-- ============================================================
-- Migration 018: Database-level rate limiting
-- ============================================================
-- Lightweight rate limiting using a PostgreSQL table + function.
-- Tracks actions per user and enforces limits without external services.
-- ============================================================

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rate_limits_lookup ON rate_limits(user_id, action, created_at DESC);

-- Auto-cleanup: delete entries older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Check if action is allowed and record it if so.
-- Returns JSON: { allowed: true/false, remaining: N, retry_after_seconds: N }
CREATE OR REPLACE FUNCTION check_and_record_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_attempts int DEFAULT 5,
  p_window_minutes int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_oldest timestamptz;
  v_window interval;
  v_retry_after int;
BEGIN
  v_window := (p_window_minutes || ' minutes')::interval;

  -- Count recent actions within window
  SELECT COUNT(*), MIN(created_at)
  INTO v_count, v_oldest
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > now() - v_window;

  -- Check limit
  IF v_count >= p_max_attempts THEN
    -- Calculate seconds until oldest entry expires
    v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM (v_oldest + v_window - now()))::int);
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', v_retry_after
    );
  END IF;

  -- Record the action
  INSERT INTO rate_limits (user_id, action) VALUES (p_user_id, p_action);

  -- Opportunistic cleanup (1% chance to avoid doing it every call)
  IF random() < 0.01 THEN
    PERFORM cleanup_rate_limits();
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_attempts - v_count - 1,
    'retry_after_seconds', 0
  );
END;
$$;

-- RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Users can only see their own rate limit records
CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT USING (auth.uid() = user_id);
-- No direct insert/update/delete — only via check_and_record_rate_limit()

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_and_record_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits TO authenticated;
