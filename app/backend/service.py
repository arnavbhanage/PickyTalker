from __future__ import annotations

import os
import time
from typing import Sequence

from fastapi import HTTPException, status

from src.backend_service import profile_from_history, rank_candidates
from src.generation.generate import generate_candidates
from src.inference import InferenceEngine


def _bounded_history(history: Sequence[str]) -> list[str]:
    return list(history[-100:])


def profile(history: Sequence[str], prior_strength: float) -> dict:
    return profile_from_history(_bounded_history(history), prior_strength)


def rank(
    engine: InferenceEngine,
    history: Sequence[str],
    candidates: Sequence[str],
) -> list[dict]:
    return rank_candidates(engine, _bounded_history(history), candidates)


def _llm_failure(exc: Exception) -> HTTPException:
    upstream_status = getattr(exc, "status_code", None)
    safe_detail = {
        "message": "The upstream language model request failed.",
        "upstream_status_code": upstream_status,
    }
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=safe_detail,
    )


def _require_llm(client):
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM is not configured; set NVIDIA_API_KEY and NIM_MODEL.",
        )


def _generate(client, history, incoming: str, n: int, condition: str) -> tuple[list[str], dict]:
    _require_llm(client)
    started = time.perf_counter()
    responses = []
    candidates = []
    for _ in range(2):
        try:
            candidates, response = generate_candidates(
                client,
                incoming_message=incoming,
                history_texts=_bounded_history(history),
                condition=condition,
                n=n,
                temperature=0.2,
                max_tokens=1200,
                return_response=True,
                strict_json=True,
            )
        except Exception as exc:
            raise _llm_failure(exc) from None
        responses.append(response)
        if len(candidates) == n:
            break
    if len(candidates) != n:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "The upstream language model returned malformed candidate output.",
                "upstream_status_code": None,
            },
        )
    latency = sum(response.latency_s for response in responses)
    if latency <= 0:
        latency = time.perf_counter() - started
    prompt_token_counts = [response.prompt_tokens for response in responses]
    completion_token_counts = [response.completion_tokens for response in responses]
    metadata = {
        "latency_ms": latency * 1000.0,
        "llm_calls": sum(not response.cached for response in responses),
        "cached_calls": sum(response.cached for response in responses),
        "prompt_tokens": (
            sum(count for count in prompt_token_counts if count is not None)
            if any(count is not None for count in prompt_token_counts)
            else None
        ),
        "completion_tokens": (
            sum(count for count in completion_token_counts if count is not None)
            if any(count is not None for count in completion_token_counts)
            else None
        ),
        "model": getattr(client, "model", None) or os.getenv("NIM_MODEL"),
    }
    return candidates, metadata


def generate(
    client,
    history: Sequence[str],
    incoming: str,
    n: int,
    condition: str,
) -> dict:
    candidates, metadata = _generate(client, history, incoming, n, condition)
    return {"candidates": candidates, "meta": metadata}


def respond(
    client,
    engine: InferenceEngine,
    history: Sequence[str],
    incoming: str,
    n: int,
) -> dict:
    candidates, metadata = _generate(client, history, incoming, n, "instruction")
    ranked = rank(engine, history, candidates)
    return {
        "best": ranked[0],
        "candidates": ranked,
        "meta": metadata,
    }
