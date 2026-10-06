import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { JSDOM } from "jsdom";
import { replyText, respondFixture } from "./fixtures/respond";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
};

let ChatWorkspace: typeof import("../src/components/chat/chat-workspace").ChatWorkspace;
let DottedGlowBackground: typeof import("../src/components/ui/dotted-glow-background").DottedGlowBackground;
let MessageComposer: typeof import("../src/components/chat/message-composer").MessageComposer;
let ResponseCard: typeof import("../src/components/chat/response-card").ResponseCard;
let GenerationStatus: typeof import("../src/components/chat/generation-status").GenerationStatus;
let SmoothTextarea: typeof import("../src/components/ui/smooth-textarea").SmoothTextarea;
let render: typeof import("@testing-library/react").render;
let cleanup: typeof import("@testing-library/react").cleanup;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let waitFor: typeof import("@testing-library/react").waitFor;
let act: typeof import("@testing-library/react").act;
let userEvent: typeof import("@testing-library/user-event").default;
const frames = new Map<number, FrameRequestCallback>();
const mediaListeners = new Set<() => void>();
let reduced = true;
let finePointer = true;
let nextFrame = 0;
let draws = 0;
let lastDotAlpha = 0;
let lastDotRadius = 0;
let disconnections = 0;
let hidden = false;

before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  const requestFrame = (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; };
  const cancelFrame = (id: number) => { frames.delete(id); };
  class Observer {
    observe() {}
    disconnect() { disconnections++; }
  }
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
    HTMLCanvasElement: { value: dom.window.HTMLCanvasElement, configurable: true },
    SVGElement: { value: dom.window.SVGElement, configurable: true }, Element: { value: dom.window.Element, configurable: true },
    getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true },
    requestAnimationFrame: { value: requestFrame, configurable: true }, cancelAnimationFrame: { value: cancelFrame, configurable: true },
    ResizeObserver: { value: Observer, configurable: true },
  });
  Object.defineProperty(dom.window.document, "hidden", { get: () => hidden, configurable: true });
  dom.window.matchMedia = (query: string) => ({
    get matches() { return query.includes("prefers-reduced-motion") ? reduced : finePointer; }, media: query, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener: (_: unknown, callback: unknown) => { mediaListeners.add(callback as () => void); },
    removeEventListener: (_: unknown, callback: unknown) => { mediaListeners.delete(callback as () => void); },
    dispatchEvent() { return true; },
  });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", { value: () => ({
    globalAlpha: 1,
    clearRect() { draws++; }, setTransform() {}, beginPath() {},
    arc(_x: number, _y: number, radius: number) { lastDotRadius = radius; },
    fill() { lastDotAlpha = this.globalAlpha; },
  }) });
  ({ render, cleanup, fireEvent, waitFor, act } = await import("@testing-library/react"));
  userEvent = (await import("@testing-library/user-event")).default;
  ({ ChatWorkspace } = await import("../src/components/chat/chat-workspace"));
  ({ DottedGlowBackground } = await import("../src/components/ui/dotted-glow-background"));
  ({ MessageComposer } = await import("../src/components/chat/message-composer"));
  ({ ResponseCard } = await import("../src/components/chat/response-card"));
  ({ GenerationStatus } = await import("../src/components/chat/generation-status"));
  ({ SmoothTextarea } = await import("../src/components/ui/smooth-textarea"));
});

beforeEach((t) => {
  if ("mock" in t) t.mock.method(globalThis, "fetch", async () => Response.json(respondFixture()));
});

afterEach(() => {
  cleanup();
  assert.equal(frames.size, 0, "all animation frames must be cancelled on unmount");
  assert.equal(mediaListeners.size, 0, "motion listeners must be cleaned up");
  assert.equal(document.querySelector("[data-smooth-caret-mirror]"), null, "caret mirrors must be removed on unmount");
  reduced = true;
  finePointer = true;
  hidden = false;
});

test("empty shell has a decorative non-interactive background and accessible composer", () => {
  const ui = render(<ChatWorkspace />);
  assert.ok(ui.getByRole("heading", { name: /AI responses that sound like you/ }));
  const decoration = ui.container.querySelector("[data-dotted-glow]");
  assert.equal(decoration?.getAttribute("aria-hidden"), "true");
  assert.equal((decoration as HTMLElement).style.pointerEvents, "none");
  assert.ok(ui.getByRole("textbox", { name: "Message you want to reply to" }));
  assert.ok(ui.getByRole("button", { name: "Generate reply" }));
  assert.equal(ui.queryByRole("log"), null);
  assert.equal(ui.queryByRole("complementary"), null, "no sidebar");
});

test("first real request removes dots, preserves multiline text and restores composer focus", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(respondFixture()));
  const ui = render(<ChatWorkspace />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Can you send the notes?\nTomorrow works too." } });
  await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
  await waitFor(() => assert.equal(input.value, ""));
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
  assert.equal(ui.container.querySelector("[data-chat-state]")?.getAttribute("data-chat-state"), "active");
  assert.equal(ui.getByRole("log").querySelector("p")?.textContent, "Can you send the notes?\nTomorrow works too.");
  assert.equal(input.value, "");
  assert.equal(document.activeElement, input);
  assert.ok(ui.getByText("Sent to the AI provider. Review replies before sending."));
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(ui.container.querySelector("[data-lattice-loader]"), null);
  assert.equal(ui.container.querySelector("[data-response-visual]")?.textContent, replyText);
});

test("blank local input leaves the empty state and background intact", () => {
  const ui = render(<ChatWorkspace />);
  fireEvent.change(ui.getByRole("textbox"), { target: { value: "   " } });
  fireEvent.submit(ui.container.querySelector("form")!);
  assert.ok(ui.container.querySelector("[data-dotted-glow]"));
  assert.equal(ui.queryByRole("log"), null);
});

test("composer and submit action are reachable by keyboard", async () => {
  const ui = render(<ChatWorkspace />);
  const user = userEvent.setup();
  await user.tab();
  assert.equal(document.activeElement, ui.getByRole("textbox"));
  await user.keyboard("A synthetic message");
  await user.tab();
  assert.equal(document.activeElement, ui.getByRole("button"));
  await user.keyboard("{Enter}");
  assert.ok(ui.getByRole("log"));
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
});

test("reduced motion draws static dots without scheduling animation, including preference changes", () => {
  const previousDraws = draws;
  render(<DottedGlowBackground />);
  assert.ok(draws > previousDraws);
  assert.equal(frames.size, 0);
  reduced = false;
  mediaListeners.forEach((callback) => callback());
  assert.equal(frames.size, 1);
  reduced = true;
  mediaListeners.forEach((callback) => callback());
  assert.equal(frames.size, 0);
});

test("default dots have visible contrast and radius even with reduced motion", () => {
  render(<DottedGlowBackground />);
  assert.ok(lastDotAlpha >= 0.4, "dot opacity must not be multiplied back down to near-invisible levels");
  assert.ok(lastDotRadius >= 1.3);
  assert.equal(frames.size, 0);
});

test("animation pauses in hidden tabs and cleans up when the background is removed", () => {
  reduced = false;
  const before = disconnections;
  const ui = render(<DottedGlowBackground />);
  assert.equal(frames.size, 1);
  hidden = true;
  document.dispatchEvent(new window.Event("visibilitychange"));
  assert.equal(frames.size, 0);
  hidden = false;
  document.dispatchEvent(new window.Event("visibilitychange"));
  assert.equal(frames.size, 1);
  ui.unmount();
  assert.equal(frames.size, 0);
  assert.ok(disconnections > before);
});

test("Enter generates one reply; Shift+Enter keeps a multiline draft", async () => {
  const ui = render(<ChatWorkspace />);
  const user = userEvent.setup();
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  await user.click(input);
  await user.keyboard("First line{Shift>}{Enter}{/Shift}Second line");
  assert.equal(input.value, "First line\nSecond line");
  assert.equal(ui.queryByRole("log"), null);
  await user.keyboard("{Enter}");
  await waitFor(() => assert.equal(input.value, ""));
  assert.equal(ui.getByRole("log").querySelector("p")?.textContent, "First line\nSecond line");
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
  assert.equal(document.activeElement, input);
});

test("validation preserves blank and over-limit drafts without starting chat", async () => {
  const ui = render(<ChatWorkspace />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(ui.container.querySelector("form")!);
  assert.match(ui.getByRole("alert").textContent!, /Paste a message/);
  assert.equal(input.value, "   ");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  const long = "x".repeat(2001);
  fireEvent.change(input, { target: { value: long } });
  fireEvent.keyDown(input, { key: "Enter" });
  assert.match(ui.getByRole("alert").textContent!, /2,000 characters/);
  assert.equal(input.value, long, "over-limit paste must not be silently truncated");
  assert.ok(ui.container.querySelector("[data-dotted-glow]"));
  assert.equal(ui.queryByRole("log"), null);
  fireEvent.change(input, { target: { value: "Fixed message" } });
  assert.equal(ui.queryByRole("alert"), null);
  await userEvent.setup().click(ui.getByRole("button"));
  assert.ok(ui.getByRole("log"));
});

test("Unicode limit matches the backend and preserves internal whitespace", async () => {
  const accepted: string[] = [];
  const ui = render(<MessageComposer onSubmit={(message) => { accepted.push(message); }} />);
  const input = ui.getByRole("textbox");
  fireEvent.change(input, { target: { value: "😀".repeat(2000) } });
  await userEvent.setup().click(ui.getByRole("button"));
  assert.equal(Array.from(accepted[0]).length, 2000);
  fireEvent.change(input, { target: { value: "  One  line\n  indented line  " } });
  await userEvent.setup().click(ui.getByRole("button"));
  assert.equal(accepted[1], "One  line\n  indented line");
});

test("IME confirmation and held Enter never submit prematurely", async () => {
  const accepted: string[] = [];
  const ui = render(<MessageComposer onSubmit={(message) => { accepted.push(message); }} />);
  const input = ui.getByRole("textbox");
  fireEvent.change(input, { target: { value: "A composed message" } });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: "Enter", isComposing: false });
  fireEvent.submit(ui.container.querySelector("form")!);
  assert.equal(accepted.length, 0);
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
  fireEvent.keyDown(input, { key: "Enter", repeat: true });
  assert.equal(accepted.length, 0);
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => assert.equal(accepted.length, 1));
});

test("pending submission disables controls and rejects duplicate submit events", async () => {
  let complete!: () => void;
  let calls = 0;
  const pending = new Promise<void>((resolve) => { complete = resolve; });
  const ui = render(<MessageComposer onSubmit={() => { calls++; return pending; }} />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  const form = ui.container.querySelector("form")!;
  fireEvent.change(input, { target: { value: "A synthetic pending message" } });
  fireEvent.keyDown(input, { key: "Enter" });
  fireEvent.submit(form);
  fireEvent.keyDown(input, { key: "Enter" });
  assert.equal(calls, 1);
  assert.ok(input.disabled);
  assert.ok((ui.getByRole("button") as HTMLButtonElement).disabled);
  assert.equal(form.getAttribute("aria-busy"), "true");
  assert.equal(input.value, "A synthetic pending message");
  await act(async () => { complete(); await pending; });
  assert.equal(input.value, "");
  assert.equal(input.disabled, false);
  assert.equal(document.activeElement, input);
});

test("failed submission keeps the complete draft and permits retry without leaking errors", async () => {
  let fail = true;
  const accepted: string[] = [];
  const ui = render(<MessageComposer onSubmit={async (message) => {
    if (fail) throw new Error("private backend diagnostic should not appear");
    accepted.push(message);
  }} />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Keep my draft\nand this newline." } });
  await userEvent.setup().click(ui.getByRole("button"));
  assert.match(ui.getByRole("alert").textContent!, /draft is still here/);
  assert.equal(input.value, "Keep my draft\nand this newline.");
  assert.equal(input.disabled, false);
  assert.equal(document.activeElement, input);
  assert.ok(!ui.container.textContent?.includes("private backend diagnostic"));
  fail = false;
  await userEvent.setup().click(ui.getByRole("button"));
  assert.equal(accepted.length, 1);
  assert.equal(input.value, "");
  assert.equal(ui.queryByRole("alert"), null);
});

test("externally busy composer cannot submit or change its retained draft", () => {
  let calls = 0;
  const submit = () => { calls++; };
  const ui = render(<MessageComposer onSubmit={submit} />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Retained draft" } });
  ui.rerender(<MessageComposer onSubmit={submit} busy />);
  fireEvent.submit(ui.container.querySelector("form")!);
  assert.equal(calls, 0);
  assert.ok(input.disabled);
  assert.equal(input.value, "Retained draft");
  ui.rerender(<MessageComposer onSubmit={submit} />);
  assert.equal(input.disabled, false);
  assert.equal(input.value, "Retained draft");
});

test("multiple messages append in order, sending no received or generated text as personal history", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(respondFixture()));
  const ui = render(<ChatWorkspace />);
  for (const message of ["First synthetic message", "Second synthetic message"]) {
    fireEvent.change(ui.getByRole("textbox"), { target: { value: message } });
    await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
    await waitFor(() => assert.equal((ui.getByRole("textbox") as HTMLTextAreaElement).value, ""));
  }
  assert.deepEqual(Array.from(ui.getByRole("log").querySelectorAll(".message p"), (node) => node.textContent), ["First synthetic message", "Second synthetic message"]);
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
  assert.equal(fetchMock.mock.callCount(), 2);
  for (const call of fetchMock.mock.calls) assert.deepEqual(JSON.parse((call.arguments[1] as RequestInit).body as string).history, []);
});

test("real request stays pending with one loader, retained input and no early reply", async (t) => {
  let complete!: (response: Response) => void;
  const fetch = t.mock.method(globalThis, "fetch", () => new Promise<Response>((resolve) => { complete = resolve; }));
  const ui = render(<ChatWorkspace />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "A synthetic slow request" } });
  fireEvent.submit(ui.container.querySelector("form")!);
  fireEvent.submit(ui.container.querySelector("form")!);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(ui.container.querySelectorAll("[data-lattice-loader]").length, 1);
  assert.equal(ui.container.querySelector("[data-selected-response]"), null);
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
  assert.equal(input.value, "A synthetic slow request");
  assert.ok(input.disabled);
  await act(async () => { complete(Response.json(respondFixture())); });
  assert.equal(ui.container.querySelector("[data-lattice-loader]"), null);
  assert.equal(ui.container.querySelector("[data-response-visual]")?.textContent, replyText);
  assert.equal(input.value, "");
  assert.equal(document.activeElement, input);
});

test("failed request retains input; explicit retry reuses the same incoming turn", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new TypeError("secret diagnostic"); });
  const ui = render(<ChatWorkspace />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  const message = "Please keep\n  my synthetic draft.";
  fireEvent.change(input, { target: { value: message } });
  await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
  assert.match(ui.getByRole("alert").textContent!, /Can't reach PickyTalker/);
  assert.equal(input.value, message);
  assert.equal(input.disabled, false);
  assert.ok(!ui.container.textContent!.includes("secret diagnostic"));
  assert.equal(ui.container.querySelector("[data-selected-response]"), null);
  await userEvent.setup().click(ui.getByRole("button", { name: "Retry generation" }));
  assert.equal(document.activeElement, input, "even an immediately failed retry restores input focus");
  assert.equal(ui.getByRole("log").querySelectorAll("li").length, 1);
  fetch.mock.mockImplementation(async () => Response.json(respondFixture()));
  await userEvent.setup().click(ui.getByRole("button", { name: "Retry generation" }));
  await waitFor(() => assert.equal(input.value, ""));
  assert.equal(ui.getByRole("log").querySelectorAll("li").length, 1);
  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(ui.queryByRole("alert"), null);
  assert.equal(document.activeElement, input);
});

test("retrying a failed message does not erase a newer draft", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new TypeError("offline"); });
  const ui = render(<ChatWorkspace />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Original synthetic draft" } });
  await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
  fireEvent.change(input, { target: { value: "My edited draft must survive" } });
  fetch.mock.mockImplementation(async () => Response.json(respondFixture()));
  await userEvent.setup().click(ui.getByRole("button", { name: "Retry generation" }));
  await waitFor(() => assert.equal(input.disabled, false));
  assert.equal(input.value, "My edited draft must survive");
  assert.equal(ui.getByRole("log").querySelectorAll("li").length, 1);
  const body = JSON.parse((fetch.mock.calls[1].arguments[1] as RequestInit).body as string);
  assert.equal(body.incoming, "Original synthetic draft");
});

test("resubmitting an unchanged failed draft also reuses its turn", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 504 }));
  const ui = render(<ChatWorkspace />);
  fireEvent.change(ui.getByRole("textbox"), { target: { value: "A synthetic timeout" } });
  await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
  assert.match(ui.getByRole("alert").textContent!, /took too long/);
  fetch.mock.mockImplementation(async () => Response.json(respondFixture()));
  await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
  assert.equal(ui.getByRole("log").querySelectorAll("li").length, 1);
  assert.equal(fetch.mock.callCount(), 2);
});

test("malformed response never renders a reply and preserves the draft", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ best: { candidate: "Unsafe to display without valid schema" } }));
  const ui = render(<ChatWorkspace />);
  fireEvent.change(ui.getByRole("textbox"), { target: { value: "A synthetic malformed request" } });
  await userEvent.setup().click(ui.getByRole("button", { name: "Generate reply" }));
  assert.match(ui.getByRole("alert").textContent!, /usable reply/);
  assert.equal(ui.container.querySelector("[data-selected-response]"), null);
  assert.ok(!ui.container.textContent!.includes("Unsafe to display"));
  assert.equal((ui.getByRole("textbox") as HTMLTextAreaElement).value, "A synthetic malformed request");
});

test("unmount aborts the real request and ignores a late result", async (t) => {
  let signal!: AbortSignal;
  let complete!: (response: Response) => void;
  t.mock.method(globalThis, "fetch", (_url: RequestInfo | URL, init?: RequestInit) => {
    signal = init!.signal!;
    return new Promise<Response>((resolve) => { complete = resolve; });
  });
  const ui = render(<ChatWorkspace />);
  fireEvent.change(ui.getByRole("textbox"), { target: { value: "A synthetic abandoned request" } });
  fireEvent.submit(ui.container.querySelector("form")!);
  ui.unmount();
  assert.ok(signal.aborted);
  await act(async () => { complete(Response.json(respondFixture())); });
  assert.equal(ui.container.textContent, "");
});

test("waiting copy changes only after sixty seconds, without invented percentages", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ui = render(<GenerationStatus />);
  assert.match(ui.getByRole("status").textContent!, /Generating and ranking/);
  act(() => t.mock.timers.tick(60_000));
  assert.match(ui.getByRole("status").textContent!, /Still waiting on the AI provider/);
  assert.ok(!ui.container.textContent!.includes("%"));
  ui.unmount();
  t.mock.timers.reset();
});

test("selected reply is exact and untruncated, including Unicode, tabs and repeated whitespace", () => {
  const text = replyText + "A long synthetic reply. ".repeat(200) + "\n  Final line.\n";
  const ui = render(<ResponseCard response={respondFixture(text)} />);
  assert.equal(ui.container.querySelector("[data-response-visual]")?.textContent, text);
  assert.equal(ui.container.querySelector("[data-selected-response] > .sr-only")?.textContent, text);
  assert.ok(ui.getByRole("article", { name: "Selected reply" }));
  assert.equal(ui.queryByText("Synthetic test reason"), null);
  assert.equal(ui.queryByRole("slider"), null);
});

test("keyboard copy writes only exact reply text and shows temporary feedback", async () => {
  const user = userEvent.setup();
  const ui = render(<ResponseCard response={respondFixture()} />);
  await user.tab();
  assert.equal(document.activeElement, ui.getByRole("button", { name: "Copy reply" }));
  await user.keyboard("{Enter}");
  assert.equal(await navigator.clipboard.readText(), replyText);
  assert.ok(ui.getByRole("button", { name: "Reply copied" }));
  assert.match(ui.getByRole("status").textContent!, /copied to clipboard/);
  await waitFor(() => assert.ok(ui.getByRole("button", { name: "Copy reply" })), { timeout: 3000 });
});

test("reduced-motion reply is static and complete; preference changes keep exact text", () => {
  const ui = render(<ResponseCard response={respondFixture()} />);
  assert.equal(ui.container.querySelectorAll("[data-response-visual] span").length, 0);
  assert.equal(ui.container.querySelector("[data-response-visual]")?.textContent, replyText);
  act(() => { reduced = false; mediaListeners.forEach((listener) => listener()); });
  assert.ok(ui.container.querySelectorAll("[data-response-visual] span").length > 0);
  assert.equal(ui.container.querySelector("[data-response-visual]")?.textContent, replyText);
  act(() => { reduced = true; mediaListeners.forEach((listener) => listener()); });
  assert.equal(ui.container.querySelectorAll("[data-response-visual] span").length, 0);
});

test("reduced-motion lattice is explicitly static and responds to preference changes", () => {
  const ui = render(<GenerationStatus />);
  assert.equal(ui.container.querySelector("[data-lattice-loader]")?.getAttribute("data-static"), "true");
  act(() => { reduced = false; mediaListeners.forEach((listener) => listener()); });
  assert.equal(ui.container.querySelector("[data-lattice-loader]")?.getAttribute("data-static"), null);
});

test("blocked clipboard shows an honest error rather than claiming it copied", async (t) => {
  const user = userEvent.setup();
  t.mock.method(navigator.clipboard, "writeText", async () => { throw new DOMException("Blocked", "NotAllowedError"); });
  const ui = render(<ResponseCard response={respondFixture()} />);
  await user.click(ui.getByRole("button", { name: "Copy reply" }));
  assert.ok(ui.getByRole("button", { name: "Copy reply" }));
  assert.match(ui.getByRole("alert").textContent!, /Clipboard access was blocked/);
  assert.equal(ui.getByRole("status").textContent, "");
});

function rankedFixture() {
  const response = respondFixture();
  response.best.reasons = ["Backend reason about punctuation.", "Backend reason about length.\nNo browser explanation."];
  response.candidates = [response.best,
    { ...response.best, candidate: "Second  ranked reply.\n  Keep indentation.", rank: 2, style_score: 0.1 },
    { ...response.best, candidate: "Third ranked reply 😀", rank: 3, style_score: 0.95 }];
  return response;
}

test("details are collapsed initially and keyboard expansion renders only backend reasons and rank order", async () => {
  const response = rankedFixture();
  const ui = render(<ResponseCard response={response} />);
  const trigger = ui.getByRole("button", { name: "Why this response" });
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(ui.queryByRole("region", { name: "Why this response" }), null);
  const user = userEvent.setup();
  await user.tab();
  await user.tab();
  assert.equal(document.activeElement, trigger);
  await user.keyboard("{Enter}");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const region = ui.getByRole("region", { name: "Why this response" });
  assert.equal(trigger.getAttribute("aria-controls"), region.id);
  assert.deepEqual(Array.from(ui.getByRole("list", { name: "Backend-provided reasons" }).querySelectorAll("li"), (item) => item.textContent), response.best.reasons);
  const alternatives = ui.getByRole("list", { name: "Ranked alternatives" });
  assert.deepEqual(Array.from(alternatives.querySelectorAll("li p"), (item) => item.textContent), response.candidates.slice(1).map((item) => item.candidate));
  assert.deepEqual(Array.from(alternatives.querySelectorAll("li"), (item) => item.getAttribute("value")), ["2", "3"]);
  assert.ok(!region.textContent!.includes("0.95"), "no raw scores or invented percentages");
  assert.ok(!region.textContent!.includes("log_words"), "no raw vectors");
  assert.ok(!alternatives.textContent!.includes(response.best.candidate), "selected reply is not repeated as an alternative");
  await user.keyboard(" ");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(ui.queryByRole("region", { name: "Why this response" }), null);
  assert.equal(document.activeElement, trigger);
});

test("empty backend explanations and a single candidate use honest fallbacks", async () => {
  const response = respondFixture();
  response.best.reasons = [];
  const ui = render(<ResponseCard response={response} />);
  await userEvent.setup().click(ui.getByRole("button", { name: "Why this response" }));
  assert.ok(ui.getByText("The backend didn’t provide an explanation for this reply."));
  assert.ok(ui.getByText("No other replies were returned."));
  assert.equal(ui.queryByRole("list", { name: "Backend-provided reasons" }), null);
  assert.equal(ui.queryByRole("list", { name: "Ranked alternatives" }), null);
});

test("expanding details does not change exact clipboard text or replay the reply", async () => {
  reduced = false;
  const ui = render(<ResponseCard response={rankedFixture()} />);
  const reveal = ui.container.querySelector("[data-response-visual]");
  const firstWord = reveal?.querySelector("span");
  const user = userEvent.setup();
  await user.click(ui.getByRole("button", { name: "Why this response" }));
  assert.equal(ui.container.querySelector("[data-response-visual]"), reveal);
  assert.equal(reveal?.querySelector("span"), firstWord);
  await user.click(ui.getByRole("button", { name: "Copy reply" }));
  assert.equal(await navigator.clipboard.readText(), replyText);
});

test("each response has an independent details panel and unique accessible controls", async () => {
  const ui = render(<><ResponseCard response={rankedFixture()} /><ResponseCard response={rankedFixture()} /></>);
  const triggers = ui.getAllByRole("button", { name: "Why this response" });
  const user = userEvent.setup();
  await user.click(triggers[0]);
  await user.click(triggers[1]);
  assert.ok(triggers[0].getAttribute("aria-controls"));
  assert.notEqual(triggers[0].getAttribute("aria-controls"), triggers[1].getAttribute("aria-controls"));
  await user.click(triggers[1]);
  assert.equal(triggers[0].getAttribute("aria-expanded"), "true");
  assert.equal(triggers[1].getAttribute("aria-expanded"), "false");
});

test("workspace connects reasons and alternatives to the real API payload without extra requests", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json(rankedFixture()));
  const ui = render(<ChatWorkspace />);
  fireEvent.change(ui.getByRole("textbox"), { target: { value: "A synthetic phase six request" } });
  const user = userEvent.setup();
  await user.click(ui.getByRole("button", { name: "Generate reply" }));
  await user.click(ui.getByRole("button", { name: "Why this response" }));
  assert.ok(ui.getByText("Backend reason about punctuation."));
  assert.ok(ui.getByText("Third ranked reply 😀"));
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
  assert.equal(ui.queryByRole("slider"), null, "no rating before Phase 7");
});

function giveInputDimensions(input: HTMLTextAreaElement) {
  Object.defineProperties(input, {
    clientWidth: { value: 400, configurable: true }, clientHeight: { value: 180, configurable: true },
    offsetWidth: { value: 400, configurable: true },
  });
}

test("smooth caret appears on desktop and restores native selection, IME and blur behavior", () => {
  reduced = false;
  const ui = render(<SmoothTextarea aria-label="Synthetic smooth input" defaultValue="One\nTwo 😀" />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  giveInputDimensions(input);
  const caret = ui.container.querySelector("[data-smooth-caret]") as HTMLElement;
  fireEvent.focus(input);
  input.focus();
  assert.equal(caret.hidden, false);
  assert.equal(input.style.caretColor, "transparent");
  input.setSelectionRange(0, 3);
  fireEvent.select(input);
  assert.equal(caret.hidden, true);
  assert.equal(input.style.caretColor, "");
  input.setSelectionRange(3, 3);
  fireEvent.select(input);
  assert.equal(caret.hidden, false);
  fireEvent.compositionStart(input);
  assert.equal(caret.hidden, true);
  assert.equal(input.style.caretColor, "");
  fireEvent.compositionEnd(input);
  assert.equal(caret.hidden, false);
  input.blur();
  assert.equal(caret.hidden, true);
  assert.equal(input.style.caretColor, "");
});

test("smooth caret falls back for reduced motion, mobile pointers, bidi text and disabled input", () => {
  reduced = false;
  const ui = render(<SmoothTextarea aria-label="Synthetic smooth input" defaultValue="Hello" />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  giveInputDimensions(input);
  input.focus();
  const caret = ui.container.querySelector("[data-smooth-caret]") as HTMLElement;
  assert.equal(caret.hidden, false);
  act(() => { finePointer = false; mediaListeners.forEach((listener) => listener()); });
  assert.equal(caret.hidden, true);
  assert.equal(input.style.caretColor, "");
  act(() => { finePointer = true; reduced = true; mediaListeners.forEach((listener) => listener()); });
  assert.equal(caret.hidden, true);
  act(() => { reduced = false; mediaListeners.forEach((listener) => listener()); });
  assert.equal(caret.hidden, false);
  fireEvent.input(input, { target: { value: "שלום" } });
  assert.equal(caret.hidden, true);
  assert.equal(input.style.caretColor, "");
  fireEvent.input(input, { target: { value: "Hello again" } });
  assert.equal(caret.hidden, false);
  ui.rerender(<SmoothTextarea aria-label="Synthetic smooth input" defaultValue="Hello" disabled />);
  assert.equal(caret.hidden, true);
  assert.equal(input.style.caretColor, "");
});
