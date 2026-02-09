import React, { memo } from 'react';
import {
  AlertCircle, Building, Calendar, Check, CheckCircle, ChevronLeft,
  ChevronRight, DollarSign, Edit2, Eye, Heart, MessageCircle, Percent,
  Plus, Send, Sparkles, Star, Ticket, Trash2, TrendingUp, Users, X, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const BusinessDashboard = memo(function BusinessDashboard({
  user,
  isImpersonating,
  impersonatedBusiness,
  activeBusiness,
  userClaimedBusinesses,
  analyticsPeriod,
  setAnalyticsPeriod,
  businessAnalytics,
  dbEvents,
  businessInboxTab,
  setBusinessInboxTab,
  businessConversations,
  businessConversationsLoading,
  selectedBusinessConversation,
  setSelectedBusinessConversation,
  businessMessagesLoading,
  businessMessages,
  businessReplyInput,
  setBusinessReplyInput,
  sendingMessage,
  eventsRefreshKey,
  setShowAuthModal,
  setShowClaimBusinessModal,
  setSelectedClaimedBusinessId,
  setEditingEvent,
  setEditEventForm,
  setShowEditEventModal,
  setShowSubmissionModal,
  setSubmissionStep,
  setSubmissionType,
  setEditingVenue,
  setEditVenueForm,
  setShowEditVenueModal,
  setEventsRefreshKey,
  fetchServices,
  showToast,
  exitImpersonation,
  fetchBusinessInbox,
  fetchBusinessMessages,
  markConversationResolved,
  sendBusinessReply,
}) {
  return (
    <div className="business-view-premium">
      {/* Check if user is authenticated first */}
      {user.isGuest && !isImpersonating ? (
        <div className="no-business-view">
          <div className="no-biz-content">
            <div className="no-biz-icon">
              <Building size={64} />
            </div>
            <h2>Sign In Required</h2>
            <p>Sign in to access the Business Dashboard and manage your business on Pulse.</p>
            <button className="claim-biz-btn-large" onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
          </div>
        </div>
      ) : !activeBusiness ? (
        <div className="no-business-view">
          <div className="no-biz-content">
            <div className="no-biz-icon">
              <Building size={64} />
            </div>
            <h2>Welcome to Business Dashboard</h2>
            <p>Claim your business to unlock powerful analytics, engage with customers, and grow your revenue.</p>

            <div className="biz-benefits-grid">
              <div className="biz-benefit">
                <TrendingUp size={24} />
                <h4>Track Performance</h4>
                <p>Views, clicks, bookings & revenue</p>
              </div>
              <div className="biz-benefit">
                <Users size={24} />
                <h4>Grow Audience</h4>
                <p>Followers, engagement & reach</p>
              </div>
              <div className="biz-benefit">
                <Zap size={24} />
                <h4>Earn Rewards</h4>
                <p>XP, badges & leaderboard rank</p>
              </div>
              <div className="biz-benefit">
                <Calendar size={24} />
                <h4>Post Events</h4>
                <p>Classes, deals & promotions</p>
              </div>
            </div>

            <button className="claim-biz-btn-large" onClick={() => setShowClaimBusinessModal(true)}>
              <Plus size={20} />
              Claim Your Business
            </button>
            <p className="claim-note">Free to claim • Verify in under 5 minutes</p>
          </div>
        </div>
      ) : (
        <>
          {/* Impersonation Banner */}
          {isImpersonating && (
            <div className="impersonation-banner">
              <div className="impersonation-left">
                <Eye size={18} />
                <span>Admin View: <strong>{impersonatedBusiness.name}</strong></span>
                <span className="impersonation-badge">Impersonation Mode</span>
              </div>
              <button className="impersonation-exit-btn" onClick={exitImpersonation}>
                <X size={16} />
                Exit Business View
              </button>
            </div>
          )}

          {/* Premium Header */}
          <div className="premium-header">
            <div className="premium-header-content">
              <div className="header-left">
                <div className="venue-avatar-upload" onClick={() => document.getElementById('business-logo-upload')?.click()}>
                  <input
                    id="business-logo-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !activeBusiness?.id) return;
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `business-logos/${activeBusiness.id}/logo.${fileExt}`;
                        const { error: uploadError } = await supabase.storage
                          .from('avatars')
                          .upload(fileName, file, { upsert: true });
                        if (uploadError) throw uploadError;
                        const { data: { publicUrl } } = supabase.storage
                          .from('avatars')
                          .getPublicUrl(fileName);
                        const { error: updateError } = await supabase
                          .from('businesses')
                          .update({ logo_url: publicUrl })
                          .eq('id', activeBusiness.id);
                        if (updateError) throw updateError;
                        fetchServices(true);
                        showToast('Logo updated!', 'success');
                      } catch (err) {
                        showToast('Failed to upload logo: ' + err.message, 'error');
                      }
                      e.target.value = '';
                    }}
                  />
                  <div className="venue-avatar">
                    {activeBusiness.logo_url
                      ? <img src={activeBusiness.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : <span className="venue-initial">{activeBusiness.name.charAt(0)}</span>
                    }
                  </div>
                  <div className="upload-overlay">
                    <Edit2 size={20} />
                  </div>
                </div>
                <div className="header-text">
                  <h1>{activeBusiness.name}</h1>
                  <p className="header-subtitle">{activeBusiness.address}</p>
                </div>
              </div>
              <div className="header-right">
                {activeBusiness.verified && (
                  <div className="verification-badge-premium">
                    <CheckCircle size={18} />
                    <span>Verified</span>
                  </div>
                )}
                {!isImpersonating && userClaimedBusinesses.length > 1 && (
                  <select className="business-selector" value={activeBusiness?.id || ''} onChange={(e) => setSelectedClaimedBusinessId(e.target.value)}>
                    {userClaimedBusinesses.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Pulse Score Card */}
          <div className="biz-pulse-score-card">
            <div className="pulse-score-left">
              <div className="pulse-score-ring">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pulseGradient)" strokeWidth="10" 
                    strokeDasharray={`${0 / 1000 * 327} 327`} 
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)" />
                  <defs>
                    <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="pulse-score-center">
                  <span className="pulse-score-num">--</span>
                  <span className="pulse-score-label">PULSE</span>
                </div>
              </div>
            </div>
            <div className="pulse-score-right">
              <div className="pulse-score-title">
                <h3>Build Your Score</h3>
              </div>
              <p>Complete your profile and engage with customers to build your Pulse Score</p>
            </div>
            <div className="pulse-score-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Profile</span>
                <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                <span className="breakdown-val">--</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Engagement</span>
                <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                <span className="breakdown-val">--</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Response</span>
                <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                <span className="breakdown-val">--</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Quality</span>
                <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                <span className="breakdown-val">--</span>
              </div>
            </div>
          </div>

          {/* Time Period Selector */}
          <div className="analytics-controls">
            <div className="time-selector">
              <button className={`time-btn ${analyticsPeriod === 30 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(30)}>Last 30 Days</button>
              <button className={`time-btn ${analyticsPeriod === 90 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(90)}>Last 90 Days</button>
              <button className={`time-btn ${analyticsPeriod === 365 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(365)}>This Year</button>
              <button className={`time-btn ${analyticsPeriod === 9999 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(9999)}>All Time</button>
            </div>
          </div>

          {/* Premium Stats Grid - Real Analytics */}
          <div className="premium-stats-grid">
            <div className="premium-stat-card views">
              <div className="stat-header">
                <span className="stat-label">Profile Views</span>
                <Eye size={20} className="stat-icon-float" />
              </div>
              <div className="stat-main">
                <div className="stat-value-large">
                  {businessAnalytics?.totals?.profile_views?.toLocaleString() || '0'}
                </div>
                <div className="stat-change neutral">
                  <span className="change-text">Last {analyticsPeriod} days</span>
                </div>
              </div>
              <div className="stat-chart">
                <div className="mini-bars">
                  {(businessAnalytics?.daily_breakdown?.slice(-7) || []).map((day, i) => (
                    <div key={i} className="mini-bar" style={{height: `${Math.min(100, (day.profile_views || 0) * 10)}%`}}></div>
                  ))}
                  {!businessAnalytics?.daily_breakdown && (
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#9ca3af', fontSize: '11px'}}>No data yet</div>
                  )}
                </div>
              </div>
            </div>

            <div className="premium-stat-card clicks">
              <div className="stat-header">
                <span className="stat-label">Class/Event Views</span>
                <Users size={20} className="stat-icon-float" />
              </div>
              <div className="stat-main">
                <div className="stat-value-large">
                  {((businessAnalytics?.totals?.class_views || 0) + (businessAnalytics?.totals?.event_views || 0)).toLocaleString()}
                </div>
                <div className="stat-change neutral">
                  <span className="change-text">Last {analyticsPeriod} days</span>
                </div>
              </div>
              <div className="stat-submetrics">
                <div className="submetric">
                  <span className="submetric-value">{businessAnalytics?.totals?.class_views || 0}</span>
                  <span className="submetric-label">Classes</span>
                </div>
                <div className="submetric">
                  <span className="submetric-value">{businessAnalytics?.totals?.event_views || 0}</span>
                  <span className="submetric-label">Events</span>
                </div>
              </div>
            </div>

            <div className="premium-stat-card bookings">
              <div className="stat-header">
                <span className="stat-label">Booking Clicks</span>
                <Ticket size={20} className="stat-icon-float" />
              </div>
              <div className="stat-main">
                <div className="stat-value-large">
                  {businessAnalytics?.totals?.booking_clicks?.toLocaleString() || '0'}
                </div>
                <div className="stat-change neutral">
                  <span className="change-text">Last {analyticsPeriod} days</span>
                </div>
              </div>
              <div className="stat-submetrics">
                <div className="submetric">
                  <span className="submetric-value">{businessAnalytics?.totals?.bookings_confirmed || 0}</span>
                  <span className="submetric-label">Confirmed</span>
                </div>
              </div>
            </div>

            <div className="premium-stat-card messages">
              <div className="stat-header">
                <span className="stat-label">Messages</span>
                <MessageCircle size={20} className="stat-icon-float" />
              </div>
              <div className="stat-main">
                <div className="stat-value-large">
                  {businessAnalytics?.totals?.messages_received?.toLocaleString() || '0'}
                </div>
                <div className="stat-change neutral">
                  <span className="change-text">Last {analyticsPeriod} days</span>
                </div>
              </div>
              <div className="stat-submetrics">
                <div className="submetric">
                  <span className="submetric-value">{businessAnalytics?.totals?.total_events || 0}</span>
                  <span className="submetric-label">Total interactions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Goals Section */}
          <div className="premium-section goals-section">
            <div className="section-header-premium">
              <h2>Weekly Goals</h2>
              <div className="goals-reward-badge">
                <Sparkles size={14} />
                <span>Complete all for +500 XP</span>
              </div>
            </div>

            <div className="goals-grid">
              <div className="goal-card completed">
                <div className="goal-status"><Check size={16} /></div>
                <div className="goal-content">
                  <span className="goal-title">Post a new event or deal</span>
                  <span className="goal-xp">+100 XP</span>
                </div>
              </div>
              <div className="goal-card completed">
                <div className="goal-status"><Check size={16} /></div>
                <div className="goal-content">
                  <span className="goal-title">Respond to 5 reviews</span>
                  <span className="goal-xp">+75 XP</span>
                </div>
              </div>
              <div className="goal-card in-progress">
                <div className="goal-status progress">3/5</div>
                <div className="goal-content">
                  <span className="goal-title">Get 5 new reviews</span>
                  <div className="goal-progress-bar"><div style={{width: '60%'}}></div></div>
                </div>
                <span className="goal-xp">+150 XP</span>
              </div>
              <div className="goal-card">
                <div className="goal-status empty"></div>
                <div className="goal-content">
                  <span className="goal-title">Reach 15,000 profile views</span>
                  <div className="goal-progress-bar"><div style={{width: '86%'}}></div></div>
                </div>
                <span className="goal-xp">+175 XP</span>
              </div>
            </div>
          </div>

          {/* Business Badges */}
          <div className="premium-section badges-section">
            <div className="section-header-premium">
              <h2>Business Badges</h2>
              <span className="badge-progress">0 / 10 earned</span>
            </div>

            <div className="badges-showcase">
              <div className="badge-item locked">
                <div className="badge-icon"><Check size={18} /></div>
                <span>Verified</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Star size={18} /></div>
                <span>Top Rated</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Zap size={18} /></div>
                <span>Quick Reply</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><TrendingUp size={18} /></div>
                <span>Rising Star</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Heart size={18} /></div>
                <span>Community Fave</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Calendar size={18} /></div>
                <span>Event Pro</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Percent size={18} /></div>
                <span>Deal Maker</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Users size={18} /></div>
                <span>1K Followers</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Building size={18} /></div>
                <span>5K Followers</span>
              </div>
              <div className="badge-item locked">
                <div className="badge-icon"><Sparkles size={18} /></div>
                <span>Superhost</span>
              </div>
            </div>
          </div>

          {/* Growth Insights */}
          <div className="premium-section insights-section">
            <div className="section-header-premium">
              <h2>💡 Growth Tips</h2>
            </div>

            <div className="insights-cards">
              <div className="insight-item hot">
                <div className="insight-tag">Get Started</div>
                <p>Post your first <strong>deal or event</strong> to start attracting customers on Pulse.</p>
                <button className="insight-btn" onClick={() => {
                  setShowSubmissionModal(true);
                  setSubmissionStep(1);
                  setSubmissionType('deal');
                }}>Create Deal</button>
              </div>
              <div className="insight-item">
                <div className="insight-tag">Tip</div>
                <p>Complete your business profile to <strong>build trust</strong> with potential customers.</p>
                <button className="insight-btn" onClick={() => {
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
              <div className="insight-item">
                <div className="insight-tag">Tip</div>
                <p>Keep your business profile updated and respond promptly to customer inquiries.</p>
              </div>
            </div>
          </div>

          {/* How to Improve Your Score */}
          <div className="premium-section score-tips-section">
            <div className="section-header-premium">
              <h2>📈 How to Improve Your Pulse Score</h2>
            </div>

            <div className="score-tips-grid">
              <div className="score-tip-card">
                <div className="tip-header">
                  <div className="tip-score">
                    <span className="tip-score-val">92</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Engagement</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: '92%', background: 'linear-gradient(90deg, #10b981, #34d399)'}}></div>
                </div>
                <p className="tip-description">How often customers interact with your listings</p>
                <div className="tip-actions">
                  <div className="tip-action">
                    <Check size={14} />
                    <span>Post events weekly</span>
                  </div>
                  <div className="tip-action">
                    <Check size={14} />
                    <span>Add photos to listings</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Create a deal (+5 pts)</span>
                  </div>
                </div>
              </div>

              <div className="score-tip-card">
                <div className="tip-header">
                  <div className="tip-score">
                    <span className="tip-score-val">88</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Response Rate</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: '88%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'}}></div>
                </div>
                <p className="tip-description">How quickly you respond to reviews & messages</p>
                <div className="tip-actions">
                  <div className="tip-action">
                    <Check size={14} />
                    <span>Reply within 24 hrs</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>3 reviews need response (+4 pts)</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Enable notifications (+3 pts)</span>
                  </div>
                </div>
              </div>

              <div className="score-tip-card needs-attention">
                <div className="tip-header">
                  <div className="tip-score">
                    <span className="tip-score-val">76</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Content Quality</span>
                  <span className="needs-work-badge">Needs Work</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: '76%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'}}></div>
                </div>
                <p className="tip-description">Completeness & quality of your profile & events</p>
                <div className="tip-actions">
                  <div className="tip-action">
                    <Check size={14} />
                    <span>Business verified</span>
                  </div>
                  <div className="tip-action pending urgent">
                    <AlertCircle size={14} />
                    <span>Add business hours (+8 pts)</span>
                  </div>
                  <div className="tip-action pending urgent">
                    <AlertCircle size={14} />
                    <span>Upload cover photo (+6 pts)</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Complete description (+4 pts)</span>
                  </div>
                </div>
              </div>

              <div className="score-tip-card">
                <div className="tip-header">
                  <div className="tip-score">
                    <span className="tip-score-val">95</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Customer Satisfaction</span>
                  <span className="excellent-badge">Excellent</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: '95%', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'}}></div>
                </div>
                <p className="tip-description">Based on ratings, reviews & repeat customers</p>
                <div className="tip-actions">
                  <div className="tip-action">
                    <Check size={14} />
                    <span>4.8 star average</span>
                  </div>
                  <div className="tip-action">
                    <Check size={14} />
                    <span>42% repeat customers</span>
                  </div>
                  <div className="tip-action">
                    <Check size={14} />
                    <span>0 unresolved complaints</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Events/Classes */}
          <div className="premium-section">
            <div className="section-header-premium">
              <h2>🏆 Top Performing</h2>
              <button className="btn-text" onClick={() => document.querySelector('.analytics-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View all analytics →</button>
            </div>

            <div className="top-classes-grid">
              {[
                { name: "No data yet", type: "Deal", views: 0, conversions: 0, revenue: "$0", growth: 0 },
              ].map((item, i) => (
                <div key={i} className="top-class-card">
                  <div className="class-card-header">
                    <div className="class-rank-badge">#{i + 1}</div>
                    <div className="class-title-section">
                      <h3>{item.name}</h3>
                      <span className="class-type-badge">{item.type}</span>
                    </div>
                    <div className="class-growth-badge">
                      <TrendingUp size={14} />
                      <span>+{item.growth}%</span>
                    </div>
                  </div>
                  <div className="class-card-stats">
                    <div className="class-stat-item">
                      <div className="stat-icon views-icon">
                        <Eye size={16} />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">{item.views.toLocaleString()}</div>
                        <div className="stat-label">Views</div>
                      </div>
                    </div>
                    <div className="class-stat-divider"></div>
                    <div className="class-stat-item">
                      <div className="stat-icon bookings-icon">
                        <Users size={16} />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">{item.conversions}</div>
                        <div className="stat-label">Conversions</div>
                      </div>
                    </div>
                    <div className="class-stat-divider"></div>
                    <div className="class-stat-item">
                      <div className="stat-icon revenue-icon">
                        <DollarSign size={16} />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">{item.revenue}</div>
                        <div className="stat-label">Revenue</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Your Listings Management */}
          <div className="premium-section">
            <div className="section-header-premium">
              <h2>Your Active Listings</h2>
              <div className="section-actions">
                <button className="btn-primary-gradient" onClick={() => { setShowSubmissionModal(true); setSubmissionStep(1); }}><Plus size={18} /> Add New</button>
              </div>
            </div>

            {(() => {
              const businessListings = activeBusiness ? dbEvents.filter(e => e.venueId === activeBusiness.id || (e.venueName && activeBusiness.name && e.venueName.toLowerCase() === activeBusiness.name.toLowerCase())).slice(0, 20) : [];
              return businessListings.length > 0 ? (
                <div className="listings-table-container">
                  <table className="listings-table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {businessListings.map((listing) => (
                        <tr key={listing.id} className="listing-row">
                          <td>
                            <div className="listing-name-cell">
                              <span className="listing-name">{listing.title}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`type-badge ${listing.eventType}`}>{listing.eventType === 'class' ? 'Class' : 'Event'}</span>
                          </td>
                          <td>
                            <span className="status-badge active">
                              <span className="status-dot"></span>
                              Active
                            </span>
                          </td>
                          <td><span className="metric-cell">{listing.start ? new Date(listing.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span></td>
                          <td><span className="metric-cell">{listing.start ? new Date(listing.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</span></td>
                          <td>
                            <div className="actions-cell">
                              <button className="action-btn-sm" title="Edit" onClick={() => {
                                setEditingEvent(listing);
                                setEditEventForm({ title: listing.title || '', description: listing.description || '', date: listing.start ? `${listing.start.getFullYear()}-${String(listing.start.getMonth()+1).padStart(2,'0')}-${String(listing.start.getDate()).padStart(2,'0')}` : '', startTime: listing.start ? `${String(listing.start.getHours()).padStart(2,'0')}:${String(listing.start.getMinutes()).padStart(2,'0')}` : '', endTime: listing.end ? `${String(listing.end.getHours()).padStart(2,'0')}:${String(listing.end.getMinutes()).padStart(2,'0')}` : '', price: listing.price || '', category: listing.category || '' });
                                setShowEditEventModal(true);
                              }}><Edit2 size={14} /></button>
                              <button className="action-btn-sm danger" title="Delete" onClick={async () => {
                                if (confirm(`Delete "${listing.title}"?`)) {
                                  try {
                                    const { error } = await supabase.from('events').delete().eq('id', listing.id);
                                    if (error) throw error;
                                    showToast(`"${listing.title}" deleted`, 'success');
                                    setEventsRefreshKey(k => k + 1);
                                  } catch (_err) {
                                    showToast('Failed to delete', 'error');
                                  }
                                }
                              }}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: '#9ca3af' }}>
                  <Calendar size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>No active listings yet. Add an event or class to get started.</p>
                </div>
              );
            })()}
          </div>

          {/* Audience Insights - Coming Soon */}
          <div className="premium-section audience-section" style={{ opacity: 0.6 }}>
            <div className="section-header-premium">
              <h2>👥 Audience Insights</h2>
              <span style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Coming Soon</span>
            </div>
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
              <p>Audience insights will be available once analytics tracking is connected.</p>
            </div>
          </div>

          {/* Business Inbox Section */}
          <div className="premium-section inbox-section">
            <div className="section-header-premium">
              <h2>📬 Inbox</h2>
              <div className="inbox-tabs">
                <button
                  className={`inbox-tab ${businessInboxTab === 'bookings' ? 'active' : ''}`}
                  onClick={() => {
                    setBusinessInboxTab('bookings');
                    fetchBusinessInbox(activeBusiness?.id, 'booking_request');
                  }}
                >
                  Booking Requests
                  {businessConversations.filter(c => c.type === 'booking_request' && c.unread_count > 0).length > 0 && (
                    <span className="inbox-badge">{businessConversations.filter(c => c.type === 'booking_request' && c.unread_count > 0).length}</span>
                  )}
                </button>
                <button
                  className={`inbox-tab ${businessInboxTab === 'messages' ? 'active' : ''}`}
                  onClick={() => {
                    setBusinessInboxTab('messages');
                    fetchBusinessInbox(activeBusiness?.id, 'general_inquiry');
                  }}
                >
                  Messages
                  {businessConversations.filter(c => c.type === 'general_inquiry' && c.unread_count > 0).length > 0 && (
                    <span className="inbox-badge">{businessConversations.filter(c => c.type === 'general_inquiry' && c.unread_count > 0).length}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="inbox-content">
              {businessConversationsLoading ? (
                <div className="inbox-loading">
                  <div className="spinner" />
                  <p>Loading...</p>
                </div>
              ) : selectedBusinessConversation ? (
                <div className="inbox-thread">
                  <div className="thread-header">
                    <button className="back-btn" onClick={() => setSelectedBusinessConversation(null)}>
                      <ChevronLeft size={20} />
                    </button>
                    <div className="thread-info">
                      <h4>{selectedBusinessConversation.user_name || 'Customer'}</h4>
                      <span className="thread-subject">{selectedBusinessConversation.subject}</span>
                    </div>
                    <button
                      className="resolve-btn"
                      onClick={() => markConversationResolved(selectedBusinessConversation.id)}
                    >
                      <Check size={16} />
                      Resolve
                    </button>
                  </div>

                  <div className="thread-messages">
                    {businessMessagesLoading ? (
                      <div className="inbox-loading">
                        <div className="spinner" />
                      </div>
                    ) : businessMessages.length === 0 ? (
                      <p className="no-messages">No messages yet</p>
                    ) : (
                      businessMessages.map(msg => (
                        <div
                          key={msg.id}
                          className={`thread-message ${msg.sender_type === 'business' ? 'sent' : 'received'}`}
                        >
                          <p>{msg.content}</p>
                          <span className="msg-time">
                            {new Date(msg.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="thread-reply">
                    <input
                      type="text"
                      placeholder="Type your reply..."
                      value={businessReplyInput}
                      onChange={(e) => setBusinessReplyInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendBusinessReply()}
                    />
                    <button
                      className="send-reply-btn"
                      onClick={sendBusinessReply}
                      disabled={!businessReplyInput.trim() || sendingMessage}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              ) : businessConversations.length === 0 ? (
                <div className="inbox-empty">
                  <MessageCircle size={48} />
                  <h3>No {businessInboxTab === 'bookings' ? 'booking requests' : 'messages'} yet</h3>
                  <p>When customers reach out, their messages will appear here.</p>
                </div>
              ) : (
                <div className="inbox-list">
                  {businessConversations.map(conv => (
                    <div
                      key={conv.id}
                      className={`inbox-item ${conv.unread_count > 0 ? 'unread' : ''}`}
                      onClick={() => {
                        setSelectedBusinessConversation(conv);
                        fetchBusinessMessages(conv.id);
                      }}
                    >
                      <div className="inbox-avatar">
                        {(conv.user_name || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="inbox-item-content">
                        <div className="inbox-item-header">
                          <span className="inbox-item-name">{conv.user_name || 'Customer'}</span>
                          <span className="inbox-item-time">
                            {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <p className="inbox-item-subject">{conv.subject}</p>
                        <p className="inbox-item-preview">{conv.last_message_preview || 'No messages yet'}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="inbox-unread-badge">{conv.unread_count}</div>
                      )}
                      <ChevronRight size={16} className="inbox-chevron" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="premium-section actions-section">
            <div className="quick-actions-grid">
              <button className="qa-btn primary" onClick={() => { setShowSubmissionModal(true); setSubmissionStep(1); setSubmissionType('event'); }}>
                <Plus size={20} />
                <span>New Event</span>
              </button>
              <button className="qa-btn" onClick={() => { setShowSubmissionModal(true); setSubmissionStep(1); setSubmissionType('deal'); }}>
                <Percent size={20} />
                <span>New Deal</span>
              </button>
              <button className="qa-btn" onClick={() => {
                if (activeBusiness) {
                  setEditingVenue(activeBusiness);
                  setEditVenueForm({ name: activeBusiness.name || '', address: activeBusiness.address || '', phone: activeBusiness.phone || '', website: activeBusiness.website || '', email: activeBusiness.email || '', category: activeBusiness.category || '' });
                  setShowEditVenueModal(true);
                }
              }}>
                <Edit2 size={20} />
                <span>Edit Profile</span>
              </button>
              <button className="qa-btn" onClick={() => {
                document.querySelector('.analytics-controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}>
                <TrendingUp size={20} />
                <span>Full Analytics</span>
              </button>
            </div>
          </div>

          {/* Help Cards */}
          <div className="quick-actions-section">
            <div className="quick-action-card">
              <div className="qa-icon">📊</div>
              <h3>Download Report</h3>
              <p>Get detailed analytics for this month</p>
              <button className="btn-outline" onClick={() => showToast('PDF reports coming in a future update', 'info')}>Download PDF</button>
            </div>
            <div className="quick-action-card">
              <div className="qa-icon">✉️</div>
              <h3>Contact Support</h3>
              <p>Need help? Our team is here for you</p>
              <button className="btn-outline" onClick={() => window.open('mailto:support@pulsesquamish.com', '_blank')}>Get Help</button>
            </div>
            <div className="quick-action-card">
              <div className="qa-icon">🎯</div>
              <h3>Boost Visibility</h3>
              <p>Feature your listings for more reach</p>
              <button className="btn-outline" onClick={() => showToast('Premium features coming soon', 'info')}>Upgrade</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default BusinessDashboard;
