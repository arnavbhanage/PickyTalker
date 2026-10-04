import pandas as pd
import pytest

from src.generation.eval_items import select_eval_items


def _rows():
    return pd.DataFrame([
        {
            "message_id": "old",
            "timestamp": "2001-01-01T09:00:00Z",
            "message": "earlier history",
            "context": None,
            "user_id": "u1",
            "user_split": "val",
            "time_split": "history",
        },
        {
            "message_id": "item",
            "timestamp": "2001-01-01T10:00:00Z",
            "message": "held out reply",
            "context": "quoted incoming message",
            "user_id": "u1",
            "user_split": "val",
            "time_split": "eval",
        },
        {
            "message_id": "future",
            "timestamp": "2001-01-01T11:00:00Z",
            "message": "later message",
            "context": None,
            "user_id": "u1",
            "user_split": "val",
            "time_split": "history",
        },
        {
            "message_id": "other-user",
            "timestamp": "2001-01-01T08:00:00Z",
            "message": "other user's history",
            "context": None,
            "user_id": "u2",
            "user_split": "val",
            "time_split": "history",
        },
        {
            "message_id": "no-context",
            "timestamp": "2001-01-01T10:30:00Z",
            "message": "not eligible",
            "context": "   ",
            "user_id": "u1",
            "user_split": "test",
            "time_split": "eval",
        },
        {
            "message_id": "train-item",
            "timestamp": "2001-01-01T10:30:00Z",
            "message": "training reply",
            "context": "incoming",
            "user_id": "u3",
            "user_split": "train",
            "time_split": "eval",
        },
    ])


def test_selects_only_contextual_heldout_users_and_attaches_earlier_history():
    result = select_eval_items(_rows())

    assert result["item_id"].tolist() == ["item"]
    assert result.iloc[0]["incoming_message"] == "quoted incoming message"
    assert result.iloc[0]["real_reply"] == "held out reply"
    assert result.iloc[0]["history_texts"] == ["earlier history"]


def test_history_is_strictly_earlier_than_its_item():
    df = _rows()
    result = select_eval_items(df)
    item = df.loc[df["message_id"].eq(result.iloc[0]["item_id"])].iloc[0]
    history = df[
        df["user_id"].eq(result.iloc[0]["user_id"])
        & df["time_split"].eq("history")
        & (pd.to_datetime(df["timestamp"], utc=True) < pd.to_datetime(item["timestamp"], utc=True))
    ]

    assert result.iloc[0]["history_texts"] == history.sort_values("timestamp")["message"].tolist()
    assert "later message" not in result.iloc[0]["history_texts"]


def test_context_is_truncated_to_600_characters_and_limit_is_deterministic():
    df = _rows()
    df.loc[df["message_id"].eq("item"), "context"] = "x" * 750
    expanded = pd.concat([df] * 4, ignore_index=True)

    first = select_eval_items(expanded, max_items=2, seed=7)
    second = select_eval_items(expanded, max_items=2, seed=7)

    assert all(len(context) == 600 for context in first["incoming_message"])
    assert first["item_id"].tolist() == second["item_id"].tolist()
    assert len(first) == 2


def test_bad_eligible_timestamp_is_reported():
    df = _rows()
    df.loc[df["message_id"].eq("item"), "timestamp"] = "not-a-date"

    with pytest.raises(ValueError, match="parseable timestamps"):
        select_eval_items(df)
