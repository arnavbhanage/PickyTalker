import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

def _hit_rr(s):
    others, s0 = s[1:], s[0]
    greater, eq = int((others > s0).sum()), int((others == s0).sum())
    hit = 1.0 / (1 + eq) if greater == 0 else 0.0
    return hit, 1.0 / (1 + greater + eq / 2)


def lineup_attacks(df: pd.DataFrame, bench: pd.DataFrame, space) -> pd.DataFrame:
    """`space` must be a StyleSpace built from the SAME df (same row order)."""
    df = df.reset_index(drop=True)
    X = TfidfVectorizer(stop_words="english", min_df=2, max_features=50000,
                        sublinear_tf=True).fit_transform(df["message"].fillna(""))
    lw = df["log_words"].to_numpy()
    out = []
    for item, user, tier, neg in bench[["item_id", "user_id", "tier", "neg_ids"]].itertuples(index=False):
        cand = np.array([space.row[item]] + [space.row[x] for x in neg.split(";")])
        Xc = X[cand]
        S = (Xc @ Xc.T).toarray()
        np.fill_diagonal(S, 0.0)
        Zc = space.Z[cand]
        scores = {
            "lineup_length_center": -np.abs(lw[cand] - np.median(lw[cand])),
            "lineup_content_center": S.sum(1) / (len(cand) - 1),
            "lineup_style_center": -np.linalg.norm(Zc - Zc.mean(0), axis=1),
        }
        for name, s in scores.items():
            h, r = _hit_rr(s)
            out.append((name, tier, user, h, r))
    return pd.DataFrame(out, columns=["scorer", "tier", "user_id", "hit", "rr"])


def paired_gain(res: pd.DataFrame, a="user_style", b="population",
                n_boot: int = 1000, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    pu = res.groupby(["tier", "user_id", "scorer"])["hit"].mean().unstack("scorer")
    rows = []
    for tier, g in pu.groupby(level="tier"):
        d = (g[a] - g[b]).dropna().to_numpy()
        n = len(d)
        boots = np.array([d[rng.integers(0, n, n)].mean() for _ in range(n_boot)])
        rows.append({"tier": tier, "users": n, "mean_gain": d.mean(),
                     "ci_low": np.percentile(boots, 2.5), "ci_high": np.percentile(boots, 97.5),
                     "share_users_improved": float((d > 0).mean())})
    order = ["random", "length_matched", "content_similar", "content_and_length"]
    out = pd.DataFrame(rows)
    out["tier"] = pd.Categorical(out["tier"], order)
    return out.sort_values("tier").reset_index(drop=True)