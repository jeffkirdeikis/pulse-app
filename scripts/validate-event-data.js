#!/usr/bin/env node
/**
 * Event Data Quality Validator
 *
 * LAYER 3: Post-import validation
 *
 * Run this after any scraper import to detect and quarantine suspicious data.
 * Can be run manually or added to the scraping pipeline.
 *
 * Usage:
 *   node scripts/validate-event-data.js           # Check for issues
 *   node scripts/validate-event-data.js --fix     # Quarantine bad data
 *   node scripts/validate-event-data.js --delete  # Delete bad data (dangerous!)
 *
 * Checks performed:
 *   1. Event clustering (same date/time/venue > 3 events)
 *   2. Title = venue_name (business listings)
 *   3. Placeholder times (9:00 AM with auto-scraped tag)
 *   4. Holiday date mismatches
 *   5. Service/navigation text in titles
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { alertDataQualityIssues } from './lib/alerting.js';

// Load env manually (no dotenv dependency)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf8');
} catch (e) {
  // Try current directory
  try {
    envContent = readFileSync('.env.local', 'utf8');
  } catch (e2) {
    console.error('Could not find .env.local file');
  }
}
const envVars = {};
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) {
    envVars[key.trim()] = rest.join('=').trim();
  }
}

// Set env vars for alerting module
process.env.TELEGRAM_BOT_TOKEN = envVars.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
process.env.TELEGRAM_CHAT_ID = envVars.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const DELETE_MODE = args.includes('--delete');

if (!SUPABASE_KEY) {
  console.error('Error: VITE_SUPABASE_ANON_KEY not found in .env.local');
  process.exit(1);
}

async function fetchEvents() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=*&limit=1000`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  return response.json();
}

async function deleteEvents(ids) {
  if (ids.length === 0) return 0;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/events?id=in.(${ids.join(',')})`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete events: ${response.status}`);
  }

  const deleted = await response.json();
  return deleted.length;
}

async function quarantineEvents(events, reason) {
  if (events.length === 0) return 0;

  const quarantineRecords = events.map(event => ({
    original_data: event,
    rejection_reason: reason,
    source_scraper: event.tags?.find(t => t !== 'auto-scraped') || 'unknown',
  }));

  // Note: This requires the events_quarantine table to exist
  // If it doesn't, we'll just log instead
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/events_quarantine`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(quarantineRecords),
      }
    );

    if (response.ok) {
      const inserted = await response.json();
      return inserted.length;
    } else {
      console.warn('Warning: Could not quarantine events (table may not exist)');
      return 0;
    }
  } catch (error) {
    console.warn('Warning: Could not quarantine events:', error.message);
    return 0;
  }
}

// ============================================
// VALIDATION CHECKS
// ============================================

function checkClustering(events) {
  const clusters = {};

  for (const event of events) {
    const key = `${event.start_date}|${event.start_time}|${event.venue_name}`;
    if (!clusters[key]) {
      clusters[key] = [];
    }
    clusters[key].push(event);
  }

  const issues = [];
  for (const [key, clusterEvents] of Object.entries(clusters)) {
    if (clusterEvents.length > 3) {
      issues.push({
        type: 'CLUSTERING',
        severity: 'HIGH',
        message: `${clusterEvents.length} events at same date/time/venue`,
        key,
        events: clusterEvents,
      });
    }
  }

  return issues;
}

function checkTitleEqualsVenue(events) {
  const issues = [];

  for (const event of events) {
    if (event.title && event.venue_name &&
        event.title.toLowerCase() === event.venue_name.toLowerCase()) {
      issues.push({
        type: 'TITLE_EQUALS_VENUE',
        severity: 'HIGH',
        message: `Title equals venue_name: "${event.title}"`,
        events: [event],
      });
    }
  }

  return issues;
}

function checkPlaceholderTimes(events) {
  const issues = [];
  // 09:00 is suspicious placeholder, 00:00 means "time varies" (legitimate for classes)
  const placeholderTimes = ['09:00:00', '09:00'];

  for (const event of events) {
    // Skip classes with 00:00 - that's intentional "time varies"
    if (event.start_time === '00:00:00' && event.event_type === 'class') {
      continue;
    }

    if (placeholderTimes.includes(event.start_time) &&
        event.tags?.includes('auto-scraped')) {
      issues.push({
        type: 'PLACEHOLDER_TIME',
        severity: 'MEDIUM',
        message: `Placeholder time 9:00 AM: "${event.title}"`,
        events: [event],
      });
    }
  }

  return issues;
}

function checkHolidayDates(events) {
  const issues = [];

  const holidayRules = {
    'christmas': { month: 12 },
    'new year\'s day': { month: 1, day: 1 },
    'boxing day': { month: 12, day: 26 },
    'halloween': { month: 10 },
    'valentine': { month: 2 },
  };

  for (const event of events) {
    if (!event.title || !event.start_date) continue;

    const titleLower = event.title.toLowerCase();
    const date = new Date(event.start_date);
    const month = date.getMonth() + 1;
    const day = date.getDate();

    for (const [holiday, rule] of Object.entries(holidayRules)) {
      if (titleLower.includes(holiday)) {
        let isValid = true;

        if (rule.month && month !== rule.month) {
          isValid = false;
        }
        if (rule.day && day !== rule.day) {
          isValid = false;
        }

        if (!isValid) {
          issues.push({
            type: 'HOLIDAY_DATE_MISMATCH',
            severity: 'HIGH',
            message: `${holiday} event on wrong date: "${event.title}" (${event.start_date})`,
            events: [event],
          });
        }
      }
    }
  }

  return issues;
}

function checkForbiddenTitles(events) {
  const issues = [];

  const forbiddenPatterns = [
    /^work with us$/i,
    /^our (professional )?team$/i,
    /^contact us$/i,
    /^register for programs?$/i,
    /^(legal )?advocacy$/i,
    /^child care$/i,
    /^housing services?$/i,
    /^workshop description$/i,
    /^counselling$/i,
    /^senior'?s? services?$/i,
  ];

  for (const event of events) {
    if (!event.title) continue;

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(event.title)) {
        issues.push({
          type: 'FORBIDDEN_TITLE',
          severity: 'HIGH',
          message: `Service/navigation text as title: "${event.title}"`,
          events: [event],
        });
        break;
      }
    }
  }

  return issues;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('='.repeat(60));
  console.log('EVENT DATA QUALITY VALIDATOR');
  console.log('='.repeat(60));
  console.log(`Mode: ${DELETE_MODE ? 'DELETE' : FIX_MODE ? 'FIX (quarantine)' : 'CHECK ONLY'}`);
  console.log('');

  // Fetch all events
  console.log('Fetching events from database...');
  const events = await fetchEvents();
  console.log(`Found ${events.length} events`);
  console.log('');

  // Run all checks
  const allIssues = [
    ...checkClustering(events),
    ...checkTitleEqualsVenue(events),
    ...checkPlaceholderTimes(events),
    ...checkHolidayDates(events),
    ...checkForbiddenTitles(events),
  ];

  // Group by severity
  const highSeverity = allIssues.filter(i => i.severity === 'HIGH');
  const mediumSeverity = allIssues.filter(i => i.severity === 'MEDIUM');

  // Report
  console.log('ISSUES FOUND:');
  console.log('-'.repeat(60));

  if (allIssues.length === 0) {
    console.log('✅ No issues found! Data quality is good.');
    return;
  }

  console.log(`🔴 HIGH severity: ${highSeverity.length}`);
  console.log(`🟡 MEDIUM severity: ${mediumSeverity.length}`);
  console.log('');

  // Detail each issue type
  const issuesByType = {};
  for (const issue of allIssues) {
    if (!issuesByType[issue.type]) {
      issuesByType[issue.type] = [];
    }
    issuesByType[issue.type].push(issue);
  }

  for (const [type, issues] of Object.entries(issuesByType)) {
    console.log(`\n${type} (${issues.length} issues):`);
    for (const issue of issues.slice(0, 5)) {  // Show first 5
      console.log(`  - ${issue.message}`);
    }
    if (issues.length > 5) {
      console.log(`  ... and ${issues.length - 5} more`);
    }
  }

  // Send Telegram alert for HIGH severity issues
  if (highSeverity.length > 0) {
    console.log('\n📱 Sending Telegram alert...');
    const alertSent = await alertDataQualityIssues(allIssues, events.length);
    if (alertSent) {
      console.log('✅ Alert sent to Telegram');
    } else {
      console.log('⚠️  Alert not sent (Telegram not configured)');
    }
  }

  // Collect all bad event IDs
  const badEventIds = new Set();
  for (const issue of highSeverity) {
    for (const event of issue.events) {
      badEventIds.add(event.id);
    }
  }

  console.log('');
  console.log('-'.repeat(60));
  console.log(`Total events to fix: ${badEventIds.size}`);

  // Take action if requested
  if (DELETE_MODE && badEventIds.size > 0) {
    console.log('');
    console.log('DELETING bad events...');
    const deleted = await deleteEvents([...badEventIds]);
    console.log(`✅ Deleted ${deleted} events`);
  } else if (FIX_MODE && highSeverity.length > 0) {
    console.log('');
    console.log('QUARANTINING bad events...');

    let totalQuarantined = 0;
    for (const issue of highSeverity) {
      const count = await quarantineEvents(issue.events, `${issue.type}: ${issue.message}`);
      totalQuarantined += count;
    }

    if (totalQuarantined > 0) {
      // Delete from main table after quarantining
      const deleted = await deleteEvents([...badEventIds]);
      console.log(`✅ Quarantined and removed ${deleted} events`);
    } else {
      console.log('⚠️  Could not quarantine (table may not exist). Run migration first.');
      console.log('   To delete directly, use: node scripts/validate-event-data.js --delete');
    }
  } else if (badEventIds.size > 0) {
    console.log('');
    console.log('Run with --fix to quarantine bad data, or --delete to remove directly.');
  }

  console.log('');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
