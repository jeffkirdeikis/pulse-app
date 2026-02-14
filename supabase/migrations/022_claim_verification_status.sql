-- Add pending_verification to business_claims status constraint
ALTER TABLE business_claims DROP CONSTRAINT IF EXISTS business_claims_status_check;
ALTER TABLE business_claims ADD CONSTRAINT business_claims_status_check
  CHECK (status IN ('pending', 'pending_verification', 'verified', 'rejected'));
