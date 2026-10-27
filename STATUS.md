# Oneliner status

Updated: 27 October 2026. Project-wide status; account implementation branch: `feat/account-registration` in `.worktrees/account-registration`, based on `feat/ui-redesign`. `main` and the account branch were pushed on 26 October; no PR or merge.

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

Capture and unfinished-trade redesign is planned in [the slice spec](specs/features/trade-journal.md) and [implementation plan](docs/superpowers/plans/2026-10-27-capture-unfinished.md). The existing product code has not changed for this slice; the spec is awaiting project-owner review.
