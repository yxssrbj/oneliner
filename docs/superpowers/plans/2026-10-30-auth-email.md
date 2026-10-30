# Auth Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the approved signup and password-code email design.

**Architecture:** Supabase Auth continues sending both messages. Replace only the local HTML templates and subjects, then apply the same declared configuration to hosted Auth after local verification.

**Tech Stack:** Supabase Auth Go templates, static HTML with inline CSS, Vitest.

**Spec:** `specs/features/auth-email.md`

## Global Constraints

- Preserve `{{ .Token }}` and the existing signup/recovery flows.
- Keep SMTP settings and any other hosted Auth configuration unchanged.
- Use a preview-only sample code; never commit a real code.
- Run focused tests and typecheck; do not run the full suite unless requested.

## Review Focus

- Six- and eight-digit tokens remain contiguous and selectable.
- Missing image, font, or external CSS support does not hide the code.
- Recovery copy also fits Settings password verification.
- No link accidentally changes code-based authentication.
- Hosted config push must not reset SMTP settings.

## Task 1: Branded templates

**Files:** `supabase/templates/confirmation-code.html`, `supabase/templates/recovery-code.html`, `supabase/config.toml`, `supabase/templates/templates.test.ts`.

- [x] Write tests for purpose-specific copy, code placeholder, no link, and inline email styling; confirm red.
- [x] Implement both templates and subjects from the approved preview; confirm green.
- [x] Render sample codes in a browser and inspect both layouts.
- [x] Run focused tests, typecheck, and lint; review the full diff.
- [x] Record the result in `STATUS.md` and commit the local change.

## Task 2: Hosted rollout

- [x] Compare hosted Auth config with the declared template settings and inspect SMTP-preservation behavior.
- [x] Apply only the reviewed template configuration if the connection permits it.
- [x] Verify hosted Auth reports both template bodies and subjects up to date.
- [ ] Check an actual hosted email delivery with a test account.
- [x] Record the unverified delivery step in `STATUS.md`.
