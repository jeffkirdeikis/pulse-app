#!/usr/bin/env node

/**
 * Scrape deals from Squamish businesses and deal sites
 * Run: node scripts/scrape-deals.js
 */

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'REDACTED_SERVICE_KEY';

// Deal sources - aggregators and local deal sites
const DEAL_SOURCES = [
  // === PRIMARY DEAL AGGREGATORS ===
  {
    name: 'Squamish Adventure - Local Deals',
    url: 'https://squamishadventure.com/local-squamish-deals/',
    type: 'deals'
  },
  {
    name: 'The Locals Board - Sea to Sky',
    url: 'https://thelocalsboard.com/sea-to-sky-business-directory/',
    type: 'directory'
  },
  {
    name: 'BC Buy Local - Squamish',
    url: 'https://bcbuylocal.com/communities/squamish/',
    type: 'directory'
  },
  // === TOURISM & LOCAL NEWS ===
  {
    name: 'Tourism Squamish Deals',
    url: 'https://www.tourismsquamish.com/deals/',
    type: 'tourism'
  },
  {
    name: 'Explore Squamish Business Directory',
    url: 'https://www.exploresquamish.com/business/',
    type: 'directory'
  },
  {
    name: 'Squamish Chamber - Member Directory',
    url: 'https://www.squamishchamber.com/explore/',
    type: 'directory'
  },
  {
    name: 'Downtown Squamish Listings',
    url: 'https://www.downtownsquamish.com/listings/',
    type: 'directory'
  },
  {
    name: 'Squamish Chief Classifieds',
    url: 'https://www.squamishchief.com/classifieds',
    type: 'classifieds'
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
              deals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Deal title/name' },
                    business_name: { type: 'string', description: 'Business offering the deal' },
                    description: { type: 'string', description: 'Deal description' },
                    discount: { type: 'string', description: 'Discount amount (e.g., 20% off, $10 off, BOGO)' },
                    original_price: { type: 'string', description: 'Original price if shown' },
                    deal_price: { type: 'string', description: 'Discounted price if shown' },
                    valid_until: { type: 'string', description: 'Expiration date' },
                    terms: { type: 'string', description: 'Terms and conditions' },
                    category: { type: 'string', description: 'Category (food, retail, services, etc.)' },
                    url: { type: 'string', description: 'Link to deal details' },
                    image: { type: 'string', description: 'Deal image URL' }
                  }
                }
              }
            }
          },
          prompt: `Extract ALL deals, promotions, discounts, and special offers from this Squamish, BC page. Include business name, discount details, prices, expiration dates, and any terms. Focus on current/active deals.`
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`   API Error: ${data.error || response.status}`);
      return [];
    }

    return data.data?.extract?.deals || [];
  } catch (error) {
    console.error(`   Error scraping ${sourceName}: ${error.message}`);
    return [];
  }
}

async function getBusinessByName(name) {
  if (!name) return null;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?name=ilike.*${encodeURIComponent(name)}*&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  const data = await response.json();
  return data[0] || null;
}

async function checkDealExists(title, businessName) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/deals?title=ilike.*${encodeURIComponent(title)}*&business_name=ilike.*${encodeURIComponent(businessName || '')}*`,
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

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const match = priceStr.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : null;
}

function parseDiscount(discountStr) {
  if (!discountStr) return { type: 'special', value: null };

  const percentMatch = discountStr.match(/(\d+)\s*%/);
  if (percentMatch) {
    return { type: 'percent', value: parseFloat(percentMatch[1]) };
  }

  const dollarMatch = discountStr.match(/\$(\d+(?:\.\d{2})?)/);
  if (dollarMatch) {
    return { type: 'fixed', value: parseFloat(dollarMatch[1]) };
  }

  if (discountStr.toLowerCase().includes('bogo') || discountStr.toLowerCase().includes('buy one')) {
    return { type: 'bogo', value: null };
  }

  if (discountStr.toLowerCase().includes('free')) {
    return { type: 'free_item', value: null };
  }

  return { type: 'special', value: null };
}

function parseExpiryDate(dateStr) {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && date > new Date()) {
      return date.toISOString().split('T')[0];
    }
  } catch {}

  return null;
}

function mapCategory(category) {
  if (!category) return 'Other';

  const cat = category.toLowerCase();
  if (cat.includes('food') || cat.includes('restaurant') || cat.includes('dining')) return 'Restaurants & Dining';
  if (cat.includes('retail') || cat.includes('shop')) return 'Retail & Shopping';
  if (cat.includes('fitness') || cat.includes('gym') || cat.includes('health')) return 'Health & Wellness';
  if (cat.includes('beauty') || cat.includes('spa') || cat.includes('salon')) return 'Salons & Spas';
  if (cat.includes('outdoor') || cat.includes('adventure')) return 'Outdoor Adventures';
  if (cat.includes('service')) return 'Services';

  return category;
}

async function main() {
  console.log('💰 PULSE DEALS SCRAPER\n');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60) + '\n');

  let totalFound = 0;
  let newDeals = 0;
  let duplicates = 0;
  let errors = 0;

  for (const source of DEAL_SOURCES) {
    console.log(`\n📍 ${source.name}`);
    console.log('-'.repeat(40));

    const deals = await scrapeUrl(source.url, source.name);
    console.log(`   Found ${deals.length} deals`);

    for (const deal of deals) {
      totalFound++;

      if (!deal.title) {
        console.log(`   ⚪ Skipped: No title`);
        continue;
      }

      // Check for duplicates
      const exists = await checkDealExists(deal.title, deal.business_name);
      if (exists) {
        console.log(`   ⚪ Exists: ${deal.title.substring(0, 40)}`);
        duplicates++;
        continue;
      }

      // Try to match to existing business
      const business = await getBusinessByName(deal.business_name);

      // Parse discount
      const discount = parseDiscount(deal.discount);

      // Insert deal
      const success = await insertDeal({
        business_id: business?.id || null,
        business_name: deal.business_name || 'Local Business',
        business_address: business?.address || 'Squamish, BC',
        title: deal.title,
        description: deal.description || '',
        category: mapCategory(deal.category),
        terms_conditions: deal.terms || null,
        discount_type: discount.type,
        discount_value: discount.value,
        original_price: parsePrice(deal.original_price),
        deal_price: parsePrice(deal.deal_price),
        valid_until: parseExpiryDate(deal.valid_until),
        image_url: deal.image || null,
        status: 'active',
        featured: false
      });

      if (success) {
        console.log(`   ✅ Added: ${deal.title.substring(0, 40)}`);
        newDeals++;
      } else {
        console.log(`   ❌ Failed: ${deal.title.substring(0, 40)}`);
        errors++;
      }
    }

    // Rate limiting between sources
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Also scrape deals from businesses with websites
  console.log(`\n📍 Business Websites`);
  console.log('-'.repeat(40));

  const businessesResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?website=not.is.null&has_deals=eq.false&limit=20`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );
  const businesses = await businessesResponse.json();
  console.log(`   Checking ${businesses.length} business websites for deals...`);

  for (const biz of businesses) {
    if (!biz.website) continue;

    let website = biz.website;
    if (!website.startsWith('http')) {
      website = 'https://' + website;
    }

    try {
      const deals = await scrapeUrl(website, biz.name);

      for (const deal of deals) {
        if (!deal.title) continue;
        totalFound++;

        const exists = await checkDealExists(deal.title, biz.name);
        if (exists) {
          duplicates++;
          continue;
        }

        const discount = parseDiscount(deal.discount);

        const success = await insertDeal({
          business_id: biz.id,
          business_name: biz.name,
          business_address: biz.address,
          title: deal.title,
          description: deal.description || '',
          category: biz.category,
          terms_conditions: deal.terms || null,
          discount_type: discount.type,
          discount_value: discount.value,
          original_price: parsePrice(deal.original_price),
          deal_price: parsePrice(deal.deal_price),
          valid_until: parseExpiryDate(deal.valid_until),
          image_url: deal.image || null,
          status: 'active',
          featured: false
        });

        if (success) {
          console.log(`   ✅ ${biz.name}: ${deal.title.substring(0, 30)}`);
          newDeals++;
        } else {
          errors++;
        }
      }

      // Mark business as checked
      await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${biz.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ has_deals: deals.length > 0 })
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (err) {
      console.log(`   ⚪ ${biz.name}: Could not scrape`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Total found: ${totalFound}`);
  console.log(`✅ New deals added: ${newDeals}`);
  console.log(`⚪ Duplicates skipped: ${duplicates}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
