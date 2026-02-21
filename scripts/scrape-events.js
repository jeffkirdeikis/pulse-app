#!/usr/bin/env node

/**
 * Scrape events from Squamish websites
 * Run: node scripts/scrape-events.js
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FIRECRAWL_API_KEY as getFirecrawlKey } from './lib/env.js';

const FIRECRAWL_API_KEY = getFirecrawlKey();
const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// Squamish event sources - aggregators and community sites
const EVENT_SOURCES = [
  // === PRIMARY AGGREGATORS ===
  // Together Nest Events — the events page renders well for Firecrawl.
  // Activities page is a SPA that won't render, so only scrape events.
  // Cleaned up 56 junk entries from old broken scraper on Feb 21, 2026.
  {
    name: 'Together Nest - Events',
    url: 'https://together-nest.com/discover?category=events',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'Sea to Sky Kids - Directory',
    url: 'https://seatoskykids.ca/directory/',
    category: 'Family',
    type: 'events'
  },
  {
    name: 'Explore Squamish - Event Calendar',
    url: 'https://www.exploresquamish.com/festivals-events/event-calendar/',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'Meetup Squamish',
    url: 'https://www.meetup.com/find/?location=ca--bc--squamish&source=EVENTS',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'Eventbrite Squamish',
    url: 'https://www.eventbrite.com/d/canada--squamish/events/',
    category: 'Community',
    type: 'events'
  },
  // === RECREATION & CLASSES ===
  {
    name: 'District of Squamish Recreation',
    url: 'https://squamish.ca/rec/',
    category: 'Recreation',
    type: 'events'
  },
  {
    name: 'Downtown Squamish Directory',
    url: 'https://www.downtownsquamish.com/listings/',
    category: 'Community',
    type: 'events'
  },
  // === LOCAL NEWS & COMMUNITY ===
  {
    name: 'Tourism Squamish',
    url: 'https://www.tourismsquamish.com/events/',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'Squamish Chief',
    url: 'https://www.squamishchief.com/local-events',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'District of Squamish Events',
    url: 'https://squamish.ca/events/',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'Squamish Arts Council',
    url: 'https://www.squamishartscouncil.com/events',
    category: 'Arts & Culture',
    type: 'events'
  },
  {
    name: 'Sea to Sky Community Services',
    url: 'https://www.sscs.ca/events/',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'The Wilder Events',
    url: 'https://www.thewilder.ca/events',
    category: 'Arts & Culture',
    type: 'events'
  },
  {
    name: 'Squamish Nation Events',
    url: 'https://www.squamish.net/events-gatherings/calendar/',
    category: 'Community',
    type: 'events'
  },
  // === ADDED Feb 10, 2026: Missing sources ===
  // Together Nest - All DISABLED (see note above)
  {
    name: 'Squamish Chamber - Events & Programming',
    url: 'https://www.squamishchamber.com/events-programming/',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'The Locals Board - Events',
    url: 'https://thelocalsboard.com/events/',
    category: 'Community',
    type: 'events'
  },
  {
    name: 'Sweet Threads Yarn & Fibre - Events',
    url: 'https://www.sweetthreads.com/events',
    category: 'Arts & Culture',
    type: 'events'
  }
];

// Together Nest Events scraper — parses markdown from their SPA.
// Events page renders with structure:
//   ### Event Title
//   by Venue/Organizer Name
//   Mar 7, 2026  (or "Feb 13, 2026 - Feb 28, 2026" for multi-day)
//   Squamish, BC, Canada
//   View Details
async function scrapeTogetherNest(url) {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        waitFor: 5000,
        actions: [
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 2000 },
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 1000 },
          { type: 'scroll', direction: 'down', amount: 3000 },
          { type: 'wait', milliseconds: 1000 }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(`   API Error: ${data.error || response.status}`);
      return [];
    }

    const markdown = data.data?.markdown || '';
    const events = [];
    const sections = markdown.split('###').slice(1);

    // Junk headings to skip (category headers, splash screen, navigation)
    const skipPatterns = /^(Welcome to the Nest|Events$|Activities$|Camps|After School|Playgrounds|Home & Family|Back to|Filter|What's On|Featured)/i;
    // Date pattern: "Feb 21, 2026" or "Feb 13, 2026 - Feb 28, 2026"
    const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i;

    for (const section of sections) {
      const lines = section.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) continue;

      const title = lines[0].trim();
      if (skipPatterns.test(title)) continue;
      if (title.length < 3 || title.length > 120) continue;

      let provider = '';
      let dateStr = '';
      let location = '';
      let imageUrl = '';

      for (const line of lines.slice(1)) {
        const l = line.trim();
        if (l.startsWith('by ')) {
          provider = l.replace(/^by\s+/, '').trim();
        } else if (datePattern.test(l)) {
          dateStr = l;
        } else if (l.includes('Squamish')) {
          location = l;
        } else if (l === 'View Details' || l === 'Learn More') {
          continue;
        }
      }

      // Also check for image in the line before the ### (from the raw section split)
      const imgMatch = section.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      if (imgMatch) imageUrl = imgMatch[1];

      // Must have a title and a provider to be a real event
      if (!provider) continue;

      // Parse date — handle "Feb 21, 2026" and "Feb 13, 2026 - Feb 28, 2026"
      let parsedDate = null;
      if (dateStr) {
        // For multi-day events, use the start date
        const startDateStr = dateStr.split(' - ')[0].trim();
        parsedDate = new Date(startDateStr);
        if (isNaN(parsedDate.getTime())) parsedDate = null;
      }

      // Skip past events
      if (parsedDate && parsedDate < new Date(new Date().toDateString())) {
        console.log(`   ⚪ Skipped: ${title.substring(0, 40)}... (past date)`);
        continue;
      }

      events.push({
        title,
        provider,
        date: parsedDate ? parsedDate.toISOString().split('T')[0] : null,
        location: location || 'Squamish, BC',
        image: imageUrl || null,
        description: `Community event at ${provider} in Squamish`,
        isClass: false
      });
    }

    return events;
  } catch (error) {
    console.error(`   Error scraping Together Nest: ${error.message}`);
    return [];
  }
}

async function scrapeUrl(url, sourceName, sourceType = 'events') {
  console.log(`   Fetching: ${url}`);

  // Special handling for Together Nest - parse markdown from SPA
  if (sourceName.includes('Together Nest')) {
    return await scrapeTogetherNest(url);
  }

  // Different extraction for activities vs events
  const isActivities = sourceType === 'activities';

  const schema = isActivities ? {
    type: 'object',
    properties: {
      activities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Activity/class name' },
            provider: { type: 'string', description: 'Business/organization offering this' },
            category: { type: 'string', description: 'Type of activity (Yoga, Martial Arts, Sports, etc.)' },
            location: { type: 'string', description: 'Location/city' },
            ageRange: { type: 'string', description: 'Age range (e.g., 5 years - 18 years)' },
            price: { type: 'string', description: 'Paid or Free' },
            description: { type: 'string', description: 'Description of the activity' }
          }
        }
      }
    }
  } : {
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
  };

  const prompt = isActivities
    ? `Extract ALL activities and classes from this page. Each card/listing is an activity. Include title, provider/business name, category type, location, age range, and whether it's paid or free. Extract as many as you can find.`
    : `Extract ALL upcoming events from this Squamish, BC events page. Include every event you can find with title, date, time, location, description, price, and any links. Focus on events happening in the future. Today is ${new Date().toISOString().split('T')[0]}.`;

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
        waitFor: 3000, // Wait for JS to load
        extract: { schema, prompt }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`   API Error: ${data.error || response.status}`);
      return [];
    }

    // Return activities or events based on type
    if (isActivities) {
      const activities = data.data?.extract?.activities || [];
      // Convert activities to event format for storage
      return activities.map(a => ({
        title: a.title,
        description: a.description || `${a.category} class for ${a.ageRange || 'all ages'}`,
        location: a.location || 'Squamish, BC',
        price: a.price || 'Paid',
        provider: a.provider,
        isClass: true // Flag to store as class
      }));
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
  if (!timeStr) return null;

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

  return null;
}

async function checkEventExists(title, date, isClass = false) {
  // For classes, just check title (they're ongoing, not date-specific)
  // For events, check title + date
  const query = isClass
    ? `${SUPABASE_URL}/rest/v1/events?title=ilike.${encodeURIComponent(title)}&event_type=eq.class`
    : `${SUPABASE_URL}/rest/v1/events?title=ilike.${encodeURIComponent(title)}&start_date=eq.${date}`;

  const response = await fetch(query, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
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

    const events = await scrapeUrl(source.url, source.name, source.type);
    console.log(`   Found ${events.length} events`);

    for (const event of events) {
      totalFound++;

      if (!event.title) {
        console.log(`   ⚪ Skipped: No title`);
        continue;
      }

      // Only mark as class if explicitly flagged by the extractor
      // Activities from community directories are events, not classes
      const isClass = event.isClass === true;
      let dateStr;

      if (isClass) {
        // For actual classes (explicitly flagged), use today's date
        dateStr = new Date().toISOString().split('T')[0];
      } else {
        // Events need real dates — try to parse from the scraped data
        const eventDate = parseDate(event.date);
        if (!eventDate) {
          // No date found — use today + 7 days as a reasonable near-future default
          // for community activities/events with no specific date listed
          const nearFuture = new Date();
          nearFuture.setDate(nearFuture.getDate() + 7);
          dateStr = nearFuture.toISOString().split('T')[0];
        } else if (eventDate < new Date()) {
          console.log(`   ⚪ Skipped: ${event.title.substring(0, 30)}... (past date)`);
          continue;
        } else {
          dateStr = eventDate.toISOString().split('T')[0];
        }
      }

      // Check for duplicates
      const exists = await checkEventExists(event.title, dateStr, isClass);
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

      // Insert event or class
      const success = await insertEvent({
        title: event.title,
        description: event.description || '',
        venue_name: event.provider || event.location || 'Squamish',
        venue_address: event.address || event.location || 'Squamish, BC',
        category: source.category,
        event_type: isClass ? 'class' : 'event',
        start_date: dateStr,
        start_time: parseTime(event.time),
        end_time: event.end_time ? parseTime(event.end_time) : null,
        price: price,
        is_free: isFree,
        price_description: event.price || null,
        image_url: event.image || null,
        source_url: event.url || null,
        status: 'active',
        tags: ['auto-scraped', source.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')]
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
