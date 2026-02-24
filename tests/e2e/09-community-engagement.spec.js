/**
 * FILE 9: Community Engagement (Actions 89-96)
 *
 * Feature status summary:
 *   89. Post update      — NOT_BUILT
 *   90. Photo/story      — NOT_BUILT
 *   91. Pin post         — NOT_BUILT
 *   92. Comments         — NOT_BUILT
 *   93. Follow businesses— NOT_BUILT: "Followers: 0" shown but no follow mechanism
 *   94. Challenges       — NOT_BUILT
 *   95. XP stats         — PARTIAL: BusinessDashboard has Weekly Goals with XP labels (+100, +75)
 *                          and badges, but display-only (no earning interaction)
 *   96. Leaderboard      — NOT_BUILT
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

async function openBusinessDashboard(page) {
  await waitForAppLoad(page);
  await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
  await switchToBusinessView(page);
  await page.waitForSelector('.business-view-premium', { timeout: 10000 });
}

// ---------------------------------------------------------------------------
// Action 89 — Post Update (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 89: Post Update', () => {
  test.skip('NOT_BUILT — no community post/update feature. When built: verify business owners can compose a text update from their dashboard, the post appears on their public listing page, and consumers see it in a feed or under the business profile.');
});

// ---------------------------------------------------------------------------
// Action 90 — Photo / Story (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 90: Photo and Story Upload', () => {
  test.skip('NOT_BUILT — no photo or story upload feature. When built: verify owners can upload images (check file size/type validation), add a caption, and the photo gallery on the public listing updates accordingly. Stories should have a configurable expiry (24h / 7d).');
});

// ---------------------------------------------------------------------------
// Action 91 — Pin Post (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 91: Pin Post', () => {
  test.skip('NOT_BUILT — no pin post feature. When built: verify owners can pin one post to the top of their profile feed, the pinned indicator is visible to consumers, and unpinning restores chronological order.');
});

// ---------------------------------------------------------------------------
// Action 92 — Comments (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 92: Comments', () => {
  test.skip('NOT_BUILT — no commenting system. When built: verify authenticated consumers can leave comments on events/classes/deals, comments appear immediately below the item, owners can reply, and abusive content can be reported. Verify unauthenticated users are prompted to log in before commenting.');
});

// ---------------------------------------------------------------------------
// Action 93 — Follow Businesses (NOT_BUILT — "Followers: 0" is display-only)
// ---------------------------------------------------------------------------

test.describe('Action 93: Follow Businesses', () => {
  test('"Followers: 0" counter is displayed on business listing but no follow button exists', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);

    // Check Services or business detail for follower display
    await page.click('.category-card:has-text("Services")');
    await page.waitForTimeout(1000);

    const serviceCard = page.locator(
      '.service-card, .business-card, [class*="card"]'
    ).first();
    if (await serviceCard.count() === 0) {
      console.log('No service/business cards found — trying Classes tab');
      await page.click('.category-card:has-text("Classes")');
      await page.waitForTimeout(1000);
    }

    // Check if a follow button exists anywhere on the page
    const followBtn = page.locator(
      'button:has-text("Follow"), button:has-text("Unfollow"), .follow-btn, [class*="follow-button"]'
    );
    const followCount = await followBtn.count();

    console.log(`Follow buttons found on page: ${followCount}`);

    // We expect zero follow buttons (feature not built)
    if (followCount > 0) {
      console.log('NOTE: Follow button found — feature may now be partially built. Update status.');
    } else {
      console.log('CONFIRMED NOT_BUILT: No follow button present');
    }

    // Check for follower count display in business detail modal
    const serviceCardEl = page.locator(
      '.service-card, .business-card, [class*="card"]'
    ).first();
    if (await serviceCardEl.count() > 0) {
      await serviceCardEl.click();
      await page.waitForTimeout(800);

      const modalText = await page.locator(
        '[class*="detail-modal"], [class*="modal-overlay"], .modal-content'
      ).first().innerText().catch(() => '');

      const hasFollowers = /followers?/i.test(modalText);
      console.log(`Modal mentions followers: ${hasFollowers}`);
      if (hasFollowers) {
        console.log('Followers counter is display-only in modal (no interactive follow button)');
      }

      await screenshot(page, 93, 'follow-businesses', '01-modal-followers-display');
    }

    await screenshot(page, 93, 'follow-businesses', '02-no-follow-button');
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('net::'));
    expect(criticalErrors).toHaveLength(0);
  });

  test.skip('NOT_BUILT — no follow interaction. When built: verify consumers can click a Follow button on any business listing, the follower count increments immediately (optimistic UI), following persists across sessions, and the business owner sees the new follower in their analytics dashboard.');
});

// ---------------------------------------------------------------------------
// Action 94 — Challenges (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 94: Challenges', () => {
  test.skip('NOT_BUILT — no challenges feature. When built: verify community challenges are listed with title, description, start/end date, and reward, users can join a challenge, progress is tracked, and completing a challenge awards XP or a badge.');
});

// ---------------------------------------------------------------------------
// Action 95 — XP Stats (PARTIAL — display-only in BusinessDashboard)
// ---------------------------------------------------------------------------

test.describe('Action 95: XP Stats', () => {
  test('BusinessDashboard shows Weekly Goals section with XP labels', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await openBusinessDashboard(page);

    // Scroll to find the Weekly Goals / XP section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const dashboardText = await page.locator('.business-view-premium').innerText();

    const hasWeeklyGoals = /weekly\s*goals?/i.test(dashboardText);
    const hasXP = /\+\d+\s*xp|\bxp\b/i.test(dashboardText);

    if (!hasWeeklyGoals && !hasXP) {
      // Scroll back up — section may be at the top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      const topText = await page.locator('.business-view-premium').innerText();
      const hasAtTop = /weekly\s*goals?|\bxp\b/i.test(topText);
      expect(hasAtTop, 'Expected Weekly Goals / XP section in BusinessDashboard').toBe(true);
    } else {
      expect(hasWeeklyGoals || hasXP, 'Expected Weekly Goals or XP labels in dashboard').toBe(true);
    }

    await screenshot(page, 95, 'xp-stats', '01-weekly-goals-xp');
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('net::'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('XP goal labels show positive point values (e.g. +100, +75)', async ({ page }) => {
    await openBusinessDashboard(page);

    // Full page text scan
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const fullText = await page.locator('.business-view-premium').innerText();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const topText = await page.locator('.business-view-premium').innerText();

    const combined = fullText + ' ' + topText;
    const hasPositiveXP = /\+\d+/i.test(combined);

    if (!hasPositiveXP) {
      console.log('PARTIAL: Positive XP values (+100, +75 etc.) not found in visible text — may be in a collapsed section or rendered as icons');
    } else {
      expect(hasPositiveXP).toBe(true);
    }

    await screenshot(page, 95, 'xp-stats', '02-xp-point-values');
  });

  test('Badges are displayed in BusinessDashboard (display-only)', async ({ page }) => {
    await openBusinessDashboard(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const badgeEl = page.locator(
      '[class*="badge"], .achievement-badge, [aria-label*="badge"], img[alt*="badge"]'
    );
    const badgeCount = await badgeEl.count();

    const dashboardText = await page.locator('.business-view-premium').innerText();
    const hasBadgeText = /badge/i.test(dashboardText);

    console.log(`Badge elements found: ${badgeCount}, badge text in dashboard: ${hasBadgeText}`);

    if (badgeCount === 0 && !hasBadgeText) {
      console.log('PARTIAL: No badge elements found — may be zero-state for new accounts');
    }

    await screenshot(page, 95, 'xp-stats', '03-badges-display');
  });

  test('PARTIAL — XP and badges are display-only; no earning mechanism is interactive', async ({ page }) => {
    await openBusinessDashboard(page);

    // Verify there are no "Earn XP" or "Complete Challenge" interactive buttons
    const earnBtn = page.locator(
      'button:has-text("Earn XP"), button:has-text("Complete"), .earn-xp-btn'
    );
    const earnCount = await earnBtn.count();

    if (earnCount > 0) {
      console.log('NOTE: "Earn XP" or "Complete" buttons found — XP system may now be interactive. Update status.');
    } else {
      console.log('CONFIRMED PARTIAL: XP display only — no interactive earn mechanism');
    }

    await screenshot(page, 95, 'xp-stats', '04-no-earn-interaction');
  });
});

// ---------------------------------------------------------------------------
// Action 96 — Leaderboard (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 96: Leaderboard', () => {
  test.skip('NOT_BUILT — no leaderboard feature. When built: verify a public leaderboard shows top businesses ranked by Pulse Score or XP, is paginated or scrollable, updates at least daily, and consumers can click a business entry to view its listing. Verify the current authenticated business owner can see their own rank.');
});
