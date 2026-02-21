import React, { memo, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Calendar, CalendarPlus, Check, Clock, DollarSign, ExternalLink,
  Globe, MapPin, Navigation, Phone, Repeat, Share2, Sparkles, Star, Ticket,
  Users, Building, Zap
} from 'lucide-react';
import { PACIFIC_TZ } from '../../utils/timezoneHelpers';

const EventDetailModal = memo(function EventDetailModal({
  event,
  onClose,
  getVenueName,
  venues,
  matchedService,
  onViewVenue,
  isVerified,
  isInMyCalendar,
  addToCalendar,
  handleBookClick,
  isItemSavedLocal,
  toggleSave,
  showToast,
}) {
  // All hooks must be called before any early return (Rules of Hooks)
  const dragY = useMotionValue(0);
  const modalOpacity = useTransform(dragY, [0, 300], [1, 0.2]);
  const modalScale = useTransform(dragY, [0, 300], [1, 0.92]);
  const modalRef = useRef(null);

  if (!event) return null;

  const itemType = event.eventType === 'class' ? 'class' : 'event';
  const saved = isItemSavedLocal(itemType, event.id);
  const inCalendar = isInMyCalendar?.(event.id);
  const venueName = getVenueName(event.venueId, event);
  const venueVerified = isVerified(event.venueId);
  const venue = venues?.find(v => v.id === event.venueId);

  const handleShare = async () => {
    const shareData = {
      title: event.title,
      text: `Check out ${event.title} at ${venueName}`,
      url: window.location.href
    };
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
        showToast('Link copied to clipboard!', 'success');
      }
    } catch (err) {
      // User cancelled share or share failed — don't show misleading toast
    }
  };

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
    <div className="modal-overlay event-modal-overlay" role="dialog" aria-modal="true" aria-label="Event details" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
        <button type="button" className="close-btn event-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
              {event.recurrence && event.recurrence !== 'none' && (
                <span className="recurring-pill">
                  <Repeat size={12} />
                  {event.recurrence}
                </span>
              )}
            </div>
            <h1 className="event-hero-title">{event.title}</h1>
            <div className="event-hero-venue">
              <MapPin size={16} />
              <span>{venueName}</span>
              {venueVerified && (
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
              {event.start?.toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' }) || 'Date TBD'}
            </div>
            <div className="datetime-time">
              {(() => {
                if (!event.start) return 'Time TBD';
                const startStr = event.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
                if (!event.end || !(event.end instanceof Date) || isNaN(event.end.getTime())) return startStr;
                const endStr = event.end.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });
                return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
              })()}
            </div>
          </div>
          <button
            type="button"
            className={`add-calendar-btn ${inCalendar ? 'added' : ''}`}
            onClick={() => addToCalendar?.(event)}
            style={{
              width: '44px', height: '44px', minWidth: '44px',
              background: inCalendar ? '#dcfce7' : '#ffffff',
              border: inCalendar ? '2px solid #bbf7d0' : '2px solid #c7d2fe',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}
          >
            <div style={{ color: inCalendar ? '#047857' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {inCalendar ? <Check size={22} strokeWidth={3} /> : <CalendarPlus size={22} strokeWidth={2} />}
            </div>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="event-quick-actions">
          {event.eventType === 'class' && (
            <button type="button" className="quick-action-btn book-class-highlight" onClick={() => handleBookClick(event)}>
              <div className="quick-action-icon book-class"><Ticket size={20} /></div>
              <span>Book</span>
            </button>
          )}
          <button
            type="button"
            className={`quick-action-btn ${saved ? 'saved' : ''}`}
            onClick={() => toggleSave(event.id, itemType, event.title, { venue: venueName, date: event.start })}
          >
            <div className={`quick-action-icon save ${saved ? 'saved' : ''}`}>
              <Star size={20} fill={saved ? 'currentColor' : 'none'} />
            </div>
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
          <button type="button" className="quick-action-btn" onClick={handleShare}>
            <div className="quick-action-icon share"><Share2 size={20} /></div>
            <span>Share</span>
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venueName + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="quick-action-btn"
          >
            <div className="quick-action-icon directions"><Navigation size={20} /></div>
            <span>Directions</span>
          </a>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank" rel="noopener noreferrer" className="quick-action-btn"
            >
              <div className="quick-action-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}><ExternalLink size={20} /></div>
              <span>More Info</span>
            </a>
          )}
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
                <span className="event-detail-value">{venueName}</span>
              </div>
            </div>
            <div className="event-detail-card">
              <div className="event-detail-icon time-icon"><Clock size={20} /></div>
              <div className="event-detail-content">
                <span className="event-detail-label">Duration</span>
                <span className="event-detail-value">
                  {(() => {
                    if (!event.end || !event.start) return 'See details';
                    const mins = Math.round((event.end - event.start) / (1000 * 60));
                    return mins > 0 && isFinite(mins) ? `${mins} min` : 'See details';
                  })()}
                </span>
              </div>
            </div>
            {event.venueAddress && event.venueAddress !== 'Squamish, BC' && (
              <div className="event-detail-card">
                <div className="event-detail-icon" style={{ background: '#fef3c7', color: '#d97706' }}><MapPin size={20} /></div>
                <div className="event-detail-content">
                  <span className="event-detail-label">Address</span>
                  <span className="event-detail-value">{event.venueAddress}</span>
                </div>
              </div>
            )}
            {event.category && (
              <div className="event-detail-card">
                <div className="event-detail-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}><Sparkles size={20} /></div>
                <div className="event-detail-content">
                  <span className="event-detail-label">Category</span>
                  <span className="event-detail-value">{event.category}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* About Section */}
        <div className="event-section">
          <h2 className="event-section-title">About</h2>
          {event.description && (
            <p className="event-about-text" style={{ whiteSpace: 'pre-line' }}>{event.description}</p>
          )}

          {/* Category & Tags (filter out internal/system tags) */}
          {(() => {
            const internalPatterns = /^(auto-scraped|mindbody|wellnessliving|janeapp|scraped|source-|manual-entry|healcode|brandedweb|community-submitted|together-?nest|togethernest|website|perfectmind)/i;
            // Also filter venue-name slugs (kebab-case of the venue name)
            const venueSlug = venueName ? venueName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
            const userTags = event.tags?.filter(t => {
              if (internalPatterns.test(t)) return false;
              if (t.includes('-classic') || t.includes('-api') || t.includes('---')) return false;
              // Filter venue-name slugs (e.g. "shala-yoga", "squamish-barbell")
              if (venueSlug && t.toLowerCase() === venueSlug) return false;
              return true;
            }) || [];
            const hasContent = event.category || userTags.length > 0;
            return hasContent ? (
              <div className="event-about-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: event.description ? '12px' : '0' }}>
                {event.category && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', background: '#eef2ff', color: '#4338ca', fontSize: '12px', fontWeight: 600 }}>
                    {event.category}
                  </span>
                )}
                {userTags.map((tag, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '20px', background: '#f3f4f6', color: '#4b5563', fontSize: '12px', fontWeight: 500 }}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null;
          })()}

          {/* Venue Info Block */}
          {matchedService && (
            <div style={{ marginTop: '14px', padding: '12px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', marginBottom: '8px' }}>{matchedService.name}</div>
              {matchedService.address && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                  <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}><MapPin size={14} /></div>
                  {matchedService.address}
                </div>
              )}
              {matchedService.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', marginBottom: '4px' }}>
                  <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}><Phone size={14} /></div>
                  <a href={`tel:${matchedService.phone.replace(/[^\d+]/g, '')}`} style={{ color: '#475569', textDecoration: 'none' }}>{matchedService.phone}</a>
                </div>
              )}
              {matchedService.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569' }}>
                  <div style={{ color: '#6366f1', display: 'flex', alignItems: 'center' }}><Globe size={14} /></div>
                  <a href={matchedService.website.startsWith('http') ? matchedService.website : `https://${matchedService.website}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>
                    {matchedService.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA Section */}
        <div className="event-cta-section">
          {event.eventType === 'class' && (
            <button
              type="button"
              className="event-cta-btn primary book-class-btn"
              onClick={() => handleBookClick(event)}
            >
              <ExternalLink size={18} />
              Book Class
            </button>
          )}
          <button
            type="button"
            className={`event-cta-btn ${event.eventType === 'class' ? 'secondary' : 'primary'} ${inCalendar ? 'added' : ''}`}
            onClick={() => addToCalendar?.(event)}
          >
            {inCalendar ? (<><Check size={18} /> Added to Calendar</>) : (<><Calendar size={18} /> Add to Calendar</>)}
          </button>
          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank" rel="noopener noreferrer"
              className="event-cta-btn secondary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={18} />
              Event Page
            </a>
          )}
          <button
            type="button"
            className="event-cta-btn secondary"
            onClick={() => onViewVenue?.(event.venueId, venueName)}
          >
            <Building size={18} />
            View Venue
          </button>
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
