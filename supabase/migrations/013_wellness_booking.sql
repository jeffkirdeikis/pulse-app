-- ============================================
-- PULSE APP - WELLNESS BOOKING SYSTEM
-- Universal wellness booking: massage, physio, chiro, acupuncture
-- ============================================

-- 1. Wellness Providers
-- ============================================
CREATE TABLE IF NOT EXISTS pulse_wellness_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
    name text NOT NULL,
    clinic_name text NOT NULL,
    discipline text NOT NULL CHECK (discipline IN (
        'massage_therapy', 'physiotherapy', 'chiropractic',
        'acupuncture', 'osteopathy', 'naturopathy', 'counselling'
    )),
    platform text DEFAULT 'janeapp' CHECK (platform IN (
        'janeapp', 'acuity', 'mindbody', 'cliniko', 'direct', 'other'
    )),
    booking_url text,
    janeapp_slug text,
    specialties text[] DEFAULT '{}',
    bio text,
    photo_url text,
    price_min integer,  -- in cents
    price_max integer,  -- in cents
    direct_billing boolean DEFAULT false,
    rating decimal(2,1),
    review_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wellness_providers_discipline ON pulse_wellness_providers(discipline);
CREATE INDEX IF NOT EXISTS idx_wellness_providers_clinic ON pulse_wellness_providers(clinic_name);
CREATE INDEX IF NOT EXISTS idx_wellness_providers_active ON pulse_wellness_providers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wellness_providers_slug ON pulse_wellness_providers(janeapp_slug) WHERE janeapp_slug IS NOT NULL;


-- 2. Availability Slots
-- ============================================
CREATE TABLE IF NOT EXISTS pulse_availability_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id uuid NOT NULL REFERENCES pulse_wellness_providers(id) ON DELETE CASCADE,
    date date NOT NULL,
    start_time time NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes IN (30, 45, 60, 75, 90, 120)),
    is_available boolean DEFAULT true,
    scraped_at timestamptz DEFAULT now(),
    source text DEFAULT 'janeapp_scrape' CHECK (source IN (
        'janeapp_scrape', 'jane_discover', 'manual', 'acuity_scrape', 'mindbody_scrape'
    )),
    UNIQUE(provider_id, date, start_time, duration_minutes)
);

CREATE INDEX IF NOT EXISTS idx_availability_date_avail ON pulse_availability_slots(date, is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_availability_provider_date ON pulse_availability_slots(provider_id, date);
CREATE INDEX IF NOT EXISTS idx_availability_scraped ON pulse_availability_slots(scraped_at);


-- 3. Booking Clicks (track when users click through to book)
-- ============================================
CREATE TABLE IF NOT EXISTS pulse_booking_clicks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider_id uuid NOT NULL REFERENCES pulse_wellness_providers(id) ON DELETE CASCADE,
    slot_id uuid REFERENCES pulse_availability_slots(id) ON DELETE SET NULL,
    booking_url text NOT NULL,
    clicked_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_clicks_user ON pulse_booking_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_clicks_provider ON pulse_booking_clicks(provider_id);
CREATE INDEX IF NOT EXISTS idx_booking_clicks_date ON pulse_booking_clicks(clicked_at);


-- 4. Availability Alerts (waitlist / notification preferences)
-- ============================================
CREATE TABLE IF NOT EXISTS pulse_availability_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider_id uuid REFERENCES pulse_wellness_providers(id) ON DELETE CASCADE,
    discipline text CHECK (discipline IN (
        'massage_therapy', 'physiotherapy', 'chiropractic',
        'acupuncture', 'osteopathy', 'naturopathy', 'counselling'
    )),
    preferred_days text[] DEFAULT '{}',
    preferred_time_range text DEFAULT 'any' CHECK (preferred_time_range IN (
        'morning', 'afternoon', 'evening', 'any'
    )),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON pulse_availability_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON pulse_availability_alerts(is_active) WHERE is_active = true;


-- 5. Scrape Log
-- ============================================
CREATE TABLE IF NOT EXISTS pulse_scrape_log (
    id serial PRIMARY KEY,
    provider_slug text,
    source text,
    status text CHECK (status IN ('success', 'error', 'rate_limited', 'no_data')),
    slots_found integer DEFAULT 0,
    error_message text,
    duration_ms integer,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scrape_log_slug ON pulse_scrape_log(provider_slug);
CREATE INDEX IF NOT EXISTS idx_scrape_log_created ON pulse_scrape_log(created_at DESC);


-- 6. User Notifications (for availability alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS pulse_user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('availability_alert', 'booking_reminder', 'new_provider', 'system')),
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}',
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON pulse_user_notifications(user_id, is_read) WHERE is_read = false;


-- ============================================
-- FUNCTIONS
-- ============================================

-- 7. Get availability for a date with provider info
-- ============================================
CREATE OR REPLACE FUNCTION get_wellness_availability(
    p_date date DEFAULT CURRENT_DATE,
    p_discipline text DEFAULT NULL,
    p_duration integer DEFAULT NULL,
    p_time_range text DEFAULT 'any',
    p_provider_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT COALESCE(jsonb_agg(row_to_json(slots)::jsonb ORDER BY slots.start_time), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT
            s.id as slot_id,
            s.date,
            s.start_time,
            s.duration_minutes,
            s.scraped_at,
            s.source,
            p.id as provider_id,
            p.name as provider_name,
            p.clinic_name,
            p.discipline,
            p.booking_url,
            p.janeapp_slug,
            p.specialties,
            p.photo_url,
            p.price_min,
            p.price_max,
            p.direct_billing,
            p.rating,
            p.review_count
        FROM pulse_availability_slots s
        JOIN pulse_wellness_providers p ON p.id = s.provider_id
        WHERE s.date = p_date
          AND s.is_available = true
          AND p.is_active = true
          AND (p_discipline IS NULL OR p.discipline = p_discipline)
          AND (p_duration IS NULL OR s.duration_minutes = p_duration)
          AND (p_provider_id IS NULL OR p.id = p_provider_id)
          AND (
              p_time_range = 'any'
              OR (p_time_range = 'morning' AND s.start_time < '12:00:00')
              OR (p_time_range = 'afternoon' AND s.start_time >= '12:00:00' AND s.start_time < '17:00:00')
              OR (p_time_range = 'evening' AND s.start_time >= '17:00:00')
          )
        ORDER BY s.start_time
    ) slots;

    RETURN v_result;
END;
$$;


-- 8. Log a booking click and award XP
-- ============================================
CREATE OR REPLACE FUNCTION log_booking_click(
    p_user_id uuid,
    p_provider_id uuid,
    p_slot_id uuid DEFAULT NULL,
    p_booking_url text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_xp_result jsonb;
    v_is_same_day boolean;
    v_click_id uuid;
BEGIN
    -- Insert booking click
    INSERT INTO pulse_booking_clicks (user_id, provider_id, slot_id, booking_url)
    VALUES (p_user_id, p_provider_id, p_slot_id, p_booking_url)
    RETURNING id INTO v_click_id;

    -- Check if booking is for today (same-day bonus)
    IF p_slot_id IS NOT NULL THEN
        SELECT (s.date = CURRENT_DATE) INTO v_is_same_day
        FROM pulse_availability_slots s WHERE s.id = p_slot_id;
    ELSE
        v_is_same_day := false;
    END IF;

    -- Award XP via existing gamification system
    v_xp_result := add_user_xp(
        p_user_id,
        'booking_click',
        p_provider_id,
        jsonb_build_object(
            'click_id', v_click_id,
            'same_day', COALESCE(v_is_same_day, false)
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'click_id', v_click_id,
        'xp', v_xp_result,
        'same_day_bonus', COALESCE(v_is_same_day, false)
    );
END;
$$;


-- 9. Get providers with slot counts
-- ============================================
CREATE OR REPLACE FUNCTION get_wellness_providers(
    p_discipline text DEFAULT NULL,
    p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(row_to_json(providers)::jsonb ORDER BY providers.clinic_name, providers.name)
        FROM (
            SELECT
                p.id,
                p.name,
                p.clinic_name,
                p.discipline,
                p.booking_url,
                p.janeapp_slug,
                p.specialties,
                p.bio,
                p.photo_url,
                p.price_min,
                p.price_max,
                p.direct_billing,
                p.rating,
                p.review_count,
                (SELECT COUNT(*) FROM pulse_availability_slots s
                 WHERE s.provider_id = p.id AND s.date = p_date AND s.is_available = true
                ) as slots_today,
                (SELECT COUNT(*) FROM pulse_availability_slots s
                 WHERE s.provider_id = p.id AND s.date BETWEEN p_date AND p_date + 6 AND s.is_available = true
                ) as slots_this_week
            FROM pulse_wellness_providers p
            WHERE p.is_active = true
              AND (p_discipline IS NULL OR p.discipline = p_discipline)
            ORDER BY p.clinic_name, p.name
        ) providers
    ), '[]'::jsonb);
END;
$$;


-- 10. Save/update availability alert
-- ============================================
CREATE OR REPLACE FUNCTION upsert_availability_alert(
    p_user_id uuid,
    p_provider_id uuid DEFAULT NULL,
    p_discipline text DEFAULT NULL,
    p_preferred_days text[] DEFAULT '{}',
    p_preferred_time_range text DEFAULT 'any'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alert_id uuid;
BEGIN
    INSERT INTO pulse_availability_alerts (
        user_id, provider_id, discipline, preferred_days, preferred_time_range
    ) VALUES (
        p_user_id, p_provider_id, p_discipline, p_preferred_days, p_preferred_time_range
    )
    RETURNING id INTO v_alert_id;

    RETURN jsonb_build_object('success', true, 'alert_id', v_alert_id);
END;
$$;


-- 11. Cleanup old availability
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_wellness_availability()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM pulse_availability_slots
    WHERE date < CURRENT_DATE - INTERVAL '1 day';
END;
$$;


-- ============================================
-- GAMIFICATION INTEGRATION
-- ============================================

-- 12. Add booking_click action type to xp_rewards
-- ============================================
INSERT INTO xp_rewards (action_type, base_xp, description) VALUES
    ('booking_click', 50, 'Book wellness appointment through Pulse')
ON CONFLICT (action_type) DO UPDATE SET
    base_xp = EXCLUDED.base_xp,
    description = EXCLUDED.description;

-- 13. Add booking_click to user_actions CHECK constraint
-- We need to drop and recreate since ALTER CHECK is not supported
ALTER TABLE user_actions DROP CONSTRAINT IF EXISTS user_actions_action_type_check;
ALTER TABLE user_actions ADD CONSTRAINT user_actions_action_type_check CHECK (action_type IN (
    'event_attendance',
    'class_attendance',
    'first_visit',
    'review',
    'deal_redemption',
    'save_item',
    'daily_checkin',
    'referral',
    'booking_click'
));

-- 14. Add wellness achievements
-- ============================================
-- First expand user_achievements CHECK constraint
ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_achievement_type_check;
ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_achievement_type_check CHECK (achievement_type IN (
    -- Event milestones
    'first_event', 'events_5', 'events_10', 'events_25', 'events_50', 'events_100',
    -- Review milestones
    'first_review', 'reviews_5', 'reviews_10', 'reviews_25', 'reviews_50',
    -- Streak achievements
    'streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 'streak_100',
    -- Level achievements
    'level_5', 'level_10', 'level_25', 'level_50', 'level_100',
    -- Special achievements
    'early_adopter', 'local_explorer', 'deal_hunter', 'social_butterfly',
    'super_supporter', 'community_champion',
    -- Wellness booking achievements
    'wellness_explorer', 'wellness_warrior', 'self_care_champion'
));

INSERT INTO achievement_definitions (achievement_type, name, description, icon, color, xp_reward) VALUES
    ('wellness_explorer', 'Wellness Explorer', 'Booked your first wellness appointment through Pulse', 'Heart', '#ec4899', 50),
    ('wellness_warrior', 'Wellness Warrior', 'Booked 5 wellness appointments through Pulse', 'Heart', '#ec4899', 150),
    ('self_care_champion', 'Self-Care Champion', 'Booked 10 wellness appointments through Pulse', 'Heart', '#ec4899', 300)
ON CONFLICT (achievement_type) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    xp_reward = EXCLUDED.xp_reward;


-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE pulse_wellness_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_booking_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_availability_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_scrape_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_user_notifications ENABLE ROW LEVEL SECURITY;

-- Providers and slots are publicly readable
CREATE POLICY "Wellness providers are viewable by everyone" ON pulse_wellness_providers FOR SELECT USING (true);
CREATE POLICY "Availability slots are viewable by everyone" ON pulse_availability_slots FOR SELECT USING (true);

-- Booking clicks: users can view own, insert own
CREATE POLICY "Users can view own booking clicks" ON pulse_booking_clicks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create booking clicks" ON pulse_booking_clicks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Alerts: users can manage own
CREATE POLICY "Users can manage own alerts" ON pulse_availability_alerts FOR ALL USING (auth.uid() = user_id);

-- Notifications: users can view own
CREATE POLICY "Users can view own notifications" ON pulse_user_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON pulse_user_notifications FOR UPDATE USING (auth.uid() = user_id);

-- Scrape log: service role only (no public policy needed, functions use SECURITY DEFINER)
CREATE POLICY "Service role full access to scrape log" ON pulse_scrape_log FOR ALL USING (auth.role() = 'service_role');

-- Service role full access for scraper operations
CREATE POLICY "Service role full access to providers" ON pulse_wellness_providers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to slots" ON pulse_availability_slots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to notifications" ON pulse_user_notifications FOR ALL USING (auth.role() = 'service_role');


-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_wellness_availability TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_wellness_providers TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_booking_click TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_availability_alert TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_wellness_availability TO authenticated;
