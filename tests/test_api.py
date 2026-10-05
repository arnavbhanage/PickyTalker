from __future__ import annotations

import logging

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.backend import deps
from app.backend.main import create_app
from src.generation.nim_client import FakeLLM
from src.inference import InferenceEngine, PopulationStats


class _LinearRanker:
    def __init__(self, feature_count):
        self.weights = np.arange(1, feature_count + 1, dtype=float) / feature_count

    def predict(self, matrix):
        return np.asarray(matrix) @ self.weights


def _engine():
    names = ("log_words", "avg_sent_len", "punct_density", "n_questions",
             "n_exclam", "caps_ratio", "starts_lower", "has_newline")
    stats = PopulationStats(names, (1.5, 8, 0.1, 0.1, 0.1, 0.1, 0.3, 0),
                           (0.5, 3, 0.1, 0.3, 0.3, 0.2, 0.5, 0.2), 10)
    feature_names = [
        *(f"{prefix}_{name}" for prefix in ("z", "delta", "abs_delta", "std", "llr")
          for name in names),
        "llr_total",
        "log1p_n_history",
        "shrinkage_weight",
    ]
    return InferenceEngine(
        _LinearRanker(len(feature_names)),
        stats,
        {"artifact_version": "test", "ranker_feature_names": feature_names},
    )


@pytest.fixture
def api(monkeypatch, tmp_path):
    monkeypatch.delenv("PICKYTALKER_API_KEY", raising=False)
    monkeypatch.setenv("NVIDIA_API_KEY", "")
    monkeypatch.setenv("NIM_MODEL", "")
    application = create_app(tmp_path)
    application.dependency_overrides[deps.get_inference_engine] = _engine
    client = TestClient(application)
    with client:
        yield client, application
    application.dependency_overrides.clear()


def _history():
    return ["I can send that over today.", "Sure, I will check and reply."]


def _valid_candidates():
    return ["Sure, I will send the report today.", "I can take a look tomorrow."]


def test_health_profile_and_rank_do_not_need_llm(api):
    client, _ = api
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["llm_configured"] is False
    assert health.json()["model_name"] is None

    profile = client.post("/profile", json={"history": _history()})
    assert profile.status_code == 200
    assert profile.json()["n_messages_used"] == 2
    assert profile.json()["confidence"] == pytest.approx(2 / 12)

    ranked = client.post(
        "/rank",
        json={"history": _history(), "candidates": _valid_candidates()},
    )
    assert ranked.status_code == 200
    rows = ranked.json()["candidates"]
    assert [row["rank"] for row in rows] == [1, 2]
    for row in rows:
        assert row["style_score"] == pytest.approx(sum(row["contributions"].values()))


def test_generate_and_respond_return_candidates_and_llm_metadata(api):
    client, application = api
    fake = FakeLLM([
        '["first generated reply", "second generated reply"]',
        '["first response candidate", "second response candidate"]',
    ])
    application.dependency_overrides[deps.get_llm_client] = lambda: fake

    generated = client.post(
        "/generate",
        json={
            "history": _history(),
            "incoming": "Can you send me the report?",
            "n": 2,
            "condition": "fewshot",
        },
    )
    assert generated.status_code == 200
    assert len(generated.json()["candidates"]) == 2
    assert generated.json()["meta"]["llm_calls"] == 1
    assert generated.json()["meta"]["cached_calls"] == 0

    response = client.post(
        "/respond",
        json={
            "history": _history(),
            "incoming": "Can you send me the report?",
            "n": 2,
        },
    )
    assert response.status_code == 200
    assert response.json()["best"]["rank"] == 1
    assert len(response.json()["candidates"]) == 2
    assert response.json()["meta"]["llm_calls"] == 1
    assert fake.calls[1]["max_tokens"] == 2500


@pytest.mark.parametrize(
    "payload",
    [
        {"history": [" "]},
        {"history": ["x" * 2001]},
        {"history": ["message"] * 201},
        {"history": ["ok"], "incoming": " "},
        {"history": ["ok"], "incoming": "x" * 2001},
        {"history": ["ok"], "candidates": ["candidate"] * 11},
        {"history": ["ok"], "candidates": [" "]},
        {"history": ["ok"], "incoming": "hello", "n": 9},
        {"history": ["ok"], "incoming": "hello", "condition": "unknown"},
    ],
)
def test_validation_limits_return_422(api, payload):
    client, _ = api
    path = "/profile" if "incoming" not in payload and "candidates" not in payload else (
        "/rank" if "candidates" in payload else "/generate"
    )
    response = client.post(path, json=payload)
    assert response.status_code == 422


def test_history_is_capped_to_latest_one_hundred_messages(api, monkeypatch):
    client, _ = api
    seen = {}

    def fake_profile_from_history(history, prior_strength):
        seen["history"] = history
        return {
            "profile": {"message_count": len(history)},
            "instruction": "test",
            "n_messages_used": len(history),
            "confidence": 0.9,
        }

    from app.backend import service as backend_service

    monkeypatch.setattr(backend_service, "profile_from_history", fake_profile_from_history)
    response = client.post("/profile", json={"history": [f"message {i}" for i in range(150)]})
    assert response.status_code == 200
    assert seen["history"][0] == "message 50"
    assert len(seen["history"]) == 100


def test_api_key_is_required_for_every_non_health_endpoint(api, monkeypatch):
    client, _ = api
    monkeypatch.setenv("PICKYTALKER_API_KEY", "expected-local-secret")
    assert client.get("/health").status_code == 200
    assert client.post("/profile", json={"history": _history()}).status_code == 401
    assert client.post(
        "/profile",
        json={"history": _history()},
        headers={"X-API-Key": "wrong"},
    ).status_code == 401
    assert client.post(
        "/profile",
        json={"history": _history()},
        headers={"X-API-Key": "expected-local-secret"},
    ).status_code == 200


def test_llm_410_is_mapped_to_safe_502(api):
    client, application = api

    class UpstreamError(RuntimeError):
        status_code = 410

    application.dependency_overrides[deps.get_llm_client] = lambda: FakeLLM([
        UpstreamError("private provider detail and nvapi-sensitive-text")
    ])
    response = client.post(
        "/generate",
        json={"history": _history(), "incoming": "incoming marker", "n": 1},
    )
    assert response.status_code == 502
    assert response.json()["detail"]["upstream_status_code"] == 410
    assert "private provider detail" not in response.text
    assert "nvapi-sensitive-text" not in response.text


def test_malformed_llm_output_is_safe_502(api):
    client, application = api
    application.dependency_overrides[deps.get_llm_client] = lambda: FakeLLM(["not json"])
    response = client.post(
        "/generate",
        json={"history": _history(), "incoming": "incoming marker", "n": 1},
    )
    assert response.status_code == 502
    assert response.json()["detail"]["upstream_status_code"] is None
    assert "not json" not in response.text


def test_missing_artifacts_return_503_but_health_and_profile_work(tmp_path, monkeypatch):
    application = create_app(tmp_path)
    with TestClient(application) as client:
        assert client.get("/health").status_code == 200
        assert client.post("/profile", json={"history": _history()}).status_code == 200
        response = client.post(
            "/rank",
            json={"history": _history(), "candidates": _valid_candidates()},
        )
    assert response.status_code == 503
    assert "python -m scripts.build_artifacts" in response.json()["detail"]


def test_logs_never_include_submitted_text_or_candidate_replies(api, caplog):
    client, application = api
    application.dependency_overrides[deps.get_llm_client] = lambda: FakeLLM([
        '["generated-private-marker", "second generated reply"]'
    ])
    private_history = "history-private-marker-9ab37"
    private_incoming = "incoming-private-marker-23c8"
    private_candidate = "candidate-private-marker-4210"
    caplog.set_level(logging.INFO, logger="picky_talker.api")

    client.post("/profile", json={"history": [private_history]})
    client.post(
        "/rank",
        json={"history": [private_history], "candidates": [private_candidate]},
    )
    client.post(
        "/generate",
        json={"history": [private_history], "incoming": private_incoming, "n": 2},
    )

    logs = caplog.text
    for private_text in (
        private_history,
        private_incoming,
        private_candidate,
        "generated-private-marker",
    ):
        assert private_text not in logs


def test_cors_allows_only_localhost_origins(api):
    client, _ = api
    allowed = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:4173",
            "Access-Control-Request-Method": "GET",
        },
    )
    denied = client.options(
        "/health",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:4173"
    assert "access-control-allow-origin" not in denied.headers
