#!/usr/bin/env node

/**
 * Automated Fitness Studio Discovery Pipeline
 *
 * Queries fitness businesses from the database, visits their websites,
 * detects booking systems using PROVIDER_SIGNATURES patterns, extracts
 * widget/studio IDs, and upserts discoveries into scraping_sources table.
 *
 * Usage:
 *   node scripts/discover-fitness-studios.js              # Full discovery
 *   node scripts/discover-fitness-studios.js --dry-run     # Detect without inserting
 *   node scripts/discover-fitness-studios.js --limit 10    # Test with 10 businesses
 *
 * Runs weekly via GitHub Actions (HTTP-only, no Puppeteer needed).
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';
import { PROVIDER_SIGNATURES, fetchWithTimeout } from './lib/provider-detector.js';
import { sendTelegramAlert } from './lib/alerting.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// ============================================================
// CLI FLAGS
// ============================================================

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX !== -1 ? parseInt(args[LIMIT_IDX + 1], 10) : 0;

// ============================================================
// CONSTANTS
// ============================================================

const FITNESS_CATEGORIES = [
  'Fitness',
  'Yoga & Pilates',
  'Martial Arts',
  'Recreation',
  'Wellness',
  'Health & Wellness'
];

const SCHEDULE_SUBPAGES = ['/schedule', '/classes', '/book', '/events'];

const FETCH_TIMEOUT_MS = 10000;
const DELAY_BETWEEN_FETCHES_MS = 1000;
const PAUSE_EVERY_N = 10;
const PAUSE_DURATION_MS = 5000;

// ============================================================
// DATABASE QUERIES
// ============================================================

/**
 * Fetch fitness businesses with websites from the businesses table.
 */
async function getFitnessBusinesses() {
  // Build OR filter for fitness categories using ilike
  // PostgREST uses * as wildcard alias for % (avoids URL encoding issues)
  const categoryFilters = FITNESS_CATEGORIES
    .map(cat => `category.ilike.*${cat}*`)
    .join(',');

  const filterParam = encodeURIComponent(`(${categoryFilters})`);
  const url = `${SUPABASE_URL}/rest/v1/businesses?or=${filterParam}&website=not.is.null&select=id,name,category,website&order=name`;

  const resp = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch businesses: ${resp.status} ${await resp.text()}`);
  }

  return resp.json();
}

/**
 * Fetch existing scraping sources to skip already-covered businesses.
 * Returns a Set of lowercase business names and a Set of business_ids.
 */
async function getExistingSourceNames() {
  const url = `${SUPABASE_URL}/rest/v1/scraping_sources?is_active=eq.true&select=name,business_id,booking_system`;

  const resp = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!resp.ok) {
    console.warn('Could not fetch existing sources, will proceed without dedup');
    return { names: new Set(), businessIds: new Set() };
  }

  const sources = await resp.json();
  const names = new Set(sources.map(s => s.name.toLowerCase()));
  const businessIds = new Set(sources.filter(s => s.business_id).map(s => s.business_id));

  return { names, businessIds };
}

// ============================================================
// WEBSITE SCANNING
// ============================================================

/**
 * Scan a business website (and schedule subpages) for booking system signatures.
 * Returns array of detections.
 */
async function scanBusinessWebsite(business) {
  const detections = [];
  const baseUrl = business.website.replace(/\/$/, '');

  // Build list of URLs to scan
  const urls = [baseUrl];
  for (const subpage of SCHEDULE_SUBPAGES) {
    urls.push(baseUrl + subpage);
  }

  for (const url of urls) {
    let html;
    try {
      const resp = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (!resp.ok) continue;
      html = await resp.text();
    } catch {
      continue; // URL fetch failed, try next
    }

    // Check each provider's patterns
    for (const [systemKey, provider] of Object.entries(PROVIDER_SIGNATURES)) {
      // Skip if we already detected this system for this business
      if (detections.find(d => d.system === systemKey)) continue;

      let bestSlug = null;
      let matched = false;

      for (const pattern of provider.htmlPatterns) {
        const match = html.match(pattern) || url.match(pattern);
        if (match) {
          matched = true;
          const slug = provider.extractSlug(match);
          if (slug && !bestSlug) bestSlug = slug;
        }
      }

      if (matched) {
        detections.push({
          system: systemKey,
          name: provider.name,
          slug: bestSlug,
          detectedOnUrl: url,
          probeSuccess: false,
          probeData: null
        });
      }
    }

    // Rate limit between fetches
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_FETCHES_MS));
  }

  // Run API probes for detections that support them
  for (const detection of detections) {
    const provider = PROVIDER_SIGNATURES[detection.system];
    if (provider.probe && detection.slug) {
      try {
        const probeResult = await provider.probe(detection.slug);
        if (probeResult) {
          detection.probeSuccess = true;
          detection.probeData = probeResult;
        }
      } catch {
        // Probe failed, keep detection but without probe confirmation
      }
    }
  }

  return detections;
}

// ============================================================
// DATABASE UPSERT
// ============================================================

/**
 * Upsert a discovered source into the scraping_sources table.
 */
async function upsertDiscoveredSource(business, detection) {
  const priority = detection.probeSuccess ? 8 : 7;

  const record = {
    business_id: business.id,
    name: business.name,
    booking_system: detection.system,
    widget_id: detection.probeData?.widget_id || null,
    studio_id: detection.probeData?.studio_id || detection.slug || null,
    url: business.website,
    schedule_url: detection.detectedOnUrl !== business.website ? detection.detectedOnUrl : null,
    address: null, // Not available from businesses table query
    category: business.category,
    priority,
    is_active: true,
    verified: false,
    notes: `Auto-discovered ${detection.name} on ${detection.detectedOnUrl}. Probe: ${detection.probeSuccess ? 'passed' : 'not available'}.`,
    updated_at: new Date().toISOString()
  };

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/scraping_sources`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(record)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Upsert failed for ${business.name}: ${err}`);
  }

  return record;
}

// ============================================================
// MAIN PIPELINE
// ============================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 FITNESS STUDIO DISCOVERY PIPELINE');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}`);
  if (DRY_RUN) console.log('Mode: DRY RUN (no database writes)');
  if (LIMIT) console.log(`Limit: ${LIMIT} businesses`);
  console.log('='.repeat(70));

  // Step 1: Fetch fitness businesses
  console.log('\n📋 Fetching fitness businesses from database...');
  const allBusinesses = await getFitnessBusinesses();
  console.log(`   Found ${allBusinesses.length} fitness businesses with websites`);

  // Step 2: Get existing sources to skip
  console.log('\n📋 Checking existing scraping sources...');
  const { names: existingNames, businessIds: existingIds } = await getExistingSourceNames();
  console.log(`   ${existingNames.size} sources already in scraping pipeline`);

  // Step 3: Filter to uncovered businesses
  const uncovered = allBusinesses.filter(b => {
    if (existingIds.has(b.id)) return false;
    if (existingNames.has(b.name.toLowerCase())) return false;
    return true;
  });
  console.log(`   ${uncovered.length} businesses not yet covered`);

  // Apply limit
  const toScan = LIMIT ? uncovered.slice(0, LIMIT) : uncovered;
  if (LIMIT) console.log(`   Scanning ${toScan.length} (limited from ${uncovered.length})`);

  // Step 4: Scan each business
  const stats = {
    scanned: 0,
    detected: 0,
    probed: 0,
    inserted: 0,
    errors: [],
    discoveries: []
  };

  console.log('\n🔍 Scanning business websites...\n');

  for (let i = 0; i < toScan.length; i++) {
    const business = toScan[i];
    stats.scanned++;

    // Progress indicator
    const progress = `[${i + 1}/${toScan.length}]`;
    process.stdout.write(`${progress} ${business.name} — `);

    try {
      const detections = await scanBusinessWebsite(business);

      if (detections.length === 0) {
        console.log('no booking system detected');
        continue;
      }

      // Use the best detection (prefer probed ones)
      const best = detections.find(d => d.probeSuccess) || detections[0];
      stats.detected++;

      if (best.probeSuccess) {
        stats.probed++;
        console.log(`✅ ${best.name} (${best.slug}) — probe PASSED`);
      } else {
        console.log(`🔶 ${best.name} (${best.slug || 'no ID'}) — HTML match only`);
      }

      stats.discoveries.push({
        business: business.name,
        system: best.system,
        slug: best.slug,
        probed: best.probeSuccess,
        url: best.detectedOnUrl
      });

      // Insert into database (unless dry run)
      if (!DRY_RUN) {
        try {
          await upsertDiscoveredSource(business, best);
          stats.inserted++;
        } catch (err) {
          stats.errors.push({ business: business.name, error: err.message });
          console.log(`      ❌ Insert failed: ${err.message}`);
        }
      }
    } catch (err) {
      console.log(`error: ${err.message}`);
      stats.errors.push({ business: business.name, error: err.message });
    }

    // Pause every N businesses to avoid rate limiting
    if (i > 0 && i % PAUSE_EVERY_N === 0) {
      console.log(`   ⏸  Pausing ${PAUSE_DURATION_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, PAUSE_DURATION_MS));
    }
  }

  // Step 5: Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 DISCOVERY SUMMARY');
  console.log('='.repeat(70));
  console.log(`Scanned:    ${stats.scanned} businesses`);
  console.log(`Detected:   ${stats.detected} booking systems`);
  console.log(`Probed:     ${stats.probed} API-verified`);
  console.log(`Inserted:   ${DRY_RUN ? '0 (dry run)' : stats.inserted}`);
  console.log(`Errors:     ${stats.errors.length}`);

  if (stats.discoveries.length > 0) {
    console.log('\n🎯 Discoveries:');
    for (const d of stats.discoveries) {
      const icon = d.probed ? '✅' : '🔶';
      console.log(`   ${icon} ${d.business} → ${d.system} (${d.slug || 'no ID'}) on ${d.url}`);
    }
  }

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    for (const e of stats.errors) {
      console.log(`   • ${e.business}: ${e.error}`);
    }
  }

  console.log(`\nCompleted: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));

  // Step 6: Send Telegram alert if discoveries found
  if (stats.discoveries.length > 0 && !DRY_RUN) {
    const lines = [`🔍 Studio Discovery: ${stats.detected} booking systems found`];
    lines.push(`Scanned: ${stats.scanned} | Verified: ${stats.probed} | Inserted: ${stats.inserted}`);
    lines.push('');
    for (const d of stats.discoveries.slice(0, 15)) {
      const icon = d.probed ? '✅' : '🔶';
      lines.push(`${icon} ${d.business} → ${d.system}`);
    }
    if (stats.discoveries.length > 15) {
      lines.push(`... and ${stats.discoveries.length - 15} more`);
    }
    await sendTelegramAlert(lines.join('\n'));
  }
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
