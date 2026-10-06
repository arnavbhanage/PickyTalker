import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
};

let ChatWorkspace: typeof import("../src/components/chat/chat-workspace").ChatWorkspace;
let DottedGlowBackground: typeof import("../src/components/ui/dotted-glow-background").DottedGlowBackground;
let render: typeof import("@testing-library/react").render;
let cleanup: typeof import("@testing-library/react").cleanup;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let userEvent: typeof import("@testing-library/user-event").default;
const frames = new Map<number, FrameRequestCallback>();
const mediaListeners = new Set<() => void>();
let reduced = true;
let nextFrame = 0;
let draws = 0;
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
    requestAnimationFrame: { value: requestFrame, configurable: true }, cancelAnimationFrame: { value: cancelFrame, configurable: true },
    ResizeObserver: { value: Observer, configurable: true },
  });
  Object.defineProperty(dom.window.document, "hidden", { get: () => hidden, configurable: true });
  dom.window.matchMedia = (query: string) => ({
    get matches() { return reduced; }, media: query, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener: (_: unknown, callback: unknown) => { mediaListeners.add(callback as () => void); },
    removeEventListener: (_: unknown, callback: unknown) => { mediaListeners.delete(callback as () => void); },
    dispatchEvent() { return true; },
  });
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, "getContext", { value: () => ({
    clearRect() { draws++; }, setTransform() {}, beginPath() {}, arc() {}, fill() {},
  }) });
  ({ render, cleanup, fireEvent } = await import("@testing-library/react"));
  userEvent = (await import("@testing-library/user-event")).default;
  ({ ChatWorkspace } = await import("../src/components/chat/chat-workspace"));
  ({ DottedGlowBackground } = await import("../src/components/ui/dotted-glow-background"));
});

afterEach(() => {
  cleanup();
  assert.equal(frames.size, 0, "all animation frames must be cancelled on unmount");
  assert.equal(mediaListeners.size, 0, "motion listeners must be cleaned up");
  reduced = true;
  hidden = false;
});

test("empty shell has a decorative non-interactive background and accessible composer", () => {
  const ui = render(<ChatWorkspace />);
  assert.ok(ui.getByRole("heading", { name: /AI responses that sound like you/ }));
  const decoration = ui.container.querySelector("[data-dotted-glow]");
  assert.equal(decoration?.getAttribute("aria-hidden"), "true");
  assert.equal((decoration as HTMLElement).style.pointerEvents, "none");
  assert.ok(ui.getByRole("textbox", { name: "Message you want to reply to" }));
  assert.ok(ui.getByRole("button", { name: "Add message to conversation" }));
  assert.equal(ui.queryByRole("log"), null);
  assert.equal(ui.queryByRole("complementary"), null, "no sidebar");
});

test("first local message removes dots, preserves multiline text and returns focus without any fetch", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", () => { throw new Error("Phase 2 must not call a backend"); });
  const ui = render(<ChatWorkspace />);
  const input = ui.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Can you send the notes?\nTomorrow works too." } });
  await userEvent.setup().click(ui.getByRole("button", { name: "Add message to conversation" }));
  assert.equal(ui.container.querySelector("[data-dotted-glow]"), null);
  assert.equal(ui.container.querySelector("[data-chat-state]")?.getAttribute("data-chat-state"), "active");
  assert.equal(ui.getByRole("log").querySelector("p")?.textContent, "Can you send the notes?\nTomorrow works too.");
  assert.equal(input.value, "");
  assert.equal(document.activeElement, input);
  assert.ok(ui.getByText("Messages stay in this tab. Reply generation comes next."));
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(ui.queryByRole("status"), null, "no generation loader");
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
