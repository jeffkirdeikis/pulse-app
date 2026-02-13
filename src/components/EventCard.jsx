import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CalendarPlus, Check, ChevronRight, Clock, MapPin, Star } from 'lucide-react';
import { PACIFIC_TZ } from '../utils/timezoneHelpers';

const EventCard = React.forwardRef(({ event, venues, isItemSavedLocal, toggleSave, getVenueName, onSelect, onBookClick, onPrefetch, addToCalendar, isInMyCalendar, index = 0 }, ref) => {
  const itemType = event.eventType === 'class' ? 'class' : 'event';
  const isSaved = isItemSavedLocal(itemType, event.id);
  const inCalendar = isInMyCalendar?.(event.id);

  const handleSave = async (e) => {
    e.stopPropagation();
    await toggleSave(event.id, itemType, event.title, { venue: getVenueName(event.venueId, event), date: event.start ? event.start.toISOString() : event.date });
  };

  const handleAddToCalendar = (e) => {
    e.stopPropagation();
    if (addToCalendar) addToCalendar(event);
  };

  const handlePrefetch = useCallback(() => {
    if (onPrefetch && event.id) onPrefetch(event.id);
  }, [onPrefetch, event.id]);

  return (
    <motion.div
      ref={ref}
      className="event-card card-enter"
      layout
      style={index < 10 ? { animationDelay: `${index * 50}ms` } : undefined}
      onClick={() => onSelect(event)}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="event-card-header">
        <div className="event-title-section">
          <h3>{event.title}</h3>
          {venues.find(v => v.id === event.venueId)?.verified && (
            <div
              className="verified-badge-premium-inline"
              onClick={(e) => e.stopPropagation()}
              data-tooltip="Verified"
            >
              <Check size={12} strokeWidth={3} />
            </div>
          )}
        </div>
      </div>

      <div className="event-card-body">
        <div className="event-detail-row">
          <div className="event-detail-item">
            <div className="detail-icon">
              <Calendar size={16} />
            </div>
            <span className="detail-text">{event.start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="event-detail-item">
            <div className="detail-icon">
              <Clock size={16} />
            </div>
            <span className="detail-text">{event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        </div>

        <div className="event-detail-row">
          <div className="event-detail-item venue-item">
            <div className="detail-icon">
              <MapPin size={16} />
            </div>
            <span className="detail-text">{getVenueName(event.venueId, event)}</span>
          </div>
        </div>

        <div className="event-badges-row">
          {event.ageGroup && <span className="event-badge age-badge">{event.ageGroup}</span>}
          {event.price && <span className="event-badge price-badge">{event.price}</span>}
          {event.recurrence !== 'none' && <span className="event-badge recurrence-badge">Recurring {event.recurrence}</span>}
        </div>
      </div>

      {/* Book button for classes, Add to Calendar for events */}
      {event.eventType === 'class' ? (
        <button
          className="event-book-btn"
          onClick={(e) => {
            e.stopPropagation();
            onBookClick(event);
          }}
        >
          Book
        </button>
      ) : (
        <button
          className={`event-calendar-btn ${inCalendar ? 'in-calendar' : ''}`}
          onClick={handleAddToCalendar}
          aria-label={inCalendar ? 'Added to calendar' : 'Add to calendar'}
        >
          {inCalendar ? (
            <><Check size={14} /> Added</>
          ) : (
            <><CalendarPlus size={14} /> Save Date</>
          )}
        </button>
      )}

      <button
        className={`save-star-btn ${isSaved ? 'saved' : ''}`}
        onClick={handleSave}
        data-tooltip={isSaved ? "Saved" : "Save"}
        aria-label={isSaved ? "Remove from saved" : "Save to favorites"}
      >
        <Star size={24} fill={isSaved ? "#f59e0b" : "none"} stroke={isSaved ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
      </button>
      <ChevronRight className="event-chevron" size={20} />
    </motion.div>
  );
});

export default EventCard;
