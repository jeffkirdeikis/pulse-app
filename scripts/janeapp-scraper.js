#!/usr/bin/env node
/**
 * JaneApp Availability Scraper for Pulse Wellness Booking
 *
 * Scrapes availability from confirmed Squamish JaneApp clinics by:
 * 1. Visiting each clinic's JaneApp booking page
 * 2. Intercepting XHR/fetch responses to capture availability API calls
 * 3. Falling back to DOM scraping if API interception doesn't yield data
 * 4. Writing results to Supabase pulse_availability_slots
 * 5. Logging each scrape attempt to pulse_scrape_log
 *
 * Rate limits: 3 seconds between page loads, runs every 30 minutes
 */

const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key for full access
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Confirmed JaneApp clinics in Squamish
const CLINICS = [
  { slug: 'seatoskymassage', name: 'Sea to Sky Massage Therapy' },
  { slug: 'squamish', name: 'Shift Wellness' },
  { slug: 'bliss', name: 'Bliss Massage Therapy' },
  { slug: 'constellationwellness', name: 'Constellation Wellness' },
  { slug: 'livwellsquamish', name: 'LivWell Integrated Health' },
  { slug: 'emilycostamassage', name: 'Emily Costa RMT' },
  { slug: 'kaylayoungwellness', name: 'Kayla Young Wellness' },
];

/**
 * Scrape a single JaneApp clinic's booking page
 */
async function scrapeClinic(browser, clinic) {
  const startTime = Date.now();
  const page = await browser.newPage();
  const slots = [];
  const apiResponses = [];

  try {
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Intercept XHR/fetch responses to capture availability API data
    page.on('response', async (response) => {
      const url = response.url();
      try {
        // JaneApp uses internal API endpoints for availability
        if (
          (url.includes('/api/') || url.includes('openings') || url.includes('availability') || url.includes('schedule') || url.includes('slots')) &&
          response.status() === 200
        ) {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const json = await response.json();
            apiResponses.push({ url, data: json });
          }
        }
      } catch {
        // Response wasn't JSON or already consumed, skip
      }
    });

    // Navigate to the booking page
    const bookingUrl = `https://${clinic.slug}.janeapp.com`;
    console.log(`  Visiting ${bookingUrl}...`);

    await page.goto(bookingUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for page content to load
    await page.waitForTimeout(2000);

    // Strategy 1: Look for treatment/service links
    const treatmentLinks = await page.evaluate(() => {
      const links = [];
      // JaneApp uses various selectors for treatment categories
      const selectors = [
        'a[href*="treatment"]',
        'a[href*="service"]',
        '[class*="treatment"] a',
        '[class*="service"] a',
        '[class*="category"] a',
        '.booking-category a',
        '.service-list a',
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach(el => {
          const text = el.textContent.toLowerCase().trim();
          const href = el.href;
          // Look for wellness-related treatments
          if (
            text.includes('massage') || text.includes('rmt') || text.includes('therapeutic') ||
            text.includes('physio') || text.includes('chiro') || text.includes('acupuncture') ||
            text.includes('osteo') || text.includes('naturo') ||
            text.includes('60 min') || text.includes('90 min') || text.includes('30 min')
          ) {
            links.push({ href, text: el.textContent.trim() });
          }
        });
      }

      // Also try broader selectors if nothing specific found
      if (links.length === 0) {
        document.querySelectorAll('a').forEach(el => {
          const text = el.textContent.toLowerCase().trim();
          if (
            (text.includes('massage') || text.includes('book') || text.includes('appointment')) &&
            el.href && el.href.includes(window.location.hostname)
          ) {
            links.push({ href: el.href, text: el.textContent.trim() });
          }
        });
      }

      return links;
    });

    console.log(`  Found ${treatmentLinks.length} treatment links`);

    // Navigate to treatment pages and scrape availability
    for (const treatment of treatmentLinks.slice(0, 8)) {
      try {
        await page.goto(treatment.href, {
          waitUntil: 'networkidle2',
          timeout: 20000,
        });
        await page.waitForTimeout(1500);

        // Extract available time slots from the page
        const pageSlots = await page.evaluate(() => {
          const results = [];

          // JaneApp renders available times as clickable elements
          const slotSelectors = [
            '[class*="time-slot"]',
            '[class*="opening"]',
            '[class*="available"]',
            'button[class*="slot"]',
            '[class*="time"] button',
            '[data-time]',
            '.schedule-slot',
            '.availability-slot',
          ];

          for (const selector of slotSelectors) {
            document.querySelectorAll(selector).forEach(el => {
              const text = el.textContent.trim();
              const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/);

              if (timeMatch) {
                let hour = parseInt(timeMatch[1]);
                const minute = parseInt(timeMatch[2] || '0');
                const period = timeMatch[3].toLowerCase();
                if (period === 'pm' && hour !== 12) hour += 12;
                if (period === 'am' && hour === 12) hour = 0;

                // Try to find the associated date
                const dateEl = el.closest('[data-date]');
                const dateAttr = dateEl?.getAttribute('data-date');

                // Try to find practitioner name
                const practSection = el.closest('[class*="practitioner"], [class*="staff"], [class*="provider"]');
                const practName = practSection?.querySelector('[class*="name"]')?.textContent?.trim();

                results.push({
                  date: dateAttr || null,
                  hour,
                  minute,
                  practitioner: practName || null,
                  text: text,
                });
              }
            });
          }

          return results;
        });

        // Detect duration from treatment name
        let durationMinutes = 60; // default
        const treatmentLower = treatment.text.toLowerCase();
        if (treatmentLower.includes('90') || treatmentLower.includes('1.5 hour')) durationMinutes = 90;
        else if (treatmentLower.includes('30') || treatmentLower.includes('half hour')) durationMinutes = 30;
        else if (treatmentLower.includes('45')) durationMinutes = 45;
        else if (treatmentLower.includes('120') || treatmentLower.includes('2 hour')) durationMinutes = 120;

        for (const ps of pageSlots) {
          slots.push({
            clinicSlug: clinic.slug,
            clinicName: clinic.name,
            practitioner: ps.practitioner,
            treatment: treatment.text,
            date: ps.date,
            startTime: `${String(ps.hour).padStart(2, '0')}:${String(ps.minute).padStart(2, '0')}`,
            durationMinutes,
          });
        }
      } catch (err) {
        console.warn(`  Warning: Could not scrape treatment "${treatment.text}": ${err.message}`);
      }
    }

    // Strategy 2: Parse intercepted API responses
    for (const resp of apiResponses) {
      try {
        const data = resp.data;

        // Handle various JaneApp API response shapes
        const openings = data?.openings || data?.slots || data?.availability || data?.data?.openings;
        if (Array.isArray(openings)) {
          for (const opening of openings) {
            const date = opening.date || opening.start_date || opening.day;
            const time = opening.start_time || opening.time || opening.start;
            const name = opening.staff_member?.name || opening.practitioner?.name || opening.provider;
            const dur = opening.duration || opening.duration_minutes || 60;

            if (date && time) {
              // Normalize time format
              let timeStr = time;
              if (time.includes('T')) {
                timeStr = time.split('T')[1].slice(0, 5);
              }

              slots.push({
                clinicSlug: clinic.slug,
                clinicName: clinic.name,
                practitioner: name || null,
                treatment: opening.treatment?.name || opening.service_name || 'Massage',
                date,
                startTime: timeStr,
                durationMinutes: typeof dur === 'number' ? dur : 60,
              });
            }
          }
        }
      } catch {
        // Skip malformed API response
      }
    }

    // Log success
    await supabase.from('pulse_scrape_log').insert({
      provider_slug: clinic.slug,
      source: 'janeapp_scrape',
      status: slots.length > 0 ? 'success' : 'no_data',
      slots_found: slots.length,
      duration_ms: Date.now() - startTime,
    });

    console.log(`  ✅ ${clinic.name}: Found ${slots.length} slots (${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error(`  ❌ ${clinic.name}: ${error.message}`);

    await supabase.from('pulse_scrape_log').insert({
      provider_slug: clinic.slug,
      source: 'janeapp_scrape',
      status: 'error',
      error_message: error.message.slice(0, 500),
      duration_ms: Date.now() - startTime,
    });
  } finally {
    await page.close();
  }

  return slots;
}

/**
 * Look up provider IDs from the database
 */
async function getProviderMap() {
  const { data: providers } = await supabase
    .from('pulse_wellness_providers')
    .select('id, janeapp_slug, name, clinic_name')
    .eq('is_active', true);

  if (!providers) return {};

  const map = {};
  for (const p of providers) {
    // Map by slug + practitioner name (case insensitive)
    if (p.janeapp_slug) {
      const key = `${p.janeapp_slug}-${p.name.toLowerCase()}`;
      map[key] = p.id;
      // Also map by slug + clinic (for generic matches)
      const clinicKey = `${p.janeapp_slug}-clinic`;
      if (!map[clinicKey]) map[clinicKey] = p.id;
    }
  }
  return map;
}

/**
 * Write scraped slots to Supabase
 */
async function upsertSlots(allSlots, providerMap) {
  if (allSlots.length === 0) {
    console.log('\n📭 No slots to insert');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const records = [];

  for (const slot of allSlots) {
    if (!slot.date || !slot.startTime) continue;

    // Try to match to a provider
    let providerId = null;

    if (slot.practitioner) {
      const key = `${slot.clinicSlug}-${slot.practitioner.toLowerCase()}`;
      providerId = providerMap[key];
    }

    if (!providerId) {
      // Fall back to clinic-level match
      const clinicKey = `${slot.clinicSlug}-clinic`;
      providerId = providerMap[clinicKey];
    }

    if (!providerId) {
      console.warn(`  ⚠️ No provider match for ${slot.clinicSlug} / ${slot.practitioner}`);
      continue;
    }

    records.push({
      provider_id: providerId,
      date: slot.date,
      start_time: slot.startTime,
      duration_minutes: slot.durationMinutes,
      is_available: true,
      source: 'janeapp_scrape',
    });
  }

  if (records.length === 0) {
    console.log('\n📭 No matched records to insert');
    return;
  }

  // Delete existing janeapp_scrape slots for today and future, then insert fresh
  const providerIds = [...new Set(records.map(r => r.provider_id))];

  const { error: deleteError } = await supabase
    .from('pulse_availability_slots')
    .delete()
    .in('provider_id', providerIds)
    .gte('date', today)
    .eq('source', 'janeapp_scrape');

  if (deleteError) {
    console.error('Delete error:', deleteError.message);
  }

  // Upsert in batches of 100
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await supabase
      .from('pulse_availability_slots')
      .upsert(batch, {
        onConflict: 'provider_id,date,start_time,duration_minutes',
      });

    if (error) {
      console.error(`Upsert error (batch ${i}):`, error.message);
    }
  }

  console.log(`\n✅ Upserted ${records.length} slots for ${providerIds.length} providers`);
}

/**
 * Main scrape orchestrator
 */
async function main() {
  console.log('🔍 Pulse JaneApp Availability Scraper');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`📋 Scraping ${CLINICS.length} clinics...\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const providerMap = await getProviderMap();
  console.log(`📌 Loaded ${Object.keys(providerMap).length} provider mappings\n`);

  const allSlots = [];
  let successCount = 0;
  let errorCount = 0;

  for (const clinic of CLINICS) {
    console.log(`\n🏥 ${clinic.name} (${clinic.slug})`);
    try {
      const slots = await scrapeClinic(browser, clinic);
      allSlots.push(...slots);
      if (slots.length > 0) successCount++;
    } catch (err) {
      console.error(`  Fatal error: ${err.message}`);
      errorCount++;
    }

    // Rate limit: 3 seconds between clinics
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();

  // Write all slots to Supabase
  await upsertSlots(allSlots, providerMap);

  // Summary
  console.log('\n📊 Summary:');
  console.log(`  Clinics scraped: ${CLINICS.length}`);
  console.log(`  With data: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Total slots found: ${allSlots.length}`);

  // Alert if error rate is high
  const errorRate = errorCount / CLINICS.length;
  if (errorRate > 0.5) {
    console.warn(`\n⚠️ HIGH ERROR RATE: ${Math.round(errorRate * 100)}% of clinics failed`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
