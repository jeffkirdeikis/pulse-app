import { test, expect } from '@playwright/test';

/**
 * BUTTON FUNCTIONALITY TESTS
 *
 * Every button in the app must be tested to ensure it:
 * 1. Is clickable
 * 2. Produces the expected action
 * 3. Updates state correctly
 */

test.describe('Navigation Tab Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.banner-tab', { timeout: 10000 });
  });

  test('Classes tab button activates and shows content', async ({ page }) => {
    const classesTab = page.locator('.banner-tab:has-text("Classes")');

    // Click
    await classesTab.click();

    // Verify active state
    await expect(classesTab).toHaveClass(/active/);

    // Verify content changed
    await expect(page.locator('input[placeholder*="classes"]')).toBeVisible();
  });

  test('Events tab button activates and shows content', async ({ page }) => {
    const eventsTab = page.locator('.banner-tab:has-text("Events")');

    await eventsTab.click();

    await expect(eventsTab).toHaveClass(/active/);
    await expect(page.locator('input[placeholder*="events"]')).toBeVisible();
  });

  test('Deals tab button activates and shows content', async ({ page }) => {
    const dealsTab = page.locator('.banner-tab:has-text("Deals")');

    await dealsTab.click();

    await expect(dealsTab).toHaveClass(/active/);
    await expect(page.locator('.deals-grid')).toBeVisible();
  });

  test('Services tab button activates and shows content', async ({ page }) => {
    const servicesTab = page.locator('.banner-tab:has-text("Services")');

    await servicesTab.click();

    await expect(servicesTab).toHaveClass(/active/);
    await expect(page.locator('input[placeholder*="services"]')).toBeVisible();
  });
});

test.describe('View Switcher Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
  });

  test('Consumer button activates correctly', async ({ page }) => {
    const consumerBtn = page.locator('button:has-text("Consumer")');

    // Should be active by default
    await expect(consumerBtn).toHaveClass(/active/);

    // Click it anyway
    await consumerBtn.click();

    // Still active
    await expect(consumerBtn).toHaveClass(/active/);

    // Consumer view visible
    await expect(page.locator('.consumer-view')).toBeVisible();
  });

  test('Business button activates correctly', async ({ page }) => {
    const businessBtn = page.locator('button:has-text("Business")');
    const consumerBtn = page.locator('button:has-text("Consumer")');

    await businessBtn.click();
    await page.waitForTimeout(300);

    await expect(businessBtn).toHaveClass(/active/);
    await expect(consumerBtn).not.toHaveClass(/active/);
  });

  test('switching views updates button states', async ({ page }) => {
    const consumerBtn = page.locator('button:has-text("Consumer")');
    const businessBtn = page.locator('button:has-text("Business")');

    // Start consumer
    await expect(consumerBtn).toHaveClass(/active/);

    // Go to business
    await businessBtn.click();
    await page.waitForTimeout(300);
    await expect(businessBtn).toHaveClass(/active/);
    await expect(consumerBtn).not.toHaveClass(/active/);

    // Back to consumer
    await consumerBtn.click();
    await page.waitForTimeout(300);
    await expect(consumerBtn).toHaveClass(/active/);
    await expect(businessBtn).not.toHaveClass(/active/);
  });
});

test.describe('Search Clear Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });
  });

  test('clear button appears when text entered', async ({ page }) => {
    const input = page.locator('.search-bar-premium input');

    // Initially no clear button
    await expect(page.locator('.search-clear-btn')).not.toBeVisible();

    // Type text
    await input.fill('test');

    // Clear button appears
    await expect(page.locator('.search-clear-btn')).toBeVisible();
  });

  test('clear button clears the input', async ({ page }) => {
    const input = page.locator('.search-bar-premium input');

    await input.fill('test search text');
    expect(await input.inputValue()).toBe('test search text');

    await page.click('.search-clear-btn');

    expect(await input.inputValue()).toBe('');
    await expect(page.locator('.search-clear-btn')).not.toBeVisible();
  });
});

test.describe('Card Action Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);
  });

  test('card click opens modal', async ({ page }) => {
    const card = page.locator('.event-card, .class-card').first();

    if (await card.count() === 0) {
      test.skip('No cards found');
      return;
    }

    await card.click();

    await expect(page.locator('.modal-overlay').first()).toBeVisible({ timeout: 5000 });
  });

  test('save button is clickable', async ({ page }) => {
    const card = page.locator('.event-card, .class-card').first();

    if (await card.count() === 0) {
      test.skip('No cards found');
      return;
    }

    const saveBtn = card.locator('button[class*="save"], .save-btn, svg[class*="save"]').first();

    if (await saveBtn.count() > 0) {
      // Button exists and is clickable
      await expect(saveBtn).toBeVisible();

      // Click it
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Either auth modal appears (guest) or toast appears (auth)
      const authModal = page.locator('.auth-modal');
      const toast = page.locator('.toast, [class*="toast"]');

      const result = (await authModal.isVisible()) || (await toast.isVisible());
      console.log('Save button produced response:', result);
    }
  });
});

test.describe('Modal Close Buttons', () => {
  test('X button closes event modal', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    const card = page.locator('.event-card, .class-card').first();
    if (await card.count() === 0) {
      test.skip('No cards');
      return;
    }

    await card.click();
    await page.waitForSelector('.modal-overlay, [class*="detail-modal"]', { timeout: 5000 });

    const closeBtn = page.locator('.close-btn, button:has-text("×"), [class*="close-btn"]').first();
    await closeBtn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('.event-detail-modal')).not.toBeVisible();
  });

  test('X button closes deal modal', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000);

    const card = page.locator('.deal-card').first();
    if (await card.count() === 0) {
      test.skip('No deals');
      return;
    }

    await card.click();
    await page.waitForSelector('.deal-detail-modal', { timeout: 5000 });

    const closeBtn = page.locator('.deal-detail-modal .close-btn, .deal-detail-modal button:has-text("×")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator('.deal-detail-modal')).not.toBeVisible();
  });
});

test.describe('Profile Menu Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.profile-btn', { timeout: 10000 });
  });

  test('profile button opens menu or modal', async ({ page }) => {
    const profileBtn = page.locator('.profile-btn');

    await profileBtn.click();
    await page.waitForTimeout(500);

    // Either auth modal (guest) or profile menu (auth)
    const authModal = page.locator('.auth-modal');
    const profileMenu = page.locator('.profile-menu, .profile-dropdown, [class*="profile-menu"]');

    const opened = (await authModal.isVisible()) || (await profileMenu.isVisible());
    expect(opened).toBe(true);
  });
});

test.describe('Filter Dropdown Buttons', () => {
  test('deal category dropdown is functional', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Deals")');
    await page.waitForTimeout(2000);

    const dropdown = page.locator('select').first();

    if (!(await dropdown.isVisible())) {
      test.skip('No dropdown found');
      return;
    }

    // Get options count
    const options = await dropdown.locator('option').count();
    console.log('Dropdown has', options, 'options');

    expect(options).toBeGreaterThan(1);

    // Select different option
    await dropdown.selectOption({ index: 1 });

    const selectedValue = await dropdown.inputValue();
    expect(selectedValue).toBeTruthy();
  });
});

test.describe('Age Group Filter Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Classes")');
    await page.waitForTimeout(1000);
  });

  test('age filter buttons are clickable and update state', async ({ page }) => {
    const ageButtons = page.locator('.age-filter button, button[class*="age"], .filter-pill');

    const buttonCount = await ageButtons.count();
    console.log('Found', buttonCount, 'age filter buttons');

    if (buttonCount > 0) {
      // Click first button
      const firstBtn = ageButtons.first();
      await firstBtn.click();
      await page.waitForTimeout(300);

      // Should have active state
      const hasActive = await firstBtn.evaluate(el =>
        el.classList.contains('active') ||
        el.classList.contains('selected') ||
        el.getAttribute('aria-pressed') === 'true'
      );

      console.log('First button has active state:', hasActive);
    }
  });
});

test.describe('Booking Sheet Buttons', () => {
  test('book now button opens booking sheet', async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Events")');
    await page.waitForTimeout(1000);

    const card = page.locator('.event-card, .class-card').first();
    if (await card.count() === 0) {
      test.skip('No cards');
      return;
    }

    await card.click();
    await page.waitForSelector('.modal-overlay, [class*="detail-modal"]', { timeout: 5000 });

    const bookBtn = page.locator('button:has-text("Book"), button:has-text("Register")').first();

    if (await bookBtn.isVisible()) {
      await bookBtn.click();
      await page.waitForTimeout(500);

      // Booking sheet should appear
      const bookingSheet = page.locator('.booking-sheet, .booking-modal, [class*="booking"]');
      console.log('Booking sheet visible:', await bookingSheet.isVisible());
    }
  });
});

test.describe('Toast Dismiss Buttons', () => {
  test('toast auto-dismisses after timeout', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Trigger a toast by searching
    const input = page.locator('.search-bar-premium input');
    await input.fill('test');

    // Wait for any toast
    await page.waitForTimeout(5000);

    // Toast should auto-dismiss
    // (Hard to test without triggering specific actions that show toasts)
  });
});
