# Pulse App - Comprehensive Test List

This document contains an exhaustive list of all features and testable actions in the Pulse app. Each action should be tested in multiple user states (guest, logged in) and from various navigation paths.

## User States to Test
- **Guest User**: Not signed in
- **Authenticated User**: Signed in with account
- **Business Owner**: User with claimed business
- **Admin User**: User with admin privileges

---

## 1. NAVIGATION & TABS

### 1.1 Tab Navigation
- [ ] Click "Classes" tab → shows classes content, tab becomes active
- [ ] Click "Events" tab → shows events content, tab becomes active
- [ ] Click "Deals" tab → shows deals content, tab becomes active
- [ ] Click "Services" tab → shows services content, tab becomes active
- [ ] Tab active state persists after scrolling
- [ ] Tab active state updates correctly when switching

### 1.2 View Switcher
- [ ] Click "Consumer" button → shows consumer view
- [ ] Click "Business" button → shows business view
- [ ] Click "Admin" button (if admin) → shows admin view
- [ ] View switcher visible in all views
- [ ] Active view button has correct styling

---

## 2. SEARCH FUNCTIONALITY

### 2.1 Search Input
- [ ] Search placeholder updates based on current tab ("Search classes...", "Search events...", etc.)
- [ ] Type in search → results filter in real-time
- [ ] Search is debounced (doesn't filter on every keystroke)
- [ ] Clear button appears when text is entered
- [ ] Click clear button → clears search input
- [ ] Results count updates based on search query
- [ ] Empty search → shows all results

### 2.2 Search Per Tab
- [ ] Search in Classes tab filters classes only
- [ ] Search in Events tab filters events only
- [ ] Search in Deals tab filters deals only
- [ ] Search in Services tab filters services only
- [ ] Search persists when switching tabs (or clears - document behavior)

---

## 3. FILTERS

### 3.1 Category Filters
- [ ] Deal category dropdown shows all categories
- [ ] Select category → filters deals to that category
- [ ] "All" option shows all deals
- [ ] Service category dropdown shows all categories
- [ ] Select service category → filters services
- [ ] Results count updates with filter

### 3.2 Filter Button/Panel
- [ ] Click filter button → opens filter panel
- [ ] Close filter panel → panel hides
- [ ] Filter options display correctly
- [ ] Select filter option → applies filter
- [ ] Multiple filters can be combined
- [ ] Reset filters → shows all results

### 3.3 Age Group Filters (Classes/Events)
- [ ] Age range buttons visible (All Ages, Kids 0-4, Kids 5-8, etc.)
- [ ] Click age range → filters events by age group
- [ ] "All Ages" shows all events
- [ ] Selected age range has active styling

---

## 4. CLASS/EVENT CARDS

### 4.1 Card Display
- [ ] Cards load and display correctly
- [ ] Card shows title, venue, time, date
- [ ] Card shows tags/categories
- [ ] Card shows price (if available)
- [ ] Featured events have special styling
- [ ] Recurring events show recurrence indicator

### 4.2 Card Interactions (Guest)
- [ ] Click card → opens detail modal
- [ ] Click save button → prompts to sign in (or saves locally)
- [ ] Click share button → opens share options
- [ ] Click book button → opens booking sheet or prompts sign in

### 4.3 Card Interactions (Authenticated)
- [ ] Click card → opens detail modal
- [ ] Click save button → toggles saved state
- [ ] Saved items appear in profile saved tab
- [ ] Click share button → opens share options
- [ ] Click book button → opens booking sheet

---

## 5. EVENT DETAIL MODAL

### 5.1 Modal Display
- [ ] Modal opens when clicking event card
- [ ] Shows event title, description
- [ ] Shows date and time formatted correctly
- [ ] Shows venue name and address
- [ ] Shows price information
- [ ] Shows event tags/categories
- [ ] Shows age group information
- [ ] Shows recurrence info (if recurring)

### 5.2 Modal Actions
- [ ] Click X button → closes modal
- [ ] Click overlay → closes modal
- [ ] Click "Add to Calendar" → adds to personal calendar (authenticated)
- [ ] Click "Book Now" → opens booking sheet
- [ ] Click save icon → toggles saved state
- [ ] Click "Register" → registers for event (authenticated)
- [ ] Click share → opens share options

### 5.3 Booking Flow
- [ ] "Book Now" opens booking bottom sheet
- [ ] External booking URL opens in new tab (if available)
- [ ] "Add to Calendar" button in sheet works
- [ ] Request booking form submits correctly (for manual booking)
- [ ] Booking confirmation dialog appears after booking
- [ ] Confirm "Yes, I booked" → adds to calendar
- [ ] Confirm "No, just browsing" → closes without adding

---

## 6. DEAL CARDS & MODAL

### 6.1 Deal Card Display
- [ ] Deal cards load correctly
- [ ] Shows deal title and description
- [ ] Shows savings percentage (if available)
- [ ] Shows business name
- [ ] Shows schedule/availability
- [ ] Shows category

### 6.2 Deal Card Interactions
- [ ] Click card → opens deal detail modal
- [ ] Click save button → toggles saved state
- [ ] Click share button → opens share options

### 6.3 Deal Detail Modal
- [ ] Modal opens correctly
- [ ] Shows full deal details
- [ ] Shows business information
- [ ] Shows terms and conditions
- [ ] Shows schedule/valid times
- [ ] Shows related deals from same business

### 6.4 Deal Redemption (Authenticated)
- [ ] Click "Redeem Deal" → generates redemption code
- [ ] Redemption code displays in toast
- [ ] Code can be copied to clipboard
- [ ] Redemption is tracked in database
- [ ] User XP is awarded for redemption

---

## 7. SERVICE CARDS & MODAL

### 7.1 Service Card Display
- [ ] Service cards load correctly
- [ ] Shows business name
- [ ] Shows category
- [ ] Shows rating and review count
- [ ] Shows address
- [ ] Shows phone (if available)

### 7.2 Service Card Interactions
- [ ] Click card → opens service detail modal
- [ ] Click call button → initiates phone call (if phone available)
- [ ] Click save button → toggles saved state

### 7.3 Service Detail Modal
- [ ] Modal opens correctly
- [ ] Shows full business details
- [ ] Shows rating with stars
- [ ] Shows address with directions link
- [ ] Shows phone with call link
- [ ] Shows website with external link
- [ ] Shows email with mailto link

### 7.4 Service Rating/Review
- [ ] Star rating input visible
- [ ] Hover over stars → shows hover state
- [ ] Click stars → sets rating
- [ ] Write review textarea visible
- [ ] Submit review → saves review (authenticated)
- [ ] Reviews display correctly

### 7.5 Contact Business
- [ ] Click "Contact" → opens contact sheet
- [ ] Subject field accepts input
- [ ] Message field accepts input (required)
- [ ] Send button enabled when message entered
- [ ] Submit → sends message (authenticated)
- [ ] Success toast appears after sending

---

## 8. AUTHENTICATION MODAL

### 8.1 Modal Access
- [ ] Click profile button (guest) → opens auth modal
- [ ] Click "Sign In" in business view → opens auth modal
- [ ] Protected actions → redirect to auth modal

### 8.2 Sign In Flow
- [ ] Modal shows "Welcome Back" header
- [ ] Email input accepts text
- [ ] Password input accepts text (type=password)
- [ ] "Continue with Google" button visible
- [ ] Click Google → redirects to Google OAuth
- [ ] Submit email/password → signs in
- [ ] Invalid credentials → shows error message
- [ ] Modal closes after successful sign in

### 8.3 Sign Up Flow
- [ ] Click "Sign Up" link → switches to sign up mode
- [ ] Name input appears in sign up mode
- [ ] Email input accepts text
- [ ] Password input accepts text (min 6 chars)
- [ ] Submit → creates account
- [ ] Validation errors display correctly
- [ ] Modal closes after successful sign up

### 8.4 Modal Interactions
- [ ] Click X button → closes modal
- [ ] Click overlay → closes modal
- [ ] Toggle between Sign In and Sign Up
- [ ] Error messages clear when switching modes

---

## 9. PROFILE MENU (Authenticated)

### 9.1 Menu Access
- [ ] Click profile button → opens profile menu dropdown
- [ ] Avatar shows user photo or initials
- [ ] Menu shows user name and email
- [ ] Menu shows level and XP

### 9.2 Menu Options
- [ ] Click "My Profile" → opens profile modal (overview tab)
- [ ] Click "My Calendar" → opens calendar modal
- [ ] Click "Saved Items" → opens profile modal (saved tab)
- [ ] Click "Submit Event/Deal" → opens submission modal
- [ ] Click "Claim Business" → opens claim business modal
- [ ] Click "Admin Panel" (if admin) → opens admin panel
- [ ] Click "Settings" → opens profile modal (settings tab)
- [ ] Click "Sign Out" → signs out user

### 9.3 Menu Behavior
- [ ] Click outside menu → closes menu
- [ ] Click overlay → closes menu

---

## 10. PROFILE MODAL

### 10.1 Profile Header
- [ ] Cover photo displays (or placeholder)
- [ ] Avatar photo displays (or initials)
- [ ] Edit cover photo button works
- [ ] Edit avatar button works
- [ ] User name displays
- [ ] User location displays (if set)

### 10.2 Profile Tabs
- [ ] "Overview" tab shows overview content
- [ ] "Activity" tab shows activity feed
- [ ] "Saved" tab shows saved items
- [ ] "Businesses" tab switches to business view
- [ ] "Settings" tab shows settings form

### 10.3 Overview Tab
- [ ] Level card shows current level
- [ ] XP progress bar displays
- [ ] XP to next level shown
- [ ] Day streak displays
- [ ] Community rank displays
- [ ] Hero score displays
- [ ] Bio section shows bio
- [ ] Interests tags display
- [ ] Stats grid shows (events attended, classes completed, etc.)
- [ ] Achievements grid shows earned/locked achievements
- [ ] Recent activity preview shows

### 10.4 Activity Tab
- [ ] Activity filters visible (All, Events, Classes, Deals, Reviews)
- [ ] Activity list shows all activities
- [ ] Click filter → filters activities
- [ ] Activity items show type icon, title, business, date

### 10.5 Saved Tab
- [ ] Saved tabs (Events, Classes, Deals, Businesses)
- [ ] Count shows for each category
- [ ] Click tab → filters to that type
- [ ] Saved items display correctly
- [ ] Click remove button → removes item
- [ ] Empty state shows when no saved items

### 10.6 Settings Tab
- [ ] Name input shows current name
- [ ] Email input shows current email
- [ ] Phone input shows current phone
- [ ] Bio textarea shows current bio
- [ ] Notification toggles work (Event Reminders, New Deals, Weekly Digest, Business Updates)
- [ ] Privacy toggles work (Show Activity, Show Saved Items, Show Attendance)
- [ ] Interest buttons selectable
- [ ] "Save Profile" button saves changes
- [ ] Toast shows success/error after save
- [ ] "Delete Account" button in danger zone

---

## 11. MY CALENDAR MODAL

### 11.1 Calendar Display
- [ ] Modal opens correctly
- [ ] Calendar header shows month/year
- [ ] Day grid displays correctly
- [ ] Today is highlighted
- [ ] Days with events have indicators

### 11.2 Registered Events
- [ ] Registered events list shows
- [ ] Events display title, venue, date, time
- [ ] Click remove → removes from calendar
- [ ] Empty state when no registered events

### 11.3 Navigation
- [ ] Click "Browse Events" → closes modal and goes to events tab
- [ ] Click X → closes modal

---

## 12. SUBMISSION MODAL (Submit Event/Class/Deal)

### 12.1 Step 1 - Type Selection
- [ ] Three options: Event, Class, Deal
- [ ] Click Event → proceeds to step 2
- [ ] Click Class → proceeds to step 2
- [ ] Click Deal → proceeds to step 2
- [ ] Selected type shown in header

### 12.2 Step 2 - Business Selection
- [ ] Claimed businesses list shows (if user has claimed)
- [ ] "Submit for new business" option available
- [ ] "Submit as individual" option available
- [ ] Select option → enables form

### 12.3 Step 2 - Form Fields
- [ ] Title input required
- [ ] Description textarea
- [ ] Category dropdown
- [ ] Date picker (for events/classes)
- [ ] Time picker
- [ ] Price input
- [ ] Image upload (square and banner)
- [ ] Image cropper works
- [ ] Remove image button works

### 12.4 Step 3 - Submission
- [ ] Submit button sends to database
- [ ] Loading state during submission
- [ ] Success step shows after submission
- [ ] "Done" button closes modal

### 12.5 Image Cropper
- [ ] Cropper opens when image selected
- [ ] Drag to reposition
- [ ] Zoom slider/buttons work
- [ ] "Apply Crop" saves cropped image
- [ ] "Cancel" discards changes

---

## 13. CLAIM BUSINESS MODAL

### 13.1 Guest User
- [ ] Shows "Sign In Required" message
- [ ] Sign In button opens auth modal

### 13.2 Authenticated User
- [ ] Form shows: Business Name, Owner Name, Email, Phone, Role, Address
- [ ] All fields accept input
- [ ] Role dropdown works (owner, manager, employee)
- [ ] Submit button enabled when required fields filled
- [ ] Submit → sends claim request
- [ ] Loading state during submission
- [ ] Success/error toast after submission
- [ ] Modal closes on cancel

---

## 14. BOOKING SHEET

### 14.1 External Booking (businesses with booking URL)
- [ ] Sheet opens at bottom
- [ ] Shows booking system badge (Mindbody, WellnessLiving, etc.)
- [ ] "Open Booking Page" button links to external URL
- [ ] "Add to Calendar" button works
- [ ] Close button/overlay closes sheet

### 14.2 Request Booking (no external URL)
- [ ] Request form shows
- [ ] Info card explains process
- [ ] Message textarea accepts input
- [ ] "Send Booking Request" submits
- [ ] Success state after sending

### 14.3 Booking Confirmation
- [ ] Dialog appears after external booking
- [ ] "Yes, I booked" adds to calendar
- [ ] "No, just browsing" dismisses

---

## 15. MESSAGES MODAL

### 15.1 Conversations List
- [ ] Modal opens correctly
- [ ] Shows list of conversations
- [ ] Each conversation shows business name, last message preview, time
- [ ] Unread indicator if unread
- [ ] Click conversation → opens message thread

### 15.2 Message Thread
- [ ] Back button returns to list
- [ ] Shows conversation with business
- [ ] Messages display with timestamp
- [ ] Message input field
- [ ] Send button submits message
- [ ] New messages appear in thread

### 15.3 Empty States
- [ ] Empty conversations list shows appropriate message
- [ ] "Start Conversation" prompt (if applicable)

---

## 16. BUSINESS VIEW

### 16.1 Guest Access
- [ ] Shows "Sign In Required" message
- [ ] Sign In button opens auth modal

### 16.2 No Claimed Business
- [ ] Shows welcome message
- [ ] Shows benefits grid (Track Performance, Grow Audience, etc.)
- [ ] "Claim Your Business" button opens claim modal

### 16.3 With Claimed Business
- [ ] Business header shows name, address
- [ ] Logo upload button works
- [ ] Verified badge shows (if verified)
- [ ] Business selector dropdown (if multiple businesses)

### 16.4 Pulse Score Card
- [ ] Score ring displays
- [ ] Score breakdown shows (Profile, Engagement, Response, Quality)
- [ ] Progress bars display

### 16.5 Time Period Selector
- [ ] "Last 30 Days" button works
- [ ] "Last 90 Days" button works
- [ ] "This Year" button works
- [ ] "All Time" button works

### 16.6 Analytics Grid
- [ ] Profile Views stat shows with chart
- [ ] Class/Event Views stat shows
- [ ] Booking Clicks stat shows
- [ ] Messages stat shows
- [ ] All stats show trend indicators

### 16.7 Weekly Goals
- [ ] Goals list displays
- [ ] Completed goals show check
- [ ] In-progress goals show progress
- [ ] XP rewards shown for each goal

### 16.8 Business Badges
- [ ] Badge grid displays
- [ ] Earned badges highlighted
- [ ] Locked badges grayed out
- [ ] Shows X/10 earned

### 16.9 Growth Tips
- [ ] Tips cards display
- [ ] Action buttons work (Create Deal, Edit Profile, etc.)

### 16.10 Score Improvement Tips
- [ ] Score cards for Engagement, Response Rate, Content Quality, Customer Satisfaction
- [ ] Progress bars show scores
- [ ] Action items listed
- [ ] Pending items highlighted

### 16.11 Quick Actions
- [ ] "New Event" button opens submission modal
- [ ] "New Deal" button opens submission modal
- [ ] "Edit Profile" button opens edit
- [ ] "Full Analytics" button opens analytics

### 16.12 Business Inbox
- [ ] Bookings tab shows booking requests
- [ ] Messages tab shows customer messages
- [ ] Reply functionality works

---

## 17. ADMIN PANEL

### 17.1 Access
- [ ] Only visible to admin users
- [ ] Opens from profile menu

### 17.2 Submissions Review
- [ ] Tabs: Pending, Approved, Rejected
- [ ] Pending count shows in badge
- [ ] Submission cards show type, title, business, description
- [ ] "Approve" button approves submission
- [ ] "Reject" button rejects submission
- [ ] Empty state when no pending submissions

---

## 18. ADD EVENT MODAL (Personal Calendar)

### 18.1 Form
- [ ] Modal opens from FAB or profile menu
- [ ] Title input required
- [ ] Date picker
- [ ] Time picker
- [ ] Category dropdown
- [ ] Description textarea
- [ ] "Add Event" submits
- [ ] "Cancel" closes modal

---

## 19. FLOATING ACTION BUTTON (FAB)

### 19.1 Display
- [ ] FAB visible in consumer view
- [ ] Plus icon displayed
- [ ] Correct styling/position

### 19.2 Action
- [ ] Click FAB → opens add event modal

---

## 20. TOAST NOTIFICATIONS

### 20.1 Appearance
- [ ] Toast appears at correct position
- [ ] Toast shows message text
- [ ] Toast auto-dismisses after timeout

### 20.2 Triggers
- [ ] Profile save → success/error toast
- [ ] Event registration → toast
- [ ] Deal redemption → toast with code
- [ ] Item saved → toast
- [ ] Message sent → toast
- [ ] Booking request sent → toast
- [ ] Error states → error toast

---

## 21. RESPONSIVE BEHAVIOR

### 21.1 Mobile
- [ ] App fits mobile viewport
- [ ] Touch interactions work
- [ ] Modals properly sized
- [ ] Bottom sheets work
- [ ] Scrolling works correctly

### 21.2 Desktop
- [ ] App centered properly
- [ ] Modals centered
- [ ] Click interactions work
- [ ] Hover states visible

---

## 22. DATA LOADING

### 22.1 Initial Load
- [ ] Classes load from Supabase
- [ ] Events load correctly
- [ ] Deals load correctly
- [ ] Services load correctly
- [ ] User data loads (if authenticated)
- [ ] Saved items load

### 22.2 Loading States
- [ ] Skeleton/loading indicators show during load
- [ ] Error states handle gracefully
- [ ] Empty states show when no data

---

## 23. ERROR HANDLING

### 23.1 Network Errors
- [ ] Failed API calls show error message
- [ ] Retry functionality where applicable
- [ ] App doesn't crash on errors

### 23.2 Form Validation
- [ ] Required fields validated
- [ ] Email format validated
- [ ] Password length validated
- [ ] Error messages display

---

## 24. KEYBOARD & ACCESSIBILITY

### 24.1 Keyboard Navigation
- [ ] Tab through interactive elements
- [ ] Enter to submit forms
- [ ] Escape to close modals
- [ ] Focus visible on interactive elements

### 24.2 Screen Reader
- [ ] Alt text on images
- [ ] ARIA labels where needed
- [ ] Semantic HTML structure

---

## 25. SHARING

### 25.1 Share Options
- [ ] Share button opens share sheet
- [ ] Copy link option
- [ ] Social share options (if implemented)
- [ ] Share works for events, deals, services

---

## 26. EXTERNAL LINKS

### 26.1 Link Behavior
- [ ] Website links open in new tab
- [ ] Phone links open dialer
- [ ] Email links open mail client
- [ ] Directions links open maps
- [ ] Booking links open correctly

---

## Test Execution Notes

**For each feature above, test in these scenarios:**

1. **As Guest User**
   - Test that features requiring auth properly prompt for sign in
   - Test that guest-accessible features work

2. **As Authenticated User**
   - Test full functionality
   - Test data persistence

3. **From Different Navigation Paths**
   - Navigate via tabs
   - Navigate via search
   - Navigate via saved items
   - Navigate via profile menu
   - Deep links (if applicable)

4. **Edge Cases**
   - Empty data states
   - Very long text
   - Missing optional data
   - Slow network conditions
   - Rapid repeated actions

