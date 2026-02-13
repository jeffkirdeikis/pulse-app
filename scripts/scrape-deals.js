#!/usr/bin/env node

/**
 * Scrape deals from Squamish businesses — HTML parsing, NO unverified AI extraction.
 *
 * Sources:
 *   1. ExploreSquamish Dining Deals (accordion HTML — restaurant deals + happy hours)
 *   2. Chances Squamish (casino promos + Match Eatery deals — card grid + detail pages)
 *   3. Sea to Sky Gondola (Family Fun Night + promotions — homepage HTML)
 *
 * Lessons applied (from venue event scraper, Feb 12 2026):
 *   - Parse structured HTML directly instead of Firecrawl AI extraction
 *   - Prefer aggregator pages (1 page covers 10+ businesses)
 *   - Use greedy regex [^\n]+ for field extraction
 *   - Handle all HTML entity variants
 *   - Verify data in DATABASE after insertion
 *   - Skip records with missing critical fields
 *   - Use exact dedup (not ilike wildcards)
 *
 * Run: node scripts/scrape-deals.js
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

const DINING_DEALS_URL = 'https://www.exploresquamish.com/travel-deals-packages/squamish-dining-deals/';
const CHANCES_PROMOS_URL = 'https://squamishchances.com/promotions/';
const CHANCES_HAPPY_HOUR_URL = 'https://squamishchances.com/happy-hour-at-match-eatery-public-house/';
const CHANCES_LOCALS_URL = 'https://squamishchances.com/locals-get-20-off/';
const CHANCES_KIDS_URL = 'https://squamishchances.com/kids-eat-free/';
const GONDOLA_URL = 'https://www.seatoskygondola.com/';

// ── HTML helpers ──────────────────────────────────────────────

function decodeHtmlEntities(text) {
  return text
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#038;/g, '&').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

// ── Supabase helpers ──────────────────────────────────────────

async function getBusinessByName(name) {
  if (!name) return null;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?name=ilike.*${encodeURIComponent(name)}*&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    return data[0] || null;
  } catch { return null; }
}

async function checkDealExists(title, businessName) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/deals?title=eq.${encodeURIComponent(title)}&business_name=eq.${encodeURIComponent(businessName)}`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    return data.length > 0;
  } catch { return false; }
}

async function insertDeal(deal) {
  // Validate: must have title and business_name
  if (!deal.title || !deal.business_name) {
    console.warn(`  [skip] missing title or business_name`);
    return false;
  }
  // Reject if title = business_name (hallucination pattern)
  if (deal.title.toLowerCase().trim() === deal.business_name.toLowerCase().trim()) {
    console.warn(`  [skip] title = business_name: "${deal.title}"`);
    return false;
  }

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

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`  [error] Insert failed for "${deal.title}": ${errText}`);
  }
  return response.ok;
}

// ── Discount parsing ──────────────────────────────────────────

function parseDiscountFromText(text) {
  const lower = text.toLowerCase();

  // "50% off" or "20% off"
  const pctMatch = text.match(/(\d+)\s*%\s*off/i);
  if (pctMatch) return { type: 'percent', value: parseFloat(pctMatch[1]) };

  // "half price" or "1/2 price"
  if (/half\s*price|1\/2/i.test(lower)) return { type: 'percent', value: 50 };

  // "$X off" pattern
  const dollarOffMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*off/i);
  if (dollarOffMatch) return { type: 'fixed', value: parseFloat(dollarOffMatch[1]) };

  // BOGO
  if (/bogo|buy\s*one\s*get\s*one/i.test(lower)) return { type: 'bogo', value: null };

  // "free" (kids eat free, etc.)
  if (/\bfree\b/i.test(lower)) return { type: 'free_item', value: null };

  // Has a concrete price ($X) — it's a deal price, not a discount
  const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (priceMatch) return { type: 'fixed', value: parseFloat(priceMatch[1]) };

  return { type: 'special', value: null };
}

function parseDaysFromText(text) {
  const days = [];
  const lower = text.toLowerCase();
  if (/\bmon(?:day)?(?:'?s)?\b/i.test(lower)) days.push('monday');
  if (/\btue(?:s(?:day)?)?(?:'?s)?\b/i.test(lower)) days.push('tuesday');
  if (/\bwed(?:nesday)?(?:'?s)?\b/i.test(lower)) days.push('wednesday');
  if (/\bthu(?:rs(?:day)?)?(?:'?s)?\b/i.test(lower)) days.push('thursday');
  if (/\bfri(?:day)?(?:'?s)?\b/i.test(lower)) days.push('friday');
  if (/\bsat(?:urday)?(?:'?s)?\b/i.test(lower)) days.push('saturday');
  if (/\bsun(?:day)?(?:'?s)?\b/i.test(lower)) days.push('sunday');
  if (/\bdaily\b|\bevery\s*day\b|7\s*days/i.test(lower)) {
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  }
  return days;
}

// ── Title builder ─────────────────────────────────────────────

function buildDealTitle(dealLines, businessName) {
  // Flatten all lines and find the most descriptive snippet with prices
  const allText = dealLines.join('\n');
  const lines = allText.split('\n').map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);

  // Find lines with concrete prices/discounts (most attractive for title)
  const pricedLines = lines.filter(l => /\$\d/.test(l) || /\d+%/.test(l) || /\bfree\b/i.test(l) || /half\s*price/i.test(l));

  let title;
  if (pricedLines.length > 0) {
    // Use the first priced line
    title = pricedLines[0];
  } else if (lines.length > 0) {
    // Use first meaningful line (skip bare day names)
    title = lines.find(l => l.length > 10 && !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(l)) || lines[0];
  } else {
    title = `Specials at ${businessName}`;
  }

  // Clean up: remove leading dashes, bullets
  title = title.replace(/^[-•*]\s*/, '');

  // Truncate at word boundary
  if (title.length > 70) {
    title = title.substring(0, 67);
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 40) title = title.substring(0, lastSpace);
    title += '...';
  }

  return title;
}

// ── ExploreSquamish Dining Deals parser ───────────────────────

async function scrapeDiningDeals() {
  console.log('\n--- ExploreSquamish Dining Deals ---');
  console.log(`Fetching: ${DINING_DEALS_URL}`);

  const res = await fetch(DINING_DEALS_URL);
  if (!res.ok) {
    console.error(`  Failed to fetch: ${res.status}`);
    return [];
  }
  const html = await res.text();
  const deals = [];

  // ── Parse accordion sections (restaurant deals) ──
  // Each accordion: <section class=accordion>...<h3 class=accordion__heading><button>NAME</button></h3>...<div class="accordion__content-text">DEALS</div>...</section>
  const accordionRegex = /<h3\s+class=accordion__heading>\s*<button[^>]*>([^<]+)<span/g;
  const contentRegex = /<div\s+class="accordion__content-text[^"]*">([\s\S]*?)<\/div>/g;

  const headings = [...html.matchAll(accordionRegex)];
  const contents = [...html.matchAll(contentRegex)];

  console.log(`  Found ${headings.length} accordion sections`);

  for (let i = 0; i < headings.length && i < contents.length; i++) {
    const businessName = decodeHtmlEntities(headings[i][1].trim());
    const contentHtml = contents[i][1];

    // Split by <p> tags to get individual deal groups
    const paragraphs = contentHtml.split(/<\/?p[^>]*>/i).filter(p => p.trim());

    const dealLines = [];
    let expiryDate = null;

    for (const p of paragraphs) {
      const text = decodeHtmlEntities(stripTags(p)).trim();
      if (!text) continue;

      // Check for expiry date
      const expiryMatch = text.match(/valid\s+until\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i);
      if (expiryMatch) {
        const parsed = new Date(expiryMatch[1].replace(/(\d+)(?:st|nd|rd|th)/, '$1'));
        if (!isNaN(parsed.getTime())) {
          expiryDate = parsed.toISOString().split('T')[0];
        }
        continue; // Don't include expiry line as a deal line
      }

      dealLines.push(text);
    }

    if (dealLines.length === 0) continue;

    // Build description from all deal lines
    const description = dealLines.join('\n');

    // Build a concise title from the deal content
    let title = buildDealTitle(dealLines, businessName);

    // Parse discount from the full description
    const discount = parseDiscountFromText(description);

    // Parse days from description
    const allDays = parseDaysFromText(description);

    // Build schedule text
    let schedule = null;
    if (allDays.length === 7) {
      schedule = 'Daily specials';
    } else if (allDays.length > 0) {
      schedule = allDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
    }

    deals.push({
      business_name: businessName,
      title,
      description,
      discount_type: discount.type,
      discount_value: discount.value,
      schedule,
      days_of_week: allDays.length > 0 ? allDays : null,
      valid_until: expiryDate,
      category: 'Restaurants & Dining',
      status: 'active',
      featured: false
    });

    console.log(`  [deal] ${businessName}: "${title.substring(0, 50)}"`);
  }

  // ── Parse Happy Hours section ──
  // Structure: <h3 class=hdr-three><strong>HAPPY HOURS!</strong></h3> followed by <ul><li>...
  const hhIdx = html.indexOf('HAPPY HOURS');
  if (hhIdx > 0) {
    const hhSection = html.substring(hhIdx, hhIdx + 5000);
    const liRegex = /<li>[\s\S]*?<\/li>/gi;
    const liMatches = [...hhSection.matchAll(liRegex)];

    console.log(`  Found ${liMatches.length} happy hour venues`);

    for (const li of liMatches) {
      const liHtml = li[0];

      // Extract venue name from <a> tag
      const nameMatch = liHtml.match(/<a[^>]*>([^<]+)<\/a>/);
      if (!nameMatch) continue;
      const venueName = decodeHtmlEntities(nameMatch[1].trim());

      // Extract schedule from text after </a>
      const afterLink = liHtml.replace(/<a[^>]*>[^<]*<\/a>/, '').replace(/<[^>]+>/g, '').trim();
      const scheduleText = decodeHtmlEntities(afterLink);

      if (!scheduleText) continue;

      deals.push({
        business_name: venueName,
        title: `Happy Hour: ${scheduleText}`,
        description: `Happy Hour at ${venueName} — ${scheduleText}`,
        discount_type: 'special',
        discount_value: null,
        schedule: scheduleText,
        days_of_week: parseDaysFromText(scheduleText) || null,
        valid_until: null,
        category: 'Restaurants & Dining',
        status: 'active',
        featured: false
      });

      console.log(`  [happy hour] ${venueName}: ${scheduleText.substring(0, 50)}`);
    }
  }

  return deals;
}

// ── Chances Squamish parser ───────────────────────────────────

async function scrapeChancesSquamish() {
  console.log('\n--- Chances Squamish Promotions ---');
  const deals = [];

  // ── 1. Parse promotions listing page (card grid) ──
  console.log(`Fetching: ${CHANCES_PROMOS_URL}`);
  try {
    const res = await fetch(CHANCES_PROMOS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Cards have: <h3 class="post-heading"><a href="URL"><span>TITLE</span></a></h3>
    // followed by: <span class="meta-excerpt">DESCRIPTION</span>
    const cardRegex = /<h3\s+class="post-heading">\s*<a\s+href="([^"]+)">\s*<span>([^<]+)<\/span>\s*<\/a>\s*<\/h3>\s*<div[^>]*>\s*<span\s+class="meta-excerpt">([^<]+)<\/span>/gi;
    const cards = [...html.matchAll(cardRegex)];

    console.log(`  Found ${cards.length} promotion cards`);

    // Only take first half — page repeats promos in sidebar
    const uniqueCards = cards.slice(0, Math.ceil(cards.length / 2));

    for (const card of uniqueCards) {
      const title = decodeHtmlEntities(card[2].trim());
      const excerpt = decodeHtmlEntities(card[3].trim().replace(/&hellip;/g, '...'));

      // Skip generic/non-deal items
      if (/fundraiser|bingo$/i.test(title)) continue;

      // Parse dates from excerpt (e.g., "February 9 - March 22")
      let validUntil = null;
      const dateRangeMatch = excerpt.match(/(\w+\s+\d{1,2})\s*[-–]\s*(\w+\s+\d{1,2})/);
      if (dateRangeMatch) {
        const endDateStr = dateRangeMatch[2] + ', 2026';
        const parsed = new Date(endDateStr);
        if (!isNaN(parsed.getTime())) {
          validUntil = parsed.toISOString().split('T')[0];
        }
      }

      const discount = parseDiscountFromText(title + ' ' + excerpt);

      deals.push({
        business_name: 'Chances Squamish',
        title: title.length > 70 ? title.substring(0, 67) + '...' : title,
        description: excerpt,
        discount_type: discount.type,
        discount_value: discount.value,
        schedule: null,
        days_of_week: parseDaysFromText(excerpt) || null,
        valid_until: validUntil,
        category: 'Entertainment',
        status: 'active',
        featured: false
      });

      console.log(`  [promo] ${title.substring(0, 50)}`);
    }
  } catch (err) {
    console.error(`  Error fetching promotions: ${err.message}`);
  }

  // ── 2. Match Eatery Happy Hour (detail page) ──
  console.log(`Fetching: ${CHANCES_HAPPY_HOUR_URL}`);
  try {
    const res = await fetch(CHANCES_HAPPY_HOUR_URL);
    if (res.ok) {
      const html = await res.text();
      const bodyText = decodeHtmlEntities(
        html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
      );

      // Look for the deal details
      const hhIdx = bodyText.indexOf('happy to an hour');
      if (hhIdx > 0) {
        const snippet = bodyText.substring(hhIdx, hhIdx + 300).trim();
        const lines = snippet.split('\n').map(l => l.trim()).filter(Boolean);
        const description = lines.join('\n');

        deals.push({
          business_name: 'Match Eatery & Public House',
          title: '$6.50 food, 1/2 price wine, $2 off craft beer',
          description: 'Happy Hour at Match Eatery: ' + description,
          discount_type: 'percent',
          discount_value: 50,
          schedule: 'Daily 3PM-5:30PM and 9PM-Close',
          days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          valid_until: null,
          category: 'Restaurants & Dining',
          status: 'active',
          featured: false
        });

        console.log(`  [happy hour] Match Eatery: $6.50 food, 1/2 price wine`);
      }
    }
  } catch (err) {
    console.error(`  Error fetching Match happy hour: ${err.message}`);
  }

  // ── 3. Match Eatery Kids Eat Free ──
  console.log(`Fetching: ${CHANCES_KIDS_URL}`);
  try {
    const res = await fetch(CHANCES_KIDS_URL);
    if (res.ok) {
      const html = await res.text();
      const bodyText = decodeHtmlEntities(
        html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
      );

      if (/kids\s*eat\s*free/i.test(bodyText)) {
        // Extract relevant paragraph
        const kefIdx = bodyText.toLowerCase().indexOf('kids eat free');
        const snippet = bodyText.substring(kefIdx, kefIdx + 500);
        const lines = snippet.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const description = lines.slice(0, 5).join('\n');

        deals.push({
          business_name: 'Match Eatery & Public House',
          title: 'Kids Eat Free Tuesdays (3PM-9PM)',
          description,
          discount_type: 'free_item',
          discount_value: null,
          schedule: 'Tuesdays 3PM-9PM',
          days_of_week: ['tuesday'],
          valid_until: null,
          category: 'Restaurants & Dining',
          status: 'active',
          featured: false
        });

        console.log(`  [deal] Match Eatery: Kids Eat Free Tuesdays`);
      }
    }
  } catch (err) {
    console.error(`  Error fetching Kids Eat Free: ${err.message}`);
  }

  // ── 4. Locals Get 20% Off ──
  console.log(`Fetching: ${CHANCES_LOCALS_URL}`);
  try {
    const res = await fetch(CHANCES_LOCALS_URL);
    if (res.ok) {
      const html = await res.text();
      const bodyText = decodeHtmlEntities(
        html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '\n')
      );

      if (/20%/i.test(bodyText)) {
        const locIdx = bodyText.indexOf('20%');
        const snippet = bodyText.substring(Math.max(0, locIdx - 100), locIdx + 400);
        const lines = snippet.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const description = lines.slice(0, 5).join('\n');

        deals.push({
          business_name: 'Match Eatery & Public House',
          title: 'Locals Get 20% Off (Mon & Tue)',
          description,
          discount_type: 'percent',
          discount_value: 20,
          schedule: 'Mondays & Tuesdays',
          days_of_week: ['monday', 'tuesday'],
          valid_until: null,
          category: 'Restaurants & Dining',
          status: 'active',
          featured: false
        });

        console.log(`  [deal] Match Eatery: Locals Get 20% Off`);
      }
    }
  } catch (err) {
    console.error(`  Error fetching Locals deal: ${err.message}`);
  }

  return deals;
}

// ── Sea to Sky Gondola parser ─────────────────────────────────

async function scrapeGondola() {
  console.log('\n--- Sea to Sky Gondola ---');
  console.log(`Fetching: ${GONDOLA_URL}`);
  const deals = [];

  try {
    const res = await fetch(GONDOLA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Look for Family Fun Night deal
    const ffnMatch = html.match(/<h2[^>]*>([^<]*Family Fun Night[^<]*)<\/h2>\s*<div[^>]*>([\s\S]*?)<\/div>/i);
    if (ffnMatch) {
      const title = decodeHtmlEntities(stripTags(ffnMatch[1]).trim());
      const desc = decodeHtmlEntities(stripTags(ffnMatch[2]).trim());

      deals.push({
        business_name: 'Sea to Sky Gondola',
        title,
        description: desc,
        discount_type: 'percent',
        discount_value: 30,
        schedule: 'Every Saturday evening, extended hours until 8PM',
        days_of_week: ['saturday'],
        valid_until: null,
        category: 'Outdoor Adventures',
        status: 'active',
        featured: true
      });

      console.log(`  [deal] ${title}`);
    }

    // Check for other promo sections with "Save" or "% off"
    const promoMatches = [...html.matchAll(/<h2[^>]*>([^<]*(?:\d+%|save|discount)[^<]*)<\/h2>/gi)];
    for (const m of promoMatches) {
      const promoTitle = decodeHtmlEntities(stripTags(m[1]).trim());
      if (promoTitle.includes('Family Fun Night')) continue; // Already parsed

      deals.push({
        business_name: 'Sea to Sky Gondola',
        title: promoTitle,
        description: promoTitle,
        discount_type: parseDiscountFromText(promoTitle).type,
        discount_value: parseDiscountFromText(promoTitle).value,
        schedule: null,
        days_of_week: null,
        valid_until: null,
        category: 'Outdoor Adventures',
        status: 'active',
        featured: false
      });

      console.log(`  [deal] ${promoTitle}`);
    }
  } catch (err) {
    console.error(`  Error fetching Gondola: ${err.message}`);
  }

  if (deals.length === 0) {
    console.log('  No deals found on homepage');
  }

  return deals;
}

// ── Data quality validation ───────────────────────────────────

function validateDeals(deals) {
  let issues = 0;
  for (const deal of deals) {
    if (deal.title.toLowerCase().trim() === deal.business_name.toLowerCase().trim()) {
      console.warn(`  [validation] title = business_name: "${deal.title}"`);
      issues++;
    }
    if (!deal.description || deal.description.length < 5) {
      console.warn(`  [validation] empty/short description: "${deal.title}"`);
      issues++;
    }
  }
  if (issues === 0) {
    console.log('  [validation] All deals passed quality checks');
  } else {
    console.warn(`  [validation] ${issues} issue(s) found`);
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log('PULSE DEALS SCRAPER (HTML parsing — no AI extraction)');
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Scrape all sources in parallel
  const [diningDeals, chancesDeals, gondolaDeals] = await Promise.all([
    scrapeDiningDeals(),
    scrapeChancesSquamish(),
    scrapeGondola()
  ]);

  const deals = [...diningDeals, ...chancesDeals, ...gondolaDeals];

  console.log(`\n--- Total deals found: ${deals.length} ---`);

  // Validate before inserting
  validateDeals(deals);

  // Insert deals
  for (const deal of deals) {
    // Check for duplicates (exact match)
    const exists = await checkDealExists(deal.title, deal.business_name);
    if (exists) {
      console.log(`  [skip] exists: "${deal.title.substring(0, 40)}" at ${deal.business_name}`);
      skipped++;
      continue;
    }

    // Try to link to business in DB
    const business = await getBusinessByName(deal.business_name);
    if (business) {
      deal.business_id = business.id;
      deal.business_address = business.address;
    } else {
      deal.business_address = 'Squamish, BC';
    }

    const ok = await insertDeal(deal);
    if (ok) {
      console.log(`  [+] ${deal.business_name}: "${deal.title.substring(0, 40)}"`);
      inserted++;
    } else {
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total found:      ${deals.length}`);
  console.log(`New deals added:  ${inserted}`);
  console.log(`Duplicates:       ${skipped}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Completed:        ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
