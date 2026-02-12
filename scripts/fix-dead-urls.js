#!/usr/bin/env node

/**
 * Fix Dead URLs
 * For businesses with broken URLs, search for the correct website and update
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

async function searchGoogle(businessName, location = 'Squamish BC') {
  const query = encodeURIComponent(`${businessName} ${location} official website`);

  try {
    // Use a simple approach - check common domain variations
    const baseName = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/squamish|bc|the/g, '');

    // Common domain patterns to try
    const variations = [
      `https://${baseName}.com`,
      `https://www.${baseName}.com`,
      `https://${baseName}.ca`,
      `https://www.${baseName}.ca`,
    ];

    for (const url of variations) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const resp = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });

        clearTimeout(timeout);

        if (resp.ok) {
          return resp.url; // Return final URL after redirects
        }
      } catch (e) {
        // Try next variation
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function getDeadUrls() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?select=id,name,website&website=not.is.null&limit=500`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const businesses = await resp.json();

  const deadUrls = [];

  for (const biz of businesses) {
    let url = biz.website;
    if (url && url.startsWith('http') === false) {
      url = 'https://' + url;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      clearTimeout(timeout);
    } catch (e) {
      const code = e.cause?.code || '';
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENOENT') {
        deadUrls.push({ id: biz.id, name: biz.name, oldUrl: url });
      }
    }
  }

  return deadUrls;
}

async function updateBusinessUrl(id, newUrl) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ website: newUrl })
    }
  );
  return resp.ok;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 DEAD URL FIXER');
  console.log('Finding correct URLs for businesses with broken websites');
  console.log('='.repeat(60) + '\n');

  console.log('📊 Finding dead URLs...');
  const deadUrls = await getDeadUrls();
  console.log(`   Found ${deadUrls.length} businesses with dead URLs\n`);

  let fixed = 0;
  let notFound = 0;

  for (const { id, name, oldUrl } of deadUrls) {
    process.stdout.write(`🔍 ${name.substring(0, 35).padEnd(35)} `);

    const newUrl = await searchGoogle(name);

    if (newUrl && newUrl !== oldUrl) {
      const updated = await updateBusinessUrl(id, newUrl);
      if (updated) {
        console.log(`✅ ${newUrl}`);
        fixed++;
      } else {
        console.log(`❌ Failed to update`);
      }
    } else {
      console.log(`❓ No alternative found`);
      notFound++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Dead URLs found:    ${deadUrls.length}`);
  console.log(`   Fixed:              ${fixed}`);
  console.log(`   No alternative:     ${notFound}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
