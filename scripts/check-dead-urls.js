#!/usr/bin/env node

/**
 * Dead URL Checker
 * Scans all businesses and identifies those with broken/dead websites
 * Updates the database to flag them
 *
 * Run: node scripts/check-dead-urls.js
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

const stats = {
  total: 0,
  alive: 0,
  dead: 0,
  redirected: 0,
  errors: []
};

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (response.ok) {
      // Check if redirected to a different domain
      const finalUrl = response.url;
      const originalDomain = new URL(url).hostname.replace('www.', '');
      const finalDomain = new URL(finalUrl).hostname.replace('www.', '');

      if (originalDomain !== finalDomain) {
        return { status: 'redirected', finalUrl, code: response.status };
      }
      return { status: 'alive', code: response.status };
    } else {
      return { status: 'dead', code: response.status };
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      return { status: 'dead', error: 'timeout' };
    }
    if (e.message.includes('ENOTFOUND') || e.message.includes('ERR_NAME_NOT_RESOLVED')) {
      return { status: 'dead', error: 'dns_failed' };
    }
    if (e.message.includes('ECONNREFUSED')) {
      return { status: 'dead', error: 'connection_refused' };
    }
    return { status: 'dead', error: e.message.substring(0, 50) };
  }
}

async function getBusinesses() {
  const allBusinesses = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/businesses?select=id,name,website&website=not.is.null&order=name&offset=${offset}&limit=${limit}`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await response.json();
    if (!data || data.length === 0) break;
    allBusinesses.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return allBusinesses;
}

async function updateBusinessWebsiteStatus(businessId, status, notes) {
  // Add website_status column if tracking (or just log for now)
  // For now, we'll just output the results
  return true;
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 DEAD URL CHECKER');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  const businesses = await getBusinesses();
  console.log(`📊 Total businesses with websites: ${businesses.length}\n`);

  stats.total = businesses.length;

  const deadUrls = [];
  const redirectedUrls = [];

  // Process in batches of 20 concurrent requests
  const batchSize = 20;

  for (let i = 0; i < businesses.length; i += batchSize) {
    const batch = businesses.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (biz) => {
        const result = await checkUrl(biz.website);
        return { ...biz, result };
      })
    );

    for (const { id, name, website, result } of results) {
      const shortName = name.substring(0, 35).padEnd(35);

      if (result.status === 'alive') {
        stats.alive++;
        // Don't print alive URLs to reduce noise
      } else if (result.status === 'redirected') {
        stats.redirected++;
        console.log(`🔀 ${shortName} → ${result.finalUrl.substring(0, 40)}`);
        redirectedUrls.push({ id, name, website, newUrl: result.finalUrl });
      } else {
        stats.dead++;
        console.log(`❌ ${shortName} ${result.error || result.code || 'failed'}`);
        deadUrls.push({ id, name, website, error: result.error || result.code });
      }
    }

    // Progress update
    const processed = Math.min(i + batchSize, businesses.length);
    if (processed % 100 === 0 || processed === businesses.length) {
      console.log(`\n📊 Progress: ${processed}/${businesses.length} (${stats.alive} alive, ${stats.dead} dead, ${stats.redirected} redirected)\n`);
    }
  }

  // Final report
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(70));
  console.log(`
   Total businesses:    ${stats.total}
   ✅ Alive:            ${stats.alive} (${Math.round(stats.alive/stats.total*100)}%)
   ❌ Dead:             ${stats.dead} (${Math.round(stats.dead/stats.total*100)}%)
   🔀 Redirected:       ${stats.redirected} (${Math.round(stats.redirected/stats.total*100)}%)
`);

  // Output dead URLs for cleanup
  if (deadUrls.length > 0) {
    console.log('\n📋 DEAD URLs (need cleanup):');
    console.log('-'.repeat(70));
    deadUrls.forEach(({ name, website, error }) => {
      console.log(`   ${name}`);
      console.log(`      ${website}`);
      console.log(`      Error: ${error}`);
    });
  }

  // Output SQL to clear dead URLs
  if (deadUrls.length > 0) {
    console.log('\n\n📝 SQL to clear dead URLs:');
    console.log('-'.repeat(70));
    console.log(`-- Clear ${deadUrls.length} dead website URLs`);
    console.log(`UPDATE businesses SET website = NULL WHERE id IN (`);
    console.log(deadUrls.map(d => `  '${d.id}'`).join(',\n'));
    console.log(`);`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(70));
}

main().catch(console.error);
