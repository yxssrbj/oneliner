# Oneliner status

Updated: 28 October 2026. Project-wide status; account implementation branch: `feat/account-registration` in `.worktrees/account-registration`, based on `feat/ui-redesign`. `main` and the account branch were pushed on 26 October; no PR or merge since then.

## Account reset and new direction

- The project owner chose email/password registration with email codes for signup verification and password recovery. The PRD and [account spec](specs/features/accounts.md) now record that decision. Email-code sign-in and the old password-access marker are removed on `feat/account-registration`.
- All **local** Supabase accounts were deleted on 25 October 2026. The transaction removed 781 users and cascaded their 692 trades, profiles, and 120 groups. Post-deletion checks found zero users, trades, profiles, groups, identities, and sessions.
- The checked-in `lib/trades/demo.ts` on `feat/ui-redesign` retains 17 synthetic sample trades across three weeks for the read-only review preview. No database trade export was retained.
- Hosted Supabase project `svohohmwwbriepmupswk` was reset on 25 October 2026 through project-scoped Supabase MCP. Before deletion it had 1 auth user, 0 trades, and 0 profiles; `public.groups` did not exist. The auth user was deleted directly from `auth.users` (1 row), which cascaded to its identity, sessions, and refresh tokens. Three orphaned `auth.flow_state` rows with nonexistent user IDs were then deleted. Final queries found 0 auth users, trades, profiles, identities, sessions, refresh tokens, and flow-state rows; `public.groups` remains absent. The MCP URL was returned to `read_only=true`. Local Supabase and the 17 synthetic demo trades were untouched.

## Working locally on `feat/account-registration`

- Registration collects email, password, and a unique username; local Supabase sends a confirmation code. Password-only sign-in, code-based recovery, and current-password plus email-code verification in Settings are implemented.
- Desktop shell and account settings: display name, account theme, sign-out, and verified password change. A profile save now updates the signup-created row and preserves its required username.
- Journal note capture, outcomes, weekly review, CSV import, and private groups from the earlier MVP.
- Cached capture drafts and trade notes are hidden until the browser confirms the same account.
- Full branch checks on 26 October 2026 after the Friends request-boundary fix: 278 unit tests, 106 database assertions, 14 local browser journeys, typecheck, lint, and production build passed. The captured browser log has no `Date.now()` prerender errors.
- Browser tests left 39 local users, 30 local trades, and 6 local groups in the shared local Supabase stack. These local records were not reset because other local worktrees use the same stack.

## Hosted account configuration

- The hosted project `svohohmwwbriepmupswk` now has the four formerly pending migrations, including account registration. Migration history and schema were checked afterward; hosted users, profiles, trades, and groups remain at zero.
- Hosted email confirmation is enabled. `supabase config push` applied the confirmation and recovery code template bodies and subjects from this branch. A subsequent config diff shows no differences for declared Auth settings; undeclared hosted SMTP settings were preserved.
- Hosted signup created a profile and denied password sign-in before email confirmation. The delivered confirmation and recovery codes worked. Hosted browser checks covered password sign-in, profile access, Friends, sign-out, and a private trade read returning 401 after sign-out. Recovery and Settings each changed the password; the prior password failed and the replacement worked. Settings also rejected an incorrect current password before sending a code. The disposable account was then deleted; hosted users, its profile, trades, and groups are zero.
- The old auth-shell worktree was retired on 26 October 2026; its local branch and commit remain as history. Hosted smoke checks used the project's current key from Supabase CLI without changing tracked secrets.

The hosted Settings send-code step and backend code verification/password update were checked separately; the final Settings form submission was covered by local browser tests, not a single hosted browser session.

Next product work after this rollout: remaining desktop screens and group chat. See `todo.md` for the broader tracker.

Capture and unfinished-trade redesign follows [the approved slice spec](specs/features/trade-journal.md) and [implementation plan](docs/superpowers/plans/2026-10-27-capture-unfinished.md) in `.worktrees/capture-unfinished`. Baseline focused tests passed (54), and typecheck passed before implementation.

The project owner approved the capture plan on 27 October. Tasks 1–4 are implemented and reviewed on `feat/capture-unfinished` in `.worktrees/capture-unfinished`: optional capture exits, the private three-trade recent API, the note-first capture screen, and compact unfinished cards with exact per-unit risk and visible exit entry. Review found and resolved decimal retry, restored-draft visibility, and Settings sign-out draft cleanup defects. Independent source reviews approved the tasks; the final minor privacy-test gap was closed in `df01d3f`.

Final focused checks: 123 trade/capture tests and 71 auth/settings tests passed (overlapping counts), typecheck, lint, production build, nine local Playwright journeys, and read-only R/row-level privacy assertions passed. Browser review covered 1280 × 800 and 1440 × 900 in dark/light themes, with real local saves, screenshots, focus/labels, overflow, errors, account replacement, and logout. No hosted or live OpenAI call, mobile review, full suite, or production-server browser run. Browser storage that rejects removal cannot be guaranteed erased; cleanup errors are logged. This slice has not been pushed or merged.

The local launch and feature-testing commands are in [RUNBOOK.md](RUNBOOK.md), present in both the primary checkout and `feat/capture-unfinished`. The feature worktree's dev server was opened on port 3015 on 27 October; the runbook explains how to restart it.

Capture interaction refinement on `feat/capture-unfinished`: **Add** parses a note into a review summary; **Edit details** opens corrections before **Save trade**. Missing or uncertain suggestions and parser failures open editable fields directly. Focused component tests (18), typecheck, lint, and 11 targeted local browser journeys passed on 27 October 2026. The branch remains local and unmerged.

The **Add** button now sits at the note form's right edge. A targeted browser test failed before the placement change and passed afterward; the screenshot was inspected, and typecheck and focused lint passed. The full suite was not rerun for this layout edit.

## Weekly review · 28 October 2026

`feat/weekly-review` in `.worktrees/weekly-review` builds on `feat/capture-unfinished`. REV-01–04 now have a compact six-metric strip, cumulative R chart, setup and daily results, a trade table with original notes, correction/exit access, and an unfinished banner. A single week-filtered model drives every section; saved R remains authoritative, and figures are rounded only for display. The branch is local, unmerged, and unpushed.

Focused checks on this branch: 67 unit/component/API tests, typecheck, focused ESLint, production build, and two Playwright journeys passed. The review journey exercised opening-week boundaries, exit and correction refresh, moving a trade to a prior week, keyboard chart detail, chart import, account isolation, and 1280 × 800 and 1440 × 900 in both themes; screenshots were inspected. The group journey checked weekly aggregate sharing and access revocation. The full suite, hosted flow, and production-server browser run were not performed. The branch's dev server is running on port 3016; see [RUNBOOK.md](RUNBOOK.md).
