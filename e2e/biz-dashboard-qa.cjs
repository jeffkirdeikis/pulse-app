/**
 * Business Dashboard QA — tests via admin impersonation
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/biz-dashboard-qa';
const ADMIN_EMAIL = 'admin-test-panel@pulse-app.ca';
const ADMIN_PASS = 'AdminTest1234!';

let browser, page;
let passed = 0, failed = 0, total = 0;

function assert(condition, testName) {
  total++;
  if (condition) { passed++; console.log(`  ✅ ${testName}`); }
  else { failed++; console.log(`  ❌ ${testName}`); }
}

async function shot(name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--window-size=430,932'] });
  page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });

  // Load env
  const envContent = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });

  // Sign in
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.pulse-app', { timeout: 10000 });

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: auth } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS });
  if (!auth?.session) { console.error('Auth failed'); process.exit(1); }

  const storageKey = `sb-${process.env.VITE_SUPABASE_URL.match(/\/\/([^.]+)/)[1]}-auth-token`;
  await page.evaluate((key, sess) => localStorage.setItem(key, JSON.stringify(sess)), storageKey, auth.session);
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.pulse-app', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2500));
  try { await page.keyboard.press('Escape'); await new Promise(r => setTimeout(r, 300)); } catch {}

  console.log('\n══ STEP 1: Navigate to Admin ══');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.view-switcher button')].find(b => b.textContent.trim() === 'Admin');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  await shot('01-admin');

  console.log('\n══ STEP 2: Impersonate a Business ══');
  // Search for Brennan Park (has lots of events)
  const searchInput = await page.$('input[placeholder*="View as business"]');
  if (searchInput) {
    await searchInput.type('Brennan');
    await new Promise(r => setTimeout(r, 1500));
    await shot('02-impersonate-search');

    // Click the first result in the impersonate dropdown
    const clicked = await page.evaluate(() => {
      // Look for dropdown results
      const items = document.querySelectorAll('.impersonate-result, [class*="impersonate"] li, [class*="impersonate"] button, [class*="impersonate"] div[role="option"]');
      if (items.length > 0) { items[0].click(); return 'dropdown-item'; }
      // Try any clickable element with "Brennan" text
      const els = [...document.querySelectorAll('button, div[role="button"], li')].filter(e => e.textContent.includes('Brennan'));
      if (els.length > 0) { els[0].click(); return 'text-match'; }
      return false;
    });
    console.log(`  Impersonate click: ${clicked}`);
    await new Promise(r => setTimeout(r, 2000));
    await shot('03-after-impersonate-click');
  }

  // Check if we're now in business view
  let inBizView = await page.evaluate(() => {
    const text = document.querySelector('.business-view-premium')?.textContent || '';
    return text.includes('PULSE') || text.includes('Pulse Score') || text.includes('Build Your Score') || text.includes('Growing Nicely') || text.includes('Great Score');
  });

  // If not in biz view, try clicking on a venue card's impersonate button
  if (!inBizView) {
    console.log('  Trying venue card impersonation...');
    // First go to admin and scroll to venue management
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.view-switcher button')].find(b => b.textContent.trim() === 'Admin');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll to venue cards
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Venue Management'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));

    // Click eye/impersonate icon on first venue card
    const impersonated = await page.evaluate(() => {
      // Look for eye icon buttons in venue cards
      const cards = document.querySelectorAll('.venue-card-admin, [class*="venue-card"]');
      for (const card of cards) {
        const btns = card.querySelectorAll('button');
        // The eye icon is typically the second button (edit, view, delete)
        for (const btn of btns) {
          if (btn.title?.includes('View') || btn.title?.includes('Impersonate') || btn.querySelector('svg[class*="eye"]')) {
            btn.click();
            return card.textContent.substring(0, 50);
          }
        }
        // Try second button (eye is often second)
        if (btns.length >= 2) {
          btns[1].click();
          return card.textContent.substring(0, 50);
        }
      }
      return false;
    });
    console.log(`  Venue impersonation: ${impersonated}`);
    await new Promise(r => setTimeout(r, 2500));
    await shot('04-after-venue-impersonate');

    inBizView = await page.evaluate(() => {
      const text = document.querySelector('.business-view-premium')?.textContent || '';
      return text.includes('PULSE') || text.includes('Pulse Score') || text.includes('Build Your Score');
    });
  }

  if (!inBizView) {
    console.log('  ⚠️  Still not in business dashboard, trying direct business view switch...');
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.view-switcher button')].find(b => b.textContent.trim() === 'Business');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await shot('04b-business-view-direct');
    inBizView = await page.evaluate(() => {
      const text = document.querySelector('.business-view-premium')?.textContent || '';
      return text.includes('PULSE') || text.includes('Pulse Score') || text.includes('Build Your Score');
    });
  }

  assert(inBizView, 'Business dashboard accessible');

  if (inBizView) {
    console.log('\n══ STEP 3: Business Dashboard Content ══');
    await shot('05-biz-dashboard-top');

    const text = await page.evaluate(() => document.querySelector('.business-view-premium')?.textContent || '');

    // === PULSE SCORE ===
    const scoreNum = await page.evaluate(() => {
      const el = document.querySelector('.pulse-score-num');
      return el ? el.textContent.trim() : '';
    });
    assert(scoreNum && scoreNum !== '--', `Pulse Score shows real number: "${scoreNum}"`);

    const breakdownVals = await page.evaluate(() =>
      [...document.querySelectorAll('.breakdown-val')].map(el => el.textContent.trim())
    );
    assert(breakdownVals.length === 4, `4 breakdown categories: ${breakdownVals.join(', ')}`);
    assert(!breakdownVals.includes('--'), `No "--" placeholders in breakdown`);

    // Check breakdown bars have non-zero widths
    const barWidths = await page.evaluate(() =>
      [...document.querySelectorAll('.breakdown-bar > div')].map(el => el.style.width)
    );
    console.log(`    Bar widths: ${barWidths.join(', ')}`);

    // Scroll to score title
    const scoreTitle = await page.evaluate(() => {
      const el = document.querySelector('.pulse-score-title h3');
      return el ? el.textContent.trim() : '';
    });
    console.log(`    Score title: "${scoreTitle}"`);

    // === ANALYTICS STATS ===
    await page.evaluate(() => {
      const el = document.querySelector('.premium-stats-grid');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('06-analytics-stats');

    const profileViews = await page.evaluate(() => {
      const el = [...document.querySelectorAll('.stat-label')].find(e => e.textContent.includes('Profile Views'));
      if (!el) return null;
      const card = el.closest('.premium-stat-card');
      const val = card?.querySelector('.stat-value-large');
      return val ? val.textContent.trim() : null;
    });
    console.log(`    Profile Views: ${profileViews}`);
    assert(profileViews !== null, `Profile Views stat card renders: "${profileViews}"`);

    // === WEEKLY GOALS ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Weekly Goals'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('07-weekly-goals');

    const goalCards = await page.evaluate(() => document.querySelectorAll('.goal-card').length);
    assert(goalCards === 4, `4 weekly goal cards (found ${goalCards})`);

    // Check for completed goals (green checkmarks)
    const completedGoals = await page.evaluate(() => document.querySelectorAll('.goal-status.complete').length);
    console.log(`    Completed goals: ${completedGoals}/4`);

    // Check progress bars exist
    const progressBars = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('.goal-progress-bar > div')];
      return bars.map(b => b.style.width);
    });
    assert(progressBars.length >= 2, `Goal progress bars rendered: ${progressBars.join(', ')}`);

    // === BADGES ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Business Badges'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('08-badges');

    const badgeCount = await page.evaluate(() => document.querySelectorAll('.badge-item').length);
    assert(badgeCount === 10, `10 badges rendered (found ${badgeCount})`);

    const earnedCount = await page.evaluate(() => document.querySelectorAll('.badge-item.earned').length);
    const lockedCount = await page.evaluate(() => document.querySelectorAll('.badge-item.locked').length);
    console.log(`    Earned: ${earnedCount}, Locked: ${lockedCount}`);
    assert(earnedCount + lockedCount === 10, `All badges have earned or locked class`);

    const badgeProgressText = await page.evaluate(() => {
      const el = document.querySelector('.badge-progress');
      return el ? el.textContent.trim() : '';
    });
    assert(badgeProgressText.includes(`${earnedCount} /`), `Badge progress text matches: "${badgeProgressText}"`);

    // === TOP PERFORMING ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Top Performing'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('09-top-performing');

    const topCards = await page.evaluate(() => document.querySelectorAll('.top-class-card').length);
    console.log(`    Top performing cards: ${topCards}`);
    // Should either show real cards or a helpful empty state (not "No data yet" placeholder)
    const hasPlaceholder = await page.evaluate(() => {
      const cards = document.querySelectorAll('.top-class-card');
      return [...cards].some(c => c.textContent.includes('No data yet'));
    });
    assert(!hasPlaceholder, 'Top Performing not showing "No data yet" hardcoded item');

    // === AUDIENCE OVERVIEW ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Audience Overview'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('10-audience-overview');

    assert(text.includes('Audience Overview'), 'Audience Overview section renders');
    assert(!text.includes('Coming Soon'), '"Coming Soon" text removed');
    assert(text.includes('Total Views'), 'Total Views metric');
    assert(text.includes('Total Saves'), 'Total Saves metric');
    assert(text.includes('Active Listings'), 'Active Listings metric');

    // === ACTIVE LISTINGS ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Active Listings'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('11-active-listings');

    const listingRows = await page.evaluate(() => document.querySelectorAll('.listing-row').length);
    console.log(`    Active listings: ${listingRows}`);

    // === INBOX ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Inbox'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('12-inbox');
    assert(text.includes('Inbox'), 'Inbox section renders');

    // === DOWNLOAD REPORT ===
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h3')].find(h => h.textContent.includes('Download Report'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('13-download-report');

    assert(text.includes('Download Report'), 'Download Report button text visible');
    assert(!text.includes('PDF reports coming'), '"PDF reports coming" placeholder removed');

    // === QUICK ACTIONS ===
    const qaButtons = await page.evaluate(() =>
      [...document.querySelectorAll('.qa-btn')].map(b => b.textContent.trim())
    );
    assert(qaButtons.length >= 4, `Quick action buttons: ${qaButtons.join(', ')}`);

    // === TIME PERIOD SWITCH ===
    console.log('\n══ STEP 4: Interaction Tests ══');

    // Click 90-day period
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.time-btn')].find(b => b.textContent.includes('90'));
      if (btn) { btn.click(); btn.scrollIntoView({ behavior: 'instant', block: 'center' }); }
    });
    await new Promise(r => setTimeout(r, 1500));
    const activePeriod = await page.evaluate(() => {
      const active = document.querySelector('.time-btn.active');
      return active ? active.textContent.trim() : '';
    });
    assert(activePeriod.includes('90'), `Time period switch works: "${activePeriod}"`);
    await shot('14-90-day-period');

    // Click New Event quick action
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.qa-btn')].find(b => b.textContent.includes('New Event'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    const submissionModalOpen = await page.evaluate(() =>
      !!document.querySelector('[class*="submission-modal"], [class*="modal-overlay"]')
    );
    await shot('15-new-event-modal');
    assert(submissionModalOpen, 'New Event quick action opens submission modal');

    // Close modal
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
  }

  // Cleanup
  await browser.close();

  console.log('\n══════════════════════════════════════');
  console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
  console.log('══════════════════════════════════════');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
