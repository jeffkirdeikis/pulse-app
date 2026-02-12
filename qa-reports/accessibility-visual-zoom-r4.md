# Pulse QA Report: Accessibility, Visual Consistency & Browser Zoom (R4)

**Date**: 2026-02-09 03:08:28
**URL**: http://localhost:5173/
**Tool**: Puppeteer (headless Chromium)

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 44 |
| PASS | 31 |
| FAIL | 4 |
| WARN | 9 |
| Pass Rate | 70.5% |

## Accessibility (A11Y)

**14 PASS / 3 FAIL / 9 WARN** out of 26 tests

| ID | Test | Status | Details |
|----|------|--------|---------|
| A11Y-001 | Keyboard Tab navigation moves focus through elements | `PASS` | Focus moved to 12 unique elements across 20 Tab presses. Tags: BUTTON, INPUT |
| A11Y-002 | ESC key closes modal | `PASS` | Modal detected and closed with ESC. Before: 4, After: 0 |
| A11Y-003 | All <img> elements have alt attribute | `PASS` | All 0 visible images have alt attributes across all tabs. |
| A11Y-004 | All <button> elements have text or aria-label | `PASS` | All 2262 visible buttons have accessible labels. |
| A11Y-005 | All <input> elements have label/aria-label/placeholder | **`FAIL`** | 2/6 inputs missing labels. Examples: [Deals] SELECT:select-one - <select class="filter-dropdown"><option value="All">💰 All Deals</option><option; [Services] SELECT:select-one - <select class="filter-dropdown"><option value="All">🔧 All Services</opt |
| A11Y-006 | Icon-only buttons have aria-label | `PASS` | All 1188 icon-only buttons have aria-label or title. |
| A11Y-007 | Modal elements have role="dialog" or aria-modal | **`FAIL`** | Found 1 modal-like overlays but none have role="dialog" or aria-modal. Examples: <div class="modal-overlay event-modal-overlay"><div class="event-detail-modal"><button class="close- |
| A11Y-008 | Color contrast meets 4.5:1 ratio (spot-check) | `PASS` | All 9 spot-checked elements meet contrast requirements. Ratios: 5.17:1, 5.17:1, 10.31:1, 6.37:1, 10.31:1, 5.17:1, 10.31:1, 10.31:1, 4.83:1 |
| A11Y-009 | Heading hierarchy is sequential (no skipped levels) | `PASS` | 942 headings in proper order. Levels: h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3, h3,  |
| A11Y-010 | HTML element has lang attribute | `PASS` | lang="en" |
| A11Y-011 | Skip navigation link present | `WARN` | No skip navigation link found. Recommended for keyboard users. |
| A11Y-012 | Focus indicators visible on keyboard navigation | `PASS` | Visible focus indicators found on 10/10 focused elements. |
| A11Y-013 | Touch targets >= 44px on mobile viewport | `WARN` | 1892/1895 (99.8%) elements below 44px. Examples: BUTTON("Consumer") 97x32px; BUTTON("Business") 89x32px; BUTTON("Sign In") 64x29px; BUTTON("Classes") 125x38px; BUTTON("Events") 125x38px |
| A11Y-014 | Navigation elements have proper ARIA roles | **`FAIL`** | No <nav> or [role="navigation"] or [role="tablist"] found. |
| A11Y-015 | Links have descriptive text | `PASS` | All 0 links have descriptive text. |
| A11Y-016 | Page has meaningful title | `PASS` | Title: "pulse-app" |
| A11Y-017 | List items are inside proper list containers | `PASS` | 0 lists found, no orphaned <li> elements. |
| A11Y-018 | Form inputs have autocomplete attributes | `WARN` | No email/tel/name inputs found to check. |
| A11Y-019 | No text below 12px font size | `WARN` | 10 elements with text below 12px: SPAN("Squamish") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pricing") 11.0 |
| A11Y-020 | Dynamic content has aria-live regions | `WARN` | No aria-live regions found. Recommended for tab switches, loading states, etc. |
| A11Y-021 | Tab order follows visual layout order | `WARN` | 3/15 elements appear out of visual order when tabbing. |
| A11Y-022 | Tables have proper structure | `PASS` | No tables found (app uses card layout). |
| A11Y-023 | Color is not the only means of conveying info | `PASS` | Tab indicators use multiple cues (weight, border, aria). 0 tabs checked. |
| A11Y-024 | Semantic HTML landmarks used | `WARN` | Only 1 landmarks found. Consider using <header>, <main>, <nav>, <footer>. Found: {"header":1,"main":0,"footer":0,"nav":0,"section":0,"article":0,"aside":0} |
| A11Y-025 | Supports prefers-reduced-motion | `WARN` | No prefers-reduced-motion media query found. Recommended for users who prefer reduced motion. |
| A11Y-026 | Error messages associated with form fields | `WARN` | No error message elements found. 1 inputs, 0 with aria-describedby. |

## Visual Consistency (VIS)

**9 PASS / 1 FAIL / 0 WARN** out of 10 tests

| ID | Test | Status | Details |
|----|------|--------|---------|
| VIS-001 | Font consistency across all tabs | `PASS` | Consistent fonts across tabs. Base fonts: -apple-system. Per tab: {"Classes":["-apple-system"],"Events":["-apple-system"],"Deals":["-apple-system"],"Services":["-apple-system"],"Wellness":["-apple-system"]} |
| VIS-002 | No horizontal overflow at 375px (mobile) | `PASS` | All tabs fit within 375px viewport. Widths: Classes=375px, Events=375px, Deals=375px, Services=375px, Wellness=375px |
| VIS-003 | No horizontal overflow at 1440px (desktop) | `PASS` | All tabs fit within 1440px viewport. Widths: Classes=1440px, Events=1440px, Deals=1440px, Services=1440px, Wellness=1440px |
| VIS-004 | Card heights consistent on Classes tab (within 20%) | **`FAIL`** | Heights vary by 25.2% (max 20%). Heights: 201, 120, 201, 120, 201, 120, 201, 120, 201, 120px, avg=161px |
| VIS-005 | Header does not overlap content | `PASS` | Header bottom: 88px, Content top: 88px, Gap: 0px |
| VIS-006 | Consistent container padding across tabs | `PASS` | Padding consistent. Values: {"Classes":{"paddingLeft":"20px","paddingRight":"20px","marginLeft":"0px","marginRight":"0px"},"Events":{"paddingLeft":"20px","paddingRight":"20px","marginLeft":"0px","marginRight":"0px"},"Deals":{"paddingLeft":"20px","pad |
| VIS-007 | No broken images across tabs | `PASS` | All visible images loaded successfully. |
| VIS-008 | Consistent button styling | `PASS` | 20 buttons checked. Border-radii: 8px, 10px, 12px. Fonts: -apple-system |
| VIS-009 | No text overflow on mobile viewport | `PASS` | All text elements fit within their containers at 375px. |
| VIS-010 | Consistent color theme across tabs | `PASS` | Background colors consistent: rgba(0, 0, 0, 0). Details: {"Classes":{"bodyBg":"rgba(0, 0, 0, 0)","headingColor":"rgb(17, 24, 39)"},"Events":{"bodyBg":"rgba(0, 0, 0, 0)","headingColor":"rgb(17, 24, 39)"},"Deals":{"bodyBg":"rgba(0, 0, 0, 0)","headingCo |

## Browser Zoom (ZOOM)

**8 PASS / 0 FAIL / 0 WARN** out of 8 tests

| ID | Test | Status | Details |
|----|------|--------|---------|
| ZOOM-001 | No horizontal overflow at 375px viewport | `PASS` | scrollWidth=375, innerWidth=375. Screenshot: zoom-375px.png |
| ZOOM-002 | No horizontal overflow at 768px viewport | `PASS` | scrollWidth=768, innerWidth=768. Screenshot: zoom-768px.png |
| ZOOM-003 | No horizontal overflow at 1920px viewport | `PASS` | scrollWidth=1920, innerWidth=1920. Screenshot: zoom-1920px.png |
| ZOOM-004 | App renders in landscape mobile (667x375) | `PASS` | Renders: true, No overflow: true. Screenshot: zoom-landscape-667x375.png |
| ZOOM-005 | No overflow with deviceScaleFactor 2 (Retina) | `PASS` | scrollWidth=1440, innerWidth=1440. Screenshot: zoom-2x-scale.png |
| ZOOM-006 | Layout intact at CSS zoom 0.5 (zoomed out) | `PASS` | Layout renders: true. Screenshot: zoom-50pct.png |
| ZOOM-007 | Layout usable at CSS zoom 2 (zoomed in) | `PASS` | Layout renders: true, No overflow: true. Some overflow expected at 2x zoom. Screenshot: zoom-200pct.png |
| ZOOM-008 | App renders at 320px viewport (smallest mobile) | `PASS` | Renders: true, No overflow: true. Screenshot: zoom-320px.png |

## Failures Detail

### A11Y-005: All <input> elements have label/aria-label/placeholder

**Status**: FAIL

**Details**: 2/6 inputs missing labels. Examples: [Deals] SELECT:select-one - <select class="filter-dropdown"><option value="All">💰 All Deals</option><option; [Services] SELECT:select-one - <select class="filter-dropdown"><option value="All">🔧 All Services</option><opt

---

### A11Y-007: Modal elements have role="dialog" or aria-modal

**Status**: FAIL

**Details**: Found 1 modal-like overlays but none have role="dialog" or aria-modal. Examples: <div class="modal-overlay event-modal-overlay"><div class="event-detail-modal"><button class="close-

---

### A11Y-014: Navigation elements have proper ARIA roles

**Status**: FAIL

**Details**: No <nav> or [role="navigation"] or [role="tablist"] found.

---

### VIS-004: Card heights consistent on Classes tab (within 20%)

**Status**: FAIL

**Details**: Heights vary by 25.2% (max 20%). Heights: 201, 120, 201, 120, 201, 120, 201, 120, 201, 120px, avg=161px

---

## Warnings (Recommended Improvements)

- **A11Y-011**: Skip navigation link present - No skip navigation link found. Recommended for keyboard users.
- **A11Y-013**: Touch targets >= 44px on mobile viewport - 1892/1895 (99.8%) elements below 44px. Examples: BUTTON("Consumer") 97x32px; BUTTON("Business") 89x32px; BUTTON("Sign In") 64x29px; BUTTON("Classes") 125x38px; BUTTON("Events") 125x38px
- **A11Y-018**: Form inputs have autocomplete attributes - No email/tel/name inputs found to check.
- **A11Y-019**: No text below 12px font size - 10 elements with text below 12px: SPAN("Squamish") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pricing") 11.0px; SPAN("See studio for pri
- **A11Y-020**: Dynamic content has aria-live regions - No aria-live regions found. Recommended for tab switches, loading states, etc.
- **A11Y-021**: Tab order follows visual layout order - 3/15 elements appear out of visual order when tabbing.
- **A11Y-024**: Semantic HTML landmarks used - Only 1 landmarks found. Consider using <header>, <main>, <nav>, <footer>. Found: {"header":1,"main":0,"footer":0,"nav":0,"section":0,"article":0,"aside":0}
- **A11Y-025**: Supports prefers-reduced-motion - No prefers-reduced-motion media query found. Recommended for users who prefer reduced motion.
- **A11Y-026**: Error messages associated with form fields - No error message elements found. 1 inputs, 0 with aria-describedby.

## Screenshots

Screenshots saved to `qa-reports/screenshots/`:

- zoom-375px.png - Mobile viewport
- zoom-768px.png - Tablet viewport
- zoom-1920px.png - Full HD viewport
- zoom-landscape-667x375.png - Landscape mobile
- zoom-2x-scale.png - Retina/2x scale
- zoom-50pct.png - CSS zoom 0.5
- zoom-200pct.png - CSS zoom 2.0
- zoom-320px.png - Smallest mobile (320px)

---

*Generated by qa-a11y-visual-zoom.cjs*
