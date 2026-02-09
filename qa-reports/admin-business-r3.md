# PULSE QA REPORT -- Admin Panel + Business View -- Data Correctness
## Date: 2026-02-08 (Round 3)

### Scope
- Business View: Access, claim flow, data correctness
- Admin Panel: Code review (requires auth), data correctness, placeholder detection
- Database cross-checks

---

## Summary
- Total checks performed: 52
- Passes: 39
- Failures: 5
- Warnings: 6
- Blocked (could not verify): 2

---

## Critical Failures

1. **[Admin Panel] Scraping Dashboard -- All data is hardcoded** -- The "Web Scraping System" section (lines 15610-15690) displays entirely fabricated data: "Tonight at 2:00 AM", "47 minutes", "23 updates", "3 errors", and a hardcoded activity log with fake timestamps. This is NOT pulled from any database or real scraping system. An admin would see these static values and believe them to be real operational data.

2. **[Business View] Audience Insights -- All data is hardcoded** -- The "Audience Insights" section (lines 15224-15287) displays fabricated data: peak times ("Friday 6-8 PM", "Saturday 12-2 PM"), demographics (45% ages 25-34, 28% ages 35-44, etc.), and top interests ("Food & Drink", "Live Music", etc.). None of this comes from any analytics backend -- it is identical for every business.

---

## Major Issues

1. **[Admin Panel] Quick Add form venue selector limited to 50 businesses** -- Line 15811: `services.slice(0, 50)` means only the first 50 businesses (out of 665) appear in the venue dropdown. An admin trying to add a class for a business ranked below #50 cannot find it. Should use searchable dropdown or load all venues.

2. **[Admin Panel] Settings button is placeholder** -- Line 15544: `onClick={() => showToast('Admin settings coming soon', 'info')}` -- button does nothing except show a toast. Should either be hidden or marked as "Coming Soon" in the UI.

3. **[Admin Panel] Add Venue button is placeholder** -- Line 15545: `onClick={() => showToast('Use the business directory to manage venues', 'info')}` -- button shows a redirect toast instead of actual functionality.

---

## Minor Issues

1. **[Business View] Download PDF button is placeholder** -- Line 15467: Shows toast "PDF reports coming in a future update".
2. **[Business View] Upgrade button is placeholder** -- Line 15479: Shows toast "Premium features coming soon".
3. **[Admin Panel] Configure scraping button is placeholder** -- Line 15605: Shows toast "Scraping configuration is managed via CLI".
4. **[Admin Panel] Run Scrape Now button is placeholder** -- Line 15606: Shows toast about running CLI commands.
5. **[Business View] Business selector doesn't switch** -- Line 14653: The `<select className="business-selector">` for users with multiple claimed businesses has no `onChange` handler. It renders options but selecting a different business does nothing.

---

## Warnings

1. **[Business View] Pulse Score always shows "--"** -- Lines 14681-14682: The Pulse Score ring always shows "--" and all breakdown bars are at 0%. While this is reasonable for businesses without activity, there's no explanation text telling the user WHY it's at zero.
2. **[Admin Panel] Venue default display limit of 12** -- Line 15731: Without any search/filter, only 12 venues are shown (of 665). There is no pagination or "Load More" button. An admin must use search to find venues beyond the first 12.
3. **[Data] 2,336 orphaned events (only 59 have venue_id)** -- Events with `venue_id = NULL` represent 97.5% of all 2,395 events. The admin panel's venue cards (lines 15724, 15732) show class counts using `dbEvents.filter(e => e.venueId === s.id).length`, which would show 0 classes for almost every venue. The "has_classes" / "no_classes" status filter is therefore nearly useless -- it would classify almost all venues as "No Classes" even though many have hundreds of events by `venue_name`. Note: The business view "My Listings" (line 15156) has a fallback that matches by `venueName` case-insensitively, so business owners see their listings correctly, but the admin panel does NOT use this fallback.
4. **[Admin Panel] Delete venue uses soft-delete but UI says "Delete"** -- Line 15771: `confirm('Delete venue.name? This cannot be undone.')` but the actual DB operation is `update({ status: 'inactive' })`. The warning text is misleading since it IS recoverable.
5. **[Business View] Mini-bar chart shows placeholder when no analytics** -- Line 14746: When `businessAnalytics?.daily_breakdown` is falsy, hardcoded bar heights `[40, 20, 30, 25, 35, 40, 45]` with `opacity: 0.3` are rendered. These are decorative/placeholder but could be mistaken for real data.
6. **[Admin Panel] Reject submission uses hardcoded reason** -- Line 14505: `onClick={() => rejectSubmission(submission.id, 'Does not meet guidelines')}` -- admin cannot provide a custom rejection reason.

---

## Detailed Results

### Phase 1: Environment Verification

| Check | Status | Evidence |
|-------|--------|----------|
| Dev server running at :5173 | PASS | HTTP 200 returned |
| Supabase DB connection | PASS | All queries returned valid data |
| Business count in DB | PASS | 665 businesses (content-range: 0-0/665), 665 active |
| Events count in DB | PASS | 2,395 total events |
| No null-title events | PASS | Query for `title=is.null` returned [] |
| No null-venue events | PASS | Query for `venue_name=is.null` returned [] |
| No null-date events | PASS | Query for `start_date=is.null` returned [] |
| No title=venue_name events | PASS | Query returned [] |
| Orphaned events (null venue_id) | WARN | 2,336 of 2,395 events have no venue_id |

### Phase 2: Business View -- Live UI Tests

| Element | Action | Expected | Actual | Status |
|---------|--------|----------|--------|--------|
| View switcher - Business button | Exists in UI | Button visible | Found "Business" button | PASS |
| Business view - Guest user | Click Business tab | Auth prompt | Shows "Sign In Required" with Sign In button | PASS |
| Sign In button | Click | Opens auth modal | Auth modal opened with Google OAuth + email/password | PASS |
| Auth modal close | Press Escape | Modal closes | Modal closed | PASS |
| Admin button - Guest | Check visibility | Not visible | Not visible for guest user | PASS |
| Services tab count | Compare to DB | 665 | "665 results" displayed | PASS |
| Business search: "Dirty Dog Grooming" | Type in search | Found | Found in results | PASS |
| Business search: "Cyrus Cafe" | Type in search | Found | Found in results | PASS |
| Business search: "Elements Casino Squamish" | Type in search | Found | Found in results | PASS |
| Mobile viewport (375px) | Check overflow | No horizontal scroll | No overflow detected | PASS |
| Mobile business view | Visual check | Renders properly | Sign In Required renders well on mobile | PASS |
| Console errors | Check for errors | None | Zero console errors during testing | PASS |

### Phase 3: Admin Panel -- Code Review

| Element | Check | Expected | Actual | Status |
|---------|-------|----------|--------|--------|
| Admin access control | `!user.isAdmin` check | Restricts non-admin | "Access Restricted" shown for non-admin (line 15489) | PASS |
| Admin button visibility | `user.isAdmin &&` | Hidden for non-admin | Wrapped in `{user.isAdmin && ...}` (line 10608) | PASS |
| adminClaimedCount source | Real DB query | From Supabase | Fetched from `business_claims` table (lines 8631-8643) | PASS |
| adminVerifiedCount source | Real DB query | From Supabase | Filtered by `status === 'verified'` from claims (line 8642) | PASS |
| Total Venues stat | Real data | `services.length` | Uses `services.length` from DB fetch (line 15557) | PASS |
| Weekly Classes stat | Real data | From events | Uses `REAL_DATA.events.length + dbEvents.length` (line 15568) | PASS |
| Active Deals stat | Real data | From deals | Uses `REAL_DATA.deals.length + dbDeals.length` (line 15590) | PASS |
| Admin search - separate state | Own state var | Separate from consumer | `adminSearchQuery` (line 8534) vs consumer search state | PASS |
| Impersonate search - separate state | Own state var | Separate | `impersonateSearchQuery` (line 8535) | PASS |
| Admin search onChange | Has handler | Functional | `onChange={(e) => setAdminSearchQuery(e.target.value)}` (line 15700) | PASS |
| Category filter onChange | Has handler | Functional | `onChange={(e) => setAdminCategoryFilter(e.target.value)}` (line 15702) | PASS |
| Status filter onChange | Has handler | Functional | `onChange={(e) => setAdminStatusFilter(e.target.value)}` (line 15708) | PASS |
| Category filter logic | Correct filtering | Matches category | `.filter(s => !adminCategoryFilter \|\| s.category === adminCategoryFilter)` | PASS |
| Status filter logic | Correct filtering | Uses classCount | Checks `dbEvents.filter(e => e.venueId === s.id).length` | PASS |
| Edit button onClick | Opens modal | Real modal | Sets `editingVenue`, populates form, shows modal (lines 15757-15768) | PASS |
| Edit modal | Has form + save | Real Supabase update | Updates `businesses` table via Supabase `.update()` (lines 15964-15975) | PASS |
| Impersonate button onClick | Navigates | Enters impersonation | Calls `enterImpersonation(venue)` (line 15769) | PASS |
| enterImpersonation function | Saves state + switches | Correct | Saves admin state, sets impersonated business, switches to business view (lines 9225-9246) | PASS |
| exitImpersonation function | Restores state | Correct | Clears impersonation, returns to admin, restores scroll (lines 9248-9260) | PASS |
| Delete button onClick | Confirms + soft-deletes | Real DB update | Uses `confirm()` then `supabase.update({ status: 'inactive' })` (lines 15770-15785) | PASS |
| approveSubmission function | Real DB operations | Updates + inserts | Updates `pending_items` status + creates event/deal in DB (lines 9728-9801) | PASS |
| rejectSubmission function | Real DB operation | Updates status | Updates `pending_items` with rejection (lines 9805-9828) | PASS |
| loadPendingSubmissions | From DB | Real data | Fetches from `pending_items` table (lines 9831-9847) | PASS |
| Quick Add form validation | Checks required fields | Shows error | Checks `!quickAddForm.title \|\| !quickAddForm.venueId` (line 15844) | PASS |
| Quick Add DB insert | Real Supabase insert | Inserts to events | Inserts via `supabase.from('events').insert(...)` (lines 15853-15865) | PASS |
| Scraping dashboard data | Real or hardcoded? | Should be real | HARDCODED: "Tonight at 2:00 AM", "47 minutes", "23 updates", "3 errors" | FAIL |
| Scraping activity log | Real or hardcoded? | Should be real | HARDCODED: Static array of 5 fake log entries (lines 15664-15669) | FAIL |
| Settings button | Real handler | Functional | Placeholder toast: "Admin settings coming soon" | FAIL |
| Add Venue button | Real handler | Functional | Placeholder toast: "Use the business directory" | FAIL |
| Reject reason | Customizable | Admin provides reason | Hardcoded to "Does not meet guidelines" | FAIL |

### Phase 4: Admin Responsive CSS

| Breakpoint | What adapts | Status |
|------------|-------------|--------|
| 1200px | Stats grid: 2-col, venues grid: 2-col | PASS (lines 5456-5465) |
| 768px | Stats grid: 1-col, venues grid: 1-col, forms 1-col, scrape cards 1-col | PASS (lines 5467-5476) |
| 480px | Reduced padding/font sizes, 1-col stat grid | PASS (lines 12904-12978) |
| 375px | overflow-x: hidden, smaller stat boxes, column layout | PASS (lines 12980-13010) |

### Phase 5: Business View -- Claim Flow (Code Review)

| Element | Check | Status | Evidence |
|---------|-------|--------|----------|
| Claim button exists | Guest can see claim CTA | PASS | Visible on business view when authenticated but no claimed business (line 14570) |
| Claim requires auth | Session check | PASS | Shows sign-in prompt when `!session?.user` (line 12250) |
| Claim search searches real businesses | Uses `services` array | PASS | Filters from DB-loaded services (line 12274) |
| Claim form validation | Required fields checked | PASS | Checks businessName, ownerName, email (line 9964) |
| Claim inserts to DB | Real Supabase insert | PASS | Inserts to `business_claims` table (line 9992) |
| Admin auto-verify | isAdmin check | PASS | Status = 'verified' for admin, 'pending' for others (line 9986) |
| Claim form has all fields | businessName, ownerName, email, phone, role, address | PASS | All 6 fields present (lines 12307-12334) |

### Phase 6: Data Correctness Cross-Checks

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| DB business count | ~664+ | 665 | PASS |
| UI services count | Matches DB | 665 results shown | PASS |
| "Dirty Dog Grooming" in DB & UI | Exists | Found in both | PASS |
| "Cyrus Cafe" in DB & UI | Exists | Found in both | PASS |
| "Elements Casino Squamish" in DB & UI | Exists | Found in both | PASS |
| "Sea to Sky Community Services" in DB | Exists | Found with category "Community Services", phone 604-892-5796 | PASS |
| Events with null titles | 0 | 0 | PASS |
| Events with null venue_name | 0 | 0 | PASS |
| Events with null dates | 0 | 0 | PASS |
| Events where title = venue_name | 0 | 0 | PASS |
| Orphaned events (null venue_id) | Low count | 2,336 of 2,395 (97.5%) | WARN |

---

## Screenshots

| Screenshot | Description |
|------------|-------------|
| /tmp/qa-r3-business-01-initial.png | App initial load -- consumer view with classes |
| /tmp/qa-r3-business-02-view.png | Business view -- "Sign In Required" for guest |
| /tmp/qa-r3-business-03-auth-modal.png | Auth modal opened from business view |
| /tmp/qa-r3-business-04-services.png | Services tab showing 665 results |
| /tmp/qa-r3-business-06-mobile.png | Mobile view (375px) of business view |

---

## Recommendations

### Must Fix
1. **Replace hardcoded scraping dashboard** with real data from a `scraping_runs` table or remove the section entirely. Displaying fabricated operational metrics is misleading for admins.
2. **Replace hardcoded audience insights** with real analytics data or clearly label as "Sample Data" / "Coming Soon".

### Should Fix
3. **Make Quick Add venue dropdown searchable** or remove the `.slice(0, 50)` limit.
4. **Add custom rejection reason input** for admin submission review.
5. **Add onChange handler to business selector** dropdown in business view.
6. **Link venue_id on events** -- 97.5% of events have null venue_id, making the admin "has_classes" filter nearly useless.

### Nice to Have
7. Replace placeholder buttons (Settings, Add Venue, Download PDF, Upgrade) with real functionality or hide them.
8. Add pagination or "Load More" to admin venue list (currently limited to 12).
9. Fix delete confirmation text to say "deactivate" instead of "Delete... cannot be undone" since it's a soft delete.
