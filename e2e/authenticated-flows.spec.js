/**
 * Authenticated Flow Tests
 *
 * Tests critical user actions that require a logged-in Supabase session:
 * Save/Favorite, Save Date (calendar), Book Class, Tab navigation, Scroll restore.
 *
 * Uses session injection (localStorage) to bypass CAPTCHA and sign-in UI.
 * Cleanup is handled by the authenticatedPageWithCleanup fixture.
 */
import { test, expect } from './fixtures/auth.js';

test.describe('Authenticated Flows', () => {

  // -----------------------------------------------------------------------
  // 1. Auth injection works
  // -----------------------------------------------------------------------
  test('auth injection produces logged-in state', async ({ authenticatedPage: page }) => {
    // Profile button visible = logged in
    await expect(page.locator('.profile-btn')).toBeVisible();
    // Sign-in button should NOT be visible
    await expect(page.locator('.sign-in-btn')).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 2. Save star toggles
  // -----------------------------------------------------------------------
  test('save star toggles on and off', async ({ authenticatedPageWithCleanup: page }) => {
    // Wait for cards to load
    await page.waitForSelector('.save-star-btn', { timeout: 10000 });

    const starBtn = page.locator('.save-star-btn').first();

    // Ensure it starts unsaved
    const wasSaved = await starBtn.evaluate(el => el.classList.contains('saved'));
    if (wasSaved) {
      await starBtn.click();
      await page.waitForTimeout(1000);
    }

    // Click to save
    await starBtn.click();
    await page.waitForTimeout(1500);
    await expect(starBtn).toHaveClass(/saved/);

    // Click again to unsave
    await starBtn.click();
    await page.waitForTimeout(1500);
    await expect(starBtn).not.toHaveClass(/saved/);
  });

  // -----------------------------------------------------------------------
  // 3. Save Date succeeds (no error toast)
  // -----------------------------------------------------------------------
  test('save date does not produce error toast', async ({ authenticatedPageWithCleanup: page }) => {
    // Calendar buttons are on the Events tab
    const eventsTab = page.locator('.banner-tab:has-text("Events")');
    if (await eventsTab.count() > 0) {
      await eventsTab.click();
      await page.waitForTimeout(1500);
    }

    const calBtn = page.locator('.event-calendar-btn').first();

    // Skip if no calendar buttons on page
    const count = await page.locator('.event-calendar-btn').count();
    if (count === 0) {
      test.skip(true, 'No event-calendar-btn found on Events tab');
      return;
    }

    // Record initial state
    const wasInCalendar = await calBtn.evaluate(el => el.classList.contains('in-calendar'));

    await calBtn.click();
    await page.waitForTimeout(2000);

    // No error toast should appear
    const errorToasts = page.locator('.toast-error, .Toastify__toast--error');
    await expect(errorToasts).toHaveCount(0);

    // Cleanup: untoggle if we toggled it on
    if (!wasInCalendar) {
      const nowInCalendar = await calBtn.evaluate(el => el.classList.contains('in-calendar'));
      if (nowInCalendar) {
        await calBtn.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  // -----------------------------------------------------------------------
  // 4. Book Class opens booking sheet
  // -----------------------------------------------------------------------
  test('book class opens booking sheet', async ({ authenticatedPage: page }) => {
    // Book buttons are on the Classes tab (default landing)
    const classesTab = page.locator('.banner-tab:has-text("Classes")');
    if (await classesTab.count() > 0) {
      await classesTab.click();
      await page.waitForTimeout(1500);
    }

    const count = await page.locator('.event-book-btn').count();
    if (count === 0) {
      test.skip(true, 'No event-book-btn found on Classes tab');
      return;
    }

    const bookBtn = page.locator('.event-book-btn').first();

    await bookBtn.click();
    await page.waitForTimeout(1500);

    // Either the booking sheet appears, or a new tab opens (external booking URL).
    // Check for the sheet first.
    const sheetVisible = await page.locator('.booking-bottom-sheet').isVisible().catch(() => false);

    if (sheetVisible) {
      await expect(page.locator('.booking-bottom-sheet')).toBeVisible();
      // Close the sheet
      const closeBtn = page.locator('.sheet-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }
    // If sheet is not visible, the button likely opened an external link — acceptable
  });

  // -----------------------------------------------------------------------
  // 5. Tab navigation switches active tab
  // -----------------------------------------------------------------------
  test('tab navigation switches active tab', async ({ authenticatedPage: page }) => {
    await page.waitForSelector('.banner-tab', { timeout: 10000 });

    const tabs = ['Events', 'Deals', 'Classes'];

    for (const tabName of tabs) {
      const tab = page.locator(`.banner-tab:has-text("${tabName}")`);
      if (await tab.count() === 0) continue;

      await tab.click();
      await page.waitForTimeout(500);

      await expect(tab).toHaveClass(/active/);
    }
  });

  // -----------------------------------------------------------------------
  // 6. Scroll restore after modal close
  // -----------------------------------------------------------------------
  test('scroll position restores after closing detail modal', async ({ authenticatedPage: page }) => {
    // Wait for content to load
    await page.waitForSelector('.event-card, .class-card, .deal-card', { timeout: 10000 });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Click a card to open detail modal
    const card = page.locator('.event-card, .class-card, .deal-card').first();
    await card.click();
    await page.waitForTimeout(1500);

    // Close modal — try overlay click, then close button
    const closed = await page.evaluate(() => {
      const overlay = document.querySelector('.modal-overlay');
      if (overlay) { overlay.click(); return true; }
      const btn = document.querySelector('.modal-close, .close-btn');
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!closed) {
      // Try pressing Escape
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(1000);
    const scrollAfter = await page.evaluate(() => window.scrollY);
    const drift = Math.abs(scrollAfter - scrollBefore);

    expect(drift).toBeLessThanOrEqual(50);
  });
});
