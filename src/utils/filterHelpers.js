import { isRealDeal, calculateDealScore } from './dealHelpers';

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
  filtered = filtered.filter(e => {
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
  // Always exclude past events regardless of day filter
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  if (filters.day === 'anytime') {
    // "Anytime" = all future events (not past ones)
    filtered = filtered.filter(e => e.start >= todayMidnight);
  } else if (filters.day === 'today') {
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
    const friday = new Date(now);
    const daysUntilFriday = (5 - now.getDay() + 7) % 7;
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    filtered = filtered.filter(e => e.start >= friday && e.start < monday);
  } else if (filters.day === 'nextWeek') {
    const nextMonday = new Date(now);
    const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7;
    nextMonday.setDate(now.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);
    const followingSunday = new Date(nextMonday);
    followingSunday.setDate(nextMonday.getDate() + 7);
    filtered = filtered.filter(e => e.start >= nextMonday && e.start < followingSunday);
  }

  // Search query
  if (searchQuery?.trim()) {
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(e =>
      e.title?.toLowerCase().includes(query) ||
      e.description?.toLowerCase().includes(query) ||
      getVenueName(e.venueId, e).toLowerCase().includes(query) ||
      e.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Age filtering
  if (filters.age === 'kids') {
    filtered = filtered.filter(e => {
      if (!e.ageGroup?.includes('Kids') && e.ageGroup !== 'All Ages') return false;

      if (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18) {
        const text = `${e.title} ${e.description}`.toLowerCase();

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
    filtered = filtered.filter(e => e.ageGroup?.includes('Adults') || e.ageGroup === 'All Ages' || e.ageGroup === '19+' || e.ageGroup === 'Teens & Adults');
  }

  // Category
  if (filters.category !== 'all') {
    filtered = filtered.filter(e => e.category === filters.category || (e.tags && e.tags.includes(filters.category)));
  }

  // Time of day
  if (filters.time !== 'all') {
    const [filterHour, filterMin] = filters.time.split(':').map(Number);
    const filterMinutes = filterHour * 60 + filterMin;

    filtered = filtered.filter(e => {
      const eventHour = e.start.getHours();
      const eventMin = e.start.getMinutes();
      const eventMinutes = eventHour * 60 + eventMin;
      return eventMinutes >= filterMinutes;
    });
  }

  // Price
  if (filters.price === 'free') {
    filtered = filtered.filter(e => e.price?.toLowerCase() === 'free');
  } else if (filters.price === 'paid') {
    filtered = filtered.filter(e => e.price?.toLowerCase() !== 'free' && e.price);
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

  if (searchQuery?.trim()) {
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(d =>
      d.title?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query) ||
      d.venueName?.toLowerCase().includes(query) ||
      getVenueName(d.venueId, d).toLowerCase().includes(query)
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
