# Authentication milestone

The existing Auth.js Google provider and Prisma adapter remain the foundation.
Email/password uses versioned bcrypt (cost 12); existing unversioned bcrypt hashes
continue to work. Passwords must be hashed, not reversibly encrypted.

## Email configuration

Add these server-only keys to `.env.local` (never `NEXT_PUBLIC_*`):

Choose `EMAIL_PROVIDER=resend` (the default), or `EMAIL_PROVIDER=gmail`.
For Gmail, use `GMAIL_SMTP_USER` and `GMAIL_SMTP_APP_PASSWORD` instead of the
Resend variables below. Follow [GMAIL_SMTP_SETUP.md](./GMAIL_SMTP_SETUP.md).
Run `npm run email:check` to test Gmail SMTP connection/authentication without
sending email. Gmail mode sends from the authenticated Gmail account and does
not fall back to Resend on failure.

- `RESEND_API_KEY`: your Resend API key with sending permission.
- `RESEND_FROM_EMAIL`: a sender address on your verified Resend domain.
  A display name such as `PickyTalker <verify@your-domain>` is supported.
  `AUTH_EMAIL_FROM` is accepted as a backwards-compatible sender alias.

Resend mode uses the official Resend SDK. Gmail mode uses Nodemailer over
authenticated TLS to `smtp.gmail.com:465`. Both modes reuse the existing OTP
flow and sanitize email-provider errors.
There is no automatic sender fallback. Verify your domain in the Resend dashboard
and choose a sender from that domain. See [Resend's domain guide](https://resend.com/docs/dashboard/domains/introduction).

Restart Next after changing environment variables. No development OTP endpoint,
console delivery, known-password account, or automatic demo user is installed.
Missing configuration for the selected provider blocks new email signup/reset requests
with a safe, specific message. Google remains usable. An account created before a delivery failure
can resume verification by signing in with its password once delivery is restored.

## Routes and security

- `/signin`: Google or email/password. Unverified password accounts must verify.
- `/signup`: first name, last name, email, password and confirmation.
- `/verify-email`: six-digit verification, followed by automatic authenticated access.
- `/forgot-password`: generic reset-code request for eligible password accounts.
- `/forgot-password/verify`: verify code, then choose/confirm the new password.
- `/app`: server-side session guard; no chatbot implementation was added.

Codes use Node's `crypto.randomInt`, a keyed SHA-256 HMAC bound to a random
256-bit challenge identifier, a 10-minute lifetime, five attempts and a 60-second
server-enforced resend cooldown. Each new challenge replaces the old one for
that email/purpose. Codes are six digits (100000–999999). Only hashed codes
and grants are stored in PostgreSQL; the plain code is passed solely to Resend.
The Resend helper checks both rejected promises and resolved API error objects,
uses a ten-second request timeout and a challenge-specific idempotency key.
Raw provider errors and payloads are never printed or returned to the browser.
Challenge identifiers and reset grants use HttpOnly, SameSite=Lax cookies
(Secure in production). Successful verification consumes the code and creates
a five-minute, single-use, 256-bit grant. Database advisory transaction locks
serialize issuance, verification attempts and grant consumption per email.
Password reset increments `users.session_version` to invalidate earlier JWTs.
Pre-milestone JWTs require one fresh login after this migration.

Google must supply `email_verified: true`. It bypasses the custom email OTP.
Auth.js's default `OAuthAccountNotLinked` protection is intentionally retained:
same-email accounts are not automatically merged or duplicated. Sign in using
the original method if this message appears. A user-facing explicit linking flow
is not part of this milestone.

The additive `20261006190000_email_verification` migration creates
`email_verification_codes` and adds `users.session_version`; no Auth.js tables
were reset or removed. `AUTH_SECRET` must remain stable and confidential because
it protects sessions and OTP hashes. Changing it invalidates outstanding codes.

## Verification

Run `npm run test:auth`, `npm run build`, `npx tsc --noEmit`, `npm run lint`,
`npx prisma validate`, `npx prisma generate`, and `npx prisma migrate status`.
Tests use mocked delivery and an in-memory transactional store, not real email
or production accounts. Code Slots interaction tests use jsdom/Testing Library.
The actual Resend adapter is tested by mocking the SDK's `emails.send` method;
it never uses the configured API key or sends live mail in automated tests.

Run `node tests/runtime-smoke.mjs` with a running local server to check safe
validation/configuration errors and anonymous redirects. It refuses to run its
signup requests if the selected email provider's configuration is complete. Run
`npx tsx tests/database-smoke.ts` for a read-only schema/lock check.

Before public production use, review the existing npm audit findings and add
deployment-level credential/IP abuse limits. Real Resend delivery and a real Google
callback must also be exercised with your external accounts. Schedule periodic
cleanup of expired challenge records; the database stores one row per email/purpose.
