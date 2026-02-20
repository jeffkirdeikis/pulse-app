# CLAUDE.md — Pulse App

> Shared rules (commit, visual QA, input testing, never break behavior) are in `~/.claude/CLAUDE.md`
> Scraper architecture details are in `CLAUDE-SCRAPER.md`
> Detailed bug histories are in `CLAUDE-ARCHIVE.md`

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

## SCRAPE EVERY BUSINESS — ZERO EXCEPTIONS

The entire Squamish business directory (~500 businesses) MUST be scraped on EVERY run. No business is skipped, deprioritized, or marked "can't scrape." Systems exist for ALL booking platforms, custom sites, and AI-verified extraction.

For every business, scrape: classes & schedules, events, deals & promotions.

If a site fails: log it with diagnostics, keep it in the queue, find a solution, escalate if needed. Never silently pass.

After every scrape run, verify: all ~500 attempted, no silent skips, data found where expected, failures logged.

> Full scraper architecture, data quality SQL, and lessons: `CLAUDE-SCRAPER.md`

---

## REAL DATA ONLY — ZERO TOLERANCE FOR FAKE DATA

**Every piece of data must come from a real, scrapeable source.** No exceptions.

| Allowed | Trust |
|---------|-------|
| Booking system scrapers (Mindbody, WellnessLiving, JaneApp) | High |
| Verified AI extraction (`verified-extractor.js` with 5-layer anti-hallucination) | Medium |
| Any scraper that parses structured data | High |
| User/business owner submissions | Medium |
| Supabase `businesses` table | High |

| Banned | Why |
|--------|-----|
| Unverified AI extraction (HTML to LLM without source verification) | LLM hallucinates fake events |
| `scrape-with-ai.js` | DISABLED — no verification |
| Hardcoded sample events/classes | Could be mistaken for real data |

---

## QA PROTOCOL

**Full protocol**: `PULSE_QA_PROTOCOL.md` — Read in entirety before any QA task.
**Test matrix**: `e2e/MASTER_QA_CHECKLIST.md` — 310+ individual verifications.

When asked to perform QA:
1. **READ** the protocol first. Do not skim.
2. **START THE APP** and interact with live UI. Reading source code is NOT QA.
3. Complete **EVERY** check. No exceptions.
4. Provide **EVIDENCE** for every check. "Works fine" is not evidence.
5. If your QA found **zero issues**, you didn't look hard enough.
6. Write findings to `qa-reports/` INCREMENTALLY.

### Pulse-Specific QA Tooling

```bash
# Full automated QA (if dev server running on :5173)
node qa.cjs
# → Build, crash check, error boundary check, console errors, screenshot
# → Then: Read /tmp/qa-screenshot.png (ACTUALLY VIEW IT)

# Manual (if dev server not running)
npm run build && node screenshot.cjs
# → Then: Read /tmp/classes-list.png (ACTUALLY VIEW IT)
```

`node qa.cjs` catches what `npm run build` CANNOT: runtime ReferenceError/TypeError, error boundary rendering, blank screens, critical console errors. **Do NOT report a change as complete without running QA.**

### Lucide Icon Fix Pattern

**Wrong**: `<Bell size={22} color="#374151" />` (color prop unreliable in buttons)
**Right**: Wrap in div with `color` set — Lucide uses `stroke: currentColor`:
```jsx
<div style={{ color: '#374151', display: 'flex', alignItems: 'center' }}>
  <Bell size={22} strokeWidth={2} />
</div>
```

---

## BUG PATTERNS

| Category | Example | Prevention |
|----------|---------|------------|
| Fix Breaks Primary | Changed filter from `now` to `todayMidnight` — showed stale events | NEVER weaken a filter. Add specificity. |
| AI Hallucination | 1,471 fake events invented by LLM | Use `verified-extractor.js` with 5-layer pipeline |
| Dedup Missing Fields | Checked title+date but NOT time — dropped 50%+ classes | Dedup ALL unique fields (title+date+time+venue) |
| UTC vs Local Timezone | `CURRENT_DATE` is UTC; at 9 PM Pacific it's tomorrow | Use `(now() AT TIME ZONE 'America/Vancouver')` |
| Existence != Correctness | Category filter UI worked but checked wrong field (`tags` vs `category`) | Spot-check 3 results match after every filter |
| CTA Wrong Action | "Book Class" used `<a href=Google>` instead of `handleBookClick()` | Same action = same handler everywhere |
| Scraper Date Duplication | Navigation failed, same schedule stamped on 30 days | Dates from page text, never from loop counters |
| Booking != Public Schedule | Detected WellnessLiving but no public classes | Verify booking system has public data first |

---

## RED FLAGS — STOP AND FIX

Never mark complete if:
- `node qa.cjs` exits non-zero
- Database query returns empty/error
- Modal opens empty
- Console has red errors
- **Any date/time comparison uses `CURRENT_DATE`/`CURRENT_TIME`/`toISOString()` without timezone awareness**
- **Scraper data inserted without verifying against live API source**
- **Your fix weakens a filter, guard, or validation**

---

## USEFUL COMMANDS

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

## RELATED DOCUMENTS

- `CLAUDE-SCRAPER.md` - Scraper architecture, data quality SQL, venue sources, lessons
- `PULSE_QA_PROTOCOL.md` - Full QA protocol (phases, checklists, report format)
- `e2e/MASTER_QA_CHECKLIST.md` - 310+ test cases
- `CLAUDE-ARCHIVE.md` - Detailed bug histories and lessons learned
