/**
 * Event Data Validator
 *
 * LAYER 2: Scraper-level validation
 *
 * This module validates event data BEFORE insertion to catch bad data early.
 * All scrapers should use this before inserting events.
 *
 * Usage:
 *   import { validateEvent, ValidationError } from './lib/event-validator.js';
 *
 *   try {
 *     const validatedEvent = validateEvent(eventData, 'my-scraper');
 *     await insertEvent(validatedEvent);
 *   } catch (error) {
 *     if (error instanceof ValidationError) {
 *       console.warn(`Skipping event: ${error.message}`);
 *       await quarantineEvent(eventData, error.message, 'my-scraper');
 *     }
 *   }
 */

// Common placeholder values that indicate scraper failed to extract real data
const PLACEHOLDER_TIMES = ['09:00', '09:00:00', '00:00', '00:00:00', '12:00', '12:00:00'];
const PLACEHOLDER_DATES = ['2026-02-06', '2026-01-01', '2000-01-01'];

// Service/navigation text that should NEVER be event titles
const FORBIDDEN_TITLE_PATTERNS = [
  /^work with us$/i,
  /^our (professional )?team$/i,
  /^contact us$/i,
  /^register for programs?$/i,
  /^(legal )?advocacy$/i,
  /^child care$/i,
  /^housing services?$/i,
  /^workshop description$/i,
  /^counselling$/i,
  /^senior'?s? services?$/i,
  /^family and parenting$/i,
  /^adult programs?$/i,
  /^our services?$/i,
  /^online coaching$/i,
  /^scheduled live event$/i,
];

// Additional patterns that AI commonly hallucinates as event titles
const AI_HALLUCINATION_PATTERNS = [
  /^(morning|evening|weekend|daily)\s+(yoga|fitness|workout|exercise)$/i,
  /^(yoga|pilates|zumba|spin|hiit)\s+(class|session)$/i,
  /^(beginner|intermediate|advanced)\s+(class|session|workshop)$/i,
  /^(group|private|personal)\s+(training|session|class)$/i,
  /^open\s+(gym|studio|mat|swim)$/i,
  /^free\s+(trial|class|session|consultation)$/i,
  /^(kids|children'?s?|youth|teen)\s+(program|class|camp)$/i,
  /^(happy hour|lunch special|dinner special|daily special)$/i,
  /^(grand opening|now open|coming soon|new location)$/i,
  /^(electrical|plumbing|roofing|hvac)\s+(service|repair|installation|wiring)/i,
  /^(haircut|manicure|pedicure|facial|massage)\s*(special)?$/i,
];

// Holiday keywords and their required date ranges
const HOLIDAY_RULES = {
  'christmas': { month: 12, days: [1, 31] },  // December only
  'new year\'s day': { month: 1, day: 1 },
  'new years day': { month: 1, day: 1 },
  'boxing day': { month: 12, day: 26 },
  'halloween': { month: 10, days: [1, 31] },  // October only
  'thanksgiving': { month: 10, days: [1, 31] },  // October in Canada
  'valentine': { month: 2, days: [1, 28] },  // February only
  'easter': { month: [3, 4], days: [1, 30] },  // March or April
  'st patrick': { month: 3, day: 17 },
  'canada day': { month: 7, day: 1 },
  'remembrance day': { month: 11, day: 11 },
};

class ValidationError extends Error {
  constructor(message, code, eventData) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.eventData = eventData;
  }
}

/**
 * Validates an event object before database insertion
 *
 * @param {Object} event - The event data to validate
 * @param {string} scraperName - Name of the scraper for logging
 * @returns {Object} - Validated and cleaned event data
 * @throws {ValidationError} - If validation fails
 */
function validateEvent(event, scraperName = 'unknown') {
  const errors = [];

  // ==========================================
  // REQUIRED FIELDS
  // ==========================================

  if (!event.title || typeof event.title !== 'string' || event.title.trim().length === 0) {
    throw new ValidationError('Missing or empty title', 'MISSING_TITLE', event);
  }

  if (!event.start_date) {
    throw new ValidationError('Missing start_date', 'MISSING_DATE', event);
  }

  if (!event.start_time) {
    throw new ValidationError('Missing start_time', 'MISSING_TIME', event);
  }

  if (!event.venue_name || typeof event.venue_name !== 'string') {
    throw new ValidationError('Missing venue_name', 'MISSING_VENUE', event);
  }

  // ==========================================
  // TITLE VALIDATION
  // ==========================================

  const title = event.title.trim();

  // Check title = venue_name (business listing, not event)
  if (title.toLowerCase() === event.venue_name.toLowerCase()) {
    throw new ValidationError(
      `Title equals venue_name: "${title}" - this is a business listing, not an event`,
      'TITLE_EQUALS_VENUE',
      event
    );
  }

  // Check for forbidden service/navigation text
  for (const pattern of FORBIDDEN_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      throw new ValidationError(
        `Title matches forbidden pattern: "${title}" - this is service/navigation text, not an event`,
        'FORBIDDEN_TITLE',
        event
      );
    }
  }

  // Check for very short titles (likely garbage)
  if (title.length < 3) {
    throw new ValidationError(
      `Title too short: "${title}" - minimum 3 characters`,
      'TITLE_TOO_SHORT',
      event
    );
  }

  // Check for very long titles (likely scraped paragraph)
  if (title.length > 200) {
    throw new ValidationError(
      `Title too long: "${title.substring(0, 50)}..." - maximum 200 characters`,
      'TITLE_TOO_LONG',
      event
    );
  }

  // ==========================================
  // DATE VALIDATION
  // ==========================================

  const dateStr = typeof event.start_date === 'string'
    ? event.start_date
    : event.start_date.toISOString().split('T')[0];

  // Check for placeholder dates
  if (PLACEHOLDER_DATES.includes(dateStr)) {
    throw new ValidationError(
      `Placeholder date detected: ${dateStr}`,
      'PLACEHOLDER_DATE',
      event
    );
  }

  // Parse date
  const eventDate = new Date(dateStr);
  if (isNaN(eventDate.getTime())) {
    throw new ValidationError(
      `Invalid date format: ${dateStr}`,
      'INVALID_DATE',
      event
    );
  }

  // Check for past dates (more than 1 day old)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (eventDate < yesterday) {
    throw new ValidationError(
      `Past date: ${dateStr} - events must be in the future`,
      'PAST_DATE',
      event
    );
  }

  // Check for dates too far in future (likely garbage)
  const twoYearsFromNow = new Date();
  twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
  if (eventDate > twoYearsFromNow) {
    throw new ValidationError(
      `Date too far in future: ${dateStr} - maximum 2 years ahead`,
      'DATE_TOO_FAR',
      event
    );
  }

  // ==========================================
  // HOLIDAY DATE VALIDATION
  // ==========================================

  const titleLower = title.toLowerCase();
  const month = eventDate.getMonth() + 1;  // JavaScript months are 0-indexed
  const day = eventDate.getDate();

  for (const [holiday, rule] of Object.entries(HOLIDAY_RULES)) {
    if (titleLower.includes(holiday)) {
      let isValid = false;

      if (rule.day) {
        // Specific day required
        isValid = month === rule.month && day === rule.day;
      } else if (rule.days) {
        // Day range within month
        const monthMatch = Array.isArray(rule.month)
          ? rule.month.includes(month)
          : month === rule.month;
        isValid = monthMatch && day >= rule.days[0] && day <= rule.days[1];
      }

      if (!isValid) {
        throw new ValidationError(
          `Holiday date mismatch: "${title}" on ${dateStr} - ${holiday} events should be in the correct period`,
          'HOLIDAY_DATE_MISMATCH',
          event
        );
      }
    }
  }

  // ==========================================
  // TIME VALIDATION
  // ==========================================

  const timeStr = event.start_time;

  // Check for placeholder times
  if (PLACEHOLDER_TIMES.includes(timeStr)) {
    // Instead of rejecting, flag for review
    console.warn(`[${scraperName}] WARNING: Placeholder time detected for "${title}": ${timeStr}`);
    // Add a tag to mark this for review
    event.tags = event.tags || [];
    if (!event.tags.includes('needs-time-review')) {
      event.tags.push('needs-time-review');
    }
  }

  // Validate time format (HH:MM or HH:MM:SS)
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/;
  if (!timeRegex.test(timeStr)) {
    throw new ValidationError(
      `Invalid time format: ${timeStr} - expected HH:MM or HH:MM:SS`,
      'INVALID_TIME',
      event
    );
  }

  // ==========================================
  // RETURN CLEANED DATA
  // ==========================================

  return {
    ...event,
    title: title,
    start_date: dateStr,
    start_time: timeStr.length === 5 ? `${timeStr}:00` : timeStr,  // Normalize to HH:MM:SS
    tags: [...(event.tags || []), `validated-by-${scraperName}`],
  };
}

/**
 * Batch validate events and separate valid from invalid
 *
 * @param {Array} events - Array of event objects
 * @param {string} scraperName - Name of the scraper
 * @returns {Object} - { valid: [], invalid: [] }
 */
function validateBatch(events, scraperName = 'unknown') {
  const valid = [];
  const invalid = [];

  for (const event of events) {
    try {
      const validatedEvent = validateEvent(event, scraperName);
      valid.push(validatedEvent);
    } catch (error) {
      if (error instanceof ValidationError) {
        invalid.push({
          event,
          error: error.message,
          code: error.code,
        });
      } else {
        throw error;  // Re-throw unexpected errors
      }
    }
  }

  console.log(`[${scraperName}] Validation complete: ${valid.length} valid, ${invalid.length} invalid`);

  if (invalid.length > 0) {
    console.log(`[${scraperName}] Invalid events:`);
    for (const { event, error, code } of invalid) {
      console.log(`  - [${code}] ${event.title || 'NO TITLE'}: ${error}`);
    }
  }

  return { valid, invalid };
}

/**
 * Validate an AI-extracted event with additional anti-hallucination checks.
 * This is a final safety net on top of the source text verification in verified-extractor.js.
 *
 * @param {Object} event - The event data to validate
 * @param {string} pageText - The source page text for verification
 * @returns {Object} - { valid: boolean, reason: string|null }
 */
function validateAIExtracted(event, pageText) {
  const title = (event.title || '').trim();

  // Check AI hallucination patterns
  for (const pattern of AI_HALLUCINATION_PATTERNS) {
    if (pattern.test(title)) {
      return {
        valid: false,
        reason: `Title matches AI hallucination pattern: "${title}"`
      };
    }
  }

  // Title should not be a generic single word
  if (title.split(/\s+/).length === 1 && title.length < 10) {
    return {
      valid: false,
      reason: `Title too generic (single short word): "${title}"`
    };
  }

  // If pageText provided, verify title appears in it
  if (pageText) {
    const normalizedPage = pageText.toLowerCase().replace(/[\s\n\r\t]+/g, ' ');
    const normalizedTitle = title.toLowerCase();

    // Check for exact or near-exact match in page text
    const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
    if (titleWords.length > 0) {
      let matchCount = 0;
      for (const word of titleWords) {
        if (normalizedPage.includes(word)) matchCount++;
      }
      const matchRatio = matchCount / titleWords.length;
      if (matchRatio < 0.8) {
        return {
          valid: false,
          reason: `Title "${title}" not found in page text (${Math.round(matchRatio * 100)}% word match)`
        };
      }
    }
  }

  return { valid: true, reason: null };
}

/**
 * Check for suspicious clustering (same date/time/venue)
 *
 * @param {Array} events - Array of events to check
 * @returns {Object} - { clean: [], suspicious: [] }
 */
function detectClustering(events) {
  const clusters = {};

  for (const event of events) {
    const key = `${event.start_date}|${event.start_time}|${event.venue_name}`;
    if (!clusters[key]) {
      clusters[key] = [];
    }
    clusters[key].push(event);
  }

  const clean = [];
  const suspicious = [];

  for (const [key, clusterEvents] of Object.entries(clusters)) {
    if (clusterEvents.length > 3) {
      console.warn(`[CLUSTERING] Suspicious: ${clusterEvents.length} events at ${key}`);
      suspicious.push(...clusterEvents);
    } else {
      clean.push(...clusterEvents);
    }
  }

  return { clean, suspicious };
}

export {
  validateEvent,
  validateBatch,
  validateAIExtracted,
  detectClustering,
  ValidationError,
  PLACEHOLDER_TIMES,
  PLACEHOLDER_DATES,
  FORBIDDEN_TITLE_PATTERNS,
  AI_HALLUCINATION_PATTERNS,
  HOLIDAY_RULES,
};
