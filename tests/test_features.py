import numpy as np
import pandas as pd

from src.benchmark.evaluate import DEFAULT_FEATURES, StyleSpace
from src.features.extractor import detokenize, extract_message
from src.ranking.features import FEATURE_GROUPS, candidate_features


def test_detokenize_dailydialog_style():
    assert detokenize("Say , Jim , how about going ?") == "Say, Jim, how about going?"
    assert detokenize("I don \u2019 t know") == "I don\u2019t know"


def test_emoji_and_question():
    f = extract_message("Yep \U0001F44D I'll send it soon.")
    assert f["n_emoji"] == 1 and f["has_emoji"] == 1
    assert extract_message("Really ?")["n_questions"] == 1


def test_empty_message_is_safe():
    f = extract_message("")
    assert f["n_words"] == 0 and f["avg_sent_len"] == 0


def test_length_ordering():
    assert extract_message("ok")["n_words"] < extract_message("ok I will send it now")["n_words"]


def _ranker_synth():
    rows = []
    for u in ["u0", "u1", "u2"]:
        for i in range(10):
            words = [f"w{j}" for j in range(5 + i % 4)]
            rows.append(
                dict(
                    user_id=u,
                    message_id=f"{u}_{i}",
                    timestamp=f"2001-01-01T00:{i:02d}:00+00:00",
                    time_split="history" if i < 7 else "eval",
                    user_split="train" if u == "u0" else "val",
                    message=" ".join(words),
                    log_words=float(len(words)),
                    avg_sent_len=float(8 + i % 4),
                    punct_density=0.2,
                    n_questions=0,
                    n_exclam=1 if i % 3 == 0 else 0,
                    caps_ratio=0.1,
                    starts_lower=1,
                    has_newline=0,
                )
            )
    return pd.DataFrame(rows)


def test_candidate_features_are_candidate_only():
    df = _ranker_synth()
    space = StyleSpace(df, DEFAULT_FEATURES)
    user = "u0"
    target = "u0_0"
    alt_a = ["u0_0", "u1_0", "u1_1"]
    alt_b = ["u0_0", "u2_0", "u2_1"]

    feat_a, names_a = candidate_features(space, user, alt_a, m=3, k=10.0, rng=np.random.default_rng(0))
    feat_b, names_b = candidate_features(space, user, alt_b, m=3, k=10.0, rng=np.random.default_rng(1))

    idx_a = alt_a.index(target)
    idx_b = alt_b.index(target)
    np.testing.assert_allclose(feat_a[idx_a], feat_b[idx_b])
    assert names_a == names_b
    assert set(FEATURE_GROUPS) >= {"raw_z", "deltas", "abs_deltas", "std_devs", "llr_parts", "history_size"}


def test_candidate_features_shape_and_history_size_fields_exist():
    df = _ranker_synth()
    space = StyleSpace(df, DEFAULT_FEATURES)
    feats, names = candidate_features(space, "u0", ["u0_0", "u1_0", "u2_0"], m=3, k=10.0)
    assert feats.shape[0] == 3
    assert feats.shape[1] == len(names)
    assert "log1p_n_history" in names
    assert "shrinkage_weight" in names