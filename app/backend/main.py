from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from app.backend import deps, service
from app.backend.cors import allowed_origins
from app.backend.schemas import (
    GenerateRequest,
    GenerateResponse,
    ProfileRequest,
    ProfileResponse,
    RankRequest,
    RankResponse,
    RespondRequest,
    RespondResponse,
)
from src.inference import ArtifactUnavailableError, InferenceEngine


logger = logging.getLogger("picky_talker.api")
ROOT = Path(__file__).resolve().parents[2]


def create_app(model_dir: str | Path | None = None) -> FastAPI:
    # Middleware is configured before lifespan startup. Load local config now,
    # without overriding the environment supplied by the deployment platform.
    load_dotenv(ROOT / ".env")
    cors_origins = allowed_origins(os.getenv("PICKYTALKER_CORS_ORIGINS"))
    artifact_dir = Path(
        model_dir
        or os.getenv("PICKYTALKER_MODEL_DIR")
        or ROOT / "models"
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            app.state.inference_engine = InferenceEngine.load(artifact_dir)
            app.state.artifact_error = None
        except ArtifactUnavailableError as exc:
            app.state.inference_engine = None
            app.state.artifact_error = str(exc)
        yield

    app = FastAPI(title="PickyTalker API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
    )

    @app.middleware("http")
    async def log_request_metadata(request: Request, call_next):
        request_id = uuid.uuid4().hex
        started = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            logger.info(
                "request completed",
                extra={
                    "request_id": request_id,
                    "endpoint": request.url.path,
                    "latency_ms": (time.perf_counter() - started) * 1000.0,
                    "status": status_code,
                },
            )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        errors = [
            {
                "loc": error.get("loc", ()),
                "msg": error.get("msg", "Invalid input."),
                "type": error.get("type", "value_error"),
            }
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": errors})

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error."},
        )

    api_key_dependency = [Depends(deps.require_api_key)]

    @app.get("/health")
    def health():
        engine = getattr(app.state, "inference_engine", None)
        return {
            "status": "ok",
            "artifact_version": engine.artifact_meta.get("artifact_version") if engine else None,
            "artifacts_loaded": engine is not None,
            "llm_configured": bool(os.getenv("NVIDIA_API_KEY") and os.getenv("NIM_MODEL")),
            "model_name": os.getenv("NIM_MODEL") or None,
        }

    @app.post(
        "/profile",
        response_model=ProfileResponse,
        dependencies=api_key_dependency,
    )
    def profile_endpoint(body: ProfileRequest):
        return service.profile(
            body.history,
            prior_strength=10.0,
        )

    @app.post(
        "/rank",
        response_model=RankResponse,
        dependencies=api_key_dependency,
    )
    def rank_endpoint(
        body: RankRequest,
        engine: InferenceEngine = Depends(deps.get_inference_engine),
    ):
        return {"candidates": service.rank(engine, body.history, body.candidates)}

    @app.post(
        "/generate",
        response_model=GenerateResponse,
        dependencies=api_key_dependency,
    )
    def generate_endpoint(
        body: GenerateRequest,
        client=Depends(deps.get_llm_client),
    ):
        return service.generate(
            client,
            body.history,
            body.incoming,
            body.n,
            body.condition,
        )

    @app.post(
        "/respond",
        response_model=RespondResponse,
        dependencies=api_key_dependency,
    )
    def respond_endpoint(
        body: RespondRequest,
        client=Depends(deps.get_llm_client),
        engine: InferenceEngine = Depends(deps.get_inference_engine),
    ):
        return service.respond(
            client,
            engine,
            body.history,
            body.incoming,
            body.n,
        )

    return app


app = create_app()
