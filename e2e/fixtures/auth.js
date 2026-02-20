/**
 * Playwright fixtures for authenticated flow tests.
 *
 * Provides:
 * - authenticatedPage: browser page with Supabase session injected
 * - serviceClient: Supabase admin client for DB cleanup
 *
 * Auth strategy: sign in via Node.js Supabase client (bypasses CAPTCHA),
 * inject session token into localStorage before page navigation.
 */
import { test as base } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const QA_TEST_EMAIL = process.env.QA_TEST_EMAIL;
const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD;
const STORAGE_KEY = 'sb-ygpfklhjwwqwrfpsfhue-auth-token';

// Cache session across tests within a single run (1hr TTL)
let cachedSession = null;
let cachedSessionExpiry = 0;

async function getSession() {
  if (cachedSession && Date.now() < cachedSessionExpiry) {
    return cachedSession;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: QA_TEST_EMAIL,
    password: QA_TEST_PASSWORD,
  });
  if (error) throw new Error('Test auth failed: ' + error.message);
  cachedSession = data.session;
  cachedSessionExpiry = Date.now() + 60 * 60 * 1000; // 1hr
  return cachedSession;
}

export const test = base.extend({
  /**
   * A page with the test user's Supabase session pre-injected.
   * Navigates to /classes and waits for .profile-btn to confirm auth hydration.
   */
  authenticatedPage: async ({ page }, use) => {
    const session = await getSession();
    const sessionPayload = JSON.stringify(session);

    // Inject session into localStorage before any JS runs
    await page.addInitScript(({ key, payload }) => {
      localStorage.setItem(key, payload);
    }, { key: STORAGE_KEY, payload: sessionPayload });

    await page.goto('/');
    // Wait for auth to hydrate — profile button appears for logged-in users
    await page.waitForSelector('.profile-btn', { timeout: 15000 });

    await use(page);
  },

  /**
   * Supabase admin client (service role) for direct DB operations.
   * Use for cleanup: deleting test rows from saved_items, user_calendar, etc.
   */
  serviceClient: async ({}, use) => {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — cannot create service client');
    }
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await use(client);
  },

  /**
   * Combined fixture: authenticated page + automatic cleanup after each test.
   * Deletes all saved_items and user_calendar rows for the test user.
   */
  authenticatedPageWithCleanup: async ({ page }, use) => {
    const session = await getSession();
    const sessionPayload = JSON.stringify(session);
    const userId = session.user.id;

    await page.addInitScript(({ key, payload }) => {
      localStorage.setItem(key, payload);
    }, { key: STORAGE_KEY, payload: sessionPayload });

    await page.goto('/');
    await page.waitForSelector('.profile-btn', { timeout: 15000 });

    await use(page);

    // Teardown: clean up test data
    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await adminClient.from('saved_items').delete().eq('user_id', userId);
      await adminClient.from('user_calendar').delete().eq('user_id', userId);
    }
  },
});

export { expect } from '@playwright/test';
