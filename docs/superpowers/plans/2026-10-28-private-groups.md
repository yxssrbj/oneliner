# Private Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old Groups screen with the approved desktop composition and working private group controls.

**Architecture:** Reuse existing Next.js API routes and Supabase RPC authorization. Refactor the client form and Groups component, then style the three-column layout. No schema change.

**Tech Stack:** Next.js 16, React 19, CSS, Vitest, Playwright, Supabase.

**Spec:** `specs/features/private-groups.md`

## Global Constraints

- Chat and pictures follow in another slice; no fake data or nonfunctional composer.
- Only members receive group details and metrics; only owners receive invite tokens.
- Group identity comes from the account; creation asks only for a name.
- Use a new feature worktree, red-green-refactor, focused checks, and atomic local commits. Do not push.

## Review Focus

- Account switch while requests are pending: old group names and data disappear.
- Membership revoked after page load: private content disappears on focus or action denial.
- Failed creation or join: input/consent remains recoverable and no success is reported.
- Invite rotation or removal: old invite cannot be used and member is no longer listed.
- Zero completed trades: win rate is unavailable, not 0%.

---

### Task 1: Account-only group forms

**Files:** `app/components/group-form.tsx`, `app/components/group-metrics.test.tsx`, `app/components/app-shell.css`

**Interfaces:** Keep `GroupForm({ inviteToken?, onCreated?, onIdentityChange? })`; remove profile editing and direct users with missing display names to `/settings`.

- [ ] Write focused tests for name-only creation, join disclosure, account switch, failed mutation, and missing-profile Settings link.
- [ ] Run the tests and confirm expected failures.
- [ ] Implement the form and dialog behavior with the existing `/api/groups` and `/api/groups/join` routes.
- [ ] Run focused tests and typecheck; inspect the diff; commit with `Groups:` subject.

### Task 2: Group workspace and comparison

**Files:** `app/components/group-metrics.tsx`, `app/components/group-metrics.test.tsx`, `app/components/app-shell.css`

**Interfaces:** Existing `GroupMetrics({ initialGroup? })`; same group/details/metrics API payloads.

- [ ] Write focused tests for three-region layout, member identities, owner/member controls, weekly comparison, zero-trade case, and stale-data clearing.
- [ ] Run tests and confirm expected failures.
- [ ] Implement the desktop layout and responsive CSS. Reuse current fetch and action logic.
- [ ] Run focused tests and typecheck; inspect every changed privacy-related line; commit with `Groups:` subject.

### Task 3: Browser verification and status

**Files:** `tests/e2e/*` existing group journey, `STATUS.md`, `todo.md`, `lessons.md` if an architectural decision needs recording.

- [ ] Extend the relevant Playwright journey for creation, join consent, multiple weeks, member removal, and account isolation; watch new assertions fail before adjusting behavior.
- [ ] Run focused tests, typecheck, lint of touched files, and browser journeys at 1280×800 and 1440×900 in dark and light themes.
- [ ] Inspect screenshots and full diff; update status and todo; commit locally.
