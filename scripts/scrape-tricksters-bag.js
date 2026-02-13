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
  pageUrl: 'https://brackendaleartgallery.com/whats-happening-at-the-bag/'
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
// BRACKENDALE ART GALLERY — Firecrawl on their actual events page
// The Eventbrite widget renders with JS; Firecrawl's waitFor handles it.
// The rendered markdown has a clean, consistent format:
//   "February 12, 2026 @ 7:00 pm - 9:00 pm"
//   "### Event Title"
//   "41950 Government Road, Squamish, BC V0N 1H0"
//   "Description text"
// ============================================================

async function scrapeBAG() {
  console.log(`\n--- Brackendale Art Gallery (page via Firecrawl) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  console.log(`   Fetching: ${BAG.pageUrl}`);

  try {
    const response = await retryWithBackoff(
      () => fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
        },
        body: JSON.stringify({
          url: BAG.pageUrl,
          formats: ['markdown'],
          timeout: 60000,
          waitFor: 10000
        })
      }),
      { label: 'Firecrawl BAG page' }
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

    // Parse the rendered Eventbrite widget markdown.
    // Format is consistent blocks of:
    //   [DayAbbrev][DayNum]
    //   [Month] [Day], [Year] @ [Time] - [OptEndDate @] [EndTime]
    //   ### [Title]
    //   [Address]
    //   [Description]
    //   [Buy tickets / Register / View details]

    const lines = markdown.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Look for date lines: "February 12, 2026 @ 7:00 pm - 9:00 pm"
      const dateMatch = line.match(
        /^(\w+)\s+(\d{1,2}),\s*(\d{4})\s*@\s*(\d{1,2}:\d{2}\s*[ap]m)\s*[-–]\s*(?:\w+\s+\d{1,2},\s*\d{4}\s*@\s*)?(\d{1,2}:\d{2}\s*[ap]m)/i
      );

      if (dateMatch) {
        const monthStr = dateMatch[1];
        const day = parseInt(dateMatch[2]);
        const year = parseInt(dateMatch[3]);
        const startTimeRaw = dateMatch[4];
        const endTimeRaw = dateMatch[5];

        const monthNum = parseMonth(monthStr);
        if (monthNum === null) { i++; continue; }

        const date = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const startTime = convertTo24h(startTimeRaw);
        const endTime = convertTo24h(endTimeRaw);

        // Skip events outside our window
        if (date < today || date > endDate) { i++; continue; }

        // Look ahead for title (### heading)
        let title = '';
        let description = '';
        let j = i + 1;

        while (j < lines.length && j < i + 10) {
          const nextLine = lines[j].trim();
          const headingMatch = nextLine.match(/^#{1,3}\s+(.+)/);
          if (headingMatch) {
            title = headingMatch[1].trim();
            // Grab description from lines after heading, skipping address and action buttons
            for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
              const descLine = lines[k].trim();
              if (!descLine) continue;
              if (descLine.startsWith('41950')) continue; // address
              if (descLine.startsWith('![')) continue; // image
              if (/^(Buy tickets|Register|View details)$/i.test(descLine)) continue;
              if (descLine.length > 10 && descLine.length < 300) {
                description = descLine;
                break;
              }
            }
            break;
          }
          j++;
        }

        if (!title) { i++; continue; }

        const category = categorizeEvent(title, description);
        const costInfo = { price: 0, isFree: true, priceDescription: 'Free' };
        // We don't have price in the rendered widget text, default to free
        // (Eventbrite shows "Buy tickets" vs "Register" but not the price)

        events.push({
          title,
          date,
          time: startTime,
          endTime,
          description: description || `${title} at Brackendale Art Gallery`,
          category,
          venueName: BAG.venue,
          address: BAG.address,
          tags: ['auto-scraped', 'bag-website', BAG.tag],
          ...costInfo
        });
      }

      i++;
    }
  } catch (error) {
    console.error(`   Error scraping BAG: ${error.message}`);
  }

  console.log(`   Found ${events.length} events`);
  return events;
}

const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

function parseMonth(str) {
  return MONTH_MAP[str.toLowerCase()] ?? null;
}

function convertTo24h(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
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
