import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Calendar, Star, DollarSign, Search, X, Heart, Wrench, MessageCircle, Bell, WifiOff, Clock, TrendingUp } from 'lucide-react';

const RECENT_SEARCHES_KEY = 'pulse-recent-searches';
const MAX_RECENT = 5;
const MAX_SUGGESTIONS = 6;

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch { return []; }
}

function saveRecentSearch(query) {
  if (!query?.trim()) return;
  const q = query.trim();
  const recent = getRecentSearches().filter(s => s !== q);
  recent.unshift(q);
  try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT))); } catch {}
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch {}
}

/**
 * Consumer view header with logo, auth/profile buttons, navigation tabs,
 * search bar with suggestions, and offline banner.
 */
const ConsumerHeader = React.memo(function ConsumerHeader({
  user,
  currentSection,
  setCurrentSection,
  searchQuery,
  setSearchQuery,
  isOffline,
  showProfileMenu,
  setShowProfileMenu,
  setServicesSubView,
  filters,
  setFilters,
  setShowAuthModal,
  openMessages,
  showToast,
  onOpenNotifications,
  unreadNotifCount,
  searchSuggestions = [],
  tabCounts = {},
}) {
  const row1Tabs = ['classes', 'events', 'deals'];
  const row2Tabs = ['services', 'wellness'];
  const tabRefs = useRef({});
  const [indicator1, setIndicator1] = useState({ x: 0, w: 0 });
  const [indicator2, setIndicator2] = useState({ x: 0, w: 0 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState(getRecentSearches);
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  const updateIndicator = useCallback(() => {
    const el = tabRefs.current[currentSection];
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const x = el.offsetLeft;
    const w = el.offsetWidth;
    if (row1Tabs.includes(currentSection)) {
      setIndicator1({ x, w });
      setIndicator2({ x: 0, w: 0 });
    } else {
      setIndicator2({ x, w });
      setIndicator1({ x: 0, w: 0 });
    }
  }, [currentSection]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filtered suggestions based on current query
  const matchedSuggestions = useMemo(() => {
    if (!searchQuery?.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return searchSuggestions
      .filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, MAX_SUGGESTIONS);
  }, [searchQuery, searchSuggestions]);

  const handleSelectSuggestion = useCallback((text) => {
    setSearchQuery(text);
    saveRecentSearch(text);
    setRecentSearches(getRecentSearches());
    setShowSuggestions(false);
  }, [setSearchQuery]);

  const handleSearchSubmit = useCallback((e) => {
    if (e.key === 'Enter' && searchQuery?.trim()) {
      saveRecentSearch(searchQuery.trim());
      setRecentSearches(getRecentSearches());
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  }, [searchQuery]);

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  const hasSuggestions = searchQuery?.trim() ? matchedSuggestions.length > 0 : recentSearches.length > 0;

  return (
    <>
      <header className="app-header-premium">
        <div className="header-container-premium">
          <div className="logo-area-premium">
            <div className="pulse-logo-premium">
              <svg className="pulse-icon-premium" viewBox="0 0 100 120" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: '#60a5fa'}} />
                    <stop offset="100%" style={{stopColor: '#3b82f6'}} />
                  </linearGradient>
                </defs>
                <path d="M50 8C33 8 19 22 19 39C19 52 28 63 50 95C72 63 81 52 81 39C81 22 67 8 50 8Z"
                      stroke="url(#pulseGradient)"
                      strokeWidth="7"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"/>
                <circle cx="50" cy="39" r="22"
                        stroke="url(#pulseGradient)"
                        strokeWidth="7"
                        fill="none"/>
                <path d="M33 39 L38 39 L42 33 L46 45 L50 28 L54 45 L58 33 L62 39 L67 39"
                      stroke="url(#pulseGradient)"
                      strokeWidth="4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"/>
              </svg>
              <div className="logo-text-container">
                <h1 className="logo-text-premium">PULSE</h1>
                <span className="city-tag">Squamish</span>
              </div>
            </div>
          </div>

          <div className="header-actions-premium">
            {user.isGuest ? (
              <button className="sign-in-btn" onClick={() => setShowAuthModal(true)}>
                Sign In
              </button>
            ) : (
              <>
                <button className="header-btn-icon messages-btn" onClick={openMessages} aria-label="Messages">
                  <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={22} strokeWidth={2} />
                  </div>
                </button>
                <button className="header-btn-icon notification-btn" onClick={onOpenNotifications} style={{ position: 'relative' }} aria-label="Notifications">
                  <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={22} strokeWidth={2} />
                  </div>
                  {unreadNotifCount > 0 && (
                    <span className="bell-badge">{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
                  )}
                </button>
                <div className="profile-btn" role="button" tabIndex={0} aria-label="Profile menu" onClick={() => setShowProfileMenu(!showProfileMenu)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowProfileMenu(!showProfileMenu); } }}>
                  <div className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="" onError={(e) => { e.target.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name?.trim() ? user.name.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U' : 'U')}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {isOffline && (
        <div role="alert" style={{background: '#fef2f2', color: '#991b1b', padding: '8px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 500, borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
          <WifiOff size={14} />
          You're offline. Some features may be unavailable.
        </div>
      )}

      {/* Top Banner Navigation */}
      <nav className="top-banner-premium" aria-label="Main navigation">
        <div className="banner-content-premium">
          <div className="banner-tabs" role="tablist" aria-label="Content sections">
            <button
              ref={el => tabRefs.current.classes = el}
              role="tab"
              aria-selected={currentSection === 'classes'}
              className={`banner-tab ${currentSection === 'classes' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('classes'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'classes' }, '', '#classes'); }}
            >
              <Calendar size={18} />
              <span>Classes</span>
              {tabCounts.classes > 0 && <span className="tab-count">{tabCounts.classes}</span>}
            </button>
            <button
              ref={el => tabRefs.current.events = el}
              role="tab"
              aria-selected={currentSection === 'events'}
              className={`banner-tab ${currentSection === 'events' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('events'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'events' }, '', '#events'); }}
            >
              <Star size={18} />
              <span>Events</span>
              {tabCounts.events > 0 && <span className="tab-count">{tabCounts.events}</span>}
            </button>
            <button
              ref={el => tabRefs.current.deals = el}
              role="tab"
              aria-selected={currentSection === 'deals'}
              className={`banner-tab ${currentSection === 'deals' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('deals'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'deals' }, '', '#deals'); }}
            >
              <DollarSign size={18} />
              <span>Deals</span>
              {tabCounts.deals > 0 && <span className="tab-count">{tabCounts.deals}</span>}
            </button>
            {indicator1.w > 0 && (
              <div className="tab-indicator" style={{ transform: `translateX(${indicator1.x}px)`, width: `${indicator1.w}px` }} />
            )}
          </div>
          <div className="banner-tabs banner-tabs-row2" role="tablist" aria-label="More sections">
            <button
              ref={el => tabRefs.current.services = el}
              role="tab"
              aria-selected={currentSection === 'services'}
              className={`banner-tab ${currentSection === 'services' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('services'); window.history.pushState({ section: 'services' }, '', '#services'); }}
            >
              <Wrench size={18} />
              <span>Services</span>
            </button>
            <button
              ref={el => tabRefs.current.wellness = el}
              role="tab"
              aria-selected={currentSection === 'wellness'}
              className={`banner-tab ${currentSection === 'wellness' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('wellness'); window.history.pushState({ section: 'wellness' }, '', '#wellness'); }}
            >
              <Heart size={18} />
              <span>Wellness</span>
            </button>
            {indicator2.w > 0 && (
              <div className="tab-indicator" style={{ transform: `translateX(${indicator2.x}px)`, width: `${indicator2.w}px` }} />
            )}
          </div>
        </div>
      </nav>

      {/* Search Bar with Suggestions (hidden for wellness which has its own UI) */}
      <div className="search-section-premium" style={currentSection === 'wellness' ? { display: 'none' } : undefined} ref={searchContainerRef}>
        <div className="search-bar-premium">
          <Search size={20} className="search-icon-premium" />
          <input
            ref={inputRef}
            type="text"
            placeholder={`Search ${currentSection}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSearchSubmit}
            aria-label={`Search ${currentSection}`}
            autoComplete="off"
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && hasSuggestions && (
          <div className="search-suggestions">
            {searchQuery?.trim() ? (
              /* Query-based autocomplete */
              matchedSuggestions.map((s, i) => (
                <button
                  key={i}
                  className="search-suggestion-item"
                  onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                >
                  <Search size={14} className="suggestion-icon" />
                  <span className="suggestion-text">{s}</span>
                </button>
              ))
            ) : (
              /* Recent searches */
              <>
                <div className="suggestions-header">
                  <span>Recent</span>
                  <button className="clear-recent-btn" onMouseDown={(e) => { e.preventDefault(); handleClearRecent(); }}>Clear</button>
                </div>
                {recentSearches.map((s, i) => (
                  <button
                    key={i}
                    className="search-suggestion-item"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                  >
                    <Clock size={14} className="suggestion-icon" />
                    <span className="suggestion-text">{s}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
});

export default ConsumerHeader;
