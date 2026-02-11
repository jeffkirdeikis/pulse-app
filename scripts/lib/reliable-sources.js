/**
 * Reliable Sources Registry
 * Database-driven list of sources that can be scraped consistently
 *
 * Sources are loaded from:
 * 1. Database (scraping_sources table) - primary, auto-discovered
 * 2. Hardcoded fallback (RELIABLE_SOURCES) - backup if DB empty
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './env.js';
import { sendTelegramAlert as telegramAlert } from './alerting.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

/**
 * Fetch sources from database
 */
export async function getSourcesFromDatabase() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?is_active=eq.true&order=priority.desc`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (response.ok) {
      const sources = await response.json();
      if (sources && sources.length > 0) {
        // Transform database format to internal format
        return sources.map(s => ({
          name: s.name,
          booking_system: s.booking_system,
          widget_id: s.widget_id,
          studio_id: s.studio_id,
          tab_id: s.tab_id,
          url: s.schedule_url || s.url,
          address: s.address,
          category: s.category,
          scrape_frequency: 'daily',
          priority: s.priority || 5,
          verified: s.verified || false,
          notes: s.notes
        }));
      }
    }
  } catch (e) {
    console.warn('Could not fetch sources from database:', e.message);
  }

  // Fall back to hardcoded sources
  return null;
}

/**
 * Get all sources (database first, then fallback to hardcoded)
 */
export async function getAllSourcesAsync() {
  const dbSources = await getSourcesFromDatabase();
  if (dbSources && dbSources.length > 0) {
    console.log(`📋 Loaded ${dbSources.length} sources from database`);
    return dbSources;
  }
  console.log(`📋 Using ${RELIABLE_SOURCES.length} hardcoded sources (database empty)`);
  return RELIABLE_SOURCES;
}

// Master list of reliable scraping sources
// These are KNOWN to work and should be scraped on every run
export const RELIABLE_SOURCES = [
  // ========================================
  // MINDBODY WIDGET API (HealCode widgets)
  // ========================================
  {
    name: 'Shala Yoga',
    booking_system: 'mindbody-widget',
    widget_id: '189264',
    studio_id: null,
    url: 'https://www.shalayoga.ca',
    address: '40383 Tantalus Rd, Unit 3, Squamish, BC',
    category: 'Yoga & Pilates',
    scrape_frequency: 'daily',
    priority: 10,
    verified: true,
    notes: 'Main yoga studio - uses numeric widget API ID (not hex embed ID)'
  },
  {
    name: 'Wild Life Gym',
    booking_system: 'mindbody-widget',
    widget_id: '69441',
    studio_id: null,
    url: 'https://www.wildlifegym.ca',
    address: '38927 Progress Way Unit 113, Squamish, BC',
    category: 'Fitness',
    scrape_frequency: 'daily',
    priority: 9,
    verified: true,
    notes: 'CrossFit-style gym - uses numeric widget API ID (not hex embed ID)'
  },

  // ========================================
  // MINDBODY CLASSIC (Web scraping)
  // ========================================
  {
    name: 'Squamish Barbell',
    booking_system: 'mindbody-classic',
    widget_id: null,
    studio_id: '7879',
    tab_id: '7',
    url: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=7879&tabID=7',
    address: '38930-C Mid Way, Squamish, BC',
    category: 'Fitness',
    scrape_frequency: 'daily',
    priority: 9,
    verified: true,
    notes: 'Barbell/strength training - navigate weeks for full schedule'
  },
  {
    name: 'Seed Studio',
    booking_system: 'mindbody-classic',
    widget_id: null,
    studio_id: '5729485',
    tab_id: '7',
    url: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=5729485&tabID=7',
    address: '38173 Cleveland Ave, Squamish, BC',
    category: 'Yoga & Pilates',
    scrape_frequency: 'daily',
    priority: 9,
    verified: true,
    notes: 'Yoga and pilates studio'
  },
  {
    name: 'Mountain Fitness Center',
    booking_system: 'mindbody-classic',
    widget_id: null,
    studio_id: '265219',
    tab_id: '7',
    url: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=265219&tabID=7',
    address: 'Squamish, BC',
    category: 'Fitness',
    scrape_frequency: 'daily',
    priority: 8,
    verified: true,
    notes: 'Gym with group fitness classes'
  },

  // ========================================
  // WELLNESSLIVING (Web scraping)
  // ========================================
  {
    name: 'Breathe Fitness Studio',
    booking_system: 'wellnessliving',
    widget_id: null,
    studio_id: '338540',
    url: 'https://www.wellnessliving.com/schedule/breathe_fitness_squamish',
    address: '1211 Commercial Way, Squamish, BC',
    category: 'Fitness',
    scrape_frequency: 'daily',
    priority: 8,
    verified: true,
    notes: 'Group fitness classes'
  },
  {
    name: 'The Sound Martial Arts',
    booking_system: 'wellnessliving',
    widget_id: null,
    studio_id: '414578',
    url: 'https://www.wellnessliving.com/schedule/thesoundmartialarts',
    address: '38922 Progress Way, Squamish, BC',
    category: 'Martial Arts',
    scrape_frequency: 'daily',
    priority: 8,
    verified: true,
    notes: 'Martial arts classes'
  },
  {
    name: 'Roundhouse Martial Arts & Fitness',
    booking_system: 'wellnessliving',
    widget_id: null,
    studio_id: null,
    url: 'https://www.wellnessliving.com/schedule/roundhouse_martial_arts',
    address: '38147 Cleveland Ave #201, Squamish, BC',
    category: 'Martial Arts',
    scrape_frequency: 'daily',
    priority: 8,
    verified: true,
    notes: 'MMA, BJJ, Muay Thai, Kickboxing - UFC vet Cole Smith'
  },

  // ========================================
  // BRANDEDWEB (Mindbody branded widgets)
  // ========================================
  {
    name: 'Oxygen Yoga & Fitness Squamish',
    booking_system: 'brandedweb',
    widget_id: '5922581a2',
    studio_id: null,
    url: 'https://brandedweb-next.mindbodyonline.com/components/widgets/schedules/view/5922581a2/schedule',
    address: '38085 Second Ave, Squamish, BC',
    category: 'Yoga & Pilates',
    scrape_frequency: 'daily',
    priority: 8,
    verified: true,
    notes: 'Hot yoga and fitness'
  },

  // ========================================
  // SENDMOREGETBETA (Climbing gyms)
  // ========================================
  {
    name: 'The Ledge Climbing Centre',
    booking_system: 'sendmoregetbeta',
    widget_id: null,
    studio_id: '13326',
    url: 'https://widgets.sendmoregetbeta.com/event?gymKey=13326',
    address: '1010 Industrial Way, Squamish, BC',
    category: 'Fitness',
    scrape_frequency: 'daily',
    priority: 9,
    verified: true,
    notes: 'Indoor climbing gym - yoga, fitness classes'
  }
];

/**
 * Get sources by booking system type
 */
export function getSourcesBySystem(system) {
  return RELIABLE_SOURCES.filter(s => s.booking_system === system);
}

/**
 * Get all sources sorted by priority
 */
export function getAllSources() {
  return [...RELIABLE_SOURCES].sort((a, b) => b.priority - a.priority);
}

/**
 * Sync reliable sources to database for tracking
 */
export async function syncSourcesToDatabase() {
  const results = { synced: 0, errors: [] };

  for (const source of RELIABLE_SOURCES) {
    try {
      // Upsert to scraping_sources table (or create if needed)
      const response = await fetch(`${SUPABASE_URL}/rest/v1/scraping_sources`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          name: source.name,
          booking_system: source.booking_system,
          widget_id: source.widget_id,
          studio_id: source.studio_id,
          url: source.url,
          address: source.address,
          category: source.category,
          scrape_frequency: source.scrape_frequency,
          priority: source.priority,
          verified: source.verified,
          notes: source.notes,
          is_active: true,
          updated_at: new Date().toISOString()
        })
      });

      if (response.ok) {
        results.synced++;
      } else {
        const err = await response.text();
        results.errors.push({ source: source.name, error: err });
      }
    } catch (e) {
      results.errors.push({ source: source.name, error: e.message });
    }
  }

  return results;
}

/**
 * Record a successful scrape
 */
export async function recordScrapeSuccess(sourceName, classCount, eventCount = 0) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_scraped: new Date().toISOString(),
        last_scrape_success: true,
        last_class_count: classCount,
        last_event_count: eventCount,
        consecutive_failures: 0
      })
    });
  } catch (e) {
    console.warn(`Failed to record scrape success for ${sourceName}:`, e.message);
  }
}

/**
 * Record a failed scrape
 */
export async function recordScrapeFailure(sourceName, errorMessage) {
  try {
    // First get current failure count
    const getResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}&select=consecutive_failures`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    let failures = 0;
    if (getResponse.ok) {
      const data = await getResponse.json();
      if (data[0]) failures = (data[0].consecutive_failures || 0) + 1;
    }

    await fetch(`${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_scraped: new Date().toISOString(),
        last_scrape_success: false,
        last_error: errorMessage,
        consecutive_failures: failures
      })
    });

    // Alert on 3+ consecutive failures — something is persistently broken
    if (failures >= 3) {
      console.warn(`   🔴 ${sourceName} has failed ${failures} times consecutively!`);
      await telegramAlert(`🔴 Scraper Alert: ${sourceName} has failed ${failures} consecutive times.\nLatest error: ${errorMessage}`);
    }
  } catch (e) {
    console.warn(`Failed to record scrape failure for ${sourceName}:`, e.message);
  }
}

/**
 * Get a saved verified source URL for a business (from previous successful scrape)
 * @param {string} businessId - UUID of the business
 * @returns {Object|null} - { url, booking_system, last_scraped } or null
 */
export async function getVerifiedSourceUrl(businessId) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?business_id=eq.${businessId}&booking_system=eq.website-verified&is_active=eq.true&select=url,booking_system,last_scraped,consecutive_failures&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        return data[0];
      }
    }
  } catch (e) {
    console.warn(`Failed to get verified source for business ${businessId}:`, e.message);
  }
  return null;
}

/**
 * Save a discovered verified source URL for a business
 * @param {string} businessId - UUID of the business
 * @param {string} businessName - Name of the business
 * @param {string} url - The URL where events were found
 * @param {number} eventCount - Number of events found
 */
export async function saveVerifiedSource(businessId, businessName, url, eventCount) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/scraping_sources`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        business_id: businessId,
        name: businessName,
        booking_system: 'website-verified',
        url: url,
        priority: 3,
        is_active: true,
        verified: true,
        last_scraped: new Date().toISOString(),
        last_scrape_success: true,
        last_event_count: eventCount,
        consecutive_failures: 0,
        notes: `AI-verified extraction from ${url}`,
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`Failed to save verified source for ${businessName}: ${err}`);
    }
  } catch (e) {
    console.warn(`Failed to save verified source for ${businessName}:`, e.message);
  }
}

/**
 * Deactivate a verified source after consecutive failures
 * @param {string} businessId - UUID of the business
 */
export async function deactivateVerifiedSource(businessId) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?business_id=eq.${businessId}&booking_system=eq.website-verified`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_active: false,
          notes: 'Deactivated after 3 consecutive failures',
          updated_at: new Date().toISOString()
        })
      }
    );
  } catch (e) {
    console.warn(`Failed to deactivate verified source for business ${businessId}:`, e.message);
  }
}

/**
 * Get all business IDs that already have dedicated scraper coverage
 * (non-website-verified sources that are active)
 */
export async function getCoveredBusinessIds() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?is_active=eq.true&booking_system=neq.website-verified&select=business_id,name,booking_system`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data
        .filter(s => s.business_id)
        .map(s => ({ businessId: s.business_id, name: s.name, system: s.booking_system }));
    }
  } catch (e) {
    console.warn('Failed to get covered business IDs:', e.message);
  }
  return [];
}

export default RELIABLE_SOURCES;
