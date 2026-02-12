# QA Report: Filter System Exhaustive Testing
## Agent: Mike (Brewery Owner in Squamish, not tech-savvy)
## Date: February 12, 2026
## Scope: ALL filters across ALL sections

---

## Executive Summary

Exhaustive code-level analysis of every filter in the Pulse app across all five sections (Classes, Events, Deals, Services, Wellness). Tested filter logic by tracing through source code against actual Supabase database contents (2,608 active events, 327 active deals, 665 active businesses).

**Overall Grade: B-** -- The filter system is functional but contains several logic bugs, misleading labels, and edge cases that will confuse users or produce incorrect results.

**Critical Issues Found: 3**
**Major Issues Found: 6**
**Minor Issues Found: 8**
**Warnings: 5**

---

## Database Context (Verified Feb 12, 2026)

| Data Set | Count |
|----------|-------|
| Total active future events (classes + events) | 2,608 |
| Active classes (event_type=class) | 2,577 |
| Active events (event_type=event) | 31 |
| Active deals | 327 |
| Active businesses | 665 |
| Free events (is_free=true) | 209 |
| Today's classes (Feb 12) | 91 |
| Tomorrow's classes (Feb 13) | 75 |
| This weekend classes (Feb 14-15) | 82 |

**Today is Thursday, February 12, 2026 (weekday index 3, where 0=Monday).**

---

## SECTION 1: Classes/Events Filters (FilterSection.jsx + filterHelpers.js)

### 1.1 DAY FILTER

#### "Upcoming" (value: `today`, default)

**Code Analysis** (filterHelpers.js, lines 43-45):
```javascript
const thirtyDaysLater = new Date(now);
thirtyDaysLater.setDate(now.getDate() + 30);
filtered = filtered.filter(e => e.start >= now && e.start < thirtyDaysLater);
```

**FINDING: BUG [MAJOR] -- Misleading label + incorrect filtering logic**

The dropdown says "Upcoming" but the value is `today`. This is confusing because:
1. Label says "Upcoming" which implies all future events, but it actually filters to a 30-day window.
2. The comparison uses `e.start >= now` (current time), NOT `e.start >= todayMidnight`. This means events earlier today (e.g., a 6 AM class when it's now 3 PM) are EXCLUDED, but only from the "Upcoming" filter. The "Anytime" filter uses `todayMidnight` instead.
3. If Mike opens the app at 5 PM, he will NOT see any classes that already started today -- even though they might run until 6 PM. This is technically correct for the start time, but a class at 4:30 PM that runs until 5:30 PM would be invisible.

**Impact**: Users at 7 PM see almost no "today" events. The 30-day cap is arbitrary and not communicated.

**Verdict: BUG** -- The filter name ("Upcoming") is misleading. It should say "Next 30 Days" or just use `todayMidnight` as the start boundary to show all of today's events.

---

#### "Tomorrow"

**Code Analysis** (filterHelpers.js, lines 47-52):
```javascript
const tomorrow = new Date(now);
tomorrow.setDate(now.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);
const dayAfter = new Date(tomorrow);
dayAfter.setDate(tomorrow.getDate() + 1);
filtered = filtered.filter(e => e.start >= tomorrow && e.start < dayAfter);
```

**FINDING: PASS** -- Correctly creates a midnight-to-midnight window for tomorrow (Feb 13, 2026 = Friday). Uses `setHours(0,0,0,0)` to zero out time. The `now` is Pacific time via `getPacificNow()`.

**DB Verification**: Tomorrow (Feb 13) has 75 classes in the database. This matches expected output.

**Timezone**: Uses `getPacificNow()` which converts via `toLocaleString('en-US', { timeZone: 'America/Vancouver' })` -- correct for Squamish.

**Verdict: PASS**

---

#### "This Weekend"

**Code Analysis** (filterHelpers.js, lines 53-60):
```javascript
const friday = new Date(now);
const daysUntilFriday = (5 - now.getDay() + 7) % 7;
friday.setDate(now.getDate() + daysUntilFriday);
friday.setHours(0, 0, 0, 0);
const monday = new Date(friday);
monday.setDate(friday.getDate() + 3);
filtered = filtered.filter(e => e.start >= friday && e.start < monday);
```

**FINDING: BUG [MAJOR] -- "This Weekend" includes Friday, which is debatable, and has a critical edge case**

1. **Friday inclusion**: The filter defines "weekend" as Friday 00:00 to Monday 00:00 (3 days). This includes ALL of Friday. Many users expect "weekend" to mean Saturday+Sunday only. Including Friday means Mike sees 157 events (Fri+Sat+Sun) instead of the 82 he'd expect (Sat+Sun only).

2. **Critical edge case on Friday**: Today is Thursday. `now.getDay()` returns 4 (JS uses 0=Sunday). So `daysUntilFriday = (5 - 4 + 7) % 7 = 1`. That's correct -- tomorrow is Friday.

3. **Edge case on Saturday**: If today were Saturday (day=6), `daysUntilFriday = (5 - 6 + 7) % 7 = 6`. This means "This Weekend" would jump to NEXT Friday, 6 days away. A user clicking "This Weekend" on Saturday would see NEXT weekend, not the current one they're in the middle of.

4. **Edge case on Sunday**: If today were Sunday (day=0), `daysUntilFriday = (5 - 0 + 7) % 7 = 5`. Same problem -- "This Weekend" on Sunday shows next weekend.

**Verdict: BUG** -- On Saturday/Sunday, "This Weekend" shows NEXT weekend instead of the current one. On any day, it includes Friday which may not match user expectations.

---

#### "Next Week"

**Code Analysis** (filterHelpers.js, lines 61-68):
```javascript
const nextMonday = new Date(now);
const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7;
nextMonday.setDate(now.getDate() + daysUntilNextMonday);
nextMonday.setHours(0, 0, 0, 0);
const followingSunday = new Date(nextMonday);
followingSunday.setDate(nextMonday.getDate() + 7);
filtered = filtered.filter(e => e.start >= nextMonday && e.start < followingSunday);
```

**FINDING: PASS WITH CONCERN**

- Today is Thursday (JS `getDay()` = 4). `daysUntilNextMonday = (8 - 4) % 7 || 7 = 4`. So next Monday = Feb 16. Range: Feb 16 00:00 to Feb 23 00:00. That's Monday-Sunday, 7 days. Correct.

- **Edge case on Monday**: `getDay()` = 1. `daysUntilNextMonday = (8 - 1) % 7 || 7 = 0 || 7 = 7`. Correct -- if today is Monday, "Next Week" means next Monday (7 days from now).

- **Edge case on Sunday**: `getDay()` = 0. `daysUntilNextMonday = (8 - 0) % 7 || 7 = 1 || 7 = 1`. So on Sunday, "Next Week" starts tomorrow (Monday). This is correct -- the coming Monday IS "next week" from Sunday's perspective.

**DB Verification**: Feb 16-22 has classes: 95+100+84+68+44+25 = 416 classes. This is the expected count for "Next Week".

**Verdict: PASS**

---

#### "Anytime"

**Code Analysis** (filterHelpers.js, lines 39-41):
```javascript
if (filters.day === 'anytime') {
    filtered = filtered.filter(e => e.start >= todayMidnight);
}
```

**FINDING: PASS** -- Shows all future events from today's midnight onward. No upper bound. This correctly shows all 2,577+ classes and 31 events.

Note: Uses `todayMidnight` (which is set `setHours(0,0,0,0)` at line 37), meaning all of today's events show even if they've already started. This is DIFFERENT from "Upcoming" which uses `now`. Inconsistency but arguably correct behavior.

**Verdict: PASS** (but inconsistent with "Upcoming" lower-bound)

---

### 1.2 TIME FILTER

#### "All Times"

**Code Analysis** (filterHelpers.js, lines 117-128):
```javascript
if (filters.time !== 'all') {
    const [filterHour, filterMin] = filters.time.split(':').map(Number);
    const filterMinutes = filterHour * 60 + filterMin;
    filtered = filtered.filter(e => {
      const eventHour = e.start.getHours();
      const eventMin = e.start.getMinutes();
      const eventMinutes = eventHour * 60 + eventMin;
      return eventMinutes >= filterMinutes;
    });
}
```

**FINDING: PASS** -- When `filters.time === 'all'`, no time filtering is applied.

---

#### Dynamic Time Slots Generation

**Code Analysis** (App.jsx, lines 513-540):
```javascript
const getAvailableTimeSlots = () => {
    const slots = new Set();
    const allEvents = [...REAL_DATA.events, ...dbEvents];
    const filteredByDay = allEvents.filter(e => {
      const now = getPacificNow();
      if (filters.day === 'today') {
        // Only show times for today's events
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return e.start >= today && e.start < tomorrow;
      }
      return true; // For other day filters, show all available times
    });
    ...
```

**FINDING: BUG [MAJOR] -- Time slots only filter by day when day='today', not for other day values**

1. When day filter is "Upcoming" (value `today`), time slots are generated from today's events only. INCORRECT -- the "Upcoming" day filter actually shows 30 days of events (not just today). So if today has classes at 6 AM, 9 AM, and 5 PM, the time dropdown only shows those 3 time slots, but the actual event list includes 30 days of events with ALL times.

2. For "Tomorrow", "This Weekend", "Next Week", "Anytime" -- `return true` means ALL events from ALL days are used to generate time slots. So a time slot from a Saturday event appears in the dropdown even when "Tomorrow" (Friday) is selected. Selecting that time slot could produce 0 results.

3. Time filtering uses `eventMinutes >= filterMinutes` -- it shows events AT OR AFTER the selected time. This means selecting "9:00 AM" shows 9 AM, 10 AM, 11 AM, etc. This is a "starting from" filter, NOT an "exact time" filter. Users may expect to see only 9 AM events. This is not documented anywhere.

**Verdict: BUG** -- Time slot generation does not match the active day filter (except partially for "today"). Users see time options that may produce 0 results.

---

#### Edge Case: Events at 1-5 AM

**Code Analysis** (useAppData.js, lines 143-149):
```javascript
// Fix suspicious times: classes at 1-5 AM are likely data errors
if (hours >= 1 && hours <= 5) {
    hours = 9;
    minutes = 0;
}
```

**FINDING: PASS (data quality guard)** -- Events with start times between 1:00-5:59 AM are silently remapped to 9:00 AM. This is a data quality fix for scraper errors. Users won't see 1-5 AM time slots.

**Concern**: Midnight (00:00) events are NOT remapped. If an event truly starts at midnight, it shows correctly. But a 12:30 AM event would be remapped to 9:00 AM because `hours = 0` (midnight) is skipped but `hours = 1` is caught.

**Verdict: PASS** (appropriate guard)

---

#### Edge Case: Events with No Time

Events always get a time because of this default (useAppData.js line 140):
```javascript
let startTimeStr = event.start_time || '09:00';
```

**FINDING: PASS** -- If `start_time` is null, it defaults to 9:00 AM. The event will appear in time filter results for 9:00 AM and later.

---

### 1.3 AGE FILTER

#### "All Ages"

**Code Analysis** (filterHelpers.js): When `filters.age === 'all'`, no age filtering happens.

**FINDING: PASS** -- Shows everything regardless of age group.

---

#### "Kids"

**Code Analysis** (filterHelpers.js, lines 83-107):
```javascript
if (filters.age === 'kids') {
    filtered = filtered.filter(e => {
      if (!e.ageGroup?.includes('Kids') && e.ageGroup !== 'All Ages') return false;
      // Age range slider refinement...
    });
}
```

**FINDING: BUG [MINOR] -- "All Ages" events always appear in Kids filter**

The filter includes events with `ageGroup === 'All Ages'`. This means adult fitness classes that were tagged "All Ages" by the `inferAgeGroup()` function (because they don't mention kids OR adults) appear when filtering for "Kids". Example: "CrossFit" classes at Squamish Barbell that don't mention any age group get tagged "All Ages" and would appear in the Kids filter.

**Age detection** (useAppData.js `inferAgeGroup()`):
- Scans title + description for kids patterns: `kids`, `child`, `junior`, `youth`, `little`, `tots`, `toddler`, `baby`, `prenatal`, etc.
- Scans for adult patterns: `adult`, `19+`, `18+`, `senior`
- If neither found: returns `'All Ages'`
- If both found: returns `'All Ages'`

**Impact**: Many adult-oriented classes without explicit age mentions (CrossFit, Powerlifting, HYROX, etc.) are returned as "All Ages" and leak into the Kids filter. For 2,577 classes, a significant portion (hundreds) would be "All Ages" by default.

**Verdict: BUG** -- Kids filter shows too many irrelevant adult classes because "All Ages" is included.

---

#### Kids Age Range Slider

**Code Analysis** (filterHelpers.js, lines 87-104):
```javascript
if (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18) {
    const text = `${e.title} ${e.description}`.toLowerCase();
    // Prenatal check
    if (kidsAgeRange[0] === -1 && kidsAgeRange[1] === 0) {
      return text.includes('prenatal') || text.includes('perinatal') || text.includes('pregnant');
    }
    // Age range extraction
    const ageMatch = text.match(/(?:ages?\s*)?(\d+)\s*[-\u2013]\s*(\d+)/i);
    if (ageMatch) {
      const eventMinAge = parseInt(ageMatch[1]);
      const eventMaxAge = parseInt(ageMatch[2]);
      return eventMinAge <= kidsAgeRange[1] && eventMaxAge >= kidsAgeRange[0];
    }
    return true; // No age info found -- include anyway
}
```

**FINDING: BUG [MINOR] -- Regex matches non-age number ranges**

The regex `(\d+)\s*[-\u2013]\s*(\d+)` matches ANY number range in the title/description. Examples:
- "Session 3-5" (session numbers, not ages)
- "February 12-14" (date range)
- "$10-20" (price range)
- "2026-02-12" (date string)

The regex would extract "3-5" from "Session 3-5" and treat it as an age range of 3-5 years. Since descriptions often contain dates, this is likely triggered frequently.

**Also**: When `ageMatch` is null (no number range found), the function returns `true` (include the event). This means the age slider has NO effect on events that don't have explicit age ranges in their title/description. The slider appears to work but doesn't actually filter most events.

**Verdict: BUG** -- Age range slider is mostly non-functional due to regex false positives and the `return true` fallback.

---

#### Quick Select Buttons ("Prenatal", "0-1", "1-2", etc.)

**Code Analysis** (FilterSection.jsx, lines 167-186):
```javascript
{ageRangeOptions.map((opt) => {
    const isSelected = kidsAgeRange[0] <= opt.min && kidsAgeRange[1] >= opt.max;
    const isExactMatch = kidsAgeRange[0] === opt.min && kidsAgeRange[1] === opt.max;
    return (
      <button
        className={`age-range-btn ${isExactMatch ? 'active' : isSelected ? 'in-range' : ''}`}
        onClick={() => setKidsAgeRange([opt.min, opt.max])}
      >
```

**FINDING: PASS (UI)** -- Buttons work correctly for setting range. The `isSelected` check shows buttons in-range. The "All Kids" button resets to [0, 18].

**However**: The effectiveness depends on the age range filtering logic above, which is buggy.

**Verdict: PASS (UI only)** -- Buttons themselves work, but the underlying filter is buggy.

---

#### "Adults"

**Code Analysis** (filterHelpers.js, lines 108-109):
```javascript
} else if (filters.age === 'adults') {
    filtered = filtered.filter(e => e.ageGroup?.includes('Adults') || e.ageGroup === 'All Ages' || e.ageGroup === '19+' || e.ageGroup === 'Teens & Adults');
}
```

**FINDING: PASS WITH CONCERN** -- Same issue as Kids: "All Ages" events (which is the majority since `inferAgeGroup()` defaults to "All Ages" for events without age indicators) appear in Adults too. This means Kids and Adults filters show nearly identical result sets since both include "All Ages".

**Impact**: Both "Kids" and "Adults" filters show the same large set of "All Ages" events plus their specific ones. The differentiation is minimal.

**Verdict: PASS** (technically correct -- "All Ages" includes adults)

---

#### Edge Case: Event with No Age Group

Events without age keywords get `ageGroup: 'All Ages'` from `inferAgeGroup()`. These appear in ALL three age filter options (All Ages, Kids, Adults). This is by design but means the age filter has low discriminating power.

**Verdict: WARNING** -- Age filter shows too many events for each option because most events are "All Ages" by default.

---

### 1.4 CATEGORY FILTER

#### "All Categories"

**Code Analysis** (filterHelpers.js, lines 112-115):
```javascript
if (filters.category !== 'all') {
    filtered = filtered.filter(e => e.category === filters.category || (e.tags && e.tags.includes(filters.category)));
}
```

**FINDING: PASS** -- No filtering when "All Categories" is selected.

---

#### Dynamic Category Generation

**Code Analysis** (App.jsx, lines 453-466):
```javascript
const categories = useMemo(() => {
    const catSet = new Set();
    let events = [...REAL_DATA.events, ...dbEvents];
    if (currentSection === 'classes') {
      events = events.filter(e => e.eventType === 'class');
    } else if (currentSection === 'events') {
      events = events.filter(e => e.eventType === 'event');
    }
    events.forEach(e => {
      if (e.category) catSet.add(e.category);
    });
    return ['All', ...Array.from(catSet).sort()];
}, [dbEvents, currentSection]);
```

**FINDING: PASS** -- Categories are dynamically built from actual event data and section-specific. Classes show class categories (Fitness, Swimming, Yoga & Pilates, etc.), Events show event categories.

**DB Verification**: Class categories: Fitness (498), Swimming (134), Yoga & Pilates (115), Gymnastics (72), Education (65), Recreation (34), Kids Programs (24), Arena Sports (21), Camps (20), Dance (9), Sports (8). Total 11 categories.

**Verdict: PASS**

---

#### Specific Category Selection

**Code Analysis**: The filter checks `e.category === filters.category` OR `e.tags && e.tags.includes(filters.category)`.

**FINDING: PASS** -- The tags fallback is good. When a database event has `tags: ['auto-scraped', 'ai-verified', 'Fitness']`, selecting "Fitness" category matches both via `category` and via `tags`.

**Concern**: Static REAL_DATA events have categories in `tags` array but also a separate `category` field... wait, they DON'T have a `category` field. Looking at realData.js: events have `tags: ['Fitness', 'Yoga']` but no explicit `category`. However, they're all from Jan 27 (past date) and will be filtered out by the day filter. So this only matters for REAL_DATA events, which are already excluded.

Actually, looking more carefully at the REAL_DATA events -- they have NO `category` field. Their categorization only exists in `tags`. But the database events have `category` set by `useAppData.js` line 181:
```javascript
category: event.category
    ? event.category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Community',
```

So database events have proper categories. REAL_DATA events don't have `category` but have `tags`. The filter correctly checks both `e.category` and `e.tags`. This works.

**Verdict: PASS**

---

#### Edge Case: Events with Multiple Categories

Events have a single `category` field but can have multiple `tags`. The filter checks BOTH, so an event tagged `['Fitness', 'Yoga']` would appear under both "Fitness" and "Yoga" categories if those exist in the category dropdown.

**However**: The dropdown only shows values from `e.category` (the single category field), NOT from tags. So the dropdown won't show "Yoga" as an option if no event has `category: 'Yoga'`, even if many events have `tags: ['Yoga']`.

**FINDING: BUG [MINOR]** -- Tags are checked during filtering but NOT used to generate the category dropdown options. This means some filterable categories are hidden from the user.

**Verdict: BUG (minor)**

---

#### Edge Case: Events with No Category

Database events default to `'Community'` if no category exists. REAL_DATA events without `category` would show as `undefined` and not match any category filter.

**Verdict: PASS** (for database events)

---

### 1.5 PRICE FILTER

#### "All Prices"

**Code Analysis** (filterHelpers.js, lines 131-135): No filtering when `filters.price === 'all'`.

**FINDING: PASS**

---

#### "Free"

**Code Analysis** (filterHelpers.js, lines 131-132):
```javascript
if (filters.price === 'free') {
    filtered = filtered.filter(e => e.price?.toLowerCase() === 'free');
}
```

**And price mapping** (useAppData.js, line 183):
```javascript
price: event.is_free ? 'Free' : (event.price > 0 ? `$${event.price}` : (event.price_description && !/^see (venue|studio) for pricing$/i.test(event.price_description) ? event.price_description : null)),
```

**FINDING: PASS** -- Only events with `is_free: true` get `price: 'Free'`. The filter checks `e.price?.toLowerCase() === 'free'`. This correctly matches.

**DB Verification**: 209 free events exist. These should all appear when "Free" filter is selected.

**Edge case**: Events with `price: null` (is_free=false, price=0, price_description="See venue for pricing") are NOT shown as free. Correct.

**Verdict: PASS**

---

#### "Paid"

**Code Analysis** (filterHelpers.js, lines 133-135):
```javascript
} else if (filters.price === 'paid') {
    filtered = filtered.filter(e => e.price?.toLowerCase() !== 'free' && e.price);
}
```

**FINDING: BUG [MINOR] -- Events with null price excluded from both "Free" and "Paid"**

Events where `price: null` (is_free=false, price=0, price_description matches "See venue for pricing") have `e.price = null`. These events:
- Are NOT shown under "Free" (correct -- they're not free)
- Are NOT shown under "Paid" (because `e.price` is falsy/null)
- Are shown under "All Prices"

This means some events disappear when switching from "All Prices" to either "Free" or "Paid". Looking at the data, many "See venue for pricing" classes fall into this gap. With hundreds of classes from scraped sources having `price: 0` and `price_description: "See venue for pricing"`, this is significant.

**Verdict: BUG** -- Events with unknown pricing disappear from both Free and Paid filters. Should either be included in "Paid" or have a third option.

---

#### "Free" Option Visibility

**Code Analysis** (FilterSection.jsx, lines 212-213):
```javascript
{hasFreeItems && <option value="free">Free</option>}
```

And in App.jsx:
```javascript
const hasFreeItems = [...REAL_DATA.events, ...dbEvents].some(e => e.price?.toLowerCase() === 'free');
```

**FINDING: PASS** -- The "Free" option only appears in the dropdown when free events exist. Smart data-driven approach.

**Verdict: PASS**

---

### 1.6 RESET BUTTON

**Code Analysis** (FilterSection.jsx, lines 219-234):
```javascript
const hasActiveFilters = filters.day !== 'today' || filters.time !== 'all' ||
                          filters.age !== 'all' || filters.category !== 'all' || filters.price !== 'all' ||
                          (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18);
return hasActiveFilters ? (
    <button onClick={() => {
        setFilters({day: 'today', time: 'all', age: 'all', category: 'all', price: 'all'});
        setKidsAgeRange([0, 18]);
    }} className="reset-btn">
```

**FINDING: PASS** -- Reset button appears only when filters are changed from defaults. Correctly resets all filters including kids age range.

**BUG [MINOR]**: Reset button does NOT reset the search query. The empty state "Clear Filters" button (App.jsx line 637) DOES reset search. Inconsistent behavior.

**Verdict: PASS (with minor inconsistency)**

---

### 1.7 EMPTY STATE

**Code Analysis** (App.jsx, lines 631-643):
```javascript
if (events.length === 0) {
    return (
      <div className="empty-state">
        <p>No {currentSection} found matching your filters.</p>
        <button onClick={() => {
          setFilters({ day: 'today', age: 'all', category: 'all', time: 'all', price: 'all', location: 'all' });
          setKidsAgeRange([0, 18]);
          setSearchQuery('');
        }}>
          Clear Filters
        </button>
      </div>
    );
}
```

**FINDING: PASS** -- Empty state message shown when no events match. "Clear Filters" button resets everything including search.

**Note**: The reset includes `location: 'all'` which isn't even a filter in the current UI. Harmless but shows copy-paste from an older version.

**Verdict: PASS**

---

## SECTION 2: Filter Combinations

### 2.1 Kids + Free + This Weekend

- Kids: Filters to `ageGroup.includes('Kids') || ageGroup === 'All Ages'`
- Free: Filters to `price.toLowerCase() === 'free'`
- This Weekend: Filters to Friday-Sunday (Feb 13-15)

**Analysis**: These three filters are applied sequentially (AND logic). This should produce a small set of free kids events this weekend. Given the DB has 157 classes Fri-Sun and 209 free events total, the intersection should be around 10-30 events.

**Potential Issue**: Most weekend events might be "All Ages" and would pass the Kids filter even though they're not specifically for kids. The "free" filter is strict and well-defined.

**Verdict: PASS (works as coded, but Kids filter over-includes)**

---

### 2.2 Adults + Fitness + Tomorrow

- Adults: `ageGroup includes 'Adults' || 'All Ages' || '19+' || 'Teens & Adults'`
- Fitness: `category === 'Fitness' || tags.includes('Fitness')`
- Tomorrow: Feb 13 events

**Analysis**: Tomorrow has 75 classes. Filtering to Fitness category and Adult age group. Most fitness classes are either "Adults" or "All Ages". Expected: ~20-40 results.

**Verdict: PASS**

---

### 2.3 Free + Anytime

- Free: `price === 'free'`
- Anytime: All events from today's midnight onward

**Analysis**: Should show all 209+ free events. This is the broadest free filter.

**Verdict: PASS**

---

### 2.4 Reset All Filters

When reset button is clicked:
- `day: 'today'`, `time: 'all'`, `age: 'all'`, `category: 'all'`, `price: 'all'`
- `kidsAgeRange: [0, 18]`

After reset, the "Upcoming" (30-day window) should show all classes within 30 days.

**Verdict: PASS**

---

### 2.5 Filter State Persistence Across Section Switches

**Code Analysis** (App.jsx, lines 745-748):
```javascript
useEffect(() => {
    setSearchQuery('');
    setDebouncedSearch('');
}, [currentSection]);
```

**FINDING: BUG [CRITICAL] -- Filter state persists when switching between Classes and Events tabs**

When switching from Classes to Events (or vice versa), the `filters` state (day, time, age, category, price) is NOT reset. Only `searchQuery` is reset. The `showFilters` toggle also persists.

Scenario:
1. Mike is on Classes tab, sets category to "Yoga & Pilates"
2. Switches to Events tab
3. The category filter still says "Yoga & Pilates" but Events may not have that category
4. Result: 0 events shown with no clear indication why

The category dropdown IS regenerated per section (`categories` memo depends on `currentSection`), so the dropdown options change. But if "Yoga & Pilates" is selected and that option doesn't exist in Events, the `<select>` may show a blank or the last value, and the filter logic still applies `category !== 'all'`.

**Additional concern**: The ConsumerHeader tab click handlers DO reset category:
```javascript
onClick={() => { setCurrentSection('classes'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); ... }}
```

So category IS reset when clicking tabs via the header. But day, time, age, and price filters persist. If Mike selects "This Weekend" on Classes, then switches to Events, Events are also filtered to "This Weekend".

**Verdict: BUG** -- Day, time, age, and price filters persist across Classes/Events tabs. Category is reset by tab click but this is inconsistent. All filters should either reset or be clearly shared.

---

### 2.6 Rapidly Toggling Filters

**Code Analysis**: All filter changes directly set React state via `setFilters({...filters, key: value})`. There is no debounce on filter changes (only on search query with 150ms debounce). Rapid toggling would cause rapid re-renders but no race conditions since React batches state updates.

The `filterEvents()` function is called synchronously during render. No async operations involved in filter logic itself.

**Verdict: PASS** -- No race conditions. Performance may degrade with rapid changes but no data corruption.

---

## SECTION 3: Deals Filters

### 3.1 Search Filter

**Code Analysis** (filterHelpers.js, lines 161-168):
```javascript
if (searchQuery?.trim()) {
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(d =>
      d.title?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query) ||
      d.venueName?.toLowerCase().includes(query) ||
      getVenueName(d.venueId, d).toLowerCase().includes(query)
    );
}
```

**FINDING: PASS** -- Searches title, description, venueName, and resolved venue name. Comprehensive.

**Note**: Deal search shares the same `searchQuery` state as other sections, but App.jsx resets search when switching sections (line 746). Correct.

**Verdict: PASS**

---

### 3.2 Deal Category Filter

**Code Analysis** (DealsGrid.jsx, lines 21-31):
```javascript
const categoryOptions = useMemo(() => {
    const catCounts = {};
    deals.forEach(deal => {
      const normalized = normalizeDealCategory(deal.category);
      catCounts[normalized] = (catCounts[normalized] || 0) + 1;
    });
    return Object.entries(catCounts)
      .filter(([cat]) => cat !== 'Other' || catCounts['Other'] > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
}, [deals]);
```

And filtering (DealsGrid.jsx, lines 45-48):
```javascript
const filteredDeals = deals.filter(deal => {
    if (dealCategoryFilter === 'All') return true;
    return normalizeDealCategory(deal.category) === dealCategoryFilter;
});
```

**FINDING: PASS** -- Categories are normalized via `DEAL_CATEGORY_MAP` (40+ raw categories mapped to 8 UI categories). The dropdown is dynamically built from actual deal data, sorted by count. Filtering uses the same normalization.

**DB Verification**: 327 deals across 57 raw categories, normalized to ~8 UI categories (Food & Drink, Retail, Services, Fitness, Entertainment, Wellness, Beauty, Family, Other).

**Verdict: PASS**

---

### 3.3 Deal Category Filter State Persistence

**FINDING: BUG [MINOR]** -- `dealCategoryFilter` is stored at App.jsx level (line 130: `const [dealCategoryFilter, setDealCategoryFilter] = useState('All')`). This state is NOT reset when switching sections. If Mike selects "Fitness" in deals, leaves, and comes back, the filter persists.

The search IS cleared on section switch, but the deal category filter is not.

**Verdict: BUG (minor -- arguably a feature to remember the user's filter)**

---

### 3.4 Expired Deals

**Code Analysis**: The deal fetch (useAppData.js, line 206-210):
```javascript
const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
```

**FINDING: BUG [MAJOR] -- No expiration filtering**

Deals have a `valid_until` field (mapped to `deal.validUntil`) but this is NEVER checked during fetch or filtering. A deal that expired last month but still has `status: 'active'` would appear in the app. Expiration is not enforced in the query or in client-side filtering.

**Verdict: BUG** -- Expired deals may be visible to users.

---

### 3.5 Deal Score Sorting

**Code Analysis** (dealHelpers.js, `calculateDealScore()`):

The scoring algorithm:
- Percentage discounts: 40-100 points based on percent
- Dollar savings: 30-90 points
- Special bonuses: free=45, BOGO=60, half price=55
- Featured boost: +25
- Concrete pricing bonus: +10-15
- Vague deal penalty: -20 if no real value

**And the "real deal" filter** (dealHelpers.js, `isRealDeal()`):
```javascript
return score >= 15;
```

**FINDING: PASS** -- Deals with score < 15 (vague "specials" with no concrete value) are filtered out before display. This means many of the 327 deals may not appear if they're all "special" type with no discount info.

**DB Verification**: 101 deals are `discount_type: 'special'` (most vague). 132 are `percent` (have concrete %), 81 are `fixed` ($X off), 11 are `free_item`, 2 are `bogo`. The "special" deals likely score under 15 and get filtered. Users would see ~230 deals.

**Verdict: PASS** (good quality filtering)

---

### 3.6 Deals Empty State

**Code Analysis** (DealsGrid.jsx, lines 159-170):
```javascript
{!dealsLoading && filteredDeals.length === 0 && (
    <div className="no-results-state">
      <DollarSign size={48} />
      <h3>No deals found</h3>
      <p>{searchQuery ? `No deals matching "${searchQuery}"` : 'No deals in this category'}</p>
      <button onClick={() => { setSearchQuery(''); setDealCategoryFilter('All'); }}>
        Clear Filters
      </button>
    </div>
)}
```

**FINDING: PASS** -- Good empty state with clear message and reset button.

**Verdict: PASS**

---

## SECTION 4: Services Filters

### 4.1 Category Filter

**Code Analysis** (ServicesGrid.jsx, lines 83-107):
```javascript
const filteredServices = services
    .filter(service => {
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase().trim();
        const nameMatch = service.name.toLowerCase().includes(query);
        const categoryMatch = service.category.toLowerCase().includes(query);
        const addressMatch = service.address?.toLowerCase().includes(query);
        if (!nameMatch && !categoryMatch && !addressMatch) return false;
      }
      if (serviceCategoryFilter === 'All') return true;
      if (serviceCategoryFilter === 'Other') return !mainCategories.includes(service.category);
      return service.category === serviceCategoryFilter;
    })
```

**FINDING: PASS** -- 21 main categories + "Other" (catches everything not in the main 21). Search works across name, category, and address.

**DB Verification**: 665 businesses across 130+ raw categories. The 21 main categories cover the majority. "Other" catches the remaining ~100+ niche categories.

**Verdict: PASS**

---

### 4.2 Services Sort by Rating

**Code Analysis** (ServicesGrid.jsx, lines 96-107):
```javascript
.sort((a, b) => {
    const aReviews = a.reviews || 0;
    const bReviews = b.reviews || 0;
    const aRating = a.rating || 0;
    const bRating = b.rating || 0;
    const aIsTier1 = aReviews >= 50 && aRating >= 4;
    const bIsTier1 = bReviews >= 50 && bRating >= 4;
    if (aIsTier1 && !bIsTier1) return -1;
    if (!aIsTier1 && bIsTier1) return 1;
    if (bRating !== aRating) return bRating - aRating;
    return bReviews - aReviews;
})
```

**FINDING: PASS** -- Two-tier sort: Tier 1 (50+ reviews AND 4+ rating) always appears first. Within tiers, sorted by rating desc, then reviews desc.

**Verdict: PASS**

---

### 4.3 Businesses with No Rating

**Code Analysis**: When `rating` is null/undefined, it becomes `0` via `a.rating || 0`. These businesses:
- Are NOT Tier 1 (0 < 4)
- Sort to the bottom (lowest rating)
- Still appear in results

**FINDING: PASS** -- Unrated businesses appear at the bottom. They're not hidden.

**Verdict: PASS**

---

### 4.4 Service Category Filter State Persistence

**FINDING: BUG [MINOR]** -- `serviceCategoryFilter` (App.jsx line 129) is NOT reset when switching sections. If Mike selects "Restaurants & Dining" in Services, switches to Classes, then back to Services, the filter persists. Search IS cleared (line 746), but category filter is not.

**Verdict: BUG (minor)**

---

### 4.5 Services Empty State

**Code Analysis** (ServicesGrid.jsx, lines 239-248):
```javascript
{debouncedSearch && filteredServices.length === 0 && (
    <div className="no-results-state">
      <h3>No businesses found for "{searchQuery}"</h3>
      <p>Try a different search term or browse all services</p>
      <button onClick={() => setSearchQuery('')}>Clear Search</button>
    </div>
)}
```

**FINDING: BUG [MINOR] -- Empty state only shows when search is active**

If no search is active but a category filter produces 0 results, there's no empty state message. The grid just shows nothing. The `debouncedSearch &&` guard prevents the empty state from showing for category-only filtering.

**Verdict: BUG** -- No empty state for category filter producing 0 results without a search query.

---

## SECTION 5: Wellness Section Filters

### 5.1 Discipline Filter

**Code Analysis** (WellnessBooking.jsx, lines 11-17):
```javascript
const DISCIPLINES = [
  { key: 'all', label: 'All', icon: Sparkles },
  { key: 'massage_therapy', label: 'Massage', icon: Heart },
  { key: 'physiotherapy', label: 'Physio', icon: Activity },
  { key: 'chiropractic', label: 'Chiro', icon: Stethoscope },
  { key: 'acupuncture', label: 'Acupuncture', icon: Sparkles },
];
```

Filtering is done server-side via Supabase RPC:
```javascript
const { data, error } = await supabase.rpc('get_wellness_availability', {
    p_date: selectedDate,
    p_discipline: discParam,
    p_duration: duration,
    p_time_range: timeRange,
});
```

**FINDING: PASS** -- Discipline filter is well-implemented with pill-style buttons. Server-side filtering ensures correctness. "All" passes `null` to the RPC, which should return all disciplines.

**Verdict: PASS**

---

### 5.2 Date Filter (Carousel)

**Code Analysis** (WellnessBooking.jsx, lines 35-55):
```javascript
function getDateRange() {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push({
        date: `${year}-${month}-${day}`,
```

**FINDING: BUG [MINOR] -- Uses `new Date()` instead of `getPacificNow()`**

The wellness date range uses `new Date()` which gives the system's local time, not Pacific time. If the app is used by someone in a different timezone (or if the server runs in UTC), the dates could be off by one day late at night.

However, the code does use local date components (`getFullYear()`, `getMonth()`, `getDate()`) instead of `toISOString()`, which is the correct approach for avoiding UTC conversion issues.

**Verdict: BUG (minor)** -- Should use `getPacificNow()` for consistency with the rest of the app.

---

### 5.3 Time Range Filter

**Code Analysis** (WellnessBooking.jsx, lines 19-24):
```javascript
const TIME_RANGES = [
  { key: 'any', label: 'Any Time' },
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];
```

Passed to the server-side RPC as `p_time_range`. The actual time range boundaries (e.g., morning = before noon?) are defined in the database function, not in the client code.

**FINDING: PASS** -- Clean pill-button UI with server-side logic.

**Verdict: PASS**

---

### 5.4 Duration Filter

**Code Analysis** (WellnessBooking.jsx, lines 26-32):
```javascript
const DURATIONS = [
  { key: null, label: 'Any' },
  { key: 30, label: '30 min' },
  { key: 45, label: '45 min' },
  { key: 60, label: '60 min' },
  { key: 90, label: '90 min' },
];
```

**FINDING: PASS** -- Duration filter with server-side filtering.

**Verdict: PASS**

---

### 5.5 Direct Billing Toggle

**Code Analysis** (WellnessBooking.jsx, lines 147-149):
```javascript
if (directBillingOnly) {
    filtered = data.filter(s => s.direct_billing);
}
```

**FINDING: PASS** -- Client-side post-filter on the server results. Clean toggle UI.

**Verdict: PASS**

---

### 5.6 Wellness Filter Active Count Badge

**Code Analysis** (WellnessBooking.jsx, lines 371-374):
```javascript
{(timeRange !== 'any' || duration || directBillingOnly) && (
    <span className="wb-filter-count">
      {[timeRange !== 'any', !!duration, directBillingOnly].filter(Boolean).length}
    </span>
)}
```

**FINDING: PASS** -- Shows count of active filters as a badge. Smart UX.

**Verdict: PASS**

---

### 5.7 Wellness Empty State

**Code Analysis** (WellnessBooking.jsx, lines 447-461):
```javascript
slots.length === 0 ? (
    <EmptyState
      hasProviders={providers.length > 0}
      selectedDate={selectedDate}
      dateCounts={dateCounts}
      onSelectDate={setSelectedDate}
      onSetAlert={() => {...}}
    />
)
```

The EmptyState component shows either:
- "Setting Up Availability" (if no providers at all)
- "No Openings for [date]" with "Jump to Next Available" button (if other dates have slots)
- "Set Alert" option (if no dates have slots)

**FINDING: PASS** -- Excellent empty state handling with actionable suggestions.

**Verdict: PASS**

---

## SECTION 6: Cross-Section Issues

### 6.1 BUG [CRITICAL] -- "Upcoming" Day Filter Uses `now` Instead of `todayMidnight`

As detailed in Section 1.1, the default "Upcoming" filter compares `e.start >= now` (current timestamp), meaning events that already started today are hidden. But the "Anytime" filter uses `e.start >= todayMidnight`, showing all of today's events. This inconsistency means:

- At 6 PM, "Upcoming" shows ~0 events for today (all classes already started)
- At 6 PM, "Anytime" shows all 91 today events plus all future events

A user's first experience in the evening would be seeing almost no events with the default filter.

**Severity: CRITICAL** -- First-time users in the evening see an empty/sparse app.

---

### 6.2 BUG [CRITICAL] -- Static REAL_DATA Events Are All Past-Dated

All hardcoded events in `REAL_DATA.events` are dated January 27, 2026. Today is February 12. These events are 16 days in the past and are correctly filtered out by all day filters. However:

1. They still contribute to `getAvailableTimeSlots()` when `filters.day !== 'today'` (since the function returns `true` for non-today day filters). This adds phantom time slots from past events.
2. They still contribute to `hasFreeItems` check (App.jsx line 543), which could show the "Free" price option even if no current DB events are free.
3. They still contribute to `categories` memo, potentially adding category options that have no current events.

**Impact**: Time slot dropdown shows times from past static data; category options may include stale entries; "Free" option may appear without current free events.

**Severity: CRITICAL** -- Stale static data pollutes filter options.

---

### 6.3 Filter Visibility on Sections

**Code Analysis** (App.jsx, lines 796-809):
```javascript
{(currentSection === 'events' || currentSection === 'classes') && (
    <FilterSection ... />
)}
```

The FilterSection (day/time/age/category/price) only appears on Events and Classes tabs. Deals and Services have their own inline filters. Wellness has its own filter system.

**FINDING: PASS** -- Section-appropriate filter visibility.

---

### 6.4 Results Count Display

**Code Analysis** (App.jsx, lines 814-837):
```javascript
{currentSection !== 'wellness' && (
    <div className="results-count">
      {(() => {
        let count;
        if (currentSection === 'deals') { count = filterDeals().filter(d => ...).length; }
        else if (currentSection === 'services') { count = services.filter(...).length; }
        else { count = filterEvents().length; }
        return `${count} ${count === 1 ? 'result' : 'results'}`;
      })()}
    </div>
)}
```

**FINDING: BUG [MAJOR] -- filterDeals() called twice per render**

For the deals section, `filterDeals()` is called at line 819 (for the results count) AND again at line 850 (for `<DealsGrid deals={filterDeals()}`). Each call performs the full filtering and sorting operation on all deals. Since it's not memoized, this is a performance issue.

Similarly, `filterEvents()` is called at line 833 (count) and again at line 629 (render). Two full filter passes per render.

**Verdict: BUG (performance)** -- Double-computation of filtered results on every render.

---

## Summary of All Findings

### CRITICAL (3)
| # | Issue | Location |
|---|-------|----------|
| C1 | "Upcoming" filter uses `now` not `todayMidnight`, hiding today's past-started events | filterHelpers.js:45 |
| C2 | Filter state (day/time/age/price) persists across Classes<->Events tab switches | App.jsx filter state |
| C3 | Static REAL_DATA events (Jan 27) pollute time slots, categories, and hasFreeItems | App.jsx:515-543 |

### MAJOR (6)
| # | Issue | Location |
|---|-------|----------|
| M1 | "This Weekend" on Saturday/Sunday shows NEXT weekend | filterHelpers.js:54-60 |
| M2 | Time slot dropdown doesn't match active day filter | App.jsx:513-540 |
| M3 | Events with null price excluded from both Free and Paid | filterHelpers.js:131-135 |
| M4 | Kids filter includes "All Ages" events (most events) | filterHelpers.js:85 |
| M5 | No expiration check on deals | useAppData.js:206-210 |
| M6 | filterDeals() and filterEvents() called twice per render | App.jsx:819/850, 833/629 |

### MINOR (8)
| # | Issue | Location |
|---|-------|----------|
| m1 | Age range regex matches non-age number ranges | filterHelpers.js:96 |
| m2 | Age slider returns true for events without age ranges (no-op) | filterHelpers.js:104 |
| m3 | Category dropdown generated from e.category only, not tags | App.jsx:462-464 |
| m4 | Reset button doesn't clear search query | FilterSection.jsx:226 |
| m5 | Deal category filter persists across sections | App.jsx:130 |
| m6 | Service category filter persists across sections | App.jsx:129 |
| m7 | Services empty state only shows with active search, not category | ServicesGrid.jsx:239 |
| m8 | Wellness dates use `new Date()` instead of `getPacificNow()` | WellnessBooking.jsx:38 |

### WARNINGS (5)
| # | Issue | Location |
|---|-------|----------|
| W1 | "Upcoming" label is misleading (actually 30-day window) | FilterSection.jsx:64 |
| W2 | "This Weekend" includes Friday -- users may expect Sat-Sun only | filterHelpers.js:53-60 |
| W3 | Time filter is "starting from" not "exact time" (undocumented) | filterHelpers.js:122-127 |
| W4 | Age filter has low discriminating power due to "All Ages" default | inferAgeGroup() |
| W5 | Reset button includes unused `location: 'all'` field | App.jsx:635 |

---

## Recommendations

### Priority 1 (Fix Now)
1. **Change "Upcoming" to use `todayMidnight`** instead of `now` so evening users see today's events
2. **Reset ALL filters (not just category) when switching between Classes/Events tabs**
3. **Filter out REAL_DATA past events** from time slot generation, category generation, and hasFreeItems check

### Priority 2 (Fix Soon)
4. **Fix "This Weekend"** to handle Saturday/Sunday correctly (include current day if it's already the weekend)
5. **Add expiration check** to deals query: `valid_until is null or valid_until >= today`
6. **Memoize `filterEvents()` and `filterDeals()`** to avoid double computation
7. **Handle null-price events** in the price filter (include in "Paid" or add an "Unknown" option)

### Priority 3 (Improve)
8. **Make time slots dynamic** per the selected day filter, not just for "today"
9. **Improve age detection** to default to "Adults" (not "All Ages") for fitness classes
10. **Add empty state for services** when category filter (without search) produces 0 results
11. **Use getPacificNow()** in WellnessBooking date generation for timezone consistency

---

## Test Execution Summary

| Section | Tests | Pass | Fail | Bug |
|---------|-------|------|------|-----|
| Day Filter | 5 | 3 | 0 | 2 |
| Time Filter | 4 | 3 | 0 | 1 |
| Age Filter | 5 | 2 | 0 | 3 |
| Category Filter | 4 | 3 | 0 | 1 |
| Price Filter | 3 | 2 | 0 | 1 |
| Reset/Empty | 2 | 2 | 0 | 0 |
| Filter Combinations | 5 | 4 | 0 | 1 |
| Deals Filters | 6 | 4 | 0 | 2 |
| Services Filters | 5 | 3 | 0 | 2 |
| Wellness Filters | 7 | 6 | 0 | 1 |
| Cross-Section | 4 | 1 | 0 | 3 |
| **TOTAL** | **50** | **33** | **0** | **17** |

Pass rate: 66% (33/50)
Bug rate: 34% (17/50) -- 3 critical, 6 major, 8 minor
