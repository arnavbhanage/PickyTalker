import type { RankedCandidate, RespondResponse } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function count(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value >= 0;
}
function candidate(value: unknown): value is RankedCandidate {
  return record(value) && typeof value.candidate === "string" && Boolean(value.candidate.trim())
    && count(value.rank) && value.rank > 0 && finite(value.ranker_score) && finite(value.style_score)
    && record(value.contributions) && Object.values(value.contributions).every(finite)
    && Array.isArray(value.reasons) && value.reasons.every((reason) => typeof reason === "string");
}

// Validate the real FastAPI contract before anything is rendered. No repairs,
// invented defaults, browser reranking, or whitespace normalization.
export function isRespondResponse(value: unknown): value is RespondResponse {
  if (!record(value) || !candidate(value.best) || !Array.isArray(value.candidates)
    || !value.candidates.length || !value.candidates.every(candidate) || !record(value.meta)) return false;
  const best = value.best;
  const first = value.candidates[0];
  const meta = value.meta;
  return value.candidates.every((item, index) => item.rank === index + 1)
    && best.rank === 1 && best.candidate === first.candidate
    && best.ranker_score === first.ranker_score && best.style_score === first.style_score
    && finite(meta.latency_ms) && meta.latency_ms >= 0 && count(meta.llm_calls) && count(meta.cached_calls)
    && (meta.prompt_tokens === null || count(meta.prompt_tokens))
    && (meta.completion_tokens === null || count(meta.completion_tokens))
    && (meta.model === null || typeof meta.model === "string");
}
