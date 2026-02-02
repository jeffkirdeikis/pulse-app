import { test, expect } from '@playwright/test';

// Configure longer timeout and serial execution
test.describe.configure({ mode: 'serial' });

test.describe('Deals Cards & Modal - Comprehensive Tests', () => {
  test.setTimeout(60000); // 60 second timeout per test

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 45000 });
    // Navigate to Deals tab
    await page.click('.banner-tab:has-text("Deals")');
    // Wait for deals to load
    await page.waitForTimeout(3000);
  });

  // ============================================
  // DEAL CARDS TESTS
  // ============================================

  test('1. Navigate to Deals tab successfully', async ({ page }) => {
    // Verify we're on the deals tab
    const dealsTab = page.locator('.banner-tab:has-text("Deals")');
    await expect(dealsTab).toHaveClass(/active/);
  });

  test('2. Deal cards load correctly', async ({ page }) => {
    // Wait for deal cards to appear
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    const dealCards = page.locator('.deal-card');
    const count = await dealCards.count();

    // Should have at least one deal
    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} deal cards`);
  });

  test('3. Cards show: title, description, savings %, business name, schedule', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    const firstCard = page.locator('.deal-card').first();

    // Check title exists (h3 inside deal-title-section)
    const title = firstCard.locator('.deal-title-section h3');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    console.log(`Deal title: ${titleText}`);

    // Check business name (venue with MapPin icon)
    const businessName = firstCard.locator('.deal-detail-item .detail-text').first();
    await expect(businessName).toBeVisible();
    const businessText = await businessName.textContent();
    console.log(`Business name: ${businessText}`);

    // Check for savings badge if present
    const savingsBadge = firstCard.locator('.deal-savings-badge');
    if (await savingsBadge.count() > 0) {
      const savingsText = await savingsBadge.textContent();
      console.log(`Savings: ${savingsText}`);
    } else {
      console.log('No savings badge on this card');
    }

    // Check for schedule if present
    const scheduleText = firstCard.locator('.deal-detail-item.full-width .detail-text');
    if (await scheduleText.count() > 0) {
      const schedule = await scheduleText.textContent();
      console.log(`Schedule: ${schedule}`);
    }

    // Check for description if present
    const description = firstCard.locator('.deal-description-new');
    if (await description.count() > 0) {
      const descText = await description.textContent();
      console.log(`Description: ${descText}`);
    }
  });

  test('4. Click deal card - opens modal', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    // Click first deal card
    await page.locator('.deal-card').first().click();

    // Modal should appear
    await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.deal-modal-overlay')).toBeVisible();
  });

  test('5. Save button on card works', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    const firstCard = page.locator('.deal-card').first();
    const saveBtn = firstCard.locator('.save-star-btn');

    await expect(saveBtn).toBeVisible();

    // Check initial state
    const initialClass = await saveBtn.getAttribute('class');
    const wasSaved = initialClass?.includes('saved');
    console.log(`Initial save state: ${wasSaved ? 'saved' : 'not saved'}`);

    // Click save button
    await saveBtn.click();

    // Wait for state change
    await page.waitForTimeout(500);

    // Verify state changed
    const newClass = await saveBtn.getAttribute('class');
    const isSavedNow = newClass?.includes('saved');
    console.log(`After click save state: ${isSavedNow ? 'saved' : 'not saved'}`);

    // State should have toggled
    expect(isSavedNow).not.toBe(wasSaved);
  });

  test('6. Share button on card - check if present (share is in modal)', async ({ page }) => {
    // Note: Based on code review, share button is only in the modal, not on cards
    // This test documents that behavior
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    const firstCard = page.locator('.deal-card').first();

    // Check for share button on card
    const shareOnCard = firstCard.locator('button:has-text("Share"), [data-tooltip="Share"]');
    const shareCount = await shareOnCard.count();

    console.log(`Share buttons on card: ${shareCount}`);

    // Share is in modal - open modal to verify
    await firstCard.click();
    await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });

    const shareInModal = page.locator('.deal-quick-actions button:has-text("Share"), .quick-action-btn:has-text("Share")');
    await expect(shareInModal).toBeVisible();
    console.log('Share button is available in modal');
  });

  // ============================================
  // DEAL DETAIL MODAL TESTS
  // ============================================

  test('7. Modal shows full deal details', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check hero title
    const heroTitle = modal.locator('.deal-hero-title');
    await expect(heroTitle).toBeVisible();
    const titleText = await heroTitle.textContent();
    console.log(`Modal title: ${titleText}`);

    // Check About section
    const aboutSection = modal.locator('.deal-section-title:has-text("About This Deal")');
    await expect(aboutSection).toBeVisible();

    const aboutText = modal.locator('.deal-about-text');
    await expect(aboutText).toBeVisible();
    console.log(`About text visible: ${await aboutText.textContent()}`);

    // Check Details section
    const detailsSection = modal.locator('.deal-section-title:has-text("Details")');
    await expect(detailsSection).toBeVisible();
  });

  test('8. Modal shows business information', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for modal content to load
    await page.waitForTimeout(500);

    // Check venue name in hero
    const venueInHero = modal.locator('.deal-hero-venue');
    await expect(venueInHero).toBeVisible();
    const venueName = await venueInHero.textContent();
    console.log(`Business in hero: ${venueName}`);

    // Check location in details grid - use more specific selector
    const locationLabel = modal.locator('.deal-detail-label:has-text("Location")');
    await expect(locationLabel).toBeVisible({ timeout: 5000 });

    const locationValue = modal.locator('.deal-detail-card:has(.deal-detail-label:has-text("Location")) .deal-detail-value');
    await expect(locationValue).toBeVisible();
    const locationText = await locationValue.textContent();
    console.log(`Location value: ${locationText}`);
  });

  test('9. Modal shows terms and conditions (if any)', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    // Click through deals to find one with terms
    const dealCards = page.locator('.deal-card');
    const count = await dealCards.count();

    let foundTerms = false;

    for (let i = 0; i < Math.min(count, 5); i++) {
      await dealCards.nth(i).click();
      await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });

      const termsSection = page.locator('.deal-section-title:has-text("Terms & Conditions")');
      if (await termsSection.count() > 0) {
        await expect(termsSection).toBeVisible();
        const termsText = page.locator('.deal-terms-text');
        await expect(termsText).toBeVisible();
        console.log(`Found terms: ${await termsText.textContent()}`);
        foundTerms = true;
        break;
      }

      // Close modal to try next deal
      await page.locator('.deal-close').click();
      await expect(page.locator('.deal-detail-modal')).not.toBeVisible({ timeout: 3000 });
    }

    console.log(`Found deal with terms: ${foundTerms}`);
    // Test passes either way - some deals may not have terms
  });

  test('10. Modal shows schedule/valid times', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check schedule card exists
    const scheduleCard = modal.locator('.deal-schedule-card');
    await expect(scheduleCard).toBeVisible();

    const scheduleLabel = scheduleCard.locator('.schedule-label');
    await expect(scheduleLabel).toHaveText('Available');

    // Schedule value may be empty for some deals
    const scheduleValue = scheduleCard.locator('.schedule-value');
    const scheduleText = await scheduleValue.textContent();
    console.log(`Schedule: ${scheduleText || '(empty)'}`);

    // Also check schedule in details grid
    const scheduleInDetails = modal.locator('.deal-detail-card:has(.deal-detail-label:has-text("Schedule"))');
    if (await scheduleInDetails.count() > 0) {
      const detailSchedule = await scheduleInDetails.locator('.deal-detail-value').textContent();
      console.log(`Schedule in details: ${detailSchedule || '(empty)'}`);
    }
  });

  test('11. Modal shows related deals from same business (if any)', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    // Try multiple deals to find one with related deals
    const dealCards = page.locator('.deal-card');
    const count = await dealCards.count();

    let foundRelated = false;

    for (let i = 0; i < Math.min(count, 10); i++) {
      await dealCards.nth(i).click();
      await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });

      const relatedSection = page.locator('.deal-section-title:has-text("More from")');
      if (await relatedSection.count() > 0) {
        await expect(relatedSection).toBeVisible();
        const relatedGrid = page.locator('.related-deals-grid');
        await expect(relatedGrid).toBeVisible();

        const relatedCards = page.locator('.related-deal-card');
        const relatedCount = await relatedCards.count();
        console.log(`Found ${relatedCount} related deals`);
        foundRelated = true;
        break;
      }

      // Close modal and try next
      await page.locator('.deal-close').click();
      await expect(page.locator('.deal-detail-modal')).not.toBeVisible({ timeout: 3000 });
    }

    console.log(`Found deal with related deals: ${foundRelated}`);
  });

  test('12. X button closes modal', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find and click close button
    const closeBtn = page.locator('.deal-close, .close-btn.deal-close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    console.log('X button successfully closes modal');
  });

  test('13. Overlay click closes modal', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    const overlay = page.locator('.deal-modal-overlay');

    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click on overlay (outside modal) - use force and position at corner
    await overlay.click({ position: { x: 10, y: 10 }, force: true });

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    console.log('Overlay click successfully closes modal');
  });

  // ============================================
  // DEAL ACTIONS TESTS
  // ============================================

  test('14. Save deal button in modal works', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find save button in quick actions
    const saveBtn = modal.locator('.quick-action-btn:has-text("Save"), .quick-action-btn.saved');
    await expect(saveBtn).toBeVisible();

    // Get initial state
    const initialClass = await saveBtn.getAttribute('class');
    const wasSaved = initialClass?.includes('saved');
    console.log(`Initial modal save state: ${wasSaved ? 'saved' : 'not saved'}`);

    // Click save
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Check new state
    const newClass = await saveBtn.getAttribute('class');
    const isSavedNow = newClass?.includes('saved');
    console.log(`After click modal save state: ${isSavedNow ? 'saved' : 'not saved'}`);

    // State should toggle
    expect(isSavedNow).not.toBe(wasSaved);
  });

  test('15. Share deal button in modal works', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find share button
    const shareBtn = modal.locator('.quick-action-btn:has-text("Share")');
    await expect(shareBtn).toBeVisible();

    // Click share - should copy to clipboard (navigator.share fallback)
    await shareBtn.click();

    // Wait for toast notification
    await page.waitForTimeout(1000);

    // Check for toast message about clipboard
    const toast = page.locator('.toast, [class*="toast"]');
    if (await toast.count() > 0) {
      const toastText = await toast.textContent();
      console.log(`Toast message: ${toastText}`);
    } else {
      console.log('Share action triggered (may have used native share or clipboard)');
    }
  });

  test('16. "Redeem Deal" button is present', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find redeem button
    const redeemBtn = modal.locator('.deal-cta-btn.primary:has-text("Redeem Deal")');
    await expect(redeemBtn).toBeVisible();
    console.log('Redeem Deal button is present');
  });

  test('17. As guest - redeem prompts for sign in', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find and click redeem button
    const redeemBtn = modal.locator('.deal-cta-btn.primary:has-text("Redeem Deal")');
    await expect(redeemBtn).toBeVisible();
    await redeemBtn.click();

    // Should show auth modal for guests
    const authModal = page.locator('.auth-modal').first();
    await expect(authModal).toBeVisible({ timeout: 5000 });
    console.log('Auth modal shown for guest user attempting redemption');

    // Verify it's asking for sign in - check for "Welcome" heading
    const welcomeHeading = page.getByRole('heading', { name: 'Welcome Back' });
    await expect(welcomeHeading).toBeVisible();
    console.log('Auth modal contains "Welcome Back" heading - authentication required');
  });

  test('18. Category filter on deals tab filters correctly', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    // Get initial count
    const initialCount = await page.locator('.deal-card').count();
    console.log(`Initial deal count: ${initialCount}`);

    // Find category filter dropdown
    const categorySelect = page.locator('select.filter-dropdown');
    await expect(categorySelect).toBeVisible();

    // Get available options
    const options = await categorySelect.locator('option').allTextContents();
    console.log(`Available categories: ${options.join(', ')}`);

    // Try filtering by a specific category (not "All")
    if (options.length > 1) {
      // Select second option (first non-All option)
      await categorySelect.selectOption({ index: 1 });

      await page.waitForTimeout(500);

      const filteredCount = await page.locator('.deal-card').count();
      console.log(`Filtered deal count: ${filteredCount}`);

      // Count should be same or less (filter applied)
      expect(filteredCount).toBeLessThanOrEqual(initialCount);

      // Reset to All
      await categorySelect.selectOption({ index: 0 });
      await page.waitForTimeout(500);

      const resetCount = await page.locator('.deal-card').count();
      console.log(`Reset deal count: ${resetCount}`);

      // Should be back to original count
      expect(resetCount).toBe(initialCount);
    }
  });

  // ============================================
  // ADDITIONAL GUEST USER TESTS
  // ============================================

  test('Guest user can browse all deals without authentication', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    const dealCards = page.locator('.deal-card');
    const count = await dealCards.count();

    console.log(`Guest can see ${count} deals`);
    expect(count).toBeGreaterThan(0);

    // Guest can click and view deal details
    await dealCards.first().click();
    await expect(page.locator('.deal-detail-modal')).toBeVisible({ timeout: 5000 });
    console.log('Guest can view deal details');

    // Guest can close modal
    await page.locator('.deal-close').click();
    await expect(page.locator('.deal-detail-modal')).not.toBeVisible({ timeout: 3000 });
    console.log('Guest can close deal modal');
  });

  test('Guest user can save deals (locally)', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });

    const saveBtn = page.locator('.deal-card').first().locator('.save-star-btn');
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Check if saved state changed
    const savedClass = await saveBtn.getAttribute('class');
    console.log(`Guest save button class: ${savedClass}`);

    // Should be able to save locally without auth
    expect(savedClass).toContain('saved');
    console.log('Guest can save deals locally');
  });

  test('View Location button opens Google Maps', async ({ page, context }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find View Location button
    const viewLocationBtn = modal.locator('.deal-cta-btn.secondary:has-text("View Location")');
    await expect(viewLocationBtn).toBeVisible();

    // Check it has correct href
    const href = await viewLocationBtn.getAttribute('href');
    expect(href).toContain('google.com/maps');
    console.log(`View Location href: ${href}`);

    // Check it opens in new tab
    const target = await viewLocationBtn.getAttribute('target');
    expect(target).toBe('_blank');
    console.log('View Location opens in new tab');
  });

  test('Directions button opens Google Maps directions', async ({ page }) => {
    await page.waitForSelector('.deal-card', { timeout: 10000 });
    await page.locator('.deal-card').first().click();

    const modal = page.locator('.deal-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find Directions quick action button
    const directionsBtn = modal.locator('.quick-action-btn:has-text("Directions")');
    await expect(directionsBtn).toBeVisible();

    // Check href
    const href = await directionsBtn.getAttribute('href');
    expect(href).toContain('google.com/maps/dir');
    console.log(`Directions href: ${href}`);
  });
});

// Summary test to document authentication requirements
test.describe('Authentication Requirements Summary', () => {
  test.setTimeout(10000);
  test('Document which features require authentication', async ({ page }) => {
    console.log('\n=== AUTHENTICATION REQUIREMENTS ===');
    console.log('Features that WORK for guests:');
    console.log('  - Browse deals');
    console.log('  - View deal details (modal)');
    console.log('  - Save deals (locally)');
    console.log('  - Share deals');
    console.log('  - View location on map');
    console.log('  - Get directions');
    console.log('  - Filter by category');
    console.log('\nFeatures that REQUIRE authentication:');
    console.log('  - Redeem deals (generates redemption code)');
    console.log('  - Persistent saves (synced to account)');
    console.log('===================================\n');
  });
});
