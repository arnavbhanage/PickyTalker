import json
import logging
import time
from types import SimpleNamespace

from src.generation.nim_client import NimClient


class _TransientError(Exception):
    def __init__(self, status_code):
        self.status_code = status_code


class APITimeoutError(Exception):
    pass


def _completion(
    text="generated reply",
    prompt_tokens=11,
    completion_tokens=4,
    finish_reason="stop",
    reasoning=None,
):
    message = SimpleNamespace(content=text)
    if reasoning is not None:
        message.reasoning = reasoning
    return SimpleNamespace(
        choices=[SimpleNamespace(message=message, finish_reason=finish_reason)],
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
    cache_path = kwargs.pop("cache_path", tmp_path / "cache.jsonl")
    nim = NimClient(
        cache_path=cache_path,
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
    assert second.finish_reason == "stop"


def test_only_message_content_is_saved_not_separate_reasoning(tmp_path, monkeypatch):
    content = '{"candidates":["hello","hi"]}'
    nim, _ = _client(
        tmp_path,
        monkeypatch,
        [_completion(text=content, reasoning="<think>private analysis</think>")],
    )

    response = nim.chat(
        [{"role": "user", "content": "generate JSON"}],
        temperature=0,
        max_tokens=20,
        response_format={"type": "json_object"},
    )
    cached = json.loads((tmp_path / "cache.jsonl").read_text(encoding="utf-8"))

    assert response.text == content
    assert cached["response"]["text"] == content
    assert "private analysis" not in cached["response"]["text"]


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


def test_retries_5xx_then_succeeds(tmp_path, monkeypatch):
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [_TransientError(503), _completion()],
        max_retries=1,
    )

    response = nim.chat([{"role": "user", "content": "hello"}], temperature=0, max_tokens=10)

    assert completions.calls == 2
    assert response.text == "generated reply"


def test_retries_one_timeout_then_succeeds(tmp_path, monkeypatch):
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [APITimeoutError("timeout"), _completion()],
        max_retries=2,
    )
    response = nim.chat([{"role": "user", "content": "hello"}], 0, 10)
    assert response.text == "generated reply"
    assert completions.calls == 2


def test_does_not_retry_retired_model_410(tmp_path, monkeypatch):
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [_TransientError(410), _completion()],
        max_retries=3,
    )
    try:
        nim.chat([{"role": "user", "content": "hello"}], 0, 10)
    except _TransientError as exc:
        assert exc.status_code == 410
    else:
        raise AssertionError("A retired-model response should be raised.")
    assert completions.calls == 1


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
    assert record["response"]["finish_reason"] == "stop"
    assert record["request"]["messages"][0]["content"] == "hello"


def test_complete_lower_budget_json_response_is_reused_but_truncated_response_is_not(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("NVIDIA_API_KEY", "test-key-never-log-or-cache")
    monkeypatch.setenv("NIM_MODEL", "test-model")
    messages = [{"role": "user", "content": "Generate 2 distinct candidate replies."}]
    cache_path = tmp_path / "cache.jsonl"
    old_client, old_calls = _client(
        tmp_path,
        monkeypatch,
        [_completion(text='["one", "two"]')],
        cache_path=cache_path,
    )
    old_client.chat(messages, temperature=0.2, max_tokens=1500)

    completions = _Completions([_completion(text='["one", "two", "three"]')])
    client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    upgraded = NimClient(
        cache_path=cache_path,
        openai_client=client,
        backoff_seconds=0,
    )
    cached = upgraded.chat(messages, temperature=0.2, max_tokens=2500)
    assert cached.cached is True
    assert completions.calls == 0

    truncated_path = tmp_path / "truncated.jsonl"
    truncated_client, _ = _client(
        tmp_path,
        monkeypatch,
        [_completion(text='["one", "unfinished')],
        cache_path=truncated_path,
    )
    truncated_client.chat(messages, temperature=0.2, max_tokens=1500)
    fresh_completions = _Completions([_completion(text='["one", "two"]')])
    fresh = NimClient(
        cache_path=truncated_path,
        openai_client=SimpleNamespace(chat=SimpleNamespace(completions=fresh_completions)),
        backoff_seconds=0,
    )
    result = fresh.chat(messages, temperature=0.2, max_tokens=2500)
    assert result.cached is False
    assert fresh_completions.calls == 1


def test_exact_budget_truncated_response_is_not_reused(tmp_path, monkeypatch):
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [
            _completion(text='["one", "unfinished', finish_reason="length"),
            _completion(text='["one", "two"]'),
        ],
    )
    messages = [{"role": "user", "content": "Generate 2 distinct candidate replies."}]

    first = nim.chat(messages, temperature=0, max_tokens=2500)
    second = nim.chat(messages, temperature=0, max_tokens=2500)

    assert first.finish_reason == "length"
    assert second.cached is False
    assert second.text == '["one", "two"]'
    assert completions.calls == 2


def test_api_key_never_appears_in_logs_or_cache(tmp_path, monkeypatch, caplog):
    secret = "test-key-never-log-or-cache"
    nim, _ = _client(tmp_path, monkeypatch, [_completion()])

    with caplog.at_level(logging.DEBUG):
        nim.chat([{"role": "user", "content": "hello"}], temperature=0, max_tokens=10)

    cache = (tmp_path / "cache.jsonl").read_text(encoding="utf-8")
    assert secret not in caplog.text
    assert secret not in cache


def test_cache_can_be_disabled_for_stateless_api_requests(tmp_path, monkeypatch):
    cache_path = tmp_path / "private" / "cache.jsonl"
    nim, completions = _client(
        tmp_path,
        monkeypatch,
        [_completion(), _completion()],
        cache_path=cache_path,
        cache_enabled=False,
    )

    first = nim.chat([{"role": "user", "content": "private history"}], 0, 10)
    second = nim.chat([{"role": "user", "content": "private history"}], 0, 10)

    assert completions.calls == 2
    assert first.cached is False and second.cached is False
    assert not cache_path.exists()
