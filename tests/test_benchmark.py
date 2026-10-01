import numpy as np
import pandas as pd
import pytest

pytest.importorskip("sklearn")
from src.benchmark.build import build_benchmark, TIERS
from src.benchmark.evaluate import StyleSpace, evaluate, summarize, DEFAULT_FEATURES
from src.data.splits import make_splits
from src.features.extractor import extract_frame

VOCAB = [f"w{i}" for i in range(60)]


def _synthetic(n_users=12, n_msgs=150, seed=0):
    rng = np.random.default_rng(seed)
    rows = []
    for u in range(n_users):
        mean_len = 4 + 2 * u
        for i in range(n_msgs):
            n = max(2, int(rng.normal(mean_len, 1.5)))
            words = list(rng.choice(VOCAB, n)) + [f"ref{u}x{i}"]
            rows.append(dict(user_id=f"u{u}", message_id=f"m{u}_{i}",
                             timestamp=f"2001-01-01T00:{i//60:02d}:{i%60:02d}+00:00",
                             message=" ".join(words) + rng.choice([".", "?", "!"])))
    df = extract_frame(pd.DataFrame(rows))
    return make_splits(df, min_msgs=100)


@pytest.fixture(scope="module")
def data():
    df = _synthetic()
    return df, build_benchmark(df, seed=0)


def test_negatives_are_other_users_in_eval_period(data):
    df, bench = data
    by_id = df.set_index("message_id")
    assert len(bench) > 0 and set(bench["tier"]) == set(TIERS)
    for item, user, neg in bench[["item_id", "user_id", "neg_ids"]].itertuples(index=False):
        assert by_id.loc[item, "time_split"] == "eval"
        for n in neg.split(";"):
            assert by_id.loc[n, "user_id"] != user
            assert by_id.loc[n, "time_split"] == "eval"


def test_length_matched_tiers_respect_tolerance(data):
    df, bench = data
    lw = df.set_index("message_id")["log_words"]
    for item, tier, neg in bench[["item_id", "tier", "neg_ids"]].itertuples(index=False):
        if tier in ("length_matched", "content_and_length"):
            assert all(abs(lw[n] - lw[item]) <= 0.15 + 1e-9 for n in neg.split(";"))


def test_every_item_has_all_tiers(data):
    _, bench = data
    assert (bench.groupby("item_id")["tier"].nunique() == len(TIERS)).all()


def test_personalization_beats_population_when_users_differ(data):
    df, bench = data
    space = StyleSpace(df, DEFAULT_FEATURES)
    res = evaluate(space, bench, seed=0)
    s = summarize(res, n_boot=50)
    r = s[s.tier == "random"].set_index("scorer")["recall@1"]
    assert r["user_style"] > 0.3 and r["user_style"] > r["population"]
    assert abs(r["random"] - 0.1) < 0.08           # chance level sanity check


def test_tie_handling_gives_chance_with_no_history(data):
    df, bench = data
    space = StyleSpace(df, DEFAULT_FEATURES)
    res = evaluate(space, bench, scorers=("user_style",), m=0, seed=0)
    assert abs(res["hit"].mean() - 0.1) < 1e-9     # all scores tie -> expected 1/10