from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException, Request, status

from src.generation.nim_client import NimClient
from src.inference import InferenceEngine


def get_inference_engine(request: Request) -> InferenceEngine:
    engine = getattr(request.app.state, "inference_engine", None)
    if engine is None:
        detail = getattr(
            request.app.state,
            "artifact_error",
            "Model artifacts are unavailable. Build them with `python -m scripts.build_artifacts`.",
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)
    return engine


def get_llm_client() -> NimClient | None:
    if not os.getenv("NVIDIA_API_KEY") or not os.getenv("NIM_MODEL"):
        return None
    return NimClient()


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    configured_key = os.getenv("PICKYTALKER_API_KEY")
    if configured_key and (
        x_api_key is None or not hmac.compare_digest(x_api_key, configured_key)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid X-API-Key header is required.",
        )
