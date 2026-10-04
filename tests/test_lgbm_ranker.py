import numpy as np
import pandas as pd

from src.benchmark.build_v1 import build_benchmark_v1
from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace, summarize
from src.ranking.lgbm_ranker import evaluate_ranker, train_ranker


def _synthetic_ranker_data(n_users=12, n_msgs=120, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(n_users):
        base_len = 8 + u * 2
        base_punct = 0.02 + u * 0.03
        base_caps = 0.01 + u * 0.04
        for i in range(n_msgs):
            words = [f"w{rng.integers(0, 40)}" for _ in range(max(3, int(rng.normal(base_len, 2.5))))]
            msg = " ".join(words)
            if rng.random() < base_punct:
                msg += "!"
            if rng.random() < base_caps:
                msg = msg[0].upper() + msg[1:]
            rows.append(
                dict(
                    user_id=f"u{u}",
                    message_id=f"m{u}_{i}",
                    timestamp=f"2001-01-01T00:{(i // 60) % 60:02d}:{i % 60:02d}+00:00",
                    message=msg,
                    user_split="train" if u < 8 else "val",
                    time_split="history" if i < 0.7 * n_msgs else "eval",
                    log_words=float(len(words)),
                    avg_sent_len=float(len(msg) / max(1, len(words))),
                    punct_density=float(base_punct),
                    n_questions=0,
                    n_exclam=1 if msg.endswith("!") else 0,
                    caps_ratio=float(base_caps),
                    starts_lower=1,
                    has_newline=0,
                )
            )
    return pd.DataFrame(rows)


def test_lgbm_ranker_beats_chance_and_shuffled_control():
    df = _synthetic_ranker_data(seed=0)
    space = StyleSpace(df, DEFAULT_FEATURES)
    train_df = df[df["user_split"] == "train"].copy()
    bench = build_benchmark_v1(train_df, n_neg=9, eval_splits=("train",), max_items_per_user=50, seed=0)

    model = train_ranker(space, bench, m=10, k=10.0, seed=0, n_estimators=60)
    res = evaluate_ranker(space, bench, model, m=10, k=10.0, seed=0)
    summary = summarize(res, n_boot=20, seed=0)
    hard = summary[summary["tier"] == "content_and_length"].iloc[0]
    assert hard["recall@1"] > 0.20

    model_shuf = train_ranker(space, bench, m=10, k=10.0, seed=0, n_estimators=60, shuffle_labels=True)
    res_shuf = evaluate_ranker(space, bench, model_shuf, m=10, k=10.0, seed=0)
    summary_shuf = summarize(res_shuf, n_boot=20, seed=0)
    hard_shuf = summary_shuf[summary_shuf["tier"] == "content_and_length"].iloc[0]
    assert hard_shuf["recall@1"] < 0.18
