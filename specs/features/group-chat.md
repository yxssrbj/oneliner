# Private group conversations

Status: implementation scope · 28 October 2026

## What members can do

The selected group shows a continuous, chronological conversation in the center of the existing three-column desktop workspace. Members can send text, one picture, or both. The member list remains visible. A compact weekly comparison dialog preserves the existing comparison and invitation controls. No trade or journal content is posted automatically.

Messages are persistent and show the sender's current display name and send time. The newest 50 load first; members can load older messages. The open conversation refreshes every five seconds while the tab is visible and immediately after a successful send. This is a small-group delivery choice, not a presence or instant-delivery promise.

The composer allows 1–2000 trimmed text characters and one JPEG, PNG, or WebP picture up to 1 MiB. A picture-only message is valid. The UI shows a local picture preview and lets the member remove it before sending. On a failed send, text and picture remain in the composer with a visible error. The server, not the browser, assigns sender and time. No edit, delete, reactions, typing indicator, online state, or threading in this slice.

## Privacy and storage

Messages and image bytes live in Postgres with group ownership and cascade when a group closes. Deleting a sender account preserves the group history with a saved display name. The image is omitted from message lists and read separately. All direct table privileges are revoked. Security-definer functions check current membership on each list, send, and image request. A removed member or nonmember receives the same unavailable response; direct image URLs do not grant access. This also avoids retained signed URLs after removal. Files already downloaded by a member cannot be recalled.

The API authenticates via the current session and validates group IDs, message sizes, file MIME and signatures. Image responses are private and never cached. Changing groups or signing out clears displayed messages and old image URLs. A stale response cannot repopulate a different group's conversation.

## Approaches

1. **Selected: Postgres message rows with capped image bytes.** One authenticated transaction per send, simple cascade cleanup and revocation, no storage URL bypass. The 1 MiB limit is deliberate for small MVP groups; move binaries to private object storage if usage grows.
2. Private Supabase Storage bucket plus message rows. Better for larger media, but requires separate upload/message transactions, orphan cleanup, and careful download policy.
3. Realtime transport. Faster updates, but adds subscription and authorization complexity; polling is sufficient for this MVP conversation.

## Done when

Two members can exchange text and pictures, see persisted history and older pages, and compare weekly results without losing the conversation. Invalid files and failed sends show errors without losing drafts. Anonymous users, nonmembers, and removed members cannot list, send, or fetch image bytes. Focused tests, typecheck, and desktop browser journeys pass.
