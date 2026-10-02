"""Scorers, metrics and the learning curve for the style-selection benchmark.

Style space: features are standardized with HISTORY-period statistics, so the
population model is a standard normal (mean 0, variance 1) by construction.
User model: diagonal Gaussian from the user's history, shrunk toward the
population with prior strength k (cold start). Score = log p(x|user) - log p(x|pop).
Known v0 limits: diagonal Gaussian (ignores feature correlations, crude for
binary/count features); the next upgrade is a learned ranker.
"""
import numpy as np
import pandas as pd

DEFAULT_FEATURES = ["log_words", "avg_sent_len", "punct_density", "n_questions",
                    "n_exclam", "caps_ratio", "starts_lower", "has_newline"]


class StyleSpace:
    def __init__(self, df: pd.DataFrame, features):
        df = df.reset_index(drop=True)
        self.features = list(features)
        X = df[self.features].to_numpy(float)
        hist = (df["time_split"] == "history").to_numpy()
        mu = X[hist].mean(0)
        sd = X[hist].std(0)
        sd[sd < 1e-9] = 1.0
        self.Z = (X - mu) / sd
        self.row = {m: i for i, m in enumerate(df["message_id"].astype(str))}
        self.hist_idx = {u: g.index.to_numpy()
                         for u, g in df[hist].groupby("user_id")}
        self.d = len(self.features)

    def user_params(self, user, m=None, k=10.0, rng=None):
        idx = self.hist_idx.get(user, np.array([], dtype=int))
        if m is not None and len(idx) > m:
            idx = rng.choice(idx, m, replace=False)
        n = len(idx)
        if n == 0:
            return np.zeros(self.d), np.ones(self.d)
        Zu = self.Z[idx]
        xbar, s2 = Zu.mean(0), Zu.var(0)
        mu = n * xbar / (n + k)                       # shrink mean toward 0
        var = np.maximum((n * s2 + k * 1.0) / (n + k), 0.05)   # shrink variance toward 1
        return mu, var


def _ll(Z, mu, var):
    return -0.5 * np.sum(np.log(var) + (Z - mu) ** 2 / var, axis=1)


def _rand(Zc, mu, var, rng, li):
    return rng.random(len(Zc))


def _population(Zc, mu, var, rng, li):
    return _ll(Zc, 0.0, 1.0)


def _user_style(Zc, mu, var, rng, li):
    return _ll(Zc, mu, var) - _ll(Zc, 0.0, 1.0)


def _user_length_only(Zc, mu, var, rng, li):
    c = Zc[:, [li]]
    return _ll(c, mu[[li]], var[[li]]) - _ll(c, 0.0, 1.0)


SCORERS = {"random": _rand, "population": _population,
           "user_length_only": _user_length_only, "user_style": _user_style}


def evaluate(space: StyleSpace, bench: pd.DataFrame, scorers=tuple(SCORERS),
             m=None, k=10.0, seed=0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    cache, out = {}, []
    li = space.features.index("log_words")
    for item_id, user, tier, neg in bench[["item_id", "user_id", "tier", "neg_ids"]].itertuples(index=False):
        cand = np.array([space.row[item_id]] + [space.row[x] for x in neg.split(";")])
        Zc = space.Z[cand]
        if user not in cache:
            cache[user] = space.user_params(user, m, k, rng)
        mu, var = cache[user]
        for name in scorers:
            s = SCORERS[name](Zc, mu, var, rng, li)
            others, s0 = s[1:], s[0]
            greater, eq = int((others > s0).sum()), int((others == s0).sum())
            hit = 1.0 / (1 + eq) if greater == 0 else 0.0     # expected hit under random tie-break
            rank = 1 + greater + eq / 2
            out.append((name, tier, user, hit, 1.0 / rank))
    return pd.DataFrame(out, columns=["scorer", "tier", "user_id", "hit", "rr"])


def summarize(res: pd.DataFrame, n_boot: int = 1000, seed: int = 0) -> pd.DataFrame:
    """Average per user first, then bootstrap over USERS for the 95% CI."""
    rng = np.random.default_rng(seed)
    pu = res.groupby(["scorer", "tier", "user_id"])[["hit", "rr"]].mean().reset_index()
    rows = []
    for (sc, t), g in pu.groupby(["scorer", "tier"]):
        a = g[["hit", "rr"]].to_numpy()
        n = len(a)
        boots = np.array([a[rng.integers(0, n, n)].mean(0) for _ in range(n_boot)])
        lo, hi = np.percentile(boots[:, 0], [2.5, 97.5])
        rows.append({"scorer": sc, "tier": t, "users": n, "recall@1": a[:, 0].mean(),
                     "ci_low": lo, "ci_high": hi, "MRR": a[:, 1].mean()})
    out = pd.DataFrame(rows)
    out["tier"] = pd.Categorical(out["tier"], ["random", "length_matched",
                                               "content_similar", "content_and_length"])
    return out.sort_values(["tier", "recall@1"], ascending=[True, False]).reset_index(drop=True)


def learning_curve(space, bench, ms=(0, 1, 3, 10, 30, 100, None), seeds=(0, 1, 2), k=10.0):
    rows = []
    for m in ms:
        for sd in seeds:
            r = evaluate(space, bench, scorers=("user_style",), m=m, k=k, seed=sd)
            for tier, v in r.groupby("tier")["hit"].mean().items():
                rows.append({"history_msgs": "all" if m is None else m, "tier": tier, "recall@1": v})
    lc = pd.DataFrame(rows).groupby(["history_msgs", "tier"], sort=False)["recall@1"].mean().unstack("tier")
    return lc[["random", "length_matched", "content_similar", "content_and_length"]]