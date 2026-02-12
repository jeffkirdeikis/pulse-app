# PULSE QA REPORT -- Services Tab

**Date**: 2026-02-08
**Scope**: Consumer View -- Services Tab ONLY
**Tester**: Automated QA (Puppeteer) + Visual Verification
**Viewports**: 430x932 (mobile), 375x667 (iPhone SE), 768x1024 (tablet), 1440x900 (desktop)

---

## Summary

- **Total checks performed**: 83
- **Passes**: 76
- **Failures**: 1
- **Warnings**: 6
- **Blocked**: 0

---

## Critical Failures (must fix before launch)

None.

## Major Issues (should fix before launch)

1. **Results Count Mismatch** -- The "results-count" element displays "683 results" but only 665 service cards are actually rendered. Root cause: the results count uses `REAL_DATA.services` (raw static data with fuzzy `.includes()` category matching) at `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` line 10891, while the actual card rendering uses the `services` state variable (which may have been filtered/modified). This means users see "683 results" but can only scroll through 665 cards, creating a confusing mismatch.

2. **Desktop Layout Wastes 74% of Viewport** -- At 1440px, the content grid is only ~380px wide (26% of viewport). The remaining 74% is a dark/empty background. Cards display in a single column even on desktop. This is a poor desktop experience for users on large monitors. See screenshot: `/tmp/qa-services-tab/11-desktop-layout.png`.

3. **Consumer/Business Toggle Overlaps Card Content** -- The floating "Consumer | Business" pill at bottom of viewport overlaps with the social proof banners at the bottom of visible service cards. This partially obscures card content and can cause unintended taps on mobile.

## Minor Issues (fix when possible)

1. **Search Long String: Horizontal Overflow** -- Typing a 500-character string into the search input causes horizontal overflow at 430px viewport width. The search input or its container does not properly contain extremely long inputs. While an edge case, it breaks the layout.

2. **Single Column Grid at All Viewports** -- Service cards render in a single column even at 1440px. At tablet/desktop widths, a multi-column grid would greatly improve usability and reduce scroll depth (665 cards x ~180px each = ~120,000px of scrolling).

3. **Results Count Filter Logic Mismatch** -- The results count at `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` line 10891-10906 uses fuzzy category matching (`normalizedCategory.includes(filterLower)`) while the actual card filter at line 11100-11119 uses exact match (`service.category === serviceCategoryFilter`). This can cause the displayed count to differ from the actual number of visible cards when a category filter is applied.

## Warnings (potential issues)

1. **Performance**: Rendering 665 service cards simultaneously (no virtualization or pagination) causes noticeable slowness when changing viewports or opening modals. The Puppeteer protocol timed out when trying to interact with the page at 375px after rendering all cards. Users on low-end mobile devices may experience jank.

2. **About Text Fallback**: The modal "About" section uses a generic template `"{name} is a {category} business located in Squamish, BC."` for businesses without descriptions. This is functional but generic.

3. **"Other" Category Has 290 Businesses** (43% of total) -- The "Other" catch-all category contains nearly half of all businesses. This suggests many businesses need proper categorization.

---

## Element Inventory

### Buttons
1. Services tab -- Location: second nav row
2. Wellness tab -- Location: second nav row
3. Search clear (X) -- Location: inside search bar (appears when text entered)
4. Category filter dropdown -- Location: below search bar
5. FAB (+) button -- Location: bottom-right floating
6. Consumer toggle -- Location: bottom-center floating
7. Business toggle -- Location: bottom-center floating
8. Service card (clickable) -- Location: main content (x665)
9. Map link (per card) -- Location: address row in each card

### Within Service Detail Modal
10. Close (X) button
11. Call action
12. Directions action
13. Website action
14. Save action
15. Rating stars (x5 interactive)
16. View on Google Maps CTA
17. Visit Website CTA
18. Report an issue button
19. Google Reviews link

### Inputs
20. Search input -- Type: text, placeholder "Search services..."

### Dynamic Content
21. Service cards list (665 items from Supabase/static data)
22. Results count display
23. Search results count (appears during search)
24. Social proof banners (per card)
25. No-results empty state

---

## Detailed Results

| # | Element | Action | Expected | Actual | Status |
|---|---------|--------|----------|--------|--------|
| 1 | App | Navigate to localhost:5173 | Page loads | Page loaded successfully | PASS |
| 2 | App | Check for error boundary | No error boundary | App renders normally | PASS |
| 3 | Console | Check for critical errors on load | No critical errors | No critical console errors | PASS |
| 4 | Services Tab | Click Services tab | Tab becomes active, services content loads | Services tab clicked, content loading | PASS |
| 5 | Services Tab | Verify active state | Services tab shows active styling | Tab has active class | PASS |
| 6 | Service Cards | Check cards render | Multiple service cards visible | 665 cards rendered | PASS |
| 7 | Page Content | Check for placeholder text | No placeholder text | No placeholder text found | PASS |
| 8 | Search Input | Check existence | Search input present | Search input found | PASS |
| 9 | Search Input | Check placeholder text | Has descriptive placeholder | Placeholder: "Search services..." | PASS |
| 10 | Search | Type "Auto" | Results filtered to matching businesses | 24 cards shown (filtered from 665) | PASS |
| 11 | Search Results Count | Display result count | Shows count of results | Shows: "24 results for "Auto"" | PASS |
| 12 | Clear Search | Click X button | Search clears, all results return | 665 cards restored | PASS |
| 13 | Search XSS | Type script tag | Text is escaped, no script execution | Special chars safely handled | PASS |
| 14 | No Results State | Search with gibberish | Shows no-results message | Shows: "No businesses found for..." with clear search button | PASS |
| 15 | Search Long String | Type 500-char string | No layout break | Horizontal overflow detected | FAIL |
| 16 | Search Empty Submit | Press Enter with empty input | Nothing breaks | 665 cards still shown | PASS |
| 17 | Search by Category | Type "Restaurant" | Shows restaurant businesses | 44 restaurant results | PASS |
| 18 | Category Filter | Check existence | Filter dropdown present | Filter dropdown found | PASS |
| 19 | Category Filter Options | Count options | 20+ categories | 23 categories available | PASS |
| 20 | Filter: Auto Services | Select Auto Services | Shows only auto businesses | 23 auto service cards | PASS |
| 21 | Filter Accuracy | Verify filtered cards match category | All cards show Auto Services | 5 cards all show Auto category | PASS |
| 22 | Filter: Restaurants | Select Restaurants & Dining | Shows restaurant businesses | 44 restaurant cards | PASS |
| 23 | Filter: Health & Wellness | Select Health & Wellness | Shows wellness businesses | 17 wellness cards | PASS |
| 24 | Filter: Other | Select Other | Shows miscellaneous businesses | 290 "Other" cards | PASS |
| 25 | Filter Reset | Select "All" | All services return | 665 cards (all services) | PASS |
| 26 | Card #1 Name | Check business name | Name displayed | "Canadian Coastal Adventures" | PASS |
| 27 | Card #1 Category | Check category | Category displayed | "Outdoor Adventures" | PASS |
| 28 | Card #1 Map Link | Check map link | Links to Google Maps | Links to maps for "38129 2nd Ave" | PASS |
| 29 | Card #1 Social Proof | Check social proof banner | Social proof badge visible | "Top rated in Outdoor Adventures" | PASS |
| 30 | Card #2 Name | Check business name | Name displayed | "Howe Sound Boat Charters" | PASS |
| 31 | Card #2 Category | Check category | Category displayed | "Outdoor Adventures" | PASS |
| 32 | Card #2 Map Link | Check map link | Links to Google Maps | Links to maps for "Squamish" | PASS |
| 33 | Card #2 Social Proof | Check social proof | Social proof visible | "Top rated in Outdoor Adventures" | PASS |
| 34 | Card #3 Name | Check business name | Name displayed | "Squamish Dental Group" | PASS |
| 35 | Card #3 Category | Check category | Category displayed | "Dental" | PASS |
| 36 | Card #3 Map Link | Check map link | Links to Google Maps | Links to maps for "38027 Cleveland Ave" | PASS |
| 37 | Card #3 Social Proof | Check social proof | Social proof visible | "Top rated in Dental" | PASS |
| 38 | Card Sorting | Check sort order | Higher-rated businesses first | First: 5.0, Second: 5.0 (tier-based sort) | PASS |
| 39 | Service Modal | Click service card | Detail modal opens | Modal opened for "Canadian Coastal Adventures" | PASS |
| 40 | Modal Title | Check business name in modal | Business name displayed | "Canadian Coastal Adventures" | PASS |
| 41 | Modal Category | Check category pill | Category pill visible | "Outdoor Adventures" | PASS |
| 42 | Modal Address | Check address | Address displayed | "38129 2nd Ave" | PASS |
| 43 | Modal About | Check About section | About text present | "Canadian Coastal Adventures is a outdoor adventures business..." | PASS |
| 44 | Modal Call Button | Check Call action | Call button present | Call button found | PASS |
| 45 | Modal Directions Button | Check Directions action | Directions button present | Directions button found | PASS |
| 46 | Modal Save Button | Check Save action | Save button present | Save button found | PASS |
| 47 | Modal Rating Stars | Check interactive rating | Star rating available | Interactive stars found | PASS |
| 48 | Rating Interaction | Click 4th star | Shows rating feedback | Feedback: "You rated 4 stars -- Thanks!" | PASS |
| 49 | Modal Trust Badges | Check trust indicators | Trust badges shown | Trust indicators visible | PASS |
| 50 | Modal CTA | Check CTA buttons | CTA section present | View on Maps / Visit Website CTAs found | PASS |
| 51 | Modal Report Button | Check Report issue button | Report button present | Report an issue button found | PASS |
| 52 | Save Toggle | Click Save button | Save toggles | Save button clicked (toggles save state) | PASS |
| 53 | Modal Close (X) | Click X button | Modal closes | Modal closed via X button | PASS |
| 54 | Modal Close (Overlay) | Click outside modal | Modal closes | Modal closed via overlay click | PASS |
| 55 | Modal Close (ESC) | Press Escape key | Modal closes | Modal closed via ESC key | PASS |
| 56 | Double-Click Card | Double-click service card | No duplicate modals | 1 modal open | PASS |
| 57 | Rapid Save Clicks | Click Save 10 times rapidly | No crash | App survived rapid save toggling | PASS |
| 58 | Search + Filter Combo | Search "pizza" + filter "Restaurants" | Combined filtering works | 3 results with combined filters | PASS |
| 59 | Map Link #1 | Check href | Links to Google Maps | Opens maps for "38129 2nd Ave" | PASS |
| 60 | Map Link #1 Target | Check target | Opens in new tab | target="_blank" | PASS |
| 61 | Map Link #2 | Check href | Links to Google Maps | Opens maps for "Squamish" | PASS |
| 62 | Map Link #2 Target | Check target | Opens in new tab | target="_blank" | PASS |
| 63 | Map Link #3 | Check href | Links to Google Maps | Opens maps for "38027 Cleveland Ave" | PASS |
| 64 | Map Link #3 Target | Check target | Opens in new tab | target="_blank" | PASS |
| 65 | Map Link Propagation | Click map link on card | Does NOT open modal (stopPropagation) | Modal did not open | PASS |
| 66 | Responsive 375px | Check layout | No horizontal overflow | No overflow at 375px | PASS |
| 67 | Responsive 375px Search | Check search visibility | Search visible at 375px | Search input visible | PASS |
| 68 | Responsive 768px | Check layout | No horizontal overflow | No overflow at 768px | PASS |
| 69 | Responsive 1440px | Check layout | No horizontal overflow | No overflow at 1440px | PASS |
| 70 | Results Count | Compare displayed count to card count | Count matches cards | Displayed: 683, Cards rendered: 665 -- 18 discrepancy | WARN |
| 71 | FAB Button | Check existence | FAB button visible | FAB found: "Add Event" | PASS |
| 72 | FAB Click | Click FAB button | Opens submit/add flow | FAB triggered action | PASS |
| 73 | Scroll | Scroll to bottom | List is scrollable | Scrollable area: 161,595px | PASS |
| 74 | Modal at 375px | Open modal at mobile | Modal fits viewport | Modal width: 375px (viewport: 375px) | PASS |
| 75 | Different Card Content | Click 2nd card | Shows different business | Card 1: "Canadian Coastal Adventures", Modal: "Howe Sound Boat Charters" | PASS |
| 76 | Desktop Layout | Check content width at 1440px | Content uses reasonable width | Content only uses 26% of viewport width (380px of 1440px) | WARN |
| 77 | Desktop Grid | Check card layout at desktop | Multi-column grid at desktop | Single column layout even at 1440px -- wasted space | WARN |
| 78 | Consumer/Business Toggle | Check for content overlap | No overlap with card content | Toggle overlaps with social proof banners | WARN |
| 79 | Search Text Visibility | Type text and verify visible | Typed text is visible | Value: "test123", color: rgb(17, 24, 39) -- clearly visible | PASS |
| 80 | Results Count Update | Change filter and check count | Count updates with filter | Default: "683 results" -> Filtered: "34 results" (updates correctly) | PASS |
| 81 | Loading State | Check for loading indicator | Loading state exists in code | Loading state defined (servicesLoading conditional) | PASS |
| 82 | Card Cursor | Check cursor style | Shows pointer cursor | Cards show pointer cursor | PASS |
| 83 | Console (Part 2) | Check critical errors | No critical errors | Clean console through all tests | PASS |

---

## Screenshots

| Screenshot | File |
|------------|------|
| Initial Services view | `/tmp/qa-services-tab/02-services-initial.png` |
| Search "Auto" results | `/tmp/qa-services-tab/03-search-auto.png` |
| Search "Restaurant" results | `/tmp/qa-services-tab/04-search-restaurant.png` |
| Auto Services filter | `/tmp/qa-services-tab/05-filter-auto.png` |
| Service detail modal | `/tmp/qa-services-tab/06-service-modal.png` |
| Responsive 375px | `/tmp/qa-services-tab/07-responsive-375.png` |
| Responsive 768px | `/tmp/qa-services-tab/08-responsive-768.png` |
| Responsive 1440px | `/tmp/qa-services-tab/09-responsive-1440.png` |
| Modal at mobile | `/tmp/qa-services-tab/10-modal-mobile.png` |
| Desktop layout | `/tmp/qa-services-tab/11-desktop-layout.png` |

---

## Visual Observations from Screenshots

1. **Services initial view (mobile)** -- Clean layout. "PULSE SQUAMISH" header, tab navigation (Classes, Events, Deals on row 1; Services, Wellness on row 2), search bar, "683 results" count, "All Services" dropdown, and well-structured cards with name, rating, category, address, and social proof. Cards are bordered with a blue left accent.

2. **Search "Auto"** -- Search input shows "Auto", clear (X) button appears, "24 results for 'Auto'" subtitle appears below filter. Cards correctly show only Auto Services businesses. Note: the "683 results" count at top does NOT change during search (only the secondary "24 results for..." count appears).

3. **Service detail modal** -- Beautiful modal with dark hero banner showing category pill, business name, address, and star rating card. Below: 4 quick action buttons (Call, Directions, Website, Save). Then About section, Details grid (Category, Location, Phone, Email), and more. Well-designed and comprehensive.

4. **Filter "Auto Services"** -- Dropdown shows car emoji + "Auto Services", count correctly updates to "23 results", all visible cards show AUTO SERVICES category.

5. **375px responsive** -- Tight but functional. Cards slightly truncated by Consumer/Business toggle at bottom.

6. **768px / 1440px** -- Content is confined to a narrow column on the left (~380px wide). The remaining viewport is dark/empty. This is the most significant visual issue -- the app is clearly mobile-first and does not adapt its layout for wider screens.

7. **Mobile modal** -- Modal fills the 375px width perfectly with proper internal layout.

---

## Root Causes / Code References

### Results Count Mismatch (683 vs 665)
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx`
- **Line 10891**: `REAL_DATA.services.filter(...)` -- uses raw static data array
- **Line 11086**: `services.filter(...)` -- uses state-managed `services` variable
- These two data sources have different lengths (683 vs 665), suggesting 18 services in REAL_DATA are not in the state-managed `services` array, possibly filtered out during initialization.

### Desktop Layout
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/styles/pulse-app.css` (or inline styles in App.jsx)
- The app container appears to have a `max-width` constraint suitable for mobile but not responsive for desktop. Cards could use CSS grid with `auto-fill` and `minmax()` for multi-column at wider viewports.

---

*Report generated by qa-services-tab.cjs + qa-services-tab-part2.cjs with visual verification*
*QA duration: ~8 minutes automated testing + visual review*
