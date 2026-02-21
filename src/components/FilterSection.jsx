import React, { useMemo, useRef, useEffect } from 'react';
import { SlidersHorizontal, ChevronRight, Sun, Sunset, Moon, Baby, DollarSign } from 'lucide-react';

function getCategoryColor(cat) {
  const c = (cat || '').toLowerCase();
  if (c.includes('fitness') || c.includes('gym') || c.includes('yoga') || c.includes('pilates')) return '#3b82f6';
  if (c.includes('martial') || c.includes('boxing') || c.includes('combat')) return '#ef4444';
  if (c.includes('outdoor') || c.includes('hike') || c.includes('climb') || c.includes('nature')) return '#22c55e';
  if (c.includes('art') || c.includes('music') || c.includes('dance') || c.includes('creative')) return '#a855f7';
  if (c.includes('kids') || c.includes('child') || c.includes('family') || c.includes('youth')) return '#f59e0b';
  if (c.includes('swim') || c.includes('aqua') || c.includes('water') || c.includes('pool')) return '#06b6d4';
  if (c.includes('wellness') || c.includes('meditation') || c.includes('mindful')) return '#14b8a6';
  if (c.includes('sport') || c.includes('ball') || c.includes('bowl') || c.includes('recreation')) return '#f97316';
  if (c.includes('community') || c.includes('social') || c.includes('workshop')) return '#8b5cf6';
  return null;
}

/**
 * Generate array of next N days starting from today (Pacific time).
 */
function getDateStrip(count = 14) {
  const now = new Date();
  // Get today in Pacific timezone
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const days = [];
  let prevMonth = -1;
  for (let i = 0; i < count; i++) {
    const d = new Date(pacific);
    d.setDate(pacific.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const month = d.getMonth();
    const isNewMonth = month !== prevMonth && i > 0;
    prevMonth = month;
    days.push({
      dateStr: `${yyyy}-${mm}-${dd}`,
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      monthShort: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: i === 0,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      showMonth: isNewMonth,
    });
  }
  return days;
}

/**
 * Collapsible filter section for classes/events tabs.
 * Includes horizontal date picker, time, age (with kids age range slider), category, and price filters.
 */
const FilterSection = React.memo(function FilterSection({
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  kidsAgeRange,
  setKidsAgeRange,
  ageRangeOptions,
  categories,
  getAvailableTimeSlots,
  hasFreeItems,
  searchQuery,
  setSearchQuery,
  currentTime,
  dateEventCounts = {},
  happeningNowCount = 0,
  freeCount = 0,
  weekendCount = 0,
}) {
  // Derive Pacific date string from currentTime so date strip regenerates at midnight
  const pacificDateKey = useMemo(() => {
    if (!currentTime) return '';
    const p = new Date(currentTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}-${String(p.getDate()).padStart(2,'0')}`;
  }, [currentTime]);
  const dateStrip = useMemo(() => getDateStrip(14), [pacificDateKey]);
  const stripRef = useRef(null);
  const selectedRef = useRef(null);

  // Scroll selected date into view on mount or when filter changes
  useEffect(() => {
    if (selectedRef.current && stripRef.current) {
      const container = stripRef.current;
      const el = selectedRef.current;
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [filters.day]);

  const isDateSelected = /^\d{4}-\d{2}-\d{2}$/.test(filters.day);
  const activeFilterCount = [
    filters.day !== 'today',
    filters.time !== 'all',
    filters.age !== 'all',
    filters.category !== 'all',
    filters.price !== 'all',
  ].filter(Boolean).length;

  return (
    <>
      {/* Horizontal Date Picker Strip */}
      <div className="date-strip-section">
        <div className="date-strip" ref={stripRef} role="tablist" aria-label="Select date">
          {/* Upcoming chip (default) */}
          <button
            type="button"
            className={`date-chip ${filters.day === 'today' ? 'date-chip-active' : ''}`}
            onClick={() => setFilters({ ...filters, day: 'today' })}
            ref={filters.day === 'today' ? selectedRef : null}
            role="tab"
            aria-selected={filters.day === 'today'}
          >
            <span className="date-chip-day">All</span>
            <span className="date-chip-label">Upcoming</span>
          </button>

          {/* Individual day chips */}
          {dateStrip.map((d) => {
            const isSelected = filters.day === d.dateStr;
            const count = dateEventCounts[d.dateStr] || 0;
            const hasEvents = count > 0;
            return (
              <React.Fragment key={d.dateStr}>
              {d.showMonth && (
                <div className="date-strip-month-label" aria-hidden="true">
                  {d.monthShort}
                </div>
              )}
              <button
                type="button"
                className={`date-chip ${isSelected ? 'date-chip-active' : ''} ${d.isWeekend ? 'date-chip-weekend' : ''} ${!hasEvents && !isSelected ? 'date-chip-empty' : ''}`}
                onClick={() => setFilters({ ...filters, day: d.dateStr })}
                ref={isSelected ? selectedRef : null}
                role="tab"
                aria-selected={isSelected}
                aria-label={`${d.dayName} ${d.monthShort} ${d.dayNum}${d.isToday ? ' (Today)' : ''} — ${count} ${count === 1 ? 'item' : 'items'}`}
              >
                <span className="date-chip-day">{d.isToday ? 'Today' : d.dayName}</span>
                <span className="date-chip-num">{d.dayNum}</span>
                {hasEvents && !isSelected && (
                  <span className="date-chip-count">{count > 99 ? '99+' : count}</span>
                )}
                {d.isToday && !isSelected && !hasEvents && <span className="date-chip-dot" />}
              </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="quick-filter-chips">
        {[
          { key: 'free', label: freeCount > 0 ? `Free · ${freeCount}` : 'Free', icon: <DollarSign size={14} />, apply: { price: 'free' }, match: (f) => f.price === 'free' },
          { key: 'morning', label: 'Morning', icon: <Sun size={14} />, apply: { time: 'morning' }, match: (f) => f.time === 'morning' },
          { key: 'afternoon', label: 'Afternoon', icon: <Sunset size={14} />, apply: { time: 'afternoon' }, match: (f) => f.time === 'afternoon' },
          { key: 'evening', label: 'Evening', icon: <Moon size={14} />, apply: { time: 'evening' }, match: (f) => f.time === 'evening' },
          { key: 'kids', label: 'Kids', icon: <Baby size={14} />, apply: { age: 'kids' }, match: (f) => f.age === 'kids' },
        ].map(chip => {
          const isActive = chip.match(filters);
          return (
            <button
              key={chip.key}
              type="button"
              className={`quick-chip ${isActive ? 'quick-chip-active' : ''} ${chip.key === 'now' && isActive ? 'quick-chip-now' : ''}`}
              onClick={() => {
                if (isActive) {
                  // Toggle off — reset the relevant filter
                  const resetKey = Object.keys(chip.apply)[0];
                  const resetDefaults = { day: 'today', time: 'all', age: 'all', price: 'all', category: 'all' };
                  setFilters({ ...filters, [resetKey]: resetDefaults[resetKey] || 'all' });
                  if (chip.key === 'kids') setKidsAgeRange([0, 18]);
                } else {
                  setFilters({ ...filters, ...chip.apply });
                }
              }}
            >
              {chip.icon}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters Toggle Button */}
      <div className="filters-toggle-section">
        <button
          type="button"
          className="filters-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
          <span>{showFilters ? 'Hide Filters' : 'Filters'}</span>
          {activeFilterCount > 0 && (
            <span className="filter-count-badge">{activeFilterCount}</span>
          )}
          <ChevronRight
            size={18}
            aria-hidden="true"
            style={{
              transform: showFilters ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </button>
      </div>

      {/* Active Filter Pills - visible when filters applied but panel hidden */}
      {!showFilters && activeFilterCount > 0 && (
        <div className="active-filter-pills">
          {filters.time !== 'all' && (() => {
            const labels = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
            let label = labels[filters.time];
            if (!label) {
              const [h, m] = filters.time.split(':').map(Number);
              const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
              const period = h >= 12 ? 'PM' : 'AM';
              label = `${hr}${m ? ':' + String(m).padStart(2, '0') : ''} ${period}+`;
            }
            return <button type="button" className="filter-pill" onClick={() => setFilters({...filters, time: 'all'})}>{label} <span className="pill-x">&times;</span></button>;
          })()}
          {filters.age !== 'all' && (
            <button type="button" className="filter-pill" onClick={() => { setFilters({...filters, age: 'all'}); setKidsAgeRange([0, 18]); }}>
              {filters.age === 'kids' ? 'Kids' : filters.age === 'adults' ? 'Adults' : filters.age} <span className="pill-x">&times;</span>
            </button>
          )}
          {filters.category !== 'all' && (
            <button type="button" className="filter-pill" onClick={() => setFilters({...filters, category: 'all'})}>
              {filters.category} <span className="pill-x">&times;</span>
            </button>
          )}
          {filters.price !== 'all' && (
            <button type="button" className="filter-pill" onClick={() => setFilters({...filters, price: 'all'})}>
              {filters.price === 'free' ? 'Free' : 'Paid'} <span className="pill-x">&times;</span>
            </button>
          )}
        </div>
      )}

      {/* Filters Section - Collapsible */}
      {showFilters && (
        <div className="filters-section">
          <div className="filters-row-top">
            {/* Time Filter - Dynamic 30-min slots */}
            <div className="filter-group">
              <select
                value={filters.time}
                onChange={(e) => setFilters({...filters, time: e.target.value})}
                className="filter-dropdown"
                aria-label="Filter by time"
              >
                <option value="all">All Times</option>
                {getAvailableTimeSlots().map(timeSlot => {
                  const [hour, min] = timeSlot.split(':');
                  const hourNum = parseInt(hour);
                  const period = hourNum >= 12 ? 'PM' : 'AM';
                  const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                  const displayMin = min === '00' ? '' : `:${min}`;
                  return (
                    <option key={timeSlot} value={timeSlot}>
                      {displayHour}{displayMin} {period}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Age Filter */}
            <div className="filter-group">
              <select
                value={filters.age}
                aria-label="Filter by age group"
                onChange={(e) => {
                  setFilters({...filters, age: e.target.value});
                  if (e.target.value !== 'kids') {
                    setKidsAgeRange([0, 18]);
                  }
                }}
                className={`filter-dropdown ${filters.age === 'kids' ? 'filter-active' : ''}`}
              >
                <option value="all">All Ages</option>
                <option value="kids">Kids</option>
                <option value="adults">Adults</option>
              </select>
            </div>
          </div>

          {/* Kids Age Range Slider - Shows when Kids is selected */}
          {filters.age === 'kids' && (
            <div className="kids-age-slider-section">
              <div className="age-slider-header">
                <span className="age-slider-label">Age Range</span>
                <span className="age-slider-value">
                  {kidsAgeRange[0] === -1 ? 'Prenatal' : `${kidsAgeRange[0]} yrs`} - {kidsAgeRange[1]} yrs
                </span>
              </div>

              {/* Dual Range Slider */}
              <div className="age-slider-container">
                <div className="age-slider-track">
                  <div
                    className="age-slider-fill"
                    style={{
                      left: `${((kidsAgeRange[0] + 1) / 19) * 100}%`,
                      width: `${((kidsAgeRange[1] - kidsAgeRange[0]) / 19) * 100}%`
                    }}
                  />
                </div>
                <input
                  type="range"
                  min="-1"
                  max="18"
                  value={kidsAgeRange[0]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val < kidsAgeRange[1]) {
                      setKidsAgeRange([val, kidsAgeRange[1]]);
                    }
                  }}
                  className="age-slider age-slider-min"
                  aria-label="Minimum age"
                />
                <input
                  type="range"
                  min="-1"
                  max="18"
                  value={kidsAgeRange[1]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > kidsAgeRange[0]) {
                      setKidsAgeRange([kidsAgeRange[0], val]);
                    }
                  }}
                  className="age-slider age-slider-max"
                  aria-label="Maximum age"
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="age-range-buttons">
                {ageRangeOptions.map((opt) => {
                  const isSelected = kidsAgeRange[0] <= opt.min && kidsAgeRange[1] >= opt.max;
                  const isExactMatch = kidsAgeRange[0] === opt.min && kidsAgeRange[1] === opt.max;
                  return (
                    <button
                      type="button"
                      key={opt.label}
                      className={`age-range-btn ${isExactMatch ? 'active' : isSelected ? 'in-range' : ''}`}
                      onClick={() => setKidsAgeRange([opt.min, opt.max])}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`age-range-btn ${kidsAgeRange[0] === 0 && kidsAgeRange[1] === 18 ? 'active' : ''}`}
                  onClick={() => setKidsAgeRange([0, 18])}
                >
                  All Kids
                </button>
              </div>
            </div>
          )}

          {/* Category Pills */}
          {categories.length > 1 && (
            <div className="category-pills-section">
              <div className="category-pills" role="group" aria-label="Filter by category">
                <button
                  type="button"
                  className={`filter-cat-pill ${filters.category === 'all' ? 'filter-cat-pill-active' : ''}`}
                  onClick={() => setFilters({...filters, category: 'all'})}
                >
                  All
                </button>
                {categories.slice(1).map(cat => {
                  const dotColor = getCategoryColor(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                    className={`filter-cat-pill ${filters.category === cat ? 'filter-cat-pill-active' : ''}`}
                      onClick={() => setFilters({...filters, category: filters.category === cat ? 'all' : cat})}
                    >
                      {dotColor && <span className="cat-dot" style={{ background: dotColor }} />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="filters-row-bottom">
            {/* Price Filter */}
            <div className="filter-group">
              <select
                value={filters.price}
                onChange={(e) => setFilters({...filters, price: e.target.value})}
                className="filter-dropdown"
                aria-label="Filter by price"
              >
                <option value="all">All Prices</option>
                {hasFreeItems && <option value="free">Free</option>}
                <option value="paid">Paid</option>
              </select>
            </div>

            {/* Reset Button */}
            {(() => {
              const hasActiveFilters = filters.day !== 'today' || filters.time !== 'all' ||
                                      filters.age !== 'all' || filters.category !== 'all' || filters.price !== 'all' ||
                                      (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18);
              return hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilters({day: 'today', time: 'all', age: 'all', category: 'all', price: 'all'});
                    setKidsAgeRange([0, 18]);
                    if (setSearchQuery) setSearchQuery('');
                  }}
                  className="reset-btn"
                >
                  Reset All
                </button>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </>
  );
});

export default FilterSection;
