import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CalendarPlus, Check, ChevronRight, Clock, MapPin, Share2, Star, Zap } from 'lucide-react';
import { PACIFIC_TZ } from '../utils/timezoneHelpers';

function getTimeBadge(start) {
  const now = new Date();
  const diffMs = start - now;
  const diffMin = diffMs / 60000;
  if (diffMin < 0 && diffMin > -120) return { label: 'Happening Now', className: 'time-badge-now' };
  if (diffMin >= 0 && diffMin <= 30) return { label: 'Starting Soon', className: 'time-badge-soon' };
  return null;
}

function getRelativeTime(start) {
  const now = new Date();
  const diffMs = start - now;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < -120) return null; // past events beyond 2 hrs
  if (diffMin < 0) return 'now';
  if (diffMin < 60) return `in ${diffMin} min`;
  const diffHrs = Math.round(diffMin / 60);
  if (diffHrs < 24) return `in ${diffHrs} hr${diffHrs > 1 ? 's' : ''}`;
  const diffDays = Math.round(diffHrs / 24);
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return null;
}

const EventCard = React.forwardRef(({ event, venues, isItemSavedLocal, toggleSave, getVenueName, onSelect, onBookClick, onPrefetch, addToCalendar, isInMyCalendar, showToast, index = 0 }, ref) => {
  const itemType = event.eventType === 'class' ? 'class' : 'event';
  const isSaved = isItemSavedLocal(itemType, event.id);
  const inCalendar = isInMyCalendar?.(event.id);
  const timeBadge = useMemo(() => getTimeBadge(event.start), [event.start]);
  const relativeTime = useMemo(() => getRelativeTime(event.start), [event.start]);

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

  const handleShare = useCallback(async (e) => {
    e.stopPropagation();
    const venue = getVenueName(event.venueId, event);
    const time = event.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const text = `${event.title}\n📍 ${venue}\n🕐 ${time}`;
    const url = `${window.location.origin}${window.location.pathname}#${event.eventType === 'class' ? 'classes' : 'events'}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text, url }); } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        if (showToast) showToast('Link copied to clipboard');
      } catch { /* silent */ }
    }
  }, [event, getVenueName, showToast]);

  return (
    <motion.div
      ref={ref}
      className={`event-card card-enter${timeBadge ? ' event-card-urgent' : ''}`}
      layout
      style={index < 10 ? { animationDelay: `${index * 50}ms` } : undefined}
      onClick={() => onSelect(event)}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Time urgency badge */}
      {timeBadge && (
        <div className={`time-badge ${timeBadge.className}`}>
          <Zap size={12} />
          {timeBadge.label}
        </div>
      )}

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
            <span className="detail-text">
              {event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
              {relativeTime && <span className="relative-time"> · {relativeTime}</span>}
            </span>
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

      <div className="event-card-actions">
        <button
          className="share-btn"
          onClick={handleShare}
          aria-label="Share"
        >
          <Share2 size={18} stroke="#9ca3af" strokeWidth={2} />
        </button>
        <button
          className={`save-star-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          data-tooltip={isSaved ? "Saved" : "Save"}
          aria-label={isSaved ? "Remove from saved" : "Save to favorites"}
        >
          <Star size={22} fill={isSaved ? "#f59e0b" : "none"} stroke={isSaved ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
        </button>
      </div>
      <ChevronRight className="event-chevron" size={20} />
    </motion.div>
  );
});

export default EventCard;
