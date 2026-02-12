# QA Report: Image Alt Text, Icon Accessibility, Empty States, Data Display

| Field | Value |
|-------|-------|
| Date | 2026-02-09 |
| URL | http://localhost:5173/ |
| Tester | Automated Puppeteer Script |
| Script | qa-images-empty-states.cjs |

---

## 1. Image Alt Text Audit (A11Y-020)

| Tab | `<img>` Count | With Alt | Empty Alt (Decorative) | Missing Alt | Broken | CSS bg-images |
|-----|--------------|----------|----------------------|-------------|--------|---------------|
| Classes | 0 | 0 | 0 | 0 | 0 | 0 |
| Events | 0 | 0 | 0 | 0 | 0 | 0 |
| Deals | 0 | 0 | 0 | 0 | 0 | 0 |
| Services | 0 | 0 | 0 | 0 | 0 | 0 |
| Wellness | 0 | 0 | 0 | 0 | 0 | 0 |

**Totals**: 0 `<img>` elements, 0 missing alt, 0 broken, 0 CSS background images

> **Finding**: This app uses **zero `<img>` elements** across all tabs. All icons are inline SVGs (Lucide React) and all visual card content is text-based. There are no product photos or hero images. This means the traditional `<img alt="">` audit finds no violations because there are no `<img>` tags to evaluate.
>
> Icon accessibility is covered in Section 2 (SVG audit). CSS background images (if any) cannot have alt text and should be decorative only.

---

## 2. Icon Accessibility (SVG Audit)

Checks: SVGs should have `aria-hidden="true"` (decorative icons) or `aria-label` (meaningful icons). SVGs inside `<button>` elements should be `aria-hidden` since the button provides the accessible label.

| Tab | Total SVGs | aria-hidden="true" | aria-label/title | Neither | In buttons w/o aria-hidden |
|-----|-----------|-------------------|-----------------|---------|---------------------------|
| Classes | 4720 | 4719 | 0 | 1 | 0 |
| Events | 130 | 129 | 0 | 1 | 0 |
| Deals | 681 | 680 | 0 | 1 | 0 |
| Services | 2557 | 2556 | 0 | 1 | 0 |
| Wellness | 126 | 125 | 0 | 1 | 0 |

**Coverage**: 8209/8214 SVGs have `aria-hidden="true"` (99.9%)

> **Note**: The single SVG without `aria-hidden` on each tab is the **Pulse app logo** (in `div.pulse-logo-premium`). This is the same element appearing on every tab. As the app logo, it could benefit from an `aria-label="Pulse Squamish logo"` or `role="img"` with a title, but this is a minor/advisory issue since the logo text "PULSE SQUAMISH" is displayed as adjacent HTML text.

### SVG Issues (deduplicated sample)

- SVG in DIV.pulse-logo-premium missing aria attrs

---

## 3. Empty State Tests (EMP-001 through EMP-004)

Searched for nonsense term `zzzxxxyyy` to guarantee zero matches. Expected: a user-friendly message indicating no results, not a blank screen.

| Status | Test ID | Tab | Detail |
|--------|---------|-----|--------|
| PASS | EMP-001 | Classes | Shows friendly "no classes" message |
| PASS | EMP-002 | Events | Shows friendly "no events" message |
| PASS | EMP-003 | Deals | Shows "0 results" count only (no descriptive empty state) |
| PASS | EMP-004 | Services | Shows friendly "no results" message |

> **Advisory**: Deals tab(s) show only a count like "0 results" without a descriptive message like "No deals found. Try a different search term." Consider adding a user-friendly empty state.

---

## 4. Data Display Correctness Spot-Check

Verified first 3 visible card titles on each tab contain real data (not "undefined", "null", "[object Object]", "NaN", "Lorem ipsum", "TODO", "FIXME", or "test123").

### Classes (PASS)

- Total cards visible: **3**
- Sample titles:
  1. "Kickboxing - Adults & Teens"
  2. "Traditional Hot Yoga"
  3. "Candlelight Radiant Yin"

### Events (PASS)

- Total cards visible: **3**
- Sample titles:
  1. "StrongStart BC Program"
  2. "How to Craft Canadian Style Resume and Cover Letter"
  3. "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games"

### Deals (PASS)

- Total cards visible: **3**
- Sample titles:
  1. "Buy One Get One Free"
  2. "Buy one get one 50% OFF"
  3. "4-Class Drop-In Pass"

### Services (PASS)

- Total cards visible: **2**
- Sample titles:
  1. "Canadian Coastal Adventures"
  2. "Howe Sound Boat Charters"

---

## Summary

### All Checks

| Status | Check | Detail |
|--------|-------|--------|
| PASS | A11Y-020: Image alt text audit | N/A -- App uses 0 <img> elements. All visuals are SVGs or text. |
| PASS | ICON-A11Y: SVG aria coverage | 99.9% coverage. Only exception: app logo SVG (1 instance, decorative -- advisory) |
| PASS | ICON-A11Y: Button SVGs have aria-hidden | All button icons properly marked aria-hidden |
| PASS | EMP-001 Classes empty state | Shows friendly "no classes" message |
| PASS | EMP-002 Events empty state | Shows friendly "no events" message |
| PASS | EMP-003 Deals empty state | Shows "0 results" count only (no descriptive empty state) |
| PASS | EMP-004 Services empty state | Shows friendly "no results" message |
| PASS | DATA-Classes: titles are real data | 3 clean titles from 3 cards |
| PASS | DATA-Events: titles are real data | 3 clean titles from 3 cards |
| PASS | DATA-Deals: titles are real data | 3 clean titles from 3 cards |
| PASS | DATA-Services: titles are real data | 2 clean titles from 2 cards |

### Totals

| Metric | Count |
|--------|-------|
| Total checks | 11 |
| Passed | 11 |
| Failed | 0 |

**Overall: ALL CHECKS PASSED.**