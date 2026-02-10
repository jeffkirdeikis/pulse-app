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
  validateScrapedData
} from './lib/scraper-utils.js';
import {
  RELIABLE_SOURCES,
  getSourcesBySystem,
  recordScrapeSuccess,
  recordScrapeFailure
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
  eventsFound: 0,
  eventsAdded: 0,
  errors: []
};

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
        const response = await fetch(apiUrl);
        if (!response.ok) continue;
        data = await response.json();
      } catch {
        continue;
      }

      if (!data || !data.class_sessions) continue;

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
        }
      }

      // Small delay between API requests
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
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
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for date header like "Mon January 26, 2026"
    const dateMatch = line.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?/i);
    if (dateMatch) {
      const monthName = dateMatch[2].toLowerCase();
      const day = parseInt(dateMatch[3]);
      const monthIndex = months.indexOf(monthName);
      if (monthIndex !== -1) {
        const year = dateMatch[4] ? parseInt(dateMatch[4]) : new Date().getFullYear();
        currentDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
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
    await page.goto(`https://clients.mindbodyonline.com/classic/mainclass?studioid=${source.studio_id}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(r => setTimeout(r, 3000));

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
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
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

  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];

  let currentDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match day headers like "Thursday, February 05, 2026" or "Sunday February 8, 2026"
    // or "Tuesday February 10, 2026 (Today)" — comma after day name is optional
    const dateMatch = line.match(/^\w+,?\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (dateMatch) {
      const monthName = dateMatch[1].toLowerCase();
      const day = parseInt(dateMatch[2]);
      const year = parseInt(dateMatch[3]);
      const monthIndex = months.indexOf(monthName);
      if (monthIndex !== -1) {
        currentDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      continue;
    }

    // Also match "Thursday, 5th February" style (alternate format)
    const dateMatch2 = line.match(/^\w+,?\s+(\d{1,2})(?:st|nd|rd|th)\s+(\w+)(?:\s+(\d{4}))?$/i);
    if (dateMatch2) {
      const day = parseInt(dateMatch2[1]);
      const monthName = dateMatch2[2].toLowerCase();
      const year = dateMatch2[3] ? parseInt(dateMatch2[3]) : new Date().getFullYear();
      const monthIndex = months.indexOf(monthName);
      if (monthIndex !== -1) {
        currentDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
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
    await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

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
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
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

  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  let currentDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match date headers: "Tuesday, February 10, 2026" or "Tuesday, February 10"
    const dateMatch1 = line.match(/^\w+,\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?$/i);
    if (dateMatch1) {
      const monthName = dateMatch1[1].toLowerCase();
      const day = parseInt(dateMatch1[2]);
      const year = dateMatch1[3] ? parseInt(dateMatch1[3]) : new Date().getFullYear();
      const monthIndex = months.indexOf(monthName);
      const shortIndex = shortMonths.findIndex(m => monthName.startsWith(m));
      const idx = monthIndex !== -1 ? monthIndex : shortIndex;
      if (idx !== -1) {
        currentDate = `${year}-${String(idx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      continue;
    }

    // Match shorter date headers: "Tue, Feb 10" or "Feb 10, 2026"
    const dateMatch2 = line.match(/(?:\w+,\s+)?(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/i);
    if (dateMatch2 && !line.match(/^\d/) && line.length < 30) {
      const monthName = dateMatch2[1].toLowerCase();
      const day = parseInt(dateMatch2[2]);
      const year = dateMatch2[3] ? parseInt(dateMatch2[3]) : new Date().getFullYear();
      const shortIndex = shortMonths.findIndex(m => monthName.startsWith(m));
      if (shortIndex !== -1 && day >= 1 && day <= 31) {
        currentDate = `${year}-${String(shortIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        continue;
      }
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
    await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 });
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
        }
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
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
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];

    // Check for date header like "Sunday, 1st February"
    const dateMatch = line.match(/(\w+),\s*(\d{1,2})(?:st|nd|rd|th)\s+(\w+)/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[2]);
      const monthName = dateMatch[3].toLowerCase();
      const monthIndex = months.indexOf(monthName);
      if (monthIndex !== -1) {
        const year = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const adjustedYear = monthIndex < currentMonth - 1 ? year + 1 : year;
        currentDate = `${adjustedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
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
    await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 });
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
      }
    }

    console.log(`   ✅ Found: ${classesFound}, Added: ${classesAdded}`);
    stats.sourcesSuccessful++;
    await recordScrapeSuccess(source.name, classesFound);

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
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

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(e => console.log(`   • ${e.source}: ${e.error}`));
  }

  console.log(`\nCompleted: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));
}

main().catch(console.error);
