-- Add claimed_business_id to profiles for linking users to their verified business
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS claimed_business_id uuid REFERENCES businesses(id);

-- Admin RLS policies for business_claims management
-- Admins need to see ALL claims (not just their own) and approve/reject them

CREATE POLICY "Admins can view all claims" ON business_claims
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

CREATE POLICY "Admins can update claims" ON business_claims
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
