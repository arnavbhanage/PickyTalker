from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from collections import deque
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Protocol, Sequence

from dotenv import load_dotenv
from openai import OpenAI

from src.generation.strict_json import parse_strict_json_candidates


@dataclass(frozen=True)
class LLMResponse:
    text: str
    latency_s: float
    prompt_tokens: int | None
    completion_tokens: int | None
    cached: bool
    finish_reason: str | None = None


class LLMClient(Protocol):
    def chat(
        self,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: dict[str, object] | None = None,
    ) -> LLMResponse:
        ...


class FakeLLM:
    def __init__(self, responses: Sequence[str | Exception] = ()):
        self._responses = deque(responses)
        self.calls: list[dict[str, object]] = []

    def chat(
        self,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: dict[str, object] | None = None,
    ) -> LLMResponse:
        self.calls.append({
            "messages": [dict(message) for message in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": response_format,
        })
        if not self._responses:
            raise RuntimeError("FakeLLM has no queued response.")
        response = self._responses.popleft()
        if isinstance(response, Exception):
            raise response
        return LLMResponse(
            text=response,
            latency_s=0.0,
            prompt_tokens=None,
            completion_tokens=None,
            cached=False,
        )


class NimClient:
    BASE_URL = "https://integrate.api.nvidia.com/v1"
    WINDOW_S = 60.0

    def __init__(
        self,
        model: str | None = None,
        cache_path: str | Path | None = None,
        requests_per_minute: int = 30,
        max_retries: int = 3,
        backoff_seconds: float = 1.0,
        timeout_s: float = 120.0,
        cache_enabled: bool = True,
        openai_client=None,
    ):
        repo_root = Path(__file__).resolve().parents[2]
        load_dotenv(repo_root / ".env")

        api_key = os.getenv("NVIDIA_API_KEY")
        if not api_key:
            raise ValueError("NVIDIA_API_KEY must be set in the environment or local .env.")
        self.model = model or os.getenv("NIM_MODEL")
        if not self.model:
            raise ValueError("NIM_MODEL must be set in the environment or local .env.")
        if requests_per_minute < 1:
            raise ValueError("requests_per_minute must be at least 1.")
        if max_retries < 0:
            raise ValueError("max_retries must be non-negative.")
        if backoff_seconds < 0:
            raise ValueError("backoff_seconds must be non-negative.")
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive.")

        self._api_key = api_key
        self.requests_per_minute = requests_per_minute
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds
        self.timeout_s = timeout_s
        self.cache_enabled = cache_enabled
        self.cache_path = Path(cache_path) if cache_path else repo_root / "data" / "cache" / "nim_responses.jsonl"
        if self.cache_enabled:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._client = openai_client or OpenAI(
            base_url=self.BASE_URL,
            api_key=api_key,
            timeout=timeout_s,
            max_retries=0,
        )
        self._request_times: deque[float] = deque()
        self._rate_lock = threading.Lock()

    @staticmethod
    def _request_key(
        model: str,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: dict[str, object] | None = None,
    ) -> str:
        payload = {
            "model": model,
            "messages": list(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            payload["response_format"] = response_format
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def _cache_lookup(self, request_key: str) -> LLMResponse | None:
        if not self.cache_path.exists():
            return None
        with self.cache_path.open("r", encoding="utf-8") as cache_file:
            for line_number, line in enumerate(cache_file, start=1):
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON in NIM cache at line {line_number}.") from exc
                if entry.get("request_key") == request_key:
                    response = entry["response"]
                    text = response.get("text")
                    request = entry.get("request", {})
                    expected_candidates = self._expected_candidate_count(request)
                    if (
                        response.get("finish_reason") == "length"
                        or not isinstance(text, str)
                        or (
                            expected_candidates is not None
                            and self._complete_candidate_count(request, text) is None
                        )
                    ):
                        continue
                    return LLMResponse(
                        text=response["text"],
                        latency_s=response["latency_s"],
                        prompt_tokens=response.get("prompt_tokens"),
                        completion_tokens=response.get("completion_tokens"),
                        cached=True,
                        finish_reason=response.get("finish_reason"),
                    )
        return None

    def _cache_append(
        self,
        request_key: str,
        request: dict[str, object],
        response: LLMResponse,
    ) -> None:
        entry = {
            "request_key": request_key,
            "request": request,
            "response": asdict(response),
        }
        serialized = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
        if self._api_key in serialized:
            raise ValueError("Refusing to cache data containing the configured API key.")
        with self.cache_path.open("a", encoding="utf-8") as cache_file:
            cache_file.write(serialized + "\n")

    @staticmethod
    def _expected_candidate_count(request: dict[str, object]) -> int | None:
        messages = request.get("messages", [])
        prompt = "\n".join(
            str(message.get("content", ""))
            for message in messages
            if isinstance(message, dict)
        )
        import re

        match = re.search(r"Generate\s+(\d+)\s+distinct candidate replies", prompt)
        return int(match.group(1)) if match else None

    @classmethod
    def _complete_candidate_count(cls, request: dict[str, object], text: str) -> int | None:
        expected = cls._expected_candidate_count(request)
        if expected is None:
            return None
        candidates, failure_reason = parse_strict_json_candidates(text, expected)
        return expected if failure_reason is None and len(candidates) == expected else None

    def _compatible_cache_lookup(
        self,
        model: str,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: dict[str, object] | None = None,
    ) -> LLMResponse | None:
        if not self.cache_path.exists():
            return None
        matching = []
        with self.cache_path.open("r", encoding="utf-8") as cache_file:
            for line_number, line in enumerate(cache_file, start=1):
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON in NIM cache at line {line_number}.") from exc
                request = entry.get("request", {})
                if (
                    request.get("model") == model
                    and request.get("messages") == list(messages)
                    and request.get("temperature") == temperature
                    and request.get("response_format") == response_format
                    and isinstance(request.get("max_tokens"), int)
                    and request["max_tokens"] < max_tokens
                ):
                    matching.append((request["max_tokens"], entry))
        for _, entry in sorted(matching, reverse=True, key=lambda pair: pair[0]):
            response = entry.get("response", {})
            text = response.get("text")
            if not isinstance(text, str):
                continue
            if response.get("finish_reason") == "length":
                continue
            if self._complete_candidate_count(entry["request"], text) is None:
                continue
            return LLMResponse(
                text=text,
                latency_s=response["latency_s"],
                prompt_tokens=response.get("prompt_tokens"),
                completion_tokens=response.get("completion_tokens"),
                cached=True,
                finish_reason=response.get("finish_reason"),
            )
        return None

    def _acquire_rate_slot(self) -> None:
        interval = self.WINDOW_S / self.requests_per_minute
        with self._rate_lock:
            while True:
                now = time.monotonic()
                while self._request_times and now - self._request_times[0] >= self.WINDOW_S:
                    self._request_times.popleft()
                spacing_wait = (
                    self._request_times[-1] + interval - now
                    if self._request_times
                    else 0.0
                )
                capacity_wait = (
                    self._request_times[0] + self.WINDOW_S - now
                    if len(self._request_times) >= self.requests_per_minute
                    else 0.0
                )
                wait_s = max(spacing_wait, capacity_wait)
                if wait_s <= 0:
                    self._request_times.append(now)
                    return
                time.sleep(wait_s)

    def chat(
        self,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
        response_format: dict[str, object] | None = None,
    ) -> LLMResponse:
        request = {
            "model": self.model,
            "messages": [dict(message) for message in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            request["response_format"] = response_format
        request_key = self._request_key(
            self.model,
            messages,
            temperature,
            max_tokens,
            response_format=response_format,
        )
        if self.cache_enabled:
            cached_response = self._cache_lookup(request_key)
            if cached_response is not None:
                return cached_response
            cached_response = self._compatible_cache_lookup(
                self.model,
                request["messages"],
                temperature,
                max_tokens,
                response_format=response_format,
            )
            if cached_response is not None:
                return cached_response

        timeout_retries = 0
        for attempt in range(self.max_retries + 1):
            self._acquire_rate_slot()
            started = time.perf_counter()
            try:
                completion = self._client.chat.completions.create(
                    model=self.model,
                    messages=request["messages"],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format=response_format,
                )
            except Exception as exc:
                status_code = getattr(exc, "status_code", None)
                retryable = status_code == 429 or (
                    isinstance(status_code, int) and 500 <= status_code <= 599
                )
                timeout_error = type(exc).__name__ in {
                    "APITimeoutError",
                    "ConnectTimeout",
                    "ReadTimeout",
                    "Timeout",
                }
                can_retry_timeout = (
                    timeout_error
                    and timeout_retries < 1
                    and attempt < self.max_retries
                )
                if not retryable and not can_retry_timeout:
                    raise
                if retryable and attempt >= self.max_retries:
                    raise
                if can_retry_timeout:
                    timeout_retries += 1
                time.sleep(self.backoff_seconds * (2 ** min(attempt, 5)))
                continue

            latency_s = time.perf_counter() - started
            text = completion.choices[0].message.content
            if not isinstance(text, str):
                raise RuntimeError(
                    f"NIM response message.content was {type(text).__name__}, not text."
                )
            usage = completion.usage
            finish_reason = completion.choices[0].finish_reason
            response = LLMResponse(
                text=text,
                latency_s=latency_s,
                prompt_tokens=usage.prompt_tokens if usage is not None else None,
                completion_tokens=usage.completion_tokens if usage is not None else None,
                cached=False,
                finish_reason=finish_reason,
            )
            cacheable = (
                response.finish_reason != "length"
                and (
                    self._expected_candidate_count(request) is None
                    or self._complete_candidate_count(request, response.text)
                    == self._expected_candidate_count(request)
                )
            )
            if self.cache_enabled and cacheable:
                self._cache_append(request_key, request, response)
            return response
        raise RuntimeError("NIM request exited its retry loop unexpectedly.")
