# CLAUDE.md - Project Instructions for Claude Code

> Detailed bug histories and lessons are in `CLAUDE-ARCHIVE.md`

---

## 🚨🚨🚨 #0 ABSOLUTE RULE: NEVER BREAK EXISTING BEHAVIOR TO FIX AN EDGE CASE 🚨🚨🚨

**On Feb 12, 2026: A fix for "evening users see empty app" changed the event filter from `e.start >= now` (current time) to `e.start >= todayMidnight` (start of day). This "fixed" the evening edge case but broke the PRIMARY behavior — users at noon saw 6 AM classes that already happened. 2,182 results included hundreds of stale events.**

### The Rule

**Every fix must preserve existing correct behavior.** If fixing edge case X would break primary behavior Y, the fix is WRONG. Find a solution that handles BOTH.

### What This Means In Practice

| Situation | WRONG approach | RIGHT approach |
|-----------|---------------|----------------|
| Evening users see empty list | Remove time filtering entirely | Show tomorrow's events when today's are done |
| Edge case fails | Weaken the guard/filter | Add a specific branch for the edge case |
| One user flow breaks | Change shared logic broadly | Fix the specific flow without touching others |

### Before Committing Any Fix, Ask:

1. **What currently works?** List the existing behaviors that depend on the code you're changing.
2. **Does my fix preserve ALL of them?** If any existing behavior breaks, the fix is not ready.
3. **Am I weakening a filter/guard/check?** Weakening (e.g. midnight instead of now, removing a validation) is almost always wrong. Add specificity instead.
4. **Test the primary flow FIRST**, then the edge case. Not the other way around.

---

## 🚨🚨🚨 #1 HIGHEST PRIORITY: SCRAPE EVERY BUSINESS — ZERO EXCEPTIONS 🚨🚨🚨

**The entire Squamish business directory (`squamish_business_directory_updated.xlsx`, ~500 businesses) MUST be scraped in its entirety on EVERY scrape run.** This is the single most important rule in the project.

### The Rule

**Every single business website is scraped every single time.** No business is skipped. No business is deprioritized. No business is marked "can't scrape" and forgotten. We have already built systems for ALL booking platforms (Mindbody, WellnessLiving, JaneApp, Brandedweb, SendMoreGetBeta), custom site scraping, and AI-verified extraction. There are ZERO exceptions.

### What Must Be Scraped

For EVERY business in the directory, the scraper searches for:
- **Classes & schedules** (fitness, yoga, martial arts, etc.)
- **Events** (workshops, community events, special occasions, etc.)
- **Deals & promotions** (discounts, specials, coupons, etc.)

### If A Site Cannot Be Scraped

1. **Log it** — Record the business name, URL, and the specific reason it failed
2. **Do NOT skip it** — It stays in the scrape queue for every run
3. **Find a solution** — Research alternative approaches (different selectors, API endpoints, cached pages, etc.)
4. **Escalate** — If after multiple attempts no solution works, flag it for manual review with full diagnostic info
5. **Never silently pass** — A silent skip is a bug

### Coverage Requirements

| Source | Method | Status |
|--------|--------|--------|
| Businesses with booking systems (Mindbody, WellnessLiving, etc.) | Dedicated booking system scrapers | ✅ Built |
| Businesses with custom websites | AI-verified extraction (`verified-extractor.js`) | ✅ Built |
| Businesses with JaneApp | JaneApp discover scraper | ✅ Built |
| Businesses with no website | Flag for manual data entry | Required |
| Businesses with WAF/Cloudflare blocking | Alternative extraction methods | Required |

### QA Verification (Highest Priority)

After every scrape run, verify:
1. **All ~500 businesses were attempted** — check scrape logs for complete coverage
2. **No business was silently skipped** — every business has a success or documented failure
3. **Data was found where expected** — venues with known schedules produced classes/events
4. **Failures are logged with diagnostics** — reason, URL, error message for every failure

---

## 🚨 QA PROTOCOL (NON-NEGOTIABLE — READ THIS BEFORE ANY QA TASK)

**Full protocol: `PULSE_QA_PROTOCOL.md`** — Read it in its entirety before any QA task.

When asked to perform QA, testing, or to "check if things work":

### BEFORE YOU START
1. **READ** `PULSE_QA_PROTOCOL.md` in its entirety. Do not skim it.
2. **ENUMERATE** every element on the page before testing anything.
3. **START THE APP** and interact with the live UI. Reading source code is NOT QA.

### DURING QA
4. Complete **EVERY** check in the protocol. No exceptions. No shortcuts.
5. Provide **EVIDENCE** for every check. "Works fine" is not evidence. Describe what you did and what happened.
6. If you **CANNOT VERIFY** something, mark it ❌ UNVERIFIED — never fake a ✅.
7. **EVERY BUTTON** must be clicked. **EVERY LINK** must be followed. **EVERY INPUT** must be tested with valid, invalid, empty, and edge-case data.
8. Test **ONE PAGE AT A TIME**. Finish all checks on Page A before moving to Page B.
9. Try to **BREAK** things. Double-click, rapid-click, empty submit, refresh mid-action, long strings, special characters.
10. If your QA found **zero issues**, you didn't look hard enough. Go back and look again.

### AFTER QA
11. Produce the **FULL REPORT** in the format specified in Phase 5 of the protocol.
12. Categorize issues as **Critical / Major / Minor / Warning**.
13. Include the **total count** of checks performed, passes, and failures.

### TIME EXPECTATIONS
- Single page QA: 15-30 minutes minimum
- Full app QA: 2+ hours minimum
- If you finish full QA in under 30 minutes, you did it wrong. Start over.

### WHAT COUNTS AS A FAILURE
- Button that does nothing when clicked → ❌
- Link that goes to wrong page or 404 → ❌
- Form that submits with empty required fields → ❌
- Console error on page load → ❌
- Data that doesn't match the database → ❌
- Loading state missing (blank space while fetching) → ❌
- No error handling when API fails → ❌
- Element not visible or not interactive on mobile → ❌
- Placeholder text visible to user ("Lorem ipsum", "TODO") → ❌

### QA EXECUTION RULES
- Write findings to qa-reports/[page-name].md INCREMENTALLY — every 5 checks, flush to disk.
- If a page has 30+ interactive elements, split QA into sub-tasks (navigation, buttons, forms, data display).
- Each agent/task must have a scope small enough to complete within its context window.
- Before starting, estimate element count. If >25 elements, split the task.

---

## 🚨🚨🚨 CRITICAL: COMMIT EVERY FIX IMMEDIATELY 🚨🚨🚨

**On Feb 4, 2026, documented fixes in CLAUDE-ARCHIVE.md were NEVER actually committed, causing massive regressions.**

### MANDATORY After Any Bug Fix:

```bash
# 1. Show what changed
git diff --stat

# 2. Commit immediately (don't batch!)
git add <specific-files>
git commit -m "Fix: <description>"

# 3. Confirm to user
echo "Committed: <commit-hash>"
```

### NEVER:
- Say "fixed" without showing `git diff`
- End session with uncommitted fixes
- Document a fix in CLAUDE-ARCHIVE.md without ALSO committing the code change

### Before Ending Any Session:
```bash
git status  # Must show "nothing to commit" or explicitly ask user to commit
```

---

## PROJECT CONTEXT

- **App**: Pulse - community platform for Squamish BC
- **Stack**: React + Vite + Supabase (664 businesses)
- **Dev URL**: http://localhost:5173/
- **Key Files**:
  - `src/App.jsx` - Main app (25k+ lines)
  - `src/hooks/useUserData.js` - User data/save
  - `src/lib/supabase.js` - Database connection
  - `src/data/realData.js` - Static data

**Credentials**: Check `.env.local` before asking user (contains Supabase, Google, Firecrawl keys)

---

## 🚨🚨🚨 REAL DATA ONLY - ZERO TOLERANCE FOR FAKE DATA 🚨🚨🚨

**On Feb 6, 2026: The AI scraper hallucinated 1,471 fake events (64% of all data). "Yoga for Beginners" at Shoppers Drug Mart, "Mixed Martial Arts" at a pharmacy, "Electrical Wiring 101" at an electrician. ALL were completely invented by the AI.**

### The Rule

**Web scraping is essential and encouraged** — all event/class data comes from scraping real websites. The core risk is **AI hallucination**: feeding raw HTML to an LLM and asking it to "extract" events can result in the AI *inventing* fake events. This is solved by **source text verification** — every AI-extracted event must be deterministically verified against the page text before insertion.

**Every piece of data in the app MUST come from a real, scrapeable source.** No exceptions. This applies to:

- **Events & Classes**: From web scrapers (Mindbody, WellnessLiving, JaneApp, verified AI extraction, or any scraper that produces real data), or manually submitted by business owners
- **Deals**: Only from business owners or verified promotions
- **Business info**: Only from the Supabase `businesses` table (real directory data)
- **Business panel**: Real data only - no placeholder/demo content
- **Admin panel**: Real data only - no placeholder/demo content
- **UI placeholders**: If sample data is needed for empty states, label it clearly as "example" and never mix with real data

### What Is Banned

| Banned | Why |
|--------|-----|
| **Unverified** AI extraction (feeding HTML to LLM without source verification) | The LLM hallucinates plausible-sounding but completely fake events |
| `scrape-with-ai.js` | DISABLED - feeds HTML to Claude without any verification |
| Old `extractWithAI()` in `scrape-orchestrator.js` | REMOVED - no source text verification |
| Hardcoded sample events/classes | Could be mistaken for real data |
| Fallback/default event data | Users cannot distinguish fake from real |

### What IS Allowed (and encouraged)

| Source | Trust Level |
|--------|-------------|
| **Dedicated booking system scrapers** (Mindbody, WellnessLiving, JaneApp, etc.) | High - parses real structured data |
| **Verified AI extraction** (`verified-extractor.js` with 5-layer anti-hallucination) | Medium - AI extracts, then every title+date verified in page text |
| Any web scraper that parses structured data | High - reads what's actually on the page |
| User-submitted events (via Submit Event form) | Medium - human-verified |
| Business owner submissions | Medium - business-verified |
| Supabase `businesses` table | High - curated directory |

### Verified AI Extraction Pipeline (5 anti-hallucination layers)

The `scripts/lib/verified-extractor.js` module enables safe AI extraction:

1. **Signal pre-filter** (free) — pages without dates, times, and event keywords never reach AI
2. **Strict AI prompt** — uses `innerText` (not HTML), requires `source_quote`, explicitly says "return empty if none"
3. **Source text verification** — every extracted title must appear in page text (80%+ word match), date OR time must appear in page text
4. **event-validator.js** — forbidden titles, AI hallucination patterns, placeholder detection, clustering detection
5. **Database constraints** — CHECK constraints, holiday triggers, quarantine table

All AI-verified events are tagged `['auto-scraped', 'ai-verified', 'website-verified']` with `confidence_score = 0.75` for easy bulk query/delete.

### Before Adding Any New Scraper

1. **Scraper must produce verifiable data** (DOM parsing, APIs, JSON-LD, or AI with source verification)
2. **Confirm** the scraped data matches what actually appears on the website
3. **Validate** with the scraper data quality checks (see SCRAPER DATA QUALITY section)
4. **Never** use an LLM to "fill in" or "invent" data — if data doesn't exist on the page, don't create it

---

## 🚨 CRITICAL: NEVER DESTROY UNCOMMITTED WORK

### Prohibited Commands (require explicit user approval)

| Command | Destruction |
|---------|-------------|
| `git checkout <file>` | All changes to that file |
| `git checkout .` / `git restore .` | All uncommitted changes |
| `git reset --hard` | Uncommitted changes |
| `git reset --hard HEAD~N` | Commits AND changes |
| `git clean -f` | Untracked files |
| `git push --force` | Remote history |

### When You Encounter a Syntax Error

**DO**: Read error → Find line → Fix specific issue → `npm run build`

**NEVER**: `git checkout` or `git restore` to "start fresh"

### Safe Way to Undo a Change

1. Read the specific lines
2. Use Edit tool on ONLY those lines
3. Verify with `npm run build`

---

## 🔴 CRITICAL: INPUT & BUTTON TESTING

### Bug Patterns That Keep Recurring

| Pattern | Detection | Fix |
|---------|-----------|-----|
| Placeholder onClick | `grep "onClick.*alert"` | Replace with real handler |
| Missing onClick | `grep "<button.*>" \| grep -v "onClick"` | Add handler |
| Invisible text | Type in input, text not visible | Add `color: #1f2937` |
| Z-index blocking | Can't click/type | Add `z-index: 100; pointer-events: auto` |
| Unused confirm() | `grep "confirm("` without if/else | Use the return value |
| Undefined function | `grep "const funcName"` returns nothing | Define the function |
| RLS blocking | `error: null` but `data: []` | Check RLS policies |

### Mandatory Tests After Any UI Change

```
FILTERS (Feb 8, 2026 lesson — MOST COMMONLY MISSED):
1. Select each filter option
2. Verify results COUNT CHANGES (not 0 unless expected)
3. SPOT-CHECK 3 visible results — do they MATCH the filter?
4. Reset filter — count returns to original
5. Every dropdown option must produce >0 results
6. Combine 2 filters — results match BOTH criteria

BUTTONS:
1. Click every button
2. Verify action happens (not alert/console.log)
3. Verify correct result

INPUTS:
1. Click into every input
2. Type "test123"
3. Verify text appears AND is visible

MODALS:
1. Open modal
2. Verify content populated
3. Close via X, overlay click, AND ESC
```

### Search for Problems Before Marking Complete

```bash
grep -n "onClick.*alert\|alert('" src/App.jsx | grep -v "Failed\|Error"  # Placeholders
grep -n "<button.*>" src/App.jsx | grep -v "onClick"                      # Missing handlers
grep -n "TODO\|FIXME" src/App.jsx                                         # Incomplete code
```

---

## 🚨🚨🚨 MANDATORY VISUAL QA - #1 CRITICAL RULE 🚨🚨🚨

**On Feb 4, 2026: Claimed icons were "fixed" 10+ times based on computed styles and code changes. Every time the icons were still visually broken. STOP CLAIMING THINGS ARE FIXED WITHOUT VISUAL PROOF.**

**On Feb 7, 2026: Implemented entire Admin Impersonation feature, reported it as complete with only `npm run build` passing. App crashed immediately with a ReferenceError on load. The user had to find the bug, not Claude.**

### HARD STOP RULE — NO EXCEPTIONS

**After EVERY code change to src/App.jsx or any component file, you MUST:**

```bash
# OPTION A: Full automated QA (if dev server running on :5173)
node qa.cjs
# → Runs build, checks for crashes, error boundaries, console errors
# → Takes screenshot, exits non-zero on failure
# → Then: Read /tmp/qa-screenshot.png (ACTUALLY VIEW IT)

# OPTION B: Manual (if dev server not running)
npm run build
node screenshot.cjs
# Then: Read /tmp/classes-list.png (ACTUALLY VIEW IT)
```

**`node qa.cjs` catches what `npm run build` CANNOT:**
- Runtime ReferenceError / TypeError (like the Feb 7 TDZ crash)
- Error boundary rendering ("Something went wrong")
- Blank screens
- Critical console errors

**Do NOT report a change as complete without running QA. If qa.cjs exits non-zero, the change is BROKEN — fix it before reporting to the user.**

### The Only Valid QA for Visual Changes

1. Take screenshot
2. **ACTUALLY LOOK at the screenshot**
3. **CONFIRM with your own eyes** that the fix is visible
4. If you can't clearly see the fix working → IT'S NOT FIXED

### What Does NOT Count as Verification

| NOT Valid | Why |
|-----------|-----|
| `npm run build` passes | Build doesn't catch runtime errors, visual bugs, or crashes |
| Computed styles show correct values | CSS can be "correct" but still not render |
| Code review looks right | Code can be wrong even if it looks right |
| "Should work now" | Assumptions are not verification |
| Reporting to user without screenshot | You are guessing, not verifying |

### Screenshot Protocol

```bash
# 1. Take screenshot
node screenshot.cjs

# 2. READ the screenshot file - actually view it
Read tool on /tmp/classes-list.png

# 3. LOOK at the image and ASK YOURSELF:
#    - Does the app render at all? (no error boundary, no blank screen)
#    - Can I clearly see the element that was changed?
#    - Is it now visually correct?
#    - Would the user be satisfied?

# 4. If ANY doubt → the fix is not complete
```

### Lucide Icon Fix Pattern (PROVEN Feb 4, 2026)

**WRONG** - These do NOT reliably work:
```jsx
<Bell size={22} color="#374151" strokeWidth={2} />
<Bell size={22} color="#374151" style={{ stroke: '#374151' }} />
```

**CORRECT** - Wrap in div with color set:
```jsx
<div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <Bell size={22} strokeWidth={2} />
</div>
```

Lucide icons use `stroke: currentColor`. The `currentColor` value requires a parent element with `color` set via CSS/style for proper inheritance inside button elements.

### OAuth Avatar Lesson (Feb 5, 2026) - DON'T OVER-FIX

**SCENARIO**: User reported profile icon showed "landscape image" (Google's default avatar).

**WRONG RESPONSE**: I tried to filter out Google default avatars with URL pattern matching:
```javascript
// BAD: This filter matches ALL Google avatars, not just defaults!
url.includes('/a-/') // <-- This is in EVERY Google profile URL
```

**RESULT**: Broke the avatar completely - showed broken image icon instead.

**LESSON LEARNED**:
1. Don't "fix" things the user didn't explicitly ask to fix
2. Google default avatars ARE valid - users may prefer them over initials
3. URL pattern matching for OAuth is dangerous - test thoroughly
4. A broken image is WORSE than an ugly default
5. **ASK the user what they want before changing avatar behavior**

---

## 📋 QA PROTOCOL

### Before Reporting Any Task Complete

1. **Build**: `npm run build` passes
2. **Database**: Query confirms data exists
3. **Code**: `grep` confirms changes saved
4. **Visual**: Screenshot confirms visible
5. **Console**: No red errors in DevTools

### Database Verification

```bash
# Check table has data
curl -s "https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/TABLE?select=*&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

| Changed | Verify |
|---------|--------|
| Classes | `events?event_type=eq.class` returns data |
| Events | `events?event_type=eq.event` returns data |
| Deals | `deals` returns data |
| Saved items | `saved_items?user_id=eq.XXX` shows item |

### Minimum Testing Matrix

| Change | Test |
|--------|------|
| Button | Click → action happens |
| Input | Type → text visible |
| Modal | Open → content visible → close works |
| Feature | Guest + auth user flows |
| Bug fix | Reproduce original → verify fixed |
| Styling | Screenshot → visually verify |

---

## 🔴 BUG ANALYSIS PROTOCOL

When a bug is reported:

1. **Fix** the bug
2. **Analyze** root cause (see categories below)
3. **Update** CLAUDE.md AND e2e/MASTER_QA_CHECKLIST.md
4. **Add** e2e test if possible

### Root Cause Categories

| Category | Example | Prevention |
|----------|---------|------------|
| Existence ≠ Function | Button exists, no onClick | Test clicking produces result |
| Placeholder Code | `alert('TODO')` | Search for alert/TODO |
| Missing State | isAdmin hardcoded false | Test all user states |
| CSS Blocking | z-index blocks input | Actually TYPE in inputs |
| Wrong Context | Modal in wrong view | Verify render context |
| Partial Testing | Modal opens, inputs broken | Test ENTIRE feature |
| **Computed ≠ Visual** | Styles show correct color, icon still invisible | **LOOK at the screenshot** |
| **CSS Inheritance** | Lucide icon color prop doesn't work in buttons | Wrap in div with color style |
| **Over-Fixing** | Tried to "fix" Google avatar by filtering URLs, broke everything | Ask user what they want first |
| **Scraper Date Duplication** | Navigation fails silently, same schedule stamped on every day for 30 days | Parse dates from page text, never assign computed dates from loop counters |
| **AI Data Hallucination** | AI invented 1,471 fake events like "Yoga Class" at A&W, "MMA" at a pharmacy | ALWAYS verify AI-extracted data against source page text. Use `verified-extractor.js` with 5-layer anti-hallucination pipeline |
| **Dedup Missing Key Fields** | `classExists()` checked title+date+venue but NOT time, dropping same-title classes at different times (Wild Life Gym lost 50%+ of classes) | Dedup checks MUST include ALL fields that make a record unique (title+date+time+venue) |
| **Booking System ≠ Public Schedule** | Roundhouse has WellnessLiving but schedule shows "no classes" — they use it for member mgmt, not public scheduling | Always verify a detected booking system actually has public data before adding to scraper |
| **Existence ≠ Correctness (Filters)** | Category filter UI worked (dropdown opened, options selectable, no crash) but checked `e.tags` (scraper metadata) instead of `e.category` (actual category). 9 QA agents missed it. | EVERY filter must be tested with data verification: select option → spot-check 3 results match → verify count changed → verify 0-result options don't exist in dropdown |
| **UTC vs Local Timezone** | Supabase runs in UTC. `CURRENT_DATE`/`CURRENT_TIME` are UTC. At 9 PM Pacific (5 AM UTC+1), CURRENT_DATE is tomorrow, CURRENT_TIME is 05:00. "Filter past slots" check using UTC lets 8:30 AM morning slots through because `08:30 > 05:00` | ALWAYS use `(now() AT TIME ZONE 'America/Vancouver')` for Pacific time comparisons. JS `toISOString()` also converts to UTC — use `getFullYear()/getMonth()/getDate()` for local dates |
| **Scraper Data Must Be Verified** | Added 547 slots to database without verifying each clinic's data against live API. Dr. Thea Lanoue appeared to have false data until verified | After EVERY scraper run, run QA verification script comparing DB against live JaneApp API for each clinic. Never trust scraper output without cross-checking |
| **CTA Button Wrong Action** | "Book Class" CTA in EventDetailModal used `<a href=Google search>` instead of `handleBookClick()` which opens the actual booking sheet/iframe. Quick action "Book" button was correct but CTA was a dead-end to Google. | EVERY button/CTA that performs an action must call the SAME handler as the equivalent action elsewhere. Don't use `<a>` tags with Google search fallbacks for in-app booking actions. When duplicating a button's purpose (quick action vs CTA), both MUST use the same `onClick` handler. |
| **Fix Breaks Primary Behavior** | Changed event filter from `now` to `todayMidnight` to help evening users — broke daytime filtering, showing 6 AM classes at noon (2,182 stale results). | NEVER weaken a filter/guard to fix an edge case. Add a specific branch instead. Test the primary flow FIRST, then the edge case. |

---

## 🚫 RED FLAGS - STOP AND FIX

Never mark complete if:

- `npm run build` shows errors
- Database query returns empty/error
- Button has no onClick or uses alert()
- Input doesn't accept typing
- Modal opens empty
- You haven't actually tested it
- Assuming it works from code review only
- **For visual fixes: You haven't taken AND VIEWED a screenshot**
- **Computed styles look correct but you haven't visually verified**
- **You're about to say "should work now" or "that should fix it"**
- **Any date/time comparison uses CURRENT_DATE, CURRENT_TIME, or toISOString() without timezone awareness**
- **Scraper data inserted without verifying against live API source**
- **Wellness slots added without running QA verification across all clinics**
- **Your fix weakens a filter, guard, or validation** — weakening shared logic to fix an edge case WILL break the primary behavior. Add specificity instead.
- **You haven't tested the PRIMARY flow after your fix** — always verify existing behavior still works before checking the edge case

---

## 📊 SCRAPER DATA QUALITY

### Validation After Any Scraper Run

```sql
-- 🚨 Date duplication detection (CRITICAL - Feb 5, 2026 lesson)
-- Ratio > 25 means navigation failed and same schedule was stamped on every day
SELECT venue_name, COUNT(*) as total, COUNT(DISTINCT title) as titles,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT title), 0), 1) as ratio
FROM events WHERE tags @> '{"auto-scraped"}' AND event_type = 'class'
GROUP BY venue_name HAVING COUNT(*)::numeric / NULLIF(COUNT(DISTINCT title), 0) > 20
ORDER BY ratio DESC;

-- Suspicious clustering (placeholder detection)
SELECT start_time, COUNT(*) FROM events
WHERE tags @> '{"auto-scraped"}'
GROUP BY start_time ORDER BY COUNT(*) DESC LIMIT 5;

-- Business listings as events (bad data)
SELECT * FROM events WHERE title = venue_name;

-- Orphaned events
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;
```

### Scraper Date Duplication Lesson (Feb 5, 2026)

**SCENARIO**: WellnessLiving and Brandedweb scrapers used day-by-day loops with fragile page navigation (CSS selectors that don't match, hardcoded pixel clicks). When navigation failed silently, the same page was scraped 30 times and each iteration assigned a different computed date. Result: every class appeared on every day for 30 days (785+ bad records).

**THE RULE**: Scrapers must NEVER assign dates from a loop counter. Dates must ALWAYS come from:
1. Parsed day headers in the page text (e.g., "Thursday, February 05, 2026")
2. API responses that are date-specific (e.g., Mindbody widget API with `start_date` param)
3. DOM elements that display the actual date

**SAFEGUARDS ADDED**:
- `validateScrapedData()` runs after each scraper and auto-deletes data with ratio > 25x
- `insertClass()` rejects records without valid date format
- Navigation failures log warnings and stop scraping (instead of continuing with stale data)

### Dedup False-Positive Lesson (Feb 6, 2026)

**SCENARIO**: `classExists()` in all 6 scraper files checked only `title + date + venue_name` to detect duplicates. It did NOT check `start_time`. When a studio has the same class at different times (e.g., "Train Wild" at 7:45 AM, 9:00 AM, 10:15 AM), only the first one was inserted — the rest were falsely flagged as duplicates and dropped.

**IMPACT**: Wild Life Gym lost 50%+ of its classes (113 vs 217). Squamish Barbell lost ~28% (376 vs 524). The bug existed in ALL 6 scraper files.

**THE RULE**: Dedup checks MUST include ALL fields that make a record unique. For classes: `title + date + time + venue`. The corrected `classExists()` function includes `start_time` in the query.

**ALSO LEARNED**: Detecting a booking system (e.g., WellnessLiving on Roundhouse's website) does NOT mean the schedule is public. Always verify the page actually returns class data before adding to scrapers.

### Scraper Rules

| DO | DON'T |
|----|-------|
| Return `null` when parsing fails | Return fallback like `'09:00'` |
| Skip records with missing fields | Insert with fake values |
| Log warnings for debugging | Silently use defaults |
| Include ALL unique fields in dedup checks | Check only title+date (misses time) |
| Verify booking system has public data | Assume detection means data exists |

### Bad Data Indicators

- Many events at 9:00 AM with `auto-scraped` tag
- Events where title = venue_name
- Holiday events on wrong dates
- Studio with suspiciously low class count (dedup dropping valid records)

---

## 🔍 USEFUL COMMANDS

```bash
# Run SQL on Supabase
export SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN .env.local | cut -d'=' -f2)
curl -X POST "https://api.supabase.com/v1/projects/ygpfklhjwwqwrfpsfhue/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR SQL HERE"}'

# Take screenshot
node screenshot.cjs

# Validate events
npm run validate:events

# E2E tests
npx playwright test e2e/complete-flows.spec.js --reporter=line
```

---

## 📁 RELATED DOCUMENTS

- `PULSE_QA_PROTOCOL.md` - **Bulletproof QA protocol** (full checklists, phases, report format)
- `qa-runner.sh` - **Automated QA runner** (runs full QA suite, generates reports)
- `e2e/MASTER_QA_CHECKLIST.md` - 185+ test cases (keep in sync with this file)
- `CLAUDE-ARCHIVE.md` - Detailed bug histories and lessons learned
