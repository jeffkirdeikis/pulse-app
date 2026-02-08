-- Admin RLS policies for events and deals tables
-- Allows admin users (profiles.is_admin = true) to INSERT, UPDATE, DELETE events and deals
-- Non-admin authenticated users can INSERT events/deals (for submission flow)

-- ============================================================
-- EVENTS TABLE: Admin full CRUD + authenticated INSERT
-- ============================================================

-- Admin can insert events (e.g., Quick Add, approval flow)
CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin can update events (e.g., edit event modal)
CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin can delete events
CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================
-- DEALS TABLE: Admin full CRUD
-- ============================================================

-- Admin can insert deals (e.g., deal approval flow)
CREATE POLICY "Admins can insert deals"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin can update deals
CREATE POLICY "Admins can update deals"
  ON deals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin can delete deals
CREATE POLICY "Admins can delete deals"
  ON deals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================================
-- PENDING_ITEMS TABLE: Ensure admin can manage submissions
-- ============================================================

-- Admin can insert pending items (if not already allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_items' AND policyname = 'Admins can manage pending items'
  ) THEN
    CREATE POLICY "Admins can manage pending items"
      ON pending_items FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- Authenticated users can insert pending items (submission flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_items' AND policyname = 'Authenticated users can submit items'
  ) THEN
    CREATE POLICY "Authenticated users can submit items"
      ON pending_items FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;
