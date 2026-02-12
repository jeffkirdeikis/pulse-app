# QA Report: Performance + Build
Date: 2026-02-10
Scope: Section 14 (Performance), Build Verification, Runtime Error Checks
Tester: Automated Puppeteer + in-browser performance.now()

## Summary
Total Checks: 13
Passed: 10
Failed: 3
Skipped: 0

## Build Results
- npm run build: PASS (built in 1.74s, 2065 modules transformed)
- node qa.cjs: PASS (no error boundary, no console errors, PULSE header present, screenshot verified)

## Performance Results
| ID | Check | Measured | Threshold | Status | Notes |
|----|-------|----------|-----------|--------|-------|
| PERF-001 | Initial page load (DOMContentLoaded + tabs visible) | 353ms | <3000ms | PASS |  |
| PERF-002 | Classes tab render time | 605ms | <2000ms | PASS |  |
| PERF-003 | Events tab render time | 57ms | <2000ms | PASS |  |
| PERF-004 | Deals tab render time | 79ms | <2000ms | PASS |  |
| PERF-005 | Services tab render time | 323ms | <2000ms | PASS |  |
| PERF-006 | Wellness tab render time | 43ms | <2000ms | PASS |  |
| PERF-010 | Tab switching (Classes->Events, avg of 3) | 58ms avg [63, 70, 40] | <500ms | PASS |  |
| PERF-011 | Filter selection (date dropdown) | 512ms | <500ms | FAIL |  |
| PERF-012 | Search typing response (set value + render) | 170ms | <300ms | PASS |  |
| PERF-013 | Modal/detail panel open time | 611ms | <300ms | FAIL | Animation/transition may account for some time |
| PERF-014 | Modal/detail panel close time (ESC) | 620ms | <200ms | FAIL | Close animation may add to time |
| PERF-015 | Scroll through cards (10 scrolls, 6000px total) | Smooth, 0 errors | No errors | PASS |  |
| PERF-023 | Main JS bundle (gzipped) | 233KB gzip (879KB raw) | <500KB gzip | PASS | CSS: 29KB gzip (174KB raw). Total dist: 1053KB raw. |

## Console Errors Found
Total unique console errors during full navigation (all 5 tabs + 3 modal opens): 0

No console errors found. The app runs cleanly across all tabs.

## Console Warnings
Total unique warnings: 0
None

## Bundle Size
- Main JS: 879KB raw / 233KB gzipped
- Main CSS: 174KB raw / 29KB gzipped
- Total dist assets: 1053KB raw
- Vite chunk size warning: JS bundle exceeds 500KB raw (consider code splitting with dynamic imports)
- Gzipped JS (233KB) is well under the 500KB gzip threshold

## Issues Found

### Critical
None

### Major
- **PERF-013**: Modal/detail panel open time -- measured 611ms, threshold <300ms. The modal uses a slide-up animation which accounts for most of the measured time. This is an intentional UX transition, not a performance bug. Consider whether the animation duration could be shortened while still feeling smooth.
- **PERF-014**: Modal/detail panel close time (ESC) -- measured 620ms, threshold <200ms. Same root cause as PERF-013; the close animation takes ~500-600ms. Reducing animation duration to 200-300ms would bring this within threshold.

### Minor
- **PERF-011**: Filter selection (date dropdown) -- measured 512ms, threshold <500ms. Only 12ms over threshold; filtering 960 classes involves re-rendering a large list. This is borderline and likely imperceptible to users.
- JS bundle is 879KB raw (233KB gzipped). While passing the 500KB gzip threshold, Vite warns about chunks over 500KB raw. Consider lazy-loading tab views with React.lazy() and dynamic imports.

### Warnings
None

## Methodology Notes
- Page load times (PERF-001) measured via Puppeteer (external: includes network + JS parse + render)
- Tab render times (PERF-002 to PERF-006) measured in-browser using performance.now() + requestAnimationFrame for accurate DOM render timing
- Interaction times (PERF-010 to PERF-014) measured in-browser using performance.now()
- Tab switching measured as avg of 3 runs from Classes->Events
- Bundle gzip sizes taken from Vite build output (computed during build)
- Console errors collected across entire test session including all 5 tab navigations and 3 modal open/close cycles
