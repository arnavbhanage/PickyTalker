# Chat integration — Phases 4 and 5

The protected `/app` shell keeps the existing Auth.js/session boundary. The chat
calls the existing `pickyTalkerApi.respond` client, not NVIDIA directly. Configure
`NEXT_PUBLIC_PICKYTALKER_API_URL` in `.env.local` (default: `http://127.0.0.1:8000`)
and restart Next.js after changing it. Public environment values are embedded
at build time. The current local env points to port **8765**, so start the
existing FastAPI service on that port from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8765
```

## Request and state

Each submission posts `{ history: [], incoming }` to `/respond`. The backend's
default candidate count is used. There is no writing-sample source connected:
the UI explicitly states replies are not personalized yet. Incoming messages
and generated replies must never be recycled as the user's writing samples.
Do not claim a personal style profile or ranker superiority from this flow.

Turns are held in React memory only, not the database or localStorage. Refresh
clears the conversation. Messages are sent through FastAPI to the AI provider;
the composer discloses this. Only synthetic messages were used for verification.

The synchronous request lock prevents duplicate submissions. A five-minute
timeout accommodates slow provider attempts. After sixty seconds, the waiting
message changes honestly, without percentages or guessed generation stages.
No automatic frontend retries are made. Manual retry of the last failed message
reuses its turn; edited drafts survive retry of the original message. Navigating
away aborts the browser request and ignores late results. A browser abort does
not guarantee that an already-running backend/provider call stops.

Network/offline, timeout, provider failure, authorization, validation and
malformed responses have safe user-facing messages. Successful JSON is checked
against the real `best`, ranked `candidates` and `meta` contract before display.
Missing fields are not repaired, ranking is not repeated in the browser, and
upstream diagnostics are not shown to the user.

## Selected reply

Only `best.candidate` is rendered. The full response must arrive before the
Aceternity-inspired reveal mounts; this is not streaming. Whitespace, Unicode,
tabs, line breaks and the final newline are preserved. The reveal delay is
bounded even for long replies, with immediate full screen-reader text and a
static reduced-motion fallback. There is no truncation or HTML execution.

The keyboard-accessible shadcn copy button writes precisely `best.candidate` to
the clipboard, with two-second success feedback. Clipboard rejection shows a
manual-copy suggestion, not false success. Timers are cleaned up on unmount.

Alternatives, explanations, scores and ratings are deliberately not rendered.
The backend response retains those fields for later phases.

## Deployment limits

The existing FastAPI CORS policy allows local HTTP origins only. Vercel requires
an HTTPS backend and an explicitly allowed deployed origin or an authenticated
server-side proxy. If `PICKYTALKER_API_KEY` is enabled, handle it server-side;
never put it or `NVIDIA_API_KEY` in a `NEXT_PUBLIC_` value. This phase does not
change backend authorization, CORS, model artifacts or database schema.

## Verification

```powershell
npm run test:chat
npm run test:auth
npm run lint
npm run build
npx tsc --noEmit
```

Chat tests use explicitly synthetic test-only fixtures. A live browser request
to the real FastAPI/provider succeeded; the real selected reply was displayed
and copied exactly by keyboard. A separate measured request through the same
API client returned five candidates in **23,178 ms** (provider metadata:
23,103.7 ms, one LLM call). Latency varies, so this is not a guarantee.
A follow-up browser request also succeeded against the existing frontend env's
port 8765, without modifying `.env.local`.

Live backend-offline and manual retry checks retained the complete draft,
kept one incoming turn, and displayed no invented reply.

Browser layout verification used the real chat components in an ignored local
preview with a synthetic account header, not a bypass of `/app` authentication.
Desktop 1440×900 and mobile 390×844 / 320×568 had no horizontal overflow; the
successful browser flow had no console errors. Automated reduced-motion tests
verify static rendering, preference changes, and subscription cleanup, with CSS
fallbacks too, without changing the user's operating-system preferences.

Final checks: production build PASS; `tsc --noEmit` PASS; ESLint PASS;
chat/API tests **50/50 PASS**; existing auth/email tests **41/41 PASS**;
`git diff --check` PASS. Computer-use browser QA also caught and fixed an
immediate-failed-retry focus edge case. Temporary verification servers were
stopped after testing. Authentication, backend/ML and database files are unchanged.

## Changed files

- Chat: `src/components/chat/chat-workspace.tsx`, `chat-workspace.module.css`,
  `message-composer.tsx`, `generation-status.tsx`, `response-card.tsx`, `use-chat.ts`.
- UI: `src/components/ui/lattice-loader.tsx`, `lattice-loader.module.css`,
  `text-generate-effect.tsx`, `text-generate-effect.module.css`,
  `use-prefers-reduced-motion.ts`.
- API: `src/lib/api.ts`, `config.ts`, `response-validation.ts`;
  `src/components/app/status-panels.tsx` adds the new error-kind mappings.
- Tests: `tests/chat-shell.test.tsx`, `chat-api.test.ts`, `fixtures/respond.ts`.
- Docs/scripts: `package.json`, `README.md`, `THIRD_PARTY_NOTICES.md`,
  `CHAT_INTEGRATION.md`.
