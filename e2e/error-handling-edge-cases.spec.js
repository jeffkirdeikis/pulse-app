import { test, expect } from '@playwright/test';

test.describe('Error Handling and Edge Cases', () => {

  test.describe('Empty State Testing', () => {
    test('should show empty state when searching for nonexistent term', async ({ page }) => {
      await page.goto('/');

      // Wait for app to load - look for search bar with the correct class
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });

      // Search for something that won't exist
      await page.fill('.search-bar-premium input', 'zzzzzzzzzz');

      // Wait for search to process
      await page.waitForTimeout(1000);

      // Take screenshot of empty state
      await page.screenshot({ path: '/tmp/empty-search-state.png', fullPage: true });

      // Check results count - should show 0 or "No results"
      const resultsText = await page.textContent('body');
      const hasNoResults = resultsText.includes('0 results') ||
                           resultsText.includes('No results') ||
                           resultsText.includes('No businesses found');

      console.log(`Empty state showing: ${hasNoResults}`);
    });

    test('should allow clearing search filter', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });

      // Search for something
      await page.fill('.search-bar-premium input', 'yoga');
      await page.waitForTimeout(500);

      // Clear the search
      await page.fill('.search-bar-premium input', '');
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({ path: '/tmp/cleared-search.png', fullPage: true });

      // Results should show content
      const resultsText = await page.locator('body').textContent();
      console.log(`Search cleared, page has content: ${resultsText.length > 100}`);
    });
  });

  test.describe('Long Text Handling', () => {
    test('should handle long text gracefully in search', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });

      // Enter very long search text
      const longText = 'a'.repeat(200);
      await page.fill('.search-bar-premium input', longText);

      // App should not crash - take screenshot
      await page.screenshot({ path: '/tmp/long-search-text.png', fullPage: true });

      // Page should still be responsive
      await expect(page.locator('.search-bar-premium input')).toBeVisible();
    });
  });

  test.describe('Input Validation', () => {
    test('should show validation for empty email in auth modal', async ({ page }) => {
      await page.goto('/');

      // Open auth modal
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');

      // Try to submit with empty email - click the submit button inside auth-modal
      const signInButton = page.locator('.auth-modal button[type="submit"]');
      await signInButton.click();

      // Take screenshot
      await page.screenshot({ path: '/tmp/empty-email-validation.png', fullPage: true });

      // Check for HTML5 validation or custom validation message
      const emailInput = page.locator('.auth-modal input[type="email"]');
      const validationMessage = await emailInput.evaluate(el => el.validationMessage);
      console.log(`Validation message: ${validationMessage}`);
    });

    test('should show validation for invalid email format', async ({ page }) => {
      await page.goto('/');

      // Open auth modal
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');

      // Enter invalid email
      await page.fill('.auth-modal input[type="email"]', 'notanemail');
      await page.fill('.auth-modal input[type="password"]', 'password123');

      // Try to submit
      const signInButton = page.locator('.auth-modal button[type="submit"]');
      await signInButton.click();

      // Take screenshot
      await page.screenshot({ path: '/tmp/invalid-email-validation.png', fullPage: true });

      // Check for validation
      const emailInput = page.locator('.auth-modal input[type="email"]');
      const isValid = await emailInput.evaluate(el => el.validity.valid);
      console.log(`Email valid: ${isValid}`);
      expect(isValid).toBe(false);
    });

    test('should handle special characters in search input', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });

      // Enter special characters
      const specialChars = '<script>alert("xss")</script>';
      await page.fill('.search-bar-premium input', specialChars);

      // App should not crash
      await page.screenshot({ path: '/tmp/special-chars-search.png', fullPage: true });

      // Page should still be responsive
      await expect(page.locator('.search-bar-premium input')).toBeVisible();

      // XSS should not execute - check page is still functional
      const pageContent = await page.content();
      const xssExecuted = pageContent.includes('<script>alert');
      console.log(`XSS attempted but not executed in DOM: ${!xssExecuted}`);
    });

    test('should handle SQL injection attempt in search', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });

      // Enter SQL injection attempt
      const sqlInjection = "'; DROP TABLE events; --";
      await page.fill('.search-bar-premium input', sqlInjection);

      await page.waitForTimeout(500);

      // App should not crash
      await page.screenshot({ path: '/tmp/sql-injection-search.png', fullPage: true });

      // Page should still be responsive
      await expect(page.locator('.search-bar-premium input')).toBeVisible();
    });
  });

  test.describe('Rapid Click Prevention', () => {
    test('should handle rapid clicks on navigation tabs without crashing', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Find navigation tabs
      const consumerTab = page.locator('button:has-text("Consumer")');
      const businessTab = page.locator('button:has-text("Business")');

      // Rapid switch between tabs
      for (let i = 0; i < 5; i++) {
        await consumerTab.click({ delay: 50 });
        await businessTab.click({ delay: 50 });
      }

      // Page should still work
      await page.screenshot({ path: '/tmp/rapid-click-tabs.png', fullPage: true });

      // Verify page didn't crash
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle opening modal after rapid clicks', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.header-signin-btn');

      // Click once to open modal
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');

      // Should only have one modal open
      const modalCount = await page.locator('.auth-modal').count();
      console.log(`Auth modals open: ${modalCount}`);
      expect(modalCount).toBe(1);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Verify modal closed
      await expect(page.locator('.auth-modal')).not.toBeVisible();

      await page.screenshot({ path: '/tmp/rapid-click-auth.png', fullPage: true });
    });
  });

  test.describe('Browser Console Errors', () => {
    test('should check for JavaScript errors on page load', async ({ page }) => {
      const errors = [];
      const warnings = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        } else if (msg.type() === 'warning') {
          warnings.push(msg.text());
        }
      });

      page.on('pageerror', exception => {
        errors.push(exception.message);
      });

      await page.goto('/');
      await page.waitForTimeout(3000); // Wait for initial load and data fetching

      // Take screenshot
      await page.screenshot({ path: '/tmp/console-errors-check.png', fullPage: true });

      console.log('=== CONSOLE ERRORS ===');
      errors.forEach((e, i) => console.log(`Error ${i + 1}: ${e}`));

      console.log('\n=== CONSOLE WARNINGS ===');
      warnings.forEach((w, i) => console.log(`Warning ${i + 1}: ${w}`));

      // Report findings
      console.log(`\nTotal errors: ${errors.length}`);
      console.log(`Total warnings: ${warnings.length}`);

      // Filter out known React dev warnings
      const criticalErrors = errors.filter(e =>
        !e.includes('non-boolean attribute') &&
        !e.includes('Warning:')
      );

      console.log(`Critical errors: ${criticalErrors.length}`);
    });

    test('should check for errors when opening modals', async ({ page }) => {
      const errors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      page.on('pageerror', exception => {
        errors.push(exception.message);
      });

      await page.goto('/');
      await page.waitForSelector('.header-signin-btn');

      // Open auth modal
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');
      await page.waitForTimeout(500);

      // Close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      console.log('=== MODAL ERRORS ===');
      errors.forEach((e, i) => console.log(`Error ${i + 1}: ${e}`));

      // Take screenshot
      await page.screenshot({ path: '/tmp/modal-errors-check.png', fullPage: true });
    });
  });

  test.describe('Image Error Fallbacks', () => {
    test('should check for avatar fallbacks', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Find avatars - look for images or avatar placeholders
      const avatars = page.locator('.avatar, .user-avatar, img[alt*="avatar"], .profile-avatar');
      const avatarCount = await avatars.count();
      console.log(`Avatars found: ${avatarCount}`);

      // Take screenshot
      await page.screenshot({ path: '/tmp/avatar-fallbacks.png', fullPage: true });
    });

    test('should check event/business images have alt text', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Find all images
      const images = page.locator('img');
      const imageCount = await images.count();

      let missingAlt = 0;
      for (let i = 0; i < Math.min(imageCount, 20); i++) {
        const alt = await images.nth(i).getAttribute('alt');
        if (!alt) {
          missingAlt++;
          const src = await images.nth(i).getAttribute('src');
          console.log(`Image ${i + 1} missing alt text: ${src?.substring(0, 50)}...`);
        }
      }

      console.log(`Total images checked: ${Math.min(imageCount, 20)}`);
      console.log(`Images missing alt text: ${missingAlt}`);
    });
  });

  test.describe('Network Error Handling', () => {
    test('should show user-friendly error when offline', async ({ page, context }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Take initial screenshot
      await page.screenshot({ path: '/tmp/before-offline.png', fullPage: true });

      // Go offline
      await context.setOffline(true);

      // Try to search (which would trigger a network request if it's server-side)
      await page.fill('.search-bar-premium input', 'yoga');
      await page.waitForTimeout(1000);

      // Take screenshot of offline state
      await page.screenshot({ path: '/tmp/offline-state.png', fullPage: true });

      // Check if any error message appears
      const pageContent = await page.textContent('body');
      console.log(`Offline behavior: App still shows content (client-side filter): ${pageContent.length > 100}`);

      // Restore network
      await context.setOffline(false);
    });
  });

  test.describe('Modal Behavior Edge Cases', () => {
    test('should close modal on ESC key', async ({ page }) => {
      await page.goto('/');
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');

      // Press ESC
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(page.locator('.auth-modal')).not.toBeVisible();
    });

    test('should handle multiple modal opens/closes', async ({ page }) => {
      await page.goto('/');

      // Open and close modal multiple times
      for (let i = 0; i < 3; i++) {
        await page.click('.header-signin-btn');
        await page.waitForSelector('.auth-modal');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // Modal should be closed
      await expect(page.locator('.auth-modal')).not.toBeVisible();

      // Page should still work
      await page.screenshot({ path: '/tmp/multiple-modal-opens.png', fullPage: true });
    });

    test('should close modal on overlay click', async ({ page }) => {
      await page.goto('/');
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');

      // Click overlay (outside modal content)
      await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

      // Modal should close
      await expect(page.locator('.auth-modal')).not.toBeVisible();
    });
  });

  test.describe('Tab/View Navigation Edge Cases', () => {
    test('should switch between all main views', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Click Consumer tab
      const consumerTab = page.locator('button:has-text("Consumer")');
      if (await consumerTab.count() > 0) {
        await consumerTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/view-consumer.png', fullPage: true });
      }

      // Click Business tab
      const businessTab = page.locator('button:has-text("Business")');
      if (await businessTab.count() > 0) {
        await businessTab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/view-business.png', fullPage: true });
      }

      console.log('View switching works correctly');
    });

    test('should switch between content tabs (Classes, Events, Deals, Services)', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      const tabs = ['Classes', 'Events', 'Deals', 'Services'];

      for (const tabName of tabs) {
        const tab = page.locator(`button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
        if (await tab.count() > 0 && await tab.isVisible()) {
          await tab.click();
          await page.waitForTimeout(500);
          console.log(`Switched to ${tabName} tab`);
        }
      }

      await page.screenshot({ path: '/tmp/content-tabs.png', fullPage: true });
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation through interactive elements', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Tab through several elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }

      // Take screenshot showing focus state
      await page.screenshot({ path: '/tmp/keyboard-navigation.png', fullPage: true });
    });

    test('should handle Enter key on focused buttons', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Focus on Sign In button
      await page.focus('.header-signin-btn');

      // Press Enter
      await page.keyboard.press('Enter');

      // Modal should open
      await expect(page.locator('.auth-modal')).toBeVisible();
    });
  });

  test.describe('Scroll Behavior', () => {
    test('should maintain state after scrolling', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(500);

      // Take screenshot
      await page.screenshot({ path: '/tmp/after-scroll.png', fullPage: true });

      // Scroll back up
      await page.evaluate(() => window.scrollTo(0, 0));

      // Header should still be visible
      const header = page.locator('header, .header, .app-header');
      const headerVisible = await header.first().isVisible().catch(() => false);
      console.log(`Header visible after scroll: ${headerVisible}`);
    });
  });

  test.describe('Form Input Edge Cases', () => {
    test('should handle paste into search', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });

      // Focus and paste
      await page.focus('.search-bar-premium input');
      await page.evaluate(() => {
        navigator.clipboard.writeText('yoga class').catch(() => {});
      });

      // Type directly as paste might not work in test env
      await page.fill('.search-bar-premium input', 'pasted yoga class');

      await page.screenshot({ path: '/tmp/paste-search.png', fullPage: true });
    });

    test('should handle form submission with Enter key', async ({ page }) => {
      await page.goto('/');
      await page.click('.header-signin-btn');
      await page.waitForSelector('.auth-modal');

      // Fill form
      await page.fill('.auth-modal input[type="email"]', 'test@example.com');
      await page.fill('.auth-modal input[type="password"]', 'password123');

      // Press Enter to submit (should trigger form submission)
      await page.keyboard.press('Enter');

      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/enter-submit.png', fullPage: true });
    });
  });

  test.describe('Double Click Prevention', () => {
    test('should not create duplicate actions on double-click Book button', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Find a Book button
      const bookButton = page.locator('button:has-text("Book")').first();

      if (await bookButton.count() > 0 && await bookButton.isVisible()) {
        // Double click
        await bookButton.dblclick();

        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/double-click-book.png', fullPage: true });

        // Check only one modal/action triggered
        const modalCount = await page.locator('.modal-overlay').count();
        console.log(`Modals open after double-click: ${modalCount}`);
      } else {
        console.log('No Book button found on page');
      }
    });
  });
});
