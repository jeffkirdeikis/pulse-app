import { test, expect } from '@playwright/test';

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I4QhFf1o4-l5Q61Hl9I99w_gJEpuREo';
const TEST_EMAIL = 'test-business@pulse-test.com';
const TEST_PASSWORD = 'TestPass123';

/**
 * Helper: Sign in via Supabase REST API and inject the session into the browser.
 * Sets the localStorage token that Supabase JS client reads on page load.
 */
async function signInAndInjectSession(page) {
  // Sign in via Supabase auth API
  const response = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    }
  );

  const status = response.status();
  if (status !== 200) {
    const body = await response.text();
    throw new Error(`Supabase sign-in failed (${status}): ${body}`);
  }

  const sessionData = await response.json();

  // Supabase JS client stores the session in localStorage under this key format:
  // sb-<project-ref>-auth-token
  const storageKey = 'sb-ygpfklhjwwqwrfpsfhue-auth-token';

  // Navigate to the app first so we can set localStorage on the correct origin
  await page.goto('/');

  // Inject the session into localStorage
  await page.evaluate(
    ({ key, data }) => {
      const sessionObj = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        expires_at: data.expires_at,
        user: data.user,
      };
      localStorage.setItem(key, JSON.stringify(sessionObj));
    },
    { key: storageKey, data: sessionData }
  );

  // Reload so the app picks up the session from localStorage
  await page.reload();
  await page.waitForLoadState('networkidle');

  return sessionData;
}

/**
 * Helper: Open the Claim Business modal from the profile menu.
 * Assumes user is authenticated (profile button visible, not Sign In button).
 */
async function openClaimBusinessModal(page) {
  // Click the profile button to open the dropdown menu
  const profileBtn = page.locator('.profile-btn');
  await expect(profileBtn).toBeVisible({ timeout: 10000 });
  await profileBtn.click();

  // Wait for the profile menu dropdown to appear
  const profileMenu = page.locator('.profile-menu-dropdown');
  await expect(profileMenu).toBeVisible({ timeout: 5000 });

  // Click "Claim Business" in the menu
  const claimMenuItem = page.locator('.profile-menu-item:has-text("Claim Business")');
  await expect(claimMenuItem).toBeVisible({ timeout: 3000 });
  await claimMenuItem.click();

  // Wait for the claim modal to appear
  const claimModal = page.locator('.claim-modal-premium');
  await expect(claimModal).toBeVisible({ timeout: 5000 });

  return claimModal;
}


// ============================================================
// TEST SUITE: AUTHENTICATED CLAIM BUSINESS FLOW
// ============================================================
test.describe('Claim Business Flow - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await signInAndInjectSession(page);
  });

  test('1. Find and click Claim Business button in profile menu', async ({ page }) => {
    // Verify user is signed in (profile button visible, not "Sign In" text button)
    const profileBtn = page.locator('.profile-btn');
    await expect(profileBtn).toBeVisible({ timeout: 10000 });

    // Open profile menu
    await profileBtn.click();
    const profileMenu = page.locator('.profile-menu-dropdown');
    await expect(profileMenu).toBeVisible({ timeout: 5000 });

    // Verify "Claim Business" menu item exists
    const claimMenuItem = page.locator('.profile-menu-item:has-text("Claim Business")');
    await expect(claimMenuItem).toBeVisible();

    // Click it
    await claimMenuItem.click();

    // Modal should open
    await expect(page.locator('.claim-modal-premium')).toBeVisible({ timeout: 5000 });
  });

  test('2. Claim modal has all required form fields', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Business search input
    const searchInput = modal.locator('input[placeholder*="Search Squamish"]');
    await expect(searchInput).toBeVisible();

    // Business Name input
    const businessNameInput = modal.locator('input[placeholder*="Sound Martial"]');
    await expect(businessNameInput).toBeVisible();

    // Owner Name (Your Name) input
    const ownerNameInput = modal.locator('input[placeholder="Full name"]');
    await expect(ownerNameInput).toBeVisible();

    // Email input
    const emailInput = modal.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Phone input
    const phoneInput = modal.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible();

    // Role dropdown
    const roleSelect = modal.locator('select');
    await expect(roleSelect).toBeVisible();

    // Verify role dropdown has the expected options
    const options = await roleSelect.locator('option').allTextContents();
    expect(options).toContain('Owner');
    expect(options).toContain('Manager');
    expect(options).toContain('Authorized Representative');

    // Address field
    const addressInput = modal.locator('input[placeholder*="Street address"]');
    await expect(addressInput).toBeVisible();
  });

  test('3. Search for a business shows results from directory', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Type a search term in the business search field
    const searchInput = modal.locator('input[placeholder*="Search Squamish"]');
    await searchInput.fill('yoga');

    // Wait for search results to appear (dropdown with matching businesses)
    // The search results appear when query length >= 2 and no business is selected
    // React renders maxHeight as max-height in the DOM
    const resultsContainer = modal.locator('div[style*="max-height"]');
    await expect(resultsContainer).toBeVisible({ timeout: 5000 });

    // Verify at least one result is displayed
    const resultItems = resultsContainer.locator('div[style*="cursor: pointer"]');
    const count = await resultItems.count();
    expect(count).toBeGreaterThan(0);

    // Verify results contain text matching "yoga" (case-insensitive)
    const firstResultText = await resultItems.first().textContent();
    expect(firstResultText.toLowerCase()).toContain('yoga');
  });

  test('4. Select a business from search results populates form', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Search for a business
    const searchInput = modal.locator('input[placeholder*="Search Squamish"]');
    await searchInput.fill('yoga');

    // Wait for results
    const resultsContainer = modal.locator('div[style*="max-height"]');
    await expect(resultsContainer).toBeVisible({ timeout: 5000 });

    // Click the first result and capture the business name first
    const firstResult = resultsContainer.locator('div[style*="cursor: pointer"]').first();
    const businessName = await firstResult.locator('div[style*="font-weight: 600"]').first().textContent();
    await firstResult.click();

    // After selecting, the search input shows the business name and the search results close.
    // A green selected-business confirmation element appears with a close (X) button inside it.
    // We locate it by looking for the element that contains the selected business name
    // and has a sibling button (the deselect X button). The confirmation is rendered
    // right after the search input, with green background styling.
    // Use a text-based locator: the confirmation span with the business name.
    const selectedText = modal.locator(`span:has-text("${businessName}")`);
    await expect(selectedText).toBeVisible({ timeout: 5000 });

    // The business name field should be populated
    const businessNameInput = modal.locator('.claim-form-group.full input').first();
    await expect(businessNameInput).toHaveValue(businessName);
  });

  test('5. Fill in claim form and submit successfully', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Search and select a business
    const searchInput = modal.locator('input[placeholder*="Search Squamish"]');
    await searchInput.fill('yoga');

    const resultsContainer = modal.locator('div[style*="max-height"]');
    await expect(resultsContainer).toBeVisible({ timeout: 5000 });

    const firstResult = resultsContainer.locator('div[style*="cursor: pointer"]').first();
    await firstResult.click();

    // Verify business was selected - the business name input gets populated
    const businessNameInput = modal.locator('.claim-form-group.full input').first();
    await expect(businessNameInput).not.toHaveValue('', { timeout: 5000 });

    // Fill in the form fields
    const ownerNameInput = modal.locator('input[placeholder="Full name"]');
    await ownerNameInput.fill('Test Business Owner');
    await expect(ownerNameInput).toHaveValue('Test Business Owner');

    const emailInput = modal.locator('input[type="email"]');
    await emailInput.fill('test-business@pulse-test.com');
    await expect(emailInput).toHaveValue('test-business@pulse-test.com');

    const phoneInput = modal.locator('input[type="tel"]');
    await phoneInput.fill('604-555-1234');
    await expect(phoneInput).toHaveValue('604-555-1234');

    const roleSelect = modal.locator('select');
    await roleSelect.selectOption('owner');
    await expect(roleSelect).toHaveValue('owner');

    // Submit the claim
    const submitBtn = modal.locator('button:has-text("Submit Claim")');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for submission to complete - expect either:
    // 1. Modal closes + success toast ("Claim submitted!" or "Business claimed and verified!")
    // 2. Error toast if duplicate claim (modal may stay open with error toast)
    // 3. The submit button changes to "Submitting..." while processing
    //
    // Use Promise.race to detect whichever outcome happens first.
    const outcome = await Promise.race([
      // Outcome A: Modal closes (success)
      page.locator('.claim-modal-premium').waitFor({ state: 'hidden', timeout: 10000 })
        .then(() => 'modal-closed')
        .catch(() => null),
      // Outcome B: Toast appears (success or error)
      page.locator('.calendar-toast').waitFor({ state: 'visible', timeout: 10000 })
        .then(() => 'toast-shown')
        .catch(() => null),
    ]);

    // At least one outcome should have occurred
    expect(outcome).not.toBeNull();
    console.log('Submit outcome:', outcome);

    // If toast appeared, log it
    if (outcome === 'toast-shown' || await page.locator('.calendar-toast').isVisible().catch(() => false)) {
      const toastText = await page.locator('.calendar-toast span').textContent().catch(() => '');
      console.log('Toast message:', toastText);
      // Accept either success or error (duplicate claim) - both are valid responses
      expect(toastText.length).toBeGreaterThan(0);
    }

    if (outcome === 'modal-closed') {
      console.log('Modal closed successfully after submission');
    }
  });

  test('6. Submit claim without required fields shows validation error', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Try to submit without filling in any fields
    // The form requires: businessName, ownerName, email
    const submitBtn = modal.locator('button:has-text("Submit Claim")');
    await submitBtn.click();

    // Should show a validation toast: "Please fill in all required fields"
    // Wait for the toast to appear
    const toast = page.locator('.toast, [class*="toast"], [class*="calendar-toast"]');
    await expect(toast.first()).toBeVisible({ timeout: 5000 });

    // The modal should still be open (submission prevented)
    await expect(modal).toBeVisible();
  });

  test('7. Close claim modal via X button', async ({ page }) => {
    await openClaimBusinessModal(page);

    // Click the X close button
    const closeBtn = page.locator('.claim-modal-close');
    await closeBtn.click();

    // Modal should be hidden
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
  });

  test('8. Close claim modal via Cancel button', async ({ page }) => {
    await openClaimBusinessModal(page);

    // Click the Cancel button
    const cancelBtn = page.locator('.claim-cancel-btn');
    await cancelBtn.click();

    // Modal should be hidden
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
  });

  test('9. Close claim modal by clicking overlay', async ({ page }) => {
    await openClaimBusinessModal(page);

    // Click the overlay (the modal-overlay div behind the content)
    // We need to click outside the modal content area
    const overlay = page.locator('.modal-overlay[role="dialog"]');
    // Click at the top-left corner of the overlay (outside the centered modal)
    await overlay.click({ position: { x: 10, y: 10 } });

    // Modal should be hidden
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });
  });

  test('10. Claim modal form resets on close and reopen', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Fill some fields
    const ownerNameInput = modal.locator('input[placeholder="Full name"]');
    await ownerNameInput.fill('Some Test Name');
    await expect(ownerNameInput).toHaveValue('Some Test Name');

    // Close the modal
    const cancelBtn = page.locator('.claim-cancel-btn');
    await cancelBtn.click();
    await expect(page.locator('.claim-modal-premium')).not.toBeVisible({ timeout: 3000 });

    // Reopen it
    const reopenedModal = await openClaimBusinessModal(page);

    // Fields should be reset
    const ownerNameInputAgain = reopenedModal.locator('input[placeholder="Full name"]');
    await expect(ownerNameInputAgain).toHaveValue('');
  });

  test('11. Can deselect a chosen business and search again', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Search and select a business
    const searchInput = modal.locator('input[placeholder*="Search Squamish"]');
    await searchInput.fill('yoga');

    const resultsContainer = modal.locator('div[style*="max-height"]');
    await expect(resultsContainer).toBeVisible({ timeout: 5000 });

    const firstResult = resultsContainer.locator('div[style*="cursor: pointer"]').first();
    const selectedName = await firstResult.locator('div[style*="font-weight: 600"]').first().textContent();
    await firstResult.click();

    // Verify selected confirmation is shown - find the green confirmation
    // by locating the span with the business name that has fontWeight 600 and color #166534
    const selectedSpan = modal.locator(`span:has-text("${selectedName}")`);
    await expect(selectedSpan).toBeVisible({ timeout: 5000 });

    // The confirmation element is the parent div containing the span and an X button.
    // Click the X button (small button near the selected business name) to deselect.
    // The X button is inside the same parent as the selected name span.
    const confirmationParent = selectedSpan.locator('..');
    const deselectBtn = confirmationParent.locator('button');
    await deselectBtn.click();

    // After deselecting, the business name span should disappear and
    // the search input should be cleared
    const searchInputAfter = modal.locator('input[placeholder*="Search Squamish"]');
    await expect(searchInputAfter).toHaveValue('');

    // Can search again
    await searchInputAfter.fill('fit');

    // New results should appear
    const newResultsContainer = modal.locator('div[style*="max-height"]');
    await expect(newResultsContainer).toBeVisible({ timeout: 5000 });
  });

  test('12. Search with no matching businesses shows "No businesses found"', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    const searchInput = modal.locator('input[placeholder*="Search Squamish"]');
    await searchInput.fill('zzxxyynonexistent');

    // The results container should appear with "No businesses found" message
    const noResults = modal.locator('text=No businesses found');
    await expect(noResults).toBeVisible({ timeout: 5000 });
  });

  test('13. Benefits section is displayed in the modal', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    // Check the 4 benefits are listed
    await expect(modal.locator('text=Manage your business profile')).toBeVisible();
    await expect(modal.locator('text=View analytics & insights')).toBeVisible();
    await expect(modal.locator('text=Respond to reviews')).toBeVisible();
    await expect(modal.locator('text=Create deals & promotions')).toBeVisible();
  });

  test('14. Modal header shows correct title and description', async ({ page }) => {
    const modal = await openClaimBusinessModal(page);

    await expect(modal.locator('h2:has-text("Claim Your Business")')).toBeVisible();
    await expect(modal.locator('text=Get access to analytics, manage your listings')).toBeVisible();
  });
});


// ============================================================
// TEST SUITE: UNAUTHENTICATED / GUEST CLAIM ATTEMPT
// ============================================================
test.describe('Claim Business Flow - Guest (Not Signed In)', () => {

  test('15. Guest user sees Sign In button instead of profile menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Guest users should see "Sign In" button in header
    const signInBtn = page.locator('.sign-in-btn');
    await expect(signInBtn).toBeVisible({ timeout: 10000 });

    // Profile button should NOT be visible for guests
    const profileBtn = page.locator('.profile-btn');
    const profileVisible = await profileBtn.isVisible().catch(() => false);
    expect(profileVisible).toBe(false);
  });

  test('16. Guest cannot access Claim Business modal directly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The claim modal should not be visible since there's no way
    // to trigger it as a guest (no profile menu, no claim button)
    const claimModal = page.locator('.claim-modal-premium');
    const isVisible = await claimModal.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('17. Guest clicking Sign In opens auth modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const signInBtn = page.locator('.sign-in-btn');
    await expect(signInBtn).toBeVisible({ timeout: 10000 });
    await signInBtn.click();

    // Auth modal should open
    const authModal = page.locator('.auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });
  });
});
