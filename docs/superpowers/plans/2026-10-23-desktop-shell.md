# Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the existing four Oneliner pages the approved desktop navigation, account area, and shared visual language without changing their trade or group behavior.

**Architecture:** Work in the existing `feat/ui-redesign` checkout, using `app/components/app-shell.tsx` as the server-rendered navigation and auth boundary. A small client account control handles sign-out; existing page components and URLs remain. Restyle the current CSS files rather than adding a UI framework.

**Tech Stack:** Next.js 16.4.2, React 19.3, TypeScript, plain CSS, Supabase Auth/Postgres, Vitest, Playwright. Local startup uses SOPS as documented in this checkout.

**Spec:** [`specs/features/desktop-ui.md`](../../../specs/features/desktop-ui.md) in the primary Oneliner checkout. That primary checkout holds the approved canonical copy; linked worktrees must read it there, not from stale branch snapshots. The approved visual reference is `docs/previews/oneliner-desktop.html` in the primary checkout.

**Status:** Draft for project-owner review. No application changes are authorized by this plan alone.

## Global Constraints

- Desktop only: verify at **1280 × 800** and **1440 × 900**. No phone layout or mobile navigation is required.
- Sidebar destinations are **Weekly review** → `/review`, **Capture a trade** → `/`, **Unfinished** → `/inbox`, and **Groups** → `/friends`; keep all existing URLs and direct links.
- Follow the approved preview's charcoal surfaces, lime accent, system sans-serif, modest corners, balanced density, visible focus, accessible current-page state and reduced-motion support.
- Preserve authentication guards, user data isolation, sign-out, capture/correction, unfinished completion, review, chart imports and private group actions. The current app has no sign-out control, so add one as part of the account area.
- Keep saved and unsaved states honest. No sample trades, simulated registration, fake presence, fabricated badges, new data fetching for badges, new metrics, API/schema changes, broker integration or new dependency.
- Test-first implementation: observe focused failure, make the smallest change, then pass relevant unit tests, typecheck, lint and real-browser flows. Read the relevant local Next.js 16 guides under `node_modules/next/dist/docs/` before code edits.
- Keep user data and local Supabase intact. Use the SOPS-wrapped npm commands, assert local Supabase before browser tests, run them with `CI=1`, and stop test servers. Make local atomic commits; no push or PR.

## Review Focus

These conditions are especially easy to miss; each is assigned to a task test below.

1. A bookmarked route such as `/friends?group=<id>` opens the same content and marks **Groups** active — Task 1 browser test.
2. A long display name or long unbroken group/trade text does not hide navigation or force page-level horizontal scrolling — Task 3 browser test.
3. Missing profile data or a profile read error shows a neutral account label and a clear failure message without exposing an email — Task 2 unit test.
4. Failed sign-out leaves the user on the current page with an error and a retryable button; successful sign-out blocks private routes — Task 2 unit/browser tests.
5. Signing into another account after sign-out does not show the first account's name, trades or groups; an in-flight account-specific response cannot restore them — Task 2 browser test plus existing account-isolation tests.

## File Structure

| File | Responsibility |
| --- | --- |
| `app/components/app-shell.tsx` | Authenticated shared shell, destination mapping, current-page state, title, server account lookup. |
| `app/components/account-controls.tsx` | Client sign-out action, pending/error state, auth-change invalidation. |
| `app/components/app-shell.css` | Shared desktop geometry, palette, typography, focus and control treatments. |
| `app/components/capture-form.css` | Apply the shared visual language to the existing capture form without changing its behavior. |
| `app/components/group-form.tsx` | Refresh the shell after the existing display-name save succeeds. |
| `app/components/*.test.tsx`, `e2e/*.spec.ts` | Unit and browser regressions for navigation, account state and existing flows. |

No route paths, API handlers, database files, dependencies or component data contracts need changing. Existing page callers continue passing `title` as `'Capture' | 'Inbox' | 'Review' | 'Friends'`.

## Task 1: Replace shared navigation and page header

**Files:** Modify `app/components/app-shell.tsx`, shared shell rules in `app/components/app-shell.css`, and the navigation/viewport assertions in `e2e/auth.spec.ts`, `e2e/capture.spec.ts`, `e2e/outcomes.spec.ts`, `e2e/groups.spec.ts`. Create `app/components/app-shell.test.tsx`.

**Interfaces:** `AppShell({title, children})` continues to accept the four existing title values. Its destination list maps each title to the exact label and href in Global Constraints; navigation remains native Next `<Link>`. Task 2 adds an account control into the sidebar; Task 3 refines colors/spacing around this structure.

- [ ] Write a failing `app-shell.test.tsx` asserting the four labeled links/hrefs, exactly one accessible current-page link for each title, the correct visible header, and redirect for a missing user. Mock the current server auth boundary; no new API.
- [ ] Run `npx vitest run app/components/app-shell.test.tsx`; confirm failures reflect the old shell.
- [ ] Update the shell markup and minimal desktop geometry: persistent left sidebar about 200px wide, compact workspace header, flexible main area, native links, visible active indicator, no mobile header/nav. Keep the existing auth redirect and page children intact. Do not add preview sample counts.
- [ ] Run the focused unit test to green. Update existing browser assertions that refer to old labels, headings, mobile nav, or 390px screenshots so they check the desktop shell at 1280px/1440px while retaining their trade/group/auth assertions. Add a direct bookmarked Groups URL check with active state.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `CI=1 npm run test:e2e -- --workers=1` against verified local Supabase. Commit the task on `feat/ui-redesign` with a `Shell:` subject.

## Task 2: Add account display and sign-out

**Files:** Modify `app/components/app-shell.tsx`, `app/components/group-form.tsx`, related tests, `e2e/auth.spec.ts`, and account-area rules in `app/components/app-shell.css`. Create `app/components/account-controls.tsx` and `app/components/account-controls.test.tsx`.

**Interfaces:** `AppShell` already has the authenticated user's ID and Supabase client. Read only that user's `profiles.display_name`; pass `{ userId: string, displayName: string | null, profileError: boolean }` to `AccountControls`. The control never receives another user's journal data. Use the existing browser Supabase client and Next router; sign out with `{ scope: 'local' }`, then replace with `/sign-in` and refresh.

- [ ] Write failing server-shell tests for stored display name, absent profile (`Trader` fallback), and profile-read failure (neutral label plus readable error). Write client tests for sign-out success, failure, pending double-click, and an external `SIGNED_OUT`/account-change event hiding old identity. Do not use raw email as fallback.
- [ ] Run those focused tests and verify red. Add the authenticated profile lookup, error handling, bottom-of-sidebar account area and client control. Keep sign-out failure visible without redirect; emit no success until Supabase confirms sign-out. Refresh the server shell after `GroupForm` saves an existing display name.
- [ ] Run focused tests to green. Extend the local `e2e/auth.spec.ts` journey: name appears after save, failed sign-out stays retryable, successful sign-out redirects and `/api/profile` returns 401, and a second account does not see the previous identity or private records. Keep pending requests/account-specific responses from reappearing.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, and `CI=1 npm run test:e2e -- --workers=1`. Commit the task with an `Account:` subject. Review every changed line, the privacy boundary and the sign-out failure path.

## Task 3: Finish visual language and desktop verification

**Files:** Modify `app/components/app-shell.css` and `app/components/capture-form.css`. Create `e2e/desktop-shell.spec.ts`; use existing browser flows as regressions. Do not change route logic or form field behavior.

**Interfaces:** Reuse Task 1's shell classes and Task 2's account markup. Define the preview's shared CSS variables in `:root`: background `#141615`, panel `#1c1f1d`, raised `#222623`, line `#303630`, text `#edf0e9`, muted `#a0aaa0`, accent `#c5ed88`, positive `#a8dca3`, negative `#e6a092`. Use them across existing components; keep page-specific chart/form structures.

- [ ] Write a failing Playwright desktop-shell test for both specified viewports, all four direct routes, keyboard focus/current navigation, long display name and long unbroken text, and no page-level overflow or obscured actions. Also exercise empty/error/loading states and `prefers-reduced-motion`. Use existing local authentication helper patterns and no hosted data.
- [ ] Run the focused browser test and verify the specific layout/style failures. Update only the shared CSS: compact desktop spacing, readable control sizes, contrast, focus and disabled styles, semantic text feedback, wrapping/internal table scroll, and reduced-motion rule. Avoid phone breakpoints and speculative visual effects.
- [ ] Run the focused browser test to green, inspect browser screenshots at 1280×800 and 1440×900 against the approved preview, and correct concrete visual defects. Record what this shared shell slice does not yet match because later feature specs own those screens.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `CI=1 npm run test:e2e -- --workers=1`. Confirm no new failures or browser errors, inspect the full diff, then commit with a `Style:` subject.

## Completion handoff

After independent task reviews and a whole-branch review, show the implemented desktop shell to the project owner with the browser evidence and list screen-specific work still pending. Keep `feat/ui-redesign` as an isolated local branch for review; do not push, merge, or remove its worktree without a separate instruction.
