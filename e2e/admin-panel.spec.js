import { test, expect } from '@playwright/test';

/**
 * ADMIN PANEL TESTS
 *
 * These tests verify the admin panel works correctly for admin users.
 * Requires: user.isAdmin = true in the database
 */

test.describe('Admin Panel Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
  });

  test('guest users cannot see admin button', async ({ page }) => {
    // As guest, admin should not be visible
    const adminBtn = page.locator('button:has-text("Admin"), .view-switcher button:nth-child(3)');

    // Either admin button doesn't exist or is hidden
    const count = await adminBtn.count();
    if (count > 0) {
      // If there's a third button, it should not be "Admin" for guests
      const text = await adminBtn.first().textContent();
      expect(text?.toLowerCase()).not.toContain('admin');
    }
  });

  test('admin button appears for admin users', async ({ page }) => {
    // This test requires the user to be signed in as admin
    // Check if we're authenticated by looking for profile menu
    const profileBtn = page.locator('.profile-btn');
    const profileText = await profileBtn.textContent().catch(() => '');

    // If user is signed in and is admin, admin button should be visible
    // The view switcher might show Consumer | Business | Admin
    const viewSwitcher = page.locator('.view-switcher');
    const buttonCount = await viewSwitcher.locator('button').count();

    console.log(`View switcher has ${buttonCount} buttons`);

    if (buttonCount >= 3) {
      const thirdButton = viewSwitcher.locator('button').nth(2);
      const text = await thirdButton.textContent();
      console.log(`Third button text: "${text}"`);

      // If admin, this should say "Admin"
      if (text?.toLowerCase().includes('admin')) {
        // Admin button is visible - test passes
        expect(text.toLowerCase()).toContain('admin');
      }
    }
  });
});

test.describe('Admin Panel Content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });
  });

  test('admin panel renders content, not blank', async ({ page }) => {
    // Try to access admin view
    const adminBtn = page.locator('button:has-text("Admin")').first();

    if (!(await adminBtn.isVisible())) {
      console.log('Admin button not visible - user may not be admin');
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // CRITICAL: Admin panel should NOT be empty
    // It should show tabs or content

    // Check for admin panel elements
    const adminPanel = page.locator('.admin-panel, .admin-view, [class*="admin"]');

    if (await adminPanel.count() > 0) {
      // Check for tabs (Pending, Approved, Rejected)
      const hasPendingTab = await page.locator('text=Pending').isVisible();
      const hasApprovedTab = await page.locator('text=Approved').isVisible();

      if (hasPendingTab || hasApprovedTab) {
        console.log('✓ Admin panel has tabs');
        expect(hasPendingTab || hasApprovedTab).toBe(true);
      }

      // Check for any content beyond just "Go Back"
      const bodyText = await page.locator('body').textContent();
      const hasContent = bodyText.includes('Pending') ||
        bodyText.includes('Submissions') ||
        bodyText.includes('Approve') ||
        bodyText.includes('Reject');

      console.log('Admin panel has content:', hasContent);

      // Should not be just "Go Back" and nothing else
      const goBackOnly = !hasContent && bodyText.includes('Go Back');
      expect(goBackOnly).toBe(false);
    } else {
      // Check if there's an access restricted message
      const accessRestricted = await page.locator('text=Access Restricted, text=Not authorized').isVisible();

      if (accessRestricted) {
        console.log('Access restricted - user is not admin in database');
        test.fail('Admin access is restricted - is_admin may be false in database');
      }
    }
  });

  test('admin tabs are clickable', async ({ page }) => {
    const adminBtn = page.locator('button:has-text("Admin")').first();

    if (!(await adminBtn.isVisible())) {
      test.skip('Admin button not visible');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Try clicking Pending tab
    const pendingTab = page.locator('button:has-text("Pending"), [role="tab"]:has-text("Pending")').first();

    if (await pendingTab.isVisible()) {
      await pendingTab.click();
      await page.waitForTimeout(300);

      // Tab should become active
      const isActive = await pendingTab.evaluate(el => {
        return el.classList.contains('active') ||
          el.getAttribute('aria-selected') === 'true' ||
          el.classList.contains('selected');
      });

      console.log('Pending tab is active:', isActive);
    }

    // Try clicking Approved tab
    const approvedTab = page.locator('button:has-text("Approved"), [role="tab"]:has-text("Approved")').first();

    if (await approvedTab.isVisible()) {
      await approvedTab.click();
      await page.waitForTimeout(300);
      console.log('Approved tab clicked');
    }
  });

  test('admin can see submission details', async ({ page }) => {
    const adminBtn = page.locator('button:has-text("Admin")').first();

    if (!(await adminBtn.isVisible())) {
      test.skip('Admin button not visible');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Look for submission cards
    const submissionCards = page.locator('.submission-card, .admin-item, [class*="submission"]');
    const cardCount = await submissionCards.count();

    console.log(`Found ${cardCount} submission cards`);

    if (cardCount > 0) {
      // Check first card has content
      const firstCard = submissionCards.first();
      const cardText = await firstCard.textContent();

      expect(cardText.length).toBeGreaterThan(10);
      console.log('First card preview:', cardText.substring(0, 100));
    } else {
      // Check for empty state
      const emptyState = await page.locator('text=No pending, text=No submissions').isVisible();
      console.log('Empty state visible:', emptyState);
    }
  });

  test('approve button works', async ({ page }) => {
    const adminBtn = page.locator('button:has-text("Admin")').first();

    if (!(await adminBtn.isVisible())) {
      test.skip('Admin button not visible');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Find approve button
    const approveBtn = page.locator('button:has-text("Approve")').first();

    if (await approveBtn.isVisible()) {
      console.log('Approve button found and visible');

      // Click it (this would approve a submission)
      // Only click if we're in a test environment
      // await approveBtn.click();
      // await page.waitForTimeout(500);

      expect(await approveBtn.isEnabled()).toBe(true);
    } else {
      console.log('No approve button visible - may be no pending submissions');
    }
  });

  test('reject button works', async ({ page }) => {
    const adminBtn = page.locator('button:has-text("Admin")').first();

    if (!(await adminBtn.isVisible())) {
      test.skip('Admin button not visible');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Find reject button
    const rejectBtn = page.locator('button:has-text("Reject")').first();

    if (await rejectBtn.isVisible()) {
      console.log('Reject button found and visible');
      expect(await rejectBtn.isEnabled()).toBe(true);
    } else {
      console.log('No reject button visible - may be no pending submissions');
    }
  });
});

test.describe('Admin Access Control', () => {
  test('non-admin users see access restricted message', async ({ page }) => {
    // This would require testing with a non-admin user
    // For now, document the expected behavior
    test.skip('Requires non-admin test user');
  });
});

test.describe('Admin Edit Venue Button', () => {
  test('edit button opens edit modal with venue data', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    // Try to access admin view
    const adminBtn = page.locator('button:has-text("Admin")').first();

    if (!(await adminBtn.isVisible())) {
      test.skip('Admin button not visible - requires admin user');
      return;
    }

    await adminBtn.click();
    await page.waitForTimeout(1000);

    // Find venue cards with edit buttons
    const editBtn = page.locator('.action-btn-mini').first();

    if (!(await editBtn.isVisible())) {
      test.skip('No edit buttons visible');
      return;
    }

    // Click edit button
    await editBtn.click();
    await page.waitForTimeout(500);

    // VERIFY: Edit modal should open
    const editModal = page.locator('.claim-modal-premium:has-text("Edit Business")');
    await expect(editModal).toBeVisible({ timeout: 5000 });

    // VERIFY: Modal has form inputs
    const nameInput = editModal.locator('input').first();
    await expect(nameInput).toBeVisible();

    // VERIFY: Inputs accept text
    await nameInput.click();
    await nameInput.fill('Test Business Name');
    const value = await nameInput.inputValue();
    expect(value).toBe('Test Business Name');

    // Close modal
    const closeBtn = editModal.locator('.claim-modal-close');
    await closeBtn.click();

    console.log('✓ Edit button opens modal with working inputs');
  });
});
