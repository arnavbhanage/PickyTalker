"""User-level and time-level splits.

user_split : which users are train / val / test  (tests cold-start generalization)
time_split : within each user, earliest (1-eval_frac) = 'history', rest = 'eval'
             (we never use the future to describe the past)
"""
import numpy as np
import pandas as pd


def make_splits(df: pd.DataFrame, min_msgs: int = 100,
                user_frac=(0.7, 0.15, 0.15), eval_frac: float = 0.2, seed: int = 0):
    df = df.sort_values(["user_id", "timestamp"]).copy()
    counts = df.groupby("user_id").size()
    keep = counts[counts >= min_msgs].index
    df = df[df["user_id"].isin(keep)].copy()

    users = np.array(sorted(keep))
    np.random.default_rng(seed).shuffle(users)
    n_tr = int(len(users) * user_frac[0])
    n_va = int(len(users) * user_frac[1])
    split_of = {u: "train" for u in users[:n_tr]}
    split_of.update({u: "val" for u in users[n_tr:n_tr + n_va]})
    split_of.update({u: "test" for u in users[n_tr + n_va:]})
    df["user_split"] = df["user_id"].map(split_of)

    pos = df.groupby("user_id").cumcount() / df.groupby("user_id")["user_id"].transform("size")
    df["time_split"] = np.where(pos >= 1 - eval_frac, "eval", "history")
    return df.reset_index(drop=True)