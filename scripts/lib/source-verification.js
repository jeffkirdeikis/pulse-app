/**
 * Multi-Source Verification & Trust Scoring
 * Cross-references events from multiple sources to verify accuracy
 */

import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic();

/**
 * Source trust scores (0-1)
 * Based on historical accuracy
 */
const SOURCE_TRUST = {
  // Direct APIs - highest trust
  'mindbody-api': 0.95,
  'wellnessliving-api': 0.95,
  'eventbrite-api': 0.92,

  // Widget scraping - high trust
  'mindbody-widget': 0.88,
  'wellnessliving-widget': 0.88,

  // Official sources - high trust
  'district-of-squamish': 0.90,
  'tourism-squamish': 0.88,

  // Aggregators - medium trust
  'together-nest': 0.75,
  'sea-to-sky-kids': 0.75,
  'meetup': 0.70,

  // Web scraping - lower trust
  'firecrawl-business': 0.60,
  'firecrawl-aggregator': 0.65,

  // Community submissions - variable
  'community-verified': 0.85,
  'community-unverified': 0.50,

  // Unknown
  'unknown': 0.40
};

/**
 * Calculate similarity between two events
 */
function calculateSimilarity(event1, event2) {
  let score = 0;
  let maxScore = 0;

  // Title similarity (fuzzy match)
  maxScore += 30;
  const title1 = event1.title?.toLowerCase() || '';
  const title2 = event2.title?.toLowerCase() || '';
  if (title1 === title2) score += 30;
  else if (title1.includes(title2) || title2.includes(title1)) score += 20;
  else {
    // Word overlap
    const words1 = new Set(title1.split(/\s+/));
    const words2 = new Set(title2.split(/\s+/));
    const overlap = [...words1].filter(w => words2.has(w)).length;
    score += Math.min(15, overlap * 5);
  }

  // Date match
  maxScore += 30;
  if (event1.start_date === event2.start_date) score += 30;

  // Time match (within 30 min)
  maxScore += 20;
  if (event1.start_time && event2.start_time) {
    const [h1, m1] = event1.start_time.split(':').map(Number);
    const [h2, m2] = event2.start_time.split(':').map(Number);
    const diff = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
    if (diff === 0) score += 20;
    else if (diff <= 30) score += 15;
    else if (diff <= 60) score += 10;
  }

  // Venue match
  maxScore += 20;
  const venue1 = event1.venue_name?.toLowerCase() || '';
  const venue2 = event2.venue_name?.toLowerCase() || '';
  if (venue1 === venue2) score += 20;
  else if (venue1.includes(venue2) || venue2.includes(venue1)) score += 15;

  return score / maxScore;
}

/**
 * Find potential matches for an event
 */
async function findMatches(event, dateRange = 1) {
  const startDate = new Date(event.start_date);
  const minDate = new Date(startDate);
  minDate.setDate(minDate.getDate() - dateRange);
  const maxDate = new Date(startDate);
  maxDate.setDate(maxDate.getDate() + dateRange);

  const { data: candidates } = await supabase
    .from('events')
    .select('*')
    .gte('start_date', minDate.toISOString().split('T')[0])
    .lte('start_date', maxDate.toISOString().split('T')[0])
    .neq('id', event.id || 'none');

  if (!candidates) return [];

  const matches = [];
  for (const candidate of candidates) {
    const similarity = calculateSimilarity(event, candidate);
    if (similarity >= 0.6) {
      matches.push({
        event: candidate,
        similarity,
        source: candidate.tags?.find(t => t.includes('-scraped') || t.includes('community')) || 'unknown'
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Verify an event using multi-source corroboration
 */
export async function verifyEvent(event) {
  const matches = await findMatches(event);
  const eventSource = event.tags?.find(t => SOURCE_TRUST[t] !== undefined) || 'unknown';
  const baseTrust = SOURCE_TRUST[eventSource] || SOURCE_TRUST.unknown;

  const result = {
    event_id: event.id,
    base_trust: baseTrust,
    matches: matches.length,
    corroboration_score: 0,
    final_confidence: baseTrust,
    verification_details: []
  };

  if (matches.length === 0) {
    result.verification_details.push('No corroborating sources found');
    return result;
  }

  // Calculate corroboration boost
  let corroborationBoost = 0;
  for (const match of matches) {
    const matchTrust = SOURCE_TRUST[match.source] || SOURCE_TRUST.unknown;
    const boost = match.similarity * matchTrust * 0.1;
    corroborationBoost += boost;

    result.verification_details.push(
      `Match from ${match.source} (${Math.round(match.similarity * 100)}% similar, trust: ${matchTrust})`
    );
  }

  // Cap corroboration boost at 0.3
  result.corroboration_score = Math.min(0.3, corroborationBoost);
  result.final_confidence = Math.min(0.99, baseTrust + result.corroboration_score);

  return result;
}

/**
 * Merge duplicate events, keeping best data from each source
 */
export async function mergeEvents(events) {
  if (events.length <= 1) return events[0];

  // Use AI to intelligently merge
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Merge these duplicate event records into one authoritative record.
Keep the most accurate/complete data from each source.

EVENTS TO MERGE:
${JSON.stringify(events, null, 2)}

Return JSON with the merged event:
{
  "merged_event": {
    "title": "best title",
    "description": "most complete description",
    "start_date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_time": "HH:MM or null",
    "venue_name": "...",
    "venue_address": "...",
    "price": "...",
    "category": "...",
    "image_url": "best image or null"
  },
  "source_ids": ["list of merged event ids"],
  "merge_notes": "what was combined/chosen"
}`
    }]
  });

  try {
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        ...result.merged_event,
        tags: ['multi-source-verified'],
        merged_from: result.source_ids,
        merge_notes: result.merge_notes
      };
    }
  } catch (e) {
    console.error('Merge failed:', e);
  }

  // Fallback: return highest trust source
  events.sort((a, b) => {
    const trustA = SOURCE_TRUST[a.tags?.[0]] || 0;
    const trustB = SOURCE_TRUST[b.tags?.[0]] || 0;
    return trustB - trustA;
  });
  return events[0];
}

/**
 * Batch verification of all unverified events
 */
export async function verifyAllEvents() {
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .is('verified_at', null)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!events) return [];

  const results = [];
  for (const event of events) {
    const verification = await verifyEvent(event);
    results.push(verification);

    // Update event with verification data
    await supabase
      .from('events')
      .update({
        confidence_score: verification.final_confidence,
        verified_at: new Date().toISOString(),
        verification_sources: verification.matches
      })
      .eq('id', event.id);

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

/**
 * Update source trust based on user feedback
 */
export async function updateSourceTrust(source, isAccurate) {
  // This would track accuracy over time and adjust trust scores
  // For now, log for manual review
  console.log(`Source ${source}: ${isAccurate ? 'accurate' : 'inaccurate'}`);
}

// Named export for SOURCE_TRUST
export { SOURCE_TRUST };

export default {
  verifyEvent,
  mergeEvents,
  verifyAllEvents,
  findMatches,
  updateSourceTrust,
  SOURCE_TRUST
};
