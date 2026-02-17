import { isRealDeal, calculateDealScore } from './dealHelpers';
import { getPacificNow } from './timezoneHelpers';

/**
 * Filter and sort events/classes based on current filters.
 *
 * @param {Array} allEvents - Combined hardcoded + database events
 * @param {Object} opts
 * @param {string} opts.currentSection - 'events' | 'classes'
 * @param {Object} opts.filters - { day, age, category, time, price, location }
 * @param {string} opts.searchQuery
 * @param {Array} opts.kidsAgeRange - [min, max] age range
 * @param {Function} opts.getVenueName - (venueId, event) => string
 * @param {Date} opts.now - Current time in Pacific timezone
 * @returns {Array} Filtered and sorted events
 */
export function filterEvents(allEvents, { currentSection, filters, searchQuery, kidsAgeRange, getVenueName, now }) {
  let filtered = [...allEvents];

  // Filter out bad data - titles that are just booking status, not actual class names
  // Also filter out events with missing/invalid start dates to prevent downstream crashes
  filtered = filtered.filter(e => {
    if (!e.start || !(e.start instanceof Date) || isNaN(e.start.getTime())) return false;
    const title = e.title || '';
    if (/^\(\d+\s+Reserved,\s+\d+\s+Open\)$/.test(title)) return false;
    if (title.length < 3) return false;
    return true;
  });

  // Filter by section (events vs classes)
  if (currentSection === 'events') {
    filtered = filtered.filter(e => e.eventType === 'event');
  } else if (currentSection === 'classes') {
    filtered = filtered.filter(e => e.eventType === 'class');
  }

  // Day filtering
  // Filter out events/classes that have already started
  if (filters.day === 'anytime') {
    // "Anytime" = all future events (not past ones)
    filtered = filtered.filter(e => e.start >= now);
  } else if (filters.day === 'happeningNow') {
    // Events that started within the last 2 hours (currently in progress)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    filtered = filtered.filter(e => e.start >= twoHoursAgo && e.start <= now);
  } else if (filters.day === 'today') {
    // "Upcoming" = next 30 days, excluding events that already started
    const thirtyDaysLater = new Date(now);
    thirtyDaysLater.setDate(now.getDate() + 30);
    filtered = filtered.filter(e => e.start >= now && e.start < thirtyDaysLater);
  } else if (filters.day === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);
    filtered = filtered.filter(e => e.start >= tomorrow && e.start < dayAfter);
  } else if (filters.day === 'thisWeekend') {
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const friday = new Date(now);
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
    if (isWeekend) {
      // Already Fri/Sat/Sun — show THIS weekend (go back to this Friday)
      const daysBackToFriday = dayOfWeek === 0 ? 2 : dayOfWeek - 5;
      friday.setDate(now.getDate() - daysBackToFriday);
    } else {
      // Mon-Thu — show the upcoming weekend
      const daysUntilFriday = 5 - dayOfWeek;
      friday.setDate(now.getDate() + daysUntilFriday);
    }
    friday.setHours(0, 0, 0, 0);
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    // If we're already in the weekend, don't show past events
    const startCutoff = isWeekend ? now : friday;
    filtered = filtered.filter(e => e.start >= startCutoff && e.start < monday);
  } else if (filters.day === 'thisWeek') {
    // Current week: from now until end of next Sunday
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek; // On Sunday, show through NEXT Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    sunday.setHours(23, 59, 59, 999);
    filtered = filtered.filter(e => e.start >= now && e.start <= sunday);
  } else if (filters.day === 'nextWeek') {
    const nextMonday = new Date(now);
    const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7;
    nextMonday.setDate(now.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);
    const followingSunday = new Date(nextMonday);
    followingSunday.setDate(nextMonday.getDate() + 7);
    filtered = filtered.filter(e => e.start >= nextMonday && e.start < followingSunday);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(filters.day)) {
    // Specific date selected from date picker (e.g. '2026-02-13')
    const [year, month, day] = filters.day.split('-').map(Number);
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    // For today's date, also exclude events that already started
    const isToday = dayStart.getFullYear() === now.getFullYear() &&
                    dayStart.getMonth() === now.getMonth() &&
                    dayStart.getDate() === now.getDate();
    const startCutoff = isToday ? now : dayStart;
    filtered = filtered.filter(e => e.start >= startCutoff && e.start < dayEnd);
  }

  // Search query
  if (searchQuery?.trim()) {
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(e =>
      e.title?.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query) ||
      (getVenueName(e.venueId, e) || '').toLowerCase().includes(query) ||
      e.tags?.some(tag => typeof tag === 'string' && tag.toLowerCase().includes(query))
    );
  }

  // Age filtering — show only items with EXPLICIT age tagging (not 'All Ages' default)
  // This makes filters useful: "Kids" shows kid-specific content, "Adults" shows adult-specific
  // The default "All Ages" option already shows everything
  if (filters.age === 'kids') {
    filtered = filtered.filter(e => {
      if (!e.ageGroup?.includes('Kids')) return false;

      if (kidsAgeRange && (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18)) {
        const text = `${e.title || ''} ${e.description || ''}`.toLowerCase();

        // Check for prenatal
        if (kidsAgeRange[0] === -1 && kidsAgeRange[1] === 0) {
          return text.includes('prenatal') || text.includes('perinatal') || text.includes('pregnant');
        }

        // Try to extract age range from title like "(3-5)" or "Ages 4-8"
        const ageMatch = text.match(/(?:ages?\s*)?(\d+)\s*[-–]\s*(\d+)/i);
        if (ageMatch) {
          const eventMinAge = parseInt(ageMatch[1]);
          const eventMaxAge = parseInt(ageMatch[2]);
          return eventMinAge <= kidsAgeRange[1] && eventMaxAge >= kidsAgeRange[0];
        }

        return true;
      }

      return true;
    });
  } else if (filters.age === 'adults') {
    // Adults includes 'All Ages' since most general events are adult-suitable
    filtered = filtered.filter(e => e.ageGroup?.includes('Adults') || e.ageGroup === 'All Ages' || e.ageGroup === '19+' || e.ageGroup === 'Teens & Adults');
  }

  // Category
  if (filters.category !== 'all') {
    filtered = filtered.filter(e => e.category === filters.category || (e.tags && e.tags.includes(filters.category)));
  }

  // Time of day — supports exact time (HH:MM) and range keywords (morning, afternoon, evening)
  if (filters.time !== 'all') {
    if (filters.time === 'morning') {
      filtered = filtered.filter(e => { const h = e.start.getHours(); return h >= 5 && h < 12; });
    } else if (filters.time === 'afternoon') {
      filtered = filtered.filter(e => { const h = e.start.getHours(); return h >= 12 && h < 17; });
    } else if (filters.time === 'evening') {
      filtered = filtered.filter(e => { const h = e.start.getHours(); return h >= 17; });
    } else {
      const [filterHour, filterMin] = filters.time.split(':').map(Number);
      const filterMinutes = (filterHour || 0) * 60 + (filterMin || 0);
      if (isNaN(filterMinutes)) return filtered;
      filtered = filtered.filter(e => {
        const eventMinutes = e.start.getHours() * 60 + e.start.getMinutes();
        return eventMinutes >= filterMinutes;
      });
    }
  }

  // Price — null/unknown pricing shows in both "All" and "Paid" but not "Free"
  if (filters.price === 'free') {
    filtered = filtered.filter(e => typeof e.price === 'string' && e.price.toLowerCase() === 'free');
  } else if (filters.price === 'paid') {
    // Show everything except explicitly "free" items — null/unknown pricing is included
    filtered = filtered.filter(e => !e.price || typeof e.price !== 'string' || e.price.toLowerCase() !== 'free');
  }

  // Sort by featured, then by date
  return filtered.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return a.start - b.start;
  });
}

/**
 * Filter and sort deals based on current filters.
 *
 * @param {Array} allDeals - Combined hardcoded + database deals
 * @param {Object} opts
 * @param {string} opts.searchQuery
 * @param {Object} opts.filters - { category }
 * @param {Function} opts.getVenueName - (venueId, deal) => string
 * @returns {Array} Filtered and sorted deals
 */
export function filterDeals(allDeals, { searchQuery, filters, getVenueName }) {
  let filtered = [...allDeals];

  // Filter out vague deals with no real value
  filtered = filtered.filter(deal => isRealDeal(deal));

  // Filter out expired deals (use Pacific time for consistency)
  const now = getPacificNow();
  filtered = filtered.filter(deal => {
    if (!deal.validUntil) return true; // No expiry = always valid
    // Parse as local date parts to avoid UTC midnight shift
    // (new Date("2026-02-17") = UTC midnight = 4 PM PST Feb 16, causing early expiry)
    const parts = String(deal.validUntil).split(/[-T]/);
    if (parts.length < 3) return true; // Unparseable = treat as valid
    const expiryDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59);
    if (isNaN(expiryDate.getTime())) return true; // Unparseable expiry = treat as valid
    return expiryDate >= now;
  });

  if (searchQuery?.trim()) {
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(d =>
      d.title?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query) ||
      d.venueName?.toLowerCase().includes(query) ||
      (getVenueName(d.venueId, d) || '').toLowerCase().includes(query)
    );
  }

  if (filters.category !== 'all') {
    filtered = filtered.filter(d => d.category === filters.category);
  }

  // Sort by deal score (best deals first)
  return filtered.sort((a, b) => {
    const scoreA = calculateDealScore(a);
    const scoreB = calculateDealScore(b);
    return scoreB - scoreA;
  });
}
