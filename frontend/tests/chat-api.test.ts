import { test } from "node:test";
import assert from "node:assert/strict";
import { pickyTalkerApi, PickyTalkerApiError } from "../src/lib/api";
import { API_CONFIG } from "../src/lib/config";
import { respondFixture } from "./fixtures/respond";

const request = { incoming: "Can you send the synthetic notes?", history: [] };
const hasKind = (kind: string) => (error: unknown) => error instanceof PickyTalkerApiError && error.kind === kind;

test("respond uses the configured FastAPI URL and real contract without provider secrets", async (t) => {
  const fixture = respondFixture();
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(fixture));
  assert.deepEqual(await pickyTalkerApi.respond(request), fixture);
  const [url, init] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, `${API_CONFIG.baseUrl}/respond`);
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body as string), request);
  assert.deepEqual(init.headers, { "Content-Type": "application/json" });
  assert.ok(API_CONFIG.generationTimeoutMs > 120_000);
});

test("network failure is backend unavailable with no automatic retries", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new TypeError("private host detail"); });
  await assert.rejects(pickyTalkerApi.respond(request), hasKind("backend_unavailable"));
  assert.equal(fetch.mock.callCount(), 1);
});

test("slow requests abort at their timeout", async (t) => {
  t.mock.method(globalThis, "fetch", (_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  await assert.rejects(pickyTalkerApi.respond(request, { timeoutMs: 10 }), hasKind("timeout"));
});

test("caller cancellation is not misreported as timeout", async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", (_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const pending = pickyTalkerApi.respond(request, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, hasKind("cancelled"));
});

test("already cancelled requests never fetch", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(respondFixture()));
  await assert.rejects(pickyTalkerApi.respond(request, { signal: AbortSignal.abort() }), hasKind("cancelled"));
  assert.equal(fetch.mock.callCount(), 0);
});

for (const [status, detail, kind] of [
  [503, "Model artifacts unavailable", "backend_unavailable"],
  [503, "LLM generation unavailable", "provider_unavailable"],
  [502, "Provider unavailable", "provider_unavailable"],
  [502, "LLM returned malformed output", "malformed_generation"],
  [504, "Timed out", "timeout"],
  [422, [], "validation"],
  [401, "API key required", "unauthorized"],
  [500, 10, "unexpected"],
] as const) {
  test(`HTTP ${status} (${kind}) is classified without leaking diagnostics`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json({ detail }, { status }));
    await assert.rejects(pickyTalkerApi.respond(request), hasKind(kind));
  });
}

for (const [label, payload] of [
  ["null", null], ["missing best", { candidates: [{}] }],
  ["blank reply", respondFixture("  ")],
  ["missing metadata", { ...respondFixture(), meta: {} }],
  ["best differs from first", { ...respondFixture(), best: { ...respondFixture().best, candidate: "Different" } }],
  ["invalid rank", { ...respondFixture(), candidates: [{ ...respondFixture().best, rank: 2 }] }],
  ["invalid score", { ...respondFixture(), best: { ...respondFixture().best, style_score: "0.7" } }],
  ["missing candidates", { ...respondFixture(), candidates: null }],
] as const) {
  test(`invalid successful payload (${label}) is rejected before rendering`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => Response.json(payload));
    await assert.rejects(pickyTalkerApi.respond(request), hasKind("malformed_generation"));
  });
}

test("no candidates gets an actionable error", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ ...respondFixture(), candidates: [] }));
  await assert.rejects(pickyTalkerApi.respond(request), hasKind("no_candidates"));
});

test("HTML on a successful status is malformed, not backend offline", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>proxy error</html>"));
  await assert.rejects(pickyTalkerApi.respond(request), hasKind("malformed_generation"));
});

test("non-JSON and null error bodies retain their HTTP classification", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response("offline", { status: 503 }));
  await assert.rejects(pickyTalkerApi.respond(request), hasKind("backend_unavailable"));
  fetch.mock.mockImplementation(async () => Response.json(null, { status: 502 }));
  await assert.rejects(pickyTalkerApi.respond(request), hasKind("provider_unavailable"));
});
