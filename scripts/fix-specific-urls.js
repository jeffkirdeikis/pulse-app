#!/usr/bin/env node

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// Corrections for known bad URLs
const corrections = [
  { search: '%alice%brohm%', newUrl: 'https://www.aliceandbrohm.com' },
  { search: '%arrow%wood%', newUrl: 'https://arrowwoodgames.com' },
  { search: '%awesome%hair%', newUrl: null }, // Will search
  { search: '%billies%house%', newUrl: null },
  { search: '%body%storm%', newUrl: null },
  { search: '%blownaway%', newUrl: null },
  { search: '%brackendale%farm%', newUrl: null },
  { search: '%break%chain%', newUrl: null },
  { search: '%canadian%coastal%', newUrl: null },
  { search: '%chief%car%wash%', newUrl: null },
];

async function updateUrl(search, newUrl) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/businesses?name=ilike.${encodeURIComponent(search)}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ website: newUrl })
    }
  );
  return resp.json();
}

async function main() {
  console.log('Fixing URLs...\n');

  for (const { search, newUrl } of corrections) {
    if (newUrl) {
      const result = await updateUrl(search, newUrl);
      if (Array.isArray(result) && result.length > 0) {
        console.log(`✅ Fixed: ${result[0].name} → ${newUrl}`);
      } else {
        console.log(`❓ No match for: ${search}`);
      }
    }
  }
}

main().catch(console.error);
