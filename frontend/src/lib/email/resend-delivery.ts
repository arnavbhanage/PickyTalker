import type { Resend } from "resend";
import type { Purpose } from "../auth/otp-core";
import { validateEmail } from "../auth/validation";
import { EmailDeliveryError } from "./email-errors";
export { EmailDeliveryError } from "./email-errors";
type EmailEnvironment = { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; AUTH_EMAIL_FROM?: string };
export function getEmailConfiguration(env: EmailEnvironment) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = (env.RESEND_FROM_EMAIL || env.AUTH_EMAIL_FROM)?.trim();
  if (!apiKey) throw new EmailDeliveryError("missingKey");
  if (!from) throw new EmailDeliveryError("missingSender");
  const address = from.match(/^[^<>]*<([^<>]+)>$/)?.[1]?.trim() ?? from;
  if (/[\r\n]/.test(from) || from.length > 320 || validateEmail(address)) throw new EmailDeliveryError("invalidSender");
  return { apiKey, from };
}

// Dependency injection exercises the actual Resend adapter without network or credentials.
export function createResendEmailSender(client: Pick<Resend, "emails">, from: string) {
  return async (recipient: string, code: string, expiresAt: Date, purpose: Purpose = "verify", challengeId?: string) => {
    if (validateEmail(recipient) || !/^[0-9]{6}$/.test(code) || Number.isNaN(expiresAt.getTime())) throw new EmailDeliveryError("failed");
    const subject = purpose === "reset" ? "Your PickyTalker password reset code" : "Your PickyTalker verification code";
    try {
      const result = await client.emails.send({ from, to: [recipient], subject,
        text: subject + "\n\n" + code + "\n\nThis code expires in 10 minutes (" + expiresAt.toISOString() + ").\n\nIf you did not request this code, you can ignore this email." },
        { signal: AbortSignal.timeout(10_000), ...(challengeId ? { idempotencyKey: "pt-otp-" + challengeId } : {}) });
      // The SDK can resolve with { error }, not just reject; never treat it as delivery.
      if (result.error) throw new EmailDeliveryError(result.error.name === "validation_error" ? "providerRejected" : "failed");
      if (!result.data?.id) throw new EmailDeliveryError("failed");
    } catch (error) {
      // Provider errors may echo payloads. No logging or raw error serialization.
      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError("failed");
    }
  };
}
