import React, { memo, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Calendar, CalendarPlus, Check, Clock, DollarSign, ExternalLink,
  MapPin, Navigation, Repeat, Share2, Sparkles, Star, Ticket,
  Users, Building, Zap
} from 'lucide-react';
import { PACIFIC_TZ } from '../../utils/timezoneHelpers';

const EventDetailModal = memo(function EventDetailModal({
  event,
  onClose,
  getVenueName,
  isVerified,
  isInMyCalendar,
  addToCalendar,
  handleBookClick,
  isItemSavedLocal,
  toggleSave,
  showToast,
}) {
  if (!event) return null;

  const itemType = event.eventType === 'class' ? 'class' : 'event';

  const handleShare = async () => {
    const shareData = {
      title: event.title,
      text: `Check out ${event.title} at ${getVenueName(event.venueId, event)}`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
        showToast('Link copied to clipboard!');
      }
    } catch (err) {
      // User cancelled share or share failed — don't show misleading toast
    }
  };

  const dragY = useMotionValue(0);
  const modalOpacity = useTransform(dragY, [0, 300], [1, 0.2]);
  const modalScale = useTransform(dragY, [0, 300], [1, 0.92]);
  const modalRef = useRef(null);

  const handleDragEnd = (_, info) => {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose();
    }
  };

  // Only allow drag when scrolled to top
  const handleDragStart = (_, info) => {
    if (modalRef.current && modalRef.current.scrollTop > 10) {
      // Cancel drag if scrolled down — user is scrolling content, not dismissing
      return false;
    }
  };

  return (
    <div className="modal-overlay event-modal-overlay" role="dialog" aria-modal="true" aria-label="Event details" onClick={onClose}>
      <motion.div
        className="event-detail-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ y: dragY, opacity: modalOpacity, scale: modalScale }}
      >
        {/* Drag Handle */}
        <div className="modal-drag-handle" aria-hidden="true">
          <div className="drag-handle-bar" />
        </div>
        <button className="close-btn event-close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M1 13L13 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Hero Section */}
        <div className={`event-hero ${event.eventType === 'class' ? 'class-hero' : ''}`}>
          <div className="event-hero-content">
            <div className="event-hero-badges">
              {event.eventType === 'class' ? (
                <span className="event-type-pill class-pill">
                  <Sparkles size={12} />
                  Class
                </span>
              ) : (
                <span className="event-type-pill event-pill">
                  <Zap size={12} />
                  Event
                </span>
              )}
              {event.recurrence !== 'none' && (
                <span className="recurring-pill">
                  <Repeat size={12} />
                  {event.recurrence}
                </span>
              )}
            </div>
            <h1 className="event-hero-title">{event.title}</h1>
            <div className="event-hero-venue">
              <MapPin size={16} />
              <span>{getVenueName(event.venueId, event)}</span>
              {isVerified(event.venueId) && (
                <div className="venue-verified-badge">
                  <Check size={12} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date/Time Card */}
        <div className="event-datetime-card">
          <div className="datetime-icon">
            <Calendar size={24} />
          </div>
          <div className="datetime-content">
            <div className="datetime-date">
              {event.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="datetime-time">
              {(() => {
                const startStr = event.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
                if (!event.end) return startStr;
                const endStr = event.end.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
                return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
              })()}
            </div>
          </div>
          <button
            className={`add-calendar-btn ${isInMyCalendar(event.id) ? 'added' : ''}`}
            onClick={() => addToCalendar(event)}
            style={{
              width: '44px', height: '44px', minWidth: '44px',
              background: isInMyCalendar(event.id) ? '#dcfce7' : '#ffffff',
              border: isInMyCalendar(event.id) ? '2px solid #bbf7d0' : '2px solid #c7d2fe',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ color: isInMyCalendar(event.id) ? '#047857' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isInMyCalendar(event.id) ? <Check size={22} strokeWidth={3} /> : <CalendarPlus size={22} strokeWidth={2} />}
            </div>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="event-quick-actions">
          {event.eventType === 'class' && (
            <button className="quick-action-btn book-class-highlight" onClick={() => handleBookClick(event)}>
              <div className="quick-action-icon book-class"><Ticket size={20} /></div>
              <span>Book</span>
            </button>
          )}
          <button
            className={`quick-action-btn ${isItemSavedLocal(itemType, event.id) ? 'saved' : ''}`}
            onClick={() => toggleSave(event.id, itemType, event.title, { venue: event.venueName, date: event.start })}
          >
            <div className={`quick-action-icon save ${isItemSavedLocal(itemType, event.id) ? 'saved' : ''}`}>
              <Star size={20} fill={isItemSavedLocal(itemType, event.id) ? 'currentColor' : 'none'} />
            </div>
            <span>{isItemSavedLocal(itemType, event.id) ? 'Saved' : 'Save'}</span>
          </button>
          <button className="quick-action-btn" onClick={handleShare}>
            <div className="quick-action-icon share"><Share2 size={20} /></div>
            <span>Share</span>
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getVenueName(event.venueId, event) + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="quick-action-btn"
          >
            <div className="quick-action-icon directions"><Navigation size={20} /></div>
            <span>Directions</span>
          </a>
        </div>

        {/* Details Section */}
        <div className="event-section">
          <h2 className="event-section-title">Details</h2>
          <div className="event-details-grid">
            {event.price && (
              <div className="event-detail-card">
                <div className="event-detail-icon price-icon"><DollarSign size={20} /></div>
                <div className="event-detail-content">
                  <span className="event-detail-label">Price</span>
                  <span className="event-detail-value">{event.price}</span>
                </div>
              </div>
            )}
            {event.ageGroup && (
              <div className="event-detail-card">
                <div className="event-detail-icon age-icon"><Users size={20} /></div>
                <div className="event-detail-content">
                  <span className="event-detail-label">Age Group</span>
                  <span className="event-detail-value">{event.ageGroup}</span>
                </div>
              </div>
            )}
            <div className="event-detail-card">
              <div className="event-detail-icon venue-icon"><Building size={20} /></div>
              <div className="event-detail-content">
                <span className="event-detail-label">Venue</span>
                <span className="event-detail-value">{getVenueName(event.venueId, event)}</span>
              </div>
            </div>
            <div className="event-detail-card">
              <div className="event-detail-icon time-icon"><Clock size={20} /></div>
              <div className="event-detail-content">
                <span className="event-detail-label">Duration</span>
                <span className="event-detail-value">
                  {(() => {
                    if (!event.end) return 'See details';
                    const mins = Math.round((event.end - event.start) / (1000 * 60));
                    return mins > 0 ? `${mins} min` : 'See details';
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="event-section">
          <h2 className="event-section-title">About</h2>
          <p className="event-about-text">{event.description}</p>
        </div>

        {/* CTA Section */}
        <div className="event-cta-section">
          {event.eventType === 'class' && (
            <button
              className="event-cta-btn primary book-class-btn"
              onClick={() => handleBookClick(event)}
            >
              <ExternalLink size={18} />
              Book Class
            </button>
          )}
          <button
            className={`event-cta-btn ${event.eventType === 'class' ? 'secondary' : 'primary'} ${isInMyCalendar(event.id) ? 'added' : ''}`}
            onClick={() => addToCalendar(event)}
          >
            {isInMyCalendar(event.id) ? (<><Check size={18} /> Added to Calendar</>) : (<><Calendar size={18} /> Add to Calendar</>)}
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getVenueName(event.venueId, event) + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="event-cta-btn secondary"
          >
            <MapPin size={18} />
            View Venue
          </a>
        </div>

        {/* Footer */}
        <div className="event-modal-footer">
          <p>Event information may change. Please verify with organizer.</p>
        </div>
      </motion.div>
    </div>
  );
});

export default EventDetailModal;
