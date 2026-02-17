import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PACIFIC_TZ, getPacificNow } from '../utils/timezoneHelpers';

// Format a Date as Google Calendar datetime string (YYYYMMDDTHHmmss) in Pacific timezone
function toGCalDateStr(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

/**
 * Hook for calendar-related functions (Google Calendar, My Calendar).
 *
 * @param {Object} options
 * @param {Array} options.myCalendar - User's saved calendar events
 * @param {boolean} options.isAuthenticated - Whether user is logged in
 * @param {Function} options.registerForEvent - Register event in user's calendar
 * @param {Function} options.refreshUserData - Refresh user data from DB
 * @param {Function} options.getVenueName - (venueId, event) => string
 * @param {Function} options.showToast - Toast display callback
 */
export function useCalendar({ myCalendar, isAuthenticated, session, registerForEvent, refreshUserData, getVenueName, showToast, onCalendarAdd }) {
  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = useCallback((event) => {
    if (!event || !event.start || isNaN(event.start.getTime())) return '';
    const startDate = toGCalDateStr(event.start);
    const endDate = event.end && !isNaN(event.end.getTime()) ? toGCalDateStr(event.end) : startDate;
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(getVenueName(event.venueId, event) + ', Squamish, BC');
    const ctz = encodeURIComponent(PACIFIC_TZ);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}&ctz=${ctz}`;
  }, [getVenueName]);

  // Add event to both Google Calendar and My Calendar
  const addToCalendar = useCallback(async (event) => {
    const isAlreadyInCalendar = myCalendar.some(e => e.eventId === event.id || e.id === event.id);

    if (!isAlreadyInCalendar && isAuthenticated) {
      try {
        const result = await registerForEvent({
          id: event.id,
          eventType: event.eventType || 'event',
          title: event.title,
          date: event.start && !isNaN(event.start.getTime()) ? `${event.start.getFullYear()}-${String(event.start.getMonth() + 1).padStart(2, '0')}-${String(event.start.getDate()).padStart(2, '0')}` : event.date,
          time: event.start && !isNaN(event.start.getTime()) ? event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) : event.time,
          venue: getVenueName(event.venueId, event),
          address: event.location || event.address || '',
          ...event
        });
        if (result?.error) throw result.error;
        showToast(`"${event.title}" added to My Calendar!`);
        if (onCalendarAdd) onCalendarAdd();
        window.open(generateGoogleCalendarUrl(event), '_blank');
      } catch {
        showToast('Failed to add to calendar. Please try again.', 'error');
      }
    } else if (isAlreadyInCalendar) {
      showToast(`"${event.title}" is already in your calendar`);
    } else {
      showToast('Sign in to add events to your calendar');
    }
  }, [myCalendar, isAuthenticated, registerForEvent, getVenueName, showToast, generateGoogleCalendarUrl, onCalendarAdd]);

  // Remove event from My Calendar
  const removeFromCalendar = useCallback(async (eventId) => {
    if (!isAuthenticated || !session?.user?.id) return;
    try {
      const { error } = await supabase
        .from('user_calendar')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', session.user.id);
      if (error) throw error;
      showToast('Event removed from My Calendar');
      refreshUserData();
    } catch (err) {
      console.error('Error removing from calendar:', err);
      showToast('Failed to remove event', 'error');
    }
  }, [isAuthenticated, session?.user?.id, refreshUserData, showToast]);

  // Check if event is in My Calendar
  const isInMyCalendar = useCallback((eventId) => {
    return myCalendar.some(e => e.eventId === eventId || e.id === eventId);
  }, [myCalendar]);

  // Get events grouped by date for calendar view (uses Pacific timezone for grouping)
  const getCalendarEventsByDate = useCallback(() => {
    const grouped = {};
    const pacificDateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: PACIFIC_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    myCalendar.forEach(event => {
      const eventDate = event.start ? new Date(event.start) : (event.date ? new Date(event.date) : null);
      if (!eventDate || isNaN(eventDate.getTime())) return;
      // Use Pacific timezone for date grouping to avoid midnight boundary issues
      const dateKey = pacificDateFmt.format(eventDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push({ ...event, _sortDate: eventDate });
    });
    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, events]) => ({
        date: new Date(date + 'T12:00:00'),
        events: events.sort((a, b) => a._sortDate - b._sortDate)
      }));
  }, [myCalendar]);

  return {
    generateGoogleCalendarUrl,
    addToCalendar,
    removeFromCalendar,
    isInMyCalendar,
    getCalendarEventsByDate,
  };
}
