# Group Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Persistent private text and picture chat in the existing desktop Groups workspace.

**Architecture:** Postgres messages and capped image bytes behind member-checked RPCs; authenticated Next routes; client polling and a comparison dialog.

**Tech Stack:** Next 16 route handlers, Supabase Postgres, React, Vitest, pgTAP, Playwright.

**Spec:** `specs/features/group-chat.md`

## Global constraints

- Text is 1–2000 characters, or a picture may stand alone.
- One JPEG, PNG, or WebP picture of at most 1 MiB per message.
- No automatic journal sharing or public image URLs.
- Newest 50 messages initially; older pages on demand; five-second visible-tab refresh.

## Review focus

- Removed members cannot read previously known image URLs.
- Rejected messages leave the composer draft intact.
- Switching groups cannot display stale messages from the prior group.
- Malformed or disguised image data is rejected.
- Closing a group removes its message rows and images, preserving journals.

---

### Task 1: Member-checked message storage

**Files:** Add `supabase/migrations/202610280001_group_chat.sql`; add `supabase/tests/database/chat.test.sql`.

- [x] Write pgTAP assertions for membership, chronology, page cursor, image access, removal, and group closure.
- [x] Run the focused database test and observe failure.
- [x] Create the messages table and narrow list/send/image RPCs; revoke direct privileges.
- [x] Run the focused database test and confirm green.
- [x] Commit `Chat: store member-only messages`.

### Task 2: Authenticated routes

**Files:** Add `app/api/groups/[groupId]/messages/route.ts`, `app/api/groups/[groupId]/messages/[messageId]/image/route.ts`, and route tests.

- [x] Write failing route tests for validation, auth, paging, image signatures, database errors, and private image responses.
- [x] Run focused route tests and observe failure.
- [x] Implement the handlers using existing group API helpers and RPCs.
- [x] Run focused tests and typecheck.
- [x] Commit `Chat: expose private message routes`.

### Task 3: Conversation screen

**Files:** Modify `app/components/group-metrics.tsx`, `app/components/app-shell.css`; add `app/components/group-chat.tsx`, focused component and browser tests.

- [x] Write failing tests for send, failed draft retention, polling, group switch, image preview, and comparison access.
- [x] Run focused component tests and observe failure.
- [x] Build the conversation and composer; put the current comparison in a dialog.
- [x] Run focused component tests, typecheck, lint, and local Playwright chat journey.
- [x] Commit `Chat: add group conversation screen`.

### Task 4: Review and tracking

**Files:** Update global `STATUS.md`, `todo.md`, `RUNBOOK.md`, `lessons.md` where warranted.

- [x] Inspect the complete diff, callers, failure cases, and privacy boundaries.
- [x] Exercise two-member text/picture exchange, revocation, and two desktop widths end to end.
- [x] Update tracking with evidence and limitations; do not push without fresh authorization.
