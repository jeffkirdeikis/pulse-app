-- Scraping sources table (tracks all discovered and manual sources)
-- This table enables the unified scraping system to:
-- 1. Store auto-discovered booking system sources
-- 2. Track scraping history and success rates
-- 3. Dynamically load sources for the reliable scraper

CREATE TABLE IF NOT EXISTS scraping_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL,
  booking_system TEXT,
  widget_id TEXT,
  studio_id TEXT,
  tab_id TEXT,
  url TEXT,
  schedule_url TEXT,
  address TEXT,
  category TEXT,
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,

  -- Scraping metadata
  last_scraped TIMESTAMPTZ,
  last_scrape_success BOOLEAN,
  last_error TEXT,
  last_class_count INTEGER,
  last_event_count INTEGER,
  consecutive_failures INTEGER DEFAULT 0,

  -- Discovery metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT false,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(name, booking_system)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_scraping_sources_active ON scraping_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scraping_sources_system ON scraping_sources(booking_system);
CREATE INDEX IF NOT EXISTS idx_scraping_sources_priority ON scraping_sources(priority DESC);

-- Add confidence columns to events if not exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS verification_sources INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE scraping_sources ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read scraping sources (for transparency)
CREATE POLICY "Anyone can view scraping sources"
  ON scraping_sources
  FOR SELECT
  USING (true);

-- Only service role can modify
CREATE POLICY "Service role can modify scraping sources"
  ON scraping_sources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
