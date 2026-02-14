import React, { memo, useRef, useState } from 'react';
import {
  AlertCircle, Calendar, Check, CheckCircle, Clock, DollarSign,
  Edit2, Eye, FileText, Plus, Search, ShieldCheck, SlidersHorizontal, Trash2, User, XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPacificDateStr } from '../utils/timezoneHelpers';

// Content Review sub-component for verifying events, classes & deals
function ContentReviewSection({ unverifiedContent, handleVerifyContent, handleRemoveContent, handleBulkVerifyContent, onEditEvent, onPreviewEvent }) {
  const [reviewTab, setReviewTab] = useState('events');
  const events = unverifiedContent?.events || [];
  const deals = unverifiedContent?.deals || [];
  const classes = events.filter(e => e.event_type === 'class');
  const nonClassEvents = events.filter(e => e.event_type !== 'class');
  const totalUnverified = events.length + deals.length;

  if (totalUnverified === 0) return null;

  const tabs = [
    { key: 'classes', label: 'Classes', count: classes.length },
    { key: 'events', label: 'Events', count: nonClassEvents.length },
    { key: 'deals', label: 'Deals', count: deals.length },
  ];
  const activeItems = reviewTab === 'classes' ? classes : reviewTab === 'events' ? nonClassEvents : deals;
  const activeType = reviewTab === 'deals' ? 'deal' : 'event';

  return (
    <div className="premium-section">
      <div className="section-header-premium">
        <div>
          <h2>Content Review</h2>
          <p className="section-subtitle">{totalUnverified} item{totalUnverified !== 1 ? 's' : ''} awaiting verification</p>
        </div>
        {activeItems.length > 0 && (
          <div className="section-actions">
            <button
              className="btn-primary-gradient"
              onClick={() => handleBulkVerifyContent(activeType, activeItems.map(i => i.id))}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <CheckCircle size={16} /> Verify All {tabs.find(t => t.key === reviewTab)?.label} ({activeItems.length})
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f3f4f6', borderRadius: '10px', padding: '4px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setReviewTab(tab.key)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px', transition: 'all 0.15s',
              background: reviewTab === tab.key ? '#fff' : 'transparent',
              color: reviewTab === tab.key ? '#111827' : '#6b7280',
              boxShadow: reviewTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.label} <span style={{
              background: reviewTab === tab.key ? '#3b82f6' : '#d1d5db',
              color: reviewTab === tab.key ? '#fff' : '#6b7280',
              padding: '1px 7px', borderRadius: '10px', fontSize: '11px', marginLeft: '4px'
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Items list */}
      {activeItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '14px' }}>
          <CheckCircle size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
          All {tabs.find(t => t.key === reviewTab)?.label.toLowerCase()} verified
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
          {activeItems.map(item => (
            <div key={item.id} style={{
              background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{item.venue_name || item.business_name}</span>
                  {item.start_date && <span>· {item.start_date}</span>}
                  {item.start_time && <span>{String(item.start_time).slice(0, 5)}</span>}
                  {item.schedule && <span>· {item.schedule}</span>}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {item.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                        background: tag === 'auto-scraped' ? '#fef3c7' : tag.includes('verified') ? '#d1fae5' : '#f3f4f6',
                        color: tag === 'auto-scraped' ? '#92400e' : tag.includes('verified') ? '#065f46' : '#6b7280',
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {activeType === 'event' && onPreviewEvent && (
                  <button
                    onClick={() => onPreviewEvent(item)}
                    title="Preview"
                    style={{
                      width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer',
                      background: '#fff', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Eye size={16} />
                  </button>
                )}
                {activeType === 'event' && onEditEvent && (
                  <button
                    onClick={() => onEditEvent(item)}
                    title="Edit"
                    style={{
                      width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer',
                      background: '#fff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleVerifyContent(activeType, item.id)}
                  title="Verify"
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Check size={18} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => handleRemoveContent(activeType, item.id, item.title)}
                  title="Remove"
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #fecaca', cursor: 'pointer',
                    background: '#fff', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const AdminDashboard = memo(function AdminDashboard({
  user,
  services,
  impersonateSearchQuery,
  setImpersonateSearchQuery,
  adminVerifiedCount,
  adminClaimedCount,
  dbEvents,
  dbDeals,
  REAL_DATA,
  adminSearchQuery,
  setAdminSearchQuery,
  adminCategoryFilter,
  setAdminCategoryFilter,
  adminStatusFilter,
  setAdminStatusFilter,
  editingVenue,
  setEditingVenue,
  setEditVenueForm,
  setShowEditVenueModal,
  quickAddForm,
  setQuickAddForm,
  enterImpersonation,
  showToast,
  fetchServices,
  setView,
  pendingClaims,
  handleClaimAction,
  unverifiedContent,
  handleVerifyContent,
  handleRemoveContent,
  handleBulkVerifyContent,
  setEditingEvent,
  setEditEventForm,
  setShowEditEventModal,
  setSelectedEvent,
}) {
  const venueCardRefs = useRef({});
  return (
    <div className="admin-view-premium">
      {/* Check if user is authenticated and admin */}
      {!user.isAdmin ? (
        <div className="no-business-view">
          <div className="no-biz-content">
            <div className="no-biz-icon">
              <AlertCircle size={64} />
            </div>
            <h2>Access Restricted</h2>
            <p>You need admin privileges to access this dashboard.</p>
            <button className="claim-biz-btn-large" onClick={() => setView('consumer')}>
              Go Back
            </button>
          </div>
        </div>
      ) : (
        <>
      {/* Premium Admin Header */}
      <div className="admin-header-premium">
        <div className="admin-header-content">
          <div>
            <h1>Admin Dashboard</h1>
            <p className="admin-subtitle">System Overview & Management</p>
          </div>
          <div className="admin-header-actions">
            <div className="admin-impersonate-search" style={{ position: 'relative' }}>
              <div className="search-box-admin">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="View as business..."
                  value={impersonateSearchQuery}
                  onChange={(e) => setImpersonateSearchQuery(e.target.value)}
                />
              </div>
              {impersonateSearchQuery.length > 1 && (
                <div className="admin-search-dropdown">
                  {services
                    .filter(s => s.name?.toLowerCase().includes(impersonateSearchQuery.toLowerCase()))
                    .slice(0, 8)
                    .map(venue => (
                      <div key={venue.id} className="admin-search-result" onClick={() => enterImpersonation(venue)}>
                        <div className="admin-search-avatar">{venue.name?.charAt(0) || '?'}</div>
                        <div className="admin-search-info">
                          <div className="admin-search-name">{venue.name}</div>
                          <div className="admin-search-meta">{venue.category}</div>
                        </div>
                        <Eye size={14} style={{ color: '#9ca3af' }} />
                      </div>
                    ))
                  }
                  {services.filter(s => s.name?.toLowerCase().includes(impersonateSearchQuery.toLowerCase())).length === 0 && (
                    <div className="admin-search-empty">No businesses found</div>
                  )}
                </div>
              )}
            </div>
            <button className="btn-secondary" disabled style={{opacity: 0.5, cursor: 'not-allowed'}}><SlidersHorizontal size={18} /> Settings <span style={{fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px'}}>Soon</span></button>
          </div>
        </div>
      </div>

      {/* System Stats */}
      <div className="admin-stats-premium">
        <div className="admin-stat-box success">
          <div className="stat-icon-wrapper success">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{services.length}</div>
            <div className="stat-label">Total Venues</div>
            <div className="stat-change">{adminVerifiedCount} verified businesses</div>
          </div>
        </div>

        <div className="admin-stat-box info">
          <div className="stat-icon-wrapper info">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{Math.round((REAL_DATA.events.length + dbEvents.length) / 7)}</div>
            <div className="stat-label">Weekly Classes</div>
            <div className="stat-change">{REAL_DATA.events.length + dbEvents.length} total instances</div>
          </div>
        </div>

        <div className="admin-stat-box warning">
          <div className="stat-icon-wrapper warning">
            <AlertCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{services.length - adminClaimedCount}</div>
            <div className="stat-label">Unclaimed Venues</div>
            <div className="stat-change">{adminClaimedCount} claimed of {services.length}</div>
          </div>
        </div>

        <div className="admin-stat-box primary">
          <div className="stat-icon-wrapper primary">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{REAL_DATA.deals.length + dbDeals.length}</div>
            <div className="stat-label">Active Deals</div>
            <div className="stat-change">{dbDeals.length} from verified owners</div>
          </div>
        </div>
      </div>

      {/* Pending Business Claims */}
      {pendingClaims && pendingClaims.length > 0 && (
      <div className="premium-section">
        <div className="section-header-premium">
          <div>
            <h2>Pending Business Claims</h2>
            <p className="section-subtitle">{pendingClaims.length} claim{pendingClaims.length !== 1 ? 's' : ''} awaiting review</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pendingClaims.map(claim => {
            const matchedBiz = services.find(s => s.id === claim.business_id);
            return (
              <div key={claim.id} style={{
                background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
                padding: '16px', display: 'flex', alignItems: 'center', gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: '18px', flexShrink: 0
                }}>
                  {(claim.owner_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: '#111827' }}>
                    {matchedBiz?.name || claim.business_name || 'Unknown Business'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                    <span style={{ fontWeight: 500 }}>{claim.owner_name || 'No name'}</span>
                    {claim.contact_email && <span> · {claim.contact_email}</span>}
                    {claim.owner_role && <span> · {claim.owner_role}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{new Date(claim.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    {claim.verification_method && (
                      <span style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>
                        {claim.verification_method === 'document' ? '📎 Documents' : '✉️ Email verified'}
                      </span>
                    )}
                    {claim.documents && claim.documents.length > 0 && (
                      <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <FileText size={10} /> {claim.documents.length} file{claim.documents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{
                      background: claim.status === 'pending' ? '#fef3c7' : '#fce7f3',
                      color: claim.status === 'pending' ? '#92400e' : '#9d174d',
                      padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500
                    }}>
                      {claim.status === 'pending_verification' ? 'Awaiting verification' : 'Pending review'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {claim.status === 'pending_verification' ? (
                    <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', padding: '8px 0' }}>Waiting for email verification</span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleClaimAction(claim.id, 'approve')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
                          fontWeight: 600, fontSize: '13px'
                        }}
                      >
                        <ShieldCheck size={15} /> Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Rejection reason (optional):');
                          if (reason !== null) handleClaimAction(claim.id, 'reject', reason);
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb',
                          cursor: 'pointer', background: '#fff', color: '#ef4444',
                          fontWeight: 600, fontSize: '13px'
                        }}
                      >
                        <XCircle size={15} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Content Review — Events, Classes & Deals */}
      <ContentReviewSection
        unverifiedContent={unverifiedContent}
        handleVerifyContent={handleVerifyContent}
        handleRemoveContent={handleRemoveContent}
        handleBulkVerifyContent={handleBulkVerifyContent}
        onEditEvent={setEditingEvent && setEditEventForm && setShowEditEventModal ? (item) => {
          setEditingEvent(item);
          setEditEventForm({
            title: item.title || '',
            description: item.description || '',
            start_date: item.start_date || '',
            start_time: item.start_time ? String(item.start_time).slice(0, 5) : '',
            end_time: item.end_time ? String(item.end_time).slice(0, 5) : '',
            venue_name: item.venue_name || '',
            category: item.category || '',
            price: item.price || '',
            age_group: item.age_group || '',
          });
          setShowEditEventModal(true);
        } : undefined}
        onPreviewEvent={setSelectedEvent ? (item) => {
          // Convert DB item to the format expected by event detail modal
          const evt = dbEvents.find(e => e.id === item.id);
          if (evt) setSelectedEvent(evt);
        } : undefined}
      />

      {/* Scraping System Status */}
      {(() => {
        const scrapedEvents = dbEvents.filter(e => e.tags && e.tags.includes('auto-scraped'));
        const scrapedClasses = scrapedEvents.filter(e => e.eventType === 'class');
        const scrapedNonClass = scrapedEvents.filter(e => e.eventType !== 'class');
        const uniqueVenues = new Set(scrapedEvents.map(e => e.venueName).filter(Boolean)).size;
        // Cron schedule: events 6AM UTC daily, classes 6:30AM, businesses Monday 7AM
        const now = new Date();
        const nextRun = new Date(now);
        nextRun.setUTCHours(6, 0, 0, 0);
        if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
        const hoursUntil = Math.round((nextRun - now) / (1000 * 60 * 60));

        return (
          <div className="premium-section">
            <div className="section-header-premium">
              <div>
                <h2>🤖 Web Scraping System</h2>
                <p className="section-subtitle">Automated data collection via pg_cron</p>
              </div>
            </div>
            <div className="scraping-dashboard">
              <div className="scrape-overview-cards">
                <div className="scrape-card success-card">
                  <div className="scrape-card-header">
                    <Clock size={20} />
                    <span>Next Scheduled Run</span>
                  </div>
                  <div className="scrape-card-value">{hoursUntil}h</div>
                  <div className="scrape-card-footer">
                    <span>Daily at 10 PM PST</span>
                  </div>
                </div>

                <div className="scrape-card info-card">
                  <div className="scrape-card-header">
                    <Calendar size={20} />
                    <span>Scraped Classes</span>
                  </div>
                  <div className="scrape-card-value">{scrapedClasses.length.toLocaleString()}</div>
                  <div className="scrape-card-footer">
                    <span>Active in database</span>
                  </div>
                </div>

                <div className="scrape-card success-card">
                  <div className="scrape-card-header">
                    <CheckCircle size={20} />
                    <span>Scraped Events</span>
                  </div>
                  <div className="scrape-card-value">{scrapedNonClass.length.toLocaleString()}</div>
                  <div className="scrape-card-footer">
                    <span>Active in database</span>
                  </div>
                </div>

                <div className="scrape-card info-card">
                  <div className="scrape-card-header">
                    <Eye size={20} />
                    <span>Venues Covered</span>
                  </div>
                  <div className="scrape-card-value">{uniqueVenues}</div>
                  <div className="scrape-card-footer">
                    <span>Unique sources</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                <span style={{ background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px', color: '#16a34a' }}>Events: daily 6 AM UTC</span>
                <span style={{ background: '#eff6ff', padding: '4px 8px', borderRadius: '6px', color: '#2563eb' }}>Classes: daily 6:30 AM UTC</span>
                <span style={{ background: '#fef3c7', padding: '4px 8px', borderRadius: '6px', color: '#d97706' }}>Businesses: Mon 7 AM UTC</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Venue Management */}
      <div className="premium-section">
        <div className="section-header-premium">
          <h2>Venue Management</h2>
          <div className="admin-search-filters">
            <div className="search-box-admin">
              <Search size={18} />
              <input type="text" placeholder="Search venues..." value={adminSearchQuery} onChange={(e) => setAdminSearchQuery(e.target.value)} />
            </div>
            <select className="filter-select-admin" value={adminCategoryFilter} onChange={(e) => setAdminCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {[...new Set(services.map(s => s.category).filter(Boolean))].sort().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select className="filter-select-admin" value={adminStatusFilter} onChange={(e) => setAdminStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="has_classes">Has Classes</option>
              <option value="no_classes">No Classes</option>
              <option value="has_website">Has Website</option>
              <option value="no_website">No Website</option>
            </select>
          </div>
        </div>

        <div className="venues-grid-admin">
          {services
            .filter(s => !adminSearchQuery || s.name?.toLowerCase().includes(adminSearchQuery.toLowerCase()) || (s.category && s.category.toLowerCase().includes(adminSearchQuery.toLowerCase())))
            .filter(s => !adminCategoryFilter || s.category === adminCategoryFilter)
            .filter(s => {
              if (!adminStatusFilter) return true;
              const classCount = dbEvents.filter(e => e.venueId === s.id).length;
              if (adminStatusFilter === 'has_classes') return classCount > 0;
              if (adminStatusFilter === 'no_classes') return classCount === 0;
              if (adminStatusFilter === 'has_website') return !!s.website;
              if (adminStatusFilter === 'no_website') return !s.website;
              return true;
            })
            .slice(0, (adminSearchQuery || adminCategoryFilter || adminStatusFilter) ? 100 : 50).map((venue, idx) => {
            const classCount = dbEvents.filter(e => e.venueId === venue.id).length;
            return (
              <div key={venue.id} className="venue-card-admin" ref={(el) => venueCardRefs.current[idx] = el}>
                <div className="venue-card-header">
                  <div className="venue-avatar-admin">
                    {venue.name?.charAt(0) || '?'}
                  </div>
                  <div className="venue-status-indicators">
                    {venue.verified && (
                      <span className="indicator-badge verified">
                        <Check size={10} />
                      </span>
                    )}
                  </div>
                </div>
                <div className="venue-card-content">
                  <h3>{venue.name}</h3>
                  <p className="venue-address">{venue.address}</p>
                  <div className="venue-meta-row">
                    <span className="meta-badge">{venue.category}</span>
                    <span className="meta-text">{classCount} classes</span>
                  </div>
                </div>
                {/* Stats will be populated from real analytics data */}
                <div className="venue-card-actions">
                  <button className="action-btn-mini" onClick={() => {
                    setEditingVenue(venue);
                    setEditVenueForm({
                      name: venue.name || '',
                      address: venue.address || '',
                      phone: venue.phone || '',
                      website: venue.website || '',
                      email: venue.email || '',
                      category: venue.category || ''
                    });
                    setShowEditVenueModal(true);
                  }}><Edit2 size={14} /></button>
                  <button className="action-btn-mini impersonate" title="View as this business" onClick={() => enterImpersonation(venue)}><Eye size={14} /></button>
                  <button className="action-btn-mini danger" onClick={async () => {
                    if (confirm(`Deactivate ${venue.name}? This will hide it from the directory. It can be reactivated later.`)) {
                      try {
                        const { error } = await supabase
                          .from('businesses')
                          .update({ status: 'inactive' })
                          .eq('id', venue.id);
                        if (error) throw error;
                        showToast(`${venue.name} deleted`, 'success');
                        await fetchServices(true);
                      } catch (err) {
                        console.error('Error deleting:', err);
                        showToast('Failed to delete business', 'error');
                      }
                    }
                  }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Add Section */}
      <div className="premium-section">
        <div className="section-header-premium">
          <h2>Quick Add Class/Event</h2>
        </div>
        <div className="quick-add-premium">
          <div className="form-grid-admin">
            <div className="form-field-admin">
              <label>Class Title</label>
              <input type="text" placeholder="e.g. Hot Yoga Flow" value={quickAddForm.title} onChange={(e) => setQuickAddForm(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="form-field-admin">
              <label>Venue</label>
              <select value={quickAddForm.venueId} onChange={(e) => {
                const venue = services.find(s => s.id === e.target.value);
                setQuickAddForm(prev => ({ ...prev, venueId: e.target.value, venueName: venue?.name || '' }));
              }}>
                <option value="">Select venue...</option>
                {services.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field-admin">
              <label>Start Time</label>
              <input type="time" value={quickAddForm.startTime} onChange={(e) => setQuickAddForm(prev => ({ ...prev, startTime: e.target.value }))} />
            </div>
            <div className="form-field-admin">
              <label>Duration</label>
              <select value={quickAddForm.duration} onChange={(e) => setQuickAddForm(prev => ({ ...prev, duration: e.target.value }))}>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </div>
            <div className="form-field-admin">
              <label>Price</label>
              <input type="text" placeholder="$20" value={quickAddForm.price} onChange={(e) => setQuickAddForm(prev => ({ ...prev, price: e.target.value }))} />
            </div>
            <div className="form-field-admin">
              <label>Recurrence</label>
              <select value={quickAddForm.recurrence} onChange={(e) => setQuickAddForm(prev => ({ ...prev, recurrence: e.target.value }))}>
                <option value="Weekly">Weekly</option>
                <option value="Daily">Daily</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>
          <button className="btn-primary-gradient btn-large-admin" onClick={async () => {
            if (!quickAddForm.title || !quickAddForm.venueId) {
              showToast('Please fill in title and venue', 'error');
              return;
            }
            try {
              const [hours, mins] = (quickAddForm.startTime || '18:00').split(':').map(Number);
              const endMins = (hours || 0) * 60 + (mins || 0) + parseInt(quickAddForm.duration || '60');
              const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

              const { error } = await supabase.from('events').insert({
                title: quickAddForm.title,
                venue_name: quickAddForm.venueName,
                venue_id: quickAddForm.venueId,
                start_date: getPacificDateStr(),
                start_time: quickAddForm.startTime,
                end_time: endTime,
                event_type: 'class',
                price: quickAddForm.price || null,
                recurrence: (quickAddForm.recurrence || 'weekly').toLowerCase(),
                tags: ['admin-added'],
                status: 'active'
              });
              if (error) throw error;
              showToast(`"${quickAddForm.title}" added!`, 'success');
              setQuickAddForm({ title: '', venueId: '', venueName: '', startTime: '18:00', duration: '60', price: '', recurrence: 'Weekly' });
            } catch (err) {
              console.error('Quick add error:', err);
              showToast('Failed to add class', 'error');
            }
          }}>
            <Plus size={20} /> Add Class
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
});

export default AdminDashboard;
