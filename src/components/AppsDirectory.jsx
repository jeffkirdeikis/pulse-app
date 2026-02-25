import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Plus, Sparkles } from 'lucide-react';
import { APPS, APP_CATEGORIES, getFeaturedApps } from '../data/appsData';
import AppCard from './AppCard';

const SubmitAppModal = lazy(() => import('./modals/SubmitAppModal'));

const AppsDirectory = React.memo(function AppsDirectory({ showToast }) {
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const featuredApps = useMemo(() => getFeaturedApps(), []);

  const filteredApps = useMemo(() => {
    let result = APPS;
    if (categoryFilter !== 'All') {
      result = result.filter(app => app.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(app =>
        app.name.toLowerCase().includes(q) ||
        app.tagline.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [categoryFilter, searchQuery]);

  const handleClearFilters = useCallback(() => {
    setCategoryFilter('All');
    setSearchQuery('');
  }, []);

  return (
    <>
      {/* Hero Section */}
      <div className="apps-hero">
        <div className="apps-hero-content">
          <div className="apps-hero-icon">
            <Sparkles size={28} />
          </div>
          <h2 className="apps-hero-title">AI Apps Directory</h2>
          <p className="apps-hero-subtitle">Discover the best AI-powered tools and apps</p>
        </div>
      </div>

      {/* Featured Banner */}
      {categoryFilter === 'All' && !searchQuery.trim() && featuredApps.length > 0 && (
        <div className="apps-featured-banner">
          <h3 className="apps-featured-title">Featured Apps</h3>
          <div className="apps-featured-strip">
            {featuredApps.map(app => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="apps-featured-chip"
              >
                <span className="apps-featured-chip-icon">{app.name.charAt(0)}</span>
                {app.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="apps-toolbar">
        <div className="apps-search-bar">
          <Search size={18} className="apps-search-icon" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search apps"
          />
          {searchQuery && (
            <button type="button" className="apps-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="apps-category-strip">
          {APP_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`apps-category-chip ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count + Submit Button */}
      <div className="apps-results-bar">
        <span className="apps-results-count">
          {filteredApps.length} app{filteredApps.length !== 1 ? 's' : ''}
        </span>
        <button type="button" className="apps-submit-btn" onClick={() => setShowSubmitModal(true)}>
          <Plus size={16} /> Submit App
        </button>
      </div>

      {/* Apps Grid */}
      <div className="apps-grid">
        <AnimatePresence>
          {filteredApps.map((app, index) => (
            <AppCard key={app.id} app={app} index={index} />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredApps.length === 0 && (
        <div className="apps-empty-state">
          <Search size={48} style={{ color: '#d1d5db', marginBottom: '12px' }} />
          <h3>No apps found</h3>
          <p>{searchQuery ? `No apps matching "${searchQuery}"` : 'No apps in this category'}</p>
          <button type="button" className="apps-clear-btn" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      )}

      {/* Submit App Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <Suspense fallback={null}>
            <SubmitAppModal
              onClose={() => setShowSubmitModal(false)}
              showToast={showToast}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
});

export default AppsDirectory;
