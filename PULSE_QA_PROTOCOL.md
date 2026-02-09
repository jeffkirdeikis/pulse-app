# PULSE QA PROTOCOL — BULLETPROOF EDITION

> **THIS IS NOT OPTIONAL. EVERY STEP MUST BE COMPLETED AND DOCUMENTED.**
> **DO NOT SKIP STEPS. DO NOT ASSUME ANYTHING WORKS. VERIFY EVERYTHING.**
> **IF YOU CANNOT VERIFY SOMETHING, MARK IT AS ❌ UNVERIFIED — NEVER ✅.**

---

## RULES OF ENGAGEMENT

### Rule 1: NO ASSUMPTIONS
You are not allowed to say something "works" or "looks correct" based on reading code. You MUST run the application, navigate to the page, and interact with the element. If you cannot do this, say so explicitly — do not fake a pass.

### Rule 2: ONE PAGE AT A TIME
Complete ALL checks for a single page/route before moving to the next. Never jump ahead. Never "come back to it later."

### Rule 3: EVIDENCE-BASED REPORTING
For every single check, you must report:
- **What you did** (exact action taken)
- **What happened** (exact observed result)
- **Pass/Fail** (based on expected vs actual)
- **If fail: what's wrong** (specific description)

Format:
```
[✅ PASS] Button: "Sign Up" → Clicked → Modal opened with email/password fields
[❌ FAIL] Button: "Sign Up" → Clicked → Nothing happened. No console errors. Button has onClick but handler is empty.
[⚠️ PARTIAL] Button: "Sign Up" → Clicked → Modal opened but email field is not focusable
```

### Rule 4: TEST LIKE A USER, NOT A DEVELOPER
Do not read the source code to determine if something works. Interact with the rendered UI. A user doesn't read your code — they click buttons. So click the buttons.

### Rule 5: BREAK THINGS ON PURPOSE
For every input: try empty submission, try special characters, try extremely long strings, try SQL injection patterns, try XSS patterns. For every flow: try going backward, try refreshing mid-flow, try double-clicking, try rapid repeated actions.

### Rule 6: DOCUMENT EVERYTHING — EVEN PASSES
A QA report that says "everything works" with no detail is a FAILED QA. Every element must have its own line item with evidence.

---

## PHASE 1: ENVIRONMENT VERIFICATION

Before testing anything, verify the app actually runs.

```
[ ] App starts without errors (npm run dev / npm start)
[ ] No console errors on initial load
[ ] App is accessible at the expected URL (localhost:XXXX)
[ ] Note the exact URL and port: _______________
[ ] All environment variables are set (.env or .env.local exists and is populated)
[ ] Database connection is live (Supabase responds)
[ ] Check browser console for any warnings or errors on load — document ALL of them
```

---

## PHASE 2: PAGE-BY-PAGE AUDIT

### For EVERY page/route in the app, complete this entire checklist:

#### 2A. PAGE LOAD
```
[ ] Page loads without blank screen
[ ] Page loads without console errors
[ ] Page loads without layout shift or flash of unstyled content
[ ] All text is visible and readable (no text-on-same-color-background)
[ ] No placeholder text visible ("Lorem ipsum", "TODO", "placeholder", "test", "asdf")
[ ] No raw code, JSON, or undefined/null displayed to user
[ ] Page is responsive: check at 375px (mobile), 768px (tablet), 1440px (desktop)
[ ] Loading states appear when data is being fetched (not just a blank space)
[ ] If data fails to load, an error state is shown (not a blank space or crash)
```

#### 2B. NAVIGATION
```
[ ] Every link on this page — click it. Does it go somewhere? Document each one:
    - Link text: ___ → Expected destination: ___ → Actual destination: ___ → [PASS/FAIL]
[ ] Back button works after navigating away
[ ] No dead links (404s)
[ ] No links that open blank pages
[ ] Active/current nav item is visually distinguished
[ ] Logo/home link returns to homepage
```

#### 2C. BUTTONS — EVERY SINGLE ONE
```
For each button on the page:
[ ] Button text: _______________
[ ] Is the button visible? ___
[ ] Does it look clickable? (cursor: pointer, hover state) ___
[ ] Click it. What happens? _______________
[ ] Is that the CORRECT behavior? ___
[ ] Click it again. Does it handle double-click gracefully? ___
[ ] If it triggers an async action: is there a loading state? ___
[ ] If it submits data: does the data actually persist? (check DB/state) ___
[ ] If it opens a modal/dropdown: does the modal/dropdown work? (see Modal checklist below) ___
```

#### 2D. FORMS & INPUTS
```
For each form/input on the page:
[ ] Input label: _______________
[ ] Is the label associated with the input? (click label, does input focus?) ___
[ ] Type valid data → submit → does it work? ___
[ ] Submit with ALL fields empty → what happens? _______________ (should show validation)
[ ] Submit with SOME fields empty → what happens? _______________
[ ] Type in extremely long text (500+ chars) → what happens? _______________
[ ] Type special characters (<script>, ', ", &, <, >) → what happens? _______________
[ ] Is there a success message/feedback after submission? ___
[ ] Does the form clear/reset after successful submission? ___
[ ] Can you submit the same data twice? Should you be able to? ___
[ ] If there's a cancel button, does it actually cancel? ___
[ ] Tab order: can you tab through all fields in logical order? ___
```

#### 2E. MODALS, DROPDOWNS, TOOLTIPS, POPOVERS
```
[ ] Does it open? ___
[ ] Does it close when clicking X? ___
[ ] Does it close when clicking outside? ___
[ ] Does it close when pressing Escape? ___
[ ] Is the content inside correct and complete? ___
[ ] If it has a form inside, test the form (see 2D) ___
[ ] Does it prevent interaction with the page behind it? (backdrop/overlay) ___
[ ] Can you scroll the page while the modal is open? (usually shouldn't) ___
```

#### 2F. IMAGES & MEDIA
```
[ ] All images load (no broken image icons) ___
[ ] Images have appropriate alt text ___
[ ] Images are appropriately sized (not stretched/squished) ___
[ ] No massive unoptimized images causing slow loads ___
```

#### 2G. DATA DISPLAY
```
[ ] If the page shows a list of items: are items actually showing? ___
[ ] Is the data correct? (spot-check 3-5 items against the database) ___
[ ] If the list should be sortable: does sorting work? ___
[ ] If the list should be filterable: does filtering work? ___
[ ] If the list should be searchable: does search work? Try partial matches, case sensitivity ___
[ ] Empty state: what happens when there's no data? (should show a message, not blank) ___
[ ] Pagination: if applicable, do all pages work? Does page 2 show different data than page 1? ___
```

#### 2G-CORRECTNESS. DATA CORRECTNESS VERIFICATION (CRITICAL)

> **This phase catches the #1 class of missed bugs: features that appear to work but produce wrong results.**
> The filter bug of Feb 8, 2026 passed all QA agents because they checked "filter dropdown opens" and "selecting a category doesn't crash" — but never verified "selecting Fitness shows only fitness results."

```
FILTER CORRECTNESS (for every filter/dropdown on the page):
[ ] Record total items BEFORE applying any filter: ___
[ ] Select Filter Option A:
    [ ] New count is LESS than total (not 0, not equal to total unless expected): ___
    [ ] Spot-check 3 visible items: do they ALL match the filter? ___
    [ ] Spot-check that items NOT matching the filter are ABSENT ___
[ ] Select Filter Option B (different option):
    [ ] New count is different from Option A (unless data legitimately overlaps): ___
    [ ] Spot-check 3 visible items match filter B ___
[ ] Select "All" / reset filter:
    [ ] Count returns to original total ___
[ ] Every dropdown option produces >0 results (if an option shows 0, it shouldn't be in dropdown) ___
[ ] Combine two filters simultaneously:
    [ ] Count is <= the count of either filter alone ___
    [ ] Results match BOTH filter criteria ___

SEARCH CORRECTNESS:
[ ] Record total items before search: ___
[ ] Search for a known item by exact name: ___
    [ ] Item appears in results ___
    [ ] Result count decreased ___
[ ] Search for partial name (first 3 letters): ___
    [ ] Correct item still appears ___
[ ] Search for something that exists but in different category: ___
    [ ] Item appears (search is cross-category unless filtered) ___
[ ] Search for nonsense string "zzzxxxyyyqqq": ___
    [ ] Shows 0 results or "no results" message ___
[ ] Clear search: ___
    [ ] All items return ___
[ ] Search + Filter combined: ___
    [ ] Results match BOTH search query AND filter ___

COUNT / DISPLAY CORRECTNESS:
[ ] Results counter text says "N results": ___
[ ] Visible card count matches or is reasonable subset of N (infinite scroll = first batch visible) ___
[ ] If counter says "0 results": ___
    [ ] No cards are displayed ___
    [ ] An empty state message is shown ___
[ ] If counter says "593 results" but you see 20 cards: is there infinite scroll/pagination? ___

DATA-TO-DATABASE CROSS-CHECK:
[ ] Pick 3 random visible items. For each:
    [ ] Title matches database record ___
    [ ] Date/time matches database record ___
    [ ] Venue/business name matches database record ___
    [ ] Category displayed matches database category ___
    [ ] Price displayed matches database price ___
```

#### 2H. STATE MANAGEMENT
```
[ ] Refresh the page. Is the state preserved where it should be? ___
[ ] Navigate away and come back. Is the state preserved? ___
[ ] Open in a new tab. Does it work independently? ___
[ ] If logged in: does the page show user-specific data? ___
[ ] If NOT logged in: does the page handle this gracefully? (redirect to login, show public view, etc.) ___
```

---

## PHASE 3: CROSS-CUTTING CONCERNS

These apply to the ENTIRE app, not individual pages.

### 3A. AUTHENTICATION FLOWS
```
[ ] Sign up with new account — full flow works end to end
[ ] Sign up with existing email — shows appropriate error
[ ] Log in with valid credentials — works
[ ] Log in with invalid credentials — shows error (not a crash)
[ ] Log out — actually logs out (can't access protected pages)
[ ] Protected pages redirect to login when not authenticated
[ ] Session persists across page refresh
[ ] Session persists across tab close/reopen (if expected)
```

### 3B. GAMIFICATION (XP, Levels, Leaderboard)
```
[ ] XP is awarded for the correct actions
[ ] XP amounts are correct per action
[ ] Level calculations are accurate
[ ] Leaderboard displays correct rankings
[ ] Leaderboard updates when XP changes
[ ] User's own position is highlighted on leaderboard
[ ] Edge case: what happens at exactly the XP threshold for a level-up?
[ ] Edge case: can a user get negative XP? Should they?
[ ] Edge case: tied XP scores — how are ties handled on leaderboard?
```

### 3C. BUSINESS DIRECTORY
```
[ ] All businesses load (count matches expected: 664+)
[ ] Search works: search for a known business name
[ ] Search works: partial name match
[ ] Search works: category search
[ ] Filters work: each filter option returns correct results
[ ] Individual business page loads with correct data
[ ] Business contact info (phone, email, website) is correct for spot-checked businesses
[ ] Map pins (if applicable) are in correct locations
[ ] Deals display correctly for businesses that have them
[ ] Events display correctly for businesses that have them
```

### 3D. EVENTS
```
[ ] Events list shows upcoming events
[ ] Past events are handled appropriately (hidden, grayed out, or in archive)
[ ] Event detail page shows complete information
[ ] Event dates/times are displayed in correct timezone
[ ] RSVP/registration works if applicable
```

### 3E. API & DATA INTEGRITY
```
[ ] Open browser DevTools → Network tab
[ ] Navigate through the app — note ALL failed requests (4xx, 5xx)
[ ] Document each failed request:
    - URL: ___
    - Status: ___
    - Expected behavior: ___
[ ] Check for requests that succeed but return empty/wrong data
[ ] Check for requests that hang indefinitely (no timeout)
[ ] Check for duplicate requests (same endpoint called multiple times unnecessarily)
```

### 3F. PERFORMANCE
```
[ ] Initial page load time: ___ seconds (should be <3s)
[ ] Note any pages that take >2 seconds to load: ___
[ ] Note any interactions that feel sluggish (>500ms response): ___
[ ] Check for memory leaks: open DevTools → Performance → record while navigating for 2 minutes
[ ] Check for excessive re-renders (React DevTools Profiler if available)
```

### 3G. VISUAL CONSISTENCY
```
[ ] Fonts are consistent across all pages
[ ] Color scheme is consistent across all pages
[ ] Spacing/padding is consistent across all pages
[ ] No elements overlapping other elements
[ ] No horizontal scrollbar on any page at standard viewport widths
[ ] Dark mode (if applicable): all pages render correctly
```

---

## PHASE 4: EDGE CASES & DESTRUCTIVE TESTING

```
[ ] Rapidly click the same button 10 times — what happens?
[ ] Open 5 tabs of the app simultaneously — any conflicts?
[ ] Disconnect internet mid-action — how does the app handle it?
[ ] Submit a form, then immediately hit back — any data corruption?
[ ] Use browser zoom (50%, 200%) — layout still usable?
[ ] Paste a massive block of text (10,000 chars) into every input field
[ ] Try accessing admin/protected routes by typing the URL directly
[ ] If there are real-time features: do they actually update in real-time?
```

---

## PHASE 5: QA REPORT STRUCTURE

After completing all phases, produce a report in EXACTLY this format:

```markdown
# PULSE QA REPORT — [DATE]

## Summary
- Total checks performed: ___
- Passes: ___
- Failures: ___
- Partial/Warnings: ___
- Blocked (could not verify): ___

## Critical Failures (must fix before launch)
1. [Page] [Element] — [What's wrong] — [Expected vs Actual]

## Major Issues (should fix before launch)
1. [Page] [Element] — [What's wrong] — [Expected vs Actual]

## Minor Issues (fix when possible)
1. [Page] [Element] — [What's wrong] — [Expected vs Actual]

## Warnings (potential issues)
1. [Page] [Element] — [What's concerning]

## Detailed Results by Page

### Page: [Route/Name]
| Element | Action | Expected | Actual | Status |
|---------|--------|----------|--------|--------|
| Sign Up Button | Click | Opens modal | Nothing happens | ❌ FAIL |
| Email Input | Empty submit | Shows error | Submits empty | ❌ FAIL |
| Logo | Click | Goes to / | Goes to / | ✅ PASS |
```

---

## HOW TO USE THIS WITH CLAUDE CODE

### Option A: Page-by-page sessions
Tell Claude Code:
> "Run QA on the [PAGE NAME] page using the QA Protocol in PULSE_QA_PROTOCOL.md. Complete every single check in Phase 2 for this page only. Do not skip any checks. Do not move to any other page. Report results in the exact format specified."

### Option B: Full QA (multi-session)
Break it into explicit sessions:
1. "Run Phase 1: Environment Verification from the QA Protocol."
2. "Run Phase 2 on the Homepage only. Complete every check."
3. "Run Phase 2 on the Business Directory page only. Complete every check."
4. (Continue for each page...)
5. "Run Phase 3: Cross-cutting concerns."
6. "Run Phase 4: Edge cases."
7. "Compile the Phase 5 report from all previous QA sessions."

### Option C: The nuclear option (recommended)
Add this to your `claude.md`:

```markdown
## QA RULES (NON-NEGOTIABLE)

When asked to run QA:
1. STOP. Read PULSE_QA_PROTOCOL.md FIRST. Fully.
2. You must complete EVERY check in the protocol. No exceptions.
3. You must provide EVIDENCE for every check. "Works" is not evidence.
4. If you cannot verify something, mark it ❌ UNVERIFIED — never ✅.
5. If you catch yourself skipping a check, STOP and go back.
6. Minimum time for full QA: 2+ hours. If you finish in 10 minutes, you did it wrong.
7. You MUST interact with the running application. Reading code is NOT QA.
8. Every button must be clicked. Every link must be followed. Every input must be tested.
9. Produce the full report in the format specified in Phase 5 of the protocol.
10. Do not summarize. Do not abbreviate. Document everything.
```

---

## ENUMERATION TEMPLATE

Before starting QA on any page, Claude Code must first enumerate everything on the page:

```markdown
## Page: [NAME] — Element Inventory

### Buttons
1. [Button text] — Location: [where on page]
2. [Button text] — Location: [where on page]
(list ALL buttons)

### Links
1. [Link text] → [expected destination]
2. [Link text] → [expected destination]
(list ALL links)

### Inputs/Forms
1. [Input label] — Type: [text/email/password/select/etc]
(list ALL inputs)

### Dynamic Content
1. [What it shows] — Source: [API/static/state]
(list ALL dynamic elements)

### Modals/Overlays
1. [Modal name] — Trigger: [what opens it]
(list ALL modals)
```

**This enumeration must be completed BEFORE any testing begins.** If you don't know what's on the page, you can't test it all.

---

## QA EXECUTION RULES

- Write findings to qa-reports/[page-name].md INCREMENTALLY — every 5 checks, flush to disk.
- If a page has 30+ interactive elements, split QA into sub-tasks (navigation, buttons, forms, data display).
- Each agent/task must have a scope small enough to complete within its context window.
- Before starting, estimate element count. If >25 elements, split the task.

---

## FINAL REMINDER

**The goal of QA is to find bugs, not to confirm the app works.**

If your QA found zero issues, you didn't look hard enough. Every application has bugs. Your job is to find them. Approach the app with skepticism. Assume everything is broken until you have proven otherwise.

**EVERY. SINGLE. ELEMENT. NO. EXCEPTIONS.**
