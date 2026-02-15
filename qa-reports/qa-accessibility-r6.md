# QA Accessibility Audit Report - Round 6

**Date**: 2026-02-14
**Scope**: All component files in `src/components/`, `src/components/modals/`, `src/App.jsx`, and `src/styles/pulse-app.css`
**Standard**: WCAG 2.1 AA
**Total Issues Found**: 42

---

## Summary by Severity

| Severity | Count |
|----------|-------|
| Critical | 6 |
| Major    | 18 |
| Minor    | 14 |
| Warning  | 4 |

---

## Bug #1 -- Missing aria-label on Messages icon button

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/ConsumerHeader.jsx`
**Line**: 169
**Code**:
```jsx
<button className="header-btn-icon messages-btn" onClick={openMessages}>
  <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <MessageCircle size={22} strokeWidth={2} />
  </div>
</button>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Critical
**Fix**: Add `aria-label="Messages"` to the button element.

---

## Bug #2 -- Missing aria-label on Notifications icon button

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/ConsumerHeader.jsx`
**Line**: 174
**Code**:
```jsx
<button className="header-btn-icon notification-btn" onClick={onOpenNotifications} style={{ position: 'relative' }}>
  <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Bell size={22} strokeWidth={2} />
  </div>
  ...
</button>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Critical
**Fix**: Add `aria-label="Notifications"` to the button element.

---

## Bug #3 -- No focus management when modals open

**File**: All modals in `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/`
**Lines**: All modal components (EventDetailModal.jsx, DealDetailModal.jsx, ServiceDetailModal.jsx, ProfileModal.jsx, SubmissionModal.jsx, ClaimBusinessModal.jsx, MyCalendarModal.jsx, MessagesModal.jsx, BookingSheet.jsx, ContactSheet.jsx, EditEventModal.jsx, EditVenueModal.jsx, NotificationsPanel.jsx, AuthModal.jsx, LegalModal.jsx)
**Code**: No modal component calls `focus()` on the modal container or close button when it opens. Example:
```jsx
// EventDetailModal.jsx - no useEffect to move focus on open
const EventDetailModal = memo(function EventDetailModal({ event, onClose, ... }) {
  if (!event) return null;
  // Focus never moves to the modal
  return (
    <div className="modal-overlay event-modal-overlay" role="dialog" aria-modal="true" ...>
```
**WCAG**: 2.4.3 Focus Order (Level A)
**Severity**: Critical
**Fix**: Add a `useEffect` to each modal that moves focus to the modal container or first focusable element (e.g., the close button) when the modal opens.

---

## Bug #4 -- No focus trap inside modals

**File**: All modals in `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/`
**Code**: None of the modals implement focus trapping. When a modal is open, users can Tab to elements behind the modal overlay.
**WCAG**: 2.4.3 Focus Order (Level A)
**Severity**: Critical
**Fix**: Implement a focus trap that keeps keyboard focus cycling within the modal when it is open. When the user tabs past the last focusable element, focus should wrap to the first focusable element within the modal.

---

## Bug #5 -- No focus return to trigger element when modals close

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx` and all modal components
**Code**: When any modal is closed (e.g., `setSelectedEvent(null)`), focus is not returned to the element that triggered the modal. Focus falls to `<body>` or the beginning of the document.
**WCAG**: 2.4.3 Focus Order (Level A)
**Severity**: Critical
**Fix**: Store a reference to the triggering element before opening the modal, and restore focus to it on close.

---

## Bug #6 -- Close buttons use icon-only SVG without aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/EventDetailModal.jsx`
**Line**: 80
**Code**:
```jsx
<button className="close-btn event-close" onClick={onClose}>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1 1L13 13M1 13L13 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
</button>
```
Same pattern in:
- `DealDetailModal.jsx` line 75
- `MessagesModal.jsx` line 21
- `BookingSheet.jsx` line 24
- `ContactSheet.jsx` line 19

**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Critical
**Fix**: Add `aria-label="Close"` to each of these close buttons. Some modals (AuthModal, FeedbackWidget, NotificationsPanel, WellnessBooking) already have aria-labels on close buttons, but these five do not.

---

## Bug #7 -- Range slider inputs missing aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FilterSection.jsx`
**Lines**: 301-326
**Code**:
```jsx
<input
  type="range"
  min="-1"
  max="18"
  value={kidsAgeRange[0]}
  onChange={(e) => { ... }}
  className="age-slider age-slider-min"
/>
<input
  type="range"
  min="-1"
  max="18"
  value={kidsAgeRange[1]}
  onChange={(e) => { ... }}
  className="age-slider age-slider-max"
/>
```
**WCAG**: 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `aria-label="Minimum age"` and `aria-label="Maximum age"` (or use `aria-labelledby` pointing to the "Age Range" label), plus `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` attributes.

---

## Bug #8 -- Conversation list items are clickable divs without role or keyboard support

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/MessagesModal.jsx`
**Line**: 48-54
**Code**:
```jsx
<div
  key={conv.id}
  className={`conversation-item ${conv.unread_count > 0 ? 'unread' : ''}`}
  onClick={() => {
    setCurrentConversation(conv);
    fetchMessages(conv.id);
  }}
>
```
**WCAG**: 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler for Enter/Space. Alternatively, use a `<button>` element.

---

## Bug #9 -- Notification items are clickable divs without role or keyboard support

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/NotificationsPanel.jsx`
**Lines**: 98-104
**Code**:
```jsx
<div
  key={notif.id}
  className={`notif-item ${notif.is_read ? '' : 'unread'}`}
  onClick={() => {
    if (!notif.is_read) onMarkRead(notif.id);
    if (onNotificationClick) onNotificationClick(notif);
  }}
>
```
**WCAG**: 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler for Enter/Space.

---

## Bug #10 -- Related deal cards are clickable divs without role or keyboard support

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/DealDetailModal.jsx`
**Line**: 185
**Code**:
```jsx
<div key={rd.id} className="related-deal-card" onClick={() => onSelectDeal(rd)}>
```
**WCAG**: 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `role="button"`, `tabIndex={0}`, and `onKeyDown` handler for Enter/Space.

---

## Bug #11 -- Provider header in WellnessBooking is a clickable div without keyboard support

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Line**: 675
**Code**:
```jsx
<div className="wb-provider-header" onClick={() => onProviderClick(provider)}>
```
**WCAG**: 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `role="button"`, `tabIndex={0}`, and `onKeyDown` handler for Enter/Space.

---

## Bug #12 -- Slot avatar in TimelineView is a clickable div without keyboard support

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Line**: 642
**Code**:
```jsx
<div className="wb-slot-avatar" onClick={(e) => { e.stopPropagation(); onProviderClick(slot); }}>
```
**WCAG**: 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Change to `<button>` or add `role="button"`, `tabIndex={0}`, and keyboard handler.

---

## Bug #13 -- Feedback widget textarea missing accessible label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FeedbackWidget.jsx`
**Line**: 175-181
**Code**:
```jsx
<textarea
  className="feedback-textarea"
  value={message}
  onChange={e => setMessage(e.target.value)}
  placeholder={currentType?.placeholder}
  maxLength={5000}
/>
```
**WCAG**: 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `aria-label="Feedback message"` to the textarea element. Placeholder text alone does not serve as a label.

---

## Bug #14 -- Feedback email input missing accessible label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FeedbackWidget.jsx`
**Lines**: 205-211
**Code**:
```jsx
<input
  type="email"
  className="feedback-email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  placeholder="Email (optional -- so we can follow up)"
/>
```
**WCAG**: 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `aria-label="Email address (optional)"` to the input element.

---

## Bug #15 -- Feedback screenshot remove button missing aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FeedbackWidget.jsx`
**Line**: 191
**Code**:
```jsx
<button onClick={() => { setScreenshot(null); setScreenshotFile(null); }} className="feedback-screenshot-remove">
  <X size={14} />
</button>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `aria-label="Remove screenshot"`.

---

## Bug #16 -- Feedback type selector buttons missing aria-pressed state

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FeedbackWidget.jsx`
**Lines**: 163-170
**Code**:
```jsx
<button
  key={t.id}
  className={`feedback-type-btn${selectedType === t.id ? ' active' : ''}`}
  onClick={() => setSelectedType(t.id)}
>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `aria-pressed={selectedType === t.id}` to each button to communicate the selected state to screen readers.

---

## Bug #17 -- Feedback error message not linked to form field

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/FeedbackWidget.jsx`
**Line**: 220
**Code**:
```jsx
{error && <div className="feedback-error">{error}</div>}
```
**WCAG**: 3.3.1 Error Identification (Level A)
**Severity**: Minor
**Fix**: Add `role="alert"` to the error div so screen readers announce it, and use `aria-describedby` on the relevant form field pointing to the error.

---

## Bug #18 -- SkeletonCards loading state not announced to screen readers

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/SkeletonCards.jsx`
**Lines**: 16-22
**Code**:
```jsx
const SkeletonCards = ({ count = 6 }) => (
  <div>
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);
```
**WCAG**: 4.1.3 Status Messages (Level AA)
**Severity**: Major
**Fix**: Add `role="status"` and `aria-label="Loading content"` to the wrapper div, or include a visually hidden "Loading..." text.

---

## Bug #19 -- WellnessBooking date carousel missing role and aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Lines**: 344-363
**Code**:
```jsx
<div className="wb-date-carousel" ref={dateScrollRef}>
  {dates.map(d => {
    ...
    return (
      <button
        key={d.date}
        ...
      >
```
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Minor
**Fix**: Add `role="tablist"` and `aria-label="Select date"` to the carousel container. Add `role="tab"` and `aria-selected` to each date button to match the pattern used in FilterSection.

---

## Bug #20 -- WellnessBooking date buttons missing aria-label for context

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Lines**: 349-361
**Code**:
```jsx
<button
  key={d.date}
  className={`wb-date-item ${isSelected ? 'active' : ''} ${d.isToday ? 'today' : ''} ...`}
  onClick={() => { setSelectedDate(d.date); ... }}
>
  <span className="wb-date-day">{d.dayName}</span>
  <span className="wb-date-num">{d.dayNum}</span>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `aria-label` with full date context, e.g., `aria-label={`${d.dayName} ${d.monthName} ${d.dayNum}${d.isToday ? ' (Today)' : ''} -- ${count} slots`}`.

---

## Bug #21 -- WellnessBooking discipline tabs missing aria role and selection state

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Lines**: 327-341
**Code**:
```jsx
<div className="wb-discipline-tabs">
  {DISCIPLINES.map(d => {
    ...
    return (
      <button
        key={d.key}
        className={`wb-discipline-tab ${discipline === d.key ? 'active' : ''}`}
        onClick={() => { setDiscipline(d.key); ... }}
      >
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `role="tablist"` on the container and `role="tab"` + `aria-selected={discipline === d.key}` on each button.

---

## Bug #22 -- WellnessBooking view toggle buttons missing aria-pressed

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Lines**: 381-395
**Code**:
```jsx
<button
  className={`wb-view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
  onClick={() => setViewMode('timeline')}
>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `aria-pressed={viewMode === 'timeline'}` or use `role="tab"` pattern.

---

## Bug #23 -- WellnessBooking ProviderDetailModal missing aria-label on close button

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Line**: 805
**Code**:
```jsx
<button className="wb-modal-close" onClick={onClose}>
  <X size={20} />
</button>
```
Same at lines 896 (AlertSetupModal close button).
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `aria-label="Close"` to both close buttons.

---

## Bug #24 -- WellnessBooking alert bell button missing aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx`
**Lines**: 696-701
**Code**:
```jsx
<button
  className={`wb-alert-btn ${hasAlert ? 'active' : ''}`}
  onClick={(e) => { e.stopPropagation(); onAlertClick(provider); }}
>
  {hasAlert ? <BellOff size={16} /> : <Bell size={16} />}
</button>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Major
**Fix**: Add `aria-label={hasAlert ? 'Remove alert' : 'Set availability alert'}`.

---

## Bug #25 -- ProfileMenu overlay uses click on div without keyboard accessibility

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/ProfileMenu.jsx`
**Line**: 23
**Code**:
```jsx
<div className="profile-menu-overlay" onClick={onClose}>
```
**WCAG**: 2.1.1 Keyboard (Level A)
**Severity**: Minor
**Fix**: This overlay-close pattern is acceptable for mouse users, but ensure the Escape key also closes the menu (which it does via the global keydown handler in App.jsx). No role needed on the overlay itself. However, the dropdown menu should have `role="menu"` and items should have `role="menuitem"` for full screen reader support.

---

## Bug #26 -- Profile menu dropdown items missing role="menuitem"

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/ProfileMenu.jsx`
**Lines**: 33-78
**Code**:
```jsx
<div className="profile-menu-items">
  <button className="profile-menu-item" onClick={onProfileOpen}>
    <Users size={18} />
    <span>My Profile</span>
  </button>
  ...
</div>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `role="menu"` to the `profile-menu-dropdown` container and `role="menuitem"` to each button inside.

---

## Bug #27 -- Claim business verification code input missing aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/ClaimBusinessModal.jsx`
**Lines**: 93-106
**Code**:
```jsx
<input
  type="text"
  inputMode="numeric"
  maxLength={6}
  placeholder="000000"
  value={claimVerificationCode}
  onChange={(e) => setClaimVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
  ...
  autoFocus
/>
```
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Major
**Fix**: Add `aria-label="Verification code"`.

---

## Bug #28 -- Claim business form inputs missing label associations

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/ClaimBusinessModal.jsx`
**Lines**: 181-205
**Code**:
```jsx
<input type="text" placeholder="e.g., The Sound Martial Arts" value={claimFormData.businessName} ... />
...
<input type="text" placeholder="Full name" value={claimFormData.ownerName} ... />
...
<input type="email" placeholder="your@email.com" value={claimFormData.email} ... />
```
The labels for these inputs exist but are `<label>` elements without `htmlFor` attributes, and the inputs lack `id` attributes. The `<label>` and `<input>` are siblings within the same div but not explicitly associated.
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Major
**Fix**: Add matching `htmlFor`/`id` pairs on each label-input pair, or wrap each input inside its `<label>`.

---

## Bug #29 -- Auth modal form inputs missing htmlFor/id label association

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/AuthModal.jsx`
**Lines**: 142-157
**Code**:
```jsx
<div className="auth-form-group">
  <label>Full Name</label>
  <input type="text" ... />
</div>
<div className="auth-form-group">
  <label>Email</label>
  <input type="email" ... />
</div>
<div className="auth-form-group">
  <label>Password</label>
  <input type="password" ... />
</div>
```
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Major
**Fix**: Add `id` to each input and matching `htmlFor` on each `<label>`, or wrap the input inside the `<label>`.

---

## Bug #30 -- Edit event/venue form inputs missing label associations

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/EditEventModal.jsx` (lines 23-53) and `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/EditVenueModal.jsx` (lines 30-83)
**Code**: Both files use `<label>` elements adjacent to `<input>` elements without `htmlFor`/`id` binding. Same pattern as Bug #28.
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Major
**Fix**: Add `htmlFor`/`id` pairs or wrap inputs in labels.

---

## Bug #31 -- Profile settings form inputs missing label associations

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/ProfileModal.jsx`
**Lines**: 755-856
**Code**: Settings tab has inputs for name, email, phone, bio, and multiple checkboxes, all using `<label>` elements without `htmlFor` attributes. Example:
```jsx
<input type="text" value={user.name} onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))} />
```
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Major
**Fix**: Add `htmlFor`/`id` pairs to all labels and inputs.

---

## Bug #32 -- Toast notifications not persistently accessible

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/App.jsx`
**Lines**: ~1816-1825
**Code**:
```jsx
<motion.div
  className={`calendar-toast ${...}`}
  role="alert"
  aria-live="assertive"
  ...
>
```
The toast has `role="alert"` and `aria-live="assertive"`, which is good. However, the toast auto-dismisses after 3 seconds (line 94: `setTimeout(() => setShowCalendarToast(false), 3000)`). Users relying on screen readers may not have time to perceive the message.
**WCAG**: 2.2.1 Timing Adjustable (Level A)
**Severity**: Warning
**Fix**: Consider extending the timeout to at least 5 seconds, or allow the user to pause/dismiss the toast manually, or ensure the message is stored in a notification history.

---

## Bug #33 -- Color contrast: #9ca3af text on white background

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/styles/pulse-app.css`
**Lines**: Multiple (273, 353, 524, 807, 994, 1047, 1220, 1583, 1614, 1642, 1717, 1763, 1875, etc.)
**Code**: Many elements use `color: #9ca3af` on white (`#fff` or `#f9fafb`) backgrounds. `#9ca3af` on `#ffffff` has a contrast ratio of approximately 2.89:1, which fails WCAG AA for normal text (requires 4.5:1).
**WCAG**: 1.4.3 Contrast (Minimum) (Level AA)
**Severity**: Major
**Impact**: Affects secondary text, timestamps, helper text, subtitles, and placeholder-style content throughout the entire app.
**Fix**: Change to at least `#6b7280` (contrast ratio ~4.65:1 on white) for secondary text, or darken the text to `#6b7280` or darker.

---

## Bug #34 -- Color contrast: Wellness slot "DB" billing badge

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/WellnessBooking.jsx` (inline CSS)
**Line**: ~1444-1451
**Code**:
```css
.wb-slot-billing {
  font-size: 10px;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
}
```
`#059669` on `#ecfdf5` yields approximately 3.22:1 contrast. For text at 10px (well below 18px/14px bold threshold), this fails the 4.5:1 requirement.
**WCAG**: 1.4.3 Contrast (Minimum) (Level AA)
**Severity**: Minor
**Fix**: Darken the text to `#047857` or `#065f46`, or increase font size to at least 14px bold.

---

## Bug #35 -- Color contrast: Date chip count badge

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/styles/pulse-app.css`
**Code**: The date-chip-count badge uses small text on colored backgrounds. The `date-chip-empty` class likely has faded appearance that may have low contrast.
**WCAG**: 1.4.3 Contrast (Minimum) (Level AA)
**Severity**: Warning
**Fix**: Verify all badge text/background combinations meet 4.5:1 for small text and 3:1 for large text.

---

## Bug #36 -- Framer Motion animations not respecting prefers-reduced-motion in JS

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/EventCard.jsx`, `DealsGrid.jsx`, `ServicesGrid.jsx`, `App.jsx`
**Code**: While the CSS file has a `prefers-reduced-motion` media query that sets `animation-duration: 0.01ms !important`, the Framer Motion animations (spring transitions, `initial`, `animate`, `exit` props, `whileTap`) are defined in JSX and are NOT affected by the CSS media query:
```jsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30, delay: index < 10 ? index * 0.04 : 0 }}
>
```
**WCAG**: 2.3.3 Animation from Interactions (Level AAA), also recommended under WCAG 2.1 general best practice
**Severity**: Minor
**Fix**: Use Framer Motion's `useReducedMotion()` hook or check `window.matchMedia('(prefers-reduced-motion: reduce)')` to disable/skip JS animations when users prefer reduced motion.

---

## Bug #37 -- Heading hierarchy skipped (h1 to h3)

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/ConsumerHeader.jsx`
**Line**: 156
**Code**: The header contains `<h1 className="logo-text-premium">PULSE</h1>`. Then the results bar in `App.jsx` line 1607 uses `<h2>`. But individual event cards use `<h3>` directly. In some modals, `<h1>` is used for the modal title, then `<h2>` for section titles. The modals' heading hierarchy may conflict with the page's heading hierarchy since modals are rendered in the same DOM.
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Warning
**Fix**: Ensure headings within modals are appropriate for modal context (typically `<h2>` as the modal title), and that the page's heading hierarchy remains intact. Consider using `aria-level` to override visual heading levels in modals.

---

## Bug #38 -- Back button in Messages chat view missing aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/MessagesModal.jsx`
**Line**: 81-83
**Code**:
```jsx
<button className="back-btn" onClick={() => setCurrentConversation(null)}>
  <ChevronLeft size={20} />
</button>
```
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `aria-label="Back to conversations"`.

---

## Bug #39 -- Verified badge tooltip uses data-tooltip without accessible alternative

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/EventCard.jsx`
**Lines**: 154-160
**Code**:
```jsx
<div
  className="verified-badge-premium-inline"
  onClick={(e) => e.stopPropagation()}
  data-tooltip="Verified"
>
  <Check size={12} strokeWidth={3} />
</div>
```
Same in `DealsGrid.jsx` line 107-113. The `data-tooltip` attribute is a custom attribute rendered via CSS `:hover::after` pseudo-element, which is invisible to screen readers and keyboard users.
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `aria-label="Verified business"` and `role="img"` to the verified badge div, or add `<span className="sr-only">Verified</span>` (visually hidden text).

---

## Bug #40 -- Admin dashboard search input missing aria-label

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/AdminDashboard.jsx`
**Line**: 516
**Code**:
```jsx
<input type="text" placeholder="Search venues..." value={adminSearchQuery} onChange={(e) => setAdminSearchQuery(e.target.value)} />
```
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Minor
**Fix**: Add `aria-label="Search venues"`.

---

## Bug #41 -- Admin quick-add form inputs missing label associations

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/AdminDashboard.jsx`
**Lines**: 618-647
**Code**:
```jsx
<input type="text" placeholder="e.g. Hot Yoga Flow" value={quickAddForm.title} ... />
...
<input type="time" value={quickAddForm.startTime} ... />
...
<input type="text" placeholder="$20" value={quickAddForm.price} ... />
```
These inputs rely on placeholder text only, with no `<label>` or `aria-label`.
**WCAG**: 1.3.1 Info and Relationships (Level A)
**Severity**: Minor
**Fix**: Add `aria-label` attributes or visible `<label>` elements.

---

## Bug #42 -- Calendar action buttons in MyCalendarModal missing aria-labels

**File**: `/Users/jeffkirdeikis/Desktop/pulse-app/src/components/modals/MyCalendarModal.jsx`
**Lines**: 89-100
**Code**:
```jsx
<a
  href={generateGoogleCalendarUrl(event)}
  target="_blank"
  rel="noopener noreferrer"
  className="calendar-action-btn google"
  title="Open in Google Calendar"
>
  <ExternalLink size={16} />
</a>
<button
  className="calendar-action-btn remove"
  onClick={() => removeFromCalendar(event.id)}
```
The Google Calendar link has a `title` but no `aria-label`. The remove button has neither `title` nor `aria-label`. Both contain only icon content.
**WCAG**: 4.1.2 Name, Role, Value (Level A)
**Severity**: Minor
**Fix**: Add `aria-label="Open in Google Calendar"` to the link and `aria-label="Remove from calendar"` to the remove button.

---

## Positive Findings (Already Implemented)

1. **Skip-to-content link** exists in `App.jsx` line 1545 with proper show-on-focus behavior.
2. **`<main>` landmark** used correctly at `App.jsx` line 1604 with `id="main-content"`.
3. **`<nav>` landmark** used in `ConsumerHeader.jsx` line 200 with `aria-label`.
4. **`<header>` landmark** used in `ConsumerHeader.jsx` line 127.
5. **`<footer>` landmark** used in `App.jsx` line 2335 with `role="contentinfo"`.
6. **`lang="en"`** set on `<html>` in `index.html`.
7. **`aria-live="polite"`** on results count (`App.jsx` line 1607).
8. **`aria-live="assertive"`** on toast notifications (`App.jsx` line 1819).
9. **`role="alert"`** on offline banner (`ConsumerHeader.jsx` line 193), toast, and auth error messages.
10. **`role="dialog"` and `aria-modal="true"`** on all modal overlays.
11. **`aria-label`** on all modals' overlay elements.
12. **`role="tablist"`** and `role="tab"` with `aria-selected` on navigation tabs and date strip.
13. **`prefers-reduced-motion`** CSS media query disabling CSS animations.
14. **ESC key** closes all modals via global keydown handler.
15. **`aria-label`** on search input, filter dropdowns, share/save buttons, clear buttons.
16. **`role="button"`**, `tabIndex={0}`, and keyboard handlers on EventCard, DealsGrid cards, and ServicesGrid cards.
17. **`aria-invalid`** used on AuthModal form inputs for validation state.

---

## Summary

42 accessibility bugs were found across the codebase. The most critical issues are:

1. **Missing aria-labels on icon-only buttons** (header messages/notifications buttons, modal close buttons) -- prevents screen reader users from understanding button purpose.
2. **No focus management for modals** (no focus trap, no focus-on-open, no focus-return-on-close) -- this is the single highest-impact accessibility failure, affecting ALL 15+ modals.
3. **Clickable divs without role/tabIndex/keyboard handlers** (conversations, notifications, related deals, provider headers) -- makes these elements completely inaccessible to keyboard-only users.
4. **Form inputs without label associations** (most form fields across AuthModal, ClaimBusinessModal, EditEventModal, EditVenueModal, ProfileModal settings, AdminDashboard) -- screen readers cannot identify what each input is for.
5. **Color contrast failures** (#9ca3af on white throughout the app) -- affects readability for low-vision users.
6. **Framer Motion animations not respecting prefers-reduced-motion** -- JS animations continue even when users have requested reduced motion.
