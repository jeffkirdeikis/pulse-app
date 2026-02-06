#!/usr/bin/env node
/**
 * Jane Discover Supplementary Scraper
 *
 * Jane App's beta product at discover.jane.app was piloted in Squamish.
 * This scraper captures aggregated availability data as a supplementary source.
 *
 * Strategy:
 * 1. Visit discover.jane.app
 * 2. Search for Squamish wellness providers
 * 3. Intercept API responses with aggregated availability
 * 4. Write to Supabase as a secondary data source
 */

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DISCIPLINES = ['Massage Therapy', 'Physiotherapy', 'Chiropractic', 'Acupuncture'];

async function scrapeJaneDiscover() {
  const startTime = Date.now();
  console.log('🔍 Jane Discover Scraper');
  console.log(`📅 ${new Date().toISOString()}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Collect all API responses
  const apiData = [];

  page.on('response', async (response) => {
    const url = response.url();
    try {
      if (response.status() === 200) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json') && (
          url.includes('api') || url.includes('graphql') || url.includes('discover') ||
          url.includes('search') || url.includes('availability') || url.includes('practitioners')
        )) {
          const json = await response.json();
          apiData.push({ url, data: json });
        }
      }
    } catch {
      // Skip non-JSON or already-consumed responses
    }
  });

  const allResults = [];

  try {
    console.log('🌐 Navigating to discover.jane.app...');
    await page.goto('https://discover.jane.app/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for the page to fully render
    await new Promise(r => setTimeout(r, 3000));

    // Try to set location to Squamish
    console.log('📍 Setting location to Squamish, BC...');
    const locationInput = await page.$(
      'input[placeholder*="location"], input[placeholder*="Location"], input[placeholder*="city"], input[type="search"], input[placeholder*="search"]'
    );

    if (locationInput) {
      await locationInput.click({ clickCount: 3 }); // Select all existing text
      await locationInput.type('Squamish, BC', { delay: 50 });
      await new Promise(r => setTimeout(r, 1500));

      // Try to select from autocomplete dropdown
      const autocompleteItem = await page.$(
        '[class*="autocomplete"] li, [class*="suggestion"], [class*="dropdown"] [class*="item"], [role="option"]'
      );
      if (autocompleteItem) {
        await autocompleteItem.click();
      } else {
        await page.keyboard.press('Enter');
      }
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log('  ⚠️ Could not find location input');
    }

    // For each discipline, search and collect results
    for (const discipline of DISCIPLINES) {
      console.log(`\n🔎 Searching for ${discipline}...`);

      // Try to find and click discipline filter
      const filterBtn = await page.evaluateHandle((disc) => {
        const buttons = Array.from(document.querySelectorAll('button, a, [role="tab"], [class*="filter"]'));
        return buttons.find(el => {
          const text = el.textContent.toLowerCase();
          return text.includes(disc.toLowerCase()) || text.includes(disc.split(' ')[0].toLowerCase());
        });
      }, discipline);

      if (filterBtn && filterBtn.asElement()) {
        await filterBtn.asElement().click();
        await new Promise(r => setTimeout(r, 2000));
      }

      // Extract visible practitioner results
      const results = await page.evaluate((disc) => {
        const practitioners = [];
        const cards = document.querySelectorAll(
          '[class*="practitioner"], [class*="result"], [class*="card"], [class*="listing"]'
        );

        cards.forEach(card => {
          const name = card.querySelector('[class*="name"], h2, h3, h4')?.textContent?.trim();
          const clinic = card.querySelector('[class*="clinic"], [class*="practice"], [class*="location"]')?.textContent?.trim();
          const availText = card.querySelector('[class*="availability"], [class*="next"], [class*="open"]')?.textContent?.trim();
          const link = card.querySelector('a[href*="jane"]')?.href;

          if (name) {
            practitioners.push({
              name,
              clinic: clinic || null,
              discipline: disc,
              availabilityText: availText || null,
              bookingUrl: link || null,
            });
          }
        });

        return practitioners;
      }, discipline);

      console.log(`  Found ${results.length} practitioners`);
      allResults.push(...results);
    }

    // Also parse any captured API data
    console.log(`\n📡 Captured ${apiData.length} API responses`);

    for (const resp of apiData) {
      try {
        const data = resp.data;

        // Try various API response shapes
        const items = data?.practitioners || data?.results || data?.data?.practitioners || data?.data?.results;
        if (Array.isArray(items)) {
          for (const item of items) {
            allResults.push({
              name: item.name || item.practitioner_name || `${item.first_name} ${item.last_name}`,
              clinic: item.clinic_name || item.practice_name || item.location,
              discipline: item.discipline || item.specialty || 'Unknown',
              availabilityText: item.next_available || item.availability_summary || null,
              bookingUrl: item.booking_url || item.url || null,
              // If the API gives us actual slots, capture them
              slots: item.available_slots || item.openings || null,
            });
          }
        }
      } catch {
        // Skip malformed data
      }
    }

    // Log success
    await supabase.from('pulse_scrape_log').insert({
      provider_slug: 'jane-discover',
      source: 'jane_discover',
      status: allResults.length > 0 ? 'success' : 'no_data',
      slots_found: allResults.length,
      duration_ms: Date.now() - startTime,
    });

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    await supabase.from('pulse_scrape_log').insert({
      provider_slug: 'jane-discover',
      source: 'jane_discover',
      status: 'error',
      error_message: error.message.slice(0, 500),
      duration_ms: Date.now() - startTime,
    });
  } finally {
    await browser.close();
  }

  // Process results - try to match to existing providers
  if (allResults.length > 0) {
    console.log('\n📋 Processing results...');

    const { data: providers } = await supabase
      .from('pulse_wellness_providers')
      .select('id, name, clinic_name, janeapp_slug')
      .eq('is_active', true);

    const providersByClinic = {};
    if (providers) {
      for (const p of providers) {
        const key = p.clinic_name.toLowerCase();
        if (!providersByClinic[key]) providersByClinic[key] = [];
        providersByClinic[key].push(p);
      }
    }

    let matched = 0;
    for (const result of allResults) {
      // Try to match by clinic name
      if (result.clinic) {
        const key = result.clinic.toLowerCase();
        const matches = providersByClinic[key];
        if (matches && matches.length > 0) {
          matched++;
          console.log(`  ✅ Matched: ${result.name} at ${result.clinic}`);
        } else {
          console.log(`  ❓ New provider: ${result.name} at ${result.clinic || 'Unknown'}`);
        }
      }

      // If we have actual slot data from API, insert it
      if (result.slots && Array.isArray(result.slots)) {
        // TODO: Parse and insert slots with 'jane_discover' source tag
        console.log(`  📅 Has ${result.slots.length} available slots`);
      }
    }

    console.log(`\n📊 Matched ${matched}/${allResults.length} to existing providers`);
  }

  console.log(`\n✅ Jane Discover scrape complete (${Date.now() - startTime}ms)`);
  console.log(`  Total practitioners found: ${allResults.length}`);
}

scrapeJaneDiscover().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
