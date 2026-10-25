# Oneliner status

Updated: 25 October 2026. Project-wide status; implementation branch: `feat/ui-redesign` in `.worktrees/ui-redesign`. No PR, merge, push, or hosted rollout.

## Working locally

- Desktop shell and account settings: display name, account theme, sign-out, email code and password sign-in, and verified password setup/change.
- Journal note capture, outcomes, weekly review, CSV import, and private groups from the earlier MVP.
- Cached capture drafts and trade notes are hidden until the browser confirms the same account.
- Latest local check: 299 unit tests, 14 browser journeys, typecheck, lint, and build passed. The password-access migration previously passed 102 database assertions. See `.superpowers/sdd/2026-10-23-account-settings/` for reports and logs.

## Waiting before hosted password access

1. Confirm the hosted Oneliner project and review migration history; this worktree is not linked to a hosted Supabase project.
2. Audit whether any hosted users received a chosen password outside Oneliner's prior email-code flow. The migration can backfill recorded password-update events, but cannot infer a password set at account creation outside the app.
3. Review and apply `supabase/migrations/202610250001_password_access.sql` to the hosted project, then decide whether to enable **Require current password when updating** in Auth settings. These are not yet authorized or applied.
4. Verify the hosted email-code, first-password, current-password change, password sign-in, same-account data, and sign-out journeys with a disposable account.

Direct Supabase email recovery remains available outside Oneliner's Settings flow. The current-password rule is enforced by the app's verified settings flow.

Next product work after this rollout: remaining desktop screens and registration with email, password, and username. See `todo.md` for the broader tracker.
