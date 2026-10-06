import { config } from "dotenv";
import nodemailer from "nodemailer";
import { EmailDeliveryError, selectEmailProvider } from "../src/lib/email/email-errors";
import { getGmailConfiguration, gmailTransportOptions } from "../src/lib/email/gmail-delivery";
import { getEmailConfiguration } from "../src/lib/email/resend-delivery";

config({ path: ".env.local", quiet: true });
async function main() {
  let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
  try {
    if (selectEmailProvider(process.env.EMAIL_PROVIDER) === "gmail") {
      const gmail = getGmailConfiguration({ GMAIL_SMTP_USER: process.env.GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD: process.env.GMAIL_SMTP_APP_PASSWORD });
      transport = nodemailer.createTransport(gmailTransportOptions(gmail));
      await transport.verify();
      console.log("Gmail SMTP connection and authentication succeeded. No email was sent.");
    } else {
      getEmailConfiguration({ RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL, AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM });
      console.log("Resend configuration is present. No email was sent; sending permissions are not verified by this check.");
    }
  } catch (error) {
    console.error(error instanceof EmailDeliveryError ? error.message : "Email connection/authentication failed. Check your provider credentials and network access.");
    process.exitCode = 1;
  } finally { transport?.close(); }
}
void main();
