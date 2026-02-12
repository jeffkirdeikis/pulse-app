#!/usr/bin/env node

/**
 * Comprehensive test for the scraping system
 * Tests: AI Extraction, Source Discovery, Source Verification
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Load env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, passed, details = '') {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}: ${details}`);
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 SCRAPING SYSTEM TEST SUITE');
  console.log('='.repeat(60) + '\n');

  // Test 1: Database connection
  try {
    const { data, error } = await supabase.from('events').select('count').limit(1);
    test('Database connection', !error, error?.message);
  } catch (e) {
    test('Database connection', false, e.message);
  }

  // Test 2: discovered_sources table exists
  try {
    const { data, error } = await supabase.from('discovered_sources').select('count').limit(1);
    test('discovered_sources table exists', !error, error?.message);
  } catch (e) {
    test('discovered_sources table exists', false, e.message);
  }

  // Test 3: events table has verification columns
  try {
    const { data, error } = await supabase
      .from('events')
      .select('confidence_score,verified_at,verification_sources')
      .limit(1);
    test('events verification columns exist', !error, error?.message);
  } catch (e) {
    test('events verification columns exist', false, e.message);
  }

  // Test 4: AI extractor module loads
  try {
    const mod = await import('./lib/ai-extractor.js');
    const hasExports = mod.extractEventsWithAI && mod.validateEventWithAI;
    test('AI extractor module loads', hasExports, 'Missing exports');
  } catch (e) {
    test('AI extractor module loads', false, e.message);
  }

  // Test 5: Source verification module loads
  try {
    const mod = await import('./lib/source-verification.js');
    const hasExports = mod.verifyEvent && mod.SOURCE_TRUST;
    test('Source verification module loads', hasExports, 'Missing exports');
  } catch (e) {
    test('Source verification module loads', false, e.message);
  }

  // Test 6: Mindbody API accessible
  try {
    const url = 'https://widgets.mindbodyonline.com/widgets/schedules/189264/load_markup?options%5Bstart_date%5D=2026-02-04';
    const res = await fetch(url);
    const data = await res.json();
    test('Mindbody API accessible', !!data.class_sessions, 'No class_sessions');
  } catch (e) {
    test('Mindbody API accessible', false, e.message);
  }

  // Test 7: Can insert to discovered_sources
  try {
    const { error } = await supabase
      .from('discovered_sources')
      .upsert({
        url: 'https://test-' + Date.now() + '.example.com',
        title: 'Test Source',
        status: 'test',
        discovered_at: new Date().toISOString()
      });
    test('Can insert to discovered_sources', !error, error?.message);
  } catch (e) {
    test('Can insert to discovered_sources', false, e.message);
  }

  // Test 8: Classes exist in database
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('event_type', 'class')
      .limit(1);
    test('Classes exist in database', data && data.length > 0, 'No classes found');
  } catch (e) {
    test('Classes exist in database', false, e.message);
  }

  // Test 9: Shala Yoga classes exist
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('venue_name', 'Shala Yoga')
      .limit(1);
    test('Shala Yoga classes scraped', data && data.length > 0, 'No Shala Yoga classes');
  } catch (e) {
    test('Shala Yoga classes scraped', false, e.message);
  }

  // Test 10: Check ANTHROPIC_API_KEY status
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  test('ANTHROPIC_API_KEY configured', hasApiKey, 'Add to .env.local for AI features');

  // Cleanup test data
  await supabase.from('discovered_sources').delete().eq('status', 'test');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}/${results.tests.length}`);
  console.log(`Failed: ${results.failed}/${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  } else {
    console.log('\n🎉 All tests passed!');
  }

  if (!hasApiKey) {
    console.log('\n📝 NOTE: Add ANTHROPIC_API_KEY to .env.local for full AI features:');
    console.log('   ANTHROPIC_API_KEY=sk-ant-...');
  }

  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);
