import { test } from "node:test";
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { validatePassword, validateSignup, isVerifiedGoogle } from "../src/lib/auth/validation";
import { generateCode, checkCode, makeChallenge, OTP_LIFETIME_MS, RESEND_COOLDOWN_MS, type Challenge, type Purpose } from "../src/lib/auth/otp-core";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { createVerificationService, type VerificationStore, type AuthUser } from "../src/lib/auth/verification-service";

const address = "test@example.test";
const key = "test-only-hmac-secret-not-a-production-secret";
const fields = { firstName: "Tyler", lastName: "Durden", email: address, password: "long-enough-password", confirmPassword: "long-enough-password" };
function fixture(google = false) {
  let time = new Date("2026-10-06T00:00:00Z");
  const records = new Map<string, Challenge>();
  let user: AuthUser | null = { id: "test-user", email: address, passwordHash: google ? null : "test-password-hash", emailVerified: google ? time : null };
  const deliveries: { code: string; purpose: Purpose; expiresAt: Date }[] = [];
  let failSend = false;
  let resetCount = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const store: VerificationStore = {
    get: async (email, purpose) => records.get(email + purpose) ?? null,
    save: async record => { records.set(record.email + record.purpose, record); },
    user: async () => user,
    verifyUser: async (_, at) => { user = { ...user!, emailVerified: at }; },
    resetPassword: async (_, hash) => { user = { ...user!, passwordHash: hash }; resetCount++; },
  };
  const service = createVerificationService({ key, now: () => time,
    send: async (_, code, expiresAt, purpose) => { if (failSend) throw new Error("mock mail unavailable"); deliveries.push({ code, expiresAt, purpose }); },
    transaction: <T,>(_: string, work: (store: VerificationStore) => Promise<T>) => {
      const next = tail.then(async () => {
        const previous = new Map(records);
        const originalUser = user;
        try { return await work(store); } catch (error) { records.clear(); previous.forEach((v, k) => records.set(k, v)); user = originalUser; throw error; }
      });
      tail = next.catch(() => undefined);
      return next;
    },
  });
  return { service, deliveries, records, advance: (ms: number) => { time = new Date(time.getTime() + ms); }, get user() { return user; },
    get resetCount() { return resetCount; }, failEmail: () => { failSend = true; }, removeUser: () => { user = null; } };
}

test("password mismatch and missing confirmation are rejected", () => {
  assert.match(validatePassword("abcdefgh", "different")!, /match/);
  assert.match(validatePassword("abcdefgh", "")!, /confirm/);
});
test("signup validates names, email and password independently", () => {
  assert.equal(validateSignup(fields), undefined);
  assert.match(validateSignup({ ...fields, firstName: " " })!, /name/);
  assert.match(validateSignup({ ...fields, lastName: "x".repeat(41) })!, /40/);
  assert.match(validateSignup({ ...fields, email: "invalid" })!, /email/);
  assert.match(validateSignup({ ...fields, email: "a@example.test,b@example.test" })!, /email/);
  assert.match(validateSignup({ ...fields, password: "short", confirmPassword: "short" })!, /8/);
  assert.match(validatePassword("😀".repeat(19), "😀".repeat(19))!, /72/);
});
test("new passwords are versioned bcrypt; legacy bcrypt remains readable", async () => {
  const stored = await hashPassword(fields.password);
  assert.ok(stored.startsWith("bcrypt-v1:$2b$12$"));
  assert.ok(await verifyPassword(fields.password, stored));
  assert.equal(await verifyPassword("wrong", stored), false);
  assert.ok(await verifyPassword(fields.password, await hash(fields.password, 4)));
  assert.equal(await verifyPassword(fields.password, "plaintext"), false);
});
test("secure OTP is exactly six digits, using cryptographic randomInt", t => {
  t.mock.method(Math, "random", () => { throw new Error("Insecure randomness must not be used"); });
  for (let i = 0; i < 1000; i++) assert.match(generateCode(), /^[1-9][0-9]{5}$/);
  const { code, record } = makeChallenge(address, "verify", new Date(), key);
  assert.notEqual(record.codeHash, code);
  assert.match(record.codeHash, /^[a-f0-9]{64}$/);
  assert.equal(record.expiresAt.getTime() - record.createdAt.getTime(), OTP_LIFETIME_MS);
  assert.equal(checkCode(record, code, new Date(), "wrong-key")?.includes("incorrect"), true);
});

test("a correct fifth attempt succeeds after four wrong attempts", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify");
  const wrong = f.deliveries[0].code === "111111" ? "222222" : "111111";
  for (let i = 0; i < 4; i++) await f.service.verify(address, "verify", issued.record!.id, wrong);
  assert.equal(f.records.get(address + "verify")!.attempts, 4);
  assert.ok((await f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code)).grant);
});
test("correct code verifies the user and issues one single-use login grant", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify");
  const result = await f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code);
  assert.ok(result.grant); assert.ok(f.user?.emailVerified);
  assert.ok(await f.service.consumeGrant(address, "verify", issued.record!.id, result.grant!));
  assert.equal(await f.service.consumeGrant(address, "verify", issued.record!.id, result.grant!), null);
});
test("incorrect code increments attempts and never verifies account", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify");
  const wrong = f.deliveries[0].code === "000000" ? "111111" : "000000";
  assert.match((await f.service.verify(address, "verify", issued.record!.id, wrong)).error!, /incorrect/);
  assert.equal(f.records.get(address + "verify")!.attempts, 1); assert.equal(f.user?.emailVerified, null);
});
test("expired code is rejected at the exact ten-minute boundary", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify"); f.advance(OTP_LIFETIME_MS);
  assert.match((await f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code)).error!, /expired/);
});
test("successfully used code cannot be reused", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify");
  await f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code);
  assert.match((await f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code)).error!, /no longer active/);
});
test("five wrong attempts lock the challenge, even for a subsequently correct code", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify");
  const wrong = f.deliveries[0].code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await f.service.verify(address, "verify", issued.record!.id, wrong);
  assert.equal(f.records.get(address + "verify")!.attempts, 5);
  assert.match((await f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code)).error!, /Too many/);
  assert.equal(f.records.get(address + "verify")!.attempts, 5);
});
test("resend waits for server cooldown and replaces previous code and context", async () => {
  const f = fixture(); const first = await f.service.issue(address, "verify");
  const wrong = f.deliveries[0].code === "111111" ? "222222" : "111111";
  await f.service.verify(address, "verify", first.record!.id, wrong);
  assert.match((await f.service.issue(address, "verify")).error!, /wait/);
  assert.equal(f.deliveries.length, 1);
  f.advance(RESEND_COOLDOWN_MS); const second = await f.service.issue(address, "verify");
  assert.equal(f.deliveries.length, 2); assert.notEqual(first.record!.id, second.record!.id);
  assert.equal(second.record!.attempts, 0);
  assert.equal(second.record!.expiresAt.getTime() - second.record!.createdAt.getTime(), OTP_LIFETIME_MS);
  assert.notEqual(f.deliveries[0].code, f.deliveries[1].code);
  assert.match((await f.service.verify(address, "verify", first.record!.id, f.deliveries[0].code)).error!, /replaced/);
  assert.match((await f.service.verify(address, "verify", second.record!.id, f.deliveries[0].code)).error!, /incorrect/);
  assert.ok((await f.service.verify(address, "verify", second.record!.id, f.deliveries[1].code)).grant);
});
test("concurrent resend requests produce only one delivery", async () => {
  const f = fixture(); const results = await Promise.all([f.service.issue(address, "verify"), f.service.issue(address, "verify")]);
  assert.equal(f.deliveries.length, 1); assert.equal(results.filter(r => r.record).length, 1);
});
test("concurrent correct verification cannot create two grants", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "verify");
  const results = await Promise.all([f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code), f.service.verify(address, "verify", issued.record!.id, f.deliveries[0].code)]);
  assert.equal(results.filter(r => r.grant).length, 1);
});
test("email provider failure rolls back challenge issuance", async () => {
  const f = fixture(); f.failEmail(); await assert.rejects(f.service.issue(address, "verify")); assert.equal(f.records.size, 0);
});
test("appropriately verified Google identity bypasses OTP; no email is sent", async () => {
  assert.equal(isVerifiedGoogle({ email_verified: true }), true);
  assert.equal(isVerifiedGoogle({ email_verified: false }), false);
  assert.equal(isVerifiedGoogle({ email_verified: "true" }), false);
  const f = fixture(true); await f.service.issue(address, "verify"); assert.equal(f.deliveries.length, 0);
});
test("unknown and Google-only reset accounts do not disclose existence or send reset mail", async () => {
  const f = fixture(); f.removeUser(); assert.ok((await f.service.issue(address, "reset")).record); assert.equal(f.deliveries.length, 0);
  const google = fixture(true); assert.ok((await google.service.issue(address, "reset")).record); assert.equal(google.deliveries.length, 0);
});
test("password reset requires a verified grant; code alone cannot change a password", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "reset");
  assert.equal(await f.service.consumeGrant(address, "reset", issued.record!.id, f.deliveries[0].code, "new-hash"), null);
  assert.equal(f.resetCount, 0);
  const result = await f.service.verify(address, "reset", issued.record!.id, f.deliveries[0].code);
  assert.ok(result.grant); assert.equal(f.resetCount, 0);
  assert.equal(await f.service.consumeGrant(address, "verify", issued.record!.id, result.grant!, "new-hash"), null);
  assert.ok(await f.service.consumeGrant(address, "reset", issued.record!.id, result.grant!, "new-hash"));
  assert.equal(f.user!.passwordHash, "new-hash"); assert.equal(f.resetCount, 1);
  assert.equal(await f.service.consumeGrant(address, "reset", issued.record!.id, result.grant!, "another-hash"), null);
});
test("expired reset grant and forged grant cannot reset password", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "reset");
  const result = await f.service.verify(address, "reset", issued.record!.id, f.deliveries[0].code);
  assert.equal(await f.service.consumeGrant(address, "reset", issued.record!.id, "forged", "new-hash"), null);
  f.advance(5 * 60_000);
  assert.equal(await f.service.consumeGrant(address, "reset", issued.record!.id, result.grant!, "new-hash"), null);
  assert.equal(f.resetCount, 0);
});
test("resend invalidates an outstanding reset grant", async () => {
  const f = fixture(); const issued = await f.service.issue(address, "reset");
  const result = await f.service.verify(address, "reset", issued.record!.id, f.deliveries[0].code);
  f.advance(RESEND_COOLDOWN_MS); await f.service.issue(address, "reset");
  assert.equal(await f.service.consumeGrant(address, "reset", issued.record!.id, result.grant!, "new-hash"), null);
});
