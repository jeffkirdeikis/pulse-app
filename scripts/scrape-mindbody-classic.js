#!/usr/bin/env node

/**
 * Classic Mindbody Scraper
 * For studios using the classic Mindbody interface (not widget API)
 * Uses stealth mode to bypass bot detection
 * Run: node scripts/scrape-mindbody-classic.js
 */

import puppeteer from 'puppeteer';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'REDACTED_SERVICE_KEY';

// Studios using classic Mindbody interface
const CLASSIC_STUDIOS = [
  {
    name: 'Squamish Barbell',
    studioId: '7879',
    tabId: '7',
    scheduleUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=7879&tabID=7',
    address: '38930-C Mid Way, Squamish, BC',
    category: 'Fitness'
  },
  {
    name: 'Seed Studio',
    studioId: '5729485',
    tabId: '7',
    scheduleUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=5729485&tabID=7',
    address: '38173 Cleveland Ave, Squamish, BC',
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

function parseTime(timeStr) {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)/);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return '09:00';
}

async function classExists(title, date, studioName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events?title=eq.${encodeURIComponent(title)}&start_date=eq.${date}&venue_name=eq.${encodeURIComponent(studioName)}&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    return data.length > 0;
  } catch { return false; }
}

async function insertClass(cls) {
  const eventData = {
    title: cls.title,
    description: cls.instructor ? `Instructor: ${cls.instructor}` : `${cls.category} class at ${cls.studioName}`,
    venue_name: cls.studioName,
    venue_address: cls.studioAddress,
    category: cls.category,
    event_type: 'class',
    start_date: cls.date,
    start_time: cls.time,
    end_time: null,
    price: 0,
    is_free: false,
    price_description: 'See studio for pricing',
    status: 'active',
    tags: ['auto-scraped', 'mindbody-classic', cls.studioName.toLowerCase().replace(/\s+/g, '-')]
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

async function deleteOldClasses(studioName, fromDate) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/events?venue_name=eq.${encodeURIComponent(studioName)}&event_type=eq.class&start_date=gte.${fromDate}&tags=cs.{auto-scraped}`,
      {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }
    );
  } catch {}
}

function parseClassicSchedule(text, studio) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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

    // Check for time pattern like "6:00 am PST" or "12:00 pm PST"
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:am|pm))\s*PST$/i);
    if (timeMatch && currentDate) {
      // Next line should be class name
      const className = lines[i + 1];
      if (!className) continue;

      // Skip if class is cancelled or is a navigation element
      if (/cancelled|all service|all class|all teachers|today|day|week/i.test(className)) continue;

      // Skip "Open Gym" as it's not a structured class
      if (/^open gym$/i.test(className)) continue;

      // Get instructor (line after class name)
      let instructor = lines[i + 2] || '';
      // Skip if instructor looks like duration
      if (/^\d+\s*(hour|minute|hr|min)/i.test(instructor)) {
        instructor = '';
      }
      // Skip if instructor is "Coach" (generic)
      if (/^coach$/i.test(instructor)) {
        instructor = '';
      }

      classes.push({
        title: className,
        time: parseTime(timeMatch[1]),
        instructor: instructor,
        studioName: studio.name,
        studioAddress: studio.address,
        category: studio.category,
        date: currentDate
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

async function scrapeStudio(browser, studio) {
  console.log(`\n📍 ${studio.name}`);
  console.log(`   Studio ID: ${studio.studioId}, Tab ID: ${studio.tabId}`);
  console.log('-'.repeat(50));

  stats.studiosAttempted++;
  const page = await browser.newPage();

  // Stealth settings
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  await page.setViewport({ width: 1280, height: 900 });

  // Use Pacific timezone for date calculations (Mindbody shows PST)
  const today = new Date();
  const pacificFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = pacificFormatter.format(today); // Returns YYYY-MM-DD
  let studioClassesFound = 0;
  let studioClassesAdded = 0;

  try {
    console.log('   Clearing old scraped classes...');
    await deleteOldClasses(studio.name, todayStr);

    console.log('   Loading schedule page...');
    // First load main page with studioid to establish session
    await page.goto(`https://clients.mindbodyonline.com/classic/mainclass?studioid=${studio.studioId}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(r => setTimeout(r, 3000));

    // Click on the correct tab to load classes
    console.log('   Clicking tab...');
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
    }, studio.tabId);
    await new Promise(r => setTimeout(r, 5000));

    // Get page text
    const text = await page.evaluate(() => document.body.innerText);

    // Check for security block
    if (text.includes('Security Check') || text.includes('Verifying you are human')) {
      throw new Error('Blocked by security check');
    }

    // Parse classes
    const classes = parseClassicSchedule(text, studio);

    // Filter for next 7 days (use string comparison to avoid timezone issues)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    const endDateStr = pacificFormatter.format(endDate);

    for (const cls of classes) {
      // Compare dates as strings (YYYY-MM-DD format)
      if (cls.date < todayStr || cls.date > endDateStr) continue;

      studioClassesFound++;
      stats.classesFound++;

      const exists = await classExists(cls.title, cls.date, cls.studioName);
      if (exists) continue;

      const success = await insertClass(cls);
      if (success) {
        stats.classesAdded++;
        studioClassesAdded++;
      }
    }

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
  console.log('🏋️ CLASSIC MINDBODY SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Studios: ${CLASSIC_STUDIOS.length}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  try {
    for (const studio of CLASSIC_STUDIOS) {
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
