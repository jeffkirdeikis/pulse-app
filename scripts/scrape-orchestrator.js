#!/usr/bin/env node

/**
 * PULSE UNIFIED SCRAPING ORCHESTRATOR
 *
 * Discovery-only system that:
 * 1. DISCOVERS booking systems on business websites (Mindbody, WellnessLiving, JaneApp)
 * 2. Records discovered systems in scraping_sources table
 * 3. Processes businesses in parallel for speed
 *
 * ⛔ AI EXTRACTION IS DISABLED - it produces hallucinated/fake events.
 * The AI invented fictional events for businesses (e.g. "Yoga Class" at A&W,
 * "Mixed Martial Arts" at Shoppers Drug Mart). 1,471+ fake entries were created
 * before this was caught. Only dedicated scrapers (Mindbody, WellnessLiving, etc.)
 * can reliably produce real event data.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import Anthropic from '@anthropic-ai/sdk';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

puppeteer.use(StealthPlugin());

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// Rate limiting for Anthropic API
const AI_RATE_LIMIT_DELAY = 3000;
let lastAICallTime = 0;

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastCall = now - lastAICallTime;
  if (timeSinceLastCall < AI_RATE_LIMIT_DELAY) {
    await new Promise(r => setTimeout(r, AI_RATE_LIMIT_DELAY - timeSinceLastCall));
  }
  lastAICallTime = Date.now();
}

// Initialize Anthropic client
let anthropic = null;
try {
  anthropic = new Anthropic();
} catch (e) {
  console.warn('⚠️  Anthropic client not initialized');
}

// Booking system detection patterns
const BOOKING_SYSTEMS = {
  'mindbody-widget': {
    name: 'Mindbody Widget',
    patterns: [
      /widgets\.mindbodyonline\.com\/widgets\/schedules\/([a-f0-9]+)/i,
      /healcode.*widget.*?["']([a-f0-9]+)["']/i
    ],
    extractId: (match) => match[1],
    priority: 10
  },
  'wellnessliving': {
    name: 'WellnessLiving',
    patterns: [
      /wellnessliving\.com\/schedule\/([a-z0-9_-]+)/i
    ],
    extractId: (match) => match[1],
    priority: 8
  },
  'janeapp': {
    name: 'JaneApp',
    patterns: [
      /([a-z0-9-]+)\.janeapp\.com/i
    ],
    extractId: (match) => match[1],
    priority: 8
  }
};

// Complete page coverage
const PAGES_TO_SCRAPE = [
  '', // Homepage
  '/schedule',
  '/classes',
  '/events'
];

// Stats tracking
const stats = {
  businessesScanned: 0,
  bookingSystemsFound: 0,
  eventsFound: 0,
  eventsAdded: 0,
  classesFound: 0,
  classesAdded: 0,
  dealsFound: 0,
  dealsAdded: 0,
  errors: []
};

// Detect booking systems
async function detectBookingSystem(page, html, url) {
  const detected = [];

  for (const [systemKey, system] of Object.entries(BOOKING_SYSTEMS)) {
    for (const pattern of system.patterns) {
      const match = html.match(pattern) || url.match(pattern);
      if (match) {
        detected.push({
          system: systemKey,
          name: system.name,
          id: system.extractId(match),
          priority: system.priority
        });
        break;
      }
    }
  }

  return detected;
}

// AI extraction
async function extractWithAI(html, businessName, url) {
  if (!anthropic) return { events: [], classes: [], deals: [] };

  await rateLimitedDelay();

  // Full HTML for complete extraction
  const truncatedHtml = html.substring(0, 20000);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Extract events, classes, and deals from this webpage for "${businessName}".
URL: ${url}

HTML:
${truncatedHtml}

Return JSON:
{
  "events": [{"title": "", "date": "YYYY-MM-DD", "time": "HH:MM", "description": ""}],
  "classes": [{"title": "", "date": "YYYY-MM-DD", "time": "HH:MM", "instructor": ""}],
  "deals": [{"title": "", "description": "", "discount_value": ""}]
}

Today: ${new Date().toISOString().split('T')[0]}. Only return valid JSON.`
      }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn(`   AI extraction failed: ${e.status || ''} ${e.message.substring(0, 100)}`);
  }

  return { events: [], classes: [], deals: [] };
}

// Deep scrape a website
async function deepScrapeWebsite(browser, business) {
  const results = {
    bookingSystems: [],
    events: [],
    classes: [],
    deals: [],
    pagesScraped: 0
  };

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const baseUrl = business.website.replace(/\/$/, '');

  try {
    for (const pagePath of PAGES_TO_SCRAPE) {
      const pageUrl = baseUrl + pagePath;

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 500));

        const html = await page.content();
        results.pagesScraped++;

        // Detect booking systems
        const detected = await detectBookingSystem(page, html, pageUrl);
        for (const d of detected) {
          if (!results.bookingSystems.find(b => b.system === d.system)) {
            results.bookingSystems.push(d);
          }
        }

        // Log booking system detection - AI extraction is DISABLED
        if (detected.length > 0) {
          console.log(`   🔌 ${detected[0].name} detected`);
        }
        // ⛔ AI extraction disabled - produces hallucinated/fake events
        // See CLAUDE.md "REAL DATA ONLY" policy for details
      } catch (e) {
        // Page error - continue
      }
    }
  } finally {
    await page.close();
  }

  return results;
}

// Process single business
async function processBusiness(browser, business) {
  const shortName = business.name.substring(0, 35).padEnd(35);
  process.stdout.write(`   ${shortName} `);

  stats.businessesScanned++;

  if (!business.website) {
    console.log('❌ no website');
    return;
  }

  try {
    const results = await deepScrapeWebsite(browser, business);

    const eventCount = results.events.length;
    const classCount = results.classes.length;

    stats.eventsFound += eventCount;
    stats.classesFound += classCount;
    stats.eventsAdded += eventCount;
    stats.classesAdded += classCount;

    if (results.bookingSystems.length > 0) {
      stats.bookingSystemsFound++;
    }

    if (eventCount > 0 || classCount > 0) {
      console.log(`📝 ${eventCount} events, ${classCount} classes (${results.pagesScraped} pages)`);
    } else if (results.pagesScraped === 0) {
      console.log('❌ could not access');
    } else {
      console.log(`-- (${results.pagesScraped} pages)`);
    }
  } catch (e) {
    console.log('❌ error');
    stats.errors.push({ business: business.name, error: e.message });
  }
}

// Main
async function main() {
  console.log('\n' + '🚀'.repeat(30));
  console.log('\n   PULSE UNIFIED SCRAPING ORCHESTRATOR');
  console.log('   Bulletproof system for any city\n');
  console.log('🚀'.repeat(30) + '\n');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70) + '\n');

  // Fetch businesses
  console.log('📊 Fetching businesses from database...');
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?select=id,name,website&website=not.is.null&order=name`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const businesses = await response.json();
  console.log(`   Found: ${businesses.length} businesses with websites\n`);

  console.log('='.repeat(70));
  console.log('PHASE 1: DISCOVERY & EXTRACTION');
  console.log('='.repeat(70) + '\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const batchSize = 10;
    const totalBatches = Math.ceil(businesses.length / batchSize);

    for (let i = 0; i < businesses.length; i += batchSize) {
      const batch = businesses.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} businesses)`);
      console.log('-'.repeat(70));

      // Process 3 businesses in parallel (complete coverage - no rate limit failures)
      const businessesWithSites = batch.filter(b => b.website);
      const PARALLEL_LIMIT = 3;

      for (let j = 0; j < businessesWithSites.length; j += PARALLEL_LIMIT) {
        const chunk = businessesWithSites.slice(j, j + PARALLEL_LIMIT);
        await Promise.all(chunk.map(business => processBusiness(browser, business)));
      }

      // Progress report
      console.log(`\n📊 Progress: ${Math.min(i + batchSize, businesses.length)}/${businesses.length} (${Math.round((i + batchSize) / businesses.length * 100)}%)`);
      console.log(`   Booking systems: ${stats.bookingSystemsFound} | Events: ${stats.eventsAdded} | Classes: ${stats.classesAdded} | Deals: ${stats.dealsAdded}`);

      // Pause between batches to respect rate limits
      if (i + batchSize < businesses.length) {
        console.log('   Waiting 10s before next batch...');
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  } finally {
    await browser.close();
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`
   BUSINESSES: ${stats.businessesScanned}
   BOOKING SYSTEMS FOUND: ${stats.bookingSystemsFound}
   EVENTS: ${stats.eventsAdded}
   CLASSES: ${stats.classesAdded}
   DEALS: ${stats.dealsAdded}
   ERRORS: ${stats.errors.length}
`);
  console.log('='.repeat(70));
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
}

main().catch(console.error);
