import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React, { useState } from "react";
import { JSDOM } from "jsdom";

// Node tests ignore stylesheet imports; styling is checked by the Next production build.
const require = createRequire(import.meta.url);
require.extensions[".css"] = () => undefined;
let CodeSlots: typeof import("../src/components/auth/CodeSlots").default;
let render: typeof import("@testing-library/react").render;
let cleanup: typeof import("@testing-library/react").cleanup;
let fireEvent: typeof import("@testing-library/react").fireEvent;
let waitFor: typeof import("@testing-library/react").waitFor;
let userEvent: typeof import("@testing-library/user-event").default;
before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  Object.defineProperties(globalThis, {
    window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true },
    navigator: { value: dom.window.navigator, configurable: true }, HTMLElement: { value: dom.window.HTMLElement, configurable: true },
    SVGElement: { value: dom.window.SVGElement, configurable: true }, Element: { value: dom.window.Element, configurable: true },
    requestAnimationFrame: { value: dom.window.requestAnimationFrame.bind(dom.window), configurable: true },
    cancelAnimationFrame: { value: dom.window.cancelAnimationFrame.bind(dom.window), configurable: true },
  });
  dom.window.matchMedia = (query: string) => ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  ({ render, cleanup, fireEvent, waitFor } = await import("@testing-library/react"));
  userEvent = (await import("@testing-library/user-event")).default;
  CodeSlots = (await import("../src/components/auth/CodeSlots")).default;
});
afterEach(() => cleanup());

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState("");
  return <form><CodeSlots value={value} onChange={setValue} disabled={disabled} /><output data-testid="value">{value}</output></form>;
}
test("Code Slots uses one accessible numeric mobile input and one form value", () => {
  const ui = render(<Harness />);
  const input = ui.getByRole("textbox", { name: "One-time code" });
  assert.equal(input.getAttribute("inputmode"), "numeric");
  assert.equal(input.getAttribute("autocomplete"), "one-time-code");
  assert.equal(ui.getAllByRole("textbox").length, 1);
  assert.ok(ui.container.querySelector('input[type="hidden"][name="code"]'));
});
test("typing, backspace and keyboard navigation operate naturally", async () => {
  const ui = render(<Harness />); const user = userEvent.setup();
  await user.click(ui.getByRole("textbox")); await user.keyboard("123");
  assert.equal(ui.getByTestId("value").textContent, "123");
  await user.keyboard("{Backspace}"); assert.equal(ui.getByTestId("value").textContent, "12");
  await user.keyboard("3456"); assert.equal(ui.getByTestId("value").textContent, "123456");
  await user.keyboard("{Home}9"); assert.equal(ui.getByTestId("value").textContent, "923456");
  await user.keyboard("{End}{Backspace}"); assert.equal(ui.getByTestId("value").textContent, "92345");
});
test("pasting all six digits replaces a partial entry, ignoring non-digits", async () => {
  const ui = render(<Harness />); const user = userEvent.setup(); const input = ui.getByRole("textbox");
  await user.click(input); await user.keyboard("12");
  await user.paste("987 654");
  assert.equal(ui.getByTestId("value").textContent, "987654");
  assert.equal((ui.container.querySelector('input[name="code"]') as HTMLInputElement).value, "987654");
});
test("mobile/autofill onChange supports a complete numeric code", () => {
  const ui = render(<Harness />);
  fireEvent.change(ui.getByRole("textbox"), { target: { value: "123456" } });
  assert.equal(ui.getByTestId("value").textContent, "123456");
});
test("disabled Code Slots cannot be edited", async () => {
  const ui = render(<Harness disabled />); const user = userEvent.setup();
  assert.ok((ui.getByRole("textbox") as HTMLInputElement).disabled);
  await user.click(ui.getByRole("textbox")); await user.keyboard("123456");
  assert.equal(ui.getByTestId("value").textContent, "");
});
test("error and success states are accessible and success locks editing", async () => {
  const ui = render(<CodeSlots defaultValue="123456" />);
  ui.rerender(<CodeSlots defaultValue="123456" status="error" />);
  assert.equal(ui.getByRole("textbox").getAttribute("aria-invalid"), "true");
  await waitFor(() => assert.ok(ui.container.textContent?.includes("0 of 6 digits entered")));
  ui.rerender(<CodeSlots value="123456" status="success" />);
  assert.ok((ui.getByRole("textbox") as HTMLInputElement).readOnly);
  assert.ok(ui.getByText("Code accepted"));
});
