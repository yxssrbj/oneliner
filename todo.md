# Oneliner work tracker

Last updated: 26 October 2026. This file tracks product work across branches; check the linked specs for acceptance details.

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
- [ ] Review hosted migration history, apply the account-registration migration, configure confirmation/recovery code emails, and verify hosted account journeys. **Current account release gate.**
- [ ] Specify, implement, and review the remaining [desktop screens](specs/features/desktop-preview-parity.md), one slice at a time: weekly review; capture and unfinished trades; private groups and continuous chat with pictures.
- [ ] Compare the complete app to the approved previews at 1280 × 800 and 1440 × 900, and verify real user journeys and privacy boundaries.

## Branch and delivery

- `main` holds the product specs and tracker. `feat/ui-redesign` holds the desktop shell in `.worktrees/ui-redesign`; `feat/account-registration` holds the local account implementation in `.worktrees/account-registration`.
- No pull request is needed for this solo project. A push requires a fresh request.
