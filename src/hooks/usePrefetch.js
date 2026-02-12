import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for prefetching detail page data on hover/tap.
 * Caches results so navigation is instant.
 */
export function usePrefetch() {
  const cache = useRef(new Map());
  const inflight = useRef(new Set());

  const prefetchEvent = useCallback(async (eventId) => {
    const key = `event-${eventId}`;
    if (cache.current.has(key) || inflight.current.has(key)) return;
    inflight.current.add(key);
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (data) cache.current.set(key, data);
    } catch { /* silent */ }
    inflight.current.delete(key);
  }, []);

  const prefetchDeal = useCallback(async (dealId) => {
    const key = `deal-${dealId}`;
    if (cache.current.has(key) || inflight.current.has(key)) return;
    inflight.current.add(key);
    try {
      const { data } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();
      if (data) cache.current.set(key, data);
    } catch { /* silent */ }
    inflight.current.delete(key);
  }, []);

  const prefetchService = useCallback(async (serviceId) => {
    const key = `service-${serviceId}`;
    if (cache.current.has(key) || inflight.current.has(key)) return;
    inflight.current.add(key);
    try {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', serviceId)
        .single();
      if (data) cache.current.set(key, data);
    } catch { /* silent */ }
    inflight.current.delete(key);
  }, []);

  const getCached = useCallback((type, id) => {
    return cache.current.get(`${type}-${id}`) || null;
  }, []);

  return {
    prefetchEvent,
    prefetchDeal,
    prefetchService,
    getCached,
  };
}
