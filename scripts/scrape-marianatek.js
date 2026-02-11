#!/usr/bin/env node

/**
 * Mariana Tek Scraper — Roundhouse Martial Arts & Fitness
 *
 * Scrapes class schedules from the Mariana Tek public API.
 * No authentication required — uses the customer-facing API.
 *
 * API: https://{tenant}.marianatek.com/api/customer/v1/classes
 *
 * Run standalone:  node scripts/scrape-marianatek.js
 * Called from:     scrape-reliable-sources.js (booking_system: 'marianatek')
 */

import {
  classExists,
  insertClass,
  deleteOldClasses,
  getTodayPacific,
  getEndDatePacific,
  validateScrapedData
} from './lib/scraper-utils.js';
import {
  recordScrapeSuccess,
  recordScrapeFailure
} from './lib/reliable-sources.js';

const DAYS_TO_SCRAPE = 30;

/**
 * Scrape all classes from a Mariana Tek tenant.
 * @param {object} source - Source config (needs: name, studio_id (tenant slug), address, category)
 * @returns {{ classesFound: number, classesAdded: number }}
 */
export async function scrapeMarianaTekClasses(source) {
  const tenant = source.studio_id; // e.g., "roundhousesquamish"
  const venueName = source.name;
  const todayStr = getTodayPacific();
  const endDateStr = getEndDatePacific(DAYS_TO_SCRAPE);

  console.log(`\n📍 ${venueName} (Mariana Tek)`);
  console.log('-'.repeat(50));

  // Phase 1: Fetch all classes from the API
  const apiUrl = `https://${tenant}.marianatek.com/api/customer/v1/classes?min_start_date=${todayStr}&max_start_date=${endDateStr}&page_size=200`;
  console.log(`   Fetching: ${apiUrl}`);

  let allResults = [];
  let url = apiUrl;

  // Paginate through all results
  while (url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Mariana Tek API failed: HTTP ${resp.status}`);

    const data = await resp.json();
    if (data.results) allResults.push(...data.results);
    url = data.next; // null when no more pages

    if (url) await new Promise(r => setTimeout(r, 300));
  }

  console.log(`   API returned ${allResults.length} classes`);

  // Filter out cancelled classes
  const active = allResults.filter(c => !c.is_cancelled && c.status !== 'cancelled');

  // Map to standard format
  const classes = [];
  for (const cls of active) {
    const mapped = mapMarianaTekClass(cls, source);
    if (mapped) classes.push(mapped);
  }

  const classesFound = classes.length;
  console.log(`   ${classesFound} active classes mapped`);

  // Show class type breakdown
  const typeCounts = {};
  classes.forEach(c => { typeCounts[c.title] = (typeCounts[c.title] || 0) + 1; });
  Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`      ${String(count).padStart(3)}x  ${name}`);
  });

  if (classesFound === 0) {
    console.warn(`   ⚠️ No classes found for ${venueName}`);
    return { classesFound: 0, classesAdded: 0 };
  }

  // Phase 2: Delete old data
  await deleteOldClasses(venueName, todayStr, 'marianatek');

  // Phase 3: Insert with dedup
  let classesAdded = 0;
  for (const cls of classes) {
    const exists = await classExists(cls.title, cls.date, cls.venueName, cls.time);
    if (exists) continue;

    const success = await insertClass(cls);
    if (success) classesAdded++;
  }

  console.log(`   ✅ ${venueName}: ${classesAdded} added (${classesFound} found)`);
  return { classesFound, classesAdded };
}

/** Map a Mariana Tek class object to our standard format */
function mapMarianaTekClass(cls, source) {
  // start_date: "2026-02-12", start_time: "16:00:00"
  const date = cls.start_date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  // Parse start time (comes as "HH:MM:SS" in local timezone)
  const startTime = cls.start_time?.substring(0, 5); // "16:00"
  if (!startTime) return null;

  // Calculate end time from duration
  let endTime = null;
  const duration = cls.class_type?.duration;
  if (duration && startTime) {
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + duration;
    endTime = `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
  }

  // Instructor
  const instructors = cls.instructors || [];
  const instructorName = instructors.map(i => i.name).filter(Boolean).join(', ') || null;

  // Price — Mariana Tek classes may be free or included in membership
  const isFree = cls.is_free_class || false;

  // Build description
  const parts = [];
  if (instructorName) parts.push(`Instructor: ${instructorName}`);
  if (cls.class_type?.description) parts.push(cls.class_type.description.substring(0, 200));
  if (cls.available_spot_count !== undefined && cls.capacity) {
    parts.push(`${cls.available_spot_count}/${cls.capacity} spots available`);
  }

  return {
    title: cls.class_type?.name || cls.name || 'Unknown Class',
    date,
    time: startTime,
    endTime,
    instructor: instructorName,
    venueName: source.name,
    address: source.address,
    category: source.category,
    bookingSystem: 'marianatek',
    price: 0,
    isFree,
    priceDescription: isFree ? 'Free' : 'See venue for pricing',
    description: parts.join(' | ') || `${source.category} class at ${source.name}`,
    tags: ['auto-scraped', 'marianatek', source.name.toLowerCase().replace(/\s+/g, '-')]
  };
}

// ============================================================
// STANDALONE ENTRY POINT
// ============================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🥊 MARIANA TEK SCRAPER — Roundhouse Martial Arts');
  console.log('='.repeat(70));

  const source = {
    name: 'Roundhouse Martial Arts & Fitness',
    studio_id: 'roundhousesquamish',
    url: 'https://www.roundhousesquamish.com/programs-schedule',
    address: '38147 Cleveland Ave #201, Squamish, BC',
    category: 'Martial Arts'
  };

  try {
    const result = await scrapeMarianaTekClasses(source);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ Done: ${result.classesFound} found, ${result.classesAdded} added`);
    await validateScrapedData(source.name, 'marianatek');
    await recordScrapeSuccess(source.name, result.classesFound);
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    await recordScrapeFailure(source.name, error.message);
    process.exitCode = 1;
  }

  console.log('='.repeat(70) + '\n');
}

const isMainModule = process.argv[1]?.endsWith('scrape-marianatek.js');
if (isMainModule) main();
