# Oneliner work tracker

Last updated: 25 October 2026. This file tracks product work across branches; check the linked specs for acceptance details.

## Current status

- [x] Define the MVP in [the PRD](specs/prd.md).
- [x] Build the working trade journal foundation: email-code sign-in, note capture, outcomes, weekly review, chart CSV import, and private groups.
- [x] Approve the [desktop preview](docs/previews/oneliner-desktop.html) and [settings preview](docs/previews/oneliner-settings.html).
- [x] Build the shared desktop sidebar, header, and palette on `feat/ui-redesign`.
- [x] Review and approve the [settings spec](specs/features/settings.md) and [implementation plan](docs/superpowers/plans/2026-10-23-account-settings.md).
- [x] Implement and locally verify account settings on `feat/ui-redesign`:
  - [x] Real settings route and display-name editing (reviewed on `feat/ui-redesign`).
  - [x] Standalone sign-out on settings (reviewed on `feat/ui-redesign`).
  - [x] Account-specific dark and light mode (reviewed on `feat/ui-redesign`).
  - [x] Verified password update and password sign-in (local review complete).
- [x] Fix cached journal notes appearing before browser account confirmation (reviewed on `feat/ui-redesign`).
- [ ] Roll out and verify password access on hosted Supabase: audit existing account provenance, apply the password-access migration, decide the current-password Auth setting, and exercise the hosted sign-in/change journey. **Current release gate.**
- [ ] Specify, implement, and review the remaining [desktop screens](specs/features/desktop-preview-parity.md), one slice at a time: weekly review; capture and unfinished trades; private groups and continuous chat with pictures.
- [ ] Specify and build email/password/username registration and account recovery, including migration for existing email-code accounts.
- [ ] Compare the complete app to the approved previews at 1280 × 800 and 1440 × 900, and verify real user journeys and privacy boundaries.

## Branch and delivery

- `main` holds the product specs and implementation plan. `feat/ui-redesign` holds the desktop shell implementation in `.worktrees/ui-redesign`.
- No pull request is needed for this solo project. A push requires a fresh request.
