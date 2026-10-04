import numpy as np
import pandas as pd

from src.benchmark.build_v1 import build_benchmark_v1


def build_training_lineups(df: pd.DataFrame, n_neg: int = 9, history_frac: float = 0.7,
                          seed: int = 0):
    """Relabel train users so the first 70% is history and the last 30% is eval.

    Returns a relabeled training dataframe and the benchmark lineups built from the
    relabeled eval rows. The relabeling guarantees that any profile message used for
    a training lineup is strictly earlier than the lineup's positive message.
    """
    if not 0.0 < history_frac < 1.0:
        raise ValueError(f"history_frac must be in (0, 1), got {history_frac!r}")

    train_users = df.loc[df["user_split"].eq("train"), "user_id"].dropna().unique()
    if len(train_users) == 0:
        raise ValueError("No train users available to relabel.")

    relabeled_frames = []
    for user_id in train_users:
        g = df[df["user_id"] == user_id].copy()
        if len(g) < 2:
            continue

        g = g.sort_values(["timestamp", "message_id"], kind="mergesort").reset_index(drop=True)
        cut = int(np.floor(len(g) * history_frac))
        cut = max(1, min(len(g) - 1, cut))
        g.loc[:cut - 1, "time_split"] = "history"
        g.loc[cut:, "time_split"] = "eval"
        g["user_split"] = "train"
        relabeled_frames.append(g)

    if not relabeled_frames:
        raise ValueError("No train users had enough rows to build relabeled history/eval splits.")

    train_df_relabeled = pd.concat(relabeled_frames, ignore_index=True).sort_values(
        ["user_id", "timestamp", "message_id"], kind="mergesort"
    ).reset_index(drop=True)

    bench_train = build_benchmark_v1(train_df_relabeled, n_neg=n_neg, eval_splits=("train",), seed=seed)
    return train_df_relabeled, bench_train
