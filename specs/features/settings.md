# Account settings

Status: Draft for project-owner review · 23 October 2026

Product baseline: [PRD](../prd.md) UI-01–05 and ACC-02–04. Visual reference: [approved settings preview](../../docs/previews/oneliner-settings.html). This slice does not complete ACC-01 registration or username selection.

## Problem and intended user

A signed-in trader needs one predictable place to correct their visible name, check their sign-in email, manage password access, change appearance, and leave the account. The existing sidebar shows a name and sign-out but has no settings destination. The current email-code sign-in must keep working while password access is introduced; a saved trade or group membership must stay attached to the same account.

## Required behavior

- The sidebar profile row opens `/settings`. Signed-out visitors are sent to `/sign-in`. The page uses the approved desktop shell: equal-width, equal-height Profile and Password cards with aligned action rows, one theme button beside the page title, and one standalone Sign out button below the cards. No Appearance or Session cards.
- Profile shows the authenticated user's email read-only. Email never appears in the sidebar or group member list. The user can save a display name of 1–80 non-blank characters. The page shows pending, validation, saved, and failure states; an error preserves the edited name. Success updates the sidebar and any group display of that user's name after refresh. A missing profile gets a neutral `Trader` label, never a fabricated profile row.
- The theme button names the next action (`Switch to light mode` or `Switch to dark mode`). Dark is the default. A confirmed choice applies across the authenticated app, remains after refresh and later sign-in on another device, and belongs to that account. A failed save restores the last confirmed theme with an error. Signing out or switching accounts does not briefly display the previous account's private identity or theme. The theme is a preference, not an authorization input.
- The Password card collects a new password and confirmation. For a password user, it also collects the current password; an email verification step confirms the change. An existing email-code user can choose `Use email code instead` and set a password on the **same** Supabase user ID without supplying a nonexistent current password. Bad, expired, or unsent codes and password-policy failures leave the existing sign-in method usable and report an actionable error. Passwords and codes are never written to profile tables, logs, drafts, or local storage.
- After a password is set, the account can sign in with email and password. Email-code sign-in remains available during the transition, including for accounts that have not set a password. Password sign-in errors do not reveal whether an email exists. Sign-out keeps the current tested local-session semantics; failure leaves a retryable action.

## What counts as working

1. A signed-in user can open `/settings`, save a corrected display name, refresh, and see it in both the sidebar and their group identity. A second account cannot read or write it; malformed and failed saves preserve input.
2. The theme changes without clearing the current settings form, survives refresh and a later sign-in, and stays separate for two accounts. Both themes keep readable labels, focus states, and the approved layout at 1280 × 800 and 1440 × 900.
3. A password account can change its password after the required verification. An existing email-code account can verify by email, set a password, sign out, and sign back into the **same account** with that password; its trade and group records remain. Wrong current passwords, wrong/expired codes, mismatch, weak passwords, and request failures do not report success.
4. Sign-out works from the standalone button. Failed sign-out remains visible and retryable; successful sign-out blocks private routes. No credentials, codes, or authenticated email appear in group content or error logs.

## Boundaries and decisions

- This slice uses the existing signed-in identity and profile API. It does not add email editing, avatar upload, public profiles, account deletion, username editing, or broker connections.
- New email/password/username registration and password recovery for signed-out users remain in the separate account-registration feature. This slice only adds password sign-in for an existing account after it sets a password. The existing OTP path stays available until that later feature is ready.
- The password flow must be checked against the deployed Supabase Auth settings before activation. In particular, reauthentication and current-password rules must not make the email-code path impossible. Local and hosted behavior are reported separately; no service-role credential is sent to the browser.
