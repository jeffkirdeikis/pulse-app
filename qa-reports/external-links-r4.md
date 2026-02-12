# External Links QA Report (R4)

**Date**: 2026-02-09 20:02:06
**Tester**: Automated Puppeteer Script
**App URL**: http://localhost:5173/

## Summary

| Metric | Count |
|--------|-------|
| Total Checks | 93 |
| PASS | 93 |
| FAIL | 0 |
| WARN | 0 |
| Pass Rate | 100.0% |

## Test Coverage

| Test ID | Area | Description |
|---------|------|-------------|
| LINK-001 | Services Tab | Navigate to Services tab |
| LINK-002 | Services Modal | Website link href validity |
| LINK-003 | Services Modal | Phone (tel:) link format |
| LINK-004 | Services Modal | Directions link (google.com/maps) |
| LINK-005 | Events Tab | Event booking/external links |
| LINK-006 | Events Modal | Booking link attributes |
| LINK-007 | Services Modal | Protocol check (https:// prepended) |
| LINK-008 | Deals Tab | Redeem button functionality |
| LINK-009 | All Tabs | Security: target="_blank" on external links |
| LINK-010 | All Tabs | Security: rel="noopener noreferrer" on external links |

## Detailed Results

### Passes (93)

| Test ID | Description | Details |
|---------|-------------|----------|
| LINK-001 | Navigate to Services tab | Services tab clicked |
| LINK-001 | Service modal opened for "Vertical Reality Sports" | - |
| LINK-002 | Website link href starts with http(s) | href="https://verticalreality.ca" |
| LINK-003 | Website link has target="_blank" | target="_blank" |
| LINK-004 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| LINK-005 | Call link uses tel: protocol | href="tel:6048928248" |
| LINK-006 | Call link tel: contains only digits and + | telPart="6048928248" |
| LINK-007 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Vertical%20Reality%20Sports%2..." |
| LINK-008 | Directions link has target="_blank" | - |
| LINK-009 | Directions link has rel="noopener noreferrer" | - |
| LINK-010 | Service modal opened for "Squamish Naturopathic Clinic" | - |
| LINK-011 | Website link href starts with http(s) | href="https://naturopathicclinic.com/" |
| LINK-012 | Website link has target="_blank" | target="_blank" |
| LINK-013 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| LINK-014 | Call link uses tel: protocol | href="tel:6048153322" |
| LINK-015 | Call link tel: contains only digits and + | telPart="6048153322" |
| LINK-016 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Squamish%20Naturopathic%20Cli..." |
| LINK-017 | Directions link has target="_blank" | - |
| LINK-018 | Directions link has rel="noopener noreferrer" | - |
| LINK-019 | Service modal opened for "Lil Chef Bistro" | - |
| LINK-020 | Website link href starts with http(s) | href="https://www.google.com/search?q=Lil%20Chef%20Bistro%20Squamish%20BC" |
| LINK-021 | Website link has target="_blank" | target="_blank" |
| LINK-022 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| LINK-023 | Call link uses tel: protocol | href="tel:6043902433" |
| LINK-024 | Call link tel: contains only digits and + | telPart="6043902433" |
| LINK-025 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Lil%20Chef%20Bistro%2040365%2..." |
| LINK-026 | Directions link has target="_blank" | - |
| LINK-027 | Directions link has rel="noopener noreferrer" | - |
| LINK-028 | Service modal opened for "Mocaccino Coffee" | - |
| LINK-029 | Website link href starts with http(s) | href="https://mocaccinocoffee.ca" |
| LINK-030 | Website link has target="_blank" | target="_blank" |
| LINK-031 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| LINK-032 | Call link uses tel: protocol | href="tel:6048153010" |
| LINK-033 | Call link tel: contains only digits and + | telPart="6048153010" |
| LINK-034 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Mocaccino%20Coffee%2038018%20..." |
| LINK-035 | Directions link has target="_blank" | - |
| LINK-036 | Directions link has rel="noopener noreferrer" | - |
| LINK-037 | Service modal opened for "RideHub Bike Shop & Cafe" | - |
| LINK-038 | Website link href starts with http(s) | href="https://ridehubsquamish.com" |
| LINK-039 | Website link has target="_blank" | target="_blank" |
| LINK-040 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| LINK-041 | Call link uses tel: protocol | href="tel:6048154494" |
| LINK-042 | Call link tel: contains only digits and + | telPart="6048154494" |
| LINK-043 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=RideHub%20Bike%20Shop%20%26%2..." |
| LINK-044 | Directions link has target="_blank" | - |
| LINK-045 | Directions link has rel="noopener noreferrer" | - |
| LINK-007 | Protocol check: Website URL has http(s) protocol | href="https://www.google.com/search?q=Manpuku%20Sushi%20Squamish%20BC" |
| LINK-046 | Service card #1 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| LINK-047 | Service card #2 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| LINK-048 | Service card #3 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| LINK-049 | Service card #4 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| LINK-050 | Service card #5 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| LINK-051 | Navigate to Events tab | Events tab clicked |
| LINK-052 | Event modal opened for "Wax & Wine Night 2.0" | - |
| LINK-053 | Event external link: "Directions" | href OK, target="_blank", rel includes noopener |
| LINK-054 | Event external link: "View Venue" | href OK, target="_blank", rel includes noopener |
| LINK-055 | Booking/CTA link exists for "Wax & Wine Night 2.0" | text="View Venue", href="https://www.google.com/maps/search/?api=1&query=SkiUphill%20" |
| LINK-056 | Event directions link for "Wax & Wine Night 2.0" | Points to Google Maps with proper attributes |
| LINK-057 | Event modal opened for "Winter Festival" | - |
| LINK-058 | Event external link: "Directions" | href OK, target="_blank", rel includes noopener |
| LINK-059 | Event external link: "View Venue" | href OK, target="_blank", rel includes noopener |
| LINK-060 | Booking/CTA link exists for "Winter Festival" | text="View Venue", href="https://www.google.com/maps/search/?api=1&query=Squamish%20R" |
| LINK-061 | Event directions link for "Winter Festival" | Points to Google Maps with proper attributes |
| LINK-062 | Event modal opened for "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" | - |
| LINK-063 | Event external link: "Directions" | href OK, target="_blank", rel includes noopener |
| LINK-064 | Event external link: "View Venue" | href OK, target="_blank", rel includes noopener |
| LINK-065 | Booking/CTA link exists for "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" | text="View Venue", href="https://www.google.com/maps/search/?api=1&query=Arrow%20Wood" |
| LINK-066 | Event directions link for "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" | Points to Google Maps with proper attributes |
| LINK-067 | Navigate to Deals tab | Deals tab clicked |
| LINK-068 | Deal modal opened for "Chips & Guac $10" | - |
| LINK-069 | Redeem button exists for "Chips & Guac $10" | tag=<button>, text="Redeem Deal" |
| LINK-070 | Redeem button does NOT use placeholder alert() | Has real click handler |
| LINK-071 | Redeem click did NOT trigger placeholder alert() for "Chips & Guac $10" | Real handler executed |
| LINK-072 | Redeem as guest triggers auth prompt for "Chips & Guac $10" | Auth modal appeared |
| LINK-073 | Deal modal opened for "Discount on Gelato at 2 Chill Gelato" | - |
| LINK-074 | Redeem button exists for "Discount on Gelato at 2 Chill Gelato" | tag=<button>, text="Redeem Deal" |
| LINK-075 | Redeem button does NOT use placeholder alert() | Has real click handler |
| LINK-076 | Redeem click did NOT trigger placeholder alert() for "Discount on Gelato at 2 Chill Gelato" | Real handler executed |
| LINK-077 | Redeem as guest triggers auth prompt for "Discount on Gelato at 2 Chill Gelato" | Auth modal appeared |
| LINK-078 | Deal modal opened for "Save 20% on baby basics" | - |
| LINK-079 | Redeem button exists for "Save 20% on baby basics" | tag=<button>, text="Redeem Deal" |
| LINK-080 | Redeem button does NOT use placeholder alert() | Has real click handler |
| LINK-081 | Redeem click did NOT trigger placeholder alert() for "Save 20% on baby basics" | Real handler executed |
| LINK-082 | Redeem as guest triggers auth prompt for "Save 20% on baby basics" | Auth modal appeared |
| LINK-009 | All 665 external links on Services page have target="_blank" | - |
| LINK-010 | All 665 external links on Services page have rel="noopener noreferrer" | - |
| LINK-083 | Events page: All external links have proper security attributes | - |
| LINK-084 | Deals page: All external links have proper security attributes | - |
| LINK-085 | Class booking link for "Hot Tone & Sculpt" | href="https://www.google.com/search?q=Oxygen%20Yoga%20%26%20Fitnes", text="Book Class" |
| LINK-086 | Class booking link for "Hot Tone & Sculpt" | href="https://www.google.com/maps/search/?api=1&query=Oxygen%20Yog", text="View Venue" |
| LINK-087 | Class booking link for "Hot One HIIT Wonder" | href="https://www.google.com/search?q=Breathe%20Fitness%20Studio%2", text="Book Class" |
| LINK-088 | Class booking link for "Hot One HIIT Wonder" | href="https://www.google.com/maps/search/?api=1&query=Breathe%20Fi", text="View Venue" |
| LINK-089 | No console errors during external links testing | - |

## All Results (Chronological)

| # | Status | Test ID | Description | Details |
|---|--------|---------|-------------|----------|
| 1 | PASS | LINK-001 | Navigate to Services tab | Services tab clicked |
| 2 | PASS | LINK-001 | Service modal opened for "Vertical Reality Sports" | - |
| 3 | PASS | LINK-002 | Website link href starts with http(s) | href="https://verticalreality.ca" |
| 4 | PASS | LINK-003 | Website link has target="_blank" | target="_blank" |
| 5 | PASS | LINK-004 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| 6 | PASS | LINK-005 | Call link uses tel: protocol | href="tel:6048928248" |
| 7 | PASS | LINK-006 | Call link tel: contains only digits and + | telPart="6048928248" |
| 8 | PASS | LINK-007 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Vertical%20Reality%20Sports%2..." |
| 9 | PASS | LINK-008 | Directions link has target="_blank" | - |
| 10 | PASS | LINK-009 | Directions link has rel="noopener noreferrer" | - |
| 11 | PASS | LINK-010 | Service modal opened for "Squamish Naturopathic Clinic" | - |
| 12 | PASS | LINK-011 | Website link href starts with http(s) | href="https://naturopathicclinic.com/" |
| 13 | PASS | LINK-012 | Website link has target="_blank" | target="_blank" |
| 14 | PASS | LINK-013 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| 15 | PASS | LINK-014 | Call link uses tel: protocol | href="tel:6048153322" |
| 16 | PASS | LINK-015 | Call link tel: contains only digits and + | telPart="6048153322" |
| 17 | PASS | LINK-016 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Squamish%20Naturopathic%20Cli..." |
| 18 | PASS | LINK-017 | Directions link has target="_blank" | - |
| 19 | PASS | LINK-018 | Directions link has rel="noopener noreferrer" | - |
| 20 | PASS | LINK-019 | Service modal opened for "Lil Chef Bistro" | - |
| 21 | PASS | LINK-020 | Website link href starts with http(s) | href="https://www.google.com/search?q=Lil%20Chef%20Bistro%20Squamish%20BC" |
| 22 | PASS | LINK-021 | Website link has target="_blank" | target="_blank" |
| 23 | PASS | LINK-022 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| 24 | PASS | LINK-023 | Call link uses tel: protocol | href="tel:6043902433" |
| 25 | PASS | LINK-024 | Call link tel: contains only digits and + | telPart="6043902433" |
| 26 | PASS | LINK-025 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Lil%20Chef%20Bistro%2040365%2..." |
| 27 | PASS | LINK-026 | Directions link has target="_blank" | - |
| 28 | PASS | LINK-027 | Directions link has rel="noopener noreferrer" | - |
| 29 | PASS | LINK-028 | Service modal opened for "Mocaccino Coffee" | - |
| 30 | PASS | LINK-029 | Website link href starts with http(s) | href="https://mocaccinocoffee.ca" |
| 31 | PASS | LINK-030 | Website link has target="_blank" | target="_blank" |
| 32 | PASS | LINK-031 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| 33 | PASS | LINK-032 | Call link uses tel: protocol | href="tel:6048153010" |
| 34 | PASS | LINK-033 | Call link tel: contains only digits and + | telPart="6048153010" |
| 35 | PASS | LINK-034 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=Mocaccino%20Coffee%2038018%20..." |
| 36 | PASS | LINK-035 | Directions link has target="_blank" | - |
| 37 | PASS | LINK-036 | Directions link has rel="noopener noreferrer" | - |
| 38 | PASS | LINK-037 | Service modal opened for "RideHub Bike Shop & Cafe" | - |
| 39 | PASS | LINK-038 | Website link href starts with http(s) | href="https://ridehubsquamish.com" |
| 40 | PASS | LINK-039 | Website link has target="_blank" | target="_blank" |
| 41 | PASS | LINK-040 | Website link has rel="noopener noreferrer" | rel="noopener noreferrer" |
| 42 | PASS | LINK-041 | Call link uses tel: protocol | href="tel:6048154494" |
| 43 | PASS | LINK-042 | Call link tel: contains only digits and + | telPart="6048154494" |
| 44 | PASS | LINK-043 | Directions link points to google.com/maps | href="https://www.google.com/maps/dir/?api=1&destination=RideHub%20Bike%20Shop%20%26%2..." |
| 45 | PASS | LINK-044 | Directions link has target="_blank" | - |
| 46 | PASS | LINK-045 | Directions link has rel="noopener noreferrer" | - |
| 47 | PASS | LINK-007 | Protocol check: Website URL has http(s) protocol | href="https://www.google.com/search?q=Manpuku%20Sushi%20Squamish%20BC" |
| 48 | PASS | LINK-046 | Service card #1 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| 49 | PASS | LINK-047 | Service card #2 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| 50 | PASS | LINK-048 | Service card #3 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| 51 | PASS | LINK-049 | Service card #4 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| 52 | PASS | LINK-050 | Service card #5 inline map link | href points to google.com/maps, target="_blank", rel="noopener noreferrer" |
| 53 | PASS | LINK-051 | Navigate to Events tab | Events tab clicked |
| 54 | PASS | LINK-052 | Event modal opened for "Wax & Wine Night 2.0" | - |
| 55 | PASS | LINK-053 | Event external link: "Directions" | href OK, target="_blank", rel includes noopener |
| 56 | PASS | LINK-054 | Event external link: "View Venue" | href OK, target="_blank", rel includes noopener |
| 57 | PASS | LINK-055 | Booking/CTA link exists for "Wax & Wine Night 2.0" | text="View Venue", href="https://www.google.com/maps/search/?api=1&query=SkiUphill%20" |
| 58 | PASS | LINK-056 | Event directions link for "Wax & Wine Night 2.0" | Points to Google Maps with proper attributes |
| 59 | PASS | LINK-057 | Event modal opened for "Winter Festival" | - |
| 60 | PASS | LINK-058 | Event external link: "Directions" | href OK, target="_blank", rel includes noopener |
| 61 | PASS | LINK-059 | Event external link: "View Venue" | href OK, target="_blank", rel includes noopener |
| 62 | PASS | LINK-060 | Booking/CTA link exists for "Winter Festival" | text="View Venue", href="https://www.google.com/maps/search/?api=1&query=Squamish%20R" |
| 63 | PASS | LINK-061 | Event directions link for "Winter Festival" | Points to Google Maps with proper attributes |
| 64 | PASS | LINK-062 | Event modal opened for "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" | - |
| 65 | PASS | LINK-063 | Event external link: "Directions" | href OK, target="_blank", rel includes noopener |
| 66 | PASS | LINK-064 | Event external link: "View Venue" | href OK, target="_blank", rel includes noopener |
| 67 | PASS | LINK-065 | Booking/CTA link exists for "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" | text="View Venue", href="https://www.google.com/maps/search/?api=1&query=Arrow%20Wood" |
| 68 | PASS | LINK-066 | Event directions link for "Magic: The Gathering - Casual Commander Night @ Arrow Wood Games" | Points to Google Maps with proper attributes |
| 69 | PASS | LINK-067 | Navigate to Deals tab | Deals tab clicked |
| 70 | PASS | LINK-068 | Deal modal opened for "Chips & Guac $10" | - |
| 71 | PASS | LINK-069 | Redeem button exists for "Chips & Guac $10" | tag=<button>, text="Redeem Deal" |
| 72 | PASS | LINK-070 | Redeem button does NOT use placeholder alert() | Has real click handler |
| 73 | PASS | LINK-071 | Redeem click did NOT trigger placeholder alert() for "Chips & Guac $10" | Real handler executed |
| 74 | PASS | LINK-072 | Redeem as guest triggers auth prompt for "Chips & Guac $10" | Auth modal appeared |
| 75 | PASS | LINK-073 | Deal modal opened for "Discount on Gelato at 2 Chill Gelato" | - |
| 76 | PASS | LINK-074 | Redeem button exists for "Discount on Gelato at 2 Chill Gelato" | tag=<button>, text="Redeem Deal" |
| 77 | PASS | LINK-075 | Redeem button does NOT use placeholder alert() | Has real click handler |
| 78 | PASS | LINK-076 | Redeem click did NOT trigger placeholder alert() for "Discount on Gelato at 2 Chill Gelato" | Real handler executed |
| 79 | PASS | LINK-077 | Redeem as guest triggers auth prompt for "Discount on Gelato at 2 Chill Gelato" | Auth modal appeared |
| 80 | PASS | LINK-078 | Deal modal opened for "Save 20% on baby basics" | - |
| 81 | PASS | LINK-079 | Redeem button exists for "Save 20% on baby basics" | tag=<button>, text="Redeem Deal" |
| 82 | PASS | LINK-080 | Redeem button does NOT use placeholder alert() | Has real click handler |
| 83 | PASS | LINK-081 | Redeem click did NOT trigger placeholder alert() for "Save 20% on baby basics" | Real handler executed |
| 84 | PASS | LINK-082 | Redeem as guest triggers auth prompt for "Save 20% on baby basics" | Auth modal appeared |
| 85 | PASS | LINK-009 | All 665 external links on Services page have target="_blank" | - |
| 86 | PASS | LINK-010 | All 665 external links on Services page have rel="noopener noreferrer" | - |
| 87 | PASS | LINK-083 | Events page: All external links have proper security attributes | - |
| 88 | PASS | LINK-084 | Deals page: All external links have proper security attributes | - |
| 89 | PASS | LINK-085 | Class booking link for "Hot Tone & Sculpt" | href="https://www.google.com/search?q=Oxygen%20Yoga%20%26%20Fitnes", text="Book Class" |
| 90 | PASS | LINK-086 | Class booking link for "Hot Tone & Sculpt" | href="https://www.google.com/maps/search/?api=1&query=Oxygen%20Yog", text="View Venue" |
| 91 | PASS | LINK-087 | Class booking link for "Hot One HIIT Wonder" | href="https://www.google.com/search?q=Breathe%20Fitness%20Studio%2", text="Book Class" |
| 92 | PASS | LINK-088 | Class booking link for "Hot One HIIT Wonder" | href="https://www.google.com/maps/search/?api=1&query=Breathe%20Fi", text="View Venue" |
| 93 | PASS | LINK-089 | No console errors during external links testing | - |
