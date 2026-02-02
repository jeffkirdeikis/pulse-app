import { test, expect } from '@playwright/test';

test('claim form inputs should accept text', async ({ page }) => {
  await page.goto('/');

  // Go to business view
  await page.click('button:has-text("Business")');
  await page.waitForTimeout(1000);

  // Check if we need to sign in or can access claim modal
  const signInBtn = page.locator('.claim-biz-btn-large:has-text("Sign In")');
  const claimBtn = page.locator('.claim-biz-btn-large:has-text("Claim")');

  if (await signInBtn.isVisible()) {
    console.log('User is guest - cannot test claim form without auth');
    test.skip();
    return;
  }

  if (await claimBtn.isVisible()) {
    await claimBtn.click();
    await page.waitForSelector('.claim-modal-premium', { timeout: 5000 });

    // Try to type in each input
    const businessNameInput = page.locator('.claim-form-group input[placeholder*="Sound Martial"]');
    await businessNameInput.click();
    await businessNameInput.fill('Test Business');

    const value = await businessNameInput.inputValue();
    console.log('Business name input value:', value);
    expect(value).toBe('Test Business');

    // Test other inputs
    const nameInput = page.locator('.claim-form-group input[placeholder="Full name"]');
    await nameInput.fill('John Doe');
    expect(await nameInput.inputValue()).toBe('John Doe');

    const emailInput = page.locator('.claim-form-group input[type="email"]');
    await emailInput.fill('test@example.com');
    expect(await emailInput.inputValue()).toBe('test@example.com');

    console.log('All inputs work correctly!');
  }
});
