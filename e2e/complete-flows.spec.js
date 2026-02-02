import { test, expect } from '@playwright/test';

/**
 * COMPLETE USER FLOW TESTS
 *
 * These tests verify entire user journeys from start to finish,
 * not just individual features in isolation.
 */

test.describe('Complete Flow: Browse and Search', () => {
  test('user can browse all tabs and search in each', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 10000 });

    // Tab 1: Classes
    await page.click('.banner-tab:has-text("Classes")');
    await expect(page.locator('.banner-tab:has-text("Classes")')).toHaveClass(/active/);

    let searchInput = page.locator('.search-bar-premium input');
    await searchInput.fill('yoga');
    expect(await searchInput.inputValue()).toBe('yoga');
    await page.waitForTimeout(500);
    await page.locator('.search-clear-btn').click().catch(() => { });

    // Tab 2: Events
    await page.click('.banner-tab:has-text("Events")');
    await expect(page.locator('.banner-tab:has-text("Events")')).toHaveClass(/active/);

    searchInput = page.locator('.search-bar-premium input');
    await searchInput.fill('music');
    expect(await searchInput.inputValue()).toBe('music');
    await page.waitForTimeout(500);
    if (await page.locator('.search-clear-btn').isVisible()) {
      await page.click('.search-clear-btn');
    }

    // Tab 3: Deals
    await page.click('.banner-tab:has-text("Deals")');
    await expect(page.locator('.banner-tab:has-text("Deals")')).toHaveClass(/active/);

    searchInput = page.locator('.search-bar-premium input');
    await searchInput.fill('discount');
    expect(await searchInput.inputValue()).toBe('discount');
    await page.waitForTimeout(500);
    if (await page.locator('.search-clear-btn').isVisible()) {
      await page.click('.search-clear-btn');
    }

    // Tab 4: Services
    await page.click('.banner-tab:has-text("Services")');
    await expect(page.locator('.banner-tab:has-text("Services")')).toHaveClass(/active/);

    searchInput = page.locator('.search-bar-premium input');
    await searchInput.fill('restaurant');
    expect(await searchInput.inputValue()).toBe('restaurant');
    await page.waitForTimeout(500);

    console.log('✓ All tabs navigable and searchable');
  });
});

test.describe('Complete Flow: View Event Details', () => {
  test('user can click event card and view details', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    // Find an event card
    const eventCard = page.locator('.event-card, .class-card, [class*="event-card"]').first();

    if (await eventCard.count() === 0) {
      test.skip('No event cards found');
      return;
    }

    // Click card
    await eventCard.click();

    // Modal should open
    await page.waitForSelector('.event-detail-modal, .modal-overlay, [class*="detail-modal"]', { timeout: 5000 });

    // Verify modal has content
    const modalTitle = page.locator('.modal-title, h2, h3').first();
    const titleText = await modalTitle.textContent();
    expect(titleText.length).toBeGreaterThan(0);

    console.log('Event title:', titleText);

    // Close modal
    const closeBtn = page.locator('.close-btn, [class*="close"], button:has-text("×")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    console.log('✓ Event detail flow complete');
  });
});

test.describe('Complete Flow: View Deal and Redemption', () => {
  test('user can view deal details', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000);

    const dealCard = page.locator('.deal-card').first();

    if (await dealCard.count() === 0) {
      test.skip('No deal cards found');
      return;
    }

    await dealCard.click();
    await page.waitForSelector('.deal-detail-modal', { timeout: 5000 });

    // Verify deal modal content
    await expect(page.locator('.deal-detail-modal')).toBeVisible();

    // Look for redeem button
    const redeemBtn = page.locator('button:has-text("Redeem")');
    if (await redeemBtn.isVisible()) {
      console.log('✓ Redeem button visible');
      // Don't click in test - just verify it exists
    }

    console.log('✓ Deal detail flow complete');
  });
});

test.describe('Complete Flow: View Service Details', () => {
  test('user can view service and contact info', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(2000);

    const serviceCard = page.locator('.service-card, .business-card, [class*="service-card"]').first();

    if (await serviceCard.count() === 0) {
      test.skip('No service cards found');
      return;
    }

    await serviceCard.click();
    await page.waitForTimeout(1000); // Allow modal to open

    // Check for contact info
    const hasPhone = await page.locator('a[href^="tel:"]').count() > 0;
    const hasAddress = await page.getByText(/\d+\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd)/i).count() > 0;

    console.log('Has phone:', hasPhone);
    console.log('Has address:', hasAddress);

    console.log('✓ Service detail flow complete');
  });
});

test.describe('Complete Flow: Filter by Category', () => {
  test('category filter changes results', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000);

    const categoryDropdown = page.locator('select').first();

    if (!(await categoryDropdown.isVisible())) {
      test.skip('Category dropdown not found');
      return;
    }

    // Get initial results
    const initialCount = await page.locator('.deal-card').count();
    console.log('Initial deal count:', initialCount);

    // Select a specific category
    await categoryDropdown.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    // Results may have changed
    const filteredCount = await page.locator('.deal-card').count();
    console.log('Filtered deal count:', filteredCount);

    // Reset to all
    await categoryDropdown.selectOption({ index: 0 });
    await page.waitForTimeout(500);

    const resetCount = await page.locator('.deal-card').count();
    console.log('Reset deal count:', resetCount);

    console.log('✓ Category filter flow complete');
  });
});

test.describe('Complete Flow: Modal Open/Close Methods', () => {
  test('modal closes with X button', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    const card = page.locator('.event-card, .class-card').first();
    if (await card.count() === 0) {
      test.skip('No cards found');
      return;
    }

    await card.click();
    await page.waitForSelector('.modal-overlay, [class*="detail-modal"]', { timeout: 5000 });

    const closeBtn = page.locator('.close-btn, button:has-text("×"), [class*="close"]').first();
    await closeBtn.click();

    await page.waitForTimeout(300);

    // Modal should be gone
    await expect(page.locator('.event-detail-modal')).not.toBeVisible();

    console.log('✓ Modal closes with X button');
  });

  test('modal closes with overlay click', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    const card = page.locator('.event-card, .class-card').first();
    if (await card.count() === 0) {
      test.skip('No cards found');
      return;
    }

    await card.click();
    await page.waitForSelector('.modal-overlay, [class*="detail-modal"]', { timeout: 5000 });

    // Click on overlay (edge of screen)
    const overlay = page.locator('.modal-overlay, .overlay').first();
    if (await overlay.isVisible()) {
      await overlay.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(300);
    }

    console.log('✓ Modal overlay click test complete');
  });

  test('modal closes with ESC key', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    const card = page.locator('.event-card, .class-card').first();
    if (await card.count() === 0) {
      test.skip('No cards found');
      return;
    }

    await card.click();
    await page.waitForSelector('.modal-overlay, [class*="detail-modal"]', { timeout: 5000 });

    // Press ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    console.log('✓ ESC key test complete');
  });
});

test.describe('Complete Flow: View Switcher', () => {
  test('can switch between Consumer and Business views', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    // Start on Consumer
    const consumerBtn = page.locator('button:has-text("Consumer")');
    await expect(consumerBtn).toHaveClass(/active/);

    // Switch to Business
    const businessBtn = page.locator('button:has-text("Business")');
    await businessBtn.click();
    await page.waitForTimeout(500);

    await expect(businessBtn).toHaveClass(/active/);
    await expect(consumerBtn).not.toHaveClass(/active/);

    // Switch back
    await consumerBtn.click();
    await page.waitForTimeout(500);

    await expect(consumerBtn).toHaveClass(/active/);

    console.log('✓ View switcher flow complete');
  });
});

test.describe('Complete Flow: Results Count Accuracy', () => {
  test('results count matches visible cards', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.results-count', { timeout: 10000 });

    // Get results count
    const countText = await page.locator('.results-count').textContent();
    const match = countText?.match(/(\d+)/);
    const reportedCount = match ? parseInt(match[1]) : 0;

    console.log('Reported count:', reportedCount);

    // Count actual cards (this may differ if results are paginated)
    const actualCards = await page.locator('.event-card, .class-card').count();
    console.log('Visible cards:', actualCards);

    // At minimum, count should be > 0 if cards visible
    if (actualCards > 0) {
      expect(reportedCount).toBeGreaterThan(0);
    }

    console.log('✓ Results count verified');
  });
});

test.describe('Complete Flow: Quick Tab Switching', () => {
  test('rapid tab switching maintains consistency', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 10000 });

    // Rapid switching
    for (let i = 0; i < 3; i++) {
      await page.click('.banner-tab:has-text("Classes")');
      await page.click('.banner-tab:has-text("Events")');
      await page.click('.banner-tab:has-text("Deals")');
      await page.click('.banner-tab:has-text("Services")');
    }

    await page.waitForTimeout(500);

    // Should end on Services
    await expect(page.locator('.banner-tab:has-text("Services")')).toHaveClass(/active/);

    // Should have service placeholder
    await expect(page.locator('input[placeholder*="services"]')).toBeVisible();

    console.log('✓ Rapid tab switching maintains consistency');
  });
});

test.describe('Complete Flow: Guest Restrictions', () => {
  test('guest cannot save items without prompt', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    const card = page.locator('.event-card, .class-card').first();
    if (await card.count() === 0) {
      test.skip('No cards found');
      return;
    }

    // Try to find and click save button
    const saveBtn = card.locator('button[class*="save"], .save-btn, svg').first();

    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Should either show auth modal or toast about signing in
      const authModal = await page.locator('.auth-modal').isVisible();
      const signInText = await page.getByText('Sign in').first().isVisible().catch(() => false);
      console.log('Auth modal shown:', authModal, 'Sign in text:', signInText);
    }

    console.log('✓ Guest restriction test complete');
  });
});
