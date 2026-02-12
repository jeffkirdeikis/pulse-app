# QA Report: Events + Deals Tabs
Date: 2026-02-10
Scope: Sections 6.2 (Events Tab Filters), 6.3 (Deals Tab Filters), Event/Deal Card Functionality

## Summary
Total Checks: 30
Passed: 26
Failed: 4

## Detailed Results

### Section 6.2: Events Tab Filters

| ID | Check | Action | Result | Evidence | Status |
|---|---|---|---|---|---|
| FLT-E01 | Events default state - baseline count | Navigated to Events tab, recorded card count and results text | Results text: "21 results", Visible cards: 21 | Screenshot: events-tab-initial.png. Cards show title, date, time, venue. Default day filter = "Upcoming" | **PASS** |
| FLT-E02 | Category filter - select "Community" | Opened filters, selected "Community" from category dropdown | Results: "18 results" (down from 21). First 3: Pemberton Playgroup, Infant/Toddler Playgroup, StrongStart BC Programs | Count decreased from 21 to 18. Screenshot: events-category-filtered.png shows Community selected, Reset button appeared | **PASS** |
| FLT-E03 | Category resets on tab switch (Events -> Classes -> Events) | Switched to Classes tab, then back to Events tab | Category value reset to "all", Results: "21 results", Cards: 21 | Category properly reset, baseline count restored. Screenshot: events-after-tab-switch.png | **PASS** |
| FLT-E04 | Anytime >= Upcoming, shows all future events | Selected "Anytime" from day filter (Upcoming count was 21) | Anytime count: 42, Cards visible: 42 | Anytime (42) >= Upcoming (21). Screenshot: events-anytime-filter.png | **PASS** |
| DEEP-E01 | Day filter defaults to "Upcoming" | Checked day filter initial value | Default value: "today", display text: "Upcoming" | Correctly defaults to Upcoming view | **PASS** |
| DEEP-E02 | Tomorrow filter works | Selected "Tomorrow" from day filter | 3 results | Valid result (tomorrow may have fewer events) | **PASS** |
| DEEP-E03 | This Weekend filter works | Selected "This Weekend" from day filter | 3 results | Valid result | **PASS** |
| DEEP-E04 | Combined filters reduce count | Set Anytime (42 results) then added Community category | Combined: 25 results, down from 42 | Multiple filters stack correctly | **PASS** |
| DEEP-E05 | Reset button clears all filters | Clicked Reset button | All filters returned to defaults: day=today, time=all, age=all, category=all, price=all | Full reset verified | **PASS** |
| DEEP-E06 | Search filters events | Typed "music" in search input | 1 result: "Live Music at The Local" | Search correctly filters events. Screenshot: events-after-rapid-switch.png | **PASS** |
| DEEP-E10 | App survives rapid filter switching | Rapidly switched day filter through all 6 options | App stable, no error boundary, results displayed | Stress test passed | **PASS** |
| DEEP-E11 | App survives rapid tab switching | Rapidly switched Events <-> Deals 6 times | App stable, content rendered | Stress test passed | **PASS** |
| FLT-E04b | Anytime filter includes past events | Viewed Anytime results list | First event: "Enchanted Forest at Squamish Canyon" dated Tue, Jan 27 (past) | "Anytime" shows past events, not just "all future events" - this may be by design but label says "Anytime" not "Including Past" | **FAIL** |

### Section 6.3: Deals Tab Filters

| ID | Check | Action | Result | Evidence | Status |
|---|---|---|---|---|---|
| FLT-D01 | Deals default state - baseline count | Navigated to Deals tab, recorded count | Results: "222 results", Cards: 222 | Screenshot: deals-tab-initial.png. Cards show title, venue, savings badge | **PASS** |
| FLT-D02 | Category filter - Food & Drink | Selected "Food & Drink" from dropdown | 55 results (down from 222). Spot check: Squamish Bakery, 2 Chill Gelato, A&W Squamish | Count decreased, relevant businesses shown. Screenshot: deals-category-filtered.png | **PASS** |
| FLT-D03 | All categories restores baseline | Selected "All Deals" from dropdown | 222 results (matches baseline) | Count fully restored. Screenshot: deals-all-reset.png | **PASS** |
| DEEP-D01a | Category cycling - all categories work | Cycled through all 8 non-All categories | Food & Drink: 55, Shopping: 0, Services: 6, Fitness: 11, Recreation: 0, Wellness: 17, Accommodations: 0, Family: 4 | Sum of categories: 93 out of 222 total. **58% of deals (129) are unreachable by category filter** | **FAIL** |
| DEEP-D08 | Empty state for empty category | Selected a category with 0 deals (e.g., Shopping) | Empty state shown with "No deals found" message and Clear Filters button | Empty state UI works correctly | **PASS** |
| DC-04 | Category dropdown populated | Checked deal category dropdown | 9 options: All Deals, Food & Drink, Shopping, Services, Fitness, Recreation, Wellness, Accommodations, Family | Dropdown is populated with real categories | **PASS** |

### Event Card Functionality

| ID | Check | Action | Result | Evidence | Status |
|---|---|---|---|---|---|
| EC-01 | Cards display title, date, time, venue | Inspected 3 event cards | All 3 have: title (h3), date (Calendar icon), time (Clock icon), venue (MapPin icon) | Spot check: "Pemberton Playgroup" - Tue, Feb 10 - 9:00 AM - Sea to Sky Community Services | **PASS** |
| EC-02 | Card click opens detail modal | Clicked first event card | Modal opened with hero section, date/time card, quick actions | Screenshot: event-detail-modal.png | **PASS** |
| EC-03 | Modal shows full info (title, date, time, description, venue) | Checked modal content | Title: "Pemberton Playgroup", Date: "Tuesday, February 10", Time: "9:00 AM", Description: "Join us Tuesday mornings...", Venue: "Sea to Sky Community Services" | All fields present | **PASS** |
| EC-04 | Save button toggles | Clicked Save in modal (was unsaved) | Button changed to "Saved" with filled star | Toggle worked correctly | **PASS** |
| EC-05 | Date grouping headers present | Checked for date dividers | 5 date dividers found: Tomorrow, Thursday February 12, Sunday February 15, Tuesday February 17, Friday February 20 | Date groups working | **PASS** |
| DEEP-E07 | Modal closes via overlay click | Opened modal, clicked overlay | Modal closed | Overlay dismiss works | **PASS** |
| DEEP-E08 | Modal closes via X button | Opened modal, clicked X | Modal closed | X button dismiss works | **PASS** |
| DEEP-E09 | Card-level save star toggles | Clicked star on event card (not modal) | Star toggled to saved | Card save works, does not open modal (stopPropagation correct) | **PASS** |

### Deal Card Functionality

| ID | Check | Action | Result | Evidence | Status |
|---|---|---|---|---|---|
| DC-01 | Cards display business name, title, savings badge | Inspected 3 deal cards | All have title, venue. Savings badges: "50% OFF", "50% OFF", "40% OFF" | Screenshot: deals-tab-initial.png | **PASS** |
| DC-02 | Card click opens detail modal | Clicked first deal card | Modal opened: "Buy One Get One Free" at Crankpots Ceramic Studio | Screenshot: deal-detail-modal.png | **PASS** |
| DC-03 | Modal shows business name, description, redeem button | Checked modal content | Venue: Crankpots Ceramic Studio, Description present, Redeem Deal button visible, Terms & Conditions section visible | All required elements present | **PASS** |
| DEEP-D06 | Redeem prompts auth for unauthenticated user | Clicked Redeem Deal button while not signed in | Auth modal appeared | Proper auth gate on redeem action. Screenshot: deal-redeem-unauth.png | **PASS** |
| DEEP-D07 | Save click does not propagate to open modal | Clicked save star on card | Star toggled, modal did NOT open | stopPropagation correctly prevents modal | **PASS** |

### Cross-cutting

| ID | Check | Action | Result | Evidence | Status |
|---|---|---|---|---|---|
| CROSS-01 | Search query persists across tabs | Typed "testing search" on Events, switched to Deals | Deals showed 0 results with "testing search" still in search box | Search leaks across tabs, breaking deals display | **FAIL** |
| CROSS-02 | Results text grammar | Searched "music" (1 result) | Text reads "1 results" (incorrect grammar) | Should say "1 result" (singular) | **FAIL** |
| CONSOLE | No critical console errors | Monitored all console output | 0 relevant errors | Clean console throughout | **PASS** |

## Issues Found

### Critical
None

### Major
1. **DEEP-D01a / Deal Category Mismatch**: 58% of deals (129 out of 222) are unreachable through the category filter. The `DEAL_CATEGORY_MAP` in `src/utils/dealHelpers.js` normalizes categories to "Retail", "Entertainment", and "Beauty", but the dropdown in `src/components/DealsGrid.jsx` offers "Shopping", "Recreation", and "Accommodations" instead. The map has no "Shopping", "Recreation", or "Accommodations" entries. Deals with categories like "Retail & Shopping" normalize to "Retail" but the dropdown checks for "Shopping" -- they never match. Similarly, "Recreation & Sports" normalizes to "Entertainment" but the dropdown checks for "Recreation". Many deals normalize to "Other" (any unmapped category) and "Other" is not in the dropdown at all.

   **Files involved**:
   - `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/dealHelpers.js` lines 92-146 (DEAL_CATEGORY_MAP)
   - `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/DealsGrid.jsx` lines 51-59 (dropdown options)

2. **CROSS-01 / Search persists across tabs**: The `searchQuery` state is shared across all tabs (Events, Classes, Deals, Services). If a user types a search on the Events tab and then clicks the Deals tab, the search term remains active and filters the deals. This can cause confusion when switching tabs shows 0 results.

   **File involved**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` -- `searchQuery` state is global, not per-tab.

### Minor
1. **FLT-E04b / Anytime includes past events**: The "Anytime" filter shows events from January 27 (past) in addition to future events. If the intent is "show everything regardless of date" this is by design, but users might expect "Anytime in the future" since the default is "Upcoming". The first card showing a past date could be confusing.

   **File involved**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/filterHelpers.js` line 35-62 -- `day === 'anytime'` applies no date filter at all.

2. **CROSS-02 / Grammar: "1 results"**: When exactly 1 result is displayed, the results count reads "1 results" instead of "1 result". This is a simple pluralization issue.

   **File involved**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` line 789 -- `` `${filterEvents().length} results` `` does not handle singular case.

## Screenshots Captured
- qa-reports/screenshots/events-tab-initial.png - Events tab with 21 results, default state
- qa-reports/screenshots/events-filters-open.png - Events filters panel expanded
- qa-reports/screenshots/events-category-filtered.png - Events filtered by "Community" category (18 results)
- qa-reports/screenshots/events-after-tab-switch.png - Events tab after Classes->Events switch (reset verified)
- qa-reports/screenshots/events-anytime-filter.png - Events with "Anytime" day filter (42 results)
- qa-reports/screenshots/events-after-rapid-switch.png - Events after rapid filter stress test
- qa-reports/screenshots/event-detail-modal.png - Event detail modal for "Pemberton Playgroup"
- qa-reports/screenshots/deals-tab-initial.png - Deals tab with 222 results, default state
- qa-reports/screenshots/deals-category-filtered.png - Deals filtered by "Food & Drink" (55 results)
- qa-reports/screenshots/deals-all-reset.png - Deals reset to All (222 results restored)
- qa-reports/screenshots/deals-food-drink-fresh.png - Fresh Deals Food & Drink filter
- qa-reports/screenshots/deal-detail-modal.png - Deal detail modal for "Buy One Get One Free"
- qa-reports/screenshots/deal-redeem-unauth.png - Redeem button triggers auth modal
- qa-reports/screenshots/deals-empty-state.png - Empty state for category with no deals

## Technical Analysis

### Deal Category Filter Bug Detail

The dropdown in `DealsGrid.jsx` defines these selectable categories:
```
All, Food & Drink, Shopping, Services, Fitness, Recreation, Wellness, Accommodations, Family
```

The `DEAL_CATEGORY_MAP` in `dealHelpers.js` normalizes to these output categories:
```
Food & Drink, Fitness, Wellness, Family, Entertainment, Retail, Beauty, Services, Other
```

**Mismatches:**
| Dropdown Option | Map Output | Match? |
|---|---|---|
| Shopping | (not in map -- map uses "Retail") | NO |
| Recreation | (not in map -- map uses "Entertainment") | NO |
| Accommodations | (not in map at all) | NO |
| (none) | Retail | Missing from dropdown |
| (none) | Entertainment | Missing from dropdown |
| (none) | Beauty | Missing from dropdown |
| (none) | Other | Missing from dropdown |

**Fix**: Either update `DEAL_CATEGORY_MAP` to normalize to the dropdown values (Shopping, Recreation, Accommodations instead of Retail, Entertainment), or update the dropdown to match the map output values, and add an "Other" option for unmapped categories.
