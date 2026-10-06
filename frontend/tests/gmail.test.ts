import { test } from "node:test";
import assert from "node:assert/strict";
import type Mail from "nodemailer/lib/mailer";
import { createGmailEmailSender, getGmailConfiguration, gmailTransportOptions, type GmailTransport } from "../src/lib/email/gmail-delivery";
import { EmailDeliveryError, selectEmailProvider } from "../src/lib/email/email-errors";

const user = "synthetic-sender@gmail.com";
const config = { user, appPassword: "abcdefghijklmnop" }; // Mock value only, never a real credential.
const recipient = "synthetic-recipient@example.test";
const expires = new Date("2026-10-07T00:10:00Z");

test("provider selection keeps Resend as default and supports explicit Gmail", () => {
  assert.equal(selectEmailProvider(), "resend");
  assert.equal(selectEmailProvider(" gmail "), "gmail");
  assert.throws(() => selectEmailProvider("unknown"), /provider configuration/);
});
test("Gmail configuration requires account and App Password, accepting Google's display spaces", () => {
  assert.throws(() => getGmailConfiguration({}), /not configured/);
  assert.throws(() => getGmailConfiguration({ GMAIL_SMTP_USER: user, GMAIL_SMTP_APP_PASSWORD: "too-short" }), /16-character/);
  assert.deepEqual(getGmailConfiguration({ GMAIL_SMTP_USER: user, GMAIL_SMTP_APP_PASSWORD: "abcd efgh ijkl mnop" }), config);
  assert.throws(() => getGmailConfiguration({ GMAIL_SMTP_USER: "bad\r\nBcc:other@example.test", GMAIL_SMTP_APP_PASSWORD: config.appPassword }), /invalid/);
});
test("Gmail transport uses authenticated TLS with safe timeouts and logging disabled", () => {
  const options = gmailTransportOptions(config);
  assert.equal(options.host, "smtp.gmail.com");
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.tls!.rejectUnauthorized, true);
  assert.equal(options.debug, false);
  assert.equal(options.logger, false);
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
});
test("Gmail sends plain OTP only in mail, using the authenticated sender, then closes transport", async () => {
  let payload: Mail.Options | undefined;
  let closed = 0;
  const transport: GmailTransport = { sendMail: async value => { payload = value; return { accepted: [recipient], rejected: [] }; }, close: () => { closed++; } };
  const result = await createGmailEmailSender(config, () => transport)(recipient, "483921", expires);
  assert.equal(result, undefined);
  assert.deepEqual(payload!.from, { name: "PickyTalker", address: user });
  assert.deepEqual(payload!.to, { name: "", address: recipient });
  assert.ok(String(payload!.text).includes("483921"));
  assert.ok(String(payload!.text).includes("10 minutes"));
  assert.equal(payload!.subject, "Your PickyTalker verification code");
  assert.equal(closed, 1);
});
test("Gmail password-reset mail uses the same sender with reset-specific subject", async () => {
  let subject: string | undefined;
  const transport: GmailTransport = { sendMail: async payload => { subject = payload.subject; return { accepted: [recipient] }; }, close: () => undefined };
  await createGmailEmailSender(config, () => transport)(recipient, "483921", expires, "reset");
  assert.equal(subject, "Your PickyTalker password reset code");
});
test("Gmail authentication failure is sanitized, not logged, and closes transport", async t => {
  let closed = 0;
  const log = t.mock.method(console, "error", () => undefined);
  const transport: GmailTransport = { sendMail: async () => { throw Object.assign(new Error("raw-secret-483921"), { code: "EAUTH" }); }, close: () => { closed++; } };
  await assert.rejects(createGmailEmailSender(config, () => transport)(recipient, "483921", expires), error => {
    assert.ok(error instanceof EmailDeliveryError);
    assert.match(error.message, /Gmail authentication failed/);
    assert.ok(!error.message.includes("483921"));
    return true;
  });
  assert.equal(closed, 1);
  assert.equal(log.mock.callCount(), 0);
});
test("SMTP rejection or missing acceptance is not treated as successful delivery", async () => {
  for (const response of [{ accepted: [], rejected: [recipient] }, { accepted: [recipient], rejected: [recipient] }]) {
    const transport: GmailTransport = { sendMail: async () => response, close: () => undefined };
    await assert.rejects(createGmailEmailSender(config, () => transport)(recipient, "483921", expires), /could not send/);
  }
});
test("bad Gmail email payload is rejected before creating a transport", async () => {
  let calls = 0;
  await assert.rejects(createGmailEmailSender(config, () => { calls++; throw new Error("Must not run"); })(recipient, "123", expires));
  assert.equal(calls, 0);
});
