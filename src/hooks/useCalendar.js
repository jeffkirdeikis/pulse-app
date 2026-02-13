import { useCallback } from 'react';
import { PACIFIC_TZ } from '../utils/timezoneHelpers';

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
export function useCalendar({ myCalendar, isAuthenticated, registerForEvent, refreshUserData, getVenueName, showToast, onCalendarAdd }) {
  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = useCallback((event) => {
    const startDate = event.start.toISOString().replace(/-|:|\.\d+/g, '');
    const endDate = event.end.toISOString().replace(/-|:|\.\d+/g, '');
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(getVenueName(event.venueId, event) + ', Squamish, BC');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
  }, [getVenueName]);

  // Add event to both Google Calendar and My Calendar
  const addToCalendar = useCallback(async (event) => {
    const isAlreadyInCalendar = myCalendar.some(e => e.eventId === event.id || e.id === event.id);

    if (!isAlreadyInCalendar && isAuthenticated) {
      await registerForEvent({
        id: event.id,
        eventType: event.eventType || 'event',
        title: event.title,
        date: event.start ? event.start.toISOString().split('T')[0] : event.date,
        time: event.start ? event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) : event.time,
        venue: getVenueName(event.venueId, event),
        address: event.location || event.address || '',
        ...event
      });
      showToast(`"${event.title}" added to My Calendar!`);
      if (onCalendarAdd) onCalendarAdd();
    } else if (isAlreadyInCalendar) {
      showToast(`"${event.title}" is already in your calendar`);
    } else {
      showToast('Sign in to add events to your calendar');
    }

    // Open Google Calendar in new tab
    window.open(generateGoogleCalendarUrl(event), '_blank');
  }, [myCalendar, isAuthenticated, registerForEvent, getVenueName, showToast, generateGoogleCalendarUrl]);

  // Remove event from My Calendar
  const removeFromCalendar = useCallback(async (_eventId) => {
    if (!isAuthenticated) return;
    showToast('Event removed from My Calendar');
    refreshUserData();
  }, [isAuthenticated, refreshUserData, showToast]);

  // Check if event is in My Calendar
  const isInMyCalendar = useCallback((eventId) => {
    return myCalendar.some(e => e.eventId === eventId || e.id === eventId);
  }, [myCalendar]);

  // Get events grouped by date for calendar view
  const getCalendarEventsByDate = useCallback(() => {
    const grouped = {};
    myCalendar.forEach(event => {
      const dateKey = event.start.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, events]) => ({
        date: new Date(date),
        events: events.sort((a, b) => a.start - b.start)
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
