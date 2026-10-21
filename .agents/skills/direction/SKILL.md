---
name: direction
description: Use when the user asks whether implementation aligns with the PRD, requests a product direction check, or suspects scope drift.
---

# Direction

Compare the current implementation with the intended product. This is a read-only review, not permission to fix code or rewrite requirements.

## Establish the target

1. Identify the current repository/worktree, branch, HEAD, and working-tree changes. Review that checkout, including uncommitted changes; do not substitute another worktree's code. State the scope when the user names a feature; otherwise cover the current-release PRD requirements.
2. Read `specs/prd.md`, then the applicable files in `specs/features/`. If the PRD is missing, report that the baseline is unavailable and ask for its location. Do not invent requirements from code or silently use an old document instead.
3. Separate confirmed requirements, draft proposals, superseded decisions, and deferred work. A draft PRD can consolidate confirmed decisions: identify that distinction and label the review provisional until the document is approved. If specifications conflict, report the conflict; implementation cannot decide which product requirement wins.

## Gather evidence

Map requirement IDs to the affected UI, APIs, data rules, and existing tests. Follow the installed `codebase-memory` skill for structural discovery, including coverage checks; inspect current source for stale or missing graph coverage. If that capability is unavailable, disclose the limitation and use direct source inspection.

Follow relevant paths far enough to support each claim, especially persistence, calculations, and authorization. For absence claims, inspect the bounded feature scope and say what was searched. Prototype HTML, placeholder screens, TODOs, and historical test summaries do not prove a shipped feature. Reading tests is evidence of intended coverage, not a passing run.

Default to inspection only: do not modify files, install dependencies, start services, send messages, use real accounts, or run migrations. Run tests or live flows only when explicitly requested and permitted for the environment; report what actually ran. Never expose credentials in evidence.

## Classify what you find

| Classification | Meaning |
| --- | --- |
| Aligned in inspected source | The inspected path matches a confirmed requirement; state runtime verification separately. |
| Drifting | Implemented behavior contradicts a confirmed requirement, or implements explicitly excluded scope without approval. |
| Not yet implemented / partial | Confirmed work remains. Planned transitions and unfinished features are not automatically drift. |
| Unverified | Evidence is missing, ambiguous, stale, or limited to a mockup. |
| Decision needed | Requirements conflict or a draft detail needs approval. |

Missing deferred work is expected. Missing draft proposals are not failures. An unmentioned implementation detail is not scope creep unless evidence shows it expands or conflicts with the product.

## Report

Start with the project, checkout/branch, reviewed scope, and a plain verdict: demonstrated drift, no drift found in the inspected scope, or insufficient baseline/evidence. Then provide:

- A compact table: requirement ID, classification, observed behavior, and `file:line` evidence for both requirement and implementation.
- The most important drift first, with impact and the smallest suggested correction.
- Remaining planned work and decisions, separate from drift.
- Coverage: list the requirement IDs examined and not examined, checks actually run, and runtime limits. Derive any counts from those lists. Never claim whole-product alignment from a partial review or invent a percentage score.
- One recommended next action. Change nothing automatically.

Example invocation: `$direction weekly review` limits the audit to review requirements and their connected calculation/data paths.
