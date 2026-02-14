import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Calendar, Check, X, Plus, CheckCircle, Moon, Percent, Sparkles, Sun, Sunset, LayoutList, List } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useUserData } from './hooks/useUserData';
import { useCardAnimation } from './hooks/useCardAnimation';
import { useMessaging } from './hooks/useMessaging';
import { useSubmissions } from './hooks/useSubmissions';
import { useBooking } from './hooks/useBooking';
import { useCalendar } from './hooks/useCalendar';
import { useAppData } from './hooks/useAppData';
import { usePrefetch } from './hooks/usePrefetch';
import { usePushNotifications } from './hooks/usePushNotifications';
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
import FeedbackWidget from './components/FeedbackWidget';
import ImageCropperModal from './components/modals/ImageCropperModal';
import ContactSheet from './components/modals/ContactSheet';
import EditEventModal from './components/modals/EditEventModal';
import NotificationsPanel from './components/modals/NotificationsPanel';
import EventCard from './components/EventCard';
import SkeletonCards from './components/SkeletonCards';
import PullToRefresh from './components/PullToRefresh';
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
  const loadMoreRef = useRef(null);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showClaimBusinessModal, setShowClaimBusinessModal] = useState(false);
  const [claimFormData, setClaimFormData] = useState({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSearchQuery, setClaimSearchQuery] = useState('');
  const [claimSelectedBusiness, setClaimSelectedBusiness] = useState(null);
  const [claimVerificationStep, setClaimVerificationStep] = useState('form');
  const [claimVerificationCode, setClaimVerificationCode] = useState('');
  const [claimId, setClaimId] = useState(null);
  const [claimVerifying, setClaimVerifying] = useState(false);
  const [claimVerificationMethod, setClaimVerificationMethod] = useState('email');
  const [claimDocuments, setClaimDocuments] = useState([]);
  const [claimResendCooldown, setClaimResendCooldown] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCalendarToast, setShowCalendarToast] = useState(false);
  const [calendarToastMessage, setCalendarToastMessage] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Helper function to show toast messages
  const showToast = useCallback((message, _type = 'info') => {
    setCalendarToastMessage(message);
    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);
  }, []);

  // Track view count on events/deals tables for business analytics
  const trackView = useCallback(async (table, id) => {
    if (!id) return;
    try {
      await supabase.rpc('increment_view_count', { p_table: table, p_id: id });
    } catch (e) { /* silent */ }
  }, []);

  const fetchNotifications = useCallback(async (userId) => {
    if (!userId) return;
    setNotificationsLoading(true);
    try {
      const { data } = await supabase
        .from('pulse_user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
    } catch (e) { /* silent */ }
    setNotificationsLoading(false);
  }, []);

  const markNotificationRead = useCallback(async (notifId) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
    await supabase.from('pulse_user_notifications').update({ is_read: true }).eq('id', notifId);
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
  const [pendingClaims, setPendingClaims] = useState([]);
  const [unverifiedContent, setUnverifiedContent] = useState({ events: [], deals: [] });
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

  // Route prefetching for instant detail navigation
  const { prefetchEvent, prefetchDeal, prefetchService } = usePrefetch();
  const { subscribeToPush } = usePushNotifications(session?.user?.id);

  // Notification functions that need session
  const markAllNotificationsRead = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('pulse_user_notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  }, [session]);

  const clearAllNotifications = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setNotifications([]);
    await supabase.from('pulse_user_notifications').delete().eq('user_id', userId);
  }, [session]);

  const createNotification = useCallback(async (type, title, body, data = null) => {
    const userId = session?.user?.id;
    if (!userId) return;
    const { data: inserted } = await supabase
      .from('pulse_user_notifications')
      .insert({ user_id: userId, type, title, body, data, is_read: false })
      .select()
      .single();
    if (inserted) {
      setNotifications(prev => [inserted, ...prev]);
    }
  }, [session]);

  // Fetch notifications on login + subscribe to real-time updates
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchNotifications(session.user.id);

    const channel = supabase
      .channel('user-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pulse_user_notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, fetchNotifications]);

  // Pull-to-refresh handler — force refresh current section's data
  const handlePullRefresh = useCallback(async () => {
    if (currentSection === 'services' || currentSection === 'wellness') {
      await fetchServices(true);
    } else if (currentSection === 'deals') {
      setDealsRefreshKey(k => k + 1);
      // Wait a moment for the data to load
      await new Promise(r => setTimeout(r, 800));
    } else {
      // classes or events
      setEventsRefreshKey(k => k + 1);
      await new Promise(r => setTimeout(r, 800));
    }
  }, [currentSection, fetchServices, setDealsRefreshKey, setEventsRefreshKey]);

  // Fetch admin stats, pending claims, and unverified content
  const fetchAdminClaims = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      // Fetch claims
      const { data: claimsData, error: claimsError } = await supabase
        .from('business_claims')
        .select('*')
        .order('created_at', { ascending: false });
      if (!claimsError && claimsData) {
        const uniqueClaimed = new Set(claimsData.map(c => c.business_id).filter(Boolean));
        setAdminClaimedCount(uniqueClaimed.size);
        const uniqueVerified = new Set(claimsData.filter(c => c.status === 'verified').map(c => c.business_id).filter(Boolean));
        setAdminVerifiedCount(uniqueVerified.size);
        setPendingClaims(claimsData.filter(c => c.status === 'pending' || c.status === 'pending_verification'));
      }
      // Fetch unverified events (most recent 50)
      const { data: unvEvents } = await supabase
        .from('events')
        .select('id, title, venue_name, event_type, start_date, start_time, tags, status, confidence_score, created_at')
        .is('verified_at', null)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);
      // Fetch unverified deals
      const { data: unvDeals } = await supabase
        .from('deals')
        .select('id, title, business_name, category, schedule, status, created_at, verified_at')
        .is('verified_at', null)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);
      setUnverifiedContent({ events: unvEvents || [], deals: unvDeals || [] });
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  }, [user?.isAdmin]);

  useEffect(() => {
    fetchAdminClaims();
  }, [fetchAdminClaims]);

  // Handle /admin path route — auto-switch to admin view for admin users
  useEffect(() => {
    if (window.location.pathname === '/admin') {
      if (user?.isAdmin) {
        setView('admin');
      } else if (user?.isGuest) {
        // Guest on /admin — prompt sign in
        setShowAuthModal(true);
      } else {
        // Logged in but not admin — redirect to home
        window.history.replaceState(null, '', '/');
      }
    }
  }, [user?.isAdmin, user?.isGuest]);

  // Browser history management for tab navigation
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const validSections = ['classes', 'events', 'deals', 'services', 'wellness'];
    // Don't overwrite hash if it contains OAuth callback tokens
    if (hash.includes('access_token') || hash.includes('error_description')) {
      // Let Supabase client handle the auth callback, then default to classes
      setTimeout(() => {
        if (!window.location.hash.includes('access_token')) return;
        window.history.replaceState({ section: 'classes' }, '', '#classes');
      }, 2000);
    } else if (validSections.includes(hash)) {
      setCurrentSection(hash);
    } else if (window.location.pathname !== '/admin') {
      // Invalid hash — fix URL to default section (but not on /admin route)
      setCurrentSection('classes');
      window.history.replaceState({ section: 'classes' }, '', '#classes');
    }
    const handlePopState = (e) => {
      // Close any open modals on back button (critical for mobile UX)
      setSelectedEvent(null);
      setSelectedDeal(null);
      setSelectedService(null);
      setShowBookingSheet(false);
      setShowContactSheet(false);

      const section = e.state?.section || window.location.hash.replace('#', '') || 'classes';
      if (validSections.includes(section)) {
        setCurrentSection(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e) => {
      // Skip if user is typing in an input/textarea/select
      const tag = e.target.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

      if (e.key === 'Escape') {
        // Close topmost modal (priority order: overlays first, then detail modals, then panels)
        if (showImageCropper) { setShowImageCropper(false); return; }
        if (showBookingSheet) { setShowBookingSheet(false); return; }
        if (showContactSheet) { setShowContactSheet(false); return; }
        if (showEditEventModal) { setShowEditEventModal(false); setEditingEvent(null); return; }
        if (showEditVenueModal) { setShowEditVenueModal(false); return; }
        if (showAddEventModal) { setShowAddEventModal(false); return; }
        if (showSubmissionModal) { setShowSubmissionModal(false); return; }
        if (selectedEvent) { setSelectedEvent(null); return; }
        if (selectedDeal) { setSelectedDeal(null); return; }
        if (selectedService) { setSelectedService(null); return; }
        if (showMyCalendarModal) { setShowMyCalendarModal(false); return; }
        if (showMessagesModal) { setShowMessagesModal(false); return; }
        if (showAuthModal) { setShowAuthModal(false); return; }
        if (showClaimBusinessModal) { setShowClaimBusinessModal(false); return; }
        if (showProfileModal) { setShowProfileModal(false); return; }
        if (showAdminPanel) { setShowAdminPanel(false); return; }
        if (showProfileMenu) { setShowProfileMenu(false); return; }
        if (showNotifications) { setShowNotifications(false); return; }
        return;
      }

      if (isTyping) return;

      // "/" to focus search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-bar-premium input');
        if (searchInput) searchInput.focus();
        return;
      }

      // 1-5 for tab switching (only in consumer view)
      if (view === 'consumer') {
        const tabs = ['classes', 'events', 'deals', 'services', 'wellness'];
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          setCurrentSection(tabs[num - 1]);
          window.history.pushState({ section: tabs[num - 1] }, '', `#${tabs[num - 1]}`);
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [view, showImageCropper, showBookingSheet, showContactSheet, showEditEventModal, showEditVenueModal, showAddEventModal, showSubmissionModal, selectedEvent, selectedDeal, selectedService, showMyCalendarModal, showMessagesModal, showAuthModal, showClaimBusinessModal, showProfileModal, showAdminPanel, showProfileMenu, showNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Track detail modal views for business analytics
  useEffect(() => {
    if (selectedEvent?.businessId) trackAnalytics('event_view', selectedEvent.businessId, selectedEvent.id);
    if (selectedEvent?.id) trackView('events', selectedEvent.id);
  }, [selectedEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedDeal?.businessId) trackAnalytics('deal_view', selectedDeal.businessId, selectedDeal.id);
    if (selectedDeal?.id) trackView('deals', selectedDeal.id);
  }, [selectedDeal?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedService?.businessId) trackAnalytics('profile_view', selectedService.businessId, selectedService.id);
  }, [selectedService?.id]);

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
      fetchBusinessInbox(businessId, 'booking');
    }
  }, [view, activeBusiness?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch analytics separately so inbox isn't re-fetched on period change
  useEffect(() => {
    if (view === 'business' && activeBusiness) {
      fetchBusinessAnalytics(activeBusiness.id, analyticsPeriod);
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

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      // Only show if user hasn't dismissed before
      if (!localStorage.getItem('pulse_install_dismissed')) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // User authentication state
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Pagination — render events incrementally to avoid 981+ DOM nodes
  const [visibleEventCount, setVisibleEventCount] = useState(50);
  // Group by venue toggle for classes
  const [groupByVenue, setGroupByVenue] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('soonest'); // soonest | price | duration

  // Filter states - all dropdowns (persisted to localStorage, excluding specific dates)
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pulse-filters') || '{}');
      return {
        day: 'today', // never restore specific dates — they go stale
        time: saved.time || 'all',
        age: saved.age || 'all',
        category: 'all', // categories vary by section, don't restore
        price: saved.price || 'all',
      };
    } catch { return { day: 'today', time: 'all', age: 'all', category: 'all', price: 'all' }; }
  });
  const [showFilters, setShowFilters] = useState(false);

  // Persist filter preferences (time, age, price) to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pulse-filters', JSON.stringify({ time: filters.time, age: filters.age, price: filters.price }));
    } catch { /* quota exceeded */ }
  }, [filters.time, filters.age, filters.price]);

  // Kids age range filter state
  const [kidsAgeRange, setKidsAgeRange] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pulse-kids-age') || 'null');
      return saved && Array.isArray(saved) ? saved : [0, 18];
    } catch { return [0, 18]; }
  });

  // Persist kids age range
  useEffect(() => {
    try { localStorage.setItem('pulse-kids-age', JSON.stringify(kidsAgeRange)); } catch {}
  }, [kidsAgeRange]);

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

  // Build categories dynamically from actual DB event data only (not stale REAL_DATA)
  // Only include categories that have >0 results in the current day-filtered view
  const categories = useMemo(() => {
    const catCounts = {};
    let events = dbEvents;
    // Only show categories relevant to the current section
    if (currentSection === 'classes') {
      events = events.filter(e => e.eventType === 'class');
    } else if (currentSection === 'events') {
      events = events.filter(e => e.eventType === 'event');
    }
    // Apply day filter so category options reflect visible date range
    const now = getPacificNow();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);
    if (filters.day === 'anytime') {
      events = events.filter(e => e.start >= todayMidnight);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(filters.day)) {
      // Specific date — show categories for that day
      const [y, m, d] = filters.day.split('-').map(Number);
      const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
      const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      events = events.filter(e => e.start >= dayStart && e.start < dayEnd);
    } else if (filters.day === 'today') {
      const thirtyDays = new Date(now);
      thirtyDays.setDate(now.getDate() + 30);
      events = events.filter(e => e.start >= now && e.start < thirtyDays);
    }
    events.forEach(e => {
      if (e.category) catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });
    // Only include categories with >0 matching events (Bug #7-9: empty dropdown options)
    const cats = Object.keys(catCounts).filter(c => catCounts[c] > 0).sort();
    return ['All', ...cats];
  }, [dbEvents, currentSection, filters.day]);

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
    session,
    registerForEvent,
    refreshUserData,
    getVenueName,
    showToast,
    onCalendarAdd: () => {
      subscribeToPush();
    },
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

  // Get available time slots from DB events only, filtered by active day filter
  const getAvailableTimeSlots = useCallback(() => {
    const slots = new Set();
    // Only use DB events (not stale REAL_DATA), and filter to current section
    let events = dbEvents;
    if (currentSection === 'classes') {
      events = events.filter(e => e.eventType === 'class');
    } else if (currentSection === 'events') {
      events = events.filter(e => e.eventType === 'event');
    }

    // Filter time slots by the active day filter so they're relevant
    const now = getPacificNow();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    events = events.filter(e => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.day)) {
        const [y, m, d] = filters.day.split('-').map(Number);
        const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
        const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
        return e.start >= dayStart && e.start < dayEnd;
      } else if (filters.day === 'today') {
        const thirtyDays = new Date(todayMidnight);
        thirtyDays.setDate(todayMidnight.getDate() + 30);
        return e.start >= todayMidnight && e.start < thirtyDays;
      } else if (filters.day === 'tomorrow') {
        const tomorrow = new Date(todayMidnight);
        tomorrow.setDate(todayMidnight.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(tomorrow.getDate() + 1);
        return e.start >= tomorrow && e.start < dayAfter;
      }
      return e.start >= todayMidnight;
    });

    events.forEach(event => {
      const hour = event.start.getHours();
      if (hour < 6) return; // Skip suspicious pre-6AM times from dropdown
      const minute = event.start.getMinutes();
      const timeStr = `${hour}:${String(minute).padStart(2, '0')}`;
      slots.add(timeStr);
    });

    return Array.from(slots).sort((a, b) => {
      const [aHour, aMin] = a.split(':').map(Number);
      const [bHour, bMin] = b.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
  }, [dbEvents, currentSection, filters.day]);

  // Check if any events/classes are free (for data-driven price filter) — DB only
  const hasFreeItems = dbEvents.some(e => e.price?.toLowerCase() === 'free');

  const handleSignOut = async () => {
    await signOut();
    setShowProfileMenu(false);
  };

  const handleClaimBusiness = async () => {
    const trimmedName = claimFormData.businessName.trim();
    const trimmedOwner = claimFormData.ownerName.trim();
    const trimmedEmail = claimFormData.email.trim();
    if (!trimmedName || !trimmedOwner || !trimmedEmail) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    if (claimVerificationMethod === 'document' && claimDocuments.length === 0) {
      showToast('Please upload at least one document', 'error');
      return;
    }
    if (!session?.user?.id) {
      setShowClaimBusinessModal(false);
      setShowAuthModal(true);
      return;
    }
    setClaimSubmitting(true);
    try {
      const isAdmin = user.isAdmin;
      const isDocumentVerification = claimVerificationMethod === 'document' && !isAdmin;
      const verificationCode = (isAdmin || isDocumentVerification) ? null : Math.floor(100000 + Math.random() * 900000).toString();

      // Upload documents if document verification
      let documentUrls = null;
      if (isDocumentVerification && claimDocuments.length > 0) {
        const uploaded = [];
        for (const file of claimDocuments) {
          const filePath = `${session.user.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage.from('claim-documents').upload(filePath, file);
          if (uploadError) throw uploadError;
          uploaded.push({ name: file.name, path: filePath, type: file.type, size: file.size });
        }
        documentUrls = uploaded;
      }

      const claimData = {
        user_id: session.user.id,
        business_name: claimSelectedBusiness?.name || trimmedName,
        business_address: claimSelectedBusiness?.address || claimFormData.address?.trim() || null,
        owner_name: trimmedOwner,
        contact_email: trimmedEmail,
        contact_phone: claimFormData.phone?.trim() || null,
        owner_role: claimFormData.role,
        status: isAdmin ? 'verified' : isDocumentVerification ? 'pending' : 'pending_verification',
        verification_method: isAdmin ? null : claimVerificationMethod,
        verification_code: verificationCode,
        documents: documentUrls,
      };
      if (claimSelectedBusiness?.id) {
        claimData.business_id = claimSelectedBusiness.id;
      }
      const { data: inserted, error } = await supabase.from('business_claims').insert(claimData).select('id').single();
      if (error) throw error;
      if (isAdmin) {
        setShowClaimBusinessModal(false);
        setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
        setClaimSelectedBusiness(null);
        setClaimSearchQuery('');
        setClaimVerificationStep('form');
        setClaimDocuments([]);
        setClaimVerificationMethod('email');
        showToast('Business claimed and verified!', 'success');
        if (typeof refreshUserData === 'function') refreshUserData();
      } else if (isDocumentVerification) {
        // Documents uploaded — goes to admin review directly
        setShowClaimBusinessModal(false);
        setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
        setClaimSelectedBusiness(null);
        setClaimSearchQuery('');
        setClaimVerificationStep('form');
        setClaimDocuments([]);
        setClaimVerificationMethod('email');
        showToast('Claim submitted! Our team will review your documents.', 'success');
      } else {
        // Send verification email
        setClaimId(inserted.id);
        supabase.functions.invoke('verify-claim-email', {
          body: { email: claimFormData.email, businessName: claimData.business_name, ownerName: claimFormData.ownerName, verificationCode },
        }).catch((err) => console.error('Email send error:', err));
        setClaimVerificationStep('verify');
        showToast('Verification code sent to your email!', 'success');
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      showToast('Error submitting claim. Please try again.', 'error');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const handleVerifyClaimCode = async () => {
    if (!claimVerificationCode || claimVerificationCode.length !== 6) {
      showToast('Please enter the 6-digit code', 'error');
      return;
    }
    setClaimVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-claim-code', {
        body: { claimId, code: claimVerificationCode },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.expired) {
          showToast('Code expired. Please resend to get a new code.', 'error');
        } else if (data.locked) {
          showToast('Too many attempts. Please resend the code.', 'error');
        } else {
          showToast(data.error, 'error');
        }
        setClaimVerifying(false);
        return;
      }
      if (data?.verified) {
        setShowClaimBusinessModal(false);
        setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
        setClaimSelectedBusiness(null);
        setClaimSearchQuery('');
        setClaimVerificationStep('form');
        setClaimVerificationCode('');
        setClaimId(null);
        showToast('Email verified! Your claim is under review.', 'success');
      } else {
        const remaining = data?.attemptsRemaining;
        showToast(`Incorrect code.${remaining != null ? ` ${remaining} attempts remaining.` : ''} Please try again.`, 'error');
      }
    } catch (error) {
      console.error('Verification error:', error);
      showToast('Error verifying code. Please try again.', 'error');
    } finally {
      setClaimVerifying(false);
    }
  };

  const handleResendClaimCode = async () => {
    if (claimResendCooldown > 0) return;
    try {
      const { data, error } = await supabase.functions.invoke('resend-claim-code', {
        body: { claimId },
      });
      if (error) throw error;
      if (data?.error) {
        showToast(data.error, 'error');
        return;
      }
      showToast('New code sent to your email!', 'success');
      // Start 60-second cooldown
      setClaimResendCooldown(60);
      const timer = setInterval(() => {
        setClaimResendCooldown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Resend error:', error);
      showToast('Error resending code. Please try again.', 'error');
    }
  };

  // Admin: approve or reject a business claim
  const handleClaimAction = useCallback(async (claimId, action, rejectedReason) => {
    try {
      if (action === 'approve') {
        const claim = pendingClaims.find(c => c.id === claimId);
        // Update claim status to verified
        const { error: claimError } = await supabase
          .from('business_claims')
          .update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: session?.user?.id })
          .eq('id', claimId);
        if (claimError) throw claimError;
        // Link the user to the business via claimed_business_id in profiles
        if (claim?.business_id && claim?.user_id) {
          await supabase
            .from('profiles')
            .update({ claimed_business_id: claim.business_id })
            .eq('id', claim.user_id);
        }
        showToast('Claim approved — business owner granted access', 'success');
      } else {
        const { error } = await supabase
          .from('business_claims')
          .update({ status: 'rejected', rejected_reason: rejectedReason || 'Rejected by admin' })
          .eq('id', claimId);
        if (error) throw error;
        showToast('Claim rejected', 'info');
      }
      fetchAdminClaims();
    } catch (err) {
      console.error('Claim action error:', err);
      showToast('Failed to update claim', 'error');
    }
  }, [pendingClaims, session?.user?.id, showToast, fetchAdminClaims]);

  // Admin: verify or remove events/deals
  const handleVerifyContent = useCallback(async (type, id) => {
    try {
      const table = type === 'deal' ? 'deals' : 'events';
      const { error } = await supabase
        .from(table)
        .update({ verified_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      showToast(`${type === 'deal' ? 'Deal' : 'Event'} verified`, 'success');
      fetchAdminClaims();
    } catch (err) {
      console.error('Verify error:', err);
      showToast('Failed to verify', 'error');
    }
  }, [showToast, fetchAdminClaims]);

  const handleRemoveContent = useCallback(async (type, id, title) => {
    if (!confirm(`Remove "${title}"? This will deactivate it from the app.`)) return;
    try {
      const table = type === 'deal' ? 'deals' : 'events';
      const removeStatus = type === 'deal' ? 'expired' : 'cancelled';
      const { error } = await supabase
        .from(table)
        .update({ status: removeStatus })
        .eq('id', id);
      if (error) throw error;
      showToast(`"${title}" removed`, 'info');
      fetchAdminClaims();
    } catch (err) {
      console.error('Remove error:', err);
      showToast('Failed to remove', 'error');
    }
  }, [showToast, fetchAdminClaims]);

  const handleBulkVerifyContent = useCallback(async (type, ids) => {
    try {
      const table = type === 'deal' ? 'deals' : 'events';
      const { error } = await supabase
        .from(table)
        .update({ verified_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      showToast(`${ids.length} ${type === 'deal' ? 'deals' : 'events'} verified`, 'success');
      fetchAdminClaims();
    } catch (err) {
      console.error('Bulk verify error:', err);
      showToast('Failed to verify', 'error');
    }
  }, [showToast, fetchAdminClaims]);

  // Reset pagination when filter inputs change
  useEffect(() => {
    setVisibleEventCount(50);
  }, [currentSection, filters, searchQuery, kidsAgeRange]);

  // Memoized filter — only recomputes when inputs change (Bug #20: called twice per render)
  const filteredEvents = useMemo(() => {
    return filterEventsUtil(
      dbEvents,
      { currentSection, filters, searchQuery, kidsAgeRange, getVenueName, now: getPacificNow() }
    );
  }, [dbEvents, currentSection, filters, searchQuery, kidsAgeRange]);

  // Build search suggestions from venue names and event titles
  const searchSuggestions = useMemo(() => {
    const suggestions = new Set();
    // Venue names
    REAL_DATA.venues.forEach(v => { if (v.name) suggestions.add(v.name); });
    // Unique event/class titles
    dbEvents.forEach(e => { if (e.title) suggestions.add(e.title); });
    return Array.from(suggestions).sort((a, b) => a.localeCompare(b));
  }, [dbEvents]);

  // Count events per day for date picker chips (next 14 days)
  const dateEventCounts = useMemo(() => {
    const counts = {};
    const now = getPacificNow();
    // Filter to current section only
    const sectionEvents = dbEvents.filter(e =>
      currentSection === 'classes' ? e.eventType === 'class' :
      currentSection === 'events' ? e.eventType === 'event' : true
    ).filter(e => e.start >= now);
    sectionEvents.forEach(e => {
      const y = e.start.getFullYear();
      const m = String(e.start.getMonth() + 1).padStart(2, '0');
      const d = String(e.start.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [dbEvents, currentSection]);

  // Count events happening right now (started within last 2 hours)
  const happeningNowCount = useMemo(() => {
    const now = getPacificNow();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    return dbEvents.filter(e =>
      (currentSection === 'classes' ? e.eventType === 'class' : currentSection === 'events' ? e.eventType === 'event' : true) &&
      e.start >= twoHoursAgo && e.start <= now
    ).length;
  }, [dbEvents, currentSection]);

  // Count free events (upcoming)
  const freeCount = useMemo(() => {
    const now = getPacificNow();
    return dbEvents.filter(e =>
      (currentSection === 'classes' ? e.eventType === 'class' : currentSection === 'events' ? e.eventType === 'event' : true) &&
      e.start >= now && e.price?.toLowerCase() === 'free'
    ).length;
  }, [dbEvents, currentSection]);

  // Count weekend events
  const weekendCount = useMemo(() => {
    const now = getPacificNow();
    const dayOfWeek = now.getDay();
    const friday = new Date(now);
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      const daysBackToFriday = dayOfWeek === 0 ? 2 : dayOfWeek - 5;
      friday.setDate(now.getDate() - daysBackToFriday);
    } else {
      friday.setDate(now.getDate() + (5 - dayOfWeek));
    }
    friday.setHours(0, 0, 0, 0);
    const monday = new Date(friday);
    monday.setDate(friday.getDate() + 3);
    return dbEvents.filter(e =>
      (currentSection === 'classes' ? e.eventType === 'class' : currentSection === 'events' ? e.eventType === 'event' : true) &&
      e.start >= friday && e.start < monday
    ).length;
  }, [dbEvents, currentSection]);

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
      return <SkeletonCards count={6} />;
    }

    let events = filteredEvents;
    if (events.length === 0) {
      // Contextual empty message based on active filter
      const isSpecificDate = /^\d{4}-\d{2}-\d{2}$/.test(filters.day);
      let emptyMessage = `No ${currentSection} found matching your filters.`;
      if (isSpecificDate) {
        const [y, m, d] = filters.day.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        emptyMessage = `No ${currentSection} on ${dateLabel}.`;
      } else if (filters.day === 'happeningNow') {
        emptyMessage = `Nothing happening right now.`;
      } else if (searchQuery?.trim()) {
        emptyMessage = `No ${currentSection} match "${searchQuery.trim()}".`;
      }

      // Build smart suggestions: try removing each active filter and count results
      const suggestions = [];
      const activeFilters = {
        time: filters.time !== 'all' ? filters.time : null,
        price: filters.price !== 'all' ? filters.price : null,
        age: filters.age !== 'all' ? filters.age : null,
        category: filters.category !== 'all' ? filters.category : null,
      };
      const filterLabels = {
        time: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' },
        price: { free: 'Free', paid: 'Paid' },
        age: { kids: 'Kids', adults: 'Adults' },
      };
      for (const [key, val] of Object.entries(activeFilters)) {
        if (!val) continue;
        const tryFilters = { ...filters, [key]: 'all' };
        const tryEvents = filterEventsUtil(dbEvents, { currentSection, filters: tryFilters, searchQuery, kidsAgeRange, getVenueName, now: getPacificNow() });
        if (tryEvents.length > 0) {
          const label = filterLabels[key]?.[val] || val;
          suggestions.push({ label: `Remove "${label}" filter`, count: tryEvents.length, action: () => setFilters({ ...filters, [key]: 'all' }) });
        }
      }
      if (filters.day === 'happeningNow') {
        suggestions.push({ label: 'Show upcoming instead', count: null, action: () => setFilters({ ...filters, day: 'today' }) });
      }

      return (
        <div className="empty-state">
          <div className="empty-state-icon">
            {currentSection === 'classes' ? '🧘' : '📅'}
          </div>
          <p className="empty-state-message">{emptyMessage}</p>
          {suggestions.length > 0 && (
            <div className="empty-state-suggestions">
              {suggestions.slice(0, 3).map((s, i) => (
                <button key={i} className="empty-state-suggestion" onClick={s.action}>
                  {s.label}{s.count ? ` (${s.count} results)` : ''}
                </button>
              ))}
            </div>
          )}
          <button className="empty-state-btn" onClick={() => {
            setFilters({ day: 'today', age: 'all', category: 'all', time: 'all', price: 'all', location: 'all' });
            setKidsAgeRange([0, 18]);
            setSearchQuery('');
          }}>
            Reset All Filters
          </button>
        </div>
      );
    }

    // Paginate: only render up to visibleEventCount events
    const paginatedEvents = events.slice(0, visibleEventCount);
    const hasMore = events.length > visibleEventCount;

    const groupedEvents = groupEventsByDate(paginatedEvents);
    const dateKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));
    const now = getPacificNow();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let globalEventIndex = 0; // Global counter for refs

    const renderedDays = dateKeys.map((dateKey, index) => {
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
          
          {(() => {
            const dayEvents = groupedEvents[dateKey];
            // Add time-of-day sub-headers when 6+ events in a day
            if (dayEvents.length >= 6) {
              const periods = [
                { key: 'morning', label: 'Morning', icon: <Sun size={14} />, test: h => h >= 5 && h < 12 },
                { key: 'afternoon', label: 'Afternoon', icon: <Sunset size={14} />, test: h => h >= 12 && h < 17 },
                { key: 'evening', label: 'Evening', icon: <Moon size={14} />, test: h => h >= 17 || h < 5 },
              ];
              return periods.map(period => {
                const periodEvents = dayEvents.filter(e => period.test(e.start.getHours()));
                if (periodEvents.length === 0) return null;
                return (
                  <React.Fragment key={period.key}>
                    <div className="time-period-header">
                      {period.icon}
                      <span>{period.label}</span>
                      <span className="time-period-count">{periodEvents.length}</span>
                    </div>
                    {periodEvents.map((event) => {
                      const currentIndex = globalEventIndex++;
                      return <EventCard key={event.id} event={event} index={currentIndex} ref={(el) => eventCardRefs.current[currentIndex] = el} venues={REAL_DATA.venues} isItemSavedLocal={isItemSavedLocal} toggleSave={toggleSave} getVenueName={getVenueName} onSelect={setSelectedEvent} onBookClick={handleBookClick} onPrefetch={prefetchEvent} addToCalendar={addToCalendar} isInMyCalendar={isInMyCalendar} showToast={showToast} searchQuery={searchQuery} compact={compactMode} />;
                    })}
                  </React.Fragment>
                );
              });
            }
            return dayEvents.map((event) => {
              const currentIndex = globalEventIndex++;
              return <EventCard key={event.id} event={event} index={currentIndex} ref={(el) => eventCardRefs.current[currentIndex] = el} venues={REAL_DATA.venues} isItemSavedLocal={isItemSavedLocal} toggleSave={toggleSave} getVenueName={getVenueName} onSelect={setSelectedEvent} onBookClick={handleBookClick} onPrefetch={prefetchEvent} addToCalendar={addToCalendar} isInMyCalendar={isInMyCalendar} showToast={showToast} searchQuery={searchQuery} compact={compactMode} />;
            });
          })()}
        </div>
      );
    });

    return (
      <>
        {renderedDays}
        {hasMore && (
          <div ref={loadMoreRef} style={{ textAlign: 'center', padding: '24px 0', minHeight: '1px' }}>
            <div className="infinite-scroll-loader">
              <div className="loader-dot" /><div className="loader-dot" /><div className="loader-dot" />
            </div>
          </div>
        )}
      </>
    );
  };

  // Memoized deals filter
  const filteredDeals = useMemo(() => filterDealsUtil(
    dbDeals,
    { searchQuery, filters, getVenueName }
  ), [dbDeals, searchQuery, filters]);

  // Create notification when user saves an event/deal (for reminders)
  const createSaveNotification = useCallback((type, name, id) => {
    if (!session?.user?.id) return;
    createNotification(
      'save_confirm',
      `Saved: ${name}`,
      `You saved this ${type}. We'll remind you before it starts.`,
      { [`${type}Id`]: id }
    );
  }, [session, createNotification]);

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
        if (exists) {
          showToast('Removed from saved items.', 'info');
        } else {
          showToast('Saved locally. Sign in to sync across devices.', 'info');
        }
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
      } else if (!wasIncluded && name) {
        // Create a confirmation notification when saving (not unsaving)
        createSaveNotification(type, name, id);
      }
    } catch {
      // Revert optimistic update on error
      setLocalSavedItems(prev => wasIncluded ? [...prev, itemKey] : prev.filter(k => k !== itemKey));
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [isAuthenticated, toggleSaveItem, localSavedItems, showToast, createSaveNotification]);

  // Combined check for saved items (local + database)
  const isItemSavedLocal = useCallback((type, id) => {
    const itemKey = `${type}-${id}`;
    return localSavedItems.includes(itemKey) || isItemSaved(type, String(id));
  }, [localSavedItems, isItemSaved]);

  // Reset search AND filters when switching tabs to prevent cross-tab confusion
  const prevSectionRef = useRef(currentSection);
  useEffect(() => {
    const prevSection = prevSectionRef.current;
    prevSectionRef.current = currentSection;
    // On first render (or same section), don't reset persisted filters
    if (prevSection === currentSection) return;
    setSearchQuery('');
    setDebouncedSearch('');
    // Reset day/category but preserve persisted preferences (time, age, price)
    setFilters(f => ({ ...f, day: 'today', category: 'all' }));
    // Reset pagination when switching sections
    setVisibleEventCount(50);
    // Scroll to top when switching sections (Bug #9)
    window.scrollTo(0, 0);
  }, [currentSection]);

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

  // Back to top button - show after scrolling 600px
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setShowBackToTop(window.scrollY > 600);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Infinite scroll — auto-load more events when sentinel comes into view
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleEventCount(c => c + 50);
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pulse-app">
      <a href="#main-content" className="skip-to-content" style={{position:'absolute',left:'-9999px',top:'auto',width:'1px',height:'1px',overflow:'hidden',zIndex:9999}} onFocus={(e)=>{e.target.style.position='fixed';e.target.style.left='50%';e.target.style.top='8px';e.target.style.transform='translateX(-50%)';e.target.style.width='auto';e.target.style.height='auto';e.target.style.overflow='visible';e.target.style.background='#1f2937';e.target.style.color='#fff';e.target.style.padding='8px 16px';e.target.style.borderRadius='8px';e.target.style.fontSize='14px';e.target.style.fontWeight='600';e.target.style.textDecoration='none';}} onBlur={(e)=>{e.target.style.position='absolute';e.target.style.left='-9999px';e.target.style.width='1px';e.target.style.height='1px';e.target.style.overflow='hidden';}}>Skip to content</a>
      {(user.isAdmin || userClaimedBusinesses.length > 0) && (
        <div className="view-switcher">
          <button tabIndex={-1} className={view === 'consumer' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) setImpersonatedBusiness(null); setView('consumer'); }}>Consumer</button>
          <button tabIndex={-1} className={view === 'business' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) setImpersonatedBusiness(null); setView('business'); }}>Business</button>
          {user.isAdmin && <button tabIndex={-1} className={view === 'admin' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) { exitImpersonation(); } else { setView('admin'); } }}>Admin</button>}
        </div>
      )}

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
            onOpenNotifications={() => setShowNotifications(true)}
            unreadNotifCount={notifications.filter(n => !n.is_read).length}
            searchSuggestions={searchSuggestions}
            tabCounts={{
              classes: dbEvents.filter(e => e.eventType === 'class').length,
              events: dbEvents.filter(e => e.eventType === 'event').length,
              deals: filteredDeals.length,
            }}
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
              hasFreeItems={hasFreeItems}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateEventCounts={dateEventCounts}
              happeningNowCount={happeningNowCount}
              freeCount={freeCount}
              weekendCount={weekendCount}
            />
          )}

          <PullToRefresh onRefresh={handlePullRefresh}>
          <main className="content" id="main-content">
            {currentSection !== 'wellness' && (
            <div className="results-bar">
              <h2 className="results-count" aria-live="polite" aria-atomic="true">
                <AnimatePresence mode="wait">
                {(() => {
                  const sectionLabels = { classes: 'class', events: 'event', deals: 'deal', services: 'business' };
                  const label = sectionLabels[currentSection] || 'result';
                  let count;
                  if (currentSection === 'deals') {
                    if (dealsLoading) return <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Loading...</motion.span>;
                    count = filteredDeals.filter(d => dealCategoryFilter === 'All' || normalizeDealCategory(d.category) === dealCategoryFilter).length;
                  } else if (currentSection === 'services') {
                    count = services.filter(s => {
                      if (debouncedSearch) {
                        const query = debouncedSearch.toLowerCase().trim();
                        if (!s.name.toLowerCase().includes(query) && !s.category.toLowerCase().includes(query) && !s.address?.toLowerCase().includes(query)) return false;
                      }
                      if (serviceCategoryFilter === 'All') return true;
                      const mainCategories = ['Restaurants & Dining', 'Retail & Shopping', 'Cafes & Bakeries', 'Outdoor Adventures', 'Auto Services', 'Real Estate', 'Fitness & Gyms', 'Recreation & Sports', 'Health & Wellness', 'Construction & Building', 'Outdoor Gear & Shops', 'Community Services', 'Hotels & Lodging', 'Web & Marketing', 'Financial Services', 'Medical Clinics', 'Photography', 'Attractions', 'Churches & Religious', 'Salons & Spas', 'Arts & Culture'];
                      if (serviceCategoryFilter === 'Other') return !mainCategories.includes(s.category);
                      return s.category === serviceCategoryFilter;
                    }).length;
                  } else {
                    if (eventsLoading) return <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Loading...</motion.span>;
                    count = filteredEvents.length;
                  }
                  const text = `${count} ${count === 1 ? label : label + (label === 'class' ? 'es' : label === 'business' ? 'es' : 's')}`;
                  return (
                    <motion.span
                      key={text}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      {text}
                    </motion.span>
                  );
                })()}
                </AnimatePresence>
              </h2>
              <div className="results-bar-actions">
                {(currentSection === 'classes' || currentSection === 'events') && (
                  <button
                    className={`group-toggle-btn ${compactMode ? 'active' : ''}`}
                    onClick={() => setCompactMode(!compactMode)}
                    aria-label={compactMode ? 'Card view' : 'Compact view'}
                    title={compactMode ? 'Card view' : 'Compact view'}
                  >
                    {compactMode ? <LayoutList size={16} /> : <List size={16} />}
                  </button>
                )}
              </div>
            </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {currentSection === 'deals' ? (
                  <DealsGrid
                    deals={filteredDeals}
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
                    onPrefetch={prefetchDeal}
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
                        onPrefetch={prefetchService}
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
              </motion.div>
            </AnimatePresence>
          </main>
          </PullToRefresh>

          {/* Event/Class Detail Modal */}
          <AnimatePresence>
          {selectedEvent && (
            <motion.div
              key="event-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
            >
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Deal Detail Modal */}
          <AnimatePresence>
          {selectedDeal && (
            <motion.div
              key="deal-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
            >
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
              allDeals={dbDeals}
            />
            </motion.div>
          )}
          </AnimatePresence>
          {/* Service Detail Modal */}
          <AnimatePresence>
          {selectedService && (
            <motion.div
              key="service-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
            >
            <ServiceDetailModal
              service={selectedService}
              onClose={() => setSelectedService(null)}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={showToast}
            />
            </motion.div>
          )}
          </AnimatePresence>

          {/* Profile Menu Dropdown */}
          <AnimatePresence>
          {showProfileMenu && (
            <motion.div key="profile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Add Event Modal */}
          <AnimatePresence>
          {showAddEventModal && (
            <motion.div key="add-event" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add event" onClick={closeAddEventModal} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <motion.div className="modal-content add-event-modal" onClick={(e) => e.stopPropagation()} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
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
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Claim Business Modal - Premium Purple Theme */}
          <AnimatePresence>
          {showClaimBusinessModal && (
            <motion.div key="claim-biz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
            <ClaimBusinessModal
              claimSearchQuery={claimSearchQuery}
              setClaimSearchQuery={setClaimSearchQuery}
              claimSelectedBusiness={claimSelectedBusiness}
              setClaimSelectedBusiness={setClaimSelectedBusiness}
              claimFormData={claimFormData}
              setClaimFormData={setClaimFormData}
              claimSubmitting={claimSubmitting}
              claimVerificationStep={claimVerificationStep}
              claimVerificationCode={claimVerificationCode}
              setClaimVerificationCode={setClaimVerificationCode}
              claimVerifying={claimVerifying}
              claimVerificationMethod={claimVerificationMethod}
              setClaimVerificationMethod={setClaimVerificationMethod}
              claimDocuments={claimDocuments}
              setClaimDocuments={setClaimDocuments}
              handleVerifyClaimCode={handleVerifyClaimCode}
              handleResendClaimCode={handleResendClaimCode}
              setClaimVerificationStep={setClaimVerificationStep}
              session={session}
              services={services}
              claimResendCooldown={claimResendCooldown}
              onClose={() => { setShowClaimBusinessModal(false); setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' }); setClaimVerificationStep('form'); setClaimVerificationCode(''); setClaimId(null); setClaimResendCooldown(0); setClaimDocuments([]); setClaimVerificationMethod('email'); setClaimSelectedBusiness(null); setClaimSearchQuery(''); }}
              setShowAuthModal={setShowAuthModal}
              handleClaimBusiness={handleClaimBusiness}
            />
            </motion.div>
          )}
          </AnimatePresence>

          {/* My Calendar Modal - Premium */}
          <AnimatePresence>
          {showMyCalendarModal && (
            <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Calendar Toast Notification */}
          <AnimatePresence>
          {showCalendarToast && (
            <motion.div
              key="toast"
              className="calendar-toast"
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div className="toast-icon">
                <Calendar size={20} />
              </div>
              <span>{calendarToastMessage}</span>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Submission Modal - Add Event/Class/Deal */}
          <AnimatePresence>
          {showSubmissionModal && (
            <motion.div key="submission" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Premium Profile Modal */}
          <AnimatePresence>
          {showProfileModal && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
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
            </motion.div>
          )}
          </AnimatePresence>
          {/* Booking Bottom Sheet */}
          <AnimatePresence>
          {showBookingSheet && bookingEvent && (
            <motion.div key="booking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Booking Confirmation Dialog */}
          <AnimatePresence>
          {showBookingConfirmation && (
            <motion.div
              key="booking-confirm"
              className="modal-overlay confirmation-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm booking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="confirmation-dialog"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
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
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Contact Business Sheet */}
          <AnimatePresence>
          {showContactSheet && contactBusiness && (
            <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Messages Modal */}
          <AnimatePresence>
          {showMessagesModal && (
            <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
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
            </motion.div>
          )}
          </AnimatePresence>

          {/* Notifications Panel */}
          <AnimatePresence>
          {showNotifications && (
            <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
            <NotificationsPanel
              notifications={notifications}
              loading={notificationsLoading}
              onClose={() => setShowNotifications(false)}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onClearAll={clearAllNotifications}
              onNotificationClick={(notif) => {
                setShowNotifications(false);
                if (notif.data?.eventId) {
                  const evt = dbEvents.find(e => e.id === notif.data.eventId);
                  if (evt) setSelectedEvent(evt);
                } else if (notif.data?.dealId) {
                  const deal = dbDeals.find(d => d.id === notif.data.dealId);
                  if (deal) setSelectedDeal(deal);
                }
              }}
            />
            </motion.div>
          )}
          </AnimatePresence>

          {/* Admin Panel Modal */}
          <AnimatePresence>
          {showAdminPanel && user.isAdmin && (
            <motion.div key="admin-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
            <AdminPanelModal
              adminTab={adminTab}
              setAdminTab={setAdminTab}
              pendingSubmissions={pendingSubmissions}
              onClose={() => setShowAdminPanel(false)}
              setView={setView}
              approveSubmission={approveSubmission}
              rejectSubmission={rejectSubmission}
            />
            </motion.div>
          )}
          </AnimatePresence>
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
          dbDeals={dbDeals}
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
          openSubmissionModal={openSubmissionModal}
          selectSubmissionType={selectSubmissionType}
          setEditingVenue={setEditingVenue}
          setEditVenueForm={setEditVenueForm}
          setShowEditVenueModal={setShowEditVenueModal}
          setEventsRefreshKey={setEventsRefreshKey}
          setDealsRefreshKey={setDealsRefreshKey}
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
          pendingClaims={pendingClaims}
          handleClaimAction={handleClaimAction}
          unverifiedContent={unverifiedContent}
          handleVerifyContent={handleVerifyContent}
          handleRemoveContent={handleRemoveContent}
          handleBulkVerifyContent={handleBulkVerifyContent}
          setEditingEvent={setEditingEvent}
          setEditEventForm={setEditEventForm}
          setShowEditEventModal={setShowEditEventModal}
          setSelectedEvent={setSelectedEvent}
        />
      )}

      {/* Edit Venue Modal - Global (works from any view) */}
      <AnimatePresence>
      {showEditVenueModal && editingVenue && (
        <motion.div key="edit-venue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
        <EditVenueModal
          editingVenue={editingVenue}
          editVenueForm={editVenueForm}
          setEditVenueForm={setEditVenueForm}
          onClose={() => { setShowEditVenueModal(false); setEditingVenue(null); }}
          showToast={showToast}
          fetchServices={fetchServices}
        />
        </motion.div>
      )}
      </AnimatePresence>

      {/* Edit Event/Class Modal */}
      <AnimatePresence>
      {showEditEventModal && editingEvent && (
        <motion.div key="edit-event" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
        <EditEventModal
          editingEvent={editingEvent}
          editEventForm={editEventForm}
          setEditEventForm={setEditEventForm}
          onClose={() => { setShowEditEventModal(false); setEditingEvent(null); }}
          showToast={showToast}
          setEventsRefreshKey={setEventsRefreshKey}
        />
        </motion.div>
      )}
      </AnimatePresence>

      {/* Global Image Cropper Modal - Works from any context */}
      <AnimatePresence>
      {showImageCropper && cropperImage && (
        <motion.div key="cropper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ position: 'fixed', inset: 0, zIndex: 1100 }}>
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
        </motion.div>
      )}
      </AnimatePresence>

      {/* ========== GLOBAL MODALS (render regardless of view) ========== */}

      {/* Auth Modal */}
      <AnimatePresence>
      {showAuthModal && (
        <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(msg) => {
            setCalendarToastMessage(msg);
            setShowCalendarToast(true);
            setTimeout(() => setShowCalendarToast(false), 5000);
          }}
        />
        </motion.div>
      )}
      </AnimatePresence>

      {/* Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            className="back-to-top-btn"
            onClick={scrollToTop}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            aria-label="Back to top"
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      <FeedbackWidget />

      {view === 'consumer' && (
        <footer className="app-footer" role="contentinfo">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">PULSE</div>
              <p className="footer-tagline">Discover what's happening in Squamish</p>
            </div>
            <div className="footer-links">
              <div className="footer-link-group">
                <h4>Explore</h4>
                <button onClick={() => { setCurrentSection('classes'); window.scrollTo(0, 0); }}>Classes</button>
                <button onClick={() => { setCurrentSection('events'); window.scrollTo(0, 0); }}>Events</button>
                <button onClick={() => { setCurrentSection('deals'); window.scrollTo(0, 0); }}>Deals</button>
                <button onClick={() => { setCurrentSection('services'); window.scrollTo(0, 0); }}>Services</button>
              </div>
              <div className="footer-link-group">
                <h4>For Business</h4>
                <button onClick={() => setShowClaimBusinessModal(true)}>Claim Your Business</button>
                <button onClick={() => setShowAddEventModal(true)}>Submit an Event</button>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Pulse Squamish. Made with care in Squamish, BC.</p>
          </div>
        </footer>
      )}

      {showInstallBanner && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff',
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.15)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Install Pulse</div>
            <div style={{ fontSize: '12px', opacity: 0.85 }}>Add to home screen for the best experience</div>
          </div>
          <button onClick={async () => {
            if (installPromptEvent) {
              installPromptEvent.prompt();
              const result = await installPromptEvent.userChoice;
              if (result.outcome === 'accepted') setShowInstallBanner(false);
              setInstallPromptEvent(null);
            }
          }} style={{
            background: '#fff', color: '#2563eb', border: 'none', borderRadius: '8px',
            padding: '8px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>Install</button>
          <button onClick={() => {
            setShowInstallBanner(false);
            localStorage.setItem('pulse_install_dismissed', 'true');
          }} style={{
            background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
            padding: '4px', opacity: 0.7,
          }}>&#x2715;</button>
        </div>
      )}
    </div>
  );
}
