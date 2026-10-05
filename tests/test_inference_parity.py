from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace
from src.inference import InferenceEngine, PopulationStats
from src.ranking.lgbm_ranker import build_training_matrix, train_ranker


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "processed" / "enron_messages.csv"


@pytest.mark.skipif(not DATA_PATH.is_file(), reason="Processed Enron data is absent; train/serve parity needs real rows.")
def test_inference_matches_training_features_and_scores_on_real_rows():
    df = pd.read_csv(DATA_PATH)
    space = StyleSpace(df, DEFAULT_FEATURES)
    train = df[df["user_split"].eq("train")]
    train_history = train[train["time_split"].eq("history")]
    users = [
        user for user, group in train_history.groupby("user_id")
        if len(group) >= 10
    ][:4]
    user_set = set(users)
    train_eval = train[
        train["user_id"].isin(user_set) & train["time_split"].eq("eval")
    ]
    other_eval = df[
        df["time_split"].eq("eval") & ~df["user_id"].isin(user_set)
    ]
    assert len(users) == 4
    assert len(train_eval) >= 4
    assert len(other_eval) >= 9

    rng = np.random.default_rng(21)
    negative_ids = other_eval["message_id"].astype(str).to_numpy()
    lineups = []
    for row in train_eval.groupby("user_id", sort=True).head(2).itertuples(index=False):
        negatives = rng.choice(negative_ids, size=9, replace=False)
        lineups.append({
            "item_id": str(row.message_id),
            "user_id": row.user_id,
            "tier": "random",
            "neg_ids": ";".join(negatives),
        })
    benchmark = pd.DataFrame(lineups)
    model = train_ranker(
        space,
        benchmark,
        m=10,
        k=10.0,
        seed=21,
        n_estimators=12,
    )

    target = benchmark.iloc[[0]]
    training_features, _, _, feature_names = build_training_matrix(
        space,
        target,
        m=10,
        k=10.0,
        seed=21,
    )
    user = target.iloc[0]["user_id"]
    history_indices = space.hist_idx[user]
    selected_indices = np.random.default_rng(21).choice(
        history_indices, size=10, replace=False
    )
    history_texts = df.iloc[selected_indices]["message"].astype(str).tolist()
    ids = [target.iloc[0]["item_id"], *target.iloc[0]["neg_ids"].split(";")]
    candidate_texts = [
        df.iloc[space.row[mid]]["message"]
        for mid in ids
    ]
    history_population = df.loc[df["time_split"].eq("history"), DEFAULT_FEATURES]
    means = history_population.mean(axis=0).to_numpy()
    deviations = history_population.std(axis=0, ddof=0).to_numpy()
    deviations[deviations < 1e-9] = 1.0
    stats = PopulationStats(
        feature_names=tuple(DEFAULT_FEATURES),
        means=tuple(means),
        standard_deviations=tuple(deviations),
        prior_strength=10.0,
    )
    engine = InferenceEngine(
        model,
        stats,
        {"ranker_feature_names": list(model.feature_names_)},
    )
    served = engine.score_candidates(history_texts, candidate_texts)

    assert feature_names == list(engine.artifact_meta["ranker_feature_names"])
    np.testing.assert_allclose(served.feature_matrix, training_features, rtol=0, atol=1e-6)
    np.testing.assert_allclose(
        served.ranker_scores,
        model.predict(training_features),
        rtol=0,
        atol=1e-6,
    )
