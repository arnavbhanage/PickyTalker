import numpy as np
import pandas as pd


def icc1(x, groups) -> float:
    d = pd.DataFrame({"x": np.asarray(x, dtype=float), "g": np.asarray(groups)}).dropna()
    grp = d.groupby("g")["x"]
    k, n, m = grp.size(), len(d), grp.ngroups
    if m < 2 or n <= m:
        return np.nan
    ssb = (k * (grp.mean() - d["x"].mean()) ** 2).sum()
    ssw = ((d["x"] - grp.transform("mean")) ** 2).sum()
    msb, msw = ssb / (m - 1), ssw / (n - m)
    k0 = (n - (k ** 2).sum() / n) / (m - 1)
    den = msb + (k0 - 1) * msw
    return float((msb - msw) / den) if den > 0 else np.nan