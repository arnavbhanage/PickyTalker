import type Mail from "nodemailer/lib/mailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Purpose } from "../auth/otp-core";
import { validateEmail } from "../auth/validation";
import { EmailDeliveryError } from "./email-errors";

export type GmailConfiguration = { user: string; appPassword: string };
export function getGmailConfiguration(env: { GMAIL_SMTP_USER?: string; GMAIL_SMTP_APP_PASSWORD?: string }): GmailConfiguration {
  const user = env.GMAIL_SMTP_USER?.trim().toLowerCase();
  const appPassword = env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !appPassword) throw new EmailDeliveryError("missingGmail");
  if (validateEmail(user) || !/^[a-zA-Z0-9]{16}$/.test(appPassword)) throw new EmailDeliveryError("invalidGmail");
  return { user, appPassword };
}

export function gmailTransportOptions(config: GmailConfiguration): SMTPTransport.Options {
  return {
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: config.user, pass: config.appPassword },
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    connectionTimeout: 5_000, greetingTimeout: 5_000, socketTimeout: 8_000,
  };
}
export type GmailTransport = {
  sendMail: (message: Mail.Options) => Promise<{ accepted?: (string | Mail.Address)[]; rejected?: (string | Mail.Address)[] }>;
  close: () => void;
};

export function createGmailEmailSender(config: GmailConfiguration, createTransport: (options: SMTPTransport.Options) => GmailTransport) {
  return async (recipient: string, code: string, expiresAt: Date, purpose: Purpose = "verify") => {
    if (validateEmail(recipient) || !/^[0-9]{6}$/.test(code) || Number.isNaN(expiresAt.getTime())) throw new EmailDeliveryError("failed");
    const transport = createTransport(gmailTransportOptions(config));
    const subject = purpose === "reset" ? "Your PickyTalker password reset code" : "Your PickyTalker verification code";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { transport.close(); reject(new EmailDeliveryError("failed")); }, 10_000);
      });
      const info = await Promise.race([transport.sendMail({
        from: { name: "PickyTalker", address: config.user },
        to: { name: "", address: recipient }, subject,
        text: subject + "\n\n" + code + "\n\nThis code expires in 10 minutes (" + expiresAt.toISOString() + ").\n\nIf you did not request this code, you can ignore this email.",
      }), deadline]);
      if (!info.accepted?.length || info.rejected?.length) throw new EmailDeliveryError("failed");
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      // SMTP errors may contain credentials, addresses or message content.
      if (typeof error === "object" && error !== null && "code" in error && error.code === "EAUTH") throw new EmailDeliveryError("gmailAuth");
      throw new EmailDeliveryError("failed");
    } finally {
      clearTimeout(timer);
      transport.close();
    }
  };
}
