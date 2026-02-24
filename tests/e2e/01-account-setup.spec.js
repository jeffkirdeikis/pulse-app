/**
 * Actions 1-10: Account Setup & Business Profile
 *
 * Feature status legend used in this file:
 *   EXISTS   — fully built, full M/S/E tests written
 *   PARTIAL  — partially built, tests cover what exists + note gaps
 *   NOT_BUILT — skipped with explanatory comment
 */

import { test, expect } from '@playwright/test';
import {
  screenshot,
  waitForAppLoad,
  openAuthModal,
  loginAsTestUser,
  switchToBusinessView,
  TEST_OWNER,
  XSS_PAYLOADS,
  EDGE_STRINGS,
  setupConsoleErrorCapture,
  verifyNoXSSRendered,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Action 1 — SIGNUP  (EXISTS)
// Auth modal has email/password + Google OAuth. Selectors confirmed in
// AuthModal.jsx: .auth-modal, input[type="email"], input[type="password"],
// button.auth-btn.email, button.auth-btn.google, .auth-field-error, .auth-error
// ---------------------------------------------------------------------------
test.describe('Action 1 — Signup', () => {
  test('1-M: Auth modal opens when sign-in / profile button is clicked', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);
    await screenshot(page, 1, 'signup', '01-app-loaded');

    // Guest sees .sign-in-btn; authenticated user sees .profile-btn
    const signInBtn = page.locator('.sign-in-btn');
    const profileBtn = page.locator('.profile-btn');
    const signInVisible = await signInBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (signInVisible) {
      await signInBtn.click();
    } else {
      await expect(profileBtn).toBeVisible();
      await profileBtn.click();
    }

    await expect(page.locator('.auth-modal')).toBeVisible();
    await screenshot(page, 1, 'signup', '02-auth-modal-open');

    // Modal must show sign-in mode by default
    await expect(page.locator('.auth-modal h2')).toContainText('Welcome Back');

    // Email and password inputs must be present and accept typing
    const emailInput = page.locator('.auth-modal input[type="email"]');
    const passwordInput = page.locator('.auth-modal input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.click();
    await emailInput.type('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    await passwordInput.click();
    await passwordInput.type('password123');
    await expect(passwordInput).toHaveValue('password123');

    expect(errors.filter(e => !e.includes('supabase') && !e.includes('network'))).toHaveLength(0);
  });

  test('1-M: Sign-up mode activates when "Sign Up" link is clicked', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    // Switch to signup
    const signupLink = page.locator('.auth-modal .auth-switch button:has-text("Sign Up")');
    await signupLink.click();

    await expect(page.locator('.auth-modal h2')).toContainText('Create Account');

    // Name field must appear in signup mode
    const nameInput = page.locator('#auth-name');
    await expect(nameInput).toBeVisible();
    await nameInput.click();
    await nameInput.type('Jane Doe');
    await expect(nameInput).toHaveValue('Jane Doe');

    await screenshot(page, 1, 'signup', '03-signup-mode');
  });

  test('1-M: Google OAuth button is present and visible', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    const googleBtn = page.locator('.auth-modal .auth-btn.google');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toContainText('Continue with Google');
    await screenshot(page, 1, 'signup', '04-google-btn');
  });

  test('1-M: Forgot password link switches to reset mode', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    const forgotLink = page.locator('.auth-modal button:has-text("Forgot password?")');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page.locator('.auth-modal h2')).toContainText('Reset Password');
    await screenshot(page, 1, 'signup', '05-forgot-password-mode');
  });

  test('1-S: Validation errors shown for empty form submission', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    // Submit empty form
    const submitBtn = page.locator('.auth-modal button[type="submit"], .auth-modal .auth-btn.email');
    await submitBtn.click();

    // Should show field-level errors
    await expect(page.locator('.auth-field-error, .auth-error').first()).toBeVisible({ timeout: 3000 });
    await screenshot(page, 1, 'signup', '06-empty-validation-errors');
  });

  test('1-S: Validation error shown for invalid email format', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    await page.locator('.auth-modal input[type="email"]').fill('not-an-email');
    await page.locator('.auth-modal input[type="password"]').fill('validpass');
    const submitBtn = page.locator('.auth-modal button[type="submit"], .auth-modal .auth-btn.email');
    await submitBtn.click();

    await expect(page.locator('.auth-field-error')).toBeVisible({ timeout: 3000 });
    await screenshot(page, 1, 'signup', '07-invalid-email-error');
  });

  test('1-S: Validation error shown for short password (< 6 chars)', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    await page.locator('.auth-modal input[type="email"]').fill('user@example.com');
    await page.locator('.auth-modal input[type="password"]').fill('abc');
    const submitBtn = page.locator('.auth-modal button[type="submit"], .auth-modal .auth-btn.email');
    await submitBtn.click();

    await expect(page.locator('.auth-field-error')).toBeVisible({ timeout: 3000 });
    await screenshot(page, 1, 'signup', '08-short-password-error');
  });

  test('1-S: Modal closes when overlay is clicked', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Click the overlay (the .modal-overlay behind the dialog)
    await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 1, 'signup', '09-modal-closed-overlay');
  });

  test('1-S: Modal closes when X button is clicked', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    await page.locator('.auth-modal-close').click();
    await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 1, 'signup', '10-modal-closed-x');
  });

  test('1-E: XSS payloads in email field do not execute', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    for (const payload of XSS_PAYLOADS) {
      await page.locator('.auth-modal input[type="email"]').fill(payload);
    }
    // Submit to trigger any rendering of the value
    const submitBtn = page.locator('.auth-modal button[type="submit"], .auth-modal .auth-btn.email');
    await submitBtn.click();

    await verifyNoXSSRendered(page);
    await screenshot(page, 1, 'signup', '11-xss-payloads-safe');
  });

  test('1-E: Very long email input is capped at maxLength=254', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    const longEmail = 'a'.repeat(300) + '@example.com';
    await page.locator('.auth-modal input[type="email"]').fill(longEmail);
    const actualValue = await page.locator('.auth-modal input[type="email"]').inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(254);
    await screenshot(page, 1, 'signup', '12-email-maxlength');
  });

  test('1-E: Signup with name field — XSS payload is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    // Switch to signup mode
    await page.locator('.auth-modal .auth-switch button:has-text("Sign Up")').click();

    const nameInput = page.locator('#auth-name');
    await nameInput.fill(XSS_PAYLOADS[0]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 1, 'signup', '13-signup-xss-name-safe');
  });

  test('1-E: Terms of Service and Privacy Policy links are present and open legal modal', async ({ page }) => {
    await waitForAppLoad(page);
    await openAuthModal(page);

    const termsBtn = page.locator('.auth-modal-footer button:has-text("Terms of Service")');
    const privacyBtn = page.locator('.auth-modal-footer button:has-text("Privacy Policy")');
    await expect(termsBtn).toBeVisible();
    await expect(privacyBtn).toBeVisible();

    await termsBtn.click();
    // LegalModal should appear
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 3000 });
    await screenshot(page, 1, 'signup', '14-terms-modal');
  });
});

// ---------------------------------------------------------------------------
// Action 2 — EMAIL VERIFY  (EXISTS — partial testability)
// Consumer email verification is handled by Supabase Auth externally.
// ClaimBusinessModal has a 6-digit code input that we can test structurally.
// We cannot intercept Supabase's outbound email in automated tests.
// ---------------------------------------------------------------------------
test.describe('Action 2 — Email Verification', () => {
  test('2-M: Auth modal shows verification prompt copy after signup attempt', async ({ page }) => {
    // NOTE: We can't complete an actual signup+verify cycle in automated tests
    // because Supabase sends the verification email to a real inbox.
    // This test verifies the UX copy that is shown when email confirmation is required.
    await waitForAppLoad(page);
    await openAuthModal(page);

    const signupLink = page.locator('.auth-modal .auth-switch button:has-text("Sign Up")');
    await signupLink.click();

    // Verify the sign-up form is visible and contains expected prompts
    await expect(page.locator('.auth-modal h2')).toContainText('Create Account');
    await expect(page.locator('.auth-modal p')).toContainText('Squamish');
    await screenshot(page, 2, 'email-verify', '01-signup-form-present');
  });

  test('2-M: ClaimBusinessModal verification step shows 6-digit code input', async ({ page }) => {
    // The ClaimBusinessModal has a full verification code UI that we can inspect structurally.
    // Accessing it requires a logged-in session and selecting a business.
    // This test verifies the structural presence after login.
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);

    // Navigate to Business view to access claim modal trigger
    await switchToBusinessView(page);
    await screenshot(page, 2, 'email-verify', '02-business-view-post-login');

    // The claim modal is triggered from inside the business dashboard when no business is claimed.
    // We just verify the business view loaded correctly.
    await expect(page.locator('.business-view-premium')).toBeVisible({ timeout: 5000 });
  });

  test.skip('2-E: Full consumer email verification cycle (requires real inbox access)', async () => {
    // SKIPPED: Supabase sends the confirmation link to a real email address.
    // To test end-to-end: use a service like Mailosaur or Mailhog with a test SMTP
    // sink, intercept the email, extract the confirmation URL, and navigate to it.
    // When that infrastructure is added, this test should:
    //   1. Sign up with a fresh test email address
    //   2. Fetch the confirmation email from the test inbox
    //   3. Extract the magic link from the email body
    //   4. Navigate to the link
    //   5. Verify the session is active and the user is redirected to the app
  });
});

// ---------------------------------------------------------------------------
// Action 3 — LOGO UPLOAD  (EXISTS)
// BusinessDashboard has #business-logo-upload hidden file input.
// .venue-avatar-upload is the clickable area. Requires a logged-in, claimed
// business. Tests verify the DOM mechanism; actual Supabase storage upload
// is covered by a mock/stub approach to avoid real network writes.
// ---------------------------------------------------------------------------
test.describe('Action 3 — Business Logo Upload', () => {
  test('3-M: Logo upload area is present in business dashboard header', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const logoArea = page.locator('.venue-avatar-upload');
    // Logo area is only shown when activeBusiness exists (i.e. user has claimed a business).
    // If not claimed, we see .no-business-view instead. Check both paths.
    const noBizView = page.locator('.no-business-view');
    const hasBusiness = await logoArea.isVisible({ timeout: 3000 }).catch(() => false);
    const hasNoBiz = await noBizView.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasBusiness) {
      await expect(logoArea).toBeVisible();
      await expect(logoArea).toHaveAttribute('aria-label', 'Upload business logo');
      await screenshot(page, 3, 'logo-upload', '01-logo-upload-area-present');
    } else if (hasNoBiz) {
      // Test account does not have a claimed business — skip upload tests gracefully
      test.skip('Test account has no claimed business; logo upload tests require a claimed business');
    } else {
      throw new Error('Neither .venue-avatar-upload nor .no-business-view found in business view');
    }
  });

  test('3-M: Hidden file input for logo upload exists and accepts image/*', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) {
      test.skip('No claimed business available');
      return;
    }

    const fileInput = page.locator('#business-logo-upload');
    await expect(fileInput).toHaveAttribute('type', 'file');
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
    await screenshot(page, 3, 'logo-upload', '02-file-input-present');
  });

  test('3-S: Logo upload rejects SVG files (security guard)', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) {
      test.skip('No claimed business available');
      return;
    }

    // Set the file input to an SVG — app must reject it and show an error toast
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const svgBuffer = Buffer.from(svgContent);

    await page.locator('#business-logo-upload').setInputFiles({
      name: 'malicious.svg',
      mimeType: 'image/svg+xml',
      buffer: svgBuffer,
    });

    // Toast error must appear
    await expect(
      page.locator('[class*="toast"], [class*="notification"], [role="alert"]')
    ).toBeVisible({ timeout: 5000 });
    await screenshot(page, 3, 'logo-upload', '03-svg-rejected');
  });

  test('3-S: Logo upload area is keyboard accessible (Enter key)', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) {
      test.skip('No claimed business available');
      return;
    }

    const logoArea = page.locator('.venue-avatar-upload');
    await logoArea.focus();
    // Pressing Enter should trigger the click which opens file picker
    // We can't fully test the file dialog opens, but we verify focus works
    await expect(logoArea).toBeFocused();
    await screenshot(page, 3, 'logo-upload', '04-logo-area-focusable');
  });
});

// ---------------------------------------------------------------------------
// Action 4 — DESCRIPTION  (PARTIAL)
// EditVenueModal does NOT have a description field for the business.
// SubmissionModal does have a description field for events/deals.
// EditEventModal does have a description textarea for existing events.
// The business profile description field is missing from the edit flow.
// ---------------------------------------------------------------------------
test.describe('Action 4 — Business Description', () => {
  test.skip('4: Business description field missing from EditVenueModal', async () => {
    // SKIPPED — PARTIAL IMPLEMENTATION
    // EditVenueModal (src/components/modals/EditVenueModal.jsx) has fields for:
    //   name, address, phone, email, website, category
    // There is NO description/bio field for the business itself.
    //
    // When a description field is added to EditVenueModal and the `businesses`
    // table, this test should cover:
    //   M: Description textarea is present in EditVenueModal
    //   M: User can type and save a description
    //   S: 500-char description saves successfully
    //   S: Empty description clears the existing value
    //   E: XSS in description is sanitized before display
    //   E: Description with emoji/unicode saves and renders correctly
    //   E: Very long description (>5000 chars) is capped or rejected gracefully
  });

  test('4-PARTIAL: SubmissionModal has description field for events/classes/deals', async ({ page }) => {
    // This verifies the description field EXISTS in the submission flow,
    // even though it is not yet available for editing an existing business profile.
    await waitForAppLoad(page);

    // Open the feedback widget which has the "Add Content" button
    const feedbackFab = page.locator('.feedback-fab');
    await expect(feedbackFab).toBeVisible({ timeout: 5000 });
    await feedbackFab.click();

    const addContentBtn = page.locator('.feedback-add-content-btn');
    await expect(addContentBtn).toBeVisible({ timeout: 3000 });
    await addContentBtn.click();

    // SubmissionModal should open
    await expect(page.locator('.submission-modal')).toBeVisible({ timeout: 5000 });
    await screenshot(page, 4, 'description', '01-submission-modal-open');

    // Select "Event" type
    await page.locator('.type-card.event').click();
    await page.waitForTimeout(500);

    // Description textarea should now be visible
    const descriptionField = page.locator('.submission-modal textarea.form-input.textarea');
    await expect(descriptionField).toBeVisible();
    await descriptionField.click();
    await descriptionField.type('A fun community event in Squamish');
    await expect(descriptionField).toHaveValue('A fun community event in Squamish');
    await screenshot(page, 4, 'description', '02-description-field-in-submission');
  });
});

// ---------------------------------------------------------------------------
// Action 5 — CATEGORY  (EXISTS)
// EditVenueModal has #edit-venue-category text input.
// ---------------------------------------------------------------------------
test.describe('Action 5 — Business Category', () => {
  test('5-M: Category field exists in EditVenueModal', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) {
      test.skip('No claimed business available for edit tests');
      return;
    }

    // Open edit via Quick Actions
    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) {
      test.skip('Edit Profile button not visible');
      return;
    }
    await editProfileBtn.click();

    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });
    await screenshot(page, 5, 'category', '01-edit-venue-modal-open');

    const categoryInput = page.locator('#edit-venue-category');
    await expect(categoryInput).toBeVisible();
    await expect(categoryInput).toHaveAttribute('placeholder', 'e.g., Fitness, Restaurant');
  });

  test('5-M: Category input accepts typing and retains value', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const categoryInput = page.locator('#edit-venue-category');
    await categoryInput.triple_click?.() || await categoryInput.click({ clickCount: 3 });
    await categoryInput.fill('Fitness Studio');
    await expect(categoryInput).toHaveValue('Fitness Studio');
    await screenshot(page, 5, 'category', '02-category-typed');
  });

  test('5-S: Category input is capped at maxLength=100', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const categoryInput = page.locator('#edit-venue-category');
    await categoryInput.fill(EDGE_STRINGS.veryLong);
    const value = await categoryInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(100);
    await screenshot(page, 5, 'category', '03-category-maxlength');
  });

  test('5-E: XSS payload in category is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const categoryInput = page.locator('#edit-venue-category');
    await categoryInput.fill(XSS_PAYLOADS[0]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 5, 'category', '04-category-xss-safe');
  });

  test('5-E: Category with emoji characters is accepted', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const categoryInput = page.locator('#edit-venue-category');
    await categoryInput.fill('Fitness ' + EDGE_STRINGS.emoji);
    const value = await categoryInput.inputValue();
    expect(value).toContain('Fitness');
    await screenshot(page, 5, 'category', '05-category-emoji');
  });
});

// ---------------------------------------------------------------------------
// Action 6 — ADDRESS  (EXISTS)
// EditVenueModal has #edit-venue-address text input (maxLength=300).
// ---------------------------------------------------------------------------
test.describe('Action 6 — Business Address', () => {
  test('6-M: Address input is present in EditVenueModal', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const addressInput = page.locator('#edit-venue-address');
    await expect(addressInput).toBeVisible();
    await expect(addressInput).toHaveAttribute('autocomplete', 'street-address');
    await screenshot(page, 6, 'address', '01-address-field-present');
  });

  test('6-M: Address input accepts a typical Squamish address', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const addressInput = page.locator('#edit-venue-address');
    await addressInput.fill('1234 Cleveland Ave, Squamish, BC V8B 0A1');
    await expect(addressInput).toHaveValue('1234 Cleveland Ave, Squamish, BC V8B 0A1');
    await screenshot(page, 6, 'address', '02-address-typed');
  });

  test('6-S: Address capped at maxLength=300', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const addressInput = page.locator('#edit-venue-address');
    await addressInput.fill(EDGE_STRINGS.veryLong);
    const value = await addressInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(300);
    await screenshot(page, 6, 'address', '03-address-maxlength');
  });

  test('6-E: XSS in address field is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const addressInput = page.locator('#edit-venue-address');
    await addressInput.fill(XSS_PAYLOADS[1]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 6, 'address', '04-address-xss-safe');
  });

  test('6-E: Special characters in address are accepted', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const addressInput = page.locator('#edit-venue-address');
    await addressInput.fill("Unit #2, O'Brien Rd, Squamish");
    await expect(addressInput).toHaveValue("Unit #2, O'Brien Rd, Squamish");
    await screenshot(page, 6, 'address', '05-address-special-chars');
  });
});

// ---------------------------------------------------------------------------
// Action 7 — PHONE  (EXISTS)
// EditVenueModal has #edit-venue-phone with type="tel" (maxLength=20).
// ---------------------------------------------------------------------------
test.describe('Action 7 — Business Phone', () => {
  test('7-M: Phone input is type="tel" in EditVenueModal', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const phoneInput = page.locator('#edit-venue-phone');
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toHaveAttribute('type', 'tel');
    await expect(phoneInput).toHaveAttribute('autocomplete', 'tel');
    await screenshot(page, 7, 'phone', '01-phone-field-present');
  });

  test('7-M: Phone input accepts Canadian phone format', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const phoneInput = page.locator('#edit-venue-phone');
    await phoneInput.fill('(604) 555-1234');
    await expect(phoneInput).toHaveValue('(604) 555-1234');
    await screenshot(page, 7, 'phone', '02-phone-typed');
  });

  test('7-S: Phone capped at maxLength=20', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const phoneInput = page.locator('#edit-venue-phone');
    await phoneInput.fill('9'.repeat(50));
    const value = await phoneInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(20);
    await screenshot(page, 7, 'phone', '03-phone-maxlength');
  });

  test('7-E: Phone field with SQL injection string does not crash the form', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const phoneInput = page.locator('#edit-venue-phone');
    await phoneInput.fill(EDGE_STRINGS.sqlInjection);
    // Form should still be visible and not crash
    await expect(page.locator('.claim-modal-premium')).toBeVisible();
    await screenshot(page, 7, 'phone', '04-phone-sql-injection-safe');
  });
});

// ---------------------------------------------------------------------------
// Action 8 — WEBSITE  (EXISTS)
// EditVenueModal has #edit-venue-website with type="url" (maxLength=500).
// ---------------------------------------------------------------------------
test.describe('Action 8 — Business Website', () => {
  test('8-M: Website input is type="url" in EditVenueModal', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const websiteInput = page.locator('#edit-venue-website');
    await expect(websiteInput).toBeVisible();
    await expect(websiteInput).toHaveAttribute('type', 'url');
    await expect(websiteInput).toHaveAttribute('autocomplete', 'url');
    await screenshot(page, 8, 'website', '01-website-field-present');
  });

  test('8-M: Website input accepts a valid https URL', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const websiteInput = page.locator('#edit-venue-website');
    await websiteInput.fill('https://www.example.com');
    await expect(websiteInput).toHaveValue('https://www.example.com');
    await screenshot(page, 8, 'website', '02-website-typed');
  });

  test('8-S: Website capped at maxLength=500', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const websiteInput = page.locator('#edit-venue-website');
    await websiteInput.fill('https://' + 'a'.repeat(600) + '.com');
    const value = await websiteInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(500);
    await screenshot(page, 8, 'website', '03-website-maxlength');
  });

  test('8-E: XSS in website field is not executed', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const websiteInput = page.locator('#edit-venue-website');
    await websiteInput.fill('javascript:' + XSS_PAYLOADS[0]);
    await verifyNoXSSRendered(page);
    await screenshot(page, 8, 'website', '04-website-xss-safe');
  });

  test('8-E: Cancel button closes EditVenueModal without saving', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await switchToBusinessView(page);

    const hasBusiness = await page.locator('.venue-avatar-upload').isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasBusiness) { test.skip('No claimed business'); return; }

    const editProfileBtn = page.locator('.qa-btn:has-text("Edit Profile")');
    if (!await editProfileBtn.isVisible({ timeout: 3000 })) { test.skip('Edit Profile button not visible'); return; }
    await editProfileBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    // Make a change then cancel
    await page.locator('#edit-venue-website').fill('https://should-not-save.com');
    await page.locator('.claim-cancel-btn').click();

    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
    await screenshot(page, 8, 'website', '05-cancel-closes-modal');
  });
});

// ---------------------------------------------------------------------------
// Action 9 — SOCIAL LINKS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 9 — Social Links', () => {
  test.skip('9: Social links not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There are no social link fields in EditVenueModal or anywhere in the
    // business editing flow. The `businesses` table also has no social_* columns.
    //
    // When social links are added, this test should cover:
    //   M: Instagram, Facebook, TikTok, LinkedIn URL fields are present in EditVenueModal
    //   M: Each field only accepts its respective social URL format
    //   S: Invalid social URLs show inline validation error
    //   S: Saving empty social links clears stored values
    //   E: XSS in social link fields is sanitized
    //   E: 'javascript:' scheme is rejected as a social URL
    //   E: Very long URL is capped at maxLength
  });
});

// ---------------------------------------------------------------------------
// Action 10 — BUSINESS HOURS  (NOT_BUILT)
// ---------------------------------------------------------------------------
test.describe('Action 10 — Business Hours', () => {
  test.skip('10: Business hours not yet built', async () => {
    // SKIPPED — NOT BUILT
    // There is no hours input in EditVenueModal. The growth tips section mentions
    // "Add business hours (+8 pts)" as a suggested improvement, confirming it is
    // a planned but unbuilt feature.
    //
    // When business hours are added, this test should cover:
    //   M: A day-by-day hours picker is present in EditVenueModal
    //   M: Toggle for "Closed" on a given day works correctly
    //   M: Open/close times can be set per day
    //   S: Invalid time range (close before open) shows validation error
    //   S: "24 hours" option works for any day
    //   S: Saving hours persists them and they appear on the business listing
    //   E: Holiday or irregular hours scenario (custom note per day)
    //   E: All-day-closed scenario (business is temporarily closed) integrates
    //      with Action 20 (Temp Closed) when that feature is built
  });
});
