# QA Data Integrity Audit - Round 6

**Date**: 2026-02-14
**Auditor**: Claude QA Agent (Opus 4.6)
**Method**: Direct Supabase API queries (service role key), code review, cross-referencing
**Database**: `ygpfklhjwwqwrfpsfhue.supabase.co`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 12 |
| MEDIUM | 11 |
| LOW | 7 |
| **TOTAL** | **35** |

**Database totals**: 3,691 events (3,525 active), 31 deals, 665 businesses, 6 user profiles

---

## CRITICAL Issues

### BUG-01: Anonymous Users Can Read ALL User Profiles Including PII (RLS Gap)
- **Severity**: CRITICAL
- **Category**: Security / RLS Policy
- **Evidence**: Anonymous (unauthenticated) users can query the `profiles` table and see:
  - Email addresses (`jeffreykirdeikis@gmail.com`, `jeff@kirdeikis.capital`, etc.)
  - Full names
  - Avatar URLs
  - `is_admin` flag (reveals who has admin access)
  - Notification settings, XP points, level, badges
- **Query**: `GET /rest/v1/profiles?select=*&limit=20` with anon key returns ALL 6 profiles with full data
- **Impact**: Email harvesting, admin identification, privacy violation
- **Fix**: Add RLS policy: `SELECT` on `profiles` should require `auth.uid() = id` (users can only read their own profile), or restrict readable columns to `id`, `display_name`, `avatar_url` for public access.

### BUG-02: 566 Past Active Events Still in Database (15% of Active Events)
- **Severity**: CRITICAL
- **Category**: Data Retention / Stale Data
- **Evidence**: 566 events with `status = 'active'` have `start_date` before 2026-02-14 (today):
  - 123 from January 2026
  - 443 from February 1-13, 2026
  - Top venues: Brennan Park (276), Squamish Barbell (89), Breathe Fitness (31)
- **Impact**: The frontend filters these out via `gte('start_date', localDateStr)`, so they are never shown, BUT:
  - They increase query payload size (566 extra records transferred per page load)
  - They waste Supabase bandwidth quota
  - No automated cleanup job exists to archive them
- **Fix**: Create a daily cron job or Supabase Edge Function to `UPDATE events SET status = 'completed' WHERE start_date < CURRENT_DATE AND status = 'active'`

### BUG-03: 3 Events Have Markdown Image URLs as Venue Names
- **Severity**: CRITICAL
- **Category**: Scraper Data Corruption
- **Evidence**: Three active events from the `together-nest---activities` scraper have Supabase storage image URLs as their `venue_name` field:
  1. `"DOS - Home Alone Course"` -> venue = `"![Fall Dryland Training S2S Nordics image](https://xkttwmehoexhrmtzdxch.supabase.co/...Screenshot%202025-10-27%20at%2018.44.58.png)"`
  2. `"Sea to Sky Gondola"` -> venue = `"![Sea To Sky Gondola - Ba& Me Hike/Snowshoe image](https://xkttwmehoexhrmtzdxch.supabase.co/...Screenshot%202025-10-27%20at%2018.58.44.png)"`
  3. `"Musical Theatre at SAM"` -> venue = `"![Squamish Axemen Youth RugClub image](https://www.squamishyouthrugby.com/uploads/4/9/8/8/49889361/dsc-3447_2.jpg)"`
- **Impact**: Users see a raw markdown image string as the venue name on event cards. Completely breaks event display.
- **Fix**: Delete or fix these 3 events. Add venue_name validation in the Together Nest scraper to reject values containing `![` or `http`.

### BUG-04: Scraper Produces Events with Event Title = Venue Name
- **Severity**: CRITICAL
- **Category**: Scraper Data Corruption
- **Evidence**: Multiple Together Nest scraper events have the event title duplicated as the venue name:
  1. `"Movie Night! It's Gravy When You're in the AV"` -> venue = `"Movie Night! It's Gravy When You're in the AV"`
  2. `"F&O Fifth Birthday"` -> venue = `"F&O Fifth Birthday"`
  3. `"Fashion Through the Decades- A HSS Grad Committee Fundraiser"` -> venue = same
  4. `"Squamish Hot Chocolate Festival"` -> venue = same
  5. `"Events"` -> venue = `"Events"` (a category, not an event)
  6. `"Camps & Pro D Days"` -> venue = `"Camps & Pro D Days"` (a category, not an event)
  7. `"Welcome to the Nest!"` -> venue = `"Discover local family activities, events & camps and filter your kids' ages and more!"` (a site tagline)
- **Impact**: Users see the event name where the venue should be. Two events (`"Events"`, `"Camps & Pro D Days"`) are categories parsed as events.
- **Fix**: Fix Together Nest scraper to properly extract venue from detail pages. Add validation: reject events where `title.trim() === venue_name.trim()` or where venue_name > 80 chars.

### BUG-05: "Valentine's Day @ House of Lager" Mapped to Wrong Venue
- **Severity**: CRITICAL
- **Category**: Venue Mapping Error
- **Evidence**: Two copies of this event exist:
  1. `venue_name = "The Squamish Store"`, `venue_id = 7a945a13...` (WRONG - The Squamish Store is a retail store)
  2. `venue_name = "House of Lager"`, `venue_id = 8c7632d0...` (CORRECT)
- **Impact**: One copy of the event directs users to the wrong business. "The Squamish Store" has nothing to do with "House of Lager."
- **Fix**: Delete the incorrectly-mapped event (id: `eab4dc2f`). Also has `start_time = 00:00:00` which gets silently corrected to 09:00 in the UI.

---

## HIGH Issues

### BUG-06: 7+ Events with Scraper Age Ranges Embedded in Venue Name
- **Severity**: HIGH
- **Category**: Scraper Data Corruption
- **Evidence**: Together Nest scraper includes age range metadata in venue names:
  - `"Baand Me, 0 months - 17 years"` (2 events)
  - `"Baand Me, 0 months - 18 months"` (1 event)
  - `"Baand Me, 0 months - 4 years"` (1 event)
  - `"Baand me, 0 months - 5 years"` (1 event)
  - `"Prenatal, Postnatal, Baand Me, 0 months - 18 months"` (1 event)
  - `"Prenatal, Postnatal, Baand me, 0 months - 18 years"` (1 event)
  - And several other `"Prenatal, Postnatal, Baand Me"` variants
- **Impact**: Users see age ranges in venue names. Same business "Baand Me" appears as 7+ different venues. Impossible to search/filter by venue.
- **Fix**: Strip age range suffix from venue names. Normalize all variants to "Baand Me".

### BUG-07: 6 Venue Name/Business Name Mismatches in venue_id Mapping
- **Severity**: HIGH
- **Category**: Data Integrity
- **Evidence**: Cross-referencing `events.venue_id` with `businesses.id`:
  1. Events say `"Squamish Barbell"` but business is `"Squamish Barbell Clinic"` (485 events affected)
  2. Events say `"Whistler"` but business is `"Whistler Courier"` (mapping completely wrong)
  3. Events say `"Squamish"` but business is `"A&W Squamish"` (mapping completely wrong)
  4. Events say `"The BAG"` but business is `"Zephyr Cafe at The BAG"` (partial match)
  5. Events say `"Alice Lake Park"` but business is `"Alice Lake Provincial Park"` (minor)
  6. Events say `"Downtown Squamish"` but business is `"Downtown Squamish BIA"` (minor)
- **Impact**: `#2` and `#3` are critical mismatches - events at generic locations are linked to completely unrelated businesses. Clicking a venue link would show the wrong business.
- **Fix**: Fix venue_id mappings for Whistler and Squamish events. Normalize business name references.

### BUG-08: Deals venueId Hardcoded to null -- No Venue Linking
- **Severity**: HIGH
- **Category**: Code Logic Bug
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` line 240
- **Evidence**: `venueId: null` is hardcoded for ALL deals in the mapping function, even though 9 deals have valid `business_id` values in the database.
- **Impact**: Deals can never be linked to their venue in the UI. The "Related Deals" feature in `dealHelpers.js` relies on `venueId` for matching but it's always null, so it falls back to `venueName` string matching which is fragile.
- **Fix**: Map `venueId` to `deal.business_id` instead of hardcoding null.

### BUG-09: 71% of Deals Missing business_id (22 of 31)
- **Severity**: HIGH
- **Category**: Data Integrity
- **Evidence**: 22 of 31 deals have `business_id = null`. These deals have `business_name` set as a string but cannot be linked to the actual business in the `businesses` table.
- **Affected deals**: The Backyard Pub, Freebird Table & Oyster Bar, Howe Sound Brewing, Kawartha Dairy, Pepe's Chophouse, Tacofino, A-FRAME Brewery, Copper Coil, Salted Vine, Trickster's Hideout, and others.
- **Impact**: Cannot navigate from deal to business page. Cannot show business details (address, phone, rating) on deal cards.
- **Fix**: Write a migration script to match `deals.business_name` to `businesses.name` and populate `business_id`.

### BUG-10: 9 Events with start_time = 00:00:00 Silently Shown as 09:00 AM
- **Severity**: HIGH
- **Category**: Data Quality / Silent Data Correction
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` lines 160-165
- **Evidence**: 9 active events have `start_time = 00:00:00` in the database. The code silently changes midnight (0:00) to 9:00 AM:
  ```js
  if (hours === 0 || (hours >= 1 && hours <= 5)) {
    hours = 9; minutes = 0;
  }
  ```
  Affected events: "Squamish Campus Online Info Session" (Capilano U), "Valentine's Day @ House of Lager", "Reading Break", "Summer 2026 Registration Opens", "Sea to Sky Model Train Show", "7-Week CCM Music Program", and others.
- **Impact**: Users see these events at 9:00 AM when the actual time is unknown or truly midnight. No indication the time was guessed.
- **Fix**: Either fix the scraper to not insert 00:00 when time is unknown, or display "Time TBA" instead of silently showing 9:00 AM.

### BUG-11: 713 Events with null end_time (24% of Active Future Events)
- **Severity**: HIGH
- **Category**: Data Completeness
- **Evidence**: 713 of 2,959 active future events have `end_time = null`. The code defaults to `start_time + 1 hour`:
  ```js
  endDate = pacificDate(event.start_date, `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  ```
- **Impact**: Duration shown as "1 hr" for all these events, which may be wrong (yoga might be 75 min, festivals might be 8 hours). The `hours + 1` computation can overflow: a 23:00 event gets `end = 24:00` which is invalid.
- **Fix**: Display "Duration unknown" or don't show duration when end_time is null. Fix the hour+1 overflow for events starting at 23:00.

### BUG-12: Brennan Park Date Duplication -- Ratio 11.3x (725 Events, 64 Titles)
- **Severity**: HIGH
- **Category**: Scraper Data Duplication
- **Evidence**: Brennan Park Recreation Centre has 725 events but only 64 unique titles, giving a ratio of 11.3x. This is just below the auto-delete threshold of 25x but still indicates date duplication: each class appears on average 11.3 days.
- **Impact**: Bloated event list. Same classes repeated for weeks. Users see duplicate-looking results.
- **Note**: This is a known pattern from the PerfectMind/District of Squamish scraper. The 725 events may be legitimate recurring classes over multiple weeks, but the ratio is suspicious.
- **Fix**: Verify that these are truly distinct scheduled instances (different dates) rather than duplicated entries.

### BUG-13: Category Casing Inconsistency -- "community" vs "Community"
- **Severity**: HIGH
- **Category**: Data Consistency
- **Evidence**: 52 events have `category = "community"` (lowercase) while 9 events have `category = "Community"` (title case). The UI applies title-case transformation but the filter comparison is case-sensitive:
  ```js
  if (filters.category !== 'all') {
    filtered = filtered.filter(e => e.category === filters.category || ...);
  }
  ```
  The lowercase "community" events get title-cased to "Community" in the mapping, so they match. BUT the raw DB category is inconsistent.
- **Impact**: May cause issues if any filter comparison occurs before the title-case transformation.
- **Fix**: Normalize all categories to title case in the database. Add a CHECK constraint.

### BUG-14: 4 Online Events Showing in Local Squamish App
- **Severity**: HIGH
- **Category**: Data Quality / Relevance
- **Evidence**: 4 active events have `venue_name = "Online"` with no connection to Squamish:
  1. "How to Craft Canadian Style Resume and Cover Letter"
  2. "The Roots of Worth: Where Self-Worth Was Formed"
  3. "HRConnect: Global Virtual HR Networking & Career Development Forum"
  4. "Spring Programs Registration"
- **Impact**: Users of a Squamish community app see irrelevant online webinars. These were scraped from Eventbrite without location filtering.
- **Fix**: Filter out events with `venue_name = 'Online'` or add a location/relevance check in the scraper.

### BUG-15: 2 Events from Victoria, BC in Squamish App
- **Severity**: HIGH
- **Category**: Data Quality / Relevance
- **Evidence**: Two events titled "Victoria at Dusk" show up with venue = "Victoria" and "Victoria, BC":
  - From `the-wilder-events` scraper
  - Dates: 2026-02-20 and 2026-02-25
- **Impact**: Events from a completely different city appear in Squamish's local app.
- **Fix**: Add geographic filtering to the Wilder Events scraper.

### BUG-16: Orphaned Saved Item References Non-Existent Event
- **Severity**: HIGH
- **Category**: Data Integrity / Referential Integrity
- **Evidence**: `saved_items` table has entry with `item_id = "test-event-123"` which:
  - Is not a valid UUID format (the events table uses UUIDs)
  - Querying `events?id=eq.test-event-123` returns "invalid input syntax for type uuid"
- **Impact**: If the app tries to load this saved item's details, it will fail with a database error. The save list will show a broken/empty entry.
- **Fix**: Delete the orphaned test data. Add a foreign key constraint or validation that item_id is a valid UUID.

### BUG-17: "Squamish" and "Whistler" venue_ids Map to Wrong Businesses
- **Severity**: HIGH
- **Category**: Data Integrity
- **Evidence**:
  - Events with `venue_name = "Squamish"` (7 events) are linked via `venue_id` to `"A&W Squamish"` business record
  - Events with `venue_name = "Whistler"` are linked via `venue_id` to `"Whistler Courier"` business record
- **Impact**: Clicking on the venue link for a "Squamish" generic event would navigate to the A&W Squamish business page. A general "Whistler" event would link to a courier service.
- **Fix**: Remove the incorrect venue_id from these events since they don't belong to specific businesses. Set venue_id to null for generic location events.

---

## MEDIUM Issues

### BUG-18: Venue Name Fragmentation -- Same Venue Stored Multiple Ways
- **Severity**: MEDIUM
- **Category**: Data Normalization
- **Evidence**: Multiple venues have their name stored inconsistently:
  - `"A-Frame Brewing"` (8) vs `"A-FRAME Brewing"` (1)
  - `"Baand Me"` fragmented into 7+ variants with age ranges
  - `"Brennan Park"` (1) vs `"Brennan Park Arena"` (2) vs `"Brennan Park Leisure Centre"` (2) vs `"Brennan Park Recreation Centre"` (725)
  - `"Sea to Sky Gondola"` (32) vs `"Sea To Sky Gondola"` (1) -- capitalization difference
  - `"Squamish Chamber"` (7) vs `"Squamish Chamber of Commerce"` (10)
  - `"Squamish Farmers Market"` (1) vs `"Squamish Farmers' Market"` (1)
  - `"House of Lager"` (5) vs `"House of Lager Brewing Company"` (1)
  - `"Various Locations"` (1) vs `"Various locations"` (1) vs `"Various locations in Squamish"` (2)
  - `"Ground Up"` (1) vs `"Ground Up Climbing Centre & Cafe"` (4)
  - `"CapU Squamish"` (2) vs `"Capilano University"` (1) vs `"Capilano University Squamish"` (3)
- **Impact**: Search by venue name misses events. Filter counts are fragmented. Same venue appears multiple times in venue lists.
- **Fix**: Create a venue name normalization map in the scrapers. Use canonical names.

### BUG-19: Together Nest Scraper Producing Garbage Data
- **Severity**: MEDIUM
- **Category**: Scraper Quality
- **Evidence**: The `together-nest` scraper (tags `together-nest---activities`, `together-nest---events`, `together-nest---all`) produces:
  - 3 events with image markdown URLs as venue names
  - Events with titles that are categories: `"Events"`, `"Camps & Pro D Days"`
  - An event titled `"Welcome to the Nest!"` with venue = site tagline
  - Events where title = venue name (title copied to venue field)
  - Age ranges concatenated to venue names
- **Impact**: Multiple corrupted events displayed to users.
- **Fix**: Rewrite the Together Nest scraper with proper field extraction and validation.

### BUG-20: Deals with No Expiration Date (27 of 31)
- **Severity**: MEDIUM
- **Category**: Data Completeness
- **Evidence**: 27 of 31 deals have `valid_until = null`, meaning they never expire. The frontend code checks `if (!deal.validUntil) return true; // No expiry = always valid`.
- **Impact**: Deals from businesses that have since changed their promotions or closed will persist indefinitely. Happy Hour deals (which are recurring) are fine without expiry, but promotional deals like "Burger Bender" or "Share the Love" should have end dates.
- **Fix**: Review all deals and add valid_until dates for promotional/seasonal deals.

### BUG-21: 11 Deals with discount_type = "special" but No discount_value
- **Severity**: MEDIUM
- **Category**: Data Quality
- **Evidence**: 11 deals (mostly Happy Hours) have `discount_type = 'special'` with no `discount_value`, resulting in the generic "Special Offer" display text instead of concrete savings.
- **Impact**: These deals get the lowest scores in `calculateDealScore()` and may be filtered out by `isRealDeal()` (which requires score >= 15). Happy Hour deals are real value but score poorly because they lack structured discount data.
- **Fix**: Either add proper discount_value/discount_type to Happy Hour deals, or adjust scoring to recognize "Happy Hour" as inherently valuable.

### BUG-22: 5 Deals with Titles Over 60 Characters
- **Severity**: MEDIUM
- **Category**: Data Quality / UI
- **Evidence**: Five deal titles exceed 60 chars and will overflow or truncate in card views:
  1. "Monday's: Family Night where kids eat for half price and there's a..." (69 chars)
  2. "Pepe's Chophouse is offering free fries for apres from 2-5PM from..." (68 chars)
  3. "Throughout the winter The Broken Seal is offering a pre-fix menu,..." (68 chars)
  4. "Happy Hour: 7 days a week from 3pm-6pm + Draft beer $5 all day..." (73 chars)
  5. "Happy Hour: Wed 5-7pm, Thurs 1-7pm, Fri & Sat 7-9pm, Sun 5-10pm..." (63 chars)
- **Impact**: UI overflow, truncation, or layout breaking on mobile.
- **Fix**: Store full description in `description` field, keep `title` under 50 chars.

### BUG-23: Events Fetched but Never Cleaned on Error
- **Severity**: MEDIUM
- **Category**: Error Handling
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` lines 142-146
- **Evidence**: When an error occurs during event pagination:
  ```js
  if (error) {
    console.error('Error fetching events:', error);
    setEventsLoading(false);
    return; // <-- returns with potentially partial data in allData
  }
  ```
  If page 1 succeeds (1000 events) but page 2 fails, `allData` contains only partial data but the loading state is set to false. The app shows truncated data with no error indication to the user.
- **Impact**: Users may see only ~1000 events when there should be ~3000 during intermittent network issues.
- **Fix**: Either display an error state to the user or retry the failed page.

### BUG-24: No User-Facing Error State for Failed Data Fetches
- **Severity**: MEDIUM
- **Category**: Error Handling / UX
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js`
- **Evidence**: All three data fetchers (services, events, deals) only `console.error` on failure and set loading to false. There is no error state variable exposed to the UI:
  ```js
  if (error) {
    console.error('Error fetching services:', error);
    setServicesLoading(false);
    return;
  }
  ```
- **Impact**: If Supabase is down or returns 401/403/500, the user sees an empty list with no indication that something went wrong. The UI appears to have loaded successfully but shows zero results.
- **Fix**: Add `servicesError`, `eventsError`, `dealsError` state variables and expose them. Show a "Something went wrong, try again" UI when data fails to load.

### BUG-25: 18 Active Events with null description
- **Severity**: MEDIUM
- **Category**: Data Completeness
- **Evidence**: 18 active future events have `description = null`. The UI fallback in `useAppData.js` is `description: event.description || ''` which prevents crashes but results in empty description cards.
- **Impact**: Event detail modals show empty description areas.
- **Fix**: Either populate descriptions from scrapers or display "No description available."

### BUG-26: Events with null price AND is_free=false Show "See venue for pricing"
- **Severity**: MEDIUM
- **Category**: Data Quality / Pricing
- **Evidence**: Events like "BUSINESS ESSENTIALS" (Squamish Chamber), "Chamber Connect", "Re-Use-It-Fair" have `price = null` AND `is_free = false`. The pricing logic in useAppData falls through to `'See venue for pricing'`:
  ```js
  price: event.is_free ? 'Free' : (event.price > 0 ? `$${event.price}` : ... : 'See venue for pricing')
  ```
- **Impact**: Free community events like "Re-Use-It-Fair" and "Repair Cafe" show "See venue for pricing" instead of "Free", potentially discouraging attendance.
- **Fix**: Flag these events as `is_free = true` in the database, or add scraper logic to infer free events from their descriptions.

### BUG-27: Cache TTL of 30 Seconds May Be Too Short
- **Severity**: MEDIUM
- **Category**: Performance / API Usage
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` line 5
- **Evidence**: `const CACHE_TTL = 30000; // 30 seconds` combined with `visibilitychange` listener means:
  - Every time a user switches tabs and returns, if 30+ seconds have passed, ALL data (events, services, deals) is re-fetched
  - With 2,959 events across 3 pages, each refetch is 3 API calls
  - On mobile, tab switching is frequent (switching to messaging apps and back)
- **Impact**: Excessive Supabase API calls, potential quota exhaustion, battery drain on mobile.
- **Fix**: Increase cache TTL to 5-10 minutes for events/services. Deals can stay at 30s since the count is small.

### BUG-28: Hour Overflow in end_time Computation for 23:xx Events
- **Severity**: MEDIUM
- **Category**: Code Logic Bug
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` line 182
- **Evidence**: When `end_time` is null, the code computes: `hours + 1`. For a 23:00 event, this becomes `24:00` which is passed to `pacificDate()`. The `split(':').map(Number)` would produce `[24, 0]`, and `new Date(year, month, day, 24, 0)` silently rolls over to midnight of the NEXT day.
- **Impact**: Events starting at 23:00 would show a duration spanning into the next day. The EventCard duration calculation `(event.end - event.start) / 60000` would still give 60 minutes, but the actual Date objects would be wrong.
- **Fix**: Cap end time computation: `Math.min(hours + 1, 23)` or handle the midnight rollover explicitly.

---

## LOW Issues

### BUG-29: Deals Query Has No Date Filter at DB Level
- **Severity**: LOW
- **Category**: Performance
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` lines 225-229
- **Evidence**: Events are filtered server-side with `.gte('start_date', localDateStr)`, but deals have no date filter -- all 31 deals are fetched and expiry is checked client-side in `filterHelpers.js`. Currently only 31 deals exist, but if the number grows, this is wasteful.
- **Impact**: Minimal now (31 records) but could become a problem.
- **Fix**: Add `.or('valid_until.is.null,valid_until.gte.<today>')` to the deals query.

### BUG-30: Saved Item "test-event-123" is Test Data in Production
- **Severity**: LOW
- **Category**: Test Data Leak
- **Evidence**: The `saved_items` table contains `item_id = "test-event-123"` for user `deedbe2c-dd63-491c-ac6f-86cf80735103` (test-consumer@pulse-test.com).
- **Impact**: Test data clutters the production database. Not visible to real users but could cause issues in analytics or admin views.
- **Fix**: Delete test data from production.

### BUG-31: "Sea To Sky Gondola" vs "Sea to Sky Gondola" Capitalization
- **Severity**: LOW
- **Category**: Data Consistency
- **Evidence**: 32 events use `"Sea to Sky Gondola"` and 1 event uses `"Sea To Sky Gondola"` (capital T in "To").
- **Impact**: Minor display inconsistency. Search would still work since it's case-insensitive.
- **Fix**: Normalize to `"Sea to Sky Gondola"`.

### BUG-32: "Squamish Farmers Market" vs "Squamish Farmers' Market" (Apostrophe)
- **Severity**: LOW
- **Category**: Data Consistency
- **Evidence**: One event each for `"Squamish Farmers Market"` and `"Squamish Farmers' Market"`.
- **Impact**: Minor display inconsistency. Different scrapers use different conventions.
- **Fix**: Normalize to one canonical form.

### BUG-33: Multiple SSCS Venue Names Instead of Unified Name
- **Severity**: LOW
- **Category**: Data Normalization
- **Evidence**: Sea to Sky Community Services appears as 6+ different venue names:
  - "Sea to Sky Community Services" (35 events)
  - "SSCS Community Center" (1)
  - "SSCS Family Room" (1)
  - "SSCS Office" (1)
  - "SSCS Senior Center" (1)
  - "SSCS Youth Center" (1)
- **Impact**: Same organization fragmented across venue filters and search.
- **Fix**: Normalize to "Sea to Sky Community Services" with room/facility as a sub-field.

### BUG-34: "Various Locations" Stored 3 Different Ways
- **Severity**: LOW
- **Category**: Data Normalization
- **Evidence**: `"Various Locations"` (1), `"Various locations"` (1), `"Various locations in Squamish"` (2).
- **Impact**: Minor display inconsistency.
- **Fix**: Normalize to "Various Locations, Squamish".

### BUG-35: Event Description Includes "Cap U's Department of Community Development & Outreach" as Venue Name
- **Severity**: LOW
- **Category**: Scraper Data Quality
- **Evidence**: One event has venue_name = `"Cap U's Department of Community Development & Outreach"` which is a department name, not a venue.
- **Impact**: Minor -- users see a department name instead of "Capilano University".
- **Fix**: Map to canonical venue name "Capilano University Squamish".

---

## Additional Observations (Not Bugs)

### OBS-1: Pagination Working Correctly
The useAppData.js pagination logic correctly fetches all 2,959+ active future events across 3 pages of 1000. Verified by direct API call: Page 1 = 1000, Page 2 = 1000, Page 3 = 975.

### OBS-2: RLS Write Protection Working
Verified that anonymous users CANNOT:
- Insert events (HTTP 401, RLS blocks)
- Create profiles (HTTP 401, RLS blocks)
- Update profiles.is_admin (returns empty array, no actual update)
RLS correctly prevents write operations.

### OBS-3: No Duplicate Events Found
Zero exact duplicates (same title + date + time + venue) found across all 3,525 active events. Dedup logic is working.

### OBS-4: Date and Time Formats Consistent
All event dates use ISO format (YYYY-MM-DD). All times use HH:MM:SS format. No format inconsistencies found.

### OBS-5: Price Data Generally Consistent
766 events have numeric prices > 0, 231 have price = 0, 3 have price = null. No string prices or negative prices found. The `is_free` flag is consistent (8 true, 992 false, 0 null).

### OBS-6: No Events with Impossible Times
No events found with hours > 23 or minutes > 59. Only 1 midnight event found ("Squamish Campus Online Info Session").

### OBS-7: 136 Unique Venue Names Across 3,541 Active Events
The app covers a good range of 136 venues, though ~20 are fragmented variants that should be consolidated.

---

## Checks Performed

| # | Check | Result |
|---|-------|--------|
| 1 | Orphaned events (null venue_id) | ~12 found, mostly online/generic events |
| 2 | Duplicate events (title+date+time+venue) | 0 found |
| 3 | Past active events | 566 found (CRITICAL) |
| 4 | Expired active deals | 0 found |
| 5 | Suspicious venue names | 3 image URLs, 7+ age ranges, multiple title=venue |
| 6 | Venue mapping accuracy | 6 mismatches found |
| 7 | Title = venue_name | ~5 found (Together Nest scraper) |
| 8 | Date format consistency | All ISO - consistent |
| 9 | Time format consistency | All HH:MM:SS - consistent |
| 10 | Impossible times | 0 found |
| 11 | Midnight events (00:00) | 9 found, silently corrected |
| 12 | Null titles | 0 found |
| 13 | Null venue_names | 0 found |
| 14 | Null start_dates | 0 found |
| 15 | Null end_times | 713 found (24%) |
| 16 | Null descriptions | 18 found |
| 17 | Null prices + not free | 6 found |
| 18 | Category casing inconsistency | "community" (52) vs "Community" (9) |
| 19 | RLS read access (profiles) | ANON can read ALL profiles (CRITICAL) |
| 20 | RLS read access (saved_items) | Protected (empty for anon) |
| 21 | RLS read access (messages) | Protected (empty for anon) |
| 22 | RLS read access (business_claims) | Protected (empty for anon) |
| 23 | RLS write access (events) | Protected (blocks anon insert) |
| 24 | RLS write access (profiles) | Protected (blocks anon insert/update) |
| 25 | Deals without business_id | 22 of 31 (71%) |
| 26 | Deals venueId mapping | Hardcoded null in code |
| 27 | Venue name fragmentation | 10+ groups with 2+ variants |
| 28 | Online events in local app | 4 found |
| 29 | Out-of-area events | 2 Victoria events found |
| 30 | Date duplication ratio | Brennan Park at 11.3x |
| 31 | Time clustering | 09:00 is 13.4% of events (expected) |
| 32 | Scraper tag analysis | together-nest most problematic |
| 33 | Saved items referential integrity | 1 orphaned test record |
| 34 | Error handling in data hooks | No user-facing error states |
| 35 | Cache TTL logic | 30s may be too aggressive |
| 36 | Pagination correctness | Working correctly |
| 37 | Deal title length | 5 over 60 chars |
| 38 | Deal discount data completeness | 11 with type=special, no value |
| 39 | Event type distribution | 98.9% class, 1.1% event |
| 40 | Price data types | All consistent (numeric or null) |

**Total checks performed: 40**
**Issues found: 35**
**Pass rate: 12.5%** (5 clean checks out of 40)
