#!/usr/bin/env node

/**
 * Scrape events from Squamish websites
 * Run: node scripts/scrape-events.js
 */

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'REDACTED_SERVICE_KEY';

// Squamish event sources
const EVENT_SOURCES = [
  {
    name: 'Together Nest',
    url: 'https://together-nest.com/discover?category=activities',
    category: 'Community'
  },
  {
    name: 'Tourism Squamish',
    url: 'https://www.tourismsquamish.com/events/',
    category: 'Community'
  },
  {
    name: 'Squamish Chief',
    url: 'https://www.squamishchief.com/local-news/events',
    category: 'Community'
  },
  {
    name: 'District of Squamish',
    url: 'https://squamish.ca/events/',
    category: 'Community'
  },
  {
    name: 'Squamish Arts Council',
    url: 'https://www.squamishartscouncil.com/events',
    category: 'Arts & Culture'
  },
  {
    name: 'Sea to Sky Community Services',
    url: 'https://www.sscs.ca/events/',
    category: 'Community'
  }
];

async function scrapeUrl(url, sourceName) {
  console.log(`   Fetching: ${url}`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          schema: {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Event name/title' },
                    date: { type: 'string', description: 'Event date (e.g., January 15, 2026 or 2026-01-15)' },
                    time: { type: 'string', description: 'Event start time (e.g., 7:00 PM or 19:00)' },
                    end_time: { type: 'string', description: 'Event end time if available' },
                    location: { type: 'string', description: 'Venue name or address' },
                    address: { type: 'string', description: 'Full address if different from location' },
                    description: { type: 'string', description: 'Event description' },
                    price: { type: 'string', description: 'Ticket price or "Free"' },
                    url: { type: 'string', description: 'Link to event details' },
                    image: { type: 'string', description: 'Event image URL' }
                  }
                }
              }
            }
          },
          prompt: `Extract ALL upcoming events from this Squamish, BC events page. Include every event you can find with title, date, time, location, description, price, and any links. Focus on events happening in the future. Today is ${new Date().toISOString().split('T')[0]}.`
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`   API Error: ${data.error || response.status}`);
      return [];
    }

    return data.data?.extract?.events || [];
  } catch (error) {
    console.error(`   Error scraping ${sourceName}: ${error.message}`);
    return [];
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    // Try direct parsing
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try common formats
    const formats = [
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,  // January 15, 2026
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,   // 01/15/2026
      /(\d{4})-(\d{2})-(\d{2})/          // 2026-01-15
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseTime(timeStr) {
  if (!timeStr) return '09:00';

  // Convert to 24h format
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] || '00';
    const period = match[3]?.toLowerCase();

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  return '09:00';
}

async function checkEventExists(title, date) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/events?title=eq.${encodeURIComponent(title)}&start_date=eq.${date}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  const data = await response.json();
  return data.length > 0;
}

async function insertEvent(event) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(event)
  });
  return response.ok;
}

async function main() {
  console.log('🎉 PULSE EVENTS SCRAPER\n');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60) + '\n');

  let totalFound = 0;
  let newEvents = 0;
  let duplicates = 0;
  let errors = 0;

  for (const source of EVENT_SOURCES) {
    console.log(`\n📍 ${source.name}`);
    console.log('-'.repeat(40));

    const events = await scrapeUrl(source.url, source.name);
    console.log(`   Found ${events.length} events`);

    for (const event of events) {
      totalFound++;

      if (!event.title) {
        console.log(`   ⚪ Skipped: No title`);
        continue;
      }

      const eventDate = parseDate(event.date);
      if (!eventDate || eventDate < new Date()) {
        console.log(`   ⚪ Skipped: ${event.title.substring(0, 30)}... (past/invalid date)`);
        continue;
      }

      const dateStr = eventDate.toISOString().split('T')[0];

      // Check for duplicates
      const exists = await checkEventExists(event.title, dateStr);
      if (exists) {
        console.log(`   ⚪ Exists: ${event.title.substring(0, 40)}`);
        duplicates++;
        continue;
      }

      // Parse price
      let price = 0;
      let isFree = false;
      if (event.price) {
        if (event.price.toLowerCase().includes('free')) {
          isFree = true;
        } else {
          const priceMatch = event.price.match(/\$?(\d+(?:\.\d{2})?)/);
          if (priceMatch) price = parseFloat(priceMatch[1]);
        }
      }

      // Insert event
      const success = await insertEvent({
        title: event.title,
        description: event.description || '',
        venue_name: event.location || 'Squamish',
        venue_address: event.address || event.location || 'Squamish, BC',
        category: source.category,
        event_type: 'event',
        start_date: dateStr,
        start_time: parseTime(event.time),
        end_time: event.end_time ? parseTime(event.end_time) : null,
        price: price,
        is_free: isFree,
        price_description: event.price || null,
        image_url: event.image || null,
        status: 'active',
        tags: ['auto-scraped', source.name.toLowerCase().replace(/\s+/g, '-')]
      });

      if (success) {
        console.log(`   ✅ Added: ${event.title.substring(0, 40)}`);
        newEvents++;
      } else {
        console.log(`   ❌ Failed: ${event.title.substring(0, 40)}`);
        errors++;
      }
    }

    // Rate limiting between sources
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Total found: ${totalFound}`);
  console.log(`✅ New events added: ${newEvents}`);
  console.log(`⚪ Duplicates skipped: ${duplicates}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
