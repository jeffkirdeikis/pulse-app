#!/usr/bin/env node

/**
 * Find 10 dead URLs to show the user
 */

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
  // Get businesses with websites
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?select=name,website&website=not.is.null&limit=300`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  const businesses = await resp.json();

  console.log(`Checking ${businesses.length} businesses for dead URLs...\n`);

  const deadUrls = [];

  for (const biz of businesses) {
    if (deadUrls.length >= 10) break;

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
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
      });

      clearTimeout(timeout);
      // If we get here, it's alive - don't add
    } catch (e) {
      const code = e.cause?.code || '';
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ENOENT') {
        deadUrls.push({ name: biz.name, url: url, reason: 'DNS does not resolve' });
        console.log(`DEAD: ${biz.name} - ${url}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('10 DEAD URLs - DNS does not resolve');
  console.log('Try them yourself in your browser:');
  console.log('='.repeat(60) + '\n');

  deadUrls.forEach((d, i) => {
    console.log(`${i + 1}. ${d.name}`);
    console.log(`   ${d.url}`);
    console.log('');
  });
}

main().catch(console.error);
