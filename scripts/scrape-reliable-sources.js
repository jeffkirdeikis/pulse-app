#!/usr/bin/env node

/**
 * Unified Reliable Sources Scraper
 *
 * Scrapes ALL known reliable sources from the database-driven list.
 * Each source has a specific booking system that determines which scraper to use.
 *
 * Run: node scripts/scrape-reliable-sources.js
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';
import {
  classExists,
  insertClass,
  deleteOldClasses,
  parseTime,
  getTodayPacific,
  getEndDatePacific,
  validateScrapedData,
  retryWithBackoff,
  parseDateHeader
} from './lib/scraper-utils.js';
import { sendTelegramAlert as telegramAlert } from './lib/alerting.js';
import {
  RELIABLE_SOURCES,
  getSourcesBySystem,
  recordScrapeSuccess,
  recordScrapeFailure,
  syncSourcesToDatabase
} from './lib/reliable-sources.js';
import { scrapePerfectMindCalendars } from './scrape-perfectmind.js';

puppeteer.use(StealthPlugin());

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();
const DAYS_TO_SCRAPE = 30;

// User-agent rotation to reduce fingerprinting risk
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];
function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

// Helper: extract sorted date headers from page text for stale detection
function extractDateHeaders(text) {
  return text.split('\n').map(l => parseDateHeader(l.trim())).filter(Boolean).sort().join(',');
}

// Stats tracking
const stats = {
  sourcesAttempted: 0,
  sourcesSuccessful: 0,
  classesFound: 0,
  classesAdded: 0,
  insertFailures: 0,
  eventsFound: 0,
  eventsAdded: 0,
  errors: []
};

// Track per-source results for post-run analysis
const sourceResults = [];

// All utility functions (parseTime, getTodayPacific, getEndDatePacific,
// classExists, insertClass, deleteOldClasses, validateScrapedData) are
// imported from ./lib/scraper-utils.js

/**
 * Extract price from nearby text lines around a class listing.
 * Looks for patterns like "$20", "$25.00", "Free", "$0".
 * Returns { price, isFree, priceDescription } or null if no price found.
 */
function extractPrice(lines, startIdx, lookAhead = 4) {
  for (let j = Math.max(0, startIdx - 1); j <= Math.min(lines.length - 1, startIdx + lookAhead); j++) {
    const line = lines[j];
    // Match "$XX" or "$XX.XX"
    const dollarMatch = line.match(/\$(\d+(?:\.\d{2})?)/);
    if (dollarMatch) {
      const amount = parseFloat(dollarMatch[1]);
      if (amount === 0) {
        return { price: 0, isFree: true, priceDescription: 'Free' };
      }
      return { price: amount, isFree: false, priceDescription: `$${dollarMatch[1]}` };
    }
    // Match "Free" as standalone or in context like "Free class"
    if (/\bfree\b/i.test(line) && !/free\s*trial/i.test(line) && !/free\s*parking/i.test(line)) {
      return { price: 0, isFree: true, priceDescription: 'Free' };
    }
  }
  return null;
}

// Pricing stats
let pricesFound = 0;
let pricesNotFound = 0;

// ============================================================
// MINDBODY WIDGET SCRAPER (HealCode)
// ============================================================

async function scrapeMindbodyWidget(source, browser) {
  console.log(`\n📍 ${source.name} (Mindbody Widget)`);
  console.log('-'.repeat(50));

  let classesFound = 0;
  let classesAdded = 0;

  try {
    const todayStr = getTodayPacific();
    const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

    // Use direct Mindbody Widget API (numeric ID) instead of loading
    // the full JS-rendered widget page (hex embed ID) in Puppeteer.
    // The API returns pre-rendered HTML that can be parsed without a browser.
    console.log(`   Using Mindbody API for widget ID: ${source.widget_id}`);

    // Phase 1: Collect all classes into memory first
    const collectedClasses = [];

    for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
      // Use Pacific-timezone-aware date to avoid UTC shift at evening scrape times
      const dateStr = getEndDatePacific(dayOffset);

      if (dateStr < todayStr || dateStr > endDateStr) continue;

      const apiUrl = `https://widgets.mindbodyonline.com/widgets/schedules/${source.widget_id}/load_markup?options%5Bstart_date%5D=${dateStr}`;

      let data;
      try {
        data = await retryWithBackoff(async () => {
          const response = await fetch(apiUrl);
          if (response.status === 404 || response.status === 410) {
            if (dayOffset === 0) {
              console.log(`   ⚠️ Widget ID may be invalid: HTTP ${response.status}`);
              await telegramAlert(`🚨 Invalid Widget ID: ${source.name}\nWidget ID ${source.widget_id} returned HTTP ${response.status}. Studio may have changed Mindbody config.`);
            }
            return null;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('json')) {
            if (dayOffset === 0) {
              await telegramAlert(`⚠️ Mindbody API Format Change: ${source.name}\nAPI returned ${contentType} instead of JSON. API may have changed.`);
            }
            return null;
          }
          return response.json();
        }, { maxRetries: 2, baseDelay: 1000, label: `${source.name} API` });
      } catch {
        continue;
      }

      if (!data || !data.class_sessions) {
        if (dayOffset === 0 && data && !data.class_sessions) {
          console.log(`   ⚠️ API response missing class_sessions. Keys: ${Object.keys(data).join(', ')}`);
          await telegramAlert(`⚠️ Mindbody API Structure Change\nWidget ${source.widget_id} response missing "class_sessions". Keys: ${Object.keys(data).join(', ')}`);
        }
        continue;
      }

      // Parse HTML from API response
      let html = data.class_sessions;
      html = html
        .replace(/\\u003c/g, '<')
        .replace(/\\u003e/g, '>')
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\\//g, '/');

      // Extract class data from the HTML
      const classNames = [...html.matchAll(/data-bw-widget-mbo-class-name="([^"]+)"/g)].map(m => m[1]);
      const startTimes = [...html.matchAll(/<time class="hc_starttime" datetime="[^"]*">\s*([^<]+)<\/time>/g)].map(m => m[1].trim());
      const endTimes = [...html.matchAll(/<time class="hc_endtime" datetime="[^"]*">\s*([^<]+)<\/time>/g)].map(m => m[1].trim());
      const instructors = [...html.matchAll(/<div class="bw-session__staff"[^>]*>\s*([^\n<]+)/g)].map(m => m[1].trim());
      // Try to extract prices from HTML (e.g., price attributes, "$XX" text)
      const prices = [...html.matchAll(/\$(\d+(?:\.\d{2})?)/g)].map(m => parseFloat(m[1]));
      // If there's exactly one price per class, map them; otherwise no price data
      const hasPerClassPrices = prices.length === classNames.length && prices.length > 0;

      // Guard: if arrays desync, Mindbody HTML structure may have changed
      if (classNames.length > 0 && classNames.length !== startTimes.length) {
        console.warn(`   ⚠️ HTML parse mismatch on ${dateStr}: ${classNames.length} names vs ${startTimes.length} times — Mindbody HTML may have changed`);
        if (dayOffset === 0) {
          await telegramAlert(`⚠️ Mindbody HTML mismatch for ${source.name}: ${classNames.length} names vs ${startTimes.length} times. HTML structure may have changed.`);
        }
      }
      const safeLen = Math.min(classNames.length, startTimes.length);

      if (classNames.length > 0) {
        // Parse dateStr back for display (dateStr is already Pacific-correct YYYY-MM-DD)
        const [yr, mo, dy] = dateStr.split('-').map(Number);
        const displayDate = new Date(yr, mo - 1, dy);
        const dayName = displayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        console.log(`   ${dayName}: ${classNames.length} classes`);
      }

      for (let i = 0; i < safeLen; i++) {
        const className = classNames[i]
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        const startTime = startTimes[i] || '';
        const instructor = instructors[i]?.replace(/\s+/g, ' ').trim() || '';

        if (!className || !startTime) continue;

        classesFound++;
        stats.classesFound++;

        const parsedTime = parseTime(startTime);
        const parsedEndTime = endTimes[i] ? parseTime(endTimes[i]) : null;
        // Pass price if available from HTML
        const classPrice = hasPerClassPrices ? prices[i] : null;
        const priceData = classPrice != null
          ? { price: classPrice, isFree: classPrice === 0, priceDescription: classPrice === 0 ? 'Free' : `$${classPrice.toFixed(2)}` }
          : {};
        if (classPrice != null) pricesFound++; else pricesNotFound++;

        collectedClasses.push({
          title: className,
          time: parsedTime,
          endTime: parsedEndTime,
          instructor: instructor,
          venueName: source.name,
          address: source.address,
          category: source.category,
          date: dateStr,
          bookingSystem: 'mindbody-widget',
          ...priceData
        });
      }

      // Small delay between API requests
      await new Promise(r => setTimeout(r, 300));
    }

    // Phase 2: Delete old data ONLY after confirming scrape found classes
    // Must delete BEFORE inserting so new data isn't caught by the delete filter
    if (collectedClasses.length > 0) {
      await deleteOldClasses(source.name, todayStr, 'mindbody-widget');
    }

    // Phase 3: Insert all collected classes
    for (const cls of collectedClasses) {
      const exists = await classExists(cls.title, cls.date, cls.venueName, cls.time);
      if (exists) continue;

      const success = await insertClass(cls);
      if (success) {
        classesAdded++;
        stats.classesAdded++;
      } else {
        stats.insertFailures++;
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: null });
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: error.message });
    await recordScrapeFailure(source.name, error.message);
  }

  return { classesFound, classesAdded };
}

// ============================================================
// MINDBODY CLASSIC SCRAPER
// ============================================================

function parseClassicSchedule(text, source) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Adaptive date header parsing — handles multiple formats
    const parsedDate = parseDateHeader(line);
    if (parsedDate) {
      currentDate = parsedDate;
      continue;
    }

    // Check for time pattern
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:am|pm))\s*PST$/i);
    if (timeMatch && currentDate) {
      // For future dates, Mindbody Classic inserts "(X Reserved, Y Open)" between
      // the time and the class name. Skip this availability line if present.
      let nameOffset = 1;
      const nextLine = lines[i + 1] || '';
      if (/^\(\d+ Reserved, \d+ Open\)$/.test(nextLine)) {
        nameOffset = 2; // Skip availability line
      }

      const className = lines[i + nameOffset];
      if (!className) continue;
      if (/cancelled|all service|all class|all teachers|today|day|week/i.test(className)) continue;
      if (/^open gym$/i.test(className)) continue;
      if (/^\(\d+ Reserved/.test(className)) continue; // Safety: skip any remaining availability text

      let instructor = lines[i + nameOffset + 1] || '';
      if (/^\d+\s*(hour|minute|hr|min)/i.test(instructor)) instructor = '';
      if (/^coach$/i.test(instructor)) instructor = '';

      // Look for price in nearby lines
      const priceInfo = extractPrice(lines, i, 5);
      if (priceInfo) pricesFound++; else pricesNotFound++;

      classes.push({
        title: className,
        time: parseTime(timeMatch[1]),
        instructor,
        venueName: source.name,
        address: source.address,
        category: source.category,
        date: currentDate,
        bookingSystem: 'mindbody-classic',
        ...(priceInfo || {})
      });
    }
  }

  // Deduplicate
  const seen = new Set();
  return classes.filter(c => {
    const key = `${c.title}-${c.time}-${c.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapeMindbodyClassic(source, browser) {
  console.log(`\n📍 ${source.name} (Mindbody Classic)`);
  console.log('-'.repeat(50));

  const page = await browser.newPage();
  let classesFound = 0;
  let classesAdded = 0;

  try {
    await page.setUserAgent(randomUA());
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setViewport({ width: 1280, height: 900 });

    const todayStr = getTodayPacific();
    const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

    console.log(`   Loading: ${source.url}`);
    await retryWithBackoff(async () => {
      await page.goto(`https://clients.mindbodyonline.com/classic/mainclass?studioid=${source.studio_id}`, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    }, { maxRetries: 2, baseDelay: 3000, label: `${source.name} page load` });
    await new Promise(r => setTimeout(r, 3000));

    // Detect if studio migrated from Classic to new Mindbody
    const currentUrl = page.url();
    const initialText = await page.evaluate(() => document.body.innerText);
    const migrationText = /this studio has moved|updated booking experience|new mindbody experience/i.test(initialText);
    const redirectedAway = !currentUrl.includes('mindbodyonline.com');
    if (migrationText || redirectedAway) {
      const msg = `${source.name} (ID: ${source.studio_id}) appears to have migrated from Mindbody Classic`;
      console.log(`   ⚠️ MIGRATION DETECTED: ${msg}`);
      await telegramAlert(`🚨 Mindbody Classic Migration: ${source.name}\n${msg}. Classic scraper will no longer work. Update to mindbody-widget.`);
      throw new Error('Studio migrated from Mindbody Classic');
    }
    // Warn (but don't fail) if redirected within Mindbody but away from Classic
    if (!currentUrl.includes('classic/mainclass')) {
      console.log(`   ⚠️ Unexpected URL after navigation: ${currentUrl} (may be transient)`);
    }

    // Click on the correct tab
    if (source.tab_id) {
      const tabClicked = await page.evaluate((tabId) => {
        const tabs = document.querySelectorAll('li[onclick]');
        for (const tab of tabs) {
          const onclick = tab.getAttribute('onclick') || '';
          if (onclick.includes('tabID=' + tabId)) {
            tab.click();
            return true;
          }
        }
        return false;
      }, source.tab_id);
      if (!tabClicked) {
        console.warn(`   ⚠️ Tab ID ${source.tab_id} not found — scraping default tab`);
        await telegramAlert(`⚠️ ${source.name}: Tab ID ${source.tab_id} not found on Mindbody Classic page. Scraping default tab.`);
      }
      await new Promise(r => setTimeout(r, 5000));
    }

    // Scrape multiple weeks
    const allClasses = [];
    const WEEKS_TO_SCRAPE = 5;
    let lastClassicDates = '';

    for (let week = 0; week < WEEKS_TO_SCRAPE; week++) {
      const text = await page.evaluate(() => document.body.innerText);

      if (text.includes('Security Check') || text.includes('Verifying you are human')) {
        throw new Error('Blocked by security check');
      }

      // Stale page detection: compare date headers only (not full text)
      // This avoids false positives from timestamps or dynamic content
      const currentDates = extractDateHeaders(text);
      if (week > 0 && (currentDates === lastClassicDates || currentDates === '')) {
        console.log(`   Week ${week + 1}: Date headers unchanged after navigation, stopping`);
        break;
      }
      lastClassicDates = currentDates;

      const weekClasses = parseClassicSchedule(text, source);
      allClasses.push(...weekClasses);

      if (week < WEEKS_TO_SCRAPE - 1) {
        const clicked = await page.evaluate(() => {
          const weekArrowRight = document.querySelector('#week-arrow-r');
          if (weekArrowRight) {
            weekArrowRight.click();
            return 'week-arrow-r';
          }
          // Fallback selectors for navigation resilience
          const fallbackSelectors = [
            '.date-arrow-r',
            'a[href*="fw=1"]',
            '.next-week',
            '[class*="arrow-right"]',
            '[class*="next"]',
            'a[title*="Next"]',
            '.fa-chevron-right',
            '.fa-arrow-right'
          ];
          for (const sel of fallbackSelectors) {
            const btn = document.querySelector(sel);
            if (btn) {
              btn.click();
              return sel;
            }
          }
          return null;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 3000));
        } else {
          console.log(`   Week ${week + 1}: Could not find next week button (tried all fallback selectors)`);
          break;
        }
      }
    }

    // Deduplicate and filter by date
    const seen = new Set();
    const classes = allClasses.filter(c => {
      const key = `${c.title}-${c.time}-${c.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return c.date >= todayStr && c.date <= endDateStr;
    });

    classesFound = classes.length;
    stats.classesFound += classesFound;

    // Delete old data BEFORE inserting — but only after confirming scrape succeeded
    if (classesFound > 0) {
      await deleteOldClasses(source.name, todayStr, 'mindbody-classic');
    }

    // Now insert the collected classes
    for (const cls of classes) {
      const exists = await classExists(cls.title, cls.date, cls.venueName, cls.time);
      if (exists) continue;

      const success = await insertClass(cls);
      if (success) {
        classesAdded++;
        stats.classesAdded++;
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: null });
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: error.message });
    await recordScrapeFailure(source.name, error.message);
  } finally {
    await page.close();
  }

  return { classesFound, classesAdded };
}

// ============================================================
// WELLNESSLIVING SCRAPER (Web scraping)
// ============================================================

/**
 * Parse WellnessLiving schedule text into classes grouped by date.
 * WellnessLiving pages show a weekly view with day headers like:
 *   "Thursday, February 05, 2026"
 * followed by classes with time ranges like:
 *   "7:00pm - 8:00pm"
 *   "Candlelight Radiant Yin"
 *   "with Chloe Nudo"
 */
function parseWellnessLivingSchedule(text, source) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Adaptive date header parsing — handles all known WellnessLiving formats
    const parsedDate = parseDateHeader(line);
    if (parsedDate) {
      currentDate = parsedDate;
      continue;
    }

    if (!currentDate) continue;

    // Match time ranges like "7:00pm - 8:00pm" or "9:30am - 10:30am"
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))$/i);
    if (!timeMatch) continue;

    const startTime = timeMatch[1];
    const endTime = timeMatch[2];

    // Next line should be the class name (as a link or plain text)
    const className = (i + 1 < lines.length) ? lines[i + 1] : '';
    if (!className || className.length < 3 || className.length > 100) continue;
    // Skip non-class lines
    if (/^(Book Now|Filter|Today|translate|Login|person|event|\d+\s*capacity)/i.test(className)) continue;

    // Check for instructor on the line after class name
    // WellnessLiving may show "Paula Johnson" or "Shelby Lewis SUB"
    let instructor = '';
    if (i + 2 < lines.length) {
      const instrLine = lines[i + 2].replace(/\s+SUB$/i, '').trim();
      // Broad instructor name match: handles "Paula Johnson", "O'Brien", "van der Berg", all-caps
      const instrMatch = instrLine.match(/^(?:with\s+)?([A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z'.-]+){0,3})$/);
      if (instrMatch) {
        instructor = instrMatch[1].trim();
      }
    }

    // Look for price in nearby lines
    const priceInfo = extractPrice(lines, i, 5);
    if (priceInfo) pricesFound++; else pricesNotFound++;

    classes.push({
      title: className.trim(),
      time: parseTime(startTime),
      endTime: parseTime(endTime),
      instructor,
      venueName: source.name,
      address: source.address,
      category: source.category,
      date: currentDate,
      bookingSystem: 'wellnessliving',
      ...(priceInfo || {})
    });
  }

  // Deduplicate (same title + same date + same time)
  const seen = new Set();
  return classes.filter(c => {
    const key = `${c.title}-${c.date}-${c.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapeWellnessLiving(source, browser) {
  console.log(`\n📍 ${source.name} (WellnessLiving)`);
  console.log('-'.repeat(50));

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  let classesFound = 0;
  let classesAdded = 0;

  try {
    const todayStr = getTodayPacific();

    console.log(`   Loading: ${source.url}`);
    await retryWithBackoff(async () => {
      await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 });
    }, { maxRetries: 2, baseDelay: 3000, label: `${source.name} page load` });
    await new Promise(r => setTimeout(r, 5000));

    // Detect Imperva WAF block
    const wlPageContent = await page.evaluate(() => document.body.innerText);
    if (/Checking your browser|Access Denied|Pardon Our Interruption|Human Verification|Enable JavaScript and cookies/i.test(wlPageContent)) {
      const msg = `Imperva WAF is blocking Puppeteer for ${source.name}. Stealth plugin may no longer be effective.`;
      console.log(`   ⚠️ WAF BLOCKED: ${msg}`);
      await telegramAlert(`🚨 WAF Block: ${source.name}\n${msg}\n\nManual action needed.`);
      throw new Error('Blocked by Imperva WAF');
    }

    // WellnessLiving shows a weekly schedule with day headers.
    // Navigate week by week to cover DAYS_TO_SCRAPE days.
    // Phase 1: Collect all classes into memory
    const collectedWLClasses = [];
    const weeksNeeded = Math.ceil(DAYS_TO_SCRAPE / 7);
    let lastWLDates = '';

    for (let week = 0; week < weeksNeeded; week++) {
      if (week > 0) {
        // Navigate to next week using the forward arrow/button
        let navSuccess = false;
        try {
          const nextWeekBtn = await page.$('button[aria-label*="Next"], button[aria-label*="next"], .rs-schedule-next, [class*="next-week"], [class*="arrow-right"], a[title*="Next"], .fa-chevron-right, .fa-arrow-right');
          if (nextWeekBtn) {
            await nextWeekBtn.click();
            await new Promise(r => setTimeout(r, 3000));
            navSuccess = true;
          } else {
            // Try clicking a ">" or right arrow by text content
            const arrows = await page.$$('button, a, span');
            for (const arrow of arrows) {
              const text = await arrow.evaluate(el => el.textContent.trim());
              if (text === '>' || text === '›' || text === '→' || text === '▶') {
                await arrow.click();
                await new Promise(r => setTimeout(r, 3000));
                navSuccess = true;
                break;
              }
            }
          }
        } catch (navErr) {
          console.log(`   [wellnessliving] Could not navigate to week ${week + 1}: ${navErr.message}`);
        }

        if (!navSuccess) {
          console.log(`   [wellnessliving] No next-week button found for week ${week + 1}, stopping`);
          break;
        }
      }

      // Extract the full page text and parse day-by-day
      const pageText = await page.evaluate(() => document.body.innerText);

      // Stale page detection: compare date headers only (not full text)
      const currentDates = extractDateHeaders(pageText);
      if (week > 0 && (currentDates === lastWLDates || currentDates === '')) {
        console.log(`   [wellnessliving] Date headers unchanged after navigation, stopping`);
        break;
      }
      lastWLDates = currentDates;
      const classes = parseWellnessLivingSchedule(pageText, source);

      console.log(`   Week ${week + 1}: Found ${classes.length} classes across ${new Set(classes.map(c => c.date)).size} days`);

      for (const cls of classes) {
        // Skip classes before today
        if (cls.date < todayStr) continue;
        collectedWLClasses.push(cls);
      }
    }

    classesFound = collectedWLClasses.length;
    stats.classesFound += classesFound;

    // Phase 2: Delete old data BEFORE inserting — only after confirming scrape succeeded
    if (classesFound > 0) {
      await deleteOldClasses(source.name, todayStr, 'wellnessliving');
    }

    // Phase 3: Insert collected classes
    for (const cls of collectedWLClasses) {
      const exists = await classExists(cls.title, cls.date, source.name, cls.time);
      if (exists) continue;

      const success = await insertClass(cls);
      if (success) {
        classesAdded++;
        stats.classesAdded++;
      } else {
        stats.insertFailures++;
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: null });
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: error.message });
    await recordScrapeFailure(source.name, error.message);
  } finally {
    await page.close();
  }

  return { classesFound, classesAdded };
}

// ============================================================
// BRANDEDWEB SCRAPER (Mindbody branded widgets)
// ============================================================

/**
 * Parse Brandedweb (Mindbody) schedule text into classes with date headers.
 * Brandedweb pages may show day headers like "Tuesday, February 10, 2026"
 * or "Tue, Feb 10" followed by class listings with time/duration/name/instructor.
 */
function parseBrandedwebSchedule(text, source) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Try adaptive date parser for any date header format
    const parsed = parseDateHeader(line);
    if (parsed) {
      currentDate = parsed;
      continue;
    }

    if (!currentDate) continue;

    // Check if line is a time (e.g., "8:30 AM", "6:00 PM")
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
    if (!timeMatch) continue;

    // Next line should be duration
    if (i + 1 >= lines.length) continue;
    const durationLine = lines[i + 1];
    if (!/^\d+\s*min$/i.test(durationLine)) continue;

    // Next line should be class name
    if (i + 2 >= lines.length) continue;
    const className = lines[i + 2];
    if (!className || className.length < 3 || className.length > 100) continue;
    if (/^(Show Details|Book|Oxygen|Squamish|\d)/.test(className)) continue;

    // Next line might be instructor
    const instructor = (i + 3 < lines.length) ? lines[i + 3] : '';
    const cleanInstructor = /^(Show Details|Book|Oxygen|\d)/.test(instructor) ? '' : instructor;

    // Look for price in nearby lines
    const priceInfo = extractPrice(lines, i, 6);
    if (priceInfo) pricesFound++; else pricesNotFound++;

    classes.push({
      title: className,
      time: parseTime(timeMatch[1]),
      instructor: cleanInstructor,
      venueName: source.name,
      address: source.address,
      category: source.category,
      date: currentDate,
      bookingSystem: 'brandedweb',
      ...(priceInfo || {})
    });
  }

  // Deduplicate by title + date + time
  const seen = new Set();
  return classes.filter(c => {
    const key = `${c.title}-${c.date}-${c.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapeBrandedweb(source, browser) {
  console.log(`\n📍 ${source.name} (Brandedweb)`);
  console.log('-'.repeat(50));

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  let classesFound = 0;
  let classesAdded = 0;

  try {
    const todayStr = getTodayPacific();

    console.log(`   Loading: ${source.url}`);
    await retryWithBackoff(
      () => page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 }),
      { label: `${source.name} page load` }
    );
    await new Promise(r => setTimeout(r, 3000));

    // Brandedweb pages show a weekly schedule. Navigate week-by-week.
    // Phase 1: Collect all classes into memory
    const collectedBWClasses = [];
    const bwWeeksNeeded = Math.ceil(DAYS_TO_SCRAPE / 7);
    let lastBWDates = '';

    for (let week = 0; week < bwWeeksNeeded; week++) {
      if (week > 0) {
        // Try to navigate to next week
        try {
          const clicked = await page.evaluate(() => {
            // Look for forward/next navigation elements
            const selectors = [
              'button[aria-label*="Next"]', 'button[aria-label*="next"]',
              'button[aria-label*="Forward"]', '.next-week', '[class*="next"]',
              '[class*="forward"]', '.fa-chevron-right', '.fa-arrow-right'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) { el.click(); return true; }
            }
            // Try arrow buttons by text
            const buttons = document.querySelectorAll('button, a, span');
            for (const btn of buttons) {
              const text = btn.textContent.trim();
              if (text === '>' || text === '›' || text === '→' || text === '▶' || text === 'Next') {
                btn.click();
                return true;
              }
            }
            return false;
          });

          if (clicked) {
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.log(`   ⚠️ Could not navigate to week ${week + 1}, stopping`);
            break;
          }
        } catch (navErr) {
          console.log(`   ⚠️ Navigation error week ${week + 1}: ${navErr.message}`);
          break;
        }
      }

      // Extract page text and compare date headers for stale detection
      const pageText = await page.evaluate(() => document.body.innerText);
      const currentDates = extractDateHeaders(pageText);
      if (week > 0 && (currentDates === lastBWDates || currentDates === '')) {
        console.log(`   ⚠️ Date headers unchanged after navigation, stopping`);
        break;
      }
      lastBWDates = currentDates;

      // Parse classes with date headers from the page text
      const classes = parseBrandedwebSchedule(pageText, source);

      const dates = new Set(classes.map(c => c.date));
      console.log(`   Week ${week + 1}: Found ${classes.length} classes across ${dates.size} days`);

      for (const cls of classes) {
        if (cls.date < todayStr) continue;
        collectedBWClasses.push(cls);
      }
    }

    classesFound = collectedBWClasses.length;
    stats.classesFound += classesFound;

    // Phase 2: Delete old data BEFORE inserting — only after confirming scrape succeeded
    if (classesFound > 0) {
      await deleteOldClasses(source.name, todayStr, 'brandedweb');
    }

    // Phase 3: Insert collected classes
    for (const cls of collectedBWClasses) {
      const exists = await classExists(cls.title, cls.date, cls.venueName, cls.time);
      if (exists) continue;

      const success = await insertClass(cls);
      if (success) {
        classesAdded++;
        stats.classesAdded++;
      } else {
        stats.insertFailures++;
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: null });
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: error.message });
    await recordScrapeFailure(source.name, error.message);
  } finally {
    await page.close();
  }

  return { classesFound, classesAdded };
}

// ============================================================
// SENDMOREGETBETA SCRAPER (Climbing gyms)
// ============================================================

// Keywords for fitness classes (not climbing courses)
const FITNESS_KEYWORDS = ['yoga', 'pilates', 'capoeira', 'tai chi', 'fitness', 'strength', 'cardio', 'hiit'];
const EXCLUDE_KEYWORDS = ['room hire', 'nicas', 'wild climbers', 'climbing'];

function isFitnessClass(className) {
  const lower = className.toLowerCase();
  const hasFitness = FITNESS_KEYWORDS.some(kw => lower.includes(kw));
  const hasExclude = EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
  return hasFitness && !hasExclude;
}

function parseSendMoreClasses(text, source) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];

    // Try adaptive date parser for any date header format
    const parsed = parseDateHeader(line);
    if (parsed) {
      currentDate = parsed;
      continue;
    }

    // Check for time range like "10:00 AM - 11:00 AM"
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
    if (timeMatch && currentDate) {
      const prevLine = i > 0 ? lines[i - 1] : '';
      if (prevLine && !prevLine.match(/(\w+),\s*\d{1,2}(?:st|nd|rd|th)/) &&
          !prevLine.match(/^(translate|Login|person|event)/i)) {
        // Look for price in nearby lines
        const priceInfo = extractPrice(lines, i, 4);
        if (priceInfo) pricesFound++; else pricesNotFound++;

        classes.push({
          title: prevLine,
          time: parseTime(timeMatch[1]),
          endTime: parseTime(timeMatch[2]),
          venueName: source.name,
          address: source.address,
          category: source.category,
          date: currentDate,
          bookingSystem: 'sendmoregetbeta',
          ...(priceInfo || {})
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  return classes.filter(c => {
    const key = `${c.title}-${c.time}-${c.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapeSendMoreGetBeta(source, browser) {
  console.log(`\n📍 ${source.name} (SendMoreGetBeta)`);
  console.log('-'.repeat(50));

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  let classesFound = 0;
  let classesAdded = 0;

  try {
    const todayStr = getTodayPacific();
    const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

    console.log(`   Loading: ${source.url}`);
    await retryWithBackoff(
      () => page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 }),
      { label: `${source.name} page load` }
    );
    await new Promise(r => setTimeout(r, 5000));

    // Phase 1: Collect all classes from the widget text
    const text = await page.evaluate(() => document.body.innerText);
    const allSMClasses = parseSendMoreClasses(text, source);

    // Filter for fitness classes and date range (string comparison avoids UTC issues)
    const collectedSMClasses = allSMClasses.filter(cls =>
      cls.date >= todayStr && cls.date <= endDateStr && isFitnessClass(cls.title)
    );

    classesFound = collectedSMClasses.length;
    stats.classesFound += classesFound;

    // Phase 2: Delete old data BEFORE inserting — only after confirming scrape succeeded
    if (classesFound > 0) {
      await deleteOldClasses(source.name, todayStr, 'sendmoregetbeta');
    }

    // Phase 3: Insert collected classes
    for (const cls of collectedSMClasses) {
      const exists = await classExists(cls.title, cls.date, cls.venueName, cls.time);
      if (exists) continue;

      const success = await insertClass(cls);
      if (success) {
        classesAdded++;
        stats.classesAdded++;
      } else {
        stats.insertFailures++;
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: null });
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
    sourceResults.push({ name: source.name, classesFound, classesAdded, error: error.message });
    await recordScrapeFailure(source.name, error.message);
  } finally {
    await page.close();
  }

  return { classesFound, classesAdded };
}

// ============================================================
// MAIN SCRAPER ORCHESTRATOR
// ============================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🎯 RELIABLE SOURCES SCRAPER');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Sources: ${RELIABLE_SOURCES.length}`);
  console.log(`Scrape window: ${DAYS_TO_SCRAPE} days`);
  console.log('='.repeat(70));

  // Sync sources to database (ensures recordScrapeSuccess/Failure has rows to update)
  await syncSourcesToDatabase();

  // List all sources
  console.log('\n📋 Sources to scrape:');
  for (const source of RELIABLE_SOURCES) {
    console.log(`   • ${source.name} (${source.booking_system})`);
  }

  const BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage'];
  const RESTART_EVERY = 4; // Restart browser every N sources to prevent memory leaks

  let browser = await puppeteer.launch({ headless: 'new', args: BROWSER_ARGS });

  try {
    for (let idx = 0; idx < RELIABLE_SOURCES.length; idx++) {
      const source = RELIABLE_SOURCES[idx];
      stats.sourcesAttempted++;

      // Restart browser periodically to prevent memory leaks
      if (idx > 0 && idx % RESTART_EVERY === 0) {
        console.log(`\n   🔄 Restarting browser (after ${idx} sources)...`);
        try { await browser.close(); } catch (e) { /* ignore */ }
        browser = await puppeteer.launch({ headless: 'new', args: BROWSER_ARGS });
      }

      switch (source.booking_system) {
        case 'mindbody-widget':
          await scrapeMindbodyWidget(source, browser);
          break;
        case 'mindbody-classic':
          await scrapeMindbodyClassic(source, browser);
          break;
        case 'wellnessliving':
          await scrapeWellnessLiving(source, browser);
          break;
        case 'brandedweb':
          await scrapeBrandedweb(source, browser);
          break;
        case 'sendmoregetbeta':
          await scrapeSendMoreGetBeta(source, browser);
          break;
        case 'perfectmind': {
          const pmResult = await scrapePerfectMindCalendars(source, browser);
          stats.classesFound += pmResult.classesFound;
          stats.classesAdded += pmResult.classesAdded;
          if (pmResult.classesFound > 0) stats.sourcesSuccessful++;
          sourceResults.push({ name: source.name, classesFound: pmResult.classesFound, classesAdded: pmResult.classesAdded, error: null });
          await recordScrapeSuccess(source.name, pmResult.classesFound);
          break;
        }
        default:
          console.log(`\n⚠️  Unknown booking system: ${source.booking_system} for ${source.name}`);
          stats.errors.push({ source: source.name, error: `Unknown booking system: ${source.booking_system}` });
      }

      // Post-scrape validation: detect and remove duplicated schedules
      await validateScrapedData(source.name, source.booking_system);

      // Zero-result detection: alert immediately when a source finds nothing
      const lastResult = sourceResults[sourceResults.length - 1];
      if (lastResult && lastResult.classesFound === 0 && !lastResult.error) {
        console.warn(`   ⚠️ ZERO CLASSES from ${source.name} — possible silent failure`);
        await telegramAlert(`⚠️ Scraper: ${source.name} returned 0 classes (${source.booking_system}). Possible format change or site issue.`);
      }

      // Brief pause between sources
      await new Promise(r => setTimeout(r, 2000));
    }
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { console.warn('Browser close error:', e.message); }
    }
  }

  // Final report
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Sources:    ${stats.sourcesSuccessful}/${stats.sourcesAttempted} successful`);
  console.log(`Classes:    ${stats.classesFound} found, ${stats.classesAdded} added`);
  console.log(`Events:     ${stats.eventsFound} found, ${stats.eventsAdded} added`);
  if (stats.insertFailures > 0) {
    console.log(`Inserts:    ${stats.insertFailures} failed`);
  }
  console.log(`Pricing:    ${pricesFound} with price, ${pricesNotFound} without (defaulted to "See venue for pricing")`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(e => console.log(`   • ${e.source}: ${e.error}`));
  }

  console.log(`\nCompleted: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));

  // Send Telegram summary if there were any issues
  const zeroSources = sourceResults.filter(r => r.classesFound === 0 && !r.error);
  const errorSources = sourceResults.filter(r => r.error);
  const hasIssues = zeroSources.length > 0 || errorSources.length > 0 || stats.insertFailures > 10;

  if (hasIssues) {
    const lines = [`📊 Scraper Run Complete — Issues Detected`];
    lines.push(`Sources: ${stats.sourcesSuccessful}/${stats.sourcesAttempted} | Classes: ${stats.classesFound} found, ${stats.classesAdded} added`);
    if (zeroSources.length > 0) {
      lines.push(`\n⚠️ Zero-result sources (${zeroSources.length}):`);
      zeroSources.forEach(r => lines.push(`  • ${r.name}`));
    }
    if (errorSources.length > 0) {
      lines.push(`\n❌ Failed sources (${errorSources.length}):`);
      errorSources.forEach(r => lines.push(`  • ${r.name}: ${r.error}`));
    }
    if (stats.insertFailures > 10) {
      lines.push(`\n🔴 High insert failure rate: ${stats.insertFailures} failures`);
    }
    await telegramAlert(lines.join('\n'));
  }
}

main().catch(console.error);
