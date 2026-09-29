"""CSV loading helpers for conversation data."""

from pathlib import Path

import pandas as pd


DEFAULT_CONVERSATIONS_PATH = Path(__file__).resolve().parents[2] / "data" / "raw" / "conversations.csv"
REQUIRED_COLUMNS = {"conversation_id", "message_id", "user_id", "timestamp", "text"}


def load_conversations(path: str | Path = DEFAULT_CONVERSATIONS_PATH) -> pd.DataFrame:
    """Load conversations and reject files that do not match the expected schema."""
    frame = pd.read_csv(path)
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(f"Conversation CSV is missing required columns: {', '.join(sorted(missing))}")
    return frame