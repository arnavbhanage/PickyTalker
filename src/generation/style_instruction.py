from __future__ import annotations

import math
from typing import Sequence

import numpy as np

from src.features.extractor import extract_message


def build_profile_from_texts(texts: Sequence[str]) -> dict[str, float | int]:
    """Summarize communication style from raw message strings."""
    messages = [str(text) for text in texts if text is not None and str(text).strip()]
    if not messages:
        return {
            "message_count": 0,
            "typical_word_count": 0.0,
            "word_count_spread": 0.0,
            "question_share": 0.0,
            "exclamation_rate": 0.0,
            "starts_lower_share": 0.0,
            "newline_share": 0.0,
            "average_sentence_length": 0.0,
        }

    features = [extract_message(text) for text in messages]
    word_counts = np.asarray([row["n_words"] for row in features], dtype=float)
    return {
        "message_count": len(messages),
        "typical_word_count": float(np.median(word_counts)),
        "word_count_spread": float(np.percentile(word_counts, 75) - np.percentile(word_counts, 25)),
        "question_share": float(np.mean([row["n_questions"] > 0 for row in features])),
        "exclamation_rate": float(np.mean([row["n_exclam"] for row in features])),
        "starts_lower_share": float(np.mean([row["starts_lower"] for row in features])),
        "newline_share": float(np.mean([row["has_newline"] for row in features])),
        "average_sentence_length": float(np.mean([row["avg_sent_len"] for row in features])),
    }


def _word_band(typical: float, spread: float) -> str:
    if spread <= 0:
        low = high = max(1, int(round(typical)))
    else:
        low = max(1, int(math.floor(typical - spread / 2)))
        high = max(low, int(math.ceil(typical + spread / 2)))
    return f"about {low} to {high} words"


def _frequency_band(value: float, unit: str) -> str:
    if value < 0.10:
        return f"rarely {unit}"
    if value < 0.35:
        return f"sometimes {unit}"
    return f"often {unit}"


def instruction_from_profile(profile: dict[str, float | int]) -> str:
    """Turn measured profile values into a deterministic style instruction."""
    count = int(profile.get("message_count", 0))
    if count <= 0:
        return "Write a clear, natural reply that answers the incoming message. No reliable style history is available."
    if count < 3:
        return "Write a clear, natural reply that answers the incoming message. Style history is very limited, so do not overfit to it."

    typical = float(profile.get("typical_word_count", 0.0))
    spread = float(profile.get("word_count_spread", 0.0))
    questions = float(profile.get("question_share", 0.0))
    exclamations = float(profile.get("exclamation_rate", 0.0))
    lowercase = float(profile.get("starts_lower_share", 0.0))
    newlines = float(profile.get("newline_share", 0.0))
    sentence_length = float(profile.get("average_sentence_length", 0.0))

    parts = [
        "Write a clear reply that answers the incoming message",
        f"aim for {_word_band(typical, spread)}",
        _frequency_band(questions, "asking questions"),
        _frequency_band(exclamations, "using exclamation marks"),
        _frequency_band(lowercase, "starting messages with lowercase"),
        _frequency_band(newlines, "using line breaks"),
        f"keep sentences around {max(1, int(round(sentence_length)))} words on average",
    ]
    return "; ".join(parts) + "."
