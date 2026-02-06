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

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function parseTime(timeStr) {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = (match[3] || '').toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return '09:00';
}

function getTodayPacific() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

function getEndDatePacific(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

async function classExists(title, date, venueName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events?title=eq.${encodeURIComponent(title)}&start_date=eq.${date}&venue_name=eq.${encodeURIComponent(venueName)}&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    return data.length > 0;
  } catch { return false; }
}

async function insertClass(cls) {
  const eventData = {
    title: cls.title,
    description: cls.instructor ? `Instructor: ${cls.instructor}` : `${cls.category} class at ${cls.venueName}`,
    venue_name: cls.venueName,
    venue_address: cls.address,
    category: cls.category,
    event_type: 'class',
    start_date: cls.date,
    start_time: cls.time,
    end_time: cls.endTime || null,
    price: 0,
    is_free: false,
    price_description: 'See venue for pricing',
    status: 'active',
    tags: ['auto-scraped', cls.bookingSystem, cls.venueName.toLowerCase().replace(/\s+/g, '-')]
  };

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(eventData)
    });
    return response.ok;
  } catch { return false; }
}

async function deleteOldClasses(venueName, fromDate, bookingSystemTag) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/events?venue_name=eq.${encodeURIComponent(venueName)}&event_type=eq.class&start_date=gte.${fromDate}&tags=cs.{auto-scraped,${bookingSystemTag}}`,
      {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }
    );
  } catch {}
}

// ============================================================
// MINDBODY WIDGET SCRAPER (HealCode)
// ============================================================

async function scrapeMindbodyWidget(source, browser) {
  console.log(`\n📍 ${source.name} (Mindbody Widget)`);
  console.log('-'.repeat(50));

  const page = await browser.newPage();
  let classesFound = 0;
  let classesAdded = 0;

  try {
    const todayStr = getTodayPacific();
    const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

    await deleteOldClasses(source.name, todayStr, 'mindbody-widget');

    const widgetUrl = `https://widgets.mindbodyonline.com/widgets/schedules/${source.widget_id}`;
    console.log(`   Loading widget: ${widgetUrl}`);

    await page.goto(widgetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Extract schedule data from widget
    const classes = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.bw-session').forEach(session => {
        const dateEl = session.closest('.bw-day')?.querySelector('.bw-day__date');
        const titleEl = session.querySelector('.bw-session__name');
        const timeEl = session.querySelector('.bw-session__time');
        const instructorEl = session.querySelector('.bw-session__staff');

        if (titleEl && timeEl && dateEl) {
          items.push({
            title: titleEl.textContent?.trim(),
            time: timeEl.textContent?.trim(),
            instructor: instructorEl?.textContent?.trim() || '',
            dateText: dateEl.textContent?.trim()
          });
        }
      });
      return items;
    });

    for (const cls of classes) {
      // Parse date from widget format
      const dateMatch = cls.dateText?.match(/(\w+)\s+(\d{1,2})/);
      if (!dateMatch) continue;

      const monthName = dateMatch[1];
      const day = parseInt(dateMatch[2]);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = months.findIndex(m => monthName.startsWith(m));
      if (monthIndex === -1) continue;

      const year = new Date().getFullYear();
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      if (dateStr < todayStr || dateStr > endDateStr) continue;

      classesFound++;
      stats.classesFound++;

      const exists = await classExists(cls.title, dateStr, source.name);
      if (exists) continue;

      const success = await insertClass({
        title: cls.title,
        time: parseTime(cls.time),
        instructor: cls.instructor,
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

    for (let week = 0; week < WEEKS_TO_SCRAPE; week++) {
      const text = await page.evaluate(() => document.body.innerText);

      if (text.includes('Security Check') || text.includes('Verifying you are human')) {
        throw new Error('Blocked by security check');
      }

      const weekClasses = parseClassicSchedule(text, source);
      allClasses.push(...weekClasses);

      if (week < WEEKS_TO_SCRAPE - 1) {
        const clicked = await page.evaluate(() => {
          const weekArrowRight = document.querySelector('#week-arrow-r');
          if (weekArrowRight) {
            weekArrowRight.click();
            return true;
          }
          const nextButtons = document.querySelectorAll('.date-arrow-r, a[href*="fw=1"], .next-week');
          for (const btn of nextButtons) {
            btn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await new Promise(r => setTimeout(r, 3000));
        } else {
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

      const exists = await classExists(cls.title, cls.date, cls.venueName);
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

    // Match day headers like "Thursday, February 05, 2026" or "Friday, February 06, 2026"
    const dateMatch = line.match(/^\w+,\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
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
    const dateMatch2 = line.match(/^\w+,\s+(\d{1,2})(?:st|nd|rd|th)\s+(\w+)(?:\s+(\d{4}))?$/i);
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
    let instructor = '';
    if (i + 2 < lines.length) {
      const instrMatch = lines[i + 2].match(/^(?:with\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
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

    for (let week = 0; week < weeksNeeded; week++) {
      if (week > 0) {
        // Navigate to next week using the forward arrow/button
        try {
          const nextWeekBtn = await page.$('button[aria-label*="Next"], button[aria-label*="next"], .rs-schedule-next, [class*="next-week"], [class*="arrow-right"], a[title*="Next"], .fa-chevron-right, .fa-arrow-right');
          if (nextWeekBtn) {
            await nextWeekBtn.click();
            await new Promise(r => setTimeout(r, 3000));
          } else {
            // Try clicking a ">" or right arrow by text content
            const arrows = await page.$$('button, a, span');
            for (const arrow of arrows) {
              const text = await arrow.evaluate(el => el.textContent.trim());
              if (text === '>' || text === '›' || text === '→' || text === '▶') {
                await arrow.click();
                await new Promise(r => setTimeout(r, 3000));
                break;
              }
            }
          }
        } catch (navErr) {
          console.log(`   ⚠️ Could not navigate to week ${week + 1}: ${navErr.message}`);
        }
      }

      // Extract the full page text and parse day-by-day
      const pageText = await page.evaluate(() => document.body.innerText);
      const classes = parseWellnessLivingSchedule(pageText, source);

      console.log(`   Week ${week + 1}: Found ${classes.length} classes across ${new Set(classes.map(c => c.date)).size} days`);

      for (const cls of classes) {
        // Skip classes before today
        if (cls.date < todayStr) continue;

        classesFound++;
        stats.classesFound++;

        const exists = await classExists(cls.title, cls.date, source.name);
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

function parseBrandedwebClasses(text, date, source) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  for (let i = 0; i < lines.length - 3; i++) {
    const line = lines[i];

    // Check if line is a time (e.g., "8:30 AM", "6:00 PM")
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
    if (!timeMatch) continue;

    // Next line should be duration
    const durationLine = lines[i + 1];
    if (!/^\d+\s*min$/i.test(durationLine)) continue;

    // Next line should be class name
    const className = lines[i + 2];
    if (!className || className.length < 3 || className.length > 100) continue;
    if (/^(Show Details|Book|Oxygen|Squamish|\d)/.test(className)) continue;

    // Next line might be instructor
    const instructor = lines[i + 3] || '';
    const cleanInstructor = /^(Show Details|Book|Oxygen)/.test(instructor) ? '' : instructor;

    classes.push({
      title: className,
      time: parseTime(timeMatch[1]),
      instructor: cleanInstructor,
      venueName: source.name,
      address: source.address,
      category: source.category,
      date: date,
      bookingSystem: 'brandedweb'
    });
  }

  // Deduplicate
  const seen = new Set();
  return classes.filter(c => {
    const key = `${c.title}-${c.time}`;
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
    const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

    await deleteOldClasses(source.name, todayStr, 'brandedweb');

    console.log(`   Loading: ${source.url}`);
    await page.goto(source.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scrape day by day
    const today = new Date();
    for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Click on date to navigate (approximate position based on day of week)
      if (dayOffset > 0) {
        const dayOfWeek = targetDate.getDay();
        const xPositions = [200, 300, 400, 500, 200, 300, 400];
        await page.mouse.click(xPositions[dayOfWeek] || 200, 265);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Extract classes from page text
      const text = await page.evaluate(() => document.body.innerText);
      const classes = parseBrandedwebClasses(text, dateStr, source);

      for (const cls of classes) {
        classesFound++;
        stats.classesFound++;

        const exists = await classExists(cls.title, cls.date, cls.venueName);
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

    // Filter for fitness classes and date range
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + DAYS_TO_SCRAPE);

    for (const cls of allClasses) {
      const classDate = new Date(cls.date);
      if (classDate < today || classDate > endDate) continue;
      if (!isFitnessClass(cls.title)) continue;

      classesFound++;
      stats.classesFound++;

      const exists = await classExists(cls.title, cls.date, cls.venueName);
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
