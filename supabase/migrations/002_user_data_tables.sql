-- ============================================
-- PULSE APP - USER DATA TABLES
-- Complete database for user profiles, saved items, calendar, etc.
-- ============================================

-- 1. Profiles table (extends Supabase auth.users)
-- ============================================
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

    -- Privacy settings
    privacy_show_activity boolean DEFAULT true,
    privacy_show_saved boolean DEFAULT false,
    privacy_show_attendance boolean DEFAULT true,

    -- Gamification (from previous migration, ensure they exist)
    total_xp integer DEFAULT 0,
    current_level integer DEFAULT 1,
    current_streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_activity_date date,
    hero_score integer DEFAULT 0,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create profile automatically when user signs up
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

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 2. Saved Items table
-- ============================================
CREATE TABLE IF NOT EXISTS saved_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_type text NOT NULL CHECK (item_type IN ('event', 'deal', 'service', 'class')),
    item_id text NOT NULL,  -- References the item in its respective table/data
    item_name text NOT NULL,
    item_data jsonb DEFAULT '{}',  -- Store snapshot of item details
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_type ON saved_items(item_type);


-- 3. User Calendar (registered events/classes)
-- ============================================
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
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, event_type, event_id, event_date)
);

CREATE INDEX IF NOT EXISTS idx_user_calendar_user ON user_calendar(user_id);
CREATE INDEX IF NOT EXISTS idx_user_calendar_date ON user_calendar(event_date);


-- 4. Business Claims
-- ============================================
CREATE TABLE IF NOT EXISTS business_claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    business_name text NOT NULL,
    business_address text,
    business_category text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    verified_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_claims_user ON business_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_business_claims_business ON business_claims(business_id);


-- 5. Events table
-- ============================================
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

    -- Recurrence
    is_recurring boolean DEFAULT false,
    recurrence_rule text,  -- 'daily', 'weekly', 'biweekly', 'monthly'
    recurrence_days text[],  -- ['monday', 'wednesday', 'friday']
    recurrence_end_date date,

    -- Pricing
    price numeric(10,2) DEFAULT 0,
    price_description text,
    is_free boolean DEFAULT false,

    -- Capacity
    max_capacity integer,
    current_attendees integer DEFAULT 0,

    -- Metadata
    image_url text,
    tags text[] DEFAULT '{}',
    featured boolean DEFAULT false,
    status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'draft')),

    created_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);


-- 6. Deals table
-- ============================================
CREATE TABLE IF NOT EXISTS deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES businesses(id),
    business_name text NOT NULL,
    business_address text,

    title text NOT NULL,
    description text,
    category text,

    -- Deal details
    discount_type text CHECK (discount_type IN ('percent', 'fixed', 'bogo', 'free_item', 'special')),
    discount_value numeric(10,2),
    original_price numeric(10,2),
    deal_price numeric(10,2),

    -- Schedule
    schedule text,  -- 'Monday-Friday 11am-3pm'
    valid_from date,
    valid_until date,
    days_of_week text[],  -- ['monday', 'tuesday']

    -- Limits
    max_redemptions integer,
    current_redemptions integer DEFAULT 0,
    redemptions_per_user integer DEFAULT 1,

    -- Display
    image_url text,
    featured boolean DEFAULT false,
    status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'paused', 'draft')),

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_business ON deals(business_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_featured ON deals(featured) WHERE featured = true;


-- 7. Deal Redemptions tracking
-- ============================================
CREATE TABLE IF NOT EXISTS deal_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    redeemed_at timestamptz DEFAULT now(),
    UNIQUE(user_id, deal_id, DATE(redeemed_at))
);

CREATE INDEX IF NOT EXISTS idx_deal_redemptions_user ON deal_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_redemptions_deal ON deal_redemptions(deal_id);


-- 8. Reviews table
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title text,
    content text,
    photos text[] DEFAULT '{}',
    helpful_count integer DEFAULT 0,
    status text DEFAULT 'published' CHECK (status IN ('published', 'pending', 'hidden')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);


-- 9. Function to get user profile with stats
-- ============================================
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
    -- Get profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    -- Calculate stats from actual data
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

    -- Get achievements
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'type', ua.achievement_type,
            'name', ad.name,
            'description', ad.description,
            'icon', ad.icon,
            'color', ad.color,
            'earned', true,
            'unlocked_at', ua.unlocked_at
        ) ORDER BY ua.unlocked_at DESC
    ), '[]'::jsonb) INTO v_achievements
    FROM user_achievements ua
    JOIN achievement_definitions ad ON ad.achievement_type = ua.achievement_type
    WHERE ua.user_id = p_user_id;

    -- Get recent activity
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'type', action_type,
            'xp_earned', xp_earned,
            'metadata', metadata,
            'created_at', created_at
        ) ORDER BY created_at DESC
    ), '[]'::jsonb) INTO v_activity
    FROM (
        SELECT * FROM user_actions WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 20
    ) recent;

    -- Build complete profile
    RETURN jsonb_build_object(
        'id', v_profile.id,
        'email', v_profile.email,
        'name', v_profile.full_name,
        'avatar', v_profile.avatar_url,
        'coverPhoto', v_profile.cover_photo_url,
        'phone', v_profile.phone,
        'bio', v_profile.bio,
        'location', v_profile.location,
        'interests', v_profile.interests,
        'memberSince', v_profile.created_at,
        'socialLinks', jsonb_build_object(
            'instagram', v_profile.instagram,
            'facebook', v_profile.facebook,
            'website', v_profile.website
        ),
        'notifications', jsonb_build_object(
            'eventReminders', v_profile.notify_event_reminders,
            'newDeals', v_profile.notify_new_deals,
            'weeklyDigest', v_profile.notify_weekly_digest,
            'businessUpdates', v_profile.notify_business_updates
        ),
        'privacy', jsonb_build_object(
            'showActivity', v_profile.privacy_show_activity,
            'showSavedItems', v_profile.privacy_show_saved,
            'showAttendance', v_profile.privacy_show_attendance
        ),
        'stats', v_stats,
        'achievements', v_achievements,
        'recentActivity', v_activity
    );
END;
$$;


-- 10. Function to get saved items
-- ============================================
CREATE OR REPLACE FUNCTION get_user_saved_items(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'type', item_type,
                'itemId', item_id,
                'name', item_name,
                'data', item_data,
                'savedAt', created_at
            ) ORDER BY created_at DESC
        )
        FROM saved_items
        WHERE user_id = p_user_id
    ), '[]'::jsonb);
END;
$$;


-- 11. Function to get user calendar
-- ============================================
CREATE OR REPLACE FUNCTION get_user_calendar(p_user_id uuid, p_from_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', id,
                'type', event_type,
                'eventId', event_id,
                'name', event_name,
                'date', event_date,
                'time', event_time,
                'venue', venue_name,
                'address', venue_address,
                'status', status,
                'data', event_data
            ) ORDER BY event_date, event_time
        )
        FROM user_calendar
        WHERE user_id = p_user_id AND event_date >= p_from_date
    ), '[]'::jsonb);
END;
$$;


-- 12. Function to save/unsave item
-- ============================================
CREATE OR REPLACE FUNCTION toggle_save_item(
    p_user_id uuid,
    p_item_type text,
    p_item_id text,
    p_item_name text,
    p_item_data jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM saved_items
        WHERE user_id = p_user_id AND item_type = p_item_type AND item_id = p_item_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM saved_items
        WHERE user_id = p_user_id AND item_type = p_item_type AND item_id = p_item_id;
        RETURN jsonb_build_object('saved', false, 'message', 'Item removed from saved');
    ELSE
        INSERT INTO saved_items (user_id, item_type, item_id, item_name, item_data)
        VALUES (p_user_id, p_item_type, p_item_id, p_item_name, p_item_data);

        -- Award XP for saving
        PERFORM add_user_xp(p_user_id, 'save_item', p_item_id::uuid, jsonb_build_object('item_type', p_item_type));

        RETURN jsonb_build_object('saved', true, 'message', 'Item saved');
    END IF;
END;
$$;


-- 13. Function to register for event/class
-- ============================================
CREATE OR REPLACE FUNCTION register_for_event(
    p_user_id uuid,
    p_event_type text,
    p_event_id text,
    p_event_name text,
    p_event_date date,
    p_event_time time,
    p_venue_name text,
    p_venue_address text,
    p_event_data jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_calendar (
        user_id, event_type, event_id, event_name, event_date,
        event_time, venue_name, venue_address, event_data
    )
    VALUES (
        p_user_id, p_event_type, p_event_id, p_event_name, p_event_date,
        p_event_time, p_venue_name, p_venue_address, p_event_data
    )
    ON CONFLICT (user_id, event_type, event_id, event_date) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'message', 'Registered for ' || p_event_name);
END;
$$;


-- 14. Function to mark attendance (and award XP)
-- ============================================
CREATE OR REPLACE FUNCTION mark_attendance(
    p_user_id uuid,
    p_calendar_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_calendar record;
    v_xp_result jsonb;
BEGIN
    SELECT * INTO v_calendar FROM user_calendar WHERE id = p_calendar_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Calendar entry not found');
    END IF;

    UPDATE user_calendar SET status = 'attended' WHERE id = p_calendar_id;

    -- Award XP
    IF v_calendar.event_type = 'class' THEN
        v_xp_result := add_user_xp(p_user_id, 'class_attendance', v_calendar.event_id::uuid,
            jsonb_build_object('event_name', v_calendar.event_name));
    ELSE
        v_xp_result := add_user_xp(p_user_id, 'event_attendance', v_calendar.event_id::uuid,
            jsonb_build_object('event_name', v_calendar.event_name));
    END IF;

    RETURN jsonb_build_object('success', true, 'xp', v_xp_result);
END;
$$;


-- 15. Row Level Security
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_redemptions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Saved items: users can manage own
CREATE POLICY "Users can manage own saved items" ON saved_items FOR ALL USING (auth.uid() = user_id);

-- Calendar: users can manage own
CREATE POLICY "Users can manage own calendar" ON user_calendar FOR ALL USING (auth.uid() = user_id);

-- Business claims: users can view and create own
CREATE POLICY "Users can view own claims" ON business_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create claims" ON business_claims FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reviews: everyone can read, users can manage own
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can manage own reviews" ON reviews FOR ALL USING (auth.uid() = user_id);

-- Deal redemptions: users can manage own
CREATE POLICY "Users can manage own redemptions" ON deal_redemptions FOR ALL USING (auth.uid() = user_id);

-- Events and deals are public read
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Deals are viewable by everyone" ON deals FOR SELECT USING (true);


-- 16. Grant permissions
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
