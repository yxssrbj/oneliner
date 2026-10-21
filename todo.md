# Oneliner — specs and direction review

Branch: `feat/ui-redesign` · 22 October 2026

- [x] Create `specs/prd.md` from confirmed product decisions.
- [x] Create `specs/features/` and identify the feature-spec boundaries.
- [x] Create and validate the read-only `$direction` review skill.
- [ ] User review of the written PRD before detailed implementation planning.

The approved HTML is a visual prototype. Production UI, revised authentication, and group chat implementation have not started on this branch.

Checks: skill format valid; Codex `skills/list` discovers `direction` as enabled with repository scope; a scratch agent review identifies two seeded deviations, distinguishes planned/draft/deferred work, and lists all six requirement IDs. A second empty scratch checkout reports a missing PRD without borrowing another baseline. Document links and requirement IDs checked; application tests and typecheck not run for this documentation/skill-only change. No push authorized.

## Earlier private-groups implementation

Branch: `feat/task-5-private-groups` · 20 October 2026

Worktree: `.worktrees/task-5-private-groups` (moved from the former Task 3 folder).

- [x] Record approved sharing and invitation behavior.
- [x] Implement database authorization, aggregate APIs and Friends screens.
- [x] Add failing regressions for group removal and account changes; fix both.
- [x] Exercise the two-account lifecycle and all four browser flows locally.
- [x] Finish checks and independent review of the two fixes.
- [x] Record completion evidence and hand the feature over for user review.
- [ ] User review of Friends at http://localhost:3012/friends.

Checks: 135 unit tests, 97 SQL assertions, four browser flows, typecheck, lint and build passed. Both independent-review findings were fixed and re-reviewed.

Hosted migrations and deployment remain separate. No push is authorized.
Detailed requirements: `docs/superpowers/plans/2026-10-17-oneliner-mvp.md`.
