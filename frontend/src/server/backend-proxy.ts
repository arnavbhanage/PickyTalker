type ProxyOptions = {
  backendUrl?: string;
  apiKey?: string;
  production: boolean;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

const MAX_BODY_BYTES = 200_000;
const SAFE_ERRORS: Record<number, string> = {
  401: "Backend authorization unavailable.",
  403: "Backend authorization unavailable.",
  408: "Generation timed out.",
  422: "Invalid request. Check your message and try again.",
  429: "Too many requests. Please wait a minute and try again.",
  502: "LLM generation unavailable.",
  503: "Backend unavailable.",
  504: "Generation timed out.",
};

function failure(status: number, detail: string) {
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

// This guard is intentionally instance-local, not a distributed quota.
// Configure provider spend limits and Vercel Firewall before public promotion.
export function createBurstGuard(now = Date.now) {
  const windows = new Map<string, { expires: number; count: number }>();
  return (identity: string) => {
    const currentTime = now();
    for (const [key, entry] of windows) if (entry.expires <= currentTime) windows.delete(key);
    const entry = windows.get(identity);
    if (!entry) {
      if (windows.size >= 1000) return false;
      windows.set(identity, { expires: currentTime + 60_000, count: 1 });
      return true;
    }
    if (entry.count >= 5) return false;
    entry.count++;
    return true;
  };
}

export async function forwardBackend(request: Request, endpoint: string, options: ProxyOptions): Promise<Response> {
  const isHealth = request.method === "GET" && endpoint === "health";
  const isMutation = request.method === "POST" && ["respond", "generate", "rank", "profile"].includes(endpoint);
  if (!isHealth && !isMutation) return failure(404, "Not found.");

  let backend: URL;
  try {
    backend = new URL(options.backendUrl || "");
    if (backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/") throw new Error("Invalid URL");
    if (options.production ? backend.protocol !== "https:" : !["http:", "https:"].includes(backend.protocol)) throw new Error("Invalid protocol");
    if (options.production && !options.apiKey) throw new Error("Missing API key");
  } catch {
    return failure(503, "Backend unavailable.");
  }

  let body: string | undefined;
  if (isMutation) {
    // No cross-origin mutations, arbitrary URL forwarding, or client key/header forwarding.
    const origin = request.headers.get("origin");
    if (origin !== new URL(request.url).origin) return failure(403, "Request origin is not allowed.");
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure(415, "JSON is required.");
    const declaredSize = Number(request.headers.get("content-length"));
    if (declaredSize > MAX_BODY_BYTES) return failure(413, "Request is too large.");
    try {
      // Read incrementally so a missing/false Content-Length cannot bypass the limit.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!reader) return failure(422, "Invalid request.");
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return failure(413, "Request is too large.");
        }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      body = new TextDecoder().decode(bytes);
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return failure(422, "Invalid request.");
    } catch {
      return failure(422, "Invalid request.");
    }
  }

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 260_000);
  try {
    if (controller.signal.aborted) return failure(499, "Request cancelled.");
    const headers: Record<string, string> = {};
    if (options.apiKey) headers["X-API-Key"] = options.apiKey;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const upstream = await (options.fetcher ?? fetch)(new URL(endpoint, backend), {
      method: request.method, body, headers, cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!upstream.ok) {
      // Never return provider diagnostics, URLs, credentials, or headers to clients.
      return failure(upstream.status in SAFE_ERRORS ? upstream.status : 502, SAFE_ERRORS[upstream.status] ?? "Backend unavailable.");
    }
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return failure(502, "Invalid backend response.");
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure(timedOut ? 504 : request.signal.aborted ? 499 : 503, timedOut ? "Generation timed out." : "Backend unavailable.");
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
  }
}
