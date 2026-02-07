-- ============================================
-- PULSE APP - WELLNESS PROVIDER SEED DATA
-- Only confirmed, real Squamish clinic data
-- NULL for any field we can't verify
-- ============================================

-- Sea to Sky Massage Therapy — Confirmed JaneApp
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Kolten', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Jen', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Liz', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Taylor', 'Sea to Sky Massage Therapy', 'massage_therapy', 'janeapp', 'https://seatoskymassage.janeapp.com', 'seatoskymassage', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Shift Wellness — Confirmed JaneApp, multi-discipline
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Teri-Rose', 'Shift Wellness', 'massage_therapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Paul', 'Shift Wellness', 'massage_therapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Yuki', 'Shift Wellness', 'massage_therapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Carly', 'Shift Wellness', 'physiotherapy', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Katlyn', 'Shift Wellness', 'acupuncture', 'janeapp', 'https://squamish.janeapp.com', 'squamish', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Bliss Massage Therapy — Confirmed JaneApp (full names from booking page)
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Kim Markgraf', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Grace MacKay', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Madison Roberts', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Danielle Trachsel', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Krista Ottema', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Martine Rouleau', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Natalia Finlayson', 'Bliss Massage Therapy', 'massage_therapy', 'janeapp', 'https://bliss.janeapp.com', 'bliss', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Constellation Wellness — Confirmed JaneApp, multi-discipline
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Daniel Porcino', 'Constellation Wellness', 'massage_therapy', 'janeapp', 'https://constellationwellness.janeapp.com', 'constellationwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Elliot Godman', 'Constellation Wellness', 'massage_therapy', 'janeapp', 'https://constellationwellness.janeapp.com', 'constellationwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('McHale Whitehouse', 'Constellation Wellness', 'massage_therapy', 'janeapp', 'https://constellationwellness.janeapp.com', 'constellationwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Jennifer P', 'Constellation Wellness', 'acupuncture', 'janeapp', 'https://constellationwellness.janeapp.com', 'constellationwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- LivWell Integrated Health — Confirmed JaneApp, large multi-discipline clinic
-- Location: 1414 Winnipeg Street, Squamish
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    -- Acupuncture & Chinese Medicine
    ('Angela Bowack', 'LivWell Integrated Health', 'acupuncture', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Alison West', 'LivWell Integrated Health', 'acupuncture', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Melissa Wheaton', 'LivWell Integrated Health', 'acupuncture', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    -- Physiotherapy
    ('Lina Englund', 'LivWell Integrated Health', 'physiotherapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Lara Martin', 'LivWell Integrated Health', 'physiotherapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Claire McDonald', 'LivWell Integrated Health', 'physiotherapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Rachel Richards', 'LivWell Integrated Health', 'physiotherapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    -- Chiropractic
    ('Valerie Brabant', 'LivWell Integrated Health', 'chiropractic', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Nathaniel Janzen', 'LivWell Integrated Health', 'chiropractic', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Rylee Stephens', 'LivWell Integrated Health', 'chiropractic', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    -- Massage Therapy
    ('Lauren Billey', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Minda Johnson', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Karen Olynyk', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Rahel Ulrich', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Chantelle Groenewoud', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Amanda Lum', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL),
    ('Jenny Lister', 'LivWell Integrated Health', 'massage_therapy', 'janeapp', 'https://livwellintegratedhealth.janeapp.com', 'livwellintegratedhealth', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Emily Costa RMT — Confirmed JaneApp, solo practitioner
-- Location: 43 - 40137 Government Rd, Squamish (Garibaldi Estates, Amblepath complex)
-- Prices: $85 (30min), $115 (45min), $135 (60min), $165 (75min)
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Emily Costa', 'Emily Costa RMT', 'massage_therapy', 'janeapp', 'https://emilycosta.janeapp.com', 'emilycosta', ARRAY['holistic', 'jaw/TMJ', 'nerve', 'prenatal'], NULL, NULL, 8500, 16500, true, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Kayla Young Wellness — Confirmed JaneApp
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Kayla Young', 'Kayla Young Wellness', 'massage_therapy', 'janeapp', 'https://kaylayoungwellness.janeapp.com', 'kaylayoungwellness', NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Anchor Health & Wellness — Likely JaneApp (needs verification)
INSERT INTO pulse_wellness_providers (name, clinic_name, discipline, platform, booking_url, janeapp_slug, specialties, bio, photo_url, price_min, price_max, direct_billing, rating, review_count)
VALUES
    ('Vanessa Senecal', 'Anchor Health & Wellness', 'massage_therapy', 'janeapp', NULL, NULL, NULL, NULL, NULL, NULL, NULL, false, NULL, NULL)
ON CONFLICT DO NOTHING;
