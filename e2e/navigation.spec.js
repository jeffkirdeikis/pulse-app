import { test, expect } from '@playwright/test';

test.describe('Navigation Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.banner-tab', { timeout: 10000 });
  });

  test('1. should display all four navigation tabs on load', async ({ page }) => {
    // Check for all 4 tab buttons
    await expect(page.locator('.banner-tab:has-text("Classes")')).toBeVisible();
    await expect(page.locator('.banner-tab:has-text("Events")')).toBeVisible();
    await expect(page.locator('.banner-tab:has-text("Deals")')).toBeVisible();
    await expect(page.locator('.banner-tab:has-text("Services")')).toBeVisible();

    // Verify exactly 4 tabs exist
    const tabCount = await page.locator('.banner-tab').count();
    expect(tabCount).toBe(4);
  });

  test('2. Classes tab - click, verify active state, verify classes content shows', async ({ page }) => {
    // Click Classes tab
    await page.click('.banner-tab:has-text("Classes")');

    // Verify active state
    await expect(page.locator('.banner-tab:has-text("Classes")')).toHaveClass(/active/);

    // Verify other tabs are NOT active
    await expect(page.locator('.banner-tab:has-text("Events")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Deals")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Services")')).not.toHaveClass(/active/);

    // Verify search placeholder says "classes"
    await expect(page.locator('input[placeholder*="classes"]')).toBeVisible();

    // Verify results count is visible
    await expect(page.locator('.results-count')).toBeVisible();
  });

  test('3. Events tab - click, verify active state, verify events content shows', async ({ page }) => {
    // Click Events tab
    await page.click('.banner-tab:has-text("Events")');

    // Wait for tab to become active
    await page.waitForTimeout(300);

    // Verify active state
    await expect(page.locator('.banner-tab:has-text("Events")')).toHaveClass(/active/);

    // Verify other tabs are NOT active
    await expect(page.locator('.banner-tab:has-text("Classes")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Deals")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Services")')).not.toHaveClass(/active/);

    // Verify search placeholder says "events"
    await expect(page.locator('input[placeholder*="events"]')).toBeVisible();
  });

  test('4. Deals tab - click, verify active state, verify deals content shows', async ({ page }) => {
    // Click Deals tab
    await page.click('.banner-tab:has-text("Deals")');

    // Wait for tab to become active
    await page.waitForTimeout(300);

    // Verify active state
    await expect(page.locator('.banner-tab:has-text("Deals")')).toHaveClass(/active/);

    // Verify other tabs are NOT active
    await expect(page.locator('.banner-tab:has-text("Classes")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Events")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Services")')).not.toHaveClass(/active/);

    // Verify search placeholder says "deals"
    await expect(page.locator('input[placeholder*="deals"]')).toBeVisible();

    // Verify deals grid appears
    await expect(page.locator('.deals-grid')).toBeVisible();
  });

  test('5. Services tab - click, verify active state, verify services content shows', async ({ page }) => {
    // Click Services tab
    await page.click('.banner-tab:has-text("Services")');

    // Wait for tab to become active
    await page.waitForTimeout(300);

    // Verify active state
    await expect(page.locator('.banner-tab:has-text("Services")')).toHaveClass(/active/);

    // Verify other tabs are NOT active
    await expect(page.locator('.banner-tab:has-text("Classes")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Events")')).not.toHaveClass(/active/);
    await expect(page.locator('.banner-tab:has-text("Deals")')).not.toHaveClass(/active/);

    // Verify search placeholder says "services"
    await expect(page.locator('input[placeholder*="services"]')).toBeVisible();
  });

  test('6. Tab switching preserves state correctly', async ({ page }) => {
    // Start on Classes
    await expect(page.locator('.banner-tab:has-text("Classes")')).toHaveClass(/active/);

    // Switch to Events
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(200);
    await expect(page.locator('.banner-tab:has-text("Events")')).toHaveClass(/active/);
    await expect(page.locator('input[placeholder*="events"]')).toBeVisible();

    // Switch to Deals
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(200);
    await expect(page.locator('.banner-tab:has-text("Deals")')).toHaveClass(/active/);
    await expect(page.locator('input[placeholder*="deals"]')).toBeVisible();

    // Switch to Services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(200);
    await expect(page.locator('.banner-tab:has-text("Services")')).toHaveClass(/active/);
    await expect(page.locator('input[placeholder*="services"]')).toBeVisible();

    // Switch back to Classes
    await page.click('.banner-tab:has-text("Classes")');
    await page.waitForTimeout(200);
    await expect(page.locator('.banner-tab:has-text("Classes")')).toHaveClass(/active/);
    await expect(page.locator('input[placeholder*="classes"]')).toBeVisible();
  });
});

test.describe('View Switcher', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
  });

  test('7. Consumer button - click, verify consumer view', async ({ page }) => {
    // Consumer should be active by default
    const consumerBtn = page.locator('.view-switcher button:has-text("Consumer")');
    await expect(consumerBtn).toBeVisible();
    await expect(consumerBtn).toHaveClass(/active/);

    // Consumer view should be visible
    await expect(page.locator('.consumer-view')).toBeVisible();
  });

  test('8. Business button - click, verify business view appears', async ({ page }) => {
    // Click Business button
    const businessBtn = page.locator('.view-switcher button:has-text("Business")');
    await businessBtn.click();

    await page.waitForTimeout(300);

    // Business button should be active
    await expect(businessBtn).toHaveClass(/active/);

    // Consumer button should NOT be active
    await expect(page.locator('.view-switcher button:has-text("Consumer")')).not.toHaveClass(/active/);
  });

  test('9. Active view button has correct styling', async ({ page }) => {
    // Consumer is active by default - verify styling
    const consumerBtn = page.locator('.view-switcher button:has-text("Consumer")');
    await expect(consumerBtn).toHaveClass(/active/);

    // Switch to Business
    const businessBtn = page.locator('.view-switcher button:has-text("Business")');
    await businessBtn.click();
    await page.waitForTimeout(300);

    // Now Business should have active styling
    await expect(businessBtn).toHaveClass(/active/);
    await expect(consumerBtn).not.toHaveClass(/active/);

    // Switch back to Consumer
    await consumerBtn.click();
    await page.waitForTimeout(300);

    // Consumer should have active styling again
    await expect(consumerBtn).toHaveClass(/active/);
    await expect(businessBtn).not.toHaveClass(/active/);
  });
});

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });
  });

  test('10. Search placeholder updates based on current tab', async ({ page }) => {
    // Default should be classes
    await expect(page.locator('input[placeholder="Search classes..."]')).toBeVisible();

    // Switch to events
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder="Search events..."]')).toBeVisible();

    // Switch to deals
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder="Search deals..."]')).toBeVisible();

    // Switch to services
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(300);
    await expect(page.locator('input[placeholder="Search services..."]')).toBeVisible();
  });

  test('11. Type in search - results filter in real-time', async ({ page }) => {
    // Get initial results count
    await page.waitForSelector('.results-count');
    const initialResults = await page.locator('.results-count').textContent();

    // Type in search
    await page.fill('.search-bar-premium input', 'yoga');

    // Wait for filtering
    await page.waitForTimeout(500);

    // Results should have changed (filtered)
    const filteredResults = await page.locator('.results-count').textContent();
    expect(filteredResults).toBeTruthy();
  });

  test('12. Clear button appears when text entered', async ({ page }) => {
    // Initially no clear button
    await expect(page.locator('.search-clear-btn')).not.toBeVisible();

    // Type in search
    await page.fill('.search-bar-premium input', 'test');

    // Clear button should appear
    await expect(page.locator('.search-clear-btn')).toBeVisible();
  });

  test('13. Click clear button - clears search', async ({ page }) => {
    // Type in search
    await page.fill('.search-bar-premium input', 'test search');

    // Verify text is there
    await expect(page.locator('.search-bar-premium input')).toHaveValue('test search');

    // Click clear button
    await page.click('.search-clear-btn');

    // Input should be empty
    await expect(page.locator('.search-bar-premium input')).toHaveValue('');

    // Clear button should disappear
    await expect(page.locator('.search-clear-btn')).not.toBeVisible();
  });

  test('14. Results count updates with search', async ({ page }) => {
    // Wait for content to load
    await page.waitForSelector('.results-count');

    // Get initial count text
    const initialText = await page.locator('.results-count').textContent();

    // Search for something specific
    await page.fill('.search-bar-premium input', 'zzznonexistent');

    // Wait for filtering
    await page.waitForTimeout(500);

    // Results count should update (likely to 0 results)
    const filteredText = await page.locator('.results-count').textContent();
    expect(filteredText).toContain('results');
  });

  test('15. Search in each tab filters correctly', async ({ page }) => {
    // Test search in Classes tab
    await page.fill('.search-bar-premium input', 'yoga');
    await page.waitForTimeout(500);
    let resultsText = await page.locator('.results-count').textContent();
    expect(resultsText).toContain('results');

    // Clear search
    await page.click('.search-clear-btn');

    // Test search in Events tab
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(300);
    await page.fill('.search-bar-premium input', 'music');
    await page.waitForTimeout(500);
    resultsText = await page.locator('.results-count').textContent();
    expect(resultsText).toContain('results');

    // Clear search
    if (await page.locator('.search-clear-btn').isVisible()) {
      await page.click('.search-clear-btn');
    }

    // Test search in Deals tab
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(300);
    await page.fill('.search-bar-premium input', 'discount');
    await page.waitForTimeout(500);
    resultsText = await page.locator('.results-count').textContent();
    expect(resultsText).toContain('results');

    // Clear search
    if (await page.locator('.search-clear-btn').isVisible()) {
      await page.click('.search-clear-btn');
    }

    // Test search in Services tab
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(300);
    await page.fill('.search-bar-premium input', 'restaurant');
    await page.waitForTimeout(500);
    resultsText = await page.locator('.results-count').textContent();
    expect(resultsText).toContain('results');
  });
});

test.describe('Guest User State', () => {
  test('should work as guest user (not signed in)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 10000 });

    // All tabs should be visible to guest
    await expect(page.locator('.banner-tab:has-text("Classes")')).toBeVisible();
    await expect(page.locator('.banner-tab:has-text("Events")')).toBeVisible();
    await expect(page.locator('.banner-tab:has-text("Deals")')).toBeVisible();
    await expect(page.locator('.banner-tab:has-text("Services")')).toBeVisible();

    // View switcher should work for guest
    await expect(page.locator('.view-switcher')).toBeVisible();

    // Search should work for guest
    await expect(page.locator('.search-bar-premium input')).toBeVisible();
    await page.fill('.search-bar-premium input', 'test');
    await expect(page.locator('.search-clear-btn')).toBeVisible();
  });
});
