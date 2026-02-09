# PULSE QA REPORT -- Auth, Navigation, Mobile Responsiveness (Round 3)

**Date**: 2026-02-08
**Tester**: Claude (Puppeteer automated + visual screenshot verification)
**App URL**: http://localhost:5173
**Viewports tested**: 375px (mobile), 430px (default), 768px (tablet), 1440px (desktop)

## Summary
- **Total checks performed**: 45
- **Passes**: 38
- **Failures**: 3
- **Warnings**: 4
- **Blocked**: 0

---

## Critical Failures (must fix)

### 1. [Navigation] Sticky Header Does Not Stick
- **Element**: `<header class="app-header-premium">` with `position: sticky; z-index: 100`
- **Action**: Scroll down 200px, 500px, 1000px
- **Expected**: Header stays visible at top while scrolling
- **Actual**: Header scrolls away with content. At 200px scroll, header is at `top: -200px`. At 500px scroll, header is at `top: -500px`. The `position: sticky` is set but is NOT functioning -- the header is treated as static. This is likely because the parent container has `overflow` set (which breaks sticky positioning) or the header is not a direct child of the scroll container.
- **Screenshot**: `/tmp/qa-r3-deep-sticky-header-scroll500.png` -- after 500px scroll, PULSE header is completely gone.
- **Impact**: Users lose access to navigation tabs and search when scrolling through results.

### 2. [Mobile 375px] Consumer/Business Toggle Obscures Card Content
- **Element**: `div.view-switcher` (position: fixed, bottom of viewport)
- **Action**: Load Classes tab at 375px width
- **Expected**: Toggle does not obstruct readable content
- **Actual**: The Consumer/Business toggle is `position: fixed` at bottom (top: 746px, bottom: 792px in 812px viewport). It obscures 2 event cards underneath it. Combined with the FAB (+) button at bottom-right, the last ~66px of the viewport is partially blocked. Card titles are cut off (e.g., "Hot H..." truncated by toggle).
- **Screenshot**: `/tmp/qa-r3-deep-toggle-375px.png`
- **Impact**: Users cannot read content behind the fixed bottom bar without scrolling past it.

### 3. [Mobile 375px] "See studio for pricing" Tag Truncated
- **Element**: Orange price tag on every class card
- **Action**: View class cards at 375px viewport
- **Expected**: All card content fully readable
- **Actual**: "See studio for pricing" is truncated to "See studio for pri..." because the Book button and the tag compete for horizontal space. Occurs on every single class card (953 cards affected).
- **Screenshot**: `/tmp/qa-r3-mobile-01-375px.png`, `/tmp/qa-r3-mobile-02-filters.png`
- **Impact**: Users cannot read the full pricing information on mobile.

---

## Minor Issues (fix when possible)

1. **[Desktop 1440px] App renders as narrow ~420px centered column** -- Known limitation per CLAUDE.md. App is mobile-first, renders as a centered narrow column on desktop with large dark areas on both sides. The Consumer/Business toggle floats far from content in top-right corner.

2. **[Tablet 768px] Content only uses 55% of viewport** -- At 768px, the app content column is about 420px, leaving ~45% whitespace.

---

## Warnings

1. **[Auth] Empty form submit uses browser-native validation only** -- Clicking "Sign In" with empty fields triggers browser's native "Please fill out this field" tooltip. Both inputs have `required` attribute. Works correctly but uses browser-default styling rather than custom app-styled validation.
   - Screenshot: `/tmp/qa-r3-deep-empty-submit.png`

2. **[Desktop] Consumer/Business toggle far from content** -- At 1440px, toggle is in top-right corner while content is in left ~420px column. Users may not discover it.

3. **[Mobile 375px] FAB + Toggle compete for bottom space** -- Both the FAB (+) button and Consumer/Business toggle are fixed at the bottom of the viewport at 375px. They don't directly overlap each other but together occupy a significant chunk of the bottom area.

4. **[Tablet] Layout underutilizes viewport** -- At 768px, could show a wider layout but remains at ~420px column width.

---

## Detailed Results

### PHASE 1: AUTH FLOW TESTS (14 checks)

| # | Status | Element | Action | Expected | Actual |
|---|--------|---------|--------|----------|--------|
| 1 | PASS | App Load | Load app fresh | App renders | Loaded without error boundary, no blank screen |
| 2 | PASS | Console Errors | Check on load | No critical errors | Zero console errors on initial load |
| 3 | PASS | Sign In Button (Guest) | Check visibility | Visible for guest | "Sign In" button at top-right, clearly visible |
| 4 | PASS | Auth Modal | Click Sign In | Modal opens | "Welcome Back" modal with Google OAuth + email/password fields |
| 5 | PASS | Email Input | Type test@example.com | Text visible | Value: "test@example.com", color: rgb(31,41,55) on rgb(255,255,255) -- good contrast |
| 6 | PASS | Password Input | Type TestPass123! | Password accepted | 12 masked characters shown |
| 7 | PASS | Sign Up Toggle | Click "Sign Up" link | Switch to signup mode | Switches to "Create Account" with Full Name / Email / Password (min 6 chars) fields |
| 8 | PASS | Empty Submit | Submit empty form | Validation shown | Browser-native "Please fill out this field" on required email input |
| 9 | PASS | Close Modal (X) | Click X button | Modal closes | Closed successfully |
| 10 | PASS | Close Modal (ESC) | Press Escape | Modal closes | Closed successfully |
| 11 | PASS | Close Modal (Overlay) | Click outside | Modal closes | Closed successfully |
| 12 | PASS | FAB Button (Guest) | Click + button | Auth prompt | Auth modal opened (correct guest behavior) |
| 13 | PASS | Google OAuth | Visual check | Button present | "Continue with Google" with G icon visible |
| 14 | PASS | ToS/Privacy | Visual check | Text present | "By continuing, you agree to our Terms of Service and Privacy Policy" shown |

### PHASE 2: NAVIGATION TESTS (13 checks)

| # | Status | Element | Action | Expected | Actual |
|---|--------|---------|--------|----------|--------|
| 15 | PASS | Classes Tab | Click | Content + hash | 953 results, hash=#classes, blue underline active indicator |
| 16 | PASS | Events Tab | Click | Content + hash | 24 results, hash=#events, blue border active indicator |
| 17 | PASS | Deals Tab | Click | Content + hash | 222 results, hash=#deals, "All Deals" dropdown visible |
| 18 | PASS | Services Tab | Click | Content + hash | 665 results, hash=#services, ratings visible |
| 19 | PASS | Wellness Tab | Click | Content + hash | Booking UI with day picker + timeline, hash=#wellness |
| 20 | PASS | Browser Back | Classes->Events->Deals, Back x2 | Return to Classes | hash=#classes after 2 backs, content present |
| 21 | PASS | Browser Forward | Forward after back | Navigate forward | Content present, hash updated |
| 22 | PASS | Direct URL | Navigate to /#events | Events loads | Events content loaded directly, 24 results shown |
| 23 | FAIL | Sticky Header | Scroll 500px | Header stays at top | Header at -500px (scrolled away). position:sticky not functioning |
| 24 | PASS | Business Toggle | Click Business | Auth prompt or biz view | Auth prompt shown (correct for guest) |
| 25 | PASS | Consumer Return | Click Consumer | Returns to consumer | Consumer view restored with class listings |
| 26 | PASS | Tab Content Distinct | Compare tab content | Each tab shows different data | Classes=953, Events=24, Deals=222, Services=665, Wellness=booking |
| 27 | PASS | Active Tab Visual | Check highlighting | Active tab distinguishable | Active tab has blue underline/border, clear distinction |

### PHASE 3: MOBILE RESPONSIVE TESTS -- 375px (10 checks)

| # | Status | Element | Action | Expected | Actual |
|---|--------|---------|--------|----------|--------|
| 28 | PASS | Horizontal Overflow | scrollWidth vs innerWidth | No overflow | scrollWidth=375, innerWidth=375 |
| 29 | PASS | Tab Bar | Check all tabs | All visible/readable | 5 tabs within viewport, all fully readable |
| 30 | PASS | Filter Dropdowns | Check visibility | Not truncated | 2 filter elements within viewport |
| 31 | PASS | Cards Boundary | Check card bounds | Cards within 375px | All cards within viewport |
| 32 | PASS | Auth Modal Fit | Open at 375px | Fits viewport | Modal width 375px, all inputs visible |
| 33 | FAIL | Toggle Overlap | Check toggle | No content obscured | Fixed toggle at bottom overlaps 2 cards, text truncated |
| 34 | FAIL | Price Tag | Check "See studio for pricing" | Fully readable | Truncated to "See studio for pri..." on all class cards |
| 35 | PASS | Search (Classes) | Type in search | Text visible | width=355px, fits viewport, dark text visible |
| 36 | PASS | Search (Events) | Type in search | Text visible | width=355px, fits viewport |
| 37 | PASS | Search (Deals) | Type in search | Text visible | width=355px, fits viewport |

### PHASE 4: TABLET TESTS -- 768px (3 checks)

| # | Status | Element | Action | Expected | Actual |
|---|--------|---------|--------|----------|--------|
| 38 | PASS | No Overflow | Horizontal check | No scrollbar | scrollWidth=768 |
| 39 | WARN | Layout Width | Content vs viewport | Reasonable usage | Content uses 55% (420px/768px) -- underutilized |
| 40 | PASS | Filter Readability | Font size check | >= 12px | All filters readable |

### PHASE 5: DESKTOP TESTS -- 1440px (5 checks)

| # | Status | Element | Action | Expected | Actual |
|---|--------|---------|--------|----------|--------|
| 41 | PASS | No Overflow | Horizontal check | No scrollbar | scrollWidth=1440 |
| 42 | WARN | Layout | Content width | Desktop layout | ~420px column (known limitation) |
| 43 | PASS | Text Readability | Font sizes | Not stretched | 6690 elements, all reasonable sizes |
| 44 | WARN | Toggle Position | Visual check | Near content | Toggle in top-right corner, far from left-aligned content |
| 45 | PASS | FAB Position | Visual check | Accessible | FAB (+) button at bottom-right, accessible |

---

## Screenshots Reference

| File | Description |
|------|-------------|
| `/tmp/qa-r3-auth-01-initial-load.png` | Initial app load -- Classes tab, 953 results |
| `/tmp/qa-r3-auth-03-after-signin-click.png` | Auth modal -- "Welcome Back" with Google OAuth |
| `/tmp/qa-r3-auth-06-email-typed.png` | Email typed with good contrast |
| `/tmp/qa-r3-deep-signup-after-click.png` | Create Account mode -- Full Name/Email/Password |
| `/tmp/qa-r3-deep-empty-submit.png` | Empty submit -- browser validation tooltip |
| `/tmp/qa-r3-auth-10-fab-guest.png` | FAB guest click -- auth modal shown |
| `/tmp/qa-r3-nav-02-tab-events.png` | Events tab -- 24 results |
| `/tmp/qa-r3-nav-02-tab-deals.png` | Deals tab -- 222 results with discount badges |
| `/tmp/qa-r3-nav-02-tab-services.png` | Services tab -- 665 results with star ratings |
| `/tmp/qa-r3-nav-02-tab-wellness.png` | Wellness tab -- booking timeline interface |
| `/tmp/qa-r3-deep-sticky-header-scroll500.png` | **BUG**: Header gone after scrolling |
| `/tmp/qa-r3-mobile-01-375px.png` | **BUG**: Price tag truncated at 375px |
| `/tmp/qa-r3-deep-toggle-375px.png` | **BUG**: Toggle overlapping card content |
| `/tmp/qa-r3-mobile-03-modal.png` | Mobile modal -- fits 375px correctly |
| `/tmp/qa-r3-tablet-01-768px.png` | Tablet -- narrow column with whitespace |
| `/tmp/qa-r3-desktop-01-1440px.png` | Desktop -- narrow column, dark background |
