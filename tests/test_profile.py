import pandas as pd

from src.profiling.user_profile import build_user_profiles


def test_build_user_profiles_aggregates_by_user():
    messages = pd.DataFrame({"user_id": ["a", "a", "b"], "text": ["Hi!", "Hello there", "ok"]})
    profiles = build_user_profiles(messages).set_index("user_id")
    assert profiles.loc["a", "mean_word_count"] == 1.5
    assert profiles.loc["b", "mean_word_count"] == 1