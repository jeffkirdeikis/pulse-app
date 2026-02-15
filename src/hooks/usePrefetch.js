import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook for prefetching detail page data on hover/tap.
 * Caches results so navigation is instant.
 * Cache is bounded to MAX_CACHE_SIZE entries with TTL-based eviction.
 */
export function usePrefetch() {
  const cache = useRef(new Map()); // key -> { data, timestamp }
  const inflight = useRef(new Set());

  const setCache = useCallback((key, data) => {
    // Evict oldest entries if cache is full
    if (cache.current.size >= MAX_CACHE_SIZE) {
      const oldest = cache.current.keys().next().value;
      cache.current.delete(oldest);
    }
    cache.current.set(key, { data, timestamp: Date.now() });
  }, []);

  const getCache = useCallback((key) => {
    const entry = cache.current.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      cache.current.delete(key);
      return null;
    }
    return entry.data;
  }, []);

  const prefetchEvent = useCallback(async (eventId) => {
    const key = `event-${eventId}`;
    if (getCache(key) || inflight.current.has(key)) return;
    inflight.current.add(key);
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (data) setCache(key, data);
    } catch { /* silent */ }
    inflight.current.delete(key);
  }, [getCache, setCache]);

  const prefetchDeal = useCallback(async (dealId) => {
    const key = `deal-${dealId}`;
    if (getCache(key) || inflight.current.has(key)) return;
    inflight.current.add(key);
    try {
      const { data } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();
      if (data) setCache(key, data);
    } catch { /* silent */ }
    inflight.current.delete(key);
  }, [getCache, setCache]);

  const prefetchService = useCallback(async (serviceId) => {
    const key = `service-${serviceId}`;
    if (getCache(key) || inflight.current.has(key)) return;
    inflight.current.add(key);
    try {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', serviceId)
        .single();
      if (data) setCache(key, data);
    } catch { /* silent */ }
    inflight.current.delete(key);
  }, [getCache, setCache]);

  const getCached = useCallback((type, id) => {
    return getCache(`${type}-${id}`);
  }, [getCache]);

  return {
    prefetchEvent,
    prefetchDeal,
    prefetchService,
    getCached,
  };
}
