# Desktop screens and account entry

Status: Draft for project-owner review · 23 October 2026

Product baseline: [approved PRD](../prd.md), especially UI-01–05, ACC-01–04, CAP-01–05, OUT-01–03, REV-01–04, GRP-01–04, CHAT-01–03, and IMP-01.
Visual target: [approved desktop preview](../../docs/previews/oneliner-desktop.html).
Settings and light-theme proposal: [settings preview](../../docs/previews/oneliner-settings.html).
Current foundation: the local `feat/ui-redesign` branch has the shared sidebar, header, palette, and sign-out. This draft describes the remaining screen-level work; it does not claim the preview is implemented.

## Intent

Make the working desktop app recognizable as the approved preview while keeping all performance, identity, and group content tied to real authorized data. The preview's composition, density, typography, panels, and interactions are the visual target. Its sample trades, online dots, mock registration, and simulated messages are demonstrations, not production data.

The intended users are individual traders who need a quick private journal and small private groups. Completion means that a tester can recognize each production screen as its preview counterpart, complete the real task on that screen, and see honest empty, loading, error, and saved states.

## Approach

**Selected direction from the existing architecture and approved plan:** rebuild the screen layouts in the existing Next.js app, reusing authenticated components, APIs, and Supabase policies. Implement and review one feature screen at a time. This preserves the trade and privacy behavior already exercised by tests.

Considered alternatives:

- Copy the standalone HTML into the app, then wire it up. This would bring sample state and simulated actions into production and bypass existing components until they were rebuilt.
- Replace the UI with a component framework. This would add a dependency and still require the same screen and data work; it offers no needed visual advantage over the approved CSS reference.

## Screen contract

### Shared navigation and profile

- Keep the four existing sidebar destinations and URLs. Match the preview's visual hierarchy: brand, clearly separated journal and group navigation, and a profile row anchored at the bottom. Use the current signed-in user's data; omit count badges unless their values come from authorized live queries.
- The profile row shows an avatar made from the user's visible name, that name, and a secondary `Personal workspace` label. It opens a **real `/settings` page**. Sign-out is a standalone button below the account settings, without its own card.
- Settings shows the authenticated email as read-only and lets the owner edit their display name with explicit save, pending, success, validation, and error states. A successful save updates the sidebar and group identity. A missing profile uses a neutral label. Settings never exposes account information to group members.
- Settings lets a password-based user change their password after the required identity check. Existing email-code users must have a safe way to set a password during the account transition; they cannot be asked for a current password they never created. Failed or interrupted changes do not report success or lock the user out; password inputs are never stored in journal drafts.
- Settings offers one standalone button beside the page title to switch between Dark and Light, without an Appearance card. Its label names the next action. The confirmed choice applies to the whole app, persists after refresh and later sign-in, and follows the signed-in account across devices. A failed preference save shows an error and restores the last confirmed choice. A different account loads its own preference. Dark is the default when no choice exists and matches the approved preview; both palettes need WCAG AA contrast checks during implementation.
- Registration asks for email, password, and desired username, as required by ACC-01. The account feature specification will define username uniqueness, migration of existing email-code users, password recovery, and which credentials can later be changed. The preview's profile-button-to-registration demo is superseded by the real settings destination. Changing username or email is outside the first settings page.

### Weekly review

- Match the preview's page heading, week controls, compact metric strip, cumulative R chart beside setup results, day-by-day cards, trade table, and unfinished banner. Show total R, win rate, completed count, unfinished count, average R, and best completed R from the selected opening week.
- Chart points, setup totals, daily totals, table rows, and headline metrics must reconcile with the same authorized trades. An empty week shows clear empty states without synthetic results. Selecting a trade opens its existing details/correction flow; unfinished trades link to completion.

### Capture and unfinished trades

- Match the preview's two-step capture composition: natural-language note first, then editable suggested fields. Keep the original note, manual fallback, pending/error/retry behavior, and current save rules. Supporting content occupies the secondary column only when it helps the task; no decorative filler or fake parser result.
- Match the unfinished screen's compact cards and clear exit action. The real exit recalculates R and updates the relevant opening-week review. Preserve chart imports and saved-trade corrections within the redesigned flow.

### Private groups

- Match the preview's three-part composition: group list, continuous conversation with composer, and member list. Weekly comparison remains simple and self-reported. No presence dots or biographies until actual presence/biography behavior is specified.
- Group creation, invitations, membership controls, text messages, and picture attachments use real authorization and persistence. Unsent text and selected attachments remain recoverable after a failed send. Removed members cannot fetch group messages or images.

## Visual and interaction acceptance

1. At 1280 × 800 and 1440 × 900, the review, capture, unfinished, groups, and settings screens retain the preview's major panels and hierarchy without page-level horizontal scrolling or obscured actions. Content may grow vertically; data regions may scroll internally where appropriate.
2. The profile row opens `/settings`; editing the signed-in display name persists after refresh and updates the sidebar. Password changes require identity verification and report success only when confirmed; existing email-code users can move to a password without losing access. Another account cannot view or change these settings. The email is never displayed to other group members.
3. Changing dark/light mode updates the whole app without losing drafts, persists across sessions and devices for that account, and does not carry the previous account's choice into a different account. Both themes retain readable text and focus states; the light palette is reviewed visually before code.
4. Review calculations and every visual breakdown agree for completed, unfinished, breakeven, corrected, backdated, and empty-week cases. The chart and setup panels contain no fabricated points.
5. Capture, correction, incomplete trade completion, import, invite, comparison, chat, and picture flows work with keyboard focus and visible feedback. Failures preserve recoverable user input.
6. A real browser comparison at both sizes includes populated and empty views plus loading and error states. Reviewers compare each page against the relevant preview section and resolve differences in layout, typography, spacing, colors, and component styling; live data and unsimulated behavior are documented separately.

## Delivery boundaries

Build this in feature slices: account and settings, weekly review, capture and unfinished entries, then groups and chat. Each slice gets its own approved behavior spec and small implementation plan before code. Existing private data and stored trades must survive the account transition. No broker synchronization, mobile UI, public feed, fake presence, or synthetic production data is added.

## Confirmed settings scope

The project owner confirmed editable display name, read-only email, password change, sign-out, and dark/light switching for the first real settings page. They accepted the settings preview with one change: theme and sign-out are standalone buttons, not separate cards. The account feature spec will settle the exact reauthentication and existing-account transition before changing authentication or schema.
