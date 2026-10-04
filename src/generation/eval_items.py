from __future__ import annotations

import pandas as pd


REQUIRED_COLUMNS = {
    "message_id",
    "timestamp",
    "message",
    "context",
    "user_id",
    "user_split",
    "time_split",
}


def select_eval_items(
    df: pd.DataFrame,
    max_items: int | None = None,
    seed: int = 0,
) -> pd.DataFrame:
    """Select held-out replies with context and attach strictly earlier history."""
    missing = REQUIRED_COLUMNS.difference(df.columns)
    if missing:
        raise ValueError(f"Missing required evaluation columns: {sorted(missing)}")
    if max_items is not None and max_items < 0:
        raise ValueError("max_items must be non-negative or None.")

    data = df.copy()
    data["_parsed_timestamp"] = pd.to_datetime(data["timestamp"], utc=True, errors="coerce")
    eligible = data[
        data["user_split"].isin(["val", "test"])
        & data["time_split"].eq("eval")
        & data["context"].notna()
        & data["context"].astype(str).str.strip().ne("")
    ].copy()
    if eligible["_parsed_timestamp"].isna().any():
        raise ValueError("Eligible evaluation items must have parseable timestamps.")

    history_rows = data[data["time_split"].eq("history")].copy()
    if history_rows["_parsed_timestamp"].isna().any():
        raise ValueError("History messages must have parseable timestamps.")

    rows = []
    for _, item in eligible.iterrows():
        item_time = item["_parsed_timestamp"]
        history = history_rows[
            history_rows["user_id"].eq(item["user_id"])
            & history_rows["_parsed_timestamp"].lt(item_time)
        ].sort_values(["_parsed_timestamp", "message_id"], kind="mergesort")
        texts = [
            str(text)
            for text in history["message"].tolist()
            if pd.notna(text) and str(text).strip()
        ]
        context = str(item["context"]).strip()[:600]
        if not context:
            continue
        rows.append({
            "item_id": str(item["message_id"]),
            "user_id": item["user_id"],
            "timestamp": item["timestamp"],
            "incoming_message": context,
            "real_reply": str(item["message"]) if pd.notna(item["message"]) else "",
            "history_texts": texts,
        })

    result = pd.DataFrame(rows, columns=[
        "item_id",
        "user_id",
        "timestamp",
        "incoming_message",
        "real_reply",
        "history_texts",
    ])
    if max_items is not None and len(result) > max_items:
        result = result.sample(n=max_items, random_state=seed)
    return result.reset_index(drop=True)
