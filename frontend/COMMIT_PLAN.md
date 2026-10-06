# Suggested commits — not executed

The following are exact paths, grouped by suggested commit message. No Git
write commands have been run. The deletion listed in group 2 should be included.

## 1. `feat(auth): add secure email verification and password recovery`

- `C:\Dev\PickyTalker\frontend\.env.example`
- `C:\Dev\PickyTalker\frontend\prisma\schema.prisma`
- `C:\Dev\PickyTalker\frontend\prisma\migrations\20261006190000_email_verification\migration.sql`
- `C:\Dev\PickyTalker\frontend\src\auth.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth-actions.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\validation.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\password.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\otp.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\otp-core.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\verification-service.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\verification.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\challenge-cookie.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\email\send-verification-email.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\email\resend-delivery.ts`
- `C:\Dev\PickyTalker\frontend\src\app\app\layout.tsx`

## 2. `feat(ui): polish light auth pages with React Bits Code Slots`

- `C:\Dev\PickyTalker\frontend\src\app\globals.css`
- `C:\Dev\PickyTalker\frontend\src\app\signin\page.tsx`
- `C:\Dev\PickyTalker\frontend\src\app\signup\page.tsx`
- `C:\Dev\PickyTalker\frontend\src\app\verify-email\page.tsx`
- `C:\Dev\PickyTalker\frontend\src\app\forgot-password\page.tsx`
- `C:\Dev\PickyTalker\frontend\src\app\forgot-password\verify\page.tsx`
- `C:\Dev\PickyTalker\frontend\src\components\auth\CodeSlots.tsx`
- `C:\Dev\PickyTalker\frontend\src\components\auth\CodeSlots.css`
- `C:\Dev\PickyTalker\frontend\src\components\auth\account-form.tsx`
- `C:\Dev\PickyTalker\frontend\src\components\auth\auth-page-shell.tsx`
- `C:\Dev\PickyTalker\frontend\src\components\auth\password-field.tsx`
- `C:\Dev\PickyTalker\frontend\src\components\auth\verification-form.tsx`
- `C:\Dev\PickyTalker\frontend\src\components\auth\email-auth-forms.tsx` (deleted; replaced by separate forms)
- `C:\Dev\PickyTalker\frontend\src\lib\site-links.ts`
- `C:\Dev\PickyTalker\frontend\THIRD_PARTY_NOTICES.md`

## 3. `test(auth): cover OTP security and document provider setup`

- `C:\Dev\PickyTalker\frontend\package.json`
- `C:\Dev\PickyTalker\frontend\package-lock.json`
- `C:\Dev\PickyTalker\frontend\tests\auth.test.ts`
- `C:\Dev\PickyTalker\frontend\tests\resend.test.ts`
- `C:\Dev\PickyTalker\frontend\tests\code-slots.test.tsx`
- `C:\Dev\PickyTalker\frontend\tests\runtime-smoke.mjs`
- `C:\Dev\PickyTalker\frontend\tests\database-smoke.ts`
- `C:\Dev\PickyTalker\frontend\AUTH_SETUP.md`
- `C:\Dev\PickyTalker\frontend\COMMIT_PLAN.md`

## Gmail SMTP follow-up

Suggested message: `feat(email): support Gmail SMTP alongside Resend`

- `C:\Dev\PickyTalker\frontend\.env.example`
- `C:\Dev\PickyTalker\frontend\package.json`
- `C:\Dev\PickyTalker\frontend\src\lib\email\email-errors.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\email\gmail-delivery.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\email\resend-delivery.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\email\send-verification-email.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth-actions.ts`

Suggested message: `test(email): cover Gmail SMTP and document local setup`

- `C:\Dev\PickyTalker\frontend\tests\gmail.test.ts`
- `C:\Dev\PickyTalker\frontend\tests\runtime-smoke.mjs`
- `C:\Dev\PickyTalker\frontend\scripts\check-email.ts`
- `C:\Dev\PickyTalker\frontend\GMAIL_SMTP_SETUP.md`
- `C:\Dev\PickyTalker\frontend\AUTH_SETUP.md`
- `C:\Dev\PickyTalker\frontend\COMMIT_PLAN.md`

Keep these changes together in a deployment: the new Prisma schema/client and
auth code require the additive migration, which has already been applied to
the configured Supabase database. Do not include `.env.local` in any commit.

## Resend follow-up (this handoff only)

If the earlier auth/UI milestone is committed separately, use these exact paths
for the Resend follow-up. No new migration or UI rebuild was needed.

Suggested message: `feat(email): deliver verification codes through Resend`

- `C:\Dev\PickyTalker\frontend\.env.example`
- `C:\Dev\PickyTalker\frontend\package.json`
- `C:\Dev\PickyTalker\frontend\package-lock.json`
- `C:\Dev\PickyTalker\frontend\src\lib\email\send-verification-email.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\email\resend-delivery.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth-actions.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\otp.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\otp-core.ts`
- `C:\Dev\PickyTalker\frontend\src\lib\auth\verification-service.ts`

Suggested message: `test(auth): verify Resend delivery and document sender setup`

- `C:\Dev\PickyTalker\frontend\tests\auth.test.ts`
- `C:\Dev\PickyTalker\frontend\tests\resend.test.ts`
- `C:\Dev\PickyTalker\frontend\tests\runtime-smoke.mjs`
- `C:\Dev\PickyTalker\frontend\AUTH_SETUP.md`
- `C:\Dev\PickyTalker\frontend\COMMIT_PLAN.md`
