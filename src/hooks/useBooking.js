import { useState, useCallback } from 'react';
import { PACIFIC_TZ } from '../utils/timezoneHelpers';
import { getBookingUrl, getBookingType } from '../utils/bookingHelpers';

/**
 * Hook for booking flow state and functions.
 *
 * @param {Object} options
 * @param {Function} options.getVenueName - (venueId, event) => string
 * @param {Array} options.venues - REAL_DATA.venues array
 * @param {Function} options.trackAnalytics - Analytics tracking callback
 * @param {Function} options.addToCalendar - Calendar add callback
 * @param {Function} options.startConversation - Start messaging conversation
 * @param {Function} options.openMessages - Open messages modal
 * @param {Function} options.setSendingMessage - Set sending state (from useMessaging)
 * @param {Function} options.showToast - Toast display callback
 */
export function useBooking({ getVenueName, venues, trackAnalytics, addToCalendar, startConversation, openMessages, setSendingMessage, showToast }) {
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [bookingEvent, setBookingEvent] = useState(null);
  const [bookingStep, setBookingStep] = useState('iframe');
  const [, setIframeLoaded] = useState(false);
  const [, setIframeFailed] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [bookingRequestMessage, setBookingRequestMessage] = useState('');

  // Get business info for an event, including booking URL from lookup
  const getBusinessForEvent = useCallback((event) => {
    const venueName = getVenueName(event.venueId, event);
    const venue = venues.find(v => v.name === venueName);
    const bookingUrl = getBookingUrl(venueName) || event.bookingUrl;
    const bookingType = getBookingType(venueName);

    return {
      id: venue?.id || event.venueId,
      name: venueName,
      booking_url: bookingUrl,
      booking_type: bookingType,
      ...venue
    };
  }, [getVenueName, venues]);

  // Handle booking button click
  const handleBookClick = useCallback((event) => {
    const business = getBusinessForEvent(event);

    trackAnalytics('booking_click', business.id, event.id);

    setBookingEvent(event);
    setIframeLoaded(false);
    setIframeFailed(false);
    setBookingRequestMessage('');

    const hasBookingUrl = business.booking_url;
    if (hasBookingUrl) {
      setBookingStep('iframe');
    } else {
      setBookingStep('request');
    }

    setShowBookingSheet(true);
  }, [getBusinessForEvent, trackAnalytics]);

  // Close booking sheet and show confirmation
  const closeBookingSheet = useCallback(() => {
    const business = bookingEvent ? getBusinessForEvent(bookingEvent) : null;
    const hasBookingUrl = business?.booking_url;

    setShowBookingSheet(false);

    if (hasBookingUrl && bookingStep === 'iframe') {
      setShowBookingConfirmation(true);
    }
  }, [bookingEvent, bookingStep, getBusinessForEvent]);

  // Handle booking confirmation response
  // Optimistic: add to calendar and close immediately, track analytics in background
  const handleBookingConfirmation = useCallback(async (didBook) => {
    // Optimistic: close confirmation and show feedback immediately
    setShowBookingConfirmation(false);

    if (didBook && bookingEvent) {
      const eventSnapshot = bookingEvent;
      const business = getBusinessForEvent(eventSnapshot);

      // Instant UI update
      addToCalendar(eventSnapshot);
      showToast('Great! Added to your calendar');

      // Track analytics in background (don't block UI)
      trackAnalytics('booking_confirmed', business.id, eventSnapshot.id).catch(() => {});
    }

    setBookingEvent(null);
  }, [bookingEvent, getBusinessForEvent, trackAnalytics, addToCalendar, showToast]);

  // Submit booking request (for businesses without booking URL)
  // Optimistic UI: close sheet and show success immediately, send in background
  const submitBookingRequest = useCallback(async () => {
    if (!bookingEvent) return;

    const business = getBusinessForEvent(bookingEvent);
    const eventSnapshot = bookingEvent;
    const messageSnapshot = bookingRequestMessage;

    // Optimistic: close immediately and show success
    setShowBookingSheet(false);
    setBookingEvent(null);
    showToast('Request sent! You\'ll hear back soon.');

    // Fire API call in background
    setSendingMessage(true);
    try {
      const subject = `Booking Request: ${eventSnapshot.title}`;
      const dateStr = eventSnapshot.start?.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' }) || 'Date TBD';
      const timeStr = eventSnapshot.start?.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) || 'Time TBD';
      const message = `Hi, I'd like to book:\n\n` +
        `Class: ${eventSnapshot.title}\n` +
        `Date: ${dateStr}\n` +
        `Time: ${timeStr}\n\n` +
        (messageSnapshot ? `Message: ${messageSnapshot}` : '');

      const conversationId = await startConversation(business.id, subject, message);

      if (conversationId) {
        await trackAnalytics('message_received', business.id, eventSnapshot.id);
        setTimeout(() => openMessages(), 1500);
      } else {
        // startConversation returned null — request failed silently
        showToast('Failed to send request. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Error submitting booking request:', err);
      // Rollback: show error since the request actually failed
      showToast('Failed to send request. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  }, [bookingEvent, bookingRequestMessage, getBusinessForEvent, trackAnalytics, startConversation, openMessages, setSendingMessage, showToast]);

  return {
    showBookingSheet, setShowBookingSheet,
    bookingEvent, setBookingEvent,
    bookingStep, setBookingStep,
    showBookingConfirmation,
    bookingRequestMessage, setBookingRequestMessage,
    getBusinessForEvent,
    handleBookClick,
    closeBookingSheet,
    handleBookingConfirmation,
    submitBookingRequest,
  };
}
