-- Migration 016: Provider Change Detection
-- Adds columns to scraping_sources for automated booking provider change detection.
-- When a venue switches providers (e.g., WellnessLiving → Mariana Tek),
-- the system detects the change, auto-switches, and re-scrapes with zero downtime.

-- Previous config (preserved for rollback)
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS previous_booking_system TEXT;
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS previous_widget_id TEXT;
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS previous_studio_id TEXT;

-- Provider change tracking
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS provider_change_detected_at TIMESTAMPTZ;
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS provider_change_confirmed BOOLEAN DEFAULT false;

-- Zero-result tracking (separate from error failures)
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS consecutive_zero_results INTEGER DEFAULT 0;

-- Detection debounce
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS last_detection_attempt TIMESTAMPTZ;

-- Detection log
ALTER TABLE scraping_sources ADD COLUMN IF NOT EXISTS detection_notes TEXT;
