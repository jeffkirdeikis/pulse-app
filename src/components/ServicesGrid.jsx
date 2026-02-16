import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MapPin, Wrench, ChevronRight } from 'lucide-react';
import SkeletonCards from './SkeletonCards';
import { formatResponseTime } from '../lib/businessAnalytics';

const ServicesGrid = React.memo(function ServicesGrid({
  services,
  servicesLoading,
  debouncedSearch,
  searchQuery,
  setSearchQuery,
  serviceCategoryFilter,
  setServiceCategoryFilter,
  serviceCardRefs,
  onSelectService,
  onPrefetch,
}) {
  const mainCategories = [
    'Restaurants & Dining', 'Retail & Shopping', 'Cafes & Bakeries',
    'Outdoor Adventures', 'Auto Services', 'Real Estate',
    'Fitness & Gyms', 'Recreation & Sports', 'Health & Wellness',
    'Construction & Building', 'Outdoor Gear & Shops', 'Community Services',
    'Hotels & Lodging', 'Web & Marketing', 'Financial Services',
    'Medical Clinics', 'Photography', 'Attractions',
    'Churches & Religious', 'Salons & Spas', 'Arts & Culture'
  ];

  const getSocialProof = (svc, idx, tier1) => {
    const reviews = svc.reviews || 0;
    const rating = svc.rating || 0;

    if (svc.pulseData) {
      const pd = svc.pulseData;
      if (pd.jobs_completed >= 100) {
        return { type: 'volume', text: `📈 ${pd.jobs_completed}+ jobs completed on Pulse` };
      }
      if (pd.neighbor_hires >= 3) {
        return { type: 'neighbor', text: `👥 ${pd.neighbor_hires} neighbors hired them` };
      }
      if (pd.response_time_minutes && pd.response_time_minutes <= 60) {
        const timeText = formatResponseTime(pd.response_time_minutes);
        return { type: 'response', text: `⚡ Responds in ${timeText}` };
      }
      if (pd.testimonial) {
        const quote = pd.testimonial.quote.length > 40
          ? pd.testimonial.quote.substring(0, 40) + '...'
          : pd.testimonial.quote;
        return { type: 'testimonial', text: `💬 "${quote}" — ${pd.testimonial.author}` };
      }
      if (pd.satisfaction_rate >= 95) {
        return { type: 'satisfaction', text: `✅ ${pd.satisfaction_rate}% satisfaction rate` };
      }
      if (pd.years_active >= 5) {
        return { type: 'longevity', text: `📅 ${pd.years_active} years serving Squamish` };
      }
      if (pd.jobs_completed >= 10) {
        return { type: 'trusted', text: `✅ ${pd.jobs_completed} jobs completed on Pulse` };
      }
    }

    if (tier1 && idx < 3 && rating >= 4.5) {
      return { type: 'rank', text: `⭐ Top rated in ${(svc.category || '').split('&')[0].trim()}` };
    }
    if (rating >= 4.8 && reviews >= 50) {
      return { type: 'excellent', text: `⭐ ${rating} rating from ${reviews} Google reviews` };
    }
    if (rating >= 4.5 && reviews >= 100) {
      return { type: 'popular', text: `📍 ${reviews}+ reviews on Google` };
    }
    if (rating >= 4.5 && reviews >= 20) {
      return { type: 'highrated', text: `⭐ Highly rated (${rating}/5)` };
    }
    if (reviews >= 50) {
      return { type: 'reviewed', text: `📍 ${reviews} Google reviews` };
    }
    if (rating >= 4.0) {
      return { type: 'rated', text: `⭐ ${rating}/5 on Google` };
    }
    return { type: 'default', text: '📍 Local Squamish Business' };
  };

  const filteredServices = services
    .filter(service => {
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase().trim();
        const nameMatch = service.name?.toLowerCase().includes(query);
        const categoryMatch = service.category?.toLowerCase().includes(query);
        const addressMatch = service.address?.toLowerCase().includes(query);
        if (!nameMatch && !categoryMatch && !addressMatch) return false;
      }
      if (serviceCategoryFilter === 'All') return true;
      if (serviceCategoryFilter === 'Other') return !mainCategories.includes(service.category);
      return service.category === serviceCategoryFilter;
    })
    .sort((a, b) => {
      const aReviews = a.reviews || 0;
      const bReviews = b.reviews || 0;
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      const aIsTier1 = aReviews >= 50 && aRating >= 4;
      const bIsTier1 = bReviews >= 50 && bRating >= 4;
      if (aIsTier1 && !bIsTier1) return -1;
      if (!aIsTier1 && bIsTier1) return 1;
      if (bRating !== aRating) return bRating - aRating;
      return bReviews - aReviews;
    });

  const handlePrefetch = useCallback((serviceId) => {
    if (onPrefetch) onPrefetch(serviceId);
  }, [onPrefetch]);

  return (
    <>
      {/* Services Filter */}
      <div className="filters-section" style={{marginTop: '20px'}}>
        <div className="filters-row-single">
          <div className="filter-group">
            <select
              value={serviceCategoryFilter}
              onChange={(e) => setServiceCategoryFilter(e.target.value)}
              className="filter-dropdown"
              aria-label="Filter services by category"
            >
              <option value="All">🔧 All Services</option>
              <option value="Restaurants & Dining">🍽️ Restaurants & Dining</option>
              <option value="Retail & Shopping">🛍️ Retail & Shopping</option>
              <option value="Cafes & Bakeries">☕ Cafes & Bakeries</option>
              <option value="Outdoor Adventures">🏔️ Outdoor Adventures</option>
              <option value="Auto Services">🚗 Auto Services</option>
              <option value="Real Estate">🏘️ Real Estate</option>
              <option value="Fitness & Gyms">💪 Fitness & Gyms</option>
              <option value="Recreation & Sports">⚽ Recreation & Sports</option>
              <option value="Health & Wellness">🧘 Health & Wellness</option>
              <option value="Construction & Building">🏗️ Construction & Building</option>
              <option value="Outdoor Gear & Shops">🎒 Outdoor Gear & Shops</option>
              <option value="Community Services">🤝 Community Services</option>
              <option value="Hotels & Lodging">🏨 Hotels & Lodging</option>
              <option value="Web & Marketing">💻 Web & Marketing</option>
              <option value="Financial Services">💰 Financial Services</option>
              <option value="Medical Clinics">🏥 Medical Clinics</option>
              <option value="Photography">📸 Photography</option>
              <option value="Attractions">🎡 Attractions</option>
              <option value="Churches & Religious">⛪ Churches & Religious</option>
              <option value="Salons & Spas">💇 Salons & Spas</option>
              <option value="Arts & Culture">🎨 Arts & Culture</option>
              <option value="Other">📋 Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search Results Count */}
      {debouncedSearch && (
        <div className="search-results-count">
          <span className="results-text">
            {filteredServices.length === 0 ? 'No results' : `${filteredServices.length} result${filteredServices.length !== 1 ? 's' : ''} for "${searchQuery}"`}
          </span>
        </div>
      )}

      <div className="services-grid" key={debouncedSearch}>
        {servicesLoading ? (
          <SkeletonCards count={6} />
        ) : (
          <AnimatePresence>
          {filteredServices.map((service, index) => {
            const isTier1 = (service.reviews || 0) >= 50 && (service.rating || 0) >= 4;
            const socialProof = getSocialProof(service, index, isTier1);

            return (
              <motion.div
                key={service.id}
                className="service-card card-enter"
                layout
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30, delay: index < 10 ? index * 0.04 : 0 }}
                ref={(el) => serviceCardRefs.current[index] = el}
                onClick={() => onSelectService(service)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectService(service); } }}
                onMouseEnter={() => handlePrefetch(service.id)}
                onTouchStart={() => handlePrefetch(service.id)}
                whileTap={{ scale: 0.97 }}
              >
                <div className="service-card-header-new">
                  <div className="service-title-section">
                    <h3 title={service.name}>{service.name}</h3>
                  </div>
                  {service.rating && (
                    <div className="service-rating-badge">
                      <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                      <span>{service.rating}</span>
                      {service.reviews && <span className="review-count">({service.reviews})</span>}
                    </div>
                  )}
                </div>

                <div className="service-card-body-new">
                  <div className="service-detail-row">
                    <div className="service-detail-item">
                      <div className="detail-icon category-icon">
                        <Wrench size={16} />
                      </div>
                      <span className="detail-text service-category-text">{service.category}</span>
                    </div>
                  </div>

                  {service.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.name + ' ' + service.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="service-detail-row service-link-row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="service-detail-item">
                      <div className="detail-icon location-icon">
                        <MapPin size={16} />
                      </div>
                      <span className="detail-text detail-link">{service.address}</span>
                    </div>
                  </a>
                  )}
                </div>

                {/* Social Proof Banner with Arrow */}
                <div className={`service-social-proof ${socialProof.type}`}>
                  <span className="social-proof-text">{socialProof.text}</span>
                  <div className="social-proof-arrow">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        )}
      </div>
      {/* No results state for services */}
      {debouncedSearch && filteredServices.length === 0 && (
        <div className="no-results-state">
          <div className="no-results-icon">🔍</div>
          <h3>No businesses found for "{searchQuery}"</h3>
          <p>Try a different search term or browse all services</p>
          <button onClick={() => setSearchQuery('')} className="clear-search-btn">
            Clear Search
          </button>
        </div>
      )}
    </>
  );
});

export default ServicesGrid;
