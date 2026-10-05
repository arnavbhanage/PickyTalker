from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from src.benchmark.audit import paired_gain
from src.benchmark.evaluate import (
    DEFAULT_FEATURES,
    StyleSpace,
    evaluate,
    learning_curve,
    summarize,
)
from src.inference import InferenceEngine
from src.ranking.lgbm_ranker import (
    build_training_matrix,
    evaluate_ranker,
    train_ranker,
)
from src.ranking.train_data import build_training_lineups


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "processed" / "enron_messages.csv"
BENCHMARK_PATH = ROOT / "data" / "processed" / "benchmark_v1.csv"
MODEL_DIR = ROOT / "models"
FINDINGS_DIR = ROOT / "docs" / "findings"
SEED = 0
PRIOR_STRENGTH = 10.0
HISTORY_SAMPLE_SIZE = 10
N_ESTIMATORS = 60


def _save(frame: pd.DataFrame, name: str) -> None:
    FINDINGS_DIR.mkdir(parents=True, exist_ok=True)
    frame.to_csv(FINDINGS_DIR / name, index=False)


def _feature_importance(engine) -> pd.DataFrame:
    names = engine.artifact_meta["ranker_feature_names"]
    gain = engine.ranker.feature_importance(importance_type="gain")
    split = engine.ranker.feature_importance(importance_type="split")
    return pd.DataFrame({
        "feature": names,
        "gain": gain,
        "split_count": split,
    }).sort_values(["gain", "split_count"], ascending=False)


def _feature_correlations(space, benchmark: pd.DataFrame) -> pd.DataFrame:
    hard = benchmark[benchmark["tier"].eq("content_and_length")]
    sample = hard.sample(min(150, len(hard)), random_state=SEED)
    matrix, _, _, names = build_training_matrix(
        space,
        sample,
        m=HISTORY_SAMPLE_SIZE,
        k=PRIOR_STRENGTH,
        seed=SEED,
    )
    correlations = np.corrcoef(matrix, rowvar=False)
    pairs = []
    for left in range(len(names)):
        for right in range(left + 1, len(names)):
            value = float(correlations[left, right])
            if np.isfinite(value) and abs(value) >= 0.98:
                pairs.append({
                    "feature_a": names[left],
                    "feature_b": names[right],
                    "pearson_r": value,
                    "absolute_r": abs(value),
                })
    return pd.DataFrame(
        pairs,
        columns=["feature_a", "feature_b", "pearson_r", "absolute_r"],
    ).sort_values("absolute_r", ascending=False)


def _history_bins(df: pd.DataFrame, results: pd.DataFrame) -> pd.DataFrame:
    history = (
        df[df["time_split"].eq("history")]
        .groupby("user_id")
        .size()
        .rename("available_history")
        .reset_index()
    )
    history = history[history["user_id"].isin(results["user_id"].unique())]
    history["history_bin"] = pd.qcut(
        history["available_history"].rank(method="first"),
        q=3,
        labels=["low", "medium", "high"],
    ).astype(str)
    per_user = (
        results.groupby(["user_id", "scorer", "tier"])["hit"]
        .mean()
        .reset_index()
        .merge(history, on="user_id", how="left")
    )
    rows = []
    for (scorer, tier, history_bin), group in per_user.groupby(
        ["scorer", "tier", "history_bin"], observed=True, sort=True
    ):
        values = group["hit"].to_numpy(dtype=float)
        rng = np.random.default_rng(SEED)
        bootstrap = np.asarray([
            values[rng.integers(0, len(values), len(values))].mean()
            for _ in range(1000)
        ])
        rows.append({
            "scorer": scorer,
            "tier": tier,
            "history_bin": history_bin,
            "users": len(values),
            "min_history_messages": int(group["available_history"].min()),
            "median_history_messages": float(group["available_history"].median()),
            "max_history_messages": int(group["available_history"].max()),
            "recall_at_1": float(values.mean()),
            "ci_low": float(np.percentile(bootstrap, 2.5)),
            "ci_high": float(np.percentile(bootstrap, 97.5)),
        })
    return pd.DataFrame(rows)


def _training_experiments(
    df: pd.DataFrame,
    space: StyleSpace,
    benchmark: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    _, train_lineups = build_training_lineups(
        df,
        n_neg=9,
        history_frac=0.7,
        seed=SEED,
    )
    train_users = sorted(train_lineups["user_id"].dropna().unique().tolist())
    rng = np.random.default_rng(SEED)
    shuffled_users = list(np.asarray(train_users, dtype=object)[rng.permutation(len(train_users))])
    validation_users = set(df.loc[df["user_split"].eq("val"), "user_id"].unique())
    validation = benchmark[
        benchmark["tier"].eq("content_and_length")
        & benchmark["user_id"].isin(validation_users)
    ]
    baselines = evaluate(
        space,
        validation,
        scorers=("population", "user_style"),
        m=HISTORY_SAMPLE_SIZE,
        k=PRIOR_STRENGTH,
        seed=SEED,
    )
    size_rows = []
    ablation_rows = []
    for fraction in (0.25, 0.5, 1.0):
        n_users = max(1, int(np.ceil(len(shuffled_users) * fraction)))
        selected = set(shuffled_users[:n_users])
        subset = train_lineups[train_lineups["user_id"].isin(selected)]
        model = train_ranker(
            space,
            subset,
            m=HISTORY_SAMPLE_SIZE,
            k=PRIOR_STRENGTH,
            seed=SEED,
            n_estimators=N_ESTIMATORS,
        )
        ranked = evaluate_ranker(
            space,
            validation,
            model,
            m=HISTORY_SAMPLE_SIZE,
            k=PRIOR_STRENGTH,
            seed=SEED,
        )
        combined = pd.concat([baselines, ranked], ignore_index=True)
        summary = summarize(combined, n_boot=1000, seed=SEED)
        for _, row in summary.iterrows():
            size_rows.append({
                "training_user_fraction": fraction,
                "training_users": n_users,
                "training_lineups": len(subset),
                "scorer": row["scorer"],
                "tier": row["tier"],
                "recall_at_1": row["recall@1"],
                "ci_low": row["ci_low"],
                "ci_high": row["ci_high"],
                "mrr": row["MRR"],
            })
        if fraction == 1.0:
            ablated = train_ranker(
                space,
                train_lineups,
                m=HISTORY_SAMPLE_SIZE,
                k=PRIOR_STRENGTH,
                seed=SEED,
                n_estimators=N_ESTIMATORS,
                drop_groups=("llr_parts",),
            )
            ablation_result = evaluate_ranker(
                space,
                validation,
                ablated,
                m=HISTORY_SAMPLE_SIZE,
                k=PRIOR_STRENGTH,
                seed=SEED,
                drop_groups=("llr_parts",),
            )
            row = summarize(ablation_result, n_boot=1000, seed=SEED).iloc[0]
            ablation_rows.append({
                "experiment": "drop_per_feature_llrs_keep_total_llr",
                "training_users": len(train_users),
                "training_lineups": len(train_lineups),
                "validation_users": int(row["users"]),
                "tier": row["tier"],
                "recall_at_1": float(row["recall@1"]),
                "ci_low": float(row["ci_low"]),
                "ci_high": float(row["ci_high"]),
                "mrr": float(row["MRR"]),
            })
    return pd.DataFrame(size_rows), pd.DataFrame(ablation_rows)


def main() -> int:
    df = pd.read_csv(DATA_PATH)
    benchmark = pd.read_csv(BENCHMARK_PATH)
    space = StyleSpace(df, DEFAULT_FEATURES)
    engine = InferenceEngine.load(MODEL_DIR)

    baseline = evaluate(
        space,
        benchmark,
        scorers=("random", "population", "user_style"),
        m=HISTORY_SAMPLE_SIZE,
        k=PRIOR_STRENGTH,
        seed=SEED,
    )
    ranker = evaluate_ranker(
        space,
        benchmark,
        engine.ranker,
        m=HISTORY_SAMPLE_SIZE,
        k=PRIOR_STRENGTH,
        seed=SEED,
    )
    results = pd.concat([baseline, ranker], ignore_index=True)
    summary = summarize(results, n_boot=1000, seed=SEED)
    _save(results, "06_ranker_comparison_eval.csv")
    _save(summary, "06_ranker_comparison_summary.csv")
    _save(
        paired_gain(results, a="ranker", b="user_style", n_boot=1000, seed=SEED),
        "06_ranker_paired_gain.csv",
    )

    user_splits = (
        df[["user_id", "user_split"]]
        .drop_duplicates()
        .set_index("user_id")["user_split"]
    )
    split_results = results.copy()
    split_results["user_split"] = split_results["user_id"].map(user_splits)
    split_user = (
        split_results.groupby(["user_split", "scorer", "tier", "user_id"])["hit"]
        .mean()
        .reset_index()
    )
    split_summary = (
        split_user.groupby(["user_split", "scorer", "tier"])["hit"]
        .agg(users="count", recall_at_1="mean")
        .reset_index()
    )
    _save(split_summary, "06_ranker_validation_test.csv")

    importance = _feature_importance(engine)
    _save(importance, "06_ranker_feature_importance.csv")
    _save(_feature_correlations(space, benchmark), "06_ranker_feature_correlations.csv")
    _save(_history_bins(df, results), "06_ranker_history_bins.csv")
    _save(
        learning_curve(
            space,
            benchmark,
            ms=(0, 1, 3, 10, 30, 100, None),
            seeds=(0, 1, 2),
            k=PRIOR_STRENGTH,
        ).reset_index(),
        "06_ranker_history_learning_curve.csv",
    )
    training_size, ablation = _training_experiments(df, space, benchmark)
    _save(training_size, "06_ranker_training_size.csv")
    _save(ablation, "06_ranker_ablation.csv")

    hardest = summary[summary["tier"].eq("content_and_length")][
        ["scorer", "users", "recall@1", "ci_low", "ci_high", "MRR"]
    ]
    print("Measured ranker comparison on the v1 benchmark (hardest tier):")
    print(hardest.to_string(index=False))
    print("\nTop ranker features by gain:")
    print(importance.head(10).to_string(index=False))
    print(f"\nFeature pairs with |Pearson r| >= 0.98: {len(pd.read_csv(FINDINGS_DIR / '06_ranker_feature_correlations.csv'))}")
    print("\nTraining-size comparisons on validation users:")
    print(training_size.to_string(index=False))
    print("\nPer-feature LLR ablation (total LLR retained):")
    print(ablation.to_string(index=False))
    print(f"\nSaved analysis tables under {FINDINGS_DIR}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
