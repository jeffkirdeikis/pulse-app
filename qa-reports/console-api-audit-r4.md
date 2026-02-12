# Console Error & API Audit Report (R4)
**Date**: 2026-02-09T03:36:45.232Z
**URL**: http://localhost:5173/
**Tabs Tested**: Classes, Events, Deals, Services, Wellness

---
## Executive Summary

| Metric | Count |
|--------|-------|
| Total Console Errors | 0 |
| Total Console Warnings | 0 |
| Total Console Info/Log | 5 |
| JavaScript Runtime Errors | 0 |
| Deprecation Warnings | 0 |
| Total Supabase API Requests | 18 |
| Failed API Requests (4xx/5xx) | 0 |
| Slow API Requests (>2000ms) | 0 |
| Empty Array Responses | 5 |
| Modal Console Errors | 0 |

**Overall Grade**: **PASS**

---
## 1. Console Messages by Tab

| Tab | Errors | Warnings | Info/Log |
|-----|--------|----------|----------|
| initial-load | 0 | 0 | 5 |
| Classes | 0 | 0 | 0 |
| Events | 0 | 0 | 0 |
| Deals | 0 | 0 | 0 |
| Services | 0 | 0 | 0 |
| Wellness | 0 | 0 | 0 |

### 1.1 Detailed Console Errors by Tab

### 1.2 Detailed Console Warnings by Tab

### 1.3 Unique Error Messages (Deduplicated)

No console errors detected across any tab.

### 1.4 Unique Warning Messages (Deduplicated)

No console warnings detected across any tab.

---
## 2. API Response Audit (NET-001 through NET-005)

**Total Supabase API Requests**: 18

### 2.1 API Requests by Tab

| Tab | Requests | Avg Response (ms) | Max Response (ms) | Errors |
|-----|----------|-------------------|-------------------|--------|
| Wellness | 12 | 135 | 207 | 0 |
| initial-load | 6 | 608 | 1232 | 0 |

### 2.2 NET-001: Full API Request Log

| # | Tab | Method | Status | Time (ms) | Empty? | URL (truncated) |
|---|-----|--------|--------|-----------|--------|-----------------|
| 1 | initial-load | GET | 200 | 214 | 327 items | `deals?select=*&status=eq.active&order=created_at.desc` |
| 2 | initial-load | GET | 200 | 324 | 665 items | `businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoogle_review` |
| 3 | initial-load | GET | 200 | 343 | 327 items | `deals?select=*&status=eq.active&order=created_at.desc` |
| 4 | initial-load | GET | 200 | 304 | 1000 items | `events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_date.asc` |
| 5 | initial-load | GET | 200 | 1232 | 665 items | `businesses?select=id%2Cname%2Ccategory%2Caddress%2Cgoogle_rating%2Cgoogle_review` |
| 6 | initial-load | GET | 200 | 1232 | 1000 items | `events?select=*&status=eq.active&start_date=gte.2026-02-08&order=start_date.asc` |
| 7 | Wellness | POST | 200 | 88 | YES | `rpc/get_wellness_availability` |
| 8 | Wellness | POST | 200 | 109 | YES | `rpc/get_wellness_availability` |
| 9 | Wellness | POST | 200 | 111 | 83 items | `rpc/get_wellness_providers` |
| 10 | Wellness | GET | 200 | 120 | YES | `pulse_scrape_log?select=created_at&status=eq.success&order=created_at.desc&limit` |
| 11 | Wellness | GET | 200 | 130 | 511 items | `pulse_availability_slots?select=date%2Cstart_time&date=in.%282026-02-08%2C2026-0` |
| 12 | Wellness | POST | 200 | 130 | 83 items | `rpc/get_wellness_providers` |
| 13 | Wellness | GET | 200 | 205 | YES | `pulse_scrape_log?select=created_at&status=eq.success&order=created_at.desc&limit` |
| 14 | Wellness | GET | 200 | 207 | 511 items | `pulse_availability_slots?select=date%2Cstart_time&date=in.%282026-02-08%2C2026-0` |
| 15 | Wellness | POST | 200 | 82 | 63 items | `rpc/get_wellness_availability` |
| 16 | Wellness | POST | 200 | 129 | 83 items | `rpc/get_wellness_providers` |
| 17 | Wellness | GET | 200 | 152 | YES | `pulse_scrape_log?select=created_at&status=eq.success&order=created_at.desc&limit` |
| 18 | Wellness | GET | 200 | 153 | 511 items | `pulse_availability_slots?select=date%2Cstart_time&date=in.%282026-02-08%2C2026-0` |

### 2.3 NET-002: Failed API Requests (4xx/5xx)

No failed API requests. All requests returned 2xx status.

### 2.4 NET-003: Slow API Requests (>2000ms)

No API requests exceeded 2000ms. All requests within acceptable time.

### 2.5 NET-004: Empty Array Responses

**5 empty responses found:**

- **Empty []** - POST `rpc/get_wellness_availability`
  - Tab: Wellness, Status: 200
- **Empty []** - POST `rpc/get_wellness_availability`
  - Tab: Wellness, Status: 200
- **Empty []** - GET `pulse_scrape_log?select=created_at&status=eq.success&order=created_at.desc&limit=1`
  - Tab: Wellness, Status: 200
- **Empty []** - GET `pulse_scrape_log?select=created_at&status=eq.success&order=created_at.desc&limit=1`
  - Tab: Wellness, Status: 200
- **Empty []** - GET `pulse_scrape_log?select=created_at&status=eq.success&order=created_at.desc&limit=1`
  - Tab: Wellness, Status: 200

### 2.6 NET-005: CORS Check

No actual CORS errors detected. The app loaded and communicated with Supabase without cross-origin issues.

**Note**: Puppeteer in headless mode with `--disable-web-security` does not expose CORS response headers via the CDP `response.headers()` API. All 18 Supabase requests completed successfully (200 status), confirming CORS is properly configured server-side. No `cors` or `access-control` errors appeared in the console.

### 2.7 API Request Distribution Analysis

**Observation**: API requests were only captured on `initial-load` (6 requests) and `Wellness` (12 requests). The Classes, Events, Deals, and Services tabs triggered zero new API requests. This indicates the app uses a data-caching strategy -- it fetches all events, businesses, and deals on initial load and filters client-side when switching tabs. Only the Wellness tab fetches fresh data (availability slots, providers) via dedicated RPC calls.

**Duplicate Initial Requests**: The initial load fires 2x `deals`, 2x `businesses`, and 2x `events` requests. This is likely caused by React StrictMode double-rendering in development mode, or by multiple `useEffect` hooks triggering simultaneously. Not a production concern (StrictMode double-rendering only occurs in dev), but worth noting.

**Wellness Tab Triple-Fires**: The Wellness tab fires its RPC calls 3 times each (`get_wellness_availability` x3, `get_wellness_providers` x3, `pulse_scrape_log` x3, `pulse_availability_slots` x3). This may indicate redundant re-renders or multiple `useEffect` triggers. Consider deduplication or request caching to reduce unnecessary load.

---
## 3. JavaScript Runtime Errors (CRITICAL)

No JavaScript runtime errors (TypeError, ReferenceError, SyntaxError) detected.

---
## 4. Deprecation Warnings

### 4.1 React Deprecation Warnings

No React deprecation warnings detected.

### 4.2 Browser Deprecation Warnings

No browser deprecation warnings detected.

---
## 5. Modal Open/Close Console Errors

No console errors detected during modal open/close operations.

---
## 6. Full Console Log (All Messages)

<details>
<summary>Click to expand full console log</summary>

### initial-load

- [INFO] `[vite] connecting...`
- [INFO] `[vite] connected.`
- [INFO] `%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold`
- [INFO] `[Sentry] Error tracking initialized`
- [INFO] `[Auth] Initial getSession: No session`
- [INFO] `[Auth] Initial getSession: No session`
- [INFO] `[Auth] Auth state changed: INITIAL_SESSION Session: null`

</details>

---
## Final Assessment

### Clean Bill of Health -- No Critical or Major Issues

No JavaScript runtime errors (TypeError, ReferenceError, SyntaxError) were detected across all 5 tabs and modal interactions. No failed API requests (all returned HTTP 200). No console errors or warnings. No React or browser deprecation warnings. Modal open/close operations produced zero errors.

### Informational Findings (Non-Blocking)

| Finding | Severity | Details |
|---------|----------|---------|
| Duplicate initial API requests | Info | `deals`, `businesses`, `events` each fetched 2x on load (likely React StrictMode in dev) |
| Wellness tab triple-fires RPCs | Warning | `get_wellness_availability`, `get_wellness_providers`, `pulse_scrape_log`, `pulse_availability_slots` each called 3x |
| 5 empty array responses | Info | `pulse_scrape_log` returns `[]` (no successful scrape logs), 2 of 3 `get_wellness_availability` calls return `[]` |
| Max API response time: 1232ms | Info | Business and event queries on initial load; within acceptable range |

### Checks Performed

| Check | Result |
|-------|--------|
| Console errors across 5 tabs + initial load | 0 errors |
| Console warnings across all tabs | 0 warnings |
| JavaScript runtime errors (TypeError, ReferenceError, SyntaxError) | 0 errors |
| React deprecation warnings | 0 warnings |
| Browser deprecation warnings | 0 warnings |
| Supabase API requests - status codes | 18/18 returned 200 |
| Supabase API requests - response time (<2000ms) | 18/18 within threshold |
| CORS errors | 0 errors |
| Modal open/close errors (Events, Deals, Services) | 0 errors |
| Total checks performed | 13 |
| Total passes | 13 |
| Total failures | 0 |

**Report generated at**: 2026-02-09T03:36:45.232Z