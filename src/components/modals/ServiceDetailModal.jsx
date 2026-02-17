import React, { memo, useState } from 'react';
import {
  CheckCircle, ChevronRight, Globe, Mail, MapPin, Navigation,
  Phone, Star, Users, Wrench, X
} from 'lucide-react';

function getSafeWebsiteUrl(url) {
  if (!url) return null;
  try {
    const full = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(full);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

const ServiceDetailModal = memo(function ServiceDetailModal({
  service,
  onClose,
  isItemSavedLocal,
  toggleSave,
  showToast,
}) {
  const [userServiceRating, setUserServiceRating] = useState(0);
  const [hoverServiceRating, setHoverServiceRating] = useState(0);

  if (!service) return null;
  const safeWebsite = getSafeWebsiteUrl(service.website);

  const handleClose = () => {
    setUserServiceRating(0);
    setHoverServiceRating(0);
    onClose();
  };

  return (
    <div className="modal-overlay service-modal-overlay" role="dialog" aria-modal="true" aria-label="Service details" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="service-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-btn service-close" onClick={handleClose} aria-label="Close"><X size={24} /></button>

        {/* Hero Section */}
        <div className="service-hero">
          <div className="service-hero-content">
            <div className="service-hero-category">
              <span className="category-pill">{service.category}</span>
            </div>
            <h1 className="service-hero-title">{service.name}</h1>
            {service.address && (
            <div className="service-hero-location">
              <MapPin size={16} />
              <span>{service.address}</span>
            </div>
            )}
          </div>

          {/* Rating Card */}
          {service.rating && (
            <div className="service-rating-card">
              <div className="rating-score">{service.rating}</div>
              <div className="rating-stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} size={16} fill={star <= Math.round(service.rating || 0) ? '#fbbf24' : 'none'} stroke="#fbbf24" />
                ))}
              </div>
              <div className="rating-reviews">{service.reviews?.toLocaleString() || 0} Google reviews</div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="service-quick-actions">
          <a
            href={service.phone ? `tel:${service.phone.replace(/[^\d+]/g, '')}` : '#'}
            className={`quick-action-btn ${!service.phone ? 'disabled' : ''}`}
            onClick={(e) => !service.phone && e.preventDefault()}
          >
            <div className="quick-action-icon call"><Phone size={20} /></div>
            <span>Call</span>
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(service.name + ' ' + service.address)}`}
            target="_blank" rel="noopener noreferrer" className="quick-action-btn"
          >
            <div className="quick-action-icon directions"><Navigation size={20} /></div>
            <span>Directions</span>
          </a>
          <a
            href={safeWebsite || `https://www.google.com/search?q=${encodeURIComponent(service.name + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="quick-action-btn"
          >
            <div className="quick-action-icon website"><Globe size={20} /></div>
            <span>{safeWebsite ? 'Website' : 'Search'}</span>
          </a>
          <button
            type="button"
            className={`quick-action-btn ${isItemSavedLocal('service', service.id) ? 'saved' : ''}`}
            onClick={() => toggleSave(service.id, 'service', service.name, { category: service.category })}
          >
            <div className={`quick-action-icon save ${isItemSavedLocal('service', service.id) ? 'saved' : ''}`}>
              <Star size={20} fill={isItemSavedLocal('service', service.id) ? 'currentColor' : 'none'} />
            </div>
            <span>{isItemSavedLocal('service', service.id) ? 'Saved' : 'Save'}</span>
          </button>
        </div>

        {/* About Section */}
        <div className="service-section">
          <h2 className="service-section-title">About</h2>
          <p className="service-about-text">
            {service.description || `${service.name} is a ${(service.category || 'local').toLowerCase()} business located in Squamish, BC.`}
          </p>
        </div>

        {/* Details Section */}
        <div className="service-section">
          <h2 className="service-section-title">Details</h2>
          <div className="service-details-grid">
            <div className="detail-card">
              <div className="detail-card-icon"><Wrench size={20} /></div>
              <div className="detail-card-content">
                <span className="detail-label">Category</span>
                <span className="detail-value">{service.category}</span>
              </div>
            </div>
            {service.address && (
            <div className="detail-card">
              <div className="detail-card-icon"><MapPin size={20} /></div>
              <div className="detail-card-content">
                <span className="detail-label">Location</span>
                <span className="detail-value">{service.address}</span>
              </div>
            </div>
            )}
            {service.phone && (
              <div className="detail-card">
                <div className="detail-card-icon"><Phone size={20} /></div>
                <div className="detail-card-content">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{service.phone}</span>
                </div>
              </div>
            )}
            {service.email && (
              <div className="detail-card">
                <div className="detail-card-icon"><Mail size={20} /></div>
                <div className="detail-card-content">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{service.email}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rating & Community Section */}
        <div className="service-section">
          <div className="rating-community-card">
            {/* Rating Display */}
            <div className="rating-display">
              <div className="rating-score">
                <span className="rating-number">{service.rating != null ? service.rating : '\u2014'}</span>
                <div className="rating-meta">
                  <div className="rating-stars-row">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star} size={18}
                        fill={star <= Math.round(service.rating || 0) ? '#fbbf24' : '#e5e7eb'}
                        stroke={star <= Math.round(service.rating || 0) ? '#fbbf24' : '#e5e7eb'}
                      />
                    ))}
                  </div>
                  <span className="rating-count">{service.reviews?.toLocaleString() || 0} reviews</span>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.name + ' Squamish BC')}`}
                target="_blank" rel="noopener noreferrer" className="google-reviews-link"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google Reviews
                <ChevronRight size={16} />
              </a>
            </div>

            <div className="rating-divider"></div>

            {/* Rate This Business */}
            <div className="rate-this-business">
              <p className="rate-prompt">Used this business?</p>
              <h3 className="rate-title">Share your experience</h3>
              <div className="rate-stars-interactive" onMouseLeave={() => setHoverServiceRating(0)}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star} className="rate-star-btn"
                    onMouseEnter={() => setHoverServiceRating(star)}
                    onClick={(e) => { e.stopPropagation(); setUserServiceRating(star); }}
                  >
                    <Star
                      size={32}
                      fill={(hoverServiceRating || userServiceRating) >= star ? '#fbbf24' : '#e5e7eb'}
                      stroke={(hoverServiceRating || userServiceRating) >= star ? '#f59e0b' : '#d1d5db'}
                    />
                  </button>
                ))}
              </div>
              <p className="rate-helper">
                {userServiceRating > 0
                  ? `You rated ${userServiceRating} star${userServiceRating > 1 ? 's' : ''} — Rating feature coming soon!`
                  : 'Tap a star to rate'}
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="trust-indicators">
            {(service.reviews || 0) >= 50 && (service.rating || 0) >= 4 && (
              <div className="trust-badge verified"><CheckCircle size={16} /><span>Top Rated</span></div>
            )}
            {(service.reviews || 0) >= 100 && (
              <div className="trust-badge popular"><Users size={16} /><span>Popular Choice</span></div>
            )}
            <div className="trust-badge local"><MapPin size={16} /><span>Squamish Local</span></div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="service-cta-section">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.name + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="service-cta-btn primary"
          >
            <Navigation size={18} />
            View on Google Maps
          </a>
          <a
            href={safeWebsite || `https://www.google.com/search?q=${encodeURIComponent(service.name + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="service-cta-btn secondary"
          >
            <Globe size={18} />
            {safeWebsite ? 'Visit Website' : 'Search Online'}
          </a>
        </div>

        {/* Footer */}
        <div className="service-modal-footer">
          <p>Information sourced from Google. Last updated recently.</p>
          <button type="button" className="report-btn" onClick={() => showToast('Report submitted. Thank you!', 'info')}>Report an issue</button>
        </div>
      </div>
    </div>
  );
});

export default ServiceDetailModal;
