#!/usr/bin/env node

/**
 * Venue Event Scraper — scrapes events from venues with JS-rendered or
 * API-based event pages that the generic AI extractor can't reach.
 *
 * Venues & data sources:
 *   1. Trickster's Hideout — WordPress Tribe Events REST API
 *   2. Brackendale Art Gallery — Firecrawl on Eventbrite widget page
 *   3. A-Frame Brewing — Squarespace JSON API
 *   4. Arrow Wood Games — Firecrawl on Tockify pinboard
 *   5. Sea to Sky Gondola — Firecrawl main page + detail page fetches
 *   6. Squamish Public Library — Communico /eeventcaldata API
 *   7. Squamish Arts Council — WordPress Tribe Events REST API
 *   8. Tourism Squamish — Calendar HTML + detail page fetches
 *
 * Run: node scripts/scrape-venue-events.js
 */

import { classExists, getTodayPacific, getEndDatePacific, retryWithBackoff } from './lib/scraper-utils.js';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FIRECRAWL_API_KEY as getFirecrawlKey } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();
const FIRECRAWL_API_KEY = getFirecrawlKey();

// ============================================================
// VENUE CONFIGS
// ============================================================

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

const AFRAME = {
  venue: 'A-Frame Brewing',
  address: '1-38927 Queens Way, Squamish, BC',
  tag: 'a-frame-brewing',
  apiUrl: 'https://aframebrewing.com/events-1?format=json'
};

const ARROWWOOD = {
  venue: 'Arrow Wood Games',
  address: '38157 2nd Ave, Squamish, BC V8B 0C4',
  tag: 'arrow-wood-games',
  pinboardUrl: 'https://tockify.com/awgevents/pinboard'
};

const GONDOLA = {
  venue: 'Sea to Sky Gondola',
  address: '36800 BC-99, Squamish, BC V8B 0N7',
  tag: 'sea-to-sky-gondola',
  pageUrl: 'https://seatoskygondola.com/events/'
};

const LIBRARY = {
  venue: 'Squamish Public Library',
  address: '37907 2nd Ave, Squamish, BC V8B 0A6',
  tag: 'squamish-library',
  apiBase: 'https://events.squamishlibrary.ca/eeventcaldata'
};

const ARTS_COUNCIL = {
  tag: 'squamish-arts',
  apiBase: 'https://squamisharts.com/wp-json/tribe/events/v1/events'
};

const TOURISM_SQUAMISH = {
  tag: 'tourism-squamish',
  calendarBase: 'https://www.exploresquamish.com/festivals-events/event-calendar/'
};

// ============================================================
// SHARED HELPERS
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
      console.warn(`   [insert-fail] ${evt.title} on ${evt.date}: HTTP ${response.status} - ${errorBody.substring(0, 200)}`);
    }
    return response.ok;
  } catch (error) {
    console.warn(`   [insert-fail] ${evt.title} on ${evt.date}: ${error.message}`);
    return false;
  }
}

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
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function categorizeEvent(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (/dj|dance|karaoke|burlesque|club|party|nightlife/.test(text)) return 'Nightlife';
  if (/comedy|standup|stand-up|comedian/.test(text)) return 'Arts & Culture';
  if (/trivia|movie|film|bingo|open mic|storytelling|entrepreneur|networking|meet ?up|toastmasters/.test(text)) return 'Community';
  if (/tribute|concert|band|live music|album|piano|country night|punk|rock|music/.test(text)) return 'Nightlife';
  if (/art|gallery|exhibition|paint|drawing/.test(text)) return 'Arts & Culture';
  if (/yoga|meditation|workout|breathwork|wellness|hike|snowshoe/.test(text)) return 'Wellness';
  if (/d&d|dungeons|mtg|magic|board game|game|pokemon|warhammer|catan|kitties/.test(text)) return 'Community';
  if (/tapas|wine|dining|food|brunch|chef/.test(text)) return 'Food & Drink';
  if (/family|kids|camp|learn/.test(text)) return 'Community';
  return 'Community';
}

function parseCost(costStr) {
  if (!costStr || costStr === '' || costStr.toLowerCase() === 'free') {
    return { price: 0, isFree: true, priceDescription: 'Free' };
  }
  const match = costStr.match(/\$?([\d.]+)/);
  const price = match ? parseFloat(match[1]) : 0;
  return { price, isFree: price === 0, priceDescription: costStr };
}

const MONTH_MAP = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
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

/** Convert "7pm" or "12:30pm" or "9:15am" to "19:00" or "12:30" or "09:15" */
function convertCompactTo24h(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const minutes = match[2] || '00';
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
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
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
}

/** Fetch markdown from Firecrawl */
async function fetchFirecrawlMarkdown(url, label) {
  const response = await retryWithBackoff(
    () => fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        timeout: 60000,
        waitFor: 10000
      })
    }),
    { label: label || `Firecrawl ${url}` }
  );

  const data = await response.json();
  if (!response.ok || !data.success) {
    console.error(`   Firecrawl error for ${url}: ${data.error || response.status}`);
    return null;
  }
  return data.data?.markdown || null;
}

// ============================================================
// 1. TRICKSTER'S HIDEOUT — WordPress Tribe Events REST API
// ============================================================

async function scrapeTricksters() {
  console.log(`\n--- Trickster's Hideout (WordPress REST API) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${TRICKSTERS.apiBase}?start_date=${today}&end_date=${endDate}&per_page=50&page=${page}`;
    console.log(`   Fetching page ${page}: ${url}`);

    try {
      const response = await retryWithBackoff(
        () => fetch(url, { headers: { 'User-Agent': 'PulseApp-Scraper/1.0' } }),
        { label: `Tricksters API page ${page}` }
      );

      if (!response.ok) {
        console.warn(`   API returned ${response.status} on page ${page}`);
        break;
      }

      const data = await response.json();
      const apiEvents = data.events || [];

      if (apiEvents.length === 0) { hasMore = false; break; }

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
          title, date, time: startTime, endTime,
          description: description || `Event at Trickster's Hideout`,
          category: categorizeEvent(title, description),
          venueName: TRICKSTERS.venue,
          address: TRICKSTERS.address,
          tags: ['auto-scraped', 'wp-tribe-api', TRICKSTERS.tag],
          ...costInfo
        });
      }

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
// 2. BRACKENDALE ART GALLERY — Firecrawl on Eventbrite widget
// ============================================================

async function scrapeBAG() {
  console.log(`\n--- Brackendale Art Gallery (Firecrawl) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  console.log(`   Fetching: ${BAG.pageUrl}`);
  const markdown = await fetchFirecrawlMarkdown(BAG.pageUrl, 'Firecrawl BAG page');
  if (!markdown) return events;

  console.log(`   Got ${markdown.length} chars of markdown`);

  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // "February 12, 2026 @ 7:00 pm - 9:00 pm"
    const dateMatch = line.match(
      /^(\w+)\s+(\d{1,2}),\s*(\d{4})\s*@\s*(\d{1,2}:\d{2}\s*[ap]m)\s*[-–]\s*(?:\w+\s+\d{1,2},\s*\d{4}\s*@\s*)?(\d{1,2}:\d{2}\s*[ap]m)/i
    );

    if (dateMatch) {
      const monthNum = parseMonth(dateMatch[1]);
      if (monthNum === null) { i++; continue; }

      const day = parseInt(dateMatch[2]);
      const year = parseInt(dateMatch[3]);
      const date = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const startTime = convertTo24h(dateMatch[4]);
      const endTime = convertTo24h(dateMatch[5]);

      if (date < today || date > endDate) { i++; continue; }

      let title = '';
      let description = '';
      let j = i + 1;

      while (j < lines.length && j < i + 10) {
        const nextLine = lines[j].trim();
        const headingMatch = nextLine.match(/^#{1,3}\s+(.+)/);
        if (headingMatch) {
          title = headingMatch[1].trim();
          for (let k = j + 1; k < Math.min(j + 6, lines.length); k++) {
            const descLine = lines[k].trim();
            if (!descLine) continue;
            if (descLine.startsWith('41950')) continue;
            if (descLine.startsWith('![')) continue;
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

      events.push({
        title, date, time: startTime, endTime,
        description: description || `${title} at Brackendale Art Gallery`,
        category: categorizeEvent(title, description),
        venueName: BAG.venue,
        address: BAG.address,
        tags: ['auto-scraped', 'bag-website', BAG.tag],
        price: 0, isFree: true, priceDescription: 'Free'
      });
    }

    i++;
  }

  console.log(`   Found ${events.length} events`);
  return events;
}

// ============================================================
// 3. A-FRAME BREWING — Squarespace JSON API
// ============================================================

async function scrapeAFrame() {
  console.log(`\n--- A-Frame Brewing (Squarespace JSON API) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  console.log(`   Fetching: ${AFRAME.apiUrl}`);

  try {
    const response = await retryWithBackoff(
      () => fetch(AFRAME.apiUrl, {
        headers: { 'User-Agent': 'PulseApp-Scraper/1.0' }
      }),
      { label: 'A-Frame Squarespace API' }
    );

    if (!response.ok) {
      console.error(`   Squarespace API returned ${response.status}`);
      return events;
    }

    const data = await response.json();
    const items = data.items || [];

    console.log(`   Got ${items.length} event items from API`);

    for (const item of items) {
      if (!item.startDate || !item.title) continue;

      const title = decodeHtmlEntities(item.title);

      // Squarespace startDate/endDate are Unix timestamps in ms
      const startMs = item.startDate;
      const endMs = item.endDate;

      // Convert to Pacific time date and time
      const startDt = new Date(startMs);
      const date = startDt.toLocaleDateString('en-CA', { timeZone: 'America/Vancouver' });
      const startTime = startDt.toLocaleTimeString('en-CA', {
        hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Vancouver'
      });
      const endTime = endMs ? new Date(endMs).toLocaleTimeString('en-CA', {
        hour12: false, hour: '2-digit', minute: '2-digit', timeZone: 'America/Vancouver'
      }) : null;

      // Filter to our date window
      if (date < today || date > endDate) continue;

      // Extract description from excerpt or body
      let description = '';
      if (item.excerpt) {
        description = item.excerpt.replace(/<[^>]+>/g, '').trim().substring(0, 300);
      } else if (item.body) {
        description = item.body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 300);
      }
      description = decodeHtmlEntities(description) || `${title} at A-Frame Brewing`;

      events.push({
        title, date, time: startTime, endTime, description,
        category: categorizeEvent(title, description),
        venueName: AFRAME.venue,
        address: AFRAME.address,
        tags: ['auto-scraped', 'squarespace-api', AFRAME.tag],
        price: 0, isFree: true, priceDescription: 'Free'
      });
    }
  } catch (error) {
    console.error(`   Error scraping A-Frame: ${error.message}`);
  }

  console.log(`   Found ${events.length} events`);
  return events;
}

// ============================================================
// 4. ARROW WOOD GAMES — Firecrawl on Tockify pinboard
// ============================================================

// Events to skip (regular store hours, not actual events)
const ARROWWOOD_SKIP_TITLES = ['games room open'];

async function scrapeArrowWood() {
  console.log(`\n--- Arrow Wood Games (Tockify Pinboard via Firecrawl) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  console.log(`   Fetching: ${ARROWWOOD.pinboardUrl}`);
  const markdown = await fetchFirecrawlMarkdown(ARROWWOOD.pinboardUrl, 'Firecrawl Arrow Wood pinboard');
  if (!markdown) return events;

  console.log(`   Got ${markdown.length} chars of markdown`);

  // Tockify pinboard format:
  //   DayAbbr MonthAbbr DayNumOrdinal StartTime - EndTime
  //   ### [Title](url)
  //   Description...

  const lines = markdown.split('\n');
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match date/time lines: "Thu Feb 12th 11:00am - 5:00pm"
    const dateTimeMatch = line.match(
      /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)\s+(\d{1,2}(?::\d{2})?(?:am|pm))\s*-\s*(\d{1,2}(?::\d{2})?(?:am|pm))$/i
    );

    if (!dateTimeMatch) continue;

    const monthNum = parseMonth(dateTimeMatch[1]);
    if (monthNum === null) continue;

    const day = parseInt(dateTimeMatch[2]);
    const startTime = convertCompactTo24h(dateTimeMatch[3]);
    const endTime = convertCompactTo24h(dateTimeMatch[4]);

    // Determine year — if month < current month, likely next year
    const nowMonth = new Date().getMonth();
    const year = (monthNum < nowMonth - 1) ? currentYear + 1 : currentYear;
    const date = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (date < today || date > endDate) continue;

    // Look for title on next non-empty line: ### [Title](url)
    let title = '';
    let description = '';
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;

      const titleMatch = nextLine.match(/^#{1,3}\s+\[([^\]]+)\]/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        // Look for description on lines after title
        for (let k = j + 1; k < Math.min(j + 4, lines.length); k++) {
          const descLine = lines[k].trim();
          if (!descLine || descLine.startsWith('!') || descLine.startsWith('#') || descLine.startsWith('[')) continue;
          if (/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i.test(descLine)) break;
          if (descLine.length > 10 && descLine.length < 500) {
            description = descLine;
            break;
          }
        }
        break;
      }
    }

    if (!title) continue;

    // Skip "Games Room OPEN" — those are store hours, not events
    if (ARROWWOOD_SKIP_TITLES.includes(title.toLowerCase())) continue;

    // Extract price from description if available (e.g., "Entry: $15")
    let costInfo = { price: 0, isFree: true, priceDescription: 'Free' };
    const priceMatch = (description || '').match(/(?:Entry|Price|Cost):\s*\$(\d+)/i);
    if (priceMatch) {
      costInfo = { price: parseFloat(priceMatch[1]), isFree: false, priceDescription: `$${priceMatch[1]}` };
    }
    // "Free" in title or description
    if (/free/i.test(title)) {
      costInfo = { price: 0, isFree: true, priceDescription: 'Free' };
    }

    events.push({
      title, date, time: startTime, endTime,
      description: description || `${title} at Arrow Wood Games`,
      category: categorizeEvent(title, description),
      venueName: ARROWWOOD.venue,
      address: ARROWWOOD.address,
      tags: ['auto-scraped', 'tockify-pinboard', ARROWWOOD.tag],
      ...costInfo
    });
  }

  console.log(`   Found ${events.length} events`);
  return events;
}

// ============================================================
// 5. SEA TO SKY GONDOLA — Firecrawl + detail page fetches
// ============================================================

// Skip daily offerings (these are regular services, not events)
const GONDOLA_SKIP_PATTERNS = ['daily'];

// Known event detail page time data (fetched from individual pages)
// We fetch these at scrape time from the detail pages
async function fetchGondolaEventTimes(detailUrl) {
  try {
    const response = await retryWithBackoff(
      () => fetch(detailUrl, { headers: { 'User-Agent': 'PulseApp-Scraper/1.0' } }),
      { label: `Gondola detail: ${detailUrl}` }
    );
    if (!response.ok) return null;

    const html = await response.text();

    // Look for time patterns in the HTML
    // Common formats: "4 - 8pm", "4:00 PM - 8:00 PM", "10am - 2pm"
    const timeMatch = html.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    if (timeMatch) {
      let startRaw = timeMatch[1].trim();
      let endRaw = timeMatch[2].trim();

      // If start time has no am/pm, inherit from end time
      if (!/am|pm/i.test(startRaw) && /am|pm/i.test(endRaw)) {
        const endPeriod = endRaw.match(/(am|pm)/i)[1];
        startRaw += endPeriod;
      }

      // Normalize to include :00 if missing
      if (!/:\d{2}/.test(startRaw)) startRaw = startRaw.replace(/(\d+)/, '$1:00');
      if (!/:\d{2}/.test(endRaw)) endRaw = endRaw.replace(/(\d+)/, '$1:00');

      return {
        startTime: convertTo24h(startRaw),
        endTime: convertTo24h(endRaw)
      };
    }

    return null;
  } catch (error) {
    console.warn(`   [warn] Could not fetch Gondola detail page ${detailUrl}: ${error.message}`);
    return null;
  }
}

/** Expand a recurrence pattern into specific dates within [today, endDate] */
function expandRecurrence(pattern, today, endDate) {
  const dates = [];
  const todayDate = new Date(today + 'T00:00:00');
  const endDateDate = new Date(endDate + 'T00:00:00');

  const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function generateWeeklyDates(dayName, monthStr, dayNum) {
    const monthNum = parseMonth(monthStr);
    if (monthNum === null) return;
    const targetDayOfWeek = DAY_NAMES.indexOf(dayName.toLowerCase());
    if (targetDayOfWeek === -1) return;

    const untilYear = monthNum < todayDate.getMonth() ? todayDate.getFullYear() + 1 : todayDate.getFullYear();
    const untilDate = new Date(untilYear, monthNum, dayNum);

    const cursor = new Date(todayDate);
    while (cursor.getDay() !== targetDayOfWeek) {
      cursor.setDate(cursor.getDate() + 1);
    }
    while (cursor <= untilDate && cursor <= endDateDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (dateStr >= today && dateStr <= endDate) {
        dates.push(dateStr);
      }
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  // "Every Saturday Night until April 18" or "Every Friday until April 17"
  // Check this FIRST — more specific pattern (handles optional "Night" keyword)
  const everyUntilMatch = pattern.match(/^every\s+(\w+)\s+(?:night\s+)?until\s+(\w+)\s+(\d{1,2})/i);
  if (everyUntilMatch) {
    generateWeeklyDates(everyUntilMatch[1], everyUntilMatch[2], parseInt(everyUntilMatch[3]));
    return dates;
  }

  // "Thursdays until March 12" or "Sundays until March 8"
  const weeklyUntilMatch = pattern.match(/^(\w+?)s?\s+until\s+(\w+)\s+(\d{1,2})/i);
  if (weeklyUntilMatch) {
    generateWeeklyDates(weeklyUntilMatch[1], weeklyUntilMatch[2], parseInt(weeklyUntilMatch[3]));
    return dates;
  }

  // "February 14 - February 16" (date range)
  const rangeMatch = pattern.match(/(\w+)\s+(\d{1,2})\s*-\s*(\w+)\s+(\d{1,2})/i);
  if (rangeMatch) {
    const startMonth = parseMonth(rangeMatch[1]);
    const startDay = parseInt(rangeMatch[2]);
    const endMonth = parseMonth(rangeMatch[3]);
    const endDay = parseInt(rangeMatch[4]);
    if (startMonth === null || endMonth === null) return dates;

    const year = todayDate.getFullYear();
    const startDate = new Date(year, startMonth, startDay);
    const rangEndDate = new Date(year, endMonth, endDay);

    const cursor = new Date(startDate);
    while (cursor <= rangEndDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (dateStr >= today && dateStr <= endDate) {
        dates.push(dateStr);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  return dates;
}

async function scrapeGondola() {
  console.log(`\n--- Sea to Sky Gondola (Firecrawl + detail pages) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  console.log(`   Fetching: ${GONDOLA.pageUrl}`);
  const markdown = await fetchFirecrawlMarkdown(GONDOLA.pageUrl, 'Firecrawl Gondola events');
  if (!markdown) return events;

  console.log(`   Got ${markdown.length} chars of markdown`);

  // Parse event cards from the "Filtered results" section
  // Format:
  //   RecurrenceText (e.g., "Thursdays until March 12")
  //   ### Title
  //   Description
  //   [See Details ...](url)

  const lines = markdown.split('\n');
  const parsedEvents = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Look for headings that are event titles (### Title)
    const headingMatch = line.match(/^###\s+(.+)/);
    if (!headingMatch) continue;

    const rawTitle = headingMatch[1].replace(/\\\*/g, '*').trim();

    // Skip navigation headings
    if (/^(Filtered results|Page Navigation|All events)/i.test(rawTitle)) continue;

    // Look backward for recurrence text (the line before the heading)
    let recurrence = '';
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const prevLine = lines[j].trim();
      if (!prevLine || prevLine.startsWith('!') || prevLine.startsWith('-')) continue;
      // Check if it's a recurrence pattern
      if (/(?:until|daily|every|february|march|april|may)/i.test(prevLine)) {
        recurrence = prevLine;
        break;
      }
    }

    // Skip "Daily" events (regular services)
    if (GONDOLA_SKIP_PATTERNS.includes(recurrence.toLowerCase())) continue;

    // Skip events with no recurrence (featured cards at top without dates)
    if (!recurrence) continue;

    // Look forward for description and detail URL
    let description = '';
    let detailUrl = '';
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const nextLine = lines[j].trim();
      if (!nextLine) continue;
      if (nextLine.startsWith('###')) break;

      const linkMatch = nextLine.match(/\[See Details[^\]]*\]\(([^)]+)\)/);
      if (linkMatch) {
        detailUrl = linkMatch[1];
        if (!detailUrl.startsWith('http')) {
          detailUrl = `https://www.seatoskygondola.com${detailUrl}`;
        }
        continue;
      }

      if (!description && nextLine.length > 10 && !nextLine.startsWith('[') && !nextLine.startsWith('!')) {
        description = nextLine;
      }
    }

    // Avoid duplicates — same event can appear in featured and filtered sections
    if (parsedEvents.some(e => e.title === rawTitle)) continue;

    parsedEvents.push({ title: rawTitle, recurrence, description, detailUrl });
  }

  console.log(`   Parsed ${parsedEvents.length} unique event types`);

  // Fetch times from detail pages and expand recurrence
  for (const evt of parsedEvents) {
    console.log(`   Processing: "${evt.title}" (${evt.recurrence})`);

    // Fetch time from detail page
    let startTime = null;
    let endTime = null;

    if (evt.detailUrl) {
      const times = await fetchGondolaEventTimes(evt.detailUrl);
      if (times) {
        startTime = times.startTime;
        endTime = times.endTime;
        console.log(`      Times from detail page: ${startTime} - ${endTime}`);
      } else {
        console.log(`      No times found on detail page`);
      }
    }

    // Expand recurrence into specific dates
    const dates = expandRecurrence(evt.recurrence, today, endDate);
    console.log(`      Expanded to ${dates.length} dates`);

    for (const date of dates) {
      events.push({
        title: evt.title,
        date,
        time: startTime,
        endTime,
        description: evt.description || `${evt.title} at Sea to Sky Gondola`,
        category: categorizeEvent(evt.title, evt.description || ''),
        venueName: GONDOLA.venue,
        address: GONDOLA.address,
        tags: ['auto-scraped', 'gondola-website', GONDOLA.tag],
        price: 0, isFree: false, priceDescription: 'See venue for pricing'
      });
    }
  }

  console.log(`   Found ${events.length} events total`);
  return events;
}

// ============================================================
// 6. SQUAMISH PUBLIC LIBRARY — Communico /eeventcaldata API
// ============================================================

// Skip closure notices (not real events)
const LIBRARY_SKIP_PATTERNS = ['library closed'];

async function scrapeLibrary() {
  console.log(`\n--- Squamish Public Library (Communico API) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  // Calculate days between today and endDate
  const todayDate = new Date(today + 'T00:00:00');
  const endDateDate = new Date(endDate + 'T00:00:00');
  const days = Math.ceil((endDateDate - todayDate) / (1000 * 60 * 60 * 24));

  const options = {
    date: today,
    days,
    view: 'list',
    private: false,
    search: '',
    locations: [],
    ages: [],
    types: []
  };

  const url = `${LIBRARY.apiBase}?event_type=0&req=${encodeURIComponent(JSON.stringify(options))}`;
  console.log(`   Fetching: ${LIBRARY.apiBase} (${days} days)`);

  try {
    const response = await retryWithBackoff(
      () => fetch(url, { headers: { 'User-Agent': 'PulseApp-Scraper/1.0' } }),
      { label: 'Communico Library API' }
    );

    if (!response.ok) {
      console.error(`   Communico API returned ${response.status}`);
      return events;
    }

    const data = await response.json();
    console.log(`   Got ${data.length} events from API`);

    for (const evt of data) {
      const title = (evt.title || '').trim();
      if (!title) continue;

      // Skip closure notices
      if (LIBRARY_SKIP_PATTERNS.some(p => title.toLowerCase().includes(p))) continue;

      // Parse date and time from raw_start_time / raw_end_time
      // Format: "2026-02-12 14:00:00"
      const startParts = (evt.raw_start_time || '').split(' ');
      const endParts = (evt.raw_end_time || '').split(' ');
      const date = startParts[0]; // "2026-02-12"
      const startTime = startParts[1] ? startParts[1].substring(0, 5) : null; // "14:00"
      const endTime = endParts[1] ? endParts[1].substring(0, 5) : null; // "17:00"

      if (!date || date < today || date > endDate) continue;

      // Skip midnight events (likely all-day markers like closures)
      if (startTime === '00:00' && endTime === '00:00') continue;

      // Extract description
      let description = (evt.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      description = description.substring(0, 300) || `${title} at Squamish Public Library`;

      // Price info
      const cost = evt.registration_cost;
      const isFree = (!cost || cost === '0' || cost === '0.00');
      const costInfo = isFree
        ? { price: 0, isFree: true, priceDescription: 'Free' }
        : { price: parseFloat(cost), isFree: false, priceDescription: `$${cost}` };

      events.push({
        title, date, time: startTime, endTime, description,
        category: categorizeEvent(title, description),
        venueName: LIBRARY.venue,
        address: LIBRARY.address,
        tags: ['auto-scraped', 'communico-api', LIBRARY.tag],
        ...costInfo
      });
    }
  } catch (error) {
    console.error(`   Error scraping Library: ${error.message}`);
  }

  console.log(`   Found ${events.length} events`);
  return events;
}

// ============================================================
// 7. SQUAMISH ARTS COUNCIL — WordPress Tribe Events REST API
// ============================================================

async function scrapeArtsCouncil() {
  console.log(`\n--- Squamish Arts Council (WordPress REST API) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${ARTS_COUNCIL.apiBase}?start_date=${today}&end_date=${endDate}&per_page=50&page=${page}`;
    console.log(`   Fetching page ${page}: ${url}`);

    try {
      const response = await retryWithBackoff(
        () => fetch(url, { headers: { 'User-Agent': 'PulseApp-Scraper/1.0' } }),
        { label: `Arts Council API page ${page}` }
      );

      if (!response.ok) {
        console.warn(`   API returned ${response.status} on page ${page}`);
        break;
      }

      const data = await response.json();
      const apiEvents = data.events || [];

      if (apiEvents.length === 0) { hasMore = false; break; }

      for (const evt of apiEvents) {
        const title = decodeHtmlEntities(evt.title || '');
        if (!title) continue;

        const description = decodeHtmlEntities(
          (evt.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500)
        );
        const date = parseDate(evt.start_date || evt.utc_start_date);
        const startTime = parseTime24(evt.start_date || evt.utc_start_date);
        const endTime = parseTime24(evt.end_date || evt.utc_end_date);
        const costInfo = parseCost(evt.cost || '');

        if (!date || !startTime) {
          console.warn(`   [skip] Missing data for "${title}" - date:${date} time:${startTime}`);
          continue;
        }

        // Use venue from API when available, otherwise fall back
        let venueName = 'Squamish Arts Council';
        let venueAddress = '';
        if (evt.venue) {
          const v = evt.venue;
          if (v.venue) venueName = decodeHtmlEntities(v.venue);
          if (v.address) venueAddress = [v.address, v.city, v.province, v.zip].filter(Boolean).join(', ');
        }

        events.push({
          title, date, time: startTime, endTime,
          description: description || `${title} — Squamish Arts Council event`,
          category: categorizeEvent(title, description),
          venueName,
          venueAddress: venueAddress || undefined,
          address: venueAddress || '',
          tags: ['auto-scraped', 'wp-tribe-api', ARTS_COUNCIL.tag],
          ...costInfo
        });
      }

      const totalPages = data.total_pages || 1;
      hasMore = page < totalPages;
      page++;
    } catch (error) {
      console.error(`   Error fetching Arts Council API page ${page}: ${error.message}`);
      break;
    }
  }

  console.log(`   Found ${events.length} events from API`);
  return events;
}

// ============================================================
// 8. TOURISM SQUAMISH — Calendar HTML + detail page fetches
// ============================================================

// Skip daily attractions/exhibits that appear 15+ days in our date range
const TOURISM_DAILY_SKIP = 15;

async function scrapeTourismSquamish() {
  console.log(`\n--- Tourism Squamish (Calendar + detail pages) ---`);
  const events = [];
  const today = getTodayPacific();
  const endDate = getEndDatePacific(30);

  const todayDate = new Date(today + 'T00:00:00');
  const endDateDate = new Date(endDate + 'T00:00:00');

  // Determine which months to fetch (e.g. Feb and Mar 2026)
  const months = new Set();
  const cursor = new Date(todayDate);
  while (cursor <= endDateDate) {
    months.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
    cursor.setMonth(cursor.getMonth() + 1);
    cursor.setDate(1);
  }

  // Step 1: Fetch calendar pages and build URL → dates mapping
  const urlDates = {}; // eventUrl → Set of date strings

  for (const ym of months) {
    const [year, month] = ym.split('-').map(Number);
    const calUrl = `${TOURISM_SQUAMISH.calendarBase}?year=${year}&month=${month}`;
    console.log(`   Fetching calendar: ${calUrl}`);

    try {
      const response = await retryWithBackoff(
        () => fetch(calUrl, { headers: { 'User-Agent': 'PulseApp-Scraper/1.0' } }),
        { label: `Tourism Squamish calendar ${year}-${month}` }
      );
      if (!response.ok) {
        console.warn(`   Calendar returned ${response.status}`);
        continue;
      }

      const html = await response.text();
      const cells = html.split(/<td\b/);

      for (const cell of cells) {
        const dayMatch = cell.match(/<span[^>]*>(\d{1,2})<\/span>/);
        if (!dayMatch) continue;

        const day = parseInt(dayMatch[1]);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr < today || dateStr > endDate) continue;

        const linkRegex = /href="(\/(?:event|submitted-events)\/[^"]+)"/g;
        let m;
        while ((m = linkRegex.exec(cell)) !== null) {
          const url = m[1];
          if (!urlDates[url]) urlDates[url] = new Set();
          urlDates[url].add(dateStr);
        }
      }
    } catch (error) {
      console.error(`   Error fetching calendar: ${error.message}`);
    }
  }

  // Step 2: Filter out daily attractions (appear on 18+ days)
  const eventUrls = Object.entries(urlDates)
    .filter(([url, dates]) => {
      if (dates.size >= TOURISM_DAILY_SKIP) {
        const slug = url.split('/').filter(Boolean).pop();
        console.log(`   [skip-daily] ${slug} (${dates.size} days — daily attraction)`);
        return false;
      }
      return true;
    });

  console.log(`   ${eventUrls.length} unique events to fetch (${Object.keys(urlDates).length - eventUrls.length} daily attractions skipped)`);

  // Step 3: Fetch detail pages (5 at a time for concurrency)
  const BATCH_SIZE = 5;

  for (let i = 0; i < eventUrls.length; i += BATCH_SIZE) {
    const batch = eventUrls.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(batch.map(async ([urlPath, dates]) => {
      const fullUrl = `https://www.exploresquamish.com${urlPath}`;
      try {
        const response = await retryWithBackoff(
          () => fetch(fullUrl, { headers: { 'User-Agent': 'PulseApp-Scraper/1.0' } }),
          { label: `Tourism detail: ${urlPath}` }
        );
        if (!response.ok) return null;

        const html = await response.text();

        // Parse title from <title> tag
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, '').trim() : '';
        title = decodeHtmlEntities(title);
        if (!title) return null;

        // Parse structured fields from the sidebar
        const bodyText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#039;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, ' ');

        // Extract Time — handles many formats:
        //   "6pm - 8pm", "6:30-9:30pm", "5:00pm to 10:00pm", "6:00", "10:00am - 4:00pm"
        const timeRaw = bodyText.match(/Time:\s*\n\s*\n\s*([^\n]+)/i);
        let startTime = null;
        let endTime = null;
        if (timeRaw) {
          const timeStr = timeRaw[1].trim();
          // Pattern 1: "6pm - 8pm" or "10:00am - 4:00pm" or "6:30-9:30pm" or "5:00pm to 10:00pm"
          const rangeMatch = timeStr.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]|(?:\s+to\s+)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)
            ? timeStr.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i)
            : null;
          if (rangeMatch) {
            let startRaw = rangeMatch[1].trim();
            let endRaw = rangeMatch[2].trim();
            // If start has no am/pm, inherit from end
            if (!/am|pm/i.test(startRaw) && /am|pm/i.test(endRaw)) {
              const endPeriod = endRaw.match(/(am|pm)/i)[1];
              startRaw += endPeriod;
            }
            if (!/:\d{2}/.test(startRaw)) startRaw = startRaw.replace(/(\d+)/, '$1:00');
            if (!/:\d{2}/.test(endRaw)) endRaw = endRaw.replace(/(\d+)/, '$1:00');
            startTime = convertTo24h(startRaw);
            endTime = convertTo24h(endRaw);
          } else {
            // Pattern 2: Single time like "6:00" or "7:30pm"
            const singleMatch = timeStr.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
            if (singleMatch) {
              let raw = singleMatch[1].trim();
              if (!/:\d{2}/.test(raw)) raw = raw.replace(/(\d+)/, '$1:00');
              // If no am/pm, assume pm for evening events (after 5), am otherwise
              if (!/am|pm/i.test(raw)) {
                const hr = parseInt(raw);
                raw += (hr >= 1 && hr <= 6) ? 'pm' : (hr >= 7 && hr <= 11) ? 'pm' : 'pm';
              }
              startTime = convertTo24h(raw);
            }
          }
        }

        // Extract Cost
        const costMatch = bodyText.match(/Cost:\s*\n\s*\n\s*([^\n]+)/i);
        const costInfo = costMatch ? parseCost(costMatch[1].trim()) : { price: 0, isFree: false, priceDescription: 'See venue for pricing' };

        // Extract Venue
        const venueSection = bodyText.match(/Venue\n\s*([^\n]+?)(?:\n\s*([^\n]+?))?(?:\n\s*(\w[\w\s]*,\s*BC))?/);
        let venueName = venueSection ? venueSection[1].trim() : '';
        let venueAddress = '';
        if (venueSection) {
          const parts = [venueSection[1], venueSection[2], venueSection[3]].filter(Boolean).map(s => s.trim());
          if (parts.length > 1) {
            venueName = parts[0];
            venueAddress = parts.slice(1).join(', ');
          }
        }

        // Extract Description
        const descMatch = bodyText.match(/See All Events\s*\n([\s\S]{20,500}?)(?:\nDates\n|$)/);
        let description = descMatch
          ? descMatch[1].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300)
          : '';
        description = description || `${title} in Squamish`;

        // Skip events without a parseable time (ongoing festivals, exhibits)
        if (!startTime) {
          const slug = urlPath.split('/').filter(Boolean).pop();
          console.log(`   [skip-no-time] ${slug} — no specific time found`);
          return null;
        }

        return {
          title, startTime, endTime, costInfo, venueName, venueAddress, description,
          dates: [...dates]
        };
      } catch (error) {
        console.warn(`   [error] ${urlPath}: ${error.message}`);
        return null;
      }
    }));

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const evt = result.value;

      for (const date of evt.dates) {
        events.push({
          title: evt.title,
          date,
          time: evt.startTime,
          endTime: evt.endTime,
          description: evt.description,
          category: categorizeEvent(evt.title, evt.description),
          venueName: evt.venueName || 'Squamish',
          address: evt.venueAddress || '',
          tags: ['auto-scraped', 'tourism-squamish', TOURISM_SQUAMISH.tag],
          ...evt.costInfo
        });
      }
    }
  }

  console.log(`   Found ${events.length} events total`);
  return events;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('=== Scraping Venue Events (8 sources) ===');
  console.log(`   Date range: ${getTodayPacific()} to ${getEndDatePacific(30)}`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Fetch events from all sources
  const tricksterEvents = await scrapeTricksters();
  const bagEvents = await scrapeBAG();
  const aframeEvents = await scrapeAFrame();
  const arrowwoodEvents = await scrapeArrowWood();
  const gondolaEvents = await scrapeGondola();
  const libraryEvents = await scrapeLibrary();
  const artsCouncilEvents = await scrapeArtsCouncil();
  const tourismEvents = await scrapeTourismSquamish();

  const allEvents = [
    ...tricksterEvents,
    ...bagEvents,
    ...aframeEvents,
    ...arrowwoodEvents,
    ...gondolaEvents,
    ...libraryEvents,
    ...artsCouncilEvents,
    ...tourismEvents
  ];

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
  console.log(`A-Frame events found: ${aframeEvents.length}`);
  console.log(`Arrow Wood events found: ${arrowwoodEvents.length}`);
  console.log(`Gondola events found: ${gondolaEvents.length}`);
  console.log(`Library events found: ${libraryEvents.length}`);
  console.log(`Arts Council events found: ${artsCouncilEvents.length}`);
  console.log(`Tourism Squamish events found: ${tourismEvents.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total processed: ${inserted + skipped + failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
