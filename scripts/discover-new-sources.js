#!/usr/bin/env node

/**
 * Automated Event Source Discovery
 * Finds new businesses, studios, and event venues in Squamish
 * that aren't yet being scraped
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dirname, '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.warn('Could not load .env.local');
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Check for Anthropic API key
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
let anthropic = null;
if (ANTHROPIC_API_KEY) {
  anthropic = new Anthropic();
} else {
  console.warn('\n⚠️  ANTHROPIC_API_KEY not set. AI categorization will be skipped.');
  console.warn('   Sources will be saved for manual review.\n');
}

// Search queries to find new sources
const DISCOVERY_QUERIES = [
  // Fitness
  'squamish yoga studio',
  'squamish fitness classes',
  'squamish gym schedule',
  'squamish pilates',
  'squamish crossfit',
  'squamish martial arts classes',
  'squamish dance classes',
  'squamish climbing gym',

  // Events
  'squamish events this week',
  'squamish live music',
  'squamish art gallery events',
  'squamish brewery events',
  'squamish restaurant events',
  'squamish community events',
  'squamish kids activities',
  'squamish workshops',

  // Venues
  'squamish event venues',
  'squamish community centers',
  'squamish halls for rent',

  // Social
  'squamish facebook events',
  'squamish meetup groups',
  'squamish eventbrite'
];

// Booking systems to detect
const BOOKING_SYSTEMS = {
  mindbody: {
    patterns: [/mindbody/i, /healcode/i, /clients\.mindbodyonline/i],
    widgetPatterns: [/widget_id[=:]\s*["']?(\d+)/i, /data-widget-id="(\d+)"/i]
  },
  wellnessliving: {
    patterns: [/wellnessliving/i, /wl\.book/i],
    widgetPatterns: [/business_id[=:]\s*["']?(\d+)/i]
  },
  janeapp: {
    patterns: [/janeapp/i, /jane\.app/i],
    widgetPatterns: [/clinic[=:]\s*["']?([a-z0-9-]+)/i]
  },
  momence: {
    patterns: [/momence/i],
    widgetPatterns: [/studio[=:]\s*["']?([a-z0-9-]+)/i]
  },
  vagaro: {
    patterns: [/vagaro/i],
    widgetPatterns: [/business_id[=:]\s*["']?(\d+)/i]
  },
  acuity: {
    patterns: [/acuity/i, /squarespacescheduling/i],
    widgetPatterns: [/owner[=:]\s*["']?(\d+)/i]
  }
};

/**
 * Search DuckDuckGo for potential sources (less bot detection than Google)
 */
async function searchWeb(query) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  try {
    // Use DuckDuckGo HTML version (more reliable for scraping)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Extract search results from DuckDuckGo HTML
    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.result').forEach(el => {
        const link = el.querySelector('a.result__a');
        const snippet = el.querySelector('.result__snippet');
        if (link && link.href) {
          // DuckDuckGo wraps URLs, extract the actual URL
          let url = link.href;
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
          items.push({
            url: url,
            title: link.textContent?.trim() || '',
            snippet: snippet?.textContent?.trim() || ''
          });
        }
      });
      return items;
    });

    await browser.close();
    return results.filter(r => r.url.startsWith('http'));
  } catch (e) {
    console.error(`Search failed for "${query}":`, e.message);
    await browser.close();
    return [];
  }
}

// Alias for backwards compatibility
const searchGoogle = searchWeb;

/**
 * Analyze a website to detect booking system and event potential
 */
async function analyzeWebsite(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const html = await page.content();
    const result = {
      url,
      hasEvents: false,
      hasClasses: false,
      bookingSystem: null,
      widgetId: null,
      contactInfo: {},
      eventIndicators: []
    };

    // Detect booking system
    for (const [system, config] of Object.entries(BOOKING_SYSTEMS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(html)) {
          result.bookingSystem = system;

          // Try to extract widget ID
          for (const widgetPattern of config.widgetPatterns) {
            const match = html.match(widgetPattern);
            if (match) {
              result.widgetId = match[1];
              break;
            }
          }
          break;
        }
      }
      if (result.bookingSystem) break;
    }

    // Detect event/class indicators
    const indicators = [
      { pattern: /schedule|class schedule|timetable/i, type: 'schedule' },
      { pattern: /book now|book a class|reserve/i, type: 'booking' },
      { pattern: /upcoming events|event calendar/i, type: 'events' },
      { pattern: /classes|workshops|sessions/i, type: 'classes' },
      { pattern: /drop-in|drop in/i, type: 'dropin' },
      { pattern: /membership|packages/i, type: 'membership' }
    ];

    for (const ind of indicators) {
      if (ind.pattern.test(html)) {
        result.eventIndicators.push(ind.type);
      }
    }

    result.hasEvents = result.eventIndicators.includes('events');
    result.hasClasses = result.eventIndicators.includes('classes') ||
                        result.eventIndicators.includes('schedule');

    // Extract contact info
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = html.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

    if (emailMatch) result.contactInfo.email = emailMatch[0];
    if (phoneMatch) result.contactInfo.phone = phoneMatch[0];

    await browser.close();
    return result;
  } catch (e) {
    await browser.close();
    return { url, error: e.message };
  }
}

/**
 * Check if source is already in database
 */
async function isKnownSource(url) {
  const domain = new URL(url).hostname.replace('www.', '');

  const { data } = await supabase
    .from('businesses')
    .select('id, name, website')
    .ilike('website', `%${domain}%`)
    .limit(1);

  return data && data.length > 0;
}

/**
 * Use AI to categorize and prioritize a discovered source
 */
async function categorizeSource(source, htmlSample) {
  // If no API key, return basic info for manual review
  if (!anthropic) {
    // Basic heuristic categorization
    const url = source.url?.toLowerCase() || '';
    const title = source.title?.toLowerCase() || '';
    const hasEvents = source.eventIndicators?.length > 0;
    const hasBooking = !!source.bookingSystem;

    let category = 'other';
    if (url.includes('yoga') || title.includes('yoga')) category = 'yoga';
    else if (url.includes('fitness') || url.includes('gym') || title.includes('fitness')) category = 'fitness';
    else if (url.includes('climb') || title.includes('climb')) category = 'fitness';
    else if (url.includes('pilates') || title.includes('pilates')) category = 'yoga';

    // Check if likely Squamish
    const isSquamish = url.includes('squamish') || title.includes('squamish') ||
                       htmlSample?.toLowerCase().includes('squamish');

    return {
      business_name: source.title,
      category,
      event_frequency: hasEvents || hasBooking ? 'unknown' : 'none',
      scrape_priority: hasBooking ? 7 : (hasEvents ? 5 : 3),
      scrape_method: source.bookingSystem ? 'widget' : 'html',
      notes: 'Auto-categorized (no AI)',
      is_squamish: isSquamish
    };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyze this potential event source for Squamish, BC:

URL: ${source.url}
Title: ${source.title}
Detected booking system: ${source.bookingSystem || 'None'}
Event indicators: ${source.eventIndicators?.join(', ') || 'None'}

HTML sample (first 5000 chars):
${htmlSample?.substring(0, 5000) || 'Not available'}

Return JSON:
{
  "business_name": "extracted name",
  "category": "fitness|yoga|art|music|community|restaurant|brewery|outdoor|kids|other",
  "event_frequency": "daily|weekly|monthly|occasional|none",
  "scrape_priority": 1-10,
  "scrape_method": "api|widget|html|manual",
  "notes": "any relevant observations",
  "is_squamish": true/false
}`
    }]
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to categorize:', e);
  }
  return null;
}

/**
 * Main discovery process
 */
async function discoverSources() {
  console.log('🔍 Starting source discovery...\n');

  const discoveries = [];
  const seenUrls = new Set();

  for (const query of DISCOVERY_QUERIES) {
    console.log(`Searching: "${query}"`);

    const results = await searchGoogle(query);
    console.log(`  Found ${results.length} results`);

    for (const result of results) {
      // Skip if already seen or known
      if (seenUrls.has(result.url)) continue;
      seenUrls.add(result.url);

      // Skip major platforms (we handle these separately)
      if (/facebook\.com|instagram\.com|yelp\.com|tripadvisor|google\.com/i.test(result.url)) {
        continue;
      }

      const isKnown = await isKnownSource(result.url);
      if (isKnown) {
        console.log(`  ⏭️  Known: ${result.title}`);
        continue;
      }

      // Analyze the website
      console.log(`  🔎 Analyzing: ${result.title}`);
      const analysis = await analyzeWebsite(result.url);

      if (analysis.error) {
        console.log(`  ❌ Error: ${analysis.error}`);
        continue;
      }

      if (!analysis.hasEvents && !analysis.hasClasses && !analysis.bookingSystem) {
        console.log(`  ⏭️  No events/classes detected`);
        continue;
      }

      // Categorize with AI (pass the search result title)
      const category = await categorizeSource({ ...analysis, title: result.title });

      if (category && category.is_squamish && category.scrape_priority >= 5) {
        discoveries.push({
          ...result,
          ...analysis,
          category
        });
        console.log(`  ✅ NEW SOURCE: ${category.business_name || result.title} (priority: ${category.scrape_priority})`);
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  // Sort by priority
  discoveries.sort((a, b) => (b.category?.scrape_priority || 0) - (a.category?.scrape_priority || 0));

  // Report findings
  console.log('\n' + '='.repeat(60));
  console.log('📊 DISCOVERY REPORT');
  console.log('='.repeat(60));
  console.log(`\nFound ${discoveries.length} new potential sources:\n`);

  for (const d of discoveries) {
    console.log(`${d.category?.scrape_priority || '?'}/10 - ${d.category?.business_name || d.title}`);
    console.log(`     URL: ${d.url}`);
    console.log(`     Category: ${d.category?.category || 'unknown'}`);
    console.log(`     Booking: ${d.bookingSystem || 'none'} ${d.widgetId ? `(ID: ${d.widgetId})` : ''}`);
    console.log(`     Method: ${d.category?.scrape_method || 'unknown'}`);
    console.log(`     Frequency: ${d.category?.event_frequency || 'unknown'}`);
    console.log('');
  }

  // Save discoveries to database
  if (discoveries.length > 0) {
    const { error } = await supabase
      .from('discovered_sources')
      .insert(discoveries.map(d => ({
        url: d.url,
        title: d.title,
        booking_system: d.bookingSystem,
        widget_id: d.widgetId,
        category: d.category?.category,
        business_name: d.category?.business_name,
        scrape_priority: d.category?.scrape_priority,
        scrape_method: d.category?.scrape_method,
        event_frequency: d.category?.event_frequency,
        contact_email: d.contactInfo?.email,
        contact_phone: d.contactInfo?.phone,
        status: 'discovered',
        discovered_at: new Date().toISOString()
      })));

    if (error) {
      console.error('Failed to save discoveries:', error);
    } else {
      console.log(`✅ Saved ${discoveries.length} discoveries to database`);
    }
  }

  return discoveries;
}

// Run discovery
discoverSources().catch(console.error);
