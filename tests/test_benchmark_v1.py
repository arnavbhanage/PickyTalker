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

VOCAB = [f"w{i}" for i in range(60)]


def _synthetic(n_users=14, n_msgs=150, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(n_users):
        mean_len = 4 + 2 * u
        for i in range(n_msgs):
            n = max(2, int(rng.normal(mean_len, 1.5)))
            words = list(rng.choice(VOCAB, n)) + [f"ref{u}x{i}"]
            rows.append(dict(user_id=f"u{u}", message_id=f"m{u}_{i}",
                             timestamp=f"2001-01-01T{i//3600:02d}:{(i//60)%60:02d}:{i%60:02d}+00:00",
                             message=" ".join(words) + rng.choice([".", "?", "!"])))
    return make_splits(extract_frame(pd.DataFrame(rows)), min_msgs=100)


@pytest.fixture(scope="module")
def world():
    df = _synthetic()
    space = StyleSpace(df, DEFAULT_FEATURES)
    return df, space, build_benchmark(df, seed=0), build_benchmark_v1(df, seed=0)


def test_v1_negatives_valid(world):
    df, _, _, v1 = world
    by_id = df.set_index("message_id")
    assert len(v1) > 0 and set(v1["tier"]) == set(TIERS)
    assert (v1.groupby("item_id")["tier"].nunique() == len(TIERS)).all()
    for item, user, neg in v1[["item_id", "user_id", "neg_ids"]].itertuples(index=False):
        for n in neg.split(";"):
            assert by_id.loc[n, "user_id"] != user and by_id.loc[n, "time_split"] == "eval"


def test_v1_removes_the_length_centrality_shortcut(world):
    df, space, v0, v1 = world

    def attack(b):
        s = summarize(lineup_attacks(df, b, space), n_boot=50)
        return s[(s.scorer == "lineup_length_center") & (s.tier == "length_matched")]["recall@1"].iloc[0]

    a0, a1 = attack(v0), attack(v1)
    assert a0 > a1 + 0.05          # v0 leaked, v1 does not
    assert a1 < 0.20               # near chance (0.10)


def test_personalization_still_wins_on_v1(world):
    df, space, _, v1 = world
    s = summarize(evaluate(space, v1, seed=0), n_boot=50)
    hard = s[s.tier == "content_and_length"].set_index("scorer")["recall@1"]
    assert hard["user_style"] > 0.25 and hard["user_style"] > hard["population"]


def test_paired_gain_columns(world):
    df, space, _, v1 = world
    g = paired_gain(evaluate(space, v1, seed=0), n_boot=50)
    assert {"mean_gain", "ci_low", "ci_high"} <= set(g.columns) and len(g) == 4