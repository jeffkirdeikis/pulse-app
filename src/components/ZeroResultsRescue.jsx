import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SECTION_META } from '../utils/sectionMeta';

/**
 * Shows results from other sections when the current section's search returns 0 results.
 * Renders below the existing empty state.
 */
const ZeroResultsRescue = React.memo(function ZeroResultsRescue({
  globalResults,
  currentSection,
  searchQuery,
  onNavigateWithSearch,
  onSelectEvent,
  onSelectDeal,
  onSelectService,
  getVenueName,
}) {
  if (!globalResults || !searchQuery?.trim()) return null;

  // Build list of other sections that have results
  const otherSections = Object.entries(globalResults)
    .filter(([section, results]) => section !== currentSection && results.length > 0)
    .map(([section, results]) => ({ section, results: results.slice(0, 2), total: results.length }));

  if (otherSections.length === 0) return null;

  const handleItemClick = (section, item) => {
    if (section === 'classes' || section === 'events') onSelectEvent?.(item);
    else if (section === 'deals') onSelectDeal?.(item);
    else if (section === 'services') onSelectService?.(item);
  };

  const getSubtitle = (section, item) => {
    if (section === 'classes' || section === 'events') {
      const venue = getVenueName?.(item.venueId, item) || '';
      const date = item.start instanceof Date ? item.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return [venue, date].filter(Boolean).join(' · ');
    }
    if (section === 'deals') return item.venueName || getVenueName?.(item.venueId, item) || '';
    if (section === 'services') return item.category || '';
    return '';
  };

  const getTitle = (section, item) => {
    if (section === 'services') return item.name || '';
    return item.title || '';
  };

  return (
    <div className="zero-results-rescue">
      <p className="rescue-heading">Found in other sections</p>
      {otherSections.map(({ section, results, total }) => {
        const meta = SECTION_META[section];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <div key={section} className="rescue-section">
            <div className="rescue-section-header">
              <Icon size={16} />
              <span className="rescue-section-label">{meta.label}</span>
              <span className="rescue-section-count">{total} result{total !== 1 ? 's' : ''}</span>
            </div>
            <div className="rescue-items">
              {results.map((item, i) => (
                <button
                  key={item.id || i}
                  className="rescue-item"
                  onClick={() => handleItemClick(section, item)}
                >
                  <span className="rescue-item-title">{getTitle(section, item)}</span>
                  <span className="rescue-item-subtitle">{getSubtitle(section, item)}</span>
                </button>
              ))}
            </div>
            <button
              className="rescue-see-all"
              onClick={() => onNavigateWithSearch(section, searchQuery)}
            >
              See all in {meta.label} <ArrowRight size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default ZeroResultsRescue;
