import { test, expect } from '@playwright/test';

const CONSUMER = {
  email: 'test-consumer@pulse-test.com',
  password: 'TestPass123',
};

const BUSINESS = {
  email: 'test-business@pulse-test.com',
  password: 'TestPass123',
};

test.describe('Auth Flows - QA Dummy Accounts', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate and wait for the app to fully load
    await page.goto('/');
    // Wait for either the sign-in button (guest) or profile button (logged in)
    await page.waitForSelector('.sign-in-btn, .profile-btn', { timeout: 15000 });
  });

  // -----------------------------------------------------------------------
  // 1. Page loads correctly
  // -----------------------------------------------------------------------
  test('1 - Page loads correctly (no blank screen, no error boundary)', async ({ page }) => {
    // Verify main header is present
    await expect(page.locator('.app-header-premium')).toBeVisible();

    // Verify navigation tabs rendered
    await expect(page.locator('text=Classes')).toBeVisible();
    await expect(page.locator('text=Events')).toBeVisible();
    await expect(page.locator('text=Deals')).toBeVisible();

    // No error boundary text
    const body = await page.textContent('body');
    expect(body).not.toContain('Something went wrong');
    expect(body).not.toContain('Error boundary');

    // Page should have meaningful content (not blank)
    const bodyLength = body.trim().length;
    expect(bodyLength).toBeGreaterThan(100);
  });

  // -----------------------------------------------------------------------
  // 2. Click sign-in button in header
  // -----------------------------------------------------------------------
  test('2 - Click sign-in button opens auth modal', async ({ page }) => {
    const signInBtn = page.locator('.sign-in-btn');
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();

    // Auth modal should appear
    await expect(page.locator('.auth-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2:has-text("Welcome Back")')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 3. Auth modal has email, password fields and Google OAuth button
  // -----------------------------------------------------------------------
  test('3 - Auth modal has email, password, and Google OAuth button', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Email field
    const emailInput = page.locator('.auth-modal input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Password field
    const passwordInput = page.locator('.auth-modal input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Google OAuth button
    const googleBtn = page.locator('.auth-btn.google');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toContainText('Continue with Google');

    // "or" divider
    await expect(page.locator('.auth-divider')).toBeVisible();

    // Submit button
    const submitBtn = page.locator('.auth-btn.email');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Sign In');
  });

  // -----------------------------------------------------------------------
  // 4. Form validation - submit empty form
  // -----------------------------------------------------------------------
  test('4 - Form validation shows errors on empty submit', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Click submit with empty fields
    await page.locator('.auth-btn.email').click();

    // Should show field-level validation errors
    const emailError = page.locator('.auth-field-error', { hasText: 'Email is required' });
    const passwordError = page.locator('.auth-field-error', { hasText: 'Password is required' });

    await expect(emailError).toBeVisible({ timeout: 3000 });
    await expect(passwordError).toBeVisible({ timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // 5. Test with wrong password
  // -----------------------------------------------------------------------
  test('5 - Wrong password shows error message', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Fill in valid email but wrong password
    await page.locator('.auth-modal input[type="email"]').fill(CONSUMER.email);
    await page.locator('.auth-modal input[type="password"]').fill('WrongPassword999');

    // Submit
    await page.locator('.auth-btn.email').click();

    // Should show auth error (Supabase returns "Invalid login credentials")
    const authError = page.locator('.auth-error');
    await expect(authError).toBeVisible({ timeout: 10000 });

    const errorText = await authError.textContent();
    expect(errorText.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 6. Successful sign in with test-consumer account
  // -----------------------------------------------------------------------
  test('6 - Successful sign in with test-consumer@pulse-test.com', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Fill credentials
    await page.locator('.auth-modal input[type="email"]').fill(CONSUMER.email);
    await page.locator('.auth-modal input[type="password"]').fill(CONSUMER.password);

    // Submit
    await page.locator('.auth-btn.email').click();

    // Auth modal should close after successful login
    await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 15000 });

    // Sign-in button should disappear, profile button should appear
    await expect(page.locator('.sign-in-btn')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('.profile-btn')).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // 7. After sign in, verify user is logged in (profile icon appears)
  // -----------------------------------------------------------------------
  test('7 - After sign in, profile icon and menu are accessible', async ({ page }) => {
    // Sign in first
    await page.locator('.sign-in-btn').click();
    await page.locator('.auth-modal input[type="email"]').fill(CONSUMER.email);
    await page.locator('.auth-modal input[type="password"]').fill(CONSUMER.password);
    await page.locator('.auth-btn.email').click();
    await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 15000 });

    // Profile button should be visible
    const profileBtn = page.locator('.profile-btn');
    await expect(profileBtn).toBeVisible({ timeout: 5000 });

    // Profile avatar should be visible inside the profile button
    await expect(page.locator('.profile-avatar')).toBeVisible();

    // Notification and message icons should appear for logged-in users
    await expect(page.locator('.notification-btn')).toBeVisible();
    await expect(page.locator('.messages-btn')).toBeVisible();

    // Click profile button to open menu
    await profileBtn.click();
    await expect(page.locator('.profile-menu-dropdown')).toBeVisible({ timeout: 3000 });

    // Menu should show user info
    await expect(page.locator('.profile-menu-header')).toBeVisible();

    // Menu should have key items
    await expect(page.locator('.profile-menu-item:has-text("My Profile")')).toBeVisible();
    await expect(page.locator('.profile-menu-item:has-text("My Calendar")')).toBeVisible();
    await expect(page.locator('.profile-menu-item:has-text("Saved Items")')).toBeVisible();
    await expect(page.locator('.profile-menu-item.logout:has-text("Sign Out")')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 8. Sign out
  // -----------------------------------------------------------------------
  test('8 - Sign out returns user to guest state', async ({ page }) => {
    // Sign in first
    await page.locator('.sign-in-btn').click();
    await page.locator('.auth-modal input[type="email"]').fill(CONSUMER.email);
    await page.locator('.auth-modal input[type="password"]').fill(CONSUMER.password);
    await page.locator('.auth-btn.email').click();
    await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('.profile-btn')).toBeVisible({ timeout: 5000 });

    // Open profile menu
    await page.locator('.profile-btn').click();
    await expect(page.locator('.profile-menu-dropdown')).toBeVisible({ timeout: 3000 });

    // Click Sign Out
    await page.locator('.profile-menu-item.logout').click();

    // Should return to guest state - sign-in button reappears
    await expect(page.locator('.sign-in-btn')).toBeVisible({ timeout: 10000 });

    // Profile button should be gone
    await expect(page.locator('.profile-btn')).not.toBeVisible();

    // Notification and message buttons should be gone
    await expect(page.locator('.notification-btn')).not.toBeVisible();
    await expect(page.locator('.messages-btn')).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 9. Sign up flow - switching to signup mode
  // -----------------------------------------------------------------------
  test('9 - Sign up flow - can switch to signup mode and see name field', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Initially in sign-in mode
    await expect(page.locator('h2:has-text("Welcome Back")')).toBeVisible();

    // Check "Don't have an account? Sign Up" link
    const signUpLink = page.locator('.auth-switch button:has-text("Sign Up")');
    await expect(signUpLink).toBeVisible();

    // Click to switch to sign up
    await signUpLink.click();

    // Should now show "Create Account"
    await expect(page.locator('h2:has-text("Create Account")')).toBeVisible();

    // Name field should appear in sign up mode
    const nameInput = page.locator('.auth-modal input[type="text"][placeholder="Your name"]');
    await expect(nameInput).toBeVisible();

    // Email and password still present
    await expect(page.locator('.auth-modal input[type="email"]')).toBeVisible();
    await expect(page.locator('.auth-modal input[type="password"]')).toBeVisible();

    // Submit button should say "Create Account"
    await expect(page.locator('.auth-btn.email')).toContainText('Create Account');

    // Sign up form validation - empty submit should show name error too
    await page.locator('.auth-btn.email').click();
    await expect(page.locator('.auth-field-error:has-text("Name is required")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.auth-field-error:has-text("Email is required")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.auth-field-error:has-text("Password is required")')).toBeVisible({ timeout: 3000 });

    // Can switch back to sign in
    const signInLink = page.locator('.auth-switch button:has-text("Sign In")');
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await expect(page.locator('h2:has-text("Welcome Back")')).toBeVisible();

    // Name field should be hidden again
    await expect(nameInput).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Bonus: Test business account sign in
  // -----------------------------------------------------------------------
  test('10 - Successful sign in with test-business@pulse-test.com', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Fill business credentials
    await page.locator('.auth-modal input[type="email"]').fill(BUSINESS.email);
    await page.locator('.auth-modal input[type="password"]').fill(BUSINESS.password);

    // Submit
    await page.locator('.auth-btn.email').click();

    // Auth modal should close
    await expect(page.locator('.auth-modal')).not.toBeVisible({ timeout: 15000 });

    // Should be logged in
    await expect(page.locator('.sign-in-btn')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('.profile-btn')).toBeVisible({ timeout: 5000 });
  });

  // -----------------------------------------------------------------------
  // Bonus: Email validation (invalid format)
  // -----------------------------------------------------------------------
  test('11 - Email validation catches invalid format', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Enter invalid email
    await page.locator('.auth-modal input[type="email"]').fill('not-an-email');
    await page.locator('.auth-modal input[type="password"]').fill('somepassword');

    // Submit
    await page.locator('.auth-btn.email').click();

    // Should show email validation error
    const emailError = page.locator('.auth-field-error:has-text("valid email")');
    await expect(emailError).toBeVisible({ timeout: 3000 });
  });

  // -----------------------------------------------------------------------
  // Bonus: Password too short validation
  // -----------------------------------------------------------------------
  test('12 - Password validation catches short password', async ({ page }) => {
    await page.locator('.sign-in-btn').click();
    await expect(page.locator('.auth-modal')).toBeVisible();

    // Enter valid email but short password
    await page.locator('.auth-modal input[type="email"]').fill('test@example.com');
    await page.locator('.auth-modal input[type="password"]').fill('ab');

    // Submit
    await page.locator('.auth-btn.email').click();

    // Should show password length error
    const pwError = page.locator('.auth-field-error:has-text("at least 6 characters")');
    await expect(pwError).toBeVisible({ timeout: 3000 });
  });

});
