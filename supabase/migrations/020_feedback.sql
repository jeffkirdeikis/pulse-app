-- ============================================================
-- Migration 020: Feedback widget
-- ============================================================
-- User-facing feedback table for bug reports, comments, and
-- suggestions. Anyone can submit; only admins can read.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('bug', 'comment', 'suggestion')),
  message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 5000),
  email TEXT,
  screenshot_url TEXT,
  page_url TEXT,
  user_agent TEXT,
  viewport TEXT,
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback (no auth required)
CREATE POLICY "Anyone can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (true);

-- Only admin can view feedback
CREATE POLICY "Only admins can view feedback"
  ON feedback FOR SELECT
  USING (
    auth.jwt()->>'email' = 'jeff@pulse-app.ca'
    OR (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

-- Only admin can update feedback status
CREATE POLICY "Only admins can update feedback"
  ON feedback FOR UPDATE
  USING (
    auth.jwt()->>'email' = 'jeff@pulse-app.ca'
    OR (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

-- Create storage bucket for feedback screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload screenshots (max 5MB enforced client-side)
CREATE POLICY "Anyone can upload feedback screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'feedback-screenshots');

-- Allow public read access to screenshots
CREATE POLICY "Public read access for feedback screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-screenshots');
