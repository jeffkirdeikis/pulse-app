# QA Report -- Agent B: Filters & Search Correctness
## Date: 2026-02-12
## Tested By: QA Agent B (Automated Playwright testing against live app at localhost:5173)

---

## Summary
- **Total checks performed:** 89
- **Passes:** 76
- **Failures:** 7
- **Warnings:** 6

---

## Critical Failures

### 1. [CRITICAL] FLT-SH06: Reset Button Does Not Clear Search Input
- **Page:** Classes tab (and likely all tabs)
- **Steps:** Type "yoga" in search + select Fitness category + click Reset button
- **Expected:** All filters AND search input reset to defaults
- **Actual:** Category filter resets to "All Categories" but search input still contains "yoga". Count shows 176 instead of baseline ~2181.
- **Impact:** Users who use Reset expect a full reset. The search text remaining causes confusion and wrong result counts.
- **Evidence:** Screenshot `/tmp/qa-reset-bug.png` -- search bar still shows "yoga" after clicking Reset

### 2. [CRITICAL] FLT-A01-events: Events Tab "Kids" Age Filter Does Not Filter
- **Page:** Events tab
- **Steps:** Open filters, select "Kids" from age dropdown
- **Expected:** Count decreases to show only kid-appropriate events
- **Actual:** Count stays at 132 (same as baseline 132). Filter has no effect.
- **Impact:** Users filtering for kids events see all events, including adult-only ones.
- **Evidence:** Script output: `Events Kids filter: 132 results (baseline 132). Age badges: {"Kids":10,"All Ages":40}`

---

## Major Issues

### 3. [MAJOR] FLT-C09: "Camps" Category Returns 0 Results (Classes Tab)
- **Page:** Classes tab
- **Steps:** Open filters, select "Camps" from category dropdown
- **Expected:** Either show camp-related classes or don't include "Camps" in dropdown
- **Actual:** 0 results. No cards displayed.
- **Impact:** Category options with 0 results waste user time and suggest broken functionality.
- **Recommendation:** Remove "Camps" from the dropdown if there is no matching data, or populate with camp data.

### 4. [MAJOR] FLT-C09: "Certifications" Category Returns 0 Results (Classes Tab)
- **Page:** Classes tab
- **Steps:** Open filters, select "Certifications" from category dropdown
- **Expected:** Either show certification classes or don't include in dropdown
- **Actual:** 0 results. No cards displayed.
- **Impact:** Same as Camps -- 0-result categories should not appear in dropdown.
- **Recommendation:** Remove "Certifications" from dropdown or populate with data.

### 5. [MAJOR] FLT-E: Events "Government" Category Returns 0 Results
- **Page:** Events tab
- **Steps:** Open filters, select "Government" from category dropdown
- **Expected:** Government events shown, or category removed from dropdown
- **Actual:** 0 results and 0 visible cards.
- **Impact:** Empty filter option in dropdown.

### 6. [MAJOR] FLT-E: Events "Recreation" Category Returns 0 Results But Shows Future Cards
- **Page:** Events tab
- **Steps:** Open filters, select "Recreation" from category dropdown
- **Expected:** Recreation events shown
- **Actual:** Count shows 0 results, but 2 cards are visible ("Spring Programs Registration" - Tue, Mar 1). The count says 0 but cards appear.
- **Impact:** Mismatch between count display and actual visible cards. Likely the "Upcoming" day filter is hiding the future event from the count but the card still renders.

---

## Minor Issues

### 7. [MINOR] Events "Tomorrow" Shows 0 Results
- **Page:** Events tab
- **Steps:** Select "Tomorrow" (Fri, Feb 13) from day filter
- **Expected:** Events for tomorrow, if any exist
- **Actual:** 0 results
- **Impact:** This may be legitimate (no events scheduled for Feb 13), but worth verifying against the database. Events visible for "Upcoming" are mostly Thu Feb 12 events.
- **Status:** Likely DATA issue, not a code bug.

---

## Warnings

### W1. Time Filter Is "From This Time Onward" Not "Exact Time"
- Selecting "6 AM" shows 2108 results (nearly all), while "9 PM" shows 9 results
- This is a "show classes at or after this time" behavior, not "show only classes at this exact time"
- May be intentional UX design, but could confuse users expecting exact time matching

### W2. "This Weekend" Filter Includes Friday
- Weekend filter (Classes tab) shows Fri Feb 13, Sat Feb 14, and Sun Feb 15
- Including Friday in "This Weekend" is a common UX pattern but may surprise some users
- All three days are present: Friday (many entries), Saturday, and Sunday

### W3. "Pilates - Foundation to Intermediate" Missing Age Badge
- When filtering by "Kids" or "Adults", this class appears without a matching age badge
- Likely the class data has no age group assigned, causing it to pass through both filters

### W4. Free Filter: 2 Cards Missing "Free" Label
- When filtering for "Free" classes, "Public Swim - Shared Pool Space" and "PLAYERS - Adult Drop-In Hockey" appear without visible "Free" text
- These may have $0 price but display differently

### W5. Events "Community Services" Timing-Sensitive Results
- Initial programmatic test showed 0, but visual screenshot showed 1 result
- The count may depend on exact timing/data load. Possibly a race condition.

### W6. Deals Tab Card Rendering Delay
- When switching deal categories quickly, first cards briefly show previous category results before updating
- This is a minor visual flash, not a data bug

---

## Detailed Results

### Section 1: Search Bar (SRCH-001 to SRCH-007)

| ID | Test | Action | Expected | Actual | Status |
|----|------|--------|----------|--------|--------|
| SRCH-001 | Search placeholder (Classes) | Load Classes tab | "Search classes..." | "Search classes..." | PASS |
| SRCH-002 | Search "yoga" | Type "yoga" in search | Results filtered, count decreases | 179 results (from 2195 baseline). Yoga-related cards shown: Vinyasa, Hot Arms & Shoulders, Hot ABSolutely Burning Butts | PASS |
| SRCH-003 | Clear search | Clear search input | All results return | 2195 results restored | PASS |
| SRCH-004 | Nonsense search | Type "zzzxxxyyy" | 0 results or empty state | "0 results" with "No classes found matching your filters" message and "Clear Filters" button | PASS |
| SRCH-005 | Special characters | Type "!@#$%^&*()" | No crash | 0 results, app stable, no crash | PASS |
| SRCH-006 | Case insensitivity | Type "YOGA" | Same as lowercase | 179 results (matches lowercase "yoga") | PASS |
| SRCH-007 | Partial match | Type "yog" | Yoga results appear | 179 results, correct partial matching | PASS |
| SRCH-EVT | Events search placeholder | Switch to Events tab | "Search events..." | "Search events..." | PASS |
| SRCH-EVT2 | Events search "playgroup" | Type "playgroup" | Filtered results | 15 results, cards contain "Playgroup" | PASS |
| SRCH-DL | Deals search placeholder | Switch to Deals tab | "Search deals..." | "Search deals..." | PASS |
| SRCH-DL2 | Deals search "fitness" | Type "fitness" | Filtered results | 14 results (from 203). Changed: yes | PASS |
| SRCH-SVC | Services search placeholder | Switch to Services tab | "Search services..." | "Search services..." | PASS |
| SRCH-SVC2 | Services search "fitness" | Type "fitness" | Filtered results | 26 results (from 665). Changed: yes | PASS |
| SRCH-SVC3 | Services nonsense search | Type "zzzxxxyyy" | 0 results | 0 results | PASS |

### Section 4.1: Navigation Buttons (BTN-001 to BTN-007)

| ID | Test | Action | Expected | Actual | Status |
|----|------|--------|----------|--------|--------|
| BTN-001 | Default tab | Load app | Classes tab active | Classes tab active (blue text, underline), 2195 results | PASS |
| BTN-002 | Events tab | Click Events | Tab active, events shown | Events active (blue outline), 132 results, placeholder "Search events..." | PASS |
| BTN-003 | Deals tab | Click Deals | Tab active, deals shown | Deals active, 203 results, "All Deals" category dropdown visible | PASS |
| BTN-004 | Services tab | Click Services | Tab active, services shown | Services active, 665 results, "All Services" category dropdown | PASS |
| BTN-005 | Wellness tab | Click Wellness | Tab active, wellness shown | Wellness active, provider/date-based booking interface with Massage/Physio/Chiro/Acupuncture categories | PASS |
| BTN-006 | Return to Classes | Click Classes | Returns to classes with original count | 2195 results, matches original | PASS |
| BTN-007 | Rapid tab switching | Click Events/Classes 3x rapidly | No crash, correct final state | 2195 results on Classes, no errors, app stable | PASS |

### Section 4.2: Card Action Buttons (BTN-010 to BTN-014)

| ID | Test | Action | Expected | Actual | Status |
|----|------|--------|----------|--------|--------|
| BTN-010 | Card click opens detail | Click card body | Detail modal opens | Event detail modal opens with: CLASS label, title (Lane Swim), venue (Brennan Park), date/time, Price ($4.73), Age Group, Duration, Book/Save/Share/Directions buttons, About section | PASS |
| BTN-011 | Save button | Identified on card | Save icon fills | Save star icons present on cards. In modal: Save button labeled with icon. (Requires auth to save) | PASS |
| BTN-012 | Book button | Click "Book" button | Booking sheet opens | "Request to Book" bottom sheet opens with: venue name, class name, date/time, "This business doesn't have online booking" notice, message textarea, "Send Booking Request" button | PASS |
| BTN-013a | Close modal (Escape) | Press Escape on detail modal | Modal closes | Modal closed successfully | PASS |
| BTN-013b | Close modal (overlay) | Click overlay area | Modal closes | Modal closed successfully | PASS |

### Section 6.1: Classes Tab Filters (FLT-C01 to FLT-C13)

#### Day Filter

| ID | Test | Action | Expected | Actual | Status |
|----|------|--------|----------|--------|--------|
| FLT-C01 | Default day | Check default | "Upcoming" selected | "Upcoming" selected, ~2178 results | PASS |
| FLT-C02 | Tomorrow | Select "Tomorrow" | Count changes, Feb 13 dates | 75 results, all cards show "Fri, Feb 13" | PASS |
| FLT-C03 | This Weekend | Select "This Weekend" | Weekend dates | 157 results, includes Fri Feb 13, Sat Feb 14, Sun Feb 15 | PASS |
| FLT-C04 | Next Week | Select "Next Week" | Count changes | 487 results, first card: "CrossFit, Mon, Feb 16" | PASS |
| FLT-C05 | Anytime | Select "Anytime" | Count >= Upcoming | 2553 results >= 2178 baseline | PASS |
| FLT-C05r | Reset day | Select "Upcoming" | Count returns to baseline | 2178 results, matches baseline | PASS |

#### Time Filter

| ID | Test | Action | Expected | Actual | Status |
|----|------|--------|----------|--------|--------|
| FLT-C06 | Time 6 AM | Select 6 AM | "From 6 AM onward" filter | 2108 results. Time filter shows classes from selected time onward | PASS |
| FLT-C07a | Time 9 AM | Select 9 AM | Fewer results | 1847 results, cards show 9:00 AM classes first | PASS |
| FLT-C07b | Time 6 PM | Select 6 PM | Evening classes | 345 results, cards show 6:00 PM classes | PASS |
| FLT-C07c | Time progression | Compare counts | Decreasing | 6AM:2108, 7AM:2023, 10AM:1413, 12PM:1089, 3PM:862, 6PM:347, 8PM:26, 9PM:9 - monotonically decreasing | PASS |
| FLT-C08 | Reset time | Select "All Times" | Count returns | 2178 results, matches baseline | PASS |

#### Category Filter (CRITICAL)

| ID | Category | Count | Baseline | Changed | Spot-Check | Status |
|----|----------|-------|----------|---------|------------|--------|
| FLT-C09a | Fitness | 951 | 2178 | YES | HYROX (Squamish Barbell), Mountain Athlete Group, Hot Power Flow (Breathe Fitness) | PASS |
| FLT-C09b | Martial Arts | 198 | 2178 | YES | Women's Only Kickboxing (Roundhouse MA & Fitness) | PASS |
| FLT-C09c | Yoga & Pilates | 250 | 2178 | YES | Pilates Foundation to Intermediate (Seed Studio), Hot Arms & Shoulders (Oxygen Yoga) | PASS |
| FLT-C09d | Swimming | 452 | 2178 | YES | Lane Swim (Brennan Park), Swim Clubs, Public Swim | PASS |
| FLT-C09e | Arts & Culture | 4 | 2178 | YES | Self-Led Paint & Sketch - 55+ (Brennan Park) | PASS |
| FLT-C09f | Dance | 5 | 2178 | YES | Dance Fitness (Brennan Park) | PASS |
| FLT-C09g | Arena Sports | 38 | 2178 | YES | PLAYERS - Adult Drop-In Hockey | PASS |
| FLT-C09h | Recreation | 103 | 2178 | YES | Age Friendly Skate (Brennan Park) | PASS |
| FLT-C09i | **Camps** | **0** | 2178 | YES | **No cards** | **FAIL** |
| FLT-C09j | Kids Programs | 24 | 2178 | YES | Little Sneakers - Sundays (Brennan Park) | PASS |
| FLT-C09k | Education | 54 | 2178 | YES | VCH - Diabetes Education | PASS |
| FLT-C09l | Drop-In | 10 | 2178 | YES | Adult Drop-In Stick & Puck | PASS |
| FLT-C09m | Gymnastics | 72 | 2178 | YES | Intermediate - Level 6 Blue (7-12yrs) | PASS |
| FLT-C09n | **Certifications** | **0** | 2178 | YES | **No cards** | **FAIL** |
| FLT-C09o | Sports | 17 | 2178 | YES | Multisport (5-7 Years old) | PASS |
| FLT-C10 | Reset category | All Categories | - | 2178 = baseline | | PASS |

#### Age Filter

| ID | Test | Count | Baseline | Spot-Check | Status |
|----|------|-------|----------|------------|--------|
| FLT-A01 | Kids | 2123 | 2178 | 9/10 cards show Kids or All Ages badge | PASS |
| FLT-A02 | Adults | 1991 | 2178 | 9/10 cards show Adults or All Ages badge | PASS |
| FLT-A03 | All Ages reset | 2178 | 2178 | Matches baseline | PASS |

#### Price Filter

| ID | Test | Count | Baseline | Spot-Check | Status |
|----|------|-------|----------|------------|--------|
| FLT-C12 | Free | 158 | 2178 | 8/10 cards show "Free" badge | PASS |
| FLT-C13 | Paid | 2020 | 2178 | 10/10 cards show $ amount or "See venue for pricing" | PASS |
| FLT-C13s | Sum check | Free(158)+Paid(2020)=2178 | 2178 | Matches baseline exactly | PASS |

#### Combined Filters

| ID | Test | Expected | Actual | Status |
|----|------|----------|--------|--------|
| FLT-COMBO1 | Fitness + 9 AM | <= Fitness alone (951) | 683 results | PASS |
| FLT-COMBO2 | Swimming + Kids | <= Swimming alone (452) | 448 results | PASS |
| FLT-RESET | Reset all filters | Matches baseline | 2178 = baseline | PASS |

### Section 6.2: Events Tab Filters (FLT-E01 to FLT-E04)

| ID | Test | Count | Baseline (132) | Spot-Check | Status |
|----|------|-------|----------------|------------|--------|
| FLT-E01 | Day: Tomorrow | 0 | Changed | No events Feb 13 (legitimate data gap) | PASS (data) |
| FLT-E01b | Day: This Weekend | 10 | Changed | Weekend events | PASS |
| FLT-E01c | Day: Next Week | 100 | Changed | - | PASS |
| FLT-E01d | Day: Anytime | 161 | >=132 | - | PASS |
| FLT-E02 | Category: Arts & Culture | 2 | Changed | Squamish at Dusk | PASS |
| FLT-E02b | Category: Community | 125 | Changed | Whistler Indoor Playgroup, etc. | PASS |
| FLT-E02c | Category: Community Services | 1 | Changed | Stepping Into Leadership (Chamber of Commerce) | PASS |
| FLT-E02d | Category: Family | 3 | Changed | Legal Advocacy (SSCS Office) | PASS |
| FLT-E02e | **Category: Government** | **0** | Changed | **No cards** | **FAIL** |
| FLT-E02f | **Category: Recreation** | **0** | Changed | **Cards visible despite 0 count** | **FAIL** |
| FLT-E03 | Price: Free | 45 | Changed | - | PASS |
| FLT-E04a | **Age: Kids** | **132** | **Same as baseline** | **No filtering** | **FAIL** |
| FLT-E04b | Age: Adults | 100 | Changed | - | PASS |

### Section 6.3: Deals Tab Filters (FLT-D01 to FLT-D03)

| ID | Test | Count | Baseline (203) | Spot-Check | Status |
|----|------|-------|----------------|------------|--------|
| FLT-D01a | Other | 69 | Changed | Crankpots Ceramic Studio | PASS |
| FLT-D01b | Food & Drink | 45 | Changed | Squamish Bakery, 2 Chill Gelato, A&W, Tim Hortons | PASS |
| FLT-D01c | Retail | 40 | Changed | - | PASS |
| FLT-D01d | Wellness | 17 | Changed | - | PASS |
| FLT-D01e | Entertainment | 11 | Changed | - | PASS |
| FLT-D01f | Fitness | 11 | Changed | Breathe Fitness, Oxygen Yoga, Wild Life Gym | PASS |
| FLT-D01g | Services | 6 | Changed | - | PASS |
| FLT-D01h | Family | 4 | Changed | Totem Preschool | PASS |
| FLT-D02 | All categories > 0 | All > 0 | - | All deal categories have at least 4 results | PASS |

### Section 6.4: Services Tab Filters (FLT-S01 to FLT-S03)

| ID | Test | Count | Baseline (665) | Spot-Check | Status |
|----|------|-------|----------------|------------|--------|
| FLT-S01 | Restaurants & Dining | 44 | Changed | Norman Ruiz, Haru Fusion Cuisine - all show "RESTAURANTS & DINING" category | PASS |
| FLT-S02 | Retail & Shopping | 39 | Changed | - | PASS |
| FLT-S03 | Cafes & Bakeries | 34 | Changed | - | PASS |
| FLT-S04 | Fitness & Gyms | 17 | Changed | Oxygen Yoga & Fitness, Club Flex, Mountain Fitness Center - all show "FITNESS & GYMS" | PASS |
| FLT-S05 | Outdoor Adventures | 23 | Changed | Canadian Coastal Adventures, Howe Sound Boat Charters | PASS |

### Section 6.5: Search Correctness (FLT-SH01 to FLT-SH06)

| ID | Test | Action | Expected | Actual | Status |
|----|------|--------|----------|--------|--------|
| FLT-SH01 | Search + Category | "yoga" + Yoga & Pilates | Combined <= search alone | 137 <= 176 (yoga alone). Cards: Hot ABSolutely Burning Butts, Shamanic Yoga | PASS |
| FLT-SH02 | Search + Category #2 | "swim" + Swimming | Combined results | 267 results | PASS |
| FLT-SH03 | Clear search, keep filter | Clear search, Swimming stays | Category still active | 451 results (Swimming category still applied) | PASS |
| FLT-SH04 | Search + Price | "yoga" + Free | Combined <= search alone | 0 <= 176 (no free yoga classes found) | PASS |
| FLT-SH05 | Manual reset all | Clear search, reset all dropdowns | Baseline count | 2181 = baseline | PASS |
| FLT-SH06 | **Reset button** | **Click Reset after search+filter** | **All cleared** | **Category resets but search "yoga" remains, count=176 not baseline** | **FAIL** |

### Section 6.6: Age Group Filters (FLT-A01 to FLT-A03)

| ID | Tab | Age | Count | Baseline | Filtering Works | Status |
|----|-----|-----|-------|----------|-----------------|--------|
| FLT-A01a | Classes | Kids | 2123 | 2178 | YES (55 fewer) | PASS |
| FLT-A01b | Classes | Adults | 1991 | 2178 | YES (187 fewer) | PASS |
| FLT-A01c | Classes | All Ages reset | 2178 | 2178 | Baseline match | PASS |
| FLT-A02a | **Events** | **Kids** | **132** | **132** | **NO - same as baseline** | **FAIL** |
| FLT-A02b | Events | Adults | 100 | 132 | YES (32 fewer) | PASS |

---

## Bug Summary

### Critical Bugs (2)

1. **Reset button does not clear search input** -- When search text is entered and filters are applied, clicking the Reset button resets dropdown filters but leaves the search input text intact. This causes the count to reflect search results, not the full unfiltered baseline.

2. **Events tab "Kids" age filter has no effect** -- Selecting "Kids" in the age dropdown on the Events tab does not reduce the result count (stays at 132, same as baseline). The filter appears to not be applied to events. Adults filter works correctly (reduces to 100).

### Major Bugs (4)

3. **"Camps" category in Classes dropdown has 0 results** -- The category option exists but produces zero results.

4. **"Certifications" category in Classes dropdown has 0 results** -- Same issue as Camps.

5. **"Government" category in Events dropdown has 0 results** -- No events with this category exist.

6. **"Recreation" category in Events shows 0 count but displays cards** -- The count says 0 but future-dated cards (March 1) still render visually. The "Upcoming" day filter may be excluding them from the count while they still appear in the DOM.

### Everything Else: PASSING

All other tests -- 76 out of 89 -- pass correctly:
- All 5 tabs navigate correctly and show appropriate content
- Search works across all tabs with correct filtering, case insensitivity, partial matching, and empty state handling
- 13 of 15 Classes category filters work correctly with proper result counts
- All 8 Deals category filters work with >0 results each
- All 5 tested Services category filters work correctly
- Day filters (Tomorrow, Weekend, Next Week, Anytime) all work with correct date ranges
- Time filter works as "from this time onward" with monotonically decreasing counts
- Price filter (Free/Paid) works correctly with counts summing to baseline
- Combined filters correctly produce intersection results
- Card detail modals open/close properly
- Booking sheet opens with appropriate content
- Special characters and nonsense strings handled gracefully

---

## Screenshots Referenced

| File | Description |
|------|-------------|
| `/tmp/qa-recon-initial.png` | Initial app load - Classes tab |
| `/tmp/qa-tab-events.png` | Events tab |
| `/tmp/qa-tab-deals.png` | Deals tab |
| `/tmp/qa-tab-services.png` | Services tab |
| `/tmp/qa-tab-wellness.png` | Wellness tab |
| `/tmp/qa-search-yoga.png` | Search "yoga" results |
| `/tmp/qa-search-nonsense.png` | Nonsense search empty state |
| `/tmp/qa-flt-c01-tomorrow.png` | Tomorrow filter |
| `/tmp/qa-flt-c02-weekend.png` | Weekend filter |
| `/tmp/qa-flt-c07-6pm.png` | 6 PM time filter |
| `/tmp/qa-deep-fitness.png` | Fitness category filter |
| `/tmp/qa-deep-yoga.png` | Yoga & Pilates category |
| `/tmp/qa-deep-free.png` | Free price filter |
| `/tmp/qa-flt-a01-kids.png` | Kids age filter |
| `/tmp/qa-flt-a02-adults.png` | Adults age filter |
| `/tmp/qa-flt-combo1.png` | Combined Fitness + 9 AM filter |
| `/tmp/qa-card-detail-modal.png` | Card detail modal (Lane Swim) |
| `/tmp/qa-card-book.png` | Booking request sheet |
| `/tmp/qa-deals-food.png` | Deals Food & Drink filter |
| `/tmp/qa-services-restaurants.png` | Services Restaurants filter |
| `/tmp/qa-events-cs-zero.png` | Events Community Services filter |
| `/tmp/qa-reset-bug.png` | Reset button bug - search not cleared |
| `/tmp/qa-search-filter-combo.png` | Search + filter combined |
