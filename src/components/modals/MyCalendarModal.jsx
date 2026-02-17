import React, { memo } from 'react';
import { Calendar, ExternalLink, Globe, MapPin, Trash2, X } from 'lucide-react';
import { PACIFIC_TZ } from '../../utils/timezoneHelpers';

const MyCalendarModal = memo(function MyCalendarModal({
  myCalendar,
  showCalendarToast,
  calendarToastMessage,
  onClose,
  setCurrentSection,
  setCalendarToastMessage,
  setShowCalendarToast,
  getCalendarEventsByDate,
  getVenueName,
  generateGoogleCalendarUrl,
  removeFromCalendar,
}) {
  return (
    <div className="modal-overlay calendar-modal-overlay" role="dialog" aria-modal="true" aria-label="My calendar" onClick={() => onClose()}>
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-btn calendar-close" onClick={() => onClose()} aria-label="Close"><X size={24} /></button>

        {/* Calendar Header */}
        <div className="calendar-header">
          <div className="calendar-header-content">
            <div className="calendar-icon-wrapper">
              <Calendar size={28} />
            </div>
            <div>
              <h1>My Calendar</h1>
              <p>{myCalendar.length} upcoming event{myCalendar.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="calendar-content">
          {myCalendar.length === 0 ? (
            <div className="calendar-empty">
              <div className="empty-calendar-icon">
                <Calendar size={48} />
              </div>
              <h3>No Events Yet</h3>
              <p>Add events from the Events & Classes section to build your personal calendar</p>
              <button 
                className="browse-events-btn"
                onClick={() => { onClose(); setCurrentSection('events'); }}
              >
                Browse Events
              </button>
            </div>
          ) : (
            <div className="calendar-events-list">
              {(getCalendarEventsByDate() || []).map(({ date, events }) => (
                <div key={date.toISOString()} className="calendar-date-group">
                  <div className="calendar-date-header">
                    <div className="calendar-date-badge">
                      <span className="date-day">{date.getDate()}</span>
                      <span className="date-month">{date.toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'short' })}</span>
                    </div>
                    <div className="calendar-date-info">
                      <span className="date-weekday">{date.toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long' })}</span>
                      <span className="date-full">{date.toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="calendar-date-events">
                    {events.map(event => (
                      <div key={event.id} className={`calendar-event-card ${event.eventType === 'class' ? 'class' : 'event'}`}>
                        <div className="calendar-event-time">
                          <span>{event.start ? new Date(event.start).toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) : ''}</span>
                          {event.end && !isNaN(new Date(event.end).getTime()) && <>
                            <span className="time-separator">-</span>
                            <span>{new Date(event.end).toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
                          </>}
                        </div>
                        <div className="calendar-event-details">
                          <div className="calendar-event-header">
                            <h4>{event.title}</h4>
                            {event.eventType === 'class' && (
                              <span className="calendar-event-badge class">Class</span>
                            )}
                          </div>
                          <div className="calendar-event-venue">
                            <MapPin size={14} />
                            <span>{getVenueName(event.venueId, event)}</span>
                          </div>
                        </div>
                        <div className="calendar-event-actions">
                          <a 
                            href={generateGoogleCalendarUrl(event)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="calendar-action-btn google"
                            title="Open in Google Calendar"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button 
                            className="calendar-action-btn remove"
                            onClick={() => removeFromCalendar(event.id)}
                            title="Remove from calendar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendar Footer */}
        {myCalendar.length > 0 && (
          <div className="calendar-footer">
            <a 
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="google-calendar-link"
            >
              <Globe size={16} />
              Open Google Calendar
            </a>
          </div>
        )}
      </div>
    </div>
  );
});

export default MyCalendarModal;
