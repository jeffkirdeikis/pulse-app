-- Protect sensitive claim fields from direct client-side modification.
-- Only service_role (used by Edge Functions) can change status and verification_code.
-- This ensures verification must go through the server-side verify-claim-code function.

CREATE OR REPLACE FUNCTION protect_claim_sensitive_fields() RETURNS TRIGGER AS $$
BEGIN
  -- Prevent direct status changes from client
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF current_setting('request.jwt.claim_role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot modify claim status directly';
    END IF;
  END IF;
  -- Prevent direct verification_code changes from client
  IF OLD.verification_code IS DISTINCT FROM NEW.verification_code THEN
    IF current_setting('request.jwt.claim_role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot modify verification code directly';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_claim_fields ON business_claims;
CREATE TRIGGER protect_claim_fields
  BEFORE UPDATE ON business_claims
  FOR EACH ROW
  EXECUTE FUNCTION protect_claim_sensitive_fields();
