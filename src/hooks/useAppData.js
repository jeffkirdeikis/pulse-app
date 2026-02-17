import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getPacificDateStr, pacificDate } from '../utils/timezoneHelpers';

const CACHE_TTL = 30000; // 30 seconds

/**
 * Infer age group from class/event title and description.
 * Prevents "All Ages" default that makes age filters useless.
 * Returns 'Kids', 'Adults', 'Teens & Adults', or 'All Ages'.
 */
function inferAgeGroup(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();

  // Explicit kids indicators
  const kidsPatterns = [
    /\bkids?\b/, /\bchild(ren)?\b/, /\bjunior\b/, /\byouth\b/,
    /\blittle\b/, /\btots?\b/, /\btoddler\b/, /\bbaby\b/, /\bbabies\b/,
    /\binfant\b/, /\bnewborn\b/, /\bprenatal\b/, /\bperinatal\b/,
    /\bpreschool\b/, /\bpre-school\b/, /\bmommy\s*(&|and)\s*me\b/,
    /\bparent\s*(&|and)\s*(tot|child|baby)\b/,
    /\bages?\s*\d+\s*[-–]\s*\d+\b/, // "Ages 3-5"
    /\b\d+\s*[-–]\s*\d+\s*y(ear|r)s?\b/, // "3-5 years"
  ];

  // Explicit adult indicators
  const adultPatterns = [
    /\badult\b/, /\b19\+\b/, /\b18\+\b/, /\bsenior\b/, /\bover\s*\d{2}\b/,
  ];

  const isKids = kidsPatterns.some(p => p.test(text));
  const isAdults = adultPatterns.some(p => p.test(text));

  if (isKids && isAdults) return 'All Ages';
  if (isKids) return 'Kids';
  if (isAdults) return 'Adults';
  return 'All Ages';
}

/**
 * Hook for fetching and caching app data from Supabase (services, events, deals).
 * Handles caching, visibility-based refresh, and data mapping.
 */
export function useAppData() {
  // Services
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Events
  const [dbEvents, setDbEvents] = useState([]);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Deals
  const [dbDeals, setDbDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsRefreshKey, setDealsRefreshKey] = useState(0);

  // Cache timestamps to prevent duplicate API requests within 30s
  const fetchTimestamps = useRef({ services: 0, events: 0, deals: 0 });

  // Force-refresh: resets cache timestamp so the next fetch always hits the API.
  // Use for pull-to-refresh / admin approval. Visibility-change uses the normal
  // refresh key increment which still respects the 30s cache TTL.
  const forceRefreshEvents = useCallback(() => {
    fetchTimestamps.current.events = 0;
    setEventsRefreshKey(k => k + 1);
  }, []);
  const forceRefreshDeals = useCallback(() => {
    fetchTimestamps.current.deals = 0;
    setDealsRefreshKey(k => k + 1);
  }, []);

  // Fetch services from Supabase
  const fetchServices = async (force = false) => {
    const now = Date.now();
    if (!force && now - fetchTimestamps.current.services < CACHE_TTL && services.length > 0) return;
    fetchTimestamps.current.services = now;

    setServicesLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, category, address, google_rating, google_reviews, phone, website, email, logo_url')
      .eq('status', 'active')
      .order('google_rating', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching services:', error);
      // Reset cache timestamp so a retry is possible immediately
      fetchTimestamps.current.services = 0;
      setServicesLoading(false);
      return;
    }

    const mappedServices = data.map(business => ({
      id: business.id,
      name: business.name,
      category: business.category || 'Other',
      address: business.address || '',
      rating: business.google_rating,
      reviews: business.google_reviews,
      phone: business.phone || '',
      website: business.website || '',
      email: business.email || '',
      logo_url: business.logo_url || null
    }));

    setServices(mappedServices);
    setServicesLoading(false);
  };

  // Fetch services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  // Refresh data when tab becomes visible (catches admin edits, external changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchServices();
        setEventsRefreshKey(k => k + 1);
        setDealsRefreshKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch events from Supabase
  useEffect(() => {
    async function fetchEvents() {
      const now = Date.now();
      if (now - fetchTimestamps.current.events < CACHE_TTL && dbEvents.length > 0) return;
      fetchTimestamps.current.events = now;

      setEventsLoading(true);
      try {
      const localDateStr = getPacificDateStr();

      // Supabase PostgREST server caps at 1000 rows per request.
      // Paginate to fetch all active future events.
      let allData = [];
      let page = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: pageData, error } = await supabase
          .from('events')
          .select('id, title, event_type, venue_id, venue_name, venue_address, start_date, start_time, end_time, tags, category, description, is_free, price, price_description, featured, image_url, view_count, created_at, business_id')
          .eq('status', 'active')
          .gte('start_date', localDateStr)
          .order('start_date', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
          console.error('Error fetching events:', error);
          fetchTimestamps.current.events = 0;
          return;
        }

        allData = allData.concat(pageData);
        hasMore = pageData && pageData.length === PAGE_SIZE;
        page++;
        // Safety limit to prevent infinite pagination
        if (allData.length > 50000) {
          if (import.meta.env.DEV) console.warn('Event pagination exceeded safety limit');
          break;
        }
      }

      const data = allData;

      const mappedEvents = data.map(event => {
        const timeUnknown = !event.start_time;
        let startTimeStr = event.start_time || '09:00';
        let [hours, minutes] = startTimeStr.split(':').map(Number);

        // Guard against NaN from unparseable time strings
        if (isNaN(hours) || isNaN(minutes)) {
          hours = 9;
          minutes = 0;
        }

        // Fix suspicious times: midnight through 4 AM are likely scraper errors
        // Allow 5 AM+ as legitimate early morning classes (sunrise yoga, etc.)
        if (hours >= 0 && hours <= 4) {
          hours = 9;
          minutes = 0;
        }

        const fixedStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const startDate = pacificDate(event.start_date, fixedStartTime);

        let endDate;
        if (event.end_time) {
          let [endHours, endMinutes] = event.end_time.split(':').map(Number);
          // Guard against NaN from unparseable end time strings
          if (isNaN(endHours) || isNaN(endMinutes)) {
            endHours = hours + 1;
            endMinutes = minutes;
          }
          // Same correction for end time: midnight through 4 AM
          if (endHours >= 0 && endHours <= 4) {
            endHours = 10;
            endMinutes = 0;
          }
          const fixedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
          endDate = pacificDate(event.start_date, fixedEndTime);
        } else {
          const endHour = hours >= 23 ? 23 : hours + 1;
          const endMin = hours >= 23 ? 59 : minutes;
          endDate = pacificDate(event.start_date, `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`);
        }

        return {
          id: event.id,
          title: event.title,
          eventType: event.event_type === 'class' ? 'class' : 'event',
          venueId: event.venue_id || null,
          venueName: event.venue_name || 'Squamish',
          venueAddress: event.venue_address || 'Squamish, BC',
          start: startDate,
          end: endDate,
          tags: event.tags || [event.category || 'Community'],
          category: event.category
            ? event.category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            : 'Community',
          ageGroup: inferAgeGroup(event.title, event.description),
          price: event.is_free ? 'Free' : (event.price > 0 ? `$${event.price}` : (event.price_description && !/^see (venue|studio) for pricing$/i.test(event.price_description) ? event.price_description : 'See venue for pricing')),
          recurrence: 'none',
          description: event.description || '',
          featured: event.featured || false,
          image: event.image_url,
          viewCount: event.view_count || 0,
          createdAt: event.created_at || null,
          businessId: event.business_id || event.venue_id || null,
          timeUnknown
        };
      });

      setDbEvents(mappedEvents);
      } catch (err) {
        console.error('Error fetching/mapping events:', err);
        fetchTimestamps.current.events = 0;
      } finally {
        setEventsLoading(false);
      }
    }

    fetchEvents();
  }, [eventsRefreshKey]);

  // Fetch deals from Supabase
  useEffect(() => {
    async function fetchDeals() {
      const now = Date.now();
      if (now - fetchTimestamps.current.deals < CACHE_TTL && dbDeals.length > 0) return;
      fetchTimestamps.current.deals = now;

      setDealsLoading(true);
      try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, business_id, business_name, business_address, category, description, discount_type, discount_value, original_price, deal_price, valid_until, terms_conditions, image_url, featured, schedule')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deals:', error);
        fetchTimestamps.current.deals = 0;
        return;
      }

      const mappedDeals = data.map(deal => ({
        id: deal.id,
        title: deal.title,
        venueId: deal.business_id || null,
        venueName: deal.business_name || 'Local Business',
        venueAddress: deal.business_address || 'Squamish, BC',
        category: deal.category || 'Other',
        description: deal.description || '',
        discountType: deal.discount_type,
        discountValue: deal.discount_value,
        originalPrice: deal.original_price,
        dealPrice: deal.deal_price,
        discount: deal.discount_type === 'percent' ? `${deal.discount_value}% off` :
                  deal.discount_type === 'fixed' ? `$${deal.discount_value} off` :
                  deal.discount_type === 'bogo' ? 'Buy One Get One' :
                  deal.discount_type === 'free_item' ? 'Free Item' : 'Special Offer',
        validUntil: deal.valid_until,
        terms: deal.terms_conditions || '',
        image: deal.image_url,
        featured: deal.featured || false,
        schedule: deal.schedule || ''
      }));

      setDbDeals(mappedDeals);
      } catch (err) {
        console.error('Error fetching/mapping deals:', err);
        fetchTimestamps.current.deals = 0;
      } finally {
        setDealsLoading(false);
      }
    }

    fetchDeals();
  }, [dealsRefreshKey]);

  return {
    services, servicesLoading, fetchServices,
    dbEvents, eventsLoading, eventsRefreshKey, setEventsRefreshKey, forceRefreshEvents,
    dbDeals, dealsLoading, dealsRefreshKey, setDealsRefreshKey, forceRefreshDeals,
  };
}
