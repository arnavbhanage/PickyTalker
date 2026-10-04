
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

pytest.importorskip("sklearn")
from src.benchmark.audit import lineup_attacks, paired_gain
from src.benchmark.build import TIERS, build_benchmark
from src.benchmark.build_v1 import build_benchmark_v1
from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace, evaluate, summarize
from src.data.splits import make_splits
from src.features.extractor import extract_frame

ROOT = Path(__file__).resolve().parents[1]
VOCAB = [f"w{i}" for i in range(80)]
SEEDS = (0, 1, 2)


def _synthetic(n_users=24, n_msgs=150, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(n_users):
        mean_len = rng.uniform(5, 25)
        p_end = rng.dirichlet([0.6, 0.6, 0.6])            # terminal '.', '?', '!'
        p_cap = rng.beta(0.5, 0.5)                         # starts with capital
        p_extra_excl = rng.beta(0.4, 1.5)                  # '!!' habit
        for i in range(n_msgs):
            n = max(2, int(rng.normal(mean_len, 2.0)))
            words = list(rng.choice(VOCAB, n)) + [f"ref{u}x{i}"]
            if rng.random() < p_cap:
                words[0] = words[0].capitalize()
            end = rng.choice([".", "?", "!"], p=p_end)
            if end == "!" and rng.random() < p_extra_excl:
                end = "!!"
            rows.append(dict(user_id=f"u{u}", message_id=f"m{u}_{i}",
                             timestamp=f"2001-01-01T{i//3600:02d}:{(i//60)%60:02d}:{i%60:02d}+00:00",
                             message=" ".join(words) + end))
    return make_splits(extract_frame(pd.DataFrame(rows)), min_msgs=100)


def _length_attack(df, bench, space):
    s = summarize(lineup_attacks(df, bench, space), n_boot=20)
    return s[(s.scorer == "lineup_length_center") & (s.tier == "length_matched")]["recall@1"].iloc[0]


@pytest.fixture(scope="module")
def runs():
    warnings.filterwarnings("ignore")
    out = []
    for sd in SEEDS:
        df = _synthetic(seed=sd)
        space = StyleSpace(df, DEFAULT_FEATURES)
        v0, v1 = build_benchmark(df, seed=0), build_benchmark_v1(df, seed=0)
        res1 = evaluate(space, v1, seed=0)
        s1 = summarize(res1, n_boot=20)
        hard = s1[s1.tier == "content_and_length"].set_index("scorer")["recall@1"]
        out.append(dict(df=df, v1=v1, res1=res1, pop=hard["population"], user=hard["user_style"],
                        att0=_length_attack(df, v0, space), att1=_length_attack(df, v1, space)))
    return out


def test_v1_negatives_valid(runs):
    df, v1 = runs[0]["df"], runs[0]["v1"]
    by_id = df.set_index("message_id")
    assert len(v1) > 0 and set(v1["tier"]) == set(TIERS)
    assert (v1.groupby("item_id")["tier"].nunique() == len(TIERS)).all()
    for item, user, neg in v1[["item_id", "user_id", "neg_ids"]].itertuples(index=False):
        for n in neg.split(";"):
            assert by_id.loc[n, "user_id"] != user and by_id.loc[n, "time_split"] == "eval"


def test_v1_removes_the_length_centrality_shortcut(runs):
    a0 = np.mean([r["att0"] for r in runs])
    a1 = np.mean([r["att1"] for r in runs])
    assert a0 > a1 + 0.04          # v0 leaked a shortcut, v1 does not
    assert a1 < 0.14               # near chance (0.10)


def test_personalization_wins_on_hardest_tier(runs):
    user = np.mean([r["user"] for r in runs])
    pop = np.mean([r["pop"] for r in runs])
    assert user > 0.30 and user > pop + 0.15 and pop < 0.16


def test_v1_lineup_length_center_stays_below_audit_gate():
    path = ROOT / "data" / "processed" / "enron_messages.csv"
    if not path.exists():
        pytest.skip(f"Enron data not present at {path}")
    df = pd.read_csv(path)
    space = StyleSpace(df, DEFAULT_FEATURES)
    bench = build_benchmark_v1(df, seed=0)
    attacks = lineup_attacks(df, bench, space)
    by_user = attacks[(attacks["scorer"] == "lineup_length_center") & (attacks["tier"] == "content_similar")].groupby("user_id")["hit"].mean()
    assert by_user.mean() < 0.14
    assert (by_user > 0.14).sum() == 0


def test_paired_gain_is_positive_and_well_formed(runs):
    g = paired_gain(runs[0]["res1"], n_boot=100)
    assert {"mean_gain", "ci_low", "ci_high"} <= set(g.columns) and len(g) == 4
    hard = g[g.tier == "content_and_length"].iloc[0]
    assert hard["mean_gain"] > 0 and hard["ci_low"] > 0