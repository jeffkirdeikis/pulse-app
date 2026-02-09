# FINAL QA REPORT — Round 3 (Correctness-Focused)

**Date**: 2026-02-08
**Methodology**: Enhanced correctness testing (Phase 2G-CORRECTNESS) added after Round 2 failed to catch category filter bug
**Testing**: 6 parallel Puppeteer agents with visual screenshot verification + DB cross-checks

---

## Overall Summary

| Agent | Checks | Pass | Fail | Warn |
|-------|--------|------|------|------|
| Classes & Filters | 55 | 47 | 3 | 5 |
| Events & Deals | 139 | 130 | 1 | 8 |
| Services & Wellness | 155 | 155 | 0 | 0 |
| Auth, Nav & Mobile | 45 | 38 | 3 | 4 |
| Admin & Business View | 52 | 39 | 5 | 6 |
| Modals, Cards & Edge Cases | 126 | 117 | 1 | 8 |
| **TOTAL** | **572** | **526 (92%)** | **13** | **31** |

---

## Bugs by Severity

### CRITICAL (0)
None — app loads, no crashes, no data loss.

### MAJOR (7) — Must Fix

| # | Bug | Location | Report |
|---|-----|----------|--------|
| M1 | **Deals search does not search by venue/business name** | `filterDeals()` in App.jsx | events-deals-r3 |
| M2 | **Sticky header does not stick on scroll** — `position: sticky` broken by parent `overflow` | `app-header-premium` CSS | auth-nav-mobile-r3 |
| M3 | **Mobile toggle overlaps card content (375px)** — fixed-position toggle covers 2 cards | `view-switcher` CSS | auth-nav-mobile-r3 |
| M4 | **Admin scraping dashboard is 100% hardcoded** — fake stats ("47 minutes", "23 updates") displayed as real | Lines 15610-15690 in App.jsx | admin-business-r3 |
| M5 | **Business View audience insights 100% hardcoded** — fake demographics shown for all businesses | Lines 15224-15287 in App.jsx | admin-business-r3 |
| M6 | **Admin Quick Add venue dropdown limited to 50 businesses** (of 665) | `.slice(0, 50)` at line 15811 | admin-business-r3 |
| M7 | **"Clear Filters" button in empty state doesn't clear search input** | Classes tab empty state handler | classes-filters-r3 |

**Status**: M1 already fixed and committed (`4732978`).

### MINOR (6) — Should Fix

| # | Bug | Location | Report |
|---|-----|----------|--------|
| m1 | "See studio for pricing" tag truncated on mobile 375px | Class card price tag CSS | auth-nav-mobile-r3 |
| m2 | Deal schedule field empty for ALL 222 deals (shows blank in modal) | Deal modal + DB `deals.schedule` | modals-cards-edge-r3 |
| m3 | Deal Terms shows "N/A" instead of hiding section | Deal modal | events-deals-r3 |
| m4 | Admin Settings button is placeholder (toast only) | Line 15544 | admin-business-r3 |
| m5 | Admin Add Venue button is placeholder (toast only) | Line 15545 | admin-business-r3 |
| m6 | Admin reject submission uses hardcoded reason | Line 14505 | admin-business-r3 |

### WARNINGS (12) — Data/Design Issues

| # | Issue | Details |
|---|-------|---------|
| W1 | Events "Adults" age filter returns 0 | All DB events mapped as "All Ages" |
| W2 | Classes "Adults" filter returns 0 | No classes tagged "Adults" in DB |
| W3 | Classes "Free" price filter returns 0 | All classes are "See studio for pricing" |
| W4 | Filter panel sometimes needs retry click | Puppeteer intermittent |
| W5 | Time filter gap 12 PM → 4:30 PM | Dynamic — no classes in that range |
| W6 | Desktop app renders as narrow 420px column | Known mobile-first design |
| W7 | Tablet layout underutilizes 768px viewport | Known limitation |
| W8 | 2,336 of 2,395 events have null venue_id | DB data quality |
| W9 | Business selector has no onChange handler | Business view multi-business dropdown |
| W10 | Pulse Score always shows "--" with no explanation | Business view |
| W11 | Admin venue list default limit of 12 | No pagination |
| W12 | Admin delete says "cannot be undone" but is soft-delete | Misleading text |

---

## What Passed Well

- **Services tab**: 665 businesses, all 22 categories working, search works, modals perfect (155/155)
- **Wellness tab**: Discipline filters, date switching, booking sheet, provider view all working
- **Auth flows**: Google OAuth, email/password, sign up, form validation, modal close methods
- **Navigation**: 5 tabs, browser back/forward, URL hash routing, tab content distinct
- **Modal system**: Open/close (X, overlay, ESC), no duplicates on double-click, scroll preservation
- **Edge cases**: Empty states, impossible filter combos, filter reset, rapid clicking
- **Events tab**: All filters work correctly (day, time, age, category, price)
- **Deals tab**: 9 category filters working, 222 deals rendered, redeem flow triggers auth

---

## Comparison: Round 2 → Round 3

| Metric | Round 2 | Round 3 | Change |
|--------|---------|---------|--------|
| Total checks | 765+ | 572 | Focused on correctness |
| Pass rate | ~97% | 92% | More bugs found (by design) |
| Bugs found | 15 | 13 | Different methodology |
| Correctness bugs | 0 | 7 | **New this round** |
| Data quality issues | 0 | 12 | **New this round** |

The lower pass rate in R3 is expected — the enhanced correctness methodology catches bugs that existence-only testing misses.

---

## Recommended Fix Priority

### Immediate (before next deploy)
1. Fix sticky header (M2) — users lose navigation on scroll
2. Fix mobile toggle overlap (M3) — content unreadable on mobile
3. Fix "Clear Filters" not clearing search (M7) — user gets stuck

### Soon
4. Hide deal schedule section when empty (m2) — blank space looks broken
5. Hide deal terms when "N/A" (m3)
6. Fix price tag truncation on mobile (m1)
7. Remove or label hardcoded admin scraping data (M4)
8. Remove or label hardcoded audience insights (M5)
9. Remove `.slice(0, 50)` on Quick Add venue dropdown (M6)

### Later
10. Add custom admin rejection reason (m6)
11. Replace placeholder buttons or mark as "Coming Soon" (m4, m5)
12. Improve data quality (venue_id linkage, schedule field population)
