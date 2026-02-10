-- Migration 013: Data quality improvements for events table
-- Run: Feb 10, 2026
-- Purpose: Backfill venue_id, auto-expire events, prevent duplicates
--
-- All steps have been executed on production. This file documents them.

-- Step 1: Backfill venue_id where venue_name matches a business name exactly
-- Result: 2,060 events linked (up from 59, now 85.9% coverage)
UPDATE events e
SET venue_id = b.id
FROM businesses b
WHERE e.venue_id IS NULL
  AND e.venue_name IS NOT NULL
  AND LOWER(TRIM(e.venue_name)) = LOWER(TRIM(b.name))
  AND e.status = 'active';

-- Step 2: Archive expired events (older than 1 day) using 'completed' status
-- Note: 'archived' is NOT in events_status_check constraint, use 'completed'
-- Result: 230 expired events archived
UPDATE events
SET status = 'completed'
WHERE start_date < (CURRENT_DATE - INTERVAL '1 day')
  AND status = 'active';

-- Step 3: Trim over-duplicated venues to 14-day window
-- Scrapers stamped same weekly schedule on every day (ratio >20x)
-- Result: 1,047 bloated records trimmed
UPDATE events
SET status = 'completed'
WHERE status = 'active'
  AND event_type = 'class'
  AND start_date > CURRENT_DATE + INTERVAL '14 days'
  AND venue_name IN (
    'Breathe Fitness Studio',
    'Squamish Barbell',
    'Oxygen Yoga & Fitness Squamish',
    'The Sound Martial Arts',
    'Seed Studio',
    'Wild Life Gym',
    'Mountain Fitness Center'
  );

-- Step 4: Create index on venue_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_events_venue_name ON events (venue_name);

-- Step 5: Create unique index to PREVENT duplicate events at DB level
-- Defense-in-depth: even if scraper dedup fails, DB rejects duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_no_duplicates
  ON events (venue_name, title, start_date, COALESCE(start_time, '00:00:00'))
  WHERE status = 'active';

-- Step 6: Auto-link venue_id on every new event insert
CREATE OR REPLACE FUNCTION auto_link_venue_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.venue_id IS NULL AND NEW.venue_name IS NOT NULL THEN
    SELECT id INTO NEW.venue_id
    FROM businesses
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.venue_name))
      AND status = 'active'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_link_venue_id ON events;
CREATE TRIGGER trigger_auto_link_venue_id
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_venue_id();

-- Step 7: Callable function to expire old events (for cron or manual use)
CREATE OR REPLACE FUNCTION cleanup_expired_events()
RETURNS integer AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE events SET status = 'completed'
  WHERE status = 'active'
    AND start_date < (CURRENT_DATE - INTERVAL '1 day');
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql;
