import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getPacificDateStr, pacificDate } from '../utils/timezoneHelpers';

const CACHE_TTL = 30000; // 30 seconds

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
    async function fetchEvents(force = false) {
      const now = Date.now();
      if (!force && now - fetchTimestamps.current.events < CACHE_TTL && dbEvents.length > 0) return;
      fetchTimestamps.current.events = now;

      setEventsLoading(true);
      const localDateStr = getPacificDateStr();

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .gte('start_date', localDateStr)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        setEventsLoading(false);
        return;
      }

      const mappedEvents = data.map(event => {
        let startTimeStr = event.start_time || '09:00';
        let [hours, minutes] = startTimeStr.split(':').map(Number);

        // Fix suspicious times: classes at 1-5 AM are likely data errors
        if (hours >= 1 && hours <= 5) {
          hours = 9;
          minutes = 0;
        } else if (minutes === 26) {
          minutes = 0;
        }

        const fixedStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const startDate = pacificDate(event.start_date, fixedStartTime);

        let endDate;
        if (event.end_time) {
          let [endHours, endMinutes] = event.end_time.split(':').map(Number);
          if (endHours >= 1 && endHours <= 5) {
            endHours = 10;
            endMinutes = 0;
          } else if (endMinutes === 26) {
            endMinutes = 0;
          }
          const fixedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
          endDate = pacificDate(event.start_date, fixedEndTime);
        } else {
          endDate = pacificDate(event.start_date, `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
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
          ageGroup: 'All Ages',
          price: event.is_free ? 'Free' : (event.price_description || (event.price ? `$${event.price}` : 'Free')),
          recurrence: 'none',
          description: event.description || '',
          featured: event.featured || false,
          image: event.image_url
        };
      });

      setDbEvents(mappedEvents);
      setEventsLoading(false);
    }

    fetchEvents();
  }, [eventsRefreshKey]);

  // Fetch deals from Supabase
  useEffect(() => {
    async function fetchDeals(force = false) {
      const now = Date.now();
      if (!force && now - fetchTimestamps.current.deals < CACHE_TTL && dbDeals.length > 0) return;
      fetchTimestamps.current.deals = now;

      setDealsLoading(true);
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deals:', error);
        setDealsLoading(false);
        return;
      }

      const mappedDeals = data.map(deal => ({
        id: deal.id,
        title: deal.title,
        venueId: null,
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
        featured: deal.featured || false
      }));

      setDbDeals(mappedDeals);
      setDealsLoading(false);
    }

    fetchDeals();
  }, [dealsRefreshKey]);

  return {
    services, servicesLoading, fetchServices,
    dbEvents, eventsLoading, eventsRefreshKey, setEventsRefreshKey,
    dbDeals, dealsLoading, dealsRefreshKey, setDealsRefreshKey,
  };
}
