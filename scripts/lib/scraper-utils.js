/**
 * Shared Scraper Utilities
 *
 * Common functions used across all scraper scripts.
 * Centralizes dedup checks, insertion with date validation,
 * timezone-aware date helpers, and post-scrape data quality validation.
 *
 * Usage:
 *   import { classExists, insertClass, getTodayPacific, validateScrapedData } from './lib/scraper-utils.js';
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// ============================================================
// DATE HELPERS
// ============================================================

/**
 * Get today's date in Pacific timezone as YYYY-MM-DD.
 * Avoids the UTC vs local bug: Supabase runs in UTC, so CURRENT_DATE
 * at 9 PM Pacific is actually tomorrow in UTC. This function always
 * returns the correct Pacific date.
 */
export function getTodayPacific() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date());
}

/**
 * Get a future date in Pacific timezone as YYYY-MM-DD.
 * @param {number} daysFromNow - Number of days from today
 */
export function getEndDatePacific(daysFromNow) {
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

// ============================================================
// DEDUP CHECK
// ============================================================

/**
 * Check if a class already exists in the database.
 * Checks ALL fields that make a record unique: title + date + venue + time.
 *
 * LESSON (Feb 6, 2026): Previously only checked title+date+venue, which
 * caused false positives when the same class runs at different times
 * (e.g., "Train Wild" at 7:45 AM, 9:00 AM, 10:15 AM).
 *
 * @param {string} title - Class title
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} venueName - Venue/studio name
 * @param {string} time - Start time in HH:MM format
 * @returns {Promise<boolean>} true if the class already exists
 */
export async function classExists(title, date, venueName, time) {
  try {
    let url = `${SUPABASE_URL}/rest/v1/events?title=eq.${encodeURIComponent(title)}&start_date=eq.${date}&venue_name=eq.${encodeURIComponent(venueName)}`;
    if (time) {
      const normalizedTime = time.length === 5 ? `${time}:00` : time;
      url += `&start_time=eq.${encodeURIComponent(normalizedTime)}`;
    }
    url += '&limit=1';
    const response = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await response.json();
    return data.length > 0;
  } catch {
    return false;
  }
}

// ============================================================
// INSERT WITH VALIDATION
// ============================================================

/**
 * Insert a class into the database with date format validation.
 *
 * SAFETY: Rejects classes without a valid parsed date (YYYY-MM-DD).
 * This prevents the bug where navigation fails silently and all classes
 * get assigned a computed date from the loop counter instead of a real
 * parsed date from the page.
 *
 * @param {object} cls - Class data object with at minimum:
 *   title, date, time, venueName, address, category, bookingSystem
 * @returns {Promise<boolean>} true if insertion succeeded
 */
export async function insertClass(cls) {
  // SAFETY: Reject classes without a valid parsed date
  if (!cls.date || !/^\d{4}-\d{2}-\d{2}$/.test(cls.date)) {
    console.warn(`   [scraper-utils] Skipping "${cls.title}" - invalid date: ${cls.date}`);
    return false;
  }

  const eventData = {
    title: cls.title,
    description: cls.instructor
      ? `Instructor: ${cls.instructor}`
      : `${cls.category} class at ${cls.venueName || cls.studioName}`,
    venue_name: cls.venueName || cls.studioName,
    venue_address: cls.address || cls.studioAddress,
    category: cls.category,
    event_type: 'class',
    start_date: cls.date,
    start_time: cls.time,
    end_time: cls.endTime || null,
    price: 0,
    is_free: false,
    price_description: 'See venue for pricing',
    status: 'active',
    tags: cls.tags || ['auto-scraped', cls.bookingSystem || 'unknown', (cls.venueName || cls.studioName || '').toLowerCase().replace(/\s+/g, '-')]
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

// ============================================================
// POST-SCRAPE VALIDATION
// ============================================================

/**
 * Post-scrape validation: detect suspicious date duplication.
 *
 * If a venue has too many records per unique class title, the scraper
 * likely failed to navigate and stamped the same schedule across dates.
 * Ratio > 25 means ~same classes on every day for 30 days.
 *
 * LESSON (Feb 5, 2026): WellnessLiving and Brandedweb scrapers used
 * day-by-day loops with fragile navigation. When nav failed silently,
 * the same page was scraped 30 times, each iteration assigned a
 * different computed date. Result: 785+ bad records.
 *
 * @param {string} venueName - Name of the venue to validate
 * @param {string} bookingSystemTag - Tag for the booking system (e.g., 'wellnessliving')
 * @returns {Promise<boolean>} true if data looks valid, false if duplicates were detected and deleted
 */
export async function validateScrapedData(venueName, bookingSystemTag) {
  try {
    const todayStr = getTodayPacific();
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events?select=title,start_date&venue_name=eq.${encodeURIComponent(venueName)}&event_type=eq.class&start_date=gte.${todayStr}&tags=cs.{auto-scraped,${bookingSystemTag}}`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return true;

    const titles = new Set(data.map(d => d.title));
    const ratio = data.length / titles.size;

    // A class running every day for 30 days = ratio of 30.
    // Most classes run 2-5x/week = ratio of 8-20 over 30 days.
    // Ratio > 25 strongly indicates duplication (same schedule stamped on every day).
    if (ratio > 25) {
      console.warn(`   [scraper-utils] VALIDATION FAIL: ${venueName} has ${data.length} records for ${titles.size} unique classes (ratio: ${ratio.toFixed(1)}x)`);
      console.warn(`      This likely indicates failed navigation causing date duplication.`);
      console.warn(`      Deleting suspicious data to prevent incorrect schedules.`);

      // Delete the suspicious data
      await fetch(
        `${SUPABASE_URL}/rest/v1/events?venue_name=eq.${encodeURIComponent(venueName)}&event_type=eq.class&start_date=gte.${todayStr}&tags=cs.{auto-scraped,${bookingSystemTag}}`,
        {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }
      );
      return false;
    }
    return true;
  } catch {
    return true; // Don't block on validation errors
  }
}

// ============================================================
// TIME PARSING
// ============================================================

/**
 * Parse a time string into HH:MM 24-hour format.
 * Handles formats like "8:30 AM", "6:00PM", "14:30", etc.
 *
 * @param {string} timeStr - Time string to parse
 * @returns {string} Time in HH:MM format, or '09:00' if unparseable
 */
export function parseTime(timeStr) {
  if (!timeStr) return '09:00';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
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

// ============================================================
// DELETE OLD CLASSES
// ============================================================

/**
 * Delete previously scraped classes for a venue from a given date onwards.
 *
 * @param {string} venueName - Name of the venue
 * @param {string} fromDate - YYYY-MM-DD start date
 * @param {string} bookingSystemTag - Tag for the booking system
 */
export async function deleteOldClasses(venueName, fromDate, bookingSystemTag) {
  try {
    const tagFilter = bookingSystemTag
      ? `&tags=cs.{auto-scraped,${bookingSystemTag}}`
      : '&tags=cs.{auto-scraped}';
    await fetch(
      `${SUPABASE_URL}/rest/v1/events?venue_name=eq.${encodeURIComponent(venueName)}&event_type=eq.class&start_date=gte.${fromDate}${tagFilter}`,
      {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      }
    );
  } catch {
    // Silently continue - deletion failure is not critical
  }
}
