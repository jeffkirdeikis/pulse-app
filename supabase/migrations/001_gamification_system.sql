-- ============================================
-- PULSE APP GAMIFICATION SYSTEM
-- ============================================

-- 1. Update profiles table with gamification fields
-- ============================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS total_xp integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_date date,
ADD COLUMN IF NOT EXISTS hero_score integer DEFAULT 0;

-- Create index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_total_xp ON profiles(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_hero_score ON profiles(hero_score DESC);


-- 2. Create user_actions table
-- ============================================
CREATE TABLE IF NOT EXISTS user_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    action_type text NOT NULL CHECK (action_type IN (
        'event_attendance',
        'class_attendance',
        'first_visit',
        'review',
        'deal_redemption',
        'save_item',
        'daily_checkin',
        'referral'
    )),
    xp_earned integer NOT NULL DEFAULT 0,
    reference_id uuid,  -- links to business/event/class id
    metadata jsonb DEFAULT '{}',  -- flexible field for additional data
    created_at timestamptz DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_actions_user_id ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_type ON user_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_user_actions_created_at ON user_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_user_date ON user_actions(user_id, created_at DESC);


-- 3. Create user_achievements table
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_type text NOT NULL CHECK (achievement_type IN (
        -- Event milestones
        'first_event',
        'events_5',
        'events_10',
        'events_25',
        'events_50',
        'events_100',
        -- Review milestones
        'first_review',
        'reviews_5',
        'reviews_10',
        'reviews_25',
        'reviews_50',
        -- Streak achievements
        'streak_3',
        'streak_7',
        'streak_14',
        'streak_30',
        'streak_60',
        'streak_100',
        -- Level achievements
        'level_5',
        'level_10',
        'level_25',
        'level_50',
        'level_100',
        -- Special achievements
        'early_adopter',
        'local_explorer',
        'deal_hunter',
        'social_butterfly',
        'super_supporter',
        'community_champion'
    )),
    unlocked_at timestamptz DEFAULT now(),
    UNIQUE(user_id, achievement_type)  -- prevent duplicate achievements
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);


-- 4. Create XP rewards configuration table
-- ============================================
CREATE TABLE IF NOT EXISTS xp_rewards (
    action_type text PRIMARY KEY,
    base_xp integer NOT NULL,
    description text
);

INSERT INTO xp_rewards (action_type, base_xp, description) VALUES
    ('event_attendance', 100, 'Attend an event'),
    ('class_attendance', 100, 'Attend a class'),
    ('first_visit', 50, 'First visit to a business'),
    ('review', 75, 'Write a review'),
    ('deal_redemption', 50, 'Redeem a deal'),
    ('save_item', 25, 'Save an item'),
    ('daily_checkin', 10, 'Daily check-in (multiplied by streak)'),
    ('referral', 200, 'Refer a friend')
ON CONFLICT (action_type) DO UPDATE SET
    base_xp = EXCLUDED.base_xp,
    description = EXCLUDED.description;


-- 5. Create achievement definitions table
-- ============================================
CREATE TABLE IF NOT EXISTS achievement_definitions (
    achievement_type text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    icon text DEFAULT 'Star',
    color text DEFAULT '#6366f1',
    xp_reward integer DEFAULT 0
);

INSERT INTO achievement_definitions (achievement_type, name, description, icon, color, xp_reward) VALUES
    ('first_event', 'Event Explorer', 'Attended your first event', 'Calendar', '#10b981', 50),
    ('events_5', 'Social Starter', 'Attended 5 events', 'Calendar', '#10b981', 100),
    ('events_10', 'Event Enthusiast', 'Attended 10 events', 'Calendar', '#10b981', 200),
    ('events_25', 'Community Regular', 'Attended 25 events', 'Calendar', '#10b981', 500),
    ('events_50', 'Event Master', 'Attended 50 events', 'Calendar', '#10b981', 1000),
    ('events_100', 'Legendary Attendee', 'Attended 100 events', 'Calendar', '#10b981', 2500),
    ('first_review', 'Voice Heard', 'Wrote your first review', 'Star', '#f59e0b', 50),
    ('reviews_5', 'Helpful Critic', 'Wrote 5 reviews', 'Star', '#f59e0b', 100),
    ('reviews_10', 'Trusted Reviewer', 'Wrote 10 reviews', 'Star', '#f59e0b', 200),
    ('reviews_25', 'Review Expert', 'Wrote 25 reviews', 'Star', '#f59e0b', 500),
    ('reviews_50', 'Review Legend', 'Wrote 50 reviews', 'Star', '#f59e0b', 1000),
    ('streak_3', 'Getting Started', '3-day activity streak', 'Zap', '#f97316', 25),
    ('streak_7', 'Week Warrior', '7-day activity streak', 'Zap', '#f97316', 100),
    ('streak_14', 'Fortnight Fighter', '14-day activity streak', 'Zap', '#f97316', 250),
    ('streak_30', 'Monthly Master', '30-day activity streak', 'Zap', '#f97316', 500),
    ('streak_60', 'Dedication King', '60-day activity streak', 'Zap', '#f97316', 1000),
    ('streak_100', 'Unstoppable', '100-day activity streak', 'Zap', '#f97316', 2500),
    ('level_5', 'Rising Star', 'Reached level 5', 'TrendingUp', '#8b5cf6', 100),
    ('level_10', 'Local Regular', 'Reached level 10', 'TrendingUp', '#8b5cf6', 250),
    ('level_25', 'Community Pillar', 'Reached level 25', 'TrendingUp', '#8b5cf6', 500),
    ('level_50', 'Squamish Legend', 'Reached level 50', 'TrendingUp', '#8b5cf6', 1000),
    ('level_100', 'Ultimate Local', 'Reached level 100', 'TrendingUp', '#8b5cf6', 5000),
    ('early_adopter', 'Early Adopter', 'Joined in the first month', 'Sparkles', '#8b5cf6', 100),
    ('local_explorer', 'Local Explorer', 'Visited 10+ unique businesses', 'MapPin', '#10b981', 200),
    ('deal_hunter', 'Deal Hunter', 'Redeemed 10+ deals', 'Percent', '#f59e0b', 150),
    ('social_butterfly', 'Social Butterfly', 'Connected with 25+ community members', 'Users', '#ec4899', 250),
    ('super_supporter', 'Super Supporter', 'Supported 50+ local businesses', 'Heart', '#ef4444', 500),
    ('community_champion', 'Community Champion', 'Top 10 on leaderboard', 'Trophy', '#eab308', 1000)
ON CONFLICT (achievement_type) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    xp_reward = EXCLUDED.xp_reward;


-- 6. Main function: add_user_xp
-- ============================================
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
BEGIN
    -- Get base XP for action type
    SELECT base_xp INTO v_base_xp FROM xp_rewards WHERE action_type = p_action_type;
    IF v_base_xp IS NULL THEN
        RAISE EXCEPTION 'Invalid action type: %', p_action_type;
    END IF;

    -- Get current user stats
    SELECT
        current_level,
        total_xp,
        current_streak,
        longest_streak,
        last_activity_date
    INTO
        v_old_level,
        v_new_total_xp,
        v_current_streak,
        v_longest_streak,
        v_last_activity
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Calculate streak
    IF v_last_activity IS NULL THEN
        -- First activity ever
        v_current_streak := 1;
    ELSIF v_last_activity = v_today THEN
        -- Already active today, streak unchanged
        NULL;
    ELSIF v_last_activity = v_today - 1 THEN
        -- Consecutive day, increment streak
        v_current_streak := v_current_streak + 1;
    ELSE
        -- Streak broken, reset to 1
        v_current_streak := 1;
    END IF;

    -- Update longest streak if needed
    IF v_current_streak > v_longest_streak THEN
        v_longest_streak := v_current_streak;
    END IF;

    -- Calculate XP (with streak multiplier for daily_checkin)
    IF p_action_type = 'daily_checkin' THEN
        v_xp_earned := v_base_xp * v_current_streak;
    ELSE
        v_xp_earned := v_base_xp;
    END IF;

    -- Add streak bonus for consecutive days (bonus 10% per day, max 50%)
    IF v_current_streak > 1 AND p_action_type != 'daily_checkin' THEN
        v_streak_bonus := LEAST(v_xp_earned * (v_current_streak - 1) * 0.1, v_xp_earned * 0.5)::integer;
        v_xp_earned := v_xp_earned + v_streak_bonus;
    END IF;

    -- Add XP to total
    v_new_total_xp := v_new_total_xp + v_xp_earned;

    -- Calculate new level: level = floor((total_xp / 100) ^ 0.667) + 1
    v_new_level := FLOOR(POWER(v_new_total_xp::numeric / 100, 0.667)) + 1;

    -- Record the action
    INSERT INTO user_actions (user_id, action_type, xp_earned, reference_id, metadata)
    VALUES (p_user_id, p_action_type, v_xp_earned, p_reference_id, p_metadata);

    -- Check for new achievements
    -- Streak achievements
    IF v_current_streak >= 3 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'streak_3')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'streak_3'); END IF;
    END IF;
    IF v_current_streak >= 7 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'streak_7')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'streak_7'); END IF;
    END IF;
    IF v_current_streak >= 14 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'streak_14')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'streak_14'); END IF;
    END IF;
    IF v_current_streak >= 30 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'streak_30')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'streak_30'); END IF;
    END IF;

    -- Level achievements
    IF v_new_level >= 5 AND v_old_level < 5 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'level_5')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'level_5'); END IF;
    END IF;
    IF v_new_level >= 10 AND v_old_level < 10 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'level_10')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'level_10'); END IF;
    END IF;
    IF v_new_level >= 25 AND v_old_level < 25 THEN
        INSERT INTO user_achievements (user_id, achievement_type)
        VALUES (p_user_id, 'level_25')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN v_new_achievements := array_append(v_new_achievements, 'level_25'); END IF;
    END IF;

    -- Add achievement XP bonus
    IF array_length(v_new_achievements, 1) > 0 THEN
        SELECT COALESCE(SUM(xp_reward), 0) INTO v_achievement_xp
        FROM achievement_definitions
        WHERE achievement_type = ANY(v_new_achievements);

        v_new_total_xp := v_new_total_xp + v_achievement_xp;
        -- Recalculate level with achievement XP
        v_new_level := FLOOR(POWER(v_new_total_xp::numeric / 100, 0.667)) + 1;
    END IF;

    -- Update hero score (weighted combination of activity)
    UPDATE profiles SET
        total_xp = v_new_total_xp,
        current_level = v_new_level,
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_activity_date = v_today,
        hero_score = (
            SELECT
                COALESCE(COUNT(*) FILTER (WHERE action_type = 'event_attendance'), 0) * 10 +
                COALESCE(COUNT(*) FILTER (WHERE action_type = 'review'), 0) * 15 +
                COALESCE(COUNT(*) FILTER (WHERE action_type = 'referral'), 0) * 25 +
                v_current_streak * 5 +
                v_new_level * 10
            FROM user_actions WHERE user_id = p_user_id
        )
    WHERE id = p_user_id;

    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'xp_earned', v_xp_earned,
        'streak_bonus', v_streak_bonus,
        'achievement_xp', v_achievement_xp,
        'total_xp', v_new_total_xp,
        'old_level', v_old_level,
        'new_level', v_new_level,
        'level_up', v_new_level > v_old_level,
        'current_streak', v_current_streak,
        'longest_streak', v_longest_streak,
        'new_achievements', to_jsonb(v_new_achievements)
    );
END;
$$;


-- 7. Helper function: Get user stats
-- ============================================
CREATE OR REPLACE FUNCTION get_user_gamification_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile record;
    v_achievements jsonb;
    v_recent_actions jsonb;
    v_xp_to_next_level integer;
    v_xp_for_current_level integer;
    v_community_rank integer;
    v_total_users integer;
BEGIN
    -- Get profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    -- Calculate XP progress
    v_xp_for_current_level := POWER((v_profile.current_level - 1)::numeric, 1.5) * 100;
    v_xp_to_next_level := POWER(v_profile.current_level::numeric, 1.5) * 100 - v_profile.total_xp;
    IF v_xp_to_next_level < 0 THEN v_xp_to_next_level := 0; END IF;

    -- Get achievements with definitions
    SELECT jsonb_agg(
        jsonb_build_object(
            'type', ua.achievement_type,
            'name', ad.name,
            'description', ad.description,
            'icon', ad.icon,
            'color', ad.color,
            'unlocked_at', ua.unlocked_at
        ) ORDER BY ua.unlocked_at DESC
    ) INTO v_achievements
    FROM user_achievements ua
    JOIN achievement_definitions ad ON ad.achievement_type = ua.achievement_type
    WHERE ua.user_id = p_user_id;

    -- Get recent actions
    SELECT jsonb_agg(
        jsonb_build_object(
            'action_type', action_type,
            'xp_earned', xp_earned,
            'created_at', created_at
        ) ORDER BY created_at DESC
    ) INTO v_recent_actions
    FROM (
        SELECT action_type, xp_earned, created_at
        FROM user_actions
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 10
    ) recent;

    -- Get community rank
    SELECT COUNT(*) + 1 INTO v_community_rank
    FROM profiles
    WHERE total_xp > v_profile.total_xp;

    SELECT COUNT(*) INTO v_total_users FROM profiles WHERE total_xp > 0;

    RETURN jsonb_build_object(
        'total_xp', v_profile.total_xp,
        'current_level', v_profile.current_level,
        'xp_to_next_level', v_xp_to_next_level,
        'xp_progress_percent', CASE
            WHEN v_xp_to_next_level + (v_profile.total_xp - v_xp_for_current_level) = 0 THEN 100
            ELSE ROUND(((v_profile.total_xp - v_xp_for_current_level)::numeric /
                   (v_xp_to_next_level + (v_profile.total_xp - v_xp_for_current_level))) * 100)
        END,
        'current_streak', v_profile.current_streak,
        'longest_streak', v_profile.longest_streak,
        'hero_score', v_profile.hero_score,
        'community_rank', v_community_rank,
        'total_users', v_total_users,
        'achievements', COALESCE(v_achievements, '[]'::jsonb),
        'recent_actions', COALESCE(v_recent_actions, '[]'::jsonb)
    );
END;
$$;


-- 8. Helper function: Get leaderboard
-- ============================================
CREATE OR REPLACE FUNCTION get_leaderboard(p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(
            jsonb_build_object(
                'rank', row_number,
                'user_id', id,
                'name', name,
                'avatar_url', avatar_url,
                'total_xp', total_xp,
                'current_level', current_level,
                'hero_score', hero_score,
                'current_streak', current_streak
            )
        )
        FROM (
            SELECT
                ROW_NUMBER() OVER (ORDER BY total_xp DESC) as row_number,
                id,
                COALESCE(full_name, 'Anonymous') as name,
                avatar_url,
                total_xp,
                current_level,
                hero_score,
                current_streak
            FROM profiles
            WHERE total_xp > 0
            ORDER BY total_xp DESC
            LIMIT p_limit
        ) ranked
    );
END;
$$;


-- 9. Enable Row Level Security
-- ============================================
ALTER TABLE user_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read their own actions
CREATE POLICY "Users can view own actions" ON user_actions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own achievements
CREATE POLICY "Users can view own achievements" ON user_achievements
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for functions)
CREATE POLICY "Service role full access to actions" ON user_actions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to achievements" ON user_achievements
    FOR ALL USING (auth.role() = 'service_role');


-- 10. Grant permissions
-- ============================================
GRANT SELECT ON xp_rewards TO authenticated;
GRANT SELECT ON achievement_definitions TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_xp TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_gamification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard TO authenticated;
