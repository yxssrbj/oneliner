# Oneliner status

Updated: 26 October 2026. Project-wide status; account implementation branch: `feat/account-registration` in `.worktrees/account-registration`, based on `feat/ui-redesign`. No PR, merge, or push.

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
- Full branch checks on 26 October 2026: 276 unit tests, 106 database assertions, 14 local browser journeys, typecheck, lint, and production build passed. The browser run also logged Next.js development prerender errors on Friends routes involving `Date.now()`; this needs investigation before calling the run clean.
- The full browser run left 19 disposable local users, 15 local trades, and 3 local groups in the shared local Supabase stack. The hosted project is still empty.

## Hosted account configuration

- The hosted project `svohohmwwbriepmupswk` now has the four formerly pending migrations, including account registration. Migration history and schema were checked afterward; hosted users, profiles, trades, and groups remain at zero.
- Hosted email confirmation is enabled. `supabase config push` applied the confirmation and recovery code template bodies and subjects from this branch. A subsequent config diff shows no differences for declared Auth settings; undeclared hosted SMTP settings were preserved.
- Hosted email delivery and the account journeys have not been exercised with a disposable account. Local browser tests used local Supabase and Mailpit.

The current-password rule is enforced by the app's verified Settings flow. Hosted browser behavior remains unverified.

Next product work after this rollout: remaining desktop screens and group chat. See `todo.md` for the broader tracker.
