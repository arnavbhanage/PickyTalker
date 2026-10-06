const messages = {
  missingKey: "Email delivery is not configured. Please try Google sign-in for now.",
  missingSender: "Email sender is not configured. Set RESEND_FROM_EMAIL to a verified Resend sender.",
  invalidSender: "Email sender configuration is invalid. Check RESEND_FROM_EMAIL.",
  providerRejected: "Email provider rejected the request. Check your verified Resend sender/domain and recipient permissions.",
  invalidProvider: "Email provider configuration is invalid. Use EMAIL_PROVIDER=gmail or resend.",
  missingGmail: "Gmail SMTP is not configured. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD.",
  invalidGmail: "Gmail SMTP configuration is invalid. Use your full Gmail address and a 16-character Google App Password.",
  gmailAuth: "Gmail authentication failed. Check your Google App Password and that 2-Step Verification is enabled.",
  failed: "We could not send your email. Please try again shortly.",
} as const;

export class EmailDeliveryError extends Error {
  constructor(kind: keyof typeof messages) { super(messages[kind]); this.name = "EmailDeliveryError"; }
}
export function selectEmailProvider(value?: string): "gmail" | "resend" {
  const provider = value?.trim().toLowerCase() || "resend";
  if (provider !== "gmail" && provider !== "resend") throw new EmailDeliveryError("invalidProvider");
  return provider;
}
