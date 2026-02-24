# Pulse App QA — Screenshot Gallery

**Test run:** 2026-02-23
**Total automated screenshots:** 370
**Total manual screenshots:** 1

Screenshots are stored in `/Users/jeffkirdeikis/pulse-app/tests/screenshots/`

## Legend

| Icon | Meaning |
|------|---------|
| PASS | Test passed — screenshot shows successful state |
| FAIL | Test failed — screenshot shows failure state |
| FAIL(R) | Retry attempt failure screenshot |
| SKIP | Test was skipped — screenshot shows skipped state |

---

## Account Setup (Actions 1–10)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | 1-M: Auth modal opens when profile button is clicked | `screenshots/01-account-setup-Action-1--958aa-n-profile-button-is-clicked-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 1-M: Auth modal opens when profile button is clicked | `screenshots/01-account-setup-Action-1--958aa-n-profile-button-is-clicked-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 1-M: Sign-up mode activates when "Sign Up" link is clicked | `screenshots/01-account-setup-Action-1--2dca9-hen-Sign-Up-link-is-clicked-desktop-chrome/test-finished-1.png` |
| PASS | 1-M: Google OAuth button is present and visible | `screenshots/01-account-setup-Action-1--eddfe-tton-is-present-and-visible-desktop-chrome/test-finished-1.png` |
| PASS | 1-M: Forgot password link switches to reset mode | `screenshots/01-account-setup-Action-1--7d113-link-switches-to-reset-mode-desktop-chrome/test-finished-1.png` |
| FAIL | 1-S: Validation errors shown for empty form submission | `screenshots/01-account-setup-Action-1--03e55-n-for-empty-form-submission-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 1-S: Validation errors shown for empty form submission | `screenshots/01-account-setup-Action-1--03e55-n-for-empty-form-submission-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 1-S: Validation error shown for invalid email format | `screenshots/01-account-setup-Action-1--598ba-wn-for-invalid-email-format-desktop-chrome/test-finished-1.png` |
| PASS | 1-S: Validation error shown for short password (< 6 chars) | `screenshots/01-account-setup-Action-1--e8517-for-short-password-6-chars--desktop-chrome/test-finished-1.png` |
| PASS | 1-S: Modal closes when overlay is clicked | `screenshots/01-account-setup-Action-1--b4351-ses-when-overlay-is-clicked-desktop-chrome/test-finished-1.png` |
| PASS | 1-S: Modal closes when X button is clicked | `screenshots/01-account-setup-Action-1--e5e70-es-when-X-button-is-clicked-desktop-chrome/test-finished-1.png` |
| PASS | 1-E: XSS payloads in email field do not execute | `screenshots/01-account-setup-Action-1--95a39--email-field-do-not-execute-desktop-chrome/test-finished-1.png` |
| PASS | 1-E: Very long email input is capped at maxLength=254 | `screenshots/01-account-setup-Action-1--7f799--is-capped-at-maxLength-254-desktop-chrome/test-finished-1.png` |
| PASS | 1-E: Signup with name field — XSS payload is not executed | `screenshots/01-account-setup-Action-1--bca95-XSS-payload-is-not-executed-desktop-chrome/test-finished-1.png` |
| FAIL | 1-E: Terms of Service and Privacy Policy links are present and open legal modal | `screenshots/01-account-setup-Action-1--b0637-resent-and-open-legal-modal-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 1-E: Terms of Service and Privacy Policy links are present and open legal modal | `screenshots/01-account-setup-Action-1--b0637-resent-and-open-legal-modal-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 2-M: Auth modal shows verification prompt copy after signup attempt | `screenshots/01-account-setup-Action-2--10769-t-copy-after-signup-attempt-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 2-M: Auth modal shows verification prompt copy after signup attempt | `screenshots/01-account-setup-Action-2--10769-t-copy-after-signup-attempt-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 2-M: ClaimBusinessModal verification step shows 6-digit code input | `screenshots/01-account-setup-Action-2--d3b19-ep-shows-6-digit-code-input-desktop-chrome/test-finished-1.png` |
| SKIP | 3-M: Logo upload area is present in business dashboard header | `screenshots/01-account-setup-Action-3--5f4f5-n-business-dashboard-header-desktop-chrome/test-finished-1.png` |
| SKIP | 3-M: Hidden file input for logo upload exists and accepts image/* | `screenshots/01-account-setup-Action-3--2ae0a-d-exists-and-accepts-image--desktop-chrome/test-finished-1.png` |
| SKIP | 3-S: Logo upload rejects SVG files (security guard) | `screenshots/01-account-setup-Action-3--7fe74-s-SVG-files-security-guard--desktop-chrome/test-finished-1.png` |
| SKIP | 3-S: Logo upload area is keyboard accessible (Enter key) | `screenshots/01-account-setup-Action-3--27c56-board-accessible-Enter-key--desktop-chrome/test-finished-1.png` |
| FAIL | 4-PARTIAL: SubmissionModal has description field for events/classes/deals | `screenshots/01-account-setup-Action-4--1888a-ld-for-events-classes-deals-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 4-PARTIAL: SubmissionModal has description field for events/classes/deals | `screenshots/01-account-setup-Action-4--1888a-ld-for-events-classes-deals-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | 5-M: Category field exists in EditVenueModal | `screenshots/01-account-setup-Action-5--56960-ld-exists-in-EditVenueModal-desktop-chrome/test-finished-1.png` |
| SKIP | 5-M: Category input accepts typing and retains value | `screenshots/01-account-setup-Action-5--25c27-ts-typing-and-retains-value-desktop-chrome/test-finished-1.png` |
| SKIP | 5-S: Category input is capped at maxLength=100 | `screenshots/01-account-setup-Action-5--c5d1f--is-capped-at-maxLength-100-desktop-chrome/test-finished-1.png` |
| SKIP | 5-E: XSS payload in category is not executed | `screenshots/01-account-setup-Action-5--5e666-in-category-is-not-executed-desktop-chrome/test-finished-1.png` |
| SKIP | 5-E: Category with emoji characters is accepted | `screenshots/01-account-setup-Action-5--5f78a-moji-characters-is-accepted-desktop-chrome/test-finished-1.png` |
| SKIP | 6-M: Address input is present in EditVenueModal | `screenshots/01-account-setup-Action-6--29247-s-present-in-EditVenueModal-desktop-chrome/test-finished-1.png` |
| SKIP | 6-M: Address input accepts a typical Squamish address | `screenshots/01-account-setup-Action-6--34801--a-typical-Squamish-address-desktop-chrome/test-finished-1.png` |
| SKIP | 6-S: Address capped at maxLength=300 | `screenshots/01-account-setup-Action-6--1316b-ess-capped-at-maxLength-300-desktop-chrome/test-finished-1.png` |
| SKIP | 6-E: XSS in address field is not executed | `screenshots/01-account-setup-Action-6--01675-dress-field-is-not-executed-desktop-chrome/test-finished-1.png` |
| SKIP | 6-E: Special characters in address are accepted | `screenshots/01-account-setup-Action-6--e4169-ers-in-address-are-accepted-desktop-chrome/test-finished-1.png` |
| SKIP | 7-M: Phone input is type="tel" in EditVenueModal | `screenshots/01-account-setup-Action-7--4e3a6--type-tel-in-EditVenueModal-desktop-chrome/test-finished-1.png` |
| SKIP | 7-M: Phone input accepts Canadian phone format | `screenshots/01-account-setup-Action-7--156ea-cepts-Canadian-phone-format-desktop-chrome/test-finished-1.png` |
| SKIP | 7-S: Phone capped at maxLength=20 | `screenshots/01-account-setup-Action-7--f3aeb-hone-capped-at-maxLength-20-desktop-chrome/test-finished-1.png` |
| SKIP | 7-E: Phone field with SQL injection string does not crash the form | `screenshots/01-account-setup-Action-7--81174-ing-does-not-crash-the-form-desktop-chrome/test-finished-1.png` |
| SKIP | 8-M: Website input is type="url" in EditVenueModal | `screenshots/01-account-setup-Action-8--1228f--type-url-in-EditVenueModal-desktop-chrome/test-finished-1.png` |
| SKIP | 8-M: Website input accepts a valid https URL | `screenshots/01-account-setup-Action-8--e7256-t-accepts-a-valid-https-URL-desktop-chrome/test-finished-1.png` |
| SKIP | 8-S: Website capped at maxLength=500 | `screenshots/01-account-setup-Action-8--86aa5-ite-capped-at-maxLength-500-desktop-chrome/test-finished-1.png` |
| SKIP | 8-E: XSS in website field is not executed | `screenshots/01-account-setup-Action-8--fb6aa-bsite-field-is-not-executed-desktop-chrome/test-finished-1.png` |
| SKIP | 8-E: Cancel button closes EditVenueModal without saving | `screenshots/01-account-setup-Action-8--45c12-itVenueModal-without-saving-desktop-chrome/test-finished-1.png` |

---

## Listing Management (Actions 11–25)

| Status | Test | File Path |
|--------|------|-----------|
| SKIP | 11-M: Business name field present in EditVenueModal | `screenshots/02-listing-management-Acti-d259b-d-present-in-EditVenueModal-desktop-chrome/test-finished-1.png` |
| SKIP | 11-M: Venue name field accepts typing and retains value | `screenshots/02-listing-management-Acti-dc734-ts-typing-and-retains-value-desktop-chrome/test-finished-1.png` |
| SKIP | 11-M: Save Changes button is disabled when name is empty | `screenshots/02-listing-management-Acti-8d17d-disabled-when-name-is-empty-desktop-chrome/test-finished-1.png` |
| SKIP | 11-M: Event title field present in EditEventModal | `screenshots/02-listing-management-Acti-41a71-d-present-in-EditEventModal-desktop-chrome/test-finished-1.png` |
| SKIP | 11-S: Venue name capped at maxLength=200 | `screenshots/02-listing-management-Acti-4a7a3-ame-capped-at-maxLength-200-desktop-chrome/test-finished-1.png` |
| SKIP | 11-E: XSS in venue name field is not executed | `screenshots/02-listing-management-Acti-3f30a--name-field-is-not-executed-desktop-chrome/test-finished-1.png` |
| SKIP | 11-E: Unicode / emoji in venue name is accepted | `screenshots/02-listing-management-Acti-82eb9-i-in-venue-name-is-accepted-desktop-chrome/test-finished-1.png` |
| FAIL | 12-M: Square and banner image upload areas present in SubmissionModal | `screenshots/02-listing-management-Acti-66895--present-in-SubmissionModal-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 12-M: Square and banner image upload areas present in SubmissionModal | `screenshots/02-listing-management-Acti-66895--present-in-SubmissionModal-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 12-M: Square image upload area shows ratio label "1:1" | `screenshots/02-listing-management-Acti-cc439-area-shows-ratio-label-1-1--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 12-M: Square image upload area shows ratio label "1:1" | `screenshots/02-listing-management-Acti-cc439-area-shows-ratio-label-1-1--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 12-M: Hidden file inputs exist inside upload areas | `screenshots/02-listing-management-Acti-c99fb-s-exist-inside-upload-areas-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 12-M: Hidden file inputs exist inside upload areas | `screenshots/02-listing-management-Acti-c99fb-s-exist-inside-upload-areas-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | 16-M: Price field is present in EditEventModal | `screenshots/02-listing-management-Acti-6ff2f-s-present-in-EditEventModal-desktop-chrome/test-finished-1.png` |
| SKIP | 16-M: Price field accepts free-text format | `screenshots/02-listing-management-Acti-b02e8-ld-accepts-free-text-format-desktop-chrome/test-finished-1.png` |
| SKIP | 16-M: Price field with "Free" keyword accepted | `screenshots/02-listing-management-Acti-bca63--with-Free-keyword-accepted-desktop-chrome/test-finished-1.png` |
| FAIL | 16-M: SubmissionModal deal form has originalPrice and dealPrice fields | `screenshots/02-listing-management-Acti-3a685-lPrice-and-dealPrice-fields-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 16-M: SubmissionModal deal form has originalPrice and dealPrice fields | `screenshots/02-listing-management-Acti-3a685-lPrice-and-dealPrice-fields-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | 18-M: "Boost Visibility" Upgrade button shows "coming soon" info toast | `screenshots/02-listing-management-Acti-4bffe-hows-coming-soon-info-toast-desktop-chrome/test-finished-1.png` |
| SKIP | 22-M: Business owner can see their active listings in the dashboard table | `screenshots/02-listing-management-Acti-4fd52-ings-in-the-dashboard-table-desktop-chrome/test-finished-1.png` |
| SKIP | 22-M: Listings table shows listing name, type, status columns | `screenshots/02-listing-management-Acti-f5005-ng-name-type-status-columns-desktop-chrome/test-finished-1.png` |
| FAIL | 23-M: Claim Business modal opens from business dashboard when no business is cla... | `screenshots/02-listing-management-Acti-fde0e-when-no-business-is-claimed-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 23-M: Claim Business modal opens from business dashboard when no business is cla... | `screenshots/02-listing-management-Acti-fde0e-when-no-business-is-claimed-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 23-M: Claim modal shows sign-in prompt for unauthenticated users | `screenshots/02-listing-management-Acti-b671f-t-for-unauthenticated-users-desktop-chrome/test-finished-1.png` |
| PASS | 23-M: Claim form has required fields: Business Name, Your Name, Email | `screenshots/02-listing-management-Acti-d3018-siness-Name-Your-Name-Email-desktop-chrome/test-finished-1.png` |
| PASS | 23-M: Business search input shows dropdown results when >= 2 chars typed | `screenshots/02-listing-management-Acti-a204e--results-when-2-chars-typed-desktop-chrome/test-finished-1.png` |
| PASS | 23-M: Verification method selector has Email Code and Upload Documents options | `screenshots/02-listing-management-Acti-3ea0c-nd-Upload-Documents-options-desktop-chrome/test-finished-1.png` |
| PASS | 23-M: Selecting "Upload Documents" shows file upload area | `screenshots/02-listing-management-Acti-96dd5-ents-shows-file-upload-area-desktop-chrome/test-finished-1.png` |
| PASS | 23-M: Submit button disabled when required fields are empty | `screenshots/02-listing-management-Acti-e761e-n-required-fields-are-empty-desktop-chrome/test-finished-1.png` |
| PASS | 23-S: Claim form validation — submit enabled only when name + owner + email fill... | `screenshots/02-listing-management-Acti-5491f-hen-name-owner-email-filled-desktop-chrome/test-finished-1.png` |
| PASS | 23-S: Closing the claim modal with X button works | `screenshots/02-listing-management-Acti-f3152-m-modal-with-X-button-works-desktop-chrome/test-finished-1.png` |
| PASS | 23-S: Claim modal closes when overlay is clicked | `screenshots/02-listing-management-Acti-98969-ses-when-overlay-is-clicked-desktop-chrome/test-finished-1.png` |
| PASS | 23-E: XSS in claim business name field is not executed | `screenshots/02-listing-management-Acti-8dd26--name-field-is-not-executed-desktop-chrome/test-finished-1.png` |
| PASS | 23-E: Document upload rejects non-image and non-PDF file types | `screenshots/02-listing-management-Acti-2c237-mage-and-non-PDF-file-types-desktop-chrome/test-finished-1.png` |
| SKIP | 25-M: Delete button is present in listings table for each row | `screenshots/02-listing-management-Acti-885e4-listings-table-for-each-row-desktop-chrome/test-finished-1.png` |
| SKIP | 25-M: Clicking delete shows browser confirm dialog | `screenshots/02-listing-management-Acti-0d41e-hows-browser-confirm-dialog-desktop-chrome/test-finished-1.png` |
| SKIP | 25-M: Edit button is present for event-type listings | `screenshots/02-listing-management-Acti-13e16-ent-for-event-type-listings-desktop-chrome/test-finished-1.png` |
| SKIP | 25-S: Deal rows have delete but no edit button | `screenshots/02-listing-management-Acti-09cf6-e-delete-but-no-edit-button-desktop-chrome/test-finished-1.png` |
| SKIP | 25-E: Cancelling delete confirm dialog leaves listing intact | `screenshots/02-listing-management-Acti-a0ff6-ialog-leaves-listing-intact-desktop-chrome/test-finished-1.png` |

---

## Deals / Promotions (Actions 26–35)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | 26-M: FeedbackWidget "Add Content" button opens SubmissionModal | `screenshots/03-deals-promotions-Action-d7e15-utton-opens-SubmissionModal-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: FeedbackWidget "Add Content" button opens SubmissionModal | `screenshots/03-deals-promotions-Action-d7e15-utton-opens-SubmissionModal-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: SubmissionModal type selection screen shows Deal card | `screenshots/03-deals-promotions-Action-14d2c-tion-screen-shows-Deal-card-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: SubmissionModal type selection screen shows Deal card | `screenshots/03-deals-promotions-Action-14d2c-tion-screen-shows-Deal-card-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: All deal-specific form fields are present | `screenshots/03-deals-promotions-Action-dcc09-fic-form-fields-are-present-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: All deal-specific form fields are present | `screenshots/03-deals-promotions-Action-dcc09-fic-form-fields-are-present-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: Host selector shows options: My Businesses (if any), New Business, Communi... | `screenshots/03-deals-promotions-Action-f841f-w-Business-Community-Member-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: Host selector shows options: My Businesses (if any), New Business, Communi... | `screenshots/03-deals-promotions-Action-f841f-w-Business-Community-Member-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: Submit button is disabled until required fields are filled | `screenshots/03-deals-promotions-Action-2d37d--required-fields-are-filled-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: Submit button is disabled until required fields are filled | `screenshots/03-deals-promotions-Action-2d37d--required-fields-are-filled-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: Submit button enables after filling all required deal fields | `screenshots/03-deals-promotions-Action-d89b2-ng-all-required-deal-fields-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: Submit button enables after filling all required deal fields | `screenshots/03-deals-promotions-Action-d89b2-ng-all-required-deal-fields-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: Successful submission advances to step 3 success screen | `screenshots/03-deals-promotions-Action-33936-es-to-step-3-success-screen-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: Successful submission advances to step 3 success screen | `screenshots/03-deals-promotions-Action-33936-es-to-step-3-success-screen-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: Success screen shows submitted deal title and type | `screenshots/03-deals-promotions-Action-a403b-bmitted-deal-title-and-type-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: Success screen shows submitted deal title and type | `screenshots/03-deals-promotions-Action-a403b-bmitted-deal-title-and-type-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-M: Done button closes the SubmissionModal after success | `screenshots/03-deals-promotions-Action-5f5c3-bmissionModal-after-success-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-M: Done button closes the SubmissionModal after success | `screenshots/03-deals-promotions-Action-5f5c3-bmissionModal-after-success-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | 26-M: BusinessDashboard Quick Actions "New Deal" button also opens deal form | `screenshots/03-deals-promotions-Action-8514a-button-also-opens-deal-form-desktop-chrome/test-finished-1.png` |
| FAIL | 26-S: Back button returns from deal form to type selection | `screenshots/03-deals-promotions-Action-0da6d-deal-form-to-type-selection-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-S: Back button returns from deal form to type selection | `screenshots/03-deals-promotions-Action-0da6d-deal-form-to-type-selection-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-S: Closing modal via X button during form entry does not submit | `screenshots/03-deals-promotions-Action-7a293--form-entry-does-not-submit-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-S: Closing modal via X button during form entry does not submit | `screenshots/03-deals-promotions-Action-7a293--form-entry-does-not-submit-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-S: Closing modal via overlay click does not submit | `screenshots/03-deals-promotions-Action-1cdb5-erlay-click-does-not-submit-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-S: Closing modal via overlay click does not submit | `screenshots/03-deals-promotions-Action-1cdb5-erlay-click-does-not-submit-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-E: XSS in deal title is not executed | `screenshots/03-deals-promotions-Action-eee51--deal-title-is-not-executed-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-E: XSS in deal title is not executed | `screenshots/03-deals-promotions-Action-eee51--deal-title-is-not-executed-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-E: XSS in deal description is not executed | `screenshots/03-deals-promotions-Action-32931-description-is-not-executed-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-E: XSS in deal description is not executed | `screenshots/03-deals-promotions-Action-32931-description-is-not-executed-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-E: Very long title is capped at maxLength=200 | `screenshots/03-deals-promotions-Action-0f35b--is-capped-at-maxLength-200-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-E: Very long title is capped at maxLength=200 | `screenshots/03-deals-promotions-Action-0f35b--is-capped-at-maxLength-200-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-E: Deal with emoji in title is accepted | `screenshots/03-deals-promotions-Action-d0827--emoji-in-title-is-accepted-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-E: Deal with emoji in title is accepted | `screenshots/03-deals-promotions-Action-d0827--emoji-in-title-is-accepted-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 26-E: Selecting "New Business" host shows business name + address fields | `screenshots/03-deals-promotions-Action-e09b3-usiness-name-address-fields-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 26-E: Selecting "New Business" host shows business name + address fields | `screenshots/03-deals-promotions-Action-e09b3-usiness-name-address-fields-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-M: Valid Until date input is present in deal form | `screenshots/03-deals-promotions-Action-db606-put-is-present-in-deal-form-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-M: Valid Until date input is present in deal form | `screenshots/03-deals-promotions-Action-db606-put-is-present-in-deal-form-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-M: Valid Until field has min date set to today (no past dates) | `screenshots/03-deals-promotions-Action-9a570-set-to-today-no-past-dates--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-M: Valid Until field has min date set to today (no past dates) | `screenshots/03-deals-promotions-Action-9a570-set-to-today-no-past-dates--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-M: Valid Until field accepts a future date | `screenshots/03-deals-promotions-Action-15cc3-field-accepts-a-future-date-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-M: Valid Until field accepts a future date | `screenshots/03-deals-promotions-Action-15cc3-field-accepts-a-future-date-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-M: Valid Until field is optional — deal submits without it | `screenshots/03-deals-promotions-Action-02243-l-—-deal-submits-without-it-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-M: Valid Until field is optional — deal submits without it | `screenshots/03-deals-promotions-Action-02243-l-—-deal-submits-without-it-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-S: Deal with an expiry date 1 year out saves successfully | `screenshots/03-deals-promotions-Action-39560-year-out-saves-successfully-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-S: Deal with an expiry date 1 year out saves successfully | `screenshots/03-deals-promotions-Action-39560-year-out-saves-successfully-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-S: Schedule field is required for deal submission | `screenshots/03-deals-promotions-Action-aa53c-equired-for-deal-submission-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-S: Schedule field is required for deal submission | `screenshots/03-deals-promotions-Action-aa53c-equired-for-deal-submission-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-E: Schedule field with special characters is accepted | `screenshots/03-deals-promotions-Action-74248-cial-characters-is-accepted-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-E: Schedule field with special characters is accepted | `screenshots/03-deals-promotions-Action-74248-cial-characters-is-accepted-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 27-E: Schedule capped at maxLength=200 | `screenshots/03-deals-promotions-Action-7ca18-ule-capped-at-maxLength-200-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 27-E: Schedule capped at maxLength=200 | `screenshots/03-deals-promotions-Action-7ca18-ule-capped-at-maxLength-200-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | 29-M: Deal rows in listings table have no edit button (confirmed NOT built) | `screenshots/03-deals-promotions-Action-a8665-button-confirmed-NOT-built--desktop-chrome/test-finished-1.png` |
| SKIP | 31-M: Delete button is present on deal rows in listings table | `screenshots/03-deals-promotions-Action-c0702-deal-rows-in-listings-table-desktop-chrome/test-finished-1.png` |
| SKIP | 31-M: Clicking delete deal shows browser confirm dialog with deal name | `screenshots/03-deals-promotions-Action-d09cf-nfirm-dialog-with-deal-name-desktop-chrome/test-finished-1.png` |
| SKIP | 31-S: Cancelling delete leaves deal row intact | `screenshots/03-deals-promotions-Action-73bf2-lete-leaves-deal-row-intact-desktop-chrome/test-finished-1.png` |
| PASS | 32-M: DealsGrid tab is accessible from consumer view | `screenshots/03-deals-promotions-Action-26102-cessible-from-consumer-view-desktop-chrome/test-finished-1.png` |
| SKIP | 32-M: BusinessDashboard shows no per-deal stats row in listings table | `screenshots/03-deals-promotions-Action-d10a5-stats-row-in-listings-table-desktop-chrome/test-finished-1.png` |
| FAIL | DT-M: Default discount type is "Percentage Off" | `screenshots/03-deals-promotions-Deal-D-dce17-unt-type-is-Percentage-Off--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-M: Default discount type is "Percentage Off" | `screenshots/03-deals-promotions-Deal-D-dce17-unt-type-is-Percentage-Off--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-M: Selecting "Percentage Off" shows discount percentage number input | `screenshots/03-deals-promotions-Deal-D-4c727-unt-percentage-number-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-M: Selecting "Percentage Off" shows discount percentage number input | `screenshots/03-deals-promotions-Deal-D-4c727-unt-percentage-number-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-M: Selecting "Dollar Amount Off" shows dollar amount number input | `screenshots/03-deals-promotions-Deal-D-7ce6c--dollar-amount-number-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-M: Selecting "Dollar Amount Off" shows dollar amount number input | `screenshots/03-deals-promotions-Deal-D-7ce6c--dollar-amount-number-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-M: Selecting "Buy One Get One" hides the discount value input | `screenshots/03-deals-promotions-Deal-D-d9429-es-the-discount-value-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-M: Selecting "Buy One Get One" hides the discount value input | `screenshots/03-deals-promotions-Deal-D-d9429-es-the-discount-value-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-M: Selecting "Free Item" hides the discount value input | `screenshots/03-deals-promotions-Deal-D-9ea93-es-the-discount-value-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-M: Selecting "Free Item" hides the discount value input | `screenshots/03-deals-promotions-Deal-D-9ea93-es-the-discount-value-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-S: Entering 100 as percentage value is accepted | `screenshots/03-deals-promotions-Deal-D-6cd83-ercentage-value-is-accepted-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-S: Entering 100 as percentage value is accepted | `screenshots/03-deals-promotions-Deal-D-6cd83-ercentage-value-is-accepted-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-S: Terms & Conditions textarea accepts up to maxLength=2000 | `screenshots/03-deals-promotions-Deal-D-9f8f6-ccepts-up-to-maxLength-2000-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-S: Terms & Conditions textarea accepts up to maxLength=2000 | `screenshots/03-deals-promotions-Deal-D-9f8f6-ccepts-up-to-maxLength-2000-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-E: XSS in terms & conditions field is not executed | `screenshots/03-deals-promotions-Deal-D-7e7a0-tions-field-is-not-executed-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-E: XSS in terms & conditions field is not executed | `screenshots/03-deals-promotions-Deal-D-7e7a0-tions-field-is-not-executed-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | DT-E: Original and deal price fields accept decimal values | `screenshots/03-deals-promotions-Deal-D-22592-ields-accept-decimal-values-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DT-E: Original and deal price fields accept decimal values | `screenshots/03-deals-promotions-Deal-D-22592-ields-accept-decimal-values-desktop-chrome-retry1/test-failed-1.png` |

---

## Events / Classes (Actions 36–48)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | 36.1 — Add Content button is visible in consumer view | `screenshots/04-events-classes-Action-3-21d61-is-visible-in-consumer-view-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 36.1 — Add Content button is visible in consumer view | `screenshots/04-events-classes-Action-3-21d61-is-visible-in-consumer-view-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 36.2 — SubmissionModal opens when Add Content is clicked | `screenshots/04-events-classes-Action-3-b98d9-when-Add-Content-is-clicked-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 36.2 — SubmissionModal opens when Add Content is clicked | `screenshots/04-events-classes-Action-3-b98d9-when-Add-Content-is-clicked-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 36.3 — Event type can be selected inside SubmissionModal | `screenshots/04-events-classes-Action-3-b5513-cted-inside-SubmissionModal-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 36.3 — Event type can be selected inside SubmissionModal | `screenshots/04-events-classes-Action-3-b5513-cted-inside-SubmissionModal-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 36.4 — Event form fields are present (title, description, date, times, price, ca... | `screenshots/04-events-classes-Action-3-5c705--date-times-price-category--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 36.4 — Event form fields are present (title, description, date, times, price, ca... | `screenshots/04-events-classes-Action-3-5c705--date-times-price-category--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 36.5 — Submitting event form routes to pending_items (form submits without error... | `screenshots/04-events-classes-Action-3-76e7c-form-submits-without-error--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 36.5 — Submitting event form routes to pending_items (form submits without error... | `screenshots/04-events-classes-Action-3-76e7c-form-submits-without-error--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 36.6 — SubmissionModal can be closed without submitting | `screenshots/04-events-classes-Action-3-cc7ae-e-closed-without-submitting-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 36.6 — SubmissionModal can be closed without submitting | `screenshots/04-events-classes-Action-3-cc7ae-e-closed-without-submitting-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 37.1 — Class type can be selected in SubmissionModal | `screenshots/04-events-classes-Action-3-c69e7-selected-in-SubmissionModal-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 37.1 — Class type can be selected in SubmissionModal | `screenshots/04-events-classes-Action-3-c69e7-selected-in-SubmissionModal-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 37.2 — Class form accepts title and description input | `screenshots/04-events-classes-Action-3-5ba4d-title-and-description-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 37.2 — Class form accepts title and description input | `screenshots/04-events-classes-Action-3-5ba4d-title-and-description-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 37.3 — Event and Class types share the same SubmissionModal form | `screenshots/04-events-classes-Action-3-ce931-e-same-SubmissionModal-form-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 37.3 — Event and Class types share the same SubmissionModal form | `screenshots/04-events-classes-Action-3-ce931-e-same-SubmissionModal-form-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 38.1 — SubmissionModal has date field for events | `screenshots/04-events-classes-Action-3-6a3b0-l-has-date-field-for-events-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 38.1 — SubmissionModal has date field for events | `screenshots/04-events-classes-Action-3-6a3b0-l-has-date-field-for-events-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 38.2 — SubmissionModal has start time and end time fields | `screenshots/04-events-classes-Action-3-51594-rt-time-and-end-time-fields-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 38.2 — SubmissionModal has start time and end time fields | `screenshots/04-events-classes-Action-3-51594-rt-time-and-end-time-fields-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 38.3 — Date field accepts a valid date | `screenshots/04-events-classes-Action-3-acba1--field-accepts-a-valid-date-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 38.3 — Date field accepts a valid date | `screenshots/04-events-classes-Action-3-acba1--field-accepts-a-valid-date-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 38.4 — Start and end time fields accept valid times | `screenshots/04-events-classes-Action-3-503d4-e-fields-accept-valid-times-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 38.4 — Start and end time fields accept valid times | `screenshots/04-events-classes-Action-3-503d4-e-fields-accept-valid-times-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 40.1 — Price field is present in event SubmissionModal | `screenshots/04-events-classes-Action-4-3684e-nt-in-event-SubmissionModal-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 40.1 — Price field is present in event SubmissionModal | `screenshots/04-events-classes-Action-4-3684e-nt-in-event-SubmissionModal-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 40.2 — Entering "free" or 0 is accepted as a price value | `screenshots/04-events-classes-Action-4-5f7bc-s-accepted-as-a-price-value-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 40.2 — Entering "free" or 0 is accepted as a price value | `screenshots/04-events-classes-Action-4-5f7bc-s-accepted-as-a-price-value-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 40.3 — Entering a numeric paid price is accepted | `screenshots/04-events-classes-Action-4-a6eb4-eric-paid-price-is-accepted-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 40.3 — Entering a numeric paid price is accepted | `screenshots/04-events-classes-Action-4-a6eb4-eric-paid-price-is-accepted-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 41.1 — Price field accepts decimal values (e.g. 19.99) | `screenshots/04-events-classes-Action-4-35e87-s-decimal-values-e-g-19-99--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 41.1 — Price field accepts decimal values (e.g. 19.99) | `screenshots/04-events-classes-Action-4-35e87-s-decimal-values-e-g-19-99--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 41.2 — Age group selector is present in event form | `screenshots/04-events-classes-Action-4-d3f61-or-is-present-in-event-form-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 41.2 — Age group selector is present in event form | `screenshots/04-events-classes-Action-4-d3f61-or-is-present-in-event-form-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 41.3 — Category selector is present in event form | `screenshots/04-events-classes-Action-4-4d137-or-is-present-in-event-form-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 41.3 — Category selector is present in event form | `screenshots/04-events-classes-Action-4-4d137-or-is-present-in-event-form-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 42.1 — Events tab loads and shows event cards | `screenshots/04-events-classes-Action-4-3c579-loads-and-shows-event-cards-desktop-chrome/test-finished-1.png` |
| PASS | 42.2 — Edit modal can be opened on an event (requires logged-in business/admin u... | `screenshots/04-events-classes-Action-4-d0f90-ged-in-business-admin-user--desktop-chrome/test-finished-1.png` |
| PASS | 42.3 — EditEventModal has title, description, date, time, price, category fields | `screenshots/04-events-classes-Action-4-76bad--time-price-category-fields-desktop-chrome/test-finished-1.png` |
| PASS | 43.1 — PARTIAL: Delete action exists on events (no cancel status) | `screenshots/04-events-classes-Action-4-282a4-on-events-no-cancel-status--desktop-chrome/test-finished-1.png` |
| FAIL | 46.1 — PARTIAL: Recurrence field exists in SubmissionModal for classes | `screenshots/04-events-classes-Action-4-41e72-SubmissionModal-for-classes-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 46.1 — PARTIAL: Recurrence field exists in SubmissionModal for classes | `screenshots/04-events-classes-Action-4-41e72-SubmissionModal-for-classes-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 46.2 — PARTIAL: Recurrence options include daily, weekly, monthly | `screenshots/04-events-classes-Action-4-eece2-nclude-daily-weekly-monthly-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 46.2 — PARTIAL: Recurrence options include daily, weekly, monthly | `screenshots/04-events-classes-Action-4-eece2-nclude-daily-weekly-monthly-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 48.1 — PARTIAL: Cover image field exists in SubmissionModal during event creatio... | `screenshots/04-events-classes-Action-4-f83a1-Modal-during-event-creation-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 48.1 — PARTIAL: Cover image field exists in SubmissionModal during event creatio... | `screenshots/04-events-classes-Action-4-f83a1-Modal-during-event-creation-desktop-chrome-retry1/test-failed-1.png` |

---

## Booking / Appointments (Actions 49–58)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | 53.1 — Business view is accessible after login | `screenshots/05-booking-appointments-Ac-754a1-w-is-accessible-after-login-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 53.1 — Business view is accessible after login | `screenshots/05-booking-appointments-Ac-754a1-w-is-accessible-after-login-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 53.2 — BusinessDashboard Inbox button is visible | `screenshots/05-booking-appointments-Ac-dd1a4-ard-Inbox-button-is-visible-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 53.2 — BusinessDashboard Inbox button is visible | `screenshots/05-booking-appointments-Ac-dd1a4-ard-Inbox-button-is-visible-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 53.3 — Inbox opens and shows Booking Requests tab | `screenshots/05-booking-appointments-Ac-6cab5--shows-Booking-Requests-tab-desktop-chrome/test-finished-1.png` |
| PASS | 53.4 — Booking Requests tab can be clicked and shows conversation list | `screenshots/05-booking-appointments-Ac-3724d-and-shows-conversation-list-desktop-chrome/test-finished-1.png` |
| PASS | 54.1 — Inbox shows Messages tab alongside Booking Requests | `screenshots/05-booking-appointments-Ac-224f7--alongside-Booking-Requests-desktop-chrome/test-finished-1.png` |
| PASS | 54.2 — Opening a conversation thread shows reply input | `screenshots/05-booking-appointments-Ac-434a1-on-thread-shows-reply-input-desktop-chrome/test-finished-1.png` |
| PASS | 54.3 — Resolve button is present on open conversation threads | `screenshots/05-booking-appointments-Ac-b08dc-n-open-conversation-threads-desktop-chrome/test-finished-1.png` |
| FAIL | 58.1 — BusinessDashboard Analytics section is accessible | `screenshots/05-booking-appointments-Ac-0e939-ytics-section-is-accessible-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 58.1 — BusinessDashboard Analytics section is accessible | `screenshots/05-booking-appointments-Ac-0e939-ytics-section-is-accessible-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 58.2 — PARTIAL: bookings_confirmed metric is displayed in Analytics | `screenshots/05-booking-appointments-Ac-fc5e8-c-is-displayed-in-Analytics-desktop-chrome/test-finished-1.png` |

---

## Customer Interaction (Actions 59–68)

| Status | Test | File Path |
|--------|------|-----------|
| PASS | 59.1 — ServiceDetailModal shows "Rating feature coming soon!" placeholder | `screenshots/06-customer-interaction-Ac-0927c-ure-coming-soon-placeholder-desktop-chrome/test-finished-2.png` |
| PASS | 59.1 — ServiceDetailModal shows "Rating feature coming soon!" placeholder | `screenshots/06-customer-interaction-Ac-0927c-ure-coming-soon-placeholder-desktop-chrome/test-finished-1.png` |
| PASS | 61.1 — App loads without console errors in consumer view | `screenshots/06-customer-interaction-Ac-a87b4-ole-errors-in-consumer-view-desktop-chrome/test-finished-1.png` |
| PASS | 61.2 — Contact / Message button is visible on business cards or detail modals | `screenshots/06-customer-interaction-Ac-c1432-ness-cards-or-detail-modals-desktop-chrome/test-finished-1.png` |
| PASS | 61.2 — Contact / Message button is visible on business cards or detail modals | `screenshots/06-customer-interaction-Ac-c1432-ness-cards-or-detail-modals-desktop-chrome/test-finished-2.png` |
| PASS | 61.3 — Clicking contact button opens a messaging UI or contact sheet | `screenshots/06-customer-interaction-Ac-215c5-ssaging-UI-or-contact-sheet-desktop-chrome/test-finished-1.png` |
| PASS | 61.3 — Clicking contact button opens a messaging UI or contact sheet | `screenshots/06-customer-interaction-Ac-215c5-ssaging-UI-or-contact-sheet-desktop-chrome/test-finished-2.png` |
| PASS | 61.4 — Messaging requires authentication (unauthenticated user sees login prompt... | `screenshots/06-customer-interaction-Ac-a8bc9-ted-user-sees-login-prompt--desktop-chrome/test-finished-1.png` |
| PASS | 61.4 — Messaging requires authentication (unauthenticated user sees login prompt... | `screenshots/06-customer-interaction-Ac-a8bc9-ted-user-sees-login-prompt--desktop-chrome/test-finished-2.png` |
| PASS | 61.5 — Logged-in user can type a message in the compose field | `screenshots/06-customer-interaction-Ac-1f23a-essage-in-the-compose-field-desktop-chrome/test-finished-1.png` |
| PASS | 61.5 — Logged-in user can type a message in the compose field | `screenshots/06-customer-interaction-Ac-1f23a-essage-in-the-compose-field-desktop-chrome/test-finished-2.png` |
| PASS | 61.6 — Message input rejects XSS payloads (rendered safely) | `screenshots/06-customer-interaction-Ac-4f879-S-payloads-rendered-safely--desktop-chrome/test-finished-1.png` |
| PASS | 61.6 — Message input rejects XSS payloads (rendered safely) | `screenshots/06-customer-interaction-Ac-4f879-S-payloads-rendered-safely--desktop-chrome/test-finished-2.png` |
| FAIL | 62.1 — Inbox is accessible from Business view | `screenshots/06-customer-interaction-Ac-b3972-cessible-from-Business-view-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 62.1 — Inbox is accessible from Business view | `screenshots/06-customer-interaction-Ac-b3972-cessible-from-Business-view-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | 62.2 — Inbox has two tabs: Booking Requests and Messages | `screenshots/06-customer-interaction-Ac-b965e-oking-Requests-and-Messages-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 62.2 — Inbox has two tabs: Booking Requests and Messages | `screenshots/06-customer-interaction-Ac-b965e-oking-Requests-and-Messages-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 62.3 — Messages tab shows conversation list or empty state | `screenshots/06-customer-interaction-Ac-7d4a0-rsation-list-or-empty-state-desktop-chrome/test-finished-1.png` |
| PASS | 62.4 — Conversation thread opens on click and shows message history | `screenshots/06-customer-interaction-Ac-e7175-k-and-shows-message-history-desktop-chrome/test-finished-1.png` |
| PASS | 62.5 — Reply input is functional in an open thread | `screenshots/06-customer-interaction-Ac-e16b4-unctional-in-an-open-thread-desktop-chrome/test-finished-1.png` |
| PASS | 62.6 — Resolve button is present on open conversation threads | `screenshots/06-customer-interaction-Ac-f6bab-n-open-conversation-threads-desktop-chrome/test-finished-1.png` |
| FAIL | 62.7 — Inbox renders without console errors | `screenshots/06-customer-interaction-Ac-790d4-ders-without-console-errors-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | 62.7 — Inbox renders without console errors | `screenshots/06-customer-interaction-Ac-790d4-ders-without-console-errors-desktop-chrome-retry1/test-failed-1.png` |
| PASS | 64.1 — Contact / inquiry form is accessible from a business card or detail modal | `screenshots/06-customer-interaction-Ac-8862e-siness-card-or-detail-modal-desktop-chrome/test-finished-1.png` |
| PASS | 64.1 — Contact / inquiry form is accessible from a business card or detail modal | `screenshots/06-customer-interaction-Ac-8862e-siness-card-or-detail-modal-desktop-chrome/test-finished-2.png` |
| PASS | 64.2 — Contact form opens as a sheet/modal with a message input | `screenshots/06-customer-interaction-Ac-277b0--modal-with-a-message-input-desktop-chrome/test-finished-1.png` |
| PASS | 64.2 — Contact form opens as a sheet/modal with a message input | `screenshots/06-customer-interaction-Ac-277b0--modal-with-a-message-input-desktop-chrome/test-finished-2.png` |
| PASS | 64.3 — Contact form message field accepts text input | `screenshots/06-customer-interaction-Ac-78f00-ge-field-accepts-text-input-desktop-chrome/test-finished-1.png` |
| PASS | 64.3 — Contact form message field accepts text input | `screenshots/06-customer-interaction-Ac-78f00-ge-field-accepts-text-input-desktop-chrome/test-finished-2.png` |
| PASS | 64.4 — Submitting contact form creates a "general" conversation (submitContactFo... | `screenshots/06-customer-interaction-Ac-f1cf9-ersation-submitContactForm--desktop-chrome/test-finished-1.png` |
| PASS | 64.4 — Submitting contact form creates a "general" conversation (submitContactFo... | `screenshots/06-customer-interaction-Ac-f1cf9-ersation-submitContactForm--desktop-chrome/test-finished-2.png` |
| PASS | 64.5 — Contact form rejects empty message submission | `screenshots/06-customer-interaction-Ac-5ff23-ts-empty-message-submission-desktop-chrome/test-finished-1.png` |
| PASS | 64.5 — Contact form rejects empty message submission | `screenshots/06-customer-interaction-Ac-5ff23-ts-empty-message-submission-desktop-chrome/test-finished-2.png` |
| PASS | 64.6 — Contact form XSS: message input renders malicious input safely | `screenshots/06-customer-interaction-Ac-abf5a-ders-malicious-input-safely-desktop-chrome/test-finished-1.png` |
| PASS | 64.6 — Contact form XSS: message input renders malicious input safely | `screenshots/06-customer-interaction-Ac-abf5a-ders-malicious-input-safely-desktop-chrome/test-finished-2.png` |

---

## Analytics (Actions 69–78)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | BusinessDashboard displays profile_views metric | `screenshots/07-analytics-Action-69-Pro-f3a93-splays-profile-views-metric-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | BusinessDashboard displays profile_views metric | `screenshots/07-analytics-Action-69-Pro-f3a93-splays-profile-views-metric-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Profile views shows 7-day bar chart or numerical data | `screenshots/07-analytics-Action-69-Pro-67ca3-bar-chart-or-numerical-data-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Profile views shows 7-day bar chart or numerical data | `screenshots/07-analytics-Action-69-Pro-67ca3-bar-chart-or-numerical-data-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Time period selector is visible (30/90/365/all options) | `screenshots/07-analytics-Action-69-Pro-71449-ible-30-90-365-all-options--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Time period selector is visible (30/90/365/all options) | `screenshots/07-analytics-Action-69-Pro-71449-ible-30-90-365-all-options--desktop-chrome-retry1/test-failed-1.png` |
| SKIP | Changing time period updates the displayed data | `screenshots/07-analytics-Action-69-Pro-b0f6f--updates-the-displayed-data-desktop-chrome/test-finished-1.png` |
| FAIL | DealDetailModal tracks and displays redemption count | `screenshots/07-analytics-Action-71-Dea-7ea37-d-displays-redemption-count-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | DealDetailModal tracks and displays redemption count | `screenshots/07-analytics-Action-71-Dea-7ea37-d-displays-redemption-count-desktop-chrome-retry1/test-failed-1.png` |
| PASS | PARTIAL — BusinessDashboard does NOT show deal redemption statistics | `screenshots/07-analytics-Action-71-Dea-4dd36--deal-redemption-statistics-desktop-chrome/test-finished-1.png` |
| FAIL | BusinessDashboard shows event_views and class_views metrics | `screenshots/07-analytics-Action-72-Eve-c125a-ews-and-class-views-metrics-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | BusinessDashboard shows event_views and class_views metrics | `screenshots/07-analytics-Action-72-Eve-c125a-ews-and-class-views-metrics-desktop-chrome-retry1/test-failed-1.png` |
| PASS | PARTIAL — No RSVP headcount shown in dashboard | `screenshots/07-analytics-Action-72-Eve-37a7d-eadcount-shown-in-dashboard-desktop-chrome/test-finished-1.png` |
| FAIL | BusinessDashboard shows booking_clicks metric | `screenshots/07-analytics-Action-73-Boo-1009e-shows-booking-clicks-metric-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | BusinessDashboard shows booking_clicks metric | `screenshots/07-analytics-Action-73-Boo-1009e-shows-booking-clicks-metric-desktop-chrome-retry1/test-failed-1.png` |
| PASS | BusinessDashboard shows bookings_confirmed metric | `screenshots/07-analytics-Action-73-Boo-70b2b-s-bookings-confirmed-metric-desktop-chrome/test-finished-1.png` |
| PASS | Booking conversion metrics are numeric values | `screenshots/07-analytics-Action-73-Boo-6b27b--metrics-are-numeric-values-desktop-chrome/test-finished-1.png` |
| FAIL | BusinessDashboard has a TXT export button | `screenshots/07-analytics-Action-77-Ana-764c7-ard-has-a-TXT-export-button-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | BusinessDashboard has a TXT export button | `screenshots/07-analytics-Action-77-Ana-764c7-ard-has-a-TXT-export-button-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | BusinessDashboard has a CSV export button | `screenshots/07-analytics-Action-77-Ana-ac2d8-ard-has-a-CSV-export-button-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | BusinessDashboard has a CSV export button | `screenshots/07-analytics-Action-77-Ana-ac2d8-ard-has-a-CSV-export-button-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | TXT export initiates a file download | `screenshots/07-analytics-Action-77-Ana-40c54-t-initiates-a-file-download-desktop-chrome/test-finished-1.png` |
| SKIP | CSV export initiates a file download | `screenshots/07-analytics-Action-77-Ana-3f04f-t-initiates-a-file-download-desktop-chrome/test-finished-1.png` |
| FAIL | Export report includes pulse score and analytics data | `screenshots/07-analytics-Action-77-Ana-bc52d-se-score-and-analytics-data-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Export report includes pulse score and analytics data | `screenshots/07-analytics-Action-77-Ana-bc52d-se-score-and-analytics-data-desktop-chrome-retry1/test-failed-1.png` |

---

## Notifications / Settings (Actions 79–88)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | ProfileModal Settings tab is accessible after login | `screenshots/08-notifications-settings--b8d98-b-is-accessible-after-login-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | ProfileModal Settings tab is accessible after login | `screenshots/08-notifications-settings--b8d98-b-is-accessible-after-login-desktop-chrome-retry1/test-failed-1.png` |
| SKIP | Settings tab has Event Reminders toggle | `screenshots/08-notifications-settings--f689c--has-Event-Reminders-toggle-desktop-chrome/test-finished-1.png` |
| SKIP | Settings tab has New Deals toggle | `screenshots/08-notifications-settings--81a57-gs-tab-has-New-Deals-toggle-desktop-chrome/test-finished-1.png` |
| SKIP | Settings tab has Weekly Digest toggle | `screenshots/08-notifications-settings--d8380-ab-has-Weekly-Digest-toggle-desktop-chrome/test-finished-1.png` |
| SKIP | Settings tab has Business Updates toggle | `screenshots/08-notifications-settings--e4040-has-Business-Updates-toggle-desktop-chrome/test-finished-1.png` |
| SKIP | Notification toggles are interactive (can be toggled on/off) | `screenshots/08-notifications-settings--40cdc-tive-can-be-toggled-on-off--desktop-chrome/test-finished-1.png` |
| PASS | PARTIAL — not all notification categories are implemented | `screenshots/08-notifications-settings--137ab--categories-are-implemented-desktop-chrome/test-finished-1.png` |

---

## Community Engagement (Actions 89–96)

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | BusinessDashboard shows Weekly Goals section with XP labels | `screenshots/09-community-engagement-Ac-f2ca6-oals-section-with-XP-labels-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | BusinessDashboard shows Weekly Goals section with XP labels | `screenshots/09-community-engagement-Ac-f2ca6-oals-section-with-XP-labels-desktop-chrome-retry1/test-failed-1.png` |
| PASS | XP goal labels show positive point values (e.g. +100, +75) | `screenshots/09-community-engagement-Ac-b7981-ve-point-values-e-g-100-75--desktop-chrome/test-finished-1.png` |
| PASS | Badges are displayed in BusinessDashboard (display-only) | `screenshots/09-community-engagement-Ac-74f23-nessDashboard-display-only--desktop-chrome/test-finished-1.png` |
| PASS | PARTIAL — XP and badges are display-only; no earning mechanism is interactive | `screenshots/09-community-engagement-Ac-bfc5a-ng-mechanism-is-interactive-desktop-chrome/test-finished-1.png` |

---

## Admin / Advanced (Actions 97–100)

| Status | Test | File Path |
|--------|------|-----------|
| SKIP | ProfileModal Settings has a Danger Zone section | `screenshots/10-admin-advanced-Action-9-0a8a3-s-has-a-Danger-Zone-section-desktop-chrome/test-finished-1.png` |
| SKIP | Danger Zone has a Delete Account button that shows a warning | `screenshots/10-admin-advanced-Action-9-de805-button-that-shows-a-warning-desktop-chrome/test-finished-1.png` |
| SKIP | Two-step deletion: requires typing "DELETE" to confirm | `screenshots/10-admin-advanced-Action-9-4f51e-es-typing-DELETE-to-confirm-desktop-chrome/test-finished-1.png` |
| SKIP | Cancelling the deletion flow does not delete the account | `screenshots/10-admin-advanced-Action-9-a5629-does-not-delete-the-account-desktop-chrome/test-finished-1.png` |

---

## Cross-Cutting Tests

| Status | Test | File Path |
|--------|------|-----------|
| FAIL | Guest visiting /: app loads without crash and shows consumer view | `screenshots/11-cross-cutting-Auth-Auth-3d489-ash-and-shows-consumer-view-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Guest visiting /: app loads without crash and shows consumer view | `screenshots/11-cross-cutting-Auth-Auth-3d489-ash-and-shows-consumer-view-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Guest clicking Business view sees "Sign In Required" (not dashboard) | `screenshots/11-cross-cutting-Auth-Auth-f8107--In-Required-not-dashboard--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Guest clicking Business view sees "Sign In Required" (not dashboard) | `screenshots/11-cross-cutting-Auth-Auth-f8107--In-Required-not-dashboard--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Guest clicking profile button sees auth modal (not profile menu) | `screenshots/11-cross-cutting-Auth-Auth-2e03c-uth-modal-not-profile-menu--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Guest clicking profile button sees auth modal (not profile menu) | `screenshots/11-cross-cutting-Auth-Auth-2e03c-uth-modal-not-profile-menu--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Guest attempting to redeem a deal is prompted to authenticate | `screenshots/11-cross-cutting-Auth-Auth-b4dec-is-prompted-to-authenticate-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Guest attempting to redeem a deal is prompted to authenticate | `screenshots/11-cross-cutting-Auth-Auth-b4dec-is-prompted-to-authenticate-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Admin view is not accessible to unauthenticated users | `screenshots/11-cross-cutting-Auth-Auth-cff31-le-to-unauthenticated-users-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Admin view is not accessible to unauthenticated users | `screenshots/11-cross-cutting-Auth-Auth-cff31-le-to-unauthenticated-users-desktop-chrome-retry1/test-failed-1.png` |
| PASS | Authenticated consumer cannot access owner-only dashboard controls | `screenshots/11-cross-cutting-Auth-Auth-21e9d-ner-only-dashboard-controls-desktop-chrome/test-finished-1.png` |
| FAIL | Homepage renders without overflow at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-43f84-verflow-at-iPhone-SE-375px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Homepage renders without overflow at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-43f84-verflow-at-iPhone-SE-375px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Homepage renders without overflow at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-fffc3-low-at-iPhone-14-Pro-390px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Homepage renders without overflow at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-fffc3-low-at-iPhone-14-Pro-390px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Homepage renders without overflow at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-b5885-verflow-at-iPad-Mini-768px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Homepage renders without overflow at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-b5885-verflow-at-iPad-Mini-768px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Homepage renders without overflow at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-72efc-overflow-at-Desktop-1280px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Homepage renders without overflow at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-72efc-overflow-at-Desktop-1280px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Business view renders at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-706a7-renders-at-iPhone-SE-375px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Business view renders at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-706a7-renders-at-iPhone-SE-375px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Business view renders at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-841ed-ers-at-iPhone-14-Pro-390px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Business view renders at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-841ed-ers-at-iPhone-14-Pro-390px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Business view renders at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-02353-renders-at-iPad-Mini-768px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Business view renders at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-02353-renders-at-iPad-Mini-768px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Business view renders at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-0c6aa--renders-at-Desktop-1280px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Business view renders at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-0c6aa--renders-at-Desktop-1280px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Deals tab and cards render at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-443cb--render-at-iPhone-SE-375px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Deals tab and cards render at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-443cb--render-at-iPhone-SE-375px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Deals tab and cards render at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-32043-der-at-iPhone-14-Pro-390px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Deals tab and cards render at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-32043-der-at-iPhone-14-Pro-390px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Deals tab and cards render at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-914e3--render-at-iPad-Mini-768px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Deals tab and cards render at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-914e3--render-at-iPad-Mini-768px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Deals tab and cards render at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-5843b-s-render-at-Desktop-1280px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Deals tab and cards render at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-5843b-s-render-at-Desktop-1280px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Event detail modal fits viewport at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-ae886-iewport-at-iPhone-SE-375px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Event detail modal fits viewport at iPhone SE (375px) | `screenshots/11-cross-cutting-Mobile-Re-ae886-iewport-at-iPhone-SE-375px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Event detail modal fits viewport at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-3cc90-ort-at-iPhone-14-Pro-390px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Event detail modal fits viewport at iPhone 14 Pro (390px) | `screenshots/11-cross-cutting-Mobile-Re-3cc90-ort-at-iPhone-14-Pro-390px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Event detail modal fits viewport at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-431cf-iewport-at-iPad-Mini-768px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Event detail modal fits viewport at iPad Mini (768px) | `screenshots/11-cross-cutting-Mobile-Re-431cf-iewport-at-iPad-Mini-768px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Event detail modal fits viewport at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-65896-viewport-at-Desktop-1280px--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Event detail modal fits viewport at Desktop (1280px) | `screenshots/11-cross-cutting-Mobile-Re-65896-viewport-at-Desktop-1280px--desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Homepage loads in under 3 seconds | `screenshots/11-cross-cutting-Performan-78266-ge-loads-in-under-3-seconds-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Homepage loads in under 3 seconds | `screenshots/11-cross-cutting-Performan-78266-ge-loads-in-under-3-seconds-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Deals tab loads and renders cards in under 3 seconds | `screenshots/11-cross-cutting-Performan-01e92-rs-cards-in-under-3-seconds-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Deals tab loads and renders cards in under 3 seconds | `screenshots/11-cross-cutting-Performan-01e92-rs-cards-in-under-3-seconds-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Events tab loads and renders cards in under 3 seconds | `screenshots/11-cross-cutting-Performan-1e5b2-rs-cards-in-under-3-seconds-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Events tab loads and renders cards in under 3 seconds | `screenshots/11-cross-cutting-Performan-1e5b2-rs-cards-in-under-3-seconds-desktop-chrome-retry1/test-failed-1.png` |
| PASS | Business dashboard loads in under 3 seconds after auth | `screenshots/11-cross-cutting-Performan-93981--under-3-seconds-after-auth-desktop-chrome/test-finished-1.png` |
| FAIL | All visible images have alt attributes | `screenshots/11-cross-cutting-Accessibi-d2f42--images-have-alt-attributes-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | All visible images have alt attributes | `screenshots/11-cross-cutting-Accessibi-d2f42--images-have-alt-attributes-desktop-chrome-retry1/test-failed-1.png` |
| PASS | Search input has an accessible label or placeholder | `screenshots/11-cross-cutting-Accessibi-6f428-ssible-label-or-placeholder-desktop-chrome/test-finished-1.png` |
| FAIL | Auth modal form inputs have accessible labels | `screenshots/11-cross-cutting-Accessibi-c25b2-puts-have-accessible-labels-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Auth modal form inputs have accessible labels | `screenshots/11-cross-cutting-Accessibi-c25b2-puts-have-accessible-labels-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Filter pills and tab buttons have discernible text or aria-label | `screenshots/11-cross-cutting-Accessibi-db465-cernible-text-or-aria-label-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Filter pills and tab buttons have discernible text or aria-label | `screenshots/11-cross-cutting-Accessibi-db465-cernible-text-or-aria-label-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Auth modal can be closed with ESC key | `screenshots/11-cross-cutting-Accessibi-76de9--can-be-closed-with-ESC-key-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Auth modal can be closed with ESC key | `screenshots/11-cross-cutting-Accessibi-76de9--can-be-closed-with-ESC-key-desktop-chrome-retry1/test-failed-1.png` |
| PASS | Tab order reaches search input without mouse | `screenshots/11-cross-cutting-Accessibi-7f989--search-input-without-mouse-desktop-chrome/test-finished-1.png` |
| PASS | XSS payload 1 is sanitized in search bar: <script>alert("xss")</script> | `screenshots/11-cross-cutting-Security--e79bf-ar-script-alert-xss-script--desktop-chrome/test-finished-1.png` |
| FAIL | XSS payload 2 is sanitized in search bar: "><img src=x onerror=alert(1)> | `screenshots/11-cross-cutting-Security--7c43e--img-src-x-onerror-alert-1--desktop-chrome/test-failed-1.png` |
| FAIL(R1) | XSS payload 2 is sanitized in search bar: "><img src=x onerror=alert(1)> | `screenshots/11-cross-cutting-Security--7c43e--img-src-x-onerror-alert-1--desktop-chrome-retry1/test-failed-1.png` |
| PASS | XSS payload 3 is sanitized in search bar: '; DROP TABLE businesses; -- | `screenshots/11-cross-cutting-Security--a7d1f-ar-DROP-TABLE-businesses----desktop-chrome/test-finished-1.png` |
| PASS | XSS payload 4 is sanitized in search bar: <svg onload=alert(1)> | `screenshots/11-cross-cutting-Security--03367-rch-bar-svg-onload-alert-1--desktop-chrome/test-finished-1.png` |
| FAIL | XSS payload 1 is sanitized in auth email input | `screenshots/11-cross-cutting-Security--96550-nitized-in-auth-email-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | XSS payload 1 is sanitized in auth email input | `screenshots/11-cross-cutting-Security--96550-nitized-in-auth-email-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | XSS payload 2 is sanitized in auth email input | `screenshots/11-cross-cutting-Security--f099d-nitized-in-auth-email-input-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | XSS payload 2 is sanitized in auth email input | `screenshots/11-cross-cutting-Security--f099d-nitized-in-auth-email-input-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Very long string (10,000 chars) does not crash the app | `screenshots/11-cross-cutting-Security--877b1-hars-does-not-crash-the-app-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Very long string (10,000 chars) does not crash the app | `screenshots/11-cross-cutting-Security--877b1-hars-does-not-crash-the-app-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | Emoji and Unicode characters are handled gracefully | `screenshots/11-cross-cutting-Security--d4907-ters-are-handled-gracefully-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | Emoji and Unicode characters are handled gracefully | `screenshots/11-cross-cutting-Security--d4907-ters-are-handled-gracefully-desktop-chrome-retry1/test-failed-1.png` |
| FAIL | SQL injection string does not cause error or leak data | `screenshots/11-cross-cutting-Security--6ea6f-ot-cause-error-or-leak-data-desktop-chrome/test-failed-1.png` |
| FAIL(R1) | SQL injection string does not cause error or leak data | `screenshots/11-cross-cutting-Security--6ea6f-ot-cause-error-or-leak-data-desktop-chrome-retry1/test-failed-1.png` |

---

## Manual Screenshots

These screenshots were captured manually during exploratory testing.

| Description | File Path |
|-------------|-----------|
| FeedbackWidget "Add Content" modal open (Action 26) | `screenshots/26-create-deal/01-feedback-modal-open.png` |

---

## Screenshot Statistics

| Category | Count |
|----------|-------|
| Pass screenshots (test-finished) | 77 |
| Fail screenshots (test-failed, attempt 1) | 117 |
| Fail screenshots (test-failed, retry) | 117 |
| Skip screenshots | 59 |
| Manual screenshots | 1 |
| **Total** | **371** |

> **Note:** Failed tests generate two screenshots (attempt 1 + retry attempt), which is why the total screenshot count (371) exceeds the failed test count (117). Each failed test gets a screenshot at the point of failure for both the initial attempt and the retry.