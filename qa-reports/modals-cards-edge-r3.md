# QA Round 3: Modals, Cards, Edge Cases

**Date**: 2026-02-08
**Viewport**: 430x932 (mobile)
**Tester**: Automated Puppeteer + visual verification
**App URL**: http://localhost:5173/

---

## SUMMARY

| Metric | Count |
|--------|-------|
| Total Checks | 126 |
| Passes | 117 |
| Failures | 1 |
| Warnings | 8 |

---

## 1. CLASSES TAB - Card Interactions

[PASS] Found 5 class cards. First 3: Youth Boxing, Youth Jiu Jitsu, Community Class

### Class Card 1: "Youth Boxing"

[PASS] Modal opened for "Youth Boxing"
  Screenshot: /tmp/qa-r3-modal-class-1.png
[PASS] Title: "Youth Boxing"
[PASS] Venue: "The Sound Martial Arts"
[PASS] Date: "Sunday, February 8"
[PASS] Time: "5:00 PM - 6:00 PM"
[PASS] No "undefined" text in modal
[PASS] No "null" text in modal
[PASS] No "NaN" text in modal
[PASS] Duration: "60 min"
[PASS] Save button present
[PASS] Share button present
[PASS] Book button present (class)
[PASS] Directions button present
[PASS] Save click triggered auth prompt (unauthenticated user)
[PASS] Modal closed via ESC key

### Class Card 2: "Youth Jiu Jitsu"

[PASS] Modal opened for "Youth Jiu Jitsu"
  Screenshot: /tmp/qa-r3-modal-class-2.png
[PASS] Title: "Youth Jiu Jitsu"
[PASS] Venue: "The Sound Martial Arts"
[PASS] Date: "Sunday, February 8"
[PASS] Time: "5:10 PM - 6:10 PM"
[PASS] No "undefined" / "null" / "NaN" in modal
[PASS] Duration: "60 min"
[PASS] Save, Share, Book, Directions all present
[PASS] Save triggers auth prompt for guest user
[PASS] Modal closed via ESC key

### Class Card 3: "Community Class"

[PASS] Modal opened for "Community Class"
  Screenshot: /tmp/qa-r3-modal-class-3.png
[PASS] Title: "Community Class"
[PASS] Venue: "Shala Yoga"
[PASS] Date: "Sunday, February 8"
[PASS] Time: "5:30 PM - 6:30 PM"
[PASS] No "undefined" / "null" / "NaN" in modal
[PASS] Duration: "60 min"
[PASS] Save, Share, Book, Directions all present
[PASS] Save triggers auth prompt for guest user
[PASS] Modal closed via ESC key

**Visual confirmation**: Screenshot shows well-structured class modal with green hero, "CLASS" badge, venue with pin icon, date/time card, calendar add button, Book/Save/Share/Directions quick actions, Details section with Price/Age Group/Venue/Duration, About section, and Book Class CTA at bottom.

---

## 2. EVENTS TAB - Card Interactions

[PASS] Navigated to Events tab
  Screenshot: /tmp/qa-r3-events-tab.png

### Event Card 1: "StrongStart BC Program"

[PASS] Modal opened
  Screenshot: /tmp/qa-r3-modal-event-1.png
[PASS] Title: "StrongStart BC Program"
[PASS] Venue: "Sea to Sky Community Services"
[PASS] Date: "Monday, February 9"
[PASS] Time: "9:00 AM" (single time, no end time in data)
[PASS] Duration: "See details" (acceptable -- start == end time, code shows `mins > 0 ? X min : 'See details'`)
[PASS] No "undefined" / "null" / "NaN"
[PASS] EVENT type badge shown (purple)
[PASS] Modal closed via X button

### Event Card 2: "How to Craft Canadian Style Resume and Cover Letter"

[PASS] Modal opened
  Screenshot: /tmp/qa-r3-modal-event-2.png
[PASS] Title correct (long title displayed fully)
[PASS] Venue: "Online"
[PASS] Date: "Monday, February 9"
[PASS] Time: "10:30 AM - 11:30 AM"
[PASS] Duration: "60 min"
[PASS] Modal closed via X button

### Event Card 3: "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games"

[PASS] Modal opened
  Screenshot: /tmp/qa-r3-modal-event-3.png
[PASS] Title correct (very long title displayed without overflow)
[PASS] Venue: "Arrow Wood Games"
[PASS] Date: "Monday, February 9"
[PASS] Time: "6:00 PM - 7:00 PM"
[PASS] Duration: "60 min"
[PASS] Modal closed via X button

**Duration audit (5 events)**:
- StrongStart BC Program: "See details" (no end time)
- How to Craft Canadian Style Resume: "60 min"
- Magic: The Gathering: "60 min"
- Pemberton Playgroup: "See details" (no end time)
- BUSINESS ESSENTIALS: "60 min"

**Verdict**: No "0 min" duration found. "See details" shown correctly for events that only have a start time.

---

## 3. DEALS TAB - Card Interactions

[PASS] Navigated to Deals tab
  Screenshot: /tmp/qa-r3-deals-tab.png
[PASS] Found 222 deal cards total

### Deal Card 1: "Buy One Get One Free"

[PASS] Deal modal opened
  Screenshot: /tmp/qa-r3-modal-deal-1.png
[PASS] Business: "Crankpots Ceramic Studio"
[PASS] Description: "Crankpots Ceramic Studio presents: Buy One Get One Free. Save 50% off!..."
[PASS] Terms: "Valid for new customers only."
[PASS] "More from Crankpots Ceramic Studio" section with 3 related deals
[PASS] Save, Share, Directions quick actions present
[PASS] Redeem Deal and View Location CTA buttons present
[FAIL] Schedule field EMPTY -- "AVAILABLE" label shows but no schedule value; "SCHEDULE" detail card also empty
[PASS] Modal closed via overlay click

### Deal Card 2: "Buy one get one 50% OFF"

[PASS] Deal modal opened
  Screenshot: /tmp/qa-r3-modal-deal-2.png
[PASS] Business: "Marks Work Wearhouse"
[PASS] Description present
[WARN] Terms shows "N/A"
[FAIL] Schedule field EMPTY (same as Deal 1)
[PASS] Modal closed via overlay click

### Deal Card 3: "4-Class Drop-In Pass"

[PASS] Deal modal opened
[PASS] Business: "Breathe Fitness Studio"
[PASS] Description present with savings info
[FAIL] Schedule field EMPTY
[PASS] Modal closed via overlay click

**Deal savings badge audit (222 deals total)**:
- 215/222 deals (97%) have a savings badge on the card
- 7 deals without badge are fixed-price items (e.g., "All veggie burritos $12", "Nachos $16")
- 0/222 deals have schedule data populated

**Verdict on schedule**: The `schedule` field is empty for ALL 222 deals. This is a **data issue** -- the deals table `schedule` column is unpopulated across the board.

---

## 4. MODAL CLOSE METHODS

### 4a. Close via X button

[PASS] Clicked `.close-btn.event-close` -> Modal closed immediately

### 4b. Close via overlay click

[PASS] Clicked at coordinates (215, 30) on overlay above the modal (modal starts at y=75) -> Modal closed
  Note: Initial automated test using `dispatchEvent` failed due to event propagation behavior. Follow-up test using `page.mouse.click()` at actual coordinates in the overlay gap succeeded. The overlay's `onClick={() => setSelectedEvent(null)}` works correctly.

### 4c. Close via ESC key

[PASS] Pressed Escape -> Modal closed. Global ESC handler in `useEffect` closes all modals.

### 4d. Page interactive after modal close

[PASS] Page scrollable after modal close
[PASS] Tab buttons remain interactive after modal close

---

## 5. WELLNESS BOOKING SHEET

[PASS] Navigated to Wellness tab
  Screenshot: /tmp/qa-r3-wellness-tab.png, /tmp/qa-r3-wellness-booking-sheet.png

[PASS] Discipline filters present (All, Massage, Physio, Chiro, Acupuncture)
[PASS] Date selector with 14 days and slot count badges
[PASS] Timeline/Provider view toggle present
[PASS] 63 time slots found on first available date (Monday, Feb 9)

### Slot click -> Booking sheet

[PASS] Clicked `.wb-slot-card` -> Booking bottom sheet (`.wb-sheet`) opened
[PASS] Provider name: "Dr. Thea Lanoue"
[PASS] Clinic: "The Wellness Room"
[PASS] Date shown: "Monday, February 9"
[PASS] Time shown: "8:30 AM - 45 minutes"
[PASS] "Book Now" button present (blue, styled)
[PASS] "View Profile" button present
[PASS] Close (X) button present
[PASS] Disclaimer text: "Opens The Wellness Room's booking page in a new tab"

### Booking sheet close methods

[PASS] Close via X button -> Sheet closed
[PASS] Close via ESC key -> Sheet closed (has its own ESC handler)
[PASS] Close via backdrop click -> Sheet closed

**Visual confirmation**: Booking sheet slides up from bottom with provider avatar (initials), name, clinic name, date/time/duration details, and two action buttons (Book Now + View Profile). Well-structured and functional.

---

## 6. EDGE CASES

### 6a. Rapid double-click on card

[PASS] Double-clicked a card rapidly -> Only 1 modal opened (no duplicates)
  Screenshot: /tmp/qa-r3-edge-doubleclick.png
  React state `setSelectedEvent()` replaces value, preventing duplicate modals.

### 6b. Scroll position preservation

[PASS] Scrolled to y=800, opened modal, closed modal -> Scroll position preserved at y=800 (diff: 0)

### 6c. Empty state (search for "zzzxxx")

[PASS] Searched for "zzzxxx" -> "0 results" shown
[PASS] Empty state message: "No classes found matching your filters." with "Clear Filters" button
  Screenshot: /tmp/qa-r3-edge-empty-search.png

### 6d. Impossible filter combination

[PASS] Applied restrictive filters (day=anytime, age=adults, price=free) -> "0 results" shown correctly
  Screenshot: /tmp/qa-r3-edge-impossible-filter.png

### 6e. Multiple filters then Reset

[PASS] Baseline: "953 results"
[PASS] After 3 active filters: "0 results"
[PASS] Reset button visible with active filters
[PASS] After Reset click: "953 results" (baseline restored)
[PASS] Reset button disappears after reset (no active filters)
  Screenshot: /tmp/qa-r3-edge-after-reset.png
  Visual: All 5 dropdowns show defaults (Upcoming, All Times, All Ages, All Categories, All Prices)

### 6f. Tab switching with filters

[PASS] Applied "Adults" filter on Classes -> switched to Events -> switched back to Classes
[PASS] Age filter PRESERVED across tab switches (remained "adults")
  Note: `setCurrentSection()` only resets `category` to 'all', preserving age/time/day/price. This is consistent -- each tab shares filters but has different categories.

### 6g. Long content / text overflow

[PASS] No text overflow in first 10 class cards (of 953 total)
[PASS] No text overflow detected in modal elements
[PASS] Long title "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" wraps correctly

---

## CONSOLE ERRORS

[PASS] No console errors during entire test run (no ReferenceError, TypeError, SyntaxError, or other critical errors)

---

## ISSUES FOUND

### Critical Issues

None.

### Major Issues

**ISSUE M1: Deal schedule field empty for ALL 222 deals**
- **Severity**: Major (data quality)
- **Location**: Deal detail modal -- "AVAILABLE" section and "SCHEDULE" detail card
- **Description**: The `schedule` field is empty/null for all 222 deals. The modal renders "AVAILABLE" label with no value below it, and "SCHEDULE" detail card with empty value. Visually it looks broken -- just a label with blank space.
- **Root cause**: The `schedule` column in the deals table is unpopulated for all records.
- **Impact**: Users cannot see when deals are available (e.g., "Daily", "Weekends only", "Mon-Fri 11am-2pm").
- **Screenshot**: /tmp/qa-r3-modal-deal-1.png -- visible as "AVAILABLE" with blank space, "SCHEDULE" with blank space
- **Recommendation**: Either populate the schedule field via scrapers/manual entry, or hide the Schedule section when the field is empty.

### Minor Issues

None.

### Warnings

**W1**: 7/222 deals lack savings badge -- these are fixed-price menu items (e.g., "$12 burritos", "$16 nachos"), not discount-type deals, so no badge is expected.

**W2**: 2/5 sampled events show "See details" for duration when only a start time exists (no end time). This is correct code behavior but could be improved by displaying just the start time without a duration section.

**W3**: Deal Terms shows "N/A" for some deals (Marks Work Wearhouse). Consider hiding the Terms section when value is "N/A".

---

## SCREENSHOTS INDEX

| Screenshot | Content |
|-----------|---------|
| /tmp/qa-r3-modal-class-1.png | Class modal: Youth Boxing |
| /tmp/qa-r3-modal-class-2.png | Class modal: Youth Jiu Jitsu |
| /tmp/qa-r3-modal-class-3.png | Class modal: Community Class |
| /tmp/qa-r3-events-tab.png | Events tab view |
| /tmp/qa-r3-modal-event-1.png | Event modal: StrongStart BC Program |
| /tmp/qa-r3-modal-event-2.png | Event modal: Resume and Cover Letter |
| /tmp/qa-r3-modal-event-3.png | Event modal: Magic The Gathering |
| /tmp/qa-r3-deals-tab.png | Deals tab view |
| /tmp/qa-r3-modal-deal-1.png | Deal modal: Buy One Get One Free |
| /tmp/qa-r3-modal-deal-2.png | Deal modal: Buy one get one 50% OFF |
| /tmp/qa-r3-modal-deal-3.png | Deal modal: 4-Class Drop-In Pass |
| /tmp/qa-r3-edge-doubleclick.png | Double-click test (single modal) |
| /tmp/qa-r3-edge-empty-search.png | Empty search "zzzxxx" |
| /tmp/qa-r3-edge-impossible-filter.png | Impossible filter combo |
| /tmp/qa-r3-edge-after-reset.png | After filter reset (953 results) |
| /tmp/qa-r3-wellness-tab.png | Wellness tab with 63 slots |
| /tmp/qa-r3-wellness-booking-sheet.png | Wellness booking bottom sheet |
| /tmp/qa-r3-wellness-slot-clicked.png | Wellness after slot click |
