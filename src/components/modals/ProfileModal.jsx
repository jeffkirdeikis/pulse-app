import React, { memo } from 'react';
import {
  Building, Calendar, Camera, Check, CheckCircle, Clock, Edit2,
  ExternalLink, Eye, Heart, Info, MapPin, Percent, Plus, Send,
  SlidersHorizontal, Sparkles, Star, Ticket, Trash2, TrendingUp,
  Users, X, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useFocusTrap } from '../../hooks/useFocusTrap';

const ProfileModal = memo(function ProfileModal({
  user,
  session,
  userStats,
  userAchievements,
  userActivity,
  savedItems,
  localSavedItems,
  userClaimedBusinesses,
  activeBusiness,
  profileTab,
  setProfileTab,
  activityFilter,
  setActivityFilter,
  savedItemsFilter,
  setSavedItemsFilter,
  onClose,
  setView,
  setShowClaimBusinessModal,
  setShowSubmissionModal,
  setSubmissionStep,
  setSubmissionType,
  setEditingVenue,
  setEditVenueForm,
  setShowEditVenueModal,
  setUser,
  setLocalSavedItems,
  setCalendarToastMessage,
  setShowCalendarToast,
  handleImageSelect,
  getVenueName,
  getBusinessForEvent,
  trackAnalytics,
  addToCalendar,
  updateProfile,
  showToast,
  toggleSaveItem,
}) {
  const focusTrapRef = useFocusTrap();
  return (
    <div className="modal-overlay profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Profile" onClick={() => onClose()}>
      <div className="profile-modal" ref={focusTrapRef} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="close-btn profile-close" onClick={() => onClose()} aria-label="Close"><X size={24} /></button>

        {/* Hidden file inputs for profile images */}
        <input 
          type="file" 
          id="profile-cover-input" 
          accept="image/*" 
          style={{ display: 'none' }} 
          onChange={(e) => handleImageSelect(e, 'profileCover')}
        />
        <input 
          type="file" 
          id="profile-avatar-input" 
          accept="image/*" 
          style={{ display: 'none' }} 
          onChange={(e) => handleImageSelect(e, 'profileAvatar')}
        />

        {/* Profile Hero Section */}
        <div className="profile-hero">
          <div className={`profile-cover ${!user.coverPhoto ? 'no-photo' : ''}`} style={{ backgroundImage: user.coverPhoto ? `url(${user.coverPhoto})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' }}>
            <button type="button" className="cover-edit-btn" onClick={() => document.getElementById('profile-cover-input').click()}>
              <Camera size={16} />
              <span>{user.coverPhoto ? 'Change Cover' : 'Add Cover Photo'}</span>
            </button>
          </div>
          <div className="profile-hero-body">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-large">
                {user.avatar ? <img src={user.avatar} alt={user.name ? `${user.name}'s avatar` : 'Profile photo'} loading="lazy" width="80" height="80" /> : (user.name?.trim() ? user.name.trim().split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U' : 'U')}
                <button type="button" className="avatar-edit-btn" aria-label="Change profile photo" onClick={() => document.getElementById('profile-avatar-input').click()}>
                  <Camera size={14} />
                </button>
              </div>
            </div>
            <div className="profile-hero-details">
              <div className="profile-hero-info">
                <h1>{user.name || 'Guest User'}</h1>
                <p className="profile-location"><MapPin size={14} /> {user.location}</p>
                <p className="profile-member-since">Member since {user.memberSince ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Today'}</p>
              </div>
              <div className="profile-hero-stats">
                <div className="hero-stat">
                  <span className="stat-number">{userStats.eventsAttended}</span>
                  <span className="stat-label">Events</span>
                </div>
                <div className="hero-stat">
                  <span className="stat-number">{userStats.businessesSupported}</span>
                  <span className="stat-label">Businesses</span>
                </div>
                <div className="hero-stat">
                  <span className="stat-number">{userAchievements.filter(a => a.earned).length}</span>
                  <span className="stat-label">Badges</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="profile-tabs" role="tablist">
          <button role="tab" aria-selected={profileTab === 'overview'} className={`profile-tab ${profileTab === 'overview' ? 'active' : ''}`} onClick={() => setProfileTab('overview')}>
            <Users size={16} aria-hidden="true" />
            <span>Overview</span>
          </button>
          <button role="tab" aria-selected={profileTab === 'activity'} className={`profile-tab ${profileTab === 'activity' ? 'active' : ''}`} onClick={() => setProfileTab('activity')}>
            <Clock size={16} aria-hidden="true" />
            <span>Activity</span>
          </button>
          <button role="tab" aria-selected={profileTab === 'saved'} className={`profile-tab ${profileTab === 'saved' ? 'active' : ''}`} onClick={() => setProfileTab('saved')}>
            <Heart size={16} aria-hidden="true" />
            <span>Saved</span>
          </button>
          <button role="tab" aria-selected={profileTab === 'businesses'} className={`profile-tab ${profileTab === 'businesses' ? 'active' : ''}`} onClick={() => { onClose(); setView('business'); }}>
            <Building size={16} aria-hidden="true" />
            <span>My Businesses</span>
          </button>
          <button role="tab" aria-selected={profileTab === 'settings'} className={`profile-tab ${profileTab === 'settings' ? 'active' : ''}`} onClick={() => setProfileTab('settings')}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="profile-tab-content">

          {/* Overview Tab */}
          {profileTab === 'overview' && (
            <div className="profile-overview">

              {/* Level & XP Card */}
              <div className="level-card">
                <div className="level-card-header">
                  <div className="level-badge">
                    <span className="level-number">{userStats.level}</span>
                    <span className="level-label">LEVEL</span>
                  </div>
                  <div className="level-info">
                    <h3>Local Legend</h3>
                    <p>{userStats.xpToNextLevel} XP to Level {userStats.level + 1}</p>
                  </div>
                  <div className="total-xp">
                    <Sparkles size={16} />
                    <span>{userStats.totalXP.toLocaleString()} XP</span>
                  </div>
                </div>
                <div className="xp-progress-bar">
                  <div className="xp-progress-fill" style={{ width: `${userStats.xpForCurrentLevel > 0 ? ((userStats.xpForCurrentLevel - userStats.xpToNextLevel) / userStats.xpForCurrentLevel) * 100 : 0}%` }}></div>
                </div>
                <div className="level-card-footer">
                  <div className="streak-box">
                    <Zap size={18} className="streak-icon" />
                    <div className="streak-info">
                      <span className="streak-number">{userStats.currentStreak}</span>
                      <span className="streak-label">Day Streak</span>
                    </div>
                  </div>
                  <div className="rank-box">
                    <TrendingUp size={18} className="rank-icon" />
                    <div className="rank-info">
                      <span className="rank-number">#{userStats.communityRank}</span>
                      <span className="rank-label">of {userStats.totalMembers.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="hero-score-box">
                    <Heart size={18} className="hero-icon" />
                    <div className="hero-info">
                      <span className="hero-number">{userStats.localHeroScore}</span>
                      <span className="hero-label">Hero Score</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio Section */}
              <div className="profile-section">
                <h3>About</h3>
                <p className="profile-bio">{user.bio}</p>
                <div className="profile-interests">
                  {(user.interests || []).map((interest, idx) => (
                    <span key={idx} className="interest-tag">{interest}</span>
                  ))}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="profile-section">
                <h3>Community Impact</h3>
                <div className="stats-grid">
                  <div className="stat-card purple">
                    <div className="stat-card-icon"><Calendar size={20} /></div>
                    <div className="stat-card-content">
                      <span className="stat-card-number">{userStats.eventsAttended}</span>
                      <span className="stat-card-label">Events Attended</span>
                    </div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-card-icon"><Sparkles size={20} /></div>
                    <div className="stat-card-content">
                      <span className="stat-card-number">{userStats.classesCompleted}</span>
                      <span className="stat-card-label">Classes Completed</span>
                    </div>
                  </div>
                  <div className="stat-card orange">
                    <div className="stat-card-icon"><Percent size={20} /></div>
                    <div className="stat-card-content">
                      <span className="stat-card-number">{userStats.dealsRedeemed}</span>
                      <span className="stat-card-label">Deals Redeemed</span>
                    </div>
                  </div>
                  <div className="stat-card blue">
                    <div className="stat-card-icon"><Building size={20} /></div>
                    <div className="stat-card-content">
                      <span className="stat-card-number">{userStats.businessesSupported}</span>
                      <span className="stat-card-label">Businesses Supported</span>
                    </div>
                  </div>
                  <div className="stat-card pink">
                    <div className="stat-card-icon"><Star size={20} /></div>
                    <div className="stat-card-content">
                      <span className="stat-card-number">{userStats.reviewsWritten}</span>
                      <span className="stat-card-label">Reviews Written</span>
                    </div>
                  </div>
                  <div className="stat-card teal">
                    <div className="stat-card-icon"><MapPin size={20} /></div>
                    <div className="stat-card-content">
                      <span className="stat-card-number">{userStats.checkIns}</span>
                      <span className="stat-card-label">Check-ins</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements Section */}
              <div className="profile-section">
                <div className="section-header">
                  <h3>Achievements</h3>
                  <span className="badge-count">{userAchievements.filter(a => a.earned).length} / {userAchievements.length}</span>
                </div>
                <div className="achievements-grid">
                  {userAchievements.map(achievement => (
                    <div key={achievement.id} className={`achievement-card ${achievement.earned ? 'earned' : 'locked'}`}>
                      <div className="achievement-icon" style={{ background: achievement.earned ? achievement.color : '#e5e7eb' }}>
                        {achievement.icon === 'Sparkles' && <Sparkles size={20} />}
                        {achievement.icon === 'MapPin' && <MapPin size={20} />}
                        {achievement.icon === 'Heart' && <Heart size={20} />}
                        {achievement.icon === 'Percent' && <Percent size={20} />}
                        {achievement.icon === 'Star' && <Star size={20} />}
                        {achievement.icon === 'Building' && <Building size={20} />}
                        {achievement.icon === 'Calendar' && <Calendar size={20} />}
                        {achievement.icon === 'Users' && <Users size={20} />}
                        {achievement.icon === 'Zap' && <Zap size={20} />}
                        {achievement.icon === 'TrendingUp' && <TrendingUp size={20} />}
                      </div>
                      <div className="achievement-info">
                        <span className="achievement-name">{achievement.name}</span>
                        <span className="achievement-desc">{achievement.description}</span>
                        {!achievement.earned && (
                          <div className="achievement-progress">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${achievement.target ? Math.min(((achievement.progress || 0) / achievement.target) * 100, 100) : 0}%`, background: achievement.color }}></div>
                            </div>
                            <span className="progress-text">{achievement.progress || 0} / {achievement.target || '?'}</span>
                          </div>
                        )}
                        {achievement.earned && (
                          <span className="achievement-xp">+{achievement.xp} XP</span>
                        )}
                      </div>
                      {achievement.earned && <div className="achievement-check"><Check size={14} /></div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity Preview */}
              <div className="profile-section">
                <div className="section-header">
                  <h3>Recent Activity</h3>
                  <button type="button" className="see-all-btn" onClick={() => setProfileTab('activity')}>See All</button>
                </div>
                <div className="activity-preview">
                  {userActivity.slice(0, 3).map(activity => (
                    <div key={activity.id} className="activity-item">
                      <div className={`activity-icon ${activity.type}`}>
                        {activity.type === 'event' && <Calendar size={14} />}
                        {activity.type === 'deal' && <Percent size={14} />}
                        {activity.type === 'class' && <Sparkles size={14} />}
                        {activity.type === 'review' && <Star size={14} />}
                        {activity.type === 'checkin' && <MapPin size={14} />}
                      </div>
                      <div className="activity-content">
                        <span className="activity-action">{activity.action} <strong>{activity.title}</strong></span>
                        <span className="activity-business">{activity.business}</span>
                      </div>
                      <span className="activity-date">{activity.date && !isNaN(new Date(activity.date).getTime()) ? new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {profileTab === 'activity' && (
            <div className="profile-activity">
              <div className="activity-filters">
                {['all', 'event', 'class', 'deal', 'review'].map(f => (
                  <button key={f} className={`activity-filter ${activityFilter === f ? 'active' : ''}`} onClick={() => setActivityFilter(f)}>
                    {f === 'all' ? 'All' : f === 'event' ? 'Events' : f === 'class' ? 'Classes' : f === 'deal' ? 'Deals' : 'Reviews'}
                  </button>
                ))}
              </div>
              <div className="activity-list">
                {userActivity.filter(a => activityFilter === 'all' || a.type === activityFilter).map(activity => (
                  <div key={activity.id} className="activity-item-full">
                    <div className={`activity-icon-large ${activity.type}`}>
                      {activity.type === 'event' && <Calendar size={18} />}
                      {activity.type === 'deal' && <Percent size={18} />}
                      {activity.type === 'class' && <Sparkles size={18} />}
                      {activity.type === 'review' && <Star size={18} />}
                      {activity.type === 'checkin' && <MapPin size={18} />}
                    </div>
                    <div className="activity-content-full">
                      <span className="activity-type-badge">{activity.type}</span>
                      <h4>{activity.action} {activity.title}</h4>
                      <p><Building size={12} /> {activity.business}</p>
                    </div>
                    <div className="activity-meta">
                      <span className="activity-date-full">{activity.date && !isNaN(new Date(activity.date).getTime()) ? new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved Tab */}
          {profileTab === 'saved' && (
            <div className="profile-saved">
              <div className="saved-tabs" role="tablist">
                <button role="tab" aria-selected={!savedItemsFilter || savedItemsFilter === 'event'} className={`saved-tab ${!savedItemsFilter || savedItemsFilter === 'event' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('event')}>
                  <Calendar size={14} aria-hidden="true" />
                  Events
                  <span className="saved-count">{savedItems.filter(s => s.type === 'event').length + localSavedItems.filter(s => s.type === 'event').length}</span>
                </button>
                <button role="tab" aria-selected={savedItemsFilter === 'class'} className={`saved-tab ${savedItemsFilter === 'class' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('class')}>
                  <Sparkles size={14} aria-hidden="true" />
                  Classes
                  <span className="saved-count">{savedItems.filter(s => s.type === 'class').length + localSavedItems.filter(s => s.type === 'class').length}</span>
                </button>
                <button role="tab" aria-selected={savedItemsFilter === 'deal'} className={`saved-tab ${savedItemsFilter === 'deal' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('deal')}>
                  <Percent size={14} aria-hidden="true" />
                  Deals
                  <span className="saved-count">{savedItems.filter(s => s.type === 'deal').length + localSavedItems.filter(s => s.type === 'deal').length}</span>
                </button>
                <button role="tab" aria-selected={savedItemsFilter === 'business'} className={`saved-tab ${savedItemsFilter === 'business' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('business')}>
                  <Building size={14} aria-hidden="true" />
                  Businesses
                  <span className="saved-count">{savedItems.filter(s => s.type === 'business').length + localSavedItems.filter(s => s.type === 'business').length}</span>
                </button>
              </div>
              <div className="saved-items-grid">
                {[...savedItems, ...localSavedItems]
                  .filter(item => !savedItemsFilter || savedItemsFilter === 'event' ? item.type === 'event' : item.type === savedItemsFilter)
                  .map((item, idx) => (
                  <div key={item.itemId || idx} className="saved-item-card">
                    <div className="saved-item-image" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                      <span className="saved-item-date">{item.type}</span>
                    </div>
                    <div className="saved-item-content">
                      <h4>{item.name || item.itemName || 'Saved Item'}</h4>
                      <p><MapPin size={12} /> {item.data?.venue || item.venue || 'Squamish'}</p>
                    </div>
                    <button
                      type="button"
                      className="saved-item-remove"
                      onClick={async () => {
                        if (session?.user) {
                          try {
                            const result = await toggleSaveItem(item.type, item.itemId, item.name);
                            if (result?.error) showToast?.('Failed to remove item', 'error');
                          } catch {
                            showToast?.('Failed to remove item', 'error');
                          }
                        } else {
                          setLocalSavedItems(prev => prev.filter(s => s.itemId !== item.itemId));
                        }
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {[...savedItems, ...localSavedItems].filter(item => !savedItemsFilter || savedItemsFilter === 'event' ? item.type === 'event' : item.type === savedItemsFilter).length === 0 && (
                  <div className="no-saved-items" style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                    <Star size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h4>No saved items yet</h4>
                    <p>Tap the star icon on any event, class, or deal to save it here!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* My Businesses Tab */}
          {profileTab === 'businesses' && (
            <div className="profile-businesses">
              {userClaimedBusinesses.length === 0 ? (
                <div className="no-businesses">
                  <div className="no-businesses-icon">
                    <Building size={48} />
                  </div>
                  <h3>No businesses claimed yet</h3>
                  <p>Claim your business to unlock powerful analytics, engage with customers, and grow your revenue.</p>

                  {/* Benefits Preview */}
                  <div className="biz-benefits-preview">
                    <div className="benefit-item">
                      <TrendingUp size={20} />
                      <span>Track views & engagement</span>
                    </div>
                    <div className="benefit-item">
                      <Users size={20} />
                      <span>Connect with customers</span>
                    </div>
                    <div className="benefit-item">
                      <Calendar size={20} />
                      <span>Post events & deals</span>
                    </div>
                    <div className="benefit-item">
                      <Star size={20} />
                      <span>Manage reviews</span>
                    </div>
                  </div>

                  <button type="button" className="claim-business-btn" onClick={() => { setShowClaimBusinessModal(true); onClose(); }}>
                    <Plus size={18} />
                    Claim Your Business
                  </button>
                  <p className="claim-subtext">Free to claim • Verify in under 5 minutes</p>
                </div>
              ) : (
                <>
                  {/* Business Performance Score */}
                  <div className="biz-score-card">
                    <div className="biz-score-header">
                      <div className="biz-score-ring">
                        <svg viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                          <circle cx="50" cy="50" r="45" fill="none" stroke="url(#scoreGradient)" strokeWidth="8" 
                            strokeDasharray={`${0 / 1000 * 283} 283`} 
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)" />
                          <defs>
                            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#34d399" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="biz-score-value">
                          <span className="score-num">--</span>
                          <span className="score-label">PULSE SCORE</span>
                        </div>
                      </div>
                      <div className="biz-score-info">
                        <h3>Welcome to Your Dashboard</h3>
                        <p>Complete your profile to start building your Pulse Score</p>
                      </div>
                    </div>
                    <div className="biz-score-breakdown">
                      <div className="score-factor">
                        <span className="factor-label">Profile Completion</span>
                        <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#10b981'}}></div></div>
                        <span className="factor-value">--</span>
                      </div>
                      <div className="score-factor">
                        <span className="factor-label">Customer Engagement</span>
                        <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#3b82f6'}}></div></div>
                        <span className="factor-value">--</span>
                      </div>
                      <div className="score-factor">
                        <span className="factor-label">Response Rate</span>
                        <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#8b5cf6'}}></div></div>
                        <span className="factor-value">--</span>
                      </div>
                      <div className="score-factor">
                        <span className="factor-label">Content Quality</span>
                        <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#f59e0b'}}></div></div>
                        <span className="factor-value">--</span>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="biz-metrics-section">
                    <h3>This Week's Performance</h3>
                    <div className="biz-metrics-grid">
                      <div className="biz-metric-card">
                        <div className="metric-icon blue"><Eye size={20} /></div>
                        <div className="metric-data">
                          <span className="metric-value">0</span>
                          <span className="metric-label">Profile Views</span>
                        </div>
                        <div className="metric-trend neutral">
                          <span>—</span>
                        </div>
                      </div>
                      <div className="biz-metric-card">
                        <div className="metric-icon green"><Users size={20} /></div>
                        <div className="metric-data">
                          <span className="metric-value">0</span>
                          <span className="metric-label">Followers</span>
                        </div>
                        <div className="metric-trend neutral">
                          <span>—</span>
                        </div>
                      </div>
                      <div className="biz-metric-card">
                        <div className="metric-icon purple"><Heart size={20} /></div>
                        <div className="metric-data">
                          <span className="metric-value">0</span>
                          <span className="metric-label">Saves</span>
                        </div>
                        <div className="metric-trend neutral">
                          <span>—</span>
                        </div>
                      </div>
                      <div className="biz-metric-card">
                        <div className="metric-icon orange"><Star size={20} /></div>
                        <div className="metric-data">
                          <span className="metric-value">--</span>
                          <span className="metric-label">Avg Rating</span>
                        </div>
                        <div className="metric-trend neutral">
                          <span>—</span>
                        </div>
                      </div>
                      <div className="biz-metric-card">
                        <div className="metric-icon teal"><Percent size={20} /></div>
                        <div className="metric-data">
                          <span className="metric-value">{userStats.dealsRedeemed}</span>
                          <span className="metric-label">Deals Redeemed</span>
                        </div>
                        <div className="metric-trend neutral">
                          <span>—</span>
                        </div>
                      </div>
                      <div className="biz-metric-card">
                        <div className="metric-icon pink"><Calendar size={20} /></div>
                        <div className="metric-data">
                          <span className="metric-value">{userStats.eventsAttended}</span>
                          <span className="metric-label">Event RSVPs</span>
                        </div>
                        <div className="metric-trend neutral">
                          <span>—</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Weekly Goals */}
                  <div className="biz-goals-section">
                    <div className="section-header">
                      <h3>Weekly Goals</h3>
                      <span className="goals-reward">Complete all for +500 XP</span>
                    </div>
                    <div className="biz-goals-list">
                      <div className="biz-goal completed">
                        <div className="goal-check"><Check size={14} /></div>
                        <div className="goal-info">
                          <span className="goal-title">Post a new event or deal</span>
                          <span className="goal-xp">+100 XP</span>
                        </div>
                      </div>
                      <div className="biz-goal completed">
                        <div className="goal-check"><Check size={14} /></div>
                        <div className="goal-info">
                          <span className="goal-title">Respond to 5 reviews</span>
                          <span className="goal-xp">+75 XP</span>
                        </div>
                      </div>
                      <div className="biz-goal in-progress">
                        <div className="goal-progress">3/5</div>
                        <div className="goal-info">
                          <span className="goal-title">Get 5 new reviews</span>
                          <div className="goal-progress-bar">
                            <div className="goal-progress-fill" style={{width: '60%'}}></div>
                          </div>
                        </div>
                        <span className="goal-xp">+150 XP</span>
                      </div>
                      <div className="biz-goal">
                        <div className="goal-empty"></div>
                        <div className="goal-info">
                          <span className="goal-title">Reach 3,000 profile views</span>
                          <div className="goal-progress-bar">
                            <div className="goal-progress-fill" style={{width: '95%'}}></div>
                          </div>
                        </div>
                        <span className="goal-xp">+175 XP</span>
                      </div>
                    </div>
                  </div>

                  {/* Business Achievements */}
                  <div className="biz-achievements-section">
                    <div className="section-header">
                      <h3>Business Badges</h3>
                      <span className="badge-count">0 / 10</span>
                    </div>
                    <div className="biz-badges-grid">
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Check size={18} /></div>
                        <span>Verified</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Star size={18} /></div>
                        <span>Top Rated</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Zap size={18} /></div>
                        <span>Quick Responder</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><TrendingUp size={18} /></div>
                        <span>Rising Star</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Heart size={18} /></div>
                        <span>Community Fave</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Calendar size={18} /></div>
                        <span>Event Pro</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Percent size={18} /></div>
                        <span>Deal Maker</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Users size={18} /></div>
                        <span>1K Followers</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Building size={18} /></div>
                        <span>5K Followers</span>
                      </div>
                      <div className="biz-badge locked">
                        <div className="badge-icon"><Sparkles size={18} /></div>
                        <span>Superhost</span>
                      </div>
                    </div>
                  </div>

                  {/* Insights & Tips */}
                  <div className="biz-insights-section">
                    <h3>💡 Growth Tips</h3>
                    <div className="insights-list">
                      <div className="insight-card hot">
                        <div className="insight-badge">Get Started</div>
                        <p>Post your first <strong>deal or event</strong> to start attracting customers on Pulse.</p>
                        <button type="button" className="insight-action" onClick={() => {
                          setShowSubmissionModal(true);
                          setSubmissionStep(1);
                          setSubmissionType('deal');
                        }}>Create Deal</button>
                      </div>
                      <div className="insight-card">
                        <div className="insight-badge">Tip</div>
                        <p>Complete your business profile to <strong>build trust</strong> with potential customers.</p>
                        <button type="button" className="insight-action" onClick={() => {
                          if (activeBusiness) {
                            const biz = activeBusiness;
                            setEditingVenue(biz);
                            setEditVenueForm({
                              name: biz.name || '',
                              address: biz.address || '',
                              phone: biz.phone || '',
                              website: biz.website || '',
                              email: biz.email || '',
                              category: biz.category || ''
                            });
                            setShowEditVenueModal(true);
                          } else {
                            showToast('No business to edit', 'error');
                          }
                        }}>Edit Profile</button>
                      </div>
                      <div className="insight-card">
                        <div className="insight-badge">Tip</div>
                        <p>Respond to inquiries quickly to improve customer satisfaction and earn badges.</p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="biz-quick-actions">
                    <button type="button" className="quick-action-btn primary" onClick={() => { setShowSubmissionModal(true); setSubmissionStep(1); setSubmissionType('event'); }}>
                      <Plus size={18} />
                      New Event
                    </button>
                    <button type="button" className="quick-action-btn" onClick={() => { setShowSubmissionModal(true); setSubmissionStep(1); setSubmissionType('deal'); }}>
                      <Percent size={18} />
                      New Deal
                    </button>
                    <button type="button" className="quick-action-btn" onClick={() => {
                      if (activeBusiness) {
                        setEditingVenue(activeBusiness);
                        setEditVenueForm({ name: activeBusiness.name || '', address: activeBusiness.address || '', phone: activeBusiness.phone || '', website: activeBusiness.website || '', email: activeBusiness.email || '', category: activeBusiness.category || '' });
                        setShowEditVenueModal(true);
                      }
                    }}>
                      <Edit2 size={18} />
                      Edit Profile
                    </button>
                    <button type="button" className="quick-action-btn" onClick={() => {
                      document.querySelector('.analytics-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>
                      <TrendingUp size={18} />
                      Full Analytics
                    </button>
                  </div>

                  <button type="button" className="add-another-business" onClick={() => { setShowClaimBusinessModal(true); }}>
                    <Plus size={16} />
                    Claim Another Business
                  </button>
                </>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {profileTab === 'settings' && (
            <div className="profile-settings">
              {/* Account Settings */}
              <div className="settings-section">
                <h3>Account</h3>
                <div className="settings-group">
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Full Name</label>
                      <input type="text" value={user.name} onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))} autoComplete="name" />
                    </div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Email</label>
                      <input type="email" value={user.email} onChange={(e) => setUser(prev => ({ ...prev, email: e.target.value }))} autoComplete="email" />
                    </div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Phone</label>
                      <input type="tel" value={user.phone} placeholder="Add phone number" onChange={(e) => setUser(prev => ({ ...prev, phone: e.target.value }))} autoComplete="tel" />
                    </div>
                  </div>
                  <div className="setting-item">
                    <div className="setting-info">
                      <label>Bio</label>
                      <textarea value={user.bio} onChange={(e) => setUser(prev => ({ ...prev, bio: e.target.value }))} rows={3} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="settings-section">
                <h3>Notifications</h3>
                <div className="settings-group">
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">Event Reminders</span>
                      <span className="setting-toggle-desc">Get notified before events you've saved</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.notifications?.eventReminders ?? true} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...(prev.notifications || {}), eventReminders: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">New Deals</span>
                      <span className="setting-toggle-desc">Get notified about new deals in your area</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.notifications?.newDeals ?? true} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...(prev.notifications || {}), newDeals: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">Weekly Digest</span>
                      <span className="setting-toggle-desc">Receive a weekly summary of what's happening</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.notifications?.weeklyDigest ?? true} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...(prev.notifications || {}), weeklyDigest: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">Business Updates</span>
                      <span className="setting-toggle-desc">Updates from businesses you follow</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.notifications?.businessUpdates ?? false} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...(prev.notifications || {}), businessUpdates: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Privacy Settings */}
              <div className="settings-section">
                <h3>Privacy</h3>
                <div className="settings-group">
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">Show Activity</span>
                      <span className="setting-toggle-desc">Let others see your recent activity</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.privacy?.showActivity ?? true} onChange={(e) => setUser(prev => ({ ...prev, privacy: { ...(prev.privacy || {}), showActivity: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">Show Saved Items</span>
                      <span className="setting-toggle-desc">Let others see items you've saved</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.privacy?.showSavedItems ?? false} onChange={(e) => setUser(prev => ({ ...prev, privacy: { ...(prev.privacy || {}), showSavedItems: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-toggle">
                    <div className="setting-toggle-info">
                      <span className="setting-toggle-label">Show Attendance</span>
                      <span className="setting-toggle-desc">Show which events you're attending</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={user.privacy?.showAttendance ?? true} onChange={(e) => setUser(prev => ({ ...prev, privacy: { ...(prev.privacy || {}), showAttendance: e.target.checked } }))} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div className="settings-section">
                <h3>Interests</h3>
                <p className="settings-desc">Select categories to personalize your experience</p>
                <div className="interests-grid">
                  {['Fitness', 'Music', 'Arts', 'Food & Drink', 'Outdoors & Nature', 'Wellness', 'Community', 'Family', 'Nightlife', 'Games'].map(interest => (
                    <button 
                      key={interest} 
                      className={`interest-btn ${(user.interests || []).includes(interest) ? 'selected' : ''}`}
                      onClick={() => {
                        setUser(prev => ({
                          ...prev,
                          interests: (prev.interests || []).includes(interest)
                            ? (prev.interests || []).filter(i => i !== interest)
                            : [...(prev.interests || []), interest]
                        }));
                      }}
                    >
                      {(user.interests || []).includes(interest) && <Check size={14} />}
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="settings-section">
                <button
                  type="button"
                  className="save-profile-btn"
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    if (btn.disabled) return;
                    btn.disabled = true;
                    try {
                      const { error } = await updateProfile({
                        name: user.name,
                        phone: user.phone,
                        bio: user.bio,
                        location: user.location,
                        interests: user.interests,
                        socialLinks: user.socialLinks,
                        notifications: user.notifications,
                        privacy: user.privacy
                      });
                      showToast?.(error ? 'Error saving profile. Please try again.' : 'Profile saved successfully!', error ? 'error' : 'success');
                    } finally {
                      btn.disabled = false;
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '24px'
                  }}
                >
                  Save Profile
                </button>
              </div>

              {/* Danger Zone */}
              <div className="settings-section danger">
                <h3>Danger Zone</h3>
                <div className="danger-actions">
                  <button type="button" className="danger-btn" onClick={() => {
                    showToast('Please contact support to delete your account', 'info');
                  }}>
                    <Trash2 size={16} />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProfileModal;
