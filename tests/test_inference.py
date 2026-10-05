from __future__ import annotations

import numpy as np

from src.backend_service import profile_from_history, rank_candidates
from src.features.extractor import extract_message
from src.inference import InferenceEngine, PopulationStats


class _LinearRanker:
    def __init__(self, feature_count):
        self.weights = np.arange(1, feature_count + 1, dtype=float) / feature_count

    def predict(self, matrix):
        return np.asarray(matrix) @ self.weights


def _engine():
    feature_names = ("log_words", "avg_sent_len", "punct_density", "n_questions",
                     "n_exclam", "caps_ratio", "starts_lower", "has_newline")
    stats = PopulationStats(
        feature_names=feature_names,
        means=(1.5, 8.0, 0.1, 0.1, 0.1, 0.1, 0.3, 0.0),
        standard_deviations=(0.5, 3.0, 0.1, 0.3, 0.3, 0.2, 0.5, 0.2),
        prior_strength=10.0,
    )
    names = [f"{prefix}_{feature}" for prefix in ("z", "delta", "abs_delta", "std", "llr")
             for feature in feature_names] + ["llr_total", "log1p_n_history", "shrinkage_weight"]
    metadata = {"ranker_feature_names": names}
    return InferenceEngine(_LinearRanker(len(names)), stats, metadata)


def test_population_stats_apply_saved_means_and_standard_deviations():
    engine = _engine()
    text = "Could you send the report today?"
    features = extract_message(text)
    result = engine.score_candidates([], [text])
    expected = np.asarray([
        (features[name] - mean) / sd
        for name, mean, sd in zip(
            engine.population_stats.feature_names,
            engine.population_stats.means,
            engine.population_stats.standard_deviations,
        )
    ])
    np.testing.assert_allclose(result.feature_matrix[0, :8], expected)


def test_style_score_is_sum_of_per_feature_contributions_and_candidates_rank():
    engine = _engine()
    ranked = rank_candidates(
        engine,
        ["Sure, I can help with that.", "I will send it later."],
        ["ok", "I would be happy to send the report tomorrow afternoon."],
    )
    assert [row["rank"] for row in ranked] == [1, 2]
    for row in ranked:
        assert np.isclose(row["style_score"], sum(row["contributions"].values()))
        assert len(row["reasons"]) <= 3


def test_profile_response_uses_existing_interpretable_profile_and_shrinkage():
    result = profile_from_history(["Could you send the report?", "Sure, I can send it!"], 10.0)
    assert result["n_messages_used"] == 2
    assert result["confidence"] == 2 / 12
    assert result["profile"]["message_count"] == 2
    assert result["instruction"]
