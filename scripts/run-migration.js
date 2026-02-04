#!/usr/bin/env node

/**
 * Run database migration for booking & messaging system
 * Usage: node scripts/run-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('='.repeat(60));
  console.log('PULSE DATABASE MIGRATION - Booking & Messaging System');
  console.log('='.repeat(60));

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/004_booking_messaging_system.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('\nMigration file loaded. Executing...\n');

  // Split into individual statements
  const statements = sql
    .split(/;[\s]*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt || stmt.length < 5) continue;

    // Skip certain statements that need special handling
    const firstLine = stmt.split('\n')[0].toLowerCase();

    try {
      // Use rpc to execute SQL (requires a helper function in the database)
      // Since we can't run raw SQL via REST, we'll try to use the postgres connection
      const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' });

      if (error) {
        // Try alternative approach - just log for manual execution
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.log(`  Statement ${i + 1}: Needs manual execution (RPC not available)`);
          errorCount++;
        } else {
          throw error;
        }
      } else {
        successCount++;
        process.stdout.write('.');
      }
    } catch (err) {
      errorCount++;
      // Don't fail on expected errors like "already exists"
      if (!err.message?.includes('already exists') &&
          !err.message?.includes('duplicate key')) {
        console.log(`\n  Warning at statement ${i + 1}: ${err.message?.slice(0, 100)}`);
      }
    }
  }

  console.log('\n');
  console.log('='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Statements processed: ${statements.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors/Skipped: ${errorCount}`);
  console.log('');

  if (errorCount > 0) {
    console.log('NOTE: Some statements may need manual execution.');
    console.log('Please run the full migration in Supabase Dashboard:');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Paste contents of: supabase/migrations/004_booking_messaging_system.sql');
    console.log('5. Click "Run"');
  }
}

runMigration().catch(console.error);
