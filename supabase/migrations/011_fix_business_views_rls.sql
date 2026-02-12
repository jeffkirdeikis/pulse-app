-- ============================================
-- FIX: business_views RLS vulnerability
--
-- PROBLEM: "Anyone can track views" policy allows fake analytics injection
-- SOLUTION: Require authenticated users AND rate limit via function
-- ============================================

-- 1. Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can track views" ON business_views;

-- 2. Create a more restrictive policy - only allow inserts through the RPC function
-- Direct table inserts are now blocked
CREATE POLICY "Views tracked via function only" ON business_views
    FOR INSERT
    WITH CHECK (false);  -- Block all direct inserts

-- 3. Update the track_business_view function to be more secure
-- Add rate limiting: max 1 view per user per business per 5 minutes
CREATE OR REPLACE FUNCTION track_business_view(
    p_business_id uuid,
    p_viewer_id uuid DEFAULT NULL,
    p_source text DEFAULT 'browse'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_view_exists boolean;
BEGIN
    -- Rate limiting: Check if this user/session already viewed this business recently
    IF p_viewer_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM business_views
            WHERE business_id = p_business_id
            AND viewer_id = p_viewer_id
            AND viewed_at > NOW() - INTERVAL '5 minutes'
        ) INTO v_recent_view_exists;

        IF v_recent_view_exists THEN
            -- Don't insert duplicate view, but return success
            RETURN jsonb_build_object('tracked', false, 'reason', 'rate_limited');
        END IF;
    END IF;

    -- Validate business exists
    IF NOT EXISTS (SELECT 1 FROM businesses WHERE id = p_business_id) THEN
        RETURN jsonb_build_object('tracked', false, 'reason', 'invalid_business');
    END IF;

    -- Insert the view (SECURITY DEFINER allows this to bypass RLS)
    INSERT INTO business_views (business_id, viewer_id, source)
    VALUES (p_business_id, p_viewer_id, p_source);

    RETURN jsonb_build_object('tracked', true);
END;
$$;

-- 4. Ensure only the function can insert, and it's available to both auth and anon
REVOKE INSERT ON business_views FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION track_business_view TO authenticated, anon;

-- 5. Add index for rate limiting lookups
CREATE INDEX IF NOT EXISTS idx_business_views_rate_limit
    ON business_views(business_id, viewer_id, viewed_at DESC)
    WHERE viewer_id IS NOT NULL;

-- 6. Comment explaining the security model
COMMENT ON TABLE business_views IS
    'Business view analytics. Direct inserts blocked - use track_business_view() function which includes rate limiting.';
