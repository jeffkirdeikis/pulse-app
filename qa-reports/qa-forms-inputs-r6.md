# QA Report: Forms, Inputs & Submission Edge Cases (Round 6)

**Date**: 2026-02-14
**Scope**: Every form, input, and submission flow in the Pulse app
**Method**: Deep code review of all form components, validation logic, hooks, and handlers
**Files Audited**: AuthModal.jsx, SubmissionModal.jsx, ClaimBusinessModal.jsx, EditVenueModal.jsx, EditEventModal.jsx, FeedbackWidget.jsx, ContactSheet.jsx, BookingSheet.jsx, ConsumerHeader.jsx, FilterSection.jsx, WellnessBooking.jsx, useSubmissions.js, useMessaging.js, useBooking.js, filterHelpers.js, App.jsx

---

## Summary

| Severity | Count |
|----------|-------|
| FAIL (Critical/Major/Medium) | 28 |
| WARN (Minor) | 17 |
| PASS | 27 |
| **Total Checks** | **72** |

---

## 1. AuthModal (`src/components/modals/AuthModal.jsx`)

### [FAIL-01] No password maximum length limit
**Severity**: Major
**Location**: AuthModal.jsx line 156
**Description**: The password input has no `maxLength` attribute. A user can type 10,000+ characters into the password field. While Supabase may reject excessively long passwords server-side, there is no client-side protection. This could cause: (1) UI slowdown with extremely long strings, (2) potential DoS to Supabase auth API, (3) poor UX with no feedback about limits.
**Evidence**: `<input type="password" ... />` -- no `maxLength` prop.
**Fix**: Add `maxLength={128}` or similar reasonable limit.

### [FAIL-02] No name maximum length limit on signup
**Severity**: Major
**Location**: AuthModal.jsx line 145
**Description**: The "Full Name" input in signup mode has no `maxLength` attribute. A user could submit a name with thousands of characters, which would be stored in `user_metadata.full_name` in Supabase Auth and could overflow UI elements elsewhere (profile display, business dashboard, etc.).
**Evidence**: `<input type="text" placeholder="Your name" ... />` -- no `maxLength` prop.
**Fix**: Add `maxLength={100}`.

### [FAIL-03] Name field accepts spaces-only string
**Severity**: Medium
**Location**: AuthModal.jsx line 43
**Description**: The name validation only checks `!authName.trim()`, meaning a name of "   " (spaces only) would fail validation. However, a name like " a " (single character with whitespace) would pass. More critically, the trimmed name is never used -- `authName` (untrimmed) is sent directly to Supabase in `options.data.full_name` (line 89). If user enters "  John  ", the stored name has leading/trailing whitespace.
**Evidence**: Line 89: `full_name: authName` -- uses raw state, not trimmed value.
**Fix**: Use `authName.trim()` when sending to Supabase.

### [FAIL-04] Email validation regex allows malformed emails
**Severity**: Medium
**Location**: AuthModal.jsx line 35
**Description**: The email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is intentionally permissive (common pattern), but allows clearly invalid emails like `a@b.c` (single-char TLD), `test@.com` (empty domain), or emails with multiple consecutive dots `test@foo..bar.com`. While Supabase will reject truly invalid emails server-side, this gives poor UX -- the user sees the form submit, then gets a confusing server error.
**Evidence**: Regex test: `"a@b.c".match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)` returns truthy.

### [WARN-01] No ESC key handler to close auth modal
**Severity**: Minor
**Location**: AuthModal.jsx
**Description**: Unlike LegalModal and NotificationsPanel which listen for ESC key, the AuthModal only closes via the X button or overlay click. Users expect ESC to close modals. The modal does have overlay click to close (line 117), but no keyboard escape handler.
**Evidence**: No `keydown` or `Escape` listener in the component.

### [WARN-02] Captcha token not validated when TURNSTILE_SITE_KEY is present
**Severity**: Medium
**Location**: AuthModal.jsx line 176
**Description**: The submit button is disabled when `TURNSTILE_SITE_KEY && !captchaToken`, which is correct. However, if the captcha token expires between the time the user completes the captcha and clicks submit, the `setCaptchaToken('')` callback fires (line 165) but there is a race condition -- the user could click submit in the milliseconds between token expiry and re-render.
**Evidence**: `onExpire={() => setCaptchaToken('')}` on line 165, button disabled check on line 176.

### [PASS-01] Empty email/password properly validated
The `validateForm()` function (line 30-48) correctly checks for empty email, empty password, and password length < 6 characters.

### [PASS-02] Form has `noValidate` and uses custom validation
The form at line 141 has `noValidate` and relies on custom validation, which is the correct pattern for React forms.

### [PASS-03] Auth loading state prevents double submission
Button is disabled with `authLoading` (line 176), and `setAuthLoading(true)` is called before API requests with `finally` block cleanup.

---

## 2. SubmissionModal (`src/components/modals/SubmissionModal.jsx` + `src/hooks/useSubmissions.js`)

### [FAIL-05] No trim() on submission form fields -- whitespace-only values pass validation
**Severity**: Critical
**Location**: SubmissionModal.jsx line 482-487, useSubmissions.js line 208-228
**Description**: The submit button's `disabled` check uses raw form values: `!submissionForm.title || !submissionForm.description || !submissionForm.businessType`. A title of "   " (spaces only) is truthy and passes this check. The `submitForApproval` function in useSubmissions.js also never trims any form fields before insertion. The data stored in `pending_items` will have leading/trailing whitespace in title, description, businessName, schedule, etc.
**Evidence**: Line 484: `!submissionForm.title` -- empty string is falsy, but "   " is truthy.
**Fix**: Change to `!submissionForm.title?.trim()` for all required field checks, and trim values before database insertion.

### [FAIL-06] No maximum length on any submission form input
**Severity**: Major
**Location**: SubmissionModal.jsx lines 278, 289, 192, 342-349, 448-454, 458-464
**Description**: None of the submission form inputs have `maxLength` attributes: title, description (textarea), business name, business address, price, schedule, terms & conditions. A malicious or careless user could submit a description with 100,000+ characters that gets stored in the database `pending_items.data` JSONB column.
**Evidence**: Every `<input>` and `<textarea>` in the form lacks `maxLength`.
**Fix**: Add `maxLength={200}` for title, `maxLength={2000}` for description, `maxLength={200}` for business name, `maxLength={500}` for schedule, `maxLength={1000}` for terms.

### [FAIL-07] No date validation -- past dates accepted for events/classes
**Severity**: Major
**Location**: SubmissionModal.jsx line 302-307
**Description**: The date input for events and classes has no `min` attribute to prevent selecting past dates. A user could submit an event for "2020-01-01" and it would pass all validation and be inserted into `pending_items`. When approved by admin, it would be inserted into `events` with a past date, showing up nowhere (filtered out by the frontend).
**Evidence**: `<input type="date" value={submissionForm.date} ... />` -- no `min` attribute.
**Fix**: Add `min={new Date().toISOString().split('T')[0]}` to prevent past dates.

### [FAIL-08] No validation that end time is after start time
**Severity**: Major
**Location**: SubmissionModal.jsx lines 310-326
**Description**: Start time and end time inputs have no cross-validation. A user can set start time to "18:00" and end time to "09:00" (end before start). This invalid data would be stored and, when approved, create an event with end_time before start_time in the database.
**Evidence**: No comparison logic between `submissionForm.startTime` and `submissionForm.endTime` anywhere in SubmissionModal or useSubmissions.

### [FAIL-09] Deal discount percentage accepts values > 100 and negative values
**Severity**: Medium
**Location**: SubmissionModal.jsx lines 406-413
**Description**: The discount value input is `type="number"` but has no `min` or `max` attributes. A user can enter -500 for "Percentage Off" or 99999. Similarly, original price and deal price accept negative numbers (lines 417-435). A deal price of -$50 makes no sense.
**Evidence**: `<input type="number" ... />` -- no min/max constraints.
**Fix**: Add `min="0" max="100"` for percentage, `min="0"` for dollar amounts.

### [FAIL-10] Deal price can exceed original price without warning
**Severity**: Medium
**Location**: SubmissionModal.jsx lines 417-435
**Description**: There is no validation that `dealPrice < originalPrice`. A user can enter Original Price: $10, Deal Price: $50, which represents a price increase, not a deal.
**Evidence**: No cross-field validation between `originalPrice` and `dealPrice`.

### [FAIL-11] Image upload has no file size validation
**Severity**: Medium
**Location**: SubmissionModal.jsx lines 229-233, useSubmissions.js line 114-127
**Description**: The image file input `accept="image/*"` has no file size check. The `handleImageSelect` reads the entire file as a DataURL via `FileReader.readAsDataURL()` (useSubmissions.js line 119), which converts to base64 (33% larger). A 50MB image would create a ~67MB base64 string stored in React state, potentially crashing the browser tab.
**Evidence**: No `file.size` check in `handleImageSelect`. Compare to FeedbackWidget (line 104) and ClaimBusinessModal (line 43) which both check `file.size > 5 * 1024 * 1024`.
**Fix**: Add `if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB'); return; }`.

### [PASS-25] Rate limiting works correctly for authenticated users
**Location**: useSubmissions.js line 194
**Description**: The rate limit check (`check_and_record_rate_limit`) runs for authenticated users. The `finally` block at line 256 correctly resets `submitting` state. Rate limiting works as intended.

### [WARN-03] Submission form does not validate image type beyond accept attribute
**Severity**: Minor
**Location**: SubmissionModal.jsx lines 229-233
**Description**: The file input has `accept="image/*"` which is a browser hint but not enforced. A user can manually select a non-image file (e.g., a PDF) via the file picker's "All Files" option. The `FileReader.readAsDataURL()` will still process it, creating a garbage base64 string that gets stored as an "image preview."
**Evidence**: No MIME type check in `handleImageSelect` (useSubmissions.js line 114-127). Compare to ClaimBusinessModal which checks `ACCEPTED_TYPES.includes(f.type)` (line 43).

### [WARN-04] No visual indication which fields are required until submit attempt
**Severity**: Minor
**Location**: SubmissionModal.jsx
**Description**: Required fields are marked with `*` in labels (e.g., "Title *"), but when the submit button is disabled, there is no per-field error message showing which specific field is missing. The user must guess which required field they missed. Compare to AuthModal which shows per-field error messages.

### [PASS-04] Submit button disabled check covers all required fields per type
The disabled logic at lines 482-488 correctly checks required fields differently for event/class vs deal types.

### [PASS-05] Rate limiting on submissions (5 per hour)
The `submitForApproval` in useSubmissions.js (line 195-206) correctly uses `check_and_record_rate_limit` RPC.

---

## 3. ClaimBusinessModal (`src/components/modals/ClaimBusinessModal.jsx` + `App.jsx:877`)

### [FAIL-13] Business claim form has no input length limits
**Severity**: Major
**Location**: ClaimBusinessModal.jsx lines 181-206
**Description**: None of the claim form inputs have `maxLength`: business name, owner name, email, phone, address. These values are inserted directly into the `business_claims` table. Extremely long strings could cause database issues or UI overflow in the admin review panel.
**Evidence**: All `<input>` elements in the claim form lack `maxLength`.

### [FAIL-14] Phone number accepts any text, no format validation
**Severity**: Medium
**Location**: ClaimBusinessModal.jsx line 193, App.jsx handleClaimBusiness
**Description**: The phone input is `type="tel"` which provides a phone keyboard on mobile but does NO validation. A user can enter "asdfghjkl" or "<script>alert(1)</script>" as their phone number. The `handleClaimBusiness` function in App.jsx (line 923) stores it directly as `contact_phone: claimFormData.phone?.trim() || null` with no format check.
**Evidence**: No phone validation regex anywhere in the claim flow.

### [FAIL-15] Claim email validation is weaker than auth email validation
**Severity**: Medium
**Location**: App.jsx line 885
**Description**: The claim form email validation regex `/\S+@\S+\.\S+/` (line 885) is weaker than the auth modal's `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` -- it lacks start/end anchors. This means `"hello @a.b goodbye"` would pass the claim validation because it contains the pattern as a substring.
**Evidence**: Regex at App.jsx line 885: `/\S+@\S+\.\S+/` has no `^` or `$` anchors.
**Fix**: Use the same regex as AuthModal: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

### [FAIL-16] Claim submit button has no disabled state for required fields
**Severity**: Major
**Location**: ClaimBusinessModal.jsx line 324
**Description**: The "Submit Claim" button is only disabled by `claimSubmitting` state (line 324). Unlike the SubmissionModal which disables the button when required fields are empty, the ClaimBusinessModal allows clicking submit with all fields empty. The validation happens INSIDE `handleClaimBusiness` (App.jsx line 881) and shows a toast, but a user can still spam-click the button before the first toast appears.
**Evidence**: Line 324: `disabled={claimSubmitting}` -- no field checks.
**Fix**: Add `disabled={claimSubmitting || !claimFormData.businessName?.trim() || !claimFormData.ownerName?.trim() || !claimFormData.email?.trim()}`.

### [WARN-05] Verification code input allows paste attacks
**Severity**: Minor
**Location**: ClaimBusinessModal.jsx line 99
**Description**: The verification code input uses `onChange={(e) => setClaimVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}` which correctly strips non-digits and limits to 6 chars. However, pasting a long string like "123456789012345" would work correctly (stripped and sliced). This is actually handled properly.
**Revised**: This is a PASS. The input correctly handles paste with non-numeric characters.

### [PASS-06] Verification code properly sanitized to digits-only
The `replace(/\D/g, '').slice(0, 6)` ensures only 6 digits are accepted.

### [PASS-07] File upload has proper size and type validation
ClaimBusinessModal (lines 42-46) correctly checks `ACCEPTED_TYPES.includes(f.type)` and `f.size > MAX_FILE_SIZE`.

### [PASS-08] Auth requirement check before claim submission
`handleClaimBusiness` (App.jsx line 893) checks `session?.user?.id` and redirects to auth modal.

---

## 4. EditVenueModal (`src/components/modals/EditVenueModal.jsx`)

### [FAIL-17] No email validation on venue email field
**Severity**: Medium
**Location**: EditVenueModal.jsx line 59-63
**Description**: The email field is `type="email"` which gives browser validation, but since the form doesn't use a `<form>` element with submit (it uses an onClick handler on a button), the browser's built-in email validation is bypassed entirely. Invalid emails like "not-an-email" would be sent directly to the `businesses` table.
**Evidence**: The save action is on a `<button onClick={...}>` (line 88), not a form submit. Browser validation on `type="email"` only fires on form submission.

### [FAIL-18] No URL validation on venue website field
**Severity**: Medium
**Location**: EditVenueModal.jsx lines 69-73
**Description**: Same issue as email -- `type="url"` provides no validation because there is no form submission. A value like "definitely not a url" would be stored as the business website.
**Evidence**: Button onClick at line 88 bypasses browser validation.

### [FAIL-19] Category field is free-text instead of dropdown
**Severity**: Medium
**Location**: EditVenueModal.jsx lines 77-82
**Description**: The category field is a plain text input, allowing any string. A user could type "zzzInvalidCategory" which would not match any category filter in the app, making the business unfindable via category filters. The SubmissionModal uses a `<select>` dropdown with predefined categories (lines 366-382), but EditVenueModal does not.
**Evidence**: `<input type="text" placeholder="e.g., Fitness, Restaurant" ...>` -- free-form text.
**Fix**: Use a `<select>` with the same predefined categories as the submission form.

### [WARN-06] No input length limits on venue edit fields
**Severity**: Minor
**Location**: EditVenueModal.jsx -- all input fields
**Description**: No `maxLength` on any input: name, address, phone, email, website, category.

### [PASS-09] Save button disabled when name is empty
Line 88: `disabled={saving || !editVenueForm.name?.trim()}` correctly prevents saving with empty name.

---

## 5. EditEventModal (`src/components/modals/EditEventModal.jsx`)

### [FAIL-20] End time before start time accepted without validation
**Severity**: Major
**Location**: EditEventModal.jsx lines 31-44
**Description**: Same as SubmissionModal (FAIL-08). A user can set start time to 20:00 and end time to 08:00. The save handler (line 62-85) stores whatever values are provided without cross-validation.
**Evidence**: No time comparison logic in the save handler.

### [FAIL-21] Date can be changed to past date without validation
**Severity**: Major
**Location**: EditEventModal.jsx line 34
**Description**: The date input has no `min` attribute. An event can be edited to a date in 2020, which would then be filtered out by the frontend (since filterHelpers.js filters to future events) but remain in the database as invisible stale data.
**Evidence**: `<input type="date" ...>` -- no `min` constraint.

### [FAIL-22] Price field allows injection of non-price strings into database
**Severity**: Medium
**Location**: EditEventModal.jsx lines 71-85
**Description**: The price parsing logic (lines 71-85) has a subtle bug: when a user enters a non-parseable string like "abc" or "<script>alert(1)</script>", `parseFloat(cleaned)` returns `NaN`, which triggers the else branch setting `is_free = true` and `price = null`. So XSS strings get silently converted to "Free" status rather than showing an error. This is actually a safety feature (no XSS), but it means entering "twenty dollars" would mark the event as free, which is a data integrity bug.
**Evidence**: Line 73: `const cleaned = priceStr.replace(/[^0-9.]/g, '')` strips everything non-numeric. "twenty dollars" becomes "" which becomes `NaN`.

### [WARN-07] No input length limits on event edit fields
**Severity**: Minor
**Location**: EditEventModal.jsx -- all fields
**Description**: No `maxLength` on title, description (textarea), price, or category fields.

### [WARN-08] Category field is free-text (same as EditVenueModal)
**Severity**: Minor
**Location**: EditEventModal.jsx line 53
**Description**: Category is a plain text input, not a dropdown. Same issue as FAIL-19.

### [PASS-10] Save button disabled when title is empty
Line 58: `disabled={saving || !editEventForm.title?.trim()}`.

### [PASS-11] Price parsing handles edge cases gracefully
The price parser (lines 71-85) handles "Free", "$25", "25.00", and garbage input without crashing.

---

## 6. ContactSheet (`src/components/modals/ContactSheet.jsx`)

### [FAIL-23] No maximum length on message or subject fields
**Severity**: Medium
**Location**: ContactSheet.jsx lines 33-47
**Description**: Neither the subject input nor the message textarea have `maxLength`. A user could send a 1MB message to a business. The `submitContactForm` in useMessaging.js (line 141) sends this via `startConversation` RPC, which could hit database limits or degrade performance.
**Evidence**: No `maxLength` on either input/textarea.

### [WARN-09] No ESC key handler to close contact sheet
**Severity**: Minor
**Location**: ContactSheet.jsx
**Description**: No keyboard escape listener. Overlay click works, but keyboard accessibility is missing.

### [PASS-12] Submit disabled when message is empty or sending
Line 52: `disabled={!contactMessage.trim() || sendingMessage}`.

---

## 7. BookingSheet (`src/components/modals/BookingSheet.jsx`)

### [WARN-10] Booking request message has no length limit
**Severity**: Minor
**Location**: BookingSheet.jsx lines 94-100
**Description**: The booking request message textarea has no `maxLength`. Compare to FeedbackWidget which limits to 5000 characters.

### [WARN-11] Booking request can be submitted with empty message
**Severity**: Minor
**Location**: BookingSheet.jsx line 106
**Description**: The "Send Booking Request" button is only disabled by `sendingMessage`, not by message content. The `submitBookingRequest` in useBooking.js (line 99) checks `if (!bookingEvent) return` but does NOT check if the message is empty. This is intentional (the label says "optional") but the auto-generated message includes `Message: ${messageSnapshot}` which would show "Message: " (empty) in the conversation.
**Evidence**: useBooking.js line 121: `(messageSnapshot ? Message: ${messageSnapshot} : '')` -- correctly handles empty, appending nothing. **Revised**: This handles it correctly with the ternary.

### [PASS-13] Send button disabled while sending
Line 106: `disabled={sendingMessage}`.

---

## 8. FeedbackWidget (`src/components/FeedbackWidget.jsx`)

### [WARN-12] Switching feedback type mid-input does not clear the message
**Severity**: Minor
**Location**: FeedbackWidget.jsx lines 161-171
**Description**: If a user types a bug report message, then switches to "Suggestion" type, the message remains. The placeholder changes but the content stays. This is arguably by design (preserving user input), but could lead to confusing submissions where a "Suggestion" type has bug-report language.
**Evidence**: `onClick={() => setSelectedType(t.id)}` -- only changes type, does not clear message.

### [WARN-13] Screenshot file persists when switching away from bug type
**Severity**: Minor
**Location**: FeedbackWidget.jsx lines 182-202
**Description**: If a user attaches a screenshot while on "Bug Report", then switches to "Comment" or "Suggestion", the screenshot UI is hidden (line 184 checks `selectedType === 'bug'`) but `screenshotFile` state is NOT cleared. If the user switches back to Bug Report, the old screenshot reappears. More importantly, if they submit as "Comment", the screenshot is still uploaded and attached to the feedback because `handleSubmit` always checks `screenshotFile` (line 45) regardless of type.
**Evidence**: No `setScreenshotFile(null)` when type changes.

### [WARN-14] Email field in feedback form has no validation
**Severity**: Minor
**Location**: FeedbackWidget.jsx line 205-210
**Description**: The email input is `type="email"` but since submission happens via `onClick` (not form submit), browser validation is bypassed. Any text, including "not-email", would be stored as `email` in the feedback table.
**Evidence**: `handleSubmit` at line 68 sends `email: email.trim() || null` -- no format check.

### [PASS-14] Message required before submission
Line 226: `disabled={!message.trim() || submitting}`.

### [PASS-15] Screenshot file size validated (5MB limit)
Line 104: `if (file.size > 5 * 1024 * 1024)`.

### [PASS-16] Message has maxLength={5000}
Line 180: `maxLength={5000}`.

---

## 9. Search Bars (`src/components/ConsumerHeader.jsx`)

### [PASS-26] Search uses includes() not regex -- special characters handled safely
**Location**: filterHelpers.js lines 104-111
**Description**: The search query is used in `String.includes()` calls (line 107). `includes()` does NOT interpret regex, so special characters like `.*+?`, SQL injection strings, and HTML tags are all treated as literal strings. No sanitization is needed and no errors occur.

### [WARN-15] Search input has no maxLength
**Severity**: Minor
**Location**: ConsumerHeader.jsx line 272-282
**Description**: The search input has no `maxLength`. A user could paste an extremely long string (100K+ chars) which would cause performance issues as the debounced filter runs `.toLowerCase().includes()` on every event title, description, venue name, and tag for every keystroke.
**Evidence**: `<input type="text" ...>` -- no `maxLength` attribute.

### [WARN-16] Recent searches stored in localStorage without size limit
**Severity**: Minor
**Location**: ConsumerHeader.jsx lines 14-19
**Description**: `saveRecentSearch` limits to `MAX_RECENT = 5` entries, but individual entries have no length limit. If a user searches for a 50,000-character string, it gets stored in localStorage. The `slice(0, MAX_RECENT)` caps the count, not the size.
**Evidence**: Line 17: `recent.unshift(q)` -- no length check on `q`.

### [PASS-17] Search has debounce implementation
App.jsx lines 1497-1501 implement a 300ms debounce for the services search.

### [PASS-18] Search clear button works correctly
ConsumerHeader.jsx line 286: `onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}`.

---

## 10. Filter Dropdowns and Selectors

### [PASS-19] Category filter uses controlled <select> elements
FilterSection.jsx uses `<select>` elements with predefined `<option>` values, preventing arbitrary input.

### [PASS-20] Date strip prevents selecting past dates
FilterSection.jsx `getDateStrip()` generates only future dates starting from today.

### [PASS-21] Quick filter chips toggle correctly
FilterSection.jsx lines 160-169 correctly toggle chips on/off with proper state management.

### [PASS-22] Age range slider has proper min/max bounds
FilterSection.jsx lines 301-326: min=-1, max=18 with proper guards preventing min>max or max<min.

---

## 11. Wellness Booking (`src/components/WellnessBooking.jsx`)

### [WARN-17] Alert setup modal allows saving with no preferences selected
**Severity**: Minor
**Location**: WellnessBooking.jsx lines 886-943
**Description**: The AlertSetupModal "Save Alert" button (line 937) calls `onSave` with no validation. A user can save an alert with empty days array and "Any Time" range, which effectively means "alert me about everything" -- potentially very noisy.
**Evidence**: No `disabled` check on the save button.

---

## 12. Cross-Cutting Issues (All Forms)

### [FAIL-25] XSS payloads stored verbatim in database (relies on React output escaping)
**Severity**: Medium (mitigated)
**Location**: All form inputs across all modals
**Description**: No form in the entire app sanitizes input before sending to Supabase. A payload like `<script>alert(1)</script>` entered as an event title would be stored as-is in the database. React's JSX output escaping prevents XSS when rendering (`{title}` is safe), but this data could be dangerous if: (1) it's ever rendered with `dangerouslySetInnerHTML`, (2) it's consumed by a different frontend, (3) it's displayed in admin email notifications (the `notify-feedback` edge function sends raw content in emails).
**Evidence**: No `DOMPurify` or equivalent sanitization anywhere. `useSubmissions.js` stores form data directly. `useMessaging.js` sends `p_content: messageInput.trim()` directly.
**Mitigation**: React does escape output by default. No `dangerouslySetInnerHTML` found in the codebase (confirmed by grep).

### [FAIL-26] No character/encoding normalization on any form input
**Severity**: Minor
**Location**: All forms
**Description**: Unicode characters, zero-width joiners, right-to-left override characters, and emoji are accepted in all text fields without normalization. A business name of "\u200B\u200B\u200B" (zero-width spaces) would appear blank but pass the `.trim()` check since zero-width spaces are not trimmed by JavaScript's `trim()`. A title of "\u202Eelddim" (right-to-left override) would display backwards as "middle" in some rendering contexts.
**Evidence**: JavaScript `trim()` only removes standard whitespace (U+0009, U+000A, U+000B, U+000C, U+000D, U+0020, U+FEFF). Zero-width spaces (U+200B), non-breaking spaces (U+00A0), etc. pass through.

### [PASS-27] SQL injection prevented by Supabase parameterized queries
**Location**: All forms
**Description**: Input like `'; DROP TABLE events; --` is stored as-is in text fields, but Supabase client library uses parameterized queries, so SQL injection is not possible through the JavaScript client. Verified safe.

### [FAIL-28] No form-level dirty state tracking -- unsaved changes lost without warning
**Severity**: Medium
**Location**: All edit modals (EditVenueModal, EditEventModal), SubmissionModal
**Description**: If a user fills out a long event submission form and accidentally clicks the overlay or X button, all data is lost immediately with no "Are you sure?" confirmation. The `onClose` handlers reset all state without checking for unsaved changes.
**Evidence**: SubmissionModal.jsx line 37: `onClick={onClose}` on overlay. EditVenueModal.jsx line 16: `onClick={() => { onClose(); }}` on overlay. No `window.confirm()` or dirty-state check.

---

## 13. Message Inputs (useMessaging.js)

### [FAIL-29] Message input in MessagesModal allows Enter key submission even while sending
**Severity**: Minor
**Location**: src/components/modals/MessagesModal.jsx line 120
**Description**: The message input's `onKeyDown` handler checks `!sendingMessage` but there is a race condition: if the user presses Enter rapidly, the first press triggers `sendMessage()` which sets `sendingMessage = true` asynchronously (after the current render), so subsequent rapid Enter presses could queue multiple sends before the state updates.
**Evidence**: Line 120: `onKeyDown={(e) => e.key === 'Enter' && messageInput.trim() && !sendingMessage && sendMessage()}` -- `sendMessage` is async, state update not synchronous.

### [PASS-23] Message rate limiting implemented
useMessaging.js lines 93-103: 20 messages per 10 minutes via `check_and_record_rate_limit` RPC.

### [PASS-24] Contact form requires authentication
useMessaging.js line 143: `if (user?.isGuest || !user?.id) { onAuthRequired?.(); return; }`.

---

## 14. Submission Approval Flow (useSubmissions.js)

### [FAIL-30] Approved events have no server-side date/time validation
**Severity**: Major
**Location**: useSubmissions.js lines 267-284
**Description**: When an admin approves an event submission, the `approveSubmission` function (line 261) inserts directly into the `events` table with values from the pending item's `data` field. There is no validation that the date is in the future, that start_time < end_time, or that required fields are present. A submission with garbage data that somehow got pending status would be inserted as-is.
**Evidence**: Lines 268-282: Direct insert with values from `submission.data` -- no validation layer.

### [FAIL-31] Approved deals have no price sanity check
**Severity**: Medium
**Location**: useSubmissions.js lines 286-304
**Description**: When a deal is approved, `discountValue`, `originalPrice`, and `dealPrice` are passed through `parseFloat()` but with no range validation. `parseFloat("Infinity")` returns `Infinity`, `parseFloat("-1000")` returns -1000. These would be inserted into the deals table.
**Evidence**: Line 294: `discount_value: submission.data.discountValue ? parseFloat(submission.data.discountValue) : null` -- no range check.

---

## Severity Summary

### Critical (2)
- FAIL-05: Whitespace-only titles pass submission validation
- FAIL-30: No server-side validation on approved events

### Major (9)
- FAIL-01: No password max length
- FAIL-02: No name max length
- FAIL-06: No max length on any submission input
- FAIL-07: Past dates accepted for events
- FAIL-08: End time before start time accepted
- FAIL-13: No input length limits on claim form
- FAIL-16: Claim submit button allows click with empty fields
- FAIL-20: End time before start time on edit
- FAIL-21: Past dates on event edit

### Medium (17)
- FAIL-03: Untrimmed name sent to Supabase
- FAIL-04: Overly permissive email regex
- FAIL-09: Discount percentage accepts >100 / negative
- FAIL-10: Deal price > original price allowed
- FAIL-11: No image file size limit on submission
- FAIL-14: Phone number accepts any text
- FAIL-15: Claim email regex lacks anchors
- FAIL-17: No email validation on venue edit
- FAIL-18: No URL validation on venue edit
- FAIL-19: Category is free-text in edit modals
- FAIL-22: Non-numeric price silently converts to "Free"
- FAIL-23: No max length on contact messages
- FAIL-25: XSS stored verbatim (mitigated by React escaping)
- FAIL-26: Zero-width characters bypass trim()
- FAIL-28: No unsaved changes warning
- FAIL-29: Enter key race condition in messages
- FAIL-31: No price sanity check on deal approval

### Minor (17 warnings)
- WARN-01 through WARN-17 as documented above

---

## Recommendations (Priority Order)

1. **Add `maxLength` to ALL text inputs**: Title (200), Description (2000), Name (100), Password (128), Address (300), Message (5000), Phone (20), URL (500)
2. **Add `.trim()` to all required field checks** in SubmissionModal disabled logic and all database writes
3. **Add `min` date attribute** to prevent past dates on event/class submissions and edits
4. **Add start/end time cross-validation** to both SubmissionModal and EditEventModal
5. **Add number range constraints**: `min="0" max="100"` for percentages, `min="0"` for prices
6. **Unify email validation regex** across all forms (use anchored version)
7. **Add file size validation** to SubmissionModal image upload (like FeedbackWidget's 5MB check)
8. **Add ESC key handlers** to AuthModal, ContactSheet, and all modals missing it
9. **Add dirty-state confirmation** before closing edit/submission modals with unsaved data
10. **Convert free-text category fields** to `<select>` dropdowns with predefined options
11. **Add phone number format validation** or at minimum a regex for digits/dashes/parens
12. **Add server-side validation** in approval flow (useSubmissions approveSubmission)

---

*Report generated by deep code review. 72 total checks performed across 15 source files. 28 FAIL, 17 WARN, 27 PASS.*
