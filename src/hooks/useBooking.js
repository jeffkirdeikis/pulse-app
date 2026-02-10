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
  const handleBookingConfirmation = useCallback(async (didBook) => {
    if (didBook && bookingEvent) {
      const business = getBusinessForEvent(bookingEvent);

      await trackAnalytics('booking_confirmed', business.id, bookingEvent.id);
      addToCalendar(bookingEvent);
      showToast('Great! Added to your calendar');
    }

    setShowBookingConfirmation(false);
    setBookingEvent(null);
  }, [bookingEvent, getBusinessForEvent, trackAnalytics, addToCalendar, showToast]);

  // Submit booking request (for businesses without booking URL)
  const submitBookingRequest = useCallback(async () => {
    if (!bookingEvent) return;

    const business = getBusinessForEvent(bookingEvent);

    setSendingMessage(true);
    try {
      const subject = `Booking Request: ${bookingEvent.title}`;
      const message = `Hi, I'd like to book:\n\n` +
        `Class: ${bookingEvent.title}\n` +
        `Date: ${bookingEvent.start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' })}\n` +
        `Time: ${bookingEvent.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}\n\n` +
        (bookingRequestMessage ? `Message: ${bookingRequestMessage}` : '');

      const conversationId = await startConversation(business.id, subject, message);

      if (conversationId) {
        await trackAnalytics('message_received', business.id, bookingEvent.id);

        setShowBookingSheet(false);
        setBookingEvent(null);

        showToast('Request sent! You\'ll hear back soon.');
        setTimeout(() => openMessages(), 1500);
      }
    } catch (err) {
      console.error('Error submitting booking request:', err);
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
