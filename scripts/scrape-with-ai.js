#!/usr/bin/env node

/**
 * AI-POWERED UNIVERSAL SCRAPER
 * Combines: AI Extraction + Source Verification + Auto-Discovery
 *
 * Usage:
 *   node scripts/scrape-with-ai.js                    # Scrape all known sources
 *   node scripts/scrape-with-ai.js --discover         # Discover new sources first
 *   node scripts/scrape-with-ai.js --verify           # Only run verification pass
 *   node scripts/scrape-with-ai.js --url <url>        # Scrape a specific URL
 */

import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

puppeteer.use(StealthPlugin());

// Check for required API keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.warn('\n⚠️  WARNING: ANTHROPIC_API_KEY not set. AI features will be disabled.');
  console.warn('   Add to .env.local: ANTHROPIC_API_KEY=your-key-here\n');
}

// Dynamic imports only if API key is available
let extractEventsWithAI, validateEventBatch, verifyEvent, SOURCE_TRUST, anthropic;
if (ANTHROPIC_API_KEY) {
  const aiExtractor = await import('./lib/ai-extractor.js');
  const sourceVerification = await import('./lib/source-verification.js');
  const Anthropic = (await import('@anthropic-ai/sdk')).default;

  extractEventsWithAI = aiExtractor.extractEventsWithAI;
  validateEventBatch = aiExtractor.validateEventBatch;
  verifyEvent = sourceVerification.verifyEvent;
  SOURCE_TRUST = sourceVerification.SOURCE_TRUST;
  anthropic = new Anthropic();
} else {
  SOURCE_TRUST = { 'firecrawl-business': 0.6, unknown: 0.4 };
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

/**
 * Fallback extraction using regex when AI is not available
 */
async function fallbackExtraction(html, venueName) {
  const events = [];

  // Common date patterns
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/g,
    /(\w+ \d{1,2},? \d{4})/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g
  ];

  // Common time patterns
  const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/g;

  // Look for event-like structures
  const eventBlocks = html.match(/<div[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<\/div>/gi) || [];

  for (const block of eventBlocks.slice(0, 20)) {
    const titleMatch = block.match(/<h[1-6][^>]*>([^<]+)<\/h/i);
    const dateMatch = block.match(/(\d{4}-\d{2}-\d{2})/);
    const timeMatch = block.match(timePattern);

    if (titleMatch && dateMatch) {
      events.push({
        title: titleMatch[1].trim(),
        date: dateMatch[1],
        time: timeMatch ? timeMatch[0].replace(/\s+/g, '') : '09:00',
        category: 'other',
        confidence: 0.5
      });
    }
  }

  return {
    events,
    extraction_notes: 'Fallback regex extraction (AI not available)'
  };
}

// Stats
const stats = {
  sourcesProcessed: 0,
  eventsExtracted: 0,
  eventsValidated: 0,
  eventsInserted: 0,
  eventsRejected: 0,
  eventsVerified: 0,
  duplicatesMerged: 0,
  errors: []
};

/**
 * Fetch webpage content using Puppeteer
 */
async function fetchPage(url, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    await page.goto(url, {
      waitUntil: options.waitUntil || 'networkidle2',
      timeout: options.timeout || 30000
    });

    // Wait for dynamic content
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
    }

    // Scroll to load lazy content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(r => setTimeout(r, 1000));

    const html = await page.content();
    const title = await page.title();

    await browser.close();
    return { html, title, url };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Normalize URL to ensure it has https://
 */
function normalizeUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

/**
 * Get all configured scraping sources
 */
async function getScrapingSources() {
  // Categories likely to have events/classes
  const eventCategories = [
    'Yoga & Pilates',
    'Fitness',
    'Gyms',
    'Dance',
    'Art',
    'Music',
    'Entertainment',
    'Community',
    'Sports',
    'Recreation',
    'Wellness',
    'Studio'
  ];

  // Get businesses with websites that are likely to have events
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, website, address, category')
    .not('website', 'is', null)
    .eq('status', 'active')
    .or(eventCategories.map(c => `category.ilike.%${c}%`).join(','))
    .limit(50);

  // Get discovered sources that are ready to scrape
  const { data: discovered } = await supabase
    .from('discovered_sources')
    .select('*')
    .eq('status', 'ready')
    .order('scrape_priority', { ascending: false })
    .limit(50);

  const sources = [];

  // Add business websites
  for (const biz of businesses || []) {
    const url = normalizeUrl(biz.website);
    if (url && !url.includes('facebook.com') && !url.includes('instagram.com')) {
      sources.push({
        type: 'business',
        url,
        name: biz.name,
        address: biz.address,
        category: biz.category,
        business_id: biz.id,
        trust_source: 'firecrawl-business'
      });
    }
  }

  // Add discovered sources
  for (const src of discovered || []) {
    sources.push({
      type: 'discovered',
      url: src.url,
      name: src.business_name || src.title,
      category: src.category,
      booking_system: src.booking_system,
      widget_id: src.widget_id,
      trust_source: src.booking_system ? `${src.booking_system}-widget` : 'firecrawl-business'
    });
  }

  return sources;
}

/**
 * Process a single source with AI extraction
 */
async function processSource(source) {
  console.log(`\n📍 Processing: ${source.name}`);
  console.log(`   URL: ${source.url}`);
  console.log(`   Type: ${source.type}`);

  try {
    // Fetch the page
    const page = await fetchPage(source.url);
    console.log(`   Fetched ${page.html.length} bytes`);

    // Extract events (AI if available, fallback to regex)
    let extraction;
    if (ANTHROPIC_API_KEY && extractEventsWithAI) {
      extraction = await extractEventsWithAI(page.html, source.url, source.name);
    } else {
      // Fallback: basic regex extraction
      extraction = await fallbackExtraction(page.html, source.name);
    }
    const events = extraction.events || [];

    console.log(`   AI extracted ${events.length} events`);
    if (extraction.extraction_notes) {
      console.log(`   Notes: ${extraction.extraction_notes}`);
    }

    stats.eventsExtracted += events.length;

    if (events.length === 0) {
      return { success: true, events: 0 };
    }

    // Get existing events for duplicate detection
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id, title, start_date, start_time, venue_name')
      .eq('venue_name', source.name)
      .gte('start_date', new Date().toISOString().split('T')[0]);

    // Validate events (AI if available, fallback to basic checks)
    let validated;
    if (ANTHROPIC_API_KEY && validateEventBatch) {
      validated = await validateEventBatch(events, existingEvents || []);
    } else {
      // Fallback: basic validation
      validated = events.map(event => ({
        event,
        validation: { is_valid: true, confidence: 0.5, issues: [] },
        action: 'insert'
      }));
    }

    let inserted = 0;
    let rejected = 0;

    for (const result of validated) {
      if (result.action === 'reject') {
        rejected++;
        stats.eventsRejected++;
        console.log(`   ❌ Rejected: ${result.event.title} - ${result.validation.issues.join(', ')}`);
        continue;
      }

      stats.eventsValidated++;

      // Apply suggested fixes
      const event = { ...result.event };
      if (result.validation.suggested_fixes) {
        Object.assign(event, result.validation.suggested_fixes);
      }

      // Calculate base trust score
      const baseTrust = SOURCE_TRUST[source.trust_source] || SOURCE_TRUST.unknown;
      const confidence = baseTrust * result.validation.confidence;

      // Insert into database
      const eventData = {
        title: event.title,
        description: event.description || `${event.title} at ${source.name}`,
        venue_name: source.name,
        venue_address: source.address,
        venue_id: source.business_id,
        category: event.category || source.category,
        // AI extraction cannot reliably determine if something is a recurring class.
        // Only dedicated scrapers (Mindbody, WellnessLiving) should create 'class' type.
        // AI-extracted items are always 'event' to avoid polluting the Classes tab.
        event_type: 'event',
        start_date: event.date,
        start_time: event.time,
        end_time: event.end_time,
        price: event.price ? parseFloat(event.price.replace(/[^0-9.]/g, '')) || 0 : 0,
        is_free: event.price?.toLowerCase() === 'free',
        price_description: event.price,
        status: result.action === 'review' ? 'pending_review' : 'active',
        tags: ['ai-scraped', source.trust_source],
        confidence_score: confidence,
        source_url: source.url
      };

      // Upsert (insert or update if exists)
      const { error } = await supabase
        .from('events')
        .upsert(eventData, {
          onConflict: 'title,start_date,venue_name',
          ignoreDuplicates: false
        });

      if (!error) {
        inserted++;
        stats.eventsInserted++;
        console.log(`   ✅ ${result.action === 'review' ? '⚠️' : ''} ${event.title} (${event.date} ${event.time})`);
      }
    }

    console.log(`   Summary: ${inserted} inserted, ${rejected} rejected`);
    return { success: true, events: inserted };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ source: source.name, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Run verification pass on unverified events
 */
async function runVerificationPass() {
  console.log('\n🔍 Running verification pass...');

  if (!ANTHROPIC_API_KEY || !verifyEvent) {
    console.log('   Skipping verification (ANTHROPIC_API_KEY not set)');
    return;
  }

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .is('verified_at', null)
    .eq('status', 'active')
    .gte('start_date', new Date().toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .limit(100);

  if (!events || events.length === 0) {
    console.log('   No events to verify');
    return;
  }

  console.log(`   Verifying ${events.length} events...`);

  for (const event of events) {
    const verification = await verifyEvent(event);

    await supabase
      .from('events')
      .update({
        confidence_score: verification.final_confidence,
        verified_at: new Date().toISOString(),
        verification_sources: verification.matches
      })
      .eq('id', event.id);

    stats.eventsVerified++;

    if (verification.matches > 0) {
      console.log(`   ✅ ${event.title}: ${Math.round(verification.final_confidence * 100)}% confidence (${verification.matches} corroborating sources)`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`   Verified ${stats.eventsVerified} events`);
}

/**
 * Discover new sources
 */
async function discoverNewSources() {
  console.log('\n🔍 Discovering new sources...');

  const DISCOVERY_QUERIES = [
    'squamish yoga studio schedule',
    'squamish fitness classes',
    'squamish pilates',
    'squamish crossfit',
    'squamish events calendar',
    'squamish live music',
    'squamish community events'
  ];

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const discovered = [];
  const seenUrls = new Set();

  for (const query of DISCOVERY_QUERIES.slice(0, 3)) { // Limit for testing
    console.log(`   Searching: "${query}"`);

    try {
      await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`, {
        waitUntil: 'networkidle2',
        timeout: 15000
      });

      const results = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('div.g a[href^="http"]').forEach(el => {
          const href = el.href;
          if (!href.includes('google.com') && !href.includes('facebook.com') &&
              !href.includes('instagram.com') && !href.includes('yelp.com')) {
            items.push(href);
          }
        });
        return [...new Set(items)].slice(0, 5);
      });

      for (const url of results) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        // Check if already in database
        const { data: existing } = await supabase
          .from('businesses')
          .select('id')
          .ilike('website', `%${new URL(url).hostname}%`)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: existingDiscovered } = await supabase
          .from('discovered_sources')
          .select('id')
          .eq('url', url)
          .limit(1);

        if (existingDiscovered && existingDiscovered.length > 0) continue;

        discovered.push({ url, query });
        console.log(`      Found: ${url}`);
      }

      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`      Error searching: ${e.message}`);
    }
  }

  await browser.close();

  // Analyze discovered sources with AI
  if (discovered.length > 0) {
    console.log(`\n   Analyzing ${discovered.length} discovered sources...`);

    for (const source of discovered.slice(0, 5)) { // Limit for API costs
      try {
        const pageData = await fetchPage(source.url);

        if (!ANTHROPIC_API_KEY) {
          // Without AI, just save basic info
          await supabase
            .from('discovered_sources')
            .insert({
              url: source.url,
              title: pageData.title,
              status: 'needs_review',
              discovered_at: new Date().toISOString()
            });
          console.log(`      ✅ Added (needs review): ${pageData.title}`);
          continue;
        }

        // Use AI to categorize
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `Analyze this Squamish BC business website. Is it relevant for a local events app?

URL: ${source.url}
Title: ${pageData.title}
HTML Sample: ${pageData.html.substring(0, 3000)}

Return JSON only:
{
  "business_name": "name or null",
  "category": "fitness|yoga|art|music|community|restaurant|other",
  "has_events": true/false,
  "has_schedule": true/false,
  "is_squamish": true/false,
  "scrape_priority": 1-10,
  "booking_system": "mindbody|wellnessliving|janeapp|none|unknown"
}`
          }]
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);

          if (analysis.is_squamish && (analysis.has_events || analysis.has_schedule) && analysis.scrape_priority >= 5) {
            await supabase
              .from('discovered_sources')
              .insert({
                url: source.url,
                title: pageData.title,
                business_name: analysis.business_name,
                category: analysis.category,
                booking_system: analysis.booking_system !== 'none' ? analysis.booking_system : null,
                scrape_priority: analysis.scrape_priority,
                status: 'ready',
                discovered_at: new Date().toISOString()
              });

            console.log(`      ✅ Added: ${analysis.business_name || pageData.title} (priority: ${analysis.scrape_priority})`);
          }
        }
      } catch (e) {
        console.log(`      Error analyzing ${source.url}: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`   Discovery complete. Found ${discovered.length} potential sources.`);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const startTime = new Date();

  console.log('\n' + '='.repeat(60));
  console.log('🤖 PULSE AI-POWERED SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started: ${startTime.toLocaleString()}`);

  // Handle command line args
  if (args.includes('--discover')) {
    await discoverNewSources();
  }

  if (args.includes('--url')) {
    const urlIndex = args.indexOf('--url') + 1;
    if (args[urlIndex]) {
      await processSource({
        type: 'manual',
        url: args[urlIndex],
        name: 'Manual Scrape',
        trust_source: 'firecrawl-business'
      });
    }
  } else if (!args.includes('--verify')) {
    // Get all sources
    const sources = await getScrapingSources();
    console.log(`\nFound ${sources.length} sources to scrape`);

    // Process each source
    for (const source of sources.slice(0, 10)) { // Limit for testing
      await processSource(source);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Always run verification pass
  if (args.includes('--verify') || !args.includes('--url')) {
    await runVerificationPass();
  }

  // Summary
  const endTime = new Date();
  const duration = Math.round((endTime - startTime) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Sources processed: ${stats.sourcesProcessed}`);
  console.log(`Events extracted:  ${stats.eventsExtracted}`);
  console.log(`Events validated:  ${stats.eventsValidated}`);
  console.log(`Events inserted:   ${stats.eventsInserted}`);
  console.log(`Events rejected:   ${stats.eventsRejected}`);
  console.log(`Events verified:   ${stats.eventsVerified}`);
  console.log(`Duration:          ${duration} seconds`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  • ${e.source}: ${e.error}`));
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
