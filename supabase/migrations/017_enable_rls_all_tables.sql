-- ============================================================
-- Migration 017: Enable RLS on ALL remaining tables
-- ============================================================
--
-- This migration enables Row Level Security on every public table
-- that currently lacks it. Tables are grouped by access pattern.
--
-- Service role key (used by scrapers/scripts) bypasses RLS entirely,
-- so no script changes are needed.
--
-- SECURITY DEFINER functions also bypass RLS, so RPCs are unaffected.
-- ============================================================


-- ============================================================
-- TIER 1: CRITICAL USER-FACING TABLES
-- These are queried directly by the client with the anon key.
-- Policies for admin INSERT/UPDATE/DELETE already exist (migration 015).
-- ============================================================

-- events: The main classes/events table. Everyone can read.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view events"
  ON events FOR SELECT USING (true);

-- deals: Business deals/promotions. Everyone can read.
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view deals"
  ON deals FOR SELECT USING (true);

-- pending_items: Submission queue. Admin policies already exist (migration 015).
-- Auth users can INSERT (existing policy). No public SELECT needed.
ALTER TABLE pending_items ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TIER 2: CLIENT-QUERIED CONFIG/DISPLAY TABLES
-- Public read, service role write.
-- ============================================================

-- business_pulse_scores: Leaderboard scores, queried by businessAnalytics.js
ALTER TABLE business_pulse_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view pulse scores"
  ON business_pulse_scores FOR SELECT USING (true);

-- achievement_definitions: Gamification config, displayed in UI
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view achievement definitions"
  ON achievement_definitions FOR SELECT USING (true);

-- xp_rewards: XP config table, read by gamification functions
ALTER TABLE xp_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view XP rewards config"
  ON xp_rewards FOR SELECT USING (true);

-- categories: Category list for filters
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view categories"
  ON categories FOR SELECT USING (true);

-- venue_aliases: Venue name mappings
ALTER TABLE venue_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view venue aliases"
  ON venue_aliases FOR SELECT USING (true);

-- neighbor_hires: Social proof data
ALTER TABLE neighbor_hires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view neighbor hires"
  ON neighbor_hires FOR SELECT USING (true);


-- ============================================================
-- TIER 3: USER-INTERACTIVE TABLES
-- Authenticated users can manage their own records.
-- ============================================================

-- review_votes: Users vote on reviews
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all review votes"
  ON review_votes FOR SELECT USING (true);
CREATE POLICY "Users can manage own review votes"
  ON review_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review votes"
  ON review_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own review votes"
  ON review_votes FOR DELETE USING (auth.uid() = user_id);

-- content_flags: Users flag inappropriate content (uses reporter_id, not user_id)
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own flags"
  ON content_flags FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Users can create flags"
  ON content_flags FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- shares: Social shares tracking
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own shares"
  ON shares FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create shares"
  ON shares FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_feedback: User feedback submissions
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own feedback"
  ON user_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create feedback"
  ON user_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- transactions: User transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create transactions"
  ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- TIER 4: INTERNAL / ANALYTICS TABLES
-- No client access needed. Service role bypasses RLS.
-- ============================================================

ALTER TABLE business_analytics_daily ENABLE ROW LEVEL SECURITY;
-- Business owners can view their own analytics
CREATE POLICY "Business analytics daily are viewable by everyone"
  ON business_analytics_daily FOR SELECT USING (true);

ALTER TABLE business_messages ENABLE ROW LEVEL SECURITY;
-- No public policy = no direct access

ALTER TABLE discovered_sources ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE screen_views ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE click_events ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE ab_test_assignments ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only

ALTER TABLE user_cohorts ENABLE ROW LEVEL SECURITY;
-- No public policy = internal only


-- ============================================================
-- FIX: pulse_scrape_log missing public SELECT policy
-- RLS is enabled but only service_role can read.
-- Client needs to read "last scraped" timestamp.
-- ============================================================

CREATE POLICY "Everyone can view scrape log"
  ON pulse_scrape_log FOR SELECT USING (true);
