-- ============================================================
-- Migration 025: Restrict profiles table RLS policy
-- ============================================================
--
-- SECURITY FIX: The original policy "Profiles are viewable by everyone"
-- (from migration 002) used USING(true), allowing anonymous/unauthenticated
-- users to read ALL profile data including emails and is_admin flags.
--
-- This migration replaces it with authenticated-only access.
-- All client-side profile reads happen after authentication, so this
-- won't break any existing functionality.
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

-- Authenticated users can read all profiles (needed for social features:
-- reviews, messaging, leaderboard display names, etc.)
CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');
