// All dates/times in this app are in Squamish (Pacific) time, regardless of user's location.
//
// APPROACH: "fake-local" — Date objects store Pacific wall-clock values in the
// browser's local timezone.  getHours(), getDate(), getDay() all return Pacific
// values, and comparisons between getPacificNow() and pacificDate() are consistent.
// Display formatters that use { timeZone: PACIFIC_TZ } work correctly for Pacific
// users (the target audience).  Non-Pacific users may see slightly shifted times
// in display but all filtering and comparison logic remains correct.
export const PACIFIC_TZ = 'America/Vancouver';

/** Get current Date with Pacific wall-clock values (fake-local).
 *  getHours/getDate/getDay return Pacific values.
 *  Compare ONLY with other pacificDate() results. */
export function getPacificNow() {
  const pacificStr = new Date().toLocaleString('en-US', { timeZone: PACIFIC_TZ });
  return new Date(pacificStr);
}

/** Get today's date string (YYYY-MM-DD) in Pacific timezone */
export function getPacificDateStr() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

/** Create a Date with Pacific wall-clock values (fake-local).
 *  getHours() returns the Pacific hour, getDate() the Pacific date, etc.
 *  Consistent with getPacificNow() for comparisons and filtering. */
export function pacificDate(dateStr, timeStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}
