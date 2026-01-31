-- ============================================================================
-- PULSE APP - COMPLETE DATABASE SCHEMA
-- Billion-dollar app analytics, gamification, and user data
-- ============================================================================
--
-- Run this entire file in Supabase SQL Editor to set up your database
-- This script is IDEMPOTENT - safe to run multiple times
--
-- ============================================================================


-- ============================================================================
-- CLEANUP: Drop existing tables (CASCADE removes policies, indexes, triggers)
-- ============================================================================

-- Drop tables - CASCADE automatically removes all policies, indexes, and triggers
DROP TABLE IF EXISTS user_cohorts CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS content_flags CASCADE;
DROP TABLE IF EXISTS user_feedback CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS shares CASCADE;
DROP TABLE IF EXISTS ab_test_assignments CASCADE;
DROP TABLE IF EXISTS funnel_events CASCADE;
DROP TABLE IF EXISTS click_events CASCADE;
DROP TABLE IF EXISTS search_analytics CASCADE;
DROP TABLE IF EXISTS screen_views CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS neighbor_hires CASCADE;
DROP TABLE IF EXISTS testimonials CASCADE;
DROP TABLE IF EXISTS business_pulse_scores CASCADE;
DROP TABLE IF EXISTS business_analytics_daily CASCADE;
DROP TABLE IF EXISTS business_messages CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS business_followers CASCADE;
DROP TABLE IF EXISTS business_views CASCADE;
DROP TABLE IF EXISTS deal_redemptions CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS business_claims CASCADE;
DROP TABLE IF EXISTS review_votes CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS user_calendar CASCADE;
DROP TABLE IF EXISTS saved_items CASCADE;
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS user_actions CASCADE;
DROP TABLE IF EXISTS achievement_definitions CASCADE;
DROP TABLE IF EXISTS xp_rewards CASCADE;

-- Drop trigger on auth.users (if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;


-- ============================================================================
-- PART 1: CORE USER SYSTEM
-- ============================================================================

-- 1.1 Profiles (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    avatar_url text,
    cover_photo_url text,
    phone text,
    bio text DEFAULT '',
    location text DEFAULT 'Squamish, BC',
    interests text[] DEFAULT '{}',

    -- Social links
    instagram text DEFAULT '',
    facebook text DEFAULT '',
    website text DEFAULT '',

    -- Notification preferences
    notify_event_reminders boolean DEFAULT true,
    notify_new_deals boolean DEFAULT true,
    notify_weekly_digest boolean DEFAULT true,
    notify_business_updates boolean DEFAULT false,
    notify_push_enabled boolean DEFAULT true,
    notify_email_enabled boolean DEFAULT true,
    notify_sms_enabled boolean DEFAULT false,

    -- Privacy settings
    privacy_show_activity boolean DEFAULT true,
    privacy_show_saved boolean DEFAULT false,
    privacy_show_attendance boolean DEFAULT true,
    privacy_show_location boolean DEFAULT true,
    privacy_searchable boolean DEFAULT true,

    -- Gamification
    total_xp integer DEFAULT 0,
    current_level integer DEFAULT 1,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date date,
    hero_score integer DEFAULT 0,

    -- User segmentation
    user_type text DEFAULT 'consumer' CHECK (user_type IN ('consumer', 'business_owner', 'admin', 'moderator')),
    is_verified boolean DEFAULT false,
    is_premium boolean DEFAULT false,
    premium_until timestamptz,

    -- Referral system
    referral_code text UNIQUE,
    referred_by uuid REFERENCES profiles(id),
    referral_count integer DEFAULT 0,

    -- Trust & Safety
    trust_score integer DEFAULT 100,  -- 0-100, affects visibility
    is_banned boolean DEFAULT false,
    banned_until timestamptz,
    ban_reason text,
    flags_received integer DEFAULT 0,
    flags_given integer DEFAULT 0,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_seen_at timestamptz DEFAULT now(),
    onboarding_completed_at timestamptz
);

-- Generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS trigger AS $$
BEGIN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON profiles;
CREATE TRIGGER set_referral_code
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION generate_referral_code();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================================
-- PART 2: GAMIFICATION SYSTEM
-- ============================================================================

-- 2.1 XP Rewards Configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS xp_rewards (
    action_type text PRIMARY KEY,
    base_xp integer NOT NULL,
    description text,
    cooldown_minutes integer DEFAULT 0,  -- Prevent spam
    daily_limit integer,  -- Max times per day
    requires_verification boolean DEFAULT false
);

INSERT INTO xp_rewards (action_type, base_xp, description, cooldown_minutes, daily_limit) VALUES
    ('event_attendance', 100, 'Attend an event', 0, NULL),
    ('class_attendance', 100, 'Attend a class', 0, NULL),
    ('first_visit', 50, 'First visit to a business', 1440, NULL),  -- Once per day per business
    ('review', 75, 'Write a review', 60, 5),
    ('deal_redemption', 50, 'Redeem a deal', 0, NULL),
    ('save_item', 25, 'Save an item', 1, 50),
    ('daily_checkin', 10, 'Daily check-in (multiplied by streak)', 1440, 1),
    ('referral', 200, 'Refer a friend', 0, NULL),
    ('profile_complete', 100, 'Complete your profile', 0, 1),
    ('first_booking', 150, 'Make your first booking', 0, 1),
    ('photo_upload', 25, 'Upload a photo', 5, 10),
    ('helpful_review', 10, 'Your review marked helpful', 0, NULL),
    ('share_business', 15, 'Share a business', 5, 10),
    ('share_event', 15, 'Share an event', 5, 10),
    ('share_deal', 15, 'Share a deal', 5, 10)
ON CONFLICT (action_type) DO UPDATE SET
    base_xp = EXCLUDED.base_xp,
    description = EXCLUDED.description;


-- 2.2 User Actions (XP earning history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_type text NOT NULL,
    xp_earned integer NOT NULL DEFAULT 0,
    reference_id uuid,  -- Links to business/event/class id
    reference_type text,  -- 'business', 'event', 'deal', 'review'
    metadata jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_user_date ON user_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_reference ON user_actions(reference_type, reference_id);


-- 2.3 Achievement Definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS achievement_definitions (
    achievement_type text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    icon text DEFAULT 'Star',
    color text DEFAULT '#6366f1',
    xp_reward integer DEFAULT 0,
    tier integer DEFAULT 1,  -- 1=bronze, 2=silver, 3=gold, 4=platinum
    secret boolean DEFAULT false,  -- Hidden until unlocked
    category text DEFAULT 'general'
);

INSERT INTO achievement_definitions (achievement_type, name, description, icon, color, xp_reward, tier, category) VALUES
    -- Event milestones
    ('first_event', 'Event Explorer', 'Attended your first event', 'Calendar', '#10b981', 50, 1, 'events'),
    ('events_5', 'Social Starter', 'Attended 5 events', 'Calendar', '#10b981', 100, 1, 'events'),
    ('events_10', 'Event Enthusiast', 'Attended 10 events', 'Calendar', '#10b981', 200, 2, 'events'),
    ('events_25', 'Community Regular', 'Attended 25 events', 'Calendar', '#10b981', 500, 2, 'events'),
    ('events_50', 'Event Master', 'Attended 50 events', 'Calendar', '#10b981', 1000, 3, 'events'),
    ('events_100', 'Legendary Attendee', 'Attended 100 events', 'Calendar', '#10b981', 2500, 4, 'events'),
    -- Review milestones
    ('first_review', 'Voice Heard', 'Wrote your first review', 'Star', '#f59e0b', 50, 1, 'reviews'),
    ('reviews_5', 'Helpful Critic', 'Wrote 5 reviews', 'Star', '#f59e0b', 100, 1, 'reviews'),
    ('reviews_10', 'Trusted Reviewer', 'Wrote 10 reviews', 'Star', '#f59e0b', 200, 2, 'reviews'),
    ('reviews_25', 'Review Expert', 'Wrote 25 reviews', 'Star', '#f59e0b', 500, 2, 'reviews'),
    ('reviews_50', 'Review Legend', 'Wrote 50 reviews', 'Star', '#f59e0b', 1000, 3, 'reviews'),
    -- Streak achievements
    ('streak_3', 'Getting Started', '3-day activity streak', 'Zap', '#f97316', 25, 1, 'engagement'),
    ('streak_7', 'Week Warrior', '7-day activity streak', 'Zap', '#f97316', 100, 1, 'engagement'),
    ('streak_14', 'Fortnight Fighter', '14-day activity streak', 'Zap', '#f97316', 250, 2, 'engagement'),
    ('streak_30', 'Monthly Master', '30-day activity streak', 'Zap', '#f97316', 500, 2, 'engagement'),
    ('streak_60', 'Dedication King', '60-day activity streak', 'Zap', '#f97316', 1000, 3, 'engagement'),
    ('streak_100', 'Unstoppable', '100-day activity streak', 'Zap', '#f97316', 2500, 4, 'engagement'),
    -- Level achievements
    ('level_5', 'Rising Star', 'Reached level 5', 'TrendingUp', '#8b5cf6', 100, 1, 'levels'),
    ('level_10', 'Local Regular', 'Reached level 10', 'TrendingUp', '#8b5cf6', 250, 2, 'levels'),
    ('level_25', 'Community Pillar', 'Reached level 25', 'TrendingUp', '#8b5cf6', 500, 2, 'levels'),
    ('level_50', 'Squamish Legend', 'Reached level 50', 'TrendingUp', '#8b5cf6', 1000, 3, 'levels'),
    ('level_100', 'Ultimate Local', 'Reached level 100', 'TrendingUp', '#8b5cf6', 5000, 4, 'levels'),
    -- Special achievements
    ('early_adopter', 'Early Adopter', 'Joined in the first month', 'Sparkles', '#8b5cf6', 100, 2, 'special'),
    ('local_explorer', 'Local Explorer', 'Visited 10+ unique businesses', 'MapPin', '#10b981', 200, 2, 'special'),
    ('deal_hunter', 'Deal Hunter', 'Redeemed 10+ deals', 'Percent', '#f59e0b', 150, 2, 'special'),
    ('social_butterfly', 'Social Butterfly', 'Connected with 25+ community members', 'Users', '#ec4899', 250, 2, 'special'),
    ('super_supporter', 'Super Supporter', 'Supported 50+ local businesses', 'Heart', '#ef4444', 500, 3, 'special'),
    ('community_champion', 'Community Champion', 'Top 10 on leaderboard', 'Trophy', '#eab308', 1000, 4, 'special'),
    ('night_owl', 'Night Owl', 'Active after midnight 10 times', 'Moon', '#6366f1', 50, 1, 'special'),
    ('early_bird', 'Early Bird', 'Active before 7am 10 times', 'Sun', '#f59e0b', 50, 1, 'special'),
    ('weekend_warrior', 'Weekend Warrior', 'Active every weekend for a month', 'Calendar', '#10b981', 150, 2, 'special'),
    ('first_referral', 'Connector', 'Referred your first friend', 'Users', '#ec4899', 100, 1, 'referrals'),
    ('referrals_5', 'Influencer', 'Referred 5 friends', 'Users', '#ec4899', 300, 2, 'referrals'),
    ('referrals_10', 'Ambassador', 'Referred 10 friends', 'Users', '#ec4899', 750, 3, 'referrals')
ON CONFLICT (achievement_type) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;


-- 2.4 User Achievements
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_type text NOT NULL REFERENCES achievement_definitions(achievement_type),
    unlocked_at timestamptz DEFAULT now(),
    notified boolean DEFAULT false,
    UNIQUE(user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);


-- 2.5 Add User XP Function
-- ============================================================================
CREATE OR REPLACE FUNCTION add_user_xp(
    p_user_id uuid,
    p_action_type text,
    p_reference_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_xp integer;
    v_xp_earned integer;
    v_old_level integer;
    v_new_level integer;
    v_new_total_xp integer;
    v_current_streak integer;
    v_longest_streak integer;
    v_last_activity date;
    v_today date := CURRENT_DATE;
    v_streak_bonus integer := 0;
    v_new_achievements text[] := '{}';
    v_achievement_xp integer := 0;
    v_cooldown integer;
    v_daily_limit integer;
    v_action_count integer;
BEGIN
    -- Get reward config
    SELECT base_xp, cooldown_minutes, daily_limit INTO v_base_xp, v_cooldown, v_daily_limit
    FROM xp_rewards WHERE action_type = p_action_type;

    IF v_base_xp IS NULL THEN
        RAISE EXCEPTION 'Invalid action type: %', p_action_type;
    END IF;

    -- Check cooldown
    IF v_cooldown > 0 THEN
        SELECT COUNT(*) INTO v_action_count
        FROM user_actions
        WHERE user_id = p_user_id
        AND action_type = p_action_type
        AND (p_reference_id IS NULL OR reference_id = p_reference_id)
        AND created_at > NOW() - (v_cooldown || ' minutes')::interval;

        IF v_action_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Action on cooldown');
        END IF;
    END IF;

    -- Check daily limit
    IF v_daily_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_action_count
        FROM user_actions
        WHERE user_id = p_user_id
        AND action_type = p_action_type
        AND created_at::date = CURRENT_DATE;

        IF v_action_count >= v_daily_limit THEN
            RETURN jsonb_build_object('success', false, 'error', 'Daily limit reached');
        END IF;
    END IF;

    -- Get current user stats
    SELECT current_level, total_xp, current_streak, longest_streak, last_activity_date
    INTO v_old_level, v_new_total_xp, v_current_streak, v_longest_streak, v_last_activity
    FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Calculate streak
    IF v_last_activity IS NULL THEN
        v_current_streak := 1;
    ELSIF v_last_activity = v_today THEN
        NULL;  -- Already active today
    ELSIF v_last_activity = v_today - 1 THEN
        v_current_streak := v_current_streak + 1;
    ELSE
        v_current_streak := 1;
    END IF;

    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;

    -- Calculate XP
    IF p_action_type = 'daily_checkin' THEN
        v_xp_earned := v_base_xp * LEAST(v_current_streak, 10);  -- Cap at 10x
    ELSE
        v_xp_earned := v_base_xp;
    END IF;

    -- Streak bonus (10% per day, max 50%)
    IF v_current_streak > 1 AND p_action_type != 'daily_checkin' THEN
        v_streak_bonus := LEAST(v_xp_earned * (v_current_streak - 1) * 0.1, v_xp_earned * 0.5)::integer;
        v_xp_earned := v_xp_earned + v_streak_bonus;
    END IF;

    v_new_total_xp := v_new_total_xp + v_xp_earned;
    v_new_level := FLOOR(POWER(v_new_total_xp::numeric / 100, 0.667)) + 1;

    -- Record action
    INSERT INTO user_actions (user_id, action_type, xp_earned, reference_id, metadata)
    VALUES (p_user_id, p_action_type, v_xp_earned, p_reference_id, p_metadata);

    -- Check achievements (streak)
    IF v_current_streak >= 3 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'streak_3') ON CONFLICT DO NOTHING;
    END IF;
    IF v_current_streak >= 7 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'streak_7') ON CONFLICT DO NOTHING;
    END IF;
    IF v_current_streak >= 14 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'streak_14') ON CONFLICT DO NOTHING;
    END IF;
    IF v_current_streak >= 30 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'streak_30') ON CONFLICT DO NOTHING;
    END IF;

    -- Check achievements (level)
    IF v_new_level >= 5 AND v_old_level < 5 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'level_5') ON CONFLICT DO NOTHING;
    END IF;
    IF v_new_level >= 10 AND v_old_level < 10 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'level_10') ON CONFLICT DO NOTHING;
    END IF;
    IF v_new_level >= 25 AND v_old_level < 25 THEN
        INSERT INTO user_achievements (user_id, achievement_type) VALUES (p_user_id, 'level_25') ON CONFLICT DO NOTHING;
    END IF;

    -- Update profile
    UPDATE profiles SET
        total_xp = v_new_total_xp,
        current_level = v_new_level,
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_activity_date = v_today,
        last_seen_at = NOW(),
        hero_score = (
            SELECT COALESCE(COUNT(*) FILTER (WHERE action_type = 'event_attendance'), 0) * 10 +
                   COALESCE(COUNT(*) FILTER (WHERE action_type = 'review'), 0) * 15 +
                   COALESCE(COUNT(*) FILTER (WHERE action_type = 'referral'), 0) * 25 +
                   v_current_streak * 5 + v_new_level * 10
            FROM user_actions WHERE user_id = p_user_id
        )
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'xp_earned', v_xp_earned,
        'streak_bonus', v_streak_bonus,
        'total_xp', v_new_total_xp,
        'old_level', v_old_level,
        'new_level', v_new_level,
        'level_up', v_new_level > v_old_level,
        'current_streak', v_current_streak
    );
END;
$$;


-- ============================================================================
-- PART 3: USER DATA & CONTENT
-- ============================================================================

-- 3.1 Saved Items
-- ============================================================================
CREATE TABLE IF NOT EXISTS saved_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_type text NOT NULL CHECK (item_type IN ('event', 'deal', 'service', 'class')),
    item_id text NOT NULL,
    item_name text NOT NULL,
    item_data jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id);


-- 3.2 User Calendar
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_calendar (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('event', 'class')),
    event_id text NOT NULL,
    event_name text NOT NULL,
    event_date date NOT NULL,
    event_time time,
    venue_name text,
    venue_address text,
    event_data jsonb DEFAULT '{}',
    status text DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled', 'no_show')),
    reminder_sent boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, event_type, event_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_user ON user_calendar(user_id);
CREATE INDEX IF NOT EXISTS idx_user_calendar_date ON user_calendar(event_date);


-- 3.3 Reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title text,
    content text,
    photos text[] DEFAULT '{}',

    -- Engagement
    helpful_count integer DEFAULT 0,
    not_helpful_count integer DEFAULT 0,
    reply_count integer DEFAULT 0,

    -- Moderation
    status text DEFAULT 'published' CHECK (status IN ('published', 'pending', 'hidden', 'flagged')),
    flagged_reason text,
    moderated_at timestamptz,
    moderated_by uuid REFERENCES profiles(id),

    -- Verification
    is_verified_purchase boolean DEFAULT false,  -- User actually booked/visited
    visit_date date,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);


-- 3.4 Review Votes (helpful/not helpful)
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vote_type text NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(review_id, user_id)
);


-- 3.5 Business Claims
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    business_name text NOT NULL,
    business_address text,
    business_category text,

    -- Verification
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    verification_method text,  -- 'phone', 'email', 'document', 'in_person'
    verification_code text,
    verification_attempts integer DEFAULT 0,

    -- Documents
    documents jsonb DEFAULT '[]',  -- Array of document URLs

    verified_at timestamptz,
    verified_by uuid REFERENCES profiles(id),
    rejected_reason text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_claims_user ON business_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_business_claims_business ON business_claims(business_id);


-- 3.6 Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    venue_id uuid REFERENCES businesses(id),
    venue_name text NOT NULL,
    venue_address text,
    category text NOT NULL,
    event_type text DEFAULT 'event' CHECK (event_type IN ('event', 'class')),

    -- Scheduling
    start_date date NOT NULL,
    start_time time NOT NULL,
    end_time time,
    duration_minutes integer,
    timezone text DEFAULT 'America/Vancouver',

    -- Recurrence
    is_recurring boolean DEFAULT false,
    recurrence_rule text,
    recurrence_days text[],
    recurrence_end_date date,

    -- Pricing
    price numeric(10,2) DEFAULT 0,
    price_description text,
    is_free boolean DEFAULT false,

    -- Capacity
    max_capacity integer,
    current_attendees integer DEFAULT 0,
    waitlist_enabled boolean DEFAULT false,
    waitlist_count integer DEFAULT 0,

    -- Media
    image_url text,
    images text[] DEFAULT '{}',
    video_url text,

    -- Metadata
    tags text[] DEFAULT '{}',
    featured boolean DEFAULT false,
    status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'draft', 'sold_out')),

    -- Engagement
    view_count integer DEFAULT 0,
    save_count integer DEFAULT 0,
    share_count integer DEFAULT 0,

    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);


-- 3.7 Deals
-- ============================================================================
CREATE TABLE IF NOT EXISTS deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES businesses(id),
    business_name text NOT NULL,
    business_address text,

    title text NOT NULL,
    description text,
    category text,
    terms_conditions text,

    -- Deal details
    discount_type text CHECK (discount_type IN ('percent', 'fixed', 'bogo', 'free_item', 'special')),
    discount_value numeric(10,2),
    original_price numeric(10,2),
    deal_price numeric(10,2),

    -- Schedule
    schedule text,
    valid_from date,
    valid_until date,
    days_of_week text[],
    start_time time,
    end_time time,

    -- Limits
    max_redemptions integer,
    current_redemptions integer DEFAULT 0,
    redemptions_per_user integer DEFAULT 1,

    -- Media
    image_url text,

    -- Display
    featured boolean DEFAULT false,
    status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'paused', 'draft')),

    -- Engagement
    view_count integer DEFAULT 0,
    save_count integer DEFAULT 0,
    share_count integer DEFAULT 0,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_business ON deals(business_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_featured ON deals(featured) WHERE featured = true;


-- 3.8 Deal Redemptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id),

    -- Redemption details
    redemption_code text,
    status text DEFAULT 'redeemed' CHECK (status IN ('redeemed', 'used', 'expired', 'cancelled')),
    used_at timestamptz,

    -- Value tracking
    savings_amount numeric(10,2),

    redeemed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_redemptions_user ON deal_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_redemptions_deal ON deal_redemptions(deal_id);


-- ============================================================================
-- PART 4: BUSINESS ANALYTICS
-- ============================================================================

-- 4.1 Business Views (every view tracked)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Context
    source text DEFAULT 'browse',  -- 'browse', 'search', 'deal', 'event', 'share', 'qr', 'ad'
    referrer text,
    search_query text,  -- What they searched for

    -- Session
    session_id uuid,
    device_type text,  -- 'mobile', 'tablet', 'desktop'

    viewed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_views_business ON business_views(business_id);
CREATE INDEX IF NOT EXISTS idx_business_views_date ON business_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_business_views_source ON business_views(source);


-- 4.2 Business Followers
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_followers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notify_deals boolean DEFAULT true,
    notify_events boolean DEFAULT true,
    followed_at timestamptz DEFAULT now(),
    UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_followers_business ON business_followers(business_id);
CREATE INDEX IF NOT EXISTS idx_business_followers_user ON business_followers(user_id);


-- 4.3 Bookings
-- ============================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Booking details
    service_type text,
    service_name text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),

    -- Scheduling
    scheduled_date date,
    scheduled_time time,
    duration_minutes integer,

    -- Communication
    notes text,
    business_notes text,  -- Internal notes from business

    -- Completion
    completed_at timestamptz,
    cancelled_at timestamptz,
    cancellation_reason text,
    cancelled_by text,  -- 'user' or 'business'

    -- Value
    estimated_value numeric(10,2),
    actual_value numeric(10,2),

    -- Follow-up
    review_requested boolean DEFAULT false,
    review_id uuid REFERENCES reviews(id),

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(scheduled_date);


-- 4.4 Business Messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id uuid,  -- Group messages in conversations

    from_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    to_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    message_type text DEFAULT 'message' CHECK (message_type IN ('inquiry', 'reply', 'system', 'auto_reply')),
    subject text,
    content text,
    attachments jsonb DEFAULT '[]',

    -- Status
    read_at timestamptz,
    archived boolean DEFAULT false,

    -- For analytics
    response_time_seconds integer,  -- How long until business replied

    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_messages_business ON business_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_business_messages_conversation ON business_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_business_messages_created ON business_messages(created_at);


-- 4.5 Business Analytics (Daily Aggregated)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_analytics_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date date NOT NULL,

    -- Views
    views integer DEFAULT 0,
    unique_views integer DEFAULT 0,
    views_from_search integer DEFAULT 0,
    views_from_browse integer DEFAULT 0,
    views_from_share integer DEFAULT 0,

    -- Engagement
    saves integer DEFAULT 0,
    shares integer DEFAULT 0,
    followers_gained integer DEFAULT 0,
    followers_lost integer DEFAULT 0,
    profile_clicks integer DEFAULT 0,  -- Clicks to website/phone/directions

    -- Bookings
    inquiries integer DEFAULT 0,
    bookings integer DEFAULT 0,
    bookings_completed integer DEFAULT 0,
    bookings_cancelled integer DEFAULT 0,
    booking_value numeric(10,2) DEFAULT 0,

    -- Messages
    messages_received integer DEFAULT 0,
    messages_responded integer DEFAULT 0,
    avg_response_time_minutes integer,

    -- Deals
    deal_views integer DEFAULT 0,
    deal_redemptions integer DEFAULT 0,
    deal_revenue numeric(10,2) DEFAULT 0,

    -- Events
    event_views integer DEFAULT 0,
    event_registrations integer DEFAULT 0,

    -- Reviews
    reviews_received integer DEFAULT 0,
    avg_rating_received numeric(3,2),

    UNIQUE(business_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_business ON business_analytics_daily(business_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON business_analytics_daily(date);


-- 4.6 Business Pulse Scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_pulse_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

    -- Overall score (0-1000)
    total_score integer DEFAULT 0,

    -- Score components (0-100 each)
    profile_completion integer DEFAULT 0,
    engagement_score integer DEFAULT 0,
    response_score integer DEFAULT 0,
    quality_score integer DEFAULT 0,
    satisfaction_score integer DEFAULT 0,

    -- Rankings
    category_rank integer,
    overall_rank integer,
    percentile integer,

    -- Trend
    score_change_7d integer DEFAULT 0,
    score_change_30d integer DEFAULT 0,

    calculated_at timestamptz DEFAULT now(),
    UNIQUE(business_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_scores_total ON business_pulse_scores(total_score DESC);


-- 4.7 Testimonials
-- ============================================================================
CREATE TABLE IF NOT EXISTS testimonials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    quote text NOT NULL,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    user_display_name text,  -- "Mike R." format
    user_avatar_url text,

    featured boolean DEFAULT false,
    approved boolean DEFAULT false,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_business ON testimonials(business_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(business_id, featured) WHERE featured = true;


-- 4.8 Neighbor Hires (social proof)
-- ============================================================================
CREATE TABLE IF NOT EXISTS neighbor_hires (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES bookings(id),
    hired_at timestamptz DEFAULT now(),
    UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_neighbor_hires_business ON neighbor_hires(business_id);


-- ============================================================================
-- PART 5: ADVANCED ANALYTICS (BILLION-DOLLAR APP TRACKING)
-- ============================================================================

-- 5.1 User Sessions (app opens/usage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    anonymous_id uuid,  -- For non-logged-in users

    -- Session info
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    duration_seconds integer,

    -- Device info
    device_type text,  -- 'mobile', 'tablet', 'desktop'
    device_os text,  -- 'ios', 'android', 'windows', 'macos'
    device_model text,
    app_version text,
    browser text,

    -- Location
    ip_address inet,
    city text,
    region text,
    country text,
    latitude numeric(10,6),
    longitude numeric(10,6),

    -- Attribution
    utm_source text,
    utm_medium text,
    utm_campaign text,
    referrer text,

    -- Engagement
    screens_viewed integer DEFAULT 0,
    actions_taken integer DEFAULT 0,
    searches_made integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON user_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_anonymous ON user_sessions(anonymous_id);


-- 5.2 Page/Screen Views
-- ============================================================================
CREATE TABLE IF NOT EXISTS screen_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Screen info
    screen_name text NOT NULL,  -- 'home', 'search', 'business_detail', 'event_detail', etc.
    screen_params jsonb DEFAULT '{}',  -- { business_id: '...', category: '...' }

    -- Timing
    viewed_at timestamptz DEFAULT now(),
    time_on_screen_seconds integer,

    -- Scroll depth
    scroll_depth_percent integer,

    -- Previous screen (for flow analysis)
    previous_screen text,

    -- Interactions on this screen
    interactions jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_screen_views_session ON screen_views(session_id);
CREATE INDEX IF NOT EXISTS idx_screen_views_screen ON screen_views(screen_name);
CREATE INDEX IF NOT EXISTS idx_screen_views_time ON screen_views(viewed_at);


-- 5.3 Search Analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES user_sessions(id),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Search details
    query text NOT NULL,
    query_normalized text,  -- Lowercase, trimmed
    search_type text DEFAULT 'text',  -- 'text', 'category', 'filter', 'voice'

    -- Filters applied
    category_filter text,
    location_filter text,
    price_filter text,
    rating_filter numeric,
    other_filters jsonb DEFAULT '{}',

    -- Results
    results_count integer,
    results_shown integer,

    -- Engagement
    result_clicked boolean DEFAULT false,
    clicked_position integer,
    clicked_business_id uuid,
    time_to_click_seconds integer,

    -- Zero results
    is_zero_results boolean DEFAULT false,

    searched_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query_normalized);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_time ON search_analytics(searched_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_zero ON search_analytics(is_zero_results) WHERE is_zero_results = true;


-- 5.4 Click/Tap Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS click_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES user_sessions(id),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Event details
    event_type text NOT NULL,  -- 'button_click', 'link_click', 'card_tap', 'call', 'directions', 'website'
    element_id text,
    element_text text,

    -- Context
    screen_name text,
    business_id uuid,
    event_id uuid,
    deal_id uuid,

    -- Position
    position_x integer,
    position_y integer,
    list_position integer,  -- Position in a list/grid

    clicked_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_click_events_session ON click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_click_events_type ON click_events(event_type);
CREATE INDEX IF NOT EXISTS idx_click_events_screen ON click_events(screen_name);


-- 5.5 Conversion Funnel Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS funnel_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES user_sessions(id),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Funnel details
    funnel_name text NOT NULL,  -- 'booking', 'deal_redemption', 'signup', 'review'
    step_name text NOT NULL,  -- 'view', 'click', 'start', 'complete', 'abandon'
    step_number integer,

    -- Context
    business_id uuid,
    item_id uuid,
    item_type text,

    -- Outcome
    completed boolean DEFAULT false,
    drop_off_reason text,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel ON funnel_events(funnel_name, step_name);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id);


-- 5.6 A/B Test Assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    anonymous_id uuid,

    test_name text NOT NULL,
    variant text NOT NULL,  -- 'control', 'variant_a', 'variant_b'

    assigned_at timestamptz DEFAULT now(),

    -- Outcomes
    converted boolean DEFAULT false,
    conversion_value numeric(10,2),
    converted_at timestamptz,

    UNIQUE(user_id, test_name)
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_test ON ab_test_assignments(test_name);
CREATE INDEX IF NOT EXISTS idx_ab_tests_user ON ab_test_assignments(user_id);


-- 5.7 Shares/Referrals Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- What was shared
    item_type text NOT NULL,  -- 'business', 'event', 'deal', 'app'
    item_id uuid,
    item_name text,

    -- Where it was shared
    platform text,  -- 'facebook', 'twitter', 'instagram', 'whatsapp', 'sms', 'email', 'copy_link'

    -- Tracking
    share_url text,
    share_code text UNIQUE,  -- For tracking conversions

    -- Results
    clicks integer DEFAULT 0,
    signups integer DEFAULT 0,
    conversions integer DEFAULT 0,

    shared_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_item ON shares(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_shares_code ON shares(share_code);


-- 5.8 Notifications Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Notification content
    type text NOT NULL,  -- 'push', 'email', 'sms', 'in_app'
    category text,  -- 'event_reminder', 'deal_alert', 'review_request', 'system'
    title text,
    body text,

    -- Targeting
    campaign_id text,

    -- Delivery
    sent_at timestamptz DEFAULT now(),
    delivered_at timestamptz,
    delivery_failed boolean DEFAULT false,
    failure_reason text,

    -- Engagement
    opened_at timestamptz,
    clicked_at timestamptz,
    click_target text,  -- Where they clicked to

    -- Outcome
    converted boolean DEFAULT false,
    conversion_type text,
    conversion_value numeric(10,2)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, category);
CREATE INDEX IF NOT EXISTS idx_notifications_campaign ON notifications(campaign_id);


-- 5.9 User Feedback
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- Feedback type
    feedback_type text NOT NULL,  -- 'bug_report', 'feature_request', 'complaint', 'praise', 'survey_response'

    -- Content
    subject text,
    message text,
    rating integer,  -- For NPS/satisfaction surveys

    -- Context
    screen_name text,
    app_version text,
    device_info jsonb,

    -- Status
    status text DEFAULT 'new' CHECK (status IN ('new', 'read', 'in_progress', 'resolved', 'closed')),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES profiles(id),
    resolution_notes text,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);


-- 5.10 Content Flags/Reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS content_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

    -- What was flagged
    content_type text NOT NULL,  -- 'review', 'business', 'event', 'user', 'message'
    content_id uuid NOT NULL,

    -- Flag details
    reason text NOT NULL,  -- 'spam', 'inappropriate', 'fake', 'harassment', 'other'
    description text,

    -- Status
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES profiles(id),
    action_taken text,

    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_flags_content ON content_flags(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status);


-- 5.11 Revenue/Transactions (for premium features, ads, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,

    -- Transaction details
    type text NOT NULL,  -- 'premium_subscription', 'featured_listing', 'ad_spend', 'booking_fee', 'tip'
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'CAD',

    -- Payment
    payment_provider text,  -- 'stripe', 'apple', 'google'
    payment_id text,
    payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

    -- Metadata
    description text,
    metadata jsonb DEFAULT '{}',

    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_business ON transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);


-- 5.12 Cohort Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_cohorts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Cohort assignments
    signup_cohort text,  -- '2024-W01', '2024-01' (week or month)
    acquisition_source text,  -- 'organic', 'referral', 'paid_ad', 'social'
    acquisition_campaign text,

    -- Lifecycle
    first_action_at timestamptz,
    first_action_type text,
    first_booking_at timestamptz,
    first_review_at timestamptz,

    -- Retention tracking (days since signup when they were active)
    active_day_1 boolean DEFAULT false,
    active_day_7 boolean DEFAULT false,
    active_day_14 boolean DEFAULT false,
    active_day_30 boolean DEFAULT false,
    active_day_60 boolean DEFAULT false,
    active_day_90 boolean DEFAULT false,

    -- Value
    lifetime_bookings integer DEFAULT 0,
    lifetime_reviews integer DEFAULT 0,
    lifetime_referrals integer DEFAULT 0,
    lifetime_value numeric(10,2) DEFAULT 0,

    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_cohorts_signup ON user_cohorts(signup_cohort);
CREATE INDEX IF NOT EXISTS idx_user_cohorts_source ON user_cohorts(acquisition_source);


-- ============================================================================
-- PART 6: HELPER FUNCTIONS
-- ============================================================================

-- 6.1 Track business view
-- ============================================================================
CREATE OR REPLACE FUNCTION track_business_view(
    p_business_id uuid,
    p_viewer_id uuid DEFAULT NULL,
    p_source text DEFAULT 'browse',
    p_search_query text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO business_views (business_id, viewer_id, source, search_query)
    VALUES (p_business_id, p_viewer_id, p_source, p_search_query);

    -- Update view count
    UPDATE businesses SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_business_id;
END;
$$;


-- 6.2 Get business social proof
-- ============================================================================
CREATE OR REPLACE FUNCTION get_business_social_proof(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bookings_count integer;
    v_neighbor_count integer;
    v_testimonial record;
    v_response_time integer;
    v_satisfaction_rate numeric;
    v_years_active integer;
    v_followers integer;
    v_saves integer;
BEGIN
    SELECT COUNT(*) INTO v_bookings_count
    FROM bookings WHERE business_id = p_business_id AND status = 'completed';

    SELECT COUNT(*) INTO v_neighbor_count
    FROM neighbor_hires WHERE business_id = p_business_id;

    SELECT quote, user_display_name, rating INTO v_testimonial
    FROM testimonials
    WHERE business_id = p_business_id AND featured = true AND approved = true
    ORDER BY created_at DESC LIMIT 1;

    SELECT AVG(avg_response_time_minutes)::integer INTO v_response_time
    FROM business_analytics_daily
    WHERE business_id = p_business_id AND avg_response_time_minutes IS NOT NULL
    AND date >= NOW() - '30 days'::interval;

    SELECT CASE WHEN COUNT(*) = 0 THEN NULL
        ELSE ROUND((COUNT(*) FILTER (WHERE rating >= 4)::numeric / COUNT(*)) * 100)
        END INTO v_satisfaction_rate
    FROM reviews WHERE business_id = p_business_id AND created_at >= NOW() - '6 months'::interval;

    SELECT EXTRACT(YEAR FROM AGE(NOW(), MIN(created_at)))::integer INTO v_years_active
    FROM bookings WHERE business_id = p_business_id;

    SELECT COUNT(*) INTO v_followers FROM business_followers WHERE business_id = p_business_id;

    SELECT COUNT(*) INTO v_saves FROM saved_items WHERE item_type = 'service' AND item_id = p_business_id::text;

    RETURN jsonb_build_object(
        'jobs_completed', v_bookings_count,
        'neighbor_hires', v_neighbor_count,
        'testimonial', CASE WHEN v_testimonial.quote IS NOT NULL THEN jsonb_build_object(
            'quote', v_testimonial.quote,
            'author', v_testimonial.user_display_name,
            'rating', v_testimonial.rating
        ) ELSE NULL END,
        'response_time_minutes', v_response_time,
        'satisfaction_rate', v_satisfaction_rate,
        'years_active', v_years_active,
        'followers', v_followers,
        'saves', v_saves
    );
END;
$$;


-- 6.3 Get business analytics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_business_analytics(
    p_business_id uuid,
    p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_views_total integer;
    v_views_period integer;
    v_views_prev integer;
    v_followers integer;
    v_saves integer;
    v_bookings integer;
    v_response_time integer;
    v_pulse_score record;
BEGIN
    SELECT COUNT(*) INTO v_views_total FROM business_views WHERE business_id = p_business_id;

    SELECT COUNT(*) INTO v_views_period FROM business_views
    WHERE business_id = p_business_id AND viewed_at >= NOW() - (p_days || ' days')::interval;

    SELECT COUNT(*) INTO v_views_prev FROM business_views
    WHERE business_id = p_business_id
    AND viewed_at >= NOW() - (p_days * 2 || ' days')::interval
    AND viewed_at < NOW() - (p_days || ' days')::interval;

    SELECT COUNT(*) INTO v_followers FROM business_followers WHERE business_id = p_business_id;
    SELECT COUNT(*) INTO v_saves FROM saved_items WHERE item_type = 'service' AND item_id = p_business_id::text;
    SELECT COUNT(*) INTO v_bookings FROM bookings WHERE business_id = p_business_id AND status = 'completed';

    SELECT AVG(avg_response_time_minutes)::integer INTO v_response_time
    FROM business_analytics_daily WHERE business_id = p_business_id AND avg_response_time_minutes IS NOT NULL;

    SELECT * INTO v_pulse_score FROM business_pulse_scores WHERE business_id = p_business_id;

    RETURN jsonb_build_object(
        'views', jsonb_build_object(
            'total', v_views_total,
            'period', v_views_period,
            'previous_period', v_views_prev,
            'change_percent', CASE WHEN v_views_prev = 0 THEN 0
                ELSE ROUND(((v_views_period - v_views_prev)::numeric / v_views_prev) * 100) END
        ),
        'followers', v_followers,
        'saves', v_saves,
        'bookings_completed', v_bookings,
        'avg_response_minutes', v_response_time,
        'pulse_score', CASE WHEN v_pulse_score IS NULL THEN NULL ELSE jsonb_build_object(
            'total', v_pulse_score.total_score,
            'profile_completion', v_pulse_score.profile_completion,
            'engagement', v_pulse_score.engagement_score,
            'response', v_pulse_score.response_score,
            'quality', v_pulse_score.quality_score,
            'satisfaction', v_pulse_score.satisfaction_score,
            'percentile', v_pulse_score.percentile
        ) END
    );
END;
$$;


-- 6.4 Calculate Pulse Score
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_pulse_score(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile integer := 0;
    v_engagement integer := 0;
    v_response integer := 0;
    v_quality integer := 0;
    v_satisfaction integer := 0;
    v_total integer;
    v_business record;
    v_views integer;
    v_bookings integer;
    v_avg_response integer;
BEGIN
    SELECT * INTO v_business FROM businesses WHERE id = p_business_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Business not found'); END IF;

    -- Profile completion
    IF v_business.name IS NOT NULL THEN v_profile := v_profile + 20; END IF;
    IF v_business.address IS NOT NULL THEN v_profile := v_profile + 15; END IF;
    IF v_business.phone IS NOT NULL THEN v_profile := v_profile + 15; END IF;
    IF v_business.website IS NOT NULL THEN v_profile := v_profile + 15; END IF;
    IF v_business.email IS NOT NULL THEN v_profile := v_profile + 15; END IF;
    IF v_business.category IS NOT NULL THEN v_profile := v_profile + 20; END IF;

    -- Engagement
    SELECT COUNT(*) INTO v_views FROM business_views
    WHERE business_id = p_business_id AND viewed_at >= NOW() - '30 days'::interval;
    SELECT COUNT(*) INTO v_bookings FROM bookings
    WHERE business_id = p_business_id AND created_at >= NOW() - '30 days'::interval;
    v_engagement := LEAST(100, (v_views / 10) + (v_bookings * 10));

    -- Response time
    SELECT AVG(avg_response_time_minutes)::integer INTO v_avg_response
    FROM business_analytics_daily WHERE business_id = p_business_id AND avg_response_time_minutes IS NOT NULL;

    v_response := CASE
        WHEN v_avg_response IS NULL THEN 0
        WHEN v_avg_response <= 30 THEN 100
        WHEN v_avg_response <= 60 THEN 90
        WHEN v_avg_response <= 120 THEN 80
        WHEN v_avg_response <= 240 THEN 60
        ELSE 40
    END;

    -- Quality (Google rating)
    v_quality := COALESCE((v_business.google_rating / 5.0 * 100)::integer, 0);

    -- Satisfaction
    v_satisfaction := v_quality;

    -- Total (weighted)
    v_total := (v_profile * 0.15 + v_engagement * 0.25 + v_response * 0.20 + v_quality * 0.20 + v_satisfaction * 0.20)::integer * 10;

    -- Upsert
    INSERT INTO business_pulse_scores (business_id, total_score, profile_completion, engagement_score, response_score, quality_score, satisfaction_score)
    VALUES (p_business_id, v_total, v_profile, v_engagement, v_response, v_quality, v_satisfaction)
    ON CONFLICT (business_id) DO UPDATE SET
        total_score = EXCLUDED.total_score, profile_completion = EXCLUDED.profile_completion,
        engagement_score = EXCLUDED.engagement_score, response_score = EXCLUDED.response_score,
        quality_score = EXCLUDED.quality_score, satisfaction_score = EXCLUDED.satisfaction_score,
        calculated_at = NOW();

    -- Update rankings
    WITH ranked AS (
        SELECT business_id, ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank,
            PERCENT_RANK() OVER (ORDER BY total_score DESC) as pct
        FROM business_pulse_scores
    )
    UPDATE business_pulse_scores ps SET overall_rank = r.rank, percentile = (100 - (r.pct * 100))::integer
    FROM ranked r WHERE ps.business_id = r.business_id;

    RETURN jsonb_build_object('total_score', v_total, 'profile_completion', v_profile,
        'engagement', v_engagement, 'response', v_response, 'quality', v_quality, 'satisfaction', v_satisfaction);
END;
$$;


-- 6.5 Get user profile with stats
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile record;
    v_stats jsonb;
    v_achievements jsonb;
    v_activity jsonb;
BEGIN
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'User not found'); END IF;

    SELECT jsonb_build_object(
        'events_attended', (SELECT COUNT(*) FROM user_calendar WHERE user_id = p_user_id AND status = 'attended' AND event_type = 'event'),
        'classes_completed', (SELECT COUNT(*) FROM user_calendar WHERE user_id = p_user_id AND status = 'attended' AND event_type = 'class'),
        'deals_redeemed', (SELECT COUNT(*) FROM deal_redemptions WHERE user_id = p_user_id),
        'reviews_written', (SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id),
        'businesses_supported', (SELECT COUNT(DISTINCT reference_id) FROM user_actions WHERE user_id = p_user_id AND reference_id IS NOT NULL),
        'items_saved', (SELECT COUNT(*) FROM saved_items WHERE user_id = p_user_id),
        'total_xp', v_profile.total_xp,
        'current_level', v_profile.current_level,
        'current_streak', v_profile.current_streak,
        'longest_streak', v_profile.longest_streak,
        'hero_score', v_profile.hero_score
    ) INTO v_stats;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', ua.achievement_type, 'name', ad.name, 'description', ad.description,
        'icon', ad.icon, 'color', ad.color, 'earned', true, 'unlocked_at', ua.unlocked_at
    ) ORDER BY ua.unlocked_at DESC), '[]'::jsonb) INTO v_achievements
    FROM user_achievements ua JOIN achievement_definitions ad ON ad.achievement_type = ua.achievement_type
    WHERE ua.user_id = p_user_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'type', action_type, 'xp_earned', xp_earned, 'metadata', metadata, 'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_activity
    FROM (SELECT * FROM user_actions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20) recent;

    RETURN jsonb_build_object(
        'id', v_profile.id, 'email', v_profile.email, 'name', v_profile.full_name,
        'avatar', v_profile.avatar_url, 'coverPhoto', v_profile.cover_photo_url,
        'phone', v_profile.phone, 'bio', v_profile.bio, 'location', v_profile.location,
        'interests', v_profile.interests, 'memberSince', v_profile.created_at,
        'socialLinks', jsonb_build_object('instagram', v_profile.instagram, 'facebook', v_profile.facebook, 'website', v_profile.website),
        'notifications', jsonb_build_object('eventReminders', v_profile.notify_event_reminders, 'newDeals', v_profile.notify_new_deals,
            'weeklyDigest', v_profile.notify_weekly_digest, 'businessUpdates', v_profile.notify_business_updates),
        'privacy', jsonb_build_object('showActivity', v_profile.privacy_show_activity, 'showSavedItems', v_profile.privacy_show_saved,
            'showAttendance', v_profile.privacy_show_attendance),
        'stats', v_stats, 'achievements', v_achievements, 'recentActivity', v_activity
    );
END;
$$;


-- 6.6 Get leaderboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(jsonb_build_object(
            'rank', row_number, 'user_id', id, 'name', name, 'avatar_url', avatar_url,
            'total_xp', total_xp, 'current_level', current_level, 'hero_score', hero_score, 'current_streak', current_streak
        ))
        FROM (
            SELECT ROW_NUMBER() OVER (ORDER BY total_xp DESC) as row_number,
                id, COALESCE(full_name, 'Anonymous') as name, avatar_url, total_xp, current_level, hero_score, current_streak
            FROM profiles WHERE total_xp > 0 ORDER BY total_xp DESC LIMIT p_limit
        ) ranked
    );
END;
$$;


-- 6.7 Toggle save item
-- ============================================================================
CREATE OR REPLACE FUNCTION toggle_save_item(
    p_user_id uuid, p_item_type text, p_item_id text, p_item_name text, p_item_data jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_exists boolean;
BEGIN
    SELECT EXISTS(SELECT 1 FROM saved_items WHERE user_id = p_user_id AND item_type = p_item_type AND item_id = p_item_id) INTO v_exists;
    IF v_exists THEN
        DELETE FROM saved_items WHERE user_id = p_user_id AND item_type = p_item_type AND item_id = p_item_id;
        RETURN jsonb_build_object('saved', false);
    ELSE
        INSERT INTO saved_items (user_id, item_type, item_id, item_name, item_data) VALUES (p_user_id, p_item_type, p_item_id, p_item_name, p_item_data);
        PERFORM add_user_xp(p_user_id, 'save_item', p_item_id::uuid, jsonb_build_object('item_type', p_item_type));
        RETURN jsonb_build_object('saved', true);
    END IF;
END;
$$;


-- 6.8 Auto-record neighbor hire on booking completion
-- ============================================================================
CREATE OR REPLACE FUNCTION record_neighbor_hire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO neighbor_hires (business_id, user_id, booking_id)
        VALUES (NEW.business_id, NEW.user_id, NEW.id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_completed ON bookings;
CREATE TRIGGER on_booking_completed
    AFTER UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION record_neighbor_hire();


-- ============================================================================
-- PART 7: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- User actions
CREATE POLICY "Users can view own actions" ON user_actions FOR SELECT USING (auth.uid() = user_id);

-- Achievements
CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);

-- Saved items
CREATE POLICY "Users can manage own saved items" ON saved_items FOR ALL USING (auth.uid() = user_id);

-- Calendar
CREATE POLICY "Users can manage own calendar" ON user_calendar FOR ALL USING (auth.uid() = user_id);

-- Reviews
CREATE POLICY "Reviews viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can manage own reviews" ON reviews FOR ALL USING (auth.uid() = user_id);

-- Business claims
CREATE POLICY "Users can view own claims" ON business_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create claims" ON business_claims FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Business views
CREATE POLICY "Anyone can track views" ON business_views FOR INSERT WITH CHECK (true);

-- Followers
CREATE POLICY "Anyone can see followers" ON business_followers FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON business_followers FOR ALL USING (auth.uid() = user_id);

-- Bookings
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Testimonials
CREATE POLICY "Anyone can view approved testimonials" ON testimonials FOR SELECT USING (approved = true);

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);


-- ============================================================================
-- PART 8: GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE, DELETE ON profiles, saved_items, user_calendar, reviews, business_claims, bookings, business_followers TO authenticated;
GRANT INSERT ON business_views, user_actions, click_events, screen_views, search_analytics TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION track_business_view TO anon;
GRANT EXECUTE ON FUNCTION get_business_social_proof TO anon;


-- ============================================================================
-- DONE! Your billion-dollar app database is ready.
-- ============================================================================
