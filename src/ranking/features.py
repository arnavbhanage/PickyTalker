import hashlib

import numpy as np
import pandas as pd


FEATURE_GROUPS = {
    "raw_z": [],
    "deltas": [],
    "abs_deltas": [],
    "std_devs": [],
    "llr_parts": [],
    "history_size": ["log1p_n_history", "shrinkage_weight"],
}


def _stable_user_seed(user):
    digest = hashlib.sha256(str(user).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=False)


def _profile_stats(space, user, m=None, k=10.0, rng=None):
    """Return the user mean and variance under the benchmark's profile model."""
    idx = space.hist_idx.get(user, np.array([], dtype=int))
    if m is not None and len(idx) > m:
        rng = np.random.default_rng(_stable_user_seed(user))
        idx = rng.choice(idx, m, replace=False)
    if len(idx) == 0:
        return np.zeros(space.d), np.ones(space.d)
    Zu = space.Z[idx]
    xbar, s2 = Zu.mean(0), Zu.var(0)
    mu = len(idx) * xbar / (len(idx) + k)
    var = np.maximum((len(idx) * s2 + k * 1.0) / (len(idx) + k), 0.05)
    return mu, var


def candidate_features(space, user, cand_rows, m=None, k=10.0, rng=None):
    """Build per-candidate features for a ranker.

    Parameters
    ----------
    space : src.benchmark.evaluate.StyleSpace
        Benchmark feature space built from the full dataset.
    user : str
        User id for which the profile is estimated.
    cand_rows : list-like
        Candidate message ids or row indices to score.
    m : int | None
        Optional number of history messages to sub-sample for the profile.
    k : float
        Prior strength for population shrinkage.
    rng : np.random.Generator | None
        Random generator used for subsampling history messages.

    Returns
    -------
    matrix : np.ndarray
        Shape (n_candidates, n_features), one row per candidate.
    feature_names : list[str]
        Names of the columns in the feature matrix.
    """
    if rng is None:
        rng = np.random.default_rng(_stable_user_seed(user))

    if isinstance(cand_rows, pd.DataFrame):
        cand_rows = cand_rows["message_id"].astype(str).tolist()

    mu, var = _profile_stats(space, user, m=m, k=k, rng=rng)
    z = np.stack([space.Z[space.row[str(mid)]] for mid in cand_rows], axis=0)
    delta = z - mu
    abs_delta = np.abs(delta)
    std_dev = delta / np.sqrt(np.maximum(var, 1e-8))

    llr_parts = -0.5 * (
        np.log(np.maximum(var, 1e-8))
        + (z - mu) ** 2 / np.maximum(var, 1e-8)
        - (np.log(1.0) + (z - 0.0) ** 2 / 1.0)
    )
    llr_total = llr_parts.sum(axis=1)

    n_hist = len(space.hist_idx.get(user, np.array([], dtype=int)))
    if m is not None and n_hist > m:
        n_hist = m
    shrinkage_weight = n_hist / (n_hist + k) if n_hist > 0 else 0.0

    raw_names = [f"z_{name}" for name in space.features]
    delta_names = [f"delta_{name}" for name in space.features]
    abs_names = [f"abs_delta_{name}" for name in space.features]
    std_names = [f"std_{name}" for name in space.features]
    llr_names = [f"llr_{name}" for name in space.features]
    total_names = ["llr_total", "log1p_n_history", "shrinkage_weight"]

    out = np.column_stack([
        z,
        delta,
        abs_delta,
        std_dev,
        llr_parts,
        llr_total[:, None],
        np.full(len(cand_rows), np.log1p(n_hist), dtype=float),
        np.full(len(cand_rows), shrinkage_weight, dtype=float),
    ])

    feature_names = raw_names + delta_names + abs_names + std_names + llr_names + total_names
    FEATURE_GROUPS["raw_z"] = raw_names
    FEATURE_GROUPS["deltas"] = delta_names
    FEATURE_GROUPS["abs_deltas"] = abs_names
    FEATURE_GROUPS["std_devs"] = std_names
    FEATURE_GROUPS["llr_parts"] = llr_names

    return out, feature_names
