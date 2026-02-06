#!/usr/bin/env node

/**
 * PULSE UNIFIED SCRAPING ORCHESTRATOR
 *
 * Two modes:
 * 1. DISCOVERY MODE (default): Discovers booking systems on business websites
 *    and records them in scraping_sources table for dedicated scrapers.
 *
 * 2. VERIFIED MODE (--verified): Uses AI extraction WITH source text verification
 *    to extract events from businesses without dedicated scraper coverage.
 *    Every extracted event must be verified against the page text before insertion.
 *
 * Usage:
 *   node scripts/scrape-orchestrator.js                     # Discovery only
 *   node scripts/scrape-orchestrator.js --verified           # Discovery + verified AI extraction
 *   node scripts/scrape-orchestrator.js --verified --limit 10 # Test with 10 businesses
 *
 * Anti-hallucination safeguards (5 layers):
 * 1. Signal pre-filter - pages without dates/times/keywords never reach AI
 * 2. Strict AI prompt - "return empty if none", requires source_quote
 * 3. Source text verification - title + date/time must appear in page text
 * 4. event-validator.js - forbidden titles, placeholder detection, clustering
 * 5. Database constraints - CHECK constraints, holiday triggers
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';
import { extractAndVerify } from './lib/verified-extractor.js';
import { validateEvent, validateAIExtracted, ValidationError } from './lib/event-validator.js';
import {
  getVerifiedSourceUrl,
  saveVerifiedSource,
  deactivateVerifiedSource,
  getCoveredBusinessIds,
  recordScrapeSuccess,
  recordScrapeFailure,
} from './lib/reliable-sources.js';

puppeteer.use(StealthPlugin());

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// Parse CLI flags
const args = process.argv.slice(2);
const VERIFIED_MODE = args.includes('--verified');
const LIMIT = (() => {
  const idx = args.indexOf('--limit');
  if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1], 10);
  return 0;
})();

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

// Pages to check for events (expanded for verified mode)
const DISCOVERY_PAGES = ['', '/schedule', '/classes', '/events'];
const VERIFIED_PAGES = [
  '', '/events', '/classes', '/schedule', '/workshops',
  '/calendar', '/programs', '/activities', '/whats-on', '/upcoming'
];

// Stats tracking
const stats = {
  businessesScanned: 0,
  businessesSkipped: 0,
  bookingSystemsFound: 0,
  pagesWithSignals: 0,
  aiExtractions: 0,
  eventsExtracted: 0,
  eventsVerified: 0,
  eventsRejected: 0,
  eventsInserted: 0,
  eventsDuplicate: 0,
  sourcesDiscovered: 0,
  errors: [],
};

// Detect booking systems from HTML
async function detectBookingSystem(html, url) {
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

// Check if event already exists in database
async function isDuplicate(event) {
  try {
    const params = new URLSearchParams({
      title: `eq.${event.title}`,
      start_date: `eq.${event.start_date}`,
      venue_name: `eq.${event.venue_name}`,
      select: 'id',
      limit: '1'
    });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events?${params}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.length > 0;
    }
  } catch (e) {
    // If check fails, allow insertion (database constraints will catch real dupes)
  }
  return false;
}

// Insert verified event into database
async function insertVerifiedEvent(event) {
  try {
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

    if (response.ok) {
      return true;
    } else {
      const err = await response.text();
      console.warn(`      Insert failed: ${err.substring(0, 100)}`);
      return false;
    }
  } catch (e) {
    console.warn(`      Insert error: ${e.message.substring(0, 100)}`);
    return false;
  }
}

// Deep scrape a website (discovery + optional verified extraction)
async function deepScrapeWebsite(browser, business, coveredIds) {
  const results = {
    bookingSystems: [],
    verifiedEvents: [],
    pagesScraped: 0,
    pageTexts: {},
  };

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const baseUrl = business.website.replace(/\/$/, '');
  const isCovered = coveredIds.some(c => c.businessId === business.id);
  const pagesToCheck = VERIFIED_MODE ? VERIFIED_PAGES : DISCOVERY_PAGES;

  // In verified mode, check if we have a saved URL for this business
  let savedUrl = null;
  if (VERIFIED_MODE && !isCovered) {
    const saved = await getVerifiedSourceUrl(business.id);
    if (saved && saved.url) {
      savedUrl = saved.url;
    }
  }

  try {
    // If we have a saved URL, try it first
    const urlsToTry = savedUrl
      ? [savedUrl, ...pagesToCheck.map(p => baseUrl + p).filter(u => u !== savedUrl)]
      : pagesToCheck.map(p => baseUrl + p);

    let foundEventsOnPage = false;

    for (const pageUrl of urlsToTry) {
      if (foundEventsOnPage) break; // Stop after first page with verified events

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 500));

        const html = await page.content();
        results.pagesScraped++;

        // Always detect booking systems
        const detected = await detectBookingSystem(html, pageUrl);
        for (const d of detected) {
          if (!results.bookingSystems.find(b => b.system === d.system)) {
            results.bookingSystems.push(d);
          }
        }

        if (detected.length > 0) {
          console.log(`   >> ${detected[0].name} detected on ${pageUrl}`);
        }

        // Verified AI extraction (only if enabled and business not already covered)
        if (VERIFIED_MODE && !isCovered) {
          // Get innerText (not HTML) for AI extraction
          const pageText = await page.evaluate(() => document.body.innerText);
          results.pageTexts[pageUrl] = pageText;

          const extraction = await extractAndVerify(pageText, business.name, pageUrl);

          if (extraction.skippedReason) {
            // No signals or error - continue to next page
            continue;
          }

          stats.aiExtractions++;
          stats.pagesWithSignals++;

          if (extraction.verified.length > 0) {
            foundEventsOnPage = true;
            stats.eventsExtracted += extraction.raw.length;
            stats.eventsVerified += extraction.verified.length;
            stats.eventsRejected += extraction.rejected.length;

            // Process verified events
            for (const { event: rawEvent, checks } of extraction.verified) {
              // Build event object for database
              const eventData = {
                title: rawEvent.title,
                start_date: rawEvent.date,
                start_time: rawEvent.time ? (rawEvent.time.length === 5 ? `${rawEvent.time}:00` : rawEvent.time) : null,
                end_time: rawEvent.end_time ? (rawEvent.end_time.length === 5 ? `${rawEvent.end_time}:00` : rawEvent.end_time) : null,
                description: rawEvent.description || null,
                venue_name: business.name,
                venue_id: business.id,
                category: 'community',
                event_type: 'event',
                tags: ['auto-scraped', 'ai-verified', 'website-verified'],
                confidence_score: 0.75,
              };

              // Layer 4: event-validator.js validation
              try {
                const validated = validateEvent(eventData, 'verified-ai');

                // Layer 4b: AI-specific validation
                const aiCheck = validateAIExtracted(validated, results.pageTexts[pageUrl]);
                if (!aiCheck.valid) {
                  console.log(`      REJECTED (AI check): ${aiCheck.reason}`);
                  stats.eventsRejected++;
                  stats.eventsVerified--;
                  continue;
                }

                // Check for duplicates
                const dupe = await isDuplicate(validated);
                if (dupe) {
                  stats.eventsDuplicate++;
                  continue;
                }

                // Insert
                const inserted = await insertVerifiedEvent(validated);
                if (inserted) {
                  stats.eventsInserted++;
                  results.verifiedEvents.push(validated);
                }
              } catch (e) {
                if (e instanceof ValidationError) {
                  console.log(`      REJECTED (validator): ${e.message}`);
                  stats.eventsRejected++;
                  stats.eventsVerified--;
                } else {
                  throw e;
                }
              }
            }

            // Log rejected events for debugging
            if (extraction.rejected.length > 0) {
              for (const { event: rejEvent, reason } of extraction.rejected) {
                console.log(`      REJECTED (source verify): "${rejEvent.title}" - ${reason}`);
              }
            }

            // Save this URL as a verified source for future runs
            if (results.verifiedEvents.length > 0) {
              await saveVerifiedSource(business.id, business.name, pageUrl, results.verifiedEvents.length);
              stats.sourcesDiscovered++;
            }
          } else if (extraction.rejected.length > 0) {
            // AI found things but none verified - log for debugging
            stats.eventsExtracted += extraction.raw.length;
            stats.eventsRejected += extraction.rejected.length;
            for (const { event: rejEvent, reason } of extraction.rejected) {
              console.log(`      REJECTED: "${rejEvent.title}" - ${reason}`);
            }
          }
        }
      } catch (e) {
        // Page error - continue to next page
      }
    }

    // If verified mode and we had a saved URL but found nothing, track failure
    if (VERIFIED_MODE && savedUrl && results.verifiedEvents.length === 0) {
      await recordScrapeFailure(business.name, 'No verified events found');
    }
  } finally {
    await page.close();
  }

  return results;
}

// Process single business
async function processBusiness(browser, business, coveredIds) {
  const shortName = business.name.substring(0, 35).padEnd(35);
  process.stdout.write(`   ${shortName} `);

  stats.businessesScanned++;

  if (!business.website) {
    console.log('-- no website');
    return;
  }

  // Skip businesses already covered by dedicated scrapers (in verified mode)
  if (VERIFIED_MODE && coveredIds.some(c => c.businessId === business.id)) {
    console.log('>> covered by dedicated scraper');
    stats.businessesSkipped++;
    return;
  }

  try {
    const results = await deepScrapeWebsite(browser, business, coveredIds);

    if (results.bookingSystems.length > 0) {
      stats.bookingSystemsFound++;
    }

    const eventCount = results.verifiedEvents.length;
    if (eventCount > 0) {
      console.log(`+${eventCount} verified events (${results.pagesScraped} pages)`);
    } else if (results.pagesScraped === 0) {
      console.log('-- could not access');
    } else {
      console.log(`-- (${results.pagesScraped} pages)`);
    }
  } catch (e) {
    console.log('-- error');
    stats.errors.push({ business: business.name, error: e.message });
  }
}

// Main
async function main() {
  const mode = VERIFIED_MODE ? 'DISCOVERY + VERIFIED AI EXTRACTION' : 'DISCOVERY ONLY';

  console.log('\n' + '='.repeat(70));
  console.log('   PULSE UNIFIED SCRAPING ORCHESTRATOR');
  console.log(`   Mode: ${mode}`);
  if (LIMIT > 0) console.log(`   Limit: ${LIMIT} businesses`);
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  // Fetch businesses
  console.log('Fetching businesses from database...');
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?select=id,name,website&website=not.is.null&order=name`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  let businesses = await response.json();
  console.log(`Found: ${businesses.length} businesses with websites`);

  if (LIMIT > 0) {
    businesses = businesses.slice(0, LIMIT);
    console.log(`Limited to: ${businesses.length} businesses`);
  }

  // Get covered business IDs (for skipping in verified mode)
  let coveredIds = [];
  if (VERIFIED_MODE) {
    coveredIds = await getCoveredBusinessIds();
    console.log(`Businesses with dedicated scrapers: ${coveredIds.length}`);
    console.log(`Businesses to scan with AI: ${businesses.length - businesses.filter(b => coveredIds.some(c => c.businessId === b.id)).length}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(VERIFIED_MODE ? 'SCANNING & EXTRACTING' : 'SCANNING FOR BOOKING SYSTEMS');
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

      console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} businesses)`);
      console.log('-'.repeat(70));

      // Process 3 businesses in parallel
      const businessesWithSites = batch.filter(b => b.website);
      const PARALLEL_LIMIT = VERIFIED_MODE ? 2 : 3; // Fewer parallel in verified mode (AI rate limits)

      for (let j = 0; j < businessesWithSites.length; j += PARALLEL_LIMIT) {
        const chunk = businessesWithSites.slice(j, j + PARALLEL_LIMIT);
        await Promise.all(chunk.map(b => processBusiness(browser, b, coveredIds)));
      }

      // Progress report
      const progress = Math.min(i + batchSize, businesses.length);
      console.log(`\nProgress: ${progress}/${businesses.length} (${Math.round(progress / businesses.length * 100)}%)`);
      if (VERIFIED_MODE) {
        console.log(`   AI calls: ${stats.aiExtractions} | Verified: ${stats.eventsVerified} | Inserted: ${stats.eventsInserted} | Rejected: ${stats.eventsRejected} | Dupes: ${stats.eventsDuplicate}`);
      }
      console.log(`   Booking systems: ${stats.bookingSystemsFound} | Errors: ${stats.errors.length}`);

      // Pause between batches
      if (i + batchSize < businesses.length) {
        const delay = VERIFIED_MODE ? 5000 : 10000;
        console.log(`   Waiting ${delay / 1000}s before next batch...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  } finally {
    await browser.close();
  }

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`
   Mode: ${mode}
   Businesses scanned: ${stats.businessesScanned}
   Businesses skipped (covered): ${stats.businessesSkipped}
   Booking systems found: ${stats.bookingSystemsFound}
   Errors: ${stats.errors.length}`);

  if (VERIFIED_MODE) {
    console.log(`
   --- AI Extraction ---
   Pages with signals: ${stats.pagesWithSignals}
   AI extraction calls: ${stats.aiExtractions}
   Events extracted (raw): ${stats.eventsExtracted}
   Events verified: ${stats.eventsVerified}
   Events rejected: ${stats.eventsRejected}
   Events duplicates: ${stats.eventsDuplicate}
   Events inserted: ${stats.eventsInserted}
   New sources discovered: ${stats.sourcesDiscovered}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Completed: ${new Date().toLocaleString()}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors:`);
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`  - ${err.business}: ${err.error.substring(0, 80)}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }
}

main().catch(console.error);
