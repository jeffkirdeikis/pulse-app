/**
 * Enrich Event/Class Descriptions
 *
 * Finds events with sparse descriptions (e.g., just "Instructor: X" or "<Category> class at <Venue>")
 * and enriches them by scraping the business website for real class/event descriptions.
 *
 * Uses:
 *   - Supabase for DB reads/writes
 *   - Firecrawl for website scraping
 *   - Anthropic for structured extraction from scraped content
 *
 * Usage:
 *   node scripts/enrich-descriptions.js              # Dry-run (preview changes)
 *   node scripts/enrich-descriptions.js --commit      # Actually write to DB
 *   node scripts/enrich-descriptions.js --venue "Squamish Barbell"  # Only one venue
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, FIRECRAWL_API_KEY as getFirecrawlKey } from './lib/env.js';

const FIRECRAWL_API_KEY = getFirecrawlKey();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY());
const anthropic = new Anthropic();

const COMMIT = process.argv.includes('--commit');
const VENUE_FILTER = (() => {
  const idx = process.argv.indexOf('--venue');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// Patterns that indicate a sparse/generic description
function isSparseDescription(desc) {
  if (!desc || desc.trim().length < 50) return true;
  const trimmed = desc.trim();
  // "Instructor: X"
  if (/^Instructor:\s*.+$/i.test(trimmed)) return true;
  // "{Category} class at {Venue}"
  if (/^.{3,30}\s+class\s+at\s+.{3,50}$/i.test(trimmed)) return true;
  // Just a category name
  if (/^(yoga|pilates|fitness|crossfit|strength|cardio|dance|martial arts|boxing|climbing|cycling|swim|run|hiit|barre|bootcamp)$/i.test(trimmed)) return true;
  return false;
}

async function scrapeWebsite(url) {
  if (!url) return null;
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
      },
      body: JSON.stringify({
        url: fullUrl,
        formats: ['markdown'],
        timeout: 30000,
      })
    });

    if (!response.ok) {
      console.error(`  Firecrawl error ${response.status} for ${fullUrl}`);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.data?.markdown) {
      console.error(`  No content returned for ${fullUrl}`);
      return null;
    }

    return data.data.markdown;
  } catch (err) {
    console.error(`  Scrape failed for ${fullUrl}: ${err.message}`);
    return null;
  }
}

async function extractDescriptions(scrapedContent, eventTitles, businessName) {
  // Truncate content to fit context window
  const maxChars = 12000;
  const content = scrapedContent.length > maxChars
    ? scrapedContent.substring(0, maxChars)
    : scrapedContent;

  const titlesStr = eventTitles.map(t => `- "${t}"`).join('\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are extracting class/event descriptions from a business website for "${businessName}".

Here is the website content:
<website>
${content}
</website>

For each of these classes/events, find the matching description from the website content.
ONLY return descriptions that are ACTUALLY PRESENT on the website. Do NOT make up or embellish descriptions.
If a class is not mentioned on the website, return null for it.

Classes/events to match:
${titlesStr}

Return a JSON object mapping each title to its description (or null if not found).
Example: {"Yoga Flow": "A dynamic vinyasa-style class that builds strength and flexibility through flowing sequences.", "HIIT": null}

Return ONLY the JSON object, no other text.`
      }]
    });

    const text = response.content[0]?.text?.trim();
    if (!text) return {};

    // Parse JSON, handling potential markdown code blocks
    const jsonStr = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error(`  Anthropic extraction failed: ${err.message}`);
    return {};
  }
}

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Enrich Event/Class Descriptions`);
  console.log(`  Mode: ${COMMIT ? 'COMMIT (writing to DB)' : 'DRY RUN (preview only)'}`);
  if (VENUE_FILTER) console.log(`  Venue filter: ${VENUE_FILTER}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Fetch all events with sparse descriptions
  let query = supabase
    .from('events')
    .select('id, title, description, venue_id, venue_name, category, event_type')
    .eq('status', 'active');

  if (VENUE_FILTER) {
    query = query.ilike('venue_name', `%${VENUE_FILTER}%`);
  }

  const { data: events, error: eventsError } = await query;
  if (eventsError) {
    console.error('Failed to fetch events:', eventsError.message);
    process.exit(1);
  }

  const sparseEvents = events.filter(e => isSparseDescription(e.description));
  console.log(`Found ${sparseEvents.length} events with sparse descriptions (out of ${events.length} total)\n`);

  if (sparseEvents.length === 0) {
    console.log('Nothing to enrich. All descriptions look good.');
    return;
  }

  // 2. Group by venue
  const byVenue = {};
  for (const event of sparseEvents) {
    const key = event.venue_id || event.venue_name;
    if (!byVenue[key]) {
      byVenue[key] = { venueId: event.venue_id, venueName: event.venue_name, events: [] };
    }
    byVenue[key].events.push(event);
  }

  console.log(`Grouped into ${Object.keys(byVenue).length} venues\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  const changes = [];

  // 3. Process each venue
  for (const [key, group] of Object.entries(byVenue)) {
    console.log(`\n--- ${group.venueName} (${group.events.length} sparse events) ---`);

    // Look up website from businesses table
    let website = null;
    if (group.venueId) {
      const { data: biz } = await supabase
        .from('businesses')
        .select('website')
        .eq('id', group.venueId)
        .single();
      website = biz?.website;
    }

    if (!website) {
      console.log(`  No website found, skipping`);
      totalSkipped += group.events.length;
      continue;
    }

    console.log(`  Website: ${website}`);

    // Scrape
    const scrapedContent = await scrapeWebsite(website);
    if (!scrapedContent) {
      console.log(`  Scrape returned no content, skipping`);
      totalSkipped += group.events.length;
      continue;
    }

    console.log(`  Scraped ${scrapedContent.length} chars`);

    // Extract descriptions using Anthropic
    const titles = [...new Set(group.events.map(e => e.title))];
    const descriptions = await extractDescriptions(scrapedContent, titles, group.venueName);

    // Match and log
    for (const event of group.events) {
      const newDesc = descriptions[event.title];
      if (!newDesc) {
        console.log(`  [SKIP] "${event.title}" - no match found on website`);
        totalSkipped++;
        continue;
      }

      changes.push({
        id: event.id,
        title: event.title,
        venueName: group.venueName,
        before: event.description || '(empty)',
        after: newDesc,
      });
      totalUpdated++;

      console.log(`  [MATCH] "${event.title}"`);
      console.log(`    Before: ${(event.description || '(empty)').substring(0, 80)}`);
      console.log(`    After:  ${newDesc.substring(0, 80)}...`);
    }

    // Rate limit: 1 second between venues
    await new Promise(r => setTimeout(r, 1000));
  }

  // 4. Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Summary: ${totalUpdated} to update, ${totalSkipped} skipped`);
  console.log(`${'='.repeat(60)}\n`);

  if (changes.length === 0) {
    console.log('No descriptions to update.');
    return;
  }

  // 5. Write to DB if --commit
  if (COMMIT) {
    console.log('Writing to database...\n');
    let writeSuccess = 0;
    let writeError = 0;

    for (const change of changes) {
      const { error } = await supabase
        .from('events')
        .update({ description: change.after, updated_at: new Date().toISOString() })
        .eq('id', change.id);

      if (error) {
        console.error(`  Failed to update "${change.title}": ${error.message}`);
        writeError++;
      } else {
        console.log(`  Updated: "${change.title}" at ${change.venueName}`);
        writeSuccess++;
      }
    }

    console.log(`\nDone: ${writeSuccess} updated, ${writeError} errors`);
  } else {
    console.log('Dry run complete. Run with --commit to write changes to DB.');
    console.log('\nChanges that would be made:');
    for (const change of changes) {
      console.log(`\n  "${change.title}" (${change.venueName})`);
      console.log(`    Before: ${change.before}`);
      console.log(`    After:  ${change.after}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
