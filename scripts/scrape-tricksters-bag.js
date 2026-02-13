#!/usr/bin/env node

/**
 * Dynamic scraper for Trickster's Hideout and Brackendale Art Gallery
 *
 * Data sources:
 *   - Trickster's: WordPress REST API (tribe/events/v1)
 *   - BAG: Eventbrite organization page via Firecrawl
 *
 * Run: node scripts/scrape-tricksters-bag.js
 */

import { classExists, getTodayPacific, getEndDatePacific, retryWithBackoff } from './lib/scraper-utils.js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FIRECRAWL_API_KEY as getFirecrawlKey } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();
const FIRECRAWL_API_KEY = getFirecrawlKey();

const TRICKSTERS = {
  venue: "Trickster's Hideout",
  address: '38005 Cleveland Ave, Squamish, BC V8B 0C3',
  tag: 'tricksters-hideout',
  apiBase: 'https://trickstershideout.ca/wp-json/tribe/events/v1/events'
};

const BAG = {
  venue: 'Brackendale Art Gallery',
  address: '41950 Government Rd, Brackendale, BC',
  tag: 'brackendale-art-gallery',
  eventbriteUrl: 'https://www.eventbrite.ca/o/brackendale-art-gallery-59178760723'
};

// ============================================================
// INSERT HELPER
// ============================================================

async function insertEvent(evt) {
  if (!evt.date || !/^\d{4}-\d{2}-\d{2}$/.test(evt.date)) {
    console.warn(`   [skip] "${evt.title}" - invalid date: ${evt.date}`);
    return false;
  }

  const eventData = {
    title: evt.title,
    description: evt.description || `${evt.category} event at ${evt.venueName}`,
    venue_name: evt.venueName,
    venue_address: evt.address,
    category: evt.category,
    event_type: 'event',
    start_date: evt.date,
    start_time: evt.time,
    end_time: evt.endTime || null,
    price: evt.price || 0,
    is_free: evt.isFree || false,
    price_description: evt.priceDescription || (evt.isFree ? 'Free' : 'See venue for pricing'),
    status: 'active',
    tags: evt.tags
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
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.warn(`   [insert-fail] ${evt.title} on ${evt.date}: HTTP ${response.status} - ${errorBody.substring(0, 100)}`);
    }
    return response.ok;
  } catch (error) {
    console.warn(`   [insert-fail] ${evt.title} on ${evt.date}: ${error.message}`);
    return false;
  }
}

// ============================================================
// TRICKSTER'S HIDEOUT — WordPress Tribe Events REST API
// ============================================================

/**
 * Decode HTML entities from WordPress API responses.
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseTime24(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-CA', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Vancouver' });
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // Format in Pacific time
  const parts = d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' }).split('/');
  // en-CA gives YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
}

function categorizeEvent(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (/dj|dance|karaoke|burlesque|club|party|nightlife/.test(text)) return 'Nightlife';
  if (/comedy|standup|stand-up|comedian/.test(text)) return 'Arts & Culture';
  if (/trivia|movie|film|bingo|open mic|storytelling|entrepreneur|networking|meet ?up|toastmasters/.test(text)) return 'Community';
  if (/tribute|concert|band|live music|album|piano|country night|punk|rock/.test(text)) return 'Nightlife';
  if (/art|gallery|exhibition|paint|drawing/.test(text)) return 'Arts & Culture';
  if (/yoga|meditation|workout|breathwork|wellness/.test(text)) return 'Wellness';
  return 'Community';
}

function parseCost(costStr) {
  if (!costStr || costStr === '' || costStr.toLowerCase() === 'free') {
    return { price: 0, isFree: true, priceDescription: 'Free' };
  }
  // Extract first dollar amount
  const match = costStr.match(/\$?([\d.]+)/);
  const price = match ? parseFloat(match[1]) : 0;
  return {
    price,
    isFree: price === 0,
    priceDescription: costStr
  };
}

async function scrapeTricksters() {
  console.log(`\n--- Trickster's Hideout (WordPress REST API) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  // Paginate through API — fetch up to 100 events
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${TRICKSTERS.apiBase}?start_date=${today}&end_date=${endDate}&per_page=50&page=${page}`;
    console.log(`   Fetching page ${page}: ${url}`);

    try {
      const response = await retryWithBackoff(
        () => fetch(url, {
          headers: { 'User-Agent': 'PulseApp-Scraper/1.0' }
        }),
        { label: `Tricksters API page ${page}` }
      );

      if (!response.ok) {
        console.warn(`   API returned ${response.status} on page ${page}`);
        break;
      }

      const data = await response.json();
      const apiEvents = data.events || [];

      if (apiEvents.length === 0) {
        hasMore = false;
        break;
      }

      for (const evt of apiEvents) {
        const title = decodeHtmlEntities(evt.title || '');
        const description = decodeHtmlEntities((evt.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500));
        const date = parseDate(evt.start_date || evt.utc_start_date);
        const startTime = parseTime24(evt.start_date || evt.utc_start_date);
        const endTime = parseTime24(evt.end_date || evt.utc_end_date);
        const costInfo = parseCost(evt.cost || '');

        if (!date || !startTime || !title) {
          console.warn(`   [skip] Missing data for "${title}" - date:${date} time:${startTime}`);
          continue;
        }

        events.push({
          title,
          date,
          time: startTime,
          endTime,
          description: description || `Event at Trickster's Hideout`,
          category: categorizeEvent(title, description),
          venueName: TRICKSTERS.venue,
          address: TRICKSTERS.address,
          tags: ['auto-scraped', 'wp-tribe-api', TRICKSTERS.tag],
          ...costInfo
        });
      }

      // Check pagination
      const totalPages = data.total_pages || 1;
      hasMore = page < totalPages;
      page++;
    } catch (error) {
      console.error(`   Error fetching Tricksters API page ${page}: ${error.message}`);
      break;
    }
  }

  console.log(`   Found ${events.length} events from API`);
  return events;
}

// ============================================================
// BRACKENDALE ART GALLERY — Eventbrite via Firecrawl
// ============================================================

async function scrapeBAG() {
  console.log(`\n--- Brackendale Art Gallery (Eventbrite via Firecrawl) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  console.log(`   Fetching: ${BAG.eventbriteUrl}`);

  try {
    // Use markdown mode — more reliable than extract for Eventbrite's heavy JS
    const response = await retryWithBackoff(
      () => fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
        },
        body: JSON.stringify({
          url: BAG.eventbriteUrl,
          formats: ['markdown'],
          timeout: 60000,
          waitFor: 8000
        })
      }),
      { label: 'Firecrawl BAG Eventbrite' }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(`   Firecrawl error: ${data.error || response.status}`);
      return events;
    }

    const markdown = data.data?.markdown || '';
    if (!markdown) {
      console.warn('   No markdown content returned');
      return events;
    }

    console.log(`   Got ${markdown.length} chars of markdown`);

    // Parse events from Eventbrite markdown
    // Eventbrite org pages list events as blocks with title, date, time, price
    const parsedEvents = parseEventbriteMarkdown(markdown, today, endDate);
    console.log(`   Parsed ${parsedEvents.length} events from markdown`);

    for (const evt of parsedEvents) {
      const costInfo = parseCost(evt.price);
      const category = categorizeEvent(evt.title, evt.description || '');

      // If it has recurrence info, expand dates
      if (evt.isRecurring && evt.dayOfWeek !== undefined) {
        const seriesEnd = evt.seriesEndDate || endDate;
        const endDt = new Date(Math.min(new Date(seriesEnd + 'T23:59:59').getTime(), new Date(endDate + 'T23:59:59').getTime()));
        const dates = expandRecurring(evt.dayOfWeek, today, endDt);

        for (const date of dates) {
          events.push({
            title: evt.title,
            date,
            time: evt.startTime || '19:00',
            endTime: evt.endTime || null,
            description: evt.description || `${evt.title} at Brackendale Art Gallery`,
            category,
            venueName: BAG.venue,
            address: BAG.address,
            tags: ['auto-scraped', 'eventbrite-markdown', BAG.tag],
            ...costInfo
          });
        }
      } else if (evt.date) {
        // One-time event within window
        if (evt.date >= today && evt.date <= endDate) {
          events.push({
            title: evt.title,
            date: evt.date,
            time: evt.startTime || '19:00',
            endTime: evt.endTime || null,
            description: evt.description || `${evt.title} at Brackendale Art Gallery`,
            category,
            venueName: BAG.venue,
            address: BAG.address,
            tags: ['auto-scraped', 'eventbrite-markdown', BAG.tag],
            ...costInfo
          });
        }
      }
    }
  } catch (error) {
    console.error(`   Error scraping BAG: ${error.message}`);
  }

  console.log(`   Expanded to ${events.length} individual event dates`);
  return events;
}

/**
 * Parse Eventbrite organizer page markdown into event objects.
 * Eventbrite pages typically list events with titles, dates, and prices.
 */
function parseEventbriteMarkdown(markdown, today, endDate) {
  const events = [];
  const lines = markdown.split('\n');

  // Day-of-week detection for recurring series
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const monthNames = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  // Eventbrite markdown typically has event blocks like:
  // ### Event Title
  // Date info (e.g. "Every Monday", "Sat, Feb 15", "Feb 13 - Mar 20")
  // Time info (e.g. "9:30 AM - 10:30 AM PST")
  // Price (e.g. "$12.58", "Free")

  let currentTitle = '';
  let currentLines = [];

  function processBlock(title, blockLines) {
    if (!title) return;
    const text = blockLines.join(' ').toLowerCase();
    const rawText = blockLines.join(' ');

    // Extract time — look for patterns like "9:30 AM", "7:00 PM - 9:00 PM"
    let startTime = null;
    let endTime = null;
    const timeMatch = rawText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*[-–]?\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?/);
    if (timeMatch) {
      startTime = convertTo24h(timeMatch[1]);
      if (timeMatch[2]) endTime = convertTo24h(timeMatch[2]);
    }

    // Extract price
    let price = 'Free';
    const priceMatch = rawText.match(/\$[\d.]+/);
    if (priceMatch) price = priceMatch[0];
    if (/free/i.test(rawText) && !priceMatch) price = 'Free';

    // Check if recurring (look for "Every Monday", "Mondays", etc.)
    let isRecurring = false;
    let dayOfWeek = undefined;
    let seriesEndDate = null;

    for (let i = 0; i < dayNames.length; i++) {
      const dayPattern = new RegExp(`every\\s+${dayNames[i]}|${dayNames[i]}s\\b`, 'i');
      if (dayPattern.test(rawText)) {
        isRecurring = true;
        dayOfWeek = i;
        break;
      }
    }

    // Try to find series end date (e.g. "through Mar 23" or "- Mar 23, 2026")
    const throughMatch = rawText.match(/(?:through|until|ending|thru|[-–]\s*)\s*(?:(\w{3})\w*\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?)/i);
    if (throughMatch && isRecurring) {
      const mon = monthNames[throughMatch[1].toLowerCase().substring(0, 3)];
      const day = parseInt(throughMatch[2]);
      const year = throughMatch[3] ? parseInt(throughMatch[3]) : new Date().getFullYear();
      if (mon !== undefined) {
        seriesEndDate = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Try to find specific date for non-recurring events
    let date = null;
    if (!isRecurring) {
      // Match patterns like "Feb 15, 2026" or "February 15" or "2026-02-15"
      const dateMatch = rawText.match(/(\w{3,9})\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/);
      if (dateMatch) {
        const mon = monthNames[dateMatch[1].toLowerCase().substring(0, 3)];
        const day = parseInt(dateMatch[2]);
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : new Date().getFullYear();
        if (mon !== undefined) {
          date = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }

    // Extract a short description from the text (first non-title, non-date line)
    let description = '';
    for (const line of blockLines) {
      const l = line.trim();
      if (l && l !== title && !timeMatch?.[0]?.includes(l) && l.length > 10 && l.length < 200) {
        description = l;
        break;
      }
    }

    events.push({
      title: title.trim(),
      date,
      startTime,
      endTime,
      price,
      description,
      isRecurring,
      dayOfWeek,
      seriesEndDate
    });
  }

  for (const line of lines) {
    // Detect event title (markdown heading or bold text)
    const headingMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^\*\*(.+)\*\*/);
    if (headingMatch) {
      // Process previous block
      processBlock(currentTitle, currentLines);
      currentTitle = headingMatch[1].replace(/\*\*/g, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  // Process last block
  processBlock(currentTitle, currentLines);

  return events.filter(e => e.title && (e.date || e.isRecurring));
}

/**
 * Convert 12h time string to 24h format.
 */
function convertTo24h(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (!match) return timeStr;
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}

/**
 * Expand a recurring day-of-week into specific dates within a range.
 */
function expandRecurring(dayOfWeek, startStr, endDate) {
  const dates = [];
  const start = new Date(startStr + 'T12:00:00');
  const end = endDate instanceof Date ? endDate : new Date(endDate + 'T12:00:00');

  let current = new Date(start);
  while (current.getDay() !== dayOfWeek) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('=== Scraping Trickster\'s Hideout & Brackendale Art Gallery ===');
  console.log(`   Date range: ${getTodayPacific()} to ${getEndDatePacific(30)}`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Fetch events from both sources
  const tricksterEvents = await scrapeTricksters();
  const bagEvents = await scrapeBAG();
  const allEvents = [...tricksterEvents, ...bagEvents];

  console.log(`\n--- Inserting ${allEvents.length} events ---`);

  for (const event of allEvents) {
    const exists = await classExists(event.title, event.date, event.venueName, event.time);
    if (exists) {
      console.log(`   [skip] ${event.title} on ${event.date} at ${event.time} (already exists)`);
      skipped++;
      continue;
    }

    const ok = await insertEvent(event);
    if (ok) {
      console.log(`   [+] ${event.title} on ${event.date} at ${event.time}`);
      inserted++;
    } else {
      failed++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Trickster's events found: ${tricksterEvents.length}`);
  console.log(`BAG events found: ${bagEvents.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total processed: ${inserted + skipped + failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
