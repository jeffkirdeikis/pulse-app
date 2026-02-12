import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Calendar, Clock, Filter, Heart, Star, MapPin, ExternalLink,
  Bell, BellOff, ChevronRight, ChevronLeft, X, Users, DollarSign,
  Activity, Stethoscope, Sparkles, RefreshCw, Check, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProgressiveImage from './ProgressiveImage';

// Discipline config
const DISCIPLINES = [
  { key: 'all', label: 'All', icon: Sparkles },
  { key: 'massage_therapy', label: 'Massage', icon: Heart },
  { key: 'physiotherapy', label: 'Physio', icon: Activity },
  { key: 'chiropractic', label: 'Chiro', icon: Stethoscope },
  { key: 'acupuncture', label: 'Acupuncture', icon: Sparkles },
];

const TIME_RANGES = [
  { key: 'any', label: 'Any Time' },
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];

const DURATIONS = [
  { key: null, label: 'Any' },
  { key: 30, label: '30 min' },
  { key: 45, label: '45 min' },
  { key: 60, label: '60 min' },
  { key: 90, label: '90 min' },
];

// Generate next 14 days
function getDateRange() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // Use local date components to avoid UTC offset issues
    // toISOString() converts to UTC which shifts the date after 4 PM Pacific
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push({
      date: `${year}-${month}-${day}`,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: i === 0,
    });
  }
  return dates;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function formatPrice(min, max) {
  if (!min && !max) return null;
  const fmtMin = min ? `$${(min / 100).toFixed(0)}` : '';
  const fmtMax = max ? `$${(max / 100).toFixed(0)}` : '';
  if (fmtMin && fmtMax && fmtMin !== fmtMax) return `${fmtMin}–${fmtMax}`;
  return fmtMin || fmtMax;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function WellnessBooking({
  onBack,
  isAuthenticated,
  session,
  showToast,
  setShowAuthModal,
}) {
  // State
  const [selectedDate, setSelectedDate] = useState(getDateRange()[0].date);
  const [discipline, setDiscipline] = useState('all');
  const [timeRange, setTimeRange] = useState('any');
  const [duration, setDuration] = useState(null);
  const [directBillingOnly, setDirectBillingOnly] = useState(false);
  const [viewMode, setViewMode] = useState('timeline'); // timeline | provider
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const [providers, setProviders] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastScrapeTime, setLastScrapeTime] = useState(null);
  const [dateCounts, setDateCounts] = useState({}); // { 'YYYY-MM-DD': count }
  const [initialDateSet, setInitialDateSet] = useState(false);

  // Modals
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertProvider, setAlertProvider] = useState(null);
  const [showBookingWebview, setShowBookingWebview] = useState(null);

  // Alert form
  const [alertDays, setAlertDays] = useState([]);
  const [alertTimeRange, setAlertTimeRange] = useState('any');

  // User alerts
  const [userAlerts, setUserAlerts] = useState([]);

  const dateScrollRef = useRef(null);
  const selectedDateRef = useRef(null);
  const dates = getDateRange();

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    const discParam = discipline === 'all' ? null : discipline;
    const { data, error } = await supabase.rpc('get_wellness_providers', {
      p_discipline: discParam,
      p_date: selectedDate,
    });
    if (!error && data) {
      setProviders(data);
    }
  }, [discipline, selectedDate]);

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    const discParam = discipline === 'all' ? null : discipline;
    const { data, error } = await supabase.rpc('get_wellness_availability', {
      p_date: selectedDate,
      p_discipline: discParam,
      p_duration: duration,
      p_time_range: timeRange,
    });
    if (!error && data) {
      let filtered = data;
      if (directBillingOnly) {
        filtered = data.filter(s => s.direct_billing);
      }
      setSlots(filtered);
    } else {
      setSlots([]);
    }
    setLoading(false);
  }, [selectedDate, discipline, duration, timeRange, directBillingOnly]);

  // Fetch slot counts for all dates in the carousel
  const fetchDateCounts = useCallback(async () => {
    const dateList = dates.map(d => d.date);
    const today = dates[0].date;
    const nowTime = new Date().toTimeString().slice(0, 8); // "HH:MM:SS"

    // Get all available slots for the next 14 days
    let query = supabase
      .from('pulse_availability_slots')
      .select('date, start_time')
      .in('date', dateList)
      .eq('is_available', true);

    const { data, error } = await query;

    if (!error && data) {
      const counts = {};
      data.forEach(row => {
        // Skip past times for today
        if (row.date === today && row.start_time <= nowTime) return;
        counts[row.date] = (counts[row.date] || 0) + 1;
      });
      setDateCounts(counts);

      // Auto-select first available date if today has no slots (only on initial load)
      if (!initialDateSet) {
        setInitialDateSet(true);
        const today = dates[0].date;
        if (!counts[today] && Object.keys(counts).length > 0) {
          const firstAvailable = dateList.find(d => counts[d] > 0);
          if (firstAvailable) {
            setSelectedDate(firstAvailable);
          }
        }
      }
    }
  }, [initialDateSet]);

  // Fetch last scrape time
  const fetchLastScrape = useCallback(async () => {
    const { data } = await supabase
      .from('pulse_scrape_log')
      .select('created_at')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]) {
      setLastScrapeTime(new Date(data[0].created_at));
    }
  }, []);

  // Fetch user alerts
  const fetchUserAlerts = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('pulse_availability_alerts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true);
    if (data) setUserAlerts(data);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProviders();
    fetchAvailability();
    fetchLastScrape();
    fetchDateCounts();
  }, [fetchProviders, fetchAvailability, fetchLastScrape, fetchDateCounts]);

  // Scroll date carousel to selected date
  useEffect(() => {
    if (selectedDateRef.current && dateScrollRef.current) {
      const container = dateScrollRef.current;
      const el = selectedDateRef.current;
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchUserAlerts();
  }, [fetchUserAlerts]);

  // Handle booking click
  const handleBookingClick = async (provider, slot = null) => {
    // Prefer slot-level booking URL (direct to practitioner/treatment page)
    // Fall back to provider booking URL, then generic JaneApp page
    const url = slot?.booking_url || provider.booking_url || `https://${provider.janeapp_slug}.janeapp.com`;

    if (isAuthenticated && session?.user?.id) {
      // Log click and award XP
      const { data } = await supabase.rpc('log_booking_click', {
        p_user_id: session.user.id,
        p_provider_id: provider.provider_id || provider.id,
        p_slot_id: slot?.slot_id || null,
        p_booking_url: url,
      });

      if (data?.xp?.xp_earned) {
        const bonusText = data.same_day_bonus ? ' (+25 same-day bonus!)' : '';
        showToast?.(`+${data.xp.xp_earned} XP for booking through Pulse${bonusText}`);
      }
    }

    // Open in new tab (JaneApp blocks iframe embedding)
    window.open(url, '_blank', 'noopener,noreferrer');
    setSelectedSlot(null);
  };

  // Save alert
  const handleSaveAlert = async () => {
    if (!isAuthenticated) {
      setShowAuthModal?.(true);
      return;
    }

    const { error } = await supabase.rpc('upsert_availability_alert', {
      p_user_id: session.user.id,
      p_provider_id: alertProvider?.id || null,
      p_discipline: discipline === 'all' ? null : discipline,
      p_preferred_days: alertDays,
      p_preferred_time_range: alertTimeRange,
    });

    if (!error) {
      showToast?.('Alert saved! We\'ll notify you when matching slots appear.');
      setShowAlertModal(false);
      fetchUserAlerts();
    }
  };

  const hasAlertForProvider = (providerId) => {
    return userAlerts.some(a => a.provider_id === providerId);
  };

  // Group slots by time for timeline view
  const groupSlotsByTime = () => {
    const groups = {};
    slots.forEach(slot => {
      const key = slot.start_time;
      if (!groups[key]) groups[key] = [];
      groups[key].push(slot);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  };

  // Group slots by provider for provider view
  const groupSlotsByProvider = () => {
    const groups = {};
    slots.forEach(slot => {
      const key = slot.provider_id;
      if (!groups[key]) {
        groups[key] = { provider: slot, slots: [] };
      }
      groups[key].slots.push(slot);
    });
    return Object.values(groups).sort((a, b) =>
      a.provider.clinic_name.localeCompare(b.provider.clinic_name)
    );
  };

  // Count slots per date (for date carousel badges)
  // We only know the count for selected date from current fetch
  // For now show count only on selected date

  return (
    <div className="wellness-booking">
      {/* Discipline Tabs */}
      <div className="wb-discipline-tabs">
        {DISCIPLINES.map(d => {
          const Icon = d.icon;
          return (
            <button
              key={d.key}
              className={`wb-discipline-tab ${discipline === d.key ? 'active' : ''}`}
              onClick={() => { setDiscipline(d.key); setSelectedSlot(null); }}
            >
              <Icon size={16} />
              <span>{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Date Carousel */}
      <div className="wb-date-carousel" ref={dateScrollRef}>
        {dates.map(d => {
          const count = dateCounts[d.date] || 0;
          const isSelected = selectedDate === d.date;
          return (
            <button
              key={d.date}
              ref={isSelected ? selectedDateRef : null}
              className={`wb-date-item ${isSelected ? 'active' : ''} ${d.isToday ? 'today' : ''} ${count > 0 && !isSelected ? 'has-slots' : ''}`}
              onClick={() => { setSelectedDate(d.date); setSelectedSlot(null); }}
            >
              <span className="wb-date-day">{d.dayName}</span>
              <span className="wb-date-num">{d.dayNum}</span>
              {count > 0 && (
                <span className="wb-date-badge">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters Row */}
      <div className="wb-filter-bar">
        <button
          className={`wb-filter-toggle ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          <span>Filters</span>
          {(timeRange !== 'any' || duration || directBillingOnly) && (
            <span className="wb-filter-count">
              {[timeRange !== 'any', !!duration, directBillingOnly].filter(Boolean).length}
            </span>
          )}
        </button>

        <div className="wb-view-toggle">
          <button
            className={`wb-view-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            <Clock size={14} />
            <span>Timeline</span>
          </button>
          <button
            className={`wb-view-btn ${viewMode === 'provider' ? 'active' : ''}`}
            onClick={() => setViewMode('provider')}
          >
            <Users size={14} />
            <span>Provider</span>
          </button>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="wb-filters-expanded">
          <div className="wb-filter-section">
            <label className="wb-filter-label">Time of Day</label>
            <div className="wb-filter-pills">
              {TIME_RANGES.map(t => (
                <button
                  key={t.key}
                  className={`wb-pill ${timeRange === t.key ? 'active' : ''}`}
                  onClick={() => setTimeRange(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="wb-filter-section">
            <label className="wb-filter-label">Duration</label>
            <div className="wb-filter-pills">
              {DURATIONS.map(d => (
                <button
                  key={d.key ?? 'any'}
                  className={`wb-pill ${duration === d.key ? 'active' : ''}`}
                  onClick={() => setDuration(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="wb-filter-section">
            <label className="wb-filter-label">
              <button
                className={`wb-toggle ${directBillingOnly ? 'active' : ''}`}
                onClick={() => setDirectBillingOnly(!directBillingOnly)}
              >
                <div className="wb-toggle-track">
                  <div className="wb-toggle-thumb" />
                </div>
              </button>
              Direct Billing Only
            </label>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="wb-content">
        {loading ? (
          <SkeletonLoading />
        ) : slots.length === 0 ? (
          <EmptyState
            hasProviders={providers.length > 0}
            selectedDate={selectedDate}
            dateCounts={dateCounts}
            onSelectDate={setSelectedDate}
            onSetAlert={() => {
              if (!isAuthenticated) {
                setShowAuthModal?.(true);
                return;
              }
              setAlertProvider(null);
              setShowAlertModal(true);
            }}
          />
        ) : viewMode === 'timeline' ? (
          <TimelineView
            groups={groupSlotsByTime()}
            onSlotClick={(slot) => setSelectedSlot(slot)}
            onProviderClick={(slot) => setSelectedProvider(slot)}
            userAlerts={userAlerts}
          />
        ) : (
          <ProviderView
            groups={groupSlotsByProvider()}
            onSlotClick={(slot) => setSelectedSlot(slot)}
            onProviderClick={(provider) => setSelectedProvider(provider)}
            onAlertClick={(provider) => {
              if (!isAuthenticated) {
                setShowAuthModal?.(true);
                return;
              }
              setAlertProvider(provider);
              setShowAlertModal(true);
            }}
            userAlerts={userAlerts}
          />
        )}
      </div>

      {/* Booking Bottom Sheet */}
      {selectedSlot && (
        <BookingSheet
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onBook={() => handleBookingClick(selectedSlot, selectedSlot)}
          onViewProfile={() => {
            setSelectedProvider(selectedSlot);
            setSelectedSlot(null);
          }}
        />
      )}

      {/* Provider Detail Modal */}
      {selectedProvider && (
        <ProviderDetailModal
          provider={selectedProvider}
          slots={slots.filter(s => s.provider_id === (selectedProvider.provider_id || selectedProvider.id))}
          onClose={() => setSelectedProvider(null)}
          onSlotClick={(slot) => {
            setSelectedProvider(null);
            setSelectedSlot(slot);
          }}
          onBook={() => handleBookingClick(selectedProvider)}
          hasAlert={hasAlertForProvider(selectedProvider.provider_id || selectedProvider.id)}
          onAlertClick={() => {
            if (!isAuthenticated) {
              setShowAuthModal?.(true);
              return;
            }
            setAlertProvider(selectedProvider);
            setSelectedProvider(null);
            setShowAlertModal(true);
          }}
        />
      )}

      {/* Alert Setup Modal */}
      {showAlertModal && (
        <AlertSetupModal
          provider={alertProvider}
          days={alertDays}
          setDays={setAlertDays}
          timeRange={alertTimeRange}
          setTimeRange={setAlertTimeRange}
          onSave={handleSaveAlert}
          onClose={() => setShowAlertModal(false)}
        />
      )}

      <style>{wellnessBookingStyles}</style>
    </div>
  );
}


// ============================================
// SUB-COMPONENTS
// ============================================

function SkeletonLoading() {
  return (
    <div className="wb-skeleton">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="wb-skeleton-card">
          <div className="wb-skeleton-time" />
          <div className="wb-skeleton-row">
            <div className="wb-skeleton-avatar" />
            <div className="wb-skeleton-text">
              <div className="wb-skeleton-line wide" />
              <div className="wb-skeleton-line narrow" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasProviders, selectedDate, onSetAlert, dateCounts, onSelectDate }) {
  const dateObj = new Date(selectedDate + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Find the next date with availability
  const nextAvailable = dateCounts ? Object.entries(dateCounts)
    .filter(([d, count]) => count > 0 && d > selectedDate)
    .sort(([a], [b]) => a.localeCompare(b))[0] : null;

  if (!hasProviders) {
    return (
      <div className="wb-empty">
        <div className="wb-empty-icon">
          <RefreshCw size={40} />
        </div>
        <h3>Setting Up Availability</h3>
        <p>We're connecting with Squamish wellness providers to bring you real-time booking. Check back soon!</p>
        <div className="wb-empty-progress">
          <div className="wb-empty-progress-bar" />
        </div>
      </div>
    );
  }

  return (
    <div className="wb-empty">
      <div className="wb-empty-icon">
        <Calendar size={40} />
      </div>
      <h3>No Openings for {dateStr}</h3>
      {nextAvailable ? (
        <>
          <p>
            {(() => {
              const nextDate = new Date(nextAvailable[0] + 'T12:00:00');
              const nextStr = nextDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
              return `${nextAvailable[1]} slots available on ${nextStr}`;
            })()}
          </p>
          <button className="wb-empty-jump-btn" onClick={() => onSelectDate(nextAvailable[0])}>
            <Calendar size={16} />
            Jump to Next Available
          </button>
        </>
      ) : (
        <>
          <p>Try adjusting your filters, or set up an alert to get notified when slots open up.</p>
          <button className="wb-empty-alert-btn" onClick={onSetAlert}>
            <Bell size={16} />
            Notify Me When Available
          </button>
        </>
      )}
    </div>
  );
}

function TimelineView({ groups, onSlotClick, onProviderClick }) {
  return (
    <div className="wb-timeline">
      {groups.map(([time, timeSlots]) => (
        <div key={time} className="wb-time-group">
          <div className="wb-time-header">
            <Clock size={14} />
            <span>{formatTime(time)}</span>
            <span className="wb-time-count">{timeSlots.length} available</span>
          </div>
          <div className="wb-time-slots">
            {timeSlots.map(slot => (
              <button
                key={slot.slot_id}
                className="wb-slot-card"
                onClick={() => onSlotClick(slot)}
              >
                <div className="wb-slot-avatar" onClick={(e) => { e.stopPropagation(); onProviderClick(slot); }}>
                  {slot.photo_url ? (
                    <ProgressiveImage src={slot.photo_url} alt={slot.provider_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    <span>{getInitials(slot.provider_name)}</span>
                  )}
                </div>
                <div className="wb-slot-info">
                  <span className="wb-slot-name">{slot.provider_name}</span>
                  <span className="wb-slot-clinic">{slot.clinic_name}</span>
                </div>
                <div className="wb-slot-meta">
                  <span className="wb-slot-duration">{slot.duration_minutes} min</span>
                  {slot.direct_billing && <span className="wb-slot-billing">DB</span>}
                </div>
                <ChevronRight size={16} className="wb-slot-chevron" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProviderView({ groups, onSlotClick, onProviderClick, onAlertClick, userAlerts }) {
  return (
    <div className="wb-providers">
      {groups.map(({ provider, slots: provSlots }) => {
        const hasAlert = userAlerts.some(a => a.provider_id === provider.provider_id);
        const priceStr = formatPrice(provider.price_min, provider.price_max);
        return (
          <div key={provider.provider_id} className="wb-provider-card">
            <div className="wb-provider-header" onClick={() => onProviderClick(provider)}>
              <div className="wb-provider-avatar">
                {provider.photo_url ? (
                  <ProgressiveImage src={provider.photo_url} alt={provider.provider_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                ) : (
                  <span>{getInitials(provider.provider_name)}</span>
                )}
              </div>
              <div className="wb-provider-info">
                <span className="wb-provider-name">{provider.provider_name}</span>
                <span className="wb-provider-clinic">{provider.clinic_name}</span>
                <div className="wb-provider-tags">
                  {provider.direct_billing && <span className="wb-tag billing">Direct Billing</span>}
                  {priceStr && <span className="wb-tag price">{priceStr}</span>}
                  {provider.rating && (
                    <span className="wb-tag rating">
                      <Star size={12} fill="#fbbf24" stroke="#fbbf24" /> {provider.rating}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={`wb-alert-btn ${hasAlert ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onAlertClick(provider); }}
              >
                {hasAlert ? <BellOff size={16} /> : <Bell size={16} />}
              </button>
            </div>
            <div className="wb-provider-slots">
              {provSlots.map(slot => (
                <button
                  key={slot.slot_id}
                  className="wb-time-btn"
                  onClick={() => onSlotClick(slot)}
                >
                  {formatTime(slot.start_time)}
                  <span className="wb-time-dur">{slot.duration_minutes}m</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingSheet({ slot, onClose, onBook, onViewProfile }) {
  const priceStr = formatPrice(slot.price_min, slot.price_max);
  const dateObj = new Date(slot.date + 'T12:00:00');
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      <div className="wb-sheet-backdrop" onClick={onClose} />
      <div className="wb-sheet">
        <div className="wb-sheet-handle" />
        <button className="wb-sheet-close-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="wb-sheet-content">
          <div className="wb-sheet-header">
            <div className="wb-sheet-avatar">
              {slot.photo_url ? (
                <ProgressiveImage src={slot.photo_url} alt={slot.provider_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              ) : (
                <span>{getInitials(slot.provider_name)}</span>
              )}
            </div>
            <div className="wb-sheet-info">
              <h3>{slot.provider_name}</h3>
              <p>{slot.clinic_name}</p>
            </div>
          </div>

          <div className="wb-sheet-details">
            <div className="wb-sheet-detail">
              <Calendar size={16} />
              <span>{dateStr}</span>
            </div>
            <div className="wb-sheet-detail">
              <Clock size={16} />
              <span>{formatTime(slot.start_time)} · {slot.duration_minutes} minutes</span>
            </div>
            {priceStr && (
              <div className="wb-sheet-detail">
                <DollarSign size={16} />
                <span>{priceStr}</span>
              </div>
            )}
            {slot.direct_billing && (
              <div className="wb-sheet-detail">
                <Check size={16} />
                <span>Direct Billing Available</span>
              </div>
            )}
          </div>

          <div className="wb-sheet-actions">
            <button className="wb-sheet-book-btn" onClick={onBook}>
              <ExternalLink size={18} />
              Book Now
            </button>
            <button className="wb-sheet-profile-btn" onClick={onViewProfile}>
              View Profile
            </button>
          </div>

          <p className="wb-sheet-disclaimer">
            Opens {slot.clinic_name}'s booking page in a new tab · Availability refreshed every 30 min
          </p>
        </div>
      </div>
    </>
  );
}

function ProviderDetailModal({ provider, slots, onClose, onSlotClick, onBook, hasAlert, onAlertClick }) {
  const priceStr = formatPrice(provider.price_min, provider.price_max);
  const disciplineLabel = DISCIPLINES.find(d => d.key === provider.discipline)?.label || provider.discipline;

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-provider-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wb-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="wb-modal-hero">
          <div className="wb-modal-avatar">
            {provider.photo_url ? (
              <ProgressiveImage src={provider.photo_url} alt={provider.provider_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              <span>{getInitials(provider.provider_name)}</span>
            )}
          </div>
          <h2>{provider.provider_name}</h2>
          <p className="wb-modal-clinic">{provider.clinic_name}</p>
          <div className="wb-modal-badges">
            <span className="wb-modal-badge discipline">{disciplineLabel}</span>
            {provider.direct_billing && <span className="wb-modal-badge billing">Direct Billing</span>}
            {priceStr && <span className="wb-modal-badge price">{priceStr}</span>}
            {provider.rating && (
              <span className="wb-modal-badge rating">
                <Star size={12} fill="#fbbf24" stroke="#fbbf24" /> {provider.rating}
                {provider.review_count > 0 && ` (${provider.review_count})`}
              </span>
            )}
          </div>
        </div>

        {provider.bio && (
          <div className="wb-modal-section">
            <h3>About</h3>
            <p>{provider.bio}</p>
          </div>
        )}

        {provider.specialties && provider.specialties.length > 0 && (
          <div className="wb-modal-section">
            <h3>Specialties</h3>
            <div className="wb-modal-specialties">
              {provider.specialties.map(s => (
                <span key={s} className="wb-specialty-pill">{s}</span>
              ))}
            </div>
          </div>
        )}

        {slots.length > 0 && (
          <div className="wb-modal-section">
            <h3>Available Times</h3>
            <div className="wb-modal-slots">
              {slots.map(slot => (
                <button
                  key={slot.slot_id}
                  className="wb-time-btn"
                  onClick={() => onSlotClick(slot)}
                >
                  {formatTime(slot.start_time)}
                  <span className="wb-time-dur">{slot.duration_minutes}m</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="wb-modal-actions">
          <button className="wb-modal-book-btn" onClick={onBook}>
            <ExternalLink size={18} />
            Book on {provider.clinic_name}
          </button>
          <button
            className={`wb-modal-alert-btn ${hasAlert ? 'active' : ''}`}
            onClick={onAlertClick}
          >
            {hasAlert ? <BellOff size={16} /> : <Bell size={16} />}
            {hasAlert ? 'Alert Active' : 'Set Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertSetupModal({ provider, days, setDays, timeRange, setTimeRange, onSave, onClose }) {
  const DAY_OPTIONS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const toggleDay = (day) => {
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="wb-alert-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wb-modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="wb-alert-header">
          <Bell size={24} />
          <h2>Set Availability Alert</h2>
          {provider && <p>For {provider.provider_name || provider.name} at {provider.clinic_name}</p>}
          {!provider && <p>Get notified when any matching slot opens up</p>}
        </div>

        <div className="wb-alert-section">
          <label>Preferred Days</label>
          <div className="wb-alert-days">
            {DAY_OPTIONS.map(day => (
              <button
                key={day}
                className={`wb-day-btn ${days.includes(day) ? 'active' : ''}`}
                onClick={() => toggleDay(day)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          {days.length === 0 && <p className="wb-alert-hint">Leave empty for any day</p>}
        </div>

        <div className="wb-alert-section">
          <label>Preferred Time</label>
          <div className="wb-filter-pills">
            {TIME_RANGES.map(t => (
              <button
                key={t.key}
                className={`wb-pill ${timeRange === t.key ? 'active' : ''}`}
                onClick={() => setTimeRange(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button className="wb-alert-save-btn" onClick={onSave}>
          <Bell size={16} />
          Save Alert
        </button>
      </div>
    </div>
  );
}

function formatTimeSince(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}


// ============================================
// STYLES
// ============================================
const wellnessBookingStyles = `
.wellness-booking {
  position: relative;
  min-height: 100vh;
  background: #f9fafb;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
}
.wellness-booking button {
  font-family: inherit;
  color: inherit;
}

/* Header */
.wb-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: white;
  color: #111827;
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid #e5e7eb;
}
.wb-back-btn {
  background: #f3f4f6;
  border: none;
  border-radius: 10px;
  padding: 8px;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.wb-back-btn:active { transform: scale(0.95); }
.wb-header-text { flex: 1; }
.wb-title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.3px;
  margin: 0;
  color: #111827;
}
.wb-subtitle {
  font-size: 12px;
  color: #6b7280;
  margin: 2px 0 0;
}
.wb-live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  border-radius: 20px;
  padding: 4px 10px;
  font-size: 11px;
  color: #166534;
}
.wb-live-dot {
  width: 6px;
  height: 6px;
  background: #4ade80;
  border-radius: 50%;
  animation: livePulse 2s ease-in-out infinite;
}
@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Discipline Tabs */
.wb-discipline-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
  flex-wrap: wrap;
  justify-content: center;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.wb-discipline-tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1.5px solid #e5e7eb;
  background: white;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.wb-discipline-tab.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.wb-discipline-tab:not(.active):hover {
  background: white;
  border-color: #3b82f6;
  color: #3b82f6;
  box-shadow: 0 2px 6px rgba(59,130,246,0.1);
}

/* Date Carousel */
.wb-date-carousel {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}
.wb-date-carousel::-webkit-scrollbar { display: none; }
.wb-date-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 52px;
  padding: 8px 6px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}
.wb-date-item.active {
  background: #111827;
  color: white;
  border-color: #111827;
}
.wb-date-item.today:not(.active) { border-color: #ec4899; }
.wb-date-item.has-slots:not(.active) { border-color: #a78bfa; background: #faf5ff; }
.wb-date-day { font-size: 11px; font-weight: 500; opacity: 0.7; text-transform: uppercase; color: inherit; }
.wb-date-num { font-size: 18px; font-weight: 700; color: inherit; }
.wb-date-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ec4899;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
}

/* Filter Bar */
.wb-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}
.wb-filter-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}
.wb-filter-toggle.active { background: #f3f4f6; border-color: #9ca3af; }
.wb-filter-count {
  background: #ec4899;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}
.wb-view-toggle {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}
.wb-view-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: none;
  background: white;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
}
.wb-view-btn.active {
  background: #111827;
  color: white;
}

/* Expanded Filters */
.wb-filters-expanded {
  padding: 12px 16px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  animation: slideDown 0.2s ease;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.wb-filter-section {
  margin-bottom: 12px;
}
.wb-filter-section:last-child { margin-bottom: 0; }
.wb-filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.wb-filter-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.wb-pill {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
}
.wb-pill.active {
  background: #111827;
  color: white;
  border-color: #111827;
}

/* Toggle */
.wb-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.wb-toggle-track {
  width: 36px;
  height: 20px;
  background: #d1d5db;
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}
.wb-toggle.active .wb-toggle-track { background: #ec4899; }
.wb-toggle-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.wb-toggle.active .wb-toggle-thumb { transform: translateX(16px); }

/* Content */
.wb-content {
  padding: 16px;
  min-height: 200px;
}

/* Skeleton */
.wb-skeleton { display: flex; flex-direction: column; gap: 12px; }
.wb-skeleton-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  animation: shimmer 1.5s ease infinite;
}
.wb-skeleton-time {
  width: 60px;
  height: 14px;
  background: #e5e7eb;
  border-radius: 4px;
  margin-bottom: 12px;
}
.wb-skeleton-row { display: flex; gap: 12px; align-items: center; }
.wb-skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e5e7eb;
}
.wb-skeleton-text { flex: 1; }
.wb-skeleton-line {
  height: 12px;
  background: #e5e7eb;
  border-radius: 4px;
  margin-bottom: 6px;
}
.wb-skeleton-line.wide { width: 70%; }
.wb-skeleton-line.narrow { width: 45%; }
@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Empty State */
.wb-empty {
  text-align: center;
  padding: 48px 24px;
}
.wb-empty-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ec4899;
}
.wb-empty h3 {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
}
.wb-empty p {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px;
  line-height: 1.5;
}
.wb-empty-alert-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wb-empty-alert-btn:active { transform: scale(0.97); }
.wb-empty-jump-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #111827;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wb-empty-jump-btn:active { transform: scale(0.97); }
.wb-empty-progress {
  width: 120px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  margin: 24px auto 0;
  overflow: hidden;
}
.wb-empty-progress-bar {
  width: 30%;
  height: 100%;
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  border-radius: 2px;
  animation: progressSlide 2s ease infinite;
}
@keyframes progressSlide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

/* Timeline View */
.wb-timeline { display: flex; flex-direction: column; gap: 16px; }
.wb-time-group { }
.wb-time-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}
.wb-time-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 500;
  color: #9ca3af;
}
.wb-time-slots { display: flex; flex-direction: column; gap: 8px; }
.wb-slot-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
}
.wb-slot-card:hover { border-color: #d1d5db; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.wb-slot-card:active { transform: scale(0.99); }
.wb-slot-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #8b5cf6;
  overflow: hidden;
  flex-shrink: 0;
}
.wb-slot-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wb-slot-info { flex: 1; min-width: 0; }
.wb-slot-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-slot-clinic {
  display: block;
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wb-slot-meta { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
.wb-slot-duration {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 6px;
}
.wb-slot-billing {
  font-size: 10px;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
  padding: 2px 6px;
  border-radius: 4px;
}
.wb-slot-chevron { color: #d1d5db; flex-shrink: 0; }

/* Provider View */
.wb-providers { display: flex; flex-direction: column; gap: 16px; }
.wb-provider-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}
.wb-provider-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
}
.wb-provider-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #8b5cf6;
  overflow: hidden;
  flex-shrink: 0;
}
.wb-provider-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wb-provider-info { flex: 1; min-width: 0; }
.wb-provider-name {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}
.wb-provider-clinic {
  display: block;
  font-size: 13px;
  color: #6b7280;
  margin-top: 1px;
}
.wb-provider-tags { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.wb-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}
.wb-tag.billing { background: #ecfdf5; color: #059669; }
.wb-tag.price { background: #f3f4f6; color: #374151; }
.wb-tag.rating {
  background: #fffbeb;
  color: #92400e;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.wb-alert-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid #e5e7eb;
  background: white;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.wb-alert-btn.active {
  background: #fce7f3;
  border-color: #ec4899;
  color: #ec4899;
}
.wb-provider-slots {
  display: flex;
  gap: 8px;
  padding: 0 16px 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.wb-provider-slots::-webkit-scrollbar { display: none; }
.wb-time-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.wb-time-btn:hover { border-color: #ec4899; background: #fdf2f8; }
.wb-time-btn:active { transform: scale(0.95); }
.wb-time-dur { font-size: 10px; font-weight: 500; color: #9ca3af; }

/* Booking Bottom Sheet */
.wb-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 100;
  animation: fadeIn 0.2s ease;
}
.wb-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 24px 24px 0 0;
  z-index: 101;
  max-height: 80vh;
  overflow-y: auto;
  animation: sheetUp 0.3s ease;
  /* relative for close button positioning */
}
@keyframes sheetUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.wb-sheet-handle {
  width: 36px;
  height: 4px;
  background: #d1d5db;
  border-radius: 2px;
  margin: 12px auto;
}
.wb-sheet-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #f3f4f6;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #6b7280;
  z-index: 1;
}
.wb-sheet-close-btn:hover { background: #e5e7eb; color: #374151; }
.wb-sheet-content { padding: 0 20px 32px; }
.wb-sheet-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}
.wb-sheet-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #8b5cf6;
  overflow: hidden;
  flex-shrink: 0;
}
.wb-sheet-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wb-sheet-info h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0; }
.wb-sheet-info p { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
.wb-sheet-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}
.wb-sheet-detail {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #374151;
}
.wb-sheet-detail svg { color: #9ca3af; flex-shrink: 0; }
.wb-sheet-actions { display: flex; gap: 10px; margin-bottom: 12px; }
.wb-sheet-book-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
.wb-sheet-book-btn:active { transform: scale(0.98); }
.wb-sheet-profile-btn {
  padding: 14px 20px;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wb-sheet-disclaimer {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  line-height: 1.4;
}

/* Provider Detail Modal */
.wb-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeIn 0.2s ease;
}
.wb-provider-modal {
  background: white;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 20px;
  position: relative;
  animation: sheetUp 0.3s ease;
}
.wb-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wb-modal-hero {
  text-align: center;
  padding: 12px 0 20px;
}
.wb-modal-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #8b5cf6;
  overflow: hidden;
  margin: 0 auto 12px;
}
.wb-modal-avatar img { width: 100%; height: 100%; object-fit: cover; }
.wb-modal-hero h2 { font-size: 20px; font-weight: 800; color: #111827; margin: 0 0 4px; }
.wb-modal-clinic { font-size: 14px; color: #6b7280; margin: 0 0 12px; }
.wb-modal-badges { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.wb-modal-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
}
.wb-modal-badge.discipline { background: #fce7f3; color: #be185d; }
.wb-modal-badge.billing { background: #ecfdf5; color: #059669; }
.wb-modal-badge.price { background: #f3f4f6; color: #374151; }
.wb-modal-badge.rating {
  background: #fffbeb;
  color: #92400e;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.wb-modal-section {
  padding: 16px 0;
  border-top: 1px solid #f3f4f6;
}
.wb-modal-section h3 {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.wb-modal-section p { font-size: 14px; color: #6b7280; line-height: 1.5; margin: 0; }
.wb-modal-specialties { display: flex; gap: 6px; flex-wrap: wrap; }
.wb-specialty-pill {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 8px;
  background: #f3f4f6;
  color: #374151;
}
.wb-modal-slots { display: flex; gap: 8px; flex-wrap: wrap; }
.wb-modal-actions {
  display: flex;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}
.wb-modal-book-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.wb-modal-book-btn:active { transform: scale(0.98); }
.wb-modal-alert-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.wb-modal-alert-btn.active {
  background: #fce7f3;
  color: #ec4899;
}

/* Alert Setup Modal */
.wb-alert-modal {
  background: white;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-width: 500px;
  padding: 24px 20px 32px;
  position: relative;
  animation: sheetUp 0.3s ease;
}
.wb-alert-header {
  text-align: center;
  margin-bottom: 24px;
  color: #ec4899;
}
.wb-alert-header h2 { font-size: 18px; font-weight: 700; color: #111827; margin: 8px 0 4px; }
.wb-alert-header p { font-size: 13px; color: #6b7280; margin: 0; }
.wb-alert-section {
  margin-bottom: 20px;
}
.wb-alert-section label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.wb-alert-days { display: flex; gap: 6px; }
.wb-day-btn {
  flex: 1;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: white;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
  text-transform: capitalize;
}
.wb-day-btn.active {
  background: #111827;
  color: white;
  border-color: #111827;
}
.wb-alert-hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }
.wb-alert-save-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.wb-alert-save-btn:active { transform: scale(0.98); }

/* Webview Overlay */
.wb-webview-overlay {
  position: fixed;
  inset: 0;
  background: white;
  z-index: 200;
  display: flex;
  flex-direction: column;
}
.wb-webview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}
.wb-webview-back {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}
.wb-webview-external {
  padding: 8px;
  color: #6b7280;
}
.wb-webview-frame {
  flex: 1;
  border: none;
  width: 100%;
}
`;
