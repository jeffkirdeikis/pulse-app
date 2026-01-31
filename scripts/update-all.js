#!/usr/bin/env node

/**
 * Master script to run all data updates
 * Run: node scripts/update-all.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 PULSE DATA UPDATE\n');
console.log('='.repeat(60));
console.log(new Date().toLocaleString());
console.log('='.repeat(60) + '\n');

const scripts = [
  { name: 'Google Reviews', file: 'update-google-data.js' },
  { name: 'Events Scraper', file: 'scrape-events.js' },
  { name: 'Deals Scraper', file: 'scrape-deals.js' }
];

async function runScript(script) {
  console.log(`\n📦 Running: ${script.name}`);
  console.log('-'.repeat(40));

  try {
    execSync(`node ${path.join(__dirname, script.file)}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`✅ ${script.name} completed\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${script.name} failed: ${error.message}\n`);
    return false;
  }
}

async function main() {
  let successful = 0;
  let failed = 0;

  for (const script of scripts) {
    const success = await runScript(script);
    if (success) successful++;
    else failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
