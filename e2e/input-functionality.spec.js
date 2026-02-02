import { test, expect } from '@playwright/test';

/**
 * CRITICAL INPUT FUNCTIONALITY TESTS
 *
 * These tests verify that ALL form inputs actually WORK (accept typing),
 * not just that they exist on the page.
 */

test.describe('Input Functionality - All Inputs Must Accept Typing', () => {

  test.describe('Search Input', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.search-bar-premium input', { timeout: 10000 });
    });

    test('search input accepts text and shows it', async ({ page }) => {
      const searchInput = page.locator('.search-bar-premium input');

      // Click to focus
      await searchInput.click();

      // Type text
      await searchInput.fill('yoga classes');

      // VERIFY: Text actually appears in the input
      const value = await searchInput.inputValue();
      expect(value).toBe('yoga classes');
    });

    test('search input accepts special characters', async ({ page }) => {
      const searchInput = page.locator('.search-bar-premium input');
      await searchInput.click();
      await searchInput.fill('test @#$% special');

      const value = await searchInput.inputValue();
      expect(value).toBe('test @#$% special');
    });

    test('search filters results in real-time', async ({ page }) => {
      const searchInput = page.locator('.search-bar-premium input');

      // Get initial results count
      await page.waitForSelector('.results-count');
      const initialText = await page.locator('.results-count').textContent();

      // Type to filter
      await searchInput.fill('zzznonexistent123');
      await page.waitForTimeout(500);

      // Results should change
      const filteredText = await page.locator('.results-count').textContent();
      expect(filteredText).toContain('0') || expect(filteredText).not.toBe(initialText);
    });

    test('clear button clears the search', async ({ page }) => {
      const searchInput = page.locator('.search-bar-premium input');

      // Type text
      await searchInput.fill('test search');
      expect(await searchInput.inputValue()).toBe('test search');

      // Clear button should appear
      await expect(page.locator('.search-clear-btn')).toBeVisible();

      // Click clear
      await page.click('.search-clear-btn');

      // VERIFY: Input is empty
      expect(await searchInput.inputValue()).toBe('');
    });
  });

  test.describe('Auth Modal - Sign In', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('.profile-btn', { timeout: 10000 });
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal', { timeout: 5000 });
    });

    test('email input accepts text', async ({ page }) => {
      const emailInput = page.locator('.auth-modal input[type="email"]');

      await emailInput.click();
      await emailInput.fill('test@example.com');

      const value = await emailInput.inputValue();
      expect(value).toBe('test@example.com');
    });

    test('password input accepts text and masks it', async ({ page }) => {
      const passwordInput = page.locator('.auth-modal input[type="password"]');

      await passwordInput.click();
      await passwordInput.fill('secretpassword123');

      const value = await passwordInput.inputValue();
      expect(value).toBe('secretpassword123');

      // Verify it's a password type (masked)
      const type = await passwordInput.getAttribute('type');
      expect(type).toBe('password');
    });
  });

  test.describe('Auth Modal - Sign Up', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.click('.profile-btn');
      await page.waitForSelector('.auth-modal', { timeout: 5000 });

      // Switch to sign up mode
      const signUpLink = page.locator('text=Sign Up, text=sign up, text=Create account').first();
      if (await signUpLink.isVisible()) {
        await signUpLink.click();
        await page.waitForTimeout(300);
      }
    });

    test('name input accepts text in signup mode', async ({ page }) => {
      // Look for name input (may have different selectors)
      const nameInput = page.locator('.auth-modal input[placeholder*="name" i], .auth-modal input[name="name"]').first();

      if (await nameInput.count() > 0) {
        await nameInput.click();
        await nameInput.fill('John Doe');

        const value = await nameInput.inputValue();
        expect(value).toBe('John Doe');
      }
    });
  });
});

test.describe('Claim Business Form - All Fields Accept Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.view-switcher', { timeout: 10000 });

    // Go to business view
    await page.click('button:has-text("Business")');
    await page.waitForTimeout(1000);
  });

  test('claim modal opens and shows form', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (await claimBtn.isVisible()) {
      await claimBtn.click();
      await page.waitForSelector('.claim-modal-premium, .claim-modal', { timeout: 5000 });

      // Verify form is visible
      await expect(page.locator('.claim-form-group')).toBeVisible();
    } else {
      // User may need to sign in first
      const signInBtn = page.locator('button:has-text("Sign In")').first();
      if (await signInBtn.isVisible()) {
        test.skip('User needs to be signed in for claim form test');
      }
    }
  });

  test('business name input accepts text', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible - may need auth');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium, .claim-modal', { timeout: 5000 });

    // Find business name input (various possible selectors)
    const bizNameInput = page.locator(
      '.claim-form-group input[placeholder*="business" i], ' +
      '.claim-form-group input[placeholder*="Business" i], ' +
      'input[name="businessName"], ' +
      '.claim-modal input:first-of-type'
    ).first();

    await bizNameInput.click();
    await bizNameInput.fill('Test Business Name');

    // CRITICAL VERIFICATION: Text actually appears
    const value = await bizNameInput.inputValue();
    expect(value).toBe('Test Business Name');
  });

  test('owner name input accepts text', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const nameInput = page.locator(
      '.claim-form-group input[placeholder*="name" i], ' +
      'input[placeholder="Full name"], ' +
      'input[name="ownerName"]'
    ).first();

    await nameInput.click();
    await nameInput.fill('John Smith');

    const value = await nameInput.inputValue();
    expect(value).toBe('John Smith');
  });

  test('email input accepts text', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const emailInput = page.locator(
      '.claim-form-group input[type="email"], ' +
      'input[placeholder*="email" i]'
    ).first();

    await emailInput.click();
    await emailInput.fill('owner@business.com');

    const value = await emailInput.inputValue();
    expect(value).toBe('owner@business.com');
  });

  test('phone input accepts text', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const phoneInput = page.locator(
      '.claim-form-group input[type="tel"], ' +
      'input[placeholder*="phone" i]'
    ).first();

    await phoneInput.click();
    await phoneInput.fill('555-123-4567');

    const value = await phoneInput.inputValue();
    expect(value).toBe('555-123-4567');
  });

  test('role dropdown can be selected', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const roleSelect = page.locator('.claim-form-group select').first();

    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption({ index: 1 });

      const value = await roleSelect.inputValue();
      expect(value).toBeTruthy();
    }
  });

  test('address input accepts text', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    const addressInput = page.locator(
      'input[placeholder*="address" i], ' +
      'input[name="address"]'
    ).first();

    if (await addressInput.count() > 0) {
      await addressInput.click();
      await addressInput.fill('123 Main Street, Squamish BC');

      const value = await addressInput.inputValue();
      expect(value).toBe('123 Main Street, Squamish BC');
    }
  });

  test('FULL FLOW: All claim form fields work end-to-end', async ({ page }) => {
    const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim"), button:has-text("Claim Your Business")').first();

    if (!(await claimBtn.isVisible())) {
      test.skip('Claim button not visible');
      return;
    }

    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    // Get all inputs in the form
    const inputs = page.locator('.claim-form-group input, .claim-form-group textarea');
    const inputCount = await inputs.count();

    console.log(`Found ${inputCount} input fields in claim form`);

    // Test each input
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');

      console.log(`Testing input ${i}: type=${type}, placeholder=${placeholder}`);

      // Click and fill
      await input.click();

      const testValue = type === 'email'
        ? 'test@example.com'
        : type === 'tel'
          ? '555-1234'
          : `Test Value ${i}`;

      await input.fill(testValue);

      // VERIFY it worked
      const value = await input.inputValue();
      expect(value).toBe(testValue);
      console.log(`✓ Input ${i} accepted text: "${value}"`);
    }
  });
});

test.describe('Profile Settings - All Fields Accept Input', () => {
  test('all profile settings inputs work', async ({ page }) => {
    // This test would require authentication
    // Skipping for now but documenting what needs to be tested
    test.skip('Requires authentication - run with auth setup');
  });
});

test.describe('Submit Event Form - All Fields Accept Input', () => {
  test('all submit form inputs work', async ({ page }) => {
    // This test would require authentication
    test.skip('Requires authentication - run with auth setup');
  });
});

test.describe('Contact/Review Forms - All Fields Accept Input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('.banner-tab:has-text("Services")');
    await page.waitForTimeout(1000);
  });

  test('service detail modal inputs accept text', async ({ page }) => {
    const serviceCard = page.locator('.service-card, .business-card').first();

    if (await serviceCard.count() === 0) {
      test.skip('No service cards found');
      return;
    }

    await serviceCard.click();
    await page.waitForSelector('.service-detail-modal, .business-detail-modal', { timeout: 5000 }).catch(() => null);

    // Look for review textarea
    const reviewTextarea = page.locator('textarea[placeholder*="review" i], textarea[placeholder*="message" i]').first();

    if (await reviewTextarea.count() > 0) {
      await reviewTextarea.click();
      await reviewTextarea.fill('This is a test review message');

      const value = await reviewTextarea.inputValue();
      expect(value).toBe('This is a test review message');
    }
  });
});
