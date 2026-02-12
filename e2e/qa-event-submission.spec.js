import { test, expect } from '@playwright/test';

/**
 * QA TEST: Event/Class/Deal Submission Flow
 *
 * Tests the complete submission flow for events, classes, and deals.
 * Signs in as test-business@pulse-test.com via Supabase auth API,
 * then exercises the submission modal through all steps and types.
 */

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I4QhFf1o4-l5Q61Hl9I99w_gJEpuREo';
const TEST_EMAIL = 'test-business@pulse-test.com';
const TEST_PASSWORD = 'TestPass123';

/**
 * Helper: Sign in via Supabase Auth API and inject session into browser
 */
async function signInAndSetSession(page) {
  // Sign in via Supabase REST API
  const response = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    }
  );

  expect(response.ok(), `Supabase auth failed: ${response.status()}`).toBeTruthy();
  const session = await response.json();
  expect(session.access_token).toBeTruthy();

  // Navigate to app first
  await page.goto('/');

  // Inject the Supabase session into localStorage so the app picks it up
  const storageKey = `sb-ygpfklhjwwqwrfpsfhue-auth-token`;
  await page.evaluate(({ key, sessionData }) => {
    const storageValue = {
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + sessionData.expires_in,
      expires_in: sessionData.expires_in,
      token_type: 'bearer',
      user: sessionData.user,
    };
    localStorage.setItem(key, JSON.stringify(storageValue));
  }, { key: storageKey, sessionData: session });

  // Reload the page so the app reads the session from localStorage
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Wait for app to finish loading
  await page.waitForTimeout(2000);
}

/**
 * Helper: Open submission modal via the profile menu
 */
async function openSubmissionModal(page) {
  // Click profile button to open menu
  const profileBtn = page.locator('.profile-btn').first();
  await expect(profileBtn).toBeVisible({ timeout: 10000 });
  await profileBtn.click();

  // Wait for profile menu to appear
  await page.waitForTimeout(500);

  // Click "Add Event / Class / Deal" in the profile menu
  const addBtn = page.locator('.profile-menu-item:has-text("Add Event")');
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();

  // Wait for submission modal to appear (Step 1)
  await expect(page.locator('.submission-modal')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper: Get tomorrow's date as YYYY-MM-DD
 */
function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ============================================================
// TEST SUITE
// ============================================================

test.describe('Event/Class/Deal Submission Flow', () => {
  test.setTimeout(120000); // 2 minutes per test for auth + interactions

  test.beforeEach(async ({ page }) => {
    await signInAndSetSession(page);
  });

  // ----------------------------------------------------------
  // 1. OPEN SUBMISSION MODAL & VERIFY TYPE SELECTION (STEP 1)
  // ----------------------------------------------------------
  test('1. Opens submission modal and verifies Step 1 type selection', async ({ page }) => {
    await openSubmissionModal(page);

    // Verify header
    await expect(page.locator('.submission-modal h1:has-text("Add to Pulse")')).toBeVisible();
    await expect(page.locator('.submission-modal p:has-text("Share something with the Squamish community")')).toBeVisible();

    // Verify step title
    await expect(page.locator('.step-title:has-text("What would you like to add?")')).toBeVisible();

    // Verify all three type options are present
    await expect(page.locator('.type-card.event h4:has-text("Event")')).toBeVisible();
    await expect(page.locator('.type-card.class h4:has-text("Class")')).toBeVisible();
    await expect(page.locator('.type-card.deal h4:has-text("Deal")')).toBeVisible();

    // Verify descriptions
    await expect(page.locator('.type-card.event p:has-text("One-time or recurring community events")')).toBeVisible();
    await expect(page.locator('.type-card.class p:has-text("Fitness, art, music, or educational classes")')).toBeVisible();
    await expect(page.locator('.type-card.deal p:has-text("Special offers and promotions")')).toBeVisible();

    console.log('PASS: Step 1 type selection displays correctly with Event, Class, Deal options');
  });

  // ----------------------------------------------------------
  // 2. SELECT EVENT TYPE - VERIFY STEP 2 FORM APPEARS
  // ----------------------------------------------------------
  test('2. Clicking Event shows Step 2 form with correct fields', async ({ page }) => {
    await openSubmissionModal(page);

    // Click "Event"
    await page.locator('.type-card.event').click();

    // Should now be on step 2
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.submission-modal p:has-text("Fill in the details")')).toBeVisible();

    // Verify business selector section
    await expect(page.locator('label:has-text("Who is hosting this?")')).toBeVisible();

    // Verify "New Business / Organization" option
    await expect(page.locator('.business-option-name:has-text("New Business / Organization")')).toBeVisible();

    // Verify "Community Member" option
    await expect(page.locator('.business-option-name:has-text("Community Member")')).toBeVisible();

    // Verify title field (labeled "Event Title" for events)
    await expect(page.locator('label:has-text("Event Title")')).toBeVisible();

    // Verify description field
    await expect(page.locator('label:has-text("Description")')).toBeVisible();

    // Verify date/time fields
    await expect(page.locator('label:has-text("Date")')).toBeVisible();
    await expect(page.locator('label:has-text("Start Time")')).toBeVisible();
    await expect(page.locator('label:has-text("End Time")')).toBeVisible();

    // Verify recurrence dropdown
    await expect(page.locator('label:has-text("Recurrence")')).toBeVisible();

    // Verify price field
    await expect(page.locator('label:has-text("Price")')).toBeVisible();

    // Verify age group dropdown
    await expect(page.locator('label:has-text("Age Group")')).toBeVisible();

    // Verify category dropdown
    await expect(page.locator('label:has-text("Category")')).toBeVisible();

    // Verify Submit button exists
    await expect(page.locator('.btn-submit:has-text("Submit for Review")')).toBeVisible();

    // Verify Back button exists
    await expect(page.locator('.btn-back:has-text("Back")')).toBeVisible();

    console.log('PASS: Step 2 Event form shows all expected fields');
  });

  // ----------------------------------------------------------
  // 3. TEST BUSINESS SELECTOR OPTIONS
  // ----------------------------------------------------------
  test('3. Business selector - New Business and Community Member options work', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Click "New Business / Organization"
    await page.locator('.business-option:has-text("New Business / Organization")').click();
    await page.waitForTimeout(300);

    // Should show business name and address fields
    await expect(page.locator('label:has-text("Business / Organization Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Business Address")')).toBeVisible();

    // Verify the option is visually selected (has 'selected' class)
    await expect(page.locator('.business-option:has-text("New Business / Organization")')).toHaveClass(/selected/);

    // Click "Community Member"
    await page.locator('.business-option:has-text("Community Member")').click();
    await page.waitForTimeout(300);

    // Business name/address fields should disappear
    await expect(page.locator('label:has-text("Business / Organization Name")')).not.toBeVisible();

    // Community Member option should now be selected
    await expect(page.locator('.business-option:has-text("Community Member")')).toHaveClass(/selected/);

    console.log('PASS: Business selector options (New Business, Community Member) work correctly');
  });

  // ----------------------------------------------------------
  // 4. FILL EVENT FORM AND SUBMIT SUCCESSFULLY
  // ----------------------------------------------------------
  test('4. Fill all Event fields and submit successfully', async ({ page }) => {
    // Capture console errors for diagnostics
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Intercept the Supabase pending_items insert to mock a successful response
    // This avoids depending on Supabase RLS policies and rate-limit RPC
    await page.route('**/rest/v1/rpc/check_and_record_rate_limit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ allowed: true, retry_after_seconds: 0 }),
      });
    });

    await page.route('**/rest/v1/pending_items**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-' + Date.now(),
            item_type: body.item_type,
            status: 'pending',
            data: body.data,
            created_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Select "Community Member" as host
    await page.locator('.business-option:has-text("Community Member")').click();
    await page.waitForTimeout(300);

    // Fill title
    await page.locator('.submission-form input[placeholder*="Live Music Night"]').fill('Test Community Event');

    // Fill description
    await page.locator('.submission-form textarea[placeholder*="Tell people what to expect"]').fill('This is a test event for QA');

    // Fill date (tomorrow)
    const tomorrow = getTomorrowDate();
    await page.locator('.submission-form input[type="date"]').fill(tomorrow);

    // Fill start time
    await page.locator('.submission-form input[type="time"]').first().fill('18:00');

    // Fill end time
    await page.locator('.submission-form input[type="time"]').last().fill('20:00');

    // Select recurrence: One-time event (default)
    const recurrenceSelect = page.locator('.submission-form select').first();
    await recurrenceSelect.selectOption('none');

    // Fill price
    await page.locator('.submission-form input[placeholder*="$25 or Free"]').fill('Free');

    // Select age group
    const ageGroupSelect = page.locator('.form-group:has(label:has-text("Age Group")) select');
    await ageGroupSelect.selectOption('');

    // Select category
    const categorySelect = page.locator('.form-group:has(label:has-text("Category")) select');
    await categorySelect.selectOption('Community');

    // Verify submit button is enabled (all required fields filled)
    const submitBtn = page.locator('.btn-submit:has-text("Submit for Review")');
    await expect(submitBtn).toBeEnabled();

    // Click submit
    await submitBtn.click();

    // Wait for success step (Step 3)
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2:has-text("Submitted for Review!")')).toBeVisible();

    // Verify success details
    await expect(page.getByText('Event', { exact: true })).toBeVisible();
    await expect(page.getByText('Test Community Event')).toBeVisible();

    // Verify "Done" button
    await expect(page.locator('.btn-done:has-text("Done")')).toBeVisible();

    // Click Done
    await page.locator('.btn-done:has-text("Done")').click();

    // Modal should close
    await expect(page.locator('.submission-modal')).not.toBeVisible({ timeout: 3000 });

    // Report any console errors
    if (consoleErrors.length > 0) {
      console.log('Console errors during test:', consoleErrors.join('\n'));
    }

    console.log('PASS: Event submission completed successfully with Step 3 confirmation');
  });

  // ----------------------------------------------------------
  // 5. SUBMIT A CLASS
  // ----------------------------------------------------------
  test('5. Submit a Class type successfully', async ({ page }) => {
    // Mock Supabase endpoints to avoid RLS/rate-limit issues
    await page.route('**/rest/v1/rpc/check_and_record_rate_limit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ allowed: true, retry_after_seconds: 0 }),
      });
    });

    await page.route('**/rest/v1/pending_items**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-class-' + Date.now(),
            item_type: body.item_type,
            status: 'pending',
            data: body.data,
            created_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await openSubmissionModal(page);

    // Select "Class"
    await page.locator('.type-card.class').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Class")')).toBeVisible({ timeout: 5000 });

    // Verify class-specific label
    await expect(page.locator('label:has-text("Class Name")')).toBeVisible();

    // Select Community Member
    await page.locator('.business-option:has-text("Community Member")').click();
    await page.waitForTimeout(300);

    // Fill class name
    await page.locator('.submission-form input[placeholder*="Hot Yoga Flow"]').fill('Test QA Fitness Class');

    // Fill description
    await page.locator('.submission-form textarea[placeholder*="Tell people what to expect"]').fill('A test fitness class for QA testing');

    // Fill date
    const tomorrow = getTomorrowDate();
    await page.locator('.submission-form input[type="date"]').fill(tomorrow);

    // Fill start/end time
    await page.locator('.submission-form input[type="time"]').first().fill('09:00');
    await page.locator('.submission-form input[type="time"]').last().fill('10:00');

    // Select recurrence: weekly
    const recurrenceSelect = page.locator('.form-group:has(label:has-text("Recurrence")) select');
    await recurrenceSelect.selectOption('weekly');

    // Fill price
    await page.locator('.submission-form input[placeholder*="$25 or Free"]').fill('$25');

    // Select age group
    const ageGroupSelect = page.locator('.form-group:has(label:has-text("Age Group")) select');
    await ageGroupSelect.selectOption('Adults (18+)');

    // Select category
    const categorySelect = page.locator('.form-group:has(label:has-text("Category")) select');
    await categorySelect.selectOption('Fitness');

    // Submit
    const submitBtn = page.locator('.btn-submit:has-text("Submit for Review")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify success
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2:has-text("Submitted for Review!")')).toBeVisible();
    await expect(page.locator('.detail-row').filter({ hasText: 'Type:' }).locator('.value')).toHaveText('Class');
    await expect(page.getByText('Test QA Fitness Class')).toBeVisible();

    console.log('PASS: Class submission completed successfully');
  });

  // ----------------------------------------------------------
  // 6. SUBMIT A DEAL
  // ----------------------------------------------------------
  test('6. Submit a Deal type successfully', async ({ page }) => {
    // Mock Supabase endpoints to avoid RLS/rate-limit issues
    await page.route('**/rest/v1/rpc/check_and_record_rate_limit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ allowed: true, retry_after_seconds: 0 }),
      });
    });

    await page.route('**/rest/v1/pending_items**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-deal-' + Date.now(),
            item_type: body.item_type,
            status: 'pending',
            data: body.data,
            created_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await openSubmissionModal(page);

    // Select "Deal"
    await page.locator('.type-card.deal').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Deal")')).toBeVisible({ timeout: 5000 });

    // Verify deal-specific label
    await expect(page.locator('label:has-text("Deal Title")')).toBeVisible();

    // Verify deal-specific fields
    await expect(page.locator('label:has-text("Discount Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Schedule / Availability")')).toBeVisible();

    // Select "New Business / Organization"
    await page.locator('.business-option:has-text("New Business / Organization")').click();
    await page.waitForTimeout(300);

    // Fill business name
    await page.locator('.submission-form input[placeholder*="Breathe Fitness Studio"]').fill('Test QA Business');

    // Fill business address
    await page.locator('.submission-form input[placeholder*="1234 Main St"]').fill('123 Test St, Squamish');

    // Fill deal title
    await page.locator('.submission-form input[placeholder*="Happy Hour"]').fill('Test QA Deal 50% Off');

    // Fill description
    await page.locator('.submission-form textarea[placeholder*="Tell people what to expect"]').fill('A test deal for QA testing purposes');

    // Select discount type (default is percentage)
    const discountTypeSelect = page.locator('.form-group:has(label:has-text("Discount Type")) select');
    await discountTypeSelect.selectOption('percent');

    // Fill discount percentage
    const discountInput = page.locator('.form-group:has(label:has-text("Discount Percentage")) input');
    await discountInput.fill('50');

    // Fill original price
    const origPrice = page.locator('.form-group:has(label:has-text("Original Price")) input');
    await origPrice.fill('40.00');

    // Fill deal price
    const dealPrice = page.locator('.form-group:has(label:has-text("Deal Price")) input');
    await dealPrice.fill('20.00');

    // Fill valid until date
    const validUntil = page.locator('.form-group:has(label:has-text("Valid Until")) input');
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    await validUntil.fill(nextMonth.toISOString().split('T')[0]);

    // Fill schedule
    await page.locator('.submission-form input[placeholder*="Mon-Fri 3-6pm"]').fill('Mon-Fri 3-6pm');

    // Fill terms
    await page.locator('.submission-form textarea[placeholder*="Cannot be combined"]').fill('Cannot be combined with other offers. QA test terms.');

    // Submit
    const submitBtn = page.locator('.btn-submit:has-text("Submit for Review")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Verify success
    await expect(page.locator('.submission-success')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2:has-text("Submitted for Review!")')).toBeVisible();
    await expect(page.locator('.detail-row').filter({ hasText: 'Type:' }).locator('.value')).toHaveText('Deal');
    await expect(page.getByText('Test QA Deal 50% Off')).toBeVisible();

    console.log('PASS: Deal submission completed successfully');
  });

  // ----------------------------------------------------------
  // 7. FORM VALIDATION - SUBMIT WITHOUT REQUIRED FIELDS
  // ----------------------------------------------------------
  test('7. Submit button is disabled when required fields are empty', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Without selecting business type or filling any fields, submit should be disabled
    const submitBtn = page.locator('.btn-submit:has-text("Submit for Review")');
    await expect(submitBtn).toBeDisabled();

    console.log('PASS (check 1/5): Submit disabled with no fields filled');

    // Fill only title - still disabled (no business type, no description)
    await page.locator('.submission-form input[placeholder*="Live Music Night"]').fill('Only Title');
    await expect(submitBtn).toBeDisabled();

    console.log('PASS (check 2/5): Submit disabled with only title filled');

    // Add description - still disabled (no business type)
    await page.locator('.submission-form textarea[placeholder*="Tell people what to expect"]').fill('Some description');
    await expect(submitBtn).toBeDisabled();

    console.log('PASS (check 3/5): Submit disabled with title + description but no business type');

    // Select business type - now should be enabled
    await page.locator('.business-option:has-text("Community Member")').click();
    await page.waitForTimeout(300);
    await expect(submitBtn).toBeEnabled();

    console.log('PASS (check 4/5): Submit enabled with title + description + business type');

    // Test "New Business" validation - requires business name
    await page.locator('.business-option:has-text("New Business / Organization")').click();
    await page.waitForTimeout(300);

    // Should be disabled because business name is empty
    await expect(submitBtn).toBeDisabled();

    console.log('PASS (check 5/5): Submit disabled when New Business selected but name is empty');

    // Fill business name - should become enabled
    await page.locator('.submission-form input[placeholder*="Breathe Fitness Studio"]').fill('My Test Business');
    await expect(submitBtn).toBeEnabled();

    console.log('PASS: All form validation checks passed');
  });

  // ----------------------------------------------------------
  // 8. BACK BUTTON NAVIGATION
  // ----------------------------------------------------------
  test('8. Back button returns to Step 1 type selection', async ({ page }) => {
    await openSubmissionModal(page);

    // Go to Step 2 (Event)
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Click Back
    await page.locator('.btn-back:has-text("Back")').click();

    // Should be back on Step 1
    await expect(page.locator('.step-title:has-text("What would you like to add?")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.type-card.event h4:has-text("Event")')).toBeVisible();
    await expect(page.locator('.type-card.class h4:has-text("Class")')).toBeVisible();
    await expect(page.locator('.type-card.deal h4:has-text("Deal")')).toBeVisible();

    console.log('PASS: Back button returns to Step 1 type selection');
  });

  // ----------------------------------------------------------
  // 9. CLOSE BUTTON DISMISSES MODAL
  // ----------------------------------------------------------
  test('9. Close button dismisses the submission modal', async ({ page }) => {
    await openSubmissionModal(page);

    // Verify modal is visible
    await expect(page.locator('.submission-modal')).toBeVisible();

    // Click close button (X)
    await page.locator('.submission-close').click();

    // Modal should be gone
    await expect(page.locator('.submission-modal')).not.toBeVisible({ timeout: 3000 });

    console.log('PASS: Close button (X) dismisses the submission modal');
  });

  // ----------------------------------------------------------
  // 10. OVERLAY CLICK DISMISSES MODAL
  // ----------------------------------------------------------
  test('10. Clicking overlay dismisses the submission modal', async ({ page }) => {
    await openSubmissionModal(page);

    await expect(page.locator('.submission-modal')).toBeVisible();

    // Click the overlay (outside the modal panel)
    await page.locator('.submission-modal-overlay').click({ position: { x: 5, y: 5 } });

    // Modal should be gone
    await expect(page.locator('.submission-modal')).not.toBeVisible({ timeout: 3000 });

    console.log('PASS: Overlay click dismisses the submission modal');
  });

  // ----------------------------------------------------------
  // 11. SUBMISSION NOTICE TEXT
  // ----------------------------------------------------------
  test('11. Submission notice about review is visible on Step 2', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Verify the review notice
    await expect(
      page.locator('.submission-notice:has-text("All submissions are reviewed by our team")')
    ).toBeVisible();

    console.log('PASS: Submission review notice is displayed on Step 2');
  });

  // ----------------------------------------------------------
  // 12. DEAL DISCOUNT TYPE CHANGES FIELDS
  // ----------------------------------------------------------
  test('12. Deal discount type changes conditional fields', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.deal').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Deal")')).toBeVisible({ timeout: 5000 });

    // Default is "percent" - should show percentage input
    await expect(page.locator('label:has-text("Discount Percentage")')).toBeVisible();

    // Switch to "fixed" - should show dollar amount input
    const discountTypeSelect = page.locator('.form-group:has(label:has-text("Discount Type")) select');
    await discountTypeSelect.selectOption('fixed');
    await expect(page.locator('label:has-text("Discount Amount ($)")')).toBeVisible();

    // Switch to "bogo" - percentage/dollar input should disappear
    await discountTypeSelect.selectOption('bogo');
    await expect(page.locator('label:has-text("Discount Percentage")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Discount Amount ($)")')).not.toBeVisible();

    // Switch to "free_item"
    await discountTypeSelect.selectOption('free_item');
    await expect(page.locator('label:has-text("Discount Percentage")')).not.toBeVisible();

    // Switch to "special"
    await discountTypeSelect.selectOption('special');
    await expect(page.locator('label:has-text("Discount Percentage")')).not.toBeVisible();

    console.log('PASS: Deal discount type correctly shows/hides conditional fields');
  });

  // ----------------------------------------------------------
  // 13. EVENT FORM - DATE/TIME FIELDS ACCEPT INPUT
  // ----------------------------------------------------------
  test('13. Date and time fields accept and retain input values', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    const tomorrow = getTomorrowDate();

    // Fill date
    const dateInput = page.locator('.submission-form input[type="date"]');
    await dateInput.fill(tomorrow);
    await expect(dateInput).toHaveValue(tomorrow);

    // Fill start time
    const startTime = page.locator('.submission-form input[type="time"]').first();
    await startTime.fill('14:30');
    await expect(startTime).toHaveValue('14:30');

    // Fill end time
    const endTime = page.locator('.submission-form input[type="time"]').last();
    await endTime.fill('16:45');
    await expect(endTime).toHaveValue('16:45');

    console.log('PASS: Date and time fields accept and retain input values');
  });

  // ----------------------------------------------------------
  // 14. RECURRENCE DROPDOWN HAS ALL OPTIONS
  // ----------------------------------------------------------
  test('14. Recurrence dropdown has all expected options', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    const recurrenceSelect = page.locator('.form-group:has(label:has-text("Recurrence")) select');

    // Verify all options
    await expect(recurrenceSelect.locator('option[value="none"]')).toHaveText('One-time event');
    await expect(recurrenceSelect.locator('option[value="daily"]')).toHaveText('Daily');
    await expect(recurrenceSelect.locator('option[value="weekly"]')).toHaveText('Weekly');
    await expect(recurrenceSelect.locator('option[value="monthly"]')).toHaveText('Monthly');

    // Default should be "none" (One-time event)
    await expect(recurrenceSelect).toHaveValue('none');

    console.log('PASS: Recurrence dropdown has all expected options (One-time, Daily, Weekly, Monthly)');
  });

  // ----------------------------------------------------------
  // 15. AGE GROUP DROPDOWN HAS ALL OPTIONS
  // ----------------------------------------------------------
  test('15. Age group dropdown has all expected options', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    const ageGroupSelect = page.locator('.form-group:has(label:has-text("Age Group")) select');

    await expect(ageGroupSelect.locator('option[value=""]')).toHaveText('All Ages');
    await expect(ageGroupSelect.locator('option[value="Kids (0-12)"]')).toHaveText('Kids (0-12)');
    await expect(ageGroupSelect.locator('option[value="Teens (13-17)"]')).toHaveText('Teens (13-17)');
    await expect(ageGroupSelect.locator('option[value="Adults (18+)"]')).toHaveText('Adults (18+)');
    await expect(ageGroupSelect.locator('option[value="Seniors (65+)"]')).toHaveText('Seniors (65+)');

    console.log('PASS: Age group dropdown has all expected options');
  });

  // ----------------------------------------------------------
  // 16. CATEGORY DROPDOWN HAS ALL OPTIONS
  // ----------------------------------------------------------
  test('16. Category dropdown has all expected options', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    const categorySelect = page.locator('.form-group:has(label:has-text("Category")) select');

    const expectedCategories = [
      'Music', 'Fitness', 'Arts', 'Community', 'Wellness',
      'Outdoors & Nature', 'Food & Drink', 'Family', 'Nightlife'
    ];

    for (const cat of expectedCategories) {
      await expect(categorySelect.locator(`option:has-text("${cat}")`)).toBeAttached();
    }

    // Also verify the placeholder option
    await expect(categorySelect.locator('option:has-text("Select category...")')).toBeAttached();

    console.log('PASS: Category dropdown has all 9 expected categories');
  });

  // ----------------------------------------------------------
  // 17. DEAL-SPECIFIC FIELDS NOT VISIBLE FOR EVENTS/CLASSES
  // ----------------------------------------------------------
  test('17. Deal-specific fields do not appear for Event type', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Deal-specific fields should NOT be visible
    await expect(page.locator('label:has-text("Discount Type")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Original Price")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Deal Price")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Valid Until")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Schedule / Availability")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Terms & Conditions")')).not.toBeVisible();

    console.log('PASS: Deal-specific fields are not shown for Event type');
  });

  // ----------------------------------------------------------
  // 18. EVENT/CLASS FIELDS NOT VISIBLE FOR DEALS
  // ----------------------------------------------------------
  test('18. Event/Class date-time fields do not appear for Deal type', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.deal').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Deal")')).toBeVisible({ timeout: 5000 });

    // Event/class-specific fields should NOT be visible
    await expect(page.locator('.form-group:has(label:text-is("Date *"))')).not.toBeVisible();
    await expect(page.locator('label:has-text("Start Time")')).not.toBeVisible();
    await expect(page.locator('label:has-text("End Time")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Recurrence")')).not.toBeVisible();
    await expect(page.locator('label:has-text("Age Group")')).not.toBeVisible();

    console.log('PASS: Event/Class date-time fields are not shown for Deal type');
  });

  // ----------------------------------------------------------
  // 19. IMAGE UPLOAD SECTION EXISTS
  // ----------------------------------------------------------
  test('19. Image upload section shows square and banner upload areas', async ({ page }) => {
    await openSubmissionModal(page);
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Verify image upload section
    await expect(page.locator('label:has-text("Images")')).toBeVisible();
    await expect(page.locator('.image-upload-card.square')).toBeVisible();
    await expect(page.locator('.image-upload-card.banner')).toBeVisible();
    await expect(page.locator('.image-ratio:has-text("1:1")')).toBeVisible();
    await expect(page.locator('.image-ratio:has-text("3:1")')).toBeVisible();

    console.log('PASS: Image upload section with square (1:1) and banner (3:1) areas exists');
  });

  // ----------------------------------------------------------
  // 20. SWITCHING TYPE AFTER BACK BUTTON
  // ----------------------------------------------------------
  test('20. Can switch between types after going back', async ({ page }) => {
    await openSubmissionModal(page);

    // First go to Event
    await page.locator('.type-card.event').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Event")')).toBeVisible({ timeout: 5000 });

    // Go back
    await page.locator('.btn-back:has-text("Back")').click();
    await expect(page.locator('.step-title:has-text("What would you like to add?")')).toBeVisible({ timeout: 3000 });

    // Now go to Class
    await page.locator('.type-card.class').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Class")')).toBeVisible({ timeout: 5000 });

    // Go back again
    await page.locator('.btn-back:has-text("Back")').click();
    await expect(page.locator('.step-title:has-text("What would you like to add?")')).toBeVisible({ timeout: 3000 });

    // Now go to Deal
    await page.locator('.type-card.deal').click();
    await expect(page.locator('.submission-modal h1:has-text("Add Deal")')).toBeVisible({ timeout: 5000 });

    console.log('PASS: Can navigate back and switch between all three types');
  });
});
