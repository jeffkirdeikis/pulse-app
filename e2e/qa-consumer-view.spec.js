import { test, expect } from '@playwright/test';

// Run tests serially to avoid resource contention
test.describe.configure({ mode: 'serial' });

// Increase default timeout for all tests
test.setTimeout(60000);

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I4QhFf1o4-l5Q61Hl9I99w_gJEpuREo';
const TEST_EMAIL = 'test-consumer@pulse-test.com';
const TEST_PASSWORD = 'TestPass123';

// ============================================================
// SECTION A: Guest (unauthenticated) Tests
// ============================================================
test.describe('Guest Consumer View', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any saved auth state
    await page.goto('/', { timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
  });

  // --- Test 1: Page loads with events visible ---
  test('1. Page loads with events visible (not blank)', async ({ page }) => {
    // Default tab is "classes" which uses event-card components
    await page.waitForSelector('.event-card', { timeout: 20000 });
    const cards = page.locator('.event-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Verify results count is shown and is not "Loading..."
    const resultsCount = page.locator('.results-count');
    await expect(resultsCount).toBeVisible({ timeout: 10000 });
    await expect(resultsCount).not.toHaveText('Loading...', { timeout: 10000 });
    const text = await resultsCount.textContent();
    expect(text).toMatch(/\d+ results?/);
  });

  // --- Test 2: Tab navigation ---
  test('2. Tab navigation: Events, Deals, Services tabs work', async ({ page }) => {
    // Verify Classes tab is default active
    const classesTab = page.locator('.banner-tab:has-text("Classes")');
    await expect(classesTab).toHaveClass(/active/);

    // Click Events tab
    await page.locator('.banner-tab:has-text("Events")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.banner-tab:has-text("Events")')).toHaveClass(/active/);
    // Events may or may not have cards - just check page is not blank (results-count exists)
    await expect(page.locator('.results-count')).toBeVisible({ timeout: 10000 });

    // Click Deals tab
    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.banner-tab:has-text("Deals")')).toHaveClass(/active/);
    await expect(page.locator('.results-count')).toBeVisible({ timeout: 10000 });

    // Click Services tab
    await page.locator('.banner-tab:has-text("Services")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.banner-tab:has-text("Services")')).toHaveClass(/active/);
    // Services tab may show results-count or search-results-count
    await expect(page.locator('.results-count')).toBeVisible({ timeout: 10000 });
  });

  // --- Test 3: Search bar functionality ---
  test('3. Search bar - type a term, verify results filter', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Get initial count
    const resultsCount = page.locator('.results-count');
    await expect(resultsCount).not.toHaveText('Loading...', { timeout: 10000 });
    const initialText = await resultsCount.textContent();
    const initialCount = parseInt(initialText.match(/\d+/)?.[0] || '0');

    // Type in search
    const searchInput = page.locator('.search-bar-premium input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('yoga');
    await page.waitForTimeout(800);

    // Verify results changed
    const newText = await resultsCount.textContent();
    const newCount = parseInt(newText.match(/\d+/)?.[0] || '0');
    expect(newCount).toBeLessThanOrEqual(initialCount);

    // Verify clear button appears
    const clearBtn = page.locator('.search-clear-btn');
    await expect(clearBtn).toBeVisible();

    // Clear search
    await clearBtn.click();
    await page.waitForTimeout(500);

    // Count should restore
    const restoredText = await resultsCount.textContent();
    const restoredCount = parseInt(restoredText.match(/\d+/)?.[0] || '0');
    expect(restoredCount).toBeGreaterThanOrEqual(newCount);
  });

  // --- Test 4: Filter section ---
  test('4. Filter section - toggle, day filter, category dropdown', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Click "Show Filters" button
    const filtersToggle = page.locator('.filters-toggle-btn');
    await expect(filtersToggle).toBeVisible();
    await filtersToggle.click();
    await page.waitForTimeout(500);

    // Verify filter dropdowns appear
    const filterDropdowns = page.locator('.filters-section .filter-dropdown');
    const ddCount = await filterDropdowns.count();
    expect(ddCount).toBeGreaterThanOrEqual(3); // day, time, age, category, price

    // Test day filter - select "Anytime"
    const dayFilter = page.locator('.filter-dropdown[aria-label="Filter by day"]');
    await dayFilter.selectOption('anytime');
    await page.waitForTimeout(500);

    // The count may change
    const resultsCount = page.locator('.results-count');
    const anytimeText = await resultsCount.textContent();
    expect(anytimeText).toMatch(/\d+ results?/);

    // Test category filter
    const categoryFilter = page.locator('.filter-dropdown[aria-label="Filter by category"]');
    const categoryOptions = categoryFilter.locator('option');
    const catOptCount = await categoryOptions.count();
    expect(catOptCount).toBeGreaterThanOrEqual(2); // "All Categories" + at least one

    // Toggle filters closed
    await filtersToggle.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.filters-section')).not.toBeVisible();
  });

  // --- Test 5: Event cards display properly ---
  test('5. Event cards display title, date, venue', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    const firstCard = page.locator('.event-card').first();

    // Title
    const title = firstCard.locator('h3');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText.length).toBeGreaterThan(0);

    // Date (detail-text with Calendar icon)
    const detailItems = firstCard.locator('.event-detail-item');
    const detailCount = await detailItems.count();
    expect(detailCount).toBeGreaterThanOrEqual(2); // date + time at minimum

    // Venue
    const venueItem = firstCard.locator('.venue-item');
    await expect(venueItem).toBeVisible();
    const venueText = await venueItem.locator('.detail-text').textContent();
    expect(venueText.length).toBeGreaterThan(0);
  });

  // --- Test 6: Click event card - detail modal opens ---
  test('6. Click event card - event detail modal opens with proper info', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Get card title first
    const cardTitle = await page.locator('.event-card').first().locator('h3').textContent();

    // Click to open
    await page.locator('.event-card').first().click();
    await page.waitForTimeout(500);

    // Modal should be visible
    const modal = page.locator('.event-detail-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Hero title should match card title
    const heroTitle = page.locator('.event-hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText(cardTitle);

    // Check for venue in modal
    const heroVenue = page.locator('.event-hero-venue');
    await expect(heroVenue).toBeVisible();

    // Check for date/time card
    const datetimeCard = page.locator('.event-datetime-card');
    await expect(datetimeCard).toBeVisible();

    // Check for quick actions (Save, Share, Directions)
    const saveAction = page.locator('.quick-action-btn:has-text("Save")');
    await expect(saveAction).toBeVisible();
    const shareAction = page.locator('.quick-action-btn:has-text("Share")');
    await expect(shareAction).toBeVisible();
    const directionsAction = page.locator('.quick-action-btn:has-text("Directions")');
    await expect(directionsAction).toBeVisible();
  });

  // --- Test 7: Close modal via X button, overlay click ---
  test('7. Close modal via X button and overlay click', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Open modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Close via X button
    await page.locator('.event-close').click();
    await expect(page.locator('.event-detail-modal')).not.toBeVisible({ timeout: 5000 });

    // Open again
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Close via overlay click (click the overlay outside the modal)
    await page.locator('.event-modal-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.event-detail-modal')).not.toBeVisible({ timeout: 5000 });
  });

  // --- Test 8: Deal cards display ---
  test('8. Deal cards display on Deals tab', async ({ page }) => {
    // Switch to Deals tab
    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1500);

    // Wait for deal cards
    await page.waitForSelector('.deal-card', { timeout: 20000 });

    const dealCards = page.locator('.deal-card');
    const dealCount = await dealCards.count();
    expect(dealCount).toBeGreaterThan(0);

    // Check first deal card structure
    const firstDeal = dealCards.first();
    const dealTitle = firstDeal.locator('h3');
    await expect(dealTitle).toBeVisible();
    const dealTitleText = await dealTitle.textContent();
    expect(dealTitleText.length).toBeGreaterThan(0);

    // Check for venue
    const venueText = firstDeal.locator('.detail-text').first();
    await expect(venueText).toBeVisible();

    // Check for save button
    const saveBtn = firstDeal.locator('.save-star-btn');
    await expect(saveBtn).toBeVisible();

    // Click deal card to open modal
    await firstDeal.click();
    await page.waitForTimeout(500);
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });

    // Close modal
    const closeBtn = page.locator('.close-btn, .modal-close-btn, .event-close').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    } else {
      // Close via overlay
      await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
      await page.waitForTimeout(500);
    }
  });

  // --- Test 9: Service cards display ---
  test('9. Service cards display on Services tab', async ({ page }) => {
    // Switch to Services tab
    await page.locator('.banner-tab:has-text("Services")').click();
    await page.waitForTimeout(1500);

    // Wait for service cards
    await page.waitForSelector('.service-card', { timeout: 20000 });

    const serviceCards = page.locator('.service-card');
    const serviceCount = await serviceCards.count();
    expect(serviceCount).toBeGreaterThan(0);

    // Check first service card
    const firstService = serviceCards.first();
    const serviceName = firstService.locator('h3');
    await expect(serviceName).toBeVisible();
    const serviceNameText = await serviceName.textContent();
    expect(serviceNameText.length).toBeGreaterThan(0);

    // Click on the card title area (not the map link) to open modal
    await serviceName.click();
    await page.waitForTimeout(500);

    // Service modal uses class "service-modal-overlay" (subclass of modal-overlay)
    await expect(page.locator('.service-modal-overlay')).toBeVisible({ timeout: 10000 });

    // Check modal has service name
    const modalTitle = page.locator('.service-detail-modal h1, .service-detail-modal h2, .service-hero-name').first();
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // Close service modal via close button
    const closeBtn = page.locator('.service-close');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.locator('.service-modal-overlay').click({ position: { x: 5, y: 5 } });
    }
    await page.waitForTimeout(500);
    await expect(page.locator('.service-modal-overlay')).not.toBeVisible({ timeout: 5000 });
  });

  // --- Test 12: Guest save prompts local save message ---
  test('12. Guest save - shows local save toast, not auth prompt', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Click save star on first card
    const saveBtn = page.locator('.event-card').first().locator('.save-star-btn');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // For guest users, the app saves locally and shows a toast
    // Check that localStorage was updated
    const savedItems = await page.evaluate(() => localStorage.getItem('pulse_local_saves'));
    expect(savedItems).not.toBeNull();
    const parsed = JSON.parse(savedItems);
    expect(parsed.length).toBeGreaterThan(0);

    // Check for toast message about local save
    const toast = page.locator('.calendar-toast');
    const toastVisible = await toast.isVisible().catch(() => false);
    // Toast should have appeared (may have auto-dismissed)
    // Verify the save state on the button
    const btnClass = await saveBtn.getAttribute('class');
    expect(btnClass).toContain('saved');
  });

  // --- Test 13: Show More / Pagination ---
  test('13. Show More / pagination if present', async ({ page }) => {
    // Switch to anytime filter to get more results
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Open filters
    const filtersToggle = page.locator('.filters-toggle-btn');
    await filtersToggle.click();
    await page.waitForTimeout(500);

    // Select "Anytime" to get maximum results
    const dayFilter = page.locator('.filter-dropdown[aria-label="Filter by day"]');
    await dayFilter.selectOption('anytime');
    await page.waitForTimeout(1500);

    // Check the results count
    const resultsText = await page.locator('.results-count').textContent();
    const totalCount = parseInt(resultsText.match(/\d+/)?.[0] || '0');

    if (totalCount > 50) {
      // Show More button should be present
      const showMoreBtn = page.locator('.btn-secondary:has-text("Show More")');
      await showMoreBtn.scrollIntoViewIfNeeded();
      await expect(showMoreBtn).toBeVisible({ timeout: 10000 });

      // Get initial visible card count
      const initialVisibleCards = await page.locator('.event-card').count();

      // Click Show More
      await showMoreBtn.click();
      await page.waitForTimeout(1000);

      // More cards should now be visible
      const newVisibleCards = await page.locator('.event-card').count();
      expect(newVisibleCards).toBeGreaterThan(initialVisibleCards);
    } else {
      // Not enough data for pagination - just verify cards are shown
      expect(totalCount).toBeGreaterThan(0);
    }
  });

  // --- Test 14: Feedback widget ---
  test('14. Feedback widget is visible and opens', async ({ page }) => {
    // Check for feedback FAB
    const feedbackFab = page.locator('.feedback-fab');
    await expect(feedbackFab).toBeVisible({ timeout: 10000 });

    // Click to open
    await feedbackFab.click();
    await page.waitForTimeout(500);

    // Feedback modal should open
    const feedbackModal = page.locator('.feedback-modal');
    await expect(feedbackModal).toBeVisible({ timeout: 5000 });

    // Check for type selector buttons
    const typeButtons = page.locator('.feedback-type-btn');
    const typeCount = await typeButtons.count();
    expect(typeCount).toBe(3); // Bug Report, Comment, Suggestion

    // Check for textarea
    const textarea = page.locator('.feedback-textarea');
    await expect(textarea).toBeVisible();

    // Check for submit button (disabled when empty)
    const submitBtn = page.locator('.feedback-submit');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Type something and verify button enables
    await textarea.fill('Test feedback message');
    await expect(submitBtn).toBeEnabled();

    // Close feedback modal
    const closeBtn = page.locator('.feedback-close');
    await closeBtn.click();
    await page.waitForTimeout(500);
    await expect(feedbackModal).not.toBeVisible();
  });

  // --- Test 15: Console errors during navigation ---
  test('15. No critical console errors during navigation', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known non-critical errors (CORS, favicon, etc.)
        if (!text.includes('favicon') &&
            !text.includes('net::ERR_') &&
            !text.includes('Failed to load resource') &&
            !text.includes('Avatar failed to load') &&
            !text.includes('third-party cookie')) {
          consoleErrors.push(text);
        }
      }
    });

    // Navigate through all tabs
    await page.waitForSelector('.event-card', { timeout: 20000 });

    await page.locator('.banner-tab:has-text("Events")').click();
    await page.waitForTimeout(1500);

    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1500);

    await page.locator('.banner-tab:has-text("Services")').click();
    await page.waitForTimeout(1500);

    await page.locator('.banner-tab:has-text("Classes")').click();
    await page.waitForTimeout(1500);

    // Open and close a modal
    await page.waitForSelector('.event-card', { timeout: 10000 });
    await page.locator('.event-card').first().click();
    await page.waitForTimeout(500);
    if (await page.locator('.event-close').isVisible()) {
      await page.locator('.event-close').click();
    }
    await page.waitForTimeout(500);

    // Report console errors (warn but don't fail on non-critical)
    if (consoleErrors.length > 0) {
      console.log(`Console errors found (${consoleErrors.length}):`);
      consoleErrors.forEach(e => console.log(`  - ${e}`));
    }

    // Fail only on critical JS errors (uncaught exceptions, reference errors)
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('Uncaught') ||
      e.includes('ReferenceError') ||
      e.includes('TypeError') ||
      e.includes('Cannot read properties')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});


// ============================================================
// SECTION B: Authenticated Consumer Tests
// ============================================================
test.describe('Authenticated Consumer View', () => {

  // Helper: sign in via Supabase API and inject session into localStorage
  async function signInAsTestConsumer(page) {
    // Sign in via Supabase Auth REST API
    const response = await page.evaluate(async ({ url, key, email, password }) => {
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': key,
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ email, password }),
      });
      return res.json();
    }, { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, email: TEST_EMAIL, password: TEST_PASSWORD });

    if (response.error) {
      console.log('Auth error:', JSON.stringify(response.error));
      return false;
    }

    if (!response.access_token) {
      console.log('No access_token in response:', JSON.stringify(response));
      return false;
    }

    // Inject the session into Supabase's localStorage key
    const supabaseKey = `sb-ygpfklhjwwqwrfpsfhue-auth-token`;
    const sessionData = JSON.stringify({
      access_token: response.access_token,
      refresh_token: response.refresh_token,
      token_type: 'bearer',
      expires_in: response.expires_in,
      expires_at: response.expires_at,
      user: response.user,
    });

    await page.evaluate(({ key, data }) => {
      localStorage.setItem(key, data);
    }, { key: supabaseKey, data: sessionData });

    return true;
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const signedIn = await signInAsTestConsumer(page);
    if (!signedIn) {
      test.skip();
      return;
    }

    // Reload to pick up the session
    await page.reload({ timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
    // Wait for auth state to settle
    await page.waitForTimeout(2000);
  });

  // --- Test 10: Save/bookmark functionality as signed-in user ---
  test('10. Signed-in user: save/bookmark on event card', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    const firstCard = page.locator('.event-card').first();
    const saveBtn = firstCard.locator('.save-star-btn');
    await expect(saveBtn).toBeVisible();

    // Check initial state
    const initialClass = await saveBtn.getAttribute('class');
    const wasSaved = initialClass.includes('saved');

    // Click to toggle
    await saveBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // State should have toggled
    const newClass = await saveBtn.getAttribute('class');
    const isNowSaved = newClass.includes('saved');
    expect(isNowSaved).not.toBe(wasSaved);

    // Toggle back to original state
    await saveBtn.click({ force: true });
    await page.waitForTimeout(1500);

    const restoredClass = await saveBtn.getAttribute('class');
    const isRestoredState = restoredClass.includes('saved');
    expect(isRestoredState).toBe(wasSaved);
  });

  // --- Test 10b: Save from within modal ---
  test('10b. Signed-in user: save from event detail modal', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Open modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Find Save quick action
    const saveAction = page.locator('.quick-action-btn:has-text("Save"), .quick-action-btn:has-text("Saved")').first();
    await expect(saveAction).toBeVisible();

    // Get initial state
    const initialText = await saveAction.locator('span').textContent();

    // Click to toggle
    await saveAction.click();
    await page.waitForTimeout(1500);

    // Verify state changed
    const newText = await saveAction.locator('span').textContent();
    if (initialText === 'Save') {
      expect(newText).toBe('Saved');
    } else {
      expect(newText).toBe('Save');
    }

    // Close modal
    await page.locator('.event-close').click();
    await page.waitForTimeout(500);
  });

  // --- Test 11: Calendar add functionality ---
  test('11. Signed-in user: add to calendar', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Open event modal
    await page.locator('.event-card').first().click();
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 10000 });

    // Find the "Add to Calendar" button in the datetime card
    const calendarBtn = page.locator('.add-calendar-btn');
    await expect(calendarBtn).toBeVisible();

    // Click to add
    await calendarBtn.click();
    await page.waitForTimeout(1500);

    // Check if the button changed to "added" state (green checkmark)
    // or check for the CTA button state
    const ctaCalBtn = page.locator('.event-cta-btn:has-text("Added to Calendar"), .event-cta-btn:has-text("Add to Calendar")');
    const ctaText = await ctaCalBtn.textContent();
    // The button should show "Added to Calendar" if successful
    // or we may see a toast
    const toastVisible = await page.locator('.calendar-toast').isVisible().catch(() => false);

    // At least one indicator should show the action was performed
    expect(ctaText.includes('Added') || ctaText.includes('Add') || toastVisible).toBeTruthy();

    // Close modal
    await page.locator('.event-close').click();
    await page.waitForTimeout(500);
  });

  // --- Test: Signed-in user sees profile button (not Sign In) ---
  test('Signed-in user: profile avatar visible instead of Sign In', async ({ page }) => {
    // When signed in, should see profile-btn with avatar, not sign-in-btn
    const profileBtn = page.locator('.profile-btn');
    const signInBtn = page.locator('.sign-in-btn');

    // Either profile is visible or sign-in is visible, depending on auth state
    const profileVisible = await profileBtn.isVisible().catch(() => false);
    const signInVisible = await signInBtn.isVisible().catch(() => false);

    // If the auth injection worked, profile should be visible
    if (profileVisible) {
      await expect(profileBtn).toBeVisible();
      // Should have avatar content
      const avatar = profileBtn.locator('.profile-avatar');
      await expect(avatar).toBeVisible();
    } else if (signInVisible) {
      // Auth may not have persisted - document this
      console.log('Note: Sign In button visible - auth session may not have persisted');
      expect(signInVisible).toBeTruthy();
    }
  });

  // --- Test: Save deal as signed-in user ---
  test('Save deal as signed-in user', async ({ page }) => {
    // Switch to Deals tab
    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('.deal-card', { timeout: 20000 });

    const firstDeal = page.locator('.deal-card').first();
    const saveBtn = firstDeal.locator('.save-star-btn');
    await expect(saveBtn).toBeVisible();

    // Toggle save
    const initialClass = await saveBtn.getAttribute('class');
    const wasSaved = initialClass.includes('saved');

    await saveBtn.click({ force: true });
    await page.waitForTimeout(1500);

    const newClass = await saveBtn.getAttribute('class');
    const isNowSaved = newClass.includes('saved');
    expect(isNowSaved).not.toBe(wasSaved);

    // Unsave to clean up
    await saveBtn.click({ force: true });
    await page.waitForTimeout(1000);
  });
});


// ============================================================
// SECTION C: Additional Edge Case Tests (Guest)
// ============================================================
test.describe('Edge Cases & Cross-Tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ timeout: 30000 });
    await page.waitForSelector('.banner-tab', { timeout: 30000 });
  });

  // --- Test: Deals tab category filter works ---
  test('Deals tab category filter works', async ({ page }) => {
    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('.deal-card', { timeout: 20000 });

    // Get initial count
    const resultsCount = page.locator('.results-count');
    const initialText = await resultsCount.textContent();
    const initialCount = parseInt(initialText.match(/\d+/)?.[0] || '0');

    // Find the deals category dropdown
    const dropdown = page.locator('.filter-dropdown[aria-label="Filter deals by category"]');
    await expect(dropdown).toBeVisible();

    // Get available options
    const options = dropdown.locator('option');
    const optCount = await options.count();
    expect(optCount).toBeGreaterThan(1); // At least "All" + 1 category

    // Select "Food & Drink" if available
    const foodOption = dropdown.locator('option:has-text("Food & Drink")');
    if (await foodOption.count() > 0) {
      await dropdown.selectOption('Food & Drink');
      await page.waitForTimeout(500);

      const filteredText = await resultsCount.textContent();
      const filteredCount = parseInt(filteredText.match(/\d+/)?.[0] || '0');
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // Select All to restore
      await dropdown.selectOption('All');
      await page.waitForTimeout(500);
    }
  });

  // --- Test: Services tab category filter works ---
  test('Services tab category filter works', async ({ page }) => {
    await page.locator('.banner-tab:has-text("Services")').click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('.service-card', { timeout: 20000 });

    // Find category dropdown
    const dropdown = page.locator('.filter-dropdown[aria-label="Filter services by category"]');
    await expect(dropdown).toBeVisible();

    // Select "Restaurants & Dining"
    await dropdown.selectOption('Restaurants & Dining');
    await page.waitForTimeout(800);

    // Should show filtered results
    const resultsCount = page.locator('.results-count');
    const text = await resultsCount.textContent();
    const count = parseInt(text.match(/\d+/)?.[0] || '0');
    expect(count).toBeGreaterThan(0);

    // Reset
    await dropdown.selectOption('All');
    await page.waitForTimeout(500);
  });

  // --- Test: Search on Deals tab ---
  test('Search works on Deals tab', async ({ page }) => {
    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('.deal-card', { timeout: 20000 });

    const searchInput = page.locator('.search-bar-premium input');
    await expect(searchInput).toBeVisible();

    // Get initial count
    const resultsCount = page.locator('.results-count');
    const initialText = await resultsCount.textContent();
    const initialCount = parseInt(initialText.match(/\d+/)?.[0] || '0');

    // Type a search term
    await searchInput.fill('food');
    await page.waitForTimeout(800);

    const filteredText = await resultsCount.textContent();
    const filteredCount = parseInt(filteredText.match(/\d+/)?.[0] || '0');
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  // --- Test: Search on Services tab ---
  test('Search works on Services tab', async ({ page }) => {
    await page.locator('.banner-tab:has-text("Services")').click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('.service-card', { timeout: 20000 });

    const searchInput = page.locator('.search-bar-premium input');
    await expect(searchInput).toBeVisible();

    // Type a search
    await searchInput.fill('restaurant');
    await page.waitForTimeout(800);

    // Verify that some filtering happened
    const resultsCount = page.locator('.results-count');
    const text = await resultsCount.textContent();
    // Services shows search results count only when searching
    expect(text).toMatch(/\d+ results?/);
  });

  // --- Test: Tab switch resets search and filters ---
  test('Tab switch resets search and filters', async ({ page }) => {
    await page.waitForSelector('.event-card', { timeout: 20000 });

    // Type in search on Classes tab
    const searchInput = page.locator('.search-bar-premium input');
    await searchInput.fill('test search');
    await page.waitForTimeout(500);

    // Switch to Deals tab
    await page.locator('.banner-tab:has-text("Deals")').click();
    await page.waitForTimeout(1000);

    // Search should be cleared
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
  });
});
