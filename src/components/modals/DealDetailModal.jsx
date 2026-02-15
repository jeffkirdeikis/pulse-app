import React, { memo } from 'react';
import {
  Check, ChevronRight, Clock, Building, Info, MapPin,
  Navigation, Share2, Star, Ticket
} from 'lucide-react';
import { generateSmartDealTitle, generateEnhancedDealDescription, getRelatedDeals } from '../../utils/dealHelpers';

const DealDetailModal = memo(function DealDetailModal({
  deal,
  onClose,
  getVenueName,
  isItemSavedLocal,
  toggleSave,
  showToast,
  onSelectDeal,
  session,
  onAuthRequired,
  supabase,
  allDeals,
}) {
  const [redeeming, setRedeeming] = React.useState(false);
  if (!deal) return null;

  const handleShare = async () => {
    const shareData = {
      title: deal.title,
      text: `Check out this deal: ${deal.title} at ${getVenueName(deal.venueId, deal) || 'a local business'}`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
        showToast('Link copied to clipboard!', 'success');
      }
    } catch (err) {
      // User cancelled share or share failed — don't show misleading toast
    }
  };

  const handleRedeem = async () => {
    if (!session?.user) {
      onAuthRequired();
      return;
    }
    if (redeeming) return;
    setRedeeming(true);
    try {
      const redemptionCode = `PULSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { error } = await supabase.from('deal_redemptions').insert({
        user_id: session.user.id,
        deal_id: deal.id,
        business_id: deal.businessId || null,
        redemption_code: redemptionCode,
        status: 'pending',
        savings_amount: deal.savingsPercent || null
      });
      if (error) {
        console.error('Error tracking redemption:', error);
        showToast('Could not process redemption. Please try again.', 'error');
        return;
      }
      showToast(`Redemption code: ${redemptionCode} - Show this to ${getVenueName(deal.venueId, deal)}!`, 'info', 5000);
    } finally {
      setRedeeming(false);
    }
  };

  const relatedDeals = getRelatedDeals(deal, allDeals);

  return (
    <div className="modal-overlay deal-modal-overlay" role="dialog" aria-modal="true" aria-label="Deal details" onClick={onClose}>
      <div className="deal-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn deal-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display: 'block'}} aria-hidden="true">
            <path d="M1 1L13 13M1 13L13 1" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Hero Section */}
        <div className="deal-hero">
          <div className="deal-hero-content">
            {deal.verified && (
              <div className="deal-hero-badges">
                <span className="verified-pill">
                  <Check size={12} />
                  Verified
                </span>
              </div>
            )}
            <h1 className="deal-hero-title">{generateSmartDealTitle(deal, getVenueName(deal.venueId, deal))}</h1>
            <div className="deal-hero-venue">
              <MapPin size={16} />
              <span>{getVenueName(deal.venueId, deal)}</span>
            </div>
          </div>
        </div>

        {/* Schedule Card */}
        {deal.schedule && (
          <div className="deal-schedule-card">
            <div className="schedule-icon"><Clock size={24} /></div>
            <div className="schedule-content">
              <div className="schedule-label">Available</div>
              <div className="schedule-value">{deal.schedule}</div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="deal-quick-actions">
          <button
            className={`quick-action-btn ${isItemSavedLocal('deal', deal.id) ? 'saved' : ''}`}
            onClick={() => toggleSave(deal.id, 'deal', deal.title, { business: deal.venueName })}
          >
            <div className={`quick-action-icon save ${isItemSavedLocal('deal', deal.id) ? 'saved' : ''}`}>
              <Star size={20} fill={isItemSavedLocal('deal', deal.id) ? 'currentColor' : 'none'} />
            </div>
            <span>{isItemSavedLocal('deal', deal.id) ? 'Saved' : 'Save'}</span>
          </button>
          <button className="quick-action-btn" onClick={handleShare}>
            <div className="quick-action-icon share"><Share2 size={20} /></div>
            <span>Share</span>
          </button>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getVenueName(deal.venueId, deal) + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="quick-action-btn"
          >
            <div className="quick-action-icon directions"><Navigation size={20} /></div>
            <span>Directions</span>
          </a>
        </div>

        {/* About Section */}
        <div className="deal-section">
          <h2 className="deal-section-title">About This Deal</h2>
          <p className="deal-about-text">
            {generateEnhancedDealDescription(deal, getVenueName(deal.venueId, deal))}
          </p>
        </div>

        {/* Details Section */}
        <div className="deal-section">
          <h2 className="deal-section-title">Details</h2>
          <div className="deal-details-grid">
            <div className="deal-detail-card">
              <div className="deal-detail-icon venue-icon"><Building size={20} /></div>
              <div className="deal-detail-content">
                <span className="deal-detail-label">Location</span>
                <span className="deal-detail-value">{getVenueName(deal.venueId, deal)}</span>
              </div>
            </div>
            {deal.schedule && (
              <div className="deal-detail-card">
                <div className="deal-detail-icon time-icon"><Clock size={20} /></div>
                <div className="deal-detail-content">
                  <span className="deal-detail-label">Schedule</span>
                  <span className="deal-detail-value">{deal.schedule}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Terms Section */}
        {deal.terms && deal.terms !== 'N/A' && (
          <div className="deal-section">
            <h2 className="deal-section-title">Terms & Conditions</h2>
            <div className="deal-terms-card">
              <Info size={18} className="terms-icon" />
              <p className="deal-terms-text">{deal.terms}</p>
            </div>
          </div>
        )}

        {/* More from this Business */}
        {relatedDeals.length > 0 && (
          <div className="deal-section">
            <h2 className="deal-section-title">
              More from {getVenueName(deal.venueId, deal)}
            </h2>
            <div className="related-deals-grid">
              {relatedDeals.slice(0, 3).map(rd => (
                <div key={rd.id} className="related-deal-card" onClick={() => onSelectDeal(rd)}>
                  <div className="related-deal-content">
                    <h4 className="related-deal-title">
                      {generateSmartDealTitle(rd, getVenueName(rd.venueId, rd))}
                    </h4>
                    {rd.discount && <span className="related-deal-discount">{rd.discount}</span>}
                    {rd.schedule && (
                      <span className="related-deal-schedule">
                        <Clock size={12} />
                        {rd.schedule}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={18} className="related-deal-arrow" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="deal-cta-section">
          <button className="deal-cta-btn primary" onClick={handleRedeem} disabled={redeeming}>
            <Ticket size={18} />
            Redeem Deal
          </button>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getVenueName(deal.venueId, deal) + ' Squamish BC')}`}
            target="_blank" rel="noopener noreferrer" className="deal-cta-btn secondary"
          >
            <MapPin size={18} />
            View Location
          </a>
        </div>

        {/* Footer */}
        <div className="deal-modal-footer">
          <p>Deal terms subject to change. Please verify with business.</p>
        </div>
      </div>
    </div>
  );
});

export default DealDetailModal;
