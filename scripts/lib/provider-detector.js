/**
 * Automated Booking Provider Change Detection
 *
 * Detects when a business switches booking providers (e.g., WellnessLiving → Mariana Tek).
 * Scans business websites for booking system signatures, probes APIs, and auto-switches
 * the scraper config with zero downtime.
 *
 * Triggered after 2+ consecutive zero-result runs or scraper failures.
 * Debounced to run at most once every 6 hours per source.
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './env.js';
import { getTodayPacific } from './scraper-utils.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

// ============================================================
// FETCH HELPER
// ============================================================

export async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// PROVIDER SIGNATURES — Detection patterns + API probes
// ============================================================

/**
 * Each provider has:
 *   htmlPatterns: regex patterns to detect in page HTML/URLs
 *   extractSlug:  function to pull the identifier from a regex match
 *   probe:        async function to verify data exists (null = needs browser)
 */
const PROVIDER_SIGNATURES = {
  'marianatek': {
    name: 'Mariana Tek',
    htmlPatterns: [
      // Direct subdomain: roundhousesquamish.marianatek.com
      /([a-z0-9-]+)\.marianatek\.com/i,
      // JS variable: var TENANT_NAME = 'roundhousesquamish';
      /TENANT_NAME\s*=\s*['"]([a-z0-9-]+)['"]/i,
      // Iframe domain: roundhousesquamish.marianaiframes.com
      /([a-z0-9-]+)\.marianaiframes\.com/i,
      // Data attribute: data-mariana-integrations="/schedule/..."
      /data-mariana-integrations/i
    ],
    extractSlug: (match) => {
      // Most patterns capture the slug in group 1
      // The data-mariana-integrations pattern has no capture group — slug unknown
      return match[1] || null;
    },
    probe: async (slug) => {
      const url = `https://${slug}.marianatek.com/api/customer/v1/classes?page_size=1`;
      try {
        const resp = await fetchWithTimeout(url, 8000);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.results) {
          return { booking_system: 'marianatek', studio_id: slug, classCount: data.results.length };
        }
      } catch { /* probe failed */ }
      return null;
    }
  },

  'mindbody-widget': {
    name: 'Mindbody Widget',
    htmlPatterns: [
      /widgets\.mindbodyonline\.com\/widgets\/schedules\/([a-f0-9]+)/i,
      /healcode.*widget.*?["']([a-f0-9]+)["']/i
    ],
    extractSlug: (match) => match[1],
    probe: async (widgetId) => {
      const today = getTodayPacific();
      const url = `https://widgets.mindbodyonline.com/widgets/schedules/${widgetId}/load_markup?options%5Bstart_date%5D=${today}`;
      try {
        const resp = await fetchWithTimeout(url, 8000);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.class_sessions) {
          return { booking_system: 'mindbody-widget', widget_id: widgetId };
        }
      } catch { /* probe failed */ }
      return null;
    }
  },

  'mindbody-classic': {
    name: 'Mindbody Classic',
    htmlPatterns: [
      /clients\.mindbodyonline\.com\/classic\/mainclass\?studioid=(\d+)/i
    ],
    extractSlug: (match) => match[1],
    probe: null // Needs browser
  },

  'wellnessliving': {
    name: 'WellnessLiving',
    htmlPatterns: [
      /wellnessliving\.com\/schedule\/([a-z0-9_-]+)/i
    ],
    extractSlug: (match) => match[1],
    probe: null // Needs browser
  },

  'janeapp': {
    name: 'JaneApp',
    htmlPatterns: [
      /([a-z0-9-]+)\.janeapp\.com/i
    ],
    extractSlug: (match) => match[1],
    probe: async (slug) => {
      const url = `https://${slug}.janeapp.com/api/v2/treatments`;
      try {
        const resp = await fetchWithTimeout(url, 8000);
        if (!resp.ok) return null;
        const data = await resp.json();
        // API returns { treatments: [...] } or raw array depending on version
        const treatments = Array.isArray(data) ? data : data?.treatments;
        if (Array.isArray(treatments) && treatments.length > 0) {
          return { booking_system: 'janeapp', studio_id: slug };
        }
      } catch { /* probe failed */ }
      return null;
    }
  },

  'perfectmind': {
    name: 'PerfectMind',
    htmlPatterns: [
      /perfectmind\.com\/Contacts\/BookMe4\?widgetId=([a-f0-9-]+)/i
    ],
    extractSlug: (match) => match[1],
    probe: null // Needs session cookies
  },

  'brandedweb': {
    name: 'Brandedweb',
    htmlPatterns: [
      /brandedweb-next\.mindbodyonline\.com.*?view\/([a-f0-9]+)/i,
      /brandedweb-next\.mindbodyonline\.com/i
    ],
    extractSlug: (match) => match[1] || null,
    probe: null // Needs browser
  },

  'sendmoregetbeta': {
    name: 'SendMoreGetBeta',
    htmlPatterns: [
      /widgets\.sendmoregetbeta\.com\/event\?gymKey=(\d+)/i,
      /sendmoregetbeta\.com/i
    ],
    extractSlug: (match) => match[1] || null,
    probe: null // Needs browser
  }
};

// ============================================================
// URL RESOLUTION
// ============================================================

/**
 * Get URLs to scan for a source.
 * If the source URL is a booking platform URL, look up the business's actual website.
 */
async function getUrlsToScan(source) {
  const urls = new Set();

  if (source.url) urls.add(source.url);

  // Check if the source URL points to a booking platform (not the business website)
  const bookingDomains = [
    'mindbodyonline.com', 'wellnessliving.com', 'janeapp.com',
    'perfectmind.com', 'sendmoregetbeta.com', 'marianatek.com',
    'brandedweb-next.mindbodyonline.com'
  ];
  const isBookingUrl = bookingDomains.some(d => source.url?.includes(d));

  if (isBookingUrl) {
    // Look up actual business website from businesses table
    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/businesses?name=ilike.${encodeURIComponent('%' + source.name + '%')}&select=website&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (resp.ok) {
        const businesses = await resp.json();
        if (businesses[0]?.website) {
          const base = businesses[0].website.replace(/\/$/, '');
          urls.add(base);
          urls.add(base + '/schedule');
          urls.add(base + '/classes');
        }
      }
    } catch { /* ignore, we'll use what we have */ }
  } else {
    // Source URL is the business website — also check schedule/classes subpages
    const base = source.url.replace(/\/$/, '');
    urls.add(base + '/schedule');
    urls.add(base + '/classes');
  }

  return [...urls];
}

// ============================================================
// CORE DETECTION
// ============================================================

/**
 * Detect if a business has changed booking providers.
 *
 * Fetches the business website + subpages, scans HTML for all provider signatures,
 * and probes APIs when possible.
 *
 * @param {object} source - Source config (needs: name, booking_system, url)
 * @returns {{ changed: boolean, newProvider: object|null, allDetected: object[], error: string|null }}
 */
export async function detectProviderChange(source) {
  const result = { changed: false, newProvider: null, allDetected: [], error: null };

  if (!source.url && !source.name) {
    result.error = 'No URL or name configured';
    return result;
  }

  const scanUrls = await getUrlsToScan(source);
  if (scanUrls.length === 0) {
    result.error = 'No URLs to scan';
    return result;
  }

  // Scan each URL for provider signatures
  for (const url of scanUrls) {
    try {
      const resp = await fetchWithTimeout(url, 10000);
      if (!resp.ok) continue;
      const html = await resp.text();

      for (const [systemKey, provider] of Object.entries(PROVIDER_SIGNATURES)) {
        // Skip if already detected this system
        if (result.allDetected.find(d => d.system === systemKey)) continue;

        // Try all patterns to find the best match (one with a slug)
        let bestSlug = null;
        let matched = false;
        for (const pattern of provider.htmlPatterns) {
          const match = html.match(pattern) || url.match(pattern);
          if (match) {
            matched = true;
            const slug = provider.extractSlug(match);
            if (slug && !bestSlug) bestSlug = slug;
          }
        }

        if (matched) {
          const detection = {
            system: systemKey,
            name: provider.name,
            slug: bestSlug,
            detectedOnUrl: url,
            probeSuccess: false,
            probeData: null,
            probeError: null
          };

          // If this provider has an API probe, verify it returns data
          if (provider.probe && bestSlug) {
            try {
              const probeResult = await provider.probe(bestSlug);
              if (probeResult) {
                detection.probeSuccess = true;
                detection.probeData = probeResult;
              }
            } catch (probeErr) {
              detection.probeError = probeErr.message;
            }
          }

          result.allDetected.push(detection);
        }
      }
    } catch {
      // URL fetch failed, try next
      continue;
    }
  }

  // Determine if the provider changed
  const currentSystem = source.booking_system;
  const newProviders = result.allDetected.filter(d => d.system !== currentSystem);

  if (newProviders.length > 0) {
    // Prefer a provider with a successful API probe
    const probed = newProviders.find(d => d.probeSuccess);
    result.changed = true;
    result.newProvider = probed || newProviders[0];
  }

  return result;
}

// ============================================================
// PROVIDER SWITCH
// ============================================================

/**
 * Apply a detected provider change to the database.
 * Preserves old config in previous_* columns for rollback.
 *
 * @param {object} source - Current source config
 * @param {object} detection - The newProvider object from detectProviderChange()
 * @returns {object} Updated source config for immediate re-scrape
 */
export async function applyProviderSwitch(source, detection) {
  const newConfig = {
    // Preserve old config
    previous_booking_system: source.booking_system,
    previous_widget_id: source.widget_id || null,
    previous_studio_id: source.studio_id || null,
    provider_change_detected_at: new Date().toISOString(),
    provider_change_confirmed: false,

    // Apply new provider
    booking_system: detection.system,
    widget_id: detection.probeData?.widget_id || null,
    studio_id: detection.probeData?.studio_id || detection.slug || null,
    detection_notes: `Auto-switched from ${source.booking_system} to ${detection.system}. Detected on ${detection.detectedOnUrl}. Probe: ${detection.probeSuccess ? 'passed' : 'not available'}.`,

    // Reset counters
    consecutive_failures: 0,
    consecutive_zero_results: 0,
    last_error: null,
    updated_at: new Date().toISOString()
  };

  // Update database
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(source.name)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConfig)
      }
    );
  } catch (e) {
    console.warn(`   Failed to update DB for provider switch: ${e.message}`);
  }

  // Return merged config for immediate re-scrape
  return { ...source, ...newConfig };
}

/**
 * Confirm a provider change worked (re-scrape returned data).
 */
export async function confirmProviderChange(sourceName) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_change_confirmed: true,
          updated_at: new Date().toISOString()
        })
      }
    );
  } catch { /* ignore */ }
}

// ============================================================
// ZERO-RESULT TRACKING
// ============================================================

/**
 * Increment the consecutive zero-result counter for a source.
 * Returns the new count.
 */
export async function recordZeroResult(sourceName) {
  try {
    const getResp = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}&select=consecutive_zero_results`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    let zeros = 0;
    if (getResp.ok) {
      const data = await getResp.json();
      if (data[0]) zeros = (data[0].consecutive_zero_results || 0) + 1;
    }

    await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ consecutive_zero_results: zeros })
      }
    );

    return zeros;
  } catch { return 0; }
}

/**
 * Reset the consecutive zero-result counter (on successful scrape with data).
 */
export async function resetZeroResult(sourceName) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ consecutive_zero_results: 0 })
      }
    );
  } catch { /* ignore */ }
}

// ============================================================
// DETECTION DEBOUNCE
// ============================================================

/**
 * Check if we should attempt provider detection for this source.
 * Returns true if:
 *   - 2+ consecutive failures OR 2+ consecutive zero results
 *   - AND last detection attempt was 6+ hours ago (or never)
 */
export async function shouldAttemptDetection(source) {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(source.name)}&select=consecutive_failures,consecutive_zero_results,last_detection_attempt`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    if (!data[0]) return false;

    const failures = data[0].consecutive_failures || 0;
    const zeros = data[0].consecutive_zero_results || 0;

    // Trigger condition: 2+ failures OR 2+ zero results
    if (failures < 2 && zeros < 2) return false;

    // Debounce: don't re-detect within 6 hours
    if (data[0].last_detection_attempt) {
      const lastDetection = new Date(data[0].last_detection_attempt);
      const hoursSince = (Date.now() - lastDetection.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 6) return false;
    }

    return true;
  } catch { return false; }
}

/**
 * Record that we attempted detection (for debounce).
 */
export async function recordDetectionAttempt(sourceName) {
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?name=eq.${encodeURIComponent(sourceName)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ last_detection_attempt: new Date().toISOString() })
      }
    );
  } catch { /* ignore */ }
}

export { PROVIDER_SIGNATURES };
