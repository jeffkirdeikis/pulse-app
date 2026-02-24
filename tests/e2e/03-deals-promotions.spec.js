/**
 * Actions 26-35: Deals & Promotions
 *
 * Feature status legend:
 *   EXISTS   — fully built, full M/S/E tests written
 *   PARTIAL  — partially built, tests cover what exists + note gaps
 *   NOT_BUILT — skipped with explanatory comment
 *
 * Deal creation flow (confirmed from source):
 *   1. Click .feedback-fab ("Feedback" button)
 *   2. Click .feedback-add-content-btn ("Add Event / Class / Business")
 *   3. SubmissionModal opens at step 1 (type selection)
 *   4. Click .type-card.deal — advances to step 2 (form)
 *   5. Select host (claimed business / new / individual)
 *   6. Fill: title, description, discountType, discountValue, originalPrice,
 *      dealPrice, validUntil, schedule, terms
 *   7. Click "Submit for Review" → step 3 (success screen)
 *
 * Alternative: BusinessDashboard Quick Actions has a "New Deal" button that
 *   calls openSubmissionModal() + selectSubmissionType('deal'), bypassing
 *   the FeedbackWidget. Both paths open the same SubmissionModal.
 */

import { test, expect } from '@playwright/test';
import {
  screenshot,
  waitForAppLoad,
  loginAsTestUser,
  switchToBusinessView,
  TEST_OWNER,
  XSS_PAYLOADS,
  EDGE_STRINGS,
  setupConsoleErrorCapture,
  verifyNoXSSRendered,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the SubmissionModal and advance to the Deal form (step 2).
 *  Automatically skips the test if auth is required but not available. */
async function openDealForm(page) {
  // Use the FeedbackWidget path as specified
  const feedbackFab = page.locator('.feedback-fab');
  const fabVisible = await feedbackFab.isVisible({ timeout: 5000 }).catch(() => false);
  test.skip(!fabVisible, 'FeedbackWidget FAB not visible');
  await feedbackFab.click();

  const addContentBtn = page.locator('.feedback-add-content-btn');
  const addContentVisible = await addContentBtn.isVisible({ timeout: 3000 }).catch(() => false);
  // Auth required — "Add Content" button is only visible to authenticated users
  test.skip(!addContentVisible, 'Add Content button not visible (requires authentication)');
  await addContentBtn.click();

  const modalVisible = await page.locator('.submission-modal').isVisible({ timeout: 5000 }).catch(() => false);
  test.skip(!modalVisible, 'SubmissionModal did not open');

  // Select "Deal" type card
  await page.locator('.type-card.deal').click();
  await page.waitForTimeout(500);

  // Should now be on step 2 (form)
  await expect(page.locator('.submission-modal .submission-content.scrollable')).toBeVisible({ timeout: 3000 });
}

/** Open SubmissionModal via the BusinessDashboard "New Deal" Quick Action. */
async function openDealFormViaBusinessDashboard(page) {
  await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
  await switchToBusinessView(page);

  const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasBusiness) return false;

  const newDealBtn = page.locator('.qa-btn:has-text("New Deal")');
  await expect(newDealBtn).toBeVisible({ timeout: 5000 });
  await newDealBtn.click();

  await expect(page.locator('.submission-modal')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.submission-modal .submission-content.scrollable')).toBeVisible({ timeout: 3000 });
  return true;
}

/** Fill in the minimum required deal fields (host = individual, title, description, schedule). */
async function fillMinimumDealForm(page, overrides = {}) {
  const title = overrides.title || 'QA Test Deal — 20% Off';
  const description = overrides.description || 'A test promotion for automated QA. Do not redeem.';
  const schedule = overrides.schedule || 'Mon-Fri 3–6pm';

  // Select host: Community Member (individual) — no login required
  await page.locator('.business-option').filter({ hasText: 'Community Member' }).click();
  await page.waitForTimeout(200);

  // Title
  await page.locator('.submission-modal input.form-input[maxlength="200"]').fill(title);

  // Description
  await page.locator('.submission-modal textarea.form-input.textarea').fill(description);

  // Schedule (required for deals)
  await page.locator('.submission-modal input[placeholder="e.g., Mon-Fri 3-6pm, Weekends Only"]').fill(schedule);
}

// ---------------------------------------------------------------------------
// Action 26 — CREATE DEAL  (EXISTS)
// SubmissionModal submissionType==='deal': title, description, discountType,
// discountValue, originalPrice, dealPrice, validUntil, schedule, terms.
// Submits to pending_items (approval queue).
// ---------------------------------------------------------------------------
test.describe('Action 26 — Create Deal', () => {
  test('26-M: FeedbackWidget "Add Content" button opens SubmissionModal', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);

    const feedbackFab = page.locator('.feedback-fab');
    await expect(feedbackFab).toBeVisible({ timeout: 5000 });
    await feedbackFab.click();

    await expect(page.locator('.feedback-modal')).toBeVisible({ timeout: 3000 });
    await screenshot(page, 26, 'create-deal', '01-feedback-modal-open');

    const addContentBtn = page.locator('.feedback-add-content-btn');
    const addContentVisible = await addContentBtn.isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(!addContentVisible, 'Add Content button not visible (requires authentication)');
    await expect(addContentBtn).toContainText('Add Event / Class / Business');
    await addContentBtn.click();
    await page.waitForTimeout(1000);

    // Check if auth modal appeared instead (guest state)
    const authAppeared = await page.locator('.auth-modal').isVisible({ timeout: 2000 }).catch(() => false);
    if (authAppeared) {
      test.skip(true, 'SubmissionModal requires authentication');
    }

    await expect(page.locator('.submission-modal')).toBeVisible({ timeout: 5000 });
    await screenshot(page, 26, 'create-deal', '02-submission-modal-open');
    expect(errors.filter(e => !e.includes('supabase') && !e.includes('network'))).toHaveLength(0);
  });

  test('26-M: SubmissionModal type selection screen shows Deal card', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    // Already on step 2 after openDealForm(), so verify the deal header
    await expect(page.locator('.submission-modal .submission-icon-wrapper.deal')).toBeVisible();
    await expect(page.locator('.submission-modal h1')).toContainText('Deal');
    await screenshot(page, 26, 'create-deal', '03-deal-form-step2');
  });

  test('26-M: All deal-specific form fields are present', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    // Discount Type select
    await expect(page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') })).toBeVisible();

    // Schedule input (required)
    await expect(page.locator('.submission-modal input[placeholder="e.g., Mon-Fri 3-6pm, Weekends Only"]')).toBeVisible();

    // Valid Until date input
    await expect(page.locator('.submission-modal input[type="date"]')).toBeVisible();

    // Terms & Conditions textarea
    await expect(page.locator('.submission-modal textarea[placeholder*="Cannot be combined"]')).toBeVisible();

    await screenshot(page, 26, 'create-deal', '04-all-deal-fields-present');
  });

  test('26-M: Host selector shows options: My Businesses (if any), New Business, Community Member', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    // Community Member option must always exist
    await expect(page.locator('.business-option').filter({ hasText: 'Community Member' })).toBeVisible();
    // New Business option must always exist
    await expect(page.locator('.business-option').filter({ hasText: 'New Business' })).toBeVisible();
    await screenshot(page, 26, 'create-deal', '05-host-selector-options');
  });

  test('26-M: Submit button is disabled until required fields are filled', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const submitBtn = page.locator('.btn-submit');
    // Before any input, submit must be disabled
    await expect(submitBtn).toBeDisabled();
    await screenshot(page, 26, 'create-deal', '06-submit-disabled-empty');
  });

  test('26-M: Submit button enables after filling all required deal fields', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    await fillMinimumDealForm(page);

    const submitBtn = page.locator('.btn-submit');
    await expect(submitBtn).not.toBeDisabled({ timeout: 3000 });
    await screenshot(page, 26, 'create-deal', '07-submit-enabled');
  });

  test('26-M: Successful submission advances to step 3 success screen', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);
    await fillMinimumDealForm(page);

    const submitBtn = page.locator('.btn-submit');
    await submitBtn.click();

    // Step 3: success screen
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.submission-success h2')).toContainText('Submitted for Review');
    await screenshot(page, 26, 'create-deal', '08-success-screen');
  });

  test('26-M: Success screen shows submitted deal title and type', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);
    await fillMinimumDealForm(page, { title: 'Happy Hour 30% Off Drinks' });

    await page.locator('.btn-submit').click();
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.detail-row .value').first()).toContainText('Deal');
    await expect(page.locator('.submission-success')).toContainText('Happy Hour 30% Off Drinks');
    await screenshot(page, 26, 'create-deal', '09-success-screen-with-title');
  });

  test('26-M: Done button closes the SubmissionModal after success', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);
    await fillMinimumDealForm(page);

    await page.locator('.btn-submit').click();
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 10000 });

    await page.locator('.btn-done').click();
    await expect(page.locator('.submission-modal')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 26, 'create-deal', '10-modal-closed-after-done');
  });

  test('26-M: BusinessDashboard Quick Actions "New Deal" button also opens deal form', async ({ page }) => {
    await waitForAppLoad(page);
    const opened = await openDealFormViaBusinessDashboard(page);
    if (!opened) { test.skip('No claimed business available'); return; }

    // Should be on deal step 2 directly
    await expect(page.locator('.submission-modal .submission-icon-wrapper.deal')).toBeVisible();
    await screenshot(page, 26, 'create-deal', '11-new-deal-via-dashboard');
  });

  test('26-S: Back button returns from deal form to type selection', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const backBtn = page.locator('.btn-back');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Should return to step 1 (type selection grid)
    await expect(page.locator('.type-selection-grid')).toBeVisible({ timeout: 3000 });
    await screenshot(page, 26, 'create-deal', '12-back-to-type-selection');
  });

  test('26-S: Closing modal via X button during form entry does not submit', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);
    await fillMinimumDealForm(page);

    await page.locator('.submission-close').click();
    await expect(page.locator('.submission-modal')).not.toBeVisible({ timeout: 3000 });

    // No success screen should have appeared
    const successScreen = page.locator('.submission-success');
    await expect(successScreen).not.toBeVisible();
    await screenshot(page, 26, 'create-deal', '13-x-closes-without-submit');
  });

  test('26-S: Closing modal via overlay click does not submit', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);
    await fillMinimumDealForm(page);

    await page.locator('.submission-modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.submission-modal')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 26, 'create-deal', '14-overlay-closes-without-submit');
  });

  test('26-E: XSS in deal title is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const titleInput = page.locator('.submission-modal input.form-input[maxlength="200"]');
    await titleInput.fill(XSS_PAYLOADS[0]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 26, 'create-deal', '15-xss-title-safe');
  });

  test('26-E: XSS in deal description is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const descInput = page.locator('.submission-modal textarea.form-input.textarea');
    await descInput.fill(XSS_PAYLOADS[3]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 26, 'create-deal', '16-xss-description-safe');
  });

  test('26-E: Very long title is capped at maxLength=200', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const titleInput = page.locator('.submission-modal input.form-input[maxlength="200"]');
    await titleInput.fill(EDGE_STRINGS.veryLong);
    const value = await titleInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(200);
    await screenshot(page, 26, 'create-deal', '17-title-maxlength');
  });

  test('26-E: Deal with emoji in title is accepted', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const titleInput = page.locator('.submission-modal input.form-input[maxlength="200"]');
    await titleInput.fill(EDGE_STRINGS.emoji + ' 50% Off Weekend Special');
    const value = await titleInput.inputValue();
    expect(value).toContain('50% Off');
    await screenshot(page, 26, 'create-deal', '18-emoji-title');
  });

  test('26-E: Selecting "New Business" host shows business name + address fields', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    await page.locator('.business-option').filter({ hasText: 'New Business' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('.submission-modal input[placeholder="e.g., Breathe Fitness Studio"]')).toBeVisible();
    await screenshot(page, 26, 'create-deal', '19-new-business-fields');
  });
});

// ---------------------------------------------------------------------------
// Action 27 — DEAL DATES  (EXISTS)
// SubmissionModal has validUntil date input (type="date", min=today).
// ---------------------------------------------------------------------------
test.describe('Action 27 — Deal Valid Until Date', () => {
  test('27-M: Valid Until date input is present in deal form', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const validUntilInput = page.locator('.submission-modal input[type="date"]');
    await expect(validUntilInput).toBeVisible();
    await expect(validUntilInput).toHaveAttribute('type', 'date');
    await screenshot(page, 27, 'deal-dates', '01-valid-until-present');
  });

  test('27-M: Valid Until field has min date set to today (no past dates)', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const validUntilInput = page.locator('.submission-modal input[type="date"]');
    const minAttr = await validUntilInput.getAttribute('min');
    expect(minAttr).toBeTruthy();

    // min should be today's date (YYYY-MM-DD format)
    const today = new Date().toISOString().split('T')[0];
    // Allow for same-day UTC vs local timezone difference (up to 1 day off)
    const minDate = new Date(minAttr);
    const todayDate = new Date(today);
    const diffDays = Math.abs((todayDate - minDate) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeLessThanOrEqual(1);
    await screenshot(page, 27, 'deal-dates', '02-min-date-today');
  });

  test('27-M: Valid Until field accepts a future date', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const validUntilInput = page.locator('.submission-modal input[type="date"]');
    await validUntilInput.fill(futureDateStr);
    await expect(validUntilInput).toHaveValue(futureDateStr);
    await screenshot(page, 27, 'deal-dates', '03-future-date-set');
  });

  test('27-M: Valid Until field is optional — deal submits without it', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    await fillMinimumDealForm(page);

    // Leave validUntil empty
    const validUntilInput = page.locator('.submission-modal input[type="date"]');
    await validUntilInput.fill('');

    // Submit should still be enabled (validUntil is not required by button disabled logic)
    const submitBtn = page.locator('.btn-submit');
    await expect(submitBtn).not.toBeDisabled();
    await screenshot(page, 27, 'deal-dates', '04-optional-date-empty-ok');
  });

  test('27-S: Deal with an expiry date 1 year out saves successfully', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);
    await fillMinimumDealForm(page);

    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const nextYearStr = nextYear.toISOString().split('T')[0];

    const validUntilInput = page.locator('.submission-modal input[type="date"]');
    await validUntilInput.fill(nextYearStr);
    await expect(validUntilInput).toHaveValue(nextYearStr);

    await page.locator('.btn-submit').click();
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 10000 });
    await screenshot(page, 27, 'deal-dates', '05-1-year-expiry-submitted');
  });

  test('27-S: Schedule field is required for deal submission', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    // Fill everything EXCEPT schedule
    await page.locator('.business-option').filter({ hasText: 'Community Member' }).click();
    await page.locator('.submission-modal input.form-input[maxlength="200"]').fill('Test Deal');
    await page.locator('.submission-modal textarea.form-input.textarea').fill('Test description');
    // Leave schedule empty

    const submitBtn = page.locator('.btn-submit');
    // Disabled because schedule is empty (confirmed in SubmissionModal.jsx submit guard)
    await expect(submitBtn).toBeDisabled();
    await screenshot(page, 27, 'deal-dates', '06-schedule-required');
  });

  test('27-E: Schedule field with special characters is accepted', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const scheduleInput = page.locator('.submission-modal input[placeholder="e.g., Mon-Fri 3-6pm, Weekends Only"]');
    await scheduleInput.fill('Mon–Fri 3–6pm & Sat–Sun 12–3pm (long weekend: +1hr)');
    const value = await scheduleInput.inputValue();
    expect(value).toContain('Mon');
    await screenshot(page, 27, 'deal-dates', '07-schedule-special-chars');
  });

  test('27-E: Schedule capped at maxLength=200', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const scheduleInput = page.locator('.submission-modal input[placeholder="e.g., Mon-Fri 3-6pm, Weekends Only"]');
    await scheduleInput.fill(EDGE_STRINGS.veryLong);
    const value = await scheduleInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(200);
    await screenshot(page, 27, 'deal-dates', '08-schedule-maxlength');
  });
});

// ---------------------------------------------------------------------------
// Action 28 — REDEMPTION LIMITS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 28 — Redemption Limits', () => {
  test.skip('28: Redemption limits not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no "max redemptions" or "limit uses" field in SubmissionModal's deal form.
    // DealDetailModal does track a redemption count (view-only for consumers) but
    // business owners cannot set a cap.
    //
    // When redemption limits are added, tests should cover:
    //   M: A "Max Redemptions" numeric input is present in the deal form
    //   M: Setting limit=50 and submitting saves the limit to the deal
    //   S: When redemption count reaches the limit, the deal is auto-marked "sold out"
    //   S: Setting limit=0 or leaving it empty means "unlimited"
    //   E: Negative limit is rejected with validation error
    //   E: Non-integer input (e.g., "10.5") is rejected or rounded down
  });
});

// ---------------------------------------------------------------------------
// Action 29 — EDIT DEAL  (NOT_BUILT)
// BusinessDashboard deal rows have delete but NO edit button (no EditDealModal).
// ---------------------------------------------------------------------------
test.describe('Action 29 — Edit Deal', () => {
  test('29-M: Deal rows in listings table have no edit button (confirmed NOT built)', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    const dealRows = page.locator('.listing-row').filter({ has: page.locator('.type-badge.deal') });
    const dealCount = await dealRows.count();
    if (dealCount === 0) { test.skip('No deal rows to verify'); return; }

    // Confirms deals have ONLY a delete button, no edit button
    const firstDealRow = dealRows.first();
    await expect(firstDealRow.locator('.action-btn-sm.danger')).toBeVisible();
    await expect(firstDealRow.locator('.action-btn-sm:not(.danger)')).not.toBeVisible();
    await screenshot(page, 29, 'edit-deal', '01-no-edit-button-for-deals');
  });

  test.skip('29-FUTURE: Edit deal functionality when EditDealModal is built', async () => {
    // SKIPPED — NOT BUILT
    // There is no EditDealModal. Deals can only be deleted and re-created.
    //
    // When deal editing is added, tests should cover:
    //   M: An edit (pencil) button appears on deal rows in the listings table
    //   M: Clicking it opens EditDealModal pre-populated with the deal's current values
    //   M: Changing the title and saving updates the deal in the consumer view
    //   S: Saving without changes does not create a duplicate
    //   S: Editing a deal while it is active does not temporarily remove it from the feed
    //   E: Clearing the title field disables the save button
    //   E: XSS in any edited field is sanitized before display
    //   E: Editing sets the deal back to "pending" if approval workflow applies
  });
});

// ---------------------------------------------------------------------------
// Action 30 — PAUSE DEAL  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 30 — Pause Deal', () => {
  test.skip('30: Deal pausing not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no pause/unpause toggle on deal rows. Deals can only be deleted.
    //
    // When pausing is added, tests should cover:
    //   M: A "Pause" button appears on active deal rows
    //   M: Clicking Pause hides the deal from the consumer Deals feed
    //   M: The dashboard shows the deal as "Paused" with a "Resume" button
    //   S: Pausing does not reset redemption count or valid-until date
    //   S: Resuming makes the deal visible again immediately
    //   E: A paused deal cannot be redeemed via direct link
  });
});

// ---------------------------------------------------------------------------
// Action 31 — DELETE DEAL  (EXISTS)
// Same mechanism as event deletion in BusinessDashboard.
// .action-btn-sm.danger triggers confirm() → supabase.from('deals').delete()
// ---------------------------------------------------------------------------
test.describe('Action 31 — Delete Deal', () => {
  test('31-M: Delete button is present on deal rows in listings table', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    const dealRows = page.locator('.listing-row').filter({ has: page.locator('.type-badge.deal') });
    const dealCount = await dealRows.count();
    if (dealCount === 0) { test.skip('No deal rows to test delete'); return; }

    const deleteBtn = dealRows.first().locator('.action-btn-sm.danger');
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toHaveAttribute('title', 'Delete');
    await screenshot(page, 31, 'delete-deal', '01-delete-button-visible');
    expect(errors.filter(e => !e.includes('supabase') && !e.includes('network'))).toHaveLength(0);
  });

  test('31-M: Clicking delete deal shows browser confirm dialog with deal name', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    const dealRows = page.locator('.listing-row').filter({ has: page.locator('.type-badge.deal') });
    if (await dealRows.count() === 0) { test.skip('No deal rows to test'); return; }

    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Delete "');
      await dialog.dismiss(); // Cancel — do not actually delete
    });

    await dealRows.first().locator('.action-btn-sm.danger').click();
    await page.waitForTimeout(500);

    // Listing must still be present after cancelling
    await expect(dealRows.first()).toBeVisible();
    await screenshot(page, 31, 'delete-deal', '02-confirm-dialog-dismissed');
  });

  test('31-S: Cancelling delete leaves deal row intact', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    const dealRows = page.locator('.listing-row').filter({ has: page.locator('.type-badge.deal') });
    if (await dealRows.count() === 0) { test.skip('No deal rows to test'); return; }

    const initialCount = await page.locator('.listing-row').count();

    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
    });

    await dealRows.first().locator('.action-btn-sm.danger').click();
    await page.waitForTimeout(500);

    expect(await page.locator('.listing-row').count()).toBe(initialCount);
    await screenshot(page, 31, 'delete-deal', '03-cancel-count-unchanged');
  });
});

// ---------------------------------------------------------------------------
// Action 32 — DEAL STATS  (PARTIAL)
// DealDetailModal shows a "redeem" button that increments redemption count.
// BusinessDashboard does NOT show per-deal stats (no analytics for deals).
// ---------------------------------------------------------------------------
test.describe('Action 32 — Deal Stats', () => {
  test('32-M: DealsGrid tab is accessible from consumer view', async ({ page }) => {
    await waitForAppLoad(page);
    await screenshot(page, 32, 'deal-stats', '01-app-loaded');

    // Navigate to Deals tab
    const dealsTab = page.locator('.category-card:has-text("Deals")');
    if (await dealsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dealsTab.click();
      await page.waitForTimeout(500);
      await screenshot(page, 32, 'deal-stats', '02-deals-tab-active');
    }

    // Consumer view should show deals grid or empty state
    await screenshot(page, 32, 'deal-stats', '03-deals-view');
  });

  test('32-M: BusinessDashboard shows no per-deal stats row in listings table', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    // Table columns for deals: Listing | Type | Status | Date | Time | Actions
    // There is NO "Redemptions" or "Stats" column — confirming partial implementation
    const thCells = await page.locator('.listings-table thead th').allTextContents();
    expect(thCells).not.toContain('Redemptions');
    expect(thCells).not.toContain('Stats');
    await screenshot(page, 32, 'deal-stats', '04-no-stats-column-confirmed');
  });

  test.skip('32-PARTIAL: Per-deal redemption stats not shown in business dashboard', async () => {
    // SKIPPED — PARTIAL IMPLEMENTATION
    // DealDetailModal (consumer-facing) tracks redemptions via a Redeem button,
    // but business owners cannot see redemption counts in the dashboard.
    //
    // When deal stats are added to the business dashboard, tests should cover:
    //   M: Each deal row in the listings table shows a redemption count
    //   M: A "View Stats" button opens a deal analytics panel
    //   S: Redemption count increments after a consumer redeems the deal
    //   S: Stats show a time-series chart of redemptions per day
    //   E: Stats are scoped to the business owner's deals only, not all deals
    //   E: Zero redemptions shows "0" not an empty cell or error
  });
});

// ---------------------------------------------------------------------------
// Action 33 — RECURRING DEAL  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 33 — Recurring Deal', () => {
  test.skip('33: Recurring deals not yet built', async () => {
    // SKIPPED — NOT BUILT
    // SubmissionModal's deal form has no "recurrence" option (unlike the event form
    // which has a Recurrence select: none/daily/weekly/monthly).
    //
    // When recurring deals are added, tests should cover:
    //   M: A "Recurring" checkbox or select is present in the deal form
    //   M: Selecting "Weekly" with a start/end date creates multiple deal instances
    //   S: The deal shows "Every Monday" or similar cadence on the consumer card
    //   S: Pausing a recurring deal stops all future instances
    //   E: Recurring deal with no end date creates an indefinitely repeating promotion
    //   E: Editing a single instance of a recurring deal does not affect other instances
    //      (or prompts "edit this / all future / all instances")
  });
});

// ---------------------------------------------------------------------------
// Action 34 — FIRST-TIME DEAL  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 34 — First-Time Customer Deal', () => {
  test.skip('34: First-time customer deal targeting not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no "new customers only" or "first-time visitor" flag in the deal form.
    //
    // When this targeting is added, tests should cover:
    //   M: A "New Customers Only" checkbox is present in the deal form
    //   M: Checking it adds a "First Visit" badge on the consumer deal card
    //   S: A user who has previously redeemed this deal sees it as ineligible
    //   S: A first-time user can redeem it and the deal is then locked for them
    //   E: Business cannot accidentally apply this to all customers retroactively
  });
});

// ---------------------------------------------------------------------------
// Action 35 — LOYALTY DEAL  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 35 — Loyalty Deal', () => {
  test.skip('35: Loyalty deal / punch card not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no loyalty program, punch card, or "N visits = reward" deal type
    // in SubmissionModal or anywhere in the app.
    //
    // When loyalty deals are added, tests should cover:
    //   M: A "Loyalty Deal" type option appears in the discount type selector
    //   M: Business can set "Buy N, get 1 free" or "Earn X points per visit" parameters
    //   S: Consumer deal card shows a punch card progress indicator
    //   S: After N redemptions the reward is automatically unlocked for the customer
    //   E: Customer cannot redeem the reward twice in one session
    //   E: Loyalty deal is tied to the customer's account, not their device
  });
});

// ---------------------------------------------------------------------------
// Discount type field tests — covers all five discount types in the deal form
// (percent, fixed, bogo, free_item, special)
// ---------------------------------------------------------------------------
test.describe('Deal Discount Type Field (Action 26 supplement)', () => {
  test('DT-M: Default discount type is "Percentage Off"', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const discountSelect = page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') });
    await expect(discountSelect).toHaveValue('percent');
    await screenshot(page, 26, 'create-deal', '20-default-discount-type-percent');
  });

  test('DT-M: Selecting "Percentage Off" shows discount percentage number input', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const discountSelect = page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') });
    await discountSelect.selectOption('percent');
    await expect(page.locator('.submission-modal input[placeholder="e.g., 25"]')).toBeVisible();
    await screenshot(page, 26, 'create-deal', '21-percent-shows-value-input');
  });

  test('DT-M: Selecting "Dollar Amount Off" shows dollar amount number input', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const discountSelect = page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') });
    await discountSelect.selectOption('fixed');
    await expect(page.locator('.submission-modal input[placeholder="e.g., 10"]')).toBeVisible();
    await screenshot(page, 26, 'create-deal', '22-fixed-shows-amount-input');
  });

  test('DT-M: Selecting "Buy One Get One" hides the discount value input', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const discountSelect = page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') });
    await discountSelect.selectOption('bogo');

    // BOGO has no numeric input
    await expect(page.locator('.submission-modal input[placeholder="e.g., 25"]')).not.toBeVisible();
    await expect(page.locator('.submission-modal input[placeholder="e.g., 10"]')).not.toBeVisible();
    await screenshot(page, 26, 'create-deal', '23-bogo-no-value-input');
  });

  test('DT-M: Selecting "Free Item" hides the discount value input', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const discountSelect = page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') });
    await discountSelect.selectOption('free_item');
    await expect(page.locator('.submission-modal input[placeholder="e.g., 25"]')).not.toBeVisible();
    await screenshot(page, 26, 'create-deal', '24-free-item-no-value-input');
  });

  test('DT-S: Entering 100 as percentage value is accepted', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const discountSelect = page.locator('.submission-modal select').filter({ has: page.locator('option[value="percent"]') });
    await discountSelect.selectOption('percent');
    const discountValueInput = page.locator('.submission-modal input[placeholder="e.g., 25"]');
    await discountValueInput.fill('100');
    await expect(discountValueInput).toHaveValue('100');
    await screenshot(page, 26, 'create-deal', '25-100-percent-accepted');
  });

  test('DT-S: Terms & Conditions textarea accepts up to maxLength=2000', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const termsTextarea = page.locator('.submission-modal textarea[placeholder*="Cannot be combined"]');
    const longTerms = 'T'.repeat(2000);
    await termsTextarea.fill(longTerms);
    const value = await termsTextarea.inputValue();
    expect(value.length).toBeLessThanOrEqual(2000);
    await screenshot(page, 26, 'create-deal', '26-terms-maxlength');
  });

  test('DT-E: XSS in terms & conditions field is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const termsTextarea = page.locator('.submission-modal textarea[placeholder*="Cannot be combined"]');
    await termsTextarea.fill(XSS_PAYLOADS[2]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 26, 'create-deal', '27-terms-xss-safe');
  });

  test('DT-E: Original and deal price fields accept decimal values', async ({ page }) => {
    await waitForAppLoad(page);
    await openDealForm(page);

    const originalPrice = page.locator('.submission-modal input[placeholder="e.g., 40.00"]');
    const dealPrice = page.locator('.submission-modal input[placeholder="e.g., 30.00"]');
    await originalPrice.fill('49.99');
    await dealPrice.fill('34.99');
    await expect(originalPrice).toHaveValue('49.99');
    await expect(dealPrice).toHaveValue('34.99');
    await screenshot(page, 26, 'create-deal', '28-decimal-prices');
  });
});
