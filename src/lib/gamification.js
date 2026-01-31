import { supabase } from './supabase';

/**
 * XP Rewards Configuration
 */
export const XP_REWARDS = {
  event_attendance: 100,
  class_attendance: 100,
  first_visit: 50,
  review: 75,
  deal_redemption: 50,
  save_item: 25,
  daily_checkin: 10, // multiplied by streak
  referral: 200,
};

/**
 * Add XP for a user action
 * @param {string} actionType - Type of action (event_attendance, review, etc.)
 * @param {string} referenceId - Optional ID of related business/event
 * @param {object} metadata - Optional additional data
 * @returns {Promise<{success, xp_earned, total_xp, new_level, level_up, new_achievements}>}
 */
export async function addUserXP(actionType, referenceId = null, metadata = {}) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  const { data, error } = await supabase.rpc('add_user_xp', {
    p_user_id: user.id,
    p_action_type: actionType,
    p_reference_id: referenceId,
    p_metadata: metadata,
  });

  if (error) {
    console.error('Error adding XP:', error);
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Get user's gamification stats
 * @returns {Promise<{total_xp, current_level, current_streak, achievements, etc.}>}
 */
export async function getUserStats() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'User not authenticated' };
  }

  const { data, error } = await supabase.rpc('get_user_gamification_stats', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error getting user stats:', error);
    return { error: error.message };
  }

  return data;
}

/**
 * Get the community leaderboard
 * @param {number} limit - Number of users to return
 * @returns {Promise<Array>}
 */
export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_limit: limit,
  });

  if (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }

  return data || [];
}

/**
 * Calculate level from XP
 * @param {number} totalXP
 * @returns {number}
 */
export function calculateLevel(totalXP) {
  return Math.floor(Math.pow(totalXP / 100, 0.667)) + 1;
}

/**
 * Calculate XP needed for a specific level
 * @param {number} level
 * @returns {number}
 */
export function xpForLevel(level) {
  return Math.ceil(Math.pow(level - 1, 1.5) * 100);
}

/**
 * Calculate XP progress to next level
 * @param {number} totalXP
 * @param {number} currentLevel
 * @returns {{current: number, needed: number, percent: number}}
 */
export function getLevelProgress(totalXP, currentLevel) {
  const currentLevelXP = xpForLevel(currentLevel);
  const nextLevelXP = xpForLevel(currentLevel + 1);
  const xpInCurrentLevel = totalXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;

  return {
    current: xpInCurrentLevel,
    needed: xpNeededForLevel,
    remaining: nextLevelXP - totalXP,
    percent: Math.round((xpInCurrentLevel / xpNeededForLevel) * 100),
  };
}

/**
 * Get level title based on level number
 * @param {number} level
 * @returns {string}
 */
export function getLevelTitle(level) {
  if (level >= 100) return 'Ultimate Local';
  if (level >= 75) return 'Squamish Legend';
  if (level >= 50) return 'Community Champion';
  if (level >= 35) return 'Local Hero';
  if (level >= 25) return 'Community Pillar';
  if (level >= 15) return 'Active Member';
  if (level >= 10) return 'Local Regular';
  if (level >= 5) return 'Rising Star';
  if (level >= 3) return 'Getting Started';
  return 'Newcomer';
}

/**
 * Track event attendance
 */
export async function trackEventAttendance(eventId) {
  return addUserXP('event_attendance', eventId);
}

/**
 * Track class attendance
 */
export async function trackClassAttendance(classId) {
  return addUserXP('class_attendance', classId);
}

/**
 * Track business first visit
 */
export async function trackFirstVisit(businessId) {
  return addUserXP('first_visit', businessId);
}

/**
 * Track review submission
 */
export async function trackReview(businessId, rating) {
  return addUserXP('review', businessId, { rating });
}

/**
 * Track deal redemption
 */
export async function trackDealRedemption(dealId) {
  return addUserXP('deal_redemption', dealId);
}

/**
 * Track item save
 */
export async function trackSaveItem(itemId, itemType) {
  return addUserXP('save_item', itemId, { item_type: itemType });
}

/**
 * Track daily check-in
 */
export async function trackDailyCheckin() {
  return addUserXP('daily_checkin');
}

/**
 * Track referral
 */
export async function trackReferral(referredUserId) {
  return addUserXP('referral', referredUserId);
}
