# Desktop layout and navigation

Status: Approved by the project owner

Product baseline: [approved PRD](../prd.md), requirements **UI-01–04**.
Visual reference: [approved desktop preview](../../docs/previews/oneliner-desktop.html).

## Problem and intended user

Traders need to move quickly between recording a trade, completing unfinished records, reviewing their week, and talking with their private groups. The desktop interface should make those destinations obvious and leave enough room for useful information without oversized controls or empty filler.

This first implementation slice establishes the shared desktop layout and visual language. Individual screen redesigns follow the trade journal, weekly review, accounts, and group specifications. Completing this slice does not complete the full preview or release.

## Required behavior

### Shared layout

- Use a persistent left sidebar and a main workspace with a compact page header, following the preview's proportions. Keep the sidebar about 200 pixels wide; give the workspace the remaining width.
- Provide four clearly labeled destinations: **Weekly review**, **Capture a trade**, **Unfinished**, and **Groups**. Preserve existing destination URLs and direct-link behavior; changing labels must not break bookmarks.
- Highlight the active destination with a visible indicator as well as color. Each destination remains one click away, including trade capture.
- Show the current page title in the workspace header. Place relevant existing page actions near that title where appropriate, without duplicating competing primary actions.
- Keep the account area at the bottom of the sidebar and preserve sign-out access. Use the existing account identity with a neutral fallback when a display name is unavailable. Do not expose an email address to other users through this layout.
- The preview's account button opens a registration demonstration. That demonstration is not the account area's production behavior; registration and profile changes belong to the accounts specification.
- Long page content scrolls normally. Navigation, headings, forms, and page actions must not overlap or become unreachable.

### Visual language and density

- Follow the preview's charcoal surfaces, lime primary accent, system sans-serif typography, restrained borders, and modest rounded corners. Use consistent spacing and control heights across the shared layout.
- Size buttons and inputs for their content and purpose. Let tables, charts, and forms use available desktop space; avoid a narrow phone-like column or stretching controls merely to fill a panel.
- Use clear hierarchy between page titles, section headings, values, labels, and supporting text. Success, warning, and error states include readable text rather than relying on color alone.
- Keep this slice to shared layout and shared control styling. Do not restructure chart contents, replace forms, or add metrics to make an individual page match the full preview prematurely.

### Interaction and real states

- Navigation and controls show hover, keyboard focus, active, and disabled states where applicable. Interactive elements work with a keyboard and have meaningful accessible names.
- Use native link behavior for navigation, including opening destinations in another tab. Mark the current destination accessibly.
- Subtle transitions may support feedback; respect reduced-motion preferences. Decorative animation is unnecessary.
- Preserve existing loading, empty, validation, and error messages. Restyling must not hide a failure, clear a recoverable draft, or make an in-progress action appear successful.
- Any navigation badge must represent current authorized data. Omit badges when that data is unavailable; do not introduce additional data fetching solely to copy the preview's sample counts.
- Keep sample trades, simulated registration, fake online status, and demonstration actions out of the production layout.

### Existing functionality

- Keep authentication guards, account isolation, sign-out behavior, and existing page workflows intact.
- Preserve capture and correction, unfinished trade completion, weekly review, chart imports, and private group actions while changing the surrounding layout.
- Preserve current navigation behavior for unsaved forms. New draft persistence or navigation-warning behavior requires the trade-journal specification.
- Do not change trade calculations, API contracts, database schemas, or authorization rules in this slice.

## Acceptance criteria

1. At **1280 × 800** and **1440 × 900**, each of the four destinations uses the same desktop shell, with readable content, reachable controls, and no page-level horizontal overflow. Wide data regions may scroll within their own labeled container.
2. Each sidebar destination opens the correct existing page, shows the correct active state, and works when visited directly or through browser back/forward navigation. Capture remains accessible in one click.
3. Keyboard users can reach every navigation item, account action, and page control with visible focus. Active navigation is conveyed accessibly, and text/control contrast meets WCAG AA.
4. Long titles, long account identities, empty records, loading states, and visible errors fit the layout without hiding controls or showing fabricated data.
5. Existing sign-in protection and sign-out continue to work. Switching accounts does not leave the previous account's identity or data visible.
6. Existing capture, completion, review, import, and group flows remain usable after restyling. Relevant automated checks and type checks pass; the affected desktop flows are exercised in a real browser with recorded results.
7. The project owner reviews the implemented shell against the approved preview. Verification reports distinguish the shared layout delivered here from screen-specific work still pending.

## Exclusions

- Phone layouts, mobile navigation, and native applications.
- Password registration, username rules, account migration, or new profile editing.
- New charts, statistics, capture behavior, or trade accounting changes.
- Group chat, image uploads, presence indicators, biographies, or new group permissions.
- Broker connections, automatic synchronization, sample data in Supabase, or production deployment.
- A new component framework or design-system package is not a product requirement; implementation choices belong in the implementation plan.

## Decisions and next gate

No further product question is needed to review this slice. The preview supplies the visual direction; existing routes and workflows supply the behavior to preserve.

Next, review a small implementation plan identifying the affected shared components, regression checks, and isolated worktree. This spec's approval does not approve that plan or claim any implementation has been verified.
