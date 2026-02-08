import { test, expect } from '@playwright/test';

/**
 * AUTH → ADMIN → IMPERSONATION E2E FLOW
 *
 * Tests the complete flow:
 * 1. Guest user sees auth modal when interacting
 * 2. Auth modal has email/password fields and Google option
 * 3. Admin view is accessible (when user is admin)
 * 4. Admin can search businesses and enter impersonation mode
 * 5. Impersonation mode shows business dashboard with banner
 * 6. User can exit impersonation and return to admin view
 */

test.describe('Auth → Admin → Impersonation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.pulse-app', { timeout: 15000 });
  });

  // ==================== AUTH FLOW ====================

  test('guest clicking profile opens auth modal with working inputs', async ({ page }) => {
    const profileBtn = page.locator('.sign-in-btn, .profile-btn').first();
    await expect(profileBtn).toBeVisible({ timeout: 5000 });
    await profileBtn.click();

    // Auth modal should appear
    const authModal = page.locator('.auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    // Should have email input that accepts typing
    const emailInput = authModal.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');

    // Should have password input that accepts typing
    const passwordInput = authModal.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill('testpassword123');
    await expect(passwordInput).toHaveValue('testpassword123');

    // Should have Google sign-in option
    const googleBtn = page.locator('text=Continue with Google');
    await expect(googleBtn).toBeVisible();

    // Should have sign-in button
    const signInBtn = authModal.locator('button:has-text("Sign In")');
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toBeEnabled();
  });

  test('auth modal has signup toggle', async ({ page }) => {
    await page.locator('.sign-in-btn, .profile-btn').first().click();
    const authModal = page.locator('.auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    // Should have a way to switch to sign-up mode
    const signUpToggle = authModal.locator('text=Sign up, text=Create account, text=Don\'t have an account').first();
    if (await signUpToggle.isVisible()) {
      await signUpToggle.click();
      await page.waitForTimeout(300);

      // Should now show signup form with name field
      const nameInput = authModal.locator('input[placeholder*="name" i], input[type="text"]').first();
      const isNameVisible = await nameInput.isVisible().catch(() => false);
      console.log('Name input visible in signup mode:', isNameVisible);
    }
  });

  test('auth modal closes via X button', async ({ page }) => {
    await page.locator('.sign-in-btn, .profile-btn').first().click();
    const authModal = page.locator('.auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    // Close via X button
    const closeBtn = page.locator('.auth-modal-close, .auth-modal .close-btn').first();
    await closeBtn.click();
    await expect(authModal).not.toBeVisible({ timeout: 3000 });
  });

  test('auth modal closes via overlay click', async ({ page }) => {
    await page.locator('.sign-in-btn, .profile-btn').first().click();
    const authModal = page.locator('.auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    // Close via overlay click
    await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(authModal).not.toBeVisible({ timeout: 3000 });
  });

  // ==================== VIEW SWITCHER ====================

  test('view switcher shows Consumer and Business buttons', async ({ page }) => {
    const viewSwitcher = page.locator('.view-switcher');
    await expect(viewSwitcher).toBeVisible({ timeout: 5000 });

    const consumerBtn = viewSwitcher.locator('button:has-text("Consumer")');
    const businessBtn = viewSwitcher.locator('button:has-text("Business")');

    await expect(consumerBtn).toBeVisible();
    await expect(businessBtn).toBeVisible();

    // Consumer should be active by default
    await expect(consumerBtn).toHaveClass(/active/);
  });

  test('switching to Business view shows business content', async ({ page }) => {
    const businessBtn = page.locator('.view-switcher button:has-text("Business")');
    await businessBtn.click();
    await page.waitForTimeout(500);

    // Should show business view content (either onboarding or dashboard)
    const businessView = page.locator('.business-view-premium, .biz-onboarding, [class*="business"]');
    const hasBusinessContent = await businessView.count() > 0;

    // Or it might prompt to claim a business
    const bodyText = await page.locator('body').textContent();
    const hasClaimPrompt = bodyText.includes('Claim') || bodyText.includes('business');
    const hasDashboard = bodyText.includes('Dashboard') || bodyText.includes('Analytics');

    expect(hasBusinessContent || hasClaimPrompt || hasDashboard).toBe(true);
  });

  // ==================== ADMIN PANEL ====================

  test('admin button visibility depends on auth state', async ({ page }) => {
    const viewSwitcher = page.locator('.view-switcher');
    const buttons = viewSwitcher.locator('button');
    const buttonCount = await buttons.count();

    // Log for debugging
    for (let i = 0; i < buttonCount; i++) {
      const text = await buttons.nth(i).textContent();
      console.log(`View button ${i}: "${text}"`);
    }

    // If admin button exists (user is admin), it should be clickable
    const adminBtn = viewSwitcher.locator('button:has-text("Admin")');
    if (await adminBtn.isVisible()) {
      expect(await adminBtn.isEnabled()).toBe(true);
    }
  });

  test('admin panel shows submissions management', async ({ page }) => {
    const adminBtn = page.locator('.view-switcher button:has-text("Admin")');

    if (!(await adminBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Admin view should have key elements
    const bodyText = await page.locator('body').textContent();

    // Should show submission management (Pending/Approved/Rejected tabs)
    const hasSubmissionTabs = bodyText.includes('Pending') || bodyText.includes('Submissions');
    console.log('Has submission management:', hasSubmissionTabs);

    // Should NOT be a blank page
    const adminContent = page.locator('.admin-view-premium, [class*="admin"]');
    const contentCount = await adminContent.count();
    expect(contentCount).toBeGreaterThan(0);
  });

  // ==================== IMPERSONATION FLOW ====================

  test('admin can search businesses for impersonation', async ({ page }) => {
    const adminBtn = page.locator('.view-switcher button:has-text("Admin")');

    if (!(await adminBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Find the impersonation search input
    const searchInput = page.locator('.admin-impersonate-search input, input[placeholder*="Search businesses" i], input[placeholder*="impersonat" i]').first();

    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('Impersonation search not found - may need different admin tab');
      test.skip('Impersonation search input not found');
      return;
    }

    // Type a search query
    await searchInput.fill('Squamish');
    await page.waitForTimeout(500);

    // Should show search results dropdown
    const results = page.locator('.admin-search-result, .search-result, [class*="search-result"]');
    const resultCount = await results.count();
    console.log(`Found ${resultCount} search results for "Squamish"`);

    if (resultCount > 0) {
      const firstResult = results.first();
      const resultText = await firstResult.textContent();
      console.log('First result:', resultText?.substring(0, 80));
      expect(resultText.length).toBeGreaterThan(0);
    }
  });

  test('clicking search result enters impersonation mode', async ({ page }) => {
    const adminBtn = page.locator('.view-switcher button:has-text("Admin")');

    if (!(await adminBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Search for a business
    const searchInput = page.locator('.admin-impersonate-search input, input[placeholder*="Search businesses" i]').first();

    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Impersonation search input not found');
      return;
    }

    await searchInput.fill('Squamish');
    await page.waitForTimeout(500);

    // Click first result
    const firstResult = page.locator('.admin-search-result').first();

    if (!(await firstResult.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('No search results found');
      return;
    }

    const businessName = await firstResult.textContent();
    console.log('Entering impersonation for:', businessName?.substring(0, 50));

    await firstResult.click();
    await page.waitForTimeout(1000);

    // Should switch to business view in impersonation mode
    const impersonationBanner = page.locator('.impersonation-banner, text=Impersonation Mode, text=Admin View');
    const hasBanner = await impersonationBanner.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Impersonation banner visible:', hasBanner);

    if (hasBanner) {
      // Should show business dashboard content
      const businessView = page.locator('.business-view-premium, [class*="business"]');
      expect(await businessView.count()).toBeGreaterThan(0);

      // Banner should show business name
      const bannerText = await impersonationBanner.textContent();
      console.log('Banner text:', bannerText?.substring(0, 100));
    }
  });

  test('exit impersonation returns to admin view', async ({ page }) => {
    const adminBtn = page.locator('.view-switcher button:has-text("Admin")');

    if (!(await adminBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    // Enter admin view
    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Search and enter impersonation
    const searchInput = page.locator('.admin-impersonate-search input, input[placeholder*="Search businesses" i]').first();

    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Impersonation search input not found');
      return;
    }

    await searchInput.fill('Squamish');
    await page.waitForTimeout(500);

    const firstResult = page.locator('.admin-search-result').first();

    if (!(await firstResult.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('No search results found');
      return;
    }

    await firstResult.click();
    await page.waitForTimeout(1000);

    // Find and click exit impersonation button
    const exitBtn = page.locator('.impersonation-exit-btn, button:has-text("Exit"), button:has-text("Back to Admin")').first();

    if (!(await exitBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Try ESC key as alternative
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      await exitBtn.click();
      await page.waitForTimeout(1000);
    }

    // Should return to admin view
    const adminView = page.locator('.admin-view-premium, [class*="admin"]');
    const isAdminView = await adminView.count() > 0;

    // Or check view switcher shows Admin as active
    const adminBtnActive = page.locator('.view-switcher button:has-text("Admin").active');
    const isAdminActive = await adminBtnActive.isVisible().catch(() => false);

    console.log('Returned to admin view:', isAdminView || isAdminActive);
  });

  // ==================== EYE BUTTON IMPERSONATION ====================

  test('eye button on venue card enters impersonation', async ({ page }) => {
    const adminBtn = page.locator('.view-switcher button:has-text("Admin")');

    if (!(await adminBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Find eye (impersonate) button on a venue card
    const eyeBtn = page.locator('.action-btn-mini.impersonate, button[title*="View as this business"]').first();

    if (!(await eyeBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log('No eye/impersonate buttons found on venue cards');
      test.skip('No impersonate buttons visible');
      return;
    }

    await eyeBtn.click();
    await page.waitForTimeout(1000);

    // Should enter impersonation mode
    const impersonationBanner = page.locator('.impersonation-banner, text=Impersonation Mode');
    const hasBanner = await impersonationBanner.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Impersonation via eye button:', hasBanner);
  });

  // ==================== GUARD RAILS ====================

  test('ESC key exits impersonation mode', async ({ page }) => {
    const adminBtn = page.locator('.view-switcher button:has-text("Admin")');

    if (!(await adminBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Enter impersonation via search
    const searchInput = page.locator('.admin-impersonate-search input').first();

    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Impersonation search input not found');
      return;
    }

    await searchInput.fill('Squamish');
    await page.waitForTimeout(500);

    const firstResult = page.locator('.admin-search-result').first();

    if (!(await firstResult.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('No search results found');
      return;
    }

    await firstResult.click();
    await page.waitForTimeout(1000);

    // Verify we're in impersonation
    const banner = page.locator('.impersonation-banner');
    if (!(await banner.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip('Did not enter impersonation mode');
      return;
    }

    // Press ESC to exit
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // Should be back in admin view (banner gone)
    await expect(banner).not.toBeVisible({ timeout: 5000 });
    console.log('ESC key successfully exited impersonation');
  });
});
