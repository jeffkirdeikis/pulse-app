-- Protect claim verification flow from client-side bypass.
-- Only service_role (Edge Functions) can:
--   1. Change status FROM pending_verification (prevents skipping email verification)
--   2. Modify verification_code (prevents setting a known code)
-- Admin approve/reject (pending → verified/rejected) is allowed from client-side.

CREATE OR REPLACE FUNCTION protect_claim_sensitive_fields() RETURNS TRIGGER AS $$
BEGIN
  -- Prevent direct verification_code changes from client
  IF OLD.verification_code IS DISTINCT FROM NEW.verification_code THEN
    IF current_setting('request.jwt.claim_role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot modify verification code directly';
    END IF;
  END IF;
  -- Prevent client from changing status away from pending_verification (must go through server)
  IF OLD.status = 'pending_verification' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF current_setting('request.jwt.claim_role', true) IS DISTINCT FROM 'service_role' THEN
      RAISE EXCEPTION 'Cannot change status from pending_verification directly';
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
