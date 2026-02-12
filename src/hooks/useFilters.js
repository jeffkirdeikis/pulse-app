import { useState, useCallback } from 'react';

/**
 * Custom hook for filter state management
 * Consolidates all filter-related state from App.jsx
 */
export function useFilters() {
  const [filters, setFilters] = useState({
    category: 'All',
    priceRange: 'all', // all, free, paid
    timeOfDay: 'all', // all, morning, afternoon, evening
    accessibility: false,
    kidsWelcome: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const [kidsAgeRange, setKidsAgeRange] = useState([0, 18]);

  // Category filters for different sections
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('All');
  const [dealCategoryFilter, setDealCategoryFilter] = useState('All');

  // Listing filters for admin/business
  const [listingFilterType, setListingFilterType] = useState('all'); // 'all', 'event', 'class', 'deal'
  const [showListingFilter, setShowListingFilter] = useState(false);

  // Update a single filter
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({
      category: 'All',
      priceRange: 'all',
      timeOfDay: 'all',
      accessibility: false,
      kidsWelcome: false
    });
    setKidsAgeRange([0, 18]);
    setServiceCategoryFilter('All');
    setDealCategoryFilter('All');
    setListingFilterType('all');
  }, []);

  // Toggle filters panel
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  // Close filters panel
  const closeFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  // Check if any filters are active
  const hasActiveFilters =
    filters.category !== 'All' ||
    filters.priceRange !== 'all' ||
    filters.timeOfDay !== 'all' ||
    filters.accessibility ||
    filters.kidsWelcome;

  // Get active filter count
  const activeFilterCount = [
    filters.category !== 'All',
    filters.priceRange !== 'all',
    filters.timeOfDay !== 'all',
    filters.accessibility,
    filters.kidsWelcome
  ].filter(Boolean).length;

  return {
    // Main filters
    filters,
    setFilters,
    showFilters,
    setShowFilters,
    kidsAgeRange,
    setKidsAgeRange,

    // Section filters
    serviceCategoryFilter,
    setServiceCategoryFilter,
    dealCategoryFilter,
    setDealCategoryFilter,

    // Listing filters
    listingFilterType,
    setListingFilterType,
    showListingFilter,
    setShowListingFilter,

    // Handlers
    updateFilter,
    resetFilters,
    toggleFilters,
    closeFilters,

    // Computed
    hasActiveFilters,
    activeFilterCount
  };
}
