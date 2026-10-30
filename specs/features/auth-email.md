# Oneliner auth email design

The owner approved `docs/previews/oneliner-email-preview.html` on 30 October 2026. Replace the plain signup and recovery code emails with this visual direction so a trader can find and copy the code immediately.

## Approach

Keep Supabase Auth's existing HTML templates and `{{ .Token }}` delivery. A React Email build step or separate Resend template would add another rendering path without improving these two messages. Keep the existing sender and SMTP configuration.

## Requirements

- Signup says the code finishes account creation. Recovery says the code continues password recovery or a Settings password change.
- Put the purpose and code near the top. Keep the code as selectable text, with no spaces inserted into the token.
- Match the approved preview's charcoal header, soft green code panel, clear type hierarchy, short security note, and Oneliner footer.
- Use email-compatible HTML and inline styles. Do not depend on remote images, fonts, scripts, or CSS support.
- Do not add magic links, disclose whether a recovery address exists, or claim a fixed code length or expiry time.
- Both local and hosted Supabase templates must use the same HTML and subjects; hosted deployment must preserve SMTP settings.

## Acceptance

Both rendered emails show the correct purpose and a 6- or 8-digit code. The code is readable with images disabled, and the existing signup and recovery journeys still work.
