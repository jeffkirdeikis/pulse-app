// All dates/times in this app are in Squamish (Pacific) time, regardless of user's location.
export const PACIFIC_TZ = 'America/Vancouver';

/** Format options for displaying dates/times always in Pacific timezone */
export const PACIFIC_DATE_OPTS = { timeZone: PACIFIC_TZ };

/** Get current Date adjusted to Pacific timezone */
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

/** Create a Date object for a Pacific date + time (from DB fields) */
export function pacificDate(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
  const fakeLocal = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const localStr = fakeLocal.toLocaleString('en-US', { timeZone: PACIFIC_TZ });
  const pacificEquiv = new Date(localStr);
  const offset = fakeLocal.getTime() - pacificEquiv.getTime();
  return new Date(fakeLocal.getTime() + offset);
}
