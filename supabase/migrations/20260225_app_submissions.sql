-- App submissions table for user-submitted AI apps
CREATE TABLE IF NOT EXISTS app_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: anyone can insert
ALTER TABLE app_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an app"
  ON app_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read submissions (via service role or admin policies)
CREATE POLICY "Admins can read app submissions"
  ON app_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
