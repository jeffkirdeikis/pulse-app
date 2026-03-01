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

import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { getTodayPacific } from './lib/scraper-utils.js';

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
  { slug: 'livwellintegratedhealth', name: 'LivWell Integrated Health' },
  { slug: 'emilycosta', name: 'Emily Costa RMT' },
  { slug: 'kaylayoungwellness', name: 'Kayla Young Wellness' },
  { slug: 'akohealth', name: 'Ako Health' },
  { slug: 'peakintegratedhealth', name: 'Peak Integrated Health' },
  { slug: 'anchorsquamish', name: 'Anchor Health & Wellness' },
  { slug: 'twr', name: 'The Wellness Room', bookingPath: '/locations/clinic-tantalus-rd-location/book' },
  { slug: 'seedsquamish', name: 'Seed Studio', bookingPath: '/locations/seed-studio/book' },
  { slug: 'teawc', name: 'The Essence Wellness Centre' },
  { slug: 'squamishbarbell', name: 'Squamish Barbell Clinic' },
  { slug: 'falllineperformance', name: 'Fall Line Fitness', bookingPath: '/locations/fall-line-fitness/book' },
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
    const baseDomain = `https://${clinic.slug}.janeapp.com`;
    const bookingUrl = clinic.bookingPath ? `${baseDomain}${clinic.bookingPath}` : baseDomain;
    console.log(`  Visiting ${bookingUrl}...`);

    await page.goto(bookingUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for page content to load
    await new Promise(r => setTimeout(r, 2000));

    // Build staff ID -> name map from page links (needed for for_discipline API parsing)
    const staffIdMap = await page.evaluate(() => {
      const map = {};
      document.querySelectorAll('a[href*="staff_member"]').forEach(el => {
        if (el.href.includes('/bio')) return;
        const match = el.href.match(/staff_member\/(\d+)/);
        if (match) {
          const name = el.textContent.trim().split('\n')[0].trim();
          if (name && name !== 'Read More') {
            map[match[1]] = name;
          }
        }
      });
      return map;
    });

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
            text.includes('osteo') || text.includes('naturo') || text.includes('reflexolog') ||
            text.includes('treatment') || text.includes('assessment') || text.includes('adjustment') ||
            text.includes('60 min') || text.includes('90 min') || text.includes('30 min') ||
            text.includes('45 min') || text.includes('75 min') || text.includes('120 min') ||
            text.includes('prenatal') || text.includes('pregnancy') || text.includes('paediatric')
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

    // If few direct treatment links found, try staff member links
    // (some JaneApp clinics organize by practitioner → treatment instead of treatment → practitioner)
    if (treatmentLinks.length < 3) {
      const staffLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll('a[href*="staff_member"]').forEach(el => {
          if (el.href.includes('/bio')) return; // skip bio links
          const text = el.textContent.trim().split('\n')[0].trim();
          if (text && text !== 'Read More' && !links.some(l => l.href === el.href)) {
            links.push({ href: el.href, text });
          }
        });
        return links;
      });

      if (staffLinks.length > 0) {
        console.log(`  Found ${staffLinks.length} staff member links (practitioner-first layout)`);
        // Navigate into each staff member, find their treatments, then navigate to trigger API
        for (const staff of staffLinks.slice(0, 15)) {
          try {
            await page.goto(staff.href, { waitUntil: 'networkidle2', timeout: 20000 });
            await new Promise(r => setTimeout(r, 1500));

            // Get treatment links on this staff member's page
            const staffTreatments = await page.evaluate(() => {
              return Array.from(document.querySelectorAll('a[href*="treatment"]'))
                .filter(a => a.href.includes('staff_member'))
                .map(a => ({ href: a.href, text: a.textContent.trim().split('\n')[0] }))
                .filter((v, i, arr) => arr.findIndex(a => a.href === v.href) === i);
            });

            // Navigate to first treatment to trigger API call (using page.goto, not click)
            if (staffTreatments.length > 0) {
              await page.goto(staffTreatments[0].href, { waitUntil: 'networkidle2', timeout: 20000 });
              await new Promise(r => setTimeout(r, 3000));
              console.log(`    ${staff.text}: ${staffTreatments.length} treatments, API triggered`);
            } else {
              // Some staff pages have discipline-level treatment links (not staff-specific)
              const genericTreatments = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href*="treatment"]'))
                  .map(a => ({ href: a.href, text: a.textContent.trim().split('\n')[0] }))
                  .filter((v, i, arr) => arr.findIndex(a => a.href === v.href) === i)
                  .slice(0, 1);
              });
              if (genericTreatments.length > 0) {
                await page.goto(genericTreatments[0].href, { waitUntil: 'networkidle2', timeout: 20000 });
                await new Promise(r => setTimeout(r, 3000));
              }
            }
          } catch (err) {
            console.warn(`  Warning: Could not scrape staff "${staff.text}": ${err.message}`);
          }
        }
      }
    }

    console.log(`  Found ${treatmentLinks.length} treatment links`);

    // Navigate to treatment pages and scrape availability
    for (const treatment of treatmentLinks.slice(0, 8)) {
      try {
        await page.goto(treatment.href, {
          waitUntil: 'networkidle2',
          timeout: 20000,
        });
        await new Promise(r => setTimeout(r, 1500));

        // Update staff ID map from treatment page (may show new staff members)
        const pageStaff = await page.evaluate(() => {
          const map = {};
          document.querySelectorAll('a[href*="staff_member"]').forEach(el => {
            if (el.href.includes('/bio')) return;
            const match = el.href.match(/staff_member\/(\d+)/);
            if (match) {
              const name = el.textContent.trim().split('\n')[0].trim();
              if (name && name !== 'Read More') map[match[1]] = name;
            }
          });
          return map;
        });
        Object.assign(staffIdMap, pageStaff);

        // Extract available time slots from the page
        const pageSlots = await page.evaluate(() => {
          const results = [];

          // Try to find the current date from the page
          let pageDate = null;

          // Look for date in page content
          const datePatterns = [
            // "February 6, 2026" or "Feb 6, 2026"
            /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
            // "2026-02-06"
            /\d{4}-\d{2}-\d{2}/,
            // "06/02/2026"
            /\d{2}\/\d{2}\/\d{4}/,
          ];

          const pageText = document.body.innerText;
          for (const pattern of datePatterns) {
            const match = pageText.match(pattern);
            if (match) {
              try {
                const d = new Date(match[0]);
                if (!isNaN(d.getTime())) {
                  // Use local date parts to avoid UTC conversion shifting the date
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  pageDate = `${year}-${month}-${day}`;
                  break;
                }
              } catch { /* skip */ }
            }
          }

          // Also check data attributes and meta tags
          const dateAttrs = document.querySelectorAll('[data-date], [data-day], [datetime]');
          dateAttrs.forEach(el => {
            if (!pageDate) {
              const val = el.getAttribute('data-date') || el.getAttribute('data-day') || el.getAttribute('datetime');
              if (val && /\d{4}-\d{2}-\d{2}/.test(val)) {
                pageDate = val.match(/\d{4}-\d{2}-\d{2}/)[0];
              }
            }
          });

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

                // Try to find the associated date from closest parent
                const dateEl = el.closest('[data-date]');
                const dateAttr = dateEl?.getAttribute('data-date');

                // Try to find practitioner name
                const practSection = el.closest('[class*="practitioner"], [class*="staff"], [class*="provider"]');
                const practName = practSection?.querySelector('[class*="name"]')?.textContent?.trim();

                results.push({
                  date: dateAttr || pageDate || null,
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
            _source: 'dom', // Track origin for filtering
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

        // Extract staff_member_id and treatment_id from the API URL for direct booking links
        // URL format: /api/v2/openings?staff_member_id=79&treatment_id=617
        const urlParams = new URL(resp.url).searchParams;
        const apiStaffId = urlParams.get('staff_member_id');
        const apiTreatmentId = urlParams.get('treatment_id');

        // JaneApp /api/v2/openings/for_discipline returns flat array:
        // [{staff_member_id, treatment_id, start_at, duration, ...}]
        if (Array.isArray(data) && data[0]?.staff_member_id && data[0]?.start_at && !data[0]?.openings) {
          for (const opening of data) {
            const startAt = opening.start_at;
            if (!startAt) continue;

            const dateStr = startAt.slice(0, 10);
            const timeStr = startAt.slice(11, 16);
            const durSec = opening.duration || 3600;
            const rawMin = Math.round(durSec / 60);
            const allowed = [30, 45, 60, 75, 90, 120];
            const durMin = allowed.reduce((prev, curr) =>
              Math.abs(curr - rawMin) < Math.abs(prev - rawMin) ? curr : prev
            );

            const staffMemberId = String(opening.staff_member_id);
            const practName = staffIdMap[staffMemberId] || null;
            const treatId = apiTreatmentId || opening.treatment_id;

            let bookingUrl = `https://${clinic.slug}.janeapp.com`;
            if (clinic.bookingPath) bookingUrl += clinic.bookingPath;
            if (staffMemberId && treatId) {
              bookingUrl += `/#/staff_member/${staffMemberId}/treatment/${treatId}`;
            } else if (staffMemberId) {
              bookingUrl += `/#/staff_member/${staffMemberId}`;
            }

            slots.push({
              clinicSlug: clinic.slug,
              clinicName: clinic.name,
              practitioner: practName,
              treatment: 'Massage',
              date: dateStr,
              startTime: timeStr,
              durationMinutes: durMin,
              bookingUrl,
              _source: 'api',
            });
          }
          continue;
        }

        // JaneApp /api/v2/openings returns: [{id, full_name, openings: [{start_at, duration, ...}]}]
        if (Array.isArray(data) && data[0]?.openings) {
          for (const staffMember of data) {
            const practName = staffMember.full_name || staffMember.name || null;
            const staffId = apiStaffId || staffMember.id;

            for (const opening of (staffMember.openings || [])) {
              const startAt = opening.start_at;
              if (!startAt) continue;

              // Parse ISO datetime "2026-02-16T12:15:00-08:00"
              const dateStr = startAt.slice(0, 10); // "2026-02-16"
              const timeStr = startAt.slice(11, 16); // "12:15"
              // Duration is in seconds (e.g. 4500 = 75 min)
              // Snap to allowed values: 30, 45, 60, 75, 90, 120
              const durSec = opening.duration || 3600;
              const rawMin = Math.round(durSec / 60);
              const allowed = [30, 45, 60, 75, 90, 120];
              const durMin = allowed.reduce((prev, curr) =>
                Math.abs(curr - rawMin) < Math.abs(prev - rawMin) ? curr : prev
              );

              // Build direct booking URL: https://{slug}.janeapp.com/#/staff_member/{id}/treatment/{id}
              const treatId = apiTreatmentId || opening.treatment_id;
              let bookingUrl = `https://${clinic.slug}.janeapp.com`;
              if (staffId && treatId) {
                bookingUrl += `/#/staff_member/${staffId}/treatment/${treatId}`;
              } else if (staffId) {
                bookingUrl += `/#/staff_member/${staffId}`;
              }

              slots.push({
                clinicSlug: clinic.slug,
                clinicName: clinic.name,
                practitioner: practName,
                treatment: opening.treatment?.name || 'Massage',
                date: dateStr,
                startTime: timeStr,
                durationMinutes: durMin,
                bookingUrl,
                _source: 'api', // Structured API data — trustworthy
              });
            }
          }
          continue;
        }

        // Fallback: Handle other API response shapes
        const openings = data?.openings || data?.slots || data?.availability || data?.data?.openings;
        if (Array.isArray(openings)) {
          for (const opening of openings) {
            const date = opening.date || opening.start_date || opening.day;
            const time = opening.start_time || opening.time || opening.start;
            const name = opening.staff_member?.name || opening.practitioner?.name || opening.provider;
            const dur = opening.duration || opening.duration_minutes || 60;

            if (date && time) {
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
                _source: 'api',
              });
            }
          }
        }
      } catch {
        // Skip malformed API response
      }
    }

    // If we got API responses, discard DOM-scraped slots — DOM scraping produces
    // false positives by matching time-like patterns in treatment descriptions
    const apiSlots = slots.filter(s => s._source === 'api');
    const domSlots = slots.filter(s => s._source === 'dom');
    const hadApiResponse = apiResponses.some(r =>
      r.url.includes('openings') || r.url.includes('availability')
    );

    if (hadApiResponse) {
      // Trust only API data — DOM data is unreliable
      if (domSlots.length > 0) {
        console.log(`  Discarding ${domSlots.length} DOM-scraped slots (API data available)`);
      }
      slots.length = 0;
      slots.push(...apiSlots);
    } else if (apiSlots.length > 0) {
      // Got API slots from some other endpoint shape
      slots.length = 0;
      slots.push(...apiSlots);
    }
    // If no API responses at all, keep DOM slots as last resort

    // Log success
    await supabase.from('pulse_scrape_log').insert({
      provider_slug: clinic.slug,
      source: 'janeapp_scrape',
      status: slots.length > 0 ? 'success' : 'no_data',
      slots_found: slots.length,
      duration_ms: Date.now() - startTime,
    });

    console.log(`  ✅ ${clinic.name}: Found ${slots.length} slots (${apiSlots.length} API, ${domSlots.length} DOM discarded) (${Date.now() - startTime}ms)`);
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
 * Strip honorific titles from a name for matching
 */
function normalizeName(name) {
  return name
    .replace(/^(mrs?\.|ms\.|dr\.|prof\.)\s*/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')  // Remove parenthetical nicknames like "(Cat)"
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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
    if (p.janeapp_slug) {
      const slug = p.janeapp_slug;
      const fullName = normalizeName(p.name);

      // Map by slug + full name
      map[`${slug}-${fullName}`] = p.id;

      // Map by slug + first name only (for clinics that show first names)
      const firstName = fullName.split(' ')[0];
      const firstNameKey = `${slug}-first-${firstName}`;
      if (!map[firstNameKey]) map[firstNameKey] = p.id;

      // Map by slug + last name only (for partial matching)
      const parts = fullName.split(' ');
      if (parts.length > 1) {
        const lastName = parts[parts.length - 1];
        const lastNameKey = `${slug}-last-${lastName}`;
        if (!map[lastNameKey]) map[lastNameKey] = p.id;
      }

      // Map by slug + clinic (for generic/fallback matches)
      const clinicKey = `${slug}-clinic`;
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

  const today = getTodayPacific();
  const records = [];

  let skippedNoDate = 0;
  let skippedNoProvider = 0;
  let skippedPastDate = 0;

  for (const slot of allSlots) {
    if (!slot.startTime) {
      skippedNoDate++;
      continue;
    }

    // SAFETY: Skip records without a parseable date instead of defaulting to today.
    // Defaulting to today can produce false data when the scraper fails to extract dates.
    if (!slot.date) {
      skippedNoDate++;
      console.warn(`   [janeapp] Skipping slot for ${slot.clinicName} - no date could be parsed from page`);
      continue;
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
      skippedNoDate++;
      console.warn(`   [janeapp] Skipping slot for ${slot.clinicName} - invalid date format: ${slot.date}`);
      continue;
    }

    // Reject slots with past dates
    if (slot.date < today) {
      skippedPastDate++;
      continue;
    }

    // Try to match to a provider (multiple strategies)
    let providerId = null;

    if (slot.practitioner) {
      const normalized = normalizeName(slot.practitioner);

      // Strategy 1: Exact full name match
      providerId = providerMap[`${slot.clinicSlug}-${normalized}`];

      // Strategy 2: First name match
      if (!providerId) {
        const firstName = normalized.split(' ')[0];
        providerId = providerMap[`${slot.clinicSlug}-first-${firstName}`];
      }

      // Strategy 3: Last name match
      if (!providerId) {
        const parts = normalized.split(' ');
        if (parts.length > 1) {
          const lastName = parts[parts.length - 1];
          providerId = providerMap[`${slot.clinicSlug}-last-${lastName}`];
        }
      }
    }

    if (!providerId) {
      // Fall back to clinic-level match
      const clinicKey = `${slot.clinicSlug}-clinic`;
      providerId = providerMap[clinicKey];
    }

    if (!providerId) {
      skippedNoProvider++;
      continue;
    }

    records.push({
      provider_id: providerId,
      date: slot.date,
      start_time: slot.startTime,
      duration_minutes: slot.durationMinutes,
      is_available: true,
      source: 'janeapp_scrape',
      booking_url: slot.bookingUrl || null,
    });
  }

  console.log(`  Skipped: ${skippedNoDate} without time, ${skippedPastDate} past dates, ${skippedNoProvider} without provider match`);

  // Deduplicate by unique constraint key: provider_id + date + start_time + duration_minutes
  const seen = new Set();
  const dedupedRecords = [];
  for (const r of records) {
    const key = `${r.provider_id}-${r.date}-${r.start_time}-${r.duration_minutes}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedRecords.push(r);
    }
  }
  console.log(`  Deduped: ${records.length} → ${dedupedRecords.length} unique slots`);

  // Replace records with deduped version
  records.length = 0;
  records.push(...dedupedRecords);

  if (records.length === 0) {
    console.log('\n📭 No matched records to insert');
    // Log a sample of what was found for debugging
    if (allSlots.length > 0) {
      console.log('  Sample slot:', JSON.stringify(allSlots[0]));
      console.log('  Provider map keys:', Object.keys(providerMap).slice(0, 10));
    }
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
 * Post-scrape validation: check for suspicious duplication in availability slots.
 * If a single provider has an unreasonable number of identical time slots across
 * many dates, the scraper likely failed to navigate and duplicated data.
 */
async function validateJaneAppSlots() {
  try {
    const today = getTodayPacific();
    const { data: slots, error } = await supabase
      .from('pulse_availability_slots')
      .select('provider_id, date, start_time')
      .gte('date', today)
      .eq('source', 'janeapp_scrape');

    if (error || !slots || slots.length === 0) return;

    // Group by provider and check for suspicious patterns
    const byProvider = {};
    for (const s of slots) {
      if (!byProvider[s.provider_id]) byProvider[s.provider_id] = [];
      byProvider[s.provider_id].push(s);
    }

    for (const [providerId, providerSlots] of Object.entries(byProvider)) {
      const uniqueTimes = new Set(providerSlots.map(s => s.start_time));
      const uniqueDates = new Set(providerSlots.map(s => s.date));
      // If same time slots appear on every single date, likely duplication
      if (uniqueDates.size > 20 && uniqueTimes.size < 5) {
        console.warn(`   [janeapp] VALIDATION WARNING: Provider ${providerId} has ${providerSlots.length} slots with only ${uniqueTimes.size} unique times across ${uniqueDates.size} dates - possible duplication`);
      }
    }
  } catch {
    // Don't block on validation errors
  }
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

  // Post-scrape validation: check for suspicious slot duplication per clinic
  await validateJaneAppSlots();

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

// Export for use by scrape-reliable-sources.js orchestrator
export { scrapeClinic, CLINICS, upsertSlots, getProviderMap };

// Run standalone if invoked directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
