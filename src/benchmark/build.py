"""Build the style-selection benchmark.

For each held-out (time_split == 'eval') message of an evaluation user we create
a lineup: the REAL message (positive) + n_neg messages written by OTHER users
(negatives), drawn at four difficulty tiers:

  random              any other user's eval message
  length_matched      other users, similar length  (length can't give it away)
  content_similar     other users, similar topic   (topic can't give it away)
  content_and_length  both controls at once        (what's left is style)

Negatives come only from the eval period (no future/past mixing) and never from
the same user or with identical text. Only items that have ALL tiers are kept, so
tiers are compared on the same items.
"""
import re

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

TIERS = ["random", "length_matched", "content_similar", "content_and_length"]


def _norm(s: str) -> str:
    return re.sub(r"\W+", "", str(s).lower())


def build_benchmark(df: pd.DataFrame, n_neg: int = 9, eval_splits=("val", "test"),
                    max_items_per_user: int = 50, len_tol: float = 0.15,
                    top_k: int = 300, seed: int = 0, chunk: int = 400) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    pool = df[df["time_split"] == "eval"].reset_index(drop=True)
    users = pool["user_id"].to_numpy()
    lw = pool["log_words"].to_numpy()
    norm = pool["message"].map(_norm).to_numpy()
    mids = pool["message_id"].to_numpy().astype(str)

    items = pool[pool["user_split"].isin(eval_splits)]
    items = items.sample(frac=1, random_state=seed).groupby("user_id").head(max_items_per_user)
    idxs = items.index.to_numpy()

    tfidf = TfidfVectorizer(stop_words="english", min_df=2, max_features=50000,
                            sublinear_tf=True)
    Xp = tfidf.fit_transform(pool["message"].fillna(""))

    rows = []
    for s in range(0, len(idxs), chunk):
        ids = idxs[s:s + chunk]
        S = (Xp[ids] @ Xp.T).toarray()
        for r, i in enumerate(ids):
            ok = (users != users[i]) & (norm != norm[i])
            cands = {}
            all_ok = np.flatnonzero(ok)
            if len(all_ok) >= n_neg:
                cands["random"] = rng.choice(all_ok, n_neg, replace=False)
            len_ok = np.flatnonzero(ok & (np.abs(lw - lw[i]) <= len_tol))
            if len(len_ok) >= n_neg:
                cands["length_matched"] = rng.choice(len_ok, n_neg, replace=False)
            sims = np.where(ok, S[r], -np.inf)
            k = min(top_k, len(sims) - 1)
            top = np.argpartition(-sims, k)[:k] if k > 0 else np.arange(len(sims))
            top = top[np.isfinite(sims[top])]
            if len(top) >= n_neg:
                cands["content_similar"] = rng.choice(top, n_neg, replace=False)
            topl = top[np.abs(lw[top] - lw[i]) <= len_tol]
            if len(topl) >= n_neg:
                cands["content_and_length"] = rng.choice(topl, n_neg, replace=False)
            if len(cands) == len(TIERS):          # keep only complete items
                for tier, neg in cands.items():
                    rows.append({"item_id": mids[i], "user_id": users[i], "tier": tier,
                                 "neg_ids": ";".join(mids[neg])})
    return pd.DataFrame(rows, columns=["item_id", "user_id", "tier", "neg_ids"])