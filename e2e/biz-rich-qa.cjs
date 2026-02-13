/**
 * Business Dashboard QA — Brennan Park (rich data: 1463 events)
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp/biz-rich-qa';
const ADMIN_EMAIL = 'admin-test-panel@pulse-app.ca';
const ADMIN_PASS = 'AdminTest1234!';

let browser, page;
let passed = 0, failed = 0, total = 0;

function assert(cond, name) {
  total++;
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
}

async function shot(name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
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

  // Go to Admin
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.view-switcher button')].find(b => b.textContent.trim() === 'Admin');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Scroll to Venue Management and search for Brennan Park
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Venue Management'));
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));

  const searchInput = await page.$('input[placeholder*="Search venues"]');
  if (searchInput) {
    await searchInput.type('Brennan Park');
    await new Promise(r => setTimeout(r, 1000));
  }

  // Click impersonate (eye icon = 2nd button) on the Brennan Park card
  const impersonated = await page.evaluate(() => {
    const cards = document.querySelectorAll('.venue-card-admin, [class*="venue-card"]');
    for (const card of cards) {
      if (card.textContent.includes('Brennan Park')) {
        const btns = card.querySelectorAll('button');
        if (btns.length >= 2) { btns[1].click(); return true; }
      }
    }
    return false;
  });
  console.log(`Impersonated Brennan Park: ${impersonated}`);
  await new Promise(r => setTimeout(r, 2500));

  const inBizView = await page.evaluate(() => {
    const text = document.querySelector('.business-view-premium')?.textContent || '';
    return text.includes('PULSE') || text.includes('Pulse Score');
  });
  assert(inBizView, 'Brennan Park business dashboard loaded');

  if (inBizView) {
    await shot('01-brennan-top');

    const text = await page.evaluate(() => document.querySelector('.business-view-premium')?.textContent || '');

    // Pulse Score
    const scoreNum = await page.evaluate(() => document.querySelector('.pulse-score-num')?.textContent?.trim());
    console.log(`  Pulse Score: ${scoreNum}`);
    assert(parseInt(scoreNum) > 0, `Pulse Score > 0: ${scoreNum}`);

    const breakdowns = await page.evaluate(() =>
      [...document.querySelectorAll('.breakdown-val')].map(el => el.textContent.trim())
    );
    console.log(`  Breakdowns: ${breakdowns.join(', ')}`);
    assert(breakdowns.some(v => v !== '0%' && v !== 'N/A'), 'Some breakdowns have non-zero values');

    // Scroll to stats
    await page.evaluate(() => {
      const el = document.querySelector('.premium-stats-grid');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('02-brennan-stats');

    // Profile views
    const profileViews = await page.evaluate(() => {
      const el = document.querySelector('.stat-value-large');
      return el ? el.textContent.trim() : '0';
    });
    console.log(`  Profile Views: ${profileViews}`);

    // Weekly Goals
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Weekly Goals'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('03-brennan-goals');

    const completedGoals = await page.evaluate(() => document.querySelectorAll('.goal-status.complete').length);
    console.log(`  Completed goals: ${completedGoals}/4`);
    // Brennan should have 10+ listings goal complete
    const listingsGoalBar = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('.goal-progress-bar > div')];
      return bars.map(b => b.style.width);
    });
    console.log(`  Goal progress: ${listingsGoalBar.join(', ')}`);

    // Badges
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Business Badges'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('04-brennan-badges');

    const earned = await page.evaluate(() => document.querySelectorAll('.badge-item.earned').length);
    const locked = await page.evaluate(() => document.querySelectorAll('.badge-item.locked').length);
    console.log(`  Badges: ${earned} earned, ${locked} locked`);
    assert(earned > 0, `Brennan Park has earned badges: ${earned}`);

    // Top Performing
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Top Performing'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('05-brennan-top-performing');

    const topCards = await page.evaluate(() => document.querySelectorAll('.top-class-card').length);
    console.log(`  Top performing cards: ${topCards}`);
    assert(topCards >= 1, `Brennan Park has top performing items: ${topCards}`);

    // Check top card has real title and views
    const topCardInfo = await page.evaluate(() => {
      const card = document.querySelector('.top-class-card');
      if (!card) return null;
      return {
        title: card.querySelector('h3')?.textContent?.trim(),
        views: card.querySelector('.stat-value')?.textContent?.trim(),
      };
    });
    if (topCardInfo) {
      console.log(`  Top item: "${topCardInfo.title}" (${topCardInfo.views} views)`);
      assert(topCardInfo.title && topCardInfo.title !== 'No data yet', `Top item has real title: "${topCardInfo.title}"`);
    }

    // Active Listings
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Active Listings'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('06-brennan-listings');

    const listingRows = await page.evaluate(() => document.querySelectorAll('.listing-row').length);
    console.log(`  Active listings: ${listingRows}`);
    assert(listingRows > 0, `Brennan Park has active listings: ${listingRows}`);

    // Audience Overview
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Audience Overview'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await new Promise(r => setTimeout(r, 500));
    await shot('07-brennan-audience');

    const audienceNumbers = await page.evaluate(() => {
      const nums = [...document.querySelectorAll('.audience-section div[style*="font-size: 24px"]')];
      return nums.map(n => n.textContent.trim());
    });
    console.log(`  Audience metrics: ${audienceNumbers.join(', ')}`);
    // Active Listings should be > 0
    assert(audienceNumbers.length === 3, `3 audience metrics shown: ${audienceNumbers.join(', ')}`);
  }

  await browser.close();
  console.log('\n══════════════════════════════════════');
  console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`  Screenshots: ${SCREENSHOT_DIR}/`);
  console.log('══════════════════════════════════════');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
