-- ============================================================================
-- PULSE APP - BUSINESS ANALYTICS EVENTS
-- Migration 005: Individual event tracking for business analytics
-- ============================================================================

-- 1. BUSINESS ANALYTICS TABLE (Individual event tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN (
        'profile_view',
        'class_view',
        'event_view',
        'booking_click',
        'booking_confirmed',
        'message_received'
    )),
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- null for anonymous tracking
    reference_id uuid,  -- for class/event id reference
    created_at timestamptz DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE business_analytics IS 'Tracks individual analytics events for businesses';
COMMENT ON COLUMN business_analytics.event_type IS 'Type of event: profile_view, class_view, event_view, booking_click, booking_confirmed, message_received';
COMMENT ON COLUMN business_analytics.reference_id IS 'Optional reference to related entity (class id, event id, etc.)';


-- 2. INDEXES FOR EFFICIENT QUERYING
-- ============================================================================
CREATE INDEX idx_business_analytics_business_id ON business_analytics(business_id);
CREATE INDEX idx_business_analytics_event_type ON business_analytics(event_type);
CREATE INDEX idx_business_analytics_created_at ON business_analytics(created_at);
CREATE INDEX idx_business_analytics_business_event ON business_analytics(business_id, event_type);
CREATE INDEX idx_business_analytics_business_date ON business_analytics(business_id, created_at);
CREATE INDEX idx_business_analytics_composite ON business_analytics(business_id, event_type, created_at);


-- 3. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE business_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for anonymous tracking)
CREATE POLICY "Anyone can insert analytics events" ON business_analytics
    FOR INSERT WITH CHECK (true);

-- Business owners can view their own analytics
CREATE POLICY "Business owners can view their analytics" ON business_analytics
    FOR SELECT USING (
        business_id IN (
            SELECT business_id FROM business_claims
            WHERE user_id = auth.uid() AND status = 'verified'
        )
    );


-- 4. FUNCTION: Track analytics event
-- ============================================================================
CREATE OR REPLACE FUNCTION track_analytics_event(
    p_business_id uuid,
    p_event_type text,
    p_user_id uuid DEFAULT NULL,
    p_reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event_id uuid;
BEGIN
    INSERT INTO business_analytics (business_id, event_type, user_id, reference_id)
    VALUES (p_business_id, p_event_type, p_user_id, p_reference_id)
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;


-- 5. FUNCTION: Get business analytics summary
-- ============================================================================
CREATE OR REPLACE FUNCTION get_business_analytics_summary(
    p_business_id uuid,
    p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date timestamptz;
    v_profile_views bigint;
    v_class_views bigint;
    v_event_views bigint;
    v_booking_clicks bigint;
    v_bookings_confirmed bigint;
    v_messages_received bigint;
    v_daily_breakdown jsonb;
BEGIN
    v_start_date := NOW() - (p_days || ' days')::interval;

    -- Get counts for each event type within the period
    SELECT
        COALESCE(SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'class_view' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'event_view' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'booking_click' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'booking_confirmed' THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN event_type = 'message_received' THEN 1 ELSE 0 END), 0)
    INTO
        v_profile_views,
        v_class_views,
        v_event_views,
        v_booking_clicks,
        v_bookings_confirmed,
        v_messages_received
    FROM business_analytics
    WHERE business_id = p_business_id
    AND created_at >= v_start_date;

    -- Get daily breakdown for charts
    SELECT COALESCE(jsonb_agg(daily_data ORDER BY date), '[]'::jsonb)
    INTO v_daily_breakdown
    FROM (
        SELECT
            DATE(created_at) as date,
            jsonb_build_object(
                'date', DATE(created_at),
                'profile_views', SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END),
                'class_views', SUM(CASE WHEN event_type = 'class_view' THEN 1 ELSE 0 END),
                'event_views', SUM(CASE WHEN event_type = 'event_view' THEN 1 ELSE 0 END),
                'booking_clicks', SUM(CASE WHEN event_type = 'booking_click' THEN 1 ELSE 0 END),
                'bookings_confirmed', SUM(CASE WHEN event_type = 'booking_confirmed' THEN 1 ELSE 0 END),
                'messages_received', SUM(CASE WHEN event_type = 'message_received' THEN 1 ELSE 0 END),
                'total_events', COUNT(*)
            ) as daily_data
        FROM business_analytics
        WHERE business_id = p_business_id
        AND created_at >= v_start_date
        GROUP BY DATE(created_at)
    ) daily_stats;

    -- Return comprehensive summary
    RETURN jsonb_build_object(
        'period_days', p_days,
        'start_date', v_start_date,
        'end_date', NOW(),
        'totals', jsonb_build_object(
            'profile_views', v_profile_views,
            'class_views', v_class_views,
            'event_views', v_event_views,
            'booking_clicks', v_booking_clicks,
            'bookings_confirmed', v_bookings_confirmed,
            'messages_received', v_messages_received,
            'total_events', v_profile_views + v_class_views + v_event_views +
                           v_booking_clicks + v_bookings_confirmed + v_messages_received
        ),
        'daily_breakdown', v_daily_breakdown
    );
END;
$$;


-- 6. FUNCTION: Get analytics comparison (current period vs previous period)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_business_analytics_comparison(
    p_business_id uuid,
    p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_start timestamptz;
    v_previous_start timestamptz;
    v_current_counts jsonb;
    v_previous_counts jsonb;
BEGIN
    v_current_start := NOW() - (p_days || ' days')::interval;
    v_previous_start := NOW() - (p_days * 2 || ' days')::interval;

    -- Current period counts
    SELECT jsonb_build_object(
        'profile_views', COALESCE(SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END), 0),
        'class_views', COALESCE(SUM(CASE WHEN event_type = 'class_view' THEN 1 ELSE 0 END), 0),
        'event_views', COALESCE(SUM(CASE WHEN event_type = 'event_view' THEN 1 ELSE 0 END), 0),
        'booking_clicks', COALESCE(SUM(CASE WHEN event_type = 'booking_click' THEN 1 ELSE 0 END), 0),
        'bookings_confirmed', COALESCE(SUM(CASE WHEN event_type = 'booking_confirmed' THEN 1 ELSE 0 END), 0),
        'messages_received', COALESCE(SUM(CASE WHEN event_type = 'message_received' THEN 1 ELSE 0 END), 0)
    )
    INTO v_current_counts
    FROM business_analytics
    WHERE business_id = p_business_id
    AND created_at >= v_current_start;

    -- Previous period counts
    SELECT jsonb_build_object(
        'profile_views', COALESCE(SUM(CASE WHEN event_type = 'profile_view' THEN 1 ELSE 0 END), 0),
        'class_views', COALESCE(SUM(CASE WHEN event_type = 'class_view' THEN 1 ELSE 0 END), 0),
        'event_views', COALESCE(SUM(CASE WHEN event_type = 'event_view' THEN 1 ELSE 0 END), 0),
        'booking_clicks', COALESCE(SUM(CASE WHEN event_type = 'booking_click' THEN 1 ELSE 0 END), 0),
        'bookings_confirmed', COALESCE(SUM(CASE WHEN event_type = 'booking_confirmed' THEN 1 ELSE 0 END), 0),
        'messages_received', COALESCE(SUM(CASE WHEN event_type = 'message_received' THEN 1 ELSE 0 END), 0)
    )
    INTO v_previous_counts
    FROM business_analytics
    WHERE business_id = p_business_id
    AND created_at >= v_previous_start
    AND created_at < v_current_start;

    -- Return with percentage changes
    RETURN jsonb_build_object(
        'period_days', p_days,
        'current_period', v_current_counts,
        'previous_period', v_previous_counts,
        'changes', jsonb_build_object(
            'profile_views', CASE
                WHEN (v_previous_counts->>'profile_views')::integer = 0 THEN 0
                ELSE ROUND((((v_current_counts->>'profile_views')::numeric - (v_previous_counts->>'profile_views')::numeric)
                    / (v_previous_counts->>'profile_views')::numeric) * 100)
            END,
            'class_views', CASE
                WHEN (v_previous_counts->>'class_views')::integer = 0 THEN 0
                ELSE ROUND((((v_current_counts->>'class_views')::numeric - (v_previous_counts->>'class_views')::numeric)
                    / (v_previous_counts->>'class_views')::numeric) * 100)
            END,
            'event_views', CASE
                WHEN (v_previous_counts->>'event_views')::integer = 0 THEN 0
                ELSE ROUND((((v_current_counts->>'event_views')::numeric - (v_previous_counts->>'event_views')::numeric)
                    / (v_previous_counts->>'event_views')::numeric) * 100)
            END,
            'booking_clicks', CASE
                WHEN (v_previous_counts->>'booking_clicks')::integer = 0 THEN 0
                ELSE ROUND((((v_current_counts->>'booking_clicks')::numeric - (v_previous_counts->>'booking_clicks')::numeric)
                    / (v_previous_counts->>'booking_clicks')::numeric) * 100)
            END,
            'bookings_confirmed', CASE
                WHEN (v_previous_counts->>'bookings_confirmed')::integer = 0 THEN 0
                ELSE ROUND((((v_current_counts->>'bookings_confirmed')::numeric - (v_previous_counts->>'bookings_confirmed')::numeric)
                    / (v_previous_counts->>'bookings_confirmed')::numeric) * 100)
            END,
            'messages_received', CASE
                WHEN (v_previous_counts->>'messages_received')::integer = 0 THEN 0
                ELSE ROUND((((v_current_counts->>'messages_received')::numeric - (v_previous_counts->>'messages_received')::numeric)
                    / (v_previous_counts->>'messages_received')::numeric) * 100)
            END
        )
    );
END;
$$;


-- 7. GRANTS
-- ============================================================================
-- Allow inserts for anonymous tracking
GRANT INSERT ON business_analytics TO authenticated, anon;

-- Allow select for authenticated users (RLS controls access)
GRANT SELECT ON business_analytics TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION track_analytics_event TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_business_analytics_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_analytics_comparison TO authenticated;


-- ============================================================================
-- DONE! Business analytics events table and functions ready.
-- ============================================================================
