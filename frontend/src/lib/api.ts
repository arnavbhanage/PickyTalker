import { API_CONFIG } from "@/lib/config";
import { isRespondResponse } from "@/lib/response-validation";
import type {
  ApiErrorResponse,
  GenerateRequest,
  GenerateResponse,
  HealthResponse,
  ProfileRequest,
  ProfileResponse,
  RankRequest,
  RankResponse,
  RespondRequest,
  RespondResponse,
} from "@/lib/types";

export type ApiErrorKind =
  | "backend_unavailable"
  | "timeout"
  | "cancelled"
  | "unauthorized"
  | "provider_unavailable"
  | "malformed_generation"
  | "validation"
  | "insufficient_history"
  | "no_candidates"
  | "unexpected";

export class PickyTalkerApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status: number | null = null,
    public readonly details?: ApiErrorResponse,
  ) {
    super(message);
    this.name = "PickyTalkerApiError";
  }
}

type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

function errorKind(status: number, payload: ApiErrorResponse): ApiErrorKind {
  const detail = payload.detail;
  const message =
    typeof detail === "string"
      ? detail
      : detail && typeof detail === "object" && !Array.isArray(detail) && "message" in detail && typeof detail.message === "string"
        ? detail.message
        : "";

  if (status === 408 || status === 504) return "timeout";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 422) return "validation";
  if (status === 502 && /malformed|valid/i.test(message)) {
    return "malformed_generation";
  }
  if (status === 502 || (status === 503 && /LLM|language model/i.test(message))) {
    return "provider_unavailable";
  }
  if (status === 503) return "backend_unavailable";
  return "unexpected";
}

async function apiRequest<TResponse, TBody = never>(
  path: string,
  body?: TBody,
  options: RequestOptions = {},
): Promise<TResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(
    () => { timedOut = true; controller.abort(); },
    options.timeoutMs ?? API_CONFIG.defaultTimeoutMs,
  );
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  if (options.signal?.aborted) controller.abort();

  try {
    if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const response = await fetch(`${API_CONFIG.baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as
      | TResponse
      | ApiErrorResponse;
    if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");

    if (!response.ok) {
      const errorPayload = payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload as ApiErrorResponse : {};
      throw new PickyTalkerApiError(
        errorKind(response.status, errorPayload),
        "The PickyTalker API could not complete the request.",
        response.status,
        errorPayload,
      );
    }

    if (payload === null) {
      throw new PickyTalkerApiError("malformed_generation", "The backend returned unreadable JSON.", response.status);
    }
    return payload as TResponse;
  } catch (error) {
    if (error instanceof PickyTalkerApiError) throw error;
    if (controller.signal.aborted) {
      throw new PickyTalkerApiError(
        timedOut ? "timeout" : "cancelled",
        timedOut ? "The request took longer than expected." : "The request was cancelled.",
      );
    }
    throw new PickyTalkerApiError(
      "backend_unavailable",
      "The PickyTalker backend could not be reached.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function requireCandidates<T extends { candidates: unknown[] }>(response: T): T {
  if (!response || !Array.isArray(response.candidates)) {
    throw new PickyTalkerApiError("malformed_generation", "The backend returned an invalid response.");
  }
  if (response.candidates.length === 0) {
    throw new PickyTalkerApiError(
      "no_candidates",
      "The backend returned no response candidates.",
    );
  }
  return response;
}

export const pickyTalkerApi = {
  health: (options?: RequestOptions) =>
    apiRequest<HealthResponse>("/health", undefined, options),
  profile: (request: ProfileRequest, options?: RequestOptions) =>
    apiRequest<ProfileResponse, ProfileRequest>("/profile", request, options),
  rank: async (request: RankRequest, options?: RequestOptions) =>
    requireCandidates(
      await apiRequest<RankResponse, RankRequest>("/rank", request, options),
    ),
  generate: async (request: GenerateRequest, options?: RequestOptions) =>
    requireCandidates(
      await apiRequest<GenerateResponse, GenerateRequest>("/generate", request, {
        timeoutMs: API_CONFIG.generationTimeoutMs,
        ...options,
      }),
    ),
  respond: async (request: RespondRequest, options?: RequestOptions) => {
    const response = requireCandidates(
      await apiRequest<RespondResponse, RespondRequest>("/respond", request, {
        timeoutMs: API_CONFIG.generationTimeoutMs,
        ...options,
      }),
    );
    if (!isRespondResponse(response)) {
      throw new PickyTalkerApiError("malformed_generation", "The backend returned an invalid selected response.");
    }
    return response;
  },
};
