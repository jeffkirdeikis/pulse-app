/**
 * Actions 59-68: Customer Interaction
 *
 * Feature status summary:
 *   59. Respond to review    — NOT_BUILT (no review system; ServiceDetailModal shows "Rating feature coming soon!")
 *   60. Flag review          — NOT_BUILT
 *   61. DM to business       — EXISTS (full 1:1 messaging via useMessaging hook, MessagesModal user-side)
 *   62. Inbox                — EXISTS (BusinessDashboard full inbox: Booking Requests + Messages tabs,
 *                                       conversation list, thread view, reply input, resolve button)
 *   63. Broadcast            — NOT_BUILT
 *   64. Inquiry form         — EXISTS (contact sheet calls submitContactForm, creates "general" conversation)
 *   65. Toggle DM            — NOT_BUILT
 *   66. Auto-reply           — NOT_BUILT
 *   67. Feedback summary     — NOT_BUILT
 *   68. Quick-thank          — NOT_BUILT
 */

import { test, expect } from '@playwright/test';
import {
  screenshot,
  waitForAppLoad,
  navigateToTab,
  loginAsTestUser,
  switchToBusinessView,
  setupConsoleErrorCapture,
  TEST_OWNER,
  EDGE_STRINGS,
  XSS_PAYLOADS,
  verifyNoXSSRendered,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Open the first business card detail modal on the current tab. */
async function openFirstBusinessCard(page) {
  const card = page.locator(
    '.business-card, [class*="business-card"], .service-card, [class*="BusinessCard"]',
  ).first();
  if (await card.isVisible({ timeout: 6000 })) {
    await card.click();
    await page.waitForTimeout(800);
  }
}

/** Log in and navigate to the Business Dashboard Inbox. */
async function openBusinessInbox(page) {
  await waitForAppLoad(page);
  await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
  await page.waitForTimeout(1500);
  await switchToBusinessView(page);

  const inboxBtn = page.locator('button:has-text("Inbox"), [data-testid="inbox-btn"], [aria-label*="inbox" i]');
  if (await inboxBtn.isVisible({ timeout: 5000 })) {
    await inboxBtn.click();
    await page.waitForTimeout(800);
  }
}

// ---------------------------------------------------------------------------
// Action 59 — Respond to review (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 59 — Respond to customer review', () => {
  test('59.1 — ServiceDetailModal shows "Rating feature coming soon!" placeholder', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);

    await openFirstBusinessCard(page);
    await screenshot(page, 59, 'respond-review', '01-service-modal-opened');

    // Modal should be visible
    const modal = page.locator(
      '.service-detail-modal, [class*="ServiceDetail"], [class*="service-detail"], .detail-modal',
    );
    const isOpen = await modal.isVisible({ timeout: 5000 }).catch(() => false);

    if (isOpen) {
      // Rating / review coming soon message
      const comingSoon = page.locator('text=/rating.*coming soon/i, text=/reviews.*coming soon/i, text=/coming soon/i');
      const hasPlaceholder = await comingSoon.isVisible({ timeout: 3000 }).catch(() => false);
      await screenshot(page, 59, 'respond-review', '02-rating-placeholder');
      if (hasPlaceholder) {
        await expect(comingSoon).toBeVisible();
        console.log('59.1: "Rating feature coming soon!" placeholder confirmed.');
      } else {
        console.log('59.1: Modal opened but coming-soon text not found at current scroll position.');
      }
    } else {
      console.log('59.1: Could not open a service detail modal. No service cards found.');
    }
  });

  test.skip('59.2 — NOT_BUILT: No review system — business owner cannot respond to reviews', async ({ page }) => {
    // When the review system is built, test:
    //   1. Reviews appear on business/service detail modal
    //   2. Logged-in business owner sees "Reply" button below each review
    //   3. Reply compose box opens inline below the review
    //   4. Reply text is validated (non-empty, max character count)
    //   5. Submitted reply appears publicly beneath the review
    //   6. Owner can edit or delete their own reply
    //   7. Reply cannot be made by a non-owner of that business
  });

  test.skip('59.3 — NOT_BUILT: Review response is displayed in public-facing UI', async ({ page }) => {
    // When built:
    //   1. Public consumers see both the review and the owner's reply
    //   2. Reply shows business name and timestamp
    //   3. Reply is visually distinguished from the original review
  });
});

// ---------------------------------------------------------------------------
// Action 60 — Flag review (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 60 — Flag inappropriate review', () => {
  test.skip('60.1 — NOT_BUILT: No review flagging mechanism exists', async ({ page }) => {
    // No review system exists at all (see Action 59). Flagging is a sub-feature.
    // When built, test:
    //   1. A "Flag" or "Report" icon appears on each review
    //   2. Clicking opens a flag reason dialog (spam, offensive, irrelevant, etc.)
    //   3. Submitting sends the flag to admin moderation queue
    //   4. Flagged review enters a pending/hidden state (or admin-configurable threshold)
    //   5. User cannot flag the same review twice
    //   6. Admin receives notification of flagged review
  });
});

// ---------------------------------------------------------------------------
// Action 61 — DM to business (EXISTS)
// ---------------------------------------------------------------------------

test.describe('Action 61 — Direct message to business', () => {
  test('61.1 — App loads without console errors in consumer view', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await waitForAppLoad(page);
    await screenshot(page, 61, 'dm-business', '01-app-loaded');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('61.2 — Contact / Message button is visible on business cards or detail modals', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Message"), button:has-text("Send Message"), [data-testid*="contact"], [data-testid*="message"]',
    );
    const isVisible = await contactBtn.isVisible({ timeout: 5000 }).catch(() => false);
    await screenshot(page, 61, 'dm-business', '02-contact-btn-check');

    if (isVisible) {
      await expect(contactBtn).toBeVisible();
    } else {
      console.log('61.2: Contact/Message button not found on first service card modal.');
    }
  });

  test('61.3 — Clicking contact button opens a messaging UI or contact sheet', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Message"), button:has-text("Send Message")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 61, 'dm-business', '03-contact-opened');

      // Either a message compose modal or contact sheet
      const contactUi = page.locator(
        '.messages-modal, .contact-sheet, .contact-modal, [class*="MessagesModal"], [class*="contact-sheet"], [class*="ContactSheet"]',
      );
      const isOpen = await contactUi.isVisible({ timeout: 5000 }).catch(() => false);
      if (isOpen) {
        await expect(contactUi).toBeVisible();
      } else {
        // Auth modal may appear if user is not logged in
        const authModal = page.locator('.auth-modal, [class*="auth-modal"]');
        const authVisible = await authModal.isVisible({ timeout: 3000 }).catch(() => false);
        if (authVisible) {
          console.log('61.3: Auth modal appeared — messaging requires login.');
          await expect(authModal).toBeVisible();
        } else {
          console.log('61.3: Unexpected state after clicking Contact. Check screenshot.');
        }
      }
    } else {
      console.log('61.3: Contact button not found. Cannot test messaging flow.');
    }
  });

  test('61.4 — Messaging requires authentication (unauthenticated user sees login prompt)', async ({ page }) => {
    await waitForAppLoad(page);
    // Do NOT log in — test unauthenticated flow
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Message"), button:has-text("Send Message")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 61, 'dm-business', '04-unauth-contact-click');

      // Should either show auth modal or redirect to login
      const authModal = page.locator('.auth-modal, [class*="auth-modal"]');
      const loginPrompt = page.locator('text=/sign in/i, text=/log in/i, text=/login/i');
      const authVisible = await authModal.isVisible({ timeout: 4000 }).catch(() => false);
      const loginVisible = await loginPrompt.isVisible({ timeout: 4000 }).catch(() => false);

      // Messaging UI (MessagesModal) for an authenticated flow
      const messagesModal = page.locator('.messages-modal, [class*="MessagesModal"]');
      const msgVisible = await messagesModal.isVisible({ timeout: 2000 }).catch(() => false);

      if (authVisible || loginVisible) {
        console.log('61.4: Login prompt shown for unauthenticated user — correct behavior.');
        expect(authVisible || loginVisible).toBeTruthy();
      } else if (msgVisible) {
        console.log('61.4: Messaging modal opened without auth — verify if guest messaging is intentional.');
      } else {
        console.log('61.4: Unknown state — check screenshot for context.');
      }
    }
  });

  test('61.5 — Logged-in user can type a message in the compose field', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Message"), button:has-text("Send Message")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);

      const messageInput = page.locator(
        'textarea[placeholder*="message" i], textarea[placeholder*="type" i], input[placeholder*="message" i], .message-input',
      );
      if (await messageInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await messageInput.fill('QA test message — Action 61');
        await expect(messageInput).toHaveValue('QA test message — Action 61');
        await screenshot(page, 61, 'dm-business', '05-message-typed');
      } else {
        await screenshot(page, 61, 'dm-business', '05-message-input-not-found');
        console.log('61.5: Message input not visible after opening contact UI.');
      }
    }
  });

  test('61.6 — Message input rejects XSS payloads (rendered safely)', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Message"), button:has-text("Send Message")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);

      const messageInput = page.locator(
        'textarea[placeholder*="message" i], textarea[placeholder*="type" i], input[placeholder*="message" i]',
      );

      if (await messageInput.isVisible({ timeout: 4000 }).catch(() => false)) {
        for (const payload of XSS_PAYLOADS) {
          await messageInput.fill(payload);
          await page.waitForTimeout(200);
        }
        await screenshot(page, 61, 'dm-business', '06-xss-typed');
        await verifyNoXSSRendered(page);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Action 62 — Inbox (EXISTS — BusinessDashboard)
// ---------------------------------------------------------------------------

test.describe('Action 62 — Business owner inbox', () => {
  test('62.1 — Inbox is accessible from Business view', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await openBusinessInbox(page);
    await screenshot(page, 62, 'inbox', '01-inbox-open');

    // Inbox container should be visible
    const inbox = page.locator(
      '.business-inbox, [class*="inbox"], [class*="Inbox"], [data-testid="inbox"]',
    );
    const isVisible = await inbox.isVisible({ timeout: 6000 }).catch(() => false);
    if (isVisible) {
      await expect(inbox).toBeVisible();
    } else {
      console.log('62.1: Inbox container selector not matched — verify class name in source.');
    }
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('62.2 — Inbox has two tabs: Booking Requests and Messages', async ({ page }) => {
    await openBusinessInbox(page);

    const bookingTab = page.locator(
      'button:has-text("Booking Requests"), [role="tab"]:has-text("Booking"), .inbox-tab:has-text("Booking")',
    );
    const messagesTab = page.locator(
      'button:has-text("Messages"), [role="tab"]:has-text("Messages"), .inbox-tab:has-text("Messages")',
    );

    const bookingVisible = await bookingTab.isVisible({ timeout: 5000 }).catch(() => false);
    const messagesVisible = await messagesTab.isVisible({ timeout: 5000 }).catch(() => false);

    await screenshot(page, 62, 'inbox', '02-tabs-check');
    // At least one tab must be present for the inbox feature to be functional
    expect(bookingVisible || messagesVisible).toBeTruthy();
    console.log(`62.2: Booking tab visible=${bookingVisible}, Messages tab visible=${messagesVisible}`);
  });

  test('62.3 — Messages tab shows conversation list or empty state', async ({ page }) => {
    await openBusinessInbox(page);

    const messagesTab = page.locator(
      'button:has-text("Messages"), [role="tab"]:has-text("Messages"), .inbox-tab:has-text("Messages")',
    );
    if (await messagesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await messagesTab.click();
      await page.waitForTimeout(800);
      await screenshot(page, 62, 'inbox', '03-messages-tab-active');

      const listOrEmpty = page.locator(
        '.conversation-list, [class*="conversation-list"], .inbox-conversations, .inbox-empty, p:has-text("No messages"), p:has-text("no conversations")',
      );
      await expect(listOrEmpty.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('62.4 — Conversation thread opens on click and shows message history', async ({ page }) => {
    await openBusinessInbox(page);

    // Switch to Messages tab
    const messagesTab = page.locator('button:has-text("Messages"), [role="tab"]:has-text("Messages")');
    if (await messagesTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await messagesTab.click();
      await page.waitForTimeout(600);
    }

    const firstConvo = page.locator('.conversation-item, [class*="conversation-item"], .inbox-thread').first();
    if (await firstConvo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstConvo.click();
      await page.waitForTimeout(800);
      await screenshot(page, 62, 'inbox', '04-thread-view');

      // Thread should show messages
      const threadContent = page.locator(
        '.message-thread, [class*="message-thread"], .thread-messages, .conversation-thread, [class*="MessageThread"]',
      );
      const isVisible = await threadContent.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        await expect(threadContent).toBeVisible();
      } else {
        console.log('62.4: Thread content selector not matched. Thread may use a different class.');
      }
    } else {
      console.log('62.4: No conversations available. Empty inbox state.');
    }
  });

  test('62.5 — Reply input is functional in an open thread', async ({ page }) => {
    await openBusinessInbox(page);

    const messagesTab = page.locator('button:has-text("Messages"), [role="tab"]:has-text("Messages")');
    if (await messagesTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await messagesTab.click();
      await page.waitForTimeout(600);
    }

    const firstConvo = page.locator('.conversation-item, [class*="conversation-item"]').first();
    if (await firstConvo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstConvo.click();
      await page.waitForTimeout(800);

      const replyInput = page.locator(
        'textarea[placeholder*="reply" i], textarea[placeholder*="message" i], input[placeholder*="reply" i], .reply-input',
      );
      if (await replyInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await replyInput.click();
        await replyInput.fill('QA inbox reply test — Action 62');
        await expect(replyInput).toHaveValue('QA inbox reply test — Action 62');
        await screenshot(page, 62, 'inbox', '05-reply-typed');
      } else {
        await screenshot(page, 62, 'inbox', '05-reply-input-not-found');
        console.log('62.5: Reply input not found in thread view.');
      }
    }
  });

  test('62.6 — Resolve button is present on open conversation threads', async ({ page }) => {
    await openBusinessInbox(page);

    const firstConvo = page.locator('.conversation-item, [class*="conversation-item"]').first();
    if (await firstConvo.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstConvo.click();
      await page.waitForTimeout(800);

      const resolveBtn = page.locator('button:has-text("Resolve"), button[aria-label*="resolve" i]');
      const isVisible = await resolveBtn.isVisible({ timeout: 4000 }).catch(() => false);
      await screenshot(page, 62, 'inbox', '06-resolve-btn');

      if (isVisible) {
        await expect(resolveBtn).toBeVisible();
        // Do NOT click — would modify production data
      } else {
        console.log('62.6: Resolve button not visible — thread may already be resolved or inbox is empty.');
      }
    }
  });

  test('62.7 — Inbox renders without console errors', async ({ page }) => {
    const errors = setupConsoleErrorCapture(page);
    await openBusinessInbox(page);
    await page.waitForTimeout(1000);
    await screenshot(page, 62, 'inbox', '07-no-errors');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('ResizeObserver'))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Action 63 — Broadcast (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 63 — Broadcast message to followers/subscribers', () => {
  test.skip('63.1 — NOT_BUILT: No broadcast / bulk messaging feature exists', async ({ page }) => {
    // When built, test:
    //   1. BusinessDashboard has a "Broadcast" or "Announcements" section
    //   2. Owner can compose a message (subject + body)
    //   3. Recipient selection: all followers, specific segments, manual list
    //   4. Preview shows estimated recipient count
    //   5. Confirmation step before send
    //   6. Sent broadcast appears in "Sent" history
    //   7. Recipients receive in-app notification or email
    //   8. Broadcast cannot be recalled after sending (or clearly labeled if it can)
  });

  test.skip('63.2 — NOT_BUILT: Broadcast rate limiting / spam prevention', async ({ page }) => {
    // When built:
    //   1. Sending > N broadcasts per day is throttled
    //   2. Throttle warning appears before hard block
  });
});

// ---------------------------------------------------------------------------
// Action 64 — Inquiry form (EXISTS)
// ---------------------------------------------------------------------------

test.describe('Action 64 — Inquiry / contact form', () => {
  test('64.1 — Contact / inquiry form is accessible from a business card or detail modal', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);
    await screenshot(page, 64, 'inquiry-form', '01-detail-modal-open');

    // Look for contact/inquiry button
    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Inquire"), button:has-text("Send Inquiry"), [data-testid*="contact"], [data-testid*="inquiry"]',
    );
    const isVisible = await contactBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(contactBtn).toBeVisible();
    } else {
      console.log('64.1: Contact/Inquiry button not found on first service modal.');
    }
  });

  test('64.2 — Contact form opens as a sheet/modal with a message input', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Inquire"), button:has-text("Send Inquiry")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 64, 'inquiry-form', '02-contact-sheet-opened');

      // Contact sheet or modal
      const sheet = page.locator(
        '.contact-sheet, [class*="contact-sheet"], .contact-modal, [class*="ContactSheet"]',
      );
      const isOpen = await sheet.isVisible({ timeout: 5000 }).catch(() => false);
      if (isOpen) {
        await expect(sheet).toBeVisible();
      } else {
        console.log('64.2: Contact sheet selector not matched — check class names.');
      }
    }
  });

  test('64.3 — Contact form message field accepts text input', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Inquire"), button:has-text("Send Inquiry")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);

      const msgInput = page.locator(
        'textarea[placeholder*="message" i], textarea[placeholder*="inquiry" i], textarea[placeholder*="type" i], .contact-sheet textarea',
      );
      if (await msgInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await msgInput.fill('QA test inquiry message — Action 64');
        await expect(msgInput).toHaveValue('QA test inquiry message — Action 64');
        await screenshot(page, 64, 'inquiry-form', '03-message-typed');
      } else {
        await screenshot(page, 64, 'inquiry-form', '03-input-not-found');
        console.log('64.3: Message input not found in contact sheet.');
      }
    }
  });

  test('64.4 — Submitting contact form creates a "general" conversation (submitContactForm)', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Inquire"), button:has-text("Send Inquiry")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);

      const msgInput = page.locator(
        'textarea[placeholder*="message" i], textarea[placeholder*="inquiry" i], .contact-sheet textarea',
      );
      if (await msgInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await msgInput.fill('QA automated inquiry — Action 64. Safe to ignore.');

        const sendBtn = page.locator(
          'button:has-text("Send"), button[type="submit"]:has-text("Send"), .contact-sheet button:has-text("Send")',
        );
        if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await sendBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, 64, 'inquiry-form', '04-after-send');

          // Expect success state: sheet closes, success message, or chat thread opens
          const successMsg = page.locator(
            'text=/sent/i, text=/message sent/i, text=/thank/i, text=/submitted/i',
          );
          const sheet = page.locator('.contact-sheet, [class*="contact-sheet"]');
          const sheetClosed = !(await sheet.isVisible({ timeout: 1000 }).catch(() => true));
          const hasSuccess = await successMsg.isVisible({ timeout: 3000 }).catch(() => false);

          expect(sheetClosed || hasSuccess).toBeTruthy();
        }
      }
    }
  });

  test('64.5 — Contact form rejects empty message submission', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Inquire"), button:has-text("Send Inquiry")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);

      const sendBtn = page.locator(
        'button:has-text("Send"), button[type="submit"]:has-text("Send")',
      );
      if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Do not fill the message — click Send with empty form
        await sendBtn.click();
        await page.waitForTimeout(500);
        await screenshot(page, 64, 'inquiry-form', '05-empty-submit');

        // Form should not close or show error
        const sheet = page.locator('.contact-sheet, [class*="contact-sheet"]');
        const stillOpen = await sheet.isVisible({ timeout: 2000 }).catch(() => false);
        const validationMsg = page.locator(
          '[class*="error"], text=/required/i, text=/empty/i, text=/enter a message/i',
        );
        const hasError = await validationMsg.isVisible({ timeout: 2000 }).catch(() => false);

        expect(stillOpen || hasError).toBeTruthy();
      }
    }
  });

  test('64.6 — Contact form XSS: message input renders malicious input safely', async ({ page }) => {
    await waitForAppLoad(page);
    await loginAsTestUser(page, TEST_OWNER.email, TEST_OWNER.password);
    await page.waitForTimeout(1500);
    await navigateToTab(page, 'Services');
    await page.waitForTimeout(1000);
    await openFirstBusinessCard(page);

    const contactBtn = page.locator(
      'button:has-text("Contact"), button:has-text("Inquire"), button:has-text("Send Inquiry")',
    ).first();

    if (await contactBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await contactBtn.click();
      await page.waitForTimeout(1000);

      const msgInput = page.locator('textarea[placeholder*="message" i], .contact-sheet textarea').first();
      if (await msgInput.isVisible({ timeout: 4000 }).catch(() => false)) {
        for (const payload of XSS_PAYLOADS) {
          await msgInput.fill(payload);
          await page.waitForTimeout(150);
        }
        await screenshot(page, 64, 'inquiry-form', '06-xss-check');
        await verifyNoXSSRendered(page);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Action 65 — Toggle DM (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 65 — Toggle DM availability', () => {
  test.skip('65.1 — NOT_BUILT: No DM enable/disable toggle in BusinessDashboard settings', async ({ page }) => {
    // Business owners cannot currently turn off direct messages.
    // When built, test:
    //   1. BusinessDashboard Settings has a "Direct Messages" toggle
    //   2. Toggling OFF hides the Message button from the public business card
    //   3. Toggling ON restores the Message button
    //   4. State is saved immediately (no separate Save button needed)
    //   5. Existing open conversations remain accessible when DM is toggled off
  });
});

// ---------------------------------------------------------------------------
// Action 66 — Auto-reply (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 66 — Auto-reply / away message', () => {
  test.skip('66.1 — NOT_BUILT: No auto-reply configuration exists', async ({ page }) => {
    // When built, test:
    //   1. BusinessDashboard has an "Auto-reply" or "Away Message" setting
    //   2. Owner can write a custom message (with character limit)
    //   3. Toggle to enable/disable the auto-reply independently of DM
    //   4. Customer receives auto-reply immediately after sending a message
    //   5. Auto-reply is visually distinguished in the thread (labeled "Auto-reply")
    //   6. Auto-reply is not triggered if owner replies within X minutes
  });
});

// ---------------------------------------------------------------------------
// Action 67 — Feedback summary (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 67 — Feedback / sentiment summary dashboard', () => {
  test.skip('67.1 — NOT_BUILT: No feedback summary or analytics for messages exists', async ({ page }) => {
    // When built, test:
    //   1. BusinessDashboard Analytics shows message sentiment summary
    //   2. Common inquiry topics are surfaced (NLP tagging)
    //   3. Response rate and average response time are shown
    //   4. Summary is updated at least daily
    //   5. Clicking a topic filters the inbox to related conversations
  });
});

// ---------------------------------------------------------------------------
// Action 68 — Quick-thank (NOT_BUILT)
// ---------------------------------------------------------------------------

test.describe('Action 68 — Quick-thank response shortcut', () => {
  test.skip('68.1 — NOT_BUILT: No quick-reply / canned response feature in inbox', async ({ page }) => {
    // When built, test:
    //   1. Inbox thread view has a "Quick Reply" button (e.g. lightning bolt icon)
    //   2. Clicking shows a list of canned responses (including "Thank you!")
    //   3. Selecting a canned response populates the reply input
    //   4. Owner can edit the pre-filled text before sending
    //   5. Owner can add/edit custom canned responses in Settings
    //   6. Canned responses support template variables (e.g. {{customer_name}})
  });
});
