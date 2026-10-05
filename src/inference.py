from __future__ import annotations

import json
import hashlib
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Sequence

import numpy as np
import pandas as pd
from lightgbm import Booster

from src.benchmark.evaluate import DEFAULT_FEATURES
from src.features.extractor import extract_message
from src.ranking.features import candidate_features


class ArtifactUnavailableError(FileNotFoundError):
    """Raised when the trained ranker or its population statistics are absent."""


@dataclass(frozen=True)
class PopulationStats:
    feature_names: tuple[str, ...]
    means: tuple[float, ...]
    standard_deviations: tuple[float, ...]
    prior_strength: float

    @classmethod
    def load(cls, path: str | Path) -> "PopulationStats":
        with Path(path).open("r", encoding="utf-8") as stream:
            payload = json.load(stream)
        stats = cls(
            feature_names=tuple(payload["feature_names"]),
            means=tuple(float(value) for value in payload["means"]),
            standard_deviations=tuple(
                float(value) for value in payload["standard_deviations"]
            ),
            prior_strength=float(payload["prior_strength"]),
        )
        if not stats.feature_names or len(stats.feature_names) != len(stats.means):
            raise ValueError("Population statistics have mismatched feature names and means.")
        if len(stats.feature_names) != len(stats.standard_deviations):
            raise ValueError("Population statistics have mismatched feature names and standard deviations.")
        if any(value <= 0 for value in stats.standard_deviations):
            raise ValueError("Population standard deviations must be positive.")
        if stats.prior_strength < 0:
            raise ValueError("Population prior strength must be non-negative.")
        return stats

    def standardize(self, rows: Sequence[dict[str, float]]) -> np.ndarray:
        values = np.asarray(
            [[float(row[name]) for name in self.feature_names] for row in rows],
            dtype=float,
        )
        means = np.asarray(self.means, dtype=float)
        deviations = np.asarray(self.standard_deviations, dtype=float)
        return (values - means) / deviations


@dataclass(frozen=True)
class ScoredCandidates:
    ranker_scores: tuple[float, ...]
    style_scores: tuple[float, ...]
    style_contributions: tuple[dict[str, float], ...]
    feature_names: tuple[str, ...]
    feature_matrix: np.ndarray


class InferenceEngine:
    def __init__(
        self,
        ranker: Booster,
        population_stats: PopulationStats,
        artifact_meta: dict,
        prior_strength: float | None = None,
    ):
        if tuple(population_stats.feature_names) != tuple(DEFAULT_FEATURES):
            raise ValueError(
                "Artifact population features do not match the ranker feature space."
            )
        self.ranker = ranker
        self.population_stats = population_stats
        self.artifact_meta = artifact_meta
        self.prior_strength = (
            population_stats.prior_strength
            if prior_strength is None
            else float(prior_strength)
        )

    @classmethod
    def load(cls, model_dir: str | Path) -> "InferenceEngine":
        model_dir = Path(model_dir)
        ranker_path = model_dir / "ranker.txt"
        stats_path = model_dir / "population_stats.json"
        metadata_path = model_dir / "artifact_meta.json"
        missing = [path.name for path in (ranker_path, stats_path, metadata_path) if not path.is_file()]
        if missing:
            raise ArtifactUnavailableError(
                "Missing model artifacts "
                f"({', '.join(missing)}). Build them with "
                "`python -m scripts.build_artifacts`."
            )
        stats = PopulationStats.load(stats_path)
        with metadata_path.open("r", encoding="utf-8") as stream:
            metadata = json.load(stream)
        return cls(Booster(model_file=str(ranker_path)), stats, metadata)

    def score_candidates(
        self,
        history: Sequence[str],
        candidates: Sequence[str],
        *,
        profile_seed: int | None = None,
    ) -> ScoredCandidates:
        if not candidates:
            raise ValueError("At least one candidate is required.")

        history_features = [extract_message(text) for text in history]
        candidate_features_raw = [extract_message(text) for text in candidates]
        history_ids = [f"history-{index}" for index in range(len(history))]
        candidate_ids = [f"candidate-{index}" for index in range(len(candidates))]
        row_ids = history_ids + candidate_ids
        all_raw_features = history_features + candidate_features_raw
        standardized = self.population_stats.standardize(all_raw_features)
        profile_user = "request-user"
        if profile_seed is None:
            history_digest = hashlib.sha256(
                "\0".join(str(text) for text in history).encode("utf-8")
            ).digest()
            profile_seed = int.from_bytes(history_digest[:8], "big", signed=False)
        history_indices = np.arange(len(history), dtype=int)
        if len(history_indices) > 10:
            history_indices = np.random.default_rng(profile_seed).choice(
                history_indices,
                size=10,
                replace=False,
            )
        space = SimpleNamespace(
            features=list(self.population_stats.feature_names),
            d=len(self.population_stats.feature_names),
            Z=standardized,
            row={message_id: index for index, message_id in enumerate(row_ids)},
            hist_idx={
                profile_user: history_indices,
            },
        )
        matrix, feature_names = candidate_features(
            space,
            profile_user,
            candidate_ids,
            m=None,
            k=self.prior_strength,
        )
        expected_names = tuple(self.artifact_meta["ranker_feature_names"])
        positions = {name: index for index, name in enumerate(feature_names)}
        missing = [name for name in expected_names if name not in positions]
        if missing:
            raise ValueError(f"Inference features are missing trained columns: {missing}")
        ordered = matrix[:, [positions[name] for name in expected_names]]
        scores = np.asarray(self.ranker.predict(ordered), dtype=float)

        style_names = [name for name in feature_names if name.startswith("llr_")]
        style_contributions = tuple(
            {
                name.removeprefix("llr_"): float(matrix[row, feature_names.index(name)])
                for name in style_names
            }
            for row in range(len(candidates))
        )
        style_scores = tuple(
            float(sum(contributions.values()))
            for contributions in style_contributions
        )
        return ScoredCandidates(
            ranker_scores=tuple(float(score) for score in scores),
            style_scores=style_scores,
            style_contributions=style_contributions,
            feature_names=expected_names,
            feature_matrix=ordered,
        )
