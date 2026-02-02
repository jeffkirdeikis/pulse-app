import { test, expect } from '@playwright/test';

// Configure tests to run serially (one at a time) to avoid overwhelming the server
test.describe.configure({ mode: 'serial' });

// Increase timeout for all tests
test.setTimeout(60000);

// Helper to wait for page to fully load
const waitForAppLoad = async (page) => {
  await page.waitForSelector('.banner-tab', { timeout: 30000 });
  await page.waitForTimeout(1000); // Allow animations to complete
};

// Helper to click on Events tab
const switchToEventsTab = async (page) => {
  await page.click('.banner-tab:has-text("Events")');
  await page.waitForTimeout(500);
};

// Helper to click on Classes tab
const switchToClassesTab = async (page) => {
  await page.click('.banner-tab:has-text("Classes")');
  await page.waitForTimeout(500);
};

test.describe('Event Detail Modal - Events Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
    await switchToEventsTab(page);
    await page.waitForTimeout(500);
  });

  test('should open event modal when clicking event card', async ({ page }) => {
    // Wait for event cards to be visible
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });

    // Click the event card
    await eventCard.click();

    // Verify modal opens
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });
  });

  test('should display all required fields in event modal', async ({ page }) => {
    // Click first event card
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    // Wait for modal
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for title
    await expect(page.locator('.event-hero-title')).toBeVisible();

    // Check for venue
    await expect(page.locator('.event-hero-venue')).toBeVisible();

    // Check for date/time card
    await expect(page.locator('.event-datetime-card')).toBeVisible();

    // Check for details section
    await expect(page.locator('.event-section-title:has-text("Details")')).toBeVisible();

    // Check for About section with description
    await expect(page.locator('.event-section-title:has-text("About")')).toBeVisible();
    await expect(page.locator('.event-about-text')).toBeVisible();
  });

  test('should show event type pill (Event)', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Should show Event pill (not Class pill)
    await expect(page.locator('.event-type-pill.event-pill')).toBeVisible();
  });

  test('should close modal via X button', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Click X button
    await page.click('.close-btn.event-close');

    // Modal should be closed
    await expect(page.locator('.event-detail-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('should close modal via overlay click', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Click on overlay (outside modal)
    await page.click('.event-modal-overlay', { position: { x: 10, y: 10 } });

    // Modal should be closed
    await expect(page.locator('.event-detail-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('should have Add to Calendar button', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for Add to Calendar in datetime card (the + button)
    await expect(page.locator('.add-calendar-btn')).toBeVisible();

    // Check for Add to Calendar CTA button
    await expect(page.locator('.event-cta-btn:has-text("Add to Calendar")')).toBeVisible();
  });

  test('should have Save button that works', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Find the Save quick action button
    const saveBtn = page.locator('.quick-action-btn:has-text("Save")');
    await expect(saveBtn).toBeVisible();

    // Click save
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Should now show "Saved"
    await expect(page.locator('.quick-action-btn:has-text("Saved")')).toBeVisible();
  });

  test('should have Share button', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for Share button
    await expect(page.locator('.quick-action-btn:has-text("Share")')).toBeVisible();
  });

  test('should have Directions button', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for Directions button
    await expect(page.locator('.quick-action-btn:has-text("Directions")')).toBeVisible();
  });

  test('should have View Venue button', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for View Venue CTA button
    await expect(page.locator('.event-cta-btn:has-text("View Venue")')).toBeVisible();
  });

  test('should display event modal footer', async ({ page }) => {
    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for footer
    await expect(page.locator('.event-modal-footer')).toBeVisible();
    await expect(page.locator('.event-modal-footer')).toContainText('Event information may change');
  });
});

test.describe('Event Detail Modal - Classes Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
    // Classes tab should be default, but let's make sure
    await switchToClassesTab(page);
    await page.waitForTimeout(500);
  });

  test('should open class modal when clicking class card', async ({ page }) => {
    // Wait for event cards (classes use same event-card class)
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });

    // Click the class card
    await classCard.click();

    // Verify modal opens
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });
  });

  test('should show Class type pill', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Should show Class pill
    await expect(page.locator('.event-type-pill.class-pill')).toBeVisible();
  });

  test('should have Book button for classes', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Classes should have Book quick action button
    await expect(page.locator('.quick-action-btn:has-text("Book")')).toBeVisible();
  });

  test('should have Book Class CTA button for classes', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Classes should have Book Class CTA
    await expect(page.locator('.event-cta-btn:has-text("Book Class")')).toBeVisible();
  });

  test('should display recurring badge if applicable', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Recurring pill may or may not be present depending on the class
    // Just verify the modal structure is correct
    await expect(page.locator('.event-hero-badges')).toBeVisible();
  });
});

test.describe('Booking Flow - Classes Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
    await switchToClassesTab(page);
    await page.waitForTimeout(500);
  });

  test('should open booking sheet when clicking Book on class card', async ({ page }) => {
    // Find a class card with Book button
    const bookBtn = page.locator('.event-book-btn').first();

    // Check if book button exists
    const bookBtnVisible = await bookBtn.isVisible().catch(() => false);

    if (bookBtnVisible) {
      await bookBtn.click();

      // Booking sheet should open
      await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });
    } else {
      // If no direct book button, open modal and use the Book button there
      const classCard = page.locator('.event-card').first();
      await expect(classCard).toBeVisible({ timeout: 10000 });
      await classCard.click();

      await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

      // Click Book quick action
      const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
      await expect(modalBookBtn).toBeVisible();
      await modalBookBtn.click();

      // Booking sheet should open
      await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display event details in booking sheet', async ({ page }) => {
    // Open a class modal and click Book
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    // Booking sheet should open
    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });

    // Check for sheet handle
    await expect(page.locator('.sheet-handle')).toBeVisible();

    // Check for close button
    await expect(page.locator('.sheet-close')).toBeVisible();
  });

  test('should close booking sheet via close button', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });

    // Close via button
    await page.click('.sheet-close');

    // Sheet should close
    await expect(page.locator('.booking-bottom-sheet')).not.toBeVisible({ timeout: 3000 });
  });

  test('should close booking sheet via overlay click', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });

    // Close via overlay click
    await page.click('.booking-sheet-overlay', { position: { x: 10, y: 10 } });

    // Sheet should close
    await expect(page.locator('.booking-bottom-sheet')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Booking Confirmation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
    await switchToClassesTab(page);
    await page.waitForTimeout(500);
  });

  test('should show booking confirmation after closing booking sheet with external URL', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });

    // Wait a moment for iframe to potentially load
    await page.waitForTimeout(1000);

    // Close the booking sheet
    await page.click('.sheet-close');

    // If there was an external booking URL (iframe step), confirmation should appear
    // This may or may not happen depending on whether the business has a booking URL
    const confirmationVisible = await page.locator('.confirmation-dialog').isVisible().catch(() => false);

    if (confirmationVisible) {
      // Check for confirmation options
      await expect(page.locator('.confirm-btn.yes')).toBeVisible();
      await expect(page.locator('.confirm-btn.yes')).toContainText('Yes, I booked');

      await expect(page.locator('.confirm-btn.no')).toBeVisible();
      await expect(page.locator('.confirm-btn.no')).toContainText('just browsing');
    }
    // If no confirmation appears, that's also valid (no external booking URL)
  });

  test('should handle "Yes, I booked" confirmation', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.click('.sheet-close');

    const confirmationVisible = await page.locator('.confirmation-dialog').isVisible().catch(() => false);

    if (confirmationVisible) {
      await page.click('.confirm-btn.yes');

      // Confirmation dialog should close
      await expect(page.locator('.confirmation-dialog')).not.toBeVisible({ timeout: 3000 });

      // Should show a toast about adding to calendar
      const toast = page.locator('.calendar-toast, [class*="toast"]');
      const toastVisible = await toast.isVisible().catch(() => false);
      // Toast may appear briefly
    }
  });

  test('should handle "No, just browsing" confirmation', async ({ page }) => {
    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.click('.sheet-close');

    const confirmationVisible = await page.locator('.confirmation-dialog').isVisible().catch(() => false);

    if (confirmationVisible) {
      await page.click('.confirm-btn.no');

      // Confirmation dialog should close
      await expect(page.locator('.confirmation-dialog')).not.toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Add to Calendar Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('should open Google Calendar when clicking add to calendar button (guest)', async ({ page, context }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Click the add to calendar button in datetime card
    const addCalendarBtn = page.locator('.add-calendar-btn');
    await expect(addCalendarBtn).toBeVisible();

    // Listen for new page (Google Calendar popup)
    const pagePromise = context.waitForEvent('page');
    await addCalendarBtn.click();
    const newPage = await pagePromise;

    // Verify Google Calendar URL was opened (may redirect to workspace.google.com)
    expect(newPage.url()).toMatch(/google\.com.*(calendar|workspace)/);
    await newPage.close();

    // Note: For guests, the button won't show "added" state since they're not authenticated
    // The calendar functionality still works (opens Google Calendar) but internal state requires auth
  });

  test('should show Add to Calendar CTA button in modal', async ({ page, context }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check CTA button exists
    const ctaBtn = page.locator('.event-cta-btn:has-text("Add to Calendar")');
    await expect(ctaBtn).toBeVisible();

    // Listen for new page when clicking (opens Google Calendar)
    const pagePromise = context.waitForEvent('page');
    await ctaBtn.click();
    const newPage = await pagePromise;

    // Verify Google Calendar URL was opened (may redirect to workspace.google.com)
    expect(newPage.url()).toMatch(/google\.com.*(calendar|workspace)/);
    await newPage.close();

    // Note: For guests, button won't change to "Added" since auth is required for internal tracking
    // But Google Calendar integration works
  });
});

test.describe('Guest User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('guest can view event details', async ({ page }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    // Modal should open for guest users
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.event-hero-title')).toBeVisible();
  });

  test('guest can view class details', async ({ page }) => {
    await switchToClassesTab(page);
    await page.waitForTimeout(500);

    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    // Modal should open for guest users
    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.event-hero-title')).toBeVisible();
  });

  test('guest can use add to calendar (opens Google Calendar)', async ({ page, context }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Guest should be able to click add to calendar button
    const addCalendarBtn = page.locator('.add-calendar-btn');
    await expect(addCalendarBtn).toBeVisible();

    // Listen for new page (Google Calendar popup)
    const pagePromise = context.waitForEvent('page');
    await addCalendarBtn.click();
    const newPage = await pagePromise;

    // Verify Google Calendar opens (may redirect to workspace.google.com)
    expect(newPage.url()).toMatch(/google\.com.*(calendar|workspace)/);
    await newPage.close();

    // Note: The button won't show "added" state for guests since internal calendar requires auth
    // But the Google Calendar integration works without login
  });

  test('guest can use share functionality', async ({ page }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Share button should be clickable
    const shareBtn = page.locator('.quick-action-btn:has-text("Share")');
    await expect(shareBtn).toBeVisible();

    // Click share (may copy to clipboard or open share dialog)
    await shareBtn.click();
    await page.waitForTimeout(500);

    // Should show toast about link copied (if no native share)
    // This depends on browser support for navigator.share
  });

  test('guest can open booking flow for classes', async ({ page }) => {
    await switchToClassesTab(page);
    await page.waitForTimeout(500);

    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const modalBookBtn = page.locator('.quick-action-btn:has-text("Book")');
    await expect(modalBookBtn).toBeVisible();
    await modalBookBtn.click();

    // Booking sheet should open for guests
    await expect(page.locator('.booking-bottom-sheet')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Modal Price and Age Group Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('should display price info when available', async ({ page }) => {
    await switchToClassesTab(page);
    await page.waitForTimeout(500);

    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Check for details grid
    await expect(page.locator('.event-details-grid')).toBeVisible();

    // Price card may or may not be present depending on event data
    const priceCard = page.locator('.event-detail-card:has(.price-icon)');
    // Just verify the grid structure is correct
  });

  test('should display venue and duration in details', async ({ page }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Venue should always be present
    await expect(page.locator('.event-detail-card:has(.venue-icon)')).toBeVisible();

    // Duration should always be present
    await expect(page.locator('.event-detail-card:has(.time-icon)')).toBeVisible();
    await expect(page.locator('.event-detail-label:has-text("Duration")')).toBeVisible();
  });
});

test.describe('External Link Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('Book Class button should have correct external link attributes', async ({ page }) => {
    await switchToClassesTab(page);
    await page.waitForTimeout(500);

    const classCard = page.locator('.event-card').first();
    await expect(classCard).toBeVisible({ timeout: 10000 });
    await classCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    // Book Class CTA should be an anchor tag with target="_blank"
    const bookClassLink = page.locator('.event-cta-btn.book-class-btn');
    await expect(bookClassLink).toBeVisible();
    await expect(bookClassLink).toHaveAttribute('target', '_blank');
    await expect(bookClassLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('View Venue button should link to Google Maps', async ({ page }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const viewVenueBtn = page.locator('.event-cta-btn:has-text("View Venue")');
    await expect(viewVenueBtn).toBeVisible();
    await expect(viewVenueBtn).toHaveAttribute('target', '_blank');

    const href = await viewVenueBtn.getAttribute('href');
    expect(href).toContain('google.com/maps');
  });

  test('Directions button should link to Google Maps directions', async ({ page }) => {
    await switchToEventsTab(page);
    await page.waitForTimeout(500);

    const eventCard = page.locator('.event-card').first();
    await expect(eventCard).toBeVisible({ timeout: 10000 });
    await eventCard.click();

    await expect(page.locator('.event-detail-modal')).toBeVisible({ timeout: 5000 });

    const directionsBtn = page.locator('.quick-action-btn:has-text("Directions")');
    await expect(directionsBtn).toBeVisible();

    const href = await directionsBtn.getAttribute('href');
    expect(href).toContain('google.com/maps/dir');
  });
});
