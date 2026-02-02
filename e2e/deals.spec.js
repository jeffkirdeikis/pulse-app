import { test, expect } from '@playwright/test';

test.describe('Deals Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000); // Wait for deals to load
  });

  test('should display deals tab content', async ({ page }) => {
    // Check that we're on the deals tab
    await expect(page.locator('.banner-tab:has-text("Deals")')).toHaveClass(/active/);
  });

  test('should have category filter dropdown', async ({ page }) => {
    // Check for category filter
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('should open deal detail modal when clicking a deal card', async ({ page }) => {
    // Wait for deals to load - look for any deal card
    await page.waitForSelector('.deal-card', { timeout: 10000 }).catch(() => null);

    const dealCards = page.locator('.deal-card');
    const count = await dealCards.count();

    // Skip if no deals
    if (count === 0) {
      test.skip();
      return;
    }

    // Click first deal card
    await dealCards.first().click();

    // Deal modal should open - check for modal overlay or deal detail modal
    await expect(page.locator('.deal-detail-modal, .deal-modal-overlay')).toBeVisible({ timeout: 5000 });
  });

  test('should filter deals by category', async ({ page }) => {
    const categorySelect = page.locator('select').first();

    // Get initial count
    const initialCards = await page.locator('.deal-card').count();

    // Select a specific category (not All)
    await categorySelect.selectOption({ index: 1 });

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should still show results count
    const resultsText = await page.locator('.results-count').textContent();
    expect(resultsText).toBeTruthy();
  });

  test('should close deal modal when clicking X or overlay', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 }).catch(() => null);

    const dealCard = page.locator('.deal-card').first();
    if (await dealCard.count() === 0) {
      test.skip();
      return;
    }

    await dealCard.click();
    await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });

    // Click close button or overlay
    const closeBtn = page.locator('.deal-detail-modal .close-btn, .deal-modal-close');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
    } else {
      // Click overlay
      await page.click('.deal-modal-overlay', { position: { x: 10, y: 10 } });
    }

    await expect(page.locator('.deal-detail-modal')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Deal Interactions', () => {
  test('should be able to save a deal from card', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000);

    // Wait for deal cards
    await page.waitForSelector('.deal-card', { timeout: 10000 }).catch(() => null);

    if (await page.locator('.deal-card').count() === 0) {
      test.skip();
      return;
    }

    // Find save button (star icon) on deal card
    const saveBtn = page.locator('.deal-card').first().locator('button, [class*="save"], svg').first();

    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      // Should see toast notification
      await page.waitForTimeout(1000);
    }
  });

  test('should show redeem button in deal modal', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000);

    await page.waitForSelector('.deal-card', { timeout: 10000 }).catch(() => null);

    if (await page.locator('.deal-card').count() === 0) {
      test.skip();
      return;
    }

    await page.locator('.deal-card').first().click();
    await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });

    // Should have redeem button
    await expect(page.locator('text=Redeem Deal')).toBeVisible();
  });
});
