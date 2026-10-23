# Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved desktop settings page with real profile edits, account-specific dark/light mode, sign-out, and a verified path to set or change a password on an existing account.

**Architecture:** Extend the existing `feat/ui-redesign` shell and owner-only profile API. Keep the email on the authenticated settings route, store the non-security theme choice in Supabase user metadata, and use Supabase Auth's signed-in reauthentication and password update APIs. Retain email-code sign-in while adding password sign-in for accounts that set a password.

**Tech Stack:** Next.js 16.4.2, React 19.3, TypeScript, plain CSS, Supabase Auth/Postgres, Vitest, Playwright. Local startup uses the existing SOPS wrapper.

**Spec:** [`specs/features/settings.md`](../../../specs/features/settings.md) and its [desktop visual contract](../../../specs/features/desktop-preview-parity.md) in the primary Oneliner checkout. Both are drafts for owner review; this plan does not authorize product code until the owner approves them.

## Global Constraints

- Work in the isolated `.worktrees/ui-redesign` checkout on `feat/ui-redesign`. Read canonical `specs/` from the primary checkout; do not copy branch-local snapshots over it.
- Preserve existing trade records, group membership, `/api/profile` ownership checks, `/review`, `/`, `/inbox`, `/friends`, and email-code sign-in. No service-role key or credentials in client code, browser storage, logs, or profile rows.
- Match `docs/previews/oneliner-settings.html`: two cards only, a standalone theme button beside the heading, and a standalone sign-out button below the cards. Email stays read-only and appears only on settings.
- Theme values are exactly `dark` and `light`, default `dark`, stored under `user_metadata.oneliner_theme`. Treat metadata as user-controlled preference only; never use it for RLS or authorization. Keep other user metadata intact.
- Password changes require a code from `auth.reauthenticate()` and `auth.updateUser({ password, nonce })`. Password users also submit `current_password`; email-code users use the email path without one. Do not report success until Supabase confirms. New password and confirmation must match and meet the provider's configured policy.
- Supabase references: [reauthenticate](https://supabase.com/docs/reference/javascript/auth-reauthenticate), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [password security](https://supabase.com/docs/guides/auth/password-security), and [password sign-in](https://supabase.com/docs/guides/auth/passwords). Confirm actual project settings during implementation.
- Read the relevant local Next.js 16 guides in `node_modules/next/dist/docs/` before code edits. Follow test-first red → green → refactor, then run focused tests, the suite, typecheck, lint, and relevant local Playwright journeys. Use `CI=1`, stop test servers, and report hosted verification separately.
- Make atomic local commits with imperative module subjects of at most 62 characters. Do not push, merge, deploy, or mutate hosted Auth settings without a new instruction.

## Review Focus

1. An account with no `profiles` row can switch theme without a fabricated display name — Task 3 unit/browser test.
2. A theme save that fails or completes after switching accounts cannot apply the old account's theme — Task 3 client test.
3. An existing email-code account sets a password on the same user ID and retains trades and group membership — Task 4 browser test.
4. Wrong current password, wrong/expired email code, weak password, mismatched confirmation, and network failure leave the old sign-in usable and never show success — Task 4 unit/browser tests.
5. A failed sign-out is retryable, and a successful sign-out clears visible identity and theme before another account signs in — Task 2/3 browser tests.

## File Structure

| File | Responsibility |
| --- | --- |
| `app/settings/page.tsx` | Auth guard; read the current owner's name and email; render the shared shell. |
| `app/settings/settings-client.tsx` | Display-name form and theme action with pending/error/saved states. |
| `app/settings/password-form.tsx` | Password and email-code steps; no credential persistence. |
| `app/components/account-controls.tsx` | Bottom sidebar profile row linking to settings and hiding stale identity. |
| `app/components/sign-out-button.tsx` | Move the existing local sign-out behavior to the settings action. |
| `app/components/app-shell.tsx` | Keep four routes; give `/settings` a current profile state and page title. |
| `lib/theme.ts` | Validate `dark`/`light` from user metadata, defaulting to dark. |
| `app/layout.tsx`, `app/components/app-shell.css` | Server-rendered theme and the approved settings/light styles across existing pages. |
| `app/components/sign-in-form.tsx` | Add password sign-in while retaining email-code and invite redirects. |
| Existing focused tests, `e2e/auth.spec.ts`, `e2e/settings.spec.ts` | Regression and real-browser proof at 1280×800 and 1440×900. |

## Task 1: Real settings route and display name

**Files:** Create `app/settings/page.tsx`, `app/settings/settings-client.tsx`, their focused tests; modify `app/components/app-shell.tsx`, `app/components/account-controls.tsx`, `app/components/app-shell.css`, and existing shell tests.

**Interfaces:** `SettingsPage()` uses `getAuthenticatedUser()` and the existing `profiles.display_name` lookup; it passes `{userId, email, initialDisplayName}` to `SettingsClient`. `SettingsClient` saves through `PUT /api/profile` with `{displayName}` and calls `router.refresh()` only on confirmed success. `AppShell({title:'Settings'})` keeps the four current nav links and marks the profile row current.

- [ ] Write failing tests: unauthenticated `/settings` redirects; a signed-in page shows its own read-only email and profile name; profile row `href` is `/settings`; a blank/overlong name is blocked; a failed `PUT` preserves the edit and shows an error; successful `PUT` updates the visible name and refreshes. Test that another account's email/name never appears after auth change.
- [ ] Run `npx vitest run app/settings app/components/app-shell.test.tsx app/components/account-controls.test.tsx`; record the expected failures caused by the absent route/profile link.
- [ ] Implement the route, Profile card, form, and sidebar link. Reuse `/api/profile` and existing `Trader` fallback; do not alter its response contract or group membership rules. Preserve the sidebar's account-change hiding and sign-out behavior until Task 2 moves sign-out. Task 4 adds the Password card.
- [ ] Run the focused tests to green, then `npm test`, `npm run typecheck`, and `npm run lint`. Inspect the full diff and commit with `Settings: Add profile page`.

## Task 2: Put sign-out on settings

**Files:** Create `app/components/sign-out-button.tsx` and its tests; modify `app/components/account-controls.tsx`, `app/settings/page.tsx`, `app/components/app-shell.css`, their tests, and `e2e/auth.spec.ts`.

**Interfaces:** `SignOutButton({userId}: {userId:string})` moves the current `auth.signOut({scope:'local'})`, pending/error/retry, and replacement-account guards from `AccountControls`. `AccountControls` remains a profile link with stale-identity protection. The sign-out button is outside either settings card.

- [ ] Write failing tests: settings has exactly one standalone Sign out button; a pending double-click sends one request; failure keeps the button retryable and stays on the page; success redirects to `/sign-in` and refreshes; an old response after account change cannot redirect the new account.
- [ ] Run `npx vitest run app/components/account-controls.test.tsx app/components/sign-out-button.test.tsx app/settings`; confirm red for the missing settings action.
- [ ] Move the tested sign-out behavior without weakening its failure handling. Update existing browser journeys to navigate to `/settings` before sign-out; keep their private-route 401 and two-account checks.
- [ ] Run focused tests, `npm test`, `npm run typecheck`, `npm run lint`, and the local auth Playwright journey to green. Commit with `Account: Move sign-out to settings`.

## Task 3: Account-specific dark and light mode

**Files:** Create `lib/theme.ts` and its test; modify `app/layout.tsx`, `app/settings/settings-client.tsx`, `app/components/account-controls.tsx`, `app/components/sign-out-button.tsx`, `app/components/app-shell.css`, focused tests, and create `e2e/settings.spec.ts`.

**Interfaces:** `themeFromUserMetadata(value: unknown): 'dark' | 'light'` returns dark for missing/invalid values. The root layout gets the verified current user and renders `<html data-theme="...">`. The single settings button calls `auth.updateUser({data:{...existingMetadata,oneliner_theme:next}})`, applies the next theme only after success, and refreshes. Sign-out/account-change returns the DOM to dark until the next account's server theme is known.

- [ ] Write failing tests for missing/malformed metadata, preserving unrelated metadata, success/failure/retry, an in-flight update after account switch, and retaining unsaved settings input. Browser assertions cover two accounts, refresh, later sign-in, focus contrast, and no horizontal overflow at both specified viewports, including a user with no profile row.
- [ ] Run `npx vitest run lib/theme.test.ts app/settings` and the focused Playwright settings file; confirm red for the absent theme behavior.
- [ ] Implement the metadata reader, server theme, client button, and light CSS variables/surfaces using the accepted preview palette. Keep all protected pages readable and avoid any theme value in authorization logic.
- [ ] Run focused tests, `npm test`, `npm run typecheck`, `npm run lint`, and local `CI=1 npm run test:e2e -- --workers=1` to green. Compare screenshots to the preview; commit with `Theme: Add account appearance choice`.

## Task 4: Verified password update and password sign-in

**Files:** Create `app/settings/password-form.tsx` and its test; modify `app/settings/page.tsx`, `app/components/sign-in-form.tsx`, `app/components/sign-in-form.test.tsx`, `app/components/app-shell.css`, `e2e/auth.spec.ts`, and `e2e/settings.spec.ts`.

**Interfaces:** `PasswordForm({userId,email}:{userId:string;email:string})` supports current-password and `Use email code instead` modes. On submit, validate new/confirm, call `auth.reauthenticate()`, collect the nonce, then call `auth.updateUser({password,nonce,current_password?})`; clear all credential/code inputs on success and account change. `SignInForm({invite?})` adds `auth.signInWithPassword({email,password})` and keeps the existing OTP flow and invite redirect.

- [ ] Confirm the local Supabase Auth password-change behavior and hosted configuration read-only, including whether a nonce is accepted with/without `current_password`. If either environment cannot support the email-code account path, record the exact mismatch and fix the flow or configuration plan before enabling it; do not silently ship a weaker path. The official API reference and installed `@supabase/auth-js` types support `reauthenticate`, `nonce`, and `current_password`.
- [ ] Write failing tests for password mismatch, weak/provider-rejected password, current-password failure, wrong/expired nonce, email-send failure, request failure, pending duplicate submit, account change, and success only after confirmed update. Test password sign-in's generic error and preserved invite redirect.
- [ ] Run `npx vitest run app/settings app/components/sign-in-form.test.tsx`; confirm red for absent password update/sign-in behavior.
- [ ] Implement the smallest two-path form and password sign-in option. Keep OTP sign-in available. Never echo credentials or codes in errors, URLs, logs, metadata, or profile writes.
- [ ] Run focused tests to green. Use local Supabase and Mailpit for an end-to-end OTP-account → set password → sign out → password sign-in journey; assert the same user ID, trade, and group access, plus bad-code/current-password failures. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `CI=1 npm run test:e2e -- --workers=1`. Record hosted verification separately and commit with `Auth: Add verified password access`.

## Handoff

Review every changed line of the Auth and privacy paths, including failures and stale account responses. Compare the completed settings page to the approved preview at both desktop sizes and show the real local browser journey to the project owner. Report any unverified hosted Auth setting or email-delivery behavior plainly. Leave registration, username selection, and signed-out recovery to the separate account-registration spec; no push or merge is implied by this plan.
