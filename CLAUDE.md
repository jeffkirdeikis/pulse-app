# CLAUDE.md - Project Instructions for Claude Code

---

## 🚨 CRITICAL: NEVER DESTROY UNCOMMITTED WORK 🚨

### ABSOLUTE PROHIBITIONS (NO EXCEPTIONS)

**NEVER run these commands without EXPLICIT user approval:**
```bash
# FILE RESTORATION (destroys uncommitted changes)
git checkout <file>          # DESTROYS all changes to that file
git checkout .               # DESTROYS all uncommitted changes
git restore <file>           # DESTROYS all changes to that file
git restore .                # DESTROYS all uncommitted changes

# HARD RESETS (destroys commits and changes)
git reset --hard             # DESTROYS uncommitted changes
git reset --hard HEAD~N      # DESTROYS commits AND changes
git clean -f                 # DESTROYS untracked files

# FORCE OPERATIONS
git push --force             # Can destroy remote history
git rebase (interactive)     # Can rewrite history
```

### WHY THIS MATTERS

On January 31, 2026, I destroyed hours of work by running `git checkout src/App.jsx` to "fix" a syntax error. This wiped out:
- ContactModal implementation
- Messaging system integration
- Book Class functionality
- Multiple bug fixes

**The syntax error could have been fixed in 2 minutes. Instead, I destroyed hours of work.**

### WHEN YOU ENCOUNTER A SYNTAX ERROR

**DO THIS:**
1. Read the error message carefully - it tells you the line number
2. Read that line and surrounding context
3. Look for: missing brackets, unclosed strings, misplaced commas
4. Fix the specific syntax issue
5. Run build again to verify

**NEVER DO THIS:**
- Run `git checkout` to "start fresh"
- Run `git restore` to "undo the broken change"
- Revert the entire file

### WHEN YOU WANT TO UNDO A CHANGE

**SAFE approach:**
1. Read the specific lines you want to change back
2. Use the Edit tool to change ONLY those specific lines
3. Verify the fix with `npm run build`

**UNSAFE approach (PROHIBITED):**
- `git checkout <file>` - destroys EVERYTHING
- `git restore <file>` - destroys EVERYTHING

### BEFORE ANY DESTRUCTIVE GIT COMMAND

If you believe you MUST use a destructive command:

1. **STOP** - Ask yourself: "Is there a safer way?"
2. **ASK THE USER** - "I want to run `git checkout src/App.jsx` which will destroy all uncommitted changes. Is that okay?"
3. **WAIT FOR EXPLICIT APPROVAL** - Do not proceed without "yes"
4. **DOCUMENT WHAT WILL BE LOST** - List the changes that will be destroyed

### COMMIT FREQUENTLY

After completing ANY working feature:
```bash
git add <specific-files>
git commit -m "Description of what works"
```

This creates a save point. If something breaks later, you can recover.

### SYNTAX ERROR DEBUGGING CHECKLIST

When you see a syntax error:

- [ ] Read the EXACT error message
- [ ] Note the line number mentioned
- [ ] Read lines (error_line - 10) to (error_line + 10)
- [ ] Look for these common issues:
  - Missing closing bracket: `}`, `)`, `]`
  - Missing comma between items
  - Unclosed string or template literal
  - Function accidentally nested inside another function
  - Missing semicolon before next statement
- [ ] Fix the SPECIFIC issue
- [ ] Run `npm run build` to verify
- [ ] If still broken, repeat - do NOT revert the file

---

## 🔴 CRITICAL: INPUT TESTING (REPEATED FAILURE)

### THIS BUG HAS HAPPENED 7 TIMES

On February 1, 2026, UI bugs were reported SEVEN separate times:
1. Claim Business form inputs (z-index blocking)
2. Admin view showing nothing (isAdmin issue)
3. Edit button doing nothing (modal in wrong context)
4. Edit Business modal inputs not accepting text (pointer-events)
5. Edit Business modal text invisible (white text on white background)
6. **Eye (view) button does nothing** (placeholder alert() code)
7. **Save Changes button doesn't update UI** (updates DB but UI shows static data)

**PATTERNS IDENTIFIED:**
- Buttons have placeholder code (alert/console.log) instead of real functionality
- UI doesn't refresh after database updates
- Testing element existence instead of functionality

### BUG #5: Text Invisible in Input Fields
- **Root cause**: CSS rules didn't specify `color` property
- **Fix**: Added `color: #1f2937 !important;` to all modal input rules

### BUG #6: Eye (View) Button Does Nothing
- **What happened**: Clicking eye button just shows `alert()` - placeholder code
- **Root cause**: Button had `onClick={() => alert(...)}` instead of real functionality
- **Why I missed it**: I never clicked the button. Tests checked existence, not function.
- **Fix**: Changed to `onClick={() => setSelectedService(venue)}` to open detail modal

### BUG #7: Save Changes Doesn't Update UI
- **What happened**: Save appeared to work but UI showed old data
- **Root cause**: Admin panel used static `REAL_DATA.venues` instead of `services` from Supabase
- **Fix**: Changed admin panel to use `services` from Supabase, added `fetchServices()` after save

### COMPREHENSIVE QA AUDIT (2026-02-01)
5 QA agents tested the entire app and found these additional non-functional buttons:

| Button | Issue | Fix Applied |
|--------|-------|-------------|
| Delete venue (admin) | `confirm()` ignored result | Added actual delete logic |
| Submit Event | No onClick handler | Redirects to submission modal |
| Delete Account | No onClick handler | Added confirmation + toast |
| Create Deal | No onClick handler | Opens submission modal |
| Edit Profile | No onClick handler | Opens edit venue modal |
| Admin tabs | No onClick handlers | Still needs fix |
| Time period buttons | No onClick handlers | Still needs fix |
| Logo upload | Shows alert() | Still needs fix |

**KEY LESSON**: Buttons without onClick handlers or with alert() are NOT working - they're placeholders

### BUG #8: showToast is not defined
- **What happened**: Save Changes button clicked, Supabase update succeeded, but then `showToast is not defined` error
- **Root cause**: `showToast()` function was USED throughout the app but NEVER DEFINED
- **Why I missed it**: The code looked correct, I assumed showToast existed because it was used everywhere
- **Fix**: Added `showToast` helper function that wraps `setCalendarToastMessage`

**LESSON**: When using a function, verify it's actually defined - not just that it's used elsewhere

### BUG #9: Supabase update returns empty array (RLS blocking)
- **What happened**: Save Changes clicked, no error thrown, but data didn't update
- **Root cause**: Supabase RLS (Row Level Security) silently blocked the update - `data: []` with `error: null`
- **Why I missed it**:
  1. I saw `error: null` and assumed success
  2. I didn't verify the data ACTUALLY CHANGED in the database
  3. I didn't check if `data` array was empty
- **Fix**:
  1. Added check: `if (!data || data.length === 0)` = update was blocked
  2. Need to add RLS policy in Supabase to allow admin updates

**LESSON**:
- `error: null` does NOT mean success - check if `data` array has items
- **After ANY database write, VERIFY the data changed** - query it back or check the response
- Supabase RLS can silently block operations without throwing errors

### MANDATORY INPUT TEST

After ANY change involving forms or modals:

```
1. Open the modal/form
2. Click into EVERY input field
3. TYPE actual text: "test123"
4. VERIFY the text appears in the field
5. VERIFY the text is VISIBLE (readable color)
6. If text doesn't appear or is invisible → NOT FIXED
```

### NEVER SKIP QA

If you cannot test something:
1. **Do NOT claim it's fixed**
2. **Document what you cannot test** and WHY
3. **Tell the user** so we can test it together
4. **Ideally, find a way to test it yourself** (create test script, screenshot, etc.)

### MANDATORY BUTTON TEST

After ANY change involving buttons:

```
1. CLICK every button
2. VERIFY an action happens (not just alert/console.log)
3. VERIFY the action is CORRECT (right modal, right data, right result)
4. If button shows alert() or console.log → PLACEHOLDER CODE, NOT WORKING
```

### SEARCH FOR PLACEHOLDER CODE AND NON-FUNCTIONAL BUTTONS

Before marking ANY feature complete, run these checks:

```bash
# Find alert() placeholders (NOT real error handling)
grep -n "onClick.*alert\|alert('" src/App.jsx | grep -v "Failed\|Error"

# Find buttons without onClick handlers
grep -n "<button.*>" src/App.jsx | grep -v "onClick"

# Find confirm() that doesn't use the result
grep -n "confirm(" src/App.jsx

# Find TODO/FIXME comments
grep -n "TODO\|FIXME" src/App.jsx

# CRITICAL: Verify functions are DEFINED, not just USED
grep -n "const showToast\|function showToast" src/App.jsx
# If a function is used but this returns nothing = BUG
```

**RED FLAGS:**
- `alert('...')` in onClick = PLACEHOLDER, not working
- `<button>` without onClick = DOES NOTHING
- `confirm()` without if/else = CONFIRMATION IGNORED
- Function used but never defined = WILL CRASH AT RUNTIME

### WHY THIS KEEPS HAPPENING

- I verify the element exists (`.toBeVisible()`)
- I verify the modal opens
- I DON'T actually type in the inputs
- CSS z-index/pointer-events blocks the input
- User reports it's broken

### THE FIX PATTERN

When inputs don't work, add to CSS:
```css
position: relative;
z-index: 100;
pointer-events: auto !important;
user-select: text;
```

### WHEN FIXING ONE MODAL'S INPUTS

Check ALL modals:
- Auth modal inputs
- Claim business modal inputs
- Edit venue modal inputs
- Profile settings inputs
- Submit event form inputs
- Contact/message form inputs
- Any other modal with inputs

**ONE BROKEN = CHECK ALL**

---

## 🖼️ MANDATORY VISUAL QA WITH SCREENSHOTS

### WHY THIS MATTERS

On January 31, 2026, I spent 45+ minutes claiming icons were "fixed" when they weren't visible at all. I kept saying "Build passed, please refresh" without ever actually looking at the app. The user had to send multiple screenshots showing the same broken UI.

**"npm run build" passing does NOT mean the feature works visually.**

### SCREENSHOT TOOL SETUP

A puppeteer script exists at `screenshot.cjs`. Use it to take screenshots:

```bash
# Take a screenshot of the current app state
node screenshot.cjs
```

This saves to `/tmp/app-modal.png`. Then view it:

```bash
# View the screenshot (use Read tool)
Read /tmp/app-modal.png
```

### WHEN TO TAKE SCREENSHOTS

**ALWAYS take a screenshot to verify:**
- Any UI change (buttons, icons, modals, layout)
- Any styling change (colors, sizes, visibility)
- Any new component or feature
- When user reports something is broken/missing
- BEFORE telling the user "it's fixed" or "please refresh"

### VISUAL QA CHECKLIST

Before reporting a UI task complete:

- [ ] `npm run build` passes
- [ ] Run `node screenshot.cjs` to capture the app
- [ ] View `/tmp/app-modal.png` with Read tool
- [ ] Visually confirm the change is actually visible
- [ ] If not visible, debug and fix - do NOT tell user to refresh
- [ ] Take another screenshot to confirm the fix
- [ ] Only THEN report to user with confidence

### MODIFYING THE SCREENSHOT SCRIPT

If you need to test a specific page or interaction, modify `screenshot.cjs`:

```javascript
// To test a specific section, modify the page.evaluate() calls
// To change viewport: page.setViewport({ width: X, height: Y })
// To wait longer: await new Promise(r => setTimeout(r, 3000))
// To click something: await page.click('.selector')
```

### RED FLAGS - STOP AND SCREENSHOT

If you find yourself saying any of these, STOP and take a screenshot first:
- "The icon should be visible now"
- "Please refresh and check"
- "I added the CSS, it should work"
- "Build passed, so it should render"
- "I can't see the browser but the code looks right"

**NONE of these are acceptable without a screenshot verification.**

---

## PROJECT CONTEXT
- This is Pulse, a community platform for Squamish BC
- Frontend: React + Vite
- Database: Supabase (664 businesses)
- The app runs at http://localhost:5173/

## KEY FILES
- src/App.jsx - Main app (large file, 25k+ lines and growing)
- src/hooks/useUserData.js - User data and save functionality
- src/lib/supabase.js - Database connection
- src/lib/gamification.js - XP system

---

## MANDATORY QA PROTOCOL

### BEFORE REPORTING ANY TASK COMPLETE:

#### STEP 1: Verify App Compiles
```bash
npm run build
```
- If there are ANY red errors, fix them first
- Do NOT proceed until build succeeds

#### STEP 2: Check Dev Server Running
```bash
# Check terminal for errors after npm run dev
# Look for: "ready in X ms" and "Local: http://localhost:5173/"
# If you see red text or "error", fix it first
```

#### STEP 3: Database Verification
For ANY feature involving data, run these:
```bash
# Check if table has data (replace TABLE_NAME)
curl -s "https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/TABLE_NAME?select=*&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"

# Count total rows
curl -s "https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/TABLE_NAME?select=count" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Prefer: count=exact"
```

**Required checks by feature type:**

| If you changed... | You MUST verify... |
|-------------------|---------------------|
| Classes | `curl .../events?event_type=eq.class` returns data |
| Events | `curl .../events?event_type=eq.event` returns data |
| Deals | `curl .../deals` returns data |
| Businesses | `curl .../businesses?limit=5` returns data |
| User actions | `curl .../user_actions` after triggering action |
| Saved items | `curl .../saved_items?user_id=eq.XXX` shows saved item |

#### STEP 4: Code Verification
```bash
# Search for the code you added/changed to confirm it's there
grep -n "UNIQUE_STRING_FROM_YOUR_CHANGE" src/App.jsx

# Check the specific function exists
grep -A 10 "function_name" src/App.jsx
```

#### STEP 5: Console Error Check
```bash
# Build and check for warnings/errors
npm run build 2>&1 | grep -i "error\|warning"
```

#### STEP 6: Cross-Reference UI and Data

Before saying "search for X to see results":
1. Run the database query that the UI would run
2. Confirm it returns data
3. Check the UI code actually uses that query
4. Verify field names match between database and UI
```bash
# Example: If UI searches classes by business name
curl -s "https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*,businesses(name)&event_type=eq.class&businesses.name=ilike.*shala*" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

---

## QA REPORT TEMPLATE

After EVERY task, provide this report:
```
## QA REPORT

### Build Status
- [ ] `npm run build` completed without errors
- [ ] Dev server running without red errors

### Database Verification
- [ ] Ran query: `[paste actual curl command you ran]`
- [ ] Result: [X rows returned / empty / error]
- [ ] Data looks correct: [yes/no, brief description]

### Code Verification
- [ ] Confirmed code changes are in file: [line numbers]
- [ ] No syntax errors

### What User Should See
- Go to: [exact URL/section]
- Do: [exact action]
- Expected result: [what should appear]
- Data source: [confirmed X rows exist in database]

### Warnings/Issues Found
- [List any concerns, even minor ones]
```

---

## RED FLAGS - STOP AND FIX

Do NOT report task complete if ANY of these:

- `npm run build` shows errors
- Database query returns empty when it shouldn't
- Database query returns error
- You're "assuming" something works without running a command
- Field names in code don't match database columns
- You wrote code but didn't verify it saved to the file
- The feature depends on data that doesn't exist yet

---

## COMMON QA FAILURES TO AVOID

### 1. "I added classes to the database"
WRONG: Assuming insert worked
RIGHT: Run SELECT query, confirm rows exist, show me the count

### 2. "Search for shala to see results"
WRONG: Assuming search works because code looks right
RIGHT: Run the exact database query the search uses, confirm it returns data

### 3. "The save button now works"
WRONG: Assuming click handler is connected
RIGHT: Query saved_items table, show me the row that was created

### 4. "Fixed the display issue"
WRONG: Assuming CSS change took effect
RIGHT: Confirm the code is in the file, build succeeds, describe exactly what changed

---

## WHEN USER SENDS A SCREENSHOT SHOWING SOMETHING BROKEN

1. Do NOT apologize more than once
2. Do NOT explain what should have worked
3. DO immediately run diagnostic queries
4. DO identify the actual problem
5. DO fix it
6. DO run full QA protocol
7. DO show proof it's fixed (database query results)

---

## 🔴 MANDATORY BUG ANALYSIS PROTOCOL

### WHEN A BUG IS REPORTED

Every time a user reports a bug, you MUST:

1. **Fix the bug** - First priority
2. **Root cause analysis** - Why did QA miss it?
3. **Update CLAUDE.md** - Add the lesson learned HERE
4. **Update MASTER_QA_CHECKLIST.md** - Add the SAME lesson there (keep them in sync!)
5. **Create/update e2e test** - Automate the test if possible
6. **Report what was learned** - Document for future reference

### ⚠️ CRITICAL: KEEP DOCUMENTS IN SYNC

**Every lesson learned MUST be added to BOTH:**
- `CLAUDE.md` (this file)
- `e2e/MASTER_QA_CHECKLIST.md`

These documents must always contain the same QA rules and lessons. When you add a lesson to one, immediately add it to the other.

### ROOT CAUSE CATEGORIES

When analyzing why a bug slipped through, classify it:

| Category | Example | Prevention |
|----------|---------|------------|
| **Existence ≠ Function** | Button exists but onClick is missing | Test that clicking produces expected result |
| **Placeholder Code** | onClick={() => alert('TODO')} | Search for alert/console.log/TODO in code |
| **Missing State** | isAdmin hardcoded to false | Test with all user states (guest, auth, admin) |
| **Auth-Required** | Feature only works when logged in | Test authenticated flows |
| **Data-Dependent** | Works only if data exists | Test empty state AND populated state |
| **CSS Blocking** | Input exists but z-index blocks typing | Actually TYPE in inputs, don't just check visibility |
| **Wrong Context** | Modal inside view A, button inside view B | Verify component is rendered in the context where it's triggered |
| **Claimed Fixed Without Testing** | "I added the handler" but never clicked it | ALWAYS test in browser before claiming fixed |
| **Same Bug, Different Place** | Input blocking fixed in one modal but not others | When fixing a bug pattern, check ALL instances across the app |
| **Partial Testing** | Modal opens but didn't test if inputs work | Test the ENTIRE feature, not just one aspect |

### BUG REPORT TEMPLATE

After fixing any reported bug:

```
## BUG ANALYSIS

### What Was Broken
[Describe the bug]

### Root Cause
[Why did the code not work]

### Why QA Missed It
[Which test category was missing]

### Fix Applied
[What code changed]

### Test Added
[What test now catches this]

### Lesson Learned
[What to check in the future]
```

---

## 🧪 COMPREHENSIVE QA BEFORE ANY CODE PUSH

### PRE-PUSH CHECKLIST

Before pushing ANY code, verify:

#### 1. Build Passes
```bash
npm run build
```

#### 2. All Buttons Work
For every button added/modified:
- [ ] Button has onClick handler (not empty or alert)
- [ ] Clicking button produces visible result
- [ ] Result is the correct/intended action

#### 3. All Inputs Accept Text
For every input added/modified:
- [ ] Click into input
- [ ] Type text
- [ ] Verify text appears
- [ ] Verify onChange handler updates state

#### 4. All Modals Open AND Close
For every modal:
- [ ] Trigger opens the modal
- [ ] X button closes it
- [ ] Overlay click closes it (if applicable)
- [ ] ESC key closes it (if applicable)
- [ ] Modal content is populated (not empty)

#### 5. All User States Tested
For features with access control:
- [ ] Guest user sees appropriate state
- [ ] Authenticated user sees correct state
- [ ] Admin user (if applicable) sees correct state

#### 6. No Placeholder Code
Search for and remove:
```bash
grep -n "alert\|TODO\|FIXME\|console.log" src/App.jsx | head -20
```

### VISUAL QA FLOW

1. Take screenshot: `node screenshot.cjs`
2. View screenshot: Read the PNG file
3. Verify change is visible
4. Test interaction works
5. Only THEN report complete

---

## 📋 MASTER QA DOCUMENT

The comprehensive test checklist is at:
`e2e/MASTER_QA_CHECKLIST.md`

This document contains:
- 185+ individual test cases
- All user states to test
- Complete flow tests
- Button functionality tests
- Input functionality tests

**When a bug is found, update this document with the missing test case.**

---

## 🚫 NEVER MARK A TASK COMPLETE IF:

- Any button has no onClick handler
- Any input doesn't accept typing
- Any modal is empty when opened
- Any feature only works for one user state
- Code contains alert() or console.log() as "functionality"
- You haven't actually tested the feature
- You're assuming it works based on code review only

---

## ✅ MINIMUM TESTING FOR ANY CHANGE

| Change Type | Minimum Tests |
|-------------|---------------|
| New button | Click it, verify action happens |
| New input | Type in it, verify text appears AND is visible (readable color) |
| New modal | Open it, verify content visible, close it |
| New feature | Test guest + auth user flows |
| Bug fix | Reproduce original bug, verify fixed |
| Styling change | Take screenshot, visually verify |
| Form change | Type in ALL inputs, verify text visible, submit works |
| New function | Verify it's DEFINED with `grep "const funcName"` |
| Any change | **CHECK BROWSER CONSOLE** for runtime errors after testing |

### ALWAYS CHECK BROWSER CONSOLE

After ANY action in the app:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red errors
4. **ReferenceError: X is not defined** = function/variable doesn't exist
5. Fix before marking complete
