# Private groups and weekly comparisons

Status: Approved direction from project owner · 28 October 2026

## Intent

Small groups of trader friends need a private place to compare the same opening week without exposing anyone's journal. This slice covers group creation, invitations, membership, and weekly comparisons. Continuous text and picture chat follows in a separate slice.

## Screen and flow

- Use the approved desktop preview's three-column composition: group list on the left, active group and comparison in the center, member list on the right. The center holds the real comparison until chat exists. Do not show a nonfunctional composer, fake messages, presence, or sample metrics.
- "Create group" opens a compact dialog asking only for the group name. The user's display name comes from their existing account. Missing profile information links to Settings; it is not collected during group creation.
- On creation, select the new group and show its owner-only invite link with a copy action. Invitees see the exact sharing disclosure and explicitly join. Joining shares only display name and weekly total R, win rate, and completed trade count with members.
- Show the active group's member list, identifying the viewer and owner. Owners can remove a member, replace the invite link, and close the group. Other members can leave. Confirm destructive membership actions and show errors without claiming success.
- The comparison offers previous and next UTC opening weeks and displays display name, total R, win rate, and completed trade count. With no completed trades, total R and count are zero and win rate is unavailable. Label figures self-reported.
- Empty, loading, and error states are explicit. Changing group/week or losing access clears stale private details. Group names and comparison data from another account must not remain visible after an account switch.

## Privacy and boundaries

- Reuse the existing authenticated group API and Supabase functions. Only members can fetch details and metrics; only owners can access invite tokens and owner actions. Removing a member rotates the invite. Closing or leaving never deletes personal trades.
- Group membership never reveals trade rows, notes, prices, setups, chart imports, email, or password. No new data collection, migration, or hosted changes in this slice.
- Match the current dark/light palettes and keyboard focus behavior. At 1280×800 and 1440×900, group selection, comparison, member list, and actions must remain usable without horizontal page scrolling.

## Approaches

1. **Selected: reshape the existing Groups client and reuse its APIs.** Keeps tested authorization and week calculations while replacing the old form-and-table layout.
2. Build a new group service and screen. More freedom, but duplicates live permission and state logic without a product need.
3. Copy the static HTML preview. Fast visually, but its sample messages and metrics would enter production and need replacement.

## Done when

A signed-in user can create and switch groups, copy an invite, join with explicit sharing consent, inspect the member list and real comparison for multiple weeks, and exercise owner/member controls. Focused tests and typecheck pass; browser journeys prove account isolation, membership revocation, and the two desktop widths. Chat remains the next slice.
