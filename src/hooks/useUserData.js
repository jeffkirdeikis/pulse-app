import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { setUser as setSentryUser, clearUser as clearSentryUser } from '../lib/sentry';

/**
 * Hook to manage all user data from Supabase
 * Replaces hardcoded user, userStats, userAchievements, userActivity, savedItems, myCalendar
 */
export function useUserData() {
  // Auth state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // User profile
  const [user, setUser] = useState({
    id: null,
    name: '',
    email: '',
    avatar: null,
    coverPhoto: null,
    phone: '',
    bio: '',
    location: 'Squamish, BC',
    memberSince: null,
    interests: [],
    isGuest: true,
    isAdmin: false,
    socialLinks: { instagram: '', facebook: '', website: '' },
    notifications: { eventReminders: true, newDeals: true, weeklyDigest: true, businessUpdates: false },
    privacy: { showActivity: true, showSavedItems: false, showAttendance: true }
  });

  // User stats (calculated from real data)
  const [userStats, setUserStats] = useState({
    eventsAttended: 0,
    classesCompleted: 0,
    dealsRedeemed: 0,
    reviewsWritten: 0,
    businessesSupported: 0,
    checkIns: 0,
    totalXP: 0,
    level: 1,
    xpToNextLevel: 100,
    xpForCurrentLevel: 0,
    currentStreak: 0,
    longestStreak: 0,
    communityRank: 0,
    totalMembers: 0,
    localHeroScore: 0
  });

  // Achievements
  const [userAchievements, setUserAchievements] = useState([]);

  // Activity history
  const [userActivity, setUserActivity] = useState([]);

  // Saved items
  const [savedItems, setSavedItems] = useState([]);

  // Calendar
  const [myCalendar, setMyCalendar] = useState([]);

  // Claimed businesses
  const [userClaimedBusinesses, setUserClaimedBusinesses] = useState([]);

  // Listen to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (import.meta.env.DEV) console.log('[Auth] Initial getSession:', session ? 'Session exists' : 'No session');
      if (session?.user) {
        if (import.meta.env.DEV) console.log('[Auth] Initial session user:', session.user.id, session.user.email);
      }
      setSession(session);
      if (session?.user) {
        fetchUserData(session.user.id, session.user);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('[Auth] getSession failed:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (import.meta.env.DEV) console.log('[Auth] Auth state changed:', event, 'Session:', session ? 'exists' : 'null');
      if (event === 'TOKEN_REFRESHED' && import.meta.env.DEV) {
        console.log('[Auth] Token refreshed successfully');
      }
      if (session?.user) {
        if (import.meta.env.DEV) console.log('[Auth] User from session:', session.user.id, session.user.email);
      }
      setSession(session);
      if (session?.user) {
        fetchUserData(session.user.id, session.user);
      } else if (event === 'SIGNED_OUT' || !session) {
        resetUserData();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch all user data
  const fetchUserData = async (userId, authUser = null) => {
    setLoading(true);
    try {
      // Fetch profile with stats
      const { data: profileData, error: profileError } = await supabase
        .rpc('get_user_profile', { p_user_id: userId });

      if (profileError) {
        if (import.meta.env.DEV) console.log('[Auth] RPC get_user_profile failed (expected if function not created):', profileError.message);
        // If function doesn't exist yet, fetch basic profile
        let { data: basicProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (fetchError) {
          if (import.meta.env.DEV) console.log('[Auth] Profile fetch result:', fetchError.code === 'PGRST116' ? 'No profile found (will create)' : fetchError.message);
        }

        // If no profile exists and we have auth user data, create one
        if (!basicProfile && authUser) {
          const userMeta = authUser.user_metadata || {};
          if (import.meta.env.DEV) console.log('[Auth] Creating new profile for user:', userId);
          if (import.meta.env.DEV) console.log('[Auth] User metadata from Google:', { name: userMeta.full_name || userMeta.name, email: authUser.email });

          const newProfile = {
            id: userId,
            email: authUser.email || '',
            full_name: userMeta.full_name || userMeta.name || '',
            avatar_url: userMeta.avatar_url || userMeta.picture || null,
            location: 'Squamish, BC',
            created_at: new Date().toISOString()
          };

          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .single();

          if (createError) {
            console.error('[Auth] ERROR creating profile:', createError.message, createError.details, createError.hint);
          } else {
            if (import.meta.env.DEV) console.log('[Auth] Profile created successfully:', createdProfile.id);
            basicProfile = createdProfile;
          }
        }

        if (basicProfile) {
          setUser({
            id: basicProfile.id,
            name: basicProfile.full_name || '',
            email: basicProfile.email || '',
            avatar: basicProfile.avatar_url,
            coverPhoto: basicProfile.cover_photo_url,
            phone: basicProfile.phone || '',
            bio: basicProfile.bio || '',
            location: basicProfile.location || 'Squamish, BC',
            memberSince: basicProfile.created_at,
            interests: basicProfile.interests || [],
            isGuest: false,
            isAdmin: basicProfile.is_admin || false,
            socialLinks: {
              instagram: basicProfile.instagram || '',
              facebook: basicProfile.facebook || '',
              website: basicProfile.website || ''
            },
            notifications: {
              eventReminders: basicProfile.notify_event_reminders ?? true,
              newDeals: basicProfile.notify_new_deals ?? true,
              weeklyDigest: basicProfile.notify_weekly_digest ?? true,
              businessUpdates: basicProfile.notify_business_updates ?? false
            },
            privacy: {
              showActivity: basicProfile.privacy_show_activity ?? true,
              showSavedItems: basicProfile.privacy_show_saved ?? false,
              showAttendance: basicProfile.privacy_show_attendance ?? true
            }
          });

          setUserStats(prev => ({
            ...prev,
            totalXP: basicProfile.total_xp || 0,
            level: basicProfile.current_level || 1,
            currentStreak: basicProfile.current_streak || 0,
            longestStreak: basicProfile.longest_streak || 0,
            localHeroScore: basicProfile.hero_score || 0
          }));
        } else if (authUser) {
          // Fallback: Even if profile doesn't exist in DB, still authenticate the user
          // using the auth user metadata so they're not stuck as a guest
          const userMeta = authUser.user_metadata || {};
          setUser({
            id: userId,
            name: userMeta.full_name || userMeta.name || '',
            email: authUser.email || '',
            avatar: userMeta.avatar_url || userMeta.picture || null,
            coverPhoto: null,
            phone: '',
            bio: '',
            location: 'Squamish, BC',
            memberSince: new Date().toISOString(),
            interests: [],
            isGuest: false,
            isAdmin: false,
            socialLinks: { instagram: '', facebook: '', website: '' },
            notifications: { eventReminders: true, newDeals: true, weeklyDigest: true, businessUpdates: false },
            privacy: { showActivity: true, showSavedItems: false, showAttendance: true }
          });
        }
      } else if (profileData) {
        // Set user from RPC response
        setUser({
          id: profileData.id,
          name: profileData.name || '',
          email: profileData.email || '',
          avatar: profileData.avatar,
          coverPhoto: profileData.coverPhoto,
          phone: profileData.phone || '',
          bio: profileData.bio || '',
          location: profileData.location || 'Squamish, BC',
          memberSince: profileData.memberSince,
          interests: profileData.interests || [],
          isGuest: false,
          isAdmin: profileData.isAdmin || profileData.is_admin || false,
          socialLinks: profileData.socialLinks || { instagram: '', facebook: '', website: '' },
          notifications: profileData.notifications || { eventReminders: true, newDeals: true, weeklyDigest: true, businessUpdates: false },
          privacy: profileData.privacy || { showActivity: true, showSavedItems: false, showAttendance: true }
        });

        // Set stats
        if (profileData.stats) {
          const stats = profileData.stats;
          const level = stats.current_level || 1;
          const totalXP = stats.total_xp || 0;
          const xpForCurrentLevel = Math.ceil(Math.pow(level - 1, 1.5) * 100);
          const xpForNextLevel = Math.ceil(Math.pow(level, 1.5) * 100);

          setUserStats({
            eventsAttended: stats.events_attended || 0,
            classesCompleted: stats.classes_completed || 0,
            dealsRedeemed: stats.deals_redeemed || 0,
            reviewsWritten: stats.reviews_written || 0,
            businessesSupported: stats.businesses_supported || 0,
            checkIns: stats.items_saved || 0,
            totalXP: totalXP,
            level: level,
            xpToNextLevel: xpForNextLevel - totalXP,
            xpForCurrentLevel: xpForNextLevel - xpForCurrentLevel,
            currentStreak: stats.current_streak || 0,
            longestStreak: stats.longest_streak || 0,
            communityRank: 0, // Will be fetched separately
            totalMembers: 0,
            localHeroScore: stats.hero_score || 0
          });
        }

        // Set achievements
        if (profileData.achievements) {
          setUserAchievements(profileData.achievements.map((a, idx) => ({
            id: idx + 1,
            name: a.name,
            description: a.description,
            icon: a.icon,
            earned: true,
            date: a.unlocked_at,
            color: a.color,
            type: a.type
          })));
        }

        // Set activity
        if (profileData.recentActivity) {
          setUserActivity(profileData.recentActivity.map((a, idx) => ({
            id: idx + 1,
            type: a.action_type,
            action: a.action_type.replace('_', ' '),
            title: a.metadata?.event_name || a.metadata?.item_type || a.action_type,
            date: a.created_at,
            xpEarned: a.xp_earned
          })));
        }
      }

      // Fetch saved items, calendar, claimed businesses, and leaderboard in parallel
      const [savedResult, calendarResult, claimsResult, leaderboardResult] = await Promise.all([
        supabase.rpc('get_user_saved_items', { p_user_id: userId }),
        supabase.rpc('get_user_calendar', { p_user_id: userId }),
        supabase.from('business_claims').select('*').eq('user_id', userId).eq('status', 'verified'),
        supabase.rpc('get_leaderboard', { p_limit: 100 }),
      ]);

      if (savedResult.data) setSavedItems(savedResult.data);
      if (calendarResult.data) setMyCalendar(calendarResult.data);
      if (claimsResult.data) {
        setUserClaimedBusinesses(claimsResult.data.filter(c => c.business_id).map(c => ({
          id: c.business_id,
          claimId: c.id,
          name: c.business_name,
          address: c.business_address,
          verified: true,
          category: c.business_category
        })));
      }
      if (leaderboardResult.data) {
        const userRankIndex = leaderboardResult.data.findIndex(u => u.user_id === userId);
        const userRank = userRankIndex >= 0 ? userRankIndex + 1 : leaderboardResult.data.length + 1;
        setUserStats(prev => ({
          ...prev,
          communityRank: userRank,
          totalMembers: leaderboardResult.data.length
        }));
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Set Sentry user context when user state changes
  useEffect(() => {
    if (user.id && !user.isGuest) {
      setSentryUser(user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.isGuest, user.email, user.name]);

  // Reset data on logout
  const resetUserData = () => {
    // Clear Sentry user context
    clearSentryUser();
    setUser({
      id: null,
      name: '',
      email: '',
      avatar: null,
      coverPhoto: null,
      phone: '',
      bio: '',
      location: 'Squamish, BC',
      memberSince: null,
      interests: [],
      isGuest: true,
      isAdmin: false,
      socialLinks: { instagram: '', facebook: '', website: '' },
      notifications: { eventReminders: true, newDeals: true, weeklyDigest: true, businessUpdates: false },
      privacy: { showActivity: true, showSavedItems: false, showAttendance: true }
    });
    setUserStats({
      eventsAttended: 0,
      classesCompleted: 0,
      dealsRedeemed: 0,
      reviewsWritten: 0,
      businessesSupported: 0,
      checkIns: 0,
      totalXP: 0,
      level: 1,
      xpToNextLevel: 100,
      xpForCurrentLevel: 0,
      currentStreak: 0,
      longestStreak: 0,
      communityRank: 0,
      totalMembers: 0,
      localHeroScore: 0
    });
    setUserAchievements([]);
    setUserActivity([]);
    setSavedItems([]);
    setMyCalendar([]);
    setUserClaimedBusinesses([]);
    setLoading(false);
  };

  // Update profile
  const updateProfile = async (updates) => {
    if (!session?.user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.name,
        phone: updates.phone,
        bio: updates.bio,
        location: updates.location,
        interests: updates.interests,
        instagram: updates.socialLinks?.instagram,
        facebook: updates.socialLinks?.facebook,
        website: updates.socialLinks?.website,
        notify_event_reminders: updates.notifications?.eventReminders,
        notify_new_deals: updates.notifications?.newDeals,
        notify_weekly_digest: updates.notifications?.weeklyDigest,
        notify_business_updates: updates.notifications?.businessUpdates,
        privacy_show_activity: updates.privacy?.showActivity,
        privacy_show_saved: updates.privacy?.showSavedItems,
        privacy_show_attendance: updates.privacy?.showAttendance,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.user.id);

    if (!error) {
      setUser(prev => ({ ...prev, ...updates }));
    }
    return { error };
  };

  // Update avatar
  const updateAvatar = async (file) => {
    if (!session?.user) return { error: 'Not authenticated' };
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return { error: 'Only image files (PNG, JPG, GIF, WebP) are allowed' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: 'Image too large (max 5MB)' };
    }

    const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const safeExt = mimeToExt[file.type] || 'png';
    const fileName = `${session.user.id}/avatar.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', session.user.id);

    if (!updateError) {
      setUser(prev => ({ ...prev, avatar: publicUrl }));
    }
    return { error: updateError, url: publicUrl };
  };

  // Update cover photo
  const updateCoverPhoto = async (file) => {
    if (!session?.user) return { error: 'Not authenticated' };
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return { error: 'Only image files (PNG, JPG, GIF, WebP) are allowed' };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { error: 'Image too large (max 10MB)' };
    }

    const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const safeExt = mimeToExt[file.type] || 'png';
    const fileName = `${session.user.id}/cover.${safeExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) return { error: uploadError };

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ cover_photo_url: publicUrl })
      .eq('id', session.user.id);

    if (!updateError) {
      setUser(prev => ({ ...prev, coverPhoto: publicUrl }));
    }
    return { error: updateError, url: publicUrl };
  };

  // Toggle save item
  const toggleSaveItem = async (itemType, itemId, itemName, itemData = {}) => {
    if (!session?.user) return { error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('toggle_save_item', {
      p_user_id: session.user.id,
      p_item_type: itemType,
      p_item_id: itemId,
      p_item_name: itemName,
      p_item_data: itemData
    });

    if (!error) {
      // Refresh saved items
      const { data: savedData } = await supabase
        .rpc('get_user_saved_items', { p_user_id: session.user.id });
      if (savedData) setSavedItems(savedData);
    }

    return data || { error };
  };

  // Check if item is saved
  const isItemSaved = useCallback((itemType, itemId) => {
    return savedItems.some(item => item.type === itemType && item.itemId === itemId);
  }, [savedItems]);

  // Register for event
  const registerForEvent = async (event) => {
    if (!session?.user) return { error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('register_for_event', {
      p_user_id: session.user.id,
      p_event_type: event.eventType || 'event',
      p_event_id: event.id,
      p_event_name: event.title,
      p_event_date: event.date,
      p_event_time: event.time,
      p_venue_name: event.venue,
      p_venue_address: event.address,
      p_event_data: event
    });

    if (!error) {
      // Refresh calendar
      const { data: calendarData } = await supabase
        .rpc('get_user_calendar', { p_user_id: session.user.id });
      if (calendarData) setMyCalendar(calendarData);
    }

    return data || { error };
  };

  // Refresh all data
  const refreshUserData = () => {
    if (session?.user) {
      fetchUserData(session.user.id, session.user);
    }
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    resetUserData();
    setSession(null);
  };

  return {
    // Auth
    session,
    isAuthenticated: !!session?.user,
    loading,

    // User data
    user,
    userStats,
    userAchievements,
    userActivity,
    savedItems,
    myCalendar,
    userClaimedBusinesses,

    // Setters (for local updates before DB sync)
    setUser,
    setUserStats,
    setUserAchievements,
    setUserActivity,
    setSavedItems,
    setMyCalendar,
    setUserClaimedBusinesses,

    // Actions
    updateProfile,
    updateAvatar,
    updateCoverPhoto,
    toggleSaveItem,
    isItemSaved,
    registerForEvent,
    refreshUserData,
    signOut
  };
}

export default useUserData;
