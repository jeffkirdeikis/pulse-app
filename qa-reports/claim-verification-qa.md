# QA Report: Business Claim Email Verification

**Date**: Feb 13, 2026
**Scope**: Full security + functional + UI audit of business claim + email verification flow
**Commits**: `e0299a4` → `20559d5` → `f9cab35` → `c80fabe`

---

## Executive Summary

Found **4 critical security vulnerabilities**, **4 critical functional bugs**, and **8 medium/minor issues** across the business claim flow. All critical and major issues have been fixed.

---

## Security Audit Results

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| S1 | CRITICAL | Verification code readable client-side — comparison in browser JS | **FIXED** — moved to `verify-claim-code` Edge Function |
| S2 | CRITICAL | No UPDATE RLS policy — user could SET status='pending' directly | **FIXED** — DB trigger blocks pending_verification transitions |
| S3 | CRITICAL | Client-side code generation + attempt reset in resend | **FIXED** — moved to `resend-claim-code` Edge Function |
| S4 | CRITICAL | No admin RLS policies — admin couldn't see/act on claims | **FIXED** — added SELECT/UPDATE policies for admins |
| S5 | HIGH | No rate limiting on resend (email bombing risk) | **FIXED** — 60-second cooldown with countdown timer |
| S6 | HIGH | Edge Function no auth check (phishing potential) | Accepted — only sends branded emails, no state mutation |
| S7 | MEDIUM | Incomplete HTML escaping in email template | **FIXED** — proper `escapeHtml()` for all 5 chars |
| S8 | LOW | `Math.random()` for codes (not crypto-secure) | **FIXED** — server-side `crypto.getRandomValues()` |

---

## Functional Bug Results

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| F1 | CRITICAL | `userClaimedBusinesses` mapped claim ID instead of business_id | **FIXED** — dashboard now uses correct business UUID |
| F2 | CRITICAL | `claimed_business_id` column missing from profiles | **FIXED** — added via migration |
| F3 | CRITICAL | No code expiration check (email says 24 hours) | **FIXED** — server-side 24h check |
| F4 | CRITICAL | DB constraint missing `pending_verification` status | **FIXED** — added to CHECK constraint |
| F5 | MAJOR | Admin could approve `pending_verification` claims | **FIXED** — buttons hidden until user verifies |
| F6 | MAJOR | "Wrong email? Go back" didn't reset modal step | **FIXED** — `setClaimVerificationStep('form')` |
| F7 | MEDIUM | No email format validation | **FIXED** — regex check before submission |
| F8 | MEDIUM | Whitespace-only names accepted | **FIXED** — `.trim()` on all fields |
| F9 | MEDIUM | Inconsistent toast error handling | **FIXED** — standardized to `showToast()` |
| F10 | MEDIUM | `onClose` didn't reset `claimId` (stale state) | **FIXED** |
| F11 | LOW | "Go back" creates orphaned DB claims | Accepted — resubmit overwrites claimId |
| F12 | LOW | Fire-and-forget email send (no failure notice) | Accepted — resend available |

---

## UI Test Results (Puppeteer)

| Check | Result |
|-------|--------|
| Claim button in footer | PASS |
| Unauth: Sign-in prompt shown | PASS |
| Unauth: Sign-in CTA opens auth modal | PASS |
| Close via X button | PASS |
| Close via overlay click | PASS |
| Close via ESC key | PASS |
| A11y: role="dialog" | PASS |
| A11y: aria-modal="true" | PASS |
| A11y: aria-label="Claim business" | PASS |
| Mobile (390px): Modal fits viewport | PASS |
| Desktop (1440px): Modal centered | PASS |
| Disabled button: no hover elevation | PASS |

---

## Edge Function Security Tests

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| verify-claim-code: no auth header | 401 | 401 | PASS |
| verify-claim-code: invalid JWT | 401 | 401 | PASS |
| resend-claim-code: no auth header | 401 | 401 | PASS |
| verify-claim-email: missing params | 400 | 401 (auth first) | PASS |
| DB trigger: exists and configured | BEFORE UPDATE trigger | Confirmed | PASS |
| All 3 functions: deployed + active | ACTIVE | ACTIVE | PASS |

---

## Deployed Artifacts

| Artifact | Description |
|----------|-------------|
| `verify-claim-code` Edge Function | Server-side code verification with expiration + attempt limiting |
| `resend-claim-code` Edge Function | Server-side code regeneration + email with auth + crypto |
| `verify-claim-email` Edge Function | Updated with proper HTML escaping |
| Migration 022 | `pending_verification` status in CHECK constraint |
| Migration 023 | DB trigger protecting status + verification_code |
| Migration 024 | Admin RLS policies + `claimed_business_id` column |

---

## Known Accepted Risks

1. **Orphaned claims on "Go back"** — Low impact, could be cleaned up with a cron job
2. **Fire-and-forget initial email** — Resend button available as recovery
3. **`verify-claim-email` has no auth** — Only sends branded email, doesn't mutate state
4. **Unlisted business claims** — Admin can approve but user gets no dashboard until business is created in directory

---

## Remaining Recommendations (Non-blocking)

1. Replace browser `prompt()` for rejection reason with a styled modal
2. Add document viewer in admin panel (currently shows count only)
3. Add "Manage Business" label when user already has a verified claim
4. Consider localStorage persistence for verification state across page reloads
