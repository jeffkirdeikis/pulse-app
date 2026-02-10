import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, Check, X, Plus, CheckCircle, Percent, Sparkles } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useUserData } from './hooks/useUserData';
import { useCardAnimation } from './hooks/useCardAnimation';
import { useMessaging } from './hooks/useMessaging';
import { useSubmissions } from './hooks/useSubmissions';
import { useBooking } from './hooks/useBooking';
import { useCalendar } from './hooks/useCalendar';
import { useAppData } from './hooks/useAppData';
import ServicesGrid from './components/ServicesGrid';
import DealsGrid from './components/DealsGrid';
import FilterSection from './components/FilterSection';
import ConsumerHeader from './components/ConsumerHeader';
import ProfileMenu from './components/ProfileMenu';
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
import EventCard from './components/EventCard';
import { REAL_DATA } from './data/realData';
import { normalizeDealCategory } from './utils/dealHelpers';
import { filterEvents as filterEventsUtil, filterDeals as filterDealsUtil } from './utils/filterHelpers';
import { PACIFIC_TZ, getPacificNow } from './utils/timezoneHelpers';
import './styles/pulse-app.css';

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

  // App data from Supabase (services, events, deals with caching)
  const {
    services, servicesLoading, fetchServices,
    dbEvents, eventsLoading, eventsRefreshKey, setEventsRefreshKey,
    dbDeals, dealsLoading, dealsRefreshKey, setDealsRefreshKey,
  } = useAppData();

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

  const getVenueName = (venueId, event) => {
    if (event?.venueName) return event.venueName;
    if (venueId) {
      const venue = REAL_DATA.venues.find(v => v.id === venueId);
      if (venue?.name) return venue.name;
    }
    return event?.venue_name || event?.title || '';
  };
  const isVerified = (venueId) => REAL_DATA.venues.find(v => v.id === venueId)?.verified || false;

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

  // Venue editing state
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

  // Calendar (hook replaces 5 functions)
  const {
    generateGoogleCalendarUrl,
    addToCalendar,
    removeFromCalendar,
    isInMyCalendar,
    getCalendarEventsByDate,
  } = useCalendar({
    myCalendar,
    isAuthenticated,
    registerForEvent,
    refreshUserData,
    getVenueName,
    showToast,
  });

  // Booking (hook replaces 7 state variables + 5 functions)
  const {
    showBookingSheet, setShowBookingSheet,
    bookingEvent,
    bookingStep,
    showBookingConfirmation,
    bookingRequestMessage, setBookingRequestMessage,
    getBusinessForEvent,
    handleBookClick,
    closeBookingSheet,
    handleBookingConfirmation,
    submitBookingRequest,
  } = useBooking({
    getVenueName,
    venues: REAL_DATA.venues,
    trackAnalytics,
    addToCalendar,
    startConversation,
    openMessages,
    setSendingMessage,
    showToast,
  });

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

  const filterEvents = () => filterEventsUtil(
    [...REAL_DATA.events, ...dbEvents],
    { currentSection, filters, searchQuery, kidsAgeRange, getVenueName, now: getPacificNow() }
  );

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
            return <EventCard key={event.id} event={event} ref={(el) => eventCardRefs.current[currentIndex] = el} venues={REAL_DATA.venues} isItemSavedLocal={isItemSavedLocal} toggleSave={toggleSave} getVenueName={getVenueName} onSelect={setSelectedEvent} onBookClick={handleBookClick} />;
          })}
        </div>
      );
    });
  };

  const filterDeals = () => filterDealsUtil(
    [...REAL_DATA.deals, ...dbDeals],
    { searchQuery, filters, getVenueName }
  );

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
          <ConsumerHeader
            user={user}
            currentSection={currentSection}
            setCurrentSection={setCurrentSection}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isOffline={isOffline}
            showProfileMenu={showProfileMenu}
            setShowProfileMenu={setShowProfileMenu}
            setServicesSubView={setServicesSubView}
            filters={filters}
            setFilters={setFilters}
            setShowAuthModal={setShowAuthModal}
            openMessages={openMessages}
            showToast={showToast}
          />

          {/* Premium Filter System - Clean 5-Filter Layout */}
          {(currentSection === 'events' || currentSection === 'classes') && (
            <FilterSection
              filters={filters}
              setFilters={setFilters}
              showFilters={showFilters}
              setShowFilters={setShowFilters}
              kidsAgeRange={kidsAgeRange}
              setKidsAgeRange={setKidsAgeRange}
              ageRangeOptions={ageRangeOptions}
              categories={categories}
              getAvailableTimeSlots={getAvailableTimeSlots}
            />
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
              <DealsGrid
                deals={filterDeals()}
                dealsLoading={dealsLoading}
                dealCategoryFilter={dealCategoryFilter}
                setDealCategoryFilter={setDealCategoryFilter}
                dealCardRefs={dealCardRefs}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                getVenueName={getVenueName}
                isItemSavedLocal={isItemSavedLocal}
                toggleSave={toggleSave}
                onSelectDeal={setSelectedDeal}
              />
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
                <ServicesGrid
                    services={services}
                    servicesLoading={servicesLoading}
                    debouncedSearch={debouncedSearch}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    serviceCategoryFilter={serviceCategoryFilter}
                    setServiceCategoryFilter={setServiceCategoryFilter}
                    serviceCardRefs={serviceCardRefs}
                    onSelectService={setSelectedService}
                  />
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
            <ProfileMenu
              user={user}
              myCalendar={myCalendar}
              pendingSubmissions={pendingSubmissions}
              onClose={() => setShowProfileMenu(false)}
              onProfileOpen={() => { setShowProfileModal(true); setProfileTab('overview'); setShowProfileMenu(false); }}
              onCalendarOpen={() => { setShowMyCalendarModal(true); setShowProfileMenu(false); }}
              onSavedOpen={() => { setShowProfileModal(true); setProfileTab('saved'); setShowProfileMenu(false); }}
              onSubmissionOpen={() => { setShowProfileMenu(false); openSubmissionModal(); }}
              onClaimBusinessOpen={() => { setShowClaimBusinessModal(true); setShowProfileMenu(false); }}
              onAdminPanelOpen={() => { setShowAdminPanel(true); setShowProfileMenu(false); }}
              onSettingsOpen={() => { setShowProfileModal(true); setProfileTab('settings'); setShowProfileMenu(false); }}
              onSignOut={handleSignOut}
            />
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
