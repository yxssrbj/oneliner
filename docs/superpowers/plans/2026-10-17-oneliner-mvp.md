# Oneliner MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a responsive web journal where a futures trader records a note, completes the trade later, reviews its opening week, and optionally shares weekly summary metrics with friends.

**Architecture:** Keep Next.js App Router as the responsive web app and API boundary. The browser uses Supabase Auth for email one-time-code sign-in and calls Next.js Route Handlers for all application data; each handler uses a cookie-backed, request-scoped Supabase client for the signed-in user so Postgres RLS applies. OpenAI parsing is server-only, and group comparison uses a narrow database function that returns aggregate metrics only.

**Tech Stack:** Existing Next.js 16.4.2, React 19.3.0, TypeScript, and plain CSS; Supabase Auth/Postgres/CLI; `@supabase/ssr`; OpenAI Responses API Structured Outputs; Zod for runtime request validation; Vitest for unit and route tests; pgTAP for database rules; Playwright for browser flows.

**Spec:** [Oneliner MVP design](../specs/2026-10-17-oneliner-mvp-design.md)

## Global Constraints

- Keep this release as a mobile-friendly web app; defer native iOS/Android clients.
- All application reads and writes go through authenticated Next.js Route Handlers; the browser uses Supabase Auth and does not query journal tables or call business RPCs directly.
- Route Handlers derive the signed-in user from the cookie-backed session and use a request-scoped Supabase client with that identity. Never expose an OpenAI key or Supabase service-role key to the browser.
- A saved trade requires the exact original note, symbol, long/short side, entry, initial stop on the loss side, setup, and opening time. It may lack an exit.
- Model one entry, one initial stop, and one exit. Store prices as Postgres `numeric`; derive R from confirmed prices and label zero as breakeven. Do not add fees, broker imports, orders, or scaling.
- Weeks run Monday 00:00 UTC to the next Monday 00:00 UTC, based on `opened_at`. Completed trades alone contribute to total R, win rate, and comparison count; breakevens remain in the win-rate denominator.
- Notes, individual trades, prices, and setups remain private. Group joining is explicit opt-in; members see only display names and weekly total R, win rate, and completed count. Mark comparisons self-reported.
- Confirm database writes before reporting success. Preserve a failed capture draft for retry and make retries idempotent.
- Keep `public/preview.html` as the visual reference; the functional app replaces the redirect at `/`.
- Before changing Next.js files, read the relevant local guide under `node_modules/next/dist/docs/` and follow the current Next.js 16 conventions.
- Supabase currently labels `@supabase/ssr` beta in its server-side auth documentation; verify the installed API against current official docs during implementation and keep cookie/session behavior covered by tests.
- Work in an isolated Git worktree during implementation. No provider credentials or Docker availability have been confirmed; record dependent checks as unverified if they cannot run.

## Working Agreement

After each task, stop and show the diff, checks, normal and edge cases to try, and any unresolved risk. You review the result and decide whether to continue. Do not push. If you request a change, add or update a failing test first, verify it fails, then fix it and rerun the relevant checks before continuing.

## Review Focus

- A stop equal to entry or on the profit side must fail at the database even when the browser is bypassed (Task 1 pgTAP test).
- An expired or missing session must not return another user's trades, and a handler must never use a service-role client for user-owned data (Task 2 route test; Tasks 3–5 API tests).
- A vague, malformed, refused, or unavailable AI parse leaves uncertain fields empty and preserves the original note for manual entry (Task 3 parser/API test).
- A failed or repeated capture must preserve the draft and never create a duplicate trade or show false success (Task 3 capture/API test).
- A UTC Monday boundary, late exit, breakeven, or correction must affect exactly the opening week's summary (Task 4 unit test).
- A removed group member must lose aggregate access, the prior invite must stop working, and members must never read another user's trade rows (Task 5 pgTAP tests).

---

### Task 1: Test foundation and private trade storage

**Files:**
- Create: `vitest.config.ts`, `supabase/config.toml`
- Create: `supabase/migrations/202610180001_core.sql`
- Create: `supabase/tests/database/core.test.sql`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- `profiles(id uuid primary key references auth.users, display_name text not null)`; users can read and update only their own profile.
- `trades(id uuid primary key, owner_id uuid, original_note text, symbol text, side text, entry_price numeric, stop_price numeric, setup text, opened_at timestamptz, exit_price numeric null, r_result numeric generated, idempotency_key uuid, created_at, updated_at)`.
- Enforce nonblank note/symbol/setup, `side` in `long | short`, positive finite prices, long stop below entry, short stop above entry, and unique `(owner_id, idempotency_key)`. Keep `owner_id` immutable after insert.
- `r_result` is null until exit; then long R is `(exit_price-entry_price)/(entry_price-stop_price)` and short R is `(entry_price-exit_price)/(stop_price-entry_price)`.
- RLS permits a user to select and mutate only their own profile and trade rows. No group access is added in this task.

- [ ] **Step 1: Add failing pgTAP cases and the minimum test command.** Assert table/column shape, long win `100/99/102 => 2R`, short loss `100/101/102 => -2R`, breakeven `exit=entry => 0R`, null exit => null R, zero/negative/NaN/infinite prices and invalid stops rejected, owner immutable, duplicate idempotency key rejected, and a second authenticated user cannot select or update the first user's trade. Add `npm test` and `npm run typecheck` scripts and Vitest config for later tasks.
- [ ] **Step 2: Run the focused database test and confirm it fails because the migration objects are missing.** Run: `npx supabase test db`. If Docker or the Supabase CLI is unavailable, record the exact block and continue with a unit-level schema check only until the local database can run.
- [ ] **Step 3: Implement the core migration.** Add constraints, the generated R expression, `updated_at` maintenance, minimal grants, and owner-only RLS policies. Do not use a service-role key in the app.
- [ ] **Step 4: Run `npx supabase test db`, `npm test`, `npm run typecheck`, and `npm run lint`; expect the core database tests and scaffold checks to pass.** Inspect the migration's grants and policies against the tests.
- [ ] **Step 5: Show the migration and test results for user review; after approval, commit:** `git add package.json package-lock.json vitest.config.ts supabase && git commit -m "feat: store private trades and calculate R"`.

### Task 2: Email-code sign-in and responsive app shell

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts`
- Create: `app/sign-in/page.tsx`, `app/components/sign-in-form.tsx`, `app/components/sign-in-form.test.tsx`
- Create: `app/api/profile/route.ts`, `app/components/app-shell.tsx`, `app/components/app-shell.css`
- Modify: `app/layout.tsx`, `app/page.tsx`, `package.json`, `package-lock.json`, `.env.example`

**Interfaces:**
- `createSupabaseBrowserClient(): SupabaseClient` in `lib/supabase/client.ts` creates the browser client. `createSupabaseServerClient(): Promise<SupabaseClient>` creates a request-scoped server client using the current cookies. `getAuthenticatedUser(): Promise<{ supabase: SupabaseClient; user: User } | null>` calls `supabase.auth.getUser()` and returns null when the cookie session is missing or invalid. Every application Route Handler uses this helper; never share a user-bound server client across requests.
- Sign-in sends an email OTP and verifies the entered code with Supabase Auth. The email template must render the one-time token. Invalid or expired codes show a recoverable error.
- `GET /api/profile` returns only the current user's display name; `PUT /api/profile` validates and saves a nonblank display name. Both reject unauthenticated requests.
- Authenticated shell destinations are Capture (`/`), Inbox (`/inbox`), Review (`/review`), and Friends (`/friends`). Use bottom navigation on mobile and a sidebar on larger screens. Replace the preview redirect; keep `/preview.html` available.

- [ ] **Step 1: Add a failing sign-in form test.** Assert the email is required, a one-time code is requested, invalid OTP displays an error, and successful OTP verification reaches the signed-in shell. Add Testing Library/jsdom only if needed to exercise the React form.
- [ ] **Step 2: Run the focused test and confirm it fails before the sign-in form exists.** Run: `npm test -- sign-in-form`.
- [ ] **Step 3: Implement cookie-backed Supabase clients, OTP sign-in, profile routes, session refresh using the current Next.js 16 request hook, and responsive navigation.** Before coding, read the relevant local Next.js 16 guides and current Supabase SSR/OTP instructions. Use `auth.getUser()` for server-side identity verification, not an unverified session lookup. Use only the public Supabase key in browser code; the server client uses the same user session.
- [ ] **Step 4: Run the focused test, full unit suite, `npm run typecheck`, `npm run lint`, and `npm run build`; expect all to pass.** Add a route test proving unauthenticated profile access returns 401 and an authenticated request can read only the caller's profile.
- [ ] **Step 5: Show the sign-in and shell changes for user review; after approval, commit:** `git add app lib proxy.ts .env.example package.json package-lock.json && git commit -m "feat: add email code sign-in and app shell"`.

### Task 3: Natural-language capture and reliable save

**Files:**
- Create: `lib/trades/validation.ts`, `lib/trades/validation.test.ts`
- Create: `lib/trades/parse-schema.ts`, `lib/trades/parse-schema.test.ts`
- Create: `app/api/parse/route.ts`, `app/api/trades/route.ts`
- Create: `app/components/capture-form.tsx`, `app/components/capture-form.test.tsx`
- Modify: `app/page.tsx`, `package.json`, `package-lock.json`, `.env.example`

**Interfaces:**
- `TradeDraft = { originalNote: string; symbol: string; side: "long" | "short" | ""; entryPrice: string; stopPrice: string; setup: string; openedAt: string }`.
- `ParseSuggestion = { symbol: string | null; side: "long" | "short" | null; entryPrice: string | null; stopPrice: string | null; setup: string | null; clarifications: string[] }`.
- `POST /api/parse` accepts `{ note }`, requires a signed-in user, rejects notes longer than 1,000 characters, and returns `{ suggestion }` or a safe error. Use OpenAI Responses API Structured Outputs with nullable fields; refuse to infer missing values. Parsing never writes a trade.
- `POST /api/trades` validates the complete confirmed draft and an `Idempotency-Key`, inserts with the current user as owner, and returns the saved trade only after the database confirms it. `GET /api/trades` supports the user's inbox and week filters. All access uses the cookie-backed, user-scoped Supabase server client.
- The form preserves the original note exactly, labels AI values as suggestions, lets the user edit every field, stores an unsaved draft in `sessionStorage`, disables duplicate in-flight submission, and clears the draft only after confirmed save or sign-out.

- [ ] **Step 1: Write failing validation and parser tests.** Assert missing required fields and wrong-side/equal stops fail; nullable/unknown AI fields stay empty with clarification; original note is never normalized or overwritten; overlong notes are rejected.
- [ ] **Step 2: Run `npm test -- trades/validation trades/parse-schema` and confirm failures before implementation.**
- [ ] **Step 3: Implement validation, parse normalization, and authenticated API route tests.** Mock OpenAI for refusals, timeout, malformed output, and a valid extraction; assert no trade is written by `/api/parse`, unauthenticated calls fail, and error responses reveal no secrets.
- [ ] **Step 4: Write and run the failing capture form/API test.** Simulate an ambiguous parse and an insert failure; assert uncertain fields remain empty, the corrected draft and note remain available, no success state appears, and retry uses the same idempotency key. Assert repeated submission creates one trade.
- [ ] **Step 5: Implement the capture UI and save flow.** Add only required OpenAI/Zod packages; keep the OpenAI key server-only. Show manual entry when parsing is unavailable.
- [ ] **Step 6: Run focused tests, the full unit suite, `npm run typecheck`, `npm run lint`, and `npm run build`; expect all to pass.**
- [ ] **Step 7: Show the capture flow and edge-case results for user review; after approval, commit:** `git add app lib package.json package-lock.json .env.example && git commit -m "feat: capture trades from editable note suggestions"`.

### Task 4: Outcome inbox and weekly review

**Files:**
- Create: `lib/trades/week.ts`, `lib/trades/week.test.ts`
- Create: `lib/trades/summary.ts`, `lib/trades/summary.test.ts`
- Create: `app/api/trades/[tradeId]/route.ts`
- Create: `app/inbox/page.tsx`, `app/review/page.tsx`
- Create: `app/components/exit-form.tsx`, `app/components/trade-edit-form.tsx`
- Modify: `app/components/app-shell.tsx`, `app/components/app-shell.css` as needed

**Interfaces:**
- `weekStartUtc(date: Date): string`, `nextWeekStartUtc(weekStart: string): string`.
- `summarizeTrades(trades: { r_result: number | null }[]): { totalR: number; wins: number; completedCount: number; unfinishedCount: number; winRate: number | null }`.
- `PATCH /api/trades/[tradeId]` accepts either `{ exitPrice }` or confirmed trade-field corrections; it validates the caller owns the row, validates corrected stops, and returns the database-computed R. It never accepts an R value from the browser.
- `GET /api/trades?status=open` lists the signed-in user's unfinished trades. `GET /api/trades?weekStart=YYYY-MM-DD` returns trades opened in `[weekStart,nextWeekStart)` plus personal metrics. Missing outcomes are excluded from total R/win rate; breakevens count in the win-rate denominator.

- [ ] **Step 1: Write failing week and summary tests.** Assert Sunday 23:59:59 UTC and Monday 00:00 UTC are in different weeks; late exit stays in the opening week; `[2, -1, 0, null]` gives `1R`, one win, three completed, one unfinished, and `1/3` win rate; an empty week gives null win rate.
- [ ] **Step 2: Run `npm test -- trades/week trades/summary` and confirm red.**
- [ ] **Step 3: Implement the helpers and failing PATCH/GET route tests.** Assert missing auth gives 401, another user's trade cannot be read or edited, invalid exit prices are rejected, and successful corrections return recalculated R.
- [ ] **Step 4: Implement Inbox, Review, exit entry, and trade correction UI.** Use the phone reference hierarchy: weekly total and completed count, daily status chart, missing-outcome cards, and trades opened this week. The exit form asks for an exit price; it shows calculated R and result label after save. Keep original notes visible and use text as well as color for outcomes.
- [ ] **Step 5: Run focused tests, the full suite, `npm run typecheck`, `npm run lint`, and `npm run build`; expect all to pass.**
- [ ] **Step 6: Show the inbox/review flow and week-boundary cases for user review; after approval, commit:** `git add app lib && git commit -m "feat: complete trades and review opening weeks"`.

### Task 5: Private friend groups and aggregate comparison

**Status (20 October 2026):** Implemented and reviewed locally on `feat/task-5-private-groups`. Checks: 135 unit tests, 97 SQL assertions, four browser flows, typecheck, lint and production build passed. Review found two client recovery/account-state issues; regression tests reproduce both and the fixes passed scoped re-review. Hosted migration and deployment remain outstanding. User review is the next step.

**Files:**
- Create: `supabase/migrations/202610200001_groups.sql`
- Create: `supabase/tests/database/groups.test.sql`
- Create: `app/api/groups/route.ts`, `app/api/groups/[groupId]/route.ts`, `app/api/groups/[groupId]/metrics/route.ts`
- Create: `app/friends/page.tsx`, `app/friends/invite/[token]/page.tsx`
- Create: `app/components/group-form.tsx`, `app/components/group-metrics.tsx`

**Interfaces:**
- Tables: `groups(id, owner_id, name, created_at)`, `group_invites(group_id, token)`, `group_members(group_id, user_id, joined_at)`. Group tables have RLS; only owner/current members see allowed group metadata.
- Authenticated RPCs: `create_group(name)`, `join_group(token)`, `leave_group(group_id)`, `remove_group_member(group_id, member_id)`, `rotate_group_invite(group_id)`, `close_group(group_id)`, `group_weekly_metrics(group_id, week_start)`. Each enforces current membership/ownership. Only the owner can retrieve the invite token.
- `group_weekly_metrics` returns current members' display names, total R, win rate, and completed count for a UTC week; include members with no completed trades as `0`, null, `0`. It returns no note, trade ID, price, setup, or individual trade row. A former member cannot call it.
- All group API routes use the signed-in user's Supabase session. Callable group RPCs may use `SECURITY DEFINER` in the exposed `public` schema with a fixed `search_path`, execution granted only to authenticated users, and identity/membership/ownership checks inside every function. Internal helpers may use a private schema. This resolves the earlier contradiction between callable RPCs and non-exposed functions (approved 20 October 2026).

- [x] **Step 1: Write failing pgTAP privacy tests.** Assert nonmembers cannot read group metrics; current members receive only aggregate columns; member A cannot select member B's trade; removal revokes access and rotates the invite; the old token cannot rejoin; leaving/closing revokes access.
- [x] **Step 2: Run `npx supabase test db` and confirm failure because the group schema/functions are missing.**
- [x] **Step 3: Implement groups, invitation lifecycle, RLS, and narrowly granted aggregate RPCs.** Review function ownership, exposed schemas, grants, search paths, and RLS bypass behavior.
- [x] **Step 4: Add failing tests for every group Route Handler before implementing them.** Cover unauthenticated requests, owner/member permissions, invalid/rotated invites, and exact aggregate response fields.
- [x] **Step 5: Implement the Friends and invite screens.** Show the opt-in disclosure before joining; compare only weekly total R, win rate, completed count, display name, and the self-reported label. Support create, join, leave, remove, invite rotation, and close.
- [x] **Step 6: Run SQL tests, route tests, full unit suite, `npm run typecheck`, `npm run lint`, and `npm run build`; expect all to pass.**
- [ ] **Step 7: User review of the local group flow.** Atomic local commits are recorded from `3b910a3` through `584016b`; the standing Git instructions authorize local commits during implementation. No push or hosted migration was performed. Open `/friends`, create a group and try its invite in another account.

### Task 6: Browser end-to-end verification and release handoff

**Files:**
- Create: `playwright.config.ts`, `e2e/oneliner.spec.ts`
- Modify: `package.json`, `package-lock.json`, `README.md`, `.env.example`

**Interfaces:**
- Playwright runs the app against local Supabase and uses two separate authenticated test users. Use the local Supabase email sink to obtain one-time codes; mock the OpenAI HTTP response in browser-flow tests so tests do not require a paid AI request.
- README documents local Supabase setup, required environment variables, email OTP template configuration, migrations/tests, local app startup, and the deployment handoff. `.env.example` contains names only, never credentials.

- [ ] **Step 1: Write a failing Playwright test for the approved done criteria.** Cover sign-in, ambiguous parser response/manual correction, save and refresh persistence, failed-save retry, outcome calculation, UTC opening-week metrics, group opt-in, aggregate comparison, and a second account's denied direct access to individual trade data. Include removal and old-invite denial.
- [ ] **Step 2: Run the test and confirm it fails against the incomplete app.**
- [ ] **Step 3: Add the minimal Playwright/local-Supabase setup and any focused fixes required by failures.** Do not mock database authorization; keep OpenAI mocked only for deterministic UI flow.
- [ ] **Step 4: Run Playwright, `npx supabase test db`, unit tests, `npm run typecheck`, `npm run lint`, and `npm run build`; expect all to pass.** Report provider-dependent checks that could not run.
- [ ] **Step 5: Complete the README and environment example, then show the verified flow and remaining deployment requirements for user review.** Deployment host and credentials remain a separate user decision; do not claim the MVP is friend-test-ready until the deployed two-account phone flow has been exercised.

## Release Check

After the code review gates pass, choose a deployment host and configure real Supabase/OpenAI projects. Apply migrations, configure the Supabase email template to send a one-time code, and use two fresh accounts to complete the Task 6 flow on phone viewports. Verify parse failure, save failure/retry, empty review, late completion, and removed-member denial. Record exact commands/results and any provider-dependent checks that remain blocked. Keep the static preview at `/preview.html`; the app's home route is the functional capture screen.

## Technical References

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Supabase server-side auth](https://supabase.com/docs/guides/auth/server-side)
- [Supabase email one-time passwords](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database testing with pgTAP](https://supabase.com/docs/guides/database/testing)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
