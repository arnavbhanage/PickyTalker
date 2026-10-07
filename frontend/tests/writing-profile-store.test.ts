import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";

type Module = typeof import("../src/server/writing-profile-store");

function fixture(session: { user?: { email?: string } } | null = { user: { email: "synthetic@example.test" } }, verified = true) {
  const calls: Array<[string, unknown]> = [];
  const profile = { samples: ["synthetic own words"], updatedAt: new Date("2026-10-07T12:00:00Z") };
  let count = 1;
  let conflict = false;
  const transaction = { writingProfile: {
    async create(args: unknown) { calls.push(["create", args]); if (conflict) throw { code: "P2002" }; return {}; },
    async updateMany(args: unknown) { calls.push(["update", args]); return { count }; },
  } };
  const prisma = {
    user: { async findUnique(args: unknown) { calls.push(["owner", args]); return { id: "session-derived-id", emailVerified: verified ? new Date() : null }; } },
    writingProfile: { async findUnique(args: unknown) { calls.push(["read", args]); return profile; } },
    async $transaction<T>(operation: (value: typeof transaction) => Promise<T>) { return operation(transaction); },
  };
  const source = readFileSync(new URL("../src/server/writing-profile-store.ts", import.meta.url), "utf8");
  const output = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  const routeModule = { exports: {} as Module };
  const stubRequire = (name: string) => {
    if (name === "server-only") return {};
    if (name === "@/auth") return { auth: async () => session };
    if (name === "@/lib/prisma") return { prisma };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "module", "exports", output)(stubRequire, routeModule, routeModule.exports);
  return { module: routeModule.exports, calls, set count(value: number) { count = value; }, set conflict(value: boolean) { conflict = value; } };
}

test("real writing store resolves only a verified current session's owner", async () => {
  for (const session of [null, {}, { user: {} }]) {
    const f = fixture(session);
    assert.equal(await f.module.currentWritingOwner(), null);
    assert.deepEqual(f.calls, []);
  }
  assert.equal(await fixture(undefined, false).module.currentWritingOwner(), null);
  const f = fixture();
  assert.equal(await f.module.currentWritingOwner(), "session-derived-id");
  assert.deepEqual(f.calls, [["owner", { where: { email: "synthetic@example.test" }, select: { id: true, emailVerified: true } }]]);
});

test("real writing store queries only the requested authenticated owner and no identity fields", async () => {
  const f = fixture();
  assert.deepEqual(await f.module.writingProfileStore.read("session-derived-id"), { samples: ["synthetic own words"], revision: "2026-10-07T12:00:00.000Z" });
  assert.deepEqual(f.calls, [["read", { where: { userId: "session-derived-id" }, select: { samples: true, updatedAt: true } }]]);
});

test("real writing store updates bind owner and revision and reject stale writes", async () => {
  const f = fixture();
  const revision = "2026-10-07T12:00:00.000Z";
  const result = await f.module.writingProfileStore.write("session-derived-id", ["new own sample"], revision);
  assert.deepEqual((f.calls[0][1] as { where: unknown }).where, { userId: "session-derived-id", updatedAt: new Date(revision) });
  assert.deepEqual(result?.samples, ["new own sample"]);
  f.count = 0;
  assert.equal(await f.module.writingProfileStore.write("session-derived-id", ["stale"], revision), null);
  f.conflict = true;
  assert.equal(await f.module.writingProfileStore.write("session-derived-id", ["concurrent create"], null), null);
});
