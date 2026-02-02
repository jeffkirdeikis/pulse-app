import { test, expect } from '@playwright/test';

test.describe('Business View - Guest Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
  });

  // BUSINESS VIEW ACCESS
  test('should display view switcher with Consumer, Business, Admin buttons', async ({ page }) => {
    const viewSwitcher = page.locator('.view-switcher');
    await expect(viewSwitcher).toBeVisible();

    await expect(viewSwitcher.locator('button:has-text("Consumer")')).toBeVisible();
    await expect(viewSwitcher.locator('button:has-text("Business")')).toBeVisible();
    await expect(viewSwitcher.locator('button:has-text("Admin")')).toBeVisible();
  });

  test('should show Consumer view as active by default', async ({ page }) => {
    const consumerBtn = page.locator('.view-switcher button:has-text("Consumer")');
    await expect(consumerBtn).toHaveClass(/active/);
  });

  test('should switch to Business view when clicking Business button', async ({ page }) => {
    await page.click('.view-switcher button:has-text("Business")');

    // Business button should be active
    const businessBtn = page.locator('.view-switcher button:has-text("Business")');
    await expect(businessBtn).toHaveClass(/active/);

    // Business view should be visible
    await expect(page.locator('.business-view-premium')).toBeVisible();
  });

  test('should show Sign In Required message for guest users in Business view', async ({ page }) => {
    await page.click('.view-switcher button:has-text("Business")');

    // Wait for business view to appear
    await page.waitForSelector('.business-view-premium', { timeout: 5000 });

    // Should show Sign In Required
    await expect(page.locator('h2:has-text("Sign In Required")')).toBeVisible();
    await expect(page.locator('text=Sign in to access the Business Dashboard')).toBeVisible();
  });

  test('should have Sign In button that opens auth modal', async ({ page }) => {
    await page.click('.view-switcher button:has-text("Business")');

    // Wait for sign in button
    const signInBtn = page.locator('.no-biz-content .claim-biz-btn-large:has-text("Sign In")');
    await expect(signInBtn).toBeVisible();

    // Click sign in button
    await signInBtn.click();

    // Auth modal should appear
    await expect(page.locator('.auth-modal')).toBeVisible();
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });

  test('should keep view switcher visible when in Business view', async ({ page }) => {
    await page.click('.view-switcher button:has-text("Business")');

    // View switcher should still be visible
    await expect(page.locator('.view-switcher')).toBeVisible();
    await expect(page.locator('.view-switcher button:has-text("Consumer")')).toBeVisible();
    await expect(page.locator('.view-switcher button:has-text("Business")')).toBeVisible();
    await expect(page.locator('.view-switcher button:has-text("Admin")')).toBeVisible();
  });
});

test.describe('Business View - UI Elements (Guest)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
    await page.click('.view-switcher button:has-text("Business")');
    await page.waitForSelector('.business-view-premium', { timeout: 5000 });
  });

  test('should display no-business-view container with proper styling', async ({ page }) => {
    const noBusinessView = page.locator('.no-business-view');
    await expect(noBusinessView).toBeVisible();

    const noBizContent = page.locator('.no-biz-content');
    await expect(noBizContent).toBeVisible();
  });

  test('should display Building icon in no-business view', async ({ page }) => {
    // Check for the icon container
    const iconContainer = page.locator('.no-biz-icon');
    await expect(iconContainer).toBeVisible();

    // Check for SVG inside (Building icon from lucide-react)
    const svg = iconContainer.locator('svg');
    await expect(svg).toBeVisible();
  });

  test('should have proper layout with gradient background', async ({ page }) => {
    const businessView = page.locator('.business-view-premium');
    await expect(businessView).toBeVisible();

    // Business view should have the gradient background
    const bgColor = await businessView.evaluate(el => {
      return window.getComputedStyle(el).backgroundImage;
    });
    expect(bgColor).toContain('gradient');
  });
});

test.describe('View Switcher Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
  });

  test('should switch between Consumer and Business views', async ({ page }) => {
    // Start in Consumer view
    await expect(page.locator('.consumer-view')).toBeVisible();

    // Switch to Business
    await page.click('.view-switcher button:has-text("Business")');
    await expect(page.locator('.business-view-premium')).toBeVisible();
    await expect(page.locator('.consumer-view')).not.toBeVisible();

    // Switch back to Consumer
    await page.click('.view-switcher button:has-text("Consumer")');
    await expect(page.locator('.consumer-view')).toBeVisible();
    await expect(page.locator('.business-view-premium')).not.toBeVisible();
  });

  test('should update active state when switching views', async ({ page }) => {
    // Consumer should be active initially
    await expect(page.locator('.view-switcher button:has-text("Consumer")')).toHaveClass(/active/);
    await expect(page.locator('.view-switcher button:has-text("Business")')).not.toHaveClass(/active/);

    // Switch to Business
    await page.click('.view-switcher button:has-text("Business")');
    await expect(page.locator('.view-switcher button:has-text("Business")')).toHaveClass(/active/);
    await expect(page.locator('.view-switcher button:has-text("Consumer")')).not.toHaveClass(/active/);

    // Switch to Admin
    await page.click('.view-switcher button:has-text("Admin")');
    await expect(page.locator('.view-switcher button:has-text("Admin")')).toHaveClass(/active/);
    await expect(page.locator('.view-switcher button:has-text("Business")')).not.toHaveClass(/active/);
  });

  test('should switch to Admin view when clicking Admin button', async ({ page }) => {
    await page.click('.view-switcher button:has-text("Admin")');

    // Admin button should be active
    await expect(page.locator('.view-switcher button:has-text("Admin")')).toHaveClass(/active/);

    // Admin view should be visible
    await expect(page.locator('.admin-view-premium')).toBeVisible();
  });
});

test.describe('Business View - Responsive Design', () => {
  test('should display properly on mobile width', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    // View switcher should still be visible on mobile
    await expect(page.locator('.view-switcher')).toBeVisible();

    // Switch to Business view
    await page.click('.view-switcher button:has-text("Business")');
    await expect(page.locator('.business-view-premium')).toBeVisible();

    // Sign In Required content should be visible
    await expect(page.locator('h2:has-text("Sign In Required")')).toBeVisible();
    await expect(page.locator('.claim-biz-btn-large:has-text("Sign In")')).toBeVisible();
  });

  test('should display properly on tablet width', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    await page.click('.view-switcher button:has-text("Business")');
    await expect(page.locator('.business-view-premium')).toBeVisible();
    await expect(page.locator('.no-business-view')).toBeVisible();
  });

  test('should have properly sized elements on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
    await page.click('.view-switcher button:has-text("Business")');

    // Check that Sign In button is clickable (not cut off)
    const signInBtn = page.locator('.claim-biz-btn-large:has-text("Sign In")');
    await expect(signInBtn).toBeVisible();

    // Check button is within viewport
    const box = await signInBtn.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
  });
});

test.describe('Auth Modal from Business View', () => {
  test('should close auth modal and return to Business view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    // Go to Business view
    await page.click('.view-switcher button:has-text("Business")');
    await page.waitForSelector('.claim-biz-btn-large:has-text("Sign In")');

    // Open auth modal
    await page.click('.claim-biz-btn-large:has-text("Sign In")');
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Close auth modal
    await page.click('.auth-modal-close');
    await expect(page.locator('.auth-modal')).not.toBeVisible();

    // Should still be in Business view
    await expect(page.locator('.business-view-premium')).toBeVisible();
    await expect(page.locator('.view-switcher button:has-text("Business")')).toHaveClass(/active/);
  });

  test('should have Google sign-in option in auth modal from Business view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    await page.click('.view-switcher button:has-text("Business")');
    await page.click('.claim-biz-btn-large:has-text("Sign In")');

    await expect(page.locator('text=Continue with Google')).toBeVisible();
  });

  test('should have email sign-in form in auth modal from Business view', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    await page.click('.view-switcher button:has-text("Business")');
    await page.click('.claim-biz-btn-large:has-text("Sign In")');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

// Note: Tests below require authentication - they document what would be tested
// if we could mock authentication. These serve as documentation of the authenticated
// business view features.

test.describe('Business View - Authenticated Features (Documentation)', () => {
  test.skip('should display business header with logo when authenticated with claimed business', async ({ page }) => {
    // Would test: .premium-header with business name and avatar
    // Would verify: .venue-avatar, .header-text h1 with business name
    // Would verify: .header-subtitle with business address
  });

  test.skip('should display Pulse Score card when authenticated', async ({ page }) => {
    // Would test: .biz-pulse-score-card visibility
    // Would verify: .pulse-score-ring with SVG
    // Would verify: Score breakdown items (Profile, Engagement, Response, Quality)
  });

  test.skip('should display analytics grid when authenticated', async ({ page }) => {
    // Would test: .premium-stats-grid visibility
    // Would verify: Profile Views card (.premium-stat-card.views)
    // Would verify: Class/Event Views card (.premium-stat-card.clicks)
    // Would verify: Booking Clicks card (.premium-stat-card.bookings)
    // Would verify: Messages card (.premium-stat-card.messages)
  });

  test.skip('should display Weekly Goals section when authenticated', async ({ page }) => {
    // Would test: .goals-section visibility
    // Would verify: Section header with "Weekly Goals"
    // Would verify: Goals grid with goal cards
    // Would verify: XP rewards displayed
  });

  test.skip('should display Business Badges section when authenticated', async ({ page }) => {
    // Would test: .badges-section visibility
    // Would verify: Badge showcase with 10 badge items
    // Would verify: Badges include: Verified, Top Rated, Quick Reply, Rising Star, etc.
  });

  test.skip('should display Growth Tips section when authenticated', async ({ page }) => {
    // Would test: .insights-section visibility
    // Would verify: Insight cards with tips
    // Would verify: Action buttons (Create Deal, Edit Profile)
  });

  test.skip('should display Quick Action buttons when authenticated', async ({ page }) => {
    // Would test: .actions-section visibility
    // Would verify: Quick actions grid
    // Would verify: Buttons: New Event, New Deal, Edit Profile, Full Analytics
  });

  test.skip('should display Help Cards when authenticated', async ({ page }) => {
    // Would test: .quick-actions-section visibility
    // Would verify: Download Report card
    // Would verify: Contact Support card
    // Would verify: Boost Visibility card
  });
});

// Test for authenticated user with no claimed businesses
test.describe('Business View - Authenticated No Business (Documentation)', () => {
  test.skip('should display Welcome to Business Dashboard when authenticated but no businesses', async ({ page }) => {
    // Would verify: "Welcome to Business Dashboard" heading
    // Would verify: Benefits grid with 4 benefits
    // Would verify: "Claim Your Business" button
    // Would verify: "Free to claim" note text
  });

  test.skip('should display benefits grid when no businesses claimed', async ({ page }) => {
    // Would verify: .biz-benefits-grid visibility
    // Would verify: Track Performance benefit
    // Would verify: Grow Audience benefit
    // Would verify: Earn Rewards benefit
    // Would verify: Post Events benefit
  });

  test.skip('should open claim business modal when clicking Claim Your Business', async ({ page }) => {
    // Would verify: Claim Your Business button visible
    // Would verify: Click opens claim business modal
  });
});
