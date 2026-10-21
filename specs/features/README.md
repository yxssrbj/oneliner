# Feature specifications

[The PRD](../prd.md) defines Oneliner's product direction and release boundaries. This folder holds the detailed feature specs reviewed before implementation.

Planned specifications, not yet written or approved:

| File | Scope | PRD requirements |
| --- | --- | --- |
| `desktop-ui.md` | Shared desktop layout, navigation, controls, and states | UI-01–04 |
| `trade-journal.md` | Capture, corrections, unfinished trades, and chart imports | CAP-01–05, OUT-01–03, IMP-01 |
| `weekly-review.md` | Metric definitions, ordering, charts, and review actions | REV-01–04 |
| `accounts.md` | Registration, usernames, recovery, and existing users | ACC-01–03 |
| `private-groups.md` | Group creation, invitations, members, and comparisons | GRP-01–04 |
| `group-chat.md` | Continuous messages, pictures, delivery, and access | CHAT-01–03 |

Each spec records its status (draft, approved, or superseded), the problem and intended user, linked PRD IDs, required behavior, acceptance criteria, exclusions, and decisions still needed. Keep implementation status and verification evidence distinct from design approval.

Resolve contradictions with the PRD explicitly. A newer draft or a working prototype does not silently override approved requirements.
