import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show sign-in modal when clicking profile as guest', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await page.waitForSelector('.profile-btn');

    // Click profile button
    await page.click('.profile-btn');

    // Auth modal should appear
    await expect(page.locator('.auth-modal')).toBeVisible();
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });

  test('should have Google sign-in button', async ({ page }) => {
    await page.goto('/');
    await page.click('.profile-btn');

    // Check for Google sign-in button
    await expect(page.locator('text=Continue with Google')).toBeVisible();
  });

  test('should have email sign-in form', async ({ page }) => {
    await page.goto('/');
    await page.click('.profile-btn');

    // Check for email/password fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should close auth modal on X button click', async ({ page }) => {
    await page.goto('/');
    await page.click('.profile-btn');

    await expect(page.locator('.auth-modal')).toBeVisible();

    // Click close button
    await page.click('.auth-modal-close');

    // Modal should be gone
    await expect(page.locator('.auth-modal')).not.toBeVisible();
  });

  test('should close auth modal on overlay click', async ({ page }) => {
    await page.goto('/');
    await page.click('.profile-btn');

    await expect(page.locator('.auth-modal')).toBeVisible();

    // Click overlay (outside modal)
    await page.click('.modal-overlay', { position: { x: 10, y: 10 } });

    // Modal should be gone
    await expect(page.locator('.auth-modal')).not.toBeVisible();
  });
});
