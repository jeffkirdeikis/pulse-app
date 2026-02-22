import React from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { SECTION_META } from '../utils/sectionMeta';

function HighlightMatch({ text, query }) {
  if (!text || !query) return text || null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="gsd-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/**
 * Dropdown overlay showing grouped search results from all sections.
 * Renders inside the search bar container, replacing autocomplete when globalResults exist.
 */
const GlobalSearchDropdown = React.memo(function GlobalSearchDropdown({
  globalResults,
  searchQuery,
  currentSection,
  onNavigateWithSearch,
  onSelectEvent,
  onSelectDeal,
  onSelectService,
  getVenueName,
}) {
  if (!globalResults || !searchQuery?.trim()) return null;

  const sections = Object.entries(globalResults)
    .filter(([, results]) => results.length > 0)
    .map(([section, results]) => ({ section, results: results.slice(0, 3), total: results.length }));

  if (sections.length === 0) return null;

  const handleItemClick = (section, item) => {
    if (section === 'classes' || section === 'events') onSelectEvent?.(item);
    else if (section === 'deals') onSelectDeal?.(item);
    else if (section === 'services') onSelectService?.(item);
  };

  const getSubtitle = (section, item) => {
    if (section === 'classes' || section === 'events') {
      const venue = getVenueName?.(item.venueId, item) || '';
      const date = item.start instanceof Date ? item.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
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
    <div className="global-search-dropdown">
      {sections.map(({ section, results, total }) => {
        const meta = SECTION_META[section];
        if (!meta) return null;
        const Icon = meta.icon;
        const isCurrent = section === currentSection;
        return (
          <div key={section} className="gsd-section">
            <div className="gsd-section-header">
              <Icon size={14} className="gsd-section-icon" />
              <span className="gsd-section-label">{meta.label}</span>
              {isCurrent && <span className="gsd-current-badge">current</span>}
              <button
                className="gsd-see-all"
                onMouseDown={(e) => { e.preventDefault(); onNavigateWithSearch(section, searchQuery); }}
              >
                See all ({total}) <ArrowRight size={12} />
              </button>
            </div>
            {results.map((item, i) => (
              <button
                key={item.id || i}
                className="gsd-result-item"
                onMouseDown={(e) => { e.preventDefault(); handleItemClick(section, item); }}
              >
                <Search size={14} className="gsd-result-icon" />
                <div className="gsd-result-text">
                  <span className="gsd-result-title">
                    <HighlightMatch text={getTitle(section, item)} query={searchQuery} />
                  </span>
                  <span className="gsd-result-subtitle">{getSubtitle(section, item)}</span>
                </div>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
});

export default GlobalSearchDropdown;
