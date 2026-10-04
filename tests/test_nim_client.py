import json
import logging
import time
from types import SimpleNamespace

from src.generation.nim_client import NimClient


class _TransientError(Exception):
    def __init__(self, status_code):
        self.status_code = status_code


def _completion(text="generated reply", prompt_tokens=11, completion_tokens=4):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
        usage=SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens),
    )


class _Completions:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def create(self, **kwargs):
        self.calls += 1
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def _client(tmp_path, monkeypatch, responses, **kwargs):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key-never-log-or-cache")
    monkeypatch.setenv("NIM_MODEL", "test-model")
    completions = _Completions(responses)
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    nim = NimClient(
        cache_path=tmp_path / "cache.jsonl",
        openai_client=client,
        backoff_seconds=0,
        **kwargs,
    )
    return nim, completions


def test_cache_hit_avoids_a_second_api_call(tmp_path, monkeypatch):
    nim, completions = _client(tmp_path, monkeypatch, [_completion()])
    messages = [{"role": "user", "content": "hello"}]

    first = nim.chat(messages, temperature=0.2, max_tokens=20)
    second = nim.chat(messages, temperature=0.2, max_tokens=20)

    assert completions.calls == 1
    assert first.cached is False
    assert second.cached is True
    assert second.text == "generated reply"


def test_retries_429_then_succeeds(tmp_path, monkeypatch):
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [_TransientError(429), _completion()],
        max_retries=1,
    )

    response = nim.chat([{"role": "user", "content": "hello"}], temperature=0, max_tokens=10)

    assert completions.calls == 2
    assert response.text == "generated reply"


def test_rate_cap_spaces_requests(tmp_path, monkeypatch):
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [_completion(), _completion()],
        requests_per_minute=120,
    )
    start = time.monotonic()

    nim.chat([{"role": "user", "content": "one"}], temperature=0, max_tokens=10)
    nim.chat([{"role": "user", "content": "two"}], temperature=0, max_tokens=10)

    assert completions.calls == 2
    assert time.monotonic() - start >= 0.45


def test_usage_is_recorded_in_response_and_cache(tmp_path, monkeypatch):
    nim, _ = _client(tmp_path, monkeypatch, [_completion(prompt_tokens=13, completion_tokens=5)])

    response = nim.chat([{"role": "user", "content": "hello"}], temperature=0, max_tokens=10)
    record = json.loads((tmp_path / "cache.jsonl").read_text(encoding="utf-8"))

    assert response.prompt_tokens == 13
    assert response.completion_tokens == 5
    assert response.latency_s >= 0
    assert record["response"]["prompt_tokens"] == 13
    assert record["response"]["completion_tokens"] == 5
    assert record["request"]["messages"][0]["content"] == "hello"


def test_api_key_never_appears_in_logs_or_cache(tmp_path, monkeypatch, caplog):
    secret = "test-key-never-log-or-cache"
    nim, _ = _client(tmp_path, monkeypatch, [_completion()])

    with caplog.at_level(logging.DEBUG):
        nim.chat([{"role": "user", "content": "hello"}], temperature=0, max_tokens=10)

    cache = (tmp_path / "cache.jsonl").read_text(encoding="utf-8")
    assert secret not in caplog.text
    assert secret not in cache
