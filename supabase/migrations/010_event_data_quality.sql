-- Migration: Event Data Quality Constraints
-- Purpose: Prevent bad scraped data from entering the database
-- Created: 2026-02-04

-- ============================================
-- LAYER 1: DATABASE-LEVEL VALIDATION
-- ============================================

-- 1. Prevent title = venue_name (business listings masquerading as events)
ALTER TABLE events ADD CONSTRAINT check_title_not_venue_name
  CHECK (title IS DISTINCT FROM venue_name);

-- 2. Prevent common service/navigation text in titles
ALTER TABLE events ADD CONSTRAINT check_title_not_service_text
  CHECK (
    title NOT ILIKE '%Work With Us%' AND
    title NOT ILIKE '%Our Team%' AND
    title NOT ILIKE '%Contact Us%' AND
    title NOT ILIKE '%Register for Programs%' AND
    title NOT ILIKE '%Our Professional Team%' AND
    title NOT ILIKE '%Legal Advocacy%' AND
    title NOT ILIKE '%Child Care%' AND
    title NOT ILIKE '%Housing Services%' AND
    title NOT ILIKE '%Workshop description%'
  );

-- 3. Prevent obviously wrong holiday dates
-- Christmas events must be in December
-- New Year's events must be Dec 31 or Jan 1
-- Boxing Day must be Dec 26
CREATE OR REPLACE FUNCTION validate_holiday_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Christmas events must be in December
  IF NEW.title ILIKE '%Christmas%' AND EXTRACT(MONTH FROM NEW.start_date) != 12 THEN
    RAISE EXCEPTION 'Christmas events must be in December, got: %', NEW.start_date;
  END IF;

  -- New Year's Day events must be Jan 1
  IF NEW.title ILIKE '%New Year''s Day%' AND
     NOT (EXTRACT(MONTH FROM NEW.start_date) = 1 AND EXTRACT(DAY FROM NEW.start_date) = 1) THEN
    RAISE EXCEPTION 'New Year''s Day events must be on January 1, got: %', NEW.start_date;
  END IF;

  -- Boxing Day events must be Dec 26
  IF NEW.title ILIKE '%Boxing Day%' AND
     NOT (EXTRACT(MONTH FROM NEW.start_date) = 12 AND EXTRACT(DAY FROM NEW.start_date) = 26) THEN
    RAISE EXCEPTION 'Boxing Day events must be on December 26, got: %', NEW.start_date;
  END IF;

  -- Halloween events must be in October
  IF NEW.title ILIKE '%Halloween%' AND EXTRACT(MONTH FROM NEW.start_date) != 10 THEN
    RAISE EXCEPTION 'Halloween events must be in October, got: %', NEW.start_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_holiday_dates
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION validate_holiday_dates();

-- 4. Create a quarantine table for suspicious data
CREATE TABLE IF NOT EXISTS events_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_data jsonb NOT NULL,
  rejection_reason text NOT NULL,
  source_scraper text,
  created_at timestamptz DEFAULT now(),
  reviewed boolean DEFAULT false,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz
);

-- 5. Create a function to quarantine suspicious events instead of rejecting
CREATE OR REPLACE FUNCTION quarantine_suspicious_event(
  event_data jsonb,
  reason text,
  scraper_name text DEFAULT 'unknown'
)
RETURNS uuid AS $$
DECLARE
  quarantine_id uuid;
BEGIN
  INSERT INTO events_quarantine (original_data, rejection_reason, source_scraper)
  VALUES (event_data, reason, scraper_name)
  RETURNING id INTO quarantine_id;

  RETURN quarantine_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Add index for finding clustered events (same date/time/venue)
CREATE INDEX IF NOT EXISTS idx_events_clustering
  ON events(start_date, start_time, venue_name);

-- 7. Create a view to detect suspicious clustering
CREATE OR REPLACE VIEW event_clustering_alerts AS
SELECT
  start_date,
  start_time,
  venue_name,
  COUNT(*) as event_count,
  array_agg(title) as titles
FROM events
GROUP BY start_date, start_time, venue_name
HAVING COUNT(*) > 3
ORDER BY COUNT(*) DESC;

-- 8. Create a view to detect placeholder times (9:00 AM is suspicious)
CREATE OR REPLACE VIEW placeholder_time_alerts AS
SELECT
  id,
  title,
  venue_name,
  start_date,
  start_time,
  tags
FROM events
WHERE start_time = '09:00:00'
  AND tags @> ARRAY['auto-scraped']
ORDER BY start_date DESC;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON CONSTRAINT check_title_not_venue_name ON events IS
  'Prevents business listings from being inserted as events (title must differ from venue_name)';

COMMENT ON CONSTRAINT check_title_not_service_text ON events IS
  'Prevents common service/navigation webpage text from being inserted as event titles';

COMMENT ON FUNCTION validate_holiday_dates() IS
  'Validates that holiday-named events occur on appropriate dates';

COMMENT ON TABLE events_quarantine IS
  'Holds suspicious scraped events for manual review before publication';

COMMENT ON VIEW event_clustering_alerts IS
  'Detects suspicious event clustering (>3 events at same date/time/venue)';

COMMENT ON VIEW placeholder_time_alerts IS
  'Detects events with placeholder 9:00 AM time from auto-scrapers';
