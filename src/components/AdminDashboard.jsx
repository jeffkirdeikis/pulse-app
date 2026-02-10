import React, { memo } from 'react';
import {
  AlertCircle, Calendar, Check, CheckCircle, Clock, DollarSign,
  Edit2, Eye, Plus, Search, SlidersHorizontal, Trash2, XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPacificDateStr } from '../utils/timezoneHelpers';

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
}) {
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
                    .filter(s => s.name.toLowerCase().includes(impersonateSearchQuery.toLowerCase()))
                    .slice(0, 8)
                    .map(venue => (
                      <div key={venue.id} className="admin-search-result" onClick={() => enterImpersonation(venue)}>
                        <div className="admin-search-avatar">{venue.name.charAt(0)}</div>
                        <div className="admin-search-info">
                          <div className="admin-search-name">{venue.name}</div>
                          <div className="admin-search-meta">{venue.category}</div>
                        </div>
                        <Eye size={14} style={{ color: '#9ca3af' }} />
                      </div>
                    ))
                  }
                  {services.filter(s => s.name.toLowerCase().includes(impersonateSearchQuery.toLowerCase())).length === 0 && (
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

      {/* Scraping System Status */}
      <div className="premium-section">
        <div className="section-header-premium">
          <div>
            <h2>🤖 Web Scraping System</h2>
            <p className="section-subtitle">Automated venue data collection</p>
          </div>
          <div className="section-actions">
            <button className="btn-secondary" onClick={() => showToast('Scraping configuration is managed via CLI', 'info')}><SlidersHorizontal size={18} /> Configure</button>
            <button className="btn-primary-gradient" onClick={() => showToast('Run scrapers via CLI: node scripts/scrape-orchestrator.js', 'info')}><Plus size={18} /> Run Scrape Now</button>
          </div>
        </div>

        <div className="scraping-dashboard" style={{ position: 'relative', opacity: 0.6 }}>
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
            Sample Data — Connect scraping system to display real metrics
          </div>
          <div className="scrape-overview-cards">
            <div className="scrape-card success-card">
              <div className="scrape-card-header">
                <Clock size={20} />
                <span>Next Scheduled Run</span>
              </div>
              <div className="scrape-card-value">--</div>
              <div className="scrape-card-footer">
                <span>Not connected</span>
              </div>
            </div>

            <div className="scrape-card info-card">
              <div className="scrape-card-header">
                <Clock size={20} />
                <span>Last Run Duration</span>
              </div>
              <div className="scrape-card-value">--</div>
              <div className="scrape-card-footer">
                <span>Not connected</span>
              </div>
            </div>

            <div className="scrape-card success-card">
              <div className="scrape-card-header">
                <CheckCircle size={20} />
                <span>Changes Detected</span>
              </div>
              <div className="scrape-card-value">--</div>
              <div className="scrape-card-footer">
                <span>Not connected</span>
              </div>
            </div>

            <div className="scrape-card error-card">
              <div className="scrape-card-header">
                <XCircle size={20} />
                <span>Failed Scrapes</span>
              </div>
              <div className="scrape-card-value">--</div>
              <div className="scrape-card-footer">
                <span>Not connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            .filter(s => !adminSearchQuery || s.name.toLowerCase().includes(adminSearchQuery.toLowerCase()) || (s.category && s.category.toLowerCase().includes(adminSearchQuery.toLowerCase())))
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
                    {venue.name.charAt(0)}
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
              const [hours, mins] = quickAddForm.startTime.split(':').map(Number);
              const endMins = hours * 60 + mins + parseInt(quickAddForm.duration);
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
                recurrence: quickAddForm.recurrence.toLowerCase(),
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
