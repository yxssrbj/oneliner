# Feature specifications

[The PRD](../prd.md) defines Oneliner's product direction and release boundaries. The canonical folder is `specs/features/` in the primary Oneliner checkout, shared by all feature worktrees. Add and review feature specifications there.

Specification status:

| File | Scope | PRD requirements | Status |
| --- | --- | --- | --- |
| [desktop-ui.md](desktop-ui.md) | Shared desktop layout, navigation, controls, and states | UI-01–04 | Approved |
| [desktop-preview-parity.md](desktop-preview-parity.md) | Full desktop screen composition and real settings entry | UI-01–05, ACC, CAP, OUT, REV, GRP, CHAT, IMP | Draft |
| [settings.md](settings.md) | First settings page, theme, password access, and sign-out | UI-01–05, ACC-02–04 | Draft |
| [trade-journal.md](trade-journal.md) | Capture and unfinished screen slice; existing corrections and chart imports preserved | CAP-01–05, OUT-01–03, IMP-01 | Proposed for review |
| `weekly-review.md` | Metric definitions, ordering, charts, and review actions | REV-01–04 | Not written |
| [accounts.md](accounts.md) | Registration, usernames, verification, and recovery | ACC-01–04 | Locally implemented; hosted pending |
| `private-groups.md` | Group creation, invitations, members, and comparisons | GRP-01–04 | Not written |
| `group-chat.md` | Continuous messages, pictures, delivery, and access | CHAT-01–03 | Not written |

Each spec records its status (draft, approved, or superseded), the problem and intended user, linked PRD IDs, required behavior, acceptance criteria, exclusions, and decisions still needed. Keep implementation status and verification evidence distinct from design approval.

Resolve contradictions with the PRD explicitly. A newer draft or a working prototype does not silently override approved requirements.
