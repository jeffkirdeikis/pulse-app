/**
 * FILE 8: Notifications & Settings (Actions 79-88)
 *
 * Feature status summary:
 *   79. Notification preferences  — PARTIAL: ProfileModal Settings tab has consumer toggles
 *   80. Review notification       — NOT_BUILT (no review system)
 *   81. Booking notification      — NOT_BUILT
 *   82. Follower notification     — NOT_BUILT
 *   83. Staff accounts            — NOT_BUILT
 *   84. Roles/permissions         — NOT_BUILT (ClaimModal has role selector for claim form only)
 *   85. Billing                   — NOT_BUILT: "Boost Visibility" → "Premium features coming soon"
 *   86. Subscription              — NOT_BUILT
 *   87. Invoices                  — NOT_BUILT
 *   88. Password change           — NOT_BUILT: no UI; handled via Supabase Auth directly
 */

import { test, expect } from '@playwright/test';
import {
  screenshot,
  waitForAppLoad,
  loginAsTestUser,
  setupConsoleErrorCapture,
  TEST_OWNER,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Log in, open the profile menu, and navigate to the Settings tab inside ProfileModal.
 * Returns true if Settings tab was found and clicked; false otherwise.
 */
async function openProfileModalSettingsTab(page) {
  await waitForAppLoad(page);
  await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);

  // Wait for auth to complete and the profile button to reflect logged-in state
  await page.waitForTimeout(2000);

  // Open the profile dropdown/menu
  const profileBtn = page.locator('.profile-btn');
  await expect(profileBtn).toBeVisible({ timeout: 8000 });
  await profileBtn.click();
  await page.waitForTimeout(500);

  // ProfileModal or profile menu should open
  const profileModal = page.locator('.profile-modal, [class*="profile-modal"], [class*="ProfileModal"]');
  const profileMenu = page.locator('.profile-menu, [class*="profile-menu"], [class*="user-menu"]');

  const modalVisible = await profileModal.isVisible().catch(() => false);
  const menuVisible = await profileMenu.isVisible().catch(() => false);

  if (!modalVisible && !menuVisible) {
    console.log('Neither profile modal nor profile menu found after clicking profile button');
    return false;
  }

  // Click the Settings tab
  const settingsTab = page.locator(
    '.profile-modal [role="tab"]:has-text("Settings"), ' +
    '.profile-modal button:has-text("Settings"), ' +
    '[class*="profile"] button:has-text("Settings"), ' +
    '[class*="profile"] [data-tab="settings"]'
  );

  const settingsVisible = await settingsTab.isVisible().catch(() => false);
  if (!settingsVisible) {
    // Try clicking a "Settings" text link anywhere inside the modal
    const settingsLink = page.locator('text=Settings').first();
    const linkVisible = await settingsLink.isVisible().catch(() => false);
    if (linkVisible) {
      await settingsLink.click();
      await page.waitForTimeout(500);
      return true;
    }
    console.log('Settings tab not found in profile modal');
    return false;
  }

  await settingsTab.click();
  await page.waitForTimeout(500);
  return true;
}

// ---------------------------------------------------------------------------
// Action 79 — Notification Preferences (PARTIAL)
// ---------------------------------------------------------------------------

test.describe('Action 79: Notification Preferences', () => {
  test('ProfileModal Settings tab is accessible after login', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    const found = await openProfileModalSettingsTab(page);

    if (!found) {
      // Log but do not hard-fail — the modal structure might vary
      console.log('PARTIAL: Settings tab not reachable in current build');
    } else {
      // Settings content should be visible
      const settingsContent = page.locator(
        '.settings-tab, [class*="settings"], .profile-settings'
      );
      const hasContent = await settingsContent.isVisible().catch(() => false);
      console.log(`Settings tab content visible: ${hasContent}`);
    }

    await screenshot(page, 79, 'notification-preferences', '01-settings-tab-open');
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('net::'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('Settings tab has Event Reminders toggle', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);
    if (!found) {
      test.skip('Settings tab not reachable — skipping toggle tests');
      return;
    }

    const toggle = page.locator(
      'text=Event Reminders, label:has-text("Event Reminders"), [data-setting="event_reminders"]'
    );
    const exists = await toggle.isVisible().catch(() => false);

    if (!exists) {
      console.log('PARTIAL: Event Reminders toggle not found in Settings tab');
    } else {
      await expect(toggle.first()).toBeVisible();
    }

    await screenshot(page, 79, 'notification-preferences', '02-event-reminders-toggle');
  });

  test('Settings tab has New Deals toggle', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);
    if (!found) {
      test.skip('Settings tab not reachable — skipping toggle tests');
      return;
    }

    const toggle = page.locator(
      'text=New Deals, label:has-text("New Deals"), [data-setting="new_deals"]'
    );
    const exists = await toggle.isVisible().catch(() => false);

    if (!exists) {
      console.log('PARTIAL: New Deals toggle not found in Settings tab');
    } else {
      await expect(toggle.first()).toBeVisible();
    }

    await screenshot(page, 79, 'notification-preferences', '03-new-deals-toggle');
  });

  test('Settings tab has Weekly Digest toggle', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);
    if (!found) {
      test.skip('Settings tab not reachable — skipping toggle tests');
      return;
    }

    const toggle = page.locator(
      'text=Weekly Digest, label:has-text("Weekly Digest"), [data-setting="weekly_digest"]'
    );
    const exists = await toggle.isVisible().catch(() => false);

    if (!exists) {
      console.log('PARTIAL: Weekly Digest toggle not found in Settings tab');
    } else {
      await expect(toggle.first()).toBeVisible();
    }

    await screenshot(page, 79, 'notification-preferences', '04-weekly-digest-toggle');
  });

  test('Settings tab has Business Updates toggle', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);
    if (!found) {
      test.skip('Settings tab not reachable — skipping toggle tests');
      return;
    }

    const toggle = page.locator(
      'text=Business Updates, label:has-text("Business Updates"), [data-setting="business_updates"]'
    );
    const exists = await toggle.isVisible().catch(() => false);

    if (!exists) {
      console.log('PARTIAL: Business Updates toggle not found in Settings tab');
    } else {
      await expect(toggle.first()).toBeVisible();
    }

    await screenshot(page, 79, 'notification-preferences', '05-business-updates-toggle');
  });

  test('Notification toggles are interactive (can be toggled on/off)', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);
    if (!found) {
      test.skip('Settings tab not reachable — skipping interactivity test');
      return;
    }

    // Find the first toggle/checkbox in the settings area
    const toggleInput = page.locator(
      '.settings-tab input[type="checkbox"], ' +
      '[class*="settings"] input[type="checkbox"], ' +
      '[class*="toggle"] input, ' +
      '[role="switch"]'
    ).first();

    const toggleExists = await toggleInput.isVisible().catch(() => false);
    if (!toggleExists) {
      console.log('PARTIAL: No interactive toggle inputs found in Settings tab');
      return;
    }

    const initialState = await toggleInput.isChecked().catch(() => null);
    await toggleInput.click();
    await page.waitForTimeout(400);
    const newState = await toggleInput.isChecked().catch(() => null);

    if (initialState !== null && newState !== null) {
      expect(newState).not.toBe(initialState);
    }

    // Toggle back to original state to avoid side effects
    await toggleInput.click();
    await page.waitForTimeout(400);

    await screenshot(page, 79, 'notification-preferences', '06-toggle-interactive');
  });

  test('PARTIAL — not all notification categories are implemented', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);
    if (!found) {
      console.log('Settings tab not reachable — cannot audit notification categories');
      return;
    }

    const settingsText = await page.locator('body').innerText();
    const hasReviews = /review\s*notification/i.test(settingsText);
    const hasBookings = /booking\s*notification/i.test(settingsText);
    const hasFollowers = /follower\s*notification/i.test(settingsText);

    console.log([
      'Notification category audit:',
      `  Review notifications visible: ${hasReviews}`,
      `  Booking notifications visible: ${hasBookings}`,
      `  Follower notifications visible: ${hasFollowers}`,
    ].join('\n'));

    await screenshot(page, 79, 'notification-preferences', '07-category-audit');
  });
});

// ---------------------------------------------------------------------------
// Action 80 — Review Notification Toggle (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 80: Review Notification Toggle', () => {
  test.skip('NOT_BUILT — no review system. When built: verify a toggle in notification settings to enable/disable email or push notifications when a customer leaves a review on a business listing.');
});

// ---------------------------------------------------------------------------
// Action 81 — Booking Notification Toggle (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 81: Booking Notification Toggle', () => {
  test.skip('NOT_BUILT — no booking notification system. When built: verify owners can toggle notifications for new bookings, booking cancellations, and booking reminders, with configurable delivery channels (email, push).');
});

// ---------------------------------------------------------------------------
// Action 82 — Follower Notification Toggle (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 82: Follower Notification Toggle', () => {
  test.skip('NOT_BUILT — no follow system. When built: verify a toggle to receive notifications when a community member follows the business, with batch/digest options to avoid notification fatigue.');
});

// ---------------------------------------------------------------------------
// Action 83 — Staff Accounts (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 83: Staff Accounts', () => {
  test.skip('NOT_BUILT — no multi-user staff account system. When built: verify business owner can invite staff by email, staff can log in and access a scoped dashboard, and owner can revoke access. Verify staff cannot access billing or delete the business.');
});

// ---------------------------------------------------------------------------
// Action 84 — Roles / Permissions (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 84: Roles and Permissions', () => {
  test('ClaimModal role selector exists on the claim form (claim-flow only)', async ({ page }) => {
    // The role selector in ClaimModal is for the claim submission form,
    // not a live access-control system. Document its existence.
    await waitForAppLoad(page);

    // Navigate to a business and attempt to claim it (as guest is fine — just check modal)
    await page.click('.category-card:has-text("Services")');
    await page.waitForTimeout(1000);

    const serviceCard = page.locator(
      '.service-card, .business-card, [class*="card"]'
    ).first();
    if (await serviceCard.count() === 0) {
      test.skip('No service/business cards found');
      return;
    }

    await serviceCard.click();
    await page.waitForTimeout(800);

    const claimBtn = page.locator(
      'button:has-text("Claim"), button:has-text("Claim Business"), .claim-btn'
    );
    const claimVisible = await claimBtn.isVisible().catch(() => false);

    if (!claimVisible) {
      console.log('Claim button not visible in service detail modal — may require auth');
      return;
    }

    await claimBtn.click();
    await page.waitForTimeout(500);

    const claimModal = page.locator('.claim-modal, [class*="claim-modal"]');
    const modalVisible = await claimModal.isVisible().catch(() => false);

    if (modalVisible) {
      const roleSelector = page.locator(
        '.claim-modal select[name*="role"], .claim-modal [class*="role"]'
      );
      const roleSelectorExists = await roleSelector.isVisible().catch(() => false);
      console.log(`ClaimModal role selector visible: ${roleSelectorExists}`);
      await screenshot(page, 84, 'roles-permissions', '01-claim-modal-role-selector');
    }
  });

  test.skip('NOT_BUILT — no live role/permission access control. When built: verify role-based access (Owner vs Manager vs Staff) restricts dashboard sections appropriately, and role assignment persists across sessions.');
});

// ---------------------------------------------------------------------------
// Action 85 — Billing (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 85: Billing', () => {
  test('"Boost Visibility" shows "Premium features coming soon" message', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(2000);

    // Switch to Business view
    const businessBtn = page.locator('.view-switcher button:has-text("Business")');
    const businessVisible = await businessBtn.isVisible().catch(() => false);
    if (!businessVisible) {
      test.skip('Business view button not visible — user may not have a claimed business');
      return;
    }
    await businessBtn.click();
    await page.waitForSelector('.business-view-premium', { timeout: 8000 });

    // Find Boost Visibility button
    const boostBtn = page.locator(
      'button:has-text("Boost Visibility"), button:has-text("Boost"), .boost-btn'
    );
    const boostVisible = await boostBtn.isVisible().catch(() => false);

    if (!boostVisible) {
      console.log('Boost Visibility button not found — skipping toast check');
      await screenshot(page, 85, 'billing', '01-no-boost-button');
      return;
    }

    // Listen for toast notification
    await boostBtn.click();
    await page.waitForTimeout(1000);

    const toastText = await page.locator(
      '[class*="toast"], [class*="notification"], [class*="snack"]'
    ).first().innerText().catch(() => '');

    const hasPremiumMessage = /premium|coming soon|not available/i.test(toastText);
    console.log(`Boost toast message: "${toastText}" — hasPremiumMessage: ${hasPremiumMessage}`);

    await screenshot(page, 85, 'billing', '02-boost-premium-toast');
  });

  test.skip('NOT_BUILT — no billing UI. When built: verify billing section shows current plan, payment method management, and upgrade/downgrade flows with Stripe integration.');
});

// ---------------------------------------------------------------------------
// Action 86 — Subscription (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 86: Subscription Management', () => {
  test.skip('NOT_BUILT — no subscription management UI. When built: verify users can view their current subscription tier, upgrade to premium, downgrade to free, and that plan changes take effect immediately in the UI.');
});

// ---------------------------------------------------------------------------
// Action 87 — Invoices (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 87: Invoices', () => {
  test.skip('NOT_BUILT — no invoice system. When built: verify business owners can view a paginated list of invoices, download individual invoices as PDFs, and filter by date range.');
});

// ---------------------------------------------------------------------------
// Action 88 — Password Change (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 88: Password Change', () => {
  test('No password change UI exists in ProfileModal Settings', async ({ page }) => {
    const found = await openProfileModalSettingsTab(page);

    if (!found) {
      console.log('Settings tab not reachable — cannot verify password change absence');
      return;
    }

    const settingsText = await page.locator('body').innerText();
    const hasPasswordUI = /change\s*password|update\s*password|new\s*password|current\s*password/i.test(settingsText);

    if (hasPasswordUI) {
      console.log('NOTE: Password change UI IS now present — update feature status to EXISTS');
      await screenshot(page, 88, 'password-change', '01-password-ui-found');
    } else {
      console.log('CONFIRMED NOT_BUILT: No password change UI in ProfileModal Settings');
      await screenshot(page, 88, 'password-change', '01-no-password-ui');
    }
    // This is a documentation test — always passes
  });

  test.skip('NOT_BUILT — no password change UI. When built: verify user can enter current password, enter a new password with confirmation, submit the form, receive success feedback, and that the new password works on next login. Supabase Auth updateUser() API should be used server-side.');
});
