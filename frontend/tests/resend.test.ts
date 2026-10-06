import { test } from "node:test";
import assert from "node:assert/strict";
import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions } from "resend";
import { createResendEmailSender, EmailDeliveryError, getEmailConfiguration } from "../src/lib/email/resend-delivery";
import { createVerificationService, type VerificationStore } from "../src/lib/auth/verification-service";
import { checkCode, type Challenge } from "../src/lib/auth/otp-core";

const from = "PickyTalker <verify@example.test>";
const recipient = "synthetic@example.test";
const expiresAt = new Date("2026-10-07T00:10:00Z");
const code = "483921";

test("Resend requires a server API key and an explicitly configured sender", () => {
  assert.throws(() => getEmailConfiguration({ RESEND_FROM_EMAIL: from }), /not configured/);
  assert.throws(() => getEmailConfiguration({ RESEND_API_KEY: "mock-only" }), /RESEND_FROM_EMAIL/);
  assert.deepEqual(getEmailConfiguration({ RESEND_API_KEY: "mock-only", RESEND_FROM_EMAIL: from }), { apiKey: "mock-only", from });
  assert.deepEqual(getEmailConfiguration({ RESEND_API_KEY: "mock-only", AUTH_EMAIL_FROM: from }), { apiKey: "mock-only", from });
});

test("invalid sender addresses and header injection are rejected", () => {
  for (const sender of ["not-an-email", "a@example.test\r\nBcc: b@example.test", "a@example.test,b@example.test"]) {
    assert.throws(() => getEmailConfiguration({ RESEND_API_KEY: "mock-only", RESEND_FROM_EMAIL: sender }), /configuration is invalid/);
  }
});

test("Resend receives the plain six-digit code only in the email payload", async t => {
  const resend = new Resend("mock-only-not-a-real-key");
  const send = t.mock.method(resend.emails, "send", async () => ({ data: { id: "mock-email" }, error: null, headers: null }));
  await createResendEmailSender(resend, from)(recipient, code, expiresAt, "verify", "challenge-id");
  assert.equal(send.mock.callCount(), 1);
  const payload = send.mock.calls[0].arguments[0] as CreateEmailOptions;
  const options = send.mock.calls[0].arguments[1] as CreateEmailRequestOptions;
  assert.equal(payload.from, from);
  assert.deepEqual(payload.to, [recipient]);
  assert.equal(payload.subject, "Your PickyTalker verification code");
  assert.ok(payload.text?.includes(code));
  assert.ok(payload.text?.includes("10 minutes"));
  assert.ok(payload.text?.includes("If you did not request"));
  assert.equal(options.idempotencyKey, "pt-otp-challenge-id");
  assert.ok(options.signal);
});

test("password reset reuses the Resend helper with reset-specific email copy", async t => {
  const resend = new Resend("mock-only-not-a-real-key");
  const send = t.mock.method(resend.emails, "send", async () => ({ data: { id: "mock-email" }, error: null, headers: null }));
  await createResendEmailSender(resend, from)(recipient, code, expiresAt, "reset");
  const payload = send.mock.calls[0].arguments[0] as CreateEmailOptions;
  assert.equal(payload.subject, "Your PickyTalker password reset code");
});

test("Resend's resolved error response is not mistaken for successful delivery", async t => {
  const resend = new Resend("mock-only-not-a-real-key");
  t.mock.method(resend.emails, "send", async () => ({ data: null, error: { name: "validation_error", message: "sensitive raw payload " + code }, headers: null }));
  await assert.rejects(createResendEmailSender(resend, from)(recipient, code, expiresAt), error => {
    assert.ok(error instanceof EmailDeliveryError);
    assert.match(error.message, /verified Resend sender/);
    assert.ok(!error.message.includes(code));
    return true;
  });
});

test("Resend network errors are sanitized without printing secrets or codes", async t => {
  const resend = new Resend("mock-only-not-a-real-key");
  t.mock.method(resend.emails, "send", async () => { throw new Error("raw key/code " + code); });
  const errorLog = t.mock.method(console, "error", () => undefined);
  const log = t.mock.method(console, "log", () => undefined);
  await assert.rejects(createResendEmailSender(resend, from)(recipient, code, expiresAt), error => {
    assert.ok(error instanceof EmailDeliveryError);
    assert.equal(error.message, "We could not send your email. Please try again shortly.");
    assert.ok(!error.message.includes(code));
    return true;
  });
  assert.equal(errorLog.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 0);
});

test("malformed OTP payloads never call Resend", async t => {
  const resend = new Resend("mock-only-not-a-real-key");
  const send = t.mock.method(resend.emails, "send");
  await assert.rejects(createResendEmailSender(resend, from)(recipient, "123", expiresAt));
  assert.equal(send.mock.callCount(), 0);
});

test("synthetic signup verification with mocked Resend stores only a hash and consumes the code", async t => {
  const resend = new Resend("mock-only-not-a-real-key");
  const send = t.mock.method(resend.emails, "send", async () => ({ data: { id: "mock-email" }, error: null, headers: null }));
  let record: Challenge | null = null;
  const user = { id: "synthetic-user", email: recipient, passwordHash: "mock-already-hashed-password", emailVerified: null as Date | null };
  const store: VerificationStore = {
    get: async () => record,
    save: async value => { record = value; },
    user: async () => user,
    verifyUser: async (_, at) => { user.emailVerified = at; },
    resetPassword: async () => { throw new Error("Not part of this signup test"); },
  };
  const key = "test-only-hmac-key";
  const service = createVerificationService({ key, now: () => new Date("2026-10-07T00:00:00Z"), transaction: (_, work) => work(store), send: createResendEmailSender(resend, from) });
  const issued = await service.issue(recipient, "verify");
  assert.ok(issued.record);
  const plainCode = (send.mock.calls[0].arguments[0] as CreateEmailOptions).text!.split("\n\n")[1];
  assert.match(plainCode, /^[1-9][0-9]{5}$/);
  const saved = await store.get(recipient, "verify");
  assert.ok(saved);
  assert.notEqual(saved.codeHash, plainCode);
  assert.equal(Object.hasOwn(saved, "code"), false);
  assert.equal(Object.values(saved).includes(plainCode), false);
  assert.equal(user.emailVerified, null);
  assert.equal(checkCode(saved, plainCode, new Date("2026-10-07T00:00:00Z"), key), undefined);
  const result = await service.verify(recipient, "verify", saved.id, plainCode);
  assert.ok(result.grant);
  assert.ok(user.emailVerified);
  assert.ok((await store.get(recipient, "verify"))!.usedAt);
  assert.ok((await service.verify(recipient, "verify", saved.id, plainCode)).error);
  assert.ok(await service.consumeGrant(recipient, "verify", saved.id, result.grant!));
  assert.equal(await service.consumeGrant(recipient, "verify", saved.id, result.grant!), null);
});
