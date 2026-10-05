from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace
from src.ranking.lgbm_ranker import train_ranker
from src.ranking.train_data import build_training_lineups


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "processed" / "enron_messages.csv"
MODEL_DIR = ROOT / "models"
PRIOR_STRENGTH = 10.0
HISTORY_SAMPLE_SIZE = 10
SEED = 0


def build_artifacts(
    data_path: str | Path = DATA_PATH,
    model_dir: str | Path = MODEL_DIR,
) -> dict[str, Path]:
    data_path = Path(data_path)
    model_dir = Path(model_dir)
    if not data_path.is_file():
        raise FileNotFoundError(
            f"Processed Enron data not found at {data_path}. Run notebook 03 first."
        )

    df = pd.read_csv(data_path)
    missing = [name for name in (*DEFAULT_FEATURES, "time_split", "user_split", "user_id", "message_id") if name not in df]
    if missing:
        raise ValueError(f"Processed data is missing required columns: {missing}")

    space = StyleSpace(df, DEFAULT_FEATURES)
    train_df, train_lineups = build_training_lineups(
        df,
        n_neg=9,
        history_frac=0.7,
        seed=SEED,
    )
    ranker = train_ranker(
        space,
        train_lineups,
        m=HISTORY_SAMPLE_SIZE,
        k=PRIOR_STRENGTH,
        seed=SEED,
        n_estimators=60,
    )

    history = df.loc[df["time_split"].eq("history"), DEFAULT_FEATURES].to_numpy(dtype=float)
    means = history.mean(axis=0)
    deviations = history.std(axis=0)
    deviations[deviations < 1e-9] = 1.0
    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "ranker.txt"
    stats_path = model_dir / "population_stats.json"
    metadata_path = model_dir / "artifact_meta.json"
    ranker.booster_.save_model(str(model_path))

    stats = {
        "feature_names": list(DEFAULT_FEATURES),
        "means": means.tolist(),
        "standard_deviations": deviations.tolist(),
        "prior_strength": PRIOR_STRENGTH,
    }
    stats_path.write_text(json.dumps(stats, indent=2) + "\n", encoding="utf-8")
    git_hash = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    metadata = {
        "artifact_version": git_hash,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_data_rows": int(len(df)),
        "training_users": int(train_df["user_id"].nunique()),
        "history_rows_for_population_stats": int(len(history)),
        "history_sample_size": HISTORY_SAMPLE_SIZE,
        "prior_strength": PRIOR_STRENGTH,
        "ranker_feature_names": list(ranker.feature_names_),
        "model_file": model_path.name,
        "population_stats_file": stats_path.name,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    return {
        "ranker": model_path,
        "population_stats": stats_path,
        "metadata": metadata_path,
    }


def main() -> int:
    paths = build_artifacts()
    for name, path in paths.items():
        print(f"{name}: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
