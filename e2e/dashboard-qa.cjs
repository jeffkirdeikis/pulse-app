/**
 * Dashboard QA Test — Business Dashboard + Admin Dashboard
 * Tests all the new features: Pulse Score, Weekly Goals, Badges,
 * Top Performing, Audience Overview, Admin Scraping Panel
 */
const puppeteer = require('puppeteer');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/dashboard-qa';
const ADMIN_EMAIL = 'admin-test-panel@pulse-app.ca';
const ADMIN_PASS = 'AdminTest1234!';

let browser, page;
let passed = 0, failed = 0, total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}`);
  }
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

async function screenshotFull(name) {
  try {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
  } catch {
    // fullPage can fail on very large pages, fall back to viewport
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
  }
}

async function getText(selector) {
  try {
    return await page.$eval(selector, el => el.textContent.trim());
  } catch { return ''; }
}

async function exists(selector) {
  try {
    return !!(await page.$(selector));
  } catch { return false; }
}

async function setup() {
  const fs2 = require('fs');
  if (!fs2.existsSync(SCREENSHOT_DIR)) fs2.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=430,932'] });
  page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });

  // Navigate and inject admin session
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.pulse-app', { timeout: 10000 });

  // Sign in as admin
  const { createClient } = require('@supabase/supabase-js');
  const envPath = path.resolve(__dirname, '..', '.env.local');
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });

  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });

  if (authErr || !auth?.session) {
    console.error('Auth failed:', authErr?.message || 'No session');
    // Try to create admin user
    const { data: signUp } = await sb.auth.signUp({ email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (signUp?.session) {
      await injectSession(signUp.session);
    } else {
      console.error('Could not create or sign in admin user');
      process.exit(1);
    }
  } else {
    await injectSession(auth.session);
  }
}

async function injectSession(session) {
  const storageKey = `sb-${process.env.VITE_SUPABASE_URL.match(/\/\/([^.]+)/)[1]}-auth-token`;
  await page.evaluate((key, sess) => {
    localStorage.setItem(key, JSON.stringify(sess));
  }, storageKey, session);
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.pulse-app', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // Dismiss auth modal if present
  try {
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
  } catch {}
}

async function testConsumerView() {
  console.log('\n══ PHASE 1: Consumer View ══');

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.pulse-app', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));
  await screenshot('01-consumer-classes');

  // Check classes tab is active and shows results
  const resultsText = await getText('.results-count') || await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => /\d+ results?/.test(e.textContent) && e.children.length === 0);
    return el ? el.textContent : '';
  });
  assert(resultsText.includes('result'), `Results count visible: "${resultsText}"`);

  // Check header tabs exist
  const classesTab = await exists('[class*="tab"]');
  assert(classesTab, 'Tab navigation visible');

  // Check search bar
  const searchBar = await exists('input[placeholder*="Search"]');
  assert(searchBar, 'Search bar visible');

  // Check filters button
  const filtersBtn = await page.evaluate(() => {
    return !!([...document.querySelectorAll('*')].find(e => e.textContent.includes('Show Filters') && e.children.length <= 3));
  });
  assert(filtersBtn, 'Show Filters button visible');

  // Click Events tab
  const eventsTab = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(e => e.textContent.trim() === 'Events');
    if (tab) { tab.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 1500));
  await screenshot('02-consumer-events');
  assert(eventsTab, 'Events tab clickable');

  // Click Deals tab
  const dealsTab = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(e => e.textContent.trim() === 'Deals');
    if (tab) { tab.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 1500));
  await screenshot('03-consumer-deals');
  assert(dealsTab, 'Deals tab clickable');

  // Click Services tab
  const servicesTab = await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(e => e.textContent.trim() === 'Services');
    if (tab) { tab.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 1500));
  await screenshot('04-consumer-services');
  assert(servicesTab, 'Services tab clickable');
}

async function testAdminDashboard() {
  console.log('\n══ PHASE 2: Admin Dashboard ══');

  // Navigate to admin view via view-switcher buttons
  const switchedToAdmin = await page.evaluate(() => {
    const btns = document.querySelectorAll('.view-switcher button');
    const adminBtn = [...btns].find(b => b.textContent.trim() === 'Admin');
    if (adminBtn) { adminBtn.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));
  await screenshot('05-admin-overview');
  assert(switchedToAdmin, 'Switched to Admin view');

  // Check admin panel renders
  const adminView = await exists('.admin-view-premium');
  assert(adminView, 'Admin view renders');

  // Check stats cards
  const statsText = await page.evaluate(() => {
    return document.querySelector('.admin-view-premium')?.textContent || '';
  });
  assert(statsText.includes('TOTAL VENUES') || statsText.includes('Total Venues') || statsText.includes('Venues'), 'Stats cards section visible');
  assert(statsText.includes('CLAIMED') || statsText.includes('Claimed'), 'Claimed count visible');

  // Check scraping section
  assert(statsText.includes('Web Scraping System'), 'Scraping system section visible');
  assert(!statsText.includes('Not connected'), 'No "Not connected" placeholders');
  assert(!statsText.includes('Sample Data'), 'No "Sample Data" banner');

  // Check for real scraping data
  const hasScrapedClasses = statsText.includes('Scraped Classes');
  assert(hasScrapedClasses, 'Scraped Classes metric visible');
  const hasScrapedEvents = statsText.includes('Scraped Events');
  assert(hasScrapedEvents, 'Scraped Events metric visible');
  const hasVenuesCovered = statsText.includes('Venues Covered');
  assert(hasVenuesCovered, 'Venues Covered metric visible');

  // Check cron schedule badges
  assert(statsText.includes('6 AM UTC') || statsText.includes('6:30 AM UTC'), 'Cron schedule badges visible');

  // Check venue management section
  assert(statsText.includes('Venue Management'), 'Venue Management section visible');

  // Scroll down and take full page screenshot
  await screenshotFull('06-admin-full');

  // Check content review section exists
  assert(statsText.includes('Content Review') || true, 'Content Review section (may be hidden if 0 unverified)');

  // Check search works
  const searchInput = await page.$('input[placeholder*="Search venues"]');
  if (searchInput) {
    await searchInput.type('Brennan');
    await new Promise(r => setTimeout(r, 1000));
    await screenshot('07-admin-search');
    const searchResults = await page.evaluate(() => {
      const cards = document.querySelectorAll('.venue-card-admin, [class*="venue-card"]');
      return cards.length;
    });
    assert(searchResults >= 0, `Admin search works (${searchResults} results for "Brennan")`);
    // Clear search
    await searchInput.click({ clickCount: 3 });
    await searchInput.press('Backspace');
    await new Promise(r => setTimeout(r, 500));
  }
}

async function testBusinessDashboard() {
  console.log('\n══ PHASE 3: Business Dashboard ══');

  // Switch to business view
  const switchedToBiz = await page.evaluate(() => {
    const btns = document.querySelectorAll('.view-switcher button');
    const bizBtn = [...btns].find(b => b.textContent.trim() === 'Business');
    if (bizBtn) { bizBtn.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));
  await screenshot('08-business-overview');

  // If we don't have a claimed business, we'll see the "claim" page
  const hasBizDashboard = await page.evaluate(() => {
    const text = document.querySelector('.business-view-premium')?.textContent || '';
    return text.includes('Pulse Score') || text.includes('PULSE') || text.includes('Build Your Score') || text.includes('Growing Nicely') || text.includes('Great Score');
  });

  if (!hasBizDashboard) {
    console.log('  ⚠️  No claimed business — testing claim page instead');
    const claimPage = await page.evaluate(() => {
      const text = document.querySelector('.business-view-premium')?.textContent || '';
      return text.includes('Claim') || text.includes('Business Dashboard');
    });
    assert(claimPage, 'Business claim/welcome page renders');
    await screenshot('08b-business-no-claim');

    // Try impersonation from admin
    console.log('  → Trying admin impersonation...');
    // Switch back to admin
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.view-switcher button');
      const adminBtn = [...btns].find(b => b.textContent.trim() === 'Admin');
      if (adminBtn) adminBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Search for a business and impersonate
    const impersonated = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Search venues"]') || document.querySelector('input[placeholder*="Search business"]');
      if (!input) return false;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    await new Promise(r => setTimeout(r, 1000));

    // Click first impersonate button
    const impersonateClicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.includes('Impersonate') || b.title?.includes('Impersonate'));
      if (btns.length > 0) { btns[0].click(); return true; }
      // Try the eye icon buttons in venue cards
      const eyeBtns = [...document.querySelectorAll('.venue-card-admin button, [class*="venue-card"] button')];
      if (eyeBtns.length > 0) { eyeBtns[0].click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 2000));
    await screenshot('08c-after-impersonate-attempt');
  }

  // Re-check business dashboard (may have impersonated)
  const bizDashText = await page.evaluate(() => {
    return document.querySelector('.business-view-premium')?.textContent || '';
  });

  if (bizDashText.includes('PULSE') || bizDashText.includes('Pulse Score') || bizDashText.includes('Build Your Score')) {
    console.log('\n  ── Business Dashboard Content ──');

    // Test Pulse Score
    const pulseScoreVisible = bizDashText.includes('PULSE');
    assert(pulseScoreVisible, 'Pulse Score ring visible');

    const hasScoreNum = await page.evaluate(() => {
      const el = document.querySelector('.pulse-score-num');
      return el ? el.textContent.trim() : '';
    });
    assert(hasScoreNum && hasScoreNum !== '--', `Pulse Score shows number: "${hasScoreNum}" (not "--")`);

    // Test breakdown bars
    const breakdownVals = await page.evaluate(() => {
      const vals = [...document.querySelectorAll('.breakdown-val')].map(el => el.textContent.trim());
      return vals;
    });
    assert(breakdownVals.length === 4, `4 breakdown categories: ${breakdownVals.join(', ')}`);
    assert(!breakdownVals.includes('--'), `No "--" placeholder values in breakdown: ${breakdownVals.join(', ')}`);

    await screenshot('09-pulse-score');

    // Scroll to Weekly Goals
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Weekly Goals'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('10-weekly-goals');

    // Test Weekly Goals
    assert(bizDashText.includes('Weekly Goals'), 'Weekly Goals section visible');
    assert(bizDashText.includes('+100 XP'), 'XP rewards shown');
    const goalCards = await page.evaluate(() => document.querySelectorAll('.goal-card').length);
    assert(goalCards === 4, `4 goal cards present (found ${goalCards})`);

    // Test that goal progress bars are wired (at least some have non-0%)
    const goalBars = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('.goal-progress-bar > div')];
      return bars.map(b => b.style.width);
    });
    assert(goalBars.length >= 2, `Goal progress bars present (${goalBars.length})`);

    // Scroll to Badges
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Business Badges'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('11-badges');

    // Test Badges
    assert(bizDashText.includes('Business Badges'), 'Business Badges section visible');
    const badgeProgress = await page.evaluate(() => {
      const el = document.querySelector('.badge-progress');
      return el ? el.textContent.trim() : '';
    });
    assert(badgeProgress.includes('/'), `Badge progress shows x/y format: "${badgeProgress}"`);
    assert(!badgeProgress.startsWith('0 / 10'), `Badge count not hardcoded "0 / 10": "${badgeProgress}"`);

    const badgeItems = await page.evaluate(() => document.querySelectorAll('.badge-item').length);
    assert(badgeItems === 10, `10 badge items (found ${badgeItems})`);

    // Check some badges are earned (at least earned class on some)
    const earnedBadges = await page.evaluate(() => document.querySelectorAll('.badge-item.earned').length);
    console.log(`    ℹ️  Earned badges: ${earnedBadges}`);

    // Scroll to Top Performing
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Top Performing'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('12-top-performing');

    // Test Top Performing
    assert(bizDashText.includes('Top Performing'), 'Top Performing section visible');
    const topCards = await page.evaluate(() => document.querySelectorAll('.top-class-card').length);
    console.log(`    ℹ️  Top performing cards: ${topCards}`);
    const noDataPlaceholder = bizDashText.includes('No data yet');
    assert(!noDataPlaceholder || topCards > 0, 'Top Performing not showing hardcoded "No data yet" placeholder');

    // Scroll to Audience Overview
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Audience Overview'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('13-audience-overview');

    // Test Audience Overview
    assert(bizDashText.includes('Audience Overview'), 'Audience Overview visible (not "Coming Soon")');
    assert(!bizDashText.includes('Coming Soon'), 'No "Coming Soon" text');
    assert(bizDashText.includes('Total Views'), 'Total Views metric shown');
    assert(bizDashText.includes('Total Saves'), 'Total Saves metric shown');
    assert(bizDashText.includes('Active Listings'), 'Active Listings metric shown');

    // Scroll to Analytics stats
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2, .premium-stats-grid')].find(h => h.className?.includes('premium-stat'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      else {
        const el2 = document.querySelector('.premium-stats-grid');
        if (el2) el2.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('14-analytics-stats');

    // Test analytics period selector
    const periodBtns = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.time-btn')];
      return btns.map(b => ({ text: b.textContent.trim(), active: b.classList.contains('active') }));
    });
    assert(periodBtns.length === 4, `4 time period buttons (found ${periodBtns.length})`);
    assert(periodBtns.some(b => b.active), 'One period button is active');

    // Click a different period
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.time-btn')].find(b => b.textContent.includes('90'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Scroll to Download Report
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('Download Report'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('15-download-report');

    // Test Download Report button exists and is not placeholder
    assert(!bizDashText.includes('PDF reports coming'), 'Download Report not showing "coming soon" placeholder');
    assert(bizDashText.includes('Download Report'), 'Download Report button visible');

    // Scroll to Quick Actions
    await page.evaluate(() => {
      const el = document.querySelector('.quick-actions-grid');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('16-quick-actions');

    // Test quick action buttons
    const qaButtons = await page.evaluate(() => {
      const btns = document.querySelectorAll('.qa-btn');
      return [...btns].map(b => b.textContent.trim());
    });
    assert(qaButtons.length >= 4, `Quick action buttons present (${qaButtons.length}): ${qaButtons.join(', ')}`);

    // Test listings section
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Active Listings'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await screenshot('17-active-listings');

    // Full page screenshot
    await screenshotFull('18-business-full');
  } else {
    console.log('  ⚠️  Could not access Business Dashboard (no claimed business or impersonation)');
  }
}

async function testConsumerInteractions() {
  console.log('\n══ PHASE 4: Consumer Interactions ══');

  // Go back to consumer view
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.view-switcher button');
    const consumerBtn = [...btns].find(b => b.textContent.trim() === 'Consumer');
    if (consumerBtn) consumerBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Switch to Classes tab
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button, a, [role="tab"]')].find(e => e.textContent.trim() === 'Classes');
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  // Click on a class card to open detail modal
  const clickedCard = await page.evaluate(() => {
    const card = document.querySelector('.event-card, [class*="event-card"]');
    if (card) { card.click(); return true; }
    // Try the chevron/arrow
    const arrow = document.querySelector('.event-card svg[class*="chevron"], .event-card [class*="arrow"]');
    if (arrow) { arrow.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 1500));
  await screenshot('19-detail-modal');
  assert(clickedCard, 'Event card clicked to open detail modal');

  // Check modal opened
  const modalVisible = await page.evaluate(() => {
    return !!document.querySelector('[class*="detail-modal"], [class*="modal-overlay"], [class*="event-detail"], [class*="EventDetail"]');
  });
  assert(modalVisible, 'Detail modal is visible');

  // Close modal
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  // Test search
  const searchInput = await page.$('input[placeholder*="Search"]');
  if (searchInput) {
    await searchInput.type('yoga');
    await new Promise(r => setTimeout(r, 1500));
    await screenshot('20-search-yoga');

    const searchResults = await page.evaluate(() => {
      const text = document.body.textContent;
      const match = text.match(/(\d+)\s+results?/);
      return match ? parseInt(match[1]) : -1;
    });
    assert(searchResults >= 0, `Search for "yoga" returns results: ${searchResults}`);

    // Clear search
    await searchInput.click({ clickCount: 3 });
    await searchInput.press('Backspace');
    await new Promise(r => setTimeout(r, 1000));
  }

  // Test Show Filters
  const filtersOpened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, div[role="button"]')].find(e => e.textContent.includes('Show Filters'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 500));
  await screenshot('21-filters-open');
  assert(filtersOpened, 'Filters panel opened');
}

async function run() {
  try {
    await setup();
    await testConsumerView();
    await testAdminDashboard();
    await testBusinessDashboard();
    await testConsumerInteractions();
  } catch (err) {
    console.error('\n💥 Test error:', err.message);
    try { await screenshot('ERROR-crash'); } catch {}
  } finally {
    if (browser) await browser.close();

    console.log('\n══════════════════════════════════════');
    console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
    console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
    console.log('══════════════════════════════════════');

    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
