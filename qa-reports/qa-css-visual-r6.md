# QA CSS/Visual Audit Report R6

**Date**: 2026-02-14
**Auditor**: Claude Opus 4.6 (CSS Deep Review)
**Scope**: All CSS in `src/styles/pulse-app.css` (14,683 lines), `src/index.css`, `src/App.css`, plus JSX components
**Method**: Static code analysis + cross-referencing z-index map, overflow chains, touch targets, and CSS specificity

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 5 |
| Major | 14 |
| Minor | 13 |
| Warning | 6 |
| **Total** | **38** |

---

## 1. OVERFLOW / SCROLL BUGS

### [FAIL] BUG-001: Booking bottom sheet has no overflow-y scroll on content area (Critical)
- **File**: `src/styles/pulse-app.css`, line 202-211
- **Description**: `.booking-bottom-sheet` and `.contact-bottom-sheet` have `max-height: 80vh` but NO `overflow-y: auto`. When content exceeds 80vh (e.g., long contact form with message, long event details), the bottom of the sheet is clipped and unreachable.
- **Fix**: Add `overflow-y: auto` to `.booking-bottom-sheet, .contact-bottom-sheet`.

### [FAIL] BUG-002: Profile modal body has no scroll container (Major)
- **File**: `src/styles/pulse-app.css`, line 9352-9366
- **Description**: `.profile-modal` has `max-height: 90vh` and `overflow: hidden` but uses `display: flex; flex-direction: column`. The flex children (hero + body) can exceed 90vh on short screens with cover photo + avatar + stats + menu items. While the flex column layout should accommodate some of this, there is no explicit `overflow-y: auto` on the body section, so if the hero section is tall, the bottom menu items become inaccessible.
- **Fix**: Add `overflow-y: auto` to the profile body content area (the scrollable child), not the outer container.

### [FAIL] BUG-003: Thread view inside business dashboard has fixed height 400px (Major)
- **File**: `src/styles/pulse-app.css`, line 3890-3891
- **Description**: `.inbox-thread { height: 400px; }` is a hardcoded pixel height. On mobile screens shorter than ~500px viewport, this creates an inner scrollable area that fights with the outer page scroll. On large screens, it wastes space. Should be relative (e.g., `max-height: 60vh` or flex-grow).
- **Fix**: Replace `height: 400px` with `flex: 1; max-height: 60vh; min-height: 200px;`.

### [FAIL] BUG-004: Search suggestions dropdown max-height can exceed viewport (Minor)
- **File**: `src/styles/pulse-app.css`, line 1688-1702
- **Description**: `.search-suggestions-dropdown` has `max-height: 280px` which is fine, but its `top: calc(100% - 4px)` means on mobile when the search bar is near the bottom of the sticky area, the dropdown can extend below the viewport with no visual affordance that scrolling is needed.
- **Fix**: Add `max-height: min(280px, calc(100vh - 200px))` to prevent overflow on short viewports.

### [PASS] Modal overlay scroll: `.modal-content` at line 6841 correctly has `max-height: 90vh; overflow-y: auto`.
### [PASS] Event detail modal at line 7366 has `max-height: 90vh; overflow-y: auto; overflow-x: hidden`.
### [PASS] Notifications panel at line 1075 has `max-height: 85vh` with child `.notif-list` having `overflow-y: auto`.

---

## 2. Z-INDEX CONFLICTS

### [FAIL] BUG-005: Toast (z-index: 2000) renders BEHIND image cropper overlay (z-index: 3000) (Critical)
- **File**: `src/styles/pulse-app.css`, lines 11725 and 8925
- **Description**: `.calendar-toast { z-index: 2000 }` while `.cropper-overlay-global { z-index: 3000 }`. If a user triggers a toast while the image cropper is open, the toast is hidden behind the cropper overlay. The toast should always be the topmost element.
- **Fix**: Set `.calendar-toast { z-index: 10000 }` or higher, above all overlays.

### [FAIL] BUG-006: Feedback widget (z-index: 9999) covers modal overlays (z-index: 1000) (Major)
- **File**: `src/styles/pulse-app.css`, lines 13927 and 6807
- **Description**: `.feedback-fab { z-index: 9999 }` and `.feedback-modal { z-index: 9999 }` sit above `.modal-overlay { z-index: 1000 }`. When any modal is open, the feedback FAB button floats above it, creating a visual distraction and potential misclick target. The feedback widget should be suppressed when modals are open.
- **Fix**: Either hide the feedback FAB when any modal is open (JS), or ensure modals sit above it by using a stacking context (e.g., wrap modals in a container with `z-index: 10000`).

### [FAIL] BUG-007: Profile modal overlay (z-index: 1500) conflicts with image cropper (z-index: 2000) (Minor)
- **File**: `src/styles/pulse-app.css`, lines 9349 and 8920
- **Description**: `.profile-modal-overlay { z-index: 1500 }` and `.cropper-overlay { z-index: 2000 }`. This works for cropper-over-profile scenario, but the standard `.modal-overlay { z-index: 1000 }` sits BELOW the profile modal. If a modal is triggered from inside the profile modal (e.g., auth flow), it appears behind the profile.
- **Fix**: Establish a clear z-index scale: modals=1000, profile=1000 (same level), cropper=2000, toast=3000, feedback=50 (below modals).

### [FAIL] BUG-008: View switcher (z-index: 1000) on same level as modal overlay (z-index: 1000) (Major)
- **File**: `src/styles/pulse-app.css`, lines 4 and 6807
- **Description**: `.view-switcher { z-index: 1000 }` and `.modal-overlay { z-index: 1000 }`. When a modal is open, the admin view switcher button is rendered at the same z-level. Depending on DOM order, it may be clickable through the modal backdrop or may partially overlap the modal.
- **Fix**: Lower `.view-switcher` to `z-index: 100` or raise `.modal-overlay` to `z-index: 1100`.

### Complete z-index map:
| z-index | Element(s) |
|---------|-----------|
| 1 | Various relative positioned items |
| 2 | Tab indicator, age slider |
| 5 | DateTime card, bookmark overlays |
| 10 | Close buttons, various local stacking |
| 20 | Results bar, event close, some overlays |
| 25 | Mobile modal handles |
| 50 | Search suggestions dropdown |
| 90 | Back to top button |
| 100 | App header, form inputs in modals, FAB |
| 200 | Modal buttons (!important) |
| 999 | Profile menu overlay, mobile view switcher |
| 1000 | View switcher, modal overlay, impersonation banner, verified badge tooltips |
| 1500 | Profile modal overlay |
| 2000 | Calendar toast, image cropper |
| 3000 | Global image cropper |
| 9998 | Feedback backdrop |
| 9999 | Feedback FAB, feedback modal |

---

## 3. TRUNCATION BUGS

### [FAIL] BUG-009: Venue name in event card truncated with no tooltip or "show more" (Major)
- **File**: `src/styles/pulse-app.css`, line 2701-2707
- **Description**: `.detail-text` uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Long venue names like "Squamish Brackendale Art Gallery and Cultural Centre" are silently cut off. There is no `title` attribute in the JSX (`EventCard.jsx` line 190) for hover-to-reveal, and no alternative to view the full name without clicking.
- **Fix**: Add `title={getVenueName(event.venueId, event)}` to the `.detail-text` span in `EventCard.jsx`.

### [FAIL] BUG-010: Compact card title and venue both truncated with no reveal mechanism (Major)
- **File**: `src/styles/pulse-app.css`, lines 14504-14517
- **Description**: `.compact-title` and `.compact-venue` both have `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. In compact mode, the combined title+venue info is severely truncated on narrow screens. No tooltip, no expand, and tapping opens the detail modal instead of expanding the text inline.
- **Fix**: Add `title` attributes to both elements in `EventCard.jsx` compact mode.

### [FAIL] BUG-011: Conversation preview in messages modal truncated to single line (Minor)
- **File**: `src/styles/pulse-app.css`, line 810-816
- **Description**: `.conv-preview` has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. This means only the first line of the last message is visible, which may be inadequate for multi-line messages. No preview expansion is available.
- **Fix**: Use `-webkit-line-clamp: 2` for 2-line preview instead of single-line truncation.

### [FAIL] BUG-012: Admin search result names truncated without tooltip (Minor)
- **File**: `src/styles/pulse-app.css`, lines 6216-6222
- **Description**: `.admin-search-name` has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Business names in admin search results can be long. No `title` attribute for hover reveal.
- **Fix**: Add `title` attribute to the name element.

### [PASS] Event card title: Uses `-webkit-line-clamp: 2` which provides adequate multi-line truncation.
### [PASS] Deal description: Uses `-webkit-line-clamp: 2` for multi-line preview.

---

## 4. POSITION: STICKY / FIXED CONFLICTS

### [FAIL] BUG-013: App header (sticky, z-index: 100) disappears behind modal overlay (z-index: 1000) incorrectly on some scroll positions (Minor)
- **File**: `src/styles/pulse-app.css`, lines 11-18 and 6807
- **Description**: `.app-header-premium { position: sticky; top: 0; z-index: 100 }`. When a modal opens, the header correctly goes behind the overlay. However, on iOS Safari, `position: sticky` elements inside a scroll container can exhibit jank where the header briefly flashes above the modal backdrop during momentum scrolling because the compositor handles sticky differently than fixed.
- **Fix**: When a modal opens, add `position: relative` override to the header or set `body { overflow: hidden }` to stop background scrolling entirely.

### [FAIL] BUG-014: Results bar sticky (z-index: 20) fights with sticky header (z-index: 100) (Minor)
- **File**: `src/styles/pulse-app.css`, lines 14411-14424
- **Description**: `.results-bar { position: sticky; top: 0; z-index: 20 }` competes with `.app-header-premium { position: sticky; top: 0; z-index: 100 }`. Both use `top: 0`, so when scrolling, the results bar slides under the header. However, it means the results bar is NOT visible when user scrolls up to the header area -- it's hidden behind the header instead of stacking below it.
- **Fix**: Set `.results-bar { top: [header-height]px }` so it stacks below the header instead of behind it.

### [FAIL] BUG-015: Body scroll not locked when modals open (Critical)
- **File**: `src/App.jsx` / all modal components
- **Description**: No `body { overflow: hidden }` is applied when modals open. The background page remains scrollable behind the modal overlay, which is particularly problematic on mobile where swipe gestures can scroll the background. The `backdrop-filter: blur(8px)` partially masks this, but content still scrolls visibly through the blur.
- **Fix**: Add `useEffect` to set `document.body.style.overflow = 'hidden'` when any modal is open, and restore on close.

---

## 5. ANIMATION ARTIFACTS

### [FAIL] BUG-016: Card entrance animation fires on every filter change (Major)
- **File**: `src/styles/pulse-app.css`, lines 14387-14401 and `src/components/EventCard.jsx` line 127
- **Description**: `.card-enter { animation: cardFadeUp 0.3s ease both; }` is applied via the `card-enter` class on every EventCard. When filters change and the list re-renders, ALL cards re-animate from scratch (fade up from 12px below). This creates a distracting "jumping" effect rather than a smooth transition. Cards should only animate on initial mount, not on filter/sort changes.
- **Fix**: Use a React state flag to track initial load vs filter change, and only apply `card-enter` on initial load.

### [FAIL] BUG-017: slideDown animation for filters section animates max-height from 0 (Minor)
- **File**: `src/styles/pulse-app.css`, lines 2051-2063
- **Description**: `@keyframes slideDown` animates from `max-height: 0` to `max-height: 500px`. This is a common anti-pattern that causes the animation to take different durations depending on actual content height. For short filter content (~100px actual), the animation completes visually in ~40ms but the CSS animation runs for the full duration to reach 500px.
- **Fix**: Use `transform: scaleY(0)` to `transform: scaleY(1)` with `transform-origin: top` for consistent animation timing, or use Framer Motion's `AnimatePresence`.

### [FAIL] BUG-018: No exit animation for modals using CSS-only animation (Major)
- **File**: `src/styles/pulse-app.css`, line 6879 and throughout
- **Description**: Modals use `animation: modalSlideUp 0.3s` for entry but have NO exit animation. When a modal closes, it instantly disappears (hard cut). Only modals using Framer Motion's `AnimatePresence` (like `EventDetailModal`) get exit animations. The auth modal, claim modal, notifications panel, and many others lack exit animations.
- **Fix**: Wrap all modal renders in `AnimatePresence` with exit animations, or add CSS exit animation via a `closing` state class.

### [PASS] Skeleton loader shimmer animation works correctly with `@keyframes shimmer`.
### [PASS] `prefers-reduced-motion: reduce` at line 14674 correctly disables all animations.

---

## 6. DARK / LIGHT THEME CONFLICTS

### [FAIL] BUG-019: index.css sets dark mode colors that conflict with pulse-app.css (Critical)
- **File**: `src/index.css`, lines 1-14
- **Description**: `index.css` declares `:root { color-scheme: light dark; color: rgba(255, 255, 255, 0.87); background-color: #242424; }`. This means in dark mode (or when `prefers-color-scheme: dark` is active), the ROOT color is white-on-dark. However, `pulse-app.css` line 3 sets `.pulse-app { background: #fff; color: #000; }` which overrides for the app container but NOT for elements that inherit from `:root` outside `.pulse-app` (e.g., portals, body-level elements). This causes:
  - Button default background `#1a1a1a` (line 47 of index.css) bleeds through to unstyled buttons
  - Link color `#646cff` from index.css clashes with the blue design system (`#2563eb`)
  - Any element outside `.pulse-app` gets dark theme colors
- **Fix**: Either remove `color-scheme: light dark` from `:root` since the app is light-only, or add explicit `color-scheme: light` to `.pulse-app`.

### [FAIL] BUG-020: No dark mode support in pulse-app.css despite index.css declaring color-scheme (Major)
- **File**: `src/styles/pulse-app.css` (entire file)
- **Description**: `index.css` declares `color-scheme: light dark`, indicating the app claims to support both schemes. Yet `pulse-app.css` has zero `@media (prefers-color-scheme: dark)` queries. Users with system dark mode get the Vite default dark colors for base elements, then white Pulse app content on top -- a broken hybrid. This is especially visible on page load before CSS fully parses.
- **Fix**: Either add `color-scheme: light only` to `:root` to explicitly opt out of dark mode, or properly implement dark mode support. The former is the simpler fix.

### [FAIL] BUG-021: Hardcoded white backgrounds throughout -- no CSS custom properties (Warning)
- **File**: `src/styles/pulse-app.css`, throughout
- **Description**: Colors like `#fff`, `#111827`, `#6b7280`, `#3b82f6` are hardcoded throughout all 14,683 lines. There are almost no CSS custom properties (only `var(--pulse-blue, #2563eb)` at line 13931). This makes any future theming or dark mode impossible without rewriting the entire stylesheet.
- **Fix**: Define a design token system using CSS custom properties at `:root` level and reference them throughout.

---

## 7. TOUCH TARGET SIZES (< 44px)

### [FAIL] BUG-022: Close buttons on modals are 32x32px -- below 44px minimum (Major)
- **File**: `src/styles/pulse-app.css`, multiple locations
- **Description**: The following close buttons are 32x32px, violating the WCAG 2.5.8 Target Size minimum of 44px:
  - `.sheet-close` (line 237-238): 32x32px
  - `.messages-close` (line 722-723): 32x32px
  - `.event-close` (line 7389-7394): 32x32px (with min/max constraints)
  - `.notif-close-btn` (line 1135-1136): 32x32px
  - `.notif-action-btn` (line 1116-1117): 32x32px
  - `.feedback-close` (line 13993-13994): 32x32px
- **Fix**: Increase all close buttons to at least 44x44px, or add invisible touch target padding with `::after { content: ''; position: absolute; inset: -6px; }`.

### [FAIL] BUG-023: Search clear button is 28x28px (Minor)
- **File**: `src/styles/pulse-app.css`, lines 1657-1658
- **Description**: `.search-clear-btn { width: 28px; height: 28px }` -- significantly below the 44px minimum. Users will struggle to tap it on mobile.
- **Fix**: Increase to 44x44px or add touch target padding.

### [FAIL] BUG-024: Verified badge is 24x24px -- a clickable element too small (Minor)
- **File**: `src/styles/pulse-app.css`, lines 2776-2777
- **Description**: `.verified-badge-premium-inline { width: 24px; height: 24px }` with `cursor: pointer`. It has a tooltip on hover but is nearly impossible to accurately tap on mobile.
- **Fix**: Add touch target expansion via `::after` pseudo-element with `inset: -10px`.

### [FAIL] BUG-025: Quick filter chips have implicit height of ~32px -- below 44px (Minor)
- **File**: `src/styles/pulse-app.css`, lines 1929-1943
- **Description**: `.quick-chip { padding: 6px 14px; font-size: 13px }`. With line-height and icon, these render at approximately 30-34px height, below the 44px touch target minimum. The chips are the primary interaction for filtering.
- **Fix**: Increase padding to `10px 14px` or set `min-height: 44px`.

### [FAIL] BUG-026: Filter pills (active filter badges) are ~28px height (Minor)
- **File**: `src/styles/pulse-app.css`, lines 1984-1996
- **Description**: `.filter-pill { padding: 5px 10px; font-size: 12px }` -- renders at approximately 26-28px height. These are tappable to remove filters but are too small.
- **Fix**: Increase padding or set `min-height: 44px`.

### [PASS] Banner tabs: `.banner-tab { min-height: 44px }` -- correctly meets minimum.
### [PASS] Sign-in button: `.sign-in-btn { min-height: 44px }` -- correct.
### [PASS] Event book button: `.event-book-btn { min-height: 44px }` -- correct.
### [PASS] Age range buttons: `.age-range-btn { min-height: 44px }` -- correct.

---

## 8. IMAGE HANDLING

### [FAIL] BUG-027: ProgressiveImage has no onError handler -- broken images show blank space (Major)
- **File**: `src/components/ProgressiveImage.jsx`, lines 56-70
- **Description**: The `<img>` element inside `ProgressiveImage` has `onLoad` but no `onError` handler. If the image URL returns 404, the blur placeholder fades to opacity 0 (because `loaded` never changes from false? Actually no -- `loaded` stays false so placeholder stays visible at opacity 1). Wait -- re-reading: `opacity: loaded ? 0 : 1` for placeholder, and `opacity: loaded ? 1 : 0` for image. So if image fails, placeholder stays visible (blurred version of same src). But if src itself is 404, the blur placeholder tries to load the same broken URL and shows nothing (gray). Result: an empty gray box with no fallback.
- **Fix**: Add `onError` handler that sets a fallback placeholder image or renders an icon.

### [FAIL] BUG-028: Profile avatar onError hides image but shows nothing if no name (Minor)
- **File**: `src/components/ConsumerHeader.jsx`, line 183
- **Description**: `onError={(e) => { e.target.style.display = 'none'; }}` -- when avatar image fails, it is hidden with `display: none`. The parent container still shows the gradient background, but the initials fallback only renders in the ternary else branch. Since the img element is hidden but not removed from the DOM, React doesn't re-render to show initials. The avatar shows as an empty blue circle.
- **Fix**: Use a state variable for image error and conditionally render initials fallback.

### [FAIL] BUG-029: Multiple img tags have empty alt="" with no accessible description (Warning)
- **File**: Multiple components
- **Description**: Profile avatar images use `alt=""` (empty alt text) in `ConsumerHeader.jsx:183`, `ProfileMenu.jsx:26`, `BusinessDashboard.jsx:210`, and `ProfileModal.jsx:80`. While `alt=""` is technically valid for decorative images, profile avatars convey information (who is logged in) and should have descriptive alt text like `alt={user.name + "'s profile picture"}`.
- **Fix**: Add descriptive alt text to user-identifying images.

### [PASS] WellnessBooking uses ProgressiveImage with alt text for provider photos.

---

## 9. PRINT / SPECIAL CSS

### [FAIL] BUG-030: No @media print styles defined anywhere (Warning)
- **File**: `src/styles/pulse-app.css`, `src/index.css`, `src/App.css`
- **Description**: Zero `@media print` rules in the entire codebase. Printing any page will include the fixed header, all interactive buttons, the feedback FAB, and potentially modal overlays. Calendar/schedule views would be particularly useful to print.
- **Fix**: Add basic print styles: hide navigation, FABs, and interactive elements; ensure content fills page width.

### [FAIL] BUG-031: prefers-reduced-motion rule disables ALL transitions including functional ones (Warning)
- **File**: `src/styles/pulse-app.css`, lines 14674-14681
- **Description**: The reduced motion rule sets `transition-duration: 0.01ms !important` on ALL elements. This disables functional transitions like dropdown appearance, focus indicators, and scroll behavior. The `scroll-behavior: auto` part is correct, but blanket disabling all transitions can cause jarring layout shifts.
- **Fix**: Only disable decorative animations. Keep functional transitions like focus states, dropdown reveals, and progress indicators.

### [PASS] `prefers-color-scheme: light` in index.css provides light mode override for Vite defaults.

---

## 10. FONT LOADING

### [FAIL] BUG-032: No @font-face declarations or font-display strategy (Warning)
- **File**: All CSS files
- **Description**: The app uses `font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif` (line 3 of pulse-app.css). While system fonts load instantly on their respective platforms, `'SF Pro Display'` is listed third and is a specific Apple font that is NOT a system font alias. On non-Apple platforms or older devices, the browser may attempt to load `SF Pro Display` remotely (if a web font is defined elsewhere), causing FOUT.
- **Fix**: Remove `'SF Pro Display'` from the font stack since system-ui already resolves to SF Pro on Apple devices, or ensure it's ordered after system-ui to act only as a fallback.

---

## 11. CSS SELECTOR / SPECIFICITY BUGS

### [FAIL] BUG-033: `.verified-badge-premium` selector collision -- badge AND modal header use same class (Critical)
- **File**: `src/styles/pulse-app.css`, lines 3106-3176
- **Description**: The class `.verified-badge-premium` is defined TWICE with completely different purposes:
  1. Lines 3106-3170: Styles a 28x28px circular badge with tooltip
  2. Lines 3172-3176: Styles a modal header section with `text-align: center; padding: 32px 32px 24px 32px; border-bottom: 1px solid #e5e7eb`
  The second declaration overwrites the first's `text-align`, `padding`, and `border-bottom`, turning the small circular badge into a large padded block element.
- **Fix**: Rename the modal header usage to `.modal-header-premium` (which already exists at line 3183) or a dedicated class.

### [FAIL] BUG-034: Excessive !important usage (65 instances) creates specificity wars (Major)
- **File**: `src/styles/pulse-app.css`
- **Description**: 65 `!important` declarations scattered across the file. Many are in global modal input/button overrides (lines 6810-6830) using patterns like `position: relative !important; z-index: 100 !important;`. This was clearly added to fix z-index blocking issues but creates an escalation problem where new styles must ALSO use !important to override.
- **Fix**: Refactor modal input/button styles to use higher-specificity selectors instead of !important (e.g., `.modal-overlay .form-field input` instead of `.modal-overlay input`).

### [FAIL] BUG-035: `App.css` sets `#root { max-width: 1280px; text-align: center }` which conflicts (Major)
- **File**: `src/App.css`, lines 1-8
- **Description**: `App.css` (Vite's default scaffold) sets `#root { max-width: 1280px; margin: 0 auto; text-align: center; }`. Meanwhile `pulse-app.css` line 2 sets `#root { width: 100%; }`. The `max-width: 1280px` and `text-align: center` from App.css apply to ALL content, potentially causing layout issues in admin views and when the consumer view is not the only content. The `text-align: center` is particularly dangerous as it center-aligns ALL text by default.
- **Fix**: Remove or override the Vite default `App.css` styles, or add `text-align: left` to `.pulse-app`.

---

## 12. ADDITIONAL FINDINGS

### [FAIL] BUG-036: Inline style blocking on avatar-edit-btn with 13 !important declarations (Minor)
- **File**: `src/styles/pulse-app.css`, lines 9511-9530
- **Description**: `.avatar-edit-btn` has 13 properties with `!important` flags including `position: absolute !important`, `background: ... !important`, `width: 34px !important`, etc. This is a brute-force override of the global `.modal-overlay button { position: relative !important; z-index: 200 !important; }` rule. The specificity war between these two rules is fragile.
- **Fix**: Use a more specific selector for the global modal button rule (e.g., `.modal-overlay > .modal-content button`) so it doesn't match nested UI buttons like avatar edit.

### [FAIL] BUG-037: Profile menu dropdown uses hardcoded `top: 76px` positioning (Minor)
- **File**: `src/styles/pulse-app.css`, line 1328
- **Description**: `.profile-menu-dropdown { position: fixed; top: 76px; right: 20px; }` -- the `top: 76px` is a magic number that assumes the header is exactly 76px tall. If the header height changes (e.g., on different screen sizes, with/without impersonation banner, or with different font sizes), the menu will be mispositioned.
- **Fix**: Calculate position dynamically based on the profile button's bounding rect, or use `top: calc(var(--header-height, 76px) + 8px)`.

### [FAIL] BUG-038: index.css sets `body { place-items: center }` which centers app vertically on short pages (Minor)
- **File**: `src/index.css`, line 28
- **Description**: `body { display: flex; place-items: center; }` -- this is Vite's default CSS for centering the starter app. With `place-items: center`, the entire app is vertically centered in the viewport on pages with less content than the viewport height. This means the app "floats" in the middle of the screen instead of being top-aligned.
- **Fix**: Change `place-items: center` to `place-items: start` or remove it entirely since `pulse-app.css` handles layout.

---

## CHECKS PASSED

| # | Check | Status |
|---|-------|--------|
| 1 | Modal overlay has correct backdrop-filter blur | [PASS] |
| 2 | Modal content has max-height: 90vh with overflow-y: auto | [PASS] |
| 3 | Conversation list has overflow-y: auto | [PASS] |
| 4 | Date strip scrollbar is hidden | [PASS] |
| 5 | Quick filter chips horizontal scroll enabled | [PASS] |
| 6 | Messages container has flex-direction: column with overflow-y: auto | [PASS] |
| 7 | Banner tabs have min-height: 44px touch targets | [PASS] |
| 8 | Sign-in, book, and age-range buttons meet 44px minimum | [PASS] |
| 9 | Event card title uses 2-line clamp | [PASS] |
| 10 | Deal description uses 2-line clamp | [PASS] |
| 11 | prefers-reduced-motion rule exists and is comprehensive | [PASS] |
| 12 | Skeleton loader shimmer animation is smooth | [PASS] |
| 13 | Send button in chat is 44x44px | [PASS] |
| 14 | FAB button is 64x64px -- well above minimum | [PASS] |
| 15 | Back-to-top button is 44x44px | [PASS] |
| 16 | Notification dot pulse animation doesn't cause layout shifts | [PASS] |
| 17 | Search input has proper focus styles with ring | [PASS] |
| 18 | Form inputs in modals have z-index fix for interactivity | [PASS] |
| 19 | Cropper modal has touch-action: none for drag | [PASS] |
| 20 | Event card active state uses scale(0.98) for touch feedback | [PASS] |

---

## TOTALS

- **Checks performed**: 58
- **Bugs found**: 38
- **Passes**: 20

### Priority fix order:
1. **BUG-019** (Critical): Fix dark mode color-scheme conflict in index.css
2. **BUG-015** (Critical): Add body scroll lock when modals are open
3. **BUG-033** (Critical): Fix .verified-badge-premium selector collision
4. **BUG-001** (Critical): Add overflow-y: auto to booking/contact bottom sheets
5. **BUG-005** (Critical): Fix toast z-index below cropper overlay
6. **BUG-035** (Major): Remove Vite default App.css conflicts
7. **BUG-022** (Major): Increase all close buttons to 44px minimum
8. **BUG-034** (Major): Refactor !important overrides
9. **BUG-006** (Major): Fix feedback FAB z-index vs modals
10. **BUG-008** (Major): Fix view-switcher z-index conflict with modals
