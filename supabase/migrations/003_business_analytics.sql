-- ============================================
-- PULSE APP - BUSINESS ANALYTICS & SOCIAL PROOF
-- Powers real metrics, scores, and social proof
-- ============================================

-- 1. Business Profile Views (tracks every view)
-- ============================================
CREATE TABLE IF NOT EXISTS business_views (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null for anonymous
    viewed_at timestamptz DEFAULT now(),
    source text DEFAULT 'browse'  -- 'browse', 'search', 'deal', 'event', 'share'
);

CREATE INDEX idx_business_views_business ON business_views(business_id);
CREATE INDEX idx_business_views_date ON business_views(viewed_at);
CREATE INDEX idx_business_views_business_date ON business_views(business_id, viewed_at);


-- 2. Business Followers
-- ============================================
CREATE TABLE IF NOT EXISTS business_followers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    followed_at timestamptz DEFAULT now(),
    UNIQUE(business_id, user_id)
);

CREATE INDEX idx_business_followers_business ON business_followers(business_id);
CREATE INDEX idx_business_followers_user ON business_followers(user_id);


-- 3. Bookings/Jobs (services booked through Pulse)
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    service_type text,  -- 'appointment', 'reservation', 'inquiry', 'quote_request'
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes text,
    scheduled_date date,
    scheduled_time time,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_bookings_business ON bookings(business_id);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);


-- 4. Business Messages (for response time tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS business_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    from_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    to_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    message_type text DEFAULT 'inquiry' CHECK (message_type IN ('inquiry', 'reply', 'system')),
    content text,
    read_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_business_messages_business ON business_messages(business_id);
CREATE INDEX idx_business_messages_created ON business_messages(created_at);


-- 5. Business Analytics (daily aggregated stats)
-- ============================================
CREATE TABLE IF NOT EXISTS business_analytics_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date date NOT NULL,
    views integer DEFAULT 0,
    unique_views integer DEFAULT 0,
    saves integer DEFAULT 0,
    followers_gained integer DEFAULT 0,
    followers_lost integer DEFAULT 0,
    bookings integer DEFAULT 0,
    bookings_completed integer DEFAULT 0,
    messages_received integer DEFAULT 0,
    messages_responded integer DEFAULT 0,
    avg_response_time_minutes integer,
    deal_views integer DEFAULT 0,
    deal_redemptions integer DEFAULT 0,
    event_views integer DEFAULT 0,
    event_registrations integer DEFAULT 0,
    UNIQUE(business_id, date)
);

CREATE INDEX idx_analytics_daily_business ON business_analytics_daily(business_id);
CREATE INDEX idx_analytics_daily_date ON business_analytics_daily(date);


-- 6. Business Pulse Score (calculated score with breakdown)
-- ============================================
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

    -- Ranking
    category_rank integer,
    overall_rank integer,
    percentile integer,  -- Top X%

    -- Timestamps
    calculated_at timestamptz DEFAULT now(),

    UNIQUE(business_id)
);

CREATE INDEX idx_pulse_scores_business ON business_pulse_scores(business_id);
CREATE INDEX idx_pulse_scores_total ON business_pulse_scores(total_score DESC);


-- 7. Customer Testimonials (real reviews that can be featured)
-- ============================================
CREATE TABLE IF NOT EXISTS testimonials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quote text NOT NULL,  -- The testimonial text
    rating integer CHECK (rating >= 1 AND rating <= 5),
    user_display_name text,  -- "Mike R." format
    featured boolean DEFAULT false,
    approved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_testimonials_business ON testimonials(business_id);
CREATE INDEX idx_testimonials_featured ON testimonials(business_id, featured) WHERE featured = true;


-- 8. Neighbor Connections (real "X neighbors hired them")
-- ============================================
CREATE TABLE IF NOT EXISTS neighbor_hires (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    hired_at timestamptz DEFAULT now(),
    booking_id uuid REFERENCES bookings(id),
    UNIQUE(business_id, user_id)
);

CREATE INDEX idx_neighbor_hires_business ON neighbor_hires(business_id);


-- ============================================
-- FUNCTIONS
-- ============================================

-- 9. Track business view
-- ============================================
CREATE OR REPLACE FUNCTION track_business_view(
    p_business_id uuid,
    p_viewer_id uuid DEFAULT NULL,
    p_source text DEFAULT 'browse'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO business_views (business_id, viewer_id, source)
    VALUES (p_business_id, p_viewer_id, p_source);
END;
$$;


-- 10. Toggle follow business
-- ============================================
CREATE OR REPLACE FUNCTION toggle_follow_business(
    p_business_id uuid,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM business_followers
        WHERE business_id = p_business_id AND user_id = p_user_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM business_followers
        WHERE business_id = p_business_id AND user_id = p_user_id;
        RETURN jsonb_build_object('following', false);
    ELSE
        INSERT INTO business_followers (business_id, user_id)
        VALUES (p_business_id, p_user_id);
        RETURN jsonb_build_object('following', true);
    END IF;
END;
$$;


-- 11. Get business analytics
-- ============================================
CREATE OR REPLACE FUNCTION get_business_analytics(
    p_business_id uuid,
    p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_views_total integer;
    v_views_period integer;
    v_views_prev_period integer;
    v_followers integer;
    v_saves integer;
    v_bookings_completed integer;
    v_avg_response_minutes integer;
    v_pulse_score record;
BEGIN
    -- Total views
    SELECT COUNT(*) INTO v_views_total
    FROM business_views WHERE business_id = p_business_id;

    -- Views this period
    SELECT COUNT(*) INTO v_views_period
    FROM business_views
    WHERE business_id = p_business_id
    AND viewed_at >= NOW() - (p_days || ' days')::interval;

    -- Views previous period (for comparison)
    SELECT COUNT(*) INTO v_views_prev_period
    FROM business_views
    WHERE business_id = p_business_id
    AND viewed_at >= NOW() - (p_days * 2 || ' days')::interval
    AND viewed_at < NOW() - (p_days || ' days')::interval;

    -- Followers
    SELECT COUNT(*) INTO v_followers
    FROM business_followers WHERE business_id = p_business_id;

    -- Saves
    SELECT COUNT(*) INTO v_saves
    FROM saved_items
    WHERE item_type = 'service' AND item_id = p_business_id::text;

    -- Completed bookings
    SELECT COUNT(*) INTO v_bookings_completed
    FROM bookings
    WHERE business_id = p_business_id AND status = 'completed';

    -- Average response time
    SELECT AVG(avg_response_time_minutes)::integer INTO v_avg_response_minutes
    FROM business_analytics_daily
    WHERE business_id = p_business_id
    AND avg_response_time_minutes IS NOT NULL
    AND date >= NOW() - (p_days || ' days')::interval;

    -- Pulse score
    SELECT * INTO v_pulse_score
    FROM business_pulse_scores WHERE business_id = p_business_id;

    RETURN jsonb_build_object(
        'views', jsonb_build_object(
            'total', v_views_total,
            'period', v_views_period,
            'previous_period', v_views_prev_period,
            'change_percent', CASE
                WHEN v_views_prev_period = 0 THEN 0
                ELSE ROUND(((v_views_period - v_views_prev_period)::numeric / v_views_prev_period) * 100)
            END
        ),
        'followers', v_followers,
        'saves', v_saves,
        'bookings_completed', v_bookings_completed,
        'avg_response_minutes', v_avg_response_minutes,
        'pulse_score', CASE WHEN v_pulse_score IS NULL THEN NULL ELSE jsonb_build_object(
            'total', v_pulse_score.total_score,
            'profile_completion', v_pulse_score.profile_completion,
            'engagement', v_pulse_score.engagement_score,
            'response', v_pulse_score.response_score,
            'quality', v_pulse_score.quality_score,
            'satisfaction', v_pulse_score.satisfaction_score,
            'percentile', v_pulse_score.percentile,
            'category_rank', v_pulse_score.category_rank
        ) END
    );
END;
$$;


-- 12. Get social proof for a business
-- ============================================
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
BEGIN
    -- Jobs completed on Pulse
    SELECT COUNT(*) INTO v_bookings_count
    FROM bookings
    WHERE business_id = p_business_id AND status = 'completed';

    -- Neighbors who hired (users in same area)
    SELECT COUNT(*) INTO v_neighbor_count
    FROM neighbor_hires WHERE business_id = p_business_id;

    -- Featured testimonial
    SELECT quote, user_display_name, rating INTO v_testimonial
    FROM testimonials
    WHERE business_id = p_business_id AND featured = true AND approved = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Average response time (last 30 days)
    SELECT AVG(avg_response_time_minutes)::integer INTO v_response_time
    FROM business_analytics_daily
    WHERE business_id = p_business_id
    AND avg_response_time_minutes IS NOT NULL
    AND date >= NOW() - '30 days'::interval;

    -- Satisfaction rate (% of 4+ star reviews in last 6 months)
    SELECT
        CASE WHEN COUNT(*) = 0 THEN NULL
        ELSE ROUND((COUNT(*) FILTER (WHERE rating >= 4)::numeric / COUNT(*)) * 100)
        END INTO v_satisfaction_rate
    FROM reviews
    WHERE business_id = p_business_id
    AND created_at >= NOW() - '6 months'::interval;

    -- Years active (from business created_at if available)
    SELECT EXTRACT(YEAR FROM AGE(NOW(), MIN(created_at)))::integer INTO v_years_active
    FROM bookings WHERE business_id = p_business_id;

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
        'years_active', v_years_active
    );
END;
$$;


-- 13. Calculate Pulse Score for a business
-- ============================================
CREATE OR REPLACE FUNCTION calculate_pulse_score(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile_score integer := 0;
    v_engagement_score integer := 0;
    v_response_score integer := 0;
    v_quality_score integer := 0;
    v_satisfaction_score integer := 0;
    v_total_score integer;
    v_business record;
    v_avg_response integer;
    v_review_avg numeric;
    v_review_count integer;
    v_views_30d integer;
    v_bookings_30d integer;
BEGIN
    -- Get business data
    SELECT * INTO v_business FROM businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Business not found');
    END IF;

    -- Profile completion score (0-100)
    v_profile_score := 0;
    IF v_business.name IS NOT NULL THEN v_profile_score := v_profile_score + 20; END IF;
    IF v_business.address IS NOT NULL THEN v_profile_score := v_profile_score + 15; END IF;
    IF v_business.phone IS NOT NULL THEN v_profile_score := v_profile_score + 15; END IF;
    IF v_business.website IS NOT NULL THEN v_profile_score := v_profile_score + 15; END IF;
    IF v_business.email IS NOT NULL THEN v_profile_score := v_profile_score + 15; END IF;
    IF v_business.category IS NOT NULL THEN v_profile_score := v_profile_score + 20; END IF;

    -- Engagement score (based on views and interactions)
    SELECT COUNT(*) INTO v_views_30d
    FROM business_views
    WHERE business_id = p_business_id AND viewed_at >= NOW() - '30 days'::interval;

    SELECT COUNT(*) INTO v_bookings_30d
    FROM bookings
    WHERE business_id = p_business_id AND created_at >= NOW() - '30 days'::interval;

    v_engagement_score := LEAST(100, (v_views_30d / 10) + (v_bookings_30d * 10));

    -- Response score (based on response time)
    SELECT AVG(avg_response_time_minutes)::integer INTO v_avg_response
    FROM business_analytics_daily
    WHERE business_id = p_business_id AND avg_response_time_minutes IS NOT NULL;

    IF v_avg_response IS NULL THEN
        v_response_score := 0;
    ELSIF v_avg_response <= 30 THEN
        v_response_score := 100;
    ELSIF v_avg_response <= 60 THEN
        v_response_score := 90;
    ELSIF v_avg_response <= 120 THEN
        v_response_score := 80;
    ELSIF v_avg_response <= 240 THEN
        v_response_score := 60;
    ELSIF v_avg_response <= 480 THEN
        v_response_score := 40;
    ELSE
        v_response_score := 20;
    END IF;

    -- Quality score (based on Google rating)
    v_quality_score := COALESCE((v_business.google_rating / 5.0 * 100)::integer, 0);

    -- Satisfaction score (based on reviews)
    SELECT AVG(rating), COUNT(*) INTO v_review_avg, v_review_count
    FROM reviews WHERE business_id = p_business_id;

    IF v_review_count >= 5 THEN
        v_satisfaction_score := COALESCE((v_review_avg / 5.0 * 100)::integer, 0);
    ELSE
        -- Use Google reviews if not enough Pulse reviews
        v_satisfaction_score := v_quality_score;
    END IF;

    -- Calculate total score (weighted average)
    v_total_score := (
        v_profile_score * 0.15 +
        v_engagement_score * 0.25 +
        v_response_score * 0.20 +
        v_quality_score * 0.20 +
        v_satisfaction_score * 0.20
    )::integer * 10;  -- Scale to 0-1000

    -- Upsert the score
    INSERT INTO business_pulse_scores (
        business_id, total_score, profile_completion, engagement_score,
        response_score, quality_score, satisfaction_score, calculated_at
    ) VALUES (
        p_business_id, v_total_score, v_profile_score, v_engagement_score,
        v_response_score, v_quality_score, v_satisfaction_score, NOW()
    )
    ON CONFLICT (business_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        profile_completion = EXCLUDED.profile_completion,
        engagement_score = EXCLUDED.engagement_score,
        response_score = EXCLUDED.response_score,
        quality_score = EXCLUDED.quality_score,
        satisfaction_score = EXCLUDED.satisfaction_score,
        calculated_at = EXCLUDED.calculated_at;

    -- Update rankings
    WITH ranked AS (
        SELECT business_id,
            ROW_NUMBER() OVER (ORDER BY total_score DESC) as overall_rank,
            PERCENT_RANK() OVER (ORDER BY total_score DESC) as pct_rank
        FROM business_pulse_scores
    )
    UPDATE business_pulse_scores ps SET
        overall_rank = r.overall_rank,
        percentile = (100 - (r.pct_rank * 100))::integer
    FROM ranked r WHERE ps.business_id = r.business_id;

    RETURN jsonb_build_object(
        'total_score', v_total_score,
        'profile_completion', v_profile_score,
        'engagement', v_engagement_score,
        'response', v_response_score,
        'quality', v_quality_score,
        'satisfaction', v_satisfaction_score
    );
END;
$$;


-- 14. Create testimonial from review
-- ============================================
CREATE OR REPLACE FUNCTION create_testimonial_from_review(
    p_review_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review record;
    v_user_name text;
BEGIN
    SELECT r.*, p.full_name INTO v_review
    FROM reviews r
    JOIN profiles p ON p.id = r.user_id
    WHERE r.id = p_review_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Review not found');
    END IF;

    -- Create display name (First name + last initial)
    v_user_name := SPLIT_PART(v_review.full_name, ' ', 1) || ' ' ||
                   LEFT(SPLIT_PART(v_review.full_name, ' ', 2), 1) || '.';

    INSERT INTO testimonials (
        business_id, review_id, user_id, quote, rating, user_display_name
    ) VALUES (
        v_review.business_id, p_review_id, v_review.user_id,
        v_review.content, v_review.rating, v_user_name
    );

    RETURN jsonb_build_object('success', true, 'display_name', v_user_name);
END;
$$;


-- 15. Record neighbor hire (when booking completes)
-- ============================================
CREATE OR REPLACE FUNCTION record_neighbor_hire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO neighbor_hires (business_id, user_id, booking_id)
        VALUES (NEW.business_id, NEW.user_id, NEW.id)
        ON CONFLICT (business_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_completed
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION record_neighbor_hire();


-- 16. Row Level Security
-- ============================================
ALTER TABLE business_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Views are write-only for tracking, readable by business owners
CREATE POLICY "Anyone can track views" ON business_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Business owners can view their analytics" ON business_views FOR SELECT
    USING (business_id IN (SELECT business_id FROM business_claims WHERE user_id = auth.uid() AND status = 'verified'));

-- Followers
CREATE POLICY "Users can manage own follows" ON business_followers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can see follower counts" ON business_followers FOR SELECT USING (true);

-- Bookings
CREATE POLICY "Users can view own bookings" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Business owners can view their bookings" ON bookings FOR SELECT
    USING (business_id IN (SELECT business_id FROM business_claims WHERE user_id = auth.uid() AND status = 'verified'));

-- Testimonials (public read for approved)
CREATE POLICY "Anyone can view approved testimonials" ON testimonials FOR SELECT USING (approved = true);


-- 17. Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION track_business_view TO authenticated, anon;
GRANT EXECUTE ON FUNCTION toggle_follow_business TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_social_proof TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_pulse_score TO authenticated;
