export type StyleProfile = Record<string, number>;

export interface HealthResponse {
  status: string;
  artifact_version: string | null;
  artifacts_loaded: boolean;
  llm_configured: boolean;
  model_name: string | null;
}

export interface ProfileRequest {
  history: string[];
}

export interface ProfileResponse {
  profile: StyleProfile;
  instruction: string;
  n_messages_used: number;
  confidence: number;
}

export interface RankRequest {
  history: string[];
  incoming?: string | null;
  candidates: string[];
}

export interface RankedCandidate {
  candidate: string;
  rank: number;
  ranker_score: number;
  style_score: number;
  contributions: Record<string, number>;
  reasons: string[];
}

export interface RankResponse {
  candidates: RankedCandidate[];
}

export type GenerationCondition = "neutral" | "fewshot" | "instruction";

export interface GenerateRequest {
  history: string[];
  incoming: string;
  n?: number;
  condition?: GenerationCondition;
}

export interface LlmMetadata {
  latency_ms: number;
  llm_calls: number;
  cached_calls: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  model: string | null;
}

export interface GenerateResponse {
  candidates: string[];
  meta: LlmMetadata;
}

export interface RespondRequest {
  history: string[];
  incoming: string;
  n?: number;
}

export interface RespondResponse {
  best: RankedCandidate;
  candidates: RankedCandidate[];
  meta: LlmMetadata;
}

export interface ApiValidationIssue {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export type ApiErrorDetail =
  | string
  | ApiValidationIssue[]
  | {
      message: string;
      upstream_status_code: number | null;
    };

export interface ApiErrorResponse {
  detail?: ApiErrorDetail;
}
