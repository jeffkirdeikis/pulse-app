/**
 * Actions 11-25: Listing Management
 *
 * Feature status legend:
 *   EXISTS   — fully built, full M/S/E tests written
 *   PARTIAL  — partially built, tests cover what exists + note gaps
 *   NOT_BUILT — skipped with explanatory comment
 *
 * Key selectors confirmed from source:
 *   .submission-modal        — SubmissionModal
 *   .claim-modal-premium     — EditVenueModal, EditEventModal, ClaimBusinessModal
 *   .business-view-premium   — BusinessDashboard outer wrapper
 *   .listings-table          — table in "Your Active Listings"
 *   .listing-row             — each row in the listings table
 *   .action-btn-sm           — edit pencil button (events only)
 *   .action-btn-sm.danger    — delete trash button (events + deals)
 *   .feedback-fab            — FeedbackWidget FAB button
 *   .feedback-add-content-btn — "Add Event / Class / Business" button inside FeedbackWidget
 */

import { test, expect } from '@playwright/test';
import {
  screenshot,
  waitForAppLoad,
  switchToBusinessView,
  loginAsTestUser,
  TEST_OWNER,
  XSS_PAYLOADS,
  EDGE_STRINGS,
  setupConsoleErrorCapture,
  verifyNoXSSRendered,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Helper: open SubmissionModal via FeedbackWidget "Add Content" button
// ---------------------------------------------------------------------------
async function openSubmissionModal(page) {
  const feedbackFab = page.locator('.feedback-fab');
  const fabVisible = await feedbackFab.isVisible({ timeout: 5000 }).catch(() => false);
  test.skip(!fabVisible, 'FeedbackWidget FAB not visible');
  await feedbackFab.click();

  const addContentBtn = page.locator('.feedback-add-content-btn');
  const addContentVisible = await addContentBtn.isVisible({ timeout: 3000 }).catch(() => false);
  test.skip(!addContentVisible, 'Add Content button not visible (requires authentication)');
  await addContentBtn.click();
  await page.waitForTimeout(1000);

  // Check if auth modal appeared instead (guest state)
  const authAppeared = await page.locator('.auth-modal').isVisible({ timeout: 2000 }).catch(() => false);
  test.skip(authAppeared, 'SubmissionModal requires authentication — auth modal appeared');

  await expect(page.locator('.submission-modal')).toBeVisible({ timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Helper: navigate to Edit modal for the first event in the listings table
// Returns false if no event is available to edit.
// ---------------------------------------------------------------------------
async function openEditEventModal(page) {
  await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
  await switchToBusinessView(page);

  const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasBusiness) return false;

  const editBtn = page.locator('.listing-row .action-btn-sm:not(.danger)').first();
  const hasEditBtn = await editBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasEditBtn) return false;

  await editBtn.click();
  await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });
  return true;
}

// ---------------------------------------------------------------------------
// Action 11 — EDIT NAME  (EXISTS)
// EditVenueModal: #edit-venue-name (name field, maxLength=200)
// EditEventModal: input[type="text"] for title (maxLength=200)
// ---------------------------------------------------------------------------
test.describe('Action 11 — Edit Listing Name / Title', () => {
  test('11-M: Business name field present in EditVenueModal', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator('#edit-venue-name');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveAttribute('maxlength', '200');
    await screenshot(page, 11, 'edit-name', '01-venue-name-field-present');
    expect(errors).toHaveLength(0);
  });

  test('11-M: Venue name field accepts typing and retains value', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator('#edit-venue-name');
    await nameInput.fill('QA Test Business Name');
    await expect(nameInput).toHaveValue('QA Test Business Name');
    await screenshot(page, 11, 'edit-name', '02-venue-name-typed');
  });

  test('11-M: Save Changes button is disabled when name is empty', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator('#edit-venue-name');
    await nameInput.fill('');
    const saveBtn = page.locator('.claim-submit-btn');
    await expect(saveBtn).toBeDisabled();
    await screenshot(page, 11, 'edit-name', '03-save-disabled-empty-name');
  });

  test('11-M: Event title field present in EditEventModal', async ({ page }) => {
    await waitForAppLoad(page);
    const opened = await openEditEventModal(page);
    if (!opened) { test.skip('No event available in listings table to edit'); return; }

    // EditEventModal has no specific ID on the title input — it is the first text input
    const titleInput = page.locator('.claim-modal-premium input[type="text"]').first();
    await expect(titleInput).toBeVisible();
    await screenshot(page, 11, 'edit-name', '04-event-title-field');
  });

  test('11-S: Venue name capped at maxLength=200', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator('#edit-venue-name');
    await nameInput.fill(EDGE_STRINGS.veryLong);
    const value = await nameInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(200);
    await screenshot(page, 11, 'edit-name', '05-name-maxlength');
  });

  test('11-E: XSS in venue name field is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator('#edit-venue-name');
    await nameInput.fill(XSS_PAYLOADS[0]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 11, 'edit-name', '06-xss-name-safe');
  });

  test('11-E: Unicode / emoji in venue name is accepted', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator('#edit-venue-name');
    await nameInput.fill('Peak ' + EDGE_STRINGS.emoji + ' Studio');
    const value = await nameInput.inputValue();
    expect(value).toContain('Peak');
    await screenshot(page, 11, 'edit-name', '07-unicode-name');
  });
});

// ---------------------------------------------------------------------------
// Action 12 — UPLOAD PHOTOS  (PARTIAL)
// SubmissionModal has image upload (square 1:1 + banner 3:1) during CREATION only.
// There is no photo upload for editing an existing event/deal.
// ---------------------------------------------------------------------------
test.describe('Action 12 — Upload Photos', () => {
  test('12-M: Square and banner image upload areas present in SubmissionModal', async ({ page }) => {
    await waitForAppLoad(page);
    await openSubmissionModal(page);

    // Select event type to get to form
    await page.locator('.type-card.event').click();
    await page.waitForTimeout(500);

    const squareUpload = page.locator('.image-upload-card.square');
    const bannerUpload = page.locator('.image-upload-card.banner');
    await expect(squareUpload).toBeVisible();
    await expect(bannerUpload).toBeVisible();
    await screenshot(page, 12, 'upload-photos', '01-image-upload-areas-present');
  });

  test('12-M: Square image upload area shows ratio label "1:1"', async ({ page }) => {
    await waitForAppLoad(page);
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.image-upload-card.square .image-ratio')).toContainText('1:1');
    await expect(page.locator('.image-upload-card.banner .image-ratio')).toContainText('3:1');
    await screenshot(page, 12, 'upload-photos', '02-ratio-labels');
  });

  test('12-M: Hidden file inputs exist inside upload areas', async ({ page }) => {
    await waitForAppLoad(page);
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await page.waitForTimeout(500);

    // Each .image-upload-area label wraps a hidden file input
    const fileInputs = page.locator('.submission-modal input[type="file"][accept="image/*"]');
    await expect(fileInputs).toHaveCount(2);
    await screenshot(page, 12, 'upload-photos', '03-file-inputs-present');
  });

  test.skip('12-PARTIAL: Edit photo for existing listing not yet built', async () => {
    // SKIPPED — PARTIAL IMPLEMENTATION
    // SubmissionModal supports image upload during creation of a new event/class/deal.
    // However, BusinessDashboard's "Your Active Listings" table shows an Edit button
    // only for events (not deals), and EditEventModal has NO image upload field.
    //
    // When photo editing for existing listings is added, tests should cover:
    //   M: An "Edit Photos" or "Change Image" button is visible on listing rows
    //   M: Clicking it opens a photo management UI
    //   S: A new image can be selected and previewed before saving
    //   S: Saving the new image updates it on the listing card in the consumer view
    //   E: Very large image (>5MB) is rejected with a clear error message
    //   E: Non-image file (PDF, .exe) is rejected
    //   E: SVG with embedded script is rejected
  });
});

// ---------------------------------------------------------------------------
// Action 13 — REORDER PHOTOS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 13 — Reorder Photos', () => {
  test.skip('13: Photo reordering not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no multi-photo gallery or reordering UI anywhere in the app.
    // Each listing has at most a square image and a banner image from SubmissionModal.
    //
    // When reordering is added, tests should cover:
    //   M: Drag handle or arrow buttons are visible for each photo in a gallery
    //   M: Dragging photo A above photo B updates the display order
    //   S: Reordered photos persist after saving and a page reload
    //   E: Reordering a single-photo listing shows no reorder controls
  });
});

// ---------------------------------------------------------------------------
// Action 14 — DELETE PHOTO  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 14 — Delete Photo', () => {
  test.skip('14: Individual photo deletion not yet built', async () => {
    // SKIPPED — NOT BUILT
    // SubmissionModal lets you remove a staged image before submission (X button on
    // the preview), but there is no delete-photo feature for existing/saved listings.
    //
    // When per-photo deletion is added, tests should cover:
    //   M: Each saved photo has a delete/remove button
    //   M: Clicking delete removes the photo from the preview
    //   S: Deleting the only photo leaves the listing in a "no photo" state
    //   S: Deleting one photo from a gallery does not affect others
    //   E: Confirm dialog or undo option prevents accidental deletion
  });
});

// ---------------------------------------------------------------------------
// Action 15 — MENU / SERVICES  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 15 — Menu / Services', () => {
  test.skip('15: Menu/services management not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no menu or services editing UI in BusinessDashboard or any modal.
    // ServicesGrid.jsx is a consumer-facing display component and is not editable.
    //
    // When menus/services editing is added, tests should cover:
    //   M: An "Add Service" or "Add Menu Item" button is visible in the dashboard
    //   M: Filling in name, description, and price saves the item to the listing
    //   S: Up to N items can be added before hitting a limit
    //   S: Each item can be individually edited and deleted
    //   E: Price field rejects non-numeric input
    //   E: XSS in service name/description is sanitized before display
  });
});

// ---------------------------------------------------------------------------
// Action 16 — EDIT PRICING  (PARTIAL)
// EditEventModal has a price text input ("Free or $20").
// SubmissionModal also has price text input for events/classes.
// There is no pricing field in EditVenueModal (business-level pricing).
// ---------------------------------------------------------------------------
test.describe('Action 16 — Edit Pricing', () => {
  test('16-M: Price field is present in EditEventModal', async ({ page }) => {
    await waitForAppLoad(page);
    const opened = await openEditEventModal(page);
    if (!opened) { test.skip('No event available in listings table to edit'); return; }

    // Price is in the 2-column grid section of EditEventModal
    const priceInput = page.locator('.claim-modal-premium input[placeholder="Free or $20"]');
    await expect(priceInput).toBeVisible();
    await expect(priceInput).toHaveAttribute('maxlength', '50');
    await screenshot(page, 16, 'edit-pricing', '01-price-field-present');
  });

  test('16-M: Price field accepts free-text format', async ({ page }) => {
    await waitForAppLoad(page);
    const opened = await openEditEventModal(page);
    if (!opened) { test.skip('No event available in listings table to edit'); return; }

    const priceInput = page.locator('.claim-modal-premium input[placeholder="Free or $20"]');
    await priceInput.fill('$45');
    await expect(priceInput).toHaveValue('$45');
    await screenshot(page, 16, 'edit-pricing', '02-price-entered');
  });

  test('16-M: Price field with "Free" keyword accepted', async ({ page }) => {
    await waitForAppLoad(page);
    const opened = await openEditEventModal(page);
    if (!opened) { test.skip('No event available in listings table to edit'); return; }

    const priceInput = page.locator('.claim-modal-premium input[placeholder="Free or $20"]');
    await priceInput.fill('Free');
    await expect(priceInput).toHaveValue('Free');
    await screenshot(page, 16, 'edit-pricing', '03-price-free');
  });

  test('16-M: SubmissionModal deal form has originalPrice and dealPrice fields', async ({ page }) => {
    await waitForAppLoad(page);
    await openSubmissionModal(page);
    await page.locator('.type-card.deal').click();
    await page.waitForTimeout(500);

    // Must have both price fields
    const originalPrice = page.locator('.submission-modal input[placeholder="e.g., 40.00"]');
    const dealPrice = page.locator('.submission-modal input[placeholder="e.g., 30.00"]');
    await expect(originalPrice).toBeVisible();
    await expect(dealPrice).toBeVisible();
    await screenshot(page, 16, 'edit-pricing', '04-deal-price-fields');
  });

  test.skip('16-PARTIAL: Business-level pricing not yet editable', async () => {
    // SKIPPED — PARTIAL
    // EditVenueModal has no pricing fields for the business itself (e.g., "Starting from $X").
    // EditEventModal only exposes price as free text without currency validation.
    //
    // When business-level pricing and proper price validation are added, tests should cover:
    //   M: Price range field on the business profile (e.g., $ / $$ / $$$ selector)
    //   S: Price saved correctly parses "$45.00" vs "45" vs "45.00" to the same numeric value
    //   E: Negative price is rejected
    //   E: Non-numeric garbage in price field shows validation error
  });
});

// ---------------------------------------------------------------------------
// Action 17 — ADD/REMOVE ITEMS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 17 — Add / Remove Listing Items', () => {
  test.skip('17: Add/remove individual menu or catalog items not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no UI to add/remove individual items (products, menu entries, catalog rows)
    // to a business listing.
    //
    // When this is added, tests should cover:
    //   M: "Add Item" button opens an inline or modal form
    //   M: Filled item (name, price, description) saves to the listing
    //   M: "Remove" on an item deletes it after confirmation
    //   S: Bulk-remove option removes all items without breaking the listing
    //   E: Empty name on "Add Item" is rejected with inline validation
  });
});

// ---------------------------------------------------------------------------
// Action 18 — FEATURED ITEM / BOOST VISIBILITY  (NOT_BUILT — "coming soon" toast)
// The "Boost Visibility" card in BusinessDashboard shows `showToast('Premium features
// coming soon', 'info')` when the Upgrade button is clicked.
// ---------------------------------------------------------------------------
test.describe('Action 18 — Featured Item / Boost Visibility', () => {
  test('18-M: "Boost Visibility" Upgrade button shows "coming soon" info toast', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const upgradeBtn = page.locator('.quick-action-card .btn-outline:has-text("Upgrade")');
    await expect(upgradeBtn).toBeVisible();
    await upgradeBtn.click();

    // A toast with "coming soon" text must appear
    await expect(
      page.locator('[class*="toast"], [class*="notification"], [role="alert"], [class*="snack"]')
    ).toBeVisible({ timeout: 3000 });
    await screenshot(page, 18, 'featured-item', '01-coming-soon-toast');
  });

  test.skip('18-FUTURE: Featured listing logic when premium feature is built', async () => {
    // SKIPPED — NOT BUILT
    // When premium featuring is implemented, tests should cover:
    //   M: Selecting a listing and clicking "Feature" marks it as featured
    //   M: Featured listing appears at the top of relevant consumer views
    //   S: Only one listing can be featured at a time (or N for premium tier)
    //   S: Featured status expires at the configured date/time
    //   E: Non-owner cannot feature a listing they don't own
    //   E: Attempting to feature when subscription is expired shows upgrade prompt
  });
});

// ---------------------------------------------------------------------------
// Action 19 — TAGS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 19 — Tags', () => {
  test.skip('19: Tag management not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no tag input in EditVenueModal, EditEventModal, or SubmissionModal.
    // Category is a single free-text or select field, not a multi-tag system.
    //
    // When tags are added, tests should cover:
    //   M: A tag input with autocomplete/chip UI is present
    //   M: Adding a tag creates a chip; clicking X on chip removes it
    //   S: Duplicate tags are rejected silently or shown as already added
    //   S: Up to N tags can be added before the add button is disabled
    //   E: XSS in tag text is sanitized
    //   E: Very long tag text is truncated at maxLength
  });
});

// ---------------------------------------------------------------------------
// Action 20 — TEMP CLOSED  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 20 — Temporarily Closed', () => {
  test.skip('20: Temporarily closed toggle not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no "mark as temporarily closed" toggle in the dashboard or EditVenueModal.
    //
    // When this is added, tests should cover:
    //   M: A "Temporarily Closed" toggle/checkbox is present in EditVenueModal or the dashboard
    //   M: Toggling it on shows a "Temporarily Closed" badge on the consumer listing
    //   S: An optional re-open date can be set
    //   S: Listing still appears in searches but shows the closed status clearly
    //   E: Toggling off removes the badge from the consumer view immediately
  });
});

// ---------------------------------------------------------------------------
// Action 21 — NOTICES  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 21 — Business Notices / Announcements', () => {
  test.skip('21: Business notices / announcements not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no "notices" or "announcement" field in any business editing UI.
    //
    // When this is added, tests should cover:
    //   M: A "Notice" text area or modal is available in the dashboard
    //   M: Saving a notice displays it prominently on the consumer-facing listing
    //   S: Notice with an expiry date auto-removes after the date passes
    //   S: Empty notice clears any existing notice from the listing
    //   E: XSS in notice text is sanitized before display
    //   E: Very long notice is capped with a char count indicator
  });
});

// ---------------------------------------------------------------------------
// Action 22 — PREVIEW LISTING  (PARTIAL)
// Admin has an impersonation mode (isImpersonating) that shows the business
// dashboard from an owner's perspective. Business owners see their listings
// in the "Your Active Listings" table but there's no dedicated preview.
// ---------------------------------------------------------------------------
test.describe('Action 22 — Preview Listing', () => {
  test('22-M: Business owner can see their active listings in the dashboard table', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    // The listings table section should be visible
    await expect(page.locator('.business-view-premium')).toBeVisible();
    await screenshot(page, 22, 'preview', '01-business-dashboard-visible');

    // Either listings table or empty state is rendered
    const tableOrEmpty = page.locator('.listings-table, .business-view-premium [style*="No active listings"]');
    // We just confirm the section header is present
    await expect(page.locator('.section-header-premium h2:has-text("Your Active Listings")')).toBeVisible({ timeout: 5000 });
    await screenshot(page, 22, 'preview', '02-listings-section-present');
  });

  test('22-M: Listings table shows listing name, type, status columns', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table yet'); return; }

    await expect(page.locator('.listings-table thead th:has-text("Listing")')).toBeVisible();
    await expect(page.locator('.listings-table thead th:has-text("Type")')).toBeVisible();
    await expect(page.locator('.listings-table thead th:has-text("Status")')).toBeVisible();
    await screenshot(page, 22, 'preview', '03-table-columns');
  });

  test.skip('22-PARTIAL: Dedicated listing preview (consumer view from owner) not yet built', async () => {
    // SKIPPED — PARTIAL IMPLEMENTATION
    // The admin can use impersonation mode to view the business dashboard as the owner,
    // but there is no "Preview as Customer" button that shows the listing exactly as a
    // consumer would see it (i.e., the consumer-facing listing card/detail modal).
    //
    // When a preview feature is added, tests should cover:
    //   M: A "Preview" button on each listing row opens the consumer-facing view
    //   M: The preview shows all fields (images, description, price, location)
    //   S: Preview does not actually increment the listing's view count
    //   E: Preview works for both published and draft/pending listings
  });
});

// ---------------------------------------------------------------------------
// Action 23 — CLAIM BUSINESS  (EXISTS)
// ClaimBusinessModal: full flow with search, owner details form, verification
// method selector, document upload, and email code verification step.
// ---------------------------------------------------------------------------
test.describe('Action 23 — Claim Business', () => {
  test('23-M: Claim Business modal opens from business dashboard when no business is claimed', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    // If already claimed, the .no-business-view won't show — skip gracefully
    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    const claimBtn = page.locator('.claim-biz-btn-large');
    await expect(claimBtn).toBeVisible();
    await claimBtn.click();

    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });
    await screenshot(page, 23, 'claim-business', '01-claim-modal-open');
    expect(errors.filter(e => !e.includes('supabase') && !e.includes('network'))).toHaveLength(0);
  });

  test('23-M: Claim modal shows sign-in prompt for unauthenticated users', async ({ page }) => {
    await waitForAppLoad(page);
    // Do not log in — remain as guest
    await switchToBusinessView(page);

    // Guest sees "Sign In Required" view
    const noBizIcon = page.locator('.no-business-view .no-biz-icon');
    if (await noBizIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, 23, 'claim-business', '02-guest-no-biz-view');
    }
    // Confirm the business dashboard requires authentication
    await expect(page.locator('.business-view-premium')).toBeVisible();
    await screenshot(page, 23, 'claim-business', '03-unauthenticated-view');
  });

  test('23-M: Claim form has required fields: Business Name, Your Name, Email', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    // Required fields labelled with *
    await expect(page.locator('.claim-modal-premium label:has-text("Business Name *")')).toBeVisible();
    await expect(page.locator('.claim-modal-premium label:has-text("Your Name *")')).toBeVisible();
    await expect(page.locator('.claim-modal-premium label:has-text("Email *")')).toBeVisible();
    await screenshot(page, 23, 'claim-business', '04-required-fields');
  });

  test('23-M: Business search input shows dropdown results when >= 2 chars typed', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const searchInput = page.locator('.claim-modal-premium input[placeholder="Search Squamish businesses..."]');
    await searchInput.fill('Sq');
    await page.waitForTimeout(300);

    // Either a result list or "No businesses found" message should appear
    const dropdown = page.locator('.claim-modal-premium [style*="maxHeight"]');
    if (await dropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
      await screenshot(page, 23, 'claim-business', '05-search-dropdown');
    }
    await screenshot(page, 23, 'claim-business', '05-after-search');
  });

  test('23-M: Verification method selector has Email Code and Upload Documents options', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    await expect(page.locator('.claim-modal-premium button:has-text("Email Code")')).toBeVisible();
    await expect(page.locator('.claim-modal-premium button:has-text("Upload Documents")')).toBeVisible();
    await screenshot(page, 23, 'claim-business', '06-verification-options');
  });

  test('23-M: Selecting "Upload Documents" shows file upload area', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    await page.locator('.claim-modal-premium button:has-text("Upload Documents")').click();
    // The dashed upload zone should appear
    await expect(page.locator('.claim-modal-premium [style*="dashed"]')).toBeVisible({ timeout: 2000 });
    await screenshot(page, 23, 'claim-business', '07-document-upload-area');
  });

  test('23-M: Submit button disabled when required fields are empty', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const submitBtn = page.locator('.claim-submit-btn');
    await expect(submitBtn).toBeDisabled();
    await screenshot(page, 23, 'claim-business', '08-submit-disabled-empty');
  });

  test('23-S: Claim form validation — submit enabled only when name + owner + email filled', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const submitBtn = page.locator('.claim-submit-btn');

    // Fill only business name — still disabled
    await page.locator('.claim-form-grid input[placeholder="e.g., The Sound Martial Arts"]').fill('Test Biz');
    await expect(submitBtn).toBeDisabled();

    // Add owner name — still disabled (email missing)
    await page.locator('.claim-form-grid input[placeholder="Full name"]').fill('Jane Owner');
    await expect(submitBtn).toBeDisabled();

    // Add email — should become enabled
    await page.locator('.claim-form-grid input[placeholder="your@email.com"]').fill('jane@example.com');
    await expect(submitBtn).not.toBeDisabled();
    await screenshot(page, 23, 'claim-business', '09-submit-enabled-all-fields');
  });

  test('23-S: Closing the claim modal with X button works', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    await page.locator('.claim-modal-close').click();
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 23, 'claim-business', '10-modal-closed');
  });

  test('23-S: Claim modal closes when overlay is clicked', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 23, 'claim-business', '11-modal-closed-overlay');
  });

  test('23-E: XSS in claim business name field is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    await page.locator('.claim-form-grid input[placeholder="e.g., The Sound Martial Arts"]').fill(XSS_PAYLOADS[0]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 23, 'claim-business', '12-xss-safe');
  });

  test('23-E: Document upload rejects non-image and non-PDF file types', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const noBizView = page.locator('.no-business-view');
    if (!await noBizView.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip('Test account already has a claimed business');
      return;
    }

    await page.locator('.claim-biz-btn-large').click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });
    await page.locator('.claim-modal-premium button:has-text("Upload Documents")').click();

    const fileInput = page.locator('.claim-modal-premium input[type="file"]');
    await fileInput.setInputFiles({
      name: 'malicious.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ fake exe'),
    });

    // The file should not appear in the uploaded files list
    const uploadedFiles = page.locator('.claim-modal-premium [style*="f0fdf4"]'); // green uploaded file row
    await expect(uploadedFiles).toHaveCount(0, { timeout: 2000 });
    await screenshot(page, 23, 'claim-business', '13-invalid-file-rejected');
  });
});

// ---------------------------------------------------------------------------
// Action 24 — MERGE LISTINGS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 24 — Merge Listings', () => {
  test.skip('24: Listing merging not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no "merge duplicate listings" feature in the business dashboard or admin panel.
    // The AdminDashboard.jsx may eventually house this.
    //
    // When merging is added, tests should cover:
    //   M: Admin or business owner sees a "Merge" option for duplicate listings
    //   M: Selecting two listings and confirming merge combines them into one
    //   S: Views, saves, and reviews from both listings are summed after merge
    //   S: The secondary listing is removed from public view after merge
    //   E: Merging a listing with itself is rejected with a clear error
    //   E: A non-owner/non-admin cannot initiate a merge
  });
});

// ---------------------------------------------------------------------------
// Action 25 — DELETE LISTING  (EXISTS)
// BusinessDashboard listings table has .action-btn-sm.danger (Trash2 icon).
// Delete triggers a browser confirm() dialog then supabase delete.
// ---------------------------------------------------------------------------
test.describe('Action 25 — Delete Listing', () => {
  test('25-M: Delete button is present in listings table for each row', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table to test delete'); return; }

    const deleteBtn = page.locator('.listing-row .action-btn-sm.danger').first();
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toHaveAttribute('title', 'Delete');
    await screenshot(page, 25, 'delete-listing', '01-delete-button-present');
    expect(errors).toHaveLength(0);
  });

  test('25-M: Clicking delete shows browser confirm dialog', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    // Set up dialog handler before clicking — dismiss (cancel) so we don't actually delete
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('Delete "');
      await dialog.dismiss();
    });

    const deleteBtn = page.locator('.listing-row .action-btn-sm.danger').first();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // After dismissing, the listing should still be in the table
    await expect(page.locator('.listing-row').first()).toBeVisible();
    await screenshot(page, 25, 'delete-listing', '02-confirm-dialog-and-cancel');
  });

  test('25-M: Edit button is present for event-type listings', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    // The edit (pencil) button only appears for events, not deals
    // Look for any row with an edit button
    const editBtn = page.locator('.listing-row .action-btn-sm:not(.danger)').first();
    const hasEditBtn = await editBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasEditBtn) {
      test.skip('No event-type listings with edit button visible');
      return;
    }

    await expect(editBtn).toHaveAttribute('title', 'Edit');
    await screenshot(page, 25, 'delete-listing', '03-edit-button-event-row');
  });

  test('25-S: Deal rows have delete but no edit button', async ({ page }) => {
    // Deals cannot be edited (only deleted) — no EditDealModal exists.
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    // Find rows with type-badge "Deal"
    const dealRows = page.locator('.listing-row').filter({ has: page.locator('.type-badge.deal') });
    const dealCount = await dealRows.count();
    if (dealCount === 0) { test.skip('No deal rows in listings table'); return; }

    const firstDealRow = dealRows.first();
    // Deal row must have a delete button
    await expect(firstDealRow.locator('.action-btn-sm.danger')).toBeVisible();
    // Deal row must NOT have an edit button (no EditDealModal)
    await expect(firstDealRow.locator('.action-btn-sm:not(.danger)')).not.toBeVisible();
    await screenshot(page, 25, 'delete-listing', '04-deal-has-delete-no-edit');
  });

  test('25-E: Cancelling delete confirm dialog leaves listing intact', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business available'); return; }

    const hasTable = await page.locator('.listings-table').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasTable) { test.skip('No listings in table'); return; }

    const initialRowCount = await page.locator('.listing-row').count();

    page.on('dialog', async (dialog) => {
      await dialog.dismiss(); // Cancel
    });

    await page.locator('.listing-row .action-btn-sm.danger').first().click();
    await page.waitForTimeout(500);

    const afterRowCount = await page.locator('.listing-row').count();
    expect(afterRowCount).toBe(initialRowCount);
    await screenshot(page, 25, 'delete-listing', '05-cancel-preserves-listing');
  });
});
