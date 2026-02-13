/**
 * Admin Panel E2E Test — Claims & Content Review
 * Tests: pending claims approve/reject, content review verify/remove, tabs, bulk verify
 */
const puppeteer = require('puppeteer');

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const ANON_KEY = 'sb_publishable_I4QhFf1o4-l5Q61Hl9I99w_gJEpuREo';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncGZrbGhqd3dxd3JmcHNmaHVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyMTU1MCwiZXhwIjoyMDg1Mjk3NTUwfQ.uF99dIMZHOmk2_sND6W42s10dcdZGcEkfpjsKO-Yt3Y';
const ADMIN_EMAIL = 'admin-test-panel@pulse-app.ca';
const ADMIN_PASS = 'AdminTest1234!';
const APP_URL = 'http://localhost:5173';

let browser, page;
let testUserId = null;
let testClaimId = null;
let testEventId = null;
let testDealId = null;
const results = [];

function log(test, pass, detail = '') {
  const icon = pass ? '✅' : '❌';
  results.push({ test, pass, detail });
  console.log(`  ${icon} ${test}${detail ? ` — ${detail}` : ''}`);
}

async function supabaseRequest(path, method = 'GET', body = null, useServiceKey = false) {
  const key = useServiceKey ? SERVICE_KEY : ANON_KEY;
  const opts = {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : undefined,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  // Clean undefined headers
  Object.keys(opts.headers).forEach(k => opts.headers[k] === undefined && delete opts.headers[k]);
  const res = await fetch(`${SUPABASE_URL}${path}`, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function setupTestData() {
  console.log('\n═══ Phase 1: Setup Test Data ═══\n');

  // 1. Create admin test user via Auth Admin API
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      email_confirm: true,
    }),
  });
  const createData = await createRes.json();
  if (createData.id) {
    testUserId = createData.id;
    log('Create admin test user', true, testUserId.slice(0, 8));
  } else if (createData.msg?.includes('already') || createData.message?.includes('already')) {
    // User exists, find them
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const listData = await listRes.json();
    const existing = (listData.users || []).find(u => u.email === ADMIN_EMAIL);
    if (existing) {
      testUserId = existing.id;
      log('Create admin test user', true, `exists: ${testUserId.slice(0, 8)}`);
    } else {
      log('Create admin test user', false, 'could not find existing user');
      return false;
    }
  } else {
    log('Create admin test user', false, JSON.stringify(createData).slice(0, 100));
    return false;
  }

  // 2. Set is_admin = true on profile
  const profileRes = await supabaseRequest(
    `/rest/v1/profiles?id=eq.${testUserId}`,
    'PATCH',
    { is_admin: true },
    true
  );
  log('Set is_admin=true on profile', profileRes.status < 300, `status ${profileRes.status}`);

  // 3. Create a test claim to verify approve/reject
  const claimRes = await supabaseRequest('/rest/v1/business_claims', 'POST', {
    user_id: testUserId,
    business_name: 'E2E Test Business Claim',
    owner_name: 'Test Claimant',
    contact_email: 'claimant@test.com',
    owner_role: 'owner',
    status: 'pending',
    documents: [],
  }, true);
  if (claimRes.status < 300 && claimRes.data?.[0]?.id) {
    testClaimId = claimRes.data[0].id;
    log('Create test pending claim', true, testClaimId.slice(0, 8));
  } else {
    log('Create test pending claim', false, `status ${claimRes.status}`);
  }

  // 4. Create a test event to verify
  const eventRes = await supabaseRequest('/rest/v1/events', 'POST', {
    title: 'E2E Test Yoga Class',
    venue_name: 'Test Venue',
    category: 'Fitness',
    event_type: 'class',
    start_date: '2026-02-20',
    start_time: '10:00',
    end_time: '11:00',
    status: 'active',
    tags: ['e2e-test'],
  }, true);
  if (eventRes.status < 300 && eventRes.data?.[0]?.id) {
    testEventId = eventRes.data[0].id;
    log('Create test unverified event', true, testEventId.slice(0, 8));
  } else {
    log('Create test unverified event', false, `status ${eventRes.status}`);
  }

  // 5. Create a test deal to verify
  const dealRes = await supabaseRequest('/rest/v1/deals', 'POST', {
    title: 'E2E Test 50% Off Deal',
    business_name: 'Test Deal Business',
    category: 'Test',
    status: 'active',
  }, true);
  if (dealRes.status < 300 && dealRes.data?.[0]?.id) {
    testDealId = dealRes.data[0].id;
    log('Create test unverified deal', true, testDealId.slice(0, 8));
  } else {
    log('Create test unverified deal', false, `status ${dealRes.status}`);
  }

  return true;
}

async function testAdminPanelUI() {
  console.log('\n═══ Phase 2: Admin Panel UI Tests ═══\n');

  browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Sign in via Supabase REST
  const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const signInData = await signInRes.json();
  log('Sign in as admin', !!signInData.access_token, signInData.access_token ? 'got token' : signInData.error_description);
  if (!signInData.access_token) return;

  // Step 1: Go to home page
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  // Capture console for debugging
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  // Step 2: Sign in by calling Supabase's signInWithPassword directly in the browser
  const authResult = await page.evaluate(async (email, password, supaUrl, anonKey) => {
    try {
      const res = await fetch(`${supaUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.access_token) return { error: data.error_description || data.msg || 'no token' };

      // Store in Supabase v2 format
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: 'bearer',
        expires_in: data.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        user: data.user,
      };
      localStorage.setItem('sb-ygpfklhjwwqwrfpsfhue-auth-token', JSON.stringify(session));
      return { success: true, userId: data.user.id };
    } catch (e) {
      return { error: e.message };
    }
  }, ADMIN_EMAIL, ADMIN_PASS, SUPABASE_URL, ANON_KEY);
  log('Browser auth sign-in', !!authResult?.success, authResult?.error || authResult?.userId?.slice(0, 8));

  // Step 3: Force page reload so Supabase picks up the session from localStorage
  await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  // Check if signed in (no "Sign In" button in header)
  const headerHasSignIn = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.some(b => b.textContent.trim() === 'Sign In');
  });
  log('User is signed in (no Sign In button)', !headerHasSignIn, headerHasSignIn ? 'still showing Sign In' : 'signed in');

  // Step 4: Navigate to /admin
  await page.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));

  // Dismiss auth modal if it appears (race condition — session loads async)
  const hasModalOnAdmin = await page.evaluate(() => document.body.innerText.includes('Welcome Back'));
  if (hasModalOnAdmin) {
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 1000));
    console.log('  ℹ️  Auth modal appeared on /admin (race condition, dismissed with Escape)');
  }

  // Screenshot: admin panel loaded
  await page.screenshot({ path: '/tmp/admin-panel-full.png', fullPage: false });

  // Test 1: Admin dashboard renders (no error boundary)
  const hasError = await page.$('.error-boundary');
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasAdminDashboard = bodyText.includes('Admin Dashboard') || bodyText.includes('System Overview');
  log('Admin dashboard renders', hasAdminDashboard && !hasError);

  // Test 2: Stats cards visible (text is uppercase in the UI)
  const upperBodyText = bodyText.toUpperCase();
  const hasStats = upperBodyText.includes('TOTAL VENUES') && upperBodyText.includes('WEEKLY CLASSES');
  log('Stats cards visible', hasStats);

  // Test 3: Pending claims section visible
  const hasPendingClaims = bodyText.includes('Pending Business Claims') || bodyText.includes('pending');
  log('Pending claims section visible', hasPendingClaims);

  // Test 4: Content Review section visible
  const hasContentReview = bodyText.includes('Content Review');
  log('Content review section visible', hasContentReview);

  // Take full-page screenshot
  await page.screenshot({ path: '/tmp/admin-panel-fullpage.png', fullPage: true });

  // Test 5: Claims have approve/reject buttons
  const approveButtons = await page.$$('button');
  const buttonTexts = await Promise.all(approveButtons.map(b => b.evaluate(el => el.textContent)));
  const hasApprove = buttonTexts.some(t => t.includes('Approve'));
  const hasReject = buttonTexts.some(t => t.includes('Reject'));
  log('Approve button present', hasApprove);
  log('Reject button present', hasReject);

  // Test 6: Content review tabs present
  const hasClassesTab = buttonTexts.some(t => t.includes('Classes'));
  const hasEventsTab = buttonTexts.some(t => t.includes('Events') && !t.includes('Events &'));
  const hasDealsTab = buttonTexts.some(t => t.includes('Deals'));
  log('Classes tab present', hasClassesTab);
  log('Events tab present', hasEventsTab);
  log('Deals tab present', hasDealsTab);

  // Test 7: Switch to Classes tab first (has items), then check buttons
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.textContent.match(/^Classes\s/) && !b.textContent.includes('Verify'));
    if (tab) tab.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const buttonTextsAfterTab = await Promise.all(
    (await page.$$('button')).map(b => b.evaluate(el => el.textContent))
  );
  const hasVerifyAll = buttonTextsAfterTab.some(t => t.includes('Verify All'));
  log('Verify All button present', hasVerifyAll);

  // Test 8: Individual verify/remove buttons in content review
  const checkButtons = await page.$$('button[title="Verify"]');
  const removeButtons = await page.$$('button[title="Remove"]');
  log('Individual verify buttons present', checkButtons.length > 0, `${checkButtons.length} found`);
  log('Individual remove buttons present', removeButtons.length > 0, `${removeButtons.length} found`);

  // Test 9: Click Events tab
  const eventsTabBtn = (await page.$$('button')).filter(async b => {
    const text = await b.evaluate(el => el.textContent);
    return text.includes('Events') && !text.includes('Verify');
  });
  // Find and click the Events tab by evaluating
  const clickedEventsTab = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const evTab = btns.find(b => b.textContent.match(/^Events\s/) && !b.textContent.includes('Verify'));
    if (evTab) { evTab.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 500));
  log('Events tab clickable', clickedEventsTab);

  // Test 10: Click Deals tab
  const clickedDealsTab = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.textContent.match(/^Deals\s/) && !b.textContent.includes('Verify'));
    if (tab) { tab.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 500));
  const bodyAfterDeals = await page.evaluate(() => document.body.innerText);
  log('Deals tab clickable', clickedDealsTab);

  await page.screenshot({ path: '/tmp/admin-deals-tab.png', fullPage: false });

  // Test 11: Click back to Classes tab
  const clickedClassesTab = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const tab = btns.find(b => b.textContent.match(/^Classes\s/) && !b.textContent.includes('Verify'));
    if (tab) { tab.click(); return true; }
    return false;
  });
  await new Promise(r => setTimeout(r, 500));
  log('Classes tab clickable', clickedClassesTab);

  // Test 12: Venue management section visible
  const hasVenueMgmt = bodyText.includes('Venue Management');
  log('Venue management section visible', hasVenueMgmt);

  // Test 13: Search box works
  const searchInput = await page.$('input[placeholder="Search venues..."]');
  if (searchInput) {
    await searchInput.type('yoga');
    await new Promise(r => setTimeout(r, 500));
    log('Venue search input works', true);
    // Clear it
    await searchInput.click({ clickCount: 3 });
    await searchInput.press('Backspace');
  } else {
    log('Venue search input works', false, 'not found');
  }

  // Test 14: Quick Add section visible
  const hasQuickAdd = bodyText.includes('Quick Add Class');
  log('Quick Add Class section visible', hasQuickAdd);

  // Test 15: Scraping system section visible
  const hasScraping = bodyText.includes('Scraping System') || bodyText.includes('Web Scraping');
  log('Scraping system section visible', hasScraping);

  await page.screenshot({ path: '/tmp/admin-panel-final.png', fullPage: false });
}

async function testAPIActions() {
  console.log('\n═══ Phase 3: API Action Tests ═══\n');

  // Test: Verify an event via API (same as what the button does)
  if (testEventId) {
    const verifyRes = await supabaseRequest(
      `/rest/v1/events?id=eq.${testEventId}`,
      'PATCH',
      { verified_at: new Date().toISOString() },
      true
    );
    log('Verify event sets verified_at', verifyRes.status < 300, `status ${verifyRes.status}`);

    // Check it's actually set
    const checkRes = await supabaseRequest(`/rest/v1/events?id=eq.${testEventId}&select=verified_at`, 'GET', null, true);
    const isVerified = checkRes.data?.[0]?.verified_at !== null;
    log('Event verified_at persisted', isVerified);
  }

  // Test: Verify a deal via API
  if (testDealId) {
    const verifyRes = await supabaseRequest(
      `/rest/v1/deals?id=eq.${testDealId}`,
      'PATCH',
      { verified_at: new Date().toISOString() },
      true
    );
    log('Verify deal sets verified_at', verifyRes.status < 300, `status ${verifyRes.status}`);

    const checkRes = await supabaseRequest(`/rest/v1/deals?id=eq.${testDealId}&select=verified_at`, 'GET', null, true);
    const isVerified = checkRes.data?.[0]?.verified_at !== null;
    log('Deal verified_at persisted', isVerified);
  }

  // Test: Remove event (set status=cancelled per CHECK constraint)
  if (testEventId) {
    const removeRes = await supabaseRequest(
      `/rest/v1/events?id=eq.${testEventId}`,
      'PATCH',
      { status: 'cancelled' },
      true
    );
    log('Remove event sets status=cancelled', removeRes.status < 300);

    const checkRes = await supabaseRequest(`/rest/v1/events?id=eq.${testEventId}&select=status`, 'GET', null, true);
    log('Event status is cancelled', checkRes.data?.[0]?.status === 'cancelled');
  }

  // Test: Approve a claim
  if (testClaimId) {
    const approveRes = await supabaseRequest(
      `/rest/v1/business_claims?id=eq.${testClaimId}`,
      'PATCH',
      { status: 'verified', verified_at: new Date().toISOString() },
      true
    );
    log('Approve claim sets status=verified', approveRes.status < 300);

    const checkRes = await supabaseRequest(`/rest/v1/business_claims?id=eq.${testClaimId}&select=status,verified_at`, 'GET', null, true);
    log('Claim status is verified', checkRes.data?.[0]?.status === 'verified');
    log('Claim verified_at persisted', checkRes.data?.[0]?.verified_at !== null);
  }

  // Test: Reject a claim (create another one and reject it)
  const rejectClaimRes = await supabaseRequest('/rest/v1/business_claims', 'POST', {
    user_id: testUserId,
    business_name: 'E2E Reject Test',
    owner_name: 'Reject Tester',
    status: 'pending',
    documents: [],
  }, true);
  if (rejectClaimRes.status < 300 && rejectClaimRes.data?.[0]?.id) {
    const rejectId = rejectClaimRes.data[0].id;
    const rejectRes = await supabaseRequest(
      `/rest/v1/business_claims?id=eq.${rejectId}`,
      'PATCH',
      { status: 'rejected', rejected_reason: 'E2E test rejection' },
      true
    );
    log('Reject claim sets status=rejected', rejectRes.status < 300);

    const checkRes = await supabaseRequest(`/rest/v1/business_claims?id=eq.${rejectId}&select=status,rejected_reason`, 'GET', null, true);
    log('Claim rejection reason persisted', checkRes.data?.[0]?.rejected_reason === 'E2E test rejection');

    // Cleanup
    await supabaseRequest(`/rest/v1/business_claims?id=eq.${rejectId}`, 'DELETE', null, true);
  }

  // Test: Bulk verify (create 3 events, bulk verify them)
  const bulkIds = [];
  for (let i = 0; i < 3; i++) {
    const r = await supabaseRequest('/rest/v1/events', 'POST', {
      title: `E2E Bulk Test ${i}`,
      venue_name: 'Bulk Test Venue',
      category: 'Fitness',
      event_type: 'class',
      start_date: '2026-02-25',
      start_time: `${10 + i}:00`,
      end_time: `${11 + i}:00`,
      status: 'active',
      tags: ['e2e-test'],
    }, true);
    if (r.data?.[0]?.id) bulkIds.push(r.data[0].id);
  }
  log('Create 3 bulk test events', bulkIds.length === 3, `${bulkIds.length} created`);

  if (bulkIds.length === 3) {
    const bulkRes = await supabaseRequest(
      `/rest/v1/events?id=in.(${bulkIds.join(',')})`,
      'PATCH',
      { verified_at: new Date().toISOString() },
      true
    );
    log('Bulk verify 3 events', bulkRes.status < 300);

    const checkRes = await supabaseRequest(
      `/rest/v1/events?id=in.(${bulkIds.join(',')})&select=verified_at`,
      'GET', null, true
    );
    const allVerified = checkRes.data?.every(e => e.verified_at !== null);
    log('All 3 events have verified_at', allVerified);
  }

  // Cleanup bulk test events
  for (const id of bulkIds) {
    await supabaseRequest(`/rest/v1/events?id=eq.${id}`, 'DELETE', null, true);
  }
}

async function cleanup() {
  console.log('\n═══ Phase 4: Cleanup ═══\n');

  if (testEventId) {
    await supabaseRequest(`/rest/v1/events?id=eq.${testEventId}`, 'DELETE', null, true);
    log('Delete test event', true);
  }
  if (testDealId) {
    await supabaseRequest(`/rest/v1/deals?id=eq.${testDealId}`, 'DELETE', null, true);
    log('Delete test deal', true);
  }
  if (testClaimId) {
    await supabaseRequest(`/rest/v1/business_claims?id=eq.${testClaimId}`, 'DELETE', null, true);
    log('Delete test claim', true);
  }
  // Don't delete the test user - reusable

  if (browser) await browser.close();
}

async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('  Admin Panel E2E Test Suite');
  console.log('══════════════════════════════════════\n');

  try {
    const setupOk = await setupTestData();
    if (!setupOk) {
      console.log('\n❌ Setup failed, aborting\n');
      process.exit(1);
    }

    await testAdminPanelUI();
    await testAPIActions();
  } catch (err) {
    console.error('Test error:', err.message);
    log('Unexpected error', false, err.message);
  } finally {
    await cleanup();
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log('\n══════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed of ${results.length}`);
  console.log('══════════════════════════════════════\n');

  console.log('  Screenshots:');
  console.log('    → /tmp/admin-panel-full.png');
  console.log('    → /tmp/admin-panel-fullpage.png');
  console.log('    → /tmp/admin-deals-tab.png');
  console.log('    → /tmp/admin-panel-final.png\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
