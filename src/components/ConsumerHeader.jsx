import React from 'react';
import { Calendar, Star, DollarSign, Search, X, Heart, Wrench, MessageCircle, Bell, WifiOff } from 'lucide-react';

/**
 * Consumer view header with logo, auth/profile buttons, navigation tabs,
 * search bar, and offline banner.
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
}) {
  return (
    <>
      <header className="app-header-premium">
        <div className="header-container-premium">
          <div className="logo-area-premium">
            <div className="pulse-logo-premium">
              <svg className="pulse-icon-premium" viewBox="0 0 100 120" fill="none">
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
                <span className="logo-text-premium">PULSE</span>
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
                <button className="header-btn-icon messages-btn" onClick={openMessages}>
                  <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={22} strokeWidth={2} />
                  </div>
                </button>
                <button className="header-btn-icon notification-btn" onClick={() => showToast('No new notifications', 'info')}>
                  <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={22} strokeWidth={2} />
                  </div>
                  <span className="notification-dot"></span>
                </button>
                <div className="profile-btn" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                  <div className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="" onError={(e) => { console.error('Avatar failed to load:', user.avatar); e.target.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U')}</div>
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
              role="tab"
              aria-selected={currentSection === 'classes'}
              className={`banner-tab ${currentSection === 'classes' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('classes'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'classes' }, '', '#classes'); }}
            >
              <Calendar size={18} />
              <span>Classes</span>
            </button>
            <button
              role="tab"
              aria-selected={currentSection === 'events'}
              className={`banner-tab ${currentSection === 'events' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('events'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'events' }, '', '#events'); }}
            >
              <Star size={18} />
              <span>Events</span>
            </button>
            <button
              role="tab"
              aria-selected={currentSection === 'deals'}
              className={`banner-tab ${currentSection === 'deals' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('deals'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'deals' }, '', '#deals'); }}
            >
              <DollarSign size={18} />
              <span>Deals</span>
            </button>
          </div>
          <div className="banner-tabs banner-tabs-row2" role="tablist" aria-label="More sections">
            <button
              role="tab"
              aria-selected={currentSection === 'services'}
              className={`banner-tab ${currentSection === 'services' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('services'); window.history.pushState({ section: 'services' }, '', '#services'); }}
            >
              <Wrench size={18} />
              <span>Services</span>
            </button>
            <button
              role="tab"
              aria-selected={currentSection === 'wellness'}
              className={`banner-tab ${currentSection === 'wellness' ? 'active' : ''}`}
              onClick={() => { setCurrentSection('wellness'); window.history.pushState({ section: 'wellness' }, '', '#wellness'); }}
            >
              <Heart size={18} />
              <span>Wellness</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Search Bar (hidden for wellness which has its own UI) */}
      <div className="search-section-premium" style={currentSection === 'wellness' ? { display: 'none' } : undefined}>
        <div className="search-bar-premium">
          <Search size={20} className="search-icon-premium" />
          <input
            type="text"
            placeholder={`Search ${currentSection}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={`Search ${currentSection}`}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );
});

export default ConsumerHeader;
