
import re

import numpy as np
import pandas as pd
from sklearn.cluster import MiniBatchKMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from src.benchmark.build import TIERS


def _norm(s: str) -> str:
    return re.sub(r"\W+", "", str(s).lower())


def _sample_noncentral(pool: np.ndarray, target_len: float, n_neg: int,
                       lengths: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Keep the target item from landing at the median length of a lineup.

    Topic-similar negatives can otherwise cluster around the true reply's length,
    which makes a cheap centrality attack surprisingly effective. If the chosen
    negatives make the positive item the exact median, resample the pool until the
    true reply sits off-center in the lineup length distribution.
    """
    pool = np.asarray(pool, dtype=int)
    chosen = rng.choice(pool, n_neg, replace=False)
    for _ in range(50):
        cand_lengths = np.concatenate(([target_len], lengths[chosen]))
        median = np.median(cand_lengths)
        span = float(np.ptp(cand_lengths))
        if abs(target_len - median) > 0.25 * (span + 1e-9):
            return chosen
        rem = pool[~np.isin(pool, chosen)]
        if len(rem) == 0:
            return chosen
        replace_idx = int(np.argmin(np.abs(lengths[chosen] - target_len)))
        alt_idx = int(np.argmax(np.abs(lengths[rem] - target_len)))
        chosen[replace_idx] = rem[alt_idx]
    return chosen


def build_benchmark_v1(df: pd.DataFrame, n_neg: int = 9, eval_splits=("val", "test"),
                       max_items_per_user: int = 50, len_tol: float = 0.15,
                       cluster_size: int = 80, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    pool = df[df["time_split"] == "eval"].reset_index(drop=True)
    users = pool["user_id"].to_numpy()
    lw = pool["log_words"].to_numpy()
    norm = pool["message"].map(_norm).to_numpy()
    mids = pool["message_id"].to_numpy().astype(str)

    items = pool[pool["user_split"].isin(eval_splits)]
    items = items.sample(frac=1, random_state=seed).groupby("user_id").head(max_items_per_user)
    idxs = items.index.to_numpy()

    # topic clusters (symmetric blocks)
    X = TfidfVectorizer(stop_words="english", min_df=2, max_features=50000,
                        sublinear_tf=True).fit_transform(pool["message"].fillna(""))
    n_comp = max(2, min(100, X.shape[1] - 1, X.shape[0] - 1))
    Xr = normalize(TruncatedSVD(n_comp, random_state=seed).fit_transform(X))
    k = max(2, len(pool) // cluster_size)
    labels = MiniBatchKMeans(n_clusters=k, random_state=seed, n_init=3).fit_predict(Xr)
    members = {c: np.flatnonzero(labels == c) for c in range(k)}

    rows = []
    for i in idxs:
        ok = (users != users[i]) & (norm != norm[i])
        cands = {}
        all_ok = np.flatnonzero(ok)
        if len(all_ok) >= n_neg:
            cands["random"] = rng.choice(all_ok, n_neg, replace=False)

        c1 = lw[i] + rng.uniform(-len_tol, len_tol)           # jittered window centre
        len_ok = np.flatnonzero(ok & (np.abs(lw - c1) <= len_tol))
        if len(len_ok) >= n_neg:
            cands["length_matched"] = rng.choice(len_ok, n_neg, replace=False)

        cl = members[labels[i]]
        cl_ok = cl[ok[cl]]
        if len(cl_ok) >= n_neg:
            cands["content_similar"] = _sample_noncentral(cl_ok, lw[i], n_neg, lw, rng)

        c2 = lw[i] + rng.uniform(-len_tol, len_tol)
        cl_len = cl_ok[np.abs(lw[cl_ok] - c2) <= len_tol]
        if len(cl_len) >= n_neg:
            cands["content_and_length"] = rng.choice(cl_len, n_neg, replace=False)

        if len(cands) == len(TIERS):
            for tier, neg in cands.items():
                rows.append({"item_id": mids[i], "user_id": users[i], "tier": tier,
                             "neg_ids": ";".join(mids[neg])})
    return pd.DataFrame(rows, columns=["item_id", "user_id", "tier", "neg_ids"])