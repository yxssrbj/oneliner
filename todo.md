# Oneliner work tracker

Last updated: 30 October 2026. This file tracks product work across branches; check the linked specs for acceptance details.

## Current delivery

- [x] Approve TradingView paper-trading history import design.
- [x] Implement the approved [trade-history plan](docs/superpowers/plans/2026-10-30-tradingview-trade-history.md) on `feat/tradingview-history`; focused parser/API/component/database and browser checks, including the supplied local CSV, passed.
- [x] Run the full local release check on `feat/tradingview-history`: 463 unit tests, 182 database assertions, 25 browser journeys, typecheck, lint, and production build passed. Configure Vercel to build from its environment variables.
- [ ] Review and integrate `feat/tradingview-history`; deployment requires separate authorization. The feature branch is pushed for Vercel preview.
- [x] Apply and verify the five pending hosted Supabase migrations; migration history and a follow-up dry run are up to date.
- [ ] Configure Vercel variables and Auth URL, then verify signup code delivery to another address before inviting friends.
- [x] Apply the approved signup and password-code email designs to local templates and hosted Auth; integrate into `main`.
- [ ] Inspect a real hosted signup and recovery email with a disposable account before inviting testers.
- [x] Run the complete feature-branch check: 377 unit tests, 140 database assertions, 23 browser journeys, typecheck, build, and lint with two existing warnings.
- [x] Verify the integrated `main` tree: 380 unit tests, 140 database assertions, 23 browser journeys, typecheck, build, and lint with two existing warnings.
- [x] Push the integrated `main` tree to `origin/main` (`1242e0d`).
- [ ] Apply the new group/chat migrations to hosted Supabase and verify hosted privacy and account journeys before deployment or inviting testers.

## Current status

- [x] Define the MVP in [the PRD](specs/prd.md).
- [x] Build the working trade journal foundation: note capture, outcomes, weekly review, chart CSV import, and private groups.
- [x] Approve the [desktop preview](docs/previews/oneliner-desktop.html) and [settings preview](docs/previews/oneliner-settings.html).
- [x] Build the shared desktop sidebar, header, and palette on `feat/ui-redesign`.
- [x] Review and approve the [settings spec](specs/features/settings.md) and [implementation plan](docs/superpowers/plans/2026-10-23-account-settings.md).
- [x] Implement and locally verify account settings on `feat/ui-redesign` and `feat/account-registration`:
  - [x] Real settings route and display-name editing (reviewed on `feat/ui-redesign`).
  - [x] Standalone sign-out on settings (reviewed on `feat/ui-redesign`).
  - [x] Account-specific dark and light mode (reviewed on `feat/ui-redesign`).
  - [x] Verified password update and password sign-in (local checks complete on the registration branch).
- [x] Fix cached journal notes appearing before browser account confirmation (reviewed on `feat/ui-redesign`).
- [x] Specify and locally implement email/password/username registration, email confirmation, and password recovery on `feat/account-registration`.
- [x] Review hosted migration history and apply the four pending migrations, including account registration.
- [x] Configure hosted signup confirmation and password recovery code templates while preserving SMTP settings.
- [x] Verify hosted registration, confirmation, recovery, password change, password sign-in, and sign-out with a disposable account; remove it afterward.
- [x] Fix Friends prerender errors with request-time boundaries; regression tests and a clean 14-journey browser log confirm it.
- [x] Specify, implement, and review the remaining [desktop screens](specs/features/desktop-preview-parity.md), one slice at a time:
  - [x] Capture and unfinished trades: [spec approved](specs/features/trade-journal.md), implemented and reviewed on `feat/capture-unfinished`; targeted browser and local privacy checks passed. Not merged or pushed.
  - [x] Weekly review: [feature spec](specs/features/weekly-review.md), richer statistics, cumulative chart, setup results, daily cards, and trade table implemented and locally checked on `feat/weekly-review`; not merged or pushed.
  - [x] Private groups and weekly comparisons: group creation, invitation, member list, owner controls, and real weekly figures implemented and locally checked on `feat/private-groups`; not merged or pushed.
- [x] Continuous group chat: text and picture messages with member-only access implemented and locally checked on `feat/group-chat`; not merged or pushed.
- [x] Rework `feat/group-chat` into Chat and Weekly comparison tabs, a compact chat composer, and a group actions menu; verify owner-only rename and browser journeys.
- [x] Match the capture page composition to the approved desktop preview on `feat/group-chat`; focused browser checks and visual inspection passed.
- [ ] Review the updated capture page at `http://localhost:3018/`.
- [x] Match the weekly review page to the approved desktop preview on `feat/group-chat`; focused browser checks and visual inspection passed.
- [ ] Review the updated weekly review at `http://localhost:3018/review`.
- [x] Match the unfinished trades page to the approved desktop preview on `feat/group-chat`; focused browser checks and visual inspection passed.
- [ ] Review the updated unfinished trades at `http://localhost:3018/inbox`.
- [x] Align the Groups chat and member layout with the approved desktop preview on `feat/group-chat`; focused component and browser checks passed.
- [ ] Review the updated Groups screen at `http://localhost:3018/friends`.
- [x] Align the shared desktop sidebar, top bar, and profile row with the approved preview on `feat/group-chat`; focused browser checks passed.
- [ ] Review the shared layout across the signed-in pages at `http://localhost:3018/`.
- [ ] Compare the complete app to the approved previews at 1280 × 800 and 1440 × 900, and verify real user journeys and privacy boundaries.

## Branch and delivery

- `main` now holds the integrated app and shared product specs. Older feature worktrees remain available as history.
- No pull request is needed for this solo project. A push requires a fresh request.
