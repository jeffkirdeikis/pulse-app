#!/usr/bin/env node

/**
 * Scraper Health Check
 *
 * Queries the scraping_sources table for issues:
 * - Sources with 3+ consecutive failures
 * - Sources not scraped in 48+ hours
 * - Sources where last scrape returned 0 classes
 *
 * Run:   node scripts/scraper-health-check.js
 * Alert: node scripts/scraper-health-check.js --alert
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';
import { sendTelegramAlert } from './lib/alerting.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();
const sendAlerts = process.argv.includes('--alert');

async function fetchSources() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/scraping_sources?is_active=eq.true&select=name,booking_system,last_scraped,last_scrape_success,last_class_count,last_error,consecutive_failures`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch sources: HTTP ${response.status}`);
  }

  return response.json();
}

function checkHealth(sources) {
  const issues = [];
  const now = new Date();

  for (const source of sources) {
    // Skip website-verified sources (those are AI-extracted, different cadence)
    if (source.booking_system === 'website-verified') continue;

    const failures = source.consecutive_failures || 0;
    const lastScraped = source.last_scraped ? new Date(source.last_scraped) : null;
    const hoursSinceLastScrape = lastScraped ? (now - lastScraped) / (1000 * 60 * 60) : Infinity;

    // HIGH: 3+ consecutive failures
    if (failures >= 3) {
      issues.push({
        severity: 'HIGH',
        source: source.name,
        message: `${failures} consecutive failures. Last error: ${source.last_error || 'unknown'}`,
        type: 'consecutive-failures'
      });
    }

    // HIGH: Not scraped in 48+ hours
    if (hoursSinceLastScrape > 48) {
      issues.push({
        severity: 'HIGH',
        source: source.name,
        message: lastScraped
          ? `Last scraped ${Math.round(hoursSinceLastScrape)}h ago (${lastScraped.toISOString()})`
          : 'Never scraped',
        type: 'stale'
      });
    }

    // MEDIUM: Last scrape succeeded but returned 0 classes
    if (source.last_scrape_success && (source.last_class_count === 0 || source.last_class_count === null)) {
      issues.push({
        severity: 'MEDIUM',
        source: source.name,
        message: `Last scrape "succeeded" with 0 classes — possible silent failure`,
        type: 'zero-result'
      });
    }

    // MEDIUM: Not scraped in 24+ hours (but less than 48)
    if (hoursSinceLastScrape > 24 && hoursSinceLastScrape <= 48) {
      issues.push({
        severity: 'MEDIUM',
        source: source.name,
        message: `Last scraped ${Math.round(hoursSinceLastScrape)}h ago`,
        type: 'stale-warning'
      });
    }
  }

  return issues;
}

function printReport(sources, issues) {
  console.log('\n' + '='.repeat(60));
  console.log('🏥 SCRAPER HEALTH CHECK');
  console.log('='.repeat(60));
  console.log(`Checked: ${sources.filter(s => s.booking_system !== 'website-verified').length} active sources`);
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));

  const highIssues = issues.filter(i => i.severity === 'HIGH');
  const medIssues = issues.filter(i => i.severity === 'MEDIUM');

  if (issues.length === 0) {
    console.log('\n✅ All sources healthy!\n');
  } else {
    if (highIssues.length > 0) {
      console.log(`\n🔴 HIGH SEVERITY (${highIssues.length}):`);
      for (const issue of highIssues) {
        console.log(`   • [${issue.type}] ${issue.source}: ${issue.message}`);
      }
    }
    if (medIssues.length > 0) {
      console.log(`\n🟡 MEDIUM SEVERITY (${medIssues.length}):`);
      for (const issue of medIssues) {
        console.log(`   • [${issue.type}] ${issue.source}: ${issue.message}`);
      }
    }
  }

  // Source status table
  console.log('\n📋 Source Status:');
  for (const source of sources) {
    if (source.booking_system === 'website-verified') continue;
    const status = source.last_scrape_success ? '✅' : '❌';
    const classes = source.last_class_count ?? '?';
    const failures = source.consecutive_failures || 0;
    const lastScraped = source.last_scraped
      ? new Date(source.last_scraped).toLocaleString()
      : 'never';
    console.log(`   ${status} ${source.name} — ${classes} classes, ${failures} failures, last: ${lastScraped}`);
  }

  console.log('\n' + '='.repeat(60));
}

async function main() {
  const sources = await fetchSources();
  const issues = checkHealth(sources);

  printReport(sources, issues);

  const highIssues = issues.filter(i => i.severity === 'HIGH');

  // Send Telegram alert if --alert flag and there are issues
  if (sendAlerts && issues.length > 0) {
    const lines = ['🏥 Scraper Health Check'];
    if (highIssues.length > 0) {
      lines.push(`\n🔴 ${highIssues.length} HIGH severity issues:`);
      highIssues.forEach(i => lines.push(`  • ${i.source}: ${i.message}`));
    }
    const medIssues = issues.filter(i => i.severity === 'MEDIUM');
    if (medIssues.length > 0) {
      lines.push(`\n🟡 ${medIssues.length} MEDIUM severity issues:`);
      medIssues.forEach(i => lines.push(`  • ${i.source}: ${i.message}`));
    }
    await sendTelegramAlert(lines.join('\n'));
    console.log('\n📱 Telegram alert sent.');
  }

  // Exit with code 1 if any HIGH severity issues (for CI usage)
  if (highIssues.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});
