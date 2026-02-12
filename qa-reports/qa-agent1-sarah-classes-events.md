# QA Report: Classes & Events Sections + Low Event Count Investigation
**Agent**: Sarah (Yoga Studio Owner, First-Time User)
**Date**: 2026-02-12
**Sections Tested**: Classes Tab, Events Tab, Filter System, Event Detail Modal
**App URL**: http://localhost:5173/
**Status**: Multiple bugs found, one Critical

---

## Executive Summary

As a yoga studio owner in Squamish discovering the Pulse app for the first time, I found the Classes section to be reasonably functional with 981 classes showing under "Upcoming." However, the Events section is severely lacking with only 9-10 events visible -- but this is NOT a front-end bug, it is a data issue combined with a **critical Supabase row limit problem**. The database contains 2,608 active future events but the app only fetches the first 1,000 due to Supabase's default PostgREST row limit. Several filter bugs were identified including a weekend filter that breaks on Saturdays/Sundays, a misleading "Upcoming" label, and a midnight time handling gap.

---

## CRITICAL INVESTIGATION: Low Event Count

### Database Reality vs App Display

| Metric | Count | Source |
|--------|-------|--------|
| Total events in DB | 3,212 | `events?select=id` (all statuses) |
| Active events | 3,013 | `events?status=eq.active` |
| Active future events (from today) | 2,608 | `events?status=eq.active&start_date=gte.2026-02-12` |
| Active future events (next 30 days) | 2,130 | `...&start_date=lte.2026-03-12` |
| Active future CLASSES | 2,577 | `...&event_type=eq.class` |
| Active future EVENTS | 31 | `...&event_type=eq.event` |
| Events in next 30 days | 14 | `...&event_type=eq.event&start_date=lte.2026-03-14` |

### Daily Distribution (Next 7 Days)

| Date | Events |
|------|--------|
| 2026-02-12 (Thu) | 95 |
| 2026-02-13 (Fri) | 75 |
| 2026-02-14 (Sat) | 49 |
| 2026-02-15 (Sun) | 36 |
| 2026-02-16 (Mon) | 71 |
| 2026-02-17 (Tue) | 97 |
| 2026-02-18 (Wed) | 100 |

### Root Causes Identified

#### 1. CRITICAL: Supabase Default Row Limit (1000 rows)
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` lines 126-131
- **Issue**: The Supabase query does NOT specify `.limit()` or `.range()`. Supabase PostgREST defaults to returning a maximum of 1,000 rows. With 2,608 active future events, **1,608 events are silently dropped**.
- **Evidence**: REST API returns `content-range: 0-999/2608` (only first 1000 of 2608)
- **Impact**: Classes tab shows 981 (of 2,577 actual). Events tab is less affected since only 31 total events exist.
- **Severity**: **CRITICAL**

```javascript
// Current code (useAppData.js line 126-131):
const { data, error } = await supabase
  .from('events')
  .select('*')
  .eq('status', 'active')
  .gte('start_date', localDateStr)
  .order('start_date', { ascending: true });
// NO .limit() or .range() -- defaults to 1000 rows
```

**Fix**: Either paginate with `.range(0, 2999)` or fetch in batches, or increase the Supabase client default. Alternatively, use `.limit(5000)` if you know the upper bound.

#### 2. LOW: Only 31 Events (event_type='event') Exist
- **Issue**: The database has only 31 records with `event_type='event'`. The remaining 2,577 are `event_type='class'`. This is a data collection issue, not a code bug.
- **Evidence**: `events?event_type=eq.event&status=eq.active&start_date=gte.2026-02-12` returns 31 rows
- **Impact**: Events tab shows very few items. Community events, workshops, festivals, etc. are underrepresented.
- **Recommendation**: Increase event scraping focus on community calendars, Facebook events, Eventbrite, etc.

#### 3. MEDIUM: "Upcoming" Default Filter Hides Today's Past Events
- **File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/filterHelpers.js` lines 42-45
- **Issue**: The default "Upcoming" filter (internally `day='today'`) uses `e.start >= now`, which excludes events that started earlier today. A 6:00 AM yoga class is hidden by 6:01 AM even though the user would benefit from seeing it for future reference.
- **Contrast**: The "Anytime" filter uses `e.start >= todayMidnight`, which correctly shows all of today's events.
- **Impact**: Classes tab shows 981 with "Upcoming" vs 990 with "Anytime" (9 classes hidden).

---

## Bug Report

### BUG-001: Supabase Row Limit Silently Drops 1,608 Events [CRITICAL]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` line 126
- **Reproduction**: Open app > Classes tab shows "981 results" but DB has 2,577 active future classes
- **Expected**: All 2,577+ classes should be fetchable
- **Actual**: Only first 1,000 rows returned (Supabase default), then ~19 filtered by time = 981
- **Evidence**: REST API `content-range: 0-999/2608` vs app showing 981 results
- **Severity**: CRITICAL
- **Fix**: Add `.limit(5000)` to the query or implement pagination

### BUG-002: "This Weekend" Filter Breaks on Saturday/Sunday [HIGH]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/filterHelpers.js` lines 53-60
- **Reproduction**: Visit on a Saturday, select "This Weekend" filter
- **Expected**: Shows remaining Saturday + Sunday events
- **Actual**: Calculates `daysUntilFriday = (5 - 6 + 7) % 7 = 6`, jumping to NEXT Friday
- **Impact**: On Saturday or Sunday, "This Weekend" shows NEXT weekend instead of current weekend
- **Severity**: HIGH
- **Code**:
```javascript
const daysUntilFriday = (5 - now.getDay() + 7) % 7;
// On Saturday (day 6): (5-6+7)%7 = 6 --> next Friday
// On Sunday (day 0): (5-0+7)%7 = 5 --> next Friday
// On Friday (day 5): (5-5+7)%7 = 0 --> today (correct)
```
- **Fix**: Add special case: if `now.getDay() >= 5` (Fri/Sat/Sun), set `friday` to today's Friday or the most recent Friday.

### BUG-003: Midnight (00:00) Start Time Not Caught by Time Correction [MEDIUM]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` lines 144-149
- **Reproduction**: "Squamish Campus Online Info Session" has `start_time=00:00:00`, displays as "12:00 AM"
- **Expected**: Midnight is likely a data error (like 1-5 AM) and should be corrected
- **Actual**: Code only catches `hours >= 1 && hours <= 5`, not `hours === 0`
- **Impact**: Events with missing/default times display at midnight; hidden by "Upcoming" filter since midnight has passed
- **Severity**: MEDIUM
- **Evidence**: Screenshot of Events tab shows "12:00 AM" for this event under "Anytime" filter but it's hidden under default "Upcoming" filter

### BUG-004: "Upcoming" Label Misleading -- Actually Shows 30-Day Window [MEDIUM]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FilterSection.jsx` line 64
- **Reproduction**: Open filters, observe "Upcoming" is the default day option
- **Expected**: "Upcoming" intuitively means "coming up soon" (today/this week)
- **Actual**: Internally mapped to `day='today'` which filters `e.start >= now && e.start < now+30days`
- **Impact**: User confusion -- "Upcoming" shows events up to 30 days out, which is actually a good range, but the internal code uses `day='today'` which is confusing for developers
- **Severity**: MEDIUM (UX confusion, not data loss)

### BUG-005: "Paid" Price Filter Hides Events with Unknown Pricing [MEDIUM]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/filterHelpers.js` lines 131-135
- **Reproduction**: Select "Paid" filter on Classes tab
- **Expected**: Shows all non-free events
- **Actual**: Filter `e.price?.toLowerCase() !== 'free' && e.price` requires price to be truthy. Events with `null` price (1,403 events where `is_free=false` and `price=0`) are excluded.
- **Impact**: 1,403 events (~54% of active classes) disappear when "Paid" filter is selected
- **Evidence**: DB has 1,403 events with `is_free=false` and `price=0`, which map to `price: null` in the UI
- **Severity**: MEDIUM
- **Fix**: Change paid filter to `e.price?.toLowerCase() !== 'free'` (remove `&& e.price` requirement), or treat null-price events as "paid with unknown price"

### BUG-006: Time Slot Dropdown Shows Irrelevant "12 AM" Option [LOW]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` lines 513-539
- **Reproduction**: Open filters > look at time dropdown
- **Expected**: Time slots reflect actual class times
- **Actual**: "12 AM" appears as first option (from event with `start_time=00:00:00`). Selecting it equals "All Times" since 0 minutes >= 0.
- **Impact**: Misleading option that doesn't meaningfully filter
- **Severity**: LOW

### BUG-007: Time Slot Dropdown Not Filtered by Selected Day Range [LOW]
- **Location**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` lines 516-526
- **Reproduction**: Select "Tomorrow" day filter > open time dropdown
- **Expected**: Time slots should reflect times available for tomorrow only
- **Actual**: `getAvailableTimeSlots` only filters for `day='today'`; all other day selections show ALL time slots from ALL events (including past static events from `REAL_DATA`)
- **Impact**: Time slot dropdown shows options that don't match the selected day, potentially confusing users
- **Severity**: LOW

---

## Test Cases

### TC-001: "I want to find yoga classes this week" [PASS with caveats]
- **Steps**: Open Classes tab > Search "yoga"
- **Result**: 84 results found, including Shamanic Yoga (Shala Yoga), Hot ABSolutely Burning Butts (Oxygen Yoga), Hatha Flow (Shala Yoga)
- **Verdict**: PASS -- Search works well for yoga. Results are relevant.
- **Caveat**: Due to BUG-001, some yoga classes in later dates are missing.

### TC-002: "I want to find free kids classes" [PASS]
- **Steps**: Classes tab > Show Filters > Age: Kids > Price: Free
- **Result**: 57 results found. Age range slider appears with quick-select buttons.
- **Verdict**: PASS -- Filter combination works correctly.

### TC-003: "I want to see what's happening tomorrow morning" [PASS with caveat]
- **Steps**: Classes tab > Show Filters > Day: Tomorrow > Time: 6 AM
- **Result**: 75 results. Shows Lane Swim at 6:00 AM, Swim Clubs, etc.
- **Verdict**: PASS -- Results are for tomorrow, starting from 6 AM onward.
- **Caveat**: Time filter is ">= selected time", not a range. So "6 AM" shows everything from 6 AM to midnight.

### TC-004: "I want to see ALL classes with no filters" [PASS with CRITICAL caveat]
- **Steps**: Classes tab > Show Filters > Day: Anytime > All other filters at default
- **Result**: 990 results displayed
- **Verdict**: PARTIAL PASS -- Shows 990 but database has 2,577 (BUG-001: 1,587 classes silently dropped by Supabase row limit)

### TC-005: Events tab default view [PASS - data limited]
- **Steps**: Click Events tab
- **Result**: 9 results under default "Upcoming" filter
- **Verdict**: PASS (no code bug) -- Database only has 14 events in the next 30 days. The 9 vs 14 difference is from time-of-day filtering (midnight event hidden, past-start events hidden).

### TC-006: Events tab with Anytime filter [PASS]
- **Steps**: Events tab > Show Filters > Day: Anytime
- **Result**: 10 results (all future events from DB, limited by 1000-row cap)
- **Verdict**: PASS -- Shows 1 more event than Upcoming (the midnight event)

### TC-007: Event Detail Modal [PASS]
- **Steps**: Click on "F.I.I.T." class card
- **Result**: Modal opens with correct info -- title, venue (Mountain Fitness Center), date/time (Thu Feb 12, 7:30-8:30 AM), quick actions (Book, Save, Share, Directions), details (Age Group: All Ages, Duration: 60 min), About section, CTA buttons (Book Class, Add to Calendar, View Venue)
- **Verdict**: PASS -- All elements render correctly, layout is clean.

### TC-008: Category filter [PASS]
- **Steps**: Show Filters > Category dropdown
- **Result**: Shows 12 categories dynamically built from data: Arena Sports, Arts & Culture, Drop-In, Education, Fitness, Gymnastics, Kids Programs, Martial Arts, Recreation, Sports, Swimming, Yoga & Pilates
- **Verdict**: PASS -- Categories are data-driven, not hardcoded.

### TC-009: Search clears with filter reset [PASS]
- **Steps**: Search "yoga" > Show Filters > Reset
- **Result**: Reset button clears all filters back to default. Search remains (search is separate from filters).
- **Verdict**: PASS -- Note: Reset does not clear search text, which could be intentional.

### TC-010: Date dividers in event list [PASS]
- **Steps**: View Classes tab under "Upcoming" with many results
- **Result**: Events grouped by date with clear dividers showing "Today", "Tomorrow", and full date labels
- **Verdict**: PASS -- Clean, helpful grouping.

### TC-011: "Book" button on class card [PASS]
- **Steps**: Click "Book" button on a class card
- **Result**: Opens booking sheet/modal (stopPropagation prevents opening detail modal)
- **Verdict**: PASS -- Button correctly intercepts click.

### TC-012: Save star button on class card [PASS]
- **Steps**: Click star icon on class card (not signed in)
- **Result**: Shows toast "Saved locally. Sign in to sync across devices." Star turns yellow.
- **Verdict**: PASS -- Local save works for guest users.

---

## Summary of Issues by Severity

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 1 | BUG-001: Supabase 1000-row limit silently drops 1,608 events |
| HIGH | 1 | BUG-002: Weekend filter breaks on Sat/Sun |
| MEDIUM | 3 | BUG-003: Midnight time not corrected; BUG-004: "Upcoming" label misleading; BUG-005: Paid filter hides 1,403 unknown-price events |
| LOW | 2 | BUG-006: 12 AM time slot; BUG-007: Time slots not filtered by day range |

---

## Recommendations

### Immediate Fixes (Critical/High)
1. **Add `.limit(5000)` to the events query** in `useAppData.js` to fetch all events (or implement pagination with batched fetching)
2. **Fix weekend filter** to detect if today is already Sat/Sun and use the current weekend's Friday as the anchor

### Short-Term Fixes (Medium)
3. **Catch midnight (hour 0)** in the time correction logic alongside hours 1-5
4. **Fix paid filter** to include events with unknown pricing (null price)
5. **Rename internal `day='today'`** to `day='upcoming'` for code clarity (UI label is already "Upcoming")

### Long-Term Improvements
6. **Increase event data collection** -- only 31 events vs 2,577 classes. Consider scraping Eventbrite, Facebook Events, community calendars
7. **Filter time slots by selected day** -- make the time dropdown contextual
8. **Add a "Today Only" filter option** -- currently "Upcoming" (30 days) and "Anytime" (all future) exist, but no true "just today" option

---

## Test Statistics

| Metric | Count |
|--------|-------|
| Test cases executed | 12 |
| Passed | 8 |
| Passed with caveats | 3 |
| Failed | 0 |
| Bugs found | 7 |
| Critical bugs | 1 |
| High bugs | 1 |
| Medium bugs | 3 |
| Low bugs | 2 |

---

## Files Reviewed

| File | Purpose |
|------|---------|
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/hooks/useAppData.js` | Data fetching from Supabase |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/filterHelpers.js` | Event/class filtering logic |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/utils/timezoneHelpers.js` | Pacific timezone utilities |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FilterSection.jsx` | Filter UI component |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/EventCard.jsx` | Event card display component |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/EventDetailModal.jsx` | Event detail modal |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` | Main app (filter orchestration, rendering) |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/data/realData.js` | Static fallback data |
| `/Users/jeffkirdeikis/Desktop/pulse-app/src/lib/supabase.js` | Supabase client configuration |
