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


@dataclass(frozen=True)
class LLMResponse:
    text: str
    latency_s: float
    prompt_tokens: int | None
    completion_tokens: int | None
    cached: bool


class LLMClient(Protocol):
    def chat(
        self,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
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
    ) -> LLMResponse:
        self.calls.append({
            "messages": [dict(message) for message in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
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

        self._api_key = api_key
        self.requests_per_minute = requests_per_minute
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds
        self.cache_path = Path(cache_path) if cache_path else repo_root / "data" / "cache" / "nim_responses.jsonl"
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._client = openai_client or OpenAI(base_url=self.BASE_URL, api_key=api_key)
        self._request_times: deque[float] = deque()
        self._rate_lock = threading.Lock()

    @staticmethod
    def _request_key(
        model: str,
        messages: Sequence[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        payload = {
            "model": model,
            "messages": list(messages),
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
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
                    return LLMResponse(
                        text=response["text"],
                        latency_s=response["latency_s"],
                        prompt_tokens=response.get("prompt_tokens"),
                        completion_tokens=response.get("completion_tokens"),
                        cached=True,
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
    ) -> LLMResponse:
        request = {
            "model": self.model,
            "messages": [dict(message) for message in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        request_key = self._request_key(self.model, messages, temperature, max_tokens)
        cached_response = self._cache_lookup(request_key)
        if cached_response is not None:
            return cached_response

        for attempt in range(self.max_retries + 1):
            self._acquire_rate_slot()
            started = time.perf_counter()
            try:
                completion = self._client.chat.completions.create(
                    model=self.model,
                    messages=request["messages"],
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except Exception as exc:
                status_code = getattr(exc, "status_code", None)
                retryable = status_code == 429 or (
                    isinstance(status_code, int) and 500 <= status_code <= 599
                )
                if not retryable or attempt >= self.max_retries:
                    raise
                time.sleep(self.backoff_seconds * (2 ** attempt))
                continue

            latency_s = time.perf_counter() - started
            text = completion.choices[0].message.content
            if not isinstance(text, str):
                raise RuntimeError("NIM response did not contain text content.")
            usage = completion.usage
            response = LLMResponse(
                text=text,
                latency_s=latency_s,
                prompt_tokens=usage.prompt_tokens if usage is not None else None,
                completion_tokens=usage.completion_tokens if usage is not None else None,
                cached=False,
            )
            self._cache_append(request_key, request, response)
            return response
        raise RuntimeError("NIM request exited its retry loop unexpectedly.")
