/**
 * Strip HTML tags from a string, converting block elements to newlines
 * and decoding HTML entities.
 */
export function stripHtml(html, title) {
  if (!html) return '';
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '');

  // Decode HTML entities using a temp element if available, else manual
  const entityMap = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#039;': "'", '&apos;': "'", '&nbsp;': ' ',
    '&rsquo;': '\u2019', '&lsquo;': '\u2018',
    '&rdquo;': '\u201D', '&ldquo;': '\u201C',
    '&mdash;': '\u2014', '&ndash;': '\u2013',
    '&hellip;': '\u2026', '&bull;': '\u2022',
    '&copy;': '\u00A9', '&reg;': '\u00AE',
    '&trade;': '\u2122', '&deg;': '\u00B0',
  };
  text = text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => entityMap[entity] || entity);

  // Strip leading schedule date blocks (e.g. "Monday, February 23, 2026, 4:00 PM - 6:00 PM, ...")
  // These are comma-separated repeating date+time entries prepended by Amilia scraper
  text = text.replace(/^(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M\s*-\s*\d{1,2}:\d{2}\s+[AP]M[,\s]*)+/i, '');

  // Strip everything up to and including "Book now" (Amilia CTA that appears after metadata)
  text = text.replace(/^[\s\S]{0,300}?Book now\s*/i, '');

  // Strip "Instructor: Name" prefix if it's at the start
  text = text.replace(/^Instructor:\s*[^\n]{1,50}\s*/i, '');

  // Strip repeated event title from start of description
  if (title) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp('^' + escaped + '\\s*', 'i'), '');
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}
