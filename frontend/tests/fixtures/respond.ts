import type { RespondResponse } from "../../src/lib/types";

// Synthetic test-only data, never imported by application code.
export const replyText = "Sure — I can send it tomorrow.\n\n  Thanks  for checking! 😀\tSee you then.\n";
export function respondFixture(text = replyText): RespondResponse {
  const best = { candidate: text, rank: 1, ranker_score: 0.6, style_score: 0.7,
    contributions: { log_words: 0.1 }, reasons: ["Synthetic test reason"] };
  return { best, candidates: [best], meta: { latency_ms: 1250, llm_calls: 1,
    cached_calls: 0, prompt_tokens: null, completion_tokens: null, model: "test-model" } };
}
