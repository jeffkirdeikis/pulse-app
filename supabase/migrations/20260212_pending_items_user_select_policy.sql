-- Fix: Allow authenticated users to read their own submissions from pending_items.
-- Without this policy, the .select() after .insert() in useSubmissions.js fails
-- because non-admin users have INSERT but not SELECT permission, causing the app
-- to show "Failed to submit" even though the data was successfully inserted.

CREATE POLICY "Users can view own submissions"
ON pending_items FOR SELECT
USING (submitted_by = auth.uid());
