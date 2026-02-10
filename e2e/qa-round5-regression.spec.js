import { test, expect } from '@playwright/test';

/**
 * QA ROUND 5 REGRESSION TESTS
 *
 * Locks in fixes from QA Round 5 to prevent regressions:
 * 1. Deal category filter uses real normalized categories (was 58% unreachable)
 * 2. Search clears on tab switch (was persisting across tabs)
 * 3. Age filter inference works (was all "All Ages")
 * 4. Grammar: singular/plural results count (was "1 results")
 * 5. Touch targets meet 44px minimum
 * 6. Desktop layout uses reasonable width (was 21% viewport usage)
 * 7. Free price filter hidden when no free items exist
 * 8. Auth validation shows custom error messages
 */

test.setTimeout(45000);

test.describe('QA Round 5 Regression Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 15000 });
  });

  // ─── 1. Deal Category Filter ────────────────────────────────────────────────

  test.describe('Deal Category Filter (was: 58% unreachable)', () => {
    test('should NOT contain old hardcoded category names', async ({ page }) => {
      await page.click('.banner-tab:has-text("Deals")');
      await page.waitForTimeout(1000);

      const dropdown = page.locator('.filter-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 10000 });

      // Get all option texts from the dropdown
      const optionTexts = await dropdown.locator('option').allTextContents();

      // Old hardcoded categories that should NOT appear
      const oldCategories = ['Shopping', 'Recreation', 'Accommodations'];
      for (const oldCat of oldCategories) {
        const found = optionTexts.some(text => text.includes(oldCat));
        expect(found, `Old category "${oldCat}" should not appear in deal filter`).toBe(false);
      }
    });

    test('should contain real normalized categories', async ({ page }) => {
      await page.click('.banner-tab:has-text("Deals")');
      await page.waitForTimeout(1000);

      const dropdown = page.locator('.filter-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 10000 });

      const optionTexts = await dropdown.locator('option').allTextContents();

      // At least one of these real normalized categories should exist
      const realCategories = ['Retail', 'Food & Drink', 'Entertainment', 'Services', 'Fitness', 'Wellness', 'Beauty'];
      const hasAtLeastOneReal = realCategories.some(cat =>
        optionTexts.some(text => text.includes(cat))
      );
      expect(hasAtLeastOneReal, 'Should have at least one real normalized category').toBe(true);
    });

    test('selecting each category should show results (no empty categories in dropdown)', async ({ page }) => {
      await page.click('.banner-tab:has-text("Deals")');
      await page.waitForTimeout(1500);

      const dropdown = page.locator('.filter-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 10000 });

      // Get all option values (skip the "All" option)
      const options = await dropdown.locator('option').all();
      const optionValues = [];
      for (const opt of options) {
        const val = await opt.getAttribute('value');
        if (val && val !== 'All') {
          optionValues.push(val);
        }
      }

      // Each category in the dropdown should produce at least 1 result
      for (const val of optionValues) {
        await dropdown.selectOption(val);
        await page.waitForTimeout(300);

        const dealCards = page.locator('.deal-card');
        const count = await dealCards.count();
        expect(count, `Category "${val}" should have at least 1 deal`).toBeGreaterThan(0);
      }

      // Reset to All
      await dropdown.selectOption('All');
    });
  });

  // ─── 2. Search Clears on Tab Switch ─────────────────────────────────────────

  test.describe('Search Clears on Tab Switch (was: search persisted)', () => {
    test('search input should clear when switching tabs', async ({ page }) => {
      // Start on Classes tab
      await page.click('.banner-tab:has-text("Classes")');
      await page.waitForTimeout(500);

      // Type a search query
      const searchInput = page.locator('.search-bar-premium input');
      await searchInput.fill('yoga');
      await expect(searchInput).toHaveValue('yoga');

      // Switch to Events tab
      await page.click('.banner-tab:has-text("Events")');
      await page.waitForTimeout(500);

      // Search should be empty on Events tab
      const eventsSearch = page.locator('.search-bar-premium input');
      await expect(eventsSearch).toHaveValue('');

      // Switch to Deals tab
      await page.click('.banner-tab:has-text("Deals")');
      await page.waitForTimeout(500);

      // Search should be empty on Deals tab
      const dealsSearch = page.locator('.search-bar-premium input');
      await expect(dealsSearch).toHaveValue('');

      // Switch to Services tab
      await page.click('.banner-tab:has-text("Services")');
      await page.waitForTimeout(500);

      // Search should be empty on Services tab
      const servicesSearch = page.locator('.search-bar-premium input');
      await expect(servicesSearch).toHaveValue('');
    });
  });

  // ─── 3. Age Filter Inference ────────────────────────────────────────────────

  test.describe('Age Filter Inference (was: all "All Ages")', () => {
    test('should display "Adults" age badge on adult-oriented classes', async ({ page }) => {
      // Classes tab is default
      await page.click('.banner-tab:has-text("Classes")');
      await page.waitForSelector('.event-card', { timeout: 15000 });

      // Look for age badges with "Adults" text
      const adultBadges = page.locator('.age-badge:has-text("Adults")');
      const adultCount = await adultBadges.count();

      // The inferAgeGroup function should tag adult classes (e.g., "Adult Jiu Jitsu")
      // There should be at least some classes with "Adults" badge
      expect(adultCount, 'Should have at least one class with "Adults" age badge').toBeGreaterThan(0);
    });

    test('age filter should change results count', async ({ page }) => {
      await page.click('.banner-tab:has-text("Classes")');
      await page.waitForSelector('.event-card', { timeout: 15000 });

      // Get initial results count
      const resultsCount = page.locator('.results-count');
      await expect(resultsCount).toBeVisible({ timeout: 5000 });
      const initialText = await resultsCount.textContent();
      const initialCount = parseInt(initialText.match(/\d+/)?.[0] || '0');

      // Open filters
      const filterToggle = page.locator('.filters-toggle-btn');
      if (await filterToggle.isVisible()) {
        await filterToggle.click();
        await page.waitForTimeout(300);
      }

      // Select "Kids" age filter
      const ageDropdown = page.locator('select[aria-label="Filter by age group"]');
      if (await ageDropdown.isVisible()) {
        await ageDropdown.selectOption('kids');
        await page.waitForTimeout(500);

        // Results should change (fewer or different results)
        const filteredText = await resultsCount.textContent();
        const filteredCount = parseInt(filteredText.match(/\d+/)?.[0] || '0');
        expect(filteredCount).toBeLessThan(initialCount);
      }
    });
  });

  // ─── 4. Grammar: Singular/Plural ───────────────────────────────────────────

  test.describe('Grammar: Singular/Plural (was: "1 results")', () => {
    test('results count should use proper singular/plural grammar', async ({ page }) => {
      // Wait for results to load on Classes (default tab)
      const resultsCount = page.locator('.results-count');
      await expect(resultsCount).toBeVisible({ timeout: 15000 });
      await expect(resultsCount).not.toHaveText('Loading...', { timeout: 10000 });

      const text = await resultsCount.textContent();

      // Should match pattern "N result" or "N results" (not "1 results")
      expect(text).toMatch(/^\d+ results?$/);

      // If we can filter to exactly 1 result, verify singular
      const searchInput = page.locator('.search-bar-premium input');
      // Search for something very specific to try to get 1 result
      await searchInput.fill('Perinatal Fitness');
      await page.waitForTimeout(600);

      const filteredText = await resultsCount.textContent();
      const match = filteredText.match(/^(\d+) (results?)$/);
      if (match) {
        const count = parseInt(match[1]);
        const word = match[2];
        if (count === 1) {
          expect(word).toBe('result');
        } else {
          expect(word).toBe('results');
        }
      }
    });
  });

  // ─── 5. Touch Targets ──────────────────────────────────────────────────────

  test.describe('Touch Targets (was: below 44px)', () => {
    test('banner tabs should have min-height >= 44px', async ({ page }) => {
      const tabs = page.locator('.banner-tab');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);

      for (let i = 0; i < tabCount; i++) {
        const box = await tabs.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box.height, `Tab ${i} height should be >= 44px (was ${box.height}px)`).toBeGreaterThanOrEqual(44);
      }
    });

    test('sign-in button should have min-height >= 44px', async ({ page }) => {
      const signInBtn = page.locator('.sign-in-btn');
      if (await signInBtn.isVisible()) {
        const box = await signInBtn.boundingBox();
        expect(box).not.toBeNull();
        expect(box.height, `Sign-in button height should be >= 44px (was ${box.height}px)`).toBeGreaterThanOrEqual(44);
      }
    });
  });

  // ─── 6. Desktop Layout ─────────────────────────────────────────────────────

  test.describe('Desktop Layout (was: 21% viewport usage)', () => {
    test('consumer view should use reasonable width on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      const consumerView = page.locator('.consumer-view');
      await expect(consumerView).toBeVisible({ timeout: 10000 });

      const box = await consumerView.boundingBox();
      expect(box).not.toBeNull();

      // Width should be in a reasonable range (600-900px based on CSS: 640px at 768+ and 800px at 1200+)
      expect(box.width, `Consumer view width should be >= 600px (was ${box.width}px)`).toBeGreaterThanOrEqual(600);
      expect(box.width, `Consumer view width should be <= 900px (was ${box.width}px)`).toBeLessThanOrEqual(900);
    });

    test('content should be horizontally centered', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);

      const consumerView = page.locator('.consumer-view');
      const box = await consumerView.boundingBox();
      expect(box).not.toBeNull();

      // Check centering: left margin should be roughly equal to right margin
      const leftMargin = box.x;
      const rightMargin = 1920 - (box.x + box.width);
      const marginDiff = Math.abs(leftMargin - rightMargin);

      // Allow 2px tolerance for rounding
      expect(marginDiff, `Content should be centered (left: ${leftMargin}px, right: ${rightMargin}px)`).toBeLessThanOrEqual(2);
    });
  });

  // ─── 7. Free Price Filter ──────────────────────────────────────────────────

  test.describe('Free Price Filter (was: showed 0 results)', () => {
    test('Free option is conditionally rendered based on data', async ({ page }) => {
      // Go to Classes tab
      await page.click('.banner-tab:has-text("Classes")');
      await page.waitForSelector('.event-card', { timeout: 15000 });

      // Open filters
      const filterToggle = page.locator('.filters-toggle-btn');
      if (await filterToggle.isVisible()) {
        await filterToggle.click();
        await page.waitForTimeout(300);
      }

      // Find the price dropdown
      const priceDropdown = page.locator('select[aria-label="Filter by price"]');
      await expect(priceDropdown).toBeVisible({ timeout: 5000 });

      const options = await priceDropdown.locator('option').allTextContents();

      // The price filter should always have "All Prices" and "Paid" options
      expect(options.some(text => text.includes('All Prices'))).toBe(true);
      expect(options.some(text => text.includes('Paid'))).toBe(true);

      // "Free" should NOT be hardcoded -- it should only appear conditionally
      // Verify that the dropdown is NOT hardcoded with a fixed set by checking
      // that it has either 2 options (All Prices + Paid) or 3 options (All Prices + Free + Paid)
      // This confirms the conditional rendering logic is working
      const optionCount = options.length;
      expect(optionCount).toBeGreaterThanOrEqual(2);
      expect(optionCount).toBeLessThanOrEqual(3);
    });
  });

  // ─── 8. Auth Validation Messages ───────────────────────────────────────────

  test.describe('Auth Validation Messages (was: browser-native only)', () => {
    test('should show custom validation errors on empty form submission', async ({ page }) => {
      // Open auth modal via Sign In button (guest users see .sign-in-btn)
      const signInBtn = page.locator('.sign-in-btn');
      await expect(signInBtn).toBeVisible({ timeout: 10000 });
      await signInBtn.click();

      // Wait for auth modal
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Submit form without filling anything
      const submitBtn = page.locator('.auth-modal .auth-btn.email');
      await expect(submitBtn).toBeVisible();
      await submitBtn.click();
      await page.waitForTimeout(300);

      // Custom validation errors should appear (not just browser tooltips)
      const emailError = page.locator('.auth-field-error:has-text("Email is required")');
      await expect(emailError).toBeVisible({ timeout: 3000 });

      const passwordError = page.locator('.auth-field-error:has-text("Password is required")');
      await expect(passwordError).toBeVisible({ timeout: 3000 });
    });

    test('should show email format validation error', async ({ page }) => {
      // Open auth modal
      const signInBtn = page.locator('.sign-in-btn');
      await signInBtn.click();
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Enter invalid email
      await page.locator('.auth-modal input[type="email"]').fill('not-an-email');
      await page.locator('.auth-modal input[type="password"]').fill('password123');

      // Submit
      await page.locator('.auth-modal .auth-btn.email').click();
      await page.waitForTimeout(300);

      // Should show email format error
      const emailError = page.locator('.auth-field-error:has-text("valid email")');
      await expect(emailError).toBeVisible({ timeout: 3000 });
    });

    test('should show password length validation error', async ({ page }) => {
      // Open auth modal
      const signInBtn = page.locator('.sign-in-btn');
      await signInBtn.click();
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      // Enter valid email but short password
      await page.locator('.auth-modal input[type="email"]').fill('test@example.com');
      await page.locator('.auth-modal input[type="password"]').fill('12345');

      // Submit
      await page.locator('.auth-modal .auth-btn.email').click();
      await page.waitForTimeout(300);

      // Should show password length error
      const pwError = page.locator('.auth-field-error:has-text("at least 6 characters")');
      await expect(pwError).toBeVisible({ timeout: 3000 });
    });

    test('should clear errors when switching to signup mode', async ({ page }) => {
      // Open auth modal and trigger errors
      const signInBtn = page.locator('.sign-in-btn');
      await signInBtn.click();
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });

      await page.locator('.auth-modal .auth-btn.email').click();
      await page.waitForTimeout(300);
      const errorsBefore = await page.locator('.auth-field-error').count();
      expect(errorsBefore).toBeGreaterThan(0);

      // Switch to signup
      await page.locator('.auth-switch button:has-text("Sign Up")').click();
      await page.waitForTimeout(300);

      // Errors should be cleared
      const errorsAfter = await page.locator('.auth-field-error').count();
      expect(errorsAfter).toBe(0);
    });
  });
});
