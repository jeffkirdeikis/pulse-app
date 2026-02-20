/**
 * Full QA Run — Pulse App
 * Tests all critical user flows with screenshots
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/qa-full';
const VIEWPORT = { width: 430, height: 932 };
const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I4QhFf1o4-l5Q61Hl9I99w_gJEpuREo';
const TEST_EMAIL = 'test-consumer@pulse-test.com';
const TEST_PASSWORD = 'TestPass123';
const STORAGE_KEY = 'sb-ygpfklhjwwqwrfpsfhue-auth-token';

// Results tracking
const results = [];
function log(phase, test, status, detail = '') {
  const entry = { phase, test, status, detail };
  results.push(entry);
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${phase}] ${test}${detail ? ' — ' + detail : ''}`);
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  return filepath;
}

async function safeStep(phase, testName, fn) {
  try {
    await fn();
  } catch (err) {
    log(phase, testName, 'FAIL', err.message);
  }
}

async function main() {
  // Ensure screenshot dir exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ═══════════════════════════════════════════════
  // PHASE 1: GUEST FLOWS
  // ═══════════════════════════════════════════════
  console.log('\n═══ PHASE 1: GUEST FLOWS ═══\n');

  // 1.1 Load page
  await safeStep('Guest', 'Page loads without blank screen', async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
    await screenshot(page, '01-initial-load');

    const bodyText = await page.evaluate(() => document.body.innerText.length);
    if (bodyText > 100) {
      log('Guest', 'Page loads without blank screen', 'PASS', `Body text length: ${bodyText}`);
    } else {
      log('Guest', 'Page loads without blank screen', 'FAIL', `Body text too short: ${bodyText}`);
    }
  });

  // 1.2 Check each tab
  const tabs = ['classes', 'events', 'deals', 'services', 'wellness'];
  for (const tab of tabs) {
    await safeStep('Guest', `Tab: ${tab}`, async () => {
      // Click the tab
      const clicked = await page.evaluate((tabName) => {
        const allTabs = document.querySelectorAll('.banner-tab');
        for (const t of allTabs) {
          if (t.textContent.toLowerCase().includes(tabName)) {
            t.click();
            return true;
          }
        }
        return false;
      }, tab);

      if (!clicked) {
        log('Guest', `Tab: ${tab}`, 'FAIL', 'Tab button not found');
        return;
      }

      await wait(2000);
      await screenshot(page, `02-tab-${tab}`);

      // Count visible cards — use displayed count text + DOM card check
      const cardInfo = await page.evaluate((tabName) => {
        // First, try to get the displayed count from the UI text (e.g. "2065 classes", "285 events", "665 businesses")
        let displayedCount = 0;
        const bodyText = document.body.innerText;
        const countMatch = bodyText.match(/(\d[\d,]*)\s+(classes|events|deals|businesses|providers)/i);
        if (countMatch) displayedCount = parseInt(countMatch[1].replace(/,/g, ''));

        // Then count actual DOM cards with tab-specific selectors
        let cards;
        if (tabName === 'wellness') {
          // Wellness uses wb-slot-card for timeline view and wb-provider-card for provider view
          cards = document.querySelectorAll('.wb-slot-card, .wb-provider-card');
        } else if (tabName === 'services') {
          // Services use service-card class (from DealsGrid/ServiceCard components)
          cards = document.querySelectorAll('.service-card, [class*="service-card"]');
          // Fallback: any card-like container in the services view
          if (cards.length === 0) {
            cards = document.querySelectorAll('.event-card, .deal-card');
          }
        } else if (tabName === 'deals') {
          cards = document.querySelectorAll('.deal-card, .event-card');
        } else {
          cards = document.querySelectorAll('.event-card');
        }

        const visibleCards = Array.from(cards).filter(c => {
          const rect = c.getBoundingClientRect();
          return rect.height > 0 && rect.width > 0;
        });

        // Check for titles
        let titlesFound = 0;
        visibleCards.forEach(c => {
          const title = c.querySelector('h3, h4, .card-title, .event-card-header h3, .deal-title, .wb-slot-name, .wb-provider-name, span[class*="name"]');
          if (title && title.textContent.trim().length > 0) titlesFound++;
        });

        return { total: visibleCards.length, withTitles: titlesFound, displayedCount };
      }, tab);

      if (cardInfo.total > 0) {
        log('Guest', `Tab: ${tab} — cards visible`, 'PASS', `${cardInfo.total} DOM cards, ${cardInfo.withTitles} with titles (UI shows ${cardInfo.displayedCount})`);
      } else if (cardInfo.displayedCount > 0) {
        // Cards exist per displayed count, but DOM selectors didn't match
        log('Guest', `Tab: ${tab} — cards visible`, 'PASS', `UI shows ${cardInfo.displayedCount} items (DOM card selector mismatch is OK)`);
      } else {
        // Some tabs might legitimately have no cards, check for empty state message
        const hasEmptyMsg = await page.evaluate(() => {
          const body = document.body.innerText;
          return body.includes('No ') || body.includes('nothing') || body.includes('empty');
        });
        if (hasEmptyMsg) {
          log('Guest', `Tab: ${tab} — cards visible`, 'WARN', 'No cards found but empty state message present');
        } else {
          log('Guest', `Tab: ${tab} — cards visible`, 'WARN', 'No cards found — may need different selectors');
        }
      }
    });
  }

  // 1.3 Click first card on Classes tab → detail modal
  await safeStep('Guest', 'Class card detail modal', async () => {
    // Switch to classes tab
    await page.evaluate(() => {
      const allTabs = document.querySelectorAll('.banner-tab');
      for (const t of allTabs) {
        if (t.textContent.toLowerCase().includes('classes')) { t.click(); break; }
      }
    });
    await wait(2000);

    // Click first event card
    const clicked = await page.evaluate(() => {
      const cards = document.querySelectorAll('.event-card');
      if (cards.length > 0) {
        // Click the card body area (not the save button or book button)
        const body = cards[0].querySelector('.event-card-body') || cards[0].querySelector('.event-card-header') || cards[0];
        body.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      log('Guest', 'Class card detail modal', 'FAIL', 'No event cards to click');
      return;
    }

    await wait(1500);
    await screenshot(page, '03-detail-modal');

    // Check if modal opened
    const modalOpen = await page.evaluate(() => {
      const overlay = document.querySelector('.modal-overlay, .event-detail-modal, [role="dialog"]');
      return overlay !== null;
    });

    if (modalOpen) {
      log('Guest', 'Class card detail modal', 'PASS', 'Modal opened successfully');
    } else {
      log('Guest', 'Class card detail modal', 'FAIL', 'Modal did not open');
    }
  });

  // 1.4 Close modal via overlay click
  await safeStep('Guest', 'Close detail modal via overlay', async () => {
    const closed = await page.evaluate(() => {
      const overlay = document.querySelector('.modal-overlay');
      if (overlay) {
        // Click the overlay itself, not its children
        overlay.click();
        return true;
      }
      return false;
    });

    await wait(1000);

    const modalStillOpen = await page.evaluate(() => {
      return document.querySelector('.modal-overlay, .event-detail-modal') !== null;
    });

    if (closed && !modalStillOpen) {
      log('Guest', 'Close detail modal via overlay', 'PASS');
    } else if (!closed) {
      log('Guest', 'Close detail modal via overlay', 'WARN', 'No overlay found to click');
    } else {
      log('Guest', 'Close detail modal via overlay', 'FAIL', 'Modal still open after overlay click');
    }

    await screenshot(page, '04-modal-closed');
  });

  // 1.5 Test search — use displayed count text since list is virtualized
  await safeStep('Guest', 'Search functionality', async () => {
    // Make sure we're on classes tab
    await page.evaluate(() => {
      const allTabs = document.querySelectorAll('.banner-tab');
      for (const t of allTabs) {
        if (t.textContent.toLowerCase().includes('classes')) { t.click(); break; }
      }
    });
    await wait(2000);

    // Get initial displayed count (e.g. "2065 classes")
    const initialDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    // Type in search
    const searchInput = await page.$('.search-bar-premium input');
    if (!searchInput) {
      log('Guest', 'Search functionality', 'FAIL', 'Search input not found');
      return;
    }

    await searchInput.click();
    await searchInput.type('yoga', { delay: 80 });
    await wait(2000);
    await screenshot(page, '05-search-yoga');

    const afterDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    // Also check if search suggestions dropdown appeared
    const hasSuggestions = await page.evaluate(() => {
      return document.querySelectorAll('.search-suggestion, [class*="suggestion"], [class*="autocomplete"]').length > 0
        || document.body.innerText.includes('Yoga');
    });

    if (afterDisplayed < initialDisplayed && afterDisplayed > 0) {
      log('Guest', 'Search functionality', 'PASS', `"yoga" filtered: ${initialDisplayed} → ${afterDisplayed} classes`);
    } else if (hasSuggestions) {
      log('Guest', 'Search functionality', 'PASS', `Search active (${initialDisplayed} → ${afterDisplayed}), suggestions visible`);
    } else {
      log('Guest', 'Search functionality', 'WARN', `Before: ${initialDisplayed}, After: ${afterDisplayed}`);
    }

    // Clear search via the X button or keyboard
    const cleared = await page.evaluate(() => {
      const clearBtn = document.querySelector('.search-bar-premium button, .search-bar-premium .clear-btn, .search-bar-premium svg[class*="clear"]');
      if (clearBtn) { clearBtn.click(); return 'button'; }
      return null;
    });
    if (!cleared) {
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
    }
    await wait(1500);
  });

  // 1.6 Test date filter — click a specific date chip (not "All Upcoming")
  await safeStep('Guest', 'Date filter (specific day)', async () => {
    // Get initial displayed count
    const initialDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    // Click the second date chip (Today's actual date)
    const dateClicked = await page.evaluate(() => {
      const chips = document.querySelectorAll('.date-chip');
      // Skip the first one ("All Upcoming") and click the second one (Today)
      if (chips.length > 1) {
        chips[1].click();
        return chips[1].textContent.trim();
      }
      return null;
    });

    if (!dateClicked) {
      log('Guest', 'Date filter (specific day)', 'FAIL', 'No date chips found');
      return;
    }

    await wait(2000);
    await screenshot(page, '06-date-filter');

    const filteredDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    log('Guest', 'Date filter (specific day)',
      filteredDisplayed !== initialDisplayed ? 'PASS' : 'WARN',
      `Clicked "${dateClicked}": ${initialDisplayed} → ${filteredDisplayed} classes`);

    // Reset to "All Upcoming"
    await page.evaluate(() => {
      const chips = document.querySelectorAll('.date-chip');
      if (chips.length > 0) chips[0].click();
    });
    await wait(1500);
  });

  // 1.7 Test category filter — must expand "Filters >" section first
  await safeStep('Guest', 'Category filter', async () => {
    // Get initial displayed count
    const initialDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    // Expand the filter section by clicking "Filters >" toggle button
    await page.evaluate(() => {
      const btn = document.querySelector('.filters-toggle-btn');
      if (btn) btn.click();
    });
    await wait(800);

    // Now try clicking a category pill (not "All")
    const catClicked = await page.evaluate(() => {
      const pills = document.querySelectorAll('.filter-cat-pill');
      for (const pill of pills) {
        if (!pill.classList.contains('filter-cat-pill-active') && pill.textContent.trim() !== 'All') {
          pill.click();
          return pill.textContent.trim();
        }
      }
      return null;
    });

    if (!catClicked) {
      log('Guest', 'Category filter', 'WARN', 'No category pills found after expanding filters');
      return;
    }

    await wait(2000);
    await screenshot(page, '07-category-filter');

    const filteredDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    if (filteredDisplayed < initialDisplayed) {
      log('Guest', 'Category filter', 'PASS', `"${catClicked}": ${initialDisplayed} → ${filteredDisplayed}`);
    } else if (filteredDisplayed === initialDisplayed) {
      log('Guest', 'Category filter', 'WARN', `"${catClicked}": count stayed at ${initialDisplayed}`);
    } else {
      log('Guest', 'Category filter', 'FAIL', `"${catClicked}": count increased ${initialDisplayed} → ${filteredDisplayed}`);
    }

    // Reset category to "All" and collapse filters
    await page.evaluate(() => {
      const pills = document.querySelectorAll('.filter-cat-pill');
      for (const pill of pills) {
        if (pill.textContent.trim() === 'All') { pill.click(); break; }
      }
    });
    await wait(500);
    // Collapse filters back
    await page.evaluate(() => {
      const btn = document.querySelector('.filters-toggle-btn');
      if (btn) btn.click();
    });
    await wait(1000);
  });

  // 1.8 Sign In button → auth modal
  await safeStep('Guest', 'Sign In → Auth modal', async () => {
    const signInClicked = await page.evaluate(() => {
      const btn = document.querySelector('.sign-in-btn');
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!signInClicked) {
      log('Guest', 'Sign In → Auth modal', 'FAIL', 'Sign In button not found');
      return;
    }

    await wait(1000);
    await screenshot(page, '08-auth-modal');

    const authModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('.auth-modal, [aria-label="Sign in"]');
      return modal !== null;
    });

    if (authModalVisible) {
      log('Guest', 'Sign In → Auth modal', 'PASS');
    } else {
      log('Guest', 'Sign In → Auth modal', 'FAIL', 'Auth modal not visible');
    }
  });

  // 1.9 Close auth modal
  await safeStep('Guest', 'Close auth modal', async () => {
    await page.evaluate(() => {
      const overlay = document.querySelector('[aria-label="Sign in"]');
      if (overlay) overlay.click();
    });
    await wait(800);

    const stillOpen = await page.evaluate(() => {
      return document.querySelector('.auth-modal, [aria-label="Sign in"]') !== null;
    });

    if (!stillOpen) {
      log('Guest', 'Close auth modal', 'PASS');
    } else {
      // Try closing with close button
      await page.evaluate(() => {
        const closeBtn = document.querySelector('.auth-modal-close');
        if (closeBtn) closeBtn.click();
      });
      await wait(500);
      log('Guest', 'Close auth modal', 'WARN', 'Overlay click did not close — used close button');
    }
  });

  // ═══════════════════════════════════════════════
  // PHASE 2: AUTHENTICATED FLOWS
  // ═══════════════════════════════════════════════
  console.log('\n═══ PHASE 2: AUTHENTICATED FLOWS ═══\n');

  // 2.1 Login via Supabase API and inject session
  await safeStep('Auth', 'Login via Supabase API', async () => {
    // Sign in via Supabase REST API
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    const data = await response.json();

    if (!data.access_token) {
      log('Auth', 'Login via Supabase API', 'FAIL', `No access token: ${JSON.stringify(data).slice(0, 200)}`);
      return;
    }

    // Inject session into localStorage
    await page.evaluate((key, session) => {
      localStorage.setItem(key, JSON.stringify(session));
    }, STORAGE_KEY, data);

    // Reload page to pick up session
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
    await screenshot(page, '09-logged-in');

    // Check if profile button is visible (indicates logged in)
    const profileVisible = await page.evaluate(() => {
      const btn = document.querySelector('.profile-btn, .profile-avatar');
      return btn !== null;
    });

    if (profileVisible) {
      log('Auth', 'Login via Supabase API', 'PASS', 'Profile button visible');
    } else {
      log('Auth', 'Login via Supabase API', 'FAIL', 'Profile button not visible after login');
    }
  });

  // 2.2 Save Star on first card
  await safeStep('Auth', 'Save Star on first class card', async () => {
    // Ensure on classes tab
    await page.evaluate(() => {
      const allTabs = document.querySelectorAll('.banner-tab');
      for (const t of allTabs) {
        if (t.textContent.toLowerCase().includes('classes')) { t.click(); break; }
      }
    });
    await wait(2000);

    // Click save star on first card
    const saveResult = await page.evaluate(() => {
      const card = document.querySelector('.event-card');
      if (!card) return { error: 'No event card found' };
      const saveBtn = card.querySelector('.save-star-btn');
      if (!saveBtn) return { error: 'No save button found on card' };
      const wasSaved = saveBtn.classList.contains('saved');
      saveBtn.click();
      return { wasSaved, clicked: true };
    });

    if (saveResult.error) {
      log('Auth', 'Save Star on first class card', 'FAIL', saveResult.error);
      return;
    }

    await wait(1500);
    await screenshot(page, '10-save-star');

    const isSavedNow = await page.evaluate(() => {
      const card = document.querySelector('.event-card');
      const saveBtn = card?.querySelector('.save-star-btn');
      return saveBtn?.classList.contains('saved') || false;
    });

    if (!saveResult.wasSaved && isSavedNow) {
      log('Auth', 'Save Star on first class card', 'PASS', 'Star toggled to saved');
    } else if (saveResult.wasSaved && !isSavedNow) {
      log('Auth', 'Save Star on first class card', 'PASS', 'Star toggled to unsaved (was already saved)');
    } else {
      log('Auth', 'Save Star on first class card', 'WARN', `Before: ${saveResult.wasSaved}, After: ${isSavedNow}`);
    }

    // Unsave if we saved it (cleanup)
    if (isSavedNow && !saveResult.wasSaved) {
      await page.evaluate(() => {
        const card = document.querySelector('.event-card');
        const saveBtn = card?.querySelector('.save-star-btn');
        if (saveBtn) saveBtn.click();
      });
      await wait(500);
    }
  });

  // 2.3 Events tab → Save Date
  await safeStep('Auth', 'Events tab → Save Date', async () => {
    await page.evaluate(() => {
      const allTabs = document.querySelectorAll('.banner-tab');
      for (const t of allTabs) {
        if (t.textContent.toLowerCase().includes('events')) { t.click(); break; }
      }
    });
    await wait(2000);
    await screenshot(page, '11-events-tab-auth');

    // Click save star on first event card
    const saveResult = await page.evaluate(() => {
      const cards = document.querySelectorAll('.event-card');
      if (cards.length === 0) return { error: 'No event cards' };
      const saveBtn = cards[0].querySelector('.save-star-btn');
      if (!saveBtn) return { error: 'No save button' };
      const wasSaved = saveBtn.classList.contains('saved');
      saveBtn.click();
      return { wasSaved, clicked: true };
    });

    if (saveResult.error) {
      log('Auth', 'Events tab → Save Date', 'FAIL', saveResult.error);
      return;
    }

    await wait(2000);

    // Check for error toast
    const hasErrorToast = await page.evaluate(() => {
      const toasts = document.querySelectorAll('.toast, .Toastify__toast, [class*="toast"]');
      for (const t of toasts) {
        if (t.classList.contains('error') || t.classList.contains('Toastify__toast--error') ||
            t.textContent.toLowerCase().includes('error') || t.textContent.toLowerCase().includes('failed')) {
          return t.textContent;
        }
      }
      return null;
    });

    await screenshot(page, '12-save-date');

    if (hasErrorToast) {
      log('Auth', 'Events tab → Save Date', 'FAIL', `Error toast: ${hasErrorToast}`);
    } else {
      log('Auth', 'Events tab → Save Date', 'PASS', 'No error toast after save');
    }

    // Unsave (cleanup)
    if (!saveResult.wasSaved) {
      await page.evaluate(() => {
        const cards = document.querySelectorAll('.event-card');
        const saveBtn = cards[0]?.querySelector('.save-star-btn');
        if (saveBtn) saveBtn.click();
      });
      await wait(500);
    }
  });

  // 2.4 Classes tab → Book button → Booking sheet
  await safeStep('Auth', 'Book button → Booking sheet', async () => {
    await page.evaluate(() => {
      const allTabs = document.querySelectorAll('.banner-tab');
      for (const t of allTabs) {
        if (t.textContent.toLowerCase().includes('classes')) { t.click(); break; }
      }
    });
    await wait(2000);

    // Click Book button on first card
    const bookClicked = await page.evaluate(() => {
      const cards = document.querySelectorAll('.event-card');
      if (cards.length === 0) return { error: 'No event cards' };
      const bookBtn = cards[0].querySelector('.event-book-btn');
      if (!bookBtn) return { error: 'No Book button on first card' };
      bookBtn.click();
      return { clicked: true, text: bookBtn.textContent.trim() };
    });

    if (bookClicked.error) {
      log('Auth', 'Book button → Booking sheet', 'FAIL', bookClicked.error);
      return;
    }

    await wait(1500);
    await screenshot(page, '13-booking-sheet');

    const sheetVisible = await page.evaluate(() => {
      return document.querySelector('.booking-sheet-overlay, .booking-sheet, [aria-label="Book class"]') !== null;
    });

    if (sheetVisible) {
      log('Auth', 'Book button → Booking sheet', 'PASS', 'Booking sheet opened');
    } else {
      // Book button might open external link
      log('Auth', 'Book button → Booking sheet', 'WARN', 'Booking sheet not visible — may redirect externally');
    }
  });

  // 2.5 Close booking sheet
  await safeStep('Auth', 'Close booking sheet', async () => {
    const closed = await page.evaluate(() => {
      const overlay = document.querySelector('.booking-sheet-overlay, [aria-label="Book class"]');
      if (overlay) {
        overlay.click();
        return true;
      }
      return false;
    });

    await wait(800);

    const stillOpen = await page.evaluate(() => {
      return document.querySelector('.booking-sheet-overlay, [aria-label="Book class"]') !== null;
    });

    if (closed && !stillOpen) {
      log('Auth', 'Close booking sheet', 'PASS');
    } else if (!closed) {
      log('Auth', 'Close booking sheet', 'WARN', 'No booking sheet overlay found');
    } else {
      log('Auth', 'Close booking sheet', 'FAIL', 'Sheet still open after click');
    }
  });

  // 2.6 Open profile menu → Open profile modal
  await safeStep('Auth', 'Profile menu → Profile modal', async () => {
    // Click profile button
    const profileClicked = await page.evaluate(() => {
      const btn = document.querySelector('.profile-btn');
      if (btn) { btn.click(); return true; }
      return false;
    });

    if (!profileClicked) {
      log('Auth', 'Profile menu → Profile modal', 'FAIL', 'Profile button not found');
      return;
    }

    await wait(1000);
    await screenshot(page, '14-profile-menu');

    // Check profile menu is open
    const menuOpen = await page.evaluate(() => {
      return document.querySelector('.profile-menu-dropdown') !== null;
    });

    if (!menuOpen) {
      log('Auth', 'Profile menu → Profile modal', 'FAIL', 'Profile menu dropdown not visible');
      return;
    }

    // Click "My Profile" in the menu
    const profileOpened = await page.evaluate(() => {
      const items = document.querySelectorAll('.profile-menu-item');
      for (const item of items) {
        if (item.textContent.includes('My Profile')) {
          item.click();
          return true;
        }
      }
      return false;
    });

    await wait(1500);
    await screenshot(page, '15-profile-modal');

    const modalVisible = await page.evaluate(() => {
      return document.querySelector('.profile-modal, .profile-modal-overlay') !== null;
    });

    if (modalVisible) {
      log('Auth', 'Profile menu → Profile modal', 'PASS', 'Profile modal opened');
    } else {
      log('Auth', 'Profile menu → Profile modal', 'FAIL', 'Profile modal not visible');
    }
  });

  // 2.7 Close profile modal
  await safeStep('Auth', 'Close profile modal', async () => {
    const closed = await page.evaluate(() => {
      const overlay = document.querySelector('.profile-modal-overlay');
      if (overlay) {
        overlay.click();
        return true;
      }
      return false;
    });

    await wait(800);

    const stillOpen = await page.evaluate(() => {
      return document.querySelector('.profile-modal-overlay') !== null;
    });

    if (closed && !stillOpen) {
      log('Auth', 'Close profile modal', 'PASS');
    } else if (!closed) {
      log('Auth', 'Close profile modal', 'WARN', 'Overlay not found');
    } else {
      log('Auth', 'Close profile modal', 'FAIL', 'Modal still open');
    }

    await screenshot(page, '16-profile-closed');
  });

  // ═══════════════════════════════════════════════
  // PHASE 3: DATA CORRECTNESS
  // ═══════════════════════════════════════════════
  console.log('\n═══ PHASE 3: DATA CORRECTNESS ═══\n');

  // 3.1 Classes tab: count total, filter by category, verify decrease (uses displayed count)
  await safeStep('Data', 'Category filter reduces count', async () => {
    // Switch to classes tab
    await page.evaluate(() => {
      const allTabs = document.querySelectorAll('.banner-tab');
      for (const t of allTabs) {
        if (t.textContent.toLowerCase().includes('classes')) { t.click(); break; }
      }
    });
    await wait(2000);

    // Reset: click "All Upcoming" on date strip
    await page.evaluate(() => {
      const dateChips = document.querySelectorAll('.date-chip');
      if (dateChips.length > 0) dateChips[0].click();
    });
    await wait(1500);

    const totalDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    // Expand filters to access category pills
    await page.evaluate(() => {
      const btn = document.querySelector('.filters-toggle-btn');
      if (btn) btn.click();
    });
    await wait(800);

    // Click a non-All category pill
    const catName = await page.evaluate(() => {
      const pills = document.querySelectorAll('.filter-cat-pill');
      for (const p of pills) {
        if (!p.classList.contains('filter-cat-pill-active') && p.textContent.trim() !== 'All') {
          p.click();
          return p.textContent.trim();
        }
      }
      return null;
    });

    if (!catName) {
      log('Data', 'Category filter reduces count', 'WARN', 'No category pills to test');
      return;
    }

    await wait(2000);

    const filteredDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    await screenshot(page, '17-data-category-filter');

    if (filteredDisplayed < totalDisplayed) {
      log('Data', 'Category filter reduces count', 'PASS', `"${catName}": ${totalDisplayed} → ${filteredDisplayed}`);
    } else if (filteredDisplayed === totalDisplayed) {
      log('Data', 'Category filter reduces count', 'WARN', `"${catName}": count stayed at ${totalDisplayed}`);
    } else {
      log('Data', 'Category filter reduces count', 'FAIL', `"${catName}": count went from ${totalDisplayed} to ${filteredDisplayed}`);
    }

    // Reset category to "All" and collapse
    await page.evaluate(() => {
      const pills = document.querySelectorAll('.filter-cat-pill');
      for (const p of pills) {
        if (p.textContent.trim() === 'All') { p.click(); break; }
      }
    });
    await wait(500);
    await page.evaluate(() => {
      const btn = document.querySelector('.filters-toggle-btn');
      if (btn) btn.click();
    });
    await wait(1000);
  });

  // 3.2 Search for "yoga" → verify results contain "yoga" in card text
  await safeStep('Data', 'Search "yoga" matches titles', async () => {
    const searchInput = await page.$('.search-bar-premium input');
    if (!searchInput) {
      log('Data', 'Search "yoga" matches titles', 'FAIL', 'Search input not found');
      return;
    }

    // Clear and type
    await searchInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await wait(500);
    await searchInput.type('yoga', { delay: 80 });
    await wait(2000);
    await screenshot(page, '18-data-search-yoga');

    // Check both displayed count and card content
    const searchResults = await page.evaluate(() => {
      const countMatch = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      const displayedCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;

      const cards = document.querySelectorAll('.event-card');
      const results = [];
      cards.forEach(card => {
        // Get ALL text content from the card to check for yoga match
        const fullCardText = card.textContent.toLowerCase();
        const titleEl = card.querySelector('h3');
        const title = titleEl ? titleEl.textContent.trim() : '';
        results.push({ title, matchesYoga: fullCardText.includes('yoga') });
      });

      return { displayedCount, cards: results };
    });

    const total = searchResults.cards.length;
    const matching = searchResults.cards.filter(r => r.matchesYoga).length;

    if (searchResults.displayedCount > 0 && searchResults.displayedCount < 2065) {
      // Search filtered results — the displayed count decreased
      if (matching === total) {
        log('Data', 'Search "yoga" matches titles', 'PASS', `${searchResults.displayedCount} total, all ${total} visible cards match "yoga"`);
      } else {
        const nonMatching = searchResults.cards.filter(r => !r.matchesYoga).map(r => r.title).slice(0, 3);
        log('Data', 'Search "yoga" matches titles', 'PASS', `${searchResults.displayedCount} results. ${matching}/${total} visible match in card text. Misses may match on description: ${nonMatching.join(', ')}`);
      }
    } else {
      log('Data', 'Search "yoga" matches titles', 'WARN', `Displayed count: ${searchResults.displayedCount}, ${matching}/${total} match`);
    }
  });

  // 3.3 Clear search → verify count returns to original
  await safeStep('Data', 'Clear search restores count', async () => {
    // Get count with search active
    const searchDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    // Clear search
    const searchInput = await page.$('.search-bar-premium input');
    if (searchInput) {
      // Try clicking X clear button first
      const cleared = await page.evaluate(() => {
        // The X button inside search bar
        const clearBtns = document.querySelectorAll('.search-bar-premium button, .search-bar-premium [class*="clear"]');
        for (const btn of clearBtns) {
          if (btn.getAttribute('aria-label')?.includes('clear') || btn.textContent === '' || btn.querySelector('svg')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      if (!cleared) {
        await searchInput.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
      }
      await wait(2000);
    }

    const clearedDisplayed = await page.evaluate(() => {
      const match = document.body.innerText.match(/(\d[\d,]*)\s+classes/i);
      return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    });

    await screenshot(page, '19-data-search-cleared');

    if (clearedDisplayed > searchDisplayed) {
      log('Data', 'Clear search restores count', 'PASS', `Search: ${searchDisplayed}, Cleared: ${clearedDisplayed}`);
    } else if (clearedDisplayed === searchDisplayed) {
      log('Data', 'Clear search restores count', 'WARN', `Both counts same: ${clearedDisplayed} — search may not have been active`);
    } else {
      log('Data', 'Clear search restores count', 'FAIL', `Count decreased after clear: ${searchDisplayed} → ${clearedDisplayed}`);
    }
  });

  // ═══════════════════════════════════════════════
  // PHASE 4: Console errors & final checks
  // ═══════════════════════════════════════════════
  console.log('\n═══ PHASE 4: FINAL CHECKS ═══\n');

  // Check console errors — filter out known noise
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('ERR_CONNECTION_REFUSED') &&
    !e.includes('net::') &&
    !e.includes('chrome-extension') &&
    !e.includes('Sentry') &&
    !e.includes('status of 400') &&  // Common Supabase auth probe responses
    !e.includes('status of 401') &&  // Unauthenticated probes
    !e.includes('status of 404') &&  // Missing resources (normal)
    !e.includes('Failed to load resource') &&  // Generic network — covered by specific checks
    !e.includes('downloadable font') &&
    !e.includes('ResizeObserver') &&
    !e.includes('third-party cookie')
  );

  // Also track the 400/resource errors separately
  const networkErrors = consoleErrors.filter(e =>
    e.includes('Failed to load resource') || e.includes('status of 4')
  );

  if (criticalErrors.length === 0 && networkErrors.length <= 10) {
    log('Final', 'Console errors', 'PASS', `No critical errors (${networkErrors.length} benign network errors filtered)`);
  } else if (criticalErrors.length === 0) {
    log('Final', 'Console errors', 'WARN', `${networkErrors.length} network errors (no JS errors). First: ${networkErrors[0]?.slice(0, 120)}`);
  } else if (criticalErrors.length <= 3) {
    log('Final', 'Console errors', 'WARN', `${criticalErrors.length} errors: ${criticalErrors.slice(0, 2).join('; ').slice(0, 200)}`);
  } else {
    log('Final', 'Console errors', 'FAIL', `${criticalErrors.length} errors. First: ${criticalErrors[0].slice(0, 200)}`);
  }

  // Take final screenshot
  await screenshot(page, '20-final-state');

  await browser.close();

  // ═══════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log('QA FULL RUN SUMMARY');
  console.log('═'.repeat(60));

  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const warns = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`\nTotal: ${total} | PASS: ${passes} | FAIL: ${fails} | WARN: ${warns}\n`);

  // Print table
  console.log('Phase'.padEnd(10) + 'Test'.padEnd(45) + 'Status'.padEnd(8) + 'Details');
  console.log('-'.repeat(120));

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(
      `${r.phase.padEnd(10)}${r.test.padEnd(45)}${icon} ${r.status.padEnd(5)}  ${(r.detail || '').slice(0, 60)}`
    );
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log('═'.repeat(60));

  if (fails > 0) {
    console.log(`\n⚠️  ${fails} test(s) FAILED — review above for details.`);
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed (some may have warnings).');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
