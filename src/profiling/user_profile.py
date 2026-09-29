"""Aggregate message-level style features into per-user profiles."""

import pandas as pd

from src.features.extractor import extract_style_features


PROFILE_FEATURES = ["text_length", "word_count", "emoji_count", "formality_score"]


def build_user_profiles(messages: pd.DataFrame) -> pd.DataFrame:
    if "user_id" not in messages or "text" not in messages:
        raise ValueError("messages must contain 'user_id' and 'text' columns")
    records = []
    for row in messages[["user_id", "text"]].itertuples(index=False):
        records.append({"user_id": row.user_id, **extract_style_features(row.text)})
    if not records:
        return pd.DataFrame(columns=["user_id", *[f"mean_{name}" for name in PROFILE_FEATURES]])
    return (
        pd.DataFrame(records)
        .groupby("user_id", as_index=False)[PROFILE_FEATURES]
        .mean()
        .rename(columns={name: f"mean_{name}" for name in PROFILE_FEATURES})
    )