import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Star, Check, ChevronRight, DollarSign } from 'lucide-react';
import SkeletonCards from './SkeletonCards';
import { generateSmartDealTitle, normalizeDealCategory, getDealSavingsDisplay } from '../utils/dealHelpers';

const DealsGrid = React.memo(function DealsGrid({
  deals,
  dealsLoading,
  dealCategoryFilter,
  setDealCategoryFilter,
  dealCardRefs,
  searchQuery,
  setSearchQuery,
  getVenueName,
  isItemSavedLocal,
  toggleSave,
  onSelectDeal,
  onPrefetch,
}) {
  const categoryOptions = useMemo(() => {
    const catCounts = {};
    deals.forEach(deal => {
      const normalized = normalizeDealCategory(deal.category);
      catCounts[normalized] = (catCounts[normalized] || 0) + 1;
    });
    return Object.entries(catCounts)
      .filter(([cat]) => cat !== 'Other' || catCounts['Other'] > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);
  }, [deals]);

  const CATEGORY_EMOJI = {
    'Food & Drink': '\uD83C\uDF54',
    'Retail': '\uD83D\uDECD\uFE0F',
    'Services': '\uD83D\uDD27',
    'Fitness': '\uD83D\uDCAA',
    'Entertainment': '\uD83C\uDFAF',
    'Wellness': '\uD83E\uDDD8',
    'Beauty': '\uD83D\uDC85',
    'Family': '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66',
    'Other': '\uD83C\uDF1F',
  };

  const filteredDeals = deals.filter(deal => {
    if (dealCategoryFilter === 'All') return true;
    return normalizeDealCategory(deal.category) === dealCategoryFilter;
  });

  const handlePrefetch = useCallback((dealId) => {
    if (onPrefetch) onPrefetch(dealId);
  }, [onPrefetch]);

  return (
    <>
      {/* Deals Filter */}
      <div className="filters-section" style={{marginTop: '20px'}}>
        <div className="filters-row-single">
          <div className="filter-group">
            <select
              value={dealCategoryFilter}
              onChange={(e) => setDealCategoryFilter(e.target.value)}
              className="filter-dropdown"
              aria-label="Filter deals by category"
            >
              <option value="All">{'\uD83D\uDCB0'} All Deals</option>
              {categoryOptions.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_EMOJI[cat] || '\uD83C\uDF1F'} {cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {dealsLoading && <SkeletonCards count={6} />}
      <div className="deals-grid">
        <AnimatePresence>
        {filteredDeals.map((deal, index) => (
          <motion.div
            key={deal.id}
            className="deal-card card-enter"
            layout
            role="button"
            tabIndex={0}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, delay: index < 10 ? index * 0.04 : 0 }}
            onClick={() => onSelectDeal(deal)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDeal(deal); } }}
            onMouseEnter={() => handlePrefetch(deal.id)}
            onTouchStart={() => handlePrefetch(deal.id)}
            whileTap={{ scale: 0.97 }}
            ref={(el) => dealCardRefs.current[index] = el}
          >
            {/* Prominent savings badge at top */}
            {getDealSavingsDisplay(deal) && (
              <div className={`deal-savings-badge savings-${getDealSavingsDisplay(deal).type}`}>
                {getDealSavingsDisplay(deal).text}
              </div>
            )}

            <div className="deal-card-header-new">
              <div className="deal-title-section">
                <h3 title={generateSmartDealTitle(deal, getVenueName(deal.venueId, deal))}>{generateSmartDealTitle(deal, getVenueName(deal.venueId, deal))}</h3>
                {deal.verified && (
                  <div
                    className="verified-badge-premium"
                    onClick={(e) => e.stopPropagation()}
                    data-tooltip="Verified"
                  >
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}
              </div>
            </div>

            <div className="deal-card-body-new">
              <div className="deal-detail-row">
                <div className="deal-detail-item">
                  <div className="detail-icon venue-icon">
                    <MapPin size={16} />
                  </div>
                  <span className="detail-text" title={getVenueName(deal.venueId, deal)}>{getVenueName(deal.venueId, deal)}</span>
                </div>
              </div>

              {deal.schedule && (
                <div className="deal-detail-row">
                  <div className="deal-detail-item full-width">
                    <div className="detail-icon clock-icon">
                      <Clock size={16} />
                    </div>
                    <span className="detail-text">{deal.schedule}</span>
                  </div>
                </div>
              )}

              {deal.description && deal.title && deal.description.toLowerCase() !== deal.title.toLowerCase() && (
                <p className="deal-description-new">{deal.description.length > 80 ? deal.description.substring(0, 77) + '...' : deal.description}</p>
              )}
            </div>

            <button
              className={`save-star-btn ${isItemSavedLocal('deal', deal.id) ? 'saved' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSave(deal.id, 'deal', deal.title, { venue: getVenueName(deal.venueId, deal) });
              }}
              data-tooltip={isItemSavedLocal('deal', deal.id) ? "Saved" : "Save"}
              aria-label={isItemSavedLocal('deal', deal.id) ? "Remove from saved" : "Save to favorites"}
            >
              <Star size={24} fill={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "none"} stroke={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
            </button>
            <ChevronRight className="deal-chevron" size={20} />
          </motion.div>
        ))}
        </AnimatePresence>
      </div>

      {/* Deals empty state */}
      {!dealsLoading && filteredDeals.length === 0 && (
        <div className="no-results-state" style={{textAlign: 'center', padding: '40px 20px', color: '#6b7280'}}>
          <DollarSign size={48} style={{color: '#d1d5db', marginBottom: '12px'}} />
          <h3 style={{color: '#374151', marginBottom: '8px'}}>No deals found</h3>
          <p>{searchQuery ? `No deals matching "${searchQuery}"` : 'No deals in this category'}</p>
          {(searchQuery || dealCategoryFilter !== 'All') && (
            <button onClick={() => { setSearchQuery(''); setDealCategoryFilter('All'); }} className="clear-search-btn" style={{marginTop: '12px', padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600}}>
              Clear Filters
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default DealsGrid;
