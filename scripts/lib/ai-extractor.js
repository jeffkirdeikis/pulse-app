/**
 * AI-Powered Event Extraction & Validation
 * Uses Claude to extract events from ANY webpage and validate data quality
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dirname, '..', '..', '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  // Env may already be loaded
}

const anthropic = new Anthropic();

/**
 * Extract events from raw webpage content using Claude
 * Works on ANY website format - no DOM selectors needed
 */
export async function extractEventsWithAI(pageContent, sourceUrl, venueName = null) {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are an expert at extracting event information from webpages.

Extract ALL events, classes, or scheduled activities from this webpage content.

SOURCE URL: ${sourceUrl}
${venueName ? `VENUE NAME: ${venueName}` : ''}

WEBPAGE CONTENT:
${pageContent.substring(0, 15000)}

For each event found, extract:
- title: The event/class name (NOT the venue name, NOT navigation text)
- date: In YYYY-MM-DD format (infer year if not stated - assume upcoming dates)
- time: In HH:MM format (24-hour)
- end_time: If available
- description: Brief description
- price: If mentioned (just the number or "Free")
- instructor: If mentioned
- category: One of: fitness, yoga, art, music, community, kids, sports, wellness, education, other

CRITICAL VALIDATION:
- Skip navigation items like "Contact Us", "About", "Our Team"
- Skip service descriptions that aren't scheduled events
- Skip if title equals the venue name (that's not an event)
- Only include items that have a specific date/time
- If a date seems wrong (Christmas event in February), flag it

Return JSON array:
{
  "events": [
    {
      "title": "...",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "end_time": "HH:MM" or null,
      "description": "...",
      "price": "..." or null,
      "instructor": "..." or null,
      "category": "...",
      "confidence": 0.0-1.0,
      "flag": "reason if suspicious" or null
    }
  ],
  "extraction_notes": "Any issues or uncertainties"
}`
    }]
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e);
  }
  return { events: [], extraction_notes: 'Parse failed' };
}

/**
 * Validate a single event using AI reasoning
 * Catches issues that regex can't
 */
export async function validateEventWithAI(event, existingEvents = []) {
  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Validate this event data for a community events app in Squamish, BC:

EVENT:
${JSON.stringify(event, null, 2)}

EXISTING EVENTS AT SAME VENUE (check for duplicates):
${JSON.stringify(existingEvents.slice(0, 10), null, 2)}

Check for:
1. Is this a real event or website navigation/service text?
2. Does the date make sense for the event name? (Christmas should be December)
3. Does the time make sense? (yoga at 3am is suspicious)
4. Is the price reasonable for this type of event in Squamish?
5. Is this a duplicate of an existing event?
6. Is the title descriptive (not just venue name)?

Return JSON:
{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of issues"] or [],
  "suggested_fixes": {"field": "corrected_value"} or {},
  "is_duplicate_of": "event_id" or null,
  "reasoning": "brief explanation"
}`
    }]
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse validation response:', e);
  }
  return { is_valid: true, confidence: 0.5, issues: ['Validation failed'], reasoning: 'Parse error' };
}

/**
 * Batch validate events with deduplication
 */
export async function validateEventBatch(events, existingEvents = []) {
  const results = [];

  for (const event of events) {
    const validation = await validateEventWithAI(event, existingEvents);
    results.push({
      event,
      validation,
      action: validation.is_valid && validation.confidence > 0.7 ? 'insert' :
              validation.confidence > 0.4 ? 'review' : 'reject'
    });

    // Add to existing for duplicate detection
    if (validation.is_valid) {
      existingEvents.push(event);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

/**
 * Smart extraction that handles ANY booking system
 */
export async function smartExtract(url, html) {
  // Detect booking system
  const systems = {
    mindbody: /mindbody|healcode/i,
    wellnessliving: /wellnessliving/i,
    janeapp: /janeapp/i,
    momence: /momence/i,
    eventbrite: /eventbrite/i,
    facebook: /facebook\.com\/events/i
  };

  let detectedSystem = 'unknown';
  for (const [system, pattern] of Object.entries(systems)) {
    if (pattern.test(html) || pattern.test(url)) {
      detectedSystem = system;
      break;
    }
  }

  console.log(`Detected booking system: ${detectedSystem}`);

  // Use AI extraction regardless of system
  return extractEventsWithAI(html, url);
}

export default {
  extractEventsWithAI,
  validateEventWithAI,
  validateEventBatch,
  smartExtract
};
