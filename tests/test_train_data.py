import numpy as np
import pandas as pd

from src.ranking.train_data import build_training_lineups


def _synthetic(n_users=12, n_msgs=80, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(n_users):
        mean_len = rng.uniform(5, 20)
        for i in range(n_msgs):
            n = max(2, int(rng.normal(mean_len, 3.0)))
            words = [f"u{u}_w{rng.integers(0, 20)}" for _ in range(n)]
            if i % 5 == 0:
                words[0] = words[0].capitalize()
            msg = " ".join(words) + ("!" if rng.random() < 0.3 else ".")
            rows.append(
                dict(
                    user_id=f"u{u}",
                    message_id=f"m{u}_{i}",
                    timestamp=f"2001-01-01T00:{i // 60:02d}:{i % 60:02d}+00:00",
                    message=msg,
                    user_split="train",
                    time_split="history" if i < 0.7 * n_msgs else "eval",
                    log_words=np.log1p(len(words)),
                    avg_sent_len=float(len(words)),
                    punct_density=0.1,
                    n_questions=0,
                    n_exclam=1 if msg.endswith("!") else 0,
                    caps_ratio=0.2,
                    starts_lower=1,
                    has_newline=0,
                )
            )
    return pd.DataFrame(rows)


def test_build_training_lineups_has_no_leakage_and_complete_tiers():
    df = _synthetic(seed=0)
    relabeled, bench = build_training_lineups(df, n_neg=3, history_frac=0.7, seed=0)

    assert list(bench.columns) == ["item_id", "user_id", "tier", "neg_ids"]
    assert set(bench["tier"]) == {"random", "length_matched", "content_similar", "content_and_length"}
    assert len(bench) > 0

    by_id = relabeled.set_index("message_id")
    for item, user, neg_ids in bench[["item_id", "user_id", "neg_ids"]].itertuples(index=False):
        item_row = by_id.loc[item]
        assert item_row["time_split"] == "eval"
        assert item_row["user_split"] == "train"
        assert item_row["user_id"] == user
        for neg in neg_ids.split(";"):
            neg_row = by_id.loc[neg]
            assert neg_row["user_id"] != user
            assert neg_row["time_split"] == "eval"
            assert neg_row["user_id"] in relabeled["user_id"].unique()

    # Profile rows used for a lineup item must be strictly earlier than the item itself.
    for user_id, g in relabeled.groupby("user_id"):
        if g.empty:
            continue
        g = g.sort_values("timestamp").reset_index(drop=True)
        eval_rows = g[g["time_split"] == "eval"]
        if eval_rows.empty:
            continue
        history_ts = g.loc[g["time_split"] == "history", "timestamp"]
        for _, row in eval_rows.iterrows():
            assert (history_ts < row["timestamp"]).any()


def test_build_training_lineups_keeps_train_users_only():
    df = _synthetic(seed=1)
    relabeled, bench = build_training_lineups(df, n_neg=2, history_frac=0.7, seed=0)

    assert relabeled["user_split"].eq("train").all()
    assert set(relabeled["time_split"]).issubset({"history", "eval"})
    assert bench["user_id"].isin(relabeled["user_id"]).all()
