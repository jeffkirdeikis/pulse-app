# CLAUDE.md - Project Instructions for Claude Code

> Detailed bug histories and lessons are in `CLAUDE-ARCHIVE.md`

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

## 🖼️ MANDATORY VISUAL QA

**"npm run build" passing does NOT mean the feature works visually.**

### Screenshot Protocol

```bash
node screenshot.cjs          # Take screenshot
# Then use Read tool on /tmp/app-modal.png to view
```

### When to Screenshot

- Any UI/styling change
- Before telling user "it's fixed"
- When user reports something broken

### CSS Fix That Actually Works (Lucide Icons)

```jsx
// Don't fight CSS specificity - use inline props:
<Bell size={22} color="#374151" strokeWidth={2} />
```

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

---

## 📊 SCRAPER DATA QUALITY

### Validation After Any Scraper Run

```sql
-- Suspicious clustering (placeholder detection)
SELECT start_time, COUNT(*) FROM events
WHERE tags @> '["auto-scraped"]'
GROUP BY start_time ORDER BY COUNT(*) DESC LIMIT 5;

-- Business listings as events (bad data)
SELECT * FROM events WHERE title = venue_name;

-- Orphaned events
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;
```

### Scraper Rules

| DO | DON'T |
|----|-------|
| Return `null` when parsing fails | Return fallback like `'09:00'` |
| Skip records with missing fields | Insert with fake values |
| Log warnings for debugging | Silently use defaults |

### Bad Data Indicators

- Many events at 9:00 AM with `auto-scraped` tag
- Events where title = venue_name
- Holiday events on wrong dates

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

- `e2e/MASTER_QA_CHECKLIST.md` - 185+ test cases (keep in sync with this file)
- `CLAUDE-ARCHIVE.md` - Detailed bug histories and lessons learned
