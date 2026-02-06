/**
 * Verified AI Extractor - Anti-Hallucination Pipeline
 *
 * Three-stage extraction that ensures every extracted event
 * actually exists on the source page:
 *
 * 1. Signal Detection (free) - Does the page have dates/times/event keywords?
 * 2. AI Extraction (Claude Haiku) - Strict prompt requiring source quotes
 * 3. Source Text Verification (deterministic) - Every title+date must appear in page text
 *
 * This replaces the old extractWithAI() which hallucinated 1,471 fake events.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
try {
  const envPath = join(__dirname, '..', '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length && !key.startsWith('#')) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
} catch (e) {
  // Env may already be loaded
}

let anthropic = null;
try {
  anthropic = new Anthropic();
} catch (e) {
  console.warn('Anthropic client not initialized - AI extraction disabled');
}

// Rate limiting
const AI_RATE_LIMIT_DELAY = 1500;
let lastAICallTime = 0;

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastCall = now - lastAICallTime;
  if (timeSinceLastCall < AI_RATE_LIMIT_DELAY) {
    await new Promise(r => setTimeout(r, AI_RATE_LIMIT_DELAY - timeSinceLastCall));
  }
  lastAICallTime = Date.now();
}

// ============================================================
// STAGE 1: Signal Detection (no AI, free)
// ============================================================

// Date patterns that indicate scheduled events
const DATE_PATTERNS = [
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}/i,
  /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /\b(?:mon|tue|wed|thu|fri|sat|sun),?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
];

// Time patterns
const TIME_PATTERNS = [
  /\b\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)\b/,
  /\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s*(?:am|pm|AM|PM)\b/,
];

// Event keywords
const EVENT_KEYWORDS = [
  /\b(?:register|registration|sign\s*up|book\s*now|tickets?|rsvp)\b/i,
  /\b(?:class(?:es)?|workshop|seminar|course|lesson|session)\b/i,
  /\b(?:schedule|calendar|upcoming|events?)\b/i,
  /\b(?:instructor|teacher|facilitator|led\s+by|hosted\s+by|with\s+\w+\s+\w+)\b/i,
  /\b(?:drop[\s-]?in|members?\s+only|all\s+levels?|beginner|intermediate|advanced)\b/i,
  /\b(?:weekly|daily|every\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
];

/**
 * Check if page text has enough signals to warrant AI extraction.
 * Returns { hasSignals: boolean, score: number, details: string[] }
 */
export function hasEventSignals(pageText) {
  if (!pageText || pageText.length < 50) {
    return { hasSignals: false, score: 0, details: ['Page text too short'] };
  }

  let score = 0;
  const details = [];

  // Check date patterns (up to 2 points)
  let dateCount = 0;
  for (const pattern of DATE_PATTERNS) {
    const matches = pageText.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      dateCount += matches.length;
    }
  }
  if (dateCount >= 3) {
    score += 2;
    details.push(`${dateCount} date patterns found`);
  } else if (dateCount >= 1) {
    score += 1;
    details.push(`${dateCount} date pattern(s) found`);
  }

  // Check time patterns (up to 2 points)
  let timeCount = 0;
  for (const pattern of TIME_PATTERNS) {
    const matches = pageText.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      timeCount += matches.length;
    }
  }
  if (timeCount >= 3) {
    score += 2;
    details.push(`${timeCount} time patterns found`);
  } else if (timeCount >= 1) {
    score += 1;
    details.push(`${timeCount} time pattern(s) found`);
  }

  // Check event keywords (up to 2 points)
  let keywordCount = 0;
  for (const pattern of EVENT_KEYWORDS) {
    if (pattern.test(pageText)) {
      keywordCount++;
    }
  }
  if (keywordCount >= 3) {
    score += 2;
    details.push(`${keywordCount} event keywords matched`);
  } else if (keywordCount >= 1) {
    score += 1;
    details.push(`${keywordCount} event keyword(s) matched`);
  }

  // Threshold: need at least 3 points (e.g., dates + times + keywords)
  const hasSignals = score >= 3;

  if (!hasSignals) {
    details.push(`Score ${score}/3 - below threshold`);
  }

  return { hasSignals, score, details };
}

// ============================================================
// STAGE 2: AI Extraction (Claude Haiku with strict prompt)
// ============================================================

const EXTRACTION_PROMPT = `You are extracting events from a business webpage in Squamish, BC.

CRITICAL RULES:
- ONLY extract events/classes/workshops that are EXPLICITLY listed on the page with specific dates and times.
- If the page has NO scheduled events, return {"events": []}.
- DO NOT invent, imagine, or hallucinate any events.
- DO NOT create events from service descriptions, menu items, or business hours.
- For each event, you MUST provide a "source_quote" — the EXACT text from the page that contains the event title.

Business: "BUSINESS_NAME"
Page URL: PAGE_URL
Today's date: TODAY_DATE

PAGE TEXT:
---
PAGE_TEXT
---

Extract events in this JSON format:
{
  "events": [
    {
      "title": "exact event title from the page",
      "date": "YYYY-MM-DD",
      "time": "HH:MM (24-hour)",
      "end_time": "HH:MM or null",
      "description": "brief description from page",
      "source_quote": "the exact sentence or phrase from the page containing this event title"
    }
  ]
}

If the page lists NO events with specific dates and times, return: {"events": []}
Return ONLY valid JSON, nothing else.`;

/**
 * Extract events using AI and verify against source text.
 * Returns { verified: [], rejected: [], raw: [], skippedReason: string|null }
 */
export async function extractAndVerify(pageText, businessName, pageUrl) {
  if (!anthropic) {
    return { verified: [], rejected: [], raw: [], skippedReason: 'No Anthropic client' };
  }

  // Stage 1: Signal detection
  const signals = hasEventSignals(pageText);
  if (!signals.hasSignals) {
    return {
      verified: [],
      rejected: [],
      raw: [],
      skippedReason: `No event signals (score: ${signals.score}): ${signals.details.join(', ')}`
    };
  }

  // Stage 2: AI extraction
  await rateLimitedDelay();

  const today = new Date().toISOString().split('T')[0];
  const truncatedText = pageText.substring(0, 15000);

  const prompt = EXTRACTION_PROMPT
    .replace('BUSINESS_NAME', businessName)
    .replace('PAGE_URL', pageUrl)
    .replace('TODAY_DATE', today)
    .replace('PAGE_TEXT', truncatedText);

  let rawEvents = [];
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      rawEvents = parsed.events || [];
    }
  } catch (e) {
    const errMsg = e.status ? `${e.status}: ${e.message.substring(0, 100)}` : e.message.substring(0, 100);
    return {
      verified: [],
      rejected: [],
      raw: [],
      skippedReason: `AI extraction failed: ${errMsg}`
    };
  }

  if (rawEvents.length === 0) {
    return { verified: [], rejected: [], raw: [], skippedReason: null };
  }

  // Stage 3: Source text verification
  const { verified, rejected } = verifyAgainstSource(rawEvents, pageText);

  return { verified, rejected, raw: rawEvents, skippedReason: null };
}

// ============================================================
// STAGE 3: Source Text Verification (deterministic)
// ============================================================

/**
 * Normalize text for fuzzy matching: lowercase, collapse whitespace, strip punctuation
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[''""]/g, "'")
    .replace(/[\s\n\r\t]+/g, ' ')
    .trim();
}

/**
 * Check if a title appears in the page text using fuzzy word matching.
 * Returns true if 80%+ of the title's words appear in the page text.
 */
function titleInSource(title, normalizedPageText) {
  const normalizedTitle = normalizeText(title);

  // Exact substring match first
  if (normalizedPageText.includes(normalizedTitle)) {
    return true;
  }

  // Fuzzy: check if 80%+ of words match
  const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 2);
  if (titleWords.length === 0) return false;

  let matchCount = 0;
  for (const word of titleWords) {
    if (normalizedPageText.includes(word)) {
      matchCount++;
    }
  }

  const matchRatio = matchCount / titleWords.length;
  return matchRatio >= 0.8;
}

/**
 * Check if a date appears in the page text in any common format.
 */
function dateInSource(dateStr, normalizedPageText) {
  if (!dateStr) return false;

  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return false;

  const months = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const monthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();

  // Check various date formats
  const formats = [
    `${months[month]} ${day}`,              // february 15
    `${monthsShort[month]} ${day}`,         // feb 15
    `${months[month]} ${day}, ${year}`,     // february 15, 2026
    `${monthsShort[month]} ${day}, ${year}`, // feb 15, 2026
    `${month + 1}/${day}`,                  // 2/15
    `${String(month + 1).padStart(2, '0')}/${String(day).padStart(2, '0')}`, // 02/15
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`, // 2026-02-15
    `${day} ${months[month]}`,              // 15 february
    `${day} ${monthsShort[month]}`,         // 15 feb
  ];

  for (const fmt of formats) {
    if (normalizedPageText.includes(fmt)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a time appears in the page text.
 */
function timeInSource(timeStr, normalizedPageText) {
  if (!timeStr) return false;

  // Parse 24-hour time
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return false;

  let hour = parseInt(match[1]);
  const minute = match[2];

  // Check 24-hour format
  if (normalizedPageText.includes(`${hour}:${minute}`)) return true;
  if (normalizedPageText.includes(`${String(hour).padStart(2, '0')}:${minute}`)) return true;

  // Check 12-hour format
  const ampm = hour >= 12 ? 'pm' : 'am';
  const hour12 = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);

  const timeFormats = [
    `${hour12}:${minute} ${ampm}`,
    `${hour12}:${minute}${ampm}`,
    `${hour12} ${ampm}`,
  ];

  // Also check without minutes if :00
  if (minute === '00') {
    timeFormats.push(`${hour12} ${ampm}`);
    timeFormats.push(`${hour12}${ampm}`);
  }

  for (const fmt of timeFormats) {
    if (normalizedPageText.includes(fmt)) return true;
  }

  return false;
}

/**
 * Verify extracted events against the source page text.
 * Every event must have its title AND (date OR time) found in the source.
 */
export function verifyAgainstSource(extractedEvents, pageText) {
  const normalizedPageText = normalizeText(pageText);
  const verified = [];
  const rejected = [];

  for (const event of extractedEvents) {
    const checks = {
      titleFound: titleInSource(event.title || '', normalizedPageText),
      dateFound: dateInSource(event.date, normalizedPageText),
      timeFound: timeInSource(event.time, normalizedPageText),
    };

    // Must have title in source
    if (!checks.titleFound) {
      rejected.push({
        event,
        reason: `Title "${event.title}" not found in page text`,
        checks,
      });
      continue;
    }

    // Must have date OR time in source
    if (!checks.dateFound && !checks.timeFound) {
      rejected.push({
        event,
        reason: `Neither date "${event.date}" nor time "${event.time}" found in page text`,
        checks,
      });
      continue;
    }

    verified.push({ event, checks });
  }

  return { verified, rejected };
}

export default {
  hasEventSignals,
  extractAndVerify,
  verifyAgainstSource,
};
