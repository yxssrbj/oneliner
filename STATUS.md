# Oneliner status

Updated: 26 October 2026. Project-wide status; account implementation branch: `feat/account-registration` in `.worktrees/account-registration`, based on `feat/ui-redesign`. No PR, merge, push, or hosted rollout.

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
- Latest focused account checks: 52 unit tests, 106 database assertions, 14 affected browser journeys, typecheck, and lint passed on 26 October 2026. These are focused checks, not a full suite or production build. The local database was reset after the browser checks; user, profile, trade, and group counts are all zero.

## Waiting before hosted account rollout

1. Review hosted migration history before applying `supabase/migrations/202610250002_account_registration.sql`; the old password-access migration was retired locally.
2. Enable email confirmation and set the hosted confirmation and recovery templates to show `{{ .Token }}`. Local `supabase/config.toml` does not configure hosted Auth.
3. Verify the hosted registration, email verification, recovery, password change, password sign-in, same-account data, and sign-out journeys with a disposable account.

The current-password rule is enforced by the app's verified Settings flow. Hosted configuration and browser behavior have not been verified in this branch.

Next product work after this rollout: remaining desktop screens and group chat. See `todo.md` for the broader tracker.
