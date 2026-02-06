#!/usr/bin/env node
/**
 * Wellness Availability Cleanup
 *
 * Removes old availability slots and cleans up stale data.
 * Run after each scrape cycle.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanup() {
  console.log('🧹 Wellness Availability Cleanup');
  console.log(`📅 ${new Date().toISOString()}\n`);

  const today = new Date().toISOString().split('T')[0];

  // 1. Delete slots older than yesterday
  const { data: deleted, error: deleteErr } = await supabase
    .from('pulse_availability_slots')
    .delete()
    .lt('date', today)
    .select('id');

  if (deleteErr) {
    console.error('Delete error:', deleteErr.message);
  } else {
    console.log(`  🗑️ Removed ${deleted?.length || 0} expired slots`);
  }

  // 2. Clean up old scrape logs (keep last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldLogs, error: logErr } = await supabase
    .from('pulse_scrape_log')
    .delete()
    .lt('created_at', weekAgo)
    .select('id');

  if (logErr) {
    console.error('Log cleanup error:', logErr.message);
  } else {
    console.log(`  🗑️ Removed ${oldLogs?.length || 0} old scrape logs`);
  }

  // 3. Clean up old read notifications (keep last 30 days)
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldNotifs, error: notifErr } = await supabase
    .from('pulse_user_notifications')
    .delete()
    .eq('is_read', true)
    .lt('created_at', monthAgo)
    .select('id');

  if (notifErr) {
    console.error('Notification cleanup error:', notifErr.message);
  } else {
    console.log(`  🗑️ Removed ${oldNotifs?.length || 0} old notifications`);
  }

  console.log('\n✅ Cleanup complete');
}

cleanup().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
