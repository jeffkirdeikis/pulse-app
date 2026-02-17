/**
 * Format response time for display
 */
export function formatResponseTime(minutes) {
  if (!minutes) return null;
  if (minutes <= 30) return '~30 min';
  if (minutes <= 60) return '~1 hour';
  if (minutes <= 120) return '~2 hours';
  if (minutes <= 240) return '~4 hours';
  if (minutes <= 480) return 'same day';
  if (minutes <= 1440) return '~1 day';
  return `~${Math.round(minutes / 1440)} days`;
}
