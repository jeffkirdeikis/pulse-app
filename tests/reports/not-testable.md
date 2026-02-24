# Pulse App QA — Not Testable Features

**Test run:** 2026-02-23
**Total not-testable actions:** 55 NOT_BUILT + additional features requiring special conditions

This document lists every feature that could not be fully tested during this automated test run and explains why.

---

## Category 1: NOT_BUILT Features (55 Actions)

These features do not exist in the codebase yet. Attempting to test them would always fail.

### Account Setup (NOT_BUILT: 3)

| Action | Feature | Reason |
|--------|---------|--------|
| 9 | Social Links | No social links fields in EditVenueModal or any modal |
| 10 | Business Hours | No business hours editor built |
| — | Profile picture upload | No user profile picture upload outside of OAuth avatar |

### Listing Management (NOT_BUILT: 9)

| Action | Feature | Reason |
|--------|---------|--------|
| 13 | Gallery Images | No gallery image management UI built |
| 14 | Image Gallery Ordering | Drag-and-drop ordering not built |
| 15 | Image Moderation | Admin moderation queue for images not built |
| 17 | Booking Link | Booking URL field in listing form not built |
| 19 | Listing Expiry | Listings do not have expiry dates |
| 20 | Listing Visibility | Toggle to hide/show listing not built |
| 21 | Listing Preview | Preview-before-publish mode not built |
| 24 | Transfer Ownership | Ownership transfer workflow not built |
| — | Listing duplication | Clone listing feature not built |

### Deals / Promotions (NOT_BUILT: 5)

| Action | Feature | Reason |
|--------|---------|--------|
| 28 | Redemption Codes | Unique code generation per deal not built |
| 29 | Edit Deal | Edit button confirmed absent from deal rows in listings table (by design per test results) |
| 30 | Deal Analytics | Per-deal view/click analytics not built |
| 34 | Deal Sharing | Share to social / copy link feature not built |
| 35 | Deal Notifications | Push/email notifications when deal is about to expire not built |

### Events / Classes (NOT_BUILT: 4)

| Action | Feature | Reason |
|--------|---------|--------|
| 39 | Recurring Events | Backend support for recurring event series not built |
| 47 | Class Categories | Separate class category taxonomy not built |
| — | Event waitlist | Waitlist for full events not built |
| — | Ticket inventory | Ticket count/cap management not built |

### Booking / Appointments (NOT_BUILT: 6)

| Action | Feature | Reason |
|--------|---------|--------|
| 51 | Booking Confirmation | Confirmation email/screen after booking not built |
| 52 | Booking Calendar | Business-side calendar view of bookings not built |
| 54 | Booking Cancellation | Customer-initiated cancellation not built |
| 55 | Booking Reminders | Automated reminder emails not built |
| 56 | Waitlist | Booking waitlist not built |
| 57 | Booking History | Customer booking history view not built |

### Customer Interaction (NOT_BUILT: 7)

| Action | Feature | Reason |
|--------|---------|--------|
| 63 | Message Threads | Threaded messaging within Inbox not built |
| 64 | Inquiry Responses | Business response to customer inquiries not built |
| 65 | Auto-Replies | Automated response templates not built |
| 66 | Customer Saved/Favorites | Save/bookmark businesses not built |
| 67 | Follow Business | Follow/subscribe to business updates not built |
| 68 | Customer Loyalty | Points/rewards/loyalty program not built |
| — | Review moderation | Admin moderation of reviews not built |

### Analytics (NOT_BUILT: 4)

| Action | Feature | Reason |
|--------|---------|--------|
| 76 | Competitor Insights | Competitor benchmarking/comparison not built |
| — | Heatmap | User interaction heatmap not built |
| — | Funnel analytics | Conversion funnel tracking not built |
| — | Search term analytics | What users are searching for not built |

### Notifications / Settings (NOT_BUILT: 9)

| Action | Feature | Reason |
|--------|---------|--------|
| 79 | Push Notifications | Browser push notification system not built |
| 80 | Email Notifications | In-app email notification preferences not built |
| 81 | Notification Preferences | Granular notification controls not built |
| 83 | Password Change | In-settings password change not built (Supabase handles via email reset) |
| 84 | Account Deletion | Account deletion workflow not built |
| 85 | Two-Factor Auth | 2FA not built |
| 86 | API Key Management | Developer API key management not built |
| 87 | Data Export (User) | GDPR data export not built |
| 88 | GDPR / Privacy Controls | Privacy consent management not built |

### Community Engagement (NOT_BUILT: 7)

| Action | Feature | Reason |
|--------|---------|--------|
| 89 | Community Feed | General community activity feed not built |
| 90 | Post Creation | User posts/updates not built |
| 91 | Comments | Comment threads not built |
| 92 | Reactions / Likes | Emoji reactions not built |
| 94 | Business Spotlight | Featured business rotation not built |
| 95 | Referral Program | Referral tracking and rewards not built |
| 96 | Community Events | Community-organized events (non-business) not built |

### Admin / Advanced (NOT_BUILT: 1)

| Action | Feature | Reason |
|--------|---------|--------|
| 100 | System Config | Runtime system configuration panel not built |

---

## Category 2: Features Requiring External Services

These features exist in the app but cannot be tested in automated E2E tests because they depend on third-party services.

### Email Verification / Delivery

| Feature | Why Not Testable |
|---------|-----------------|
| Action 2: Email verification flow | Supabase sends verification email to real inbox; cannot intercept in Playwright without email testing service (e.g., Mailosaur, Mailtrap) |
| Action 83: Password reset email | Same — email sent to real inbox |
| Booking confirmation emails | Sent externally; cannot assert delivery |
| Deal expiry notification emails | Scheduled job on server; not triggerable in tests |

### Payment Processing

| Feature | Why Not Testable |
|---------|-----------------|
| Stripe payment flow | Requires Stripe test mode setup; no payment UI currently built |
| Subscription upgrade | Stripe subscription not wired to UI |
| Booking payment | Payment step not built |

### OAuth Providers

| Feature | Why Not Testable |
|---------|-----------------|
| Google OAuth signup/login | Cannot automate OAuth redirect flow without test Google account credentials injected into CI |
| Apple Sign-In | Same limitation; requires Apple developer account |

### External Booking Platforms

| Feature | Why Not Testable |
|---------|-----------------|
| Mindbody class booking | Live external booking system; cannot mock in E2E |
| WellnessLiving booking | Same |
| JaneApp booking | Same |

---

## Category 3: Features Requiring Specific Database State

These features exist but require specific records in Supabase that were not present during this test run.

### Requires Claimed Business

| Feature | What Is Needed | Why Not Available |
|---------|---------------|-------------------|
| Action 53: BusinessDashboard Booking Inbox | A Supabase user account with a `claimed_businesses` record | Test ran without authenticated user |
| Action 58: Booking Analytics in Dashboard | Same claimed business requirement | No test account with claimed business set up |
| Action 62: Business Inbox (messages) | Claimed business + at least one message in inbox | No seeded test data |
| Action 69-78: All Analytics metrics | Authenticated business owner with activity data | No auth in test run |
| Action 93: Weekly Goals / XP | Authenticated business owner | No auth in test run |

### Requires Test Account

| Feature | What Is Needed |
|---------|---------------|
| Logo upload (Action 3) | Logged-in business owner with upload permissions |
| Business category edit (Action 5) | Logged-in business owner, EditVenueModal accessible |
| Listing delete (Action 25) | Logged-in owner with existing listings |
| Deal delete (Action 31) | Logged-in owner with existing deals |
| Profile settings (Action 82) | Logged-in user |

### Requires Seeded Content

| Feature | What Is Needed |
|---------|---------------|
| Deal redemption count (Action 72) | Existing deal with at least one redemption in analytics table |
| Export report (Actions 77-78) | BusinessDashboard with analytics data populated |
| Booking history (Action 57) | At least one past booking in database |

---

## Category 4: Test Infrastructure Limitations

These features may exist in the app but tests failed due to test code issues, not app issues.

### Wrong Selector for Guest State

The majority of cross-cutting test failures (Actions in file `11-cross-cutting.spec.js`) are caused by this pattern:

```javascript
// WRONG: .profile-btn only appears when logged in
await page.waitForSelector('.profile-btn');

// CORRECT: Use .sign-in-btn for guest state
await page.waitForSelector('.sign-in-btn, .profile-btn');
```

**Affected tests:** 34 tests using `.profile-btn`, `.banner-tab`, or `.view-switcher` with incorrect assumptions about guest UI state.

### Wrong Selector for SubmissionModal Access

The SubmissionModal is only accessible to authenticated users. Tests in files 03-07 assumed the FeedbackWidget "Add Content" button would be visible in guest state:

```javascript
// WRONG: Assumes button visible to guests
await page.locator('button:has-text("Add Content")').click();

// ACTUAL BEHAVIOR: Guest sees login prompt instead
```

**Affected tests:** ~62 tests across Actions 26-48 that depend on SubmissionModal access.

### Strict Mode Violation

One test used `.toBeVisible()` on a selector that matched multiple elements:

```
Action 1-S: Validation errors shown for empty form submission
Locator: locator('.auth-field-error, .auth-error')
Error: strict mode violation — resolved to 2 elements
Fix: Use .first() or more specific selector
```

---

## Category 5: Features Requiring Manual Verification

These behaviors cannot be automatically verified and require human review.

| Feature | Why Manual Verification Needed |
|---------|-------------------------------|
| Visual design / branding accuracy | Automated tests can assert presence but not aesthetic correctness |
| Email template formatting | Cannot render HTML email in browser context |
| PDF report output quality | PDF generation requires visual inspection |
| Print stylesheet | Requires print preview mode |
| Screen reader / VoiceOver compatibility | Requires manual NVDA/VoiceOver testing |
| Touch gestures (swipe, pinch-zoom) | Playwright touch simulation is limited |
| Cross-browser visual regression | Only Chrome tested; Firefox/Safari/Edge not covered |
| Real device testing | Tests ran on simulated viewport; real device behaviour may differ |
| Localization / French Canadian | No i18n tests written |
| Dark mode | No dark mode tests written; app may not support dark mode |

---

## Summary

| Category | Count |
|----------|-------|
| NOT_BUILT features | 55 |
| Requires external service (email, payments, OAuth) | ~12 scenarios |
| Requires specific DB state (auth, claimed business, seeded data) | ~15 scenarios |
| Test infrastructure limitations (wrong selectors) | ~96 tests |
| Requires manual verification | ~10 areas |

**To unlock auth-gated tests:** Set up a dedicated test Supabase account with:
1. A verified email/password user
2. At least one claimed business record
3. Some existing deals, events, and bookings for analytics tests
4. Store credentials in `.env.test` and update tests to log in via API before running business dashboard tests
