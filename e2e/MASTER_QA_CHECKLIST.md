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

# SECTION 6: FILTER FUNCTIONALITY

## 6.1 Category Filters

| ID | Filter | Action | Verification |
|----|--------|--------|--------------|
| FLT-001 | Deal category | Select "Food" | Only food deals show |
| FLT-002 | Deal category | Select "All" | All deals show |
| FLT-003 | Service category | Select category | Services filter |
| FLT-004 | Results count | After filter | Count matches visible |

## 6.2 Age Group Filters

| ID | Filter | Action | Verification |
|----|--------|--------|--------------|
| FLT-010 | Kids 0-4 | Click button | Events filter to that age |
| FLT-011 | All Ages | Click button | All events show |
| FLT-012 | Active state | Click filter | Button shows active style |

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
| Search | 7 |
| Form Inputs | 25 |
| Modal Open/Close | 12 |
| Modal Content | 8 |
| Buttons | 37 |
| Complete Flows | 6 flows (60+ steps) |
| Filters | 6 |
| Toasts | 8 |
| Error States | 10 |
| Keyboard | 4 |
| Mobile | 4 |
| Persistence | 4 |

**TOTAL: 185+ individual verifications**

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
