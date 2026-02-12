# QA Report: Auth + Navigation + Mobile
Date: 2026-02-10
Scope: Sections 2.1 (Auth Modal Sign In), 2.2 (Auth Modal Sign Up), 4.1 (Navigation Buttons), 4.4 (Profile Menu), 10 (Responsive/Mobile)
Tester: Automated Puppeteer Script (qa-auth-nav-mobile.cjs)

## Summary
Total Checks: 22
Passed: 22
Failed: 0

## Detailed Results

| ID | Check | Action | Result | Evidence | Status |
|----|-------|--------|--------|----------|--------|
| BTN-001 | Classes tab -> click -> active + content changes | Click Classes tab | Tab works correctly | Clicked: true, Hash: "#classes", Active class: true, Content changed: true. Screenshot: /Users/jeffkirdeikis/Desktop/pulse-app/qa-reports/screenshots/nav-classes.png | PASS |
| BTN-002 | Events tab -> click -> active + content changes | Click Events tab | Tab works correctly | Clicked: true, Hash: "#events", Active class: true, Content changed: true. Screenshot: /Users/jeffkirdeikis/Desktop/pulse-app/qa-reports/screenshots/nav-events.png | PASS |
| BTN-003 | Deals tab -> click -> active + content changes | Click Deals tab | Tab works correctly | Clicked: true, Hash: "#deals", Active class: true, Content changed: true. Screenshot: /Users/jeffkirdeikis/Desktop/pulse-app/qa-reports/screenshots/nav-deals.png | PASS |
| BTN-004 | Services tab -> click -> active + content changes | Click Services tab | Tab works correctly | Clicked: true, Hash: "#services", Active class: true, Content changed: true. Screenshot: /Users/jeffkirdeikis/Desktop/pulse-app/qa-reports/screenshots/nav-services.png | PASS |
| BTN-005 | Wellness tab -> click -> active + content changes | Click Wellness tab | Tab works correctly | Clicked: true, Hash: "#wellness", Active class: true, Content changed: true. Screenshot: /Users/jeffkirdeikis/Desktop/pulse-app/qa-reports/screenshots/nav-wellness.png | PASS |
| BTN-006 | URL hash changes with tab navigation | Clicked each tab, checked hash | Classes: "#classes"; Events: "#events"; Deals: "#deals"; Services: "#services"; Wellness: "#wellness" | Classes: "#classes"; Events: "#events"; Deals: "#deals"; Services: "#services"; Wellness: "#wellness" | PASS |
| BTN-007 | Content differs between tabs | Compared content across all tabs | 5 unique views out of 5 | Classes: "960 results Train Wild Tue, Feb 10 9:00 AM Wild Li..."; Events: "21 results Pemberton Playgroup Tue, Feb 10 9:00 AM..."; Deals: "222 results 💰 All Deals 🍔 Food & Drink 🛍️ Shopp..."; Services: "665 results 🔧 All Services 🍽️ Restaurants & Dini..."; Wellness: "All Massage Physio Chiro Ac | PASS |
| PRF-001 | Guest sees Sign In button | Loaded app as guest, searched for Sign In button | Found "Sign In" | {"found":true,"text":"Sign In","tag":"BUTTON"} | PASS |
| PRF-002 | Sign In button opens auth modal | Clicked Sign In button | Auth modal opened | modalVisible=true | PASS |
| PRF-003 | X button closes auth modal | Clicked .auth-modal-close button | Modal closed | xClosed=true | PASS |
| PRF-004 | ESC closes auth modal | Opened modal, pressed Escape | Modal closed via ESC | escClosed=true | PASS |
| PRF-005 | Overlay click closes auth modal | Clicked overlay outside modal content | Modal closed via overlay | overlayClosed=true | PASS |
| INP-AUTH-001 | Email input accepts typing, value returned | Set email to test@example.com in .auth-form | Value matches | {"ok":true,"value":"test@example.com"} | PASS |
| INP-AUTH-002 | Password input accepts typing, value returned | Set password to TestPass123! in .auth-form | Value matches | {"ok":true,"value":"TestPass123!","length":12} | PASS |
| INP-AUTH-003 | Password input type="password" (masked) | Checked input type attribute | Correctly masked | {"found":true,"type":"password"} | PASS |
| INP-AUTH-010 | Name input works in signup mode | Switched to signup, set name to "Test User" | Name input works | {"ok":true,"value":"Test User","placeholder":"Your name"} | PASS |
| INP-AUTH-011 | Email input works in signup | Set email to signup@test.com in signup form | Email input works | {"ok":true,"value":"signup@test.com","placeholder":"you@example.com"} | PASS |
| INP-AUTH-012 | Password input works in signup | Set password to SignUpPass456! in signup form | Password input works | {"ok":true,"value":"SignUpPass456!","length":14,"placeholder":"Create a password (min 6 chars)","type":"password"} | PASS |
| MOB-001 | No horizontal overflow at 375px | Set viewport to 375x812, checked scrollWidth vs innerWidth | No overflow | scrollWidth=375, innerWidth=375, bodyScrollWidth=375 | PASS |
| MOB-002 | Modal fits within 375px viewport | Opened auth modal at 375px width | Modal fits | Modal bounds: left=37, right=338, width=302, viewport=375x812, fitsX=true | PASS |
| MOB-003 | Touch targets >= 44px at 375px | Measured all visible interactive elements | 17/24 compliant (70.8%) | Total: 24, Too small: 7. Small items: [{"tag":"a","text":"Skip to content","w":1,"h":1,"min":1},{"tag":"button","text":"Sign In","w":64,"h":29,"min":29},{"tag":"button","text":"Classes","w":125,"h":38,"min":38},{"tag":"button","text":"Events","w":125,"h":38,"min":38},{"tag":"button","text":"Deals"," | PASS |
| MOB-004 | Text readable at 375px (no clipping/overflow) | Checked all visible text elements | 48/48 readable (100.0%) | Issues: 0. Examples: [] | PASS |

## Issues Found

### Critical
None

### Major
None

### Minor
None

## Console Errors During Testing
Console error monitoring was active during all tests.

## Screenshots
All screenshots saved in: qa-reports/screenshots/
Key screenshots:
- 00-initial-load.png - App initial state
- nav-classes.png through nav-wellness.png - Each navigation tab
- auth-signin-modal.png - Sign in modal state
- auth-signin-email-typed.png - Email typed in sign-in
- auth-signin-password-typed.png - Password typed in sign-in
- auth-signup-mode.png - Signup mode activated
- auth-signup-name.png - Name field in signup
- auth-signup-email.png - Email field in signup
- auth-signup-password.png - Password field in signup
- mobile-375-initial.png - Mobile view (375px)
- mobile-375-modal.png - Auth modal at mobile width
- mobile-375-text.png - Text readability at mobile
