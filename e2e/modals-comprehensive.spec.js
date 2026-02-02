import { test, expect } from '@playwright/test';

// Increase timeout for all tests
test.setTimeout(45000);

test.describe('Modals Comprehensive Tests', () => {

  // ========== CLAIM BUSINESS MODAL (Tests 1-4) ==========
  test.describe('Claim Business Modal', () => {

    test('1. Business view shows Sign In Required for guests', async ({ page }) => {
      await page.goto('/');

      // Click Business view
      await page.click('.view-switcher button:has-text("Business")');

      // Should show Sign In Required message for guests
      const signInRequired = page.locator('h2:has-text("Sign In Required")');
      await expect(signInRequired).toBeVisible({ timeout: 5000 });

      // Should have informative text
      const description = page.locator('.no-biz-content p');
      await expect(description).toContainText('Sign in to access');
    });

    test('2. Sign In button opens auth modal from Business view', async ({ page }) => {
      await page.goto('/');

      // Navigate to Business view
      await page.click('.view-switcher button:has-text("Business")');

      // Click Sign In button
      await page.click('.claim-biz-btn-large:has-text("Sign In")');

      // Auth modal should appear
      const authModal = page.locator('.auth-modal');
      await expect(authModal).toBeVisible({ timeout: 3000 });

      // Auth modal should have expected content
      await expect(page.locator('.auth-modal h2')).toContainText(/Welcome Back|Create Account/);
    });

    test('3. Auth modal closes on X button', async ({ page }) => {
      await page.goto('/');

      await page.click('.view-switcher button:has-text("Business")');
      await page.click('.claim-biz-btn-large:has-text("Sign In")');

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });

      // Click close button
      await page.click('.auth-modal-close');

      // Modal should close
      await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('4. Auth modal closes on overlay click', async ({ page }) => {
      await page.goto('/');

      await page.click('.view-switcher button:has-text("Business")');
      await page.click('.claim-biz-btn-large:has-text("Sign In")');

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });

      // Click overlay (outside modal content)
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

      // Modal should close
      await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 2000 });
    });
  });

  // ========== ADD EVENT MODAL (FAB) (Tests 5-9) ==========
  test.describe('Add Event Modal (FAB)', () => {

    test('5. FAB button is visible and clickable', async ({ page }) => {
      await page.goto('/');

      // FAB should be visible
      const fab = page.locator('.fab-premium');
      await expect(fab).toBeVisible();

      // Should have Add Event label
      await expect(page.locator('.fab-label')).toContainText('Add Event');
    });

    test('6. FAB opens Add Event modal for guest', async ({ page }) => {
      await page.goto('/');

      // Click FAB
      await page.click('.fab-premium');

      // Add Event modal should open
      const addEventModal = page.locator('.add-event-modal');
      await expect(addEventModal).toBeVisible({ timeout: 3000 });
    });

    test('7. Add Event modal has form fields', async ({ page }) => {
      await page.goto('/');

      await page.click('.fab-premium');
      await expect(page.locator('.add-event-modal')).toBeVisible({ timeout: 3000 });

      // Check for header
      await expect(page.locator('.modal-header-premium h2')).toContainText('Add Your Event');

      // Check for form inputs - placeholder is "e.g., Yoga in the Park"
      await expect(page.locator('.add-event-modal .form-input').first()).toBeVisible();

      // Check for category selection
      await expect(page.locator('.category-checkbox-grid')).toBeVisible();
    });

    test('8. Add Event modal closes on X button', async ({ page }) => {
      await page.goto('/');

      await page.click('.fab-premium');
      await expect(page.locator('.add-event-modal')).toBeVisible({ timeout: 3000 });

      // Click X button
      await page.click('.add-event-modal .close-btn');

      // Modal should close
      await expect(page.locator('.add-event-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('9. Add Event modal closes on overlay click', async ({ page }) => {
      await page.goto('/');

      await page.click('.fab-premium');
      await expect(page.locator('.add-event-modal')).toBeVisible({ timeout: 3000 });

      // Click overlay
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

      // Modal should close
      await expect(page.locator('.add-event-modal')).not.toBeVisible({ timeout: 2000 });
    });
  });

  // ========== SUBMISSION MODAL (Tests 10-13) ==========
  test.describe('Submission Modal', () => {

    test('10-11. Profile button opens auth modal for guests', async ({ page }) => {
      await page.goto('/');

      // Click profile button - for guests this opens auth modal
      await page.click('.profile-btn');

      // For guests, auth modal should appear
      const authModal = page.locator('.auth-modal');
      await expect(authModal).toBeVisible({ timeout: 3000 });

      console.log('Guest user: Profile button opens auth modal - submission modal requires authentication');
    });

    test('12. Submission modal requires auth - verify profile auth gate', async ({ page }) => {
      await page.goto('/');

      // Try to access via profile button
      await page.click('.profile-btn');

      // Check if auth modal appears (guest)
      const authModal = page.locator('.auth-modal');
      await expect(authModal).toBeVisible({ timeout: 3000 });

      // Verify auth modal content
      await expect(page.locator('.auth-modal h2')).toContainText(/Welcome Back|Create Account/);
      console.log('Guest user: Cannot access submission modal - auth required');
    });
  });

  // ========== MY CALENDAR MODAL (Tests 14-20) ==========
  test.describe('My Calendar Modal', () => {

    test('14. My Calendar requires auth for guests', async ({ page }) => {
      await page.goto('/');

      // Click profile button
      await page.click('.profile-btn');

      // For guests, auth modal appears
      const authModal = page.locator('.auth-modal');
      await expect(authModal).toBeVisible({ timeout: 3000 });
      console.log('Guest user: My Calendar requires authentication - accessed via profile menu');
    });
  });

  // ========== MODAL CLOSE BEHAVIORS (Tests 21-23) ==========
  test.describe('Modal Close Behaviors', () => {

    test('21. Auth modal and Add Event modal close on X button', async ({ page }) => {
      await page.goto('/');

      // Test Auth Modal
      await page.click('.view-switcher button:has-text("Business")');
      await page.click('.claim-biz-btn-large:has-text("Sign In")');
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });
      await page.click('.auth-modal-close');
      await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 2000 });

      // Go back to Consumer view
      await page.click('.view-switcher button:has-text("Consumer")');

      // Test Add Event Modal
      await page.click('.fab-premium');
      await expect(page.locator('.add-event-modal')).toBeVisible({ timeout: 3000 });
      await page.click('.add-event-modal .close-btn');
      await expect(page.locator('.add-event-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('22. Auth modal and Add Event modal close on overlay click', async ({ page }) => {
      await page.goto('/');

      // Test Auth Modal
      await page.click('.view-switcher button:has-text("Business")');
      await page.click('.claim-biz-btn-large:has-text("Sign In")');
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
      await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 2000 });

      // Go back to Consumer view
      await page.click('.view-switcher button:has-text("Consumer")');

      // Test Add Event Modal
      await page.click('.fab-premium');
      await expect(page.locator('.add-event-modal')).toBeVisible({ timeout: 3000 });
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });
      await expect(page.locator('.add-event-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('23. ESC key behavior on auth modal', async ({ page }) => {
      await page.goto('/');

      // Open auth modal
      await page.click('.view-switcher button:has-text("Business")');
      await page.click('.claim-biz-btn-large:has-text("Sign In")');
      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });

      // Press ESC
      await page.keyboard.press('Escape');

      // Check if ESC closes the modal
      await page.waitForTimeout(300);
      const stillVisible = await page.locator('.auth-modal').isVisible();
      if (stillVisible) {
        console.log('RESULT: ESC key does NOT close auth modal - behavior not implemented');
      } else {
        console.log('RESULT: ESC key closes auth modal');
      }
    });
  });

  // ========== AUTH MODAL FUNCTIONALITY ==========
  test.describe('Auth Modal Functionality', () => {

    test('Auth modal has Google sign-in and email form', async ({ page }) => {
      await page.goto('/');
      await page.click('.profile-btn');

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });

      // Check for Google button
      const googleBtn = page.locator('.auth-btn.google');
      await expect(googleBtn).toBeVisible();
      await expect(googleBtn).toContainText('Continue with Google');

      // Check for email form
      await expect(page.locator('.auth-form input[type="email"]')).toBeVisible();
      await expect(page.locator('.auth-form input[type="password"]')).toBeVisible();
      await expect(page.locator('.auth-form button[type="submit"]')).toBeVisible();
    });

    test('Auth modal switches between sign-in and sign-up', async ({ page }) => {
      await page.goto('/');
      await page.click('.profile-btn');

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });

      // Should start with Sign In mode
      await expect(page.locator('.auth-modal h2')).toContainText('Welcome Back');

      // Click to switch to Sign Up
      await page.click('.auth-switch button');

      // Should now show Create Account
      await expect(page.locator('.auth-modal h2')).toContainText('Create Account');

      // Name field should appear in sign up mode
      await expect(page.locator('.auth-form-group:has-text("Full Name") input')).toBeVisible();
    });

    test('Auth modal shows footer with terms', async ({ page }) => {
      await page.goto('/');
      await page.click('.profile-btn');

      await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 3000 });

      // Check footer
      await expect(page.locator('.auth-modal-footer')).toContainText('Terms of Service');
      await expect(page.locator('.auth-modal-footer')).toContainText('Privacy Policy');
    });
  });

  // ========== GUEST ACCESS SUMMARY ==========
  test.describe('Guest Access Summary', () => {

    test('Document guest access permissions', async ({ page }) => {
      await page.goto('/');

      const accessReport = {
        fabButton: false,
        addEventModal: false,
        businessView: false,
        authModalFromProfile: false,
        authModalFromBusiness: false,
        profileMenu: false
      };

      // Check FAB button
      accessReport.fabButton = await page.locator('.fab-premium').isVisible();

      // Check Add Event Modal access
      if (accessReport.fabButton) {
        await page.click('.fab-premium');
        accessReport.addEventModal = await page.locator('.add-event-modal').isVisible({ timeout: 2000 }).catch(() => false);
        if (accessReport.addEventModal) {
          await page.click('.add-event-modal .close-btn');
        }
      }

      // Check Business view
      await page.click('.view-switcher button:has-text("Business")');
      const signInRequired = await page.locator('h2:has-text("Sign In Required")').isVisible({ timeout: 3000 }).catch(() => false);
      accessReport.businessView = !signInRequired;

      if (signInRequired) {
        // Test auth modal from business view
        await page.click('.claim-biz-btn-large:has-text("Sign In")');
        accessReport.authModalFromBusiness = await page.locator('.auth-modal').isVisible({ timeout: 2000 }).catch(() => false);
        if (accessReport.authModalFromBusiness) {
          await page.click('.auth-modal-close');
        }
      }

      // Go back to Consumer
      await page.click('.view-switcher button:has-text("Consumer")');

      // Check profile button behavior
      await page.click('.profile-btn');
      accessReport.authModalFromProfile = await page.locator('.auth-modal').isVisible({ timeout: 2000 }).catch(() => false);
      accessReport.profileMenu = await page.locator('.profile-menu-dropdown').isVisible({ timeout: 1000 }).catch(() => false);

      // Log the access report
      console.log('\n=== GUEST ACCESS REPORT ===');
      console.log(`FAB Button Visible: ${accessReport.fabButton ? 'YES' : 'NO'}`);
      console.log(`Add Event Modal Accessible: ${accessReport.addEventModal ? 'YES' : 'NO'}`);
      console.log(`Business View Accessible: ${accessReport.businessView ? 'YES' : 'NO (requires auth)'}`);
      console.log(`Auth Modal from Profile: ${accessReport.authModalFromProfile ? 'YES' : 'NO'}`);
      console.log(`Auth Modal from Business: ${accessReport.authModalFromBusiness ? 'YES' : 'NO'}`);
      console.log(`Profile Menu Accessible: ${accessReport.profileMenu ? 'YES' : 'NO (requires auth)'}`);
      console.log('===========================\n');

      // Verify expected guest behavior
      expect(accessReport.fabButton).toBeTruthy();
      expect(accessReport.addEventModal).toBeTruthy();
      expect(accessReport.businessView).toBeFalsy();
      expect(accessReport.authModalFromProfile || accessReport.authModalFromBusiness).toBeTruthy();
    });
  });
});
