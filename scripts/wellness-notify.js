#!/usr/bin/env node
/**
 * Wellness Availability Notification Checker
 *
 * After each scrape run, checks pulse_availability_alerts
 * and creates notifications for users when matching slots appear.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAlerts() {
  console.log('🔔 Wellness Availability Alert Checker');
  console.log(`📅 ${new Date().toISOString()}\n`);

  // Get all active alerts
  const { data: alerts, error: alertErr } = await supabase
    .from('pulse_availability_alerts')
    .select('*')
    .eq('is_active', true);

  if (alertErr) {
    console.error('Error fetching alerts:', alertErr.message);
    return;
  }

  if (!alerts || alerts.length === 0) {
    console.log('📭 No active alerts');
    return;
  }

  console.log(`📋 Checking ${alerts.length} active alerts...\n`);

  const today = new Date().toISOString().split('T')[0];
  const todayDow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];

  let notificationCount = 0;

  for (const alert of alerts) {
    // Check if today matches preferred days (if specified)
    if (alert.preferred_days && alert.preferred_days.length > 0) {
      if (!alert.preferred_days.includes(todayDow)) continue;
    }

    // Build query for matching slots
    let query = supabase
      .from('pulse_availability_slots')
      .select('*, pulse_wellness_providers!inner(name, clinic_name, discipline, booking_url)')
      .eq('date', today)
      .eq('is_available', true);

    // Filter by provider if specified
    if (alert.provider_id) {
      query = query.eq('provider_id', alert.provider_id);
    }

    // Filter by discipline if specified
    if (alert.discipline) {
      query = query.eq('pulse_wellness_providers.discipline', alert.discipline);
    }

    // Filter by time range
    if (alert.preferred_time_range === 'morning') {
      query = query.lt('start_time', '12:00:00');
    } else if (alert.preferred_time_range === 'afternoon') {
      query = query.gte('start_time', '12:00:00').lt('start_time', '17:00:00');
    } else if (alert.preferred_time_range === 'evening') {
      query = query.gte('start_time', '17:00:00');
    }

    const { data: matchingSlots } = await query.limit(5);

    if (matchingSlots && matchingSlots.length > 0) {
      // Check if we already sent a notification for this alert today
      const { data: existingNotif } = await supabase
        .from('pulse_user_notifications')
        .select('id')
        .eq('user_id', alert.user_id)
        .eq('type', 'availability_alert')
        .gte('created_at', today)
        .limit(1);

      if (existingNotif && existingNotif.length > 0) {
        continue; // Already notified today
      }

      // Create notification
      const slot = matchingSlots[0];
      const provider = slot.pulse_wellness_providers;
      const timeStr = formatTime(slot.start_time);
      const slotsText = matchingSlots.length === 1
        ? `${provider.name} has an opening at ${timeStr}`
        : `${matchingSlots.length} openings found — earliest at ${timeStr}`;

      const { error: notifErr } = await supabase
        .from('pulse_user_notifications')
        .insert({
          user_id: alert.user_id,
          type: 'availability_alert',
          title: 'New Wellness Opening!',
          body: slotsText,
          data: {
            alert_id: alert.id,
            provider_id: slot.provider_id,
            provider_name: provider.name,
            clinic_name: provider.clinic_name,
            slot_date: today,
            slot_time: slot.start_time,
            booking_url: provider.booking_url,
            total_matches: matchingSlots.length,
          },
        });

      if (!notifErr) {
        notificationCount++;
        console.log(`  📬 Notified user ${alert.user_id.slice(0, 8)}... — ${slotsText}`);
      }
    }
  }

  console.log(`\n✅ Created ${notificationCount} notifications from ${alerts.length} alerts`);
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

checkAlerts().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
