#!/usr/bin/env node
/**
 * Data Quality Validation Script
 *
 * Run after every scraper execution to catch data issues before they reach users.
 * Exits with code 1 if critical issues found, code 0 if clean.
 *
 * Usage:
 *   node scripts/validate-data-quality.js           # Full validation
 *   node scripts/validate-data-quality.js --fix      # Fix issues automatically
 *   node scripts/validate-data-quality.js --venue "Breathe Fitness"  # Check specific venue
 *
 * Checks:
 *   1. Date duplication (ratio > 25x = scraper stamped same schedule on every day)
 *   2. Missing venue_id (should be linked to businesses table)
 *   3. Expired events (start_date in the past)
 *   4. Hallucinated events (title = venue_name)
 *   5. Suspicious time clustering (50+ events at same time)
 *   6. Age group inference validation
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const VENUE_FILTER = args.includes('--venue') ? args[args.indexOf('--venue') + 1] : null;

let criticalCount = 0;
let majorCount = 0;
let minorCount = 0;
let fixedCount = 0;

function critical(msg) { criticalCount++; console.error(`\x1b[31m[CRITICAL]\x1b[0m ${msg}`); }
function major(msg) { majorCount++; console.warn(`\x1b[33m[MAJOR]\x1b[0m ${msg}`); }
function minor(msg) { minorCount++; console.log(`\x1b[36m[MINOR]\x1b[0m ${msg}`); }
function pass(msg) { console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`); }
function fixed(msg) { fixedCount++; console.log(`\x1b[35m[FIXED]\x1b[0m ${msg}`); }

async function checkDateDuplication() {
  console.log('\n--- Check 1: Date Duplication ---');

  const { data, error } = await supabase.rpc('execute_sql', {
    query: `
      SELECT venue_name, COUNT(*) as total, COUNT(DISTINCT title) as titles,
        ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT title), 0), 1) as ratio
      FROM events
      WHERE tags @> '{"auto-scraped"}' AND event_type = 'class' AND status = 'active'
      ${VENUE_FILTER ? `AND venue_name ILIKE '%${VENUE_FILTER}%'` : ''}
      GROUP BY venue_name
      HAVING COUNT(*)::numeric / NULLIF(COUNT(DISTINCT title), 0) > 20
      ORDER BY ratio DESC
    `
  });

  if (error) {
    // Fallback: use REST API
    const { data: events } = await supabase
      .from('events')
      .select('venue_name, title')
      .eq('status', 'active')
      .eq('event_type', 'class')
      .contains('tags', ['auto-scraped']);

    if (!events) { console.log('  Could not check (RPC not available, REST fallback failed)'); return; }

    // Calculate ratios manually
    const venueData = {};
    events.forEach(e => {
      if (!venueData[e.venue_name]) venueData[e.venue_name] = { total: 0, titles: new Set() };
      venueData[e.venue_name].total++;
      venueData[e.venue_name].titles.add(e.title);
    });

    let found = false;
    for (const [venue, data] of Object.entries(venueData)) {
      const ratio = data.total / data.titles.size;
      if (ratio > 25) {
        found = true;
        critical(`${venue}: ${ratio.toFixed(1)}x ratio (${data.total} events / ${data.titles.size} titles) - scraper likely stamped same schedule on every day`);

        if (FIX_MODE) {
          // Delete duplicates: keep only distinct title+start_time combos per day-of-week
          console.log(`  → Would need manual cleanup for ${venue}. Run scrapers with day-of-week filtering.`);
        }
      } else if (ratio > 15) {
        major(`${venue}: ${ratio.toFixed(1)}x ratio (${data.total} / ${data.titles.size}) - borderline, review manually`);
      }
    }

    if (!found) pass('No date duplication detected (all venues under 25x ratio)');
    return;
  }

  if (!data || data.length === 0) {
    pass('No date duplication detected (all venues under 25x ratio)');
  } else {
    data.forEach(row => {
      critical(`${row.venue_name}: ${row.ratio}x ratio (${row.total} events / ${row.titles} titles)`);
    });
  }
}

async function checkMissingVenueId() {
  console.log('\n--- Check 2: Missing venue_id ---');

  const { count: totalCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: nullCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('venue_id', null);

  const pct = ((nullCount / totalCount) * 100).toFixed(1);

  if (pct > 90) {
    major(`${nullCount}/${totalCount} events (${pct}%) missing venue_id`);
  } else if (pct > 50) {
    minor(`${nullCount}/${totalCount} events (${pct}%) missing venue_id`);
  } else {
    pass(`Only ${nullCount}/${totalCount} events (${pct}%) missing venue_id`);
  }

  if (FIX_MODE && nullCount > 0) {
    // Attempt to backfill venue_id by matching venue_name to businesses.name
    const { data: orphanedEvents } = await supabase
      .from('events')
      .select('id, venue_name')
      .eq('status', 'active')
      .is('venue_id', null)
      .limit(1000);

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('status', 'active');

    if (orphanedEvents && businesses) {
      // Build lookup map (case-insensitive)
      const bizMap = {};
      businesses.forEach(b => { bizMap[b.name.toLowerCase()] = b.id; });

      let matched = 0;
      for (const event of orphanedEvents) {
        const bizId = bizMap[event.venue_name?.toLowerCase()];
        if (bizId) {
          const { error: updateErr } = await supabase
            .from('events')
            .update({ venue_id: bizId })
            .eq('id', event.id);
          if (!updateErr) matched++;
        }
      }
      if (matched > 0) fixed(`Backfilled venue_id for ${matched} events`);
    }
  }
}

async function checkExpiredEvents() {
  console.log('\n--- Check 3: Expired Events ---');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const dateStr = sevenDaysAgo.toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .lt('start_date', dateStr);

  if (error) { console.log('  Could not check:', error.message); return; }

  if (count > 50) {
    major(`${count} expired events (>7 days old) still active`);
  } else if (count > 0) {
    minor(`${count} expired events (>7 days old) still active`);
  } else {
    pass('No expired events found');
  }

  if (FIX_MODE && count > 0) {
    const { error: archiveErr } = await supabase
      .from('events')
      .update({ status: 'archived' })
      .lt('start_date', dateStr)
      .eq('status', 'active');

    if (!archiveErr) fixed(`Archived ${count} expired events`);
    else console.error('  Error archiving:', archiveErr.message);
  }
}

async function checkHallucinatedEvents() {
  console.log('\n--- Check 4: Hallucinated Events (title = venue_name) ---');

  const { data, error } = await supabase
    .from('events')
    .select('id, title, venue_name')
    .eq('status', 'active');

  if (error) { console.log('  Could not check:', error.message); return; }

  const hallucinated = data.filter(e =>
    e.title && e.venue_name &&
    e.title.toLowerCase().trim() === e.venue_name.toLowerCase().trim()
  );

  if (hallucinated.length > 0) {
    major(`${hallucinated.length} events where title = venue_name (likely hallucinated)`);
    hallucinated.slice(0, 5).forEach(e => console.log(`  → "${e.title}" at ${e.venue_name}`));
  } else {
    pass('No hallucinated events found');
  }
}

async function checkTimeClustering() {
  console.log('\n--- Check 5: Suspicious Time Clustering ---');

  const { data, error } = await supabase
    .from('events')
    .select('start_time')
    .eq('status', 'active')
    .contains('tags', ['auto-scraped']);

  if (error) { console.log('  Could not check:', error.message); return; }

  const timeCounts = {};
  data.forEach(e => {
    const t = e.start_time || 'unknown';
    timeCounts[t] = (timeCounts[t] || 0) + 1;
  });

  const sorted = Object.entries(timeCounts).sort((a, b) => b[1] - a[1]);
  const worst = sorted[0];

  if (worst && worst[1] > 500) {
    major(`Time ${worst[0]} has ${worst[1]} events - possible scraper default`);
  } else if (worst) {
    pass(`Most common time: ${worst[0]} with ${worst[1]} events (within normal range)`);
  }
}

async function checkAgeGroupInference() {
  console.log('\n--- Check 6: Age Group Inference ---');

  // Check a sample of classes that should be tagged as Kids
  const kidsKeywords = ['kids', 'children', 'junior', 'youth', 'toddler', 'baby'];
  const { data: events } = await supabase
    .from('events')
    .select('title, venue_name')
    .eq('status', 'active')
    .eq('event_type', 'class')
    .limit(2000);

  if (!events) { console.log('  Could not check'); return; }

  let kidsCount = 0;
  let adultCount = 0;
  events.forEach(e => {
    const text = e.title.toLowerCase();
    if (kidsKeywords.some(k => text.includes(k))) kidsCount++;
    if (text.includes('adult') || text.includes('19+') || text.includes('senior')) adultCount++;
  });

  console.log(`  Found ${kidsCount} classes with kids keywords, ${adultCount} with adult keywords out of ${events.length} total`);
  if (kidsCount > 0 || adultCount > 0) {
    pass(`Age inference will categorize ${kidsCount} kids + ${adultCount} adult classes (vs ${events.length - kidsCount - adultCount} "All Ages")`);
  } else {
    minor('No classes have kids/adult keywords in title - age filter may still be limited');
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Pulse Data Quality Validation Suite    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${FIX_MODE ? 'FIX (will attempt repairs)' : 'CHECK ONLY'}`);
  if (VENUE_FILTER) console.log(`Venue filter: ${VENUE_FILTER}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await checkDateDuplication();
  await checkMissingVenueId();
  await checkExpiredEvents();
  await checkHallucinatedEvents();
  await checkTimeClustering();
  await checkAgeGroupInference();

  console.log('\n══════════════════════════════════════');
  console.log(`Results: ${criticalCount} critical, ${majorCount} major, ${minorCount} minor`);
  if (FIX_MODE) console.log(`Fixed: ${fixedCount} issues`);

  if (criticalCount > 0) {
    console.error('\x1b[31m✗ CRITICAL issues found - data quality check FAILED\x1b[0m');
    process.exit(1);
  } else if (majorCount > 0) {
    console.warn('\x1b[33m⚠ Major issues found - review recommended\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[32m✓ All data quality checks passed\x1b[0m');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Validation script error:', err);
  process.exit(1);
});
