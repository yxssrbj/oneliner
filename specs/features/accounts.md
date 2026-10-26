# Accounts — registration and recovery

Status: Locally implemented, 26 October 2026; hosted rollout remains pending. Product owner requested this journey and its end-to-end check. Username uniqueness and validation are implementation decisions pending any correction from the owner.

## Intent

New traders create an Oneliner account with email, password, and username, prove that they control the email with a code, and return with a password. Email codes recover a forgotten password. Journal data stays private to the authenticated account.

## Approaches

- **Supabase Auth codes and sessions (chosen):** use `signUp`, `verifyOtp`, password sign-in, `resetPasswordForEmail`, and recovery verification. This uses the existing Auth identity and server-side user checks, and requires separate confirmation/recovery email templates.
- **Custom codes and sessions:** store tokens and implement expiry, rate limits, recovery, and session issuance ourselves. It duplicates Auth and creates avoidable security work.

## Required behavior

1. `/register` collects email, password, and username. Usernames are case-insensitive unique handles, normalized to lowercase, 3–24 characters from `a–z`, `0–9`, and `_`. Passwords have at least 8 characters and must pass the hosted Auth policy. The form explains validation errors without clearing fields.
2. Successful signup sends a confirmation **code** and leaves the user signed out until that code is verified. The code field accepts the provider's 6–8 digit codes. A wrong or expired code leaves the entered email and a way to request a fresh code. A verified signup establishes only that user's session and opens the intended destination, including a validated private-group invite.
3. The chosen username is reserved atomically with account creation and creates a matching private profile display name. A duplicate or invalid username never creates an account without a usable profile. The username is stable for this release; Settings may still edit the separate display name. The profile is never public by default.
4. `/sign-in` accepts email and password only. It offers links to registration and recovery. Incorrect credentials, unknown accounts, network failures, and unverified accounts never produce a false success or expose whether an email exists. Sign-out preserves the current local-session behavior and clears stale private content.
5. `/recover` requests a recovery **code** by email without revealing whether the address belongs to an account. A valid code permits choosing and confirming a new password for that same account. Invalid codes, mismatched passwords, weak passwords, and request failures are recoverable. After success, the recovery session is ended and the user signs in with the new password.
6. Settings password changes require the current password and email verification. First-password setup for old email-code accounts and its password-access marker are retired because the prelaunch accounts were deleted. Email-code sign-in disappears from the app; email codes remain for signup confirmation, recovery, and sensitive-account verification.
7. Passwords and codes stay out of profile tables, logs, draft storage, and URLs. Client success requires a confirmed Auth response. No service-role credential reaches the browser.

## Configuration and scope

- Local Supabase enables email confirmation and uses separate `{{ .Token }}` templates for confirmation and recovery. The hosted project's confirmation setting and templates must be checked separately before claiming hosted verification.
- Keep the existing 17 synthetic preview trades in `lib/trades/demo.ts`; registration does not inject demo data into real accounts.
- Broker connections, social discovery by username, username editing, and account migration are outside this slice.

## Acceptance

- A new account cannot use protected pages before confirmation; after entering the emailed code, its username/profile exists and it can sign out and sign back in with its password.
- Two accounts cannot reserve the same username with different casing; a failed signup does not claim success.
- A recovery code changes only the requested account's password. The old password fails, the new one signs in, and a wrong/expired code changes nothing.
- Invite continuation accepts only a UUID. Cross-account private notes and settings stay hidden.
- Relevant unit, database, type, and browser checks run locally. Hosted settings and hosted browser checks are reported separately.
