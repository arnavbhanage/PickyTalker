const DEFAULT_API_URL = "http://127.0.0.1:8000";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export const API_CONFIG = {
  baseUrl: normalizeBaseUrl(
    process.env.NEXT_PUBLIC_PICKYTALKER_API_URL || DEFAULT_API_URL,
  ),
  defaultTimeoutMs: 15_000,
  generationTimeoutMs: 75_000,
} as const;
