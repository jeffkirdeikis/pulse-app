import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, MapPin, Clock, Star, Check, Bell, Search, ChevronRight, X, Plus, Eye, Users, DollarSign, CheckCircle, SlidersHorizontal, Building, Wrench, Percent, Heart, Sparkles, MessageCircle, WifiOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useUserData } from './hooks/useUserData';
import { useCardAnimation } from './hooks/useCardAnimation';
import { useMessaging } from './hooks/useMessaging';
import { useSubmissions } from './hooks/useSubmissions';
import { formatResponseTime } from './lib/businessAnalytics';
import WellnessBooking from './components/WellnessBooking';
import EventDetailModal from './components/modals/EventDetailModal';
import DealDetailModal from './components/modals/DealDetailModal';
import ServiceDetailModal from './components/modals/ServiceDetailModal';
import AuthModal from './components/modals/AuthModal';
import BusinessDashboard from './components/BusinessDashboard';
import AdminDashboard from './components/AdminDashboard';
import ProfileModal from './components/modals/ProfileModal';
import SubmissionModal from './components/modals/SubmissionModal';
import ClaimBusinessModal from './components/modals/ClaimBusinessModal';
import MyCalendarModal from './components/modals/MyCalendarModal';
import MessagesModal from './components/modals/MessagesModal';
import BookingSheet from './components/modals/BookingSheet';
import AdminPanelModal from './components/modals/AdminPanelModal';
import EditVenueModal from './components/modals/EditVenueModal';
import ImageCropperModal from './components/modals/ImageCropperModal';
import ContactSheet from './components/modals/ContactSheet';
import EditEventModal from './components/modals/EditEventModal';
import { REAL_DATA } from './data/realData';
import { getBookingUrl, getBookingType } from './utils/bookingHelpers';
import { generateSmartDealTitle, normalizeDealCategory, calculateDealScore, getDealSavingsDisplay, isRealDeal } from './utils/dealHelpers';
import './styles/pulse-app.css';

// All dates/times in this app are in Squamish (Pacific) time, regardless of user's location.
const PACIFIC_TZ = 'America/Vancouver';

/** Get current Date adjusted to Pacific timezone */
function getPacificNow() {
  const pacificStr = new Date().toLocaleString('en-US', { timeZone: PACIFIC_TZ });
  return new Date(pacificStr);
}

/** Get today's date string (YYYY-MM-DD) in Pacific timezone */
function getPacificDateStr() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

/** Create a Date object for a Pacific date + time (from DB fields) */
function pacificDate(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
  const fakeLocal = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const localStr = fakeLocal.toLocaleString('en-US', { timeZone: PACIFIC_TZ });
  const pacificEquiv = new Date(localStr);
  const offset = fakeLocal.getTime() - pacificEquiv.getTime();
  return new Date(fakeLocal.getTime() + offset);
}

/** Format options for displaying dates/times always in Pacific timezone */
const PACIFIC_DATE_OPTS = { timeZone: PACIFIC_TZ };

export default function PulseApp() {
  const [view, setView] = useState('consumer');
  const [currentSection, setCurrentSection] = useState('classes'); // classes, events, deals, services, wellness - DEFAULT TO CLASSES
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const dealCardRefs = useRef([]);
  const eventCardRefs = useRef([]);
  const serviceCardRefs = useRef([]);
  const classCardRefs = useRef([]);
  const venueCardRefs = useRef([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showClaimBusinessModal, setShowClaimBusinessModal] = useState(false);
  const [claimFormData, setClaimFormData] = useState({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSearchQuery, setClaimSearchQuery] = useState('');
  const [claimSelectedBusiness, setClaimSelectedBusiness] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCalendarToast, setShowCalendarToast] = useState(false);
  const [calendarToastMessage, setCalendarToastMessage] = useState('');

  // Helper function to show toast messages
  const showToast = useCallback((message, _type = 'info') => {
    setCalendarToastMessage(message);
    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);
  }, []);

  // User data from Supabase (replaces all hardcoded dummy data)
  const {
    session,
    isAuthenticated,
    user,
    userStats,
    userAchievements,
    userActivity,
    savedItems,
    myCalendar,
    userClaimedBusinesses,
    setUser,
    updateProfile,
    updateAvatar,
    updateCoverPhoto,
    toggleSaveItem,
    isItemSaved,
    registerForEvent,
    refreshUserData,
    signOut
  } = useUserData();

  // Admin Business Impersonation State
  const [impersonatedBusiness, setImpersonatedBusiness] = useState(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [impersonateSearchQuery, setImpersonateSearchQuery] = useState('');
  const [previousAdminState, setPreviousAdminState] = useState(null);
  const [selectedClaimedBusinessId, setSelectedClaimedBusinessId] = useState(null);
  // Admin venue management filter state
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('');
  // Admin stats: claimed businesses count
  const [adminClaimedCount, setAdminClaimedCount] = useState(0);
  const [adminVerifiedCount, setAdminVerifiedCount] = useState(0);
  const activeBusiness = impersonatedBusiness || (selectedClaimedBusinessId ? userClaimedBusinesses.find(b => b.id === selectedClaimedBusinessId) : null) || (userClaimedBusinesses.length > 0 ? userClaimedBusinesses[0] : null);
  const isImpersonating = !!impersonatedBusiness;

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState('overview'); // overview, activity, saved, businesses, settings
  const [activityFilter, setActivityFilter] = useState('all');

  const [savedItemsFilter, setSavedItemsFilter] = useState('event');
  const [localSavedItems, setLocalSavedItems] = useState(() => {
    // Initialize from localStorage for persistence without login
    try {
      const saved = localStorage.getItem('pulse_local_saves');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showMyCalendarModal, setShowMyCalendarModal] = useState(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('All');
  const [dealCategoryFilter, setDealCategoryFilter] = useState('All');
  const [servicesSubView, setServicesSubView] = useState('directory'); // directory | booking

  // Supabase services data
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Supabase events data (from database)
  const [dbEvents, setDbEvents] = useState([]);
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Cache timestamps to prevent duplicate API requests within 30s
  const fetchTimestamps = useRef({ services: 0, events: 0, deals: 0 });
  const CACHE_TTL = 30000; // 30 seconds

  // Fetch services from Supabase - extracted to be reusable
  const fetchServices = async (force = false) => {
    const now = Date.now();
    if (!force && now - fetchTimestamps.current.services < CACHE_TTL && services.length > 0) return;
    fetchTimestamps.current.services = now;

    setServicesLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, category, address, google_rating, google_reviews, phone, website, email, logo_url')
      .eq('status', 'active')
      .order('google_rating', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching services:', error);
      setServicesLoading(false);
      return;
    }

    // Map Supabase fields to expected UI fields
    const mappedServices = data.map(business => ({
      id: business.id,
      name: business.name,
      category: business.category || 'Other',
      address: business.address || '',
      rating: business.google_rating,
      reviews: business.google_reviews,
      phone: business.phone || '',
      website: business.website || '',
      email: business.email || '',
      logo_url: business.logo_url || null
    }));

    setServices(mappedServices);
    setServicesLoading(false);
  };

  // Fetch services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  // Refresh data when tab becomes visible (catches admin edits, external changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchServices();
        setEventsRefreshKey(k => k + 1);
        setDealsRefreshKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch admin stats (claimed/verified business counts) when admin panel is shown
  useEffect(() => {
    if (!user?.isAdmin) return;
    const fetchAdminStats = async () => {
      try {
        // Count all claims (each unique business_id with a claim)
        const { data: claimsData, error: claimsError } = await supabase
          .from('business_claims')
          .select('business_id, status');
        if (!claimsError && claimsData) {
          // Count unique claimed business IDs
          const uniqueClaimed = new Set(claimsData.map(c => c.business_id).filter(Boolean));
          setAdminClaimedCount(uniqueClaimed.size);
          // Count verified claims
          const uniqueVerified = new Set(claimsData.filter(c => c.status === 'verified').map(c => c.business_id).filter(Boolean));
          setAdminVerifiedCount(uniqueVerified.size);
        }
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      }
    };
    fetchAdminStats();
  }, [user?.isAdmin]);

  // Browser history management for tab navigation
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const validSections = ['classes', 'events', 'deals', 'services', 'wellness'];
    if (validSections.includes(hash)) {
      setCurrentSection(hash);
    } else {
      window.history.replaceState({ section: 'classes' }, '', '#classes');
    }
    const handlePopState = (e) => {
      const section = e.state?.section || window.location.hash.replace('#', '') || 'classes';
      if (validSections.includes(section)) {
        setCurrentSection(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        // Close any open modal
        setSelectedEvent(null);
        setSelectedDeal(null);
        setSelectedService(null);
        setShowAuthModal(false);
        setShowClaimBusinessModal(false);
        setShowSubmissionModal(false);
        setShowProfileModal(false);
        setShowAdminPanel(false);
        setShowEditVenueModal(false);
        setShowMessagesModal(false);
        setShowAddEventModal(false);
        setShowMyCalendarModal(false);
        setShowBookingSheet(false);
        setShowContactSheet(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // ESC to exit impersonation mode (separate effect with proper deps)
  useEffect(() => {
    if (!impersonatedBusiness) return;
    const handleImpersonateEsc = (e) => {
      if (e.key === 'Escape') {
        exitImpersonation();
      }
    };
    window.addEventListener('keydown', handleImpersonateEsc);
    return () => window.removeEventListener('keydown', handleImpersonateEsc);
  }, [impersonatedBusiness]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch events from Supabase on mount
  useEffect(() => {
    async function fetchEvents(force = false) {
      const now = Date.now();
      if (!force && now - fetchTimestamps.current.events < CACHE_TTL && dbEvents.length > 0) return;
      fetchTimestamps.current.events = now;

      setEventsLoading(true);
      // Always use Squamish (Pacific) date, regardless of user's timezone
      const localDateStr = getPacificDateStr();

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .gte('start_date', localDateStr)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        setEventsLoading(false);
        return;
      }

      // Map Supabase events to the UI format
      const mappedEvents = data.map(event => {
        // Parse date/time as Pacific (Squamish) time, regardless of user's timezone
        let startTimeStr = event.start_time || '09:00';
        let [hours, minutes] = startTimeStr.split(':').map(Number);

        // Fix suspicious times: classes at 1-5 AM are likely data errors, default to 9 AM
        // Also fix weird times like XX:26 which indicate scraping errors
        if (hours >= 1 && hours <= 5) {
          hours = 9;
          minutes = 0;
        } else if (minutes === 26) {
          minutes = 0;
        }

        const fixedStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const startDate = pacificDate(event.start_date, fixedStartTime);

        let endDate;
        if (event.end_time) {
          let [endHours, endMinutes] = event.end_time.split(':').map(Number);
          if (endHours >= 1 && endHours <= 5) {
            endHours = 10;
            endMinutes = 0;
          } else if (endMinutes === 26) {
            endMinutes = 0;
          }
          const fixedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
          endDate = pacificDate(event.start_date, fixedEndTime);
        } else {
          endDate = pacificDate(event.start_date, `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        }

        return {
          id: event.id,
          title: event.title,
          eventType: event.event_type === 'class' ? 'class' : 'event',
          venueId: event.venue_id || null,
          venueName: event.venue_name || 'Squamish',
          venueAddress: event.venue_address || 'Squamish, BC',
          start: startDate,
          end: endDate,
          tags: event.tags || [event.category || 'Community'],
          category: event.category
            ? event.category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            : 'Community',
          ageGroup: 'All Ages',
          price: event.is_free ? 'Free' : (event.price_description || (event.price ? `$${event.price}` : 'Free')),
          recurrence: 'none',
          description: event.description || '',
          featured: event.featured || false,
          image: event.image_url
        };
      });

      setDbEvents(mappedEvents);
      setEventsLoading(false);
    }

    fetchEvents();
  }, [eventsRefreshKey]);

  // Supabase deals data (from database)
  const [dbDeals, setDbDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsRefreshKey, setDealsRefreshKey] = useState(0);

  // Fetch deals from Supabase on mount
  useEffect(() => {
    async function fetchDeals(force = false) {
      const now = Date.now();
      if (!force && now - fetchTimestamps.current.deals < CACHE_TTL && dbDeals.length > 0) return;
      fetchTimestamps.current.deals = now;

      setDealsLoading(true);
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deals:', error);
        setDealsLoading(false);
        return;
      }

      // Map Supabase deals to the UI format
      const mappedDeals = data.map(deal => ({
        id: deal.id,
        title: deal.title,
        venueId: null,
        venueName: deal.business_name || 'Local Business',
        venueAddress: deal.business_address || 'Squamish, BC',
        category: deal.category || 'Other',
        description: deal.description || '',
        // Keep raw values for scoring
        discountType: deal.discount_type,
        discountValue: deal.discount_value,
        originalPrice: deal.original_price,
        dealPrice: deal.deal_price,
        // Formatted display string
        discount: deal.discount_type === 'percent' ? `${deal.discount_value}% off` :
                  deal.discount_type === 'fixed' ? `$${deal.discount_value} off` :
                  deal.discount_type === 'bogo' ? 'Buy One Get One' :
                  deal.discount_type === 'free_item' ? 'Free Item' : 'Special Offer',
        validUntil: deal.valid_until,
        terms: deal.terms_conditions || '',
        image: deal.image_url,
        featured: deal.featured || false
      }));

      setDbDeals(mappedDeals);
      setDealsLoading(false);
    }

    fetchDeals();
  }, [dealsRefreshKey]);

  // Track analytics event
  const trackAnalytics = async (eventType, businessId, referenceId = null) => {
    try {
      await supabase.from('business_analytics').insert({
        business_id: businessId,
        event_type: eventType,
        user_id: user?.id || null,
        reference_id: referenceId
      });
    } catch (err) {
      console.error('Analytics tracking error:', err);
    }
  };

  // Get business info for an event, including booking URL from lookup
  const getBusinessForEvent = (event) => {
    const venueName = getVenueName(event.venueId, event);
    const venue = REAL_DATA.venues.find(v => v.name === venueName);
    const bookingUrl = getBookingUrl(venueName) || event.bookingUrl;
    const bookingType = getBookingType(venueName);

    return {
      id: venue?.id || event.venueId,
      name: venueName,
      booking_url: bookingUrl,
      booking_type: bookingType,
      ...venue
    };
  };

  // Handle booking button click
  const handleBookClick = (event) => {
    const business = getBusinessForEvent(event);

    // Track booking click
    trackAnalytics('booking_click', business.id, event.id);

    setBookingEvent(event);
    setIframeLoaded(false);
    setIframeFailed(false);
    setBookingRequestMessage('');

    // Determine booking step based on whether business has booking URL
    const hasBookingUrl = business.booking_url;
    if (hasBookingUrl) {
      setBookingStep('iframe');
    } else {
      setBookingStep('request');
    }

    setShowBookingSheet(true);
  };

  // Close booking sheet and show confirmation
  const closeBookingSheet = () => {
    const business = bookingEvent ? getBusinessForEvent(bookingEvent) : null;
    const hasBookingUrl = business?.booking_url;

    setShowBookingSheet(false);

    // Only show confirmation if there was a booking URL (user might have booked externally)
    if (hasBookingUrl && bookingStep === 'iframe') {
      setShowBookingConfirmation(true);
    }
  };

  // Handle booking confirmation response
  const handleBookingConfirmation = async (didBook) => {
    if (didBook && bookingEvent) {
      const business = getBusinessForEvent(bookingEvent);

      // Track confirmed booking
      await trackAnalytics('booking_confirmed', business.id, bookingEvent.id);

      // Add to calendar
      addToCalendar(bookingEvent);

      setCalendarToastMessage('Great! Added to your calendar');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 2000);
    }

    setShowBookingConfirmation(false);
    setBookingEvent(null);
  };

  // Submit booking request (for businesses without booking URL)
  const submitBookingRequest = async () => {
    if (!bookingEvent) return;

    const business = getBusinessForEvent(bookingEvent);

    setSendingMessage(true);
    try {
      const subject = `Booking Request: ${bookingEvent.title}`;
      const message = `Hi, I'd like to book:\n\n` +
        `Class: ${bookingEvent.title}\n` +
        `Date: ${bookingEvent.start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' })}\n` +
        `Time: ${bookingEvent.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}\n\n` +
        (bookingRequestMessage ? `Message: ${bookingRequestMessage}` : '');

      const conversationId = await startConversation(business.id, subject, message);

      if (conversationId) {
        // Track message received
        await trackAnalytics('message_received', business.id, bookingEvent.id);

        setShowBookingSheet(false);
        setBookingEvent(null);

        setCalendarToastMessage('Request sent! You\'ll hear back soon.');
        setShowCalendarToast(true);
        setTimeout(() => {
          setShowCalendarToast(false);
          // Open messages to show the sent request
          openMessages();
        }, 1500);
      }
    } catch (err) {
      console.error('Error submitting booking request:', err);
      showToast('Failed to send request. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };


  // Business Analytics State
  const [businessAnalytics, setBusinessAnalytics] = useState(null);
  const [, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30); // days

  // Fetch business analytics
  const fetchBusinessAnalytics = async (businessId, days = 30) => {
    if (!businessId) return;
    setAnalyticsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_business_analytics_summary', {
        p_business_id: businessId,
        p_days: days
      });
      if (error) throw error;
      setBusinessAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setBusinessAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Admin Business Impersonation Functions
  const enterImpersonation = (venue) => {
    if (!user.isAdmin) return;
    setPreviousAdminState({
      adminTab: adminTab,
      scrollPosition: window.scrollY
    });
    setImpersonatedBusiness({
      id: venue.id,
      name: venue.name,
      address: venue.address || '',
      verified: venue.verified || false,
      category: venue.category || '',
      phone: venue.phone || '',
      website: venue.website || '',
      email: venue.email || '',
      logo_url: venue.logo_url || null
    });
    setImpersonateSearchQuery('');
    setAdminSearchQuery('');
    setView('business');
    window.scrollTo(0, 0);
  };

  const exitImpersonation = () => {
    const savedState = previousAdminState;
    setImpersonatedBusiness(null);
    setView('admin');
    setBusinessAnalytics(null);
    setBusinessConversations([]);
    setSelectedBusinessConversation(null);
    if (savedState) {
      setAdminTab(savedState.adminTab);
      setTimeout(() => window.scrollTo(0, savedState.scrollPosition || 0), 100);
      setPreviousAdminState(null);
    }
  };

  // Load business data when view changes
  useEffect(() => {
    if (view === 'business' && activeBusiness) {
      const businessId = activeBusiness.id;
      fetchBusinessInbox(businessId, 'booking_request');
      fetchBusinessAnalytics(businessId, analyticsPeriod);
    }
  }, [view, activeBusiness?.id, analyticsPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Admin panel state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('pending');
  const [quickAddForm, setQuickAddForm] = useState({ title: '', venueId: '', venueName: '', startTime: '18:00', duration: '60', price: '', recurrence: 'Weekly' });
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editEventForm, setEditEventForm] = useState({ title: '', description: '', date: '', startTime: '', endTime: '', price: '', category: '' });

  // Submissions + Image Cropper (hook replaces 10 state variables + 12 functions)
  const {
    showSubmissionModal, setShowSubmissionModal,
    submissionStep, setSubmissionStep,
    submissionType, setSubmissionType,
    submissionForm, setSubmissionForm,
    pendingSubmissions,
    showImageCropper, setShowImageCropper,
    cropperType, setCropperType,
    cropperImage, setCropperImage,
    cropPosition, setCropPosition,
    cropZoom, setCropZoom,
    openSubmissionModal, closeSubmissionModal,
    selectSubmissionType, selectBusinessType,
    handleImageSelect, handleCropComplete,
    removeImage, getSelectedBusinessInfo,
    submitForApproval, approveSubmission, rejectSubmission,
    loadPendingSubmissions, closeImageCropper,
  } = useSubmissions(user, {
    showToast,
    userClaimedBusinesses,
    updateAvatar,
    updateCoverPhoto,
  });

  // Load pending submissions when admin panel opens
  useEffect(() => {
    if (showAdminPanel && user?.isAdmin) {
      loadPendingSubmissions();
    }
  }, [showAdminPanel, user?.isAdmin]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // User authentication state
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Filter states - all dropdowns
  const [filters, setFilters] = useState({
    day: 'today', // today, tomorrow, thisWeekend, nextWeek, anytime
    time: 'all', // all, or specific times like '6:00', '6:30', '7:00', etc
    age: 'all', // all, kids, adults
    category: 'all', // all, music, fitness, arts, etc
    price: 'all' // all, free, paid
  });
  const [showFilters, setShowFilters] = useState(false);

  // Kids age range filter state
  const [kidsAgeRange, setKidsAgeRange] = useState([0, 18]);
  const ageRangeOptions = [
    { label: 'Prenatal', min: -1, max: 0 },
    { label: '0-1', min: 0, max: 1 },
    { label: '1-2', min: 1, max: 2 },
    { label: '2-5', min: 2, max: 5 },
    { label: '5-7', min: 5, max: 7 },
    { label: '7-10', min: 7, max: 10 },
    { label: '10-13', min: 10, max: 13 },
    { label: '13-18', min: 13, max: 18 }
  ];

  // Booking & Messaging State
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [bookingEvent, setBookingEvent] = useState(null);
  const [bookingStep, setBookingStep] = useState('iframe'); // iframe, request, confirmation
  const [, setIframeLoaded] = useState(false);
  const [, setIframeFailed] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [bookingRequestMessage, setBookingRequestMessage] = useState('');
  const [showEditVenueModal, setShowEditVenueModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [editVenueForm, setEditVenueForm] = useState({ name: '', address: '', phone: '', website: '', email: '', category: '' });

  // Messaging (hook replaces 19 state variables + 10 functions)
  const msg = useMessaging(user, {
    showToast,
    onAuthRequired: () => setShowAuthModal(true),
    activeBusiness,
    trackAnalytics,
  });
  const {
    showMessagesModal, setShowMessagesModal,
    conversations, conversationsLoading,
    currentConversation, setCurrentConversation,
    conversationMessages, messagesLoading,
    messageInput, setMessageInput,
    sendingMessage, setSendingMessage,
    showContactSheet, setShowContactSheet,
    contactBusiness, contactSubject, setContactSubject,
    contactMessage, setContactMessage,
    businessInboxTab, setBusinessInboxTab,
    businessConversations, businessConversationsLoading,
    selectedBusinessConversation, setSelectedBusinessConversation,
    businessMessages, businessMessagesLoading,
    businessReplyInput, setBusinessReplyInput,
    fetchConversations, fetchMessages, sendMessage,
    startConversation, submitContactForm, openMessages,
    fetchBusinessInbox, fetchBusinessMessages,
    sendBusinessReply, markConversationResolved,
  } = msg;

  // Build categories dynamically from actual event data, filtered by current section
  const categories = useMemo(() => {
    const catSet = new Set();
    let events = [...REAL_DATA.events, ...dbEvents];
    // Only show categories relevant to the current section
    if (currentSection === 'classes') {
      events = events.filter(e => e.eventType === 'class');
    } else if (currentSection === 'events') {
      events = events.filter(e => e.eventType === 'event');
    }
    events.forEach(e => {
      if (e.category) catSet.add(e.category);
    });
    return ['All', ...Array.from(catSet).sort()];
  }, [dbEvents, currentSection]);

  // Helper to close Add Event modal
  const closeAddEventModal = () => {
    setShowAddEventModal(false);
  };

  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = (event) => {
    const startDate = event.start.toISOString().replace(/-|:|\.\d+/g, '');
    const endDate = event.end.toISOString().replace(/-|:|\.\d+/g, '');
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(getVenueName(event.venueId, event) + ', Squamish, BC');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
  };

  // Add event to both Google Calendar and My Calendar
  const addToCalendar = async (event) => {
    // Add to internal calendar if not already there
    const isAlreadyInCalendar = myCalendar.some(e => e.eventId === event.id || e.id === event.id);

    if (!isAlreadyInCalendar && isAuthenticated) {
      await registerForEvent({
        id: event.id,
        eventType: event.eventType || 'event',
        title: event.title,
        date: event.start ? event.start.toISOString().split('T')[0] : event.date,
        time: event.start ? event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) : event.time,
        venue: getVenueName(event.venueId, event),
        address: event.location || event.address || '',
        ...event
      });
      setCalendarToastMessage(`"${event.title}" added to My Calendar!`);
    } else if (isAlreadyInCalendar) {
      setCalendarToastMessage(`"${event.title}" is already in your calendar`);
    } else {
      setCalendarToastMessage('Sign in to add events to your calendar');
    }

    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);

    // Open Google Calendar in new tab
    window.open(generateGoogleCalendarUrl(event), '_blank');
  };

  // Remove event from My Calendar
  const removeFromCalendar = async (_eventId) => {
    if (!isAuthenticated) return;
    // For now, just show toast - full removal would need a Supabase function
    setCalendarToastMessage('Event removed from My Calendar');
    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);
    refreshUserData(); // Refresh to get updated calendar
  };

  // Check if event is in My Calendar
  const isInMyCalendar = (eventId) => {
    return myCalendar.some(e => e.eventId === eventId || e.id === eventId);
  };

  // Get events grouped by date for calendar view
  const getCalendarEventsByDate = () => {
    const grouped = {};
    myCalendar.forEach(event => {
      const dateKey = event.start.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    // Sort by date
    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, events]) => ({
        date: new Date(date),
        events: events.sort((a, b) => a.start - b.start)
      }));
  };

  // Get available time slots from actual events (30-min intervals)
  const getAvailableTimeSlots = () => {
    const slots = new Set();
    const allEvents = [...REAL_DATA.events, ...dbEvents];
    const filteredByDay = allEvents.filter(e => {
      const now = getPacificNow();
      if (filters.day === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return e.start >= today && e.start < tomorrow;
      }
      return true;
    });

    filteredByDay.forEach(event => {
      const hour = event.start.getHours();
      const minute = event.start.getMinutes();
      const timeStr = `${hour}:${String(minute).padStart(2, '0')}`;
      slots.add(timeStr);
    });

    return Array.from(slots).sort((a, b) => {
      const [aHour, aMin] = a.split(':').map(Number);
      const [bHour, bMin] = b.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
  };

  const handleSignOut = async () => {
    await signOut();
    setShowProfileMenu(false);
  };

  const handleClaimBusiness = async () => {
    if (!claimFormData.businessName || !claimFormData.ownerName || !claimFormData.email) {
      setCalendarToastMessage('Please fill in all required fields');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 3000);
      return;
    }
    if (!session?.user?.id) {
      // This shouldn't happen since we show sign-in prompt, but just in case
      setShowClaimBusinessModal(false);
      setShowAuthModal(true);
      return;
    }
    setClaimSubmitting(true);
    try {
      const claimData = {
        user_id: session.user.id,
        business_name: claimSelectedBusiness?.name || claimFormData.businessName,
        business_address: claimSelectedBusiness?.address || claimFormData.address || null,
        owner_name: claimFormData.ownerName,
        contact_email: claimFormData.email,
        contact_phone: claimFormData.phone || null,
        owner_role: claimFormData.role,
        status: user.isAdmin ? 'verified' : 'pending'
      };
      // Add business_id if selecting from directory
      if (claimSelectedBusiness?.id) {
        claimData.business_id = claimSelectedBusiness.id;
      }
      const { error } = await supabase.from('business_claims').insert(claimData);
      if (error) throw error;
      setShowClaimBusinessModal(false);
      setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
      setClaimSelectedBusiness(null);
      setClaimSearchQuery('');
      if (user.isAdmin) {
        showToast('Business claimed and verified!', 'success');
        // Refresh user data to pick up the new claim
        if (typeof refreshUserData === 'function') refreshUserData();
      } else {
        showToast('Claim submitted! We\'ll review it shortly.', 'success');
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      setCalendarToastMessage('Error submitting claim. Please try again.');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 3000);
    } finally {
      setClaimSubmitting(false);
    }
  };

  const getVenueName = (venueId, event) => {
    // For database events that have venueName directly
    if (event?.venueName) return event.venueName;
    // For hardcoded events with venueId
    if (venueId) {
      const venue = REAL_DATA.venues.find(v => v.id === venueId);
      if (venue?.name) return venue.name;
    }
    // Fallback to venue_name field or title-based name
    return event?.venue_name || event?.title || '';
  };
  const isVerified = (venueId) => REAL_DATA.venues.find(v => v.id === venueId)?.verified || false;
  

  const filterEvents = () => {
    const now = getPacificNow(); // Always filter based on Squamish time
    // Combine hardcoded events with database events
    let filtered = [...REAL_DATA.events, ...dbEvents];

    // Filter out bad data - titles that are just booking status, not actual class names
    filtered = filtered.filter(e => {
      const title = e.title || '';
      // Skip entries where title is just booking status like "(8 Reserved, 2 Open)"
      if (/^\(\d+\s+Reserved,\s+\d+\s+Open\)$/.test(title)) return false;
      // Skip entries with no meaningful title
      if (title.length < 3) return false;
      return true;
    });

    // Filter by section (events vs classes)
    if (currentSection === 'events') {
      filtered = filtered.filter(e => e.eventType === 'event');
    } else if (currentSection === 'classes') {
      filtered = filtered.filter(e => e.eventType === 'class');
    }

    // Day filtering - for infinite scroll, we get events for next 30 days when "today" is selected
    // Only show events that haven't started yet (filter out past events from today)
    if (filters.day === 'today') {
      const thirtyDaysLater = new Date(now);
      thirtyDaysLater.setDate(now.getDate() + 30);
      filtered = filtered.filter(e => e.start >= now && e.start < thirtyDaysLater);
    } else if (filters.day === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(tomorrow.getDate() + 1);
      filtered = filtered.filter(e => e.start >= tomorrow && e.start < dayAfter);
    } else if (filters.day === 'thisWeekend') {
      const friday = new Date(now);
      const daysUntilFriday = (5 - now.getDay() + 7) % 7;
      friday.setDate(now.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);
      const monday = new Date(friday);
      monday.setDate(friday.getDate() + 3);
      filtered = filtered.filter(e => e.start >= friday && e.start < monday);
    } else if (filters.day === 'nextWeek') {
      const nextMonday = new Date(now);
      const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7;
      nextMonday.setDate(now.getDate() + daysUntilNextMonday);
      nextMonday.setHours(0, 0, 0, 0);
      const followingSunday = new Date(nextMonday);
      followingSunday.setDate(nextMonday.getDate() + 7);
      filtered = filtered.filter(e => e.start >= nextMonday && e.start < followingSunday);
    }
    // 'anytime' shows all future events

    // Search query
    if (searchQuery?.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(e =>
        e.title?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        getVenueName(e.venueId, e).toLowerCase().includes(query) ||
        e.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Age filtering
    if (filters.age === 'kids') {
      filtered = filtered.filter(e => {
        // Basic kids filter - must be for kids or all ages
        if (!e.ageGroup?.includes('Kids') && e.ageGroup !== 'All Ages') return false;

        // If specific age range is selected, match against event titles/descriptions
        if (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18) {
          // Extract age numbers from title/description
          const text = `${e.title} ${e.description}`.toLowerCase();

          // Check for prenatal
          if (kidsAgeRange[0] === -1 && kidsAgeRange[1] === 0) {
            return text.includes('prenatal') || text.includes('perinatal') || text.includes('pregnant');
          }

          // Try to extract age range from title like "(3-5)" or "Ages 4-8"
          const ageMatch = text.match(/(?:ages?\s*)?(\d+)\s*[-–]\s*(\d+)/i);
          if (ageMatch) {
            const eventMinAge = parseInt(ageMatch[1]);
            const eventMaxAge = parseInt(ageMatch[2]);
            // Check if event age range overlaps with selected range
            return eventMinAge <= kidsAgeRange[1] && eventMaxAge >= kidsAgeRange[0];
          }

          // If no age range found in title, include it (generic kids class)
          return true;
        }

        return true;
      });
    } else if (filters.age === 'adults') {
      filtered = filtered.filter(e => e.ageGroup?.includes('Adults') || e.ageGroup === 'All Ages' || e.ageGroup === '19+' || e.ageGroup === 'Teens & Adults');
    }

    // Category
    if (filters.category !== 'all') {
      filtered = filtered.filter(e => e.category === filters.category || (e.tags && e.tags.includes(filters.category)));
    }

    // Time of day
    // Time filtering - show classes from selected time onwards
    if (filters.time !== 'all') {
      const [filterHour, filterMin] = filters.time.split(':').map(Number);
      const filterMinutes = filterHour * 60 + filterMin;
      
      filtered = filtered.filter(e => {
        const eventHour = e.start.getHours();
        const eventMin = e.start.getMinutes();
        const eventMinutes = eventHour * 60 + eventMin;
        return eventMinutes >= filterMinutes;
      });
    }

    // Price
    if (filters.price === 'free') {
      filtered = filtered.filter(e => e.price?.toLowerCase() === 'free');
    } else if (filters.price === 'paid') {
      filtered = filtered.filter(e => e.price?.toLowerCase() !== 'free' && e.price);
    }

    // Location - simplified for demo
    if (filters.location !== 'all') {
      // In real app, would filter by venue location
      // For now, just keep all results
    }

    // Sort by featured, then by date
    return filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.start - b.start;
    });
  };

  // Group events by date for infinite scroll with dividers
  const groupEventsByDate = (events) => {
    const grouped = {};
    
    events.forEach(event => {
      const dateKey = event.start.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return grouped;
  };

  // Render events with date dividers
  const renderEventsWithDividers = () => {
    // Show loading state while fetching database events
    if (eventsLoading) {
      return (
        <div className="loading-state" style={{padding: '40px 20px', textAlign: 'center'}}>
          <div style={{fontSize: '14px', color: '#6b7280'}}>Loading {currentSection}...</div>
        </div>
      );
    }

    const events = filterEvents();
    if (events.length === 0) {
      return (
        <div className="empty-state">
          <p>No {currentSection} found matching your filters.</p>
          <button onClick={() => {
            setFilters({ day: 'today', age: 'all', category: 'all', time: 'all', price: 'all', location: 'all' });
            setKidsAgeRange([0, 18]);
            setSearchQuery('');
          }}>
            Clear Filters
          </button>
        </div>
      );
    }

    const groupedEvents = groupEventsByDate(events);
    const dateKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));
    const now = getPacificNow();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let globalEventIndex = 0; // Global counter for refs

    return dateKeys.map((dateKey, index) => {
      // Use first event's date for formatting to avoid timezone re-parse issues
      const firstEvent = groupedEvents[dateKey][0];
      const date = firstEvent.start;
      const isToday = dateKey === today.toDateString();
      const isTomorrow = dateKey === tomorrow.toDateString();

      let dateLabelText;
      if (isToday) {
        dateLabelText = 'Today';
      } else if (isTomorrow) {
        dateLabelText = 'Tomorrow';
      } else {
        dateLabelText = date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
      }

      const fullDateSubtext = date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      return (
        <div key={dateKey}>
          {index > 0 && <div className="date-divider">
            <div className="date-divider-line"></div>
            <div className="date-divider-content">
              <div className="date-divider-label">{dateLabelText}</div>
              {(isToday || isTomorrow) && <div className="date-divider-subtext">{fullDateSubtext}</div>}
            </div>
            <div className="date-divider-line"></div>
          </div>}
          
          {groupedEvents[dateKey].map((event) => {
            const currentIndex = globalEventIndex++;
            return <EventCard key={event.id} event={event} ref={(el) => eventCardRefs.current[currentIndex] = el} />;
          })}
        </div>
      );
    });
  };

  const filterDeals = () => {
    // Combine hardcoded deals with database deals
    let filtered = [...REAL_DATA.deals, ...dbDeals];

    // Filter out vague deals with no real value
    filtered = filtered.filter(deal => isRealDeal(deal));

    if (searchQuery?.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(d =>
        d.title?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query) ||
        d.venueName?.toLowerCase().includes(query) ||
        getVenueName(d.venueId, d).toLowerCase().includes(query)
      );
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(d => d.category === filters.category);
    }

    // Sort by deal score (best deals first)
    return filtered.sort((a, b) => {
      const scoreA = calculateDealScore(a);
      const scoreB = calculateDealScore(b);
      return scoreB - scoreA; // Higher score = better deal = first
    });
  };

  const toggleSave = useCallback(async (id, type, name = '', data = {}) => {
    const itemKey = `${type}-${id}`;

    if (!isAuthenticated) {
      // Use local storage when not logged in
      setLocalSavedItems(prev => {
        const exists = prev.includes(itemKey);
        const newSaves = exists
          ? prev.filter(k => k !== itemKey)
          : [...prev, itemKey];
        localStorage.setItem('pulse_local_saves', JSON.stringify(newSaves));
        return newSaves;
      });
      return;
    }

    // Optimistic update for logged-in users
    const wasIncluded = localSavedItems.includes(itemKey);
    setLocalSavedItems(prev => {
      const exists = prev.includes(itemKey);
      return exists ? prev.filter(k => k !== itemKey) : [...prev, itemKey];
    });

    try {
      const result = await toggleSaveItem(type, String(id), name, data);
      if (result?.error) {
        // Revert optimistic update on error
        setLocalSavedItems(prev => wasIncluded ? [...prev, itemKey] : prev.filter(k => k !== itemKey));
        showToast('Failed to save. Please try again.', 'error');
      }
    } catch {
      // Revert optimistic update on error
      setLocalSavedItems(prev => wasIncluded ? [...prev, itemKey] : prev.filter(k => k !== itemKey));
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [isAuthenticated, toggleSaveItem, localSavedItems, showToast]);

  // Combined check for saved items (local + database)
  const isItemSavedLocal = useCallback((type, id) => {
    const itemKey = `${type}-${id}`;
    return localSavedItems.includes(itemKey) || isItemSaved(type, String(id));
  }, [localSavedItems, isItemSaved]);

  // Debounce search for smoother performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Card scroll-in animations (IntersectionObserver)
  useCardAnimation(dealCardRefs, 'deal-card-visible', [currentSection, dealCategoryFilter, searchQuery]);
  useCardAnimation(eventCardRefs, 'event-card-visible', [currentSection, filters, searchQuery]);
  useCardAnimation(serviceCardRefs, 'service-card-visible', [currentSection, serviceCategoryFilter, searchQuery]);
  useCardAnimation(classCardRefs, 'class-card-visible', [currentSection]);
  useCardAnimation(venueCardRefs, 'venue-card-visible', [currentSection], { checkInitial: false });

  const EventCard = React.forwardRef(({ event }, ref) => {
    const itemType = event.eventType === 'class' ? 'class' : 'event';
    const isSaved = isItemSavedLocal(itemType, event.id);

    const handleSave = async (e) => {
      e.stopPropagation();
      await toggleSave(event.id, itemType, event.title, { venue: getVenueName(event.venueId, event), date: event.start ? event.start.toISOString() : event.date });
    };

    return (
      <div ref={ref} className="event-card" onClick={() => setSelectedEvent(event)}>
        <div className="event-card-header">
          <div className="event-title-section">
            <h3>{event.title}</h3>
            {REAL_DATA.venues.find(v => v.id === event.venueId)?.verified && (
              <div
                className="verified-badge-premium-inline"
                onClick={(e) => e.stopPropagation()}
                data-tooltip="Verified"
              >
                <Check size={12} strokeWidth={3} />
              </div>
            )}
          </div>
        </div>

        <div className="event-card-body">
          <div className="event-detail-row">
            <div className="event-detail-item">
              <div className="detail-icon">
                <Calendar size={16} />
              </div>
              <span className="detail-text">{event.start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="event-detail-item">
              <div className="detail-icon">
                <Clock size={16} />
              </div>
              <span className="detail-text">{event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="event-detail-row">
            <div className="event-detail-item venue-item">
              <div className="detail-icon">
                <MapPin size={16} />
              </div>
              <span className="detail-text">{getVenueName(event.venueId, event)}</span>
            </div>
          </div>

          <div className="event-badges-row">
            {event.ageGroup && <span className="event-badge age-badge">{event.ageGroup}</span>}
            {event.price && <span className="event-badge price-badge">{event.price}</span>}
            {event.recurrence !== 'none' && <span className="event-badge recurrence-badge">Recurring {event.recurrence}</span>}
          </div>
        </div>

        {/* Book button for classes */}
        {event.eventType === 'class' && (
          <button
            className="event-book-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleBookClick(event);
            }}
          >
            Book
          </button>
        )}

        <button
          className={`save-star-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          data-tooltip={isSaved ? "Saved" : "Save"}
          aria-label={isSaved ? "Remove from saved" : "Save to favorites"}
        >
          <Star size={24} fill={isSaved ? "#f59e0b" : "none"} stroke={isSaved ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
        </button>
        <ChevronRight className="event-chevron" size={20} />
      </div>
    );
  });

  return (
    <div className="pulse-app">
      <a href="#main-content" className="skip-to-content" style={{position:'absolute',left:'-9999px',top:'auto',width:'1px',height:'1px',overflow:'hidden',zIndex:9999}} onFocus={(e)=>{e.target.style.position='fixed';e.target.style.left='50%';e.target.style.top='8px';e.target.style.transform='translateX(-50%)';e.target.style.width='auto';e.target.style.height='auto';e.target.style.overflow='visible';e.target.style.background='#1f2937';e.target.style.color='#fff';e.target.style.padding='8px 16px';e.target.style.borderRadius='8px';e.target.style.fontSize='14px';e.target.style.fontWeight='600';e.target.style.textDecoration='none';}} onBlur={(e)=>{e.target.style.position='absolute';e.target.style.left='-9999px';e.target.style.width='1px';e.target.style.height='1px';e.target.style.overflow='hidden';}}>Skip to content</a>
      <div className="view-switcher">
        <button className={view === 'consumer' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) setImpersonatedBusiness(null); setView('consumer'); }}>Consumer</button>
        <button className={view === 'business' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) setImpersonatedBusiness(null); setView('business'); }}>Business</button>
        {user.isAdmin && (
          <button className={view === 'admin' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) { exitImpersonation(); } else { setView('admin'); } }}>Admin</button>
        )}
      </div>

      {view === 'consumer' && (
        <div className="consumer-view">
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
                    {/* Location Pin Outline - teardrop shape */}
                    <path d="M50 8C33 8 19 22 19 39C19 52 28 63 50 95C72 63 81 52 81 39C81 22 67 8 50 8Z" 
                          stroke="url(#pulseGradient)" 
                          strokeWidth="7" 
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"/>
                    
                    {/* Large Circle inside pin */}
                    <circle cx="50" cy="39" r="22" 
                            stroke="url(#pulseGradient)" 
                            strokeWidth="7" 
                            fill="none"/>
                    
                    {/* Pulse wave - centered and simplified */}
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

          {/* Top Banner Navigation - Premium */}
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

          {/* Search Bar - Premium (hidden for wellness which has its own UI) */}
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

          {/* Premium Filter System - Clean 5-Filter Layout */}
          {(currentSection === 'events' || currentSection === 'classes') && (
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
                          setKidsAgeRange([0, 18]); // Reset when not kids
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
          )}

          <main className="content" id="main-content">
            {currentSection !== 'wellness' && (
            <div className="results-count" aria-live="polite" aria-atomic="true">
              {currentSection === 'deals' ? (
                dealsLoading ? 'Loading...' : `${filterDeals().filter(d => dealCategoryFilter === 'All' || normalizeDealCategory(d.category) === dealCategoryFilter).length} results`
              ) : currentSection === 'services' ? (
                `${services.filter(s => {
                  if (debouncedSearch) {
                    const query = debouncedSearch.toLowerCase().trim();
                    if (!s.name.toLowerCase().includes(query) && !s.category.toLowerCase().includes(query) && !s.address?.toLowerCase().includes(query)) return false;
                  }
                  if (serviceCategoryFilter === 'All') return true;
                  const mainCategories = ['Restaurants & Dining', 'Retail & Shopping', 'Cafes & Bakeries', 'Outdoor Adventures', 'Auto Services', 'Real Estate', 'Fitness & Gyms', 'Recreation & Sports', 'Health & Wellness', 'Construction & Building', 'Outdoor Gear & Shops', 'Community Services', 'Hotels & Lodging', 'Web & Marketing', 'Financial Services', 'Medical Clinics', 'Photography', 'Attractions', 'Churches & Religious', 'Salons & Spas', 'Arts & Culture'];
                  if (serviceCategoryFilter === 'Other') return !mainCategories.includes(s.category);
                  return s.category === serviceCategoryFilter;
                }).length} results`
              ) : (
                eventsLoading ? 'Loading...' : `${filterEvents().length} results`
              )}
            </div>
            )}

            {currentSection === 'deals' ? (
              <>
                {/* Deals Filter */}
                <div className="filters-section" style={{marginTop: '20px'}}>
                  <div className="filters-row-single">
                    <div className="filter-group">
                      <select
                        value={dealCategoryFilter}
                        onChange={(e) => setDealCategoryFilter(e.target.value)}
                        className="filter-dropdown"
                        aria-label="Filter deals by category"
                      >
                        <option value="All">💰 All Deals</option>
                        <option value="Food & Drink">🍔 Food & Drink</option>
                        <option value="Shopping">🛍️ Shopping</option>
                        <option value="Services">🔧 Services</option>
                        <option value="Fitness">💪 Fitness</option>
                        <option value="Recreation">🎯 Recreation</option>
                        <option value="Wellness">🧘 Wellness</option>
                        <option value="Accommodations">🏨 Accommodations</option>
                        <option value="Family">👨‍👩‍👧‍👦 Family</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="deals-grid">
                  {filterDeals()
                    .filter(deal => {
                      if (dealCategoryFilter === 'All') return true;
                      // Use normalized category for filtering
                      return normalizeDealCategory(deal.category) === dealCategoryFilter;
                    })
                    .map((deal, index) => (
                  <div
                    key={deal.id}
                    className="deal-card"
                    onClick={() => setSelectedDeal(deal)}
                    ref={(el) => dealCardRefs.current[index] = el}
                  >
                    {/* Prominent savings badge at top */}
                    {getDealSavingsDisplay(deal) && (
                      <div className={`deal-savings-badge savings-${getDealSavingsDisplay(deal).type}`}>
                        {getDealSavingsDisplay(deal).text}
                      </div>
                    )}

                    <div className="deal-card-header-new">
                      <div className="deal-title-section">
                        <h3>{generateSmartDealTitle(deal, getVenueName(deal.venueId, deal))}</h3>
                        {deal.verified && (
                          <div
                            className="verified-badge-premium"
                            onClick={(e) => e.stopPropagation()}
                            data-tooltip="Verified"
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="deal-card-body-new">
                      <div className="deal-detail-row">
                        <div className="deal-detail-item">
                          <div className="detail-icon venue-icon">
                            <MapPin size={16} />
                          </div>
                          <span className="detail-text">{getVenueName(deal.venueId, deal)}</span>
                        </div>
                      </div>

                      {deal.schedule && (
                        <div className="deal-detail-row">
                          <div className="deal-detail-item full-width">
                            <div className="detail-icon clock-icon">
                              <Clock size={16} />
                            </div>
                            <span className="detail-text">{deal.schedule}</span>
                          </div>
                        </div>
                      )}

                      {deal.description && deal.description.toLowerCase() !== deal.title.toLowerCase() && (
                        <p className="deal-description-new">{deal.description.length > 80 ? deal.description.substring(0, 77) + '...' : deal.description}</p>
                      )}
                    </div>

                    <button
                      className={`save-star-btn ${isItemSavedLocal('deal', deal.id) ? 'saved' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSave(deal.id, 'deal', deal.title, { venue: getVenueName(deal.venueId, deal) });
                      }}
                      data-tooltip={isItemSavedLocal('deal', deal.id) ? "Saved" : "Save"}
                      aria-label={isItemSavedLocal('deal', deal.id) ? "Remove from saved" : "Save to favorites"}
                    >
                      <Star size={24} fill={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "none"} stroke={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
                    </button>
                    <ChevronRight className="deal-chevron" size={20} />
                  </div>
                ))}
              </div>
              {/* Deals empty state */}
              {!dealsLoading && filterDeals().filter(d => dealCategoryFilter === 'All' || normalizeDealCategory(d.category) === dealCategoryFilter).length === 0 && (
                <div className="no-results-state" style={{textAlign: 'center', padding: '40px 20px', color: '#6b7280'}}>
                  <DollarSign size={48} style={{color: '#d1d5db', marginBottom: '12px'}} />
                  <h3 style={{color: '#374151', marginBottom: '8px'}}>No deals found</h3>
                  <p>{searchQuery ? `No deals matching "${searchQuery}"` : 'No deals in this category'}</p>
                  {(searchQuery || dealCategoryFilter !== 'All') && (
                    <button onClick={() => { setSearchQuery(''); setDealCategoryFilter('All'); }} className="clear-search-btn" style={{marginTop: '12px', padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600}}>
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
              </>
            ) : currentSection === 'services' ? (
              <>
                {servicesSubView === 'booking' ? (
                  <WellnessBooking
                    onBack={() => setServicesSubView('directory')}
                    isAuthenticated={isAuthenticated}
                    session={session}
                    showToast={showToast}
                    setShowAuthModal={setShowAuthModal}
                  />
                ) : (
                <>
                {/* Services Filter */}
                <div className="filters-section" style={{marginTop: '20px'}}>
                  <div className="filters-row-single">
                    <div className="filter-group">
                      <select
                        value={serviceCategoryFilter}
                        onChange={(e) => setServiceCategoryFilter(e.target.value)}
                        className="filter-dropdown"
                        aria-label="Filter services by category"
                      >
                        <option value="All">🔧 All Services</option>
                        <option value="Restaurants & Dining">🍽️ Restaurants & Dining</option>
                        <option value="Retail & Shopping">🛍️ Retail & Shopping</option>
                        <option value="Cafes & Bakeries">☕ Cafes & Bakeries</option>
                        <option value="Outdoor Adventures">🏔️ Outdoor Adventures</option>
                        <option value="Auto Services">🚗 Auto Services</option>
                        <option value="Real Estate">🏘️ Real Estate</option>
                        <option value="Fitness & Gyms">💪 Fitness & Gyms</option>
                        <option value="Recreation & Sports">⚽ Recreation & Sports</option>
                        <option value="Health & Wellness">🧘 Health & Wellness</option>
                        <option value="Construction & Building">🏗️ Construction & Building</option>
                        <option value="Outdoor Gear & Shops">🎒 Outdoor Gear & Shops</option>
                        <option value="Community Services">🤝 Community Services</option>
                        <option value="Hotels & Lodging">🏨 Hotels & Lodging</option>
                        <option value="Web & Marketing">💻 Web & Marketing</option>
                        <option value="Financial Services">💰 Financial Services</option>
                        <option value="Medical Clinics">🏥 Medical Clinics</option>
                        <option value="Photography">📸 Photography</option>
                        <option value="Attractions">🎡 Attractions</option>
                        <option value="Churches & Religious">⛪ Churches & Religious</option>
                        <option value="Salons & Spas">💇 Salons & Spas</option>
                        <option value="Arts & Culture">🎨 Arts & Culture</option>
                        <option value="Other">📋 Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Search Results Count */}
                {debouncedSearch && (
                  <div className="search-results-count">
                    <span className="results-text">
                      {(() => {
                        const count = services.filter(service => {
                          const query = debouncedSearch.toLowerCase().trim();
                          return service.name.toLowerCase().includes(query) ||
                                 service.category.toLowerCase().includes(query) ||
                                 service.address?.toLowerCase().includes(query);
                        }).length;
                        return count === 0 ? 'No results' : `${count} result${count !== 1 ? 's' : ''} for "${searchQuery}"`;
                      })()}
                    </span>
                  </div>
                )}
                
                <div className="services-grid" key={debouncedSearch}>
                  {servicesLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                      Loading services...
                    </div>
                  ) : services
                    .filter(service => {
                      // Search filter - search in name, category, and address
                      if (debouncedSearch) {
                        const query = debouncedSearch.toLowerCase().trim();
                        const nameMatch = service.name.toLowerCase().includes(query);
                        const categoryMatch = service.category.toLowerCase().includes(query);
                        const addressMatch = service.address?.toLowerCase().includes(query);
                        if (!nameMatch && !categoryMatch && !addressMatch) {
                          return false;
                        }
                      }
                      
                      // Category filter
                      if (serviceCategoryFilter === 'All') return true;

                      // Main categories with 10+ businesses - exact match
                      const mainCategories = [
                        'Restaurants & Dining', 'Retail & Shopping', 'Cafes & Bakeries',
                        'Outdoor Adventures', 'Auto Services', 'Real Estate',
                        'Fitness & Gyms', 'Recreation & Sports', 'Health & Wellness',
                        'Construction & Building', 'Outdoor Gear & Shops', 'Community Services',
                        'Hotels & Lodging', 'Web & Marketing', 'Financial Services',
                        'Medical Clinics', 'Photography', 'Attractions',
                        'Churches & Religious', 'Salons & Spas', 'Arts & Culture'
                      ];

                      // "Other" catches everything not in main categories
                      if (serviceCategoryFilter === 'Other') {
                        return !mainCategories.includes(service.category);
                      }

                      // Exact category match
                      return service.category === serviceCategoryFilter;
                    })
                    .sort((a, b) => {
                      // Tiered sorting system
                      const aReviews = a.reviews || 0;
                      const bReviews = b.reviews || 0;
                      const aRating = a.rating || 0;
                      const bRating = b.rating || 0;
                      
                      // Tier 1: 50+ reviews AND 4+ stars
                      const aIsTier1 = aReviews >= 50 && aRating >= 4;
                      const bIsTier1 = bReviews >= 50 && bRating >= 4;
                      
                      // If one is Tier 1 and other isn't, Tier 1 comes first
                      if (aIsTier1 && !bIsTier1) return -1;
                      if (!aIsTier1 && bIsTier1) return 1;
                      
                      // Within same tier, sort by rating (highest first), then by reviews as tiebreaker
                      if (bRating !== aRating) return bRating - aRating;
                      return bReviews - aReviews;
                    })
                    .map((service, index) => {
                      // Check if this is a Tier 1 business (50+ reviews AND 4+ stars)
                      const isTier1 = (service.reviews || 0) >= 50 && (service.rating || 0) >= 4;
                      
                      // Generate social proof - uses real Pulse data when available, falls back to Google data
                      const getSocialProof = (svc, idx, tier1) => {
                        const reviews = svc.reviews || 0;
                        const rating = svc.rating || 0;

                        // If service has pre-fetched Pulse social proof data, use it
                        if (svc.pulseData) {
                          const pd = svc.pulseData;
                          // Jobs completed on Pulse
                          if (pd.jobs_completed >= 100) {
                            return { type: 'volume', text: `📈 ${pd.jobs_completed}+ jobs completed on Pulse` };
                          }
                          // Neighbors hired
                          if (pd.neighbor_hires >= 3) {
                            return { type: 'neighbor', text: `👥 ${pd.neighbor_hires} neighbors hired them` };
                          }
                          // Fast response
                          if (pd.response_time_minutes && pd.response_time_minutes <= 60) {
                            const timeText = formatResponseTime(pd.response_time_minutes);
                            return { type: 'response', text: `⚡ Responds in ${timeText}` };
                          }
                          // Testimonial
                          if (pd.testimonial) {
                            const quote = pd.testimonial.quote.length > 40
                              ? pd.testimonial.quote.substring(0, 40) + '...'
                              : pd.testimonial.quote;
                            return { type: 'testimonial', text: `💬 "${quote}" — ${pd.testimonial.author}` };
                          }
                          // Satisfaction rate
                          if (pd.satisfaction_rate >= 95) {
                            return { type: 'satisfaction', text: `✅ ${pd.satisfaction_rate}% satisfaction rate` };
                          }
                          // Years active
                          if (pd.years_active >= 5) {
                            return { type: 'longevity', text: `📅 ${pd.years_active} years serving Squamish` };
                          }
                          // Some jobs completed
                          if (pd.jobs_completed >= 10) {
                            return { type: 'trusted', text: `✅ ${pd.jobs_completed} jobs completed on Pulse` };
                          }
                        }

                        // Fallback to Google data
                        if (tier1 && idx < 3 && rating >= 4.5) {
                          return { type: 'rank', text: `⭐ Top rated in ${svc.category.split('&')[0].trim()}` };
                        }

                        if (rating >= 4.8 && reviews >= 50) {
                          return { type: 'excellent', text: `⭐ ${rating} rating from ${reviews} Google reviews` };
                        }

                        if (rating >= 4.5 && reviews >= 100) {
                          return { type: 'popular', text: `📍 ${reviews}+ reviews on Google` };
                        }

                        if (rating >= 4.5 && reviews >= 20) {
                          return { type: 'highrated', text: `⭐ Highly rated (${rating}/5)` };
                        }

                        if (reviews >= 50) {
                          return { type: 'reviewed', text: `📍 ${reviews} Google reviews` };
                        }

                        if (rating >= 4.0) {
                          return { type: 'rated', text: `⭐ ${rating}/5 on Google` };
                        }

                        // Default - just show it's a local business
                        return { type: 'default', text: '📍 Local Squamish Business' };
                      };

                      const socialProof = getSocialProof(service, index, isTier1);
                      
                      return (
                    <div key={service.id} className="service-card" ref={(el) => serviceCardRefs.current[index] = el} onClick={() => setSelectedService(service)}>
                      <div className="service-card-header-new">
                        <div className="service-title-section">
                          <h3>{service.name}</h3>
                          
                        </div>
                        {service.rating && (
                          <div className="service-rating-badge">
                            <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                            <span>{service.rating}</span>
                            {service.reviews && <span className="review-count">({service.reviews})</span>}
                          </div>
                        )}
                      </div>

                      <div className="service-card-body-new">
                        <div className="service-detail-row">
                          <div className="service-detail-item">
                            <div className="detail-icon category-icon">
                              <Wrench size={16} />
                            </div>
                            <span className="detail-text service-category-text">{service.category}</span>
                          </div>
                        </div>

                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.name + ' ' + service.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="service-detail-row service-link-row"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="service-detail-item">
                            <div className="detail-icon location-icon">
                              <MapPin size={16} />
                            </div>
                            <span className="detail-text detail-link">{service.address}</span>
                          </div>
                        </a>
                      </div>

                      {/* Social Proof Banner with Arrow */}
                      <div className={`service-social-proof ${socialProof.type}`}>
                        <span className="social-proof-text">{socialProof.text}</span>
                        <div className="social-proof-arrow">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                      );
                    })}
                </div>
                {/* No results state for services */}
                {debouncedSearch && services.filter(service => {
                  const query = debouncedSearch.toLowerCase().trim();
                  return service.name.toLowerCase().includes(query) ||
                         service.category.toLowerCase().includes(query) ||
                         service.address?.toLowerCase().includes(query);
                }).length === 0 && (
                  <div className="no-results-state">
                    <div className="no-results-icon">🔍</div>
                    <h3>No businesses found for "{searchQuery}"</h3>
                    <p>Try a different search term or browse all services</p>
                    <button onClick={() => setSearchQuery('')} className="clear-search-btn">
                      Clear Search
                    </button>
                  </div>
                )}
              </>
                )}
              </>
            ) : currentSection === 'wellness' ? (
              <WellnessBooking
                onBack={() => setCurrentSection('services')}
                isAuthenticated={isAuthenticated}
                session={session}
                showToast={showToast}
                setShowAuthModal={setShowAuthModal}
              />
            ) : (
              <div className="events-list">
                {renderEventsWithDividers()}
              </div>
            )}
          </main>

          {/* Event/Class Detail Modal */}
          {selectedEvent && (
            <EventDetailModal
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              getVenueName={getVenueName}
              isVerified={isVerified}
              isInMyCalendar={isInMyCalendar}
              addToCalendar={addToCalendar}
              handleBookClick={handleBookClick}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={(msg) => { setCalendarToastMessage(msg); setShowCalendarToast(true); setTimeout(() => setShowCalendarToast(false), 2000); }}
            />
          )}

          {/* Deal Detail Modal */}
          {selectedDeal && (
            <DealDetailModal
              deal={selectedDeal}
              onClose={() => setSelectedDeal(null)}
              getVenueName={getVenueName}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={(msg, type, duration) => {
                if (type === 'error') { showToast(msg, 'error'); return; }
                setCalendarToastMessage(msg);
                setShowCalendarToast(true);
                setTimeout(() => setShowCalendarToast(false), duration || 2000);
              }}
              onSelectDeal={setSelectedDeal}
              session={session}
              onAuthRequired={() => setShowAuthModal(true)}
              supabase={supabase}
              allDeals={[...REAL_DATA.deals, ...dbDeals]}
            />
          )}
          {/* Service Detail Modal */}
          {selectedService && (
            <ServiceDetailModal
              service={selectedService}
              onClose={() => setSelectedService(null)}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={showToast}
            />
          )}

          {/* Floating Action Button - Premium */}
          <button className="fab-premium" onClick={() => { if (user.isGuest) { setShowAuthModal(true); return; } setShowAddEventModal(true); }}>
            <Plus size={24} strokeWidth={2.5} />
            <span className="fab-label">Add Event</span>
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="profile-menu-overlay" onClick={() => setShowProfileMenu(false)}>
              <div className="profile-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="profile-menu-header">
                  <div className="profile-avatar large">{user.avatar ? <img src={user.avatar} alt="" /> : (user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U')}</div>
                  <div className="profile-menu-info">
                    <h3>{user.name || 'Guest'}</h3>
                    <p>{user.email || 'Not signed in'}</p>
                  </div>
                </div>
                <div className="profile-menu-divider"></div>
                <div className="profile-menu-items">
                  <button className="profile-menu-item" onClick={() => { setShowProfileModal(true); setProfileTab('overview'); setShowProfileMenu(false); }}>
                    <Users size={18} />
                    <span>My Profile</span>
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowMyCalendarModal(true); setShowProfileMenu(false); }}>
                    <Calendar size={18} />
                    <span>My Calendar</span>
                    {myCalendar.length > 0 && <span className="menu-badge">{myCalendar.length}</span>}
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowProfileModal(true); setProfileTab('saved'); setShowProfileMenu(false); }}>
                    <Star size={18} />
                    <span>Saved Items</span>
                  </button>
                  <div className="profile-menu-divider"></div>
                  <button className="profile-menu-item" onClick={() => { setShowProfileMenu(false); openSubmissionModal(); }}>
                    <Plus size={18} />
                    <span>Add Event / Class / Deal</span>
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowClaimBusinessModal(true); setShowProfileMenu(false); }}>
                    <Building size={18} />
                    <span>Claim Business</span>
                  </button>
                  {user.isAdmin && (
                    <>
                      <div className="profile-menu-divider"></div>
                      <button className="profile-menu-item admin" onClick={() => { setShowAdminPanel(true); setShowProfileMenu(false); }}>
                        <Eye size={18} />
                        <span>Admin Panel</span>
                        {pendingSubmissions.filter(s => s.status === 'pending').length > 0 && (
                          <span className="menu-badge admin">{pendingSubmissions.filter(s => s.status === 'pending').length}</span>
                        )}
                      </button>
                    </>
                  )}
                  <div className="profile-menu-divider"></div>
                  <button className="profile-menu-item" onClick={() => { setShowProfileModal(true); setProfileTab('settings'); setShowProfileMenu(false); }}>
                    <SlidersHorizontal size={18} />
                    <span>Settings</span>
                  </button>
                </div>
                <div className="profile-menu-divider"></div>
                <button className="profile-menu-item logout" onClick={handleSignOut}>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Add Event Modal */}
          {showAddEventModal && (
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add event" onClick={closeAddEventModal}>
              <div className="modal-content add-event-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={closeAddEventModal}><X size={24} /></button>
                <div className="modal-header-premium">
                  <Plus size={32} className="modal-icon" />
                  <h2>Add Your Event</h2>
                  <p>Share your event with the Squamish community</p>
                </div>
                <div className="modal-body-premium">
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem', textAlign: 'center' }}>Choose what you'd like to add to the Squamish community</p>
                  <div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn-primary" onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('event');
                    }}><Calendar size={18} style={{ marginRight: '0.5rem' }} /> Submit an Event</button>
                    <button className="btn-primary" style={{ background: '#8b5cf6' }} onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('class');
                    }}><Sparkles size={18} style={{ marginRight: '0.5rem' }} /> Submit a Class</button>
                    <button className="btn-primary" style={{ background: '#f59e0b' }} onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('deal');
                    }}><Percent size={18} style={{ marginRight: '0.5rem' }} /> Submit a Deal</button>
                    <button className="btn-secondary" onClick={closeAddEventModal}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Claim Business Modal - Premium Purple Theme */}
          {showClaimBusinessModal && (
            <ClaimBusinessModal
              claimSearchQuery={claimSearchQuery}
              setClaimSearchQuery={setClaimSearchQuery}
              claimSelectedBusiness={claimSelectedBusiness}
              setClaimSelectedBusiness={setClaimSelectedBusiness}
              claimFormData={claimFormData}
              setClaimFormData={setClaimFormData}
              claimSubmitting={claimSubmitting}
              session={session}
              services={services}
              onClose={() => { setShowClaimBusinessModal(false); setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' }); }}
              setShowAuthModal={setShowAuthModal}
              handleClaimBusiness={handleClaimBusiness}
            />
          )}

          {/* My Calendar Modal - Premium */}
          {showMyCalendarModal && (
            <MyCalendarModal
              myCalendar={myCalendar}
              showCalendarToast={showCalendarToast}
              calendarToastMessage={calendarToastMessage}
              onClose={() => setShowMyCalendarModal(false)}
              setCurrentSection={setCurrentSection}
              setCalendarToastMessage={setCalendarToastMessage}
              setShowCalendarToast={setShowCalendarToast}
              getCalendarEventsByDate={getCalendarEventsByDate}
              getVenueName={getVenueName}
              generateGoogleCalendarUrl={generateGoogleCalendarUrl}
              removeFromCalendar={removeFromCalendar}
            />
          )}

          {/* Calendar Toast Notification */}
          {showCalendarToast && (
            <div className="calendar-toast" role="alert" aria-live="assertive">
              <div className="toast-icon">
                <Calendar size={20} />
              </div>
              <span>{calendarToastMessage}</span>
            </div>
          )}

          {/* Submission Modal - Add Event/Class/Deal */}
          {showSubmissionModal && (
            <SubmissionModal
              submissionStep={submissionStep}
              submissionType={submissionType}
              submissionForm={submissionForm}
              setSubmissionForm={setSubmissionForm}
              showImageCropper={showImageCropper}
              cropperImage={cropperImage}
              cropPosition={cropPosition}
              setCropPosition={setCropPosition}
              cropZoom={cropZoom}
              setCropZoom={setCropZoom}
              cropperType={cropperType}
              userClaimedBusinesses={userClaimedBusinesses}
              user={user}
              onClose={closeSubmissionModal}
              setSubmissionStep={setSubmissionStep}
              setSubmissionType={setSubmissionType}
              setShowImageCropper={setShowImageCropper}
              setCropperImage={setCropperImage}
              setCropperType={setCropperType}
              selectSubmissionType={selectSubmissionType}
              selectBusinessType={selectBusinessType}
              removeImage={removeImage}
              handleImageSelect={handleImageSelect}
              handleCropComplete={handleCropComplete}
              submitForApproval={submitForApproval}
              getSelectedBusinessInfo={getSelectedBusinessInfo}
              showToast={showToast}
            />
          )}

          {/* Premium Profile Modal */}
          {showProfileModal && (
            <ProfileModal
              user={user}
              session={session}
              userStats={userStats}
              userAchievements={userAchievements}
              userActivity={userActivity}
              savedItems={savedItems}
              localSavedItems={localSavedItems}
              userClaimedBusinesses={userClaimedBusinesses}
              activeBusiness={activeBusiness}
              profileTab={profileTab}
              setProfileTab={setProfileTab}
              activityFilter={activityFilter}
              setActivityFilter={setActivityFilter}
              savedItemsFilter={savedItemsFilter}
              setSavedItemsFilter={setSavedItemsFilter}
              onClose={() => setShowProfileModal(false)}
              setView={setView}
              setShowClaimBusinessModal={setShowClaimBusinessModal}
              setShowSubmissionModal={setShowSubmissionModal}
              setSubmissionStep={setSubmissionStep}
              setSubmissionType={setSubmissionType}
              setEditingVenue={setEditingVenue}
              setEditVenueForm={setEditVenueForm}
              setShowEditVenueModal={setShowEditVenueModal}
              setUser={setUser}
              setLocalSavedItems={setLocalSavedItems}
              setCalendarToastMessage={setCalendarToastMessage}
              setShowCalendarToast={setShowCalendarToast}
              handleImageSelect={handleImageSelect}
              getVenueName={getVenueName}
              getBusinessForEvent={getBusinessForEvent}
              trackAnalytics={trackAnalytics}
              addToCalendar={addToCalendar}
              updateProfile={updateProfile}
              showToast={showToast}
              toggleSaveItem={toggleSaveItem}
            />
          )}
          {/* Booking Bottom Sheet */}
          {showBookingSheet && bookingEvent && (
            <BookingSheet
              bookingEvent={bookingEvent}
              bookingStep={bookingStep}
              bookingRequestMessage={bookingRequestMessage}
              setBookingRequestMessage={setBookingRequestMessage}
              sendingMessage={sendingMessage}
              onClose={closeBookingSheet}
              getVenueName={getVenueName}
              getBusinessForEvent={getBusinessForEvent}
              trackAnalytics={trackAnalytics}
              addToCalendar={addToCalendar}
              submitBookingRequest={submitBookingRequest}
              setCalendarToastMessage={setCalendarToastMessage}
              setShowCalendarToast={setShowCalendarToast}
            />
          )}

          {/* Booking Confirmation Dialog */}
          {showBookingConfirmation && (
            <div className="modal-overlay confirmation-overlay" role="dialog" aria-modal="true" aria-label="Confirm booking">
              <div className="confirmation-dialog">
                <div className="confirmation-icon">
                  <CheckCircle size={48} />
                </div>
                <h3>Did you complete your booking?</h3>
                <p>Let us know so we can add it to your calendar.</p>
                <div className="confirmation-buttons">
                  <button
                    className="confirm-btn yes"
                    onClick={() => handleBookingConfirmation(true)}
                  >
                    <Check size={18} />
                    Yes, I booked
                  </button>
                  <button
                    className="confirm-btn no"
                    onClick={() => handleBookingConfirmation(false)}
                  >
                    No, just browsing
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contact Business Sheet */}
          {showContactSheet && contactBusiness && (
            <ContactSheet
              contactBusiness={contactBusiness}
              contactSubject={contactSubject}
              setContactSubject={setContactSubject}
              contactMessage={contactMessage}
              setContactMessage={setContactMessage}
              sendingMessage={sendingMessage}
              onClose={() => setShowContactSheet(false)}
              submitContactForm={submitContactForm}
            />
          )}

          {/* Messages Modal */}
          {showMessagesModal && (
            <MessagesModal
              currentConversation={currentConversation}
              setCurrentConversation={setCurrentConversation}
              conversationsLoading={conversationsLoading}
              conversations={conversations}
              messagesLoading={messagesLoading}
              conversationMessages={conversationMessages}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              sendingMessage={sendingMessage}
              onClose={() => { setShowMessagesModal(false); setCurrentConversation(null); }}
              fetchMessages={fetchMessages}
              sendMessage={sendMessage}
            />
          )}

          {/* Admin Panel Modal */}
          {showAdminPanel && user.isAdmin && (
            <AdminPanelModal
              adminTab={adminTab}
              setAdminTab={setAdminTab}
              pendingSubmissions={pendingSubmissions}
              onClose={() => setShowAdminPanel(false)}
              setView={setView}
              approveSubmission={approveSubmission}
              rejectSubmission={rejectSubmission}
            />
          )}
        </div>
      )}

      {view === 'business' && (
        <BusinessDashboard
          user={user}
          isImpersonating={isImpersonating}
          impersonatedBusiness={impersonatedBusiness}
          activeBusiness={activeBusiness}
          userClaimedBusinesses={userClaimedBusinesses}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
          businessAnalytics={businessAnalytics}
          dbEvents={dbEvents}
          businessInboxTab={businessInboxTab}
          setBusinessInboxTab={setBusinessInboxTab}
          businessConversations={businessConversations}
          businessConversationsLoading={businessConversationsLoading}
          selectedBusinessConversation={selectedBusinessConversation}
          setSelectedBusinessConversation={setSelectedBusinessConversation}
          businessMessagesLoading={businessMessagesLoading}
          businessMessages={businessMessages}
          businessReplyInput={businessReplyInput}
          setBusinessReplyInput={setBusinessReplyInput}
          sendingMessage={sendingMessage}
          eventsRefreshKey={eventsRefreshKey}
          setShowAuthModal={setShowAuthModal}
          setShowClaimBusinessModal={setShowClaimBusinessModal}
          setSelectedClaimedBusinessId={setSelectedClaimedBusinessId}
          setEditingEvent={setEditingEvent}
          setEditEventForm={setEditEventForm}
          setShowEditEventModal={setShowEditEventModal}
          setShowSubmissionModal={setShowSubmissionModal}
          setSubmissionStep={setSubmissionStep}
          setSubmissionType={setSubmissionType}
          setEditingVenue={setEditingVenue}
          setEditVenueForm={setEditVenueForm}
          setShowEditVenueModal={setShowEditVenueModal}
          setEventsRefreshKey={setEventsRefreshKey}
          fetchServices={fetchServices}
          showToast={showToast}
          exitImpersonation={exitImpersonation}
          fetchBusinessInbox={fetchBusinessInbox}
          fetchBusinessMessages={fetchBusinessMessages}
          markConversationResolved={markConversationResolved}
          sendBusinessReply={sendBusinessReply}
        />
      )}
      {view === 'admin' && (
        <AdminDashboard
          user={user}
          services={services}
          impersonateSearchQuery={impersonateSearchQuery}
          setImpersonateSearchQuery={setImpersonateSearchQuery}
          adminVerifiedCount={adminVerifiedCount}
          adminClaimedCount={adminClaimedCount}
          dbEvents={dbEvents}
          dbDeals={dbDeals}
          REAL_DATA={REAL_DATA}
          adminSearchQuery={adminSearchQuery}
          setAdminSearchQuery={setAdminSearchQuery}
          adminCategoryFilter={adminCategoryFilter}
          setAdminCategoryFilter={setAdminCategoryFilter}
          adminStatusFilter={adminStatusFilter}
          setAdminStatusFilter={setAdminStatusFilter}
          editingVenue={editingVenue}
          setEditingVenue={setEditingVenue}
          setEditVenueForm={setEditVenueForm}
          setShowEditVenueModal={setShowEditVenueModal}
          quickAddForm={quickAddForm}
          setQuickAddForm={setQuickAddForm}
          enterImpersonation={enterImpersonation}
          showToast={showToast}
          fetchServices={fetchServices}
          getPacificDateStr={getPacificDateStr}
          setView={setView}
        />
      )}

      {/* Edit Venue Modal - Global (works from any view) */}
      {showEditVenueModal && editingVenue && (
        <EditVenueModal
          editingVenue={editingVenue}
          editVenueForm={editVenueForm}
          setEditVenueForm={setEditVenueForm}
          onClose={() => { setShowEditVenueModal(false); setEditingVenue(null); }}
          showToast={showToast}
          fetchServices={fetchServices}
        />
      )}

      {/* Edit Event/Class Modal */}
      {showEditEventModal && editingEvent && (
        <EditEventModal
          editingEvent={editingEvent}
          editEventForm={editEventForm}
          setEditEventForm={setEditEventForm}
          onClose={() => { setShowEditEventModal(false); setEditingEvent(null); }}
          showToast={showToast}
          setEventsRefreshKey={setEventsRefreshKey}
        />
      )}

      {/* Global Image Cropper Modal - Works from any context */}
      {showImageCropper && cropperImage && (
        <ImageCropperModal
          cropperImage={cropperImage}
          cropperType={cropperType}
          cropPosition={cropPosition}
          setCropPosition={setCropPosition}
          cropZoom={cropZoom}
          setCropZoom={setCropZoom}
          onClose={closeImageCropper}
          handleCropComplete={handleCropComplete}
        />
      )}

      {/* ========== GLOBAL MODALS (render regardless of view) ========== */}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(msg) => {
            setCalendarToastMessage(msg);
            setShowCalendarToast(true);
            setTimeout(() => setShowCalendarToast(false), 5000);
          }}
        />
      )}

    </div>
  );
}
