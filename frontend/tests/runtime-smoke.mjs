import { JSDOM } from "jsdom";
import { config } from "dotenv";
import assert from "node:assert/strict";

config({ path: ".env.local", quiet: true });
// This diagnostic only posts validation/missing-provider requests. Never send
// email or create a test account if someone later configures a real sender.
const sender = process.env.RESEND_FROM_EMAIL || process.env.AUTH_EMAIL_FROM;
const gmail = process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "gmail";
assert.ok(gmail ? !process.env.GMAIL_SMTP_USER || !process.env.GMAIL_SMTP_APP_PASSWORD : !process.env.RESEND_API_KEY || !sender, "Email is configured; skip this missing-provider diagnostic.");
const configurationError = gmail ? "Gmail SMTP is not configured." : process.env.RESEND_API_KEY ? "Email sender is not configured." : "Email delivery is not configured.";
const base = "http://localhost:3000";
for (const [path, values, expected] of [
  ["/signup", { firstName: "Tyler", lastName: "Durden", email: "test@example.test", password: "abcdefgh", confirmPassword: "different" }, "Passwords do not match."],
  ["/signup", { firstName: "Tyler", lastName: "Durden", email: "test@example.test", password: "abcdefgh", confirmPassword: "abcdefgh" }, configurationError],
  ["/forgot-password", { email: "test@example.test" }, configurationError],
]) {
  const html = await (await fetch(base + path)).text();
  const doc = new JSDOM(html).window.document;
  const form = [...doc.forms].find(item => item.querySelector('input[name="email"]'));
  assert.ok(form);
  const data = new FormData();
  for (const input of form.querySelectorAll('input[type="hidden"]')) data.append(input.name, input.value);
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  const response = await fetch(base + path, { method: "POST", body: data, headers: { origin: base }, redirect: "manual" });
  const result = await response.text();
  assert.equal(response.status, 200);
  assert.ok(result.includes(expected), path + " should return its expected safe validation error");
  console.log(path + ": expected server validation/configuration error passed");
}
for (const [path, location] of [["/app", "/signin"], ["/verify-email", "/signin"], ["/forgot-password/verify", "/forgot-password"]]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), location);
  console.log(path + ": unauthenticated redirect passed");
}
const providers = await (await fetch(base + "/api/auth/providers")).json();
assert.ok(providers.google);
assert.ok(providers.credentials);
console.log("Auth.js: Google and credentials providers present");
