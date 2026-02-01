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
