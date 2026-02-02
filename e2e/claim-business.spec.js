import { test, expect } from '@playwright/test';

test.describe('Claim Business Form', () => {
  test('should open claim business modal from Business view (authenticated)', async ({ page }) => {
    await page.goto('/');

    // Switch to Business view
    await page.click('.view-switcher button:has-text("Business")');

    // Wait for view to load
    await page.waitForTimeout(1000);

    // For guests, should show sign-in required
    // For authenticated users without businesses, should show claim button
    const signInRequired = page.locator('text=Sign In Required');
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim Your Business")');

    if (await signInRequired.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Guest user - click the sign in button which should open auth modal
      await page.click('.claim-biz-btn-large');
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });
    } else if (await claimBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Authenticated user without businesses
      await claimBtn.click();
      await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });
    } else {
      // User already has claimed businesses - different UI shown
      test.skip();
    }
  });

  test('should open claim business modal from profile menu', async ({ page }) => {
    await page.goto('/');

    // Click profile button
    await page.click('.profile-btn');

    // Wait for menu or auth modal
    await page.waitForTimeout(500);

    // If auth modal appears (guest), we can test that path
    const authModal = page.locator('.auth-modal');
    if (await authModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Guest user - auth modal is expected behavior
      await expect(authModal).toBeVisible();
      return;
    }

    // Look for profile menu with claim business option
    const claimMenuItem = page.locator('.profile-menu-item:has-text("Claim"), .profile-menu-item:has-text("Business")');
    if (await claimMenuItem.count() > 0) {
      await claimMenuItem.first().click();
      await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should close claim modal on X button click', async ({ page }) => {
    await page.goto('/');
    await page.click('.view-switcher button:has-text("Business")');
    await page.waitForTimeout(1000);

    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim Your Business")');
    if (await claimBtn.count() === 0) {
      test.skip();
      return;
    }

    await claimBtn.click();
    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });

    // Click X button
    await page.click('.claim-modal-close');

    // Modal should close
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
  });

  test('claim modal should have form fields', async ({ page }) => {
    await page.goto('/');
    await page.click('.view-switcher button:has-text("Business")');
    await page.waitForTimeout(1000);

    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim Your Business")');
    if (await claimBtn.count() === 0) {
      test.skip();
      return;
    }

    await claimBtn.click();
    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });

    // Check for form inputs
    await expect(page.locator('.claim-modal-premium input').first()).toBeVisible();
    await expect(page.locator('.claim-modal-premium select')).toBeVisible();
  });

  test('claim modal form should reset on close', async ({ page }) => {
    await page.goto('/');
    await page.click('.view-switcher button:has-text("Business")');
    await page.waitForTimeout(1000);

    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim Your Business")');
    if (await claimBtn.count() === 0) {
      test.skip();
      return;
    }

    await claimBtn.click();
    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });

    // Fill in data
    const firstInput = page.locator('.claim-modal-premium input').first();
    await firstInput.fill('Test Business');

    // Close modal
    await page.click('.claim-modal-close');
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });

    // Reopen
    await claimBtn.click();
    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });

    // Should be reset
    await expect(page.locator('.claim-modal-premium input').first()).toHaveValue('');
  });
});
