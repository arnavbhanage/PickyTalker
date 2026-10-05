from __future__ import annotations

import json
import re


def contains_reasoning(text: str) -> bool:
    lowered = text.casefold()
    markers = (
        "<think>",
        "</think>",
        "<analysis>",
        "</analysis>",
        "<reasoning>",
        "</reasoning>",
        "analysis:",
        "reasoning:",
        "let me think",
        "let's think",
        "we need to reason",
        "here's a thinking process",
        "analyze user input",
        "analyze the request",
        "**task:**",
        "**constraints:**",
        "**incoming message:**",
        "**incoming message content:**",
        "**style instructions:**",
        "return only a json list",
    )
    return any(marker in lowered for marker in markers)


def contains_non_reply_content(text: str) -> bool:
    lowered = text.casefold().strip()
    markers = (
        "as an ai",
        "as a language model",
        "i am an ai",
        "i'm an ai",
        "here's a thinking process",
        "analyze user input",
        "analyze the request",
        "the user asks",
        "we need to generate",
        "we need to reply",
        "let's craft",
        "i should provide",
        "i will generate",
        "candidate reply",
        "response options",
        "incoming message:",
        "incoming message content:",
        "style instruction:",
        "**task:**",
        "**constraints:**",
        "**analysis:**",
    )
    return (
        any(marker in lowered for marker in markers)
        or lowered.startswith(("```", "{", "["))
        or contains_reasoning(lowered)
    )


def candidate_key(candidate: str) -> str:
    return re.sub(r"[\W_]+", "", candidate.casefold())


def parse_strict_json_candidates(
    text: str,
    n: int,
) -> tuple[list[str], str | None]:
    cleaned = text.strip()
    if not cleaned:
        return [], "empty_message_content"
    if contains_reasoning(cleaned):
        return [], "reasoning_text_in_content"
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return [], "json_parse_failure"
    if isinstance(parsed, dict) and set(parsed) == {"candidates"}:
        parsed = parsed["candidates"]
    if not isinstance(parsed, list):
        return [], "invalid_json_shape"
    if len(parsed) != n:
        return [], "candidate_count_mismatch"
    if any(not isinstance(item, str) or not item.strip() for item in parsed):
        return [], "invalid_candidate_value"
    candidates = [item.strip() for item in parsed]
    if len({candidate_key(item) for item in candidates}) != n:
        return [], "duplicate_candidates"
    if any(contains_non_reply_content(item) for item in candidates):
        return [], "non_reply_content"
    return candidates, None
