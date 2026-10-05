from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Message = Annotated[str, Field(min_length=1, max_length=2000)]
History = Annotated[list[Message], Field(max_length=200)]


class _HistoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    history: History

    @field_validator("history")
    @classmethod
    def history_messages_must_contain_text(cls, messages: list[str]) -> list[str]:
        if any(not message.strip() for message in messages):
            raise ValueError("History messages must not be blank.")
        return messages


class ProfileRequest(_HistoryBody):
    pass


class ProfileResponse(BaseModel):
    profile: dict[str, float | int]
    instruction: str
    n_messages_used: int
    confidence: float


class RankRequest(_HistoryBody):
    incoming: Message | None = None
    candidates: Annotated[list[Message], Field(min_length=1, max_length=10)]

    @field_validator("incoming")
    @classmethod
    def incoming_must_contain_text(cls, incoming: str | None) -> str | None:
        if incoming is not None and not incoming.strip():
            raise ValueError("Incoming message must not be blank.")
        return incoming

    @field_validator("candidates")
    @classmethod
    def candidates_must_contain_text(cls, candidates: list[str]) -> list[str]:
        if any(not candidate.strip() for candidate in candidates):
            raise ValueError("Candidates must not be blank.")
        return candidates


class RankedCandidate(BaseModel):
    candidate: str
    rank: int
    ranker_score: float
    style_score: float
    contributions: dict[str, float]
    reasons: list[str]


class RankResponse(BaseModel):
    candidates: list[RankedCandidate]


class GenerateRequest(_HistoryBody):
    incoming: Message
    n: Annotated[int, Field(ge=1, le=8)] = 5
    condition: Literal["neutral", "fewshot", "instruction"] = "instruction"

    @field_validator("incoming")
    @classmethod
    def incoming_must_contain_text(cls, incoming: str) -> str:
        if not incoming.strip():
            raise ValueError("Incoming message must not be blank.")
        return incoming


class LLMMetadata(BaseModel):
    latency_ms: float
    llm_calls: int
    cached_calls: int
    prompt_tokens: int | None
    completion_tokens: int | None
    model: str | None


class GenerateResponse(BaseModel):
    candidates: list[str]
    meta: LLMMetadata


class RespondRequest(_HistoryBody):
    incoming: Message
    n: Annotated[int, Field(ge=1, le=8)] = 5

    @field_validator("incoming")
    @classmethod
    def incoming_must_contain_text(cls, incoming: str) -> str:
        if not incoming.strip():
            raise ValueError("Incoming message must not be blank.")
        return incoming


class RespondResponse(BaseModel):
    best: RankedCandidate
    candidates: list[RankedCandidate]
    meta: LLMMetadata
