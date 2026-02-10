-- Migration: Backfill venue_id by matching venue_name to businesses.name
-- This links events to the businesses table for referential integrity.
-- Run after all scrapers have been updated to include venue_id on insert.

-- Step 1: Backfill venue_id where venue_name matches a business name exactly
UPDATE events e
SET venue_id = b.id
FROM businesses b
WHERE e.venue_id IS NULL
  AND e.venue_name IS NOT NULL
  AND LOWER(TRIM(e.venue_name)) = LOWER(TRIM(b.name))
  AND e.status = 'active';

-- Step 2: Archive expired events (older than 7 days)
UPDATE events
SET status = 'archived'
WHERE start_date < (CURRENT_DATE - INTERVAL '7 days')
  AND status = 'active';

-- Step 3: Create index on venue_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_events_venue_name ON events (venue_name);

-- Step 4: Create a function to auto-link venue_id on insert
CREATE OR REPLACE FUNCTION auto_link_venue_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If venue_id is not set but venue_name is, try to find matching business
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

-- Step 5: Create trigger to auto-link venue_id on every insert
DROP TRIGGER IF EXISTS trigger_auto_link_venue_id ON events;
CREATE TRIGGER trigger_auto_link_venue_id
  BEFORE INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_venue_id();
