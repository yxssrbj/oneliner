# Oneliner lessons

## Confirmed product direction — 22 October 2026

- The redesign targets desktop only; do not introduce phone layouts or oversized controls to fill space. The approved visual reference is `docs/previews/oneliner-desktop.html`. Source: user correction and preview approval, current conversation.
- New target scope includes signup with email/password/username and private continuous group chat with pictures and a member list. Broker connections remain deferred. These are product decisions, not claims of implemented functionality. Source: current conversation.
- Keep product requirements in `specs/prd.md` and detailed feature specs in `specs/features/`. The read-only `direction` skill distinguishes drift from unfinished work and cites implementation evidence. Written PRD approval remains pending. Source: user documentation and command requests, 22 October 2026.

## Confirmed decisions — 20 October 2026

- Group sharing exposes display names and weekly aggregates only. Raw trades stay owner-only. Source: approved MVP design and `supabase/migrations/202610200001_groups.sql`.
- Group metadata tables deny direct access. Narrow authenticated database functions check identity and membership explicitly, avoiding recursive membership policies; fixed search paths and restricted grants bound their elevated access. Source: group migration.
- Membership changes lock the group; removal rotates its invite and joining rechecks the token after the lock. This prevents a waiting old invite from undoing removal. Source: group migration.
- Comparisons use completed trades from Monday UTC opening weeks; breakeven trades remain in the win-rate denominator. Source: approved design and SQL aggregate tests.

## Durable corrections

- Moving a worktree also invalidates Docker bind mounts, including Supabase's email template. Recreate local containers from the new folder with backup-preserving `supabase stop`/`start`, then verify the mount, unchanged data counts and email sign-in; restarting Next.js alone is insufficient. Source: Kong's old-path mount failure after the Task 5 move, 20 October 2026.
- Keep a separate worktree for each active feature, with its folder matching the feature. Reusing Task 3's folder for Task 5 confused navigation; use `git worktree move` when correcting a folder name. Source: user correction and approved move, 20 October 2026.
- After membership refresh, reconcile selection against the returned groups. Keeping a removed selection can hide other valid groups. Source: Task 5 review and browser regression.
- Account changes must invalidate identity-derived forms and pending requests as well as displayed results. Cover Friends and invite pages; preserve drafts on ordinary same-account failures. Source: Task 5 review and component/browser regressions.
- Each push needs current authorization; local atomic commits are permitted. Source: updated global instructions, 20 October 2026.

- Keep canonical specs in `specs/` in the primary project checkout, shared by every feature worktree. Resolve that checkout through Git; review feature code locally while reading the shared PRD. Do not treat a feature branch’s copied PRD as its own product direction. Source: user correction, 22 October 2026.

- Private settings rendering must await `io()` before Supabase auth initialization: its session expiry check reads `Date.now()` and triggers Next.js prerender diagnostics. A clean build alone does not prove route navigation; exercise it on the production server. Source: Task 1 production browser regression and Supabase `GoTrueClient.__loadSession`, 24 October 2026.
- Successful sign-in must start a new document at the validated destination; `router.replace()` plus `router.refresh()` can retain a signed-out private-route result with partial prefetching. Keep the signed-out settings → OTP sign-in → profile-link journey in production browser coverage. Source: Task 1 production isolation/regression, 24 October 2026.
- Gate all private settings identity on matching browser-owner confirmation; disabling edits alone still renders the previous server account before `INITIAL_SESSION`. Cover delayed and mismatched initialization, including a held-script browser navigation. Source: Task 1 review/fix round 1, 24 October 2026.
- Compare browser failures against the exact baseline before labeling them unrelated. Full-document OTP navigation exposed Home's missing `io()` boundary: baseline 8230b9a passed 6/6 development flows while Task 1 initially failed outcomes. Source: isolated baseline reproduction and caller fix, 24 October 2026.

- Coordinate pending local logout across sidebar and settings auth subscribers: Supabase emits `SIGNED_OUT` even when logout returns an error. Hide private identity immediately but defer that event's refresh until the button handles success/failure, preserving retry; account replacements still refresh. Source: Task 2 real-component integration red/green and local auth browser journey, 24 October 2026.
