#!/usr/bin/env node

/**
 * Brandedweb Mindbody Scraper
 * For studios using brandedweb-next.mindbodyonline.com widgets
 * Run: node scripts/scrape-brandedweb.js
 */

import puppeteer from 'puppeteer';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

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

function parseTime(timeStr) {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3]?.toUpperCase();
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
    tags: ['auto-scraped', 'brandedweb', cls.studioName.toLowerCase().replace(/\s+/g, '-')]
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

async function scrapeStudio(browser, studio) {
  console.log(`\n📍 ${studio.name}`);
  console.log(`   Widget ID: ${studio.widgetId}`);
  console.log('-'.repeat(50));

  stats.studiosAttempted++;
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let studioClassesFound = 0;
  let studioClassesAdded = 0;

  try {
    console.log('   Clearing old scraped classes...');
    await deleteOldClasses(studio.name, todayStr);

    console.log('   Loading schedule page...');
    await page.goto(studio.scheduleUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // Scrape each day
    for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Click on the day number to navigate
      if (dayOffset > 0) {
        const dayNum = targetDate.getDate();
        // Calculate approximate x position based on day of week (Sun=1, Mon=2, etc.)
        const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, etc.
        const xPositions = [200, 300, 400, 500, 200, 300, 400]; // Approximate button positions
        const xPos = xPositions[dayOfWeek] || 200;

        await page.mouse.click(xPos, 265);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Extract classes from the page
      const text = await page.evaluate(() => document.body.innerText);
      const classes = parseClasses(text, dateStr, studio);

      if (classes.length > 0) {
        console.log(`   ${dayName}: ${classes.length} classes`);

        for (const cls of classes) {
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

function parseClasses(text, date, studio) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Pattern: time (8:30 AM) -> duration (55 min) -> class name -> instructor -> Show Details -> venue -> Book
  for (let i = 0; i < lines.length - 3; i++) {
    const line = lines[i];

    // Check if line is a time (e.g., "8:30 AM", "6:00 PM")
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
    if (!timeMatch) continue;

    // Next line should be duration (e.g., "55 min", "45 min")
    const durationLine = lines[i + 1];
    if (!/^\d+\s*min$/i.test(durationLine)) continue;

    // Next line should be class name (e.g., "Hot Rise & Shine")
    const className = lines[i + 2];
    if (!className || className.length < 3 || className.length > 100) continue;
    if (/^(Show Details|Book|Oxygen|Squamish|\d)/.test(className)) continue;

    // Next line should be instructor name
    const instructor = lines[i + 3] || '';
    const cleanInstructor = /^(Show Details|Book|Oxygen)/.test(instructor) ? '' : instructor;

    classes.push({
      title: className,
      time: parseTime(timeMatch[1]),
      instructor: cleanInstructor,
      studioName: studio.name,
      studioAddress: studio.address,
      category: studio.category,
      date: date
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
