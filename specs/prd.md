# Oneliner — product requirements

Status: Approved by the project owner · 22 October 2026; settings and theme direction amended 23 October 2026; account direction amended 25 October 2026

Canonical location: `specs/` in the primary Oneliner checkout. All feature worktrees use that shared PRD and feature folder; branch-local snapshots do not override them.

This document consolidates the product decisions confirmed in the project conversation. The project owner approved this PRD on 22 October 2026 after approving the desktop visual direction. Detailed feature specifications and implementation plans still need their own review before implementation. Proposed details and deferred work are identified explicitly.

## Purpose and audience

Oneliner helps individual futures traders capture trades quickly, finish their records later, and learn from a clear weekly review. Small private groups let trader friends compare self-reported performance and discuss their trading. The first testers are the creator and interested trader friends.

Success means a useful, reliable journal that people keep using: fast capture, easy corrections, correct statistics, and clear privacy boundaries. It should also be a finished, deployable portfolio project.

## Product direction

- **UI-01 — Desktop only for this phase.** No phone layouts, mobile navigation, or native app work is required yet.
- **UI-02 — Balanced density.** Use space for useful information. Avoid oversized inputs and buttons, excessive empty space, and crowded screens. Navigation and controls must remain readable and keyboard accessible.
- **UI-03 — Interactive and focused.** Use selection states, chart details, filtering where useful, and clear action feedback. Richer personal statistics belong in the weekly review; group comparisons remain simple.
- **UI-04 — Approved visual reference.** Follow the layout and visual direction in [the desktop preview](../docs/previews/oneliner-desktop.html). Its sample data, simulated actions, and illustrative restrictions are not production requirements or implementation evidence.
- **UI-05 — Light and dark appearance.** Users can switch between light and dark mode from account settings. Both modes keep the approved layout, readable contrast, visible focus, and persistent selection. Dark mode follows the approved preview; light mode needs its own visual review before implementation.

## Current release requirements

### Accounts and identity

- **ACC-01:** Registration asks for email, password, and desired username. Establish the user's identity during account creation, rather than asking for a name when they first create a group.
- **ACC-02:** Users sign up with email and password, confirm their email with a code, sign in and out with a password, and recover a forgotten password with an email code. Email-code sign-in is removed from the app. The prelaunch email-code accounts were deleted by the project owner; no account migration is needed.
- **ACC-03:** Each user's journal is private. Account changes must clear the previous user's displayed data and pending account-specific requests.
- **ACC-04:** The sidebar profile row opens a real settings page. Users can edit their display name, see their email as read-only, change their password, sign out, and switch appearance. Failed saves and password changes show an error without claiming success or losing journal data.

The detailed registration, username, verification, and recovery behavior is in [the account feature spec](features/accounts.md). The hosted configuration and browser journey need separate verification before friend testing.

### Capture and correct trades

- **CAP-01:** Accept a natural-language note. AI suggests symbol, long/short direction, entry, initial stop, and setup. Users review and correct suggestions before saving.
- **CAP-02:** Keep the original note exactly as entered. Missing or ambiguous information stays unresolved with an explanation; the parser must not invent values. Manual entry remains possible when parsing fails.
- **CAP-03:** Saving requires the note, symbol, direction, entry, initial stop, setup, and opening time. Opening time defaults to now and is editable. The initial stop is below entry for longs and above entry for shorts. An exit is optional at capture.
- **CAP-04:** A successful save persists after refresh and a later sign-in. A failed save retains the draft and corrections, explains the problem, and permits retry. Repeated submission must not create duplicate trades.
- **CAP-05:** Users can correct saved trade fields. Corrections update results and summaries while keeping the original captured note available.

### Complete unfinished trades

- **OUT-01:** Show trades missing an exit in a dedicated unfinished list and in the relevant weekly review. Users can add an exit from either flow.
- **OUT-02:** Calculate R from entry, initial stop, direction, and exit; do not ask users to supply the result manually.
  - Long: `(exit − entry) / (entry − initial stop)`.
  - Short: `(entry − exit) / (initial stop − entry)`.
  - Positive R is a win, negative R is a loss, and zero is breakeven.
- **OUT-03:** Closing or correcting a trade updates its record, unfinished state, and personal and shared aggregates consistently.

This release models one entry and one exit. The result excludes fees and does not model partial fills, scaling, or broker executions.

### Personal weekly review

- **REV-01:** Assign trades to the week they were opened, even if completed or corrected later. Weeks run from Monday 00:00 UTC, inclusive, to the following Monday 00:00 UTC, exclusive.
- **REV-02:** Show total R, win rate, completed count, and unfinished count. Only completed trades contribute to result statistics. Win rate is wins divided by completed trades; breakeven trades stay in that denominator. With no completed trades, show win rate as unavailable.
- **REV-03:** Include average R per completed trade, best completed result, a cumulative R chart, results by day and setup, and the underlying trades and notes, following the approved preview. Empty or unavailable results must not appear as invented performance.
- **REV-04:** Every chart, total, table, and group comparison must agree for the same records and period. Dates, counts, and the meaning of R must be understandable. Incomplete trades must be visible without inflating completed results.

The review feature spec will define chart ordering, precision, rounding, and filters before implementation. The preview's two sample weeks are not a limit on real history.

### Private groups and comparisons

- **GRP-01:** Users can create private groups, invite friends, and explicitly join after seeing which weekly figures they will share. Joining is the opt-in to aggregate sharing.
- **GRP-02:** Show a Discord-style member list and a simple weekly comparison of member identity, total R, win rate, and completed trade count for the same opening week. Results are labeled self-reported, not broker-verified.
- **GRP-03:** Group membership does not expose personal notes, individual trade rows, prices, setups, or chart imports. Members may deliberately share content in chat; their journal is not posted automatically.
- **GRP-04:** Members can leave. Owners can remove members, replace invitation links, and close a group. Leaving or removal revokes group access and visibility of the departing member's aggregates. Removing a member invalidates the old invite. Closing a group preserves personal journals.

### Group conversations

- **CHAT-01:** Each private group has a continuous chronological chat for text and pictures, with a visible composer and member list. Threaded feeds are outside this phase.
- **CHAT-02:** Sent messages persist and become available to the group's other authorized members. Sending and upload failures are visible and retain recoverable drafts; the interface must not claim an unsuccessful send succeeded.
- **CHAT-03:** Messages and pictures are restricted to authorized group members. Nonmembers and removed members cannot obtain new access through direct data or image requests. Previously downloaded content cannot be recalled.

The chat slice is specified in [group-chat.md](features/group-chat.md) and implemented locally on `feat/group-chat`. The HTML preview's online dots and sample biographies do not approve a presence or biography feature.

### Existing chart imports

- **IMP-01:** Preserve the existing local CSV chart-import capability while redesigning its presentation. It is separate from automatic trade synchronization and must not fabricate trades or results from chart-price data. Imported chart data stays private by default.

## Outside this release

- **LATER-01:** TradingView, Tradovate, and other broker connections for automatically fetched or updated trade data.
- **LATER-02:** Phone layouts and native mobile applications.
- **LATER-03:** Live execution tracking, order placement, automated trading, broker-verified performance, complex position accounting, and AI-written trading advice.
- **LATER-04:** Public communities, threaded social feeds, voice/video calls, and richer group analytics.

Absence of these features is intentional. Do not add them as prerequisites for completing the current scope.

## Definition of done

The release is ready for friend testing after the user accepts the implementation and these checks succeed:

1. Two independent accounts can register, verify email, sign in, recover access, and return to their own persisted records.
2. Capture, correction, retry, refresh, and late completion work end to end. Unclear notes and parser outages are recoverable; required fields and invalid risk are validated.
3. Long and short wins and losses, breakeven, empty weeks, opening-week boundaries, backdated entries, and late corrections produce consistent R and aggregate results.
4. Members can create, join, compare, chat, and share pictures in a private group. Cross-account requests cannot expose private journals or unauthorized messages/images. Revocation is exercised through both the UI and direct requests.
5. The approved desktop layouts are exercised in a real browser with realistic, empty, loading, and error states. Inputs have labels, keyboard focus is usable, and controls are sized for their purpose.
6. Relevant automated tests, type checks, and end-to-end checks pass. Local verification and deployed verification are reported separately; a static mockup does not prove a working feature.

## Specifications and change control

- Put detailed feature specifications in [features/](features/README.md), with the relevant requirement IDs, approval status, acceptance criteria, exclusions, and unresolved decisions.
- This PRD defines what to build. Feature specs refine behavior; implementation plans explain how. A new plan or code change does not silently change the product scope.
- [The original MVP definition](../docs/product/oneliner-mvp.md) and older Superpowers documents record the earlier baseline. The confirmed desktop-only, registration, and chat decisions above replace their conflicting product direction. Preserve historical documents rather than treating them as current competing requirements.
- Use `$direction` from any Oneliner worktree to review alignment with the current PRD. Missing planned work is not automatically drift; explicit contradictions or unapproved scope expansion are.
