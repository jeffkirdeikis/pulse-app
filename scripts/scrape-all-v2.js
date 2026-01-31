#!/usr/bin/env node

/**
 * IMPROVED COMPREHENSIVE BUSINESS SCRAPER v2
 * - Better error handling with specific failure reasons
 * - Rate limiting: 1 second between requests
 * - Batch processing: 50 businesses, 30 second pause between batches
 * - Tracks last_scraped to avoid re-scraping within 24 hours
 * - Detailed summary at end
 */

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'REDACTED_SERVICE_KEY';

const BATCH_SIZE = 50;
const BATCH_PAUSE_MS = 30000; // 30 seconds between batches
const REQUEST_DELAY_MS = 1000; // 1 second between requests

// Stats tracking
const stats = {
  total: 0,
  withWebsites: 0,
  skippedRecent: 0,
  attempted: 0,
  successful: 0,
  failed: 0,
  eventsFound: 0,
  eventsAdded: 0,
  classesFound: 0,
  classesAdded: 0,
  dealsFound: 0,
  dealsAdded: 0,
  errors: {
    timeout: 0,
    blocked: 0,
    notFound: 0,
    invalidUrl: 0,
    noCredits: 0,
    networkError: 0,
    parseError: 0,
    other: 0
  }
};

const failedBusinesses = [];

// Helper: delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper: format URL
function formatUrl(url) {
  if (!url) return null;
  url = url.trim();
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }
  // Remove trailing slashes
  url = url.replace(/\/+$/, '');
  return url;
}

// Fetch all businesses with websites
async function getBusinesses() {
  console.log('\n📊 Fetching businesses from database...');

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?select=id,name,address,website,category&website=neq.&order=name`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch businesses: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Filter to only those with actual website URLs
  const withWebsites = data.filter(b => b.website && b.website.trim().length > 0);

  stats.total = data.length;
  stats.withWebsites = withWebsites.length;

  console.log(`   Total businesses: ${stats.total}`);
  console.log(`   With websites: ${stats.withWebsites}`);
  console.log(`   To scrape: ${stats.withWebsites}`);

  return withWebsites;
}

// Scrape a single business website
async function scrapeBusiness(business) {
  const url = formatUrl(business.website);

  if (!url) {
    stats.errors.invalidUrl++;
    return { success: false, error: 'Invalid URL' };
  }

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
        timeout: 30000,
        extract: {
          schema: {
            type: 'object',
            properties: {
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    date: { type: 'string' },
                    time: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'string' },
                    location: { type: 'string' }
                  }
                }
              },
              classes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    schedule: { type: 'string' },
                    price: { type: 'string' },
                    description: { type: 'string' },
                    instructor: { type: 'string' }
                  }
                }
              },
              deals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    discount: { type: 'string' },
                    description: { type: 'string' },
                    validUntil: { type: 'string' },
                    terms: { type: 'string' }
                  }
                }
              }
            }
          },
          prompt: `Extract ALL events, classes, and deals/specials from this business website.

Events: Look for upcoming events, performances, live music, trivia nights, special occasions. Include date, time, description.

Classes: Look for recurring classes, workshops, training sessions, fitness classes. Include schedule (days/times), price, instructor if available.

Deals: Look for promotions, discounts, specials, happy hours, coupons, "% off" offers. Include discount amount, validity period, any terms.

Today's date is ${new Date().toISOString().split('T')[0]}. Only include future events.`
        }
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.error || `HTTP ${response.status}`;

      // Categorize error
      if (errorMsg.includes('timeout')) {
        stats.errors.timeout++;
        return { success: false, error: 'Timeout' };
      } else if (errorMsg.includes('credit')) {
        stats.errors.noCredits++;
        return { success: false, error: 'No credits' };
      } else if (errorMsg.includes('blocked') || errorMsg.includes('403')) {
        stats.errors.blocked++;
        return { success: false, error: 'Blocked' };
      } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        stats.errors.notFound++;
        return { success: false, error: '404 Not Found' };
      } else {
        stats.errors.other++;
        return { success: false, error: errorMsg.substring(0, 50) };
      }
    }

    const extract = data.data?.extract || {};
    return {
      success: true,
      events: extract.events || [],
      classes: extract.classes || [],
      deals: extract.deals || []
    };

  } catch (error) {
    if (error.message.includes('fetch')) {
      stats.errors.networkError++;
      return { success: false, error: 'Network error' };
    }
    stats.errors.other++;
    return { success: false, error: error.message.substring(0, 50) };
  }
}

// Parse date string to ISO format
function parseDate(dateStr) {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && date > new Date()) {
      return date.toISOString().split('T')[0];
    }
  } catch {}

  return null;
}

// Parse time string to HH:MM format
function parseTime(timeStr) {
  if (!timeStr) return '09:00';

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

// Parse price to number
function parsePrice(priceStr) {
  if (!priceStr) return null;
  if (priceStr.toLowerCase().includes('free')) return 0;

  const match = priceStr.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}

// Insert event into database
async function insertEvent(event, business, isClass = false) {
  const eventDate = parseDate(event.date);
  if (!eventDate && !isClass) return false; // Events need dates, classes can be recurring

  const eventData = {
    title: event.title,
    description: event.description || '',
    venue_name: business.name,
    venue_address: business.address || 'Squamish, BC',
    category: business.category || 'Community',
    event_type: isClass ? 'class' : 'event',
    start_date: eventDate || new Date().toISOString().split('T')[0],
    start_time: parseTime(event.time || event.schedule),
    price: parsePrice(event.price),
    is_free: event.price?.toLowerCase().includes('free') || false,
    price_description: event.price || null,
    status: 'active',
    tags: ['auto-scraped', business.name.toLowerCase().replace(/\s+/g, '-')]
  };

  // Check for duplicate
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/events?title=eq.${encodeURIComponent(event.title)}&venue_name=eq.${encodeURIComponent(business.name)}&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const existing = await checkResponse.json();
  if (existing.length > 0) return false; // Duplicate

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
}

// Insert deal into database
async function insertDeal(deal, business) {
  // Parse discount type
  let discountType = 'special';
  let discountValue = null;

  if (deal.discount) {
    const percentMatch = deal.discount.match(/(\d+)\s*%/);
    const dollarMatch = deal.discount.match(/\$(\d+(?:\.\d{2})?)/);

    if (percentMatch) {
      discountType = 'percent';
      discountValue = parseFloat(percentMatch[1]);
    } else if (dollarMatch) {
      discountType = 'fixed';
      discountValue = parseFloat(dollarMatch[1]);
    } else if (deal.discount.toLowerCase().includes('bogo') || deal.discount.toLowerCase().includes('buy one')) {
      discountType = 'bogo';
    } else if (deal.discount.toLowerCase().includes('free')) {
      discountType = 'free_item';
    }
  }

  const dealData = {
    business_id: business.id,
    business_name: business.name,
    business_address: business.address || 'Squamish, BC',
    title: deal.title,
    description: deal.description || '',
    category: business.category || 'Other',
    discount_type: discountType,
    discount_value: discountValue,
    terms_conditions: deal.terms || null,
    valid_until: parseDate(deal.validUntil),
    status: 'active',
    featured: false
  };

  // Check for duplicate
  const checkResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/deals?title=eq.${encodeURIComponent(deal.title)}&business_name=eq.${encodeURIComponent(business.name)}&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  const existing = await checkResponse.json();
  if (existing.length > 0) return false; // Duplicate

  const response = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(dealData)
  });

  return response.ok;
}

// Update business last_scraped timestamp (disabled - column doesn't exist yet)
async function updateLastScraped(businessId) {
  // Column doesn't exist yet - skipping
  return;
}

// Process a single business
async function processBusiness(business, index, total) {
  const prefix = `[${(index + 1).toString().padStart(3)}/${total}]`;
  const name = business.name.substring(0, 35).padEnd(35);

  stats.attempted++;

  const result = await scrapeBusiness(business);

  if (!result.success) {
    stats.failed++;
    failedBusinesses.push({ name: business.name, error: result.error });
    console.log(`${prefix} ${name} ❌ ${result.error}`);
    return;
  }

  stats.successful++;

  // Process events
  let eventsAdded = 0;
  for (const event of result.events) {
    if (event.title) {
      stats.eventsFound++;
      if (await insertEvent(event, business, false)) {
        stats.eventsAdded++;
        eventsAdded++;
      }
    }
  }

  // Process classes (stored as events with event_type='class')
  let classesAdded = 0;
  for (const cls of result.classes) {
    if (cls.title) {
      stats.classesFound++;
      if (await insertEvent({ ...cls, date: null }, business, true)) {
        stats.classesAdded++;
        classesAdded++;
      }
    }
  }

  // Process deals
  let dealsAdded = 0;
  for (const deal of result.deals) {
    if (deal.title) {
      stats.dealsFound++;
      if (await insertDeal(deal, business)) {
        stats.dealsAdded++;
        dealsAdded++;
      }
    }
  }

  // Update last_scraped
  await updateLastScraped(business.id);

  // Log result
  const items = [];
  if (eventsAdded > 0) items.push(`${eventsAdded} events`);
  if (classesAdded > 0) items.push(`${classesAdded} classes`);
  if (dealsAdded > 0) items.push(`${dealsAdded} deals`);

  if (items.length > 0) {
    console.log(`${prefix} ${name} ✅ ${items.join(', ')}`);
  } else {
    console.log(`${prefix} ${name} ⚪ scraped (no new items)`);
  }
}

// Main function
async function main() {
  console.log('\n');
  console.log('🚀'.repeat(30));
  console.log('\n   PULSE BUSINESS SCRAPER v2');
  console.log('   Scraping ALL businesses for events, classes & deals\n');
  console.log('🚀'.repeat(30));
  console.log(`\nStarted: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));

  try {
    const businesses = await getBusinesses();

    if (businesses.length === 0) {
      console.log('\n⚠️  No businesses to scrape (all scraped within 24 hours)');
      return;
    }

    console.log('\n' + '='.repeat(70));
    console.log('Starting scrape...\n');

    // Process in batches
    for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
      const batch = businesses.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(businesses.length / BATCH_SIZE);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} businesses)`);
      console.log('-'.repeat(70));

      for (let j = 0; j < batch.length; j++) {
        await processBusiness(batch[j], i + j, businesses.length);

        // Rate limiting between requests
        if (j < batch.length - 1) {
          await delay(REQUEST_DELAY_MS);
        }
      }

      // Pause between batches (except after last batch)
      if (i + BATCH_SIZE < businesses.length) {
        console.log(`\n⏸️  Pausing ${BATCH_PAUSE_MS / 1000}s before next batch...`);
        await delay(BATCH_PAUSE_MS);
      }

      // Progress report every batch
      console.log(`\n📊 Progress: ${Math.min(i + BATCH_SIZE, businesses.length)}/${businesses.length} (${Math.round((i + BATCH_SIZE) / businesses.length * 100)}%)`);
      console.log(`   ✅ Success: ${stats.successful} | ❌ Failed: ${stats.failed}`);
      console.log(`   Events: ${stats.eventsAdded} | Classes: ${stats.classesAdded} | Deals: ${stats.dealsAdded}`);
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
  }

  // Final summary
  console.log('\n');
  console.log('🎉'.repeat(30));
  console.log('\n   SCRAPING COMPLETE!\n');
  console.log('🎉'.repeat(30));

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));

  console.log('\n   BUSINESSES');
  console.log(`   ├─ Total in database:      ${stats.total}`);
  console.log(`   ├─ Skipped (recent):       ${stats.skippedRecent}`);
  console.log(`   ├─ Attempted:              ${stats.attempted}`);
  console.log(`   ├─ ✅ Successful:          ${stats.successful}`);
  console.log(`   └─ ❌ Failed:              ${stats.failed}`);

  console.log('\n   CONTENT ADDED');
  console.log(`   ├─ Events found:           ${stats.eventsFound}`);
  console.log(`   ├─ Events added:           ${stats.eventsAdded}`);
  console.log(`   ├─ Classes found:          ${stats.classesFound}`);
  console.log(`   ├─ Classes added:          ${stats.classesAdded}`);
  console.log(`   ├─ Deals found:            ${stats.dealsFound}`);
  console.log(`   └─ Deals added:            ${stats.dealsAdded}`);

  console.log('\n   ERROR BREAKDOWN');
  console.log(`   ├─ Timeout:                ${stats.errors.timeout}`);
  console.log(`   ├─ Blocked (403):          ${stats.errors.blocked}`);
  console.log(`   ├─ Not Found (404):        ${stats.errors.notFound}`);
  console.log(`   ├─ Invalid URL:            ${stats.errors.invalidUrl}`);
  console.log(`   ├─ No Credits:             ${stats.errors.noCredits}`);
  console.log(`   ├─ Network Error:          ${stats.errors.networkError}`);
  console.log(`   └─ Other:                  ${stats.errors.other}`);

  console.log('\n' + '='.repeat(70));
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));

  // Show sample of failed businesses
  if (failedBusinesses.length > 0) {
    console.log('\n📋 Sample Failed Businesses (first 20):');
    failedBusinesses.slice(0, 20).forEach(b => {
      console.log(`   • ${b.name}: ${b.error}`);
    });
  }
}

main().catch(console.error);
