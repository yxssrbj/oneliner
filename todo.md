# Oneliner — specs and direction review

Branch: `feat/ui-redesign` · 22 October 2026

- [x] Create `specs/prd.md` from confirmed product decisions.
- [x] Create `specs/features/` and identify the feature-spec boundaries.
- [x] Create and validate the read-only `$direction` review skill.
- [ ] User review of the written PRD before detailed implementation planning.

The approved HTML is a visual prototype. Production UI, revised authentication, and group chat implementation have not started on this branch.

Checks: skill format valid; Codex `skills/list` discovers one shared, enabled `direction` skill in all five project worktrees; a scratch agent review identifies two seeded deviations, distinguishes planned/draft/deferred work, and lists all six requirement IDs. A second empty scratch checkout reports a missing PRD without borrowing another baseline. Shared-spec regression: a linked scratch worktree with a contradictory local PRD still uses the primary checkout’s PRD and detects both seeded deviations. Document links and requirement IDs checked; application tests and typecheck not run for this documentation/skill-only change. No push authorized.

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

## Desktop shell — Task 1 (23 October 2026)

Risk: medium; shared navigation and desktop geometry.

- [x] Observe failing navigation/header contract tests (4 fail, 1 pass).
- [x] Implement desktop shell and update browser assertions.
- [x] Verify 148 unit tests, typecheck, lint and 4 local browser flows.
- [x] Review diff, report evidence and commit locally.

## Desktop shell — Task 2 (23 October 2026)

Risk: high; profile privacy and local sign-out.

- [x] Observe failing profile, refresh and auth race regressions.
- [x] Add own-profile account display and retryable local sign-out.
- [x] Verify 162 unit tests, typecheck and lint.
- [x] Complete expanded local auth journey and all four browser flows.
- [x] Review all changed lines, report evidence and commit locally.

## Desktop shell — Task 3 (23 October 2026)

Risk: medium; shared CSS and desktop interaction geometry.

- [x] Observe both desktop tests fail on the old focus palette.
- [x] Apply approved tokens, compact controls and content wrapping.
- [x] Exercise four routes, long content, loading/error/disabled states.
- [x] Verify local pointer sign-out and sticky sidebar at both sizes.
- [x] Inspect screenshots and run tests, typecheck, lint and build.
- [x] Record existing diagnostics and screen-specific follow-up scope.

## Account settings — Task 2 (24 October 2026)

Branch: `feat/ui-redesign`. Risk: high; logout races and account privacy.

- [x] Prove missing standalone action and failed-logout refresh race red.
- [x] Extract sign-out, preserve identity guards and update browser callers.
- [x] Verify focused/full unit tests, typecheck, lint and browser journeys.
- [x] Review the full diff, write evidence report and commit locally.

## Account settings — Task 4 (25 October 2026)

Branch: `feat/ui-redesign`. Risk: high; password access and verification.

- [x] Inspect Auth SDK/provider semantics and reproduce nonce bypass locally.
- [x] Research isolated email OTP verification and session consequences.
- [x] Observe password sign-in and runtime-boundary regressions red.
- [x] Add password sign-in while preserving OTP and validated invites.
- [x] Correct the design to isolated OTP verification after local nonce bypass.
- [x] Record hosted Auth settings read-only; hosted E2E remains unexercised.
- [x] Verify 285 unit tests, 14 CI browser flows and 8 production flows.
- [x] Verify typecheck, lint, build and both desktop screenshots.
- [x] Review every changed auth line, record evidence and commit locally.
