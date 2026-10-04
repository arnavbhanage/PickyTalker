import numpy as np
import pandas as pd

from src.ranking.features import FEATURE_GROUPS, candidate_features

try:
    from lightgbm import LGBMRanker
except ModuleNotFoundError as exc:  # pragma: no cover - environment-specific guard
    LGBMRanker = None
    _LIGHTGBM_IMPORT_ERROR = exc
else:
    _LIGHTGBM_IMPORT_ERROR = None


def _require_lightgbm():
    if LGBMRanker is None:
        raise ModuleNotFoundError(
            "lightgbm is required for the learned ranker. Install it with "
            "`python -m pip install lightgbm`."
        ) from _LIGHTGBM_IMPORT_ERROR


def _lineup_candidates(item_id, neg_ids):
    positives = [str(item_id)]
    if isinstance(neg_ids, str) and neg_ids:
        positives.extend(str(x) for x in neg_ids.split(";"))
    return positives


def build_training_matrix(space, bench_train, m=None, k=10.0, seed=0, rng=None, drop_groups=()):
    """Build a list of lineups for LightGBM ranking.

    Each lineup contributes one positive candidate and nine negative candidates.
    The returned arrays are shaped for LightGBM's `group` API.
    """
    if rng is None:
        rng = np.random.default_rng(seed)

    Xs, ys, groups = [], [], []
    active_groups = set(drop_groups)
    for item_id, user, tier, neg_ids in bench_train[["item_id", "user_id", "tier", "neg_ids"]].itertuples(index=False):
        cand_ids = _lineup_candidates(item_id, neg_ids)
        feats, feat_names = candidate_features(space, user, cand_ids, m=m, k=k, rng=rng)
        if active_groups:
            keep = []
            for name in feat_names:
                keep_name = True
                for group in active_groups:
                    if name in FEATURE_GROUPS.get(group, []):
                        keep_name = False
                        break
                if keep_name:
                    keep.append(True)
                else:
                    keep.append(False)
            feats = feats[:, np.array(keep, dtype=bool)]
            feat_names = [n for n, ok in zip(feat_names, keep) if ok]
        Xs.append(feats)
        ys.append(np.array([1] + [0] * (len(cand_ids) - 1), dtype=float))
        groups.append(len(cand_ids))

    if not Xs:
        raise ValueError("No lineups available to build the ranker training matrix.")

    X = np.vstack(Xs)
    y = np.concatenate(ys)
    return X, y, np.array(groups, dtype=int), feat_names


def train_ranker(space, bench_train, m=None, k=10.0, seed=0, eval_set=None,
                early_stopping_rounds=25, n_estimators=200, shuffle_labels=False,
                drop_groups=()):
    """Train a shallow LGBMRanker on the training benchmark."""
    _require_lightgbm()
    X, y, groups, feat_names = build_training_matrix(
        space, bench_train, m=m, k=k, seed=seed, drop_groups=drop_groups
    )
    if shuffle_labels:
        rng = np.random.default_rng(seed)
        y = y[rng.permutation(len(y))]

    model = LGBMRanker(
        objective="lambdarank",
        metric="ndcg",
        learning_rate=0.08,
        num_leaves=7,
        max_depth=4,
        n_estimators=n_estimators,
        min_data_in_leaf=2,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=seed,
        reg_alpha=0.0,
        reg_lambda=1.0,
        verbosity=-1,
    )
    fit_kwargs = {"X": X, "y": y, "group": groups}
    if eval_set is not None:
        Xv, yv, groups_v, _ = build_training_matrix(
            space, eval_set, m=m, k=k, seed=seed + 1, drop_groups=drop_groups
        )
        fit_kwargs["eval_set"] = [(Xv, yv)]
        fit_kwargs["eval_group"] = [groups_v]
        fit_kwargs["eval_at"] = [1, 3, 5]
        fit_kwargs["early_stopping_rounds"] = early_stopping_rounds
    model.fit(**fit_kwargs)
    model.feature_names_ = feat_names
    return model


def evaluate_ranker(space, bench, model, m=None, k=10.0, seed=0, drop_groups=()):
    """Evaluate a trained ranker in the same table format used by the benchmark."""
    out = []
    rng = np.random.default_rng(seed)
    model_names = getattr(model, "feature_names_", None)
    for item_id, user, tier, neg_ids in bench[["item_id", "user_id", "tier", "neg_ids"]].itertuples(index=False):
        cand_ids = _lineup_candidates(item_id, neg_ids)
        X, _, _, feat_names = build_training_matrix(
            space, pd.DataFrame([{"item_id": item_id, "user_id": user, "tier": tier, "neg_ids": neg_ids}], columns=["item_id", "user_id", "tier", "neg_ids"]),
            m=m, k=k, seed=seed, rng=rng, drop_groups=drop_groups
        )
        if len(X) == 0:
            continue
        if model_names is not None and len(model_names) > 0:
            name_to_idx = {name: i for i, name in enumerate(feat_names)}
            order = [name_to_idx.get(name) for name in model_names]
            X = X[:, order]
        scores = model.predict(X)
        best = int(np.argmax(scores))
        others = np.asarray(scores[1:])
        s0 = scores[0]
        greater = int((others > s0).sum())
        eq = int((others == s0).sum())
        hit = 1.0 / (1 + eq) if greater == 0 else 0.0
        rank = 1 + greater + eq / 2
        out.append(("ranker", tier, user, hit, 1.0 / rank))
    return pd.DataFrame(out, columns=["scorer", "tier", "user_id", "hit", "rr"])
