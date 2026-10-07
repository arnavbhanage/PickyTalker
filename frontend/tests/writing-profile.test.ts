import { test } from "node:test";
import assert from "node:assert/strict";
import { createWritingProfileHandlers, type WritingProfileStore } from "../src/server/writing-profile-handlers";
import { isWritingProfile, validateWritingSamples, type WritingProfile } from "../src/lib/writing-profile";

const samples = ["yep gotchu", "no worries :)\nill check", "nah tomorrow works"];
const revision = "2026-10-07T12:00:00.000Z";
function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/writing-profile", { method: "PUT", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function fixture(owner: string | null = "synthetic-owner") {
  const profiles = new Map<string, WritingProfile>();
  const reads: string[] = [];
  const writes: Array<{ owner: string; samples: string[] }> = [];
  const store: WritingProfileStore = {
    async read(id) { reads.push(id); return profiles.get(id) ?? { samples: [], revision: null }; },
    async write(id, next, expected) {
      if ((profiles.get(id)?.revision ?? null) !== expected) return null;
      writes.push({ owner: id, samples: next });
      const result = { samples: next, revision };
      profiles.set(id, result);
      return result;
    },
  };
  return { handlers: createWritingProfileHandlers(async () => owner, store), store, reads, writes, profiles };
}

test("writing sample validation bounds Unicode count, total size, blanks and duplicates", () => {
  assert.equal(validateWritingSamples(samples), null);
  assert.equal(validateWritingSamples(["😀".repeat(2000)]), null);
  for (const invalid of [null, {}, [1], ["  "], ["😀".repeat(2001)], Array.from({ length: 101 }, (_, i) => `sample ${i}`), ["same", " same "], Array.from({ length: 30 }, (_, i) => `${i}` + "x".repeat(1990))]) {
    assert.ok(validateWritingSamples(invalid));
  }
  assert.equal(validateWritingSamples([]), null, "explicitly removing all samples is allowed");
  assert.equal(isWritingProfile({ samples, revision }), true);
  assert.equal(isWritingProfile({ samples, revision: "invalid" }), false);
});

test("signed-out sample reads and writes never touch storage", async () => {
  const f = fixture(null);
  assert.equal((await f.handlers.GET()).status, 401);
  assert.equal((await f.handlers.PUT(request({ samples, revision: null }))).status, 401);
  assert.deepEqual(f.reads, []);
  assert.deepEqual(f.writes, []);
});

test("sample storage uses only authenticated ownership and returns no owner IDs", async () => {
  const f = fixture();
  f.profiles.set("other-account", { samples: ["private-other-account-message"], revision });
  const saved = await f.handlers.PUT(request({ samples, revision: null }));
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { samples, revision });
  assert.deepEqual(f.writes, [{ owner: "synthetic-owner", samples }]);
  const loaded = await f.handlers.GET();
  assert.equal(loaded.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await loaded.json(), { samples, revision });
  assert.deepEqual(f.profiles.get("other-account")?.samples, ["private-other-account-message"]);
});

test("client-supplied account IDs, invalid samples and cross-origin writes are rejected", async () => {
  const f = fixture();
  assert.equal((await f.handlers.PUT(request({ samples, revision: null, userId: "other-account" }))).status, 422);
  assert.equal((await f.handlers.PUT(request({ samples: [" "], revision: null }))).status, 422);
  assert.equal((await f.handlers.PUT(request({ samples, revision: null }, "https://untrusted.test"))).status, 403);
  assert.deepEqual(f.writes, []);
});

test("stale revisions cannot silently overwrite another tab's samples", async () => {
  const f = fixture();
  f.profiles.set("synthetic-owner", { samples, revision });
  assert.equal((await f.handlers.PUT(request({ samples: ["new text"], revision: null }))).status, 409);
  assert.equal((await f.handlers.PUT(request({ samples: ["new text"], revision: "2026-10-07T11:00:00.000Z" }))).status, 409);
  assert.deepEqual(f.writes, []);
});

test("storage failures are safe and never leak database credentials or samples", async () => {
  const failure = async () => { throw new Error("postgres://private:secret@host/private-sample"); };
  const handlers = createWritingProfileHandlers(async () => "synthetic-owner", { read: failure, write: failure });
  const loaded = await handlers.GET();
  const saved = await handlers.PUT(request({ samples, revision: null }));
  assert.equal(loaded.status, 503);
  assert.equal(saved.status, 503);
  for (const response of [loaded, saved]) assert.equal((await response.text()).includes("postgres://"), false);
});

test("streamed oversized bodies and invalid JSON cannot bypass sample validation", async () => {
  const f = fixture();
  assert.equal((await f.handlers.PUT(request({ samples: ["x".repeat(200_001)], revision: null }))).status, 413);
  const malformed = new Request("http://localhost/api/writing-profile", { method: "PUT", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: "{" });
  assert.equal((await f.handlers.PUT(malformed)).status, 422);
  assert.deepEqual(f.writes, []);
});
