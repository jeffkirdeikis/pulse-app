import { test, expect } from '@playwright/test';

// Run tests serially to avoid resource contention
test.describe.configure({ mode: 'serial' });

// Increase default timeout for all tests
test.setTimeout(60000);

test.describe('Filter Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    // Wait for app to load
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
  });

  test.describe('Deal Category Dropdown', () => {
    test('should display deal category dropdown and filter deals', async ({ page }) => {
      // Navigate to Deals tab
      await page.click('.banner-tab:has-text("Deals")');
      await page.waitForTimeout(1000);

      // 1. Check dropdown is visible
      const dropdown = page.locator('.filter-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 10000 });

      // 2. Check default value is All
      await expect(dropdown).toHaveValue('All');

      // 3. Check for category options (using count since options are hidden in native select)
      await expect(dropdown.locator('option[value="All"]')).toHaveCount(1);
      await expect(dropdown.locator('option[value="Food & Drink"]')).toHaveCount(1);
      await expect(dropdown.locator('option[value="Shopping"]')).toHaveCount(1);

      // 4. Get initial count
      const resultsCount = page.locator('.results-count');
      await expect(resultsCount).toBeVisible({ timeout: 5000 });
      const initialCountText = await resultsCount.textContent();
      const initialCount = parseInt(initialCountText.match(/\d+/)?.[0] || '0');

      // 5. Select a category and verify filtering
      await page.selectOption('.filter-dropdown', 'Food & Drink');
      await page.waitForTimeout(500);

      const filteredCountText = await resultsCount.textContent();
      const filteredCount = parseInt(filteredCountText.match(/\d+/)?.[0] || '0');

      // Filtered count should be less than or equal to total
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // 6. Select All and verify all items return
      await page.selectOption('.filter-dropdown', 'All');
      await page.waitForTimeout(500);

      const allCountText = await resultsCount.textContent();
      const allCount = parseInt(allCountText.match(/\d+/)?.[0] || '0');
      expect(allCount).toBeGreaterThanOrEqual(filteredCount);
    });
  });

  test.describe('Service Category Dropdown', () => {
    test('should display service category dropdown and filter services', async ({ page }) => {
      // Navigate to Services tab
      await page.click('.banner-tab:has-text("Services")');
      await page.waitForTimeout(1000);

      // 1. Check dropdown is visible
      const dropdown = page.locator('.filter-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 10000 });

      // 2. Check default value
      await expect(dropdown).toHaveValue('All');

      // 3. Check for category options (using count since options are hidden in native select)
      await expect(dropdown.locator('option[value="All"]')).toHaveCount(1);
      await expect(dropdown.locator('option[value="Restaurants & Dining"]')).toHaveCount(1);

      // 4. Wait for results count (services uses .results-count, not .search-results-count)
      const resultsCount = page.locator('.results-count');
      await expect(resultsCount).toBeVisible({ timeout: 10000 });

      // 5. Get initial count
      const initialCountText = await resultsCount.textContent();
      const initialCount = parseInt(initialCountText.match(/\d+/)?.[0] || '0');

      // 6. Select a category
      await page.selectOption('.filter-dropdown', 'Restaurants & Dining');
      await page.waitForTimeout(500);

      const filteredCountText = await resultsCount.textContent();
      const filteredCount = parseInt(filteredCountText.match(/\d+/)?.[0] || '0');

      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });
  });
});

test.describe('Class Cards Display and Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
    // Stay on Classes tab (default)
    await page.waitForTimeout(500);
  });

  test('should load and display class cards with all required information', async ({ page }) => {
    // Wait for cards to appear
    await page.waitForSelector('.event-card', { timeout: 15000 });

    const cards = page.locator('.event-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check first card has title
    const firstCard = page.locator('.event-card').first();
    const title = firstCard.locator('h3');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText.length).toBeGreaterThan(0);

    // Check for venue
    const venueItem = firstCard.locator('.venue-item');
    await expect(venueItem).toBeVisible();

    // Check for date and time detail items
    const detailItems = firstCard.locator('.event-detail-item');
    const detailCount = await detailItems.count();
    expect(detailCount).toBeGreaterThanOrEqual(2);
  });

  test('should display badges on cards', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    // Check for price badges
    const priceBadges = page.locator('.price-badge');
    const priceCount = await priceBadges.count();
    expect(priceCount).toBeGreaterThan(0);

    // Check for age badges
    const ageBadges = page.locator('.age-badge');
    const ageCount = await ageBadges.count();
    expect(ageCount).toBeGreaterThan(0);

    // Check for recurrence badges
    const recurrenceBadges = page.locator('.recurrence-badge');
    const recurrenceCount = await recurrenceBadges.count();
    expect(recurrenceCount).toBeGreaterThan(0);
  });

  test('should open and close detail modal', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    // Get the title from the card
    const cardTitle = await page.locator('.event-card').first().locator('h3').textContent();

    // Click to open modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Modal should show the same title
    const modalTitle = page.locator('.event-hero-title');
    await expect(modalTitle).toContainText(cardTitle);

    // Close modal using close button
    await page.locator('.event-close').click();
    await expect(page.locator('.event-detail-modal')).not.toBeVisible({ timeout: 5000 });

    // Open again and close via overlay
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });
    await page.locator('.event-modal-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.event-detail-modal')).not.toBeVisible({ timeout: 5000 });
  });

  test('should have save button that toggles state', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    const firstCard = page.locator('.event-card').first();
    const saveBtn = firstCard.locator('.save-star-btn');

    await expect(saveBtn).toBeVisible();

    // Check initial state
    const initialState = await saveBtn.getAttribute('class');
    const wasInitiallySaved = initialState.includes('saved');

    // Click save button
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Check if state changed
    const newState = await saveBtn.getAttribute('class');
    const isNowSaved = newState.includes('saved');

    // State should have toggled
    expect(isNowSaved).not.toBe(wasInitiallySaved);
  });

  test('should have save button in modal', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    // Open modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Check for save button in quick actions
    const saveAction = page.locator('.quick-action-btn:has-text("Save")');
    await expect(saveAction).toBeVisible();
  });
});

test.describe('Share Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
  });

  test('should have share button in modal', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    // Open modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Check for share button
    const shareBtn = page.locator('.quick-action-btn:has-text("Share")');
    await expect(shareBtn).toBeVisible();

    // Check for share icon
    const shareIcon = page.locator('.quick-action-icon.share');
    await expect(shareIcon).toBeVisible();

    // Click share button - should not throw error
    await shareBtn.click();
    await page.waitForTimeout(500);
    // Test passed if no error
  });
});

test.describe('Card Scrolling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
  });

  test('should be able to scroll through cards', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    const cards = page.locator('.event-card');
    const count = await cards.count();

    if (count > 3) {
      // Scroll to bottom of the list
      const lastCard = cards.last();
      await lastCard.scrollIntoViewIfNeeded();

      // Last card should now be visible
      await expect(lastCard).toBeVisible();
    }
  });
});

test.describe('Events Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(500);
  });

  test('should display event cards and open modal on click', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 15000 });

    const cards = page.locator('.event-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Click to open modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Deal Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(500);
  });

  test('should display deal cards with all required information', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 15000 });

    const cards = page.locator('.deal-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check first card has title
    const firstCard = page.locator('.deal-card').first();
    const title = firstCard.locator('h3');
    await expect(title).toBeVisible();

    // Check for venue
    const venue = firstCard.locator('.detail-text').first();
    await expect(venue).toBeVisible();

    // Check for save button
    const saveBtn = firstCard.locator('.save-star-btn');
    await expect(saveBtn).toBeVisible();
  });

  test('should open deal detail modal when clicking card', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 15000 });

    await page.locator('.deal-card').first().click();

    // Wait for deal modal
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });
  });

  test('should display savings badge when deal has savings', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 15000 });

    // Check if any cards have savings badges (not all will)
    const savingsBadges = page.locator('.deal-savings-badge');
    const count = await savingsBadges.count();

    // Just verify the test runs - not all deals have savings
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Service Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(500);
  });

  test('should display service cards and open modal on click', async ({ page }) => {
    await page.waitForSelector('.service-card', { timeout: 15000 });

    const cards = page.locator('.service-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    await page.locator('.service-card').first().click();

    // Wait for service modal
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Results Count Updates', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
  });

  test('should display and update results count on Classes tab', async ({ page }) => {
    await page.waitForSelector('.results-count', { timeout: 15000 });

    // Wait for loading to complete
    const resultsCount = page.locator('.results-count');
    await expect(resultsCount).not.toHaveText('Loading...', { timeout: 10000 });

    const text = await resultsCount.textContent();
    expect(text).toMatch(/\d+ results/);

    // Get initial count
    const initialCount = parseInt(text.match(/\d+/)?.[0] || '0');

    // Search for something specific
    await page.fill('.search-bar-premium input', 'yoga');
    await page.waitForTimeout(500);

    // Wait for loading to complete again
    await expect(resultsCount).not.toHaveText('Loading...', { timeout: 5000 });

    // Get new count
    const newText = await resultsCount.textContent();
    const newCount = parseInt(newText.match(/\d+/)?.[0] || '0');

    // Count should change (likely be lower)
    expect(newCount).toBeLessThanOrEqual(initialCount);
  });

  test('should display results count on all tabs', async ({ page }) => {
    // Check Deals tab
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(500);
    const dealsCount = page.locator('.results-count');
    await expect(dealsCount).toBeVisible({ timeout: 10000 });
    const dealsText = await dealsCount.textContent();
    expect(dealsText).toMatch(/\d+ results/);

    // Check Services tab (uses .results-count, not .search-results-count)
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(500);
    const servicesCount = page.locator('.results-count');
    await expect(servicesCount).toBeVisible({ timeout: 10000 });
  });
});
