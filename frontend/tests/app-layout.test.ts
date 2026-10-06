import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transpileModule, ModuleKind, JsxEmit } from "typescript";
import type { ReactElement, ReactNode } from "react";
import type { AuthUserSummary } from "../src/components/auth/auth-controls";

// Execute the real server layout with narrow module stubs: no credentials,
// database, email or browser login. Full-stack auth QA is reserved for Phase 9.
const require = createRequire(import.meta.url);
type Layout = (props: { children: ReactNode }) => Promise<ReactElement<{ user: AuthUserSummary; children: ReactNode }>>;
type TestSession = { user?: AuthUserSummary & { id?: string }; expires?: string; secret?: string } | null;
class Redirect extends Error { constructor(public path: string) { super(path); } }

function fixture(session: TestSession) {
  let calls = 0;
  const AppShell = () => null;
  const source = readFileSync(new URL("../src/app/app/layout.tsx", import.meta.url), "utf8");
  const output = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText;
  const routeModule = { exports: {} as { default: Layout } };
  const stubRequire = (name: string) => {
    if (name === "@/auth") return { auth: async () => { calls++; return session; } };
    if (name === "next/navigation") return { redirect: (path: string) => { throw new Redirect(path); } };
    if (name === "@/components/app/app-shell") return { AppShell };
    if (name === "react/jsx-runtime") return require(name);
    throw new Error(`Unexpected server dependency: ${name}`);
  };
  new Function("require", "module", "exports", output)(stubRequire, routeModule, routeModule.exports);
  return { layout: routeModule.exports.default, AppShell, get calls() { return calls; } };
}

test("protected app layout redirects missing/invalid user sessions before rendering the shell", async () => {
  for (const session of [null, {}, { expires: "synthetic-expiry" }] as TestSession[]) {
    const server = fixture(session);
    await assert.rejects(server.layout({ children: "Synthetic chat" }), (error: unknown) => error instanceof Redirect && error.path === "/signin");
    assert.equal(server.calls, 1);
  }
});

test("signed-in layout renders chat with one auth lookup and only safe account display fields", async () => {
  const server = fixture({ user: { id: "synthetic-user-id", name: "Synthetic User", email: "synthetic@example.test", image: null }, expires: "synthetic-expiry", secret: "test-only-private-field" });
  const element = await server.layout({ children: "Synthetic chat" });
  assert.equal(element.type, server.AppShell);
  assert.equal(server.calls, 1);
  assert.equal(element.props.children, "Synthetic chat");
  assert.deepEqual(element.props.user, { name: "Synthetic User", email: "synthetic@example.test", image: null });
  assert.equal(JSON.stringify(element.props).includes("test-only-private-field"), false);
  assert.equal(JSON.stringify(element.props).includes("synthetic-user-id"), false);
});
