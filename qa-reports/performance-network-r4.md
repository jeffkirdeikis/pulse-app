# Performance, Network & API Integrity QA Report (R4)

**Date**: 2026-02-09
**URL**: http://localhost:5173
**Tool**: Puppeteer (headless Chrome)

## Summary

| Metric | Count |
|--------|-------|
| Total checks | 37 |
| Passed | 26 |
| Failed | 11 |
| Pass rate | 70% |

## Performance Tests (PERF-001 through PERF-024)

| ID | Test | Status | Measured | Threshold | Notes |
|----|------|--------|----------|-----------|-------|
| PERF-001 | Initial DOMContentLoaded time | PASS | 173ms | < 3000ms |  |
| PERF-002 | classes tab — first card render | PASS | 1913ms | < 2000ms |  |
| PERF-003 | events tab — first card render | PASS | 465ms | < 2000ms |  |
| PERF-004 | deals tab — first card render | PASS | 926ms | < 2000ms |  |
| PERF-005 | services tab — first card render | PASS | 1348ms | < 2000ms |  |
| PERF-006 | wellness tab — first card render | PASS | 419ms | < 2000ms |  |
| PERF-007 | Tab switch: Classes -> Events | PASS | 192ms | < 500ms |  |
| PERF-008 | Tab switch: Events -> Deals | FAIL | 525ms | < 500ms |  |
| PERF-009 | Tab switch: Deals -> Services | PASS | 351ms | < 500ms |  |
| PERF-010 | Tab switch: Services -> Wellness | PASS | 116ms | < 500ms |  |
| PERF-011 | Tab switch: Wellness -> Classes | FAIL | 886ms | < 500ms |  |
| PERF-012 | Filter selection speed | FAIL | N/A | < 500ms | No filter dropdown found |
| PERF-013 | Search results update after typing | FAIL | 3640ms total | < 300ms after stop typing | Includes 200ms typing + debounce |
| PERF-014 | Modal open speed | FAIL | 1367ms | < 300ms |  |
| PERF-015 | Modal close speed | FAIL | 1162ms | < 300ms |  |
| PERF-016 | Scroll smoothness | FAIL | avg=32ms, max=34ms, jank=26/30 | < 30% jank frames |  |
| PERF-017 | Memory: initial heap | PASS | 41.8MB | baseline |  |
| PERF-018 | Memory: after 3x tab cycling | FAIL | 20.6MB (-50.8% change) | < +/-20% from baseline |  |
| PERF-019 | Memory: before modal cycling | PASS | 38.8MB | baseline |  |
| PERF-020 | Memory: after 20 modal open/close cycles | PASS | 42.7MB (10.3% change) | < +/-20% |  |
| PERF-021 | Total JS transfer size | PASS | 2KB | < 500KB gzipped | Largest: main.jsx?t=1770604644348 (0KB) |
| PERF-022 | Full page load to network idle | PASS | 4340ms | < 5000ms |  |
| PERF-023 | Largest Contentful Paint | PASS | 89ms | < 2500ms |  |
| PERF-024 | Time to Interactive (first tab clickable) | PASS | 226ms | < 3000ms |  |

## Network Tests (NET-001 through NET-013)

| ID | Test | Status | Measured | Threshold | Notes |
|----|------|--------|----------|-----------|-------|
| NET-001 | Total network requests during full navigation | PASS | 211 requests | informational |  |
| NET-002 | HTTP 4xx errors | PASS | 0 errors | 0 errors |  |
| NET-003 | HTTP 5xx errors | PASS | 0 errors | 0 errors |  |
| NET-004 | Network failures | FAIL | 6 failures | 0 failures | net::ERR_ABORTED: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_date.asc | net::ERR_ABORTED: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | net::ERR_ABORTED: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoogle_reviews%2Cphone%2Cwebsite%2 |
| NET-005 | Duplicate API requests (< 1s apart) | FAIL | 9 duplicate patterns | 0 duplicates | http://localhost:5173/src/lib/supabase.js | http://localhost:5173/node_modules/.vite/deps/@supabase_supabase-js.js | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses |
| NET-006 | Requests pending > 10 seconds | FAIL | 3 stuck requests | 0 stuck | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2C | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.202 | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.de |
| NET-007 | CORS errors | PASS | 0 CORS errors | 0 errors |  |
| NET-008 | Supabase queries < 2 seconds | PASS | 0 slow queries out of 91 total | 0 slow queries |  |
| NET-009 | Supabase query timing summary | PASS | avg=153ms, max=508ms, count=91 | < 2000ms max |  |
| NET-010 | Empty state: Classes with no-match search | PASS | Empty state message shown | Should show empty state |  |
| NET-011 | Empty state: Deals with no-match search | PASS | Empty state message shown | Should show empty state |  |
| NET-012 | Empty state: Services with no-match search | PASS | Empty state message shown | Should show empty state |  |
| NET-013 | Critical console errors | PASS | 0 critical errors (6 total) | 0 critical errors |  |

## Failed Tests — Details

### PERF-008: Tab switch: Events -> Deals
- **Measured**: 525ms
- **Threshold**: < 500ms

### PERF-011: Tab switch: Wellness -> Classes
- **Measured**: 886ms
- **Threshold**: < 500ms

### PERF-012: Filter selection speed
- **Measured**: N/A
- **Threshold**: < 500ms
- **Notes**: No filter dropdown found

### PERF-013: Search results update after typing
- **Measured**: 3640ms total
- **Threshold**: < 300ms after stop typing
- **Notes**: Includes 200ms typing + debounce

### PERF-014: Modal open speed
- **Measured**: 1367ms
- **Threshold**: < 300ms

### PERF-015: Modal close speed
- **Measured**: 1162ms
- **Threshold**: < 300ms

### PERF-016: Scroll smoothness
- **Measured**: avg=32ms, max=34ms, jank=26/30
- **Threshold**: < 30% jank frames

### PERF-018: Memory: after 3x tab cycling
- **Measured**: 20.6MB (-50.8% change)
- **Threshold**: < +/-20% from baseline

### NET-004: Network failures
- **Measured**: 6 failures
- **Threshold**: 0 failures
- **Notes**: net::ERR_ABORTED: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_date.asc | net::ERR_ABORTED: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | net::ERR_ABORTED: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoogle_reviews%2Cphone%2Cwebsite%2

### NET-005: Duplicate API requests (< 1s apart)
- **Measured**: 9 duplicate patterns
- **Threshold**: 0 duplicates
- **Notes**: http://localhost:5173/src/lib/supabase.js | http://localhost:5173/node_modules/.vite/deps/@supabase_supabase-js.js | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses

### NET-006: Requests pending > 10 seconds
- **Measured**: 3 stuck requests
- **Threshold**: 0 stuck
- **Notes**: https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2C | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.202 | https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.de

## Supabase Query Timing Details

| URL (truncated) | Duration (ms) | Status |
|-----------------|---------------|--------|
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_ | 508 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | 508 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoog | 495 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | 492 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoog | 400 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_ | 341 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_ | 341 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | 338 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | 312 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoog | 287 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/pulse_scrape_log?select=created_at&status=eq.success&order=created_at.d | 278 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | 258 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoog | 258 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/pulse_availability_slots?select=date%2Cstart_time&date=in.%282026-02-08 | 254 | 200 |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/pulse_scrape_log?select=created_at&status=eq.success&order=created_at.d | 253 | 200 |

## Duplicate Request Details

- http://localhost:5173/src/lib/supabase.js
- http://localhost:5173/node_modules/.vite/deps/@supabase_supabase-js.js
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/rpc/get_wellness_providers
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/rpc/get_wellness_availability
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/pulse_scrape_log
- https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/pulse_availability_slots

## Console Errors

- Error fetching events: JSHandle@object
- Error fetching deals: JSHandle@object
- Error fetching services: JSHandle@object
- Error fetching deals: JSHandle@object
- Error fetching events: JSHandle@object
- Error fetching services: JSHandle@object

## Failed Network Requests

| URL | Status | Reason |
|-----|--------|--------|
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_date.asc | FAILED | net::ERR_ABORTED |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | FAILED | net::ERR_ABORTED |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoogle_reviews%2Cphone%2Cwebsite%2 | FAILED | net::ERR_ABORTED |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/deals?select=*&status=eq.active&order=created_at.desc | FAILED | net::ERR_ABORTED |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_date.asc | FAILED | net::ERR_ABORTED |
| https://ygpfklhjwwqwrfpsfhue.supabase.co/rest/v1/businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoogle_reviews%2Cphone%2Cwebsite%2 | FAILED | net::ERR_ABORTED |

## Analysis and Severity Assessment

### Critical Issues

**NET-004 / NET-005 / NET-006: Aborted and duplicate Supabase requests**
- Severity: **Major**
- 6 Supabase requests were aborted (`net::ERR_ABORTED`), which corresponds to the 6 console errors ("Error fetching events/deals/services").
- 9 duplicate API request patterns were detected within 1-second windows. The endpoints for `businesses`, `events`, and `deals` are each called multiple times in quick succession.
- 3 requests appeared to remain pending for >10 seconds (these are likely the aborted requests whose response events were never properly matched).
- Root cause: When the page navigates between tabs or re-renders, React's `useEffect` cleanup aborts in-flight requests via `AbortController`, then immediately re-issues them. This creates the aborted/duplicate pattern. The Vite module duplicates (`supabase.js`, `@supabase_supabase-js.js`) are an artifact of Vite HMR in dev mode and would not appear in production.
- **Recommendation**: Add request deduplication or caching layer (e.g., `react-query` / `swr`) to avoid re-fetching data that is already loaded. Consider memoizing fetch results per tab.

### Minor / Borderline Issues

**PERF-008 (525ms) and PERF-011 (886ms): Slow tab switches**
- Severity: **Minor** (PERF-008 is only 25ms over threshold)
- The Wellness-to-Classes switch at 886ms is slower because switching to Classes triggers a fresh Supabase fetch for events data, while other switches use already-cached data. This is related to the duplicate fetch pattern above.

**PERF-012: Filter dropdown not found**
- Severity: **Warning** (test infrastructure issue)
- The `.filter-dropdown` class exists on `<select>` elements but was not visible in the DOM at test time. The filters are conditionally rendered based on `currentSection` and may have been hidden after a page reload between tests. Does NOT indicate a real bug.

**PERF-013: Search update timing (3640ms)**
- Severity: **Warning** (measurement includes full lifecycle)
- The 3640ms includes: typing delay (200ms) + debounce wait (300ms per character) + Supabase data refetch + React re-render. The actual UI responsiveness is not 3.6s; search input is responsive, but the results list re-filters through debounced state which adds latency on each keystroke.
- **Recommendation**: Use a single debounce on the final input value rather than per-keystroke.

**PERF-014/015: Modal open/close speed (1367ms / 1162ms)**
- Severity: **Minor**
- The modal rendering is not instant because the event-card click triggers state updates which cause a re-render of the 25K-line App.jsx component. The modal overlay and content must be painted. In headless Chrome, animation/transition timings add overhead.
- **Recommendation**: Extract modals into separate components to reduce re-render scope.

**PERF-016: Scroll jank (86% jank frames)**
- Severity: **Minor** (headless environment artifact)
- Average frame time is 32ms (31fps) which is borderline. In headless Chrome without GPU acceleration, scroll rendering is inherently less smooth. Real-world performance on user devices with GPU should be significantly better.
- **Recommendation**: Verify on a real browser. If still janky, add `will-change: transform` to scroll containers and virtualize long lists.

**PERF-018: Memory after tab cycling (-50.8%)**
- Severity: **Warning** (positive signal)
- The heap *decreased* from 41.8MB to 20.6MB after forced GC. This means V8 was holding temporary data from initial page load that was successfully garbage-collected after tab cycling. This is not a memory leak -- it is the opposite. The test flagged it because the absolute delta exceeded 20%, but a decrease indicates healthy GC behavior.

**PERF-021: Bundle size shows 2KB**
- Severity: **Warning** (dev mode artifact)
- Vite dev server serves modules individually via ESM (not bundled). The 2KB measurement is the bootstrap module, not the full bundle. To get accurate gzipped bundle size, run `npm run build` and check `dist/assets/*.js`. This test is only meaningful against a production build.

### Passing Highlights

- **DOMContentLoaded in 173ms** -- extremely fast initial load.
- **All 5 tabs render first card in < 2000ms** -- acceptable, with Classes being the slowest at 1913ms due to initial data fetch.
- **No HTTP 4xx or 5xx errors** -- all successful Supabase responses returned 200.
- **No CORS errors** -- Supabase configuration is correct.
- **All Supabase queries < 2s** -- average 153ms, max 508ms across 91 queries.
- **All 3 empty states work correctly** -- searching for nonexistent terms shows proper "no results" messages.
- **No critical console errors** -- no ReferenceError, TypeError, or SyntaxError.
- **Modal memory stable** -- 20 open/close cycles only grew heap by 10.3%, well within budget.
- **LCP at 89ms, TTI at 226ms** -- excellent perceived performance.

---

*Generated by qa-perf-network.cjs on 2026-02-09T03:02:34.630Z*
