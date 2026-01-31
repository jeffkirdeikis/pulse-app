import { supabase } from './supabase';

/**
 * Track a business profile view
 */
export async function trackBusinessView(businessId, source = 'browse') {
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.rpc('track_business_view', {
    p_business_id: businessId,
    p_viewer_id: user?.id || null,
    p_source: source
  });
}

/**
 * Toggle follow/unfollow a business
 */
export async function toggleFollowBusiness(businessId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase.rpc('toggle_follow_business', {
    p_business_id: businessId,
    p_user_id: user.id
  });

  return data || { error };
}

/**
 * Check if user follows a business
 */
export async function isFollowingBusiness(businessId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('business_followers')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .single();

  return !!data;
}

/**
 * Get business analytics (for business owners)
 */
export async function getBusinessAnalytics(businessId, days = 30) {
  const { data, error } = await supabase.rpc('get_business_analytics', {
    p_business_id: businessId,
    p_days: days
  });

  if (error) {
    console.error('Error fetching analytics:', error);
    return null;
  }

  return data;
}

/**
 * Get social proof data for a business (public)
 */
export async function getBusinessSocialProof(businessId) {
  const { data, error } = await supabase.rpc('get_business_social_proof', {
    p_business_id: businessId
  });

  if (error) {
    console.error('Error fetching social proof:', error);
    return null;
  }

  return data;
}

/**
 * Calculate/refresh Pulse Score for a business
 */
export async function calculatePulseScore(businessId) {
  const { data, error } = await supabase.rpc('calculate_pulse_score', {
    p_business_id: businessId
  });

  if (error) {
    console.error('Error calculating score:', error);
    return null;
  }

  return data;
}

/**
 * Get business Pulse Score
 */
export async function getBusinessPulseScore(businessId) {
  const { data, error } = await supabase
    .from('business_pulse_scores')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching pulse score:', error);
    return null;
  }

  return data;
}

/**
 * Get featured testimonials for a business
 */
export async function getBusinessTestimonials(businessId, limit = 5) {
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('business_id', businessId)
    .eq('approved', true)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching testimonials:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a booking/inquiry
 */
export async function createBooking(businessId, serviceType, details = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      business_id: businessId,
      user_id: user.id,
      service_type: serviceType,
      notes: details.notes,
      scheduled_date: details.date,
      scheduled_time: details.time
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    return { error: error.message };
  }

  return { data };
}

/**
 * Generate social proof text based on real data
 */
export function generateSocialProofText(socialProof, googleRating, googleReviews) {
  if (!socialProof) {
    // Fallback to Google data if no Pulse data
    if (googleRating >= 4.8 && googleReviews >= 50) {
      return { type: 'excellent', text: `⭐ ${googleRating} rating from ${googleReviews} Google reviews` };
    }
    if (googleRating >= 4.5 && googleReviews >= 20) {
      return { type: 'highrated', text: `⭐ Highly rated (${googleRating}/5)` };
    }
    if (googleReviews >= 50) {
      return { type: 'reviewed', text: `📍 ${googleReviews} Google reviews` };
    }
    if (googleRating >= 4.0) {
      return { type: 'rated', text: `⭐ ${googleRating}/5 on Google` };
    }
    return { type: 'default', text: '📍 Local Squamish Business' };
  }

  // Priority order for social proof
  const { jobs_completed, neighbor_hires, testimonial, response_time_minutes, satisfaction_rate, years_active } = socialProof;

  // Jobs completed on Pulse (most compelling)
  if (jobs_completed >= 100) {
    return { type: 'volume', text: `📈 ${jobs_completed}+ jobs completed on Pulse` };
  }

  // Neighbor social proof
  if (neighbor_hires >= 3) {
    return { type: 'neighbor', text: `👥 ${neighbor_hires} neighbors hired them` };
  }

  // Jobs completed (lower threshold)
  if (jobs_completed >= 10) {
    return { type: 'trusted', text: `✅ ${jobs_completed} jobs completed on Pulse` };
  }

  // Fast response time
  if (response_time_minutes && response_time_minutes <= 60) {
    const timeText = response_time_minutes <= 30 ? '~30 min' :
                     response_time_minutes <= 60 ? '~1 hour' : 'same day';
    return { type: 'response', text: `⚡ Responds in ${timeText}` };
  }

  // Testimonial
  if (testimonial) {
    return { type: 'testimonial', text: `💬 "${testimonial.quote.substring(0, 50)}..." — ${testimonial.author}` };
  }

  // High satisfaction
  if (satisfaction_rate >= 95) {
    return { type: 'satisfaction', text: `✅ ${satisfaction_rate}% satisfaction rate` };
  }

  // Years in business
  if (years_active >= 5) {
    return { type: 'longevity', text: `📅 ${years_active} years serving Squamish` };
  }

  // Fallback to Google data
  if (googleRating >= 4.5) {
    return { type: 'highrated', text: `⭐ Highly rated (${googleRating}/5)` };
  }

  return { type: 'default', text: '📍 Local Squamish Business' };
}

/**
 * Format response time for display
 */
export function formatResponseTime(minutes) {
  if (!minutes) return null;
  if (minutes <= 30) return '~30 min';
  if (minutes <= 60) return '~1 hour';
  if (minutes <= 120) return '~2 hours';
  if (minutes <= 240) return '~4 hours';
  if (minutes <= 480) return 'same day';
  if (minutes <= 1440) return '~1 day';
  return `~${Math.round(minutes / 1440)} days`;
}

/**
 * Get leaderboard of top businesses
 */
export async function getBusinessLeaderboard(category = null, limit = 10) {
  let query = supabase
    .from('business_pulse_scores')
    .select(`
      *,
      businesses (id, name, category, google_rating, google_reviews)
    `)
    .order('total_score', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('businesses.category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}
