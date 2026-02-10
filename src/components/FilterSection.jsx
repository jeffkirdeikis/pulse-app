import React from 'react';
import { SlidersHorizontal, ChevronRight } from 'lucide-react';

/**
 * Collapsible filter section for classes/events tabs.
 * Includes day, time, age (with kids age range slider), category, and price filters.
 *
 * @param {Object} props
 * @param {Object} props.filters - Current filter state { day, time, age, category, price }
 * @param {Function} props.setFilters - Filter state setter
 * @param {boolean} props.showFilters - Whether filters are expanded
 * @param {Function} props.setShowFilters - Toggle filters visibility
 * @param {Array} props.kidsAgeRange - [min, max] age range
 * @param {Function} props.setKidsAgeRange - Age range setter
 * @param {Array} props.ageRangeOptions - Age range quick-select options
 * @param {Array} props.categories - Available categories (includes 'All')
 * @param {Function} props.getAvailableTimeSlots - Returns sorted time slot strings
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
}) {
  return (
    <>
      {/* Filters Toggle Button */}
      <div className="filters-toggle-section">
        <button
          className="filters-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
          <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
          <ChevronRight
            size={18}
            style={{
              transform: showFilters ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </button>
      </div>

      {/* Filters Section - Collapsible */}
      {showFilters && (
        <div className="filters-section">
          <div className="filters-row-top">
            {/* Day Filter */}
            <div className="filter-group">
              <select
                value={filters.day}
                onChange={(e) => setFilters({...filters, day: e.target.value})}
                className="filter-dropdown"
                aria-label="Filter by day"
              >
                <option value="today">📅 Upcoming</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="thisWeekend">This Weekend</option>
                <option value="nextWeek">Next Week</option>
                <option value="anytime">Anytime</option>
              </select>
            </div>

            {/* Time Filter - Dynamic 30-min slots */}
            <div className="filter-group">
              <select
                value={filters.time}
                onChange={(e) => setFilters({...filters, time: e.target.value})}
                className="filter-dropdown"
                aria-label="Filter by time"
              >
                <option value="all">🕐 All Times</option>
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
                <option value="all">👥 All Ages</option>
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
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="age-range-buttons">
                {ageRangeOptions.map((opt) => {
                  const isSelected = kidsAgeRange[0] <= opt.min && kidsAgeRange[1] >= opt.max;
                  const isExactMatch = kidsAgeRange[0] === opt.min && kidsAgeRange[1] === opt.max;
                  return (
                    <button
                      key={opt.label}
                      className={`age-range-btn ${isExactMatch ? 'active' : isSelected ? 'in-range' : ''}`}
                      onClick={() => setKidsAgeRange([opt.min, opt.max])}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <button
                  className={`age-range-btn ${kidsAgeRange[0] === 0 && kidsAgeRange[1] === 18 ? 'active' : ''}`}
                  onClick={() => setKidsAgeRange([0, 18])}
                >
                  All Kids
                </button>
              </div>
            </div>
          )}

          <div className="filters-row-bottom">
            {/* Category Filter */}
            <div className="filter-group">
              <select
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
                className="filter-dropdown"
                aria-label="Filter by category"
              >
                <option value="all">🏷️ All Categories</option>
                {categories.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {/* Price Filter */}
            <div className="filter-group">
              <select
                value={filters.price}
                onChange={(e) => setFilters({...filters, price: e.target.value})}
                className="filter-dropdown"
                aria-label="Filter by price"
              >
                <option value="all">💵 All Prices</option>
                <option value="free">Free</option>
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
                  onClick={() => {
                    setFilters({day: 'today', time: 'all', age: 'all', category: 'all', price: 'all'});
                    setKidsAgeRange([0, 18]);
                  }}
                  className="reset-btn"
                >
                  ↺ Reset
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
