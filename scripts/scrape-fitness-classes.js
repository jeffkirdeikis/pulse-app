#!/usr/bin/env node

/**
 * FITNESS CLASS SCRAPER v3
 * Direct Mindbody Widget API - scrapes 30 days of classes
 *
 * Run manually: node scripts/scrape-fitness-classes.js
 * Run via cron: Add to crontab for daily execution
 *
 * To add a new studio:
 * 1. Go to their schedule page
 * 2. Open DevTools > Network tab
 * 3. Look for requests to widgets.mindbodyonline.com
 * 4. Find the widget ID (e.g., /schedules/189264/)
 * 5. Add to FITNESS_STUDIOS array below
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// How many days ahead to scrape
const DAYS_TO_SCRAPE = 30;

// Fitness studios with Mindbody widget IDs
// Widget IDs discovered by inspecting network requests on schedule pages
const FITNESS_STUDIOS = [
  {
    name: 'Shala Yoga',
    widgetId: '189264',
    address: '40383 Tantalus Rd, Unit 3, Squamish, BC',
    category: 'Yoga & Pilates',
    bookingSystem: 'mindbody'
  },
  {
    name: 'Wild Life Gym',
    widgetId: '69441',
    address: 'Squamish, BC',
    category: 'Fitness',
    bookingSystem: 'mindbody'
  }
  // Studios using WellnessLiving (different API - not yet implemented):
  // - Breathe Fitness: k_business=338540
  // - Sound Martial Arts: wellnessliving
];

// Stats tracking
const stats = {
  studiosAttempted: 0,
  studiosSuccessful: 0,
  studiosFailed: 0,
  classesFound: 0,
  classesAdded: 0,
  classesDuplicate: 0,
  errors: []
};

/**
 * Fetch schedule from Mindbody widget API
 */
async function fetchMindbodySchedule(widgetId, date) {
  const url = `https://widgets.mindbodyonline.com/widgets/schedules/${widgetId}/load_markup?options%5Bstart_date%5D=${date}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Parse class data from Mindbody widget HTML response
 */
function parseClasses(html, date, studio) {
  const classes = [];

  // Unescape HTML entities
  html = html
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/');

  // Extract all class names
  const classNames = [...html.matchAll(/data-bw-widget-mbo-class-name="([^"]+)"/g)].map(m => m[1]);

  // Extract all start times
  const startTimes = [...html.matchAll(/<time class="hc_starttime" datetime="[^"]*">\s*([^<]+)<\/time>/g)].map(m => m[1].trim());

  // Extract all end times
  const endTimes = [...html.matchAll(/<time class="hc_endtime" datetime="[^"]*">\s*([^<]+)<\/time>/g)].map(m => m[1].trim());

  // Extract all instructors
  const instructors = [...html.matchAll(/<div class="bw-session__staff"[^>]*>\s*([^\n<]+)/g)].map(m => m[1].trim());

  // Combine into class objects
  for (let i = 0; i < classNames.length; i++) {
    const className = classNames[i]
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    const startTime = startTimes[i] || '';
    const endTime = endTimes[i] || '';
    const instructor = instructors[i]?.replace(/\s+/g, ' ').trim() || '';

    if (className && startTime) {
      classes.push({
        title: className,
        time: parseTime(startTime),
        endTime: parseTime(endTime),
        instructor: instructor,
        description: `${className} class at ${studio.name}`,
        studioName: studio.name,
        studioAddress: studio.address,
        category: studio.category,
        date: date
      });
    }
  }

  return classes;
}

/**
 * Parse time string to HH:MM format
 */
function parseTime(timeStr) {
  if (!timeStr) return '09:00';

  timeStr = timeStr.replace(/\s+/g, ' ').trim();

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

/**
 * Check if class exists in database
 */
async function classExists(title, date, studioName, time) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/events?title=ilike.${encodeURIComponent(title)}&start_date=eq.${date}&venue_name=ilike.${encodeURIComponent(studioName)}`;
    if (time) {
      const normalizedTime = time.length === 5 ? `${time}:00` : time;
      url += `&start_time=eq.${encodeURIComponent(normalizedTime)}`;
    }
    url += '&limit=1';
    const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const data = await response.json();
    return data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Delete old classes for a studio (to refresh data)
 */
async function deleteOldClasses(studioName, fromDate) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events?venue_name=eq.${encodeURIComponent(studioName)}&event_type=eq.class&start_date=gte.${fromDate}&tags=cs.{auto-scraped}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Insert class into Supabase
 */
async function insertClass(cls) {
  const eventData = {
    title: cls.title,
    description: cls.instructor
      ? `Instructor: ${cls.instructor}`
      : `${cls.category} class at ${cls.studioName}`,
    venue_name: cls.studioName,
    venue_address: cls.studioAddress,
    category: cls.category,
    event_type: 'class',
    start_date: cls.date,
    start_time: cls.time,
    end_time: cls.endTime || null,
    price: 0,
    is_free: false,
    price_description: 'See studio for pricing',
    status: 'active',
    tags: ['auto-scraped', 'mindbody-api', cls.studioName.toLowerCase().replace(/\s+/g, '-')]
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
  } catch {
    return false;
  }
}

/**
 * Process a single studio
 */
async function processStudio(studio) {
  console.log(`\n📍 ${studio.name}`);
  console.log(`   Widget ID: ${studio.widgetId}`);
  console.log('-'.repeat(50));

  stats.studiosAttempted++;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let studioClassesFound = 0;
  let studioClassesAdded = 0;

  try {
    // First, delete old auto-scraped classes to refresh
    console.log('   Clearing old scraped classes...');
    await deleteOldClasses(studio.name, todayStr);

    for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Fetch schedule for this date
      const data = await fetchMindbodySchedule(studio.widgetId, dateStr);

      if (!data || !data.class_sessions) {
        continue;
      }

      // Parse classes from HTML response
      const classes = parseClasses(data.class_sessions, dateStr, studio);

      if (classes.length > 0) {
        const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        console.log(`   ${dayName}: ${classes.length} classes`);

        for (const cls of classes) {
          studioClassesFound++;
          stats.classesFound++;

          // Check for duplicates
          const exists = await classExists(cls.title, cls.date, cls.studioName, cls.time);
          if (exists) {
            stats.classesDuplicate++;
            continue;
          }

          // Insert into database
          const success = await insertClass(cls);
          if (success) {
            stats.classesAdded++;
            studioClassesAdded++;
          }
        }
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`   ✅ Total: ${studioClassesFound} found, ${studioClassesAdded} added`);
    stats.studiosSuccessful++;

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.studiosFailed++;
    stats.errors.push({ studio: studio.name, error: error.message });
  }
}

/**
 * Main function
 */
async function main() {
  const startTime = new Date();

  console.log('\n' + '='.repeat(60));
  console.log('🧘 PULSE FITNESS CLASS SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started: ${startTime.toLocaleString()}`);
  console.log(`Studios: ${FITNESS_STUDIOS.length}`);
  console.log(`Days to scrape: ${DAYS_TO_SCRAPE}`);
  console.log('='.repeat(60));

  for (const studio of FITNESS_STUDIOS) {
    await processStudio(studio);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  const endTime = new Date();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Studios:     ${stats.studiosSuccessful}/${stats.studiosAttempted} successful`);
  console.log(`Classes:     ${stats.classesFound} found`);
  console.log(`             ${stats.classesAdded} added`);
  console.log(`             ${stats.classesDuplicate} duplicates`);
  console.log(`Duration:    ${duration} seconds`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  • ${e.studio}: ${e.error}`));
  }

  console.log(`\nCompleted: ${endTime.toLocaleString()}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
