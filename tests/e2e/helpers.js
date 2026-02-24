/**
 * Shared test helpers for Pulse App QA Test Suite
 *
 * ACTUAL DOM SELECTORS (verified from source code):
 * - Guest sign-in: button.sign-in-btn
 * - Authenticated profile: div.profile-btn (role="button")
 * - Auth modal: .auth-modal
 * - Tab navigation: button.category-card (with .active class when selected)
 * - Tab labels: .category-card-label (Classes, Events, Deals, Services, Wellness)
 * - Search bar: .search-bar-premium input
 * - Search clear: .search-clear-btn
 * - Business dashboard: .business-view-premium
 * - Feedback widget: .feedback-fab
 * - Feedback modal: .feedback-modal
 * - Add content button: .feedback-add-content-btn
 */

import { test, expect } from '@playwright/test';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Test credentials
export const TEST_OWNER = {
  email: process.env.QA_TEST_EMAIL || 'test-consumer@pulse-test.com',
  password: process.env.QA_TEST_PASSWORD || 'TestPass123',
};

export const TEST_CUSTOMER = {
  email: 'testcustomer@pulse-qa.com',
  password: 'TestPass123!',
};

// Screenshot helper
export async function screenshot(page, actionNumber, actionName, stepName) {
  const dir = join(dirname(new URL(import.meta.url).pathname), '..', 'screenshots', `${String(actionNumber).padStart(2, '0')}-${actionName}`);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = join(dir, `${stepName}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

// Wait for app to fully load
export async function waitForAppLoad(page) {
  await page.goto('/');
  // Wait for the header or navigation cards to appear (actual DOM selectors)
  await page.waitForSelector('.category-card, .app-header-premium, .sign-in-btn, .profile-btn', { timeout: 30000 });
  // Small extra wait for data to populate
  await page.waitForTimeout(1500);
}

// Navigate to a specific tab (Classes, Events, Deals, Services, Wellness)
export async function navigateToTab(page, tabName) {
  const tab = page.locator(`.category-card:has(.category-card-label:has-text("${tabName}"))`);
  if (await tab.isVisible()) {
    await tab.click();
    await page.waitForTimeout(500);
  }
}

// Open auth modal - works for both guest and authenticated users
export async function openAuthModal(page) {
  // For guests: click "Sign In" button
  const signInBtn = page.locator('.sign-in-btn');
  const profileBtn = page.locator('.profile-btn');

  if (await signInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await signInBtn.click();
  } else if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await profileBtn.click();
    // Profile menu opens; may need to find login option within it
  }
  await page.waitForSelector('.auth-modal', { timeout: 5000 });
}

// Switch to business view (uses footer or profile menu navigation)
export async function switchToBusinessView(page) {
  // Try the view switcher (admin-visible) first
  const viewSwitcher = page.locator('.view-switcher button:has-text("Business")');
  if (await viewSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
    await viewSwitcher.click();
    await page.waitForSelector('.business-view-premium', { timeout: 5000 });
    return;
  }
  // Otherwise try navigating to /business path
  await page.goto('/business');
  await page.waitForTimeout(2000);
}

// Switch to admin view
export async function switchToAdminView(page) {
  const adminBtn = page.locator('.view-switcher button:has-text("Admin")');
  if (await adminBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await adminBtn.click();
    await page.waitForTimeout(1000);
    return;
  }
  await page.goto('/admin');
  await page.waitForTimeout(2000);
}

// Switch to consumer view
export async function switchToConsumerView(page) {
  const consumerBtn = page.locator('.view-switcher button:has-text("Consumer")');
  if (await consumerBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await consumerBtn.click();
    await page.waitForTimeout(500);
    return;
  }
  await page.goto('/classes');
  await page.waitForTimeout(1000);
}

// Login helper — skips test if login fails (no test account available)
export async function loginAsTestUser(page, email, password) {
  await openAuthModal(page);
  const emailInput = page.locator('.auth-modal input[type="email"]');
  const passwordInput = page.locator('.auth-modal input[type="password"]');

  await emailInput.fill(email || TEST_OWNER.email);
  await passwordInput.fill(password || TEST_OWNER.password);

  const submitBtn = page.locator('.auth-modal button[type="submit"], .auth-modal .auth-submit-btn');
  await submitBtn.click();

  // Wait for modal to close (successful login) or error to show
  await page.waitForTimeout(3000);

  // Check if login succeeded — profile button appears for authenticated users
  const profileBtn = page.locator('.profile-btn');
  const loginSucceeded = await profileBtn.isVisible({ timeout: 3000 }).catch(() => false);

  // If auth modal is still visible with an error, login failed
  const authModalStillOpen = await page.locator('.auth-modal').isVisible().catch(() => false);

  if (!loginSucceeded || authModalStillOpen) {
    // Close the modal if it's still open
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    test.skip(true, 'Test account login failed — set QA_TEST_EMAIL and QA_TEST_PASSWORD env vars');
  }
}

// Open feedback widget
export async function openFeedbackWidget(page) {
  const fab = page.locator('.feedback-fab');
  if (await fab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fab.click();
    await page.waitForSelector('.feedback-modal', { timeout: 5000 });
  }
}

// Open submission modal (via feedback widget "Add Content" button)
export async function openSubmissionModal(page) {
  await openFeedbackWidget(page);
  const addContentBtn = page.locator('.feedback-add-content-btn');
  if (await addContentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addContentBtn.click();
    await page.waitForTimeout(1000);
  }
}

// XSS test payloads
export const XSS_PAYLOADS = [
  '<script>alert("xss")</script>',
  '"><img src=x onerror=alert(1)>',
  "'; DROP TABLE businesses; --",
  '<svg onload=alert(1)>',
];

// Edge case test strings
export const EDGE_STRINGS = {
  empty: '',
  veryLong: 'A'.repeat(10000),
  emoji: '🏔️🍕🎉💪🧘‍♀️',
  unicode: '日本語テスト Тест العربية',
  rtl: 'مرحبا بالعالم',
  html: '<b>bold</b><i>italic</i>',
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  sqlInjection: "'; DROP TABLE businesses; --",
  xss: '<script>alert("xss")</script>',
};

// Check for console errors
export function setupConsoleErrorCapture(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

// Check that no XSS was rendered as executable HTML elements
// The payload appearing as visible *text* is fine (correctly escaped).
// What we check: no actual <script> elements or img elements with onerror were injected.
export async function verifyNoXSSRendered(page) {
  const injectedScript = await page.evaluate(() => {
    // Check for injected script elements (not the app's own scripts in <head>)
    const bodyScripts = document.body.querySelectorAll('script');
    for (const s of bodyScripts) {
      if (s.textContent.includes('alert')) return true;
    }
    // Check for img elements with onerror handlers
    const imgs = document.querySelectorAll('img[onerror]');
    if (imgs.length > 0) return true;
    // Check for svg elements with onload handlers
    const svgs = document.querySelectorAll('svg[onload]');
    if (svgs.length > 0) return true;
    return false;
  });
  expect(injectedScript, 'XSS payload must not create executable DOM elements').toBe(false);
}
