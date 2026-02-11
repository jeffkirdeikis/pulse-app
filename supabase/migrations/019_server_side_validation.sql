-- ============================================================
-- Migration 019: Server-side input validation
-- ============================================================
-- Adds database-level constraints that enforce data quality
-- regardless of whether requests come from client or scripts.
-- These cannot be bypassed by skipping client-side validation.
-- ============================================================

-- ============================================================
-- PENDING_ITEMS: Validate submission data
-- ============================================================

-- Restrict item_type to known values
ALTER TABLE pending_items
  ADD CONSTRAINT pending_items_type_check
  CHECK (item_type IN ('event', 'class', 'deal', 'service'));

-- Restrict status to known values
ALTER TABLE pending_items
  ADD CONSTRAINT pending_items_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Restrict action to known values
ALTER TABLE pending_items
  ADD CONSTRAINT pending_items_action_check
  CHECK (action IN ('create', 'update', 'delete'));

-- Validate the JSONB data field has required fields and reasonable sizes
-- Title must exist and be 1-200 chars, description must be under 5000 chars
CREATE OR REPLACE FUNCTION validate_pending_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Title is required and must be reasonable length
  IF NEW.data->>'title' IS NULL OR length(NEW.data->>'title') = 0 THEN
    RAISE EXCEPTION 'Submission must include a title';
  END IF;
  IF length(NEW.data->>'title') > 200 THEN
    RAISE EXCEPTION 'Title must be under 200 characters';
  END IF;

  -- Description must be reasonable length if present
  IF NEW.data->>'description' IS NOT NULL AND length(NEW.data->>'description') > 5000 THEN
    RAISE EXCEPTION 'Description must be under 5000 characters';
  END IF;

  -- Business name must be reasonable if present
  IF NEW.data->'business'->>'name' IS NOT NULL AND length(NEW.data->'business'->>'name') > 200 THEN
    RAISE EXCEPTION 'Business name must be under 200 characters';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_pending_item_trigger
  BEFORE INSERT OR UPDATE ON pending_items
  FOR EACH ROW EXECUTE FUNCTION validate_pending_item();


-- ============================================================
-- EVENTS: Strengthen existing constraints
-- ============================================================

-- Title length limit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_title_length'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_title_length
      CHECK (length(title) > 0 AND length(title) <= 200);
  END IF;
END $$;

-- Description length limit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_description_length'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_description_length
      CHECK (description IS NULL OR length(description) <= 5000);
  END IF;
END $$;

-- Venue name length limit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_venue_name_length'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_venue_name_length
      CHECK (venue_name IS NULL OR length(venue_name) <= 200);
  END IF;
END $$;

-- start_time is already a TIME type — no regex needed


-- ============================================================
-- DEALS: Add input constraints
-- ============================================================

-- Title required and length limited
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_title_length'
  ) THEN
    ALTER TABLE deals ADD CONSTRAINT deals_title_length
      CHECK (length(title) > 0 AND length(title) <= 200);
  END IF;
END $$;

-- Description length limit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_description_length'
  ) THEN
    ALTER TABLE deals ADD CONSTRAINT deals_description_length
      CHECK (description IS NULL OR length(description) <= 5000);
  END IF;
END $$;

-- Discount value must be reasonable
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_discount_value_range'
  ) THEN
    ALTER TABLE deals ADD CONSTRAINT deals_discount_value_range
      CHECK (discount_value IS NULL OR (discount_value >= 0 AND discount_value <= 10000));
  END IF;
END $$;


-- ============================================================
-- REVIEWS: Prevent abuse
-- ============================================================

-- Rating must be 1-5
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_range'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_rating_range
      CHECK (rating >= 1 AND rating <= 5);
  END IF;
END $$;

-- Review text length limit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_content_length'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_content_length
      CHECK (content IS NULL OR length(content) <= 2000);
  END IF;
END $$;


-- ============================================================
-- MESSAGES: Prevent abuse
-- ============================================================

-- Message content length limit
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_length'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_content_length
      CHECK (length(content) > 0 AND length(content) <= 5000);
  END IF;
END $$;
