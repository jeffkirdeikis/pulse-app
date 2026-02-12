# PULSE QA REPORT -- Admin View -- 2026-02-08

## Summary
- **Total checks performed**: 85
- **Passes**: 71
- **Failures**: 1
- **Warnings**: 13
- **Blocked**: 0

## Critical Failures (must fix before launch)
None.

## Major Issues (should fix before launch)
1. **Responsive: Mobile 375px** -- Admin view causes horizontal scroll at 375px width. Body scrollWidth is 704px vs 375px viewport. The admin header buttons ("Settings", "Add Venue"), stat cards, scraping cards, and venue management grid all overflow the mobile viewport. The view switcher also overlaps content. This entire view needs mobile-specific CSS.
2. **Stats: "Total Venues" and "Unclaimed Venues" show the same number (318)** -- This implies zero businesses have been claimed, or the unclaimed count is being set to the same value as total venues regardless of actual claims. The stat should reflect `total_venues - claimed_venues`.
3. **Stats: "0 verified businesses" and "0 verified" deals** -- Despite having 318 venues and 350 deals, zero are marked as verified. This may be accurate if no verification system is active, but if verifications exist in the database this is a data display bug.
4. **Impersonation search returns unrelated results** -- Typing "Gr" in the impersonation search returned "Ajay Thomas Photography", "LivWell Integrated Health", and "Squamish Dental Group" as the first three results, none of which contain "Gr". The search appears to search by category or other fields, not just name, or the dropdown is showing stale/unfiltered results. (Note: The search may have matched these because the venue management search field shares state with the impersonation search, both bound to `adminSearchQuery`.)

## Minor Issues (fix when possible)
1. **Filter dropdowns non-functional** -- Category and Status filter `<select>` elements in Venue Management (lines 15627-15638 of App.jsx) render but have no `onChange` handlers. They do nothing when changed.
2. **Placeholder buttons** -- Settings, Add Venue, Configure, and Run Scrape Now buttons all show toast messages with "coming soon" or CLI instructions rather than performing real actions.
3. **Scraping dashboard is entirely hardcoded** -- All scraping system values ("Tonight at 2:00 AM", "47 minutes", "23 updates", "3 errors", and the 5-entry activity log) are static data, not pulled from any live scraping system or database table.
4. **Delete button labeling** -- The delete button (trash icon) performs a soft-delete (sets `status: 'inactive'`), which is good practice but the action should be labeled "Deactivate" or show a confirm dialog that says "deactivate" rather than "Delete [name]? This cannot be undone." since it CAN be undone.
5. **Quick Add form: empty submission toast may be too brief** -- The validation toast "Please fill in title and venue" appears but may disappear before user reads it, especially at the bottom of a long page.
6. **Shared search state** -- The impersonation search in the admin header and the venue management search both share the same `adminSearchQuery` state. Typing in one affects the other, which can cause confusing behavior (e.g., typing in the venue management search also populates the impersonation search dropdown).

## Warnings (potential issues)
1. **Scraping: Hardcoded Data** -- Scraping dashboard values ("Tonight at 2:00 AM", "47 minutes", "23 updates", "3 errors", activity log) all appear hardcoded and not pulled from live scraping system data
2. **Scraping: Configure Click** -- No visible toast feedback
3. **Scraping: Run Scrape Click** -- No visible toast feedback
4. **Category Filter: Functionality** -- The category and status filter <select> elements do not have onChange handlers in the source code - they are rendered but do not actually filter the venue list
5. **Quick Add: Empty Validation** -- No visible validation message for empty submission
6. **Header: Settings Button** -- No toast feedback visible
7. **Header: Add Venue Button** -- No toast feedback visible
8. **Header: Placeholder Actions** -- Both Settings and Add Venue buttons show toast messages and do not perform real actions yet
9. **Console: Non-Critical** -- 2 messages: Error fetching business inbox: JSHandle@object; Error fetching analytics: JSHandle@object
10. **Source: Hardcoded Scraping Data** -- The scraping dashboard (lines 15589-15612 of App.jsx) uses a hardcoded array of activity log entries and static values, not live scraping system data
11. **Source: Filter Dropdowns Non-Functional** -- The Category and Status filter <select> elements in Venue Management (lines 15627-15638 of App.jsx) have no onChange handlers and do not actually filter the venue list
12. **Source: Delete Uses Soft Delete** -- The delete button sets status to "inactive" rather than actually deleting the record, which is good practice but should be labeled "Deactivate" for clarity
13. **Source: Placeholder Buttons** -- Settings button, Add Venue button, Configure button, and Run Scrape Now button all show toast messages with "coming soon" or CLI instructions rather than performing actual admin actions

## Detailed Results

| # | Status | Element | Action | Result |
|---|--------|---------|--------|--------|
| 1 | ✅ PASS | App Load | Navigate to localhost:5173 | Page loaded successfully |
| 2 | ✅ PASS | Error Boundary | Check initial render | No error boundary visible |
| 3 | ✅ PASS | Guest Access Control | Admin tab hidden from guest | Admin tab correctly not visible to unauthenticated/non-admin users |
| 4 | ✅ PASS | View Switcher | Check tabs for guest | Tabs visible: [Consumer, Business] |
| 5 | ✅ PASS | Admin State Injection | Set user.isAdmin=true via React hooks | Admin state successfully injected |
| 6 | ✅ PASS | Admin Tab Visibility | Admin tab now visible after injection | Admin tab correctly appears for admin user |
| 7 | ✅ PASS | Admin Tab Click | Click Admin tab in nav | Successfully clicked Admin tab |
| 8 | ✅ PASS | Admin Dashboard Load | Admin dashboard renders | Admin Dashboard and System Overview visible |
| 9 | ✅ PASS | Stats Card Count | Check stat cards | 4 stat cards rendered |
| 10 | ✅ PASS | Stat: Total Venues | Check value | Value: 318 (0 verified businesses) |
| 11 | ✅ PASS | Stat: Weekly Classes | Check value | Value: 151 (1059 total instances) |
| 12 | ✅ PASS | Stat: Unclaimed Venues | Check value | Value: 318 (Awaiting business claims) |
| 13 | ✅ PASS | Stat: Active Deals | Check value | Value: 350 (0 verified) |
| 14 | ✅ PASS | Stat Sanity: Total Venues | Check non-zero | 318 venues (reasonable) |
| 15 | ✅ PASS | Scraping: Section Present | Check section | Web Scraping System section visible |
| 16 | ✅ PASS | Scraping: Info Cards | Check cards | 4 scrape info cards |
| 17 | ✅ PASS | Scraping: Next Run Card | Check Next Scheduled Run | Card present |
| 18 | ✅ PASS | Scraping: Duration Card | Check Last Run Duration | Card present |
| 19 | ✅ PASS | Scraping: Changes Card | Check Changes Detected | Card present |
| 20 | ✅ PASS | Scraping: Failed Card | Check Failed Scrapes | Card present |
| 21 | ✅ PASS | Scraping: Activity Log | Check log section | Recent Scraping Activity visible |
| 22 | ✅ PASS | Scraping: Log Entries | Check log items | 5 log entries displayed |
| 23 | ⚠️ WARN | Scraping: Hardcoded Data | Data source check | Scraping dashboard values ("Tonight at 2:00 AM", "47 minutes", "23 updates", "3 errors", activity log) all appear hardco |
| 24 | ✅ PASS | Scraping: Configure Button | Button present | Configure button exists |
| 25 | ✅ PASS | Scraping: Run Scrape Button | Button present | Run Scrape Now button exists |
| 26 | ⚠️ WARN | Scraping: Configure Click | Click Configure | No visible toast feedback |
| 27 | ⚠️ WARN | Scraping: Run Scrape Click | Click Run Scrape Now | No visible toast feedback |
| 28 | ✅ PASS | Venue Management: Section | Section exists | Venue Management section visible |
| 29 | ✅ PASS | Venue Management: Cards | Cards rendered | 12 venue cards displayed |
| 30 | ✅ PASS | Venue Management: Default Limit | Check default card count | Shows 12 cards by default (correct limit) |
| 31 | ✅ PASS | Venue Management: Search | Search input exists | Search venues input present |
| 32 | ✅ PASS | Venue Management: Filters | Filter dropdowns | 2 filter dropdown(s) present |
| 33 | ✅ PASS | Venue Card: Name | Check name | First venue: "Avant Life Church Squamish" |
| 34 | ✅ PASS | Venue Card: Address | Check address | Address: "38027 Cleveland Ave" |
| 35 | ✅ PASS | Venue Card: Category | Check category badge | Category: "Churches & Religious" |
| 36 | ✅ PASS | Venue Card: Edit Buttons | Edit buttons present | 36 edit buttons across 12 cards |
| 37 | ✅ PASS | Venue Card: Impersonate Buttons | Impersonate buttons present | 12 impersonate buttons |
| 38 | ✅ PASS | Venue Card: Delete Buttons | Delete buttons present | 12 delete buttons |
| 39 | ✅ PASS | Venue Search: Filter | Type "Oxygen" | Found 2 results including "Oxygen Yoga & Fitness" |
| 40 | ✅ PASS | Venue Search: Clear | Clear search | 12 venues shown after clearing |
| 41 | ✅ PASS | Category Filter: Options | Check options | Options: [All Categories, Fitness, Martial Arts, Arts & Culture] |
| 42 | ⚠️ WARN | Category Filter: Functionality | Filter may be non-functional | The category and status filter <select> elements do not have onChange handlers in the source code - they are rendered bu |
| 43 | ✅ PASS | Edit Modal: Opens | Click edit button | Edit Business modal opened |
| 44 | ✅ PASS | Edit Modal: Fields | Check input count | 6 input fields: Business Name, Address, Phone, Email, Website, Category |
| 45 | ✅ PASS | Edit Modal: Business Name Field | Field exists | Business Name input present |
| 46 | ✅ PASS | Edit Modal: Address Field | Field exists | Address input present |
| 47 | ✅ PASS | Edit Modal: Phone Field | Field exists | Phone input present |
| 48 | ✅ PASS | Edit Modal: Email Field | Field exists | Email input present |
| 49 | ✅ PASS | Edit Modal: Website Field | Field exists | Website input present |
| 50 | ✅ PASS | Edit Modal: Category Field | Field exists | Category input present |
| 51 | ✅ PASS | Edit Modal: Pre-populated | Check pre-fill | Name field pre-populated with "Avant Life Church Squamish" |
| 52 | ✅ PASS | Edit Modal: Close (X) | X button exists | Close button present |
| 53 | ✅ PASS | Edit Modal: Cancel Button | Cancel button exists | Cancel button present |
| 54 | ✅ PASS | Edit Modal: Save Button | Save button exists | Save Changes button present |
| 55 | ✅ PASS | Edit Modal: Input Typing | Type in name field | Text accepted and visible: "Test QA Business" |
| 56 | ✅ PASS | Edit Modal: Cancel Close | Click Cancel | Modal closed |
| 57 | ✅ PASS | Edit Modal: Overlay Close | Click outside modal | Modal closed by clicking overlay |
| 58 | ✅ PASS | Edit Modal: ESC Close | Press Escape key | Modal closed via ESC |
| 59 | ✅ PASS | Impersonation: Search Input | Input exists in header | "View as business..." search input present |
| 60 | ✅ PASS | Impersonation: Dropdown | Type "Gr" in search | Dropdown appeared with 8 results: Ajay Thomas Photography, LivWell Integrated Health, Squamish Dental Group |
| 61 | ✅ PASS | Impersonation: Avatar | Check result styling | Avatar initial shown in results |
| 62 | ✅ PASS | Impersonation: Banner | Check banner | Impersonation banner visible for "Ajay Thomas Photography" |
| 63 | ✅ PASS | Impersonation: Admin View Label | Check label | "Admin View:" label present |
| 64 | ✅ PASS | Impersonation: Mode Badge | Check badge | "Impersonation Mode" badge visible |
| 65 | ✅ PASS | Impersonation: Exit Button | Check exit button | "Exit Business View" button present |
| 66 | ✅ PASS | Impersonation: View Switch | Check active tab | Switched to Business view |
| 67 | ✅ PASS | Impersonation: Exit | Click Exit Business View | Returned to Admin Dashboard |
| 68 | ✅ PASS | Quick Add: Section | Section exists | Quick Add Class/Event section visible |
| 69 | ✅ PASS | Quick Add: Field Count | Check fields | 6 fields: Class Title, Venue, Start Time, Duration, Price, Recurrence |
| 70 | ✅ PASS | Quick Add: Submit Button | Check Add button | "Add Class" button present |
| 71 | ✅ PASS | Quick Add: Venue Options | Check dropdown options | 51 venue options in dropdown |
| 72 | ⚠️ WARN | Quick Add: Empty Validation | Submit empty form | No visible validation message for empty submission |
| 73 | ✅ PASS | Quick Add: Title Input | Type in title | Input accepts text: "QA Test Class" |
| 74 | ⚠️ WARN | Header: Settings Button | Click Settings | No toast feedback visible |
| 75 | ⚠️ WARN | Header: Add Venue Button | Click Add Venue | No toast feedback visible |
| 76 | ⚠️ WARN | Header: Placeholder Actions | Settings and Add Venue functionality | Both Settings and Add Venue buttons show toast messages and do not perform real actions yet |
| 77 | ❌ FAIL | Responsive: Mobile 375px | No horizontal scroll | Body scrollWidth: 704px > viewport: 375px |
| 78 | ✅ PASS | Responsive: Tablet 768px | No horizontal scroll | Layout fits tablet viewport |
| 79 | ✅ PASS | Responsive: Desktop 1440px | Desktop viewport | Admin view renders correctly at full width |
| 80 | ✅ PASS | Console Errors: Final | No critical JS errors | Zero critical errors across all admin view interactions (2 non-critical) |
| 81 | ⚠️ WARN | Console: Non-Critical | Non-critical console messages | 2 messages: Error fetching business inbox: JSHandle@object; Error fetching analytics: JSHandle@object |
| 82 | ⚠️ WARN | Source: Hardcoded Scraping Data | Code analysis | The scraping dashboard (lines 15589-15612 of App.jsx) uses a hardcoded array of activity log entries and static values,  |
| 83 | ⚠️ WARN | Source: Filter Dropdowns Non-Functional | Code analysis | The Category and Status filter <select> elements in Venue Management (lines 15627-15638 of App.jsx) have no onChange han |
| 84 | ⚠️ WARN | Source: Delete Uses Soft Delete | Code analysis | The delete button sets status to "inactive" rather than actually deleting the record, which is good practice but should  |
| 85 | ⚠️ WARN | Source: Placeholder Buttons | Code analysis | Settings button, Add Venue button, Configure button, and Run Scrape Now button all show toast messages with "coming soon |

## Screenshots
- `/tmp/qa-admin-01-initial-load.png`
- `/tmp/qa-admin-02-after-admin-inject.png`
- `/tmp/qa-admin-03-admin-view.png`
- `/tmp/qa-admin-04-admin-stats.png`
- `/tmp/qa-admin-05-venue-management.png`
- `/tmp/qa-admin-06-venue-search.png`
- `/tmp/qa-admin-07-edit-venue-modal.png`
- `/tmp/qa-admin-08-impersonation-active.png`
- `/tmp/qa-admin-09-impersonation-exit.png`
- `/tmp/qa-admin-10-quick-add.png`
- `/tmp/qa-admin-11-mobile-375.png`
- `/tmp/qa-admin-12-tablet-768.png`
- `/tmp/qa-admin-13-desktop-1440.png`

## Test Environment
- **URL**: http://localhost:5173/
- **Viewports tested**: 375px (mobile), 768px (tablet), 1440px (desktop)
- **Tool**: Puppeteer (headless Chromium)
- **Date**: 2026-02-08T14:26:43.828Z
- **Admin access method**: React fiber state injection (set user.isAdmin=true)

## Visual Verification (Screenshots Reviewed)

All 13 screenshots were taken and visually inspected:

1. **Admin Dashboard (desktop 1440px)**: Renders cleanly with blue gradient header, 4 stat cards in a row, scraping system section with 4 info cards, and activity log with success/error labels. All text readable, no overlapping elements, no placeholder text visible. The "Add V..." button text is truncated at 1440px due to the search bar taking significant space.

2. **Venue Management**: Cards display in a 3-column grid at desktop. Each card shows avatar initial, venue name, address, category badge, class count, and 3 action buttons (edit/impersonate/delete). Visually consistent styling.

3. **Venue Search**: Typing "Oxygen" correctly filters to 2 results (Oxygen Yoga & Fitness and Oxygen Yoga & Fitness Squamish). Cards resize smoothly.

4. **Edit Business Modal**: Centered overlay modal with gradient header, edit icon, and 6 labeled form fields all pre-populated with the venue's current data. Cancel and Save Changes buttons clearly visible. Modal visually prevents interaction with background.

5. **Impersonation Mode**: Orange/amber impersonation banner appears at the top of the business view with "Admin View: [Business Name]", "IMPERSONATION MODE" badge, and "Exit Business View" button. The business dashboard below shows the impersonated business's analytics (all zeros for a new business). Clean, professional appearance.

6. **Quick Add Class/Event**: 6 fields in a clean grid layout with placeholder text. "Add Class" button spans full width with gradient styling.

7. **Mobile 375px**: FAILS -- The admin dashboard does NOT have a mobile-responsive layout. Stat cards stack but are too wide, the admin header buttons overflow, and the venue management grid is single-column but still causes horizontal scroll. Filter dropdowns are not visible (hidden by overflow).

8. **Tablet 768px**: Passes -- Layout adapts reasonably. Venue cards appear in a single-column layout with full-width cards. Scraping cards wrap appropriately. Activity log entries are readable with success/error badges.

## Admin View Architecture Notes
- Admin access is controlled by `is_admin` boolean flag in the Supabase `profiles` table
- The Admin tab in the view switcher only renders when `user.isAdmin === true` (line 10539 of App.jsx)
- Admin view features: Dashboard stats, Web Scraping System, Venue Management (CRUD), Impersonation, Quick Add Class/Event
- Admin Panel Modal (accessible via profile menu) provides submission review (Pending/Approved/Rejected tabs)
- Impersonation switches to Business view with a banner showing admin is viewing as another business
- ESC key exits impersonation mode (dedicated effect at line 8646)
- Venue edit uses Supabase `.update()` and refetches services list after successful update
- Quick Add inserts directly to Supabase `events` table with tag `admin-added`
- Delete is soft-delete: sets `status: 'inactive'` on the business record
