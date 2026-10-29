# Account Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New traders register with a unique username, verify email by code, sign in with a password, and recover a forgotten password by code.

**Architecture:** Keep Supabase Auth as the only credential/session authority. A database trigger creates the private profile and reserves the username in the same signup transaction. Client forms call Supabase Auth and navigate only after verified responses.

**Tech Stack:** Next.js 16.4 App Router, React 19, Supabase Auth/Postgres, Vitest, Playwright.

**Spec:** `/Users/yasser/Documents/Projects/oneliner/specs/features/accounts.md`

## Global Constraints

- Preserve the user's signed-in identity and private journal boundaries.
- Use 6–8 digit email codes for confirmation and recovery; do not expose email-code sign-in.
- Keep the 17 synthetic review trades in `lib/trades/demo.ts` and out of real accounts.
- Run red, green, relevant tests, and typecheck for each behavior change; local and hosted evidence stay separate.
- No hosted schema/Auth configuration change and no push without separate review.

## Review Focus

- Duplicate username with different case must leave no new Auth account.
- Wrong or expired code must not navigate or change a password.
- Account switch must not reveal cached notes from the previous user.
- Recovery for an unknown email must not disclose account existence.
- Invite continuation must accept only a UUID.

---

### Task 1: Username and profile transaction

**Files:** `supabase/migrations/202610250002_account_registration.sql`, `supabase/tests/database/accounts.test.sql`, `supabase/tests/schema.test.ts`; retire `202610250001_password_access.sql` and its SQL test after updating Settings in Task 4.

**Interfaces:** Auth `signUp` receives `options.data.username`; `public.profiles.username` is lowercase, unique case-insensitively, and 3–24 characters. The signup trigger inserts `display_name = username`.

- [x] Write SQL assertions for valid signup, missing/invalid username, duplicate casing, and profile privacy.
- [x] Run those assertions and observe the expected red failure.
- [x] Add the column, constraints, index, and Auth trigger with `search_path = ''` and explicit grants.
- [x] Run focused database assertions and `npm run typecheck`; inspect all migration lines.
- [x] Commit the schema and tests atomically.

### Task 2: Registration and confirmation

**Files:** `app/register/page.tsx`, `app/components/register-form.tsx`, their unit tests, shared auth CSS; adjust `app/sign-in/page.tsx` links.

**Interfaces:** `RegisterForm({invite?: string})` calls `auth.signUp({email,password,options:{data:{username}}})`, then `auth.verifyOtp({email,token,type:'email'})`. The invitation destination uses `isUuid`.

- [x] Write failing form tests for validation, pending state, signup failure, invalid/expired code, success, and invite safety.
- [x] Implement the form and page with no profile write from the browser.
- [x] Run focused tests and `npm run typecheck`; commit.

### Task 3: Password-only sign-in and recovery

**Files:** `app/components/sign-in-form.tsx`, `app/sign-in/page.tsx`, `app/recover/page.tsx`, `app/components/recover-form.tsx`, their unit tests, local email templates and `supabase/config.toml`.

**Interfaces:** Sign-in calls `signInWithPassword`. Recovery calls `resetPasswordForEmail(email)`, `verifyOtp({email,token,type:'recovery'})`, then `updateUser({password})` and local sign-out. Local Auth requires email confirmation and sends token templates.

- [x] Rewrite sign-in tests so old OTP sign-in controls fail; add recovery tests for wrong code, mismatch, weak password, unknown email, and success.
- [x] Implement the minimal forms, page, and local template configuration.
- [x] Run focused unit tests and `npm run typecheck`; commit.

### Task 4: Retire the old password bridge

**Files:** `app/settings/password-form.tsx`, its tests, `lib/supabase/client.ts` if verification client is no longer needed, old password-access migration/test, account-related product docs.

**Interfaces:** Existing password users must supply their current password and verify email before updating. No `account_has_password` RPC or first-password branch remains.

- [x] Write failing tests that require current password and reject the removed first-password path.
- [x] Remove the marker dependency and simplify Settings without changing its identity guards.
- [x] Run focused Settings tests and `npm run typecheck`; commit.

### Task 5: Local browser journey

**Files:** `e2e/auth.spec.ts`, relevant browser helpers, `STATUS.md` in primary checkout, `todo.md`, `lessons.md` if a lasting decision emerges.

**Interfaces:** Local Mailpit supplies signup/recovery tokens; browser validates redirects, persisted profile, sign-out, old/new password, and private data boundaries.

- [x] Write the browser journey and observe red on the old UI.
- [x] Rebuild local Supabase from migrations/config, then run the focused browser journey to green.
- [x] Run relevant unit/SQL checks, `npm run typecheck`, lint, and review the full auth diff. Do not run the full test suite unless the owner asks if the feature is fully complete or deploy-ready.
- [x] Record exact local evidence and hosted configuration gaps; commit docs.
