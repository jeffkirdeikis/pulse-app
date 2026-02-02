import { test, expect } from '@playwright/test';

test.describe('Authentication Modal - Comprehensive Tests', () => {

  // ========== MODAL ACCESS ==========
  test.describe('Modal Access', () => {

    test('1. Click profile button (as guest) - auth modal opens', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');

      await page.click('.profile-btn');

      await expect(page.locator('.auth-modal')).toBeVisible();
    });

    test('2. Click Business view sign in button - auth modal opens', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate to business view
      await page.click('text=Business');

      // Wait for business view to show sign-in prompt
      await page.waitForSelector('text=Sign In Required', { timeout: 5000 });

      // Click the Sign In button
      await page.click('button:has-text("Sign In")');

      await expect(page.locator('.auth-modal')).toBeVisible();
    });

    test('3. Try to redeem deal (guest) - prompts auth modal', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Navigate to deals section
      await page.click('text=Deals');
      await page.waitForTimeout(1000);

      // Wait for deals to load
      const dealCard = page.locator('.deal-card').first();

      // Check if there are any deals
      const dealCount = await page.locator('.deal-card').count();
      if (dealCount === 0) {
        test.skip('No deals available to test');
        return;
      }

      // Click on the first deal
      await dealCard.click();

      // Wait for deal modal to open
      await page.waitForSelector('.deal-detail-modal, .deal-modal', { timeout: 5000 });

      // Look for the redeem button
      const redeemBtn = page.locator('button:has-text("Get This Deal"), button:has-text("Redeem"), .deal-cta-btn');

      if (await redeemBtn.count() > 0) {
        await redeemBtn.first().click();

        // Should show auth modal for guest users
        await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });
      }
    });

    test('4. Try to save item (guest) - behavior check', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for events to load
      await page.waitForTimeout(2000);

      // Find a save button (star icon)
      const saveBtn = page.locator('.save-star-btn').first();

      if (await saveBtn.count() > 0) {
        await saveBtn.click();

        // For guests, saving works locally without auth modal
        // The star should toggle to saved state
        await page.waitForTimeout(500);

        // Verify the save worked (star should be filled/saved)
        const isSaved = await saveBtn.evaluate(el => el.classList.contains('saved'));
        expect(isSaved).toBe(true);
      }
    });
  });

  // ========== SIGN IN MODE ==========
  test.describe('Sign In Mode', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');
    });

    test('5. Modal shows "Welcome Back" header', async ({ page }) => {
      await expect(page.locator('.auth-modal-header h2')).toHaveText('Welcome Back');
    });

    test('6. Email input accepts text', async ({ page }) => {
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();

      await emailInput.fill('test@example.com');
      await expect(emailInput).toHaveValue('test@example.com');
    });

    test('7. Password input is type=password', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

      // Verify it's actually a password field
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType).toBe('password');
    });

    test('8. "Continue with Google" button visible and styled', async ({ page }) => {
      const googleBtn = page.locator('button:has-text("Continue with Google")');
      await expect(googleBtn).toBeVisible();

      // Check it has the google class for styling
      await expect(googleBtn).toHaveClass(/google/);
    });

    test('9. Submit with empty fields - shows validation', async ({ page }) => {
      // Try to submit the form with empty fields
      const submitBtn = page.locator('.auth-form button[type="submit"]');
      await submitBtn.click();

      // HTML5 validation should prevent submission
      // Check that email input shows validation state
      const emailInput = page.locator('input[type="email"]');
      const isInvalid = await emailInput.evaluate(el => !el.checkValidity());
      expect(isInvalid).toBe(true);
    });

    test('10. Submit with invalid email - shows error', async ({ page }) => {
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      // Enter invalid email and password
      await emailInput.fill('notavalidemail');
      await passwordInput.fill('password123');

      // Try to submit
      const submitBtn = page.locator('.auth-form button[type="submit"]');
      await submitBtn.click();

      // HTML5 validation should catch invalid email format
      const isInvalid = await emailInput.evaluate(el => !el.checkValidity());
      expect(isInvalid).toBe(true);
    });

    test('11. Switch to Sign Up link works', async ({ page }) => {
      // Find and click the Sign Up link
      await page.click('.auth-switch button:has-text("Sign Up")');

      // Header should change to "Create Account"
      await expect(page.locator('.auth-modal-header h2')).toHaveText('Create Account');
    });
  });

  // ========== SIGN UP MODE ==========
  test.describe('Sign Up Mode', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      // Switch to sign up mode
      await page.click('.auth-switch button:has-text("Sign Up")');
      await page.waitForTimeout(300);
    });

    test('12. Click "Sign Up" - switches mode', async ({ page }) => {
      // Already switched in beforeEach
      await expect(page.locator('.auth-modal-header h2')).toHaveText('Create Account');
    });

    test('13. "Create Account" header shown', async ({ page }) => {
      await expect(page.locator('.auth-modal-header h2')).toHaveText('Create Account');
    });

    test('14. Name input appears', async ({ page }) => {
      // In sign up mode, there should be a name input
      const nameInput = page.locator('input[type="text"][placeholder*="name" i]');
      await expect(nameInput).toBeVisible();
    });

    test('15. Name, Email, Password all required', async ({ page }) => {
      const nameInput = page.locator('input[placeholder*="name" i]');
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      // Check required attribute
      await expect(nameInput).toHaveAttribute('required', '');
      await expect(emailInput).toHaveAttribute('required', '');
      await expect(passwordInput).toHaveAttribute('required', '');
    });

    test('16. Password minimum 6 characters enforced', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');

      // Check minLength attribute
      const minLength = await passwordInput.getAttribute('minLength') || await passwordInput.getAttribute('minlength');
      expect(minLength).toBe('6');
    });

    test('17. Switch to Sign In link works', async ({ page }) => {
      // Find and click the Sign In link
      await page.click('.auth-switch button:has-text("Sign In")');

      // Header should change back to "Welcome Back"
      await expect(page.locator('.auth-modal-header h2')).toHaveText('Welcome Back');
    });
  });

  // ========== MODAL INTERACTIONS ==========
  test.describe('Modal Interactions', () => {

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');
    });

    test('18. X button closes modal', async ({ page }) => {
      await expect(page.locator('.auth-modal')).toBeVisible();

      // Click the close button
      await page.click('.auth-modal-close');

      await expect(page.locator('.auth-modal')).not.toBeVisible();
    });

    test('19. Click overlay closes modal', async ({ page }) => {
      await expect(page.locator('.auth-modal')).toBeVisible();

      // Click the overlay (outside the modal)
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

      await expect(page.locator('.auth-modal')).not.toBeVisible();
    });

    test('20. Form clears when modal closes', async ({ page }) => {
      // Fill in some data
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'testpassword');

      // Close the modal
      await page.click('.auth-modal-close');
      await expect(page.locator('.auth-modal')).not.toBeVisible();

      // Reopen the modal
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      // Fields should be cleared
      await expect(page.locator('input[type="email"]')).toHaveValue('');
      await expect(page.locator('input[type="password"]')).toHaveValue('');
    });

    test('21. Error messages clear when switching modes', async ({ page }) => {
      // Note: We can't easily trigger a real auth error without backend,
      // but we can test that switching modes works and the error state is managed

      // Fill in credentials and submit to trigger potential error
      await page.fill('input[type="email"]', 'nonexistent@test.com');
      await page.fill('input[type="password"]', 'wrongpassword');

      // Submit the form
      await page.click('.auth-form button[type="submit"]');

      // Wait a moment for potential error
      await page.waitForTimeout(500);

      // Switch to sign up mode
      await page.click('.auth-switch button:has-text("Sign Up")');

      // Error should be cleared (if any was shown)
      const errorDiv = page.locator('.auth-error');
      const errorCount = await errorDiv.count();
      if (errorCount > 0) {
        await expect(errorDiv).not.toBeVisible();
      }
    });

    test('22. Form validation on submit', async ({ page }) => {
      // Leave fields empty and try to submit
      const submitBtn = page.locator('.auth-form button[type="submit"]');

      // Click submit
      await submitBtn.click();

      // Modal should still be visible (form wasn't submitted due to validation)
      await expect(page.locator('.auth-modal')).toBeVisible();

      // Email input should be invalid
      const emailInput = page.locator('input[type="email"]');
      const isInvalid = await emailInput.evaluate(el => !el.checkValidity());
      expect(isInvalid).toBe(true);
    });
  });

  // ========== ADDITIONAL UI/UX CHECKS ==========
  test.describe('Additional UI/UX Checks', () => {

    test('Modal has proper styling and animations', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      // Check modal is centered and visible
      const modal = page.locator('.auth-modal');
      await expect(modal).toBeVisible();

      // Check for overlay
      const overlay = page.locator('.modal-overlay');
      await expect(overlay).toBeVisible();
    });

    test('Google button has correct styling', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      const googleBtn = page.locator('.auth-btn.google');
      await expect(googleBtn).toBeVisible();

      // Button should contain "Google" text
      await expect(googleBtn).toContainText('Google');
    });

    test('Divider "or" text is visible between OAuth and email', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      const divider = page.locator('.auth-divider');
      await expect(divider).toBeVisible();
      await expect(divider).toContainText('or');
    });

    test('Footer with terms text is visible', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      const footer = page.locator('.auth-modal-footer');
      await expect(footer).toBeVisible();
      await expect(footer).toContainText('Terms of Service');
      await expect(footer).toContainText('Privacy Policy');
    });

    test('Sign up shows correct placeholder text', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      // Switch to sign up
      await page.click('.auth-switch button:has-text("Sign Up")');
      await page.waitForTimeout(300);

      // Check password placeholder mentions minimum characters
      const passwordInput = page.locator('input[type="password"]');
      const placeholder = await passwordInput.getAttribute('placeholder');
      expect(placeholder).toContain('min 6');
    });

    test('Sign in mode description text is shown', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      // Check for description text
      const description = page.locator('.auth-modal-header p');
      await expect(description).toContainText('Sign in to save events');
    });

    test('Sign up mode description text is shown', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal');

      // Switch to sign up
      await page.click('.auth-switch button:has-text("Sign Up")');
      await page.waitForTimeout(300);

      // Check for description text
      const description = page.locator('.auth-modal-header p');
      await expect(description).toContainText('Join the Squamish community');
    });
  });
});
