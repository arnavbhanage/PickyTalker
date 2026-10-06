# PickyTalker frontend

The Next.js application for PickyTalker. It uses Auth.js with Google OAuth and
email/password credentials, Prisma, and a Supabase-hosted PostgreSQL database.
Supabase Auth is not used.

## Local setup

Copy `.env.example` to `.env.local` and configure the Google OAuth and database
values. Use Supabase's pooled URL for `DATABASE_URL` and its direct/session URL
for `DIRECT_URL`.

Then install, prepare the database, and run the development server:

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The local site runs at [http://localhost:3000](http://localhost:3000). The Google
OAuth callback is `http://localhost:3000/api/auth/callback/google`.

## Useful checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test:chat
npm run test:auth
```

See [chat integration](CHAT_INTEGRATION.md) for FastAPI setup, request behavior,
current personalization limits, and deployment requirements.
