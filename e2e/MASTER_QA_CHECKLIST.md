# MASTER QA CHECKLIST - Pulse App
## Complete Functional Verification Matrix

**CRITICAL RULE**: Every test must verify THE FEATURE WORKS, not just that elements exist.

---

## SCRAPE-001: Complete Coverage Verification

**The entire business directory (~500 businesses) MUST be scraped on EVERY run.** This section takes priority over ALL other QA checks.

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| SCRAPE-001 | All businesses attempted | Check scrape log for each business | Every business has a log entry |
| SCRAPE-002 | No silent skips | Count directory vs scrape log | Counts match exactly |
| SCRAPE-003 | Classes extracted | Query `events` by `venue_name` | Known venues have future classes |
| SCRAPE-004 | Events extracted | Query `events` for `event_type=event` | Events found |
| SCRAPE-005 | Deals extracted | Query `deals` table | Deals found |
| SCRAPE-006 | Failures documented | Check failure logs | Each has: name, URL, error, method |
| SCRAPE-007 | No stale exclusions | Check for hardcoded "skip" | Zero permanent exclusions |
| SCRAPE-008 | Booking system venues populated | Query future classes | All return >0 classes |
| SCRAPE-009 | AI-verified venues attempted | Check verified-extractor logs | All websites attempted |
| SCRAPE-010 | Post-scrape data quality | Run validation queries | No duplication, no hallucinations |

---

## BUGS FOUND LOG

Historical bugs that made it past QA. Lessons are captured in the rules sections below.

| # | Date | Bug | Root Cause | Key Lesson |
|---|------|-----|-----------|------------|
| 1 | Feb 1 | Claim form inputs not accepting typing | CSS z-index blocking | Always test inputs by actually typing |
| 2 | Feb 1 | Admin view shows nothing | `isAdmin` hardcoded false | Test all user states (guest, auth, business, admin) |
| 3 | Feb 1 | Admin edit button does nothing | Modal inside wrong view conditional | Test changes in the app, not just code review |
| 4 | Feb 1 | Edit modal inputs don't accept text | z-index/pointer-events blocking | Same bug = check ALL instances across app |
| 5 | Feb 1 | Edit modal text invisible (white on white) | No explicit `color` on inputs | Test visibility, not just that text was accepted |
| 6 | Feb 1 | Eye (view) button does nothing | `onClick={() => alert(...)}` placeholder | Click every button; alert() = placeholder |
| 7 | Feb 1 | Save changes doesn't update UI | Static data instead of dynamic state | After save, verify UI shows updated data |
| 8 | Feb 1 | `showToast` is not defined | Function used 15+ places but never defined | Verify functions exist before using them |
| 9 | Feb 1 | Supabase update silently fails | RLS blocking; `data: [], error: null` | `error: null` != success; check `data.length` |
| 10 | Feb 1 | Save button not clickable | z-index regression from input fix | Test ENTIRE flow after any CSS change |
| 11 | Feb 6 | classExists() drops valid classes | Dedup checked title+date but NOT time | Dedup ALL unique fields (title+date+time+venue) |
| 12 | Feb 6 | Booking detection != public schedule | Roundhouse had WellnessLiving but no public data | Verify booking system has public data first |
| 13 | Feb 8 | Category filters return 0 results | Checked `e.tags` (scraper metadata) not `e.category` | Every filter: spot-check 3 results match criteria |

---

## VERIFICATION STANDARDS

For each test, verify:
1. **Element exists** — Locate it
2. **Element is interactable** — Can click/type/select
3. **Element content is VISIBLE** — Text readable, not white-on-white
4. **Action produces expected result** — State changes correctly
5. **Result persists** — Changes save/persist

---

## USER STATES FOR TESTING

| State | Description | Setup Required |
|-------|-------------|----------------|
| `GUEST` | Not signed in | Fresh session |
| `AUTH` | Signed in user | Log in first |
| `BUSINESS` | Has claimed business | Claim a business |
| `ADMIN` | is_admin=true in DB | Set flag in profiles |

---

# SECTION 1: SEARCH BAR

| ID | Action | Verification Steps | Pass Criteria |
|----|--------|-------------------|---------------|
| SRCH-001 | Type in search | Click → type "yoga" → inputValue() | `value === "yoga"` |
| SRCH-002 | Search filters results | Get count → search → get new count | Count changed or results match |
| SRCH-003 | Clear button | Type → click clear → inputValue() | `value === ""` |
| SRCH-004 | Placeholder per tab | Switch to Events → check placeholder | Contains "events" |
| SRCH-005 | Paste works | Simulate paste → inputValue() | Pasted text appears |
| SRCH-006 | Special chars | Type "!@#$%" → inputValue() | Special chars present |
| SRCH-007 | Results count updates | Note count → search → read count | Count reflects filter |

---

# SECTION 2: ALL FORM INPUTS

**Every input in every form must be tested with actual typing.**

## 2.1 Auth Modal

| ID | Input | Pass Criteria |
|----|-------|---------------|
| INP-AUTH-001 | Email input | fill('test@email.com') → inputValue() returns typed email |
| INP-AUTH-002 | Password input | fill('password123') → inputValue() returns typed password |
| INP-AUTH-003 | Password type | getAttribute('type') === "password" |
| INP-AUTH-010 | Signup: Name | fill('John Doe') → inputValue() returns name |
| INP-AUTH-011 | Signup: Email | fill('new@email.com') → inputValue() returns email |
| INP-AUTH-012 | Signup: Password | fill('newpassword') → inputValue() returns password |

## 2.2 Claim Business Modal

| ID | Input | Pass Criteria |
|----|-------|---------------|
| INP-CLM-001 | Business name | click → fill('My Biz') → inputValue() returns "My Biz" |
| INP-CLM-002 | Owner name | click → fill('John Doe') → inputValue() returns name |
| INP-CLM-003 | Email | fill('test@test.com') → returns email |
| INP-CLM-004 | Phone | fill('555-1234') → returns phone |
| INP-CLM-005 | Address | fill('123 Main St') → returns address |
| INP-CLM-006 | Role dropdown | selectOption('manager') → option selected |

## 2.3 Profile Settings

| ID | Input | Pass Criteria |
|----|-------|---------------|
| INP-PROF-001 | Name field | Clear & type → inputValue() returns new name |
| INP-PROF-002 | Phone field | fill('555-9999') → returns phone |
| INP-PROF-003 | Bio textarea | fill('My bio') → returns bio |
| INP-PROF-004 | Save works | Edit → save → refresh → value persisted |

## 2.4 Submit Event/Class/Deal Modal

| ID | Input | Pass Criteria |
|----|-------|---------------|
| INP-SUB-001 | Title | fill('Event Title') → returns title |
| INP-SUB-002 | Description | fill('Description') → returns description |
| INP-SUB-003 | Category dropdown | selectOption({index: 1}) → selected |
| INP-SUB-004 | Date picker | Select date → value populated |
| INP-SUB-005 | Time picker | Select time → value populated |

## 2.5 Other Inputs

| ID | Input | Pass Criteria |
|----|-------|---------------|
| INP-MSG-001 | Message subject | fill('Question') → returns subject |
| INP-MSG-002 | Message textarea | fill('Message') → returns message |
| INP-CAL-001 | Calendar event title | fill('My Event') → returns title |
| INP-REV-001 | Review textarea | fill('Great place!') → returns review |
| INP-REV-002 | Star rating | Click 4th star → 4 stars selected |

---

# SECTION 3: MODAL FUNCTIONALITY

## 3.1 Modal Open/Close

| ID | Modal | Open | Close Methods |
|----|-------|------|---------------|
| MOD-001 | Auth | Click profile (guest) | X, overlay, ESC |
| MOD-004 | Event Detail | Click event card | X, overlay |
| MOD-006 | Deal Detail | Click deal card | X |
| MOD-007 | Service Detail | Click service card | X |
| MOD-008 | Profile | Click My Profile | X |
| MOD-009 | Calendar | Click My Calendar | X |
| MOD-010 | Submit | Click Submit Event | X |
| MOD-011 | Claim | Click Claim Business | X |

## 3.2 Modal Content

| ID | Modal | Check | Verification |
|----|-------|-------|--------------|
| MOD-020 | Event | Title present | `.textContent()` returns event title |
| MOD-022 | Event | Book button | Visible AND clickable |
| MOD-023 | Event | Save button | Clicking toggles saved state |
| MOD-024 | Deal | Business name | Present |
| MOD-025 | Deal | Redeem button | Present (auth), clicks work |
| MOD-026 | Service | Contact info | Phone/email/address visible |
| MOD-028 | Profile | Tab switching | Each tab click switches content |

---

# SECTION 4: BUTTON FUNCTIONALITY

## 4.1 Navigation

| ID | Button | Verification |
|----|--------|--------------|
| BTN-001 | Classes tab | active class, content changes |
| BTN-002 | Events tab | active class, content changes |
| BTN-003 | Deals tab | Deals grid appears |
| BTN-004 | Services tab | Services list appears |
| BTN-005 | Consumer view | Consumer view renders |
| BTN-006 | Business view | Business view or auth prompt |
| BTN-007 | Admin view | Admin panel (admin only) |

## 4.2 Card Actions

| ID | Button | Verification |
|----|--------|--------------|
| BTN-010 | Save (heart) | Icon fills, toast appears |
| BTN-011 | Unsave | Icon unfills, item unsaved |
| BTN-012 | Share | Share options appear |
| BTN-013 | Book Now | Booking sheet opens |
| BTN-014 | Card click | Detail modal opens |

## 4.3 Modal Actions

| ID | Button | Verification |
|----|--------|--------------|
| BTN-020 | Close (X) | Modal closes |
| BTN-021 | Add to Calendar | Event added, toast confirms |
| BTN-023 | Redeem Deal | Code generated, displayed |
| BTN-024 | Submit (form) | Form submits, feedback shown |

## 4.4 Profile Menu

| ID | Button | Verification |
|----|--------|--------------|
| BTN-030 | My Profile | Profile modal opens |
| BTN-031 | My Calendar | Calendar modal opens |
| BTN-032 | Saved Items | Profile > Saved tab |
| BTN-033 | Submit Event | Submit modal opens |
| BTN-034 | Claim Business | Claim modal opens |
| BTN-035 | Admin Panel | Admin panel (admin only) |
| BTN-036 | Settings | Settings tab opens |
| BTN-037 | Sign Out | User signed out |

---

# SECTION 5: COMPLETE FLOW TESTS

## 5.1 Save Item Flow
Sign in → Events tab → save event (icon fills, toast) → Profile > Saved (event listed) → remove → refresh (state persists)

## 5.2 Book Event Flow
Sign in → click event card → Book Now → booking sheet → external link (new tab) → confirm → "Yes, I booked" → My Calendar (event listed)

## 5.3 Redeem Deal Flow
Sign in → Deals tab → click deal → Redeem Deal → code generated → code copyable

## 5.4 Claim Business Flow
Sign in → Business view → Claim → fill all fields (verify typing works) → Submit → toast confirms

## 5.5 Submit Event Flow
Sign in → Submit Event → select type → select business → fill title/description → category/date/time → Submit → success

## 5.6 Admin Review Flow
Sign in as admin → Admin view → panels load → Pending tab → Approve (moves to Approved) → Reject (moves to Rejected)

---

# SECTION 6: FILTER & SEARCH CORRECTNESS

> **Critical lesson (Bug #13)**: 9 QA agents marked filters PASS because they only checked "dropdown opens" — never verified results were correct.

## 6.1 Classes Tab Filters

| ID | Filter | CORRECTNESS CHECK |
|----|--------|-------------------|
| FLT-C01 | Default state | Record baseline count |
| FLT-C02 | Category: Fitness | Spot-check 3 cards: all fitness |
| FLT-C03 | Category: Martial Arts | Spot-check 3 cards: all martial arts |
| FLT-C04 | Category: All | Count returns to baseline |
| FLT-C05 | Date: Tomorrow | Spot-check: dates show tomorrow |
| FLT-C07 | Time: 6 PM | Spot-check: all times >= 6 PM |
| FLT-C10 | Price: Free | Spot-check: prices show "Free" |
| FLT-C11 | Reset | All filters reset, baseline count |
| FLT-C12 | Combined filters | Results match BOTH criteria |
| FLT-C13 | No empty options | Every dropdown option returns >0 results |

## 6.2 Events/Deals/Services Filters

| ID | Filter | CORRECTNESS CHECK |
|----|--------|-------------------|
| FLT-E01 | Events default | Record baseline |
| FLT-E02 | Events category | Spot-check 3 cards match |
| FLT-D01 | Deals default | Record baseline |
| FLT-D02 | Deals category | Spot-check deals match |
| FLT-S01 | Services default | Record baseline |
| FLT-S02 | Services category | Spot-check services match |

## 6.3 Search Correctness

| ID | Search | CORRECTNESS CHECK |
|----|--------|-------------------|
| FLT-SH01 | "CrossFit" | All cards contain "CrossFit" |
| FLT-SH02 | "Cross" (partial) | Cards contain "Cross" |
| FLT-SH03 | "zzzxxxyyy" (no match) | Empty state message |
| FLT-SH04 | Clear search | Count matches baseline |
| FLT-SH05 | "crossfit" (case) | Same results as "CrossFit" |
| FLT-SH06 | Search + filter | Results match BOTH |

---

# SECTION 7: TOAST NOTIFICATIONS

| ID | Trigger | Expected |
|----|---------|----------|
| TST-001 | Save item | "Saved" toast, auto-dismisses |
| TST-002 | Unsave item | "Removed" toast |
| TST-003 | Profile update | "Updated" toast |
| TST-004 | Event register | "Added to calendar" toast |
| TST-005 | Deal redeem | Code display toast |
| TST-006 | Claim submit | "Submitted" toast |
| TST-007 | Error | Red error toast |
| TST-008 | Auto-dismiss | Toast disappears after ~3s |

---

# SECTION 8: ERROR STATES

| ID | Error Case | Pass Criteria |
|----|------------|---------------|
| ERR-001 | Empty email (auth) | Error message shows |
| ERR-002 | Invalid email format | Error message shows |
| ERR-003 | Short password | "Min 6 chars" error |
| ERR-004 | Wrong credentials | Login error shows |
| ERR-005 | Empty required (claim) | Validation error |
| ERR-006 | Empty title (submit) | Validation error |
| EMP-001 | No search results | "No results" message |
| EMP-002 | No saved items | "No saved items" message |
| EMP-003 | No calendar events | "No events" message |

---

# SECTION 9: KEYBOARD & ACCESSIBILITY

| ID | Check | Pass Criteria |
|----|-------|---------------|
| KEY-001 | Tab through page | Focus moves logically |
| KEY-002 | Enter on button | Button activates |
| KEY-003 | ESC on modal | Modal closes |
| KEY-004 | Focus visible | Focus ring shows |
| A11Y-002 | All interactive focusable | Nothing skipped via Tab |
| A11Y-008 | Focus trapped in modals | Tab stays within modal |
| A11Y-020 | Images have alt text | All `<img>` have meaningful `alt` |
| A11Y-021 | Inputs have labels | All have `<label>` or `aria-label` |
| A11Y-022 | Icon buttons have names | All have `aria-label` or text |
| A11Y-025 | Color contrast | WCAG AA: 4.5:1 normal, 3:1 large |

---

# SECTION 10: RESPONSIVE & VISUAL

| ID | Check | Pass Criteria |
|----|-------|---------------|
| MOB-001 | 375px: no overflow | `scrollWidth <= viewportWidth` |
| MOB-002 | 375px: modals fit | Modal within viewport |
| MOB-003 | 375px: touch works | Tap events work |
| ZOOM-003 | 150% zoom | Layout usable, scrollable |
| ZOOM-004 | 200% zoom | No horizontal overflow |
| VIS-001 | Font consistency | Same font family throughout |
| VIS-004 | No element overlap | No elements covering others |
| VIS-008 | Button styling | Consistent border-radius, padding, hover |

---

# SECTION 11: DATA INTEGRITY

| ID | Check | Pass Criteria |
|----|-------|---------------|
| DATA-001 | No unverified AI events | `source = 'ai-extracted'` count = 0 |
| DATA-003 | No hallucinated names | `title = venue_name` count = 0 |
| DATA-004 | No suspicious clustering | No single time with 50+ events |
| DATA-005 | No date duplication | No venue with ratio > 25 |
| DATA-010 | Only verified AI allowed | `scrape-with-ai.js` not used |
| DATA-014 | Dedup includes time | All `classExists` calls pass time param |
| PERS-001 | Save persists on refresh | Saved list contains item after refresh |
| PERS-003 | Profile update persists | Fields show saved values after refresh |

---

# SECTION 12: PERFORMANCE & NETWORK

| ID | Check | Pass Criteria |
|----|-------|---------------|
| PERF-001 | Initial page load | < 3 seconds |
| PERF-010 | Tab switching | < 500ms, no lag |
| PERF-013 | Modal open | < 300ms |
| PERF-015 | Scroll 100+ cards | Smooth 60fps |
| NET-001 | No failed requests on load | Zero 4xx/5xx |
| NET-002 | No failed requests on nav | Zero 4xx/5xx |
| NET-005 | Supabase queries | No single query > 2s |

---

# SECTION 13: STRESS TESTING

| ID | Check | Pass Criteria |
|----|-------|---------------|
| STRESS-001 | 10K char paste in search | No crash, graceful handling |
| STRESS-003 | Rapid tab switching (20x/5s) | No crash, correct tab renders |
| STRESS-005 | Rapid modal open/close (10x) | No duplicate modals |
| STRESS-006 | Rapid save/unsave (10x) | Final state correct |
| STRESS-008 | XSS in search | No alert fires, sanitized |
| STRESS-009 | SQL injection in search | Treated as text |

---

# SECTION 14: EXTERNAL LINKS

| ID | Check | Pass Criteria |
|----|-------|---------------|
| LINK-001 | Service websites (5 random) | Correct URL, new tab, not 404 |
| LINK-004 | Directions links | Opens Google Maps correctly |
| LINK-005 | Booking links (5 events) | Correct booking page |
| LINK-009 | External links new tab | All `target="_blank"` |
| LINK-010 | External links security | All `rel="noopener noreferrer"` |

---

## EVIDENCE FORMAT

```
[PASS] Button: "Sign Up" → Clicked → Modal opened with email/password fields
[FAIL] Button: "Sign Up" → Clicked → Nothing happened. No console errors. Handler is empty.
[PARTIAL] Button: "Sign Up" → Clicked → Modal opened but email field not focusable
[UNVERIFIED] Button: "Sign Up" → Could not test (app crashed on page load)
```

---

## TEST COUNT SUMMARY

| Section | Tests |
|---------|-------|
| Scraping Coverage | 10 |
| Search | 7 |
| Form Inputs | 25 |
| Modals | 15 |
| Buttons | 30 |
| Complete Flows | 6 flows |
| Filters & Search | 22 |
| Toasts | 8 |
| Error States | 9 |
| Keyboard & A11Y | 10 |
| Responsive & Visual | 8 |
| Data Integrity | 8 |
| Performance & Network | 7 |
| Stress Testing | 6 |
| External Links | 5 |

**TOTAL: ~170 individual verifications**
