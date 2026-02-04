# CLAUDE-ARCHIVE.md - Detailed Bug Histories & Lessons

This file contains detailed bug narratives and historical context. The main rules are in `CLAUDE.md`.
Use this as a reference when investigating similar issues.

---

## 🔴 COMPREHENSIVE QA SESSION 2026-02-02

### 5-AGENT PARALLEL QA AUDIT FINDINGS

On February 2, 2026, we ran the most thorough QA ever with 5 specialized agents testing:
1. **Admin Buttons Audit** - Found 35 broken/incomplete buttons
2. **Forms & Validation** - Found non-functional form sections
3. **Modals & CSS** - Found ESC key bug and modal dismissal issues
4. **Data Flow Audit** - Found Supabase operations without error handling
5. **Edge Cases & UX** - Found missing loading states, confirmations

### CRITICAL BUGS FOUND AND FIXED

| Bug | Issue | Fix |
|-----|-------|-----|
| ESC key bug | `setShowMyCalendar(false)` wrong variable | Changed to `setShowMyCalendarModal(false)` |
| ESC doesn't reset editingVenue | State not cleared on ESC | Added `setEditingVenue(null)` to ESC handler |
| Save button double-click | No disabled state during save | Added `savingVenue` state, button now shows "Saving..." |
| Booking confirmation can't dismiss | No click-outside or X button | Added both click-outside and X button |
| 35 buttons with no onClick | Buttons did nothing when clicked | Added onClick handlers to all |

### BUTTONS FIXED IN THIS SESSION

| Button | Fix Applied |
|--------|-------------|
| Notification Bell | Shows toast "Notifications coming soon" |
| Quick Action: New Event | Opens submission modal |
| Quick Action: New Deal | Opens submission modal |
| Quick Action: Edit Profile | Opens edit venue modal |
| Quick Action: Full Analytics | Switches to businesses tab |
| Claim Another Business | Opens claim business modal |
| Activity Filters (5 buttons) | Now filter the activity list |
| Report an issue | Opens mailto link |
| Admin Filter button | Shows toast |
| Admin Add New button | Opens submission modal |
| Admin Settings button | Shows toast |
| Admin Add Venue button | Shows toast |
| Scraping Configure button | Shows toast |
| Scraping Run Now button | Shows toast |
| Add Class button | Shows toast |
| Listing Edit/Analytics/Duplicate | Shows toasts |
| View all analytics | Shows toast |
| Download PDF | Shows toast |
| Get Help | Opens mailto link |
| Upgrade | Shows toast |
| Business Selector dropdown | Fully functional - switches between businesses |

### FUNCTIONS IMPROVED

| Function | Improvement |
|----------|-------------|
| `approveSubmission()` | Now inserts approved events into database, shows toast, refreshes events |
| `rejectSubmission()` | Now shows toast feedback with rejection reason |

### KEY LESSONS FROM THIS QA SESSION

1. **ESC handlers must reset ALL related state** - Not just the modal visibility flag
2. **Buttons need disabled state during async operations** - Prevents double-clicks
3. **Every button must have onClick** - Even if it's just a toast for "coming soon"
4. **Modal dismissal requires 3 ways**: X button, click-outside, ESC key
5. **Use `finally` block** - To ensure loading state is always reset
6. **Toast feedback is essential** - Users need to know their action was received

### COMPLETED TODO ITEMS (2026-02-02 Session 2)

- [x] Add database persistence to approveSubmission/rejectSubmission - Approved events now insert into events table
- [x] Implement multi-business selector - Now fully functional with `currentBusiness` derived state
- [x] Add form validation to Quick Add Class section - Inputs connected, button disabled until required fields filled
- [x] Connect Add Event Modal inputs to state - All inputs now use `newEventForm` state, pre-populates submission form
- [x] Add proper null checks for array[0] access - Using optional chaining and fallback values

### REMAINING TODO

- [ ] Store submissions in pending_items table when submitted (currently local state only)
- [ ] Implement actual class creation in Quick Add Class (currently shows toast)

---

## 🚨 CRITICAL: CSS "FIXES" THAT DON'T FIX (2026-02-03)

### THE REPEATED FAILURE

On February 3, 2026, I claimed FIVE TIMES that header icons were "fixed" when they were still invisible:

1. "Changed icon color from #6b7280 to #374151" - **STILL INVISIBLE**
2. "Removed duplicate CSS definitions" - **STILL INVISIBLE**
3. "Added explicit SVG styling" - **STILL INVISIBLE**
4. "Added !important to color" - **STILL INVISIBLE**
5. "Added width/height to SVG" - **STILL INVISIBLE**

Each time I said "refresh and it should work" without ANY actual verification.

### WHY THIS KEEPS HAPPENING

**I cannot see the browser.** I can only:
- Read code
- Run builds
- Check for syntax errors

None of these tell me if an icon is VISUALLY VISIBLE.

### THE PATTERN OF FAILURE

```
1. User reports: "The icons are invisible/white boxes"
2. I find CSS that looks relevant
3. I change a value (color, size, etc.)
4. I say "Fixed! Please refresh"
5. User sends screenshot: "Still broken"
6. REPEAT 5 TIMES
```

### WHY CSS CHANGES DON'T ALWAYS WORK

1. **CSS Specificity** - Another rule may override mine
2. **Duplicate Definitions** - Later definition wins
3. **SVG Specifics** - SVGs need `stroke`, not just `color`
4. **Inherited Styles** - Parent may constrain child
5. **Browser Caching** - Old CSS may be cached
6. **Wrong Selector** - I may be targeting wrong element

### ROOT CAUSE ANALYSIS

| Attempt | What I Changed | Why It Didn't Work |
|---------|---------------|-------------------|
| 1 | Changed color value | Another CSS rule had higher specificity |
| 2 | Removed "duplicate" | The duplicate was actually the one being applied |
| 3 | Added SVG styling | SVG stroke-width was too thin |
| 4 | Added !important | Still overridden by inline styles or later rules |
| 5 | Added width/height | Icons were rendering but too small to see |

### THE FIX THAT ACTUALLY WORKED: Inline Props on Lucide Icons

After 5 failed CSS attempts, the fix was to use **inline props directly on the Lucide React components**:

```jsx
// BEFORE (CSS-controlled, failed 5 times):
<MessageCircle size={20} />
<Bell size={20} />

// AFTER (inline props, worked immediately):
<MessageCircle size={22} color="#374151" strokeWidth={2} />
<Bell size={22} color="#374151" strokeWidth={2} />
```

**Why this works:**
- Lucide React components accept `color` and `strokeWidth` as props
- These set the SVG attributes directly, bypassing CSS specificity wars
- No CSS override can affect inline SVG attributes

---

## 🔴 CRITICAL BUG: External URL Fallbacks (2026-02-02)

### THE BUG THAT SLIPPED THROUGH

The "Book Class" button in the event modal was using this code:
```jsx
<a href={selectedEvent.bookingUrl || `https://www.google.com/search?q=...`}>
  Book Class
</a>
```

This meant when there was no `bookingUrl`, clicking "Book Class" opened a **Google search** instead of the in-app booking flow.

### WHY THIS IS CRITICAL

- The app HAS a proper booking system (`handleBookClick()`)
- Users expected to book in-app
- Instead they got dumped to Google
- This was a **placeholder pattern** that should NEVER reach production

### THE FIX

Changed from `<a href=...>` to `<button onClick={handleBookClick}>`:
```jsx
<button onClick={() => handleBookClick(selectedEvent)}>
  Book Class
</button>
```

### ITEMS FIXED IN THIS SESSION

| Line | Element | Before | After |
|------|---------|--------|-------|
| 11287-11293 | Book Class button | External link with Google fallback | Button using handleBookClick() |
| 11619 | Service Website button | Google search fallback | Only shows if website exists |
| 11808 | Service Website CTA | Google search fallback | Only shows if website exists |

---

## 🔧 LESSONS LEARNED: February 3, 2026

### SCRAPER DATA QUALITY

**Bug Found:** Mindbody classic scraper was extracting availability text "(8 Reserved, 0 Open)" as class names instead of actual class names like "CrossFit", "Powerlifting".

**Root Cause:** The parser read the next line after the time without checking if it was the availability text pattern.

**Fix Applied:** Added regex to skip availability text:
```javascript
// Skip availability text pattern "(N Reserved, N Open)" or "(N Reserved, N Waitlisted)"
if (/^\(\d+\s+Reserved,\s+\d+\s+(Open|Waitlisted)\)$/i.test(className)) {
  offset++;
  className = lines[i + offset] || '';
}
```

### ORPHANED EVENTS

**Problem:** 543 events had no `venue_id` (couldn't link to businesses).

**Cause:** Scrapers create events with `venue_name` but don't always link to `venue_id`.

**Fix:** Created `/tmp/link-orphaned-events.mjs` script that:
1. Gets all businesses and creates a name lookup map
2. Gets orphaned events
3. Matches venue_name to business name (exact + partial matching)
4. Updates venue_id

### BUNDLE SIZE OPTIMIZATION

**Problem:** 1,070 KB single bundle - slow on mobile.

**Fix:** Added Vite chunk splitting in `vite.config.js`:
```javascript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-icons': ['lucide-react'],
  'data': ['./src/data/realData.js'],
}
```

**Result:** Main bundle reduced to 711 KB (33% reduction), with vendor chunks cached separately.

---

## 🔧 LESSONS LEARNED: February 4, 2026

### SCRAPED DATA QUALITY - PLACEHOLDER DATES AND BAD DATA

**Bug Found:** 58 events in the database were showing the SAME date (Feb 6), time (9:00 AM), and venue (Howe Sound Inn). Events included:
- "New Year's Day Double Caesars" (should be Jan 1, not Feb 6)
- "Boxing Day Blowout" (should be Dec 26, not Feb 6)
- "Squamish Christmas Craft Market" (should be December)

**Root Cause:** The web scraper failed to extract actual event dates and used placeholder values:
- Default date: `2026-02-06`
- Default time: `09:00:00`
- All events tagged `["auto-scraped","business-website"]`

**Additional Bad Data Found:**
1. **Services mislabeled as events:** "Child Care", "Legal Advocacy", "Counselling", "Housing Services"
2. **Business listings as events:** Events where `title == venue_name`
3. **Webpage navigation items:** "Register for Programs", "Work With Us", "Our Professional Team"

**Data Cleaned:**
- 25 events with placeholder dates deleted
- 16 service/webpage items deleted
- 17 business listings deleted
- **Total:** 58 bad records removed

**Detection Queries:**
```sql
-- Find events with same date/time/venue (suspicious clustering)
SELECT start_date, start_time, venue_name, COUNT(*) as count
FROM events
GROUP BY start_date, start_time, venue_name
HAVING COUNT(*) > 3
ORDER BY count DESC;

-- Find placeholder date/time (common scraper default)
SELECT * FROM events
WHERE start_time = '09:00:00'
AND tags @> '["auto-scraped"]';

-- Find business listings masquerading as events
SELECT * FROM events WHERE title = venue_name;
```

### E2E TEST SELECTORS

**Critical Pattern:** Guest vs Authenticated selectors differ!

| User State | Auth Area Selector | What It Shows |
|------------|-------------------|---------------|
| Guest | `.header-signin-btn` | "Sign In" button |
| Authenticated | `.profile-btn` | User avatar with dropdown |

---

## 🔴 BUG: Duplicate Data Processing Functions (2026-02-04)

### THE BUG

Events were showing 4x duplicated in the UI. "Lunchtime Flow" at 12:15 PM appeared four times in a row.

### ROOT CAUSE

In `src/data/realData.js`, the `expandRecurringEvents()` function was called **TWICE** on the same data:

```javascript
// Line 8046
REAL_DATA.events = expandRecurringEvents(REAL_DATA.events);

// ... 90 lines of other code ...

// Line 8136 - DUPLICATE CALL (BUG)
REAL_DATA.events = expandRecurringEvents(REAL_DATA.events);
```

The function expands weekly recurring events into 7 instances. Called twice:
- 1st call: 1 weekly event → 7 events
- 2nd call: 7 events (each still marked "weekly") → 49 events

### THE FIX

Removed the duplicate call at line 8136.

---

## 🔴 BUG: Broken Avatar Image Without Fallback (2026-02-04)

### THE BUG

Profile photo showed as broken image (blue box with landscape icon) instead of falling back to user initials.

### ROOT CAUSE

The avatar `<img>` tag had no `onError` handler. When the image URL failed to load (expired OAuth token, invalid URL, etc.), the browser showed a broken image icon.

```jsx
// BEFORE (no error handling):
{user.avatar ? <img src={user.avatar} /> : <Initials />}

// AFTER (with error fallback):
{user.avatar ? (
  <>
    <img src={user.avatar} onError={(e) => {
      e.target.style.display = 'none';
      e.target.nextSibling.style.display = 'flex';
    }} />
    <span style={{ display: 'none' }}><Initials /></span>
  </>
) : <Initials />}
```

---

## 🔴 BUG: Scrapers Using Placeholder Fallbacks (2026-02-04)

### THE BUG

Events clustered at the same date/time (Feb 6, 9:00 AM) because scrapers used placeholder fallback values.

### ROOT CAUSE

The `parseTime()` function returned a fallback value instead of null:

```javascript
// BEFORE (BAD):
function parseTime(timeStr) {
  if (!timeStr) return '09:00';  // <-- This is the bug!
  return '09:00';  // Fallback if parsing fails
}

// AFTER (CORRECT):
function parseTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return null;
  console.warn(`Could not parse time: "${timeStr}"`);
  return null;  // Let caller decide what to do
}
```

### THE FIX PATTERN

**Parsers should return null on failure, not fallbacks:**

```javascript
// Caller decides what to do with null
if (!parsedTime) {
  console.log(`Skipping event: no valid time`);
  continue;  // Skip this event
}
```

**Never use fallback values that look like real data:**
- `'09:00'` looks real but isn't
- `'2026-02-06'` looks real but isn't
- `'TBD'` or `null` clearly indicate missing data

---

## Useful Commands Reference

```bash
# Check orphaned events
curl -s "...events?venue_id=is.null&select=count" -H "..." | jq

# Group orphaned events by venue
cat /tmp/orphaned.json | jq '[.[].venue_name] | group_by(.) | map({venue: .[0], count: length}) | sort_by(-.count)'

# Run E2E tests
npx playwright test e2e/complete-flows.spec.js --reporter=line

# Check bundle sizes after build
npm run build 2>&1 | grep -E "dist/|KB"

# Validate scraped events
npm run validate:events
```
