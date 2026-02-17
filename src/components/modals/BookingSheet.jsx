import React, { memo } from 'react';
import { Calendar, Clock, ExternalLink, Info, Send, Ticket } from 'lucide-react';
import { PACIFIC_TZ } from '../../utils/timezoneHelpers';

const BookingSheet = memo(function BookingSheet({
  bookingEvent,
  bookingStep,
  bookingRequestMessage,
  setBookingRequestMessage,
  sendingMessage,
  onClose,
  getVenueName,
  getBusinessForEvent,
  trackAnalytics,
  addToCalendar,
  submitBookingRequest,
  showToast,
}) {
  if (!bookingEvent) return null;
  return (
    <div className="modal-overlay booking-sheet-overlay" role="dialog" aria-modal="true" aria-label="Book class" onClick={onClose}>
      <div className={`booking-bottom-sheet ${bookingStep === 'iframe' ? 'full-height' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <button type="button" className="close-btn sheet-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Header - always shown */}
        <div className="sheet-header">
          <h2>{bookingStep === 'request' ? 'Request to Book' : 'Book Now'}</h2>
          <p className="sheet-subtitle">{getVenueName(bookingEvent.venueId, bookingEvent)}</p>
          <div className="sheet-event-details">
            <div className="event-title-row">{bookingEvent.title}</div>
            <div className="sheet-event-info">
              <Calendar size={14} />
              <span>{bookingEvent.start?.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' }) || 'Date TBD'}</span>
              <span className="dot">•</span>
              <Clock size={14} />
              <span>{bookingEvent.start?.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) || 'Time TBD'}</span>
            </div>
          </div>
        </div>

        {/* External booking view - for businesses with booking URLs */}
        {bookingStep === 'iframe' && (() => {
          const business = getBusinessForEvent(bookingEvent);
          const rawUrl = business?.booking_url;
          const bookingUrl = rawUrl && (() => { try { const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } })();

          return (
            <div className="external-booking-container">
              {bookingUrl ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="open-booking-btn"
                onClick={() => {
                  trackAnalytics('booking_click', business?.id, bookingEvent.id);
                }}
              >
                <Ticket size={20} />
                Open Booking Page
              </a>
              ) : (
              <div className="open-booking-btn" style={{ opacity: 0.5, cursor: 'default' }}>
                <Ticket size={20} />
                Booking link unavailable
              </div>
              )}

              <button
                className="add-calendar-secondary"
                onClick={() => {
                  addToCalendar(bookingEvent);
                }}
              >
                <Calendar size={18} />
                Add to Calendar
              </button>

              <p className="booking-note">
                After booking, come back and let us know so we can track it for you.
              </p>
            </div>
          );
        })()}

        {/* Request to book form */}
        {bookingStep === 'request' && (
          <div className="booking-request-form">
            <div className="request-info-card">
              <Info size={18} />
              <p>This business doesn't have online booking. Send them a request and they'll get back to you.</p>
            </div>

            <div className="form-field">
              <label>Add a message (optional)</label>
              <textarea
                placeholder="Any special requests or questions..."
                value={bookingRequestMessage}
                onChange={(e) => setBookingRequestMessage(e.target.value)}
                rows={3}
              />
            </div>

            <button
              className="send-request-btn"
              onClick={submitBookingRequest}
              disabled={sendingMessage}
            >
              {sendingMessage ? (
                <>
                  <div className="spinner-small" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send Booking Request
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default BookingSheet;
