"""Basic message cleanup and filtering."""

import pandas as pd


def preprocess_messages(frame: pd.DataFrame) -> pd.DataFrame:
    """Normalize text and remove rows without a usable user or message."""
    cleaned = frame.copy()
    cleaned["text"] = cleaned["text"].fillna("").astype(str).str.strip()
    cleaned["user_id"] = cleaned["user_id"].fillna("").astype(str).str.strip()
    return cleaned.loc[(cleaned["text"] != "") & (cleaned["user_id"] != "")].reset_index(drop=True)