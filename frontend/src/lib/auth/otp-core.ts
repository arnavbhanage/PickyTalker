import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_LIFETIME_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;
export type Purpose = "verify" | "reset";
export type Challenge = {
  id: string; email: string; purpose: string; codeHash: string; expiresAt: Date;
  attempts: number; createdAt: Date; resendAt: Date; usedAt: Date | null;
  grantHash: string | null; grantExpiresAt: Date | null;
};
export function generateCode() { return randomInt(100_000, 1_000_000).toString(); }
export function generateSecret() { return randomBytes(32).toString("hex"); }
export function secretHash(secret: string, context: string, key: string) {
  if (!key) throw new Error("Authentication secret is not configured");
  // Keyed hash prevents offline enumeration of the small six-digit space.
  return createHmac("sha256", key).update(context + ":" + secret).digest("hex");
}
export function matchesSecret(secret: string, expected: string, context: string, key: string) {
  const actual = Buffer.from(secretHash(secret, context, key), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
export function makeChallenge(email: string, purpose: Purpose, now: Date, key: string, previous?: Challenge | null) {
  let code = generateCode();
  // Do not accidentally resend the same numeric code.
  while (previous && matchesSecret(code, previous.codeHash, previous.id, key)) code = generateCode();
  const id = generateSecret();
  const record: Challenge = { id, email, purpose, codeHash: secretHash(code, id, key),
    expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS), attempts: 0, createdAt: now,
    resendAt: new Date(now.getTime() + RESEND_COOLDOWN_MS), usedAt: null,
    grantHash: null, grantExpiresAt: null };
  return { code, record };
}
export function checkCode(record: Challenge | null, code: string, now: Date, key: string) {
  if (!record || record.usedAt) return "This code is no longer active. Request a new code.";
  if (record.expiresAt <= now) return "This code has expired. Request a new code.";
  if (record.attempts >= MAX_ATTEMPTS) return "Too many attempts. Request a new code.";
  if (!/^\d{6}$/.test(code) || !matchesSecret(code, record.codeHash, record.id, key)) return "The code is incorrect. Please try again.";
}
