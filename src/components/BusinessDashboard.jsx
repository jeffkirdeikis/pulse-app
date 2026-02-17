import React, { memo } from 'react';
import {
  AlertCircle, Building, Calendar, Check, CheckCircle, ChevronLeft,
  ChevronRight, DollarSign, Download, Edit2, Eye, Heart, MessageCircle, Percent,
  Plus, Send, Share2, Sparkles, Star, Ticket, Trash2, TrendingUp, Users, X, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPacificNow } from '../utils/timezoneHelpers';

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
  dbDeals,
  businessInboxTab,
  setBusinessInboxTab,
  businessConversations,
  inboxUnreadCounts,
  businessConversationsLoading,
  selectedBusinessConversation,
  setSelectedBusinessConversation,
  businessMessagesLoading,
  businessMessages,
  businessReplyInput,
  setBusinessReplyInput,
  sendingBusinessReply,
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
  openSubmissionModal,
  selectSubmissionType,
  setEditingVenue,
  setEditVenueForm,
  setShowEditVenueModal,
  setEventsRefreshKey,
  setDealsRefreshKey,
  fetchServices,
  showToast,
  exitImpersonation,
  fetchBusinessInbox,
  fetchBusinessMessages,
  markConversationResolved,
  sendBusinessReply,
}) {
  // === Computed: Top Performing Content ===
  const businessListingsAll = activeBusiness ? dbEvents.filter(e => e.venueId === activeBusiness.id || (e.venueName && activeBusiness.name && e.venueName.toLowerCase() === activeBusiness.name.toLowerCase())) : [];
  const businessDealsAll = activeBusiness && dbDeals ? dbDeals.filter(d => d.venueName && activeBusiness.name && d.venueName.toLowerCase() === activeBusiness.name.toLowerCase()) : [];
  const totalListingsCount = businessListingsAll.length + businessDealsAll.length;
  const topPerforming = [...businessListingsAll].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 3).filter(e => e.viewCount > 0 || businessListingsAll.length > 0);
  // If no views yet, just show top 3 listings as a starting point
  const topItems = topPerforming.length > 0 ? topPerforming : businessListingsAll.slice(0, 3);

  // === Computed: Pulse Score ===
  const profileFields = activeBusiness ? [activeBusiness.name, activeBusiness.address, activeBusiness.phone, activeBusiness.website, activeBusiness.email, activeBusiness.category].filter(Boolean).length : 0;
  const profileScore = Math.round((profileFields / 6) * 100);
  const totalViews = (businessAnalytics?.totals?.profile_views || 0) + (businessAnalytics?.totals?.class_views || 0) + (businessAnalytics?.totals?.event_views || 0);
  const engagementScore = Math.min(100, Math.round(totalViews / 10));
  const conversations = businessConversations || [];
  const resolvedConvos = conversations.filter(c => c.status === 'resolved').length;
  const totalConvos = conversations.length;
  const responseScore = totalConvos > 0 ? Math.round((resolvedConvos / totalConvos) * 100) : 0;
  const qualityScore = Math.min(100, totalListingsCount * 10);
  const pulseScore = Math.round((profileScore + engagementScore + responseScore + qualityScore) / 4);

  // === Computed: Weekly Goals ===
  const weekAgo = getPacificNow(); weekAgo.setDate(weekAgo.getDate() - 7);
  const eventsThisWeek = businessListingsAll.filter(e => e.createdAt && new Date(e.createdAt) >= weekAgo).length;
  const goalPosted = eventsThisWeek > 0;
  const goalViews = businessAnalytics?.totals?.profile_views || 0;
  const goalViewsTarget = 500;
  const goalViewsPct = Math.min(100, Math.round((goalViews / goalViewsTarget) * 100));

  // === Computed: Badges ===
  const badges = [
    { icon: Check, name: 'Verified', earned: !!activeBusiness?.claimed_by },
    { icon: Star, name: 'Top Rated', earned: totalViews >= 100 },
    { icon: Zap, name: 'Quick Reply', earned: responseScore >= 80 },
    { icon: TrendingUp, name: 'Rising Star', earned: totalViews >= 50 },
    { icon: Heart, name: 'Community Fave', earned: (businessAnalytics?.totals?.total_saves || 0) >= 10 },
    { icon: Calendar, name: 'Event Pro', earned: businessListingsAll.filter(e => e.eventType !== 'class').length >= 10 },
    { icon: Percent, name: 'Deal Maker', earned: false },
    { icon: Users, name: '1K Views', earned: totalViews >= 1000 },
    { icon: Building, name: '5K Views', earned: totalViews >= 5000 },
    { icon: Sparkles, name: 'Superhost', earned: pulseScore >= 80 },
  ];
  const earnedBadgeCount = badges.filter(b => b.earned).length;

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
                      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
                        showToast('Only image files (PNG, JPG, GIF, WebP) are allowed', 'error');
                        e.target.value = '';
                        return;
                      }
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
                      ? <img src={activeBusiness.logo_url} alt={`${activeBusiness.name || 'Business'} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : <span className="venue-initial">{activeBusiness.name?.charAt(0) || '?'}</span>
                    }
                  </div>
                  <div className="upload-overlay">
                    <Edit2 size={20} />
                  </div>
                </div>
                <div className="header-text">
                  <h1>{activeBusiness.name || 'Unnamed Business'}</h1>
                  <p className="header-subtitle">{activeBusiness.address || ''}</p>
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
            <button className="pulse-share-btn" title="Share your Pulse Score" aria-label="Share your Pulse Score" onClick={async () => {
              const shareText = `${activeBusiness?.name} has a Pulse Score of ${pulseScore}/100 on Pulse Squamish! ${earnedBadgeCount} badges earned. Check them out!`;
              if (navigator.share) {
                try { await navigator.share({ title: `${activeBusiness?.name} - Pulse Score`, text: shareText, url: `https://pulse-app.ca/squamish#services` }); } catch { /* user cancelled share dialog */ }
              } else {
                try {
                  await navigator.clipboard.writeText(shareText);
                  showToast('Copied to clipboard!', 'success');
                } catch {
                  showToast('Failed to copy to clipboard', 'error');
                }
              }
            }}>
              <Share2 size={16} />
            </button>
            <div className="pulse-score-left">
              <div className="pulse-score-ring">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pulseGradientBiz)" strokeWidth="10"
                    strokeDasharray={`${pulseScore / 100 * 327} 327`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)" />
                  <defs>
                    <linearGradient id="pulseGradientBiz" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="pulse-score-center">
                  <span className="pulse-score-num">{pulseScore}</span>
                  <span className="pulse-score-label">PULSE</span>
                </div>
              </div>
            </div>
            <div className="pulse-score-right">
              <div className="pulse-score-title">
                <h3>{pulseScore >= 80 ? 'Great Score!' : pulseScore >= 50 ? 'Growing Nicely' : 'Build Your Score'}</h3>
              </div>
              <p>{pulseScore >= 80 ? 'Your business is performing well on Pulse' : 'Complete your profile and engage with customers to build your Pulse Score'}</p>
            </div>
            <div className="pulse-score-breakdown">
              <div className="breakdown-item">
                <span className="breakdown-label">Profile</span>
                <div className="breakdown-bar"><div style={{width: `${profileScore}%`}}></div></div>
                <span className="breakdown-val">{profileScore}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Engagement</span>
                <div className="breakdown-bar"><div style={{width: `${engagementScore}%`}}></div></div>
                <span className="breakdown-val">{engagementScore}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Response</span>
                <div className="breakdown-bar"><div style={{width: `${responseScore}%`}}></div></div>
                <span className="breakdown-val">{responseScore > 0 ? `${responseScore}%` : 'N/A'}</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Quality</span>
                <div className="breakdown-bar"><div style={{width: `${qualityScore}%`}}></div></div>
                <span className="breakdown-val">{qualityScore}%</span>
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
                  <span className="change-text">Last {analyticsPeriod >= 9999 ? 'All Time' : `${analyticsPeriod} days`}</span>
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
                  <span className="change-text">Last {analyticsPeriod >= 9999 ? 'All Time' : `${analyticsPeriod} days`}</span>
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
                  <span className="change-text">Last {analyticsPeriod >= 9999 ? 'All Time' : `${analyticsPeriod} days`}</span>
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
                  <span className="change-text">Last {analyticsPeriod >= 9999 ? 'All Time' : `${analyticsPeriod} days`}</span>
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
              <div className="goal-card">
                <div className={`goal-status ${goalPosted ? 'complete' : 'empty'}`}>{goalPosted && <Check size={14} />}</div>
                <div className="goal-content">
                  <span className="goal-title">Post a new event or deal</span>
                  <span className="goal-xp">+100 XP</span>
                </div>
              </div>
              <div className="goal-card">
                <div className={`goal-status ${resolvedConvos >= 5 ? 'complete' : 'empty'}`}>{resolvedConvos >= 5 && <Check size={14} />}</div>
                <div className="goal-content">
                  <span className="goal-title">Respond to 5 messages</span>
                  <div className="goal-progress-bar"><div style={{width: `${Math.min(100, (resolvedConvos / 5) * 100)}%`}}></div></div>
                </div>
                <span className="goal-xp">+75 XP</span>
              </div>
              <div className="goal-card">
                <div className={`goal-status ${totalListingsCount >= 10 ? 'complete' : 'empty'}`}>{totalListingsCount >= 10 && <Check size={14} />}</div>
                <div className="goal-content">
                  <span className="goal-title">Have 10 active listings</span>
                  <div className="goal-progress-bar"><div style={{width: `${Math.min(100, (totalListingsCount / 10) * 100)}%`}}></div></div>
                </div>
                <span className="goal-xp">+150 XP</span>
              </div>
              <div className="goal-card">
                <div className={`goal-status ${goalViews >= goalViewsTarget ? 'complete' : 'empty'}`}>{goalViews >= goalViewsTarget && <Check size={14} />}</div>
                <div className="goal-content">
                  <span className="goal-title">Reach {goalViewsTarget.toLocaleString()} profile views</span>
                  <div className="goal-progress-bar"><div style={{width: `${goalViewsPct}%`}}></div></div>
                </div>
                <span className="goal-xp">+175 XP</span>
              </div>
            </div>
          </div>

          {/* Business Badges */}
          <div className="premium-section badges-section">
            <div className="section-header-premium">
              <h2>Business Badges</h2>
              <span className="badge-progress">{earnedBadgeCount} / {badges.length} earned</span>
            </div>

            <div className="badges-showcase">
              {badges.map((badge, i) => (
                <div key={i} className={`badge-item ${badge.earned ? 'earned' : 'locked'}`}>
                  <div className="badge-icon"><badge.icon size={18} /></div>
                  <span>{badge.name}</span>
                </div>
              ))}
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
                <p>Post your first <strong>event, class, or deal</strong> to start attracting customers on Pulse.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="insight-btn" onClick={() => { openSubmissionModal(); selectSubmissionType('event'); }}>Create Event</button>
                  <button className="insight-btn" onClick={() => { openSubmissionModal(); selectSubmissionType('deal'); }}>Create Deal</button>
                </div>
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
                    <span className="tip-score-val">{engagementScore}</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Engagement</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: `${engagementScore}%`, background: 'linear-gradient(90deg, #10b981, #34d399)'}}></div>
                </div>
                <p className="tip-description">How often customers interact with your listings</p>
                <div className="tip-actions">
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Post events weekly</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
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
                    <span className="tip-score-val">{responseScore}</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Response Rate</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: `${responseScore}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'}}></div>
                </div>
                <p className="tip-description">How quickly you respond to reviews & messages</p>
                <div className="tip-actions">
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Reply within 24 hrs</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Respond to reviews</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Enable notifications (+3 pts)</span>
                  </div>
                </div>
              </div>

              <div className="score-tip-card">
                <div className="tip-header">
                  <div className="tip-score">
                    <span className="tip-score-val">{qualityScore}</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Content Quality</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: `${qualityScore}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'}}></div>
                </div>
                <p className="tip-description">Completeness & quality of your profile & events</p>
                <div className="tip-actions">
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Add business hours (+8 pts)</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
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
                    <span className="tip-score-val">{profileScore}</span>
                    <span className="tip-score-max">/100</span>
                  </div>
                  <span className="tip-label">Customer Satisfaction</span>
                </div>
                <div className="tip-progress">
                  <div className="tip-progress-fill" style={{width: `${profileScore}%`, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'}}></div>
                </div>
                <p className="tip-description">Based on ratings, reviews & repeat customers</p>
                <div className="tip-actions">
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Get your first review</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Build repeat customers</span>
                  </div>
                  <div className="tip-action pending">
                    <Plus size={14} />
                    <span>Respond to inquiries</span>
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
              {topItems.length > 0 ? topItems.map((item, i) => (
                <div key={item.id || i} className="top-class-card">
                  <div className="class-card-header">
                    <div className="class-rank-badge">#{i + 1}</div>
                    <div className="class-title-section">
                      <h3>{item.title}</h3>
                      <span className="class-type-badge">{item.eventType === 'class' ? 'Class' : 'Event'}</span>
                    </div>
                  </div>
                  <div className="class-card-stats">
                    <div className="class-stat-item">
                      <div className="stat-icon views-icon">
                        <Eye size={16} />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">{(item.viewCount || 0).toLocaleString()}</div>
                        <div className="stat-label">Views</div>
                      </div>
                    </div>
                    <div className="class-stat-divider"></div>
                    <div className="class-stat-item">
                      <div className="stat-icon bookings-icon">
                        <Heart size={16} />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">{item.saveCount || 0}</div>
                        <div className="stat-label">Saves</div>
                      </div>
                    </div>
                    <div className="class-stat-divider"></div>
                    <div className="class-stat-item">
                      <div className="stat-icon revenue-icon">
                        <Calendar size={16} />
                      </div>
                      <div className="stat-content">
                        <div className="stat-value">{item.start ? new Date(item.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</div>
                        <div className="stat-label">Date</div>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '14px' }}>
                  <Calendar size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Add events or classes to see your top performers</p>
                </div>
              )}
            </div>
          </div>

          {/* Your Listings Management */}
          <div className="premium-section">
            <div className="section-header-premium">
              <h2>Your Active Listings</h2>
              <div className="section-actions">
                <button className="btn-primary-gradient" onClick={() => openSubmissionModal()}><Plus size={18} /> Add New</button>
              </div>
            </div>

            {(() => {
              const businessEvents = activeBusiness ? dbEvents.filter(e => e.venueId === activeBusiness.id || (e.venueName && activeBusiness.name && e.venueName.toLowerCase() === activeBusiness.name.toLowerCase())).slice(0, 20) : [];
              const businessDeals = activeBusiness && dbDeals ? dbDeals.filter(d => d.venueName && activeBusiness.name && d.venueName.toLowerCase() === activeBusiness.name.toLowerCase()).slice(0, 10) : [];
              const businessListings = [
                ...businessEvents.map(e => ({ ...e, _type: e.eventType === 'class' ? 'Class' : 'Event', _source: 'event' })),
                ...businessDeals.map(d => ({ ...d, _type: 'Deal', _source: 'deal' })),
              ];
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
                        <tr key={`${listing._source}-${listing.id}`} className="listing-row">
                          <td>
                            <div className="listing-name-cell">
                              <span className="listing-name">{listing.title}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`type-badge ${listing._source === 'deal' ? 'deal' : listing.eventType}`}>{listing._type}</span>
                          </td>
                          <td>
                            <span className="status-badge active">
                              <span className="status-dot"></span>
                              Active
                            </span>
                          </td>
                          <td><span className="metric-cell">{listing._source === 'deal' ? (listing.validUntil ? new Date(listing.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Ongoing') : (listing.start ? new Date(listing.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')}</span></td>
                          <td><span className="metric-cell">{listing._source === 'deal' ? (listing.discount || '—') : (listing.start ? new Date(listing.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—')}</span></td>
                          <td>
                            <div className="actions-cell">
                              {listing._source === 'event' && (
                                <button className="action-btn-sm" title="Edit" onClick={() => {
                                  setEditingEvent(listing);
                                  const s = listing.start ? (listing.start instanceof Date ? listing.start : new Date(listing.start)) : null;
                                  const e = listing.end ? (listing.end instanceof Date ? listing.end : new Date(listing.end)) : null;
                                  const sValid = s && !isNaN(s.getTime());
                                  const eValid = e && !isNaN(e.getTime());
                                  setEditEventForm({ title: listing.title || '', description: listing.description || '', date: sValid ? `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-${String(s.getDate()).padStart(2,'0')}` : '', startTime: sValid ? `${String(s.getHours()).padStart(2,'0')}:${String(s.getMinutes()).padStart(2,'0')}` : '', endTime: eValid ? `${String(e.getHours()).padStart(2,'0')}:${String(e.getMinutes()).padStart(2,'0')}` : '', price: listing.price || '', category: listing.category || '' });
                                  setShowEditEventModal(true);
                                }}><Edit2 size={14} /></button>
                              )}
                              <button className="action-btn-sm danger" title="Delete" onClick={async () => {
                                if (confirm(`Delete "${listing.title}"?`)) {
                                  try {
                                    const table = listing._source === 'deal' ? 'deals' : 'events';
                                    const { error } = await supabase.from(table).delete().eq('id', listing.id);
                                    if (error) throw error;
                                    showToast(`"${listing.title}" deleted`, 'success');
                                    if (listing._source === 'deal') {
                                      setDealsRefreshKey(k => k + 1);
                                    } else {
                                      setEventsRefreshKey(k => k + 1);
                                    }
                                  } catch (err) {
                                    console.error('Error deleting listing:', err);
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
                  <p style={{ margin: 0, fontSize: '14px' }}>No active listings yet. Add an event, class, or deal to get started.</p>
                </div>
              );
            })()}
          </div>

          {/* Audience Insights */}
          <div className="premium-section audience-section">
            <div className="section-header-premium">
              <h2>👥 Audience Overview</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px' }}>
              <div style={{ textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{totalViews.toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Total Views</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: '#eff6ff', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>{(businessAnalytics?.totals?.total_saves || 0).toLocaleString()}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Total Saves</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: '#fef3c7', borderRadius: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>{totalListingsCount}</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Active Listings</div>
              </div>
            </div>
          </div>

          {/* Business Inbox Section */}
          <div className="premium-section inbox-section">
            <div className="section-header-premium">
              <h2>📬 Inbox</h2>
              <div className="inbox-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={businessInboxTab === 'bookings'}
                  className={`inbox-tab ${businessInboxTab === 'bookings' ? 'active' : ''}`}
                  onClick={() => {
                    setBusinessInboxTab('bookings');
                    fetchBusinessInbox(activeBusiness?.id, 'booking');
                  }}
                >
                  Booking Requests
                  {(inboxUnreadCounts?.bookings || 0) > 0 && (
                    <span className="inbox-badge">{inboxUnreadCounts.bookings}</span>
                  )}
                </button>
                <button
                  role="tab"
                  aria-selected={businessInboxTab === 'messages'}
                  className={`inbox-tab ${businessInboxTab === 'messages' ? 'active' : ''}`}
                  onClick={() => {
                    setBusinessInboxTab('messages');
                    fetchBusinessInbox(activeBusiness?.id, 'general');
                  }}
                >
                  Messages
                  {(inboxUnreadCounts?.messages || 0) > 0 && (
                    <span className="inbox-badge">{inboxUnreadCounts.messages}</span>
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
                      onKeyDown={(e) => e.key === 'Enter' && businessReplyInput.trim() && !sendingBusinessReply && sendBusinessReply()}
                    />
                    <button
                      className="send-reply-btn"
                      onClick={sendBusinessReply}
                      disabled={!businessReplyInput.trim() || sendingBusinessReply}
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
              <button className="qa-btn primary" onClick={() => { openSubmissionModal(); selectSubmissionType('event'); }}>
                <Plus size={20} />
                <span>New Event</span>
              </button>
              <button className="qa-btn" onClick={() => { openSubmissionModal(); selectSubmissionType('class'); }}>
                <Sparkles size={20} />
                <span>New Class</span>
              </button>
              <button className="qa-btn" onClick={() => { openSubmissionModal(); selectSubmissionType('deal'); }}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => {
                  const data = `Pulse Business Report - ${activeBusiness?.name || 'Business'}\nGenerated: ${new Date().toLocaleDateString()}\n\nPulse Score: ${pulseScore}/100\n  Profile: ${profileScore}%\n  Engagement: ${engagementScore}%\n  Response: ${responseScore > 0 ? responseScore + '%' : 'N/A'}\n  Quality: ${qualityScore}%\n\nAnalytics (${analyticsPeriod === 9999 ? 'All Time' : `Last ${analyticsPeriod} Days`})\n  Profile Views: ${businessAnalytics?.totals?.profile_views || 0}\n  Class Views: ${businessAnalytics?.totals?.class_views || 0}\n  Event Views: ${businessAnalytics?.totals?.event_views || 0}\n  Booking Clicks: ${businessAnalytics?.totals?.booking_clicks || 0}\n  Total Saves: ${businessAnalytics?.totals?.total_saves || 0}\n\nContent\n  Active Listings: ${businessListingsAll.length}\n  Badges Earned: ${earnedBadgeCount}/${badges.length}\n\nTop Performing\n${topItems.map((e, i) => `  ${i+1}. ${e.title} (${e.viewCount || 0} views)`).join('\n')}`;
                  const blob = new Blob([data], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `pulse-report-${new Date().toISOString().slice(0,10)}.txt`; a.click();
                  URL.revokeObjectURL(url);
                  showToast('Report downloaded', 'success');
                }}>
                  <Download size={14} style={{ marginRight: '4px' }} />
                  TXT
                </button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => {
                  const rows = [
                    ['Metric', 'Value'],
                    ['Business', activeBusiness?.name || ''],
                    ['Date', new Date().toLocaleDateString()],
                    ['Pulse Score', pulseScore],
                    ['Profile Score', profileScore + '%'],
                    ['Engagement Score', engagementScore + '%'],
                    ['Response Score', responseScore > 0 ? responseScore + '%' : 'N/A'],
                    ['Quality Score', qualityScore + '%'],
                    ['Profile Views', businessAnalytics?.totals?.profile_views || 0],
                    ['Class Views', businessAnalytics?.totals?.class_views || 0],
                    ['Event Views', businessAnalytics?.totals?.event_views || 0],
                    ['Booking Clicks', businessAnalytics?.totals?.booking_clicks || 0],
                    ['Total Saves', businessAnalytics?.totals?.total_saves || 0],
                    ['Active Listings', businessListingsAll.length],
                    ['Badges Earned', `${earnedBadgeCount}/${badges.length}`],
                    [],
                    ['Top Performing', 'Views'],
                    ...topItems.map(e => [e.title, e.viewCount || 0]),
                  ];
                  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `pulse-analytics-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                  URL.revokeObjectURL(url);
                  showToast('CSV exported', 'success');
                }}>
                  <Download size={14} style={{ marginRight: '4px' }} />
                  CSV
                </button>
              </div>
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
