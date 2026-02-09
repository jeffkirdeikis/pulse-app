# MASTER QA CHECKLIST - Pulse App
## Complete Functional Verification Matrix

**CRITICAL RULE**: Every test must verify THE FEATURE WORKS, not just that elements exist.

**⚠️ KEEP IN SYNC WITH CLAUDE.md**: Every lesson learned here MUST also be added to `/CLAUDE.md`. These documents must always contain the same QA rules.

---

## BUGS FOUND LOG

This section tracks bugs that made it past QA and the lessons learned.

### Bug #1: Claim Form Inputs Not Accepting Typing
- **Date**: 2026-02-01
- **Reported By**: User screenshot
- **Root Cause**: CSS z-index issue blocking inputs
- **Why Missed**: Tests checked `.toBeVisible()` but never called `.fill()` + `.inputValue()`
- **Fix**: Added z-index CSS fix
- **Test Added**: `e2e/input-functionality.spec.js` - all inputs now tested with actual typing
- **Lesson**: ALWAYS test inputs by actually typing in them

### Bug #2: Admin View Shows Nothing
- **Date**: 2026-02-01
- **Reported By**: User screenshot
- **Root Cause**: `isAdmin` hardcoded to `false` in useUserData.js
- **Why Missed**: No test for admin user state, no database flag
- **Fix**: Updated useUserData.js to read `is_admin` from DB, added column to profiles
- **Test Added**: `e2e/admin-panel.spec.js` - admin panel content tests
- **Lesson**: Test with ALL user states (guest, auth, business, admin)

### Bug #3: Admin Edit Button Does Nothing
- **Date**: 2026-02-01
- **Reported By**: User
- **Root Cause**: Modal was placed inside `{view === 'consumer' && (...)}` but the edit button was inside `{view === 'admin' && (...)}`. Modal wasn't rendered in admin view.
- **Why Missed**: I claimed it was fixed without actually testing it in the app
- **Fix**: Moved Edit Venue Modal to global section (outside all view conditionals)
- **Lesson**:
  1. ACTUALLY TEST CHANGES BEFORE CLAIMING THEY WORK
  2. Modals that can be triggered from multiple views must be placed outside view conditionals
  3. When adding onClick handlers, verify the target component is actually rendered in that context

### Bug #4: Edit Business Modal Inputs Don't Accept Text
- **Date**: 2026-02-01
- **Reported By**: User screenshot
- **Root Cause**: CSS z-index/pointer-events issues blocking input interaction in modals
- **Why Missed**: Same bug pattern as Bug #1 - I didn't test by actually typing in the inputs after fixing Bug #3
- **Fix**: Added global CSS rule for all modal inputs with `pointer-events: auto !important; z-index: 100 !important; user-select: text !important`
- **Also Fixed**: All other input CSS rules across the app (auth-form-group, form-field, form-field-admin, setting-info, claim-form-group)
- **Test Added**: None yet - need to run actual e2e tests with typing
- **Lesson**:
  1. **SAME BUG = SAME FIX ACROSS ENTIRE APP** - When a pattern breaks once, check ALL instances
  2. After ANY modal fix, ALWAYS test by actually typing in inputs
  3. Add defensive CSS globally for all modal inputs to prevent this class of bugs

### Bug #5: Edit Business Modal Text Invisible (White on White)
- **Date**: 2026-02-01
- **Reported By**: User screenshot showing faint/invisible text in input fields
- **Root Cause**: CSS rules didn't specify `color` property for inputs, text inherited white/transparent color
- **Why Missed**: I tested that inputs ACCEPT text but didn't verify the text was VISIBLE (readable color)
- **Fix**: Added `color: #1f2937 !important;` and `background: #fff !important;` to global modal input CSS rule
- **Also Fixed**: `.auth-form-group input`, `.claim-form-group input` - added explicit dark text color
- **Lesson**:
  1. **INPUTS MUST BE TESTED FOR VISIBILITY** - Text appearing is not the same as text being readable
  2. Always specify `color` and `background` explicitly in form input CSS
  3. After typing in an input, visually confirm you can READ the text

### Bug #6: Eye (View) Button Does Nothing
- **Date**: 2026-02-01
- **Reported By**: User
- **Root Cause**: Button had `onClick={() => alert(...)}` - PLACEHOLDER CODE, not real functionality
- **Why Missed**: I never clicked the button. Tests checked element existence, not functionality.
- **Fix**: Changed to `onClick={() => setSelectedService(venue)}` to open the detail modal
- **Lesson**:
  1. **CLICK EVERY BUTTON** - Checking existence is NOT testing functionality
  2. **alert() = PLACEHOLDER** - Any onClick with alert() is not working code
  3. **SEARCH FOR PLACEHOLDERS** before marking complete: `grep -n "alert\|console.log" src/App.jsx`

### Bug #7: Save Changes Doesn't Update UI
- **Date**: 2026-02-01
- **Reported By**: User
- **Root Cause**: Admin panel used static `REAL_DATA.venues` instead of dynamic `services` from Supabase
- **Fix**: Changed to use `services` state, added `fetchServices()` after save
- **Lesson**: After save, verify UI shows updated data

### Bug #13: Category Filters Return 0 Results (Data Mismatch)
- **Date**: 2026-02-08
- **Reported By**: User
- **Root Cause**: Filter checked `e.tags.includes(category)` but `tags` contained scraper metadata (`["auto-scraped", "mindbody-classic"]`) not category names. The actual category was in a separate `category` DB field that was never mapped to the frontend event objects.
- **Why Missed**: **9 QA agents and 1000+ checks all missed this** because they verified "dropdown opens, has options, doesn't crash" but never verified "selecting Fitness shows only fitness results." This is the most dangerous QA gap: features that APPEAR to work but produce WRONG data.
- **Fix**:
  1. Added `category` field to mapped DB events from `event.category`
  2. Changed filter to check `e.category` (with `e.tags` fallback for static data)
  3. Generated categories dynamically from actual data per section
  4. Normalized lowercase categories
  5. Reset category filter when switching tabs
  6. Fixed truncated filter text (CSS grid 3→2 columns)
- **Lesson**:
  1. **EXISTENCE ≠ CORRECTNESS** — A filter that opens and has options is NOT a working filter. You must verify the filtered results are actually correct.
  2. **Every filter must be tested with data verification**: select an option, then spot-check 3 visible results to confirm they match the filter criteria.
  3. **Every dropdown option must produce >0 results** — if an option shows 0 results, it shouldn't exist in the dropdown.
  4. **Test data layer, not just UI layer** — the `tags` field looked like categories in REAL_DATA but was scraper metadata in the DB. Always verify what the actual database data looks like.

### COMPREHENSIVE QA AUDIT (2026-02-01)

5 QA agents tested the entire app simultaneously. Here are ALL bugs found:

| Bug | Location | Issue | Status |
|-----|----------|-------|--------|
| Delete venue button | Line 15112 | `confirm()` ignored result | FIXED |
| Submit Event button | Line 11852 | No onClick handler | FIXED |
| Delete Account button | Line 13571 | No onClick handler | FIXED |
| Create Deal button | Lines 13341, 14364 | No onClick handler | FIXED |
| Edit Profile button | Lines 13346, 14369 | No onClick handler | FIXED |
| Admin tabs | Lines 13959-13967 | No onClick handlers, can't switch tabs | FIXED |
| Time period buttons | Lines 14188-14191 | No onClick handlers | FIXED |
| Logo upload | Line 14101 | Shows alert() placeholder | FIXED (shows toast) |
| ESC key close | All modals | No keydown listener | FIXED |
| Mobile overlap | CSS | View switcher covers profile button | FIXED |
| Error alerts | Lines 8775, 8919, 8971, 9048 | Use alert() instead of toast | FIXED |
| Save Changes (admin) | Line 15351 | `showToast` was never defined | FIXED |

### Bug #8: showToast is not defined
- **Date**: 2026-02-01
- **Symptom**: Save Changes button clicked, Supabase update succeeded (data: [], error: null), then ReferenceError
- **Root Cause**: `showToast()` function was USED throughout the app but NEVER DEFINED
- **Why Missed**: Code looked correct, assumed showToast existed because it was used in 15+ places
- **Fix**: Added `showToast` helper function that wraps `setCalendarToastMessage`
- **Lesson**: When using a function, verify it's actually defined - check for `const showToast = ` or `function showToast`

### Bug #9: Supabase update silently fails (RLS blocking)
- **Date**: 2026-02-01
- **Symptom**: Save Changes clicked, toast shows "success", but data doesn't change
- **Root Cause**: Supabase RLS (Row Level Security) blocked the update. Response was `data: [], error: null`
- **Why Missed**:
  1. Saw `error: null` and assumed success
  2. Didn't verify data ACTUALLY CHANGED
  3. Didn't check if `data` array was empty
- **Fix**:
  1. Added check: `if (!data || data.length === 0)` shows "Update blocked" error
  2. Need RLS policy in Supabase: "Admins can update businesses"
- **Lesson**:
  - `error: null` does NOT mean success - ALWAYS check if `data` has items
  - After ANY database write, VERIFY the data actually changed
  - Supabase RLS can silently block operations

### Bug #10: Save button not clickable (z-index regression)
- **Date**: 2026-02-01
- **Symptom**: Save Changes button couldn't be clicked in Edit Business modal
- **Root Cause**: Added `z-index: 100` to inputs but buttons had no z-index, so inputs covered buttons
- **Why Missed**: Deployed without testing entire modal flow - only tested input visibility
- **Fix**: Added global CSS for modal buttons: `z-index: 200 !important; pointer-events: auto !important`
- **CRITICAL LESSON**: After ANY deployment, test:
  1. The specific feature changed
  2. ALL related features (modals, forms, buttons)
  3. The ENTIRE user flow (open → interact → submit → close)
  4. Check browser console
  5. CLICK every button, TYPE in every input

**KEY LESSON**: Many buttons in the app have NO onClick handlers or use alert() as placeholders. Before marking any feature complete, search for these patterns.

### Bug #11: classExists() Dedup Drops Valid Classes
- **Date**: 2026-02-06
- **Symptom**: Wild Life Gym only showed ~4 classes/day instead of ~8. 50%+ of classes missing.
- **Root Cause**: `classExists()` in all 6 scraper files checked only `title + date + venue_name` — not `start_time`. Same-title classes at different times (e.g., "Train Wild" at 7:45 AM, 9:00 AM, 10:15 AM) were falsely flagged as duplicates.
- **Why Missed**: The dedup logic was never tested with studios that run the same class multiple times per day.
- **Fix**: Added `start_time` to `classExists()` query in all 6 scraper files.
- **Impact**: Class count jumped from 720 to 2,003 across all venues.
- **CRITICAL LESSON**: Dedup functions MUST include ALL fields that make a record unique. For scraper classes: `title + date + time + venue`.

### Bug #12: Booking System Detection ≠ Public Schedule
- **Date**: 2026-02-06
- **Symptom**: Roundhouse Martial Arts detected as WellnessLiving, but scraper returned 0 classes.
- **Root Cause**: Roundhouse has a WellnessLiving account but hasn't configured a public schedule — page shows "There are no classes today" for every day.
- **Why Missed**: Assumed detecting a booking system meant public data was available.
- **Fix**: Commented out Roundhouse from WellnessLiving scraper until schedule is configured.
- **LESSON**: Always verify a detected booking system actually has public data before adding to scrapers. Visit the schedule URL manually and confirm classes appear.

---

## CRITICAL QA RULES (Synced with CLAUDE.md)

### MANDATORY TESTS FOR EVERY FEATURE

| Feature Type | MUST Test |
|--------------|-----------|
| **Button** | CLICK it, verify action happens (not alert/console.log) |
| **Input** | TYPE in it, verify text appears AND is visible |
| **Modal** | OPEN it, verify content, CLOSE it (X, overlay, ESC) |
| **Save/Submit** | Submit → verify toast → verify UI updates → **verify data.length > 0** → verify DB |
| **Form** | Fill ALL fields → submit → verify data persists |
| **New Function** | Verify function is DEFINED (`grep "const funcName"`) before using it |
| **Error Handling** | Check browser console for runtime errors after every action |

### SEARCH FOR PLACEHOLDER CODE AND UNDEFINED FUNCTIONS

Before marking ANY feature complete:
```bash
# Find placeholder alerts
grep -n "alert\|console.log\|TODO\|FIXME" src/App.jsx | grep -v "showToast\|console.error"

# Find buttons without onClick
grep -n "<button.*>" src/App.jsx | grep -v "onClick"

# CRITICAL: Verify functions are DEFINED not just USED
# If you use functionName(), search for its definition:
grep -n "const functionName\|function functionName" src/App.jsx
# Empty result = function doesn't exist = RUNTIME CRASH
```

**RED FLAGS:**
- `alert()` in onClick = PLACEHOLDER, not working
- `<button>` without onClick = DOES NOTHING
- Function used but grep returns nothing = UNDEFINED, WILL CRASH

### NEVER SKIP QA

If you cannot test something:
1. Do NOT claim it's fixed
2. Document what you cannot test and WHY
3. Tell the user so we can test together
4. Find a way to test it yourself (screenshot, test script)

---

## VERIFICATION STANDARDS

For each test, you must verify:
1. **Element exists** - Locate the element
2. **Element is interactable** - Can click/type/select
3. **Element content is VISIBLE** - Text is readable (not white on white, not transparent)
4. **Action produces expected result** - State changes correctly
5. **Result persists** - Changes save/persist appropriately

**Example of BAD test:**
```javascript
// WRONG: Only checks existence
await expect(page.locator('input[name="email"]')).toBeVisible();
```

**Example of GOOD test:**
```javascript
// CORRECT: Verifies it actually works
const input = page.locator('input[name="email"]');
await input.click();
await input.fill('test@example.com');
const value = await input.inputValue();
expect(value).toBe('test@example.com');
```

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

## 1.1 Search Input Functionality

| ID | Action | Verification Steps | Pass Criteria |
|----|--------|-------------------|---------------|
| SRCH-001 | Type in search | 1. Click input<br>2. Type "yoga"<br>3. Get inputValue() | `value === "yoga"` |
| SRCH-002 | Search filters results | 1. Get initial count<br>2. Type search term<br>3. Get new count | Count changed or results match query |
| SRCH-003 | Clear button clears | 1. Type text<br>2. Click clear<br>3. Get inputValue() | `value === ""` |
| SRCH-004 | Placeholder changes per tab | 1. Switch to Events<br>2. Check placeholder | Contains "events" |
| SRCH-005 | Paste works | 1. Simulate paste<br>2. Get inputValue() | Pasted text appears |
| SRCH-006 | Special chars work | 1. Type "!@#$%"<br>2. Get inputValue() | Special chars present |
| SRCH-007 | Results count updates | 1. Note initial count<br>2. Search<br>3. Read count | Count reflects filter |

---

# SECTION 2: ALL FORM INPUTS (CRITICAL)

**Every input in every form must be tested with actual typing.**

## 2.1 Auth Modal - Sign In

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-AUTH-001 | Email input | 1. Click input<br>2. `fill('test@email.com')`<br>3. `inputValue()` | Returns typed email |
| INP-AUTH-002 | Password input | 1. Click input<br>2. `fill('password123')`<br>3. `inputValue()` | Returns typed password |
| INP-AUTH-003 | Input type=password | Check `getAttribute('type')` | `type === "password"` |

## 2.2 Auth Modal - Sign Up

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-AUTH-010 | Name input | 1. Switch to signup<br>2. `fill('John Doe')`<br>3. `inputValue()` | Returns typed name |
| INP-AUTH-011 | Email input | 1. `fill('new@email.com')`<br>2. `inputValue()` | Returns typed email |
| INP-AUTH-012 | Password input | 1. `fill('newpassword')`<br>2. `inputValue()` | Returns typed password |

## 2.3 Claim Business Modal (Previously Failed)

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-CLM-001 | Business name | 1. Open claim modal<br>2. Find input<br>3. `click()`<br>4. `fill('My Biz')`<br>5. `inputValue()` | Returns "My Biz" |
| INP-CLM-002 | Owner name | 1. Find name input<br>2. `click()`<br>3. `fill('John Doe')`<br>4. `inputValue()` | Returns "John Doe" |
| INP-CLM-003 | Email | 1. Find email input<br>2. `click()`<br>3. `fill('test@test.com')`<br>4. `inputValue()` | Returns email |
| INP-CLM-004 | Phone | 1. Find phone input<br>2. `click()`<br>3. `fill('555-1234')`<br>4. `inputValue()` | Returns phone |
| INP-CLM-005 | Address | 1. Find address input<br>2. `click()`<br>3. `fill('123 Main St')`<br>4. `inputValue()` | Returns address |
| INP-CLM-006 | Role dropdown | 1. Find select<br>2. `selectOption('manager')`<br>3. Check value | Option selected |

## 2.4 Profile Settings

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-PROF-001 | Name field | 1. Navigate to settings<br>2. Clear & type new name<br>3. `inputValue()` | Returns new name |
| INP-PROF-002 | Phone field | 1. `fill('555-9999')`<br>2. `inputValue()` | Returns phone |
| INP-PROF-003 | Bio textarea | 1. `fill('My bio text')`<br>2. `inputValue()` | Returns bio |
| INP-PROF-004 | Save works | 1. Edit field<br>2. Click save<br>3. Refresh<br>4. Check value | Value persisted |

## 2.5 Submit Event/Class/Deal Modal

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-SUB-001 | Title input | 1. `fill('Event Title')`<br>2. `inputValue()` | Returns title |
| INP-SUB-002 | Description textarea | 1. `fill('Description text')`<br>2. `inputValue()` | Returns description |
| INP-SUB-003 | Category dropdown | 1. `selectOption({ index: 1 })`<br>2. Check value | Option selected |
| INP-SUB-004 | Date picker | 1. Open picker<br>2. Select date<br>3. Check value | Date populated |
| INP-SUB-005 | Time picker | 1. Select time<br>2. Check value | Time populated |

## 2.6 Contact/Message Forms

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-MSG-001 | Subject input | 1. `fill('Question')`<br>2. `inputValue()` | Returns subject |
| INP-MSG-002 | Message textarea | 1. `fill('Message body')`<br>2. `inputValue()` | Returns message |

## 2.7 Add Event (Personal Calendar)

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-CAL-001 | Event title | 1. `fill('My Event')`<br>2. `inputValue()` | Returns title |
| INP-CAL-002 | Description | 1. `fill('Details')`<br>2. `inputValue()` | Returns details |

## 2.8 Review Form

| ID | Input | Verification Steps | Pass Criteria |
|----|-------|-------------------|---------------|
| INP-REV-001 | Review textarea | 1. `fill('Great place!')`<br>2. `inputValue()` | Returns review |
| INP-REV-002 | Star rating | 1. Click 4th star<br>2. Check rating state | 4 stars selected |

---

# SECTION 3: MODAL FUNCTIONALITY

## 3.1 Modal Open/Close

| ID | Modal | Open | Close | Verification |
|----|-------|------|-------|--------------|
| MOD-001 | Auth | Click profile (guest) | Click X | Modal removed from DOM or hidden |
| MOD-002 | Auth | Click profile | Click overlay | Modal closes |
| MOD-003 | Auth | Click profile | Press ESC | Modal closes |
| MOD-004 | Event Detail | Click event card | Click X | Modal closes |
| MOD-005 | Event Detail | Click card | Click overlay | Modal closes |
| MOD-006 | Deal Detail | Click deal card | Click X | Modal closes |
| MOD-007 | Service Detail | Click service card | Click X | Modal closes |
| MOD-008 | Profile | Click My Profile | Click X | Modal closes |
| MOD-009 | Calendar | Click My Calendar | Click X | Modal closes |
| MOD-010 | Submit | Click Submit Event | Click X | Modal closes |
| MOD-011 | Claim | Click Claim Business | Click X | Modal closes |
| MOD-012 | Claim | Open as AUTH | None | Form inputs visible AND functional |

## 3.2 Modal Content Verification

| ID | Modal | Check | Verification |
|----|-------|-------|--------------|
| MOD-020 | Event | Title | `.textContent()` returns event title |
| MOD-021 | Event | Date | Date text present and formatted |
| MOD-022 | Event | Book button | Button visible AND clickable |
| MOD-023 | Event | Save button | Clicking toggles saved state |
| MOD-024 | Deal | Business | Business name text present |
| MOD-025 | Deal | Redeem button | Button present (auth), clicks work |
| MOD-026 | Service | Contact info | Phone/email/address visible |
| MOD-027 | Service | Rating | Stars display correctly |
| MOD-028 | Profile | Tabs | Each tab click switches content |

---

# SECTION 4: BUTTON FUNCTIONALITY

**Every button must verify the action happens.**

## 4.1 Navigation Buttons

| ID | Button | Click Action | Verification |
|----|--------|--------------|--------------|
| BTN-001 | Classes tab | Click | `.hasClass('active')` = true |
| BTN-002 | Events tab | Click | `.hasClass('active')` = true, content changes |
| BTN-003 | Deals tab | Click | Deals grid appears |
| BTN-004 | Services tab | Click | Services list appears |
| BTN-005 | Consumer btn | Click | Consumer view renders |
| BTN-006 | Business btn | Click | Business view or auth prompt |
| BTN-007 | Admin btn | Click | Admin panel renders (admin only) |

## 4.2 Card Action Buttons

| ID | Button | Click Action | Verification |
|----|--------|--------------|--------------|
| BTN-010 | Save (heart/star) | Click | Icon fills, toast appears |
| BTN-011 | Save again | Click | Icon unfills, item unsaved |
| BTN-012 | Share | Click | Share options appear |
| BTN-013 | Book Now | Click | Booking sheet opens |
| BTN-014 | Card itself | Click | Detail modal opens |

## 4.3 Modal Action Buttons

| ID | Button | Click Action | Verification |
|----|--------|--------------|--------------|
| BTN-020 | Close (X) | Click | Modal closes |
| BTN-021 | Add to Calendar | Click | Event added, toast confirms |
| BTN-022 | Register | Click | Registration confirmed |
| BTN-023 | Redeem Deal | Click | Code generated, displayed |
| BTN-024 | Submit (form) | Click | Form submits, feedback shown |
| BTN-025 | Cancel | Click | Modal/action cancelled |

## 4.4 Profile Menu Buttons

| ID | Button | Click Action | Verification |
|----|--------|--------------|--------------|
| BTN-030 | My Profile | Click | Profile modal opens to Overview |
| BTN-031 | My Calendar | Click | Calendar modal opens |
| BTN-032 | Saved Items | Click | Profile modal opens to Saved tab |
| BTN-033 | Submit Event | Click | Submit modal opens |
| BTN-034 | Claim Business | Click | Claim modal opens |
| BTN-035 | Admin Panel | Click | Admin panel opens (admin) |
| BTN-036 | Settings | Click | Settings tab opens |
| BTN-037 | Sign Out | Click | User signed out, becomes guest |

---

# SECTION 5: COMPLETE FLOW TESTS

## 5.1 Save Item Flow

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Sign in | user.isGuest = false |
| 2 | Go to Events tab | Events visible |
| 3 | Click save on event | Icon fills, toast shows |
| 4 | Go to Profile > Saved | Event appears in saved list |
| 5 | Click remove | Event removed from list |
| 6 | Refresh page | Saved state persists correctly |

## 5.2 Book Event Flow

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Sign in | Authenticated |
| 2 | Click event card | Detail modal opens |
| 3 | Click Book Now | Booking sheet opens |
| 4 | Click external link | Opens in new tab |
| 5 | Return, confirm booking | Dialog appears |
| 6 | Click "Yes, I booked" | Event added to calendar |
| 7 | Go to My Calendar | Event appears in list |

## 5.3 Redeem Deal Flow

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Sign in | Authenticated |
| 2 | Go to Deals tab | Deals visible |
| 3 | Click deal card | Deal modal opens |
| 4 | Click Redeem Deal | Code generated |
| 5 | Code displays | Toast with code visible |
| 6 | Code copyable | Click copies to clipboard |

## 5.4 Claim Business Flow

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Sign in | Authenticated |
| 2 | Go to Business view | See "Claim Your Business" |
| 3 | Click Claim button | Claim modal opens |
| 4 | Fill business name | Type works, text appears |
| 5 | Fill owner name | Type works, text appears |
| 6 | Fill email | Type works, text appears |
| 7 | Fill phone | Type works, text appears |
| 8 | Select role | Dropdown works |
| 9 | Fill address | Type works, text appears |
| 10 | Click Submit | Request sent, toast shows |

## 5.5 Submit Event Flow

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Sign in | Authenticated |
| 2 | Click Submit Event | Modal opens |
| 3 | Select "Event" type | Proceeds to step 2 |
| 4 | Select business | Selection works |
| 5 | Fill title | Type works |
| 6 | Fill description | Type works |
| 7 | Select category | Dropdown works |
| 8 | Select date | Date picker works |
| 9 | Select time | Time picker works |
| 10 | Upload image | Cropper opens |
| 11 | Submit | Success screen shows |

## 5.6 Admin Review Flow (ADMIN ONLY)

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Sign in as admin | user.isAdmin = true |
| 2 | Go to Admin view | Admin panel loads |
| 3 | Panel has content | Tabs and submissions visible |
| 4 | Click Pending tab | Pending submissions show |
| 5 | Click Approve | Item moves to Approved |
| 6 | Click Reject | Item moves to Rejected |

---

# SECTION 6: FILTER & SEARCH CORRECTNESS (CRITICAL)

> **Bug #13 (Feb 8, 2026): Category filters returned 0 results for everything because code checked `e.tags` (scraper metadata like "auto-scraped") instead of `e.category` ("Fitness"). All QA agents marked filters as PASS because they only checked "dropdown opens and has options" — never verified results actually changed correctly. THIS SECTION NOW REQUIRES DATA CORRECTNESS VERIFICATION.**

## 6.1 Classes Tab Filters

| ID | Filter | Action | Verification | CORRECTNESS CHECK |
|----|--------|--------|--------------|-------------------|
| FLT-C01 | Default state | Load Classes tab | Count shows total classes | Record baseline count: ___ |
| FLT-C02 | Category: Fitness | Select Fitness | Count decreases | Spot-check 3 cards: all show fitness-related classes |
| FLT-C03 | Category: Martial Arts | Select Martial Arts | Count changes from Fitness | Spot-check 3 cards: all show martial arts classes |
| FLT-C04 | Category: All | Select All | Count returns to baseline | Baseline count matches |
| FLT-C05 | Date: Tomorrow | Select Tomorrow | Count changes | Spot-check: dates show tomorrow |
| FLT-C06 | Date: Anytime | Select Anytime | Count >= Upcoming count | More results than Today/Upcoming |
| FLT-C07 | Time: 6 PM | Select 6:00 PM | Count decreases | Spot-check: all times are 6 PM or later |
| FLT-C08 | Age: Kids | Select Kids | Count changes | Spot-check: classes tagged for kids |
| FLT-C09 | Age: Adults | Select Adults | Count changes | Spot-check: classes tagged for adults |
| FLT-C10 | Price: Free | Select Free | Count changes | Spot-check: prices show "Free" |
| FLT-C11 | Reset button | Click Reset | All filters back to default | Count returns to baseline |
| FLT-C12 | Combined filters | Category + Time | Count <= min of individual | Results match BOTH criteria |
| FLT-C13 | No empty options | Check all dropdown options | Each option returns >0 | No option produces "0 results" |

## 6.2 Events Tab Filters

| ID | Filter | Action | Verification | CORRECTNESS CHECK |
|----|--------|--------|--------------|-------------------|
| FLT-E01 | Default state | Load Events tab | Count shows total events | Record baseline: ___ |
| FLT-E02 | Category: Community | Select Community | Count changes | Spot-check 3 cards: community events |
| FLT-E03 | Category switch | Tab to Classes then back | Category resets to All | Baseline count restored |
| FLT-E04 | Anytime | Select Anytime | Count >= Upcoming | Shows all future events |

## 6.3 Deals Tab Filters

| ID | Filter | Action | Verification | CORRECTNESS CHECK |
|----|--------|--------|--------------|-------------------|
| FLT-D01 | Default state | Load Deals tab | Count shows total deals | Record baseline: ___ |
| FLT-D02 | Category filter | Select specific category | Count decreases | Spot-check: deals match category |
| FLT-D03 | All categories | Select All | Count returns to baseline | Matches |

## 6.4 Services Tab Filters

| ID | Filter | Action | Verification | CORRECTNESS CHECK |
|----|--------|--------|--------------|-------------------|
| FLT-S01 | Default state | Load Services tab | Count shows total services | Record baseline: ___ |
| FLT-S02 | Category filter | Select specific category | Count changes | Spot-check: services match category |
| FLT-S03 | Search + Filter | Type query + select category | Count <= either alone | Results match BOTH |

## 6.5 Search Correctness

| ID | Search | Action | Verification | CORRECTNESS CHECK |
|----|--------|--------|--------------|-------------------|
| FLT-SH01 | Exact match | Search "CrossFit" | Results appear | All visible cards contain "CrossFit" |
| FLT-SH02 | Partial match | Search "Cross" | Results appear | Cards contain "Cross" in title/venue |
| FLT-SH03 | No match | Search "zzzxxxyyy" | 0 results | Empty state message shown |
| FLT-SH04 | Clear search | Delete search text | All results return | Count matches baseline |
| FLT-SH05 | Case insensitive | Search "crossfit" | Same results as "CrossFit" | Same count |
| FLT-SH06 | Search + filter | Search "yoga" + Category:Fitness | Combined | Results are yoga AND fitness |

## 6.6 Age Group Filters

| ID | Filter | Action | Verification | CORRECTNESS CHECK |
|----|--------|--------|--------------|-------------------|
| FLT-A01 | Kids | Click Kids | Events filter | Spot-check: classes are kid-appropriate |
| FLT-A02 | All Ages | Click All Ages | All events show | Count matches baseline |
| FLT-A03 | Active state | Click filter | Active styling visible | Visual indicator present |

---

# SECTION 7: TOAST NOTIFICATIONS

## 7.1 Toast Triggers

| ID | Trigger | Expected Toast | Verification |
|----|---------|----------------|--------------|
| TST-001 | Save item | "Saved" message | Toast appears, auto-dismisses |
| TST-002 | Unsave item | "Removed" message | Toast appears |
| TST-003 | Profile update | "Updated" message | Toast appears |
| TST-004 | Event register | "Added to calendar" | Toast appears |
| TST-005 | Deal redeem | Code display | Toast with code |
| TST-006 | Claim submit | "Submitted" | Toast appears |
| TST-007 | Error | Error message | Toast appears (red) |
| TST-008 | Auto-dismiss | After ~3s | Toast disappears |

---

# SECTION 8: ERROR STATES

## 8.1 Form Validation

| ID | Form | Error Case | Verification |
|----|------|------------|--------------|
| ERR-001 | Auth | Empty email | Error message shows |
| ERR-002 | Auth | Invalid email format | Error message shows |
| ERR-003 | Auth | Short password | "Min 6 chars" error |
| ERR-004 | Auth | Wrong credentials | Login error shows |
| ERR-005 | Claim | Empty required | Validation error |
| ERR-006 | Submit | Empty title | Validation error |

## 8.2 Empty States

| ID | Context | Verification |
|----|---------|--------------|
| EMP-001 | No search results | "No results" message |
| EMP-002 | No saved items | "No saved items" message |
| EMP-003 | No calendar events | "No events" message |
| EMP-004 | No pending (admin) | "No pending" message |

---

# SECTION 9: KEYBOARD & ACCESSIBILITY

## 9.1 Keyboard Navigation

| ID | Action | Verification |
|----|--------|--------------|
| KEY-001 | Tab through page | Focus moves logically |
| KEY-002 | Enter on button | Button activates |
| KEY-003 | ESC on modal | Modal closes |
| KEY-004 | Focus visible | Focus ring shows |

---

# SECTION 10: RESPONSIVE

## 10.1 Mobile (375px)

| ID | Check | Verification |
|----|-------|--------------|
| MOB-001 | No overflow | `document.body.scrollWidth <= window.innerWidth` |
| MOB-002 | Modals fit | Modal within viewport |
| MOB-003 | Touch works | Tap events work |
| MOB-004 | Text readable | No clipping |

---

# SECTION 11: DATA PERSISTENCE

## 11.1 After Actions

| ID | Action | After Refresh | Verification |
|----|--------|---------------|--------------|
| PERS-001 | Save item | Item still saved | Saved list contains item |
| PERS-002 | Register event | In calendar | Calendar contains event |
| PERS-003 | Update profile | Changes persist | Fields show saved values |
| PERS-004 | Claim business | Claim exists | Shows in business list |

---

# GAPS THAT CAUSED PREVIOUS QA FAILURES

## Gap 1: Input Typing Not Tested

**Problem**: Tests used `.toBeVisible()` instead of actually typing.
**Solution**: Every input test must:
1. `click()` the input
2. `fill('text')` with test text
3. `inputValue()` to verify text appears
4. Compare value to expected

## Gap 2: Admin Panel Not Accessible

**Problem**: `is_admin` was hardcoded to `false` in code.
**Solution**:
- Fixed: `useUserData.js` now reads `is_admin` from database
- Fixed: Added `is_admin` column to profiles table
- Test: Set test user as admin before running admin tests

## Gap 3: Authenticated Tests Skipped

**Problem**: Tests that required auth were just skipped.
**Solution**: Create auth-required test suite with:
- Setup hook that signs in
- All authenticated features tested
- Teardown hook that signs out

## Gap 4: Only Testing Existence, Not Function

**Problem**: `await expect(element).toBeVisible()` ≠ "it works"
**Solution**: Every test must verify the action produces the expected result

---

# TEST COUNT SUMMARY

| Section | Tests |
|---------|-------|
| 1. Search | 7 |
| 2. Form Inputs | 25 |
| 3. Modal Open/Close | 12 |
| 3. Modal Content | 8 |
| 4. Buttons | 37 |
| 5. Complete Flows | 6 flows (60+ steps) |
| 6. Filters & Correctness | 26 |
| 7. Toasts | 8 |
| 8. Error States | 10 |
| 9. Keyboard | 4 |
| 10. Mobile | 4 |
| 11. Persistence | 4 |
| 12. Data Integrity | 16 |
| 14. Performance | 15 |
| 15. Network & API | 9 |
| 16. Offline & Network Failure | 5 |
| 17. Multi-Tab & Session | 10 |
| 18. Browser Zoom & Viewport | 8 |
| 19. Stress Testing | 10 |
| 20. External Links & URLs | 10 |
| 21. Accessibility | 16 |
| 22. Visual Consistency | 10 |

**TOTAL: 310+ individual verifications**

---

# SECTION 12: DATA INTEGRITY (CRITICAL)

**ZERO TOLERANCE for fake/hallucinated data. See CLAUDE.md "REAL DATA ONLY" policy.**

## 12.1 Data Source Verification

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| DATA-001 | No AI-extracted events | `SELECT COUNT(*) FROM events WHERE source = 'ai-extracted'` | Count = 0 |
| DATA-002 | All events from verified sources | `SELECT DISTINCT source FROM events` | Only: mindbody-api, wellnessliving, janeapp, user-submitted, manual |
| DATA-003 | No hallucinated business names | `SELECT * FROM events WHERE title = venue_name` | Count = 0 |
| DATA-004 | No suspicious clustering | `SELECT start_time, COUNT(*) FROM events GROUP BY start_time ORDER BY COUNT(*) DESC LIMIT 5` | No single time with 50+ events |
| DATA-005 | No date duplication | Ratio query from CLAUDE.md | No venue with ratio > 25 |
| DATA-006 | Business panel shows real data | Visual inspection of business panel | No placeholder/demo content |
| DATA-007 | Admin panel shows real data | Visual inspection of admin panel | No placeholder/demo content |

## 12.2 After Any Scraper Run

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| DATA-010 | Unverified AI extraction disabled | `scrape-with-ai.js` not used | Only `verified-extractor.js` (with source text verification) allowed |
| DATA-011 | AI-verified events tagged correctly | `SELECT * FROM events WHERE tags @> '{"ai-verified"}'` | All have confidence_score=0.75, tagged ai-verified+website-verified |
| DATA-012 | Only booking system + verified data inserted | Check scraper output log | Only entries from detected booking systems or verified AI extraction |
| DATA-013 | Post-scrape validation passes | Run validation queries from CLAUDE.md | All checks pass |
| DATA-014 | Dedup includes start_time | `grep 'classExists' scripts/scrape-*.js` | All calls pass time parameter |
| DATA-015 | Same-title classes preserved | `SELECT title, start_date, COUNT(*) FROM events WHERE event_type='class' GROUP BY title, start_date HAVING COUNT(*)>1 LIMIT 5` | Multi-time classes exist (e.g. "Train Wild" x3) |
| DATA-016 | New booking source verified | Visit schedule URL in browser | Actual classes visible before adding to scraper |

---

---

# SECTION 14: PERFORMANCE

## 14.1 Page Load Performance

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| PERF-001 | Initial page load time | DevTools Network tab → DOMContentLoaded | < 3 seconds |
| PERF-002 | Classes tab load | Navigate to Classes, measure time to first card render | < 2 seconds |
| PERF-003 | Events tab load | Navigate to Events, measure time to first card render | < 2 seconds |
| PERF-004 | Deals tab load | Navigate to Deals, measure time to first card render | < 2 seconds |
| PERF-005 | Services tab load | Navigate to Services, measure time to first card render | < 2 seconds |
| PERF-006 | Wellness tab load | Navigate to Wellness, measure time to first card render | < 2 seconds |

## 14.2 Interaction Performance

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| PERF-010 | Tab switching | Click between tabs, measure delay | < 500ms, no visible lag |
| PERF-011 | Filter selection | Select a filter, measure time to results update | < 500ms |
| PERF-012 | Search typing | Type in search, measure debounce + results update | Results appear within 300ms of stop typing |
| PERF-013 | Modal open | Click card to open modal, measure time | < 300ms |
| PERF-014 | Modal close | Close modal, measure time | < 200ms |
| PERF-015 | Scroll performance | Scroll through 100+ cards, check for jank | Smooth 60fps, no stuttering |

## 14.3 Memory & Resource

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| PERF-020 | Memory leak — navigation | DevTools → Performance Monitor → JS Heap → navigate all 5 tabs 3x | Heap returns to baseline (±20%) |
| PERF-021 | Memory leak — modals | Open and close 20 modals, check heap | Heap returns to baseline (±20%) |
| PERF-022 | Memory leak — filters | Toggle filters 20 times, check heap | Heap returns to baseline (±20%) |
| PERF-023 | Bundle size | Check network transfer size | Main JS bundle < 500KB gzipped |
| PERF-024 | Unnecessary re-renders | React DevTools Profiler → navigate app | No component renders >10ms without interaction |

---

# SECTION 15: NETWORK & API INTEGRITY

## 15.1 Request Monitoring

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| NET-001 | No failed requests on load | DevTools → Network → load app → filter 4xx/5xx | Zero failed requests |
| NET-002 | No failed requests on navigation | Navigate all 5 tabs → filter 4xx/5xx | Zero failed requests |
| NET-003 | No duplicate requests | Watch Network tab during tab switch | No same-URL called 2+ times within 1 second |
| NET-004 | No hanging requests | Watch Network tab for 30 seconds | No requests with "pending" status > 10 seconds |
| NET-005 | Supabase queries efficient | Check query timing in Network tab | No single query > 2 seconds |

## 15.2 Error Handling

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| NET-010 | API timeout handling | Throttle network to Slow 3G, interact with app | Timeout message shown, no crash |
| NET-011 | Empty response handling | Check what happens when Supabase returns `[]` | Empty state message, not blank/crash |
| NET-012 | Malformed response | (Code review) Check `.catch()` on all fetch calls | All Supabase calls have error handling |
| NET-013 | CORS errors | Check console for CORS-related errors | Zero CORS errors |

---

# SECTION 16: OFFLINE & NETWORK FAILURE

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| OFF-001 | Disconnect on page load | DevTools → Network → Offline → refresh | Error message shown, not blank white screen |
| OFF-002 | Disconnect mid-navigation | Load app → go offline → click new tab | Graceful failure, no crash |
| OFF-003 | Disconnect during save | Start saving item → go offline mid-action | Error toast, not silent failure |
| OFF-004 | Reconnect recovery | Go offline → go online → interact | App recovers, data loads |
| OFF-005 | Disconnect during form submit | Fill form → go offline → submit | Error message, form data preserved |

---

# SECTION 17: MULTI-TAB & SESSION PERSISTENCE

## 17.1 Multi-Tab

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| TAB-001 | Two tabs same page | Open app in 2 tabs on same tab | Both render correctly |
| TAB-002 | Save in tab A, check tab B | Save item in tab A → refresh tab B | Saved item appears in tab B |
| TAB-003 | Login in tab A, check tab B | Log in tab A → refresh tab B | Tab B shows logged-in state |
| TAB-004 | Logout in tab A, check tab B | Log out tab A → interact in tab B | Tab B handles gracefully (redirect or show guest) |
| TAB-005 | 5 tabs simultaneously | Open 5 tabs, navigate each differently | No conflicts, no console errors, no memory crash |

## 17.2 Session Persistence

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| SESS-001 | Refresh preserves auth | Log in → refresh page | Still logged in |
| SESS-002 | Tab close/reopen preserves auth | Log in → close tab → open new tab to same URL | Still logged in (if expected) |
| SESS-003 | Active tab preserved on refresh | Navigate to Events → refresh | Events tab still active |
| SESS-004 | Filter state on refresh | Set filters → refresh | Filters reset (expected) or preserved (if implemented) |
| SESS-005 | Auth state after 30 min idle | Log in → wait 30 min → interact | Session still valid or graceful re-auth prompt |

---

# SECTION 18: BROWSER ZOOM & VIEWPORT

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| ZOOM-001 | 50% zoom | Browser zoom to 50% → navigate all tabs | Layout usable, no overlap, no cut-off text |
| ZOOM-002 | 75% zoom | Browser zoom to 75% → navigate all tabs | Layout usable |
| ZOOM-003 | 150% zoom | Browser zoom to 150% → navigate all tabs | Layout usable, scrollable |
| ZOOM-004 | 200% zoom | Browser zoom to 200% → navigate all tabs | Layout usable, no horizontal overflow |
| ZOOM-005 | 375px mobile viewport | DevTools → responsive → 375px | Full app usable, no overflow |
| ZOOM-006 | 768px tablet viewport | DevTools → responsive → 768px | Layout adapts appropriately |
| ZOOM-007 | 1920px desktop viewport | DevTools → responsive → 1920px | No excessive whitespace, centered layout |
| ZOOM-008 | Landscape mobile (667x375) | DevTools → responsive → 667x375 | App usable in landscape |

---

# SECTION 19: LARGE INPUT & STRESS TESTING

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| STRESS-001 | 10,000 char paste into search | Paste massive string into search input | No crash, input accepts or truncates gracefully |
| STRESS-002 | 10,000 char paste into form inputs | Paste into each form field (auth, claim, submit) | No crash, validation or truncation |
| STRESS-003 | Rapid tab switching (20x in 5s) | Click tabs as fast as possible | No crash, correct tab renders |
| STRESS-004 | Rapid filter toggling (20x in 5s) | Toggle filters on/off rapidly | No crash, correct results shown at end |
| STRESS-005 | Rapid modal open/close (10x) | Open and close same modal 10 times fast | No duplicate modals, no orphaned overlays |
| STRESS-006 | Rapid save/unsave (10x) | Toggle save button 10 times fast | Final state correct (saved or unsaved), no duplicates in DB |
| STRESS-007 | Rapid card clicks | Click 5 different cards in 2 seconds | No multiple modals stacked, last one wins |
| STRESS-008 | XSS in search | Type `<script>alert('xss')</script>` in search | No alert fires, text displayed as-is or sanitized |
| STRESS-009 | SQL injection in search | Type `'; DROP TABLE events; --` in search | No error, treated as text |
| STRESS-010 | Emoji in inputs | Type emoji characters in all inputs | Accepted or gracefully rejected |

---

# SECTION 20: EXTERNAL LINKS & URLS

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| LINK-001 | Service website links | Click "Website" on 5 random service modals | Opens correct URL in new tab, not 404 |
| LINK-002 | Service phone links | Click "Call" on 5 random service modals | Opens tel: link with correct number |
| LINK-003 | Service email links | Click "Email" on 5 random service modals | Opens mailto: link with correct address |
| LINK-004 | Service directions links | Click "Directions" on 5 random service modals | Opens Google Maps with correct location |
| LINK-005 | Event booking links | Click "Book" on 5 events with booking URLs | Opens correct booking page, not 404 |
| LINK-006 | Deal redeem links | Click "Redeem" on 5 deals | Opens correct deal URL or shows code |
| LINK-007 | Website URL protocol | Check services with websites missing http:// | URL has protocol prepended, link works |
| LINK-008 | Phone number formatting | Check tel: links for special characters | Only digits and + in tel: href |
| LINK-009 | External links open in new tab | Click external links | All open in new tab (target="_blank") |
| LINK-010 | External links have rel="noopener" | Inspect external link elements | All have `rel="noopener noreferrer"` |

---

# SECTION 21: ACCESSIBILITY

## 21.1 Keyboard Navigation

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| A11Y-001 | Tab order logical | Tab through entire page | Focus moves in reading order |
| A11Y-002 | All interactive elements focusable | Tab through — can reach every button, link, input | Nothing skipped |
| A11Y-003 | Focus visible on all elements | Tab through — focus ring visible | Clear visual indicator on focused element |
| A11Y-004 | Enter activates buttons | Focus button → press Enter | Button action fires |
| A11Y-005 | Space activates checkboxes/toggles | Focus checkbox → press Space | Toggle state changes |
| A11Y-006 | ESC closes modals/dropdowns | Open modal → press ESC | Modal closes |
| A11Y-007 | Arrow keys in dropdowns | Open dropdown → arrow up/down | Options navigate correctly |
| A11Y-008 | Focus trapped in modals | Open modal → Tab repeatedly | Focus stays within modal, doesn't go to background |
| A11Y-009 | Focus returns after modal close | Open modal → close → check focus | Focus returns to trigger element |
| A11Y-010 | Skip to content link | Press Tab on page load | "Skip to content" link appears (or n/a) |

## 21.2 Screen Reader & ARIA

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| A11Y-020 | All images have alt text | Inspect `<img>` elements | All have meaningful `alt` attribute |
| A11Y-021 | Form inputs have labels | Inspect inputs | All have associated `<label>` or `aria-label` |
| A11Y-022 | Buttons have accessible names | Inspect icon-only buttons | All have `aria-label` or visible text |
| A11Y-023 | Modals have role="dialog" | Inspect modal elements | `role="dialog"` and `aria-modal="true"` |
| A11Y-024 | Live regions for toasts | Inspect toast container | `role="alert"` or `aria-live="polite"` |
| A11Y-025 | Color contrast ratio | Use DevTools accessibility audit | All text meets WCAG AA (4.5:1 normal, 3:1 large) |
| A11Y-026 | No info conveyed by color alone | Check error states, status indicators | Text/icon accompanies color indicators |

---

# SECTION 22: VISUAL CONSISTENCY

| ID | Check | How to Verify | Pass Criteria |
|----|-------|---------------|---------------|
| VIS-001 | Font consistency | Navigate all 5 tabs + modals | Same font family throughout |
| VIS-002 | Color scheme consistency | Navigate all tabs | Primary/secondary colors match design system |
| VIS-003 | Spacing consistency | Compare padding/margins across cards | Consistent spacing between similar elements |
| VIS-004 | No element overlap | Scroll through all tabs at 375px | No elements covering other elements |
| VIS-005 | No horizontal scroll | Check all tabs at 375px, 768px, 1440px | `document.body.scrollWidth <= window.innerWidth` |
| VIS-006 | Card height consistency | View cards in grid layout | Similar cards have consistent heights |
| VIS-007 | Icon consistency | Check icon sizes and styles across tabs | Same icon library, consistent sizing |
| VIS-008 | Button styling consistency | Compare primary/secondary buttons | Same border-radius, padding, hover states |
| VIS-009 | Loading state consistency | Trigger loading on multiple tabs | Same loading indicator style |
| VIS-010 | Empty state consistency | Trigger empty states on multiple tabs | Same empty state pattern/style |

---

# SECTION 13: BULLETPROOF QA PROTOCOL REFERENCE

**Full protocol document: `/PULSE_QA_PROTOCOL.md`** — Must be read in full before any QA session.

## 13.1 Rules of Engagement (Summary)

| Rule | Description |
|------|-------------|
| **NO ASSUMPTIONS** | You MUST run the app and interact with elements. Reading code is NOT QA. |
| **ONE PAGE AT A TIME** | Complete ALL checks for a page before moving to the next. |
| **EVIDENCE-BASED** | Every check needs: what you did, what happened, pass/fail. |
| **TEST LIKE A USER** | Click buttons, type in inputs, follow links. Don't read source code. |
| **BREAK THINGS** | Empty submit, special chars, long strings, rapid clicks, XSS patterns. |
| **DOCUMENT EVERYTHING** | Even passes need detail. "Everything works" = failed QA. |

## 13.2 Phase Checklist

| Phase | Scope | Checks |
|-------|-------|--------|
| Phase 1 | Environment Verification | App starts, no console errors, DB connection, env vars |
| Phase 2A | Page Load | No blank screen, no console errors, responsive, loading states |
| Phase 2B | Navigation | Every link clicked and documented, back button, no dead links |
| Phase 2C | Buttons | Every button clicked, correct behavior, double-click handling |
| Phase 2D | Forms & Inputs | Valid data, empty submit, long text, special chars, tab order |
| Phase 2E | Modals | Open, close (X, overlay, ESC), content correct, backdrop works |
| Phase 2F | Images | All load, alt text, correct sizing |
| Phase 2G | Data Display | Items showing, data correct, sort/filter/search, empty state |
| Phase 2H | State Management | Refresh, navigate away/back, new tab, auth/guest states |
| Phase 3A | Auth Flows | Sign up, sign in, sign out, session persistence |
| Phase 3B | Gamification | XP, levels, leaderboard, edge cases |
| Phase 3C | Business Directory | All load, search, filters, detail pages, contact info |
| Phase 3D | Events | List, detail, timezone, RSVP |
| Phase 3E | API Integrity | Network tab, failed requests, empty responses, duplicates |
| Phase 3F | Performance | Load time, sluggish interactions, memory leaks |
| Phase 3G | Visual Consistency | Fonts, colors, spacing, no overlap, no horizontal scroll |
| Phase 4 | Edge Cases | Rapid clicks, multi-tab, offline, zoom, admin URL access |

## 13.3 Enumeration Template

Before starting QA on any page, enumerate ALL elements:

```markdown
## Page: [NAME] — Element Inventory

### Buttons
1. [Button text] — Location: [where on page]

### Links
1. [Link text] → [expected destination]

### Inputs/Forms
1. [Input label] — Type: [text/email/password/select/etc]

### Dynamic Content
1. [What it shows] — Source: [API/static/state]

### Modals/Overlays
1. [Modal name] — Trigger: [what opens it]
```

## 13.4 Report Format

All QA reports MUST follow the Phase 5 format in `PULSE_QA_PROTOCOL.md`:
- Summary (total checks, passes, failures, blocked)
- Critical Failures (must fix)
- Major Issues (should fix)
- Minor Issues (fix when possible)
- Warnings (potential issues)
- Detailed Results by Page (table format)

## 13.5 QA Execution Rules

- Write findings to `qa-reports/[page-name].md` INCREMENTALLY — every 5 checks, flush to disk.
- If a page has 30+ interactive elements, split QA into sub-tasks (navigation, buttons, forms, data display).
- Each agent/task must have a scope small enough to complete within its context window.
- Before starting, estimate element count. If >25 elements, split the task.

## 13.6 Evidence Format

```
[✅ PASS] Button: "Sign Up" → Clicked → Modal opened with email/password fields
[❌ FAIL] Button: "Sign Up" → Clicked → Nothing happened. No console errors. Handler is empty.
[⚠️ PARTIAL] Button: "Sign Up" → Clicked → Modal opened but email field is not focusable
[❌ UNVERIFIED] Button: "Sign Up" → Could not test (app crashed on page load)
```

---

# AUTOMATED TEST IMPLEMENTATION PATTERN

```javascript
// BAD - Only checks existence
test('input exists', async ({ page }) => {
  await expect(page.locator('input')).toBeVisible();
});

// GOOD - Verifies functionality
test('input accepts text', async ({ page }) => {
  const input = page.locator('input');

  // 1. Click to focus
  await input.click();

  // 2. Type text
  await input.fill('Test Value');

  // 3. Verify text appears
  const value = await input.inputValue();
  expect(value).toBe('Test Value');
});

// COMPLETE - Tests full flow
test('claim form works end-to-end', async ({ page }) => {
  // Navigate to claim modal
  await page.click('button:has-text("Business")');
  await page.click('button:has-text("Claim")');

  // Verify modal opened
  await expect(page.locator('.claim-modal')).toBeVisible();

  // Fill each field AND verify
  const bizName = page.locator('input[placeholder*="business name"]');
  await bizName.click();
  await bizName.fill('Test Business');
  expect(await bizName.inputValue()).toBe('Test Business');

  const ownerName = page.locator('input[placeholder*="name"]').nth(1);
  await ownerName.click();
  await ownerName.fill('John Doe');
  expect(await ownerName.inputValue()).toBe('John Doe');

  // ... continue for all fields

  // Submit and verify
  await page.click('button:has-text("Submit")');
  await expect(page.locator('.toast-success')).toBeVisible();
});
```
