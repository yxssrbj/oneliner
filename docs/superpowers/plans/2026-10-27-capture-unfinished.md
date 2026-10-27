# Capture and Unfinished Trades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make capture and unfinished trades match the approved desktop experience with real private data and optional exit at capture.

**Architecture:** Extend the existing trade API and components, retaining their owner checks and retry semantics. Use the current Supabase trade table and calculated R trigger. Keep the existing correction and chart-import controls available from saved trades.

**Tech Stack:** Next.js 16.4.2, React, Supabase, CSS, Vitest, Playwright.

**Spec:** `specs/features/trade-journal.md`; product baseline `specs/prd.md`.

## Global Constraints

- Desktop first, aligned with `docs/previews/oneliner-desktop.html`; no synthetic production trades.
- Original notes remain exact and private. No AI call is required for manual capture.
- Server validation and R calculation remain authoritative. Drafts, requests, and recent results stay account scoped.
- Use red → green → refactor, atomic commits, relevant tests and typecheck, then targeted browser journeys. Do not run the full suite unless requested.
- Read the relevant installed Next.js guide before changing a route or page.

## Review Focus

- Empty, invalid, duplicate, and conflicting optional exits: validate them in Task 1 tests.
- Backdated trades in the recent list: assert ordering by `created_at`, not opening time, in Task 1.
- Parser outage and manual entry: assert the review fields remain reachable with no AI request in Task 2.
- Account switch during a recent-list request: assert old notes never render in Task 2.
- Tiny decimal stops and failed exit saves: assert accurate risk display and retained input in Task 3.

---

### Task 1: Optional capture exit and bounded recent list

**Files:** Modify `lib/trades/validation.ts`, `lib/trades/validation.test.ts`, `app/api/trades/route.ts`, `app/api/trades/route.test.ts`; read `supabase/migrations/202610180001_core.sql`.

**Interfaces:** `TradeDraft` gains `exitPrice?: string`; `validateDraft` accepts omitted or empty exit and rejects an invalid present exit. `POST /api/trades` writes a valid exit and includes it in idempotency comparison. `GET /api/trades?recent=3` returns the owner's three latest saved trades by `created_at`; an absent `recent` keeps existing ordering and pagination.

- [x] Write tests for optional exit, invalid exit, same-key retry/conflict, valid/invalid/duplicate limit, ordering, and owner isolation.
- [x] Run the focused tests and observe failures caused by missing behavior.
- [x] Implement validation and route changes without changing existing unfiltered list behavior.
- [x] Run focused tests and typecheck; inspect failure and privacy paths.
- [x] Commit as `Trades: support capture exits and recent reads`.

### Task 2: Note-first capture with real recent trades

**Files:** Modify `app/components/capture-form.tsx`, `app/components/capture-form.css`, `app/components/capture-form.test.tsx`, `app/page.tsx` only if needed, `e2e/capture.spec.ts`.

**Interfaces:** Keep `CaptureForm({userId})`. Manual details and AI suggestions share the same editable draft. The recent panel reads `GET /api/trades?recent=3` only after browser owner confirmation and refreshes after a confirmed save.

- [ ] Write failing component tests for manual reveal, parse failure, optional exit, success/retry, recent empty/error, and account-switch privacy.
- [ ] Run focused tests and confirm the expected red behavior.
- [ ] Reshape the component and CSS to the preview's two-column layout, preserving labels, note storage, idempotency, and owner gating.
- [ ] Run focused tests and typecheck; commit as `Capture: build note-first desktop workspace`.

### Task 3: Compact unfinished cards and inline exits

**Files:** Modify `app/components/trade-workspace.tsx`, `app/components/exit-form.tsx` only if needed, `app/components/app-shell.css`, `app/components/trade-review.test.tsx`, `lib/trades/validation.ts` and its test for exact decimal risk display if needed, `e2e/outcomes.spec.ts`.

**Interfaces:** Keep `TradeWorkspace({mode,userId,initialWeek,demo})` and `ExitForm({trade,onSaved})`. The inbox shows one card per open trade with visible exit entry; review mode keeps its current behavior until the weekly-review slice.

- [ ] Write failing tests for compact card details, precise per-unit risk, failed exit input, confirmed removal, empty/load-error states, and account-switch hiding.
- [ ] Run focused tests and observe expected failures.
- [ ] Implement the smallest inbox-only markup/CSS change and preserve corrections and chart import access.
- [ ] Run focused tests and typecheck; commit as `Inbox: show compact open trades and exits`.

### Task 4: Real-browser review and project status

**Files:** Modify targeted Playwright cases in `e2e/capture.spec.ts` and `e2e/outcomes.spec.ts`; update canonical `STATUS.md`, `todo.md`, and `lessons.md` for durable decisions.

**Interfaces:** Existing local Supabase and SOPS startup; browser tests use local data only.

- [ ] Exercise populated, empty, loading/error, parser failure, manual save, optional exit, retry, and sign-out/account-change flows at 1280 × 800 and 1440 × 900 in dark and light themes.
- [ ] Compare screenshots with the approved preview and inspect focus, labels, horizontal overflow, and console errors. Record intentional differences.
- [ ] Run the relevant Vitest files, typecheck, lint, production build, targeted Playwright tests, and focused database assertions for R/privacy; inspect each result.
- [ ] Review every changed line and surrounding auth/privacy paths. Update status/tracker, commit documentation, and report any skipped check. Do not push without a new request.
