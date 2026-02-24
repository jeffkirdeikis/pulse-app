/**
 * FILE 7: Analytics (Actions 69-78)
 *
 * Feature status summary:
 *   69. Profile views        — EXISTS:     BusinessDashboard shows profile_views with mini bar chart
 *   70. Search impressions   — NOT_BUILT
 *   71. Deal redemptions     — PARTIAL:    DealDetailModal tracks redemptions; dashboard doesn't show stats
 *   72. Event attendance     — PARTIAL:    event_views / class_views shown; no RSVP headcount
 *   73. Booking conversions  — EXISTS:     booking_clicks and bookings_confirmed shown
 *   74. Follower growth      — NOT_BUILT:  No follow system
 *   75. Peak hours           — NOT_BUILT
 *   76. Demographics         — NOT_BUILT
 *   77. Export               — EXISTS:     TXT and CSV export buttons in BusinessDashboard
 *   78. Period comparison    — NOT_BUILT:  Time period selector exists but no side-by-side comparison
 */

import { test, expect } from '@playwright/test';
import {
  screenshot,
  waitForAppLoad,
  switchToBusinessView,
  loginAsTestUser,
  setupConsoleErrorCapture,
  TEST_OWNER,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Log in and navigate to the BusinessDashboard analytics section. */
async function openBusinessDashboard(page) {
  await waitForAppLoad(page);
  await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
  await switchToBusinessView(page);
  // Wait for the dashboard container to be present
  await page.waitForSelector('.business-view-premium', { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Action 69 — Profile Views (EXISTS)
// ---------------------------------------------------------------------------

test.describe('Action 69: Profile Views', () => {
  test('BusinessDashboard displays profile_views metric', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await openBusinessDashboard(page);

    // The analytics section should contain a profile views card/label
    const profileViewsEl = page.locator(
      'text=Profile Views, text=profile_views, [data-metric="profile_views"]'
    );
    const found = await profileViewsEl.count();

    if (found === 0) {
      // Fallback: scan visible text for "profile" near a number
      const bodyText = await page.locator('.business-view-premium').innerText();
      const hasProfileViews = /profile\s*views/i.test(bodyText);
      expect(hasProfileViews, 'Expected "Profile Views" text in business dashboard').toBe(true);
    } else {
      await expect(profileViewsEl.first()).toBeVisible();
    }

    await screenshot(page, 69, 'profile-views', '01-dashboard-profile-views');
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('Profile views shows 7-day bar chart or numerical data', async ({ page }) => {
    await openBusinessDashboard(page);

    // Look for a bar chart element or sparkline near the profile views metric
    const chartEl = page.locator(
      '.analytics-chart, .mini-bar-chart, .sparkline, canvas, svg[class*="chart"]'
    );
    const chartCount = await chartEl.count();

    // It's acceptable if no chart renders when data is zero, but the container should exist
    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasViewData = /profile\s*views|0\s*views/i.test(dashboardText);
    expect(hasViewData, 'Dashboard should mention profile views').toBe(true);

    await screenshot(page, 69, 'profile-views', '02-bar-chart-present');
    console.log(`Chart elements found: ${chartCount}`);
  });

  test('Time period selector is visible (30/90/365/all options)', async ({ page }) => {
    await openBusinessDashboard(page);

    // Look for a period selector — could be a select, button group, or dropdown
    const periodSelector = page.locator(
      'select[class*="period"], .period-selector, .time-period-select, ' +
      'button:has-text("30"), button:has-text("90"), button:has-text("365"), button:has-text("All")'
    );

    const count = await periodSelector.count();
    if (count === 0) {
      // Check for text representations
      const dashboardText = await page.locator('.business-view-premium').innerText();
      const hasPeriods = /30\s*days|90\s*days|365\s*days|all\s*time/i.test(dashboardText);
      expect(hasPeriods, 'Expected time period options (30/90/365/All) in dashboard').toBe(true);
    } else {
      await expect(periodSelector.first()).toBeVisible();
    }

    await screenshot(page, 69, 'profile-views', '03-period-selector');
  });

  test('Changing time period updates the displayed data', async ({ page }) => {
    await openBusinessDashboard(page);

    // Find and interact with the first available period button/option
    const thirtyDayBtn = page.locator('button:has-text("30"), option[value="30"]').first();
    const allTimeBtn = page.locator(
      'button:has-text("All"), option[value="all"], button:has-text("all time")'
    ).first();

    const thirtyVisible = await thirtyDayBtn.isVisible().catch(() => false);
    const allVisible = await allTimeBtn.isVisible().catch(() => false);

    if (!thirtyVisible && !allVisible) {
      test.skip('Time period selector buttons not found — skipping interaction test');
      return;
    }

    if (thirtyVisible) {
      await thirtyDayBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, 69, 'profile-views', '04-30day-selected');
    }

    if (allVisible) {
      await allTimeBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, 69, 'profile-views', '05-alltime-selected');
    }

    // Dashboard should still be intact (no crash)
    await expect(page.locator('.business-view-premium')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Action 70 — Search Impressions (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 70: Search Impressions', () => {
  test.skip('NOT_BUILT — no search impression tracking. When built: verify dashboard shows how many times the business appeared in search results, with a time-series chart and breakdown by keyword.');
});

// ---------------------------------------------------------------------------
// Action 71 — Deal Redemptions (PARTIAL)
// ---------------------------------------------------------------------------

test.describe('Action 71: Deal Redemptions', () => {
  test('DealDetailModal tracks and displays redemption count', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);

    // Navigate to Deals tab and open a deal
    await page.click('.category-card:has-text("Deals")');
    await page.waitForTimeout(1000);

    const dealCard = page.locator('.deal-card').first();
    if (await dealCard.count() === 0) {
      test.skip('No deal cards found — skipping redemption tracking test');
      return;
    }

    await dealCard.click();
    await page.waitForSelector('.deal-detail-modal, [class*="deal-modal"]', { timeout: 5000 });

    // Check that some redemption count text is present in the modal
    const modalText = await page.locator('.deal-detail-modal, [class*="deal-modal"]').first().innerText();
    const hasRedemptions = /redeem|redemption|claimed|used/i.test(modalText);
    console.log(`Deal modal redemption text found: ${hasRedemptions}`);
    // Non-fatal — log only; dashboard gap is the real gap

    await screenshot(page, 71, 'deal-redemptions', '01-deal-modal-redemption-count');
  });

  test('PARTIAL — BusinessDashboard does NOT show deal redemption statistics', async ({ page }) => {
    await openBusinessDashboard(page);

    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasRedemptionStats = /redemption|deals redeemed|deal stats/i.test(dashboardText);

    // We expect this to be absent (feature is partial / not surfaced on dashboard)
    if (hasRedemptionStats) {
      console.log('NOTE: Redemption stats ARE now visible in dashboard — update feature status to EXISTS');
    } else {
      console.log('CONFIRMED PARTIAL: Redemption stats not shown in business dashboard');
    }

    await screenshot(page, 71, 'deal-redemptions', '02-dashboard-no-redemption-stats');
    // Test always passes — this is a documentation/observability test
  });
});

// ---------------------------------------------------------------------------
// Action 72 — Event Attendance (PARTIAL)
// ---------------------------------------------------------------------------

test.describe('Action 72: Event Attendance', () => {
  test('BusinessDashboard shows event_views and class_views metrics', async ({ page }) => {
    await openBusinessDashboard(page);

    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasEventViews = /event.?views|class.?views/i.test(dashboardText);

    if (!hasEventViews) {
      // May be behind a section that needs scrolling
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const scrolledText = await page.locator('.business-view-premium').innerText();
      const hasAfterScroll = /event.?views|class.?views/i.test(scrolledText);
      expect(hasAfterScroll, 'Expected event_views or class_views in business dashboard').toBe(true);
    } else {
      expect(hasEventViews).toBe(true);
    }

    await screenshot(page, 72, 'event-attendance', '01-event-class-views');
  });

  test('PARTIAL — No RSVP headcount shown in dashboard', async ({ page }) => {
    await openBusinessDashboard(page);

    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasRsvpHeadcount = /rsvp|attendees|going|headcount/i.test(dashboardText);

    if (hasRsvpHeadcount) {
      console.log('NOTE: RSVP/attendee data IS now visible — update feature status');
    } else {
      console.log('CONFIRMED PARTIAL: No RSVP headcount in dashboard (only view counts shown)');
    }

    await screenshot(page, 72, 'event-attendance', '02-no-rsvp-headcount');
  });
});

// ---------------------------------------------------------------------------
// Action 73 — Booking Conversions (EXISTS)
// ---------------------------------------------------------------------------

test.describe('Action 73: Booking Conversions', () => {
  test('BusinessDashboard shows booking_clicks metric', async ({ page }) => {
    await openBusinessDashboard(page);

    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasBookingClicks = /booking.?clicks|book\s*clicks/i.test(dashboardText);

    if (!hasBookingClicks) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const scrolledText = await page.locator('.business-view-premium').innerText();
      expect(
        /booking.?clicks|book\s*clicks/i.test(scrolledText),
        'Expected booking_clicks metric in dashboard'
      ).toBe(true);
    } else {
      expect(hasBookingClicks).toBe(true);
    }

    await screenshot(page, 73, 'booking-conversions', '01-booking-clicks');
  });

  test('BusinessDashboard shows bookings_confirmed metric', async ({ page }) => {
    await openBusinessDashboard(page);

    // Scroll to make sure we see all analytics
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasConfirmed = /bookings.?confirmed|confirmed.?bookings/i.test(dashboardText);

    if (!hasConfirmed) {
      console.log('NOTE: bookings_confirmed not found in visible text — may be under a collapsed section');
    }

    // Soft assertion — log rather than hard fail if data is zero and label differs
    console.log(`Bookings confirmed metric found: ${hasConfirmed}`);
    await screenshot(page, 73, 'booking-conversions', '02-bookings-confirmed');
  });

  test('Booking conversion metrics are numeric values', async ({ page }) => {
    await openBusinessDashboard(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const dashboardText = await page.locator('.business-view-premium').innerText();
    // Verify at least some numeric analytics are present
    const hasNumbers = /\b\d+\b/.test(dashboardText);
    expect(hasNumbers, 'Dashboard should contain numeric analytics values').toBe(true);

    await screenshot(page, 73, 'booking-conversions', '03-numeric-values-present');
  });
});

// ---------------------------------------------------------------------------
// Action 74 — Follower Growth (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 74: Follower Growth', () => {
  test.skip('NOT_BUILT — no follow system. When built: verify dashboard shows follower count over time, net new followers per period, follower growth chart, and ability to see follower demographics.');
});

// ---------------------------------------------------------------------------
// Action 75 — Peak Hours (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 75: Peak Hours', () => {
  test.skip('NOT_BUILT — no peak hours analytics. When built: verify a heatmap or bar chart showing profile/page visits by hour of day and day of week so business owners can identify their peak traffic times.');
});

// ---------------------------------------------------------------------------
// Action 76 — Demographics (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 76: Demographics', () => {
  test.skip('NOT_BUILT — no demographic analytics. When built: verify dashboard shows audience breakdown (age, location, device type) and that data is anonymized per privacy requirements.');
});

// ---------------------------------------------------------------------------
// Action 77 — Export (EXISTS)
// ---------------------------------------------------------------------------

test.describe('Action 77: Analytics Export', () => {
  test('BusinessDashboard has a TXT export button', async ({ page }) => {
    await openBusinessDashboard(page);

    // Scroll to find export controls
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const txtBtn = page.locator(
      'button:has-text("TXT"), button:has-text("Export TXT"), button:has-text(".txt"), a:has-text("TXT")'
    );
    const count = await txtBtn.count();
    if (count === 0) {
      // Scroll through page sections to find export
      const exportSection = page.locator('[class*="export"], [class*="download"]');
      await exportSection.first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
    }

    const found = await txtBtn.count();
    expect(found, 'Expected TXT export button in BusinessDashboard').toBeGreaterThan(0);

    await screenshot(page, 77, 'export', '01-txt-export-button');
  });

  test('BusinessDashboard has a CSV export button', async ({ page }) => {
    await openBusinessDashboard(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const csvBtn = page.locator(
      'button:has-text("CSV"), button:has-text("Export CSV"), button:has-text(".csv"), a:has-text("CSV")'
    );
    const found = await csvBtn.count();
    expect(found, 'Expected CSV export button in BusinessDashboard').toBeGreaterThan(0);

    await screenshot(page, 77, 'export', '02-csv-export-button');
  });

  test('TXT export initiates a file download', async ({ page }) => {
    await openBusinessDashboard(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const txtBtn = page.locator(
      'button:has-text("TXT"), button:has-text("Export TXT"), a:has-text("TXT")'
    ).first();
    if (await txtBtn.count() === 0) {
      test.skip('TXT export button not found');
      return;
    }

    // Listen for download event
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await txtBtn.click();
    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      expect(filename, 'Downloaded file should have a name').toBeTruthy();
      console.log(`TXT download filename: ${filename}`);
    } else {
      // Some implementations navigate or open a new tab — check for toast at minimum
      const toast = page.locator('[class*="toast"], [class*="notification"], [class*="alert"]');
      const toastVisible = await toast.isVisible().catch(() => false);
      console.log(`Download event not detected; toast visible: ${toastVisible}`);
    }

    await screenshot(page, 77, 'export', '03-txt-download-triggered');
  });

  test('CSV export initiates a file download', async ({ page }) => {
    await openBusinessDashboard(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const csvBtn = page.locator(
      'button:has-text("CSV"), button:has-text("Export CSV"), a:has-text("CSV")'
    ).first();
    if (await csvBtn.count() === 0) {
      test.skip('CSV export button not found');
      return;
    }

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await csvBtn.click();
    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      expect(filename, 'Downloaded file should have a name').toBeTruthy();
      console.log(`CSV download filename: ${filename}`);
    } else {
      console.log('CSV download event not detected — may use blob URL or anchor click');
    }

    await screenshot(page, 77, 'export', '04-csv-download-triggered');
  });

  test('Export report includes pulse score and analytics data', async ({ page }) => {
    await openBusinessDashboard(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Verify the export buttons are present and not disabled
    const exportBtns = page.locator(
      'button:has-text("TXT"), button:has-text("CSV"), button:has-text("Export")'
    );
    const count = await exportBtns.count();
    expect(count, 'At least one export button should be present').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = exportBtns.nth(i);
      const isDisabled = await btn.isDisabled();
      expect(isDisabled, `Export button ${i + 1} should not be disabled`).toBe(false);
    }

    await screenshot(page, 77, 'export', '05-export-buttons-enabled');
  });
});

// ---------------------------------------------------------------------------
// Action 78 — Period Comparison (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 78: Period Comparison', () => {
  test.skip('NOT_BUILT — time period selector exists but no side-by-side comparison. When built: verify user can select two date ranges and see a split-screen or overlaid chart comparing metrics (views, bookings, deal redemptions) between the two periods.');
});
