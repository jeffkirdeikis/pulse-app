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

puppeteer.use(StealthPlugin());

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();
const DAYS_TO_SCRAPE = 30;

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

    await deleteOldClasses(source.name, todayStr, 'mindbody-widget');

    // Use direct Mindbody Widget API (numeric ID) instead of loading
    // the full JS-rendered widget page (hex embed ID) in Puppeteer.
    // The API returns pre-rendered HTML that can be parsed without a browser.
    console.log(`   Using Mindbody API for widget ID: ${source.widget_id}`);

    const today = new Date();
    for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];

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

      if (classNames.length > 0) {
        const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        console.log(`   ${dayName}: ${classNames.length} classes`);
      }

      for (let i = 0; i < classNames.length; i++) {
        const className = classNames[i]
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        const startTime = startTimes[i] || '';
        const instructor = instructors[i]?.replace(/\s+/g, ' ').trim() || '';

        if (!className || !startTime) continue;

        classesFound++;
        stats.classesFound++;

        const parsedTime = parseTime(startTime);
        const exists = await classExists(className, dateStr, source.name, parsedTime);
        if (exists) continue;

        const parsedEndTime = endTimes[i] ? parseTime(endTimes[i]) : null;
        const success = await insertClass({
          title: className,
          time: parsedTime,
          endTime: parsedEndTime,
          instructor: instructor,
          venueName: source.name,
          address: source.address,
          category: source.category,
          date: dateStr,
          bookingSystem: 'mindbody-widget'
        });

        if (success) {
          classesAdded++;
          stats.classesAdded++;
        } else {
          stats.insertFailures++;
        }
      }

      // Small delay between API requests
      await new Promise(r => setTimeout(r, 300));
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
      const className = lines[i + 1];
      if (!className) continue;
      if (/cancelled|all service|all class|all teachers|today|day|week/i.test(className)) continue;
      if (/^open gym$/i.test(className)) continue;

      let instructor = lines[i + 2] || '';
      if (/^\d+\s*(hour|minute|hr|min)/i.test(instructor)) instructor = '';
      if (/^coach$/i.test(instructor)) instructor = '';

      classes.push({
        title: className,
        time: parseTime(timeMatch[1]),
        instructor,
        venueName: source.name,
        address: source.address,
        category: source.category,
        date: currentDate,
        bookingSystem: 'mindbody-classic'
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
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setViewport({ width: 1280, height: 900 });

    const todayStr = getTodayPacific();
    const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

    await deleteOldClasses(source.name, todayStr, 'mindbody-classic');

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
      await page.evaluate((tabId) => {
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
      await new Promise(r => setTimeout(r, 5000));
    }

    // Scrape multiple weeks
    const allClasses = [];
    const WEEKS_TO_SCRAPE = 5;
    let lastClassicPageText = '';

    for (let week = 0; week < WEEKS_TO_SCRAPE; week++) {
      const text = await page.evaluate(() => document.body.innerText);

      if (text.includes('Security Check') || text.includes('Verifying you are human')) {
        throw new Error('Blocked by security check');
      }

      // Stale page detection: if content didn't change after navigation, stop
      if (week > 0 && text === lastClassicPageText) {
        console.log(`   Week ${week + 1}: Page content unchanged after navigation, stopping`);
        break;
      }
      lastClassicPageText = text;

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

    for (const cls of classes) {
      classesFound++;
      stats.classesFound++;

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
      const instrMatch = instrLine.match(/^(?:with\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
      if (instrMatch) {
        instructor = instrMatch[1].trim();
      }
    }

    classes.push({
      title: className.trim(),
      time: parseTime(startTime),
      endTime: parseTime(endTime),
      instructor,
      venueName: source.name,
      address: source.address,
      category: source.category,
      date: currentDate,
      bookingSystem: 'wellnessliving'
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

    await deleteOldClasses(source.name, todayStr, 'wellnessliving');

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
    const weeksNeeded = Math.ceil(DAYS_TO_SCRAPE / 7);
    let lastWLPageText = '';

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

      // Stale page detection: if content didn't change after navigation, stop
      if (week > 0 && pageText === lastWLPageText) {
        console.log(`   [wellnessliving] Page content unchanged after navigation, stopping`);
        break;
      }
      lastWLPageText = pageText;
      const classes = parseWellnessLivingSchedule(pageText, source);

      console.log(`   Week ${week + 1}: Found ${classes.length} classes across ${new Set(classes.map(c => c.date)).size} days`);

      for (const cls of classes) {
        // Skip classes before today
        if (cls.date < todayStr) continue;

        classesFound++;
        stats.classesFound++;

        const exists = await classExists(cls.title, cls.date, source.name, cls.time);
        if (exists) continue;

        const success = await insertClass(cls);
        if (success) {
          classesAdded++;
          stats.classesAdded++;
        }
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

    classes.push({
      title: className,
      time: parseTime(timeMatch[1]),
      instructor: cleanInstructor,
      venueName: source.name,
      address: source.address,
      category: source.category,
      date: currentDate,
      bookingSystem: 'brandedweb'
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

    await deleteOldClasses(source.name, todayStr, 'brandedweb');

    console.log(`   Loading: ${source.url}`);
    await retryWithBackoff(
      () => page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 }),
      { label: `${source.name} page load` }
    );
    await new Promise(r => setTimeout(r, 3000));

    // Brandedweb pages show a weekly schedule. Navigate week-by-week.
    const weeksNeeded = Math.ceil(DAYS_TO_SCRAPE / 7);
    let lastPageText = '';

    for (let week = 0; week < weeksNeeded; week++) {
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

      // Extract page text and check it actually changed
      const pageText = await page.evaluate(() => document.body.innerText);
      if (week > 0 && pageText === lastPageText) {
        console.log(`   ⚠️ Page didn't change after navigation, stopping`);
        break;
      }
      lastPageText = pageText;

      // Parse classes with date headers from the page text
      const classes = parseBrandedwebSchedule(pageText, source);

      const dates = new Set(classes.map(c => c.date));
      console.log(`   Week ${week + 1}: Found ${classes.length} classes across ${dates.size} days`);

      for (const cls of classes) {
        if (cls.date < todayStr) continue;

        classesFound++;
        stats.classesFound++;

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
        classes.push({
          title: prevLine,
          time: parseTime(timeMatch[1]),
          endTime: parseTime(timeMatch[2]),
          venueName: source.name,
          address: source.address,
          category: source.category,
          date: currentDate,
          bookingSystem: 'sendmoregetbeta'
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

    await deleteOldClasses(source.name, todayStr, 'sendmoregetbeta');

    console.log(`   Loading: ${source.url}`);
    await retryWithBackoff(
      () => page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 }),
      { label: `${source.name} page load` }
    );
    await new Promise(r => setTimeout(r, 5000));

    // Parse all classes from the widget text
    const text = await page.evaluate(() => document.body.innerText);
    const allClasses = parseSendMoreClasses(text, source);

    // Filter for fitness classes and date range (string comparison avoids UTC issues)
    for (const cls of allClasses) {
      if (cls.date < todayStr || cls.date > endDateStr) continue;
      if (!isFitnessClass(cls.title)) continue;

      classesFound++;
      stats.classesFound++;

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

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  });

  try {
    // Group sources by booking system and scrape
    for (const source of RELIABLE_SOURCES) {
      stats.sourcesAttempted++;

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
    await browser.close();
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
