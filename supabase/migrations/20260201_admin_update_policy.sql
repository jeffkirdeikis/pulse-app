-- Migration: Allow admins to update businesses
-- Run this in Supabase Dashboard > SQL Editor if migration doesn't work

-- First, check if the policy already exists and drop it
DROP POLICY IF EXISTS "Admins can update businesses" ON businesses;

-- Create policy to allow admins to update any business
CREATE POLICY "Admins can update businesses" ON businesses
FOR UPDATE
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

-- Verify the policy was created
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'businesses';
