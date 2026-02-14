#!/usr/bin/env node

/**
 * Brandedweb Mindbody Scraper
 * For studios using brandedweb-next.mindbodyonline.com widgets
 *
 * FIXED (Feb 2026): Replaced fragile pixel-clicking day navigation with
 * CSS selector-based week navigation. Now parses dates from page headers
 * instead of assigning computed dates from a loop counter. Detects stale
 * pages (navigation failure) and stops immediately.
 *
 * Run: node scripts/scrape-brandedweb.js
 */

import puppeteer from 'puppeteer';
import {
  classExists,
  insertClass,
  parseTime,
  getTodayPacific,
  getEndDatePacific,
  deleteOldClasses,
  validateScrapedData
} from './lib/scraper-utils.js';

const DAYS_TO_SCRAPE = 30;

// Studios using brandedweb Mindbody widgets
const BRANDEDWEB_STUDIOS = [
  {
    name: 'Oxygen Yoga & Fitness Squamish',
    widgetId: '5922581a2',
    scheduleUrl: 'https://brandedweb-next.mindbodyonline.com/components/widgets/schedules/view/5922581a2/schedule',
    address: '38085 Second Ave, Squamish, BC',
    category: 'Yoga & Pilates'
  }
];

const stats = {
  studiosAttempted: 0,
  studiosSuccessful: 0,
  classesFound: 0,
  classesAdded: 0,
  errors: []
};

/**
 * Parse date headers from Brandedweb page text.
 * Brandedweb pages show date headers like:
 *   "Tuesday, February 10, 2026"
 *   "Tue, Feb 10"
 *   "Feb 10, 2026"
 *
 * Returns an array of all unique dates found on the page as YYYY-MM-DD.
 */
function parseDatesFromText(text) {
  const dates = new Set();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  for (const line of lines) {
    // Pattern 1: "Tuesday, February 10, 2026"
    const match1 = line.match(/^\w+,\s+(\w+)\s+(\d{1,2}),?\s*(\d{4})?$/i);
    if (match1) {
      const monthName = match1[1].toLowerCase();
      const day = parseInt(match1[2]);
      const year = match1[3] ? parseInt(match1[3]) : new Date().getFullYear();
      const monthIndex = months.indexOf(monthName);
      const shortIndex = shortMonths.findIndex(m => monthName.startsWith(m));
      const idx = monthIndex !== -1 ? monthIndex : shortIndex;
      if (idx !== -1) {
        dates.add(`${year}-${String(idx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
      continue;
    }

    // Pattern 2: "Feb 10, 2026" or "Tue, Feb 10"
    const match2 = line.match(/(?:\w+,\s+)?(\w+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/i);
    if (match2 && !line.match(/^\d/) && line.length < 30) {
      const monthName = match2[1].toLowerCase();
      const day = parseInt(match2[2]);
      const year = match2[3] ? parseInt(match2[3]) : new Date().getFullYear();
      const shortIndex = shortMonths.findIndex(m => monthName.startsWith(m));
      if (shortIndex !== -1 && day >= 1 && day <= 31) {
        dates.add(`${year}-${String(shortIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    }
  }

  return Array.from(dates).sort();
}

/**
 * Parse classes from Brandedweb page text, using date headers found in
 * the text itself. Classes are only assigned dates that appear as headers
 * on the page -- never computed dates from a loop counter.
 *
 * Expected format on page:
 *   [Date header line]
 *   8:30 AM           <-- time line
 *   55 min            <-- duration line
 *   Hot Rise & Shine  <-- class name
 *   Instructor Name   <-- instructor (optional)
 */
function parseClasses(text, studio) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  let currentDate = null;

  for (let i = 0; i < lines.length - 3; i++) {
    const line = lines[i];

    // Check for date header: "Tuesday, February 10, 2026" or "Tuesday, February 10"
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

    // Shorter date header: "Feb 10, 2026" or "Tue, Feb 10"
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

    // Only extract classes if we have a valid parsed date from the page
    if (!currentDate) continue;

    // Check if line is a time (e.g., "8:30 AM", "6:00 PM")
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
    if (!timeMatch) continue;

    // Next line should be duration (e.g., "55 min", "45 min")
    const durationLine = lines[i + 1];
    if (!/^\d+\s*min$/i.test(durationLine)) continue;

    // Next line should be class name (e.g., "Hot Rise & Shine")
    const className = lines[i + 2];
    if (!className || className.length < 3 || className.length > 100) continue;
    // Skip UI elements — but NOT studio/brand names that could be part of class names
    if (/^(Show Details|Book Now|Book Class|Sign Up|Add to Cart|Waitlist|Cancel|Close|\d)/.test(className)) continue;
    // Skip if class name exactly matches the studio name (header text, not a real class)
    if (className === studio.name) continue;

    // Next line should be instructor name
    const instructor = lines[i + 3] || '';
    const cleanInstructor = /^(Show Details|Book Now|Book Class|Sign Up|\d)/.test(instructor) ? '' : instructor;

    classes.push({
      title: className,
      time: parseTime(timeMatch[1]),
      instructor: cleanInstructor,
      studioName: studio.name,
      studioAddress: studio.address,
      venueName: studio.name,
      address: studio.address,
      category: studio.category,
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

/**
 * Click the "Next" week arrow button in the Brandedweb widget.
 * Returns true if navigation succeeded (page content changed).
 */
async function clickNextWeek(page) {
  const beforeText = await page.evaluate(() => document.body.innerText);

  const clicked = await page.evaluate(() => {
    // Primary: MUI IconButton with aria-label="Next"
    const nextBtn = document.querySelector('button[aria-label="Next"]');
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.click();
      return true;
    }
    // Fallback selectors
    const selectors = [
      'button[aria-label*="Next"]', 'button[aria-label*="next"]',
      'button[aria-label*="Forward"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && !el.disabled) { el.click(); return true; }
    }
    return false;
  });

  if (!clicked) return false;

  await new Promise(r => setTimeout(r, 3000));

  // Verify page content actually changed
  const afterText = await page.evaluate(() => document.body.innerText);
  return afterText !== beforeText;
}

/**
 * Get the list of day tab elements in the Brandedweb widget.
 * Day tabs are <h6> MUI Typography elements that come in pairs:
 *   day name ("Today"/"Sun"/"Mon"/...) followed by day number ("14"/"15"/...)
 * We return the indices of the day-name elements (every other one).
 */
async function getDayTabCount(page) {
  return page.evaluate(() => {
    const dayNames = ['Today', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const h6s = document.querySelectorAll('h6.MuiTypography-root');
    let count = 0;
    for (const h6 of h6s) {
      const text = h6.textContent.trim();
      if (dayNames.includes(text)) count++;
    }
    return count;
  });
}

/**
 * Click the Nth day tab (0-indexed) in the Brandedweb widget.
 * Day tabs are <h6> elements with day names: Today, Sun, Mon, Tue, etc.
 */
async function clickDayTab(page, dayIndex) {
  const result = await page.evaluate((idx) => {
    const dayNames = ['Today', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const h6s = document.querySelectorAll('h6.MuiTypography-root');
    let dayCount = 0;
    for (const h6 of h6s) {
      const text = h6.textContent.trim();
      if (dayNames.includes(text)) {
        if (dayCount === idx) {
          h6.click();
          return text;
        }
        dayCount++;
      }
    }
    return null;
  }, dayIndex);

  if (result) {
    await new Promise(r => setTimeout(r, 2000));
  }
  return result;
}

async function scrapeStudio(browser, studio) {
  console.log(`\n📍 ${studio.name}`);
  console.log(`   Widget ID: ${studio.widgetId}`);
  console.log('-'.repeat(50));

  stats.studiosAttempted++;
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const todayStr = getTodayPacific();
  const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);
  let studioClassesFound = 0;
  let studioClassesAdded = 0;

  try {
    console.log('   Clearing old scraped classes...');
    await deleteOldClasses(studio.name, todayStr, 'brandedweb');

    console.log('   Loading schedule page...');
    await page.goto(studio.scheduleUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Brandedweb widgets show ONE DAY at a time with a day-tab carousel.
    // Day tabs are <h6> MUI Typography elements (Today, Sun, Mon, ...).
    // We must click each day tab to see that day's classes, then advance
    // to the next week with the "Next" arrow button.
    const weeksNeeded = Math.ceil(DAYS_TO_SCRAPE / 7);

    for (let week = 0; week < weeksNeeded; week++) {
      // Navigate to next week (skip for the first week)
      if (week > 0) {
        const navigated = await clickNextWeek(page);
        if (!navigated) {
          console.log(`   Could not navigate to week ${week + 1}. Stopping.`);
          break;
        }
      }

      // Count day tabs available this week
      const dayCount = await getDayTabCount(page);
      if (dayCount === 0) {
        console.log(`   Week ${week + 1}: No day tabs found. Stopping.`);
        break;
      }

      let weekClasses = 0;
      let weekDays = 0;

      // Click each day tab and scrape its classes
      for (let day = 0; day < dayCount; day++) {
        const dayName = await clickDayTab(page, day);
        if (!dayName) continue;

        // Extract page text for this day
        const pageText = await page.evaluate(() => document.body.innerText);
        const classes = parseClasses(pageText, studio);

        if (classes.length > 0) weekDays++;
        weekClasses += classes.length;

        for (const cls of classes) {
          if (cls.date < todayStr || cls.date > endDateStr) continue;

          studioClassesFound++;
          stats.classesFound++;

          const exists = await classExists(cls.title, cls.date, cls.studioName, cls.time);
          if (exists) continue;

          const success = await insertClass(cls);
          if (success) {
            stats.classesAdded++;
            studioClassesAdded++;
          }
        }
      }

      console.log(`   Week ${week + 1}: ${weekClasses} classes across ${weekDays} days (${dayCount} tabs)`);
    }

    // Post-scrape validation: detect and remove duplicated schedules
    await validateScrapedData(studio.name, 'brandedweb');

    console.log(`   ✅ Total: ${studioClassesFound} found, ${studioClassesAdded} added`);
    stats.studiosSuccessful++;

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ studio: studio.name, error: error.message });
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧘 BRANDEDWEB MINDBODY SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Studios: ${BRANDEDWEB_STUDIOS.length}`);
  console.log(`Days to scrape: ${DAYS_TO_SCRAPE}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const studio of BRANDEDWEB_STUDIOS) {
      await scrapeStudio(browser, studio);
    }
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Studios:     ${stats.studiosSuccessful}/${stats.studiosAttempted} successful`);
  console.log(`Classes:     ${stats.classesFound} found, ${stats.classesAdded} added`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  • ${e.studio}: ${e.error}`));
  }

  console.log(`\nCompleted: ${new Date().toLocaleString()}`);
}

main().catch(console.error);
