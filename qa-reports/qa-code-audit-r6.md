# QA Code Audit - Round 6

**Date**: 2026-02-14
**Scope**: Source code scan for known bug patterns across all `.jsx` and `.js` files in `src/`
**Method**: Static analysis (not browser testing)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| Major | 9 |
| Minor | 12 |
| Warning | 18 |
| **Total** | **41** |

---

## 1. Placeholder/TODO Code

### console.log in Production Code

```
[⚠️ WARN] src/hooks/useUserData.js:70 - console.log guarded by DEV check (acceptable)
  Code: if (import.meta.env.DEV) console.log('[Auth] Initial getSession:', ...);
  Fix: None needed — DEV-only logging, stripped in production build.
  Note: 9 instances in useUserData.js, 2 in sentry.js — all guarded by import.meta.env.DEV.
```

```
[⚠️ WARN] src/App.jsx:296 - console.error in catch block (admin stats)
  Code: console.error('Error fetching admin stats:', err);
  Fix: Consider using Sentry captureException instead for production error tracking.
  Note: 30+ catch blocks across codebase use console.error. These are acceptable for error reporting
  but should ideally be routed through Sentry.
```

### Placeholder Text

```
[✅ OK] src/components/FeedbackWidget.jsx:6-8 - placeholder property in TYPES config
  Code: { id: 'bug', label: 'Bug Report', icon: '...', placeholder: 'Describe what happened...' }
  Fix: None needed — this is a proper `placeholder` attribute value for textarea/input elements, not
  user-visible placeholder content.
```

```
[✅ OK] All placeholder="" attributes across modals (SubmissionModal, ClaimBusinessModal, AuthModal, etc.)
  Fix: None needed — these are proper HTML input placeholder attributes with meaningful text.
```

No TODO/FIXME/HACK/XXX comments found anywhere in source code.
No `alert()` calls found anywhere in source code.

---

## 2. Dead onClick Handlers

### Empty onClick / Placeholder Handlers

```
[✅ OK] No `onClick={() => {}}` (empty handler) found.
[✅ OK] No `onClick={() => alert(` (placeholder) found.
[✅ OK] No `href="#"` (dead links) found.
```

### Buttons Without onClick (Potential Issues)

```
[⚠️ WARN] src/components/AdminDashboard.jsx:256 - Disabled settings button with no future handler
  Code: <button className="btn-secondary" disabled style={{opacity: 0.5, cursor: 'not-allowed'}}>
          <SlidersHorizontal size={18} /> Settings <span ...>Soon</span>
        </button>
  Fix: This is intentionally disabled with a "Soon" badge, so acceptable. But should have an
  onClick handler ready or be removed if the feature won't ship soon.
  Severity: Warning — cosmetic dead button
```

### `prompt()` Usage (Admin-Only)

```
[⚠️ WARN] src/components/AdminDashboard.jsx:382 - Uses window.prompt() for rejection reason
  Code: const reason = prompt('Rejection reason (optional):');
  Fix: Replace with a proper modal/dialog for better UX. prompt() looks dated and doesn't match
  the app's premium design. Admin-only, so lower priority.

[⚠️ WARN] src/components/modals/AdminPanelModal.jsx:155 - Uses window.prompt() for rejection reason
  Code: const reason = prompt('Rejection reason:', 'Does not meet guidelines');
  Fix: Same as above — replace with styled modal input.
```

### `confirm()` Usage (Admin-Only)

```
[⚠️ WARN] src/App.jsx:1095 - Uses window.confirm() for content removal
  Code: if (!confirm(`Remove "${title}"? This will deactivate it from the app.`)) return;
  Fix: Replace with a styled confirmation dialog. Admin-only, lower priority.

[⚠️ WARN] src/components/BusinessDashboard.jsx:760 - Uses window.confirm() for listing deletion
  Code: if (confirm(`Delete "${listing.title}"?`)) { ... }
  Fix: Same — replace with styled dialog.

[⚠️ WARN] src/components/AdminDashboard.jsx:587 - Uses window.confirm() for venue deactivation
  Code: if (confirm(`Deactivate ${venue.name}? ...`)) { ... }
  Fix: Same — replace with styled dialog.
```

---

## 3. Missing Error Handling

### Silent Catch Blocks (No User Feedback)

```
[⚠️ WARN] src/App.jsx:102 - Silent catch in trackView RPC
  Code: } catch (e) { /* silent */ }
  Fix: Acceptable for analytics tracking — failures shouldn't interrupt user flow.
  But should log to Sentry for debugging.

[⚠️ WARN] src/App.jsx:116 - Silent catch in fetchNotifications
  Code: } catch (e) { /* silent */ }
  Fix: Acceptable for non-critical background fetch.

[⚠️ WARN] src/hooks/usePrefetch.js:23,38,53 - Silent catches in prefetch hooks
  Code: } catch { /* silent */ }
  Fix: Acceptable — prefetch is speculative, failure is non-critical.
```

### Empty Catch Blocks (localStorage)

```
[✅ OK] Multiple empty catch blocks for localStorage operations across:
  - src/App.jsx:179, 561, 569, 577, 582, 1422, 2400
  - src/components/ConsumerHeader.jsx:11, 19, 23
  Fix: None needed — localStorage can throw QuotaExceededError or be blocked by privacy settings.
  Empty catches here are idiomatic and correct.
```

### Async Functions Without Error Handling

```
[⚠️ MINOR] src/App.jsx:401-417 - fetchBusinessAnalytics is not wrapped in useCallback
  Code: const fetchBusinessAnalytics = async (businessId, days = 30) => { ... }
  Fix: Wrap in useCallback for proper dependency tracking in useEffect. Currently the function
  is recreated on every render, which is wasteful but not a bug.
```

```
[⚠️ MINOR] src/hooks/useAppData.js:63 - fetchServices is not wrapped in useCallback
  Code: const fetchServices = async (force = false) => { ... }
  Fix: Same — should be useCallback for stable reference. Currently works because it's called
  from useEffect but could cause unnecessary re-renders if passed as prop.
```

---

## 4. State Management Issues

### Unused State Variables (Write-Only)

```
[❌ MAJOR] src/App.jsx:397 - analyticsLoading state is set but never read
  Code: const [, setAnalyticsLoading] = useState(false);
  Fix: Either use the loading state to show a spinner in the business dashboard analytics section,
  or remove it entirely. The destructured-away pattern `[, setter]` is intentional but wasteful.

[⚠️ MINOR] src/hooks/useBooking.js:22-23 - iframeLoaded and iframeFailed states are set but never read
  Code: const [, setIframeLoaded] = useState(false);
        const [, setIframeFailed] = useState(false);
  Fix: Remove if no longer needed, or expose for BookingSheet to show loading/error states.
```

### eslint-disable for react-hooks/exhaustive-deps

```
[⚠️ WARN] src/App.jsx:376,380 - Analytics tracking useEffects suppress dependency warnings
  Code: }, [selectedEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  Fix: The trackAnalytics and trackView dependencies are intentionally omitted to prevent
  infinite loops. This is a known pattern but should be documented.

[⚠️ WARN] src/App.jsx:463,470 - Business data fetch useEffects suppress dependency warnings
  Code: }, [view, activeBusiness?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  Fix: fetchBusinessInbox, fetchInboxUnreadCounts, fetchBusinessAnalytics are intentionally
  omitted. Acceptable but should document why.

[⚠️ WARN] src/App.jsx:793,811 - Keyboard shortcut useEffects suppress dependency warnings
  Code: // eslint-disable-line react-hooks/exhaustive-deps
  Fix: The setters from useState are stable and don't need to be in deps. The eslint-disable
  is acceptable here. Many modal state setters are omitted.
```

---

## 5. Cross-View Modal Bug Pattern

### Modals Inside Consumer View Block

The following modals are rendered INSIDE `{view === 'consumer' && ( ... )}` (lines 1549-2100):

```
[❌ CRITICAL] src/App.jsx:1722-1747 - EventDetailModal inside consumer view block
  Code: {selectedEvent && ( <EventDetailModal ... /> )}
  Impact: If a user is in business/admin view and clicks "Preview" on an event (AdminDashboard.jsx:425-429
  sets selectedEvent), the EventDetailModal will NOT render because it's inside the consumer view block.
  The admin "Preview" button at AdminDashboard.jsx:425 calls setSelectedEvent but the modal only renders
  when view === 'consumer'.
  Fix: Move EventDetailModal to the global section (after line 2190, alongside ClaimBusinessModal,
  SubmissionModal, etc.).

[❌ CRITICAL] src/App.jsx:1750-1775 - DealDetailModal inside consumer view block
  Code: {selectedDeal && ( <DealDetailModal ... /> )}
  Impact: Same issue — if admin/business view needs to preview a deal, the modal won't render.
  Currently no admin preview triggers for deals, but the pattern is fragile.
  Fix: Move DealDetailModal to the global section.
```

```
[⚠️ MINOR] src/App.jsx:1777-1796 - ServiceDetailModal inside consumer view block
  Code: {selectedService && ( <ServiceDetailModal ... /> )}
  Impact: Same pattern. Currently only triggered from consumer ServicesGrid.
  Fix: Move to global section for consistency and future-proofing.
```

```
[⚠️ MINOR] src/App.jsx:1800-1818 - ProfileMenu inside consumer view block
  Code: {showProfileMenu && ( <ProfileMenu ... /> )}
  Impact: Profile menu only shows in consumer view. If user is in business view and somehow
  triggers it, nothing happens. This is likely intentional since business/admin have their own nav.
  Fix: Acceptable, but document the intentional scoping.
```

```
[⚠️ MINOR] src/App.jsx:1820-1858 - AddEventModal inside consumer view block
  Fix: Acceptable — "Add Event" is consumer-facing.

[⚠️ MINOR] src/App.jsx:1862-1880 - MyCalendarModal inside consumer view block
  Fix: Acceptable — calendar is consumer-facing.

[⚠️ MINOR] src/App.jsx:1904-1948 - ProfileModal inside consumer view block
  Fix: Should probably be global — profile could be accessed from business view.

[⚠️ MINOR] src/App.jsx:1949-2015 - BookingSheet and BookingConfirmation inside consumer view block
  Fix: Acceptable — booking is consumer-facing.

[⚠️ MINOR] src/App.jsx:2017-2055 - ContactSheet and MessagesModal inside consumer view block
  Fix: Should probably be global — messages could be accessed from notifications.

[⚠️ MINOR] src/App.jsx:2057-2081 - NotificationsPanel inside consumer view block
  Fix: Acceptable — notifications panel has consumer-specific content.

[⚠️ MINOR] src/App.jsx:2083-2098 - AdminPanelModal inside consumer view block
  Fix: Should arguably be in the admin view section or global.
```

### Correctly Global Modals

The following modals are correctly in the global section (after all view blocks):
- ClaimBusinessModal (line 2192) - correct
- SubmissionModal (line 2226) - correct
- EditVenueModal (line 2264) - correct
- EditEventModal (line 2280) - correct
- ImageCropperModal (line 2296) - correct
- AuthModal (line 2316) - correct

---

## 6. CSS Issues

### `position: relative !important` Override

```
[⚠️ WARN] src/styles/pulse-app.css:6813-6814 - Global override on all modal inputs
  Code: .modal-overlay input, .modal-overlay textarea, .modal-overlay select {
          position: relative !important;
          z-index: 100 !important;
        }
  Impact: This was added as a "global fix" for z-index blocking issues. It overrides positioning
  of ALL inputs inside modals, which could break custom-positioned inputs. The corresponding
  button override (line 6826) also forces `position: relative !important` and `z-index: 200 !important`.
  Fix: The close button counter-override (line 6831-6840) correctly restores `position: absolute !important`
  for .close-btn, .claim-modal-close, .auth-modal-close. This is a fragile but currently working
  system. Any new absolutely-positioned button inside a modal will need its own counter-override.
  Severity: Warning — works now but fragile architecture
```

### z-index Proliferation

```
[⚠️ WARN] src/styles/pulse-app.css - 50+ z-index declarations across the file
  Key values:
  - 9999: Install banner, skip-to-content (highest)
  - 9998: Feedback backdrop
  - 3000: Feedback modal
  - 2000: Feedback FAB, image cropper
  - 1500: Calendar toast
  - 1000: View switcher, modal overlays, all modals (most common)
  - 999: Admin dropdowns, sticky headers
  - 200: Modal buttons (forced)
  - 100: Modal inputs (forced), various controls
  Fix: Create a z-index scale/token system instead of ad-hoc values. Current system works but
  is hard to reason about. The install banner (z-index: 9999) could overlay everything including
  the feedback widget (z-index: 9998 backdrop / 3000 modal).
```

### No Duplicate Selectors Found

Checked for duplicate CSS selector definitions — no problematic duplicates detected.

---

## 7. Security

### dangerouslySetInnerHTML / eval / innerHTML

```
[✅ OK] No dangerouslySetInnerHTML usage found in any source file.
[✅ OK] No eval() usage found in any source file.
[✅ OK] No .innerHTML assignments found in any source file.
```

### Hardcoded Secrets/Tokens

```
[✅ OK] src/lib/supabase.js:3-4 - Uses environment variables correctly
  Code: const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  Fix: None needed — uses env vars. VITE_ prefix keys are exposed to client-side but Supabase
  anon key is designed to be public (RLS enforces security).
```

```
[✅ OK] src/components/modals/AuthModal.jsx:7 - Turnstile site key from env
  Code: const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  Fix: None needed — site keys are public by design.
```

### URL Construction from User Input

```
[⚠️ MINOR] src/components/modals/EventDetailModal.jsx:179 - Google Maps URL from venue name
  Code: href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getVenueName(...) + ' Squamish BC')}`}
  Fix: Uses encodeURIComponent correctly. Safe.

[⚠️ MINOR] src/components/modals/EventDetailModal.jsx:256 - Google Maps search URL
  Code: href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(...)}`}
  Fix: Uses encodeURIComponent correctly. Safe.
```

---

## 8. Null Safety

### `.length` on Potentially Null/Undefined Values

```
[❌ MAJOR] src/App.jsx:884 - .length on claimDocuments without null check
  Code: if (claimVerificationMethod === 'document' && claimDocuments.length === 0) {
  Impact: claimDocuments is initialized as [] (line 78), so this is safe in normal flow.
  However, if state somehow becomes null/undefined, this would crash.
  Fix: Use optional chaining: `claimDocuments?.length === 0`
  Severity: Minor — state is always initialized but lacks defensive coding.
```

```
[⚠️ MINOR] src/App.jsx:1567 - .filter().length on notifications
  Code: unreadNotifCount={notifications.filter(n => !n.is_read).length}
  Impact: notifications is initialized as [] (line 85) and set to data || [] (line 115).
  Should be safe.
  Fix: None strictly needed, but `(notifications || []).filter(...)` would be defensive.
```

### `.map()` on Potentially Null Values

```
[❌ MAJOR] src/App.jsx:1570-1571 - .filter().length on dbEvents without null guard
  Code: classes: dbEvents.filter(e => e.eventType === 'class').length,
        events: dbEvents.filter(e => e.eventType === 'event').length,
  Impact: dbEvents is initialized as [] and always set to mappedEvents array. Safe in normal
  flow, but if Supabase returns an error and setDbEvents is never called, the initial []
  handles it.
  Fix: None strictly needed — initialized safely.
```

```
[❌ MAJOR] src/App.jsx:865 - Optional chaining inconsistency on price
  Code: const hasFreeItems = dbEvents.some(e => e.price?.toLowerCase() === 'free');
  Impact: This correctly uses ?. on price (which can be undefined). Good pattern.
  But many other places access e.price without ?. (e.g., EventCard.jsx:197).
  Fix: Audit all e.price accesses — most are in JSX where undefined just renders nothing,
  so this is safe for display. Only problematic if calling methods on price.
```

```
[❌ MAJOR] src/components/WellnessBooking.jsx:75 - getInitials accesses w[0] without check
  Code: return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  Impact: If name contains double spaces ("John  Doe"), split produces empty strings,
  and w[0] would be undefined. `.join('')` would then produce "JundefinedD".
  Fix: Filter empty strings: `name.split(' ').filter(Boolean).map(w => w[0])...`
```

```
[❌ MAJOR] src/App.jsx:1145 - REAL_DATA.venues.forEach without checking if venues exists
  Code: REAL_DATA.venues.forEach(v => { if (v.name) suggestions.add(v.name); });
  Impact: REAL_DATA.venues is statically defined in realData.js, always exists. Safe.
  Fix: None needed.
```

### Property Access on Potentially Null Objects

```
[❌ MAJOR] src/components/EventCard.jsx:153 - venues.find without null check on result
  Code: {venues.find(v => v.id === event.venueId)?.verified && ( ... )}
  Impact: Correctly uses optional chaining on the find result. Safe.
  Fix: None needed — good use of ?.
```

```
[❌ MAJOR] src/App.jsx:421 - user.isAdmin accessed without null check
  Code: if (!user.isAdmin) return;
  Impact: user is always an object (initialized with default shape in useUserData.js:15-31).
  Safe because isAdmin defaults to false.
  Fix: None strictly needed.
```

```
[⚠️ WARN] src/hooks/useAppData.js:156 - Fallback to '09:00' for missing start_time
  Code: let startTimeStr = event.start_time || '09:00';
  Impact: This contradicts the project rule "never invent fake times." However, this is a
  display-time fallback for events already in the database, not a scraper inserting data.
  The fallback is needed to prevent runtime errors from .split(':').
  Fix: Consider flagging these events in the UI as "time not confirmed" instead of showing 9:00 AM.
```

```
[⚠️ WARN] src/hooks/useAppData.js:160-165 - Suspicious time correction logic
  Code: if (hours === 0 || (hours >= 1 && hours <= 5)) { hours = 9; minutes = 0; }
        else if (minutes === 26) { minutes = 0; }
  Impact: Silently changes midnight/early-AM events to 9 AM, and rounds :26 to :00.
  This could mask real data issues and confuse users expecting early-morning events.
  The `:26` check is oddly specific — suggests a known data corruption pattern.
  Fix: Log these corrections or tag the events as "time adjusted" for transparency.
```

---

## 9. Additional Issues Found

### Stale REAL_DATA References in Admin Dashboard

```
[❌ MAJOR] src/components/AdminDashboard.jsx:279,281,301 - Mixing REAL_DATA with dbEvents/dbDeals
  Code: <div className="stat-number">{Math.round((REAL_DATA.events.length + dbEvents.length) / 7)}</div>
        <div className="stat-change">{REAL_DATA.events.length + dbEvents.length} total instances</div>
        <div className="stat-number">{REAL_DATA.deals.length + dbDeals.length}</div>
  Impact: REAL_DATA.events/deals is stale static data. The admin dashboard shows inflated
  counts by double-counting static data with live database data. Per CLAUDE.md, REAL_DATA
  should only be used for venues lookup, not for events/deals.
  Fix: Remove REAL_DATA.events and REAL_DATA.deals references. Use only dbEvents and dbDeals
  for accurate counts.
```

### Unused State Variables (Write-Only Pattern)

```
[⚠️ MINOR] src/App.jsx:397 - analyticsLoading is set but the value is never read
  Code: const [, setAnalyticsLoading] = useState(false);
  Impact: Business dashboard has no loading indicator for analytics data. Users see stale
  data or zeros while analytics are being fetched.
  Fix: Read the loading state and pass it to BusinessDashboard to show a loading spinner.

[⚠️ MINOR] src/hooks/useBooking.js:22-23 - iframeLoaded and iframeFailed never read
  Code: const [, setIframeLoaded] = useState(false);
        const [, setIframeFailed] = useState(false);
  Impact: BookingSheet has no way to show iframe loading/error states. The iframe just
  loads (or doesn't) with no feedback.
  Fix: Expose these states and use them in BookingSheet for loading/error UI.
```

### Potential Memory Leak: Claim Cooldown Timer

```
[⚠️ MINOR] src/App.jsx:1029-1036 - Interval timer for claim resend cooldown
  Code: claimCooldownTimerRef.current = setInterval(() => { ... }, 1000);
  Impact: If the component unmounts while the cooldown is active, the interval continues.
  The ref is cleaned up in the modal close handler (line 2218) but not in a useEffect cleanup.
  Fix: Add a useEffect cleanup that clears the interval on unmount:
  useEffect(() => { return () => { if (claimCooldownTimerRef.current) clearInterval(...); }; }, []);
```

### fetchServices Missing useCallback

```
[⚠️ MINOR] src/hooks/useAppData.js:63 - fetchServices not memoized with useCallback
  Code: const fetchServices = async (force = false) => { ... }
  Impact: fetchServices is recreated on every render, causing potential unnecessary re-fetches
  when passed as a dependency to useEffect or as a prop. The function captures `services` in
  its closure but this is mitigated by the cache TTL check.
  Fix: Wrap in useCallback with appropriate dependencies, or use useRef for the function.
```

### Console Error Logging Pattern

```
[⚠️ WARN] Multiple files - console.error used for error logging instead of Sentry
  Files: App.jsx (12 instances), useMessaging.js (8), useUserData.js (1), useSubmissions.js (3),
         AdminDashboard.jsx (2), BusinessDashboard.jsx (1), EditVenueModal.jsx (1),
         EditEventModal.jsx (1), useCalendar.js (1), usePushNotifications.js (1)
  Impact: Production errors are only visible in browser console, not in error tracking.
  The app has Sentry configured (src/lib/sentry.js) but it's not used in catch blocks.
  Fix: Replace console.error calls with Sentry.captureException for production error visibility.
  Keep console.error for development only.
```

---

## 10. Positive Findings

The following patterns are well-implemented:

1. **No `alert()` calls** - All user feedback uses the toast system (`showToast`)
2. **No `href="#"`** - All navigation uses proper handlers
3. **No `dangerouslySetInnerHTML`** - No XSS vectors
4. **No hardcoded secrets** - All credentials from env vars
5. **Optional chaining used widely** - Most property accesses are null-safe
6. **Error boundaries** exist (`src/components/ErrorBoundary.jsx`)
7. **Rate limiting** implemented in messaging (`useMessaging.js:92-103`)
8. **Optimistic UI updates** with proper rollback on failure (`toggleSave`)
9. **CAPTCHA integration** for auth (`AuthModal.jsx` with Turnstile)
10. **Proper cleanup** in most useEffect hooks (event listeners, timers)
11. **Global modals** for cross-view features (Claim, Submission, Edit, Auth) are correctly placed
12. **Pull-to-refresh** and **infinite scroll** are well-implemented
13. **Timezone-aware** date handling using `getPacificNow()` and `PACIFIC_TZ`

---

## Priority Fix List

### Immediate (Critical)

1. **Move EventDetailModal to global section** (App.jsx) — Admin preview feature is broken
2. **Move DealDetailModal to global section** (App.jsx) — Prevent future cross-view issues

### High (Major)

3. **Remove REAL_DATA.events/deals from AdminDashboard** — Shows inflated/inaccurate counts
4. **Fix getInitials double-space bug** (WellnessBooking.jsx:75) — Filter empty strings from split
5. **Expose analyticsLoading state** to BusinessDashboard for loading UI
6. **Expose iframeLoaded/iframeFailed** to BookingSheet for loading/error UI
7. **Add useEffect cleanup** for claim cooldown timer interval

### Medium (Minor)

8. **Replace prompt()/confirm()** in admin views with styled dialogs
9. **Add Sentry error tracking** to catch blocks instead of console.error
10. **Document the time-correction logic** in useAppData.js (hours 0-5 -> 9, :26 -> :00)
11. **Wrap fetchServices in useCallback** for stable reference
12. **Add defensive null checks** on claimDocuments.length

---

*Generated by code-level QA audit (not browser testing). Verify critical issues with live testing.*
