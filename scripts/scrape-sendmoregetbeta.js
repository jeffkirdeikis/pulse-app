#!/usr/bin/env node

/**
 * SendMoreGetBeta Scraper
 * For climbing gyms using SendMoreGetBeta booking system
 * Run: node scripts/scrape-sendmoregetbeta.js
 */

import puppeteer from 'puppeteer';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

const DAYS_TO_SCRAPE = 30;

// Studios using SendMoreGetBeta
const SENDMORE_STUDIOS = [
  {
    name: 'The Ledge Climbing Centre',
    gymKey: '13326',
    widgetUrl: 'https://widgets.sendmoregetbeta.com/event?gymKey=13326',
    address: '1010 Industrial Way, Squamish, BC',
    category: 'Fitness'
  }
];

// Keywords for fitness classes (not climbing courses)
const FITNESS_KEYWORDS = ['yoga', 'pilates', 'capoeira', 'tai chi', 'fitness', 'strength', 'cardio', 'hiit'];
const EXCLUDE_KEYWORDS = ['room hire', 'nicas', 'wild climbers', 'climbing'];

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

function isFitnessClass(className) {
  const lower = className.toLowerCase();
  // Must contain a fitness keyword and NOT contain an exclude keyword
  const hasFitness = FITNESS_KEYWORDS.some(kw => lower.includes(kw));
  const hasExclude = EXCLUDE_KEYWORDS.some(kw => lower.includes(kw));
  return hasFitness && !hasExclude;
}

async function classExists(title, date, studioName, time) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/events?title=eq.${encodeURIComponent(title)}&start_date=eq.${date}&venue_name=eq.${encodeURIComponent(studioName)}`;
    if (time) {
      const normalizedTime = time.length === 5 ? `${time}:00` : time;
      url += `&start_time=eq.${encodeURIComponent(normalizedTime)}`;
    }
    url += '&limit=1';
    const response = await fetch(url,
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
    end_time: cls.endTime || null,
    price: 0,
    is_free: false,
    price_description: 'See venue for pricing',
    status: 'active',
    tags: ['auto-scraped', 'sendmoregetbeta', cls.studioName.toLowerCase().replace(/\s+/g, '-')]
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
  console.log(`   Gym Key: ${studio.gymKey}`);
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

    console.log('   Loading schedule widget...');
    await page.goto(studio.widgetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Parse all classes from the widget text
    const text = await page.evaluate(() => document.body.innerText);
    const classes = parseClasses(text, studio);

    // Group by date and filter for next 7 days
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + DAYS_TO_SCRAPE);

    for (const cls of classes) {
      const classDate = new Date(cls.date);
      if (classDate < today || classDate > endDate) continue;
      if (!isFitnessClass(cls.title)) continue;

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

    console.log(`   ✅ Total: ${studioClassesFound} fitness classes found, ${studioClassesAdded} added`);
    stats.studiosSuccessful++;

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ studio: studio.name, error: error.message });
  } finally {
    await page.close();
  }
}

function parseClasses(text, studio) {
  const classes = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentDate = null;
  const months = ['january', 'february', 'march', 'april', 'may', 'june',
                  'july', 'august', 'september', 'october', 'november', 'december'];

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];

    // Check for date header like "Sunday, 1st February" or "Monday, 2nd February"
    const dateMatch = line.match(/(\w+),\s*(\d{1,2})(?:st|nd|rd|th)\s+(\w+)/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[2]);
      const monthName = dateMatch[3].toLowerCase();
      const monthIndex = months.indexOf(monthName);
      if (monthIndex !== -1) {
        const year = new Date().getFullYear();
        // Handle year rollover
        const currentMonth = new Date().getMonth();
        const adjustedYear = monthIndex < currentMonth - 1 ? year + 1 : year;
        currentDate = `${adjustedYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      continue;
    }

    // Check for time pattern like "10:00 AM - 11:00 AM"
    const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
    if (timeMatch && currentDate) {
      // Previous line might be the class name
      const prevLine = i > 0 ? lines[i - 1] : '';
      // Skip if previous line is a date or navigation
      if (prevLine && !prevLine.match(/(\w+),\s*\d{1,2}(?:st|nd|rd|th)/) &&
          !prevLine.match(/^(translate|Login|person|event)/i)) {

        classes.push({
          title: prevLine,
          time: parseTime(timeMatch[1]),
          endTime: parseTime(timeMatch[2]),
          studioName: studio.name,
          studioAddress: studio.address,
          category: studio.category,
          date: currentDate
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

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🧗 SENDMOREGETBETA SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Studios: ${SENDMORE_STUDIOS.length}`);
  console.log(`Days to scrape: ${DAYS_TO_SCRAPE}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const studio of SENDMORE_STUDIOS) {
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
