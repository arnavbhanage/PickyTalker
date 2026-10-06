# Gmail SMTP setup for local PickyTalker development

Gmail can send your verification/reset emails to other recipients. A purchased
domain, Resend domain verification and a hosted website are not needed for this
setup. Messages come from the Gmail account you authenticate, not from
`noreply@pickytalker.com`.

## 1. Turn on 2-Step Verification

Sign into the new Gmail account. Open https://myaccount.google.com/security,
find **How you sign in to Google → 2-Step Verification**, and complete Google's
setup. Creating an App Password requires 2-Step Verification.

## 2. Create an App Password

Open https://myaccount.google.com/apppasswords while signed into that same
account. Name the app **PickyTalker local SMTP** and generate the password.
Google displays a 16-character password, sometimes in groups with spaces.

Do not use your regular Google password. Never paste the App Password into chat,
screenshots, source code or Git. Store it directly in the ignored `.env.local`.
The helper accepts Google's grouped spaces and strips them before authenticating.
Changing your normal Google password can revoke existing App Passwords.

If the App Password option is missing, confirm that you are signed into the
correct account and have 2-Step Verification enabled. Google notes that
security-key-only 2-Step Verification, organization policies or Advanced
Protection may make this option unavailable. Do not disable security protections
or enable deprecated "less secure app" access.

Official help: https://support.google.com/accounts/answer/185833

## 3. Select Gmail in the frontend environment

Edit `C:\Dev\PickyTalker\frontend\.env.local`:

```env
EMAIL_PROVIDER=gmail
GMAIL_SMTP_USER="your-new-account@gmail.com"
GMAIL_SMTP_APP_PASSWORD="paste-the-generated-app-password-here"
```

The values above are placeholders, not working credentials. Replace them.
Use one entry for each key; replace an existing `EMAIL_PROVIDER=resend` entry
instead of adding duplicates.

Keep your existing database, Auth.js secret and Google OAuth environment values.
Resend settings can stay in the file; Gmail mode ignores them and does not fall
back to Resend on SMTP failure. Switch back with `EMAIL_PROVIDER=resend` later.

The application fixes SMTP to `smtp.gmail.com:465` using implicit TLS,
certificate validation, server-only authentication and disabled debug logging.
No host, port or fake sender needs to be configured.

## 4. Check authentication, then restart the app

Stop the running Next server with **Ctrl+C**, then run:

```powershell
cd C:\Dev\PickyTalker\frontend
npm run email:check
npm run dev
```

The diagnostic authenticates with Google but does not send an email. On success:
`Gmail SMTP connection and authentication succeeded. No email was sent.`

If it fails, check the account, App Password and internet access. Never share
the password when asking for help. There is no need to change `AUTH_GOOGLE_SECRET`
or `AUTH_SECRET`; they serve different purposes.

## 5. Test the verification flow

Open http://localhost:3000/signup and use a recipient mailbox you control
(it may be different from the Gmail sender). Check its inbox and spam folder.
Enter the six-digit code in PickyTalker. It expires after ten minutes.

If that recipient account already exists, sign in with its password to resume
email verification. If it was created through Google, continue with Google.
Do not repeatedly create duplicate accounts to test delivery.

Automated tests mock SMTP and never send email. Live delivery still needs this
manual check after you configure credentials.

Gmail is intended here for a small prototype, not high-volume production
transactional email. Google applies sending/abuse limits and SMTP acceptance
does not guarantee inbox placement. Limits:
https://support.google.com/mail/answer/22839
