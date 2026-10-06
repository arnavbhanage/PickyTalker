import "server-only";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { Purpose } from "@/lib/auth/otp";
import { createResendEmailSender, getEmailConfiguration } from "./resend-delivery";
import { createGmailEmailSender, getGmailConfiguration } from "./gmail-delivery";
import { selectEmailProvider } from "./email-errors";

export function requireEmailConfiguration() {
  const provider = selectEmailProvider(process.env.EMAIL_PROVIDER);
  if (provider === "gmail") return { provider, ...getGmailConfiguration({
    GMAIL_SMTP_USER: process.env.GMAIL_SMTP_USER,
    GMAIL_SMTP_APP_PASSWORD: process.env.GMAIL_SMTP_APP_PASSWORD,
  }) };
  return { provider, ...getEmailConfiguration({
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  }) };
}
export async function sendVerificationEmail(recipient: string, code: string, expiresAt: Date, purpose: Purpose = "verify", challengeId?: string) {
  const config = requireEmailConfiguration();
  if (config.provider === "gmail") {
    await createGmailEmailSender(config, options => nodemailer.createTransport(options))(recipient, code, expiresAt, purpose);
  } else {
    const resend = new Resend(config.apiKey);
    await createResendEmailSender(resend, config.from)(recipient, code, expiresAt, purpose, challengeId);
  }
}
