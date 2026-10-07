import pytest
from fastapi.testclient import TestClient

from app.backend import main
from app.backend.cors import LOCAL_ORIGINS, allowed_origins


def test_explicit_origins_normalize_and_deduplicate_without_allowing_all_vercel():
    assert allowed_origins(None) == list(LOCAL_ORIGINS)
    assert allowed_origins(" https://picky-example.vercel.app/, https://PICKY-EXAMPLE.vercel.app:443, http://localhost:4173 ") == [
        *LOCAL_ORIGINS, "https://picky-example.vercel.app", "http://localhost:4173",
    ]


@pytest.mark.parametrize("origin", [
    "*", "https://*.vercel.app", "null", "http://picky-example.vercel.app",
    "https://example.com/app", "https://user:password@example.com",
    "https://example.com?x=1", "https://example.com#fragment",
    "https://example.com:99999", "https://example.com:0",
    "https://example.com\\evil", "https://example.com\n.evil.test",
    "https://%2a.vercel.app", "https://.vercel.app", "ftp://example.com",
])
def test_invalid_or_overbroad_configuration_fails_closed(origin):
    with pytest.raises(ValueError, match="PICKYTALKER_CORS_ORIGINS"):
        allowed_origins(origin)


def test_production_preflight_simple_responses_and_rejected_origins(monkeypatch, tmp_path):
    production = "https://picky-example.vercel.app"
    monkeypatch.setenv("PICKYTALKER_CORS_ORIGINS", production)
    with TestClient(main.create_app(tmp_path)) as client:
        for origin in [*LOCAL_ORIGINS, production]:
            preflight = client.options("/respond", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-api-key,x-request-id",
            })
            assert preflight.status_code == 200
            assert preflight.headers["access-control-allow-origin"] == origin
            assert "access-control-allow-credentials" not in preflight.headers
            assert client.get("/health", headers={"Origin": origin}).headers["access-control-allow-origin"] == origin
        for origin in [
            "https://other.vercel.app", production + ".evil.test", "https://example.com",
            "http://localhost:4173", "null",
        ]:
            preflight = client.options("/respond", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
            assert preflight.status_code == 400
            assert "access-control-allow-origin" not in preflight.headers
            assert "access-control-allow-origin" not in client.get("/health", headers={"Origin": origin}).headers
        forbidden_method = client.options("/respond", headers={"Origin": production, "Access-Control-Request-Method": "DELETE"})
        assert forbidden_method.status_code == 400
        forbidden_header = client.options("/respond", headers={"Origin": production, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-unexpected"})
        assert forbidden_header.status_code == 400


def test_dotenv_is_loaded_before_cors_middleware_and_does_not_override_platform_config(monkeypatch, tmp_path):
    (tmp_path / ".env").write_text("PICKYTALKER_CORS_ORIGINS=https://from-file.vercel.app\n", encoding="utf-8")
    monkeypatch.setattr(main, "ROOT", tmp_path)
    monkeypatch.delenv("PICKYTALKER_CORS_ORIGINS", raising=False)
    local_app = main.create_app(tmp_path)
    configured = next(m.kwargs["allow_origins"] for m in local_app.user_middleware if "allow_origins" in m.kwargs)
    assert configured == [*LOCAL_ORIGINS, "https://from-file.vercel.app"]
    monkeypatch.setenv("PICKYTALKER_CORS_ORIGINS", "https://platform.vercel.app")
    platform_app = main.create_app(tmp_path)
    configured = next(m.kwargs["allow_origins"] for m in platform_app.user_middleware if "allow_origins" in m.kwargs)
    assert configured == [*LOCAL_ORIGINS, "https://platform.vercel.app"]
