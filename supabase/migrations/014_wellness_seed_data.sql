-- ============================================
-- PULSE APP - WELLNESS PROVIDER SEED DATA
-- Only confirmed, real Squamish clinic data
-- NULL for any field we can't verify
-- ============================================

-- Sea to Sky Massage Therapy — Confirmed JaneApp
-- Individual RMTs seeded as separate providers
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Kolten', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Jen', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Liz', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Taylor', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Shift Wellness — Confirmed JaneApp, multi-discipline
-- Location: #103-37989 Cleveland Ave
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Teri-Rose', 'Shift Wellness', 'massage_therapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Paul', 'Shift Wellness', 'massage_therapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Yuki', 'Shift Wellness', 'massage_therapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Carly', 'Shift Wellness', 'physiotherapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Katlyn', 'Shift Wellness', 'acupuncture', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Bliss Massage Therapy — Confirmed JaneApp
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Kim', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Grace', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Madison', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Danielle', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Krista', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Marti', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Constellation Wellness — Confirmed JaneApp
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Daniel', 'Constellation Wellness', 'massage_therapy', 'janeapp', 'https://constellationwellness.janeapp.com', 'constellationwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Elliot', 'Constellation Wellness', 'massage_therapy', 'janeapp', 'https://constellationwellness.janeapp.com', 'constellationwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- LivWell Integrated Health — Confirmed JaneApp, multi-discipline
-- NOTE: Exact practitioners need to be confirmed via scraping
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('LivWell RMT', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellsquamish.janeapp.com', 'livwellsquamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('LivWell Chiro', 'LivWell Integrated Health', 'chiropractic', 'janeapp', 'https://livwellsquamish.janeapp.com', 'livwellsquamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('LivWell Physio', 'LivWell Integrated Health', 'physiotherapy', 'janeapp', 'https://livwellsquamish.janeapp.com', 'livwellsquamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('LivWell Acupuncture', 'LivWell Integrated Health', 'acupuncture', 'janeapp', 'https://livwellsquamish.janeapp.com', 'livwellsquamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Emily Costa RMT — Confirmed JaneApp, solo practitioner
-- Location: Garibaldi Estates, Specialties: holistic, jaw/TMJ, nerve
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Emily Costa', 'Emily Costa RMT', 'massage_therapy', 'janeapp', 'https://emilycostamassage.janeapp.com', 'emilycostamassage', ARRAY['holistic', 'jaw/TMJ', 'nerve'], NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Kayla Young Wellness — Confirmed JaneApp
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Kayla Young', 'Kayla Young Wellness', 'massage_therapy', 'janeapp', 'https://kaylayoungwellness.janeapp.com', 'kaylayoungwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Anchor Health & Wellness — Likely JaneApp (needs verification)
-- Location: #101 - 37776 2nd Ave, Downtown Squamish
-- NOTE: janeapp_slug needs to be verified by visiting their website
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Vanessa Senecal', 'Anchor Health & Wellness', 'massage_therapy', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Ako Health — Platform needs verification
-- Location: Downtown Squamish
-- NOTE: booking_url and platform need to be verified
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Ako Health RMT', 'Ako Health', 'massage_therapy', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Ako Health Physio', 'Ako Health', 'physiotherapy', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Ako Health Acupuncture', 'Ako Health', 'acupuncture', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Peak Integrated Health — Platform needs verification
-- NOTE: booking_url and platform need to be verified
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Peak Chiro', 'Peak Integrated Health', 'chiropractic', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Peak Physio', 'Peak Integrated Health', 'physiotherapy', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Peak RMT', 'Peak Integrated Health', 'massage_therapy', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Peak Acupuncture', 'Peak Integrated Health', 'acupuncture', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- The Wellness Room — Platform needs verification, two locations
-- NOTE: Platform may not be JaneApp. Locations: Mamquam and Tantalus
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Wellness Room RMT', 'The Wellness Room', 'massage_therapy', 'other', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Wellness Room Chiro', 'The Wellness Room', 'chiropractic', 'other', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Wellness Room Acupuncture', 'The Wellness Room', 'acupuncture', 'other', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;
