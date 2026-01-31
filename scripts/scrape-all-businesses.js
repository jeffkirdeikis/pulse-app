#!/usr/bin/env node

/**
 * COMPREHENSIVE BUSINESS SCRAPER
 * Scrapes ALL 664 businesses for events, classes, deals, and services
 * Run: node scripts/scrape-all-businesses.js
 */

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'REDACTED_SERVICE_KEY';

// Stats tracking
const stats = {
  businessesProcessed: 0,
  businessesWithWebsites: 0,
  businessesSkipped: 0,
  eventsFound: 0,
  eventsAdded: 0,
  classesFound: 0,
  classesAdded: 0,
  dealsFound: 0,
  dealsAdded: 0,
  servicesFound: 0,
  servicesUpdated: 0,
  errors: 0
};

async function getAllBusinesses() {
  console.log('📊 Fetching all businesses from database...');

  let allBusinesses = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?select=id,name,address,website,category,phone&order=name.asc&offset=${offset}&limit=${limit}`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const businesses = await response.json();
    if (businesses.length === 0) break;

    allBusinesses = allBusinesses.concat(businesses);
    offset += limit;

    if (businesses.length < limit) break;
  }

  console.log(`   Found ${allBusinesses.length} total businesses`);
  return allBusinesses;
}

async function scrapeBusinessWebsite(url, businessName) {
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
                description: 'Upcoming events, shows, performances, or special occasions at this business',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    date: { type: 'string' },
                    time: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'string' },
                    recurring: { type: 'boolean' }
                  }
                }
              },
              classes: {
                type: 'array',
                description: 'Classes, workshops, courses, training sessions, or scheduled group activities',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    schedule: { type: 'string' },
                    days: { type: 'string' },
                    time: { type: 'string' },
                    duration: { type: 'string' },
                    price: { type: 'string' },
                    instructor: { type: 'string' },
                    description: { type: 'string' },
                    level: { type: 'string' }
                  }
                }
              },
              deals: {
                type: 'array',
                description: 'Current promotions, discounts, special offers, happy hours, or deals',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    discount: { type: 'string' },
                    originalPrice: { type: 'string' },
                    dealPrice: { type: 'string' },
                    validUntil: { type: 'string' },
                    terms: { type: 'string' },
                    schedule: { type: 'string' }
                  }
                }
              },
              services: {
                type: 'array',
                description: 'Services offered by this business with pricing',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'string' },
                    duration: { type: 'string' }
                  }
                }
              },
              hours: {
                type: 'object',
                description: 'Business hours',
                properties: {
                  monday: { type: 'string' },
                  tuesday: { type: 'string' },
                  wednesday: { type: 'string' },
                  thursday: { type: 'string' },
                  friday: { type: 'string' },
                  saturday: { type: 'string' },
                  sunday: { type: 'string' }
                }
              },
              description: {
                type: 'string',
                description: 'Business description or about section'
              }
            }
          },
          prompt: `Extract ALL information from this ${businessName} business website in Squamish, BC:

1. EVENTS: Any upcoming events, live music, trivia nights, tastings, performances, open houses, seasonal events
2. CLASSES: Any classes, workshops, courses, training, fitness schedules, yoga classes, art classes, cooking classes, etc.
3. DEALS: Any promotions, discounts, happy hours, daily specials, coupons, seasonal offers, membership deals
4. SERVICES: All services offered with prices if available
5. HOURS: Business operating hours

Be thorough - extract everything you can find. Today's date is ${new Date().toISOString().split('T')[0]}.`
        }
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return null;
    }

    return data.data?.extract || null;
  } catch (error) {
    return null;
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && date >= new Date()) {
      return date.toISOString().split('T')[0];
    }
  } catch {}
  return null;
}

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

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const match = priceStr.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
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

async function insertDeal(deal) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(deal)
  });
  return response.ok;
}

async function updateBusiness(id, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  return response.ok;
}

async function checkExists(table, field, value, businessId = null) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?${field}=ilike.*${encodeURIComponent(value.substring(0, 50))}*`;
  if (businessId) {
    url += `&business_id=eq.${businessId}`;
  }

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await response.json();
  return data.length > 0;
}

async function processBusiness(business) {
  if (!business.website) {
    return { skipped: true, reason: 'no website' };
  }

  let website = business.website.trim();
  if (!website.startsWith('http')) {
    website = 'https://' + website;
  }

  // Skip invalid URLs
  if (website.length < 10 || !website.includes('.')) {
    return { skipped: true, reason: 'invalid URL' };
  }

  const data = await scrapeBusinessWebsite(website, business.name);

  if (!data) {
    return { skipped: true, reason: 'scrape failed' };
  }

  const results = {
    events: 0,
    classes: 0,
    deals: 0,
    services: 0
  };

  // Process EVENTS
  if (data.events && Array.isArray(data.events)) {
    for (const event of data.events) {
      if (!event.title) continue;
      stats.eventsFound++;

      const exists = await checkExists('events', 'title', event.title, business.id);
      if (exists) continue;

      const eventDate = parseDate(event.date) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const success = await insertEvent({
        title: event.title,
        description: event.description || '',
        venue_id: business.id,
        venue_name: business.name,
        venue_address: business.address,
        category: business.category || 'Community',
        event_type: 'event',
        start_date: eventDate,
        start_time: parseTime(event.time),
        price: parsePrice(event.price) || 0,
        is_free: event.price?.toLowerCase()?.includes('free') || false,
        price_description: event.price || null,
        is_recurring: event.recurring || false,
        status: 'active',
        tags: ['auto-scraped', 'business-website']
      });

      if (success) {
        stats.eventsAdded++;
        results.events++;
      }
    }
  }

  // Process CLASSES (as events with type 'class')
  if (data.classes && Array.isArray(data.classes)) {
    for (const cls of data.classes) {
      if (!cls.title) continue;
      stats.classesFound++;

      const exists = await checkExists('events', 'title', cls.title, business.id);
      if (exists) continue;

      // Classes are recurring, set date to next week
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const success = await insertEvent({
        title: cls.title,
        description: `${cls.description || ''}\n\nInstructor: ${cls.instructor || 'TBA'}\nLevel: ${cls.level || 'All levels'}\nDuration: ${cls.duration || 'TBA'}`.trim(),
        venue_id: business.id,
        venue_name: business.name,
        venue_address: business.address,
        category: business.category || 'Fitness & Gyms',
        event_type: 'class',
        start_date: nextWeek.toISOString().split('T')[0],
        start_time: parseTime(cls.time),
        price: parsePrice(cls.price) || 0,
        is_free: cls.price?.toLowerCase()?.includes('free') || false,
        price_description: cls.price || null,
        is_recurring: true,
        recurrence_rule: cls.schedule || cls.days || 'Weekly',
        status: 'active',
        tags: ['auto-scraped', 'class', 'business-website']
      });

      if (success) {
        stats.classesAdded++;
        results.classes++;
      }
    }
  }

  // Process DEALS
  if (data.deals && Array.isArray(data.deals)) {
    for (const deal of data.deals) {
      if (!deal.title) continue;
      stats.dealsFound++;

      const exists = await checkExists('deals', 'title', deal.title, business.id);
      if (exists) continue;

      // Parse discount type
      let discountType = 'special';
      let discountValue = null;
      if (deal.discount) {
        if (deal.discount.includes('%')) {
          discountType = 'percent';
          const match = deal.discount.match(/(\d+)/);
          discountValue = match ? parseFloat(match[1]) : null;
        } else if (deal.discount.includes('$')) {
          discountType = 'fixed';
          discountValue = parsePrice(deal.discount);
        } else if (deal.discount.toLowerCase().includes('bogo')) {
          discountType = 'bogo';
        } else if (deal.discount.toLowerCase().includes('free')) {
          discountType = 'free_item';
        }
      }

      const success = await insertDeal({
        business_id: business.id,
        business_name: business.name,
        business_address: business.address,
        title: deal.title,
        description: deal.description || '',
        category: business.category,
        terms_conditions: deal.terms || null,
        discount_type: discountType,
        discount_value: discountValue,
        original_price: parsePrice(deal.originalPrice),
        deal_price: parsePrice(deal.dealPrice),
        schedule: deal.schedule || null,
        valid_until: parseDate(deal.validUntil),
        status: 'active',
        featured: false
      });

      if (success) {
        stats.dealsAdded++;
        results.deals++;
      }
    }
  }

  // Update business with scraped info
  const updateData = {
    last_scraped_at: new Date().toISOString()
  };

  if (data.description && !business.description) {
    updateData.description = data.description.substring(0, 1000);
  }

  if (data.hours) {
    updateData.hours = JSON.stringify(data.hours);
  }

  if (data.services && data.services.length > 0) {
    stats.servicesFound += data.services.length;
    updateData.services = JSON.stringify(data.services);
    stats.servicesUpdated++;
    results.services = data.services.length;
  }

  await updateBusiness(business.id, updateData);

  return results;
}

async function main() {
  console.log('\n');
  console.log('🚀'.repeat(30));
  console.log('\n   PULSE COMPREHENSIVE BUSINESS SCRAPER');
  console.log('   Scraping ALL businesses for events, classes, deals & services\n');
  console.log('🚀'.repeat(30));
  console.log('\n');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70) + '\n');

  const businesses = await getAllBusinesses();
  const businessesWithWebsites = businesses.filter(b => b.website);

  console.log(`\n📊 Businesses with websites: ${businessesWithWebsites.length}/${businesses.length}`);
  console.log('='.repeat(70) + '\n');

  stats.businessesWithWebsites = businessesWithWebsites.length;

  for (let i = 0; i < businessesWithWebsites.length; i++) {
    const business = businessesWithWebsites[i];
    stats.businessesProcessed++;

    const progress = `[${(i + 1).toString().padStart(3)}/${businessesWithWebsites.length}]`;
    const name = business.name.substring(0, 35).padEnd(35);

    process.stdout.write(`${progress} ${name} `);

    try {
      const result = await processBusiness(business);

      if (result.skipped) {
        console.log(`⚪ ${result.reason}`);
        stats.businessesSkipped++;
      } else {
        const found = [];
        if (result.events > 0) found.push(`${result.events} events`);
        if (result.classes > 0) found.push(`${result.classes} classes`);
        if (result.deals > 0) found.push(`${result.deals} deals`);
        if (result.services > 0) found.push(`${result.services} services`);

        if (found.length > 0) {
          console.log(`✅ ${found.join(', ')}`);
        } else {
          console.log(`✅ scraped (no new items)`);
        }
      }

      // Rate limiting - Firecrawl has limits
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      stats.errors++;
    }

    // Progress update every 50 businesses
    if ((i + 1) % 50 === 0) {
      console.log('\n' + '-'.repeat(70));
      console.log(`📊 Progress: ${i + 1}/${businessesWithWebsites.length} (${Math.round((i + 1) / businessesWithWebsites.length * 100)}%)`);
      console.log(`   Events: ${stats.eventsAdded} | Classes: ${stats.classesAdded} | Deals: ${stats.dealsAdded} | Services: ${stats.servicesUpdated}`);
      console.log('-'.repeat(70) + '\n');
    }
  }

  // Final summary
  console.log('\n');
  console.log('🎉'.repeat(30));
  console.log('\n   SCRAPING COMPLETE!\n');
  console.log('🎉'.repeat(30));
  console.log('\n');
  console.log('='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n   BUSINESSES`);
  console.log(`   ├─ Total in database:     ${businesses.length}`);
  console.log(`   ├─ With websites:         ${stats.businessesWithWebsites}`);
  console.log(`   ├─ Successfully scraped:  ${stats.businessesProcessed - stats.businessesSkipped}`);
  console.log(`   └─ Skipped/Failed:        ${stats.businessesSkipped + stats.errors}`);
  console.log(`\n   EVENTS`);
  console.log(`   ├─ Found:                 ${stats.eventsFound}`);
  console.log(`   └─ Added to database:     ${stats.eventsAdded}`);
  console.log(`\n   CLASSES`);
  console.log(`   ├─ Found:                 ${stats.classesFound}`);
  console.log(`   └─ Added to database:     ${stats.classesAdded}`);
  console.log(`\n   DEALS`);
  console.log(`   ├─ Found:                 ${stats.dealsFound}`);
  console.log(`   └─ Added to database:     ${stats.dealsAdded}`);
  console.log(`\n   SERVICES`);
  console.log(`   ├─ Found:                 ${stats.servicesFound}`);
  console.log(`   └─ Businesses updated:    ${stats.servicesUpdated}`);
  console.log('\n' + '='.repeat(70));
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);
