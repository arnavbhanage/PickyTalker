# Chat integration — through Phase 8

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

`best.candidate` is the primary reply. The full response must arrive before the
Aceternity-inspired reveal mounts; this is not streaming. Whitespace, Unicode,
tabs, line breaks and the final newline are preserved. The reveal delay is
bounded even for long replies, with immediate full screen-reader text and a
static reduced-motion fallback. There is no truncation or HTML execution.

The keyboard-accessible shadcn copy button writes precisely `best.candidate` to
the clipboard, with two-second success feedback. Clipboard rejection shows a
manual-copy suggestion, not false success. Timers are cleaned up on unmount.

## Phase 6 — explanations and alternatives

The selected-reply card has one collapsed-by-default shadcn/Radix panel,
`Why this response`. Expanding it renders `best.reasons` exactly as supplied by
FastAPI and the other `candidates` in their validated backend rank order. The
selected rank is excluded, and alternatives preserve complete whitespace and
Unicode. No scoring, reranking, explanation generation or additional request is
performed in the browser. Empty reasons and a single candidate have honest
fallbacks, not invented explanations. Raw scores, contribution vectors and
percentages are not displayed. The panel reiterates that there is no personal
style profile yet. Ratings were added separately in Phase 7 below.

The disclosure is keyboard-accessible with `aria-expanded`, linked panel labels
and independent state/IDs for each reply. Opening it does not restart the main
reply reveal or change exactly what the copy button writes.

## Requested visual/input fixes

The empty-state dots now use a darker blue-gray, a larger radius, higher base
opacity and a broader fade mask. They remain decorative, static under reduced
motion, visibility-aware, and disappear after the first submission.

The composer now has a Skiper106-style gliding caret, not just its rounded
appearance. Native multiline text is never delayed or replaced. A DOM mirror
tracks wrapped lines, selection offsets, Unicode, tabs, scroll and font/resize
changes; a 140ms eased CSS transition moves the caret. A fixed offscreen mirror
does not enlarge document scroll bounds. Native caret fallback protects text
selection, IME, mobile/coarse pointers, bidi text, disabled/read-only input,
reduced motion and forced colors. There is no DialKit/debug UI or new package.

## Deployment limits

The existing FastAPI CORS policy allows local HTTP origins only. Vercel requires
an HTTPS backend and an explicitly allowed deployed origin or an authenticated
server-side proxy. If `PICKYTALKER_API_KEY` is enabled, handle it server-side;
never put it or `NVIDIA_API_KEY` in a `NEXT_PUBLIC_` value. This phase does not
change backend authorization, CORS, model artifacts or database schema.

## Phase 7 — response rating

Every successful selected reply now has `Was this response useful?` and a 1–5
React Bits Peek Rating adaptation. Hover/focus previews lift and label the
stars; selection uses existing shadcn buttons with Radix radio semantics.
Tab enters the group, Left/Right select, Space/Enter choose, and Clear removes
the current rating. Buttons have 44px touch targets; controls can wrap in a
narrow card, and reduced-motion/forced-colors fallbacks are provided in CSS.
The group is linked to its label and persistence note; a named polite status
announces selection. Ratings are independent per response and do not change
the reveal, exact copy text, ranking or explanations.

Ratings live in React memory only. They are not sent to FastAPI, saved to the
database or written to browser storage. Refresh/navigation/unmount loses them.
The visible note says `Only kept in this session—not saved or sent.` No
feedback endpoint or database persistence was added, and no training or ranking
benefit is claimed. There is no rating UI for pending or failed turns.

## Phase 8 — account polish

The existing Auth.js server guard still redirects a missing user to `/signin`.
The layout reads the session once and passes only name, email and image to the
app shell; it does not pass session tokens, expiry, database IDs or credentials.
The header now has a discreet shadcn/Radix account popover instead of a separate
name/sign-out strip. It shows the signed-in identity and a session-only data
notice. Existing `signOutCurrentUser` is reused without changing the auth flow;
the action button disables while sign-out is pending. Escape or the close
button dismisses the popover and restores trigger focus. Long identity text
wraps inside a collision-aware, viewport-constrained panel; mobile uses a
44px avatar-only trigger. Opening the account control does not remount chat.

No existing style-profile viewer was found, so none was invented. No sidebar,
new settings page, auth rebuild, OTP change or database change was added.
The landing-page auth controls are untouched.

## Phases 7 and 8 — verification scope

Phase 7: production build PASS; `tsc --noEmit` PASS; ESLint PASS; chat/API tests
**63/63 PASS**. Tests cover keyboard rating, preview versus committed state,
change/clear, independent ratings, remount reset, no persistence request,
successful-only rendering and unchanged exact reply copy/explanations.

Phase 8 adds isolated tests of the real server layout with narrow auth/redirect
stubs, plus account open/close/focus, missing and long identity, the supplied
sign-out action, pending duplicate prevention, and preserved drafts/ratings.
These are unit/component checks, not a claimed live login test.

Combined Phase 7/8 checks: production build PASS; `tsc --noEmit` PASS;
ESLint PASS; chat/API/layout/component tests **69/69 PASS**; existing
auth/OTP/email tests **41/41 PASS**; `git diff --check` PASS. No Git staging,
commit or push was performed.

**Phase 9 is intentionally deferred at the user's request.** Do the final
signed-in/signed-out browser flow, actual mobile layout and reduced-motion QA,
live provider/error path, console/overflow/security review and backend pytest
together with the user. No temporary servers, real email, live provider call or
database write was started for Phases 7 and 8.

## Verification history — Phases 4 and 5

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

Phase 4/5 checks: production build PASS; `tsc --noEmit` PASS; ESLint PASS;
chat/API tests **50/50 PASS**; existing auth/email tests **41/41 PASS**;
`git diff --check` PASS. Computer-use browser QA also caught and fixed an
immediate-failed-retry focus edge case. Temporary verification servers were
stopped after testing. Authentication, backend/ML and database files are unchanged.

## Phase 6 validation

Automated tests cover exact backend reasons, ranked alternatives (including
style scores that disagree with rank order), keyboard Enter/Space expansion,
unique independent panels, missing explanations/single-candidate fallbacks,
and unchanged exact-copy/reveal behavior when details are opened. Caret tests
cover desktop eligibility, selection, composition, blur, reduced-motion and
pointer changes, bidi fallback, disable/cleanup and visible static dot contrast.

Phase 6 checks: production build PASS; `tsc --noEmit` PASS; ESLint PASS;
chat/API tests **58/58 PASS**; existing auth/email tests **41/41 PASS**;
`git diff --check` PASS. The live FastAPI/provider returned a selected reply,
three exact reasons and four alternatives in ranks 2–5. Keyboard expansion,
collapse and exact selected-reply copy worked, with no browser console errors.
The provider took longer than sixty seconds; the existing honest long-wait
message appeared and the draft remained intact.

Computer-use browser QA checked the actual gliding desktop caret and responsive
layouts at 1440×900, 390×844 and 320×568. It caught and fixed a hidden caret
mirror causing horizontal overflow; the final layouts have no horizontal
overflow and all expanded alternatives remain reachable by conversation scroll.
The preview used the real chat components and backend with a synthetic account
header, not a bypass or end-to-end retest of the protected login flow.
Temporary verification servers were stopped after testing; the pre-existing
Next.js dev server was left running. Authentication, backend/ML and database
files are unchanged. No Git staging, commit or push was performed.

## Changed files — Phases 4 and 5

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

## Changed files — Phase 6 and requested fixes

- Chat: `src/components/chat/chat-workspace.tsx`, `chat-workspace.module.css`,
  `message-composer.tsx`, `response-card.tsx`, `response-details.tsx`,
  `response-details.module.css`.
- UI: `src/components/ui/collapsible.tsx`, `smooth-textarea.tsx`,
  `smooth-textarea.module.css`, `dotted-glow-background.tsx`.
- Tests/docs: `tests/chat-shell.test.tsx`, `THIRD_PARTY_NOTICES.md`,
  `CHAT_INTEGRATION.md`.

## Changed files — Phases 7 and 8

- Phase 7: `src/components/ui/peek-rating.tsx`, `peek-rating.module.css`;
  `src/components/chat/response-rating.tsx`, `response-rating.module.css`,
  `response-card.tsx`; `tests/chat-shell.test.tsx`; `THIRD_PARTY_NOTICES.md`.
- Phase 8: `src/components/ui/popover.tsx`;
  `src/components/app/account-control.tsx`, `account-control.module.css`,
  `app-shell.tsx`, `app-shell.module.css`; `src/app/app/layout.tsx`;
  `tests/app-layout.test.ts`, `tests/chat-shell.test.tsx`; `package.json`.
- Shared report: `CHAT_INTEGRATION.md`.

Suggested manual commits:
- Phase 7: `feat(chat): add session-only Peek Rating feedback`
- Phase 8: `feat(app): polish account control with existing auth session`
