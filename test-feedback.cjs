/**
 * Comprehensive Puppeteer test suite for the Feedback Widget
 * Tests: FAB visibility, modal open/close, type selector, validation,
 *        screenshot field, submissions, and Supabase data verification.
 *
 * Usage:  node test-feedback.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5173/';
const SCREENSHOT_DIR = path.join(__dirname, 'test-results', 'feedback-screenshots');

const SUPABASE_URL = 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncGZrbGhqd3dxd3JmcHNmaHVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyMTU1MCwiZXhwIjoyMDg1Mjk3NTUwfQ.uF99dIMZHOmk2_sND6W42s10dcdZGcEkfpjsKO-Yt3Y';

// Unique tag so we can find our test records
const TEST_TAG = `automated-qa-${Date.now()}`;

// ── Helpers ─────────────────────────────────────────────────────────────────
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let passCount = 0;
let failCount = 0;

function record(name, passed, detail) {
  const status = passed ? 'PASS' : 'FAIL';
  if (passed) passCount++;
  else failCount++;
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function screenshot(page, label) {
  const safeName = label.replace(/[^a-z0-9_-]/gi, '_');
  const filePath = path.join(SCREENSHOT_DIR, `${safeName}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`       Screenshot saved: ${filePath}`);
  return filePath;
}

/** Small pause helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Query Supabase REST API via https */
function supabaseQuery(queryParams) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/feedback`);
    url.search = queryParams;

    const options = {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Supabase parse error: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** Delete test records from Supabase so we leave the DB clean */
function supabaseDelete(queryParams) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/feedback`);
    url.search = queryParams;

    const options = {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
    };

    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n=== Feedback Widget — Automated Puppeteer Tests ===\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
      defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // ────────────────────────────────────────────────────────────────────────
    // TEST 1: FAB visibility
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: FAB visibility ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1500); // let animations settle

    try {
      const fab = await page.waitForSelector('.feedback-fab', { visible: true, timeout: 8000 });
      const fabText = await fab.evaluate((el) => el.textContent.trim());
      const fabBox = await fab.boundingBox();
      const vp = page.viewport();

      const isBottomRight =
        fabBox && fabBox.x + fabBox.width > vp.width - 200 && fabBox.y + fabBox.height > vp.height - 200;

      record(
        'FAB visible with "Feedback" text',
        fabText.includes('Feedback') && isBottomRight,
        `text="${fabText}", pos=(${Math.round(fabBox?.x)},${Math.round(fabBox?.y)}), viewport=${vp.width}x${vp.height}`
      );
      await screenshot(page, '01_fab_visible');
    } catch (err) {
      record('FAB visible with "Feedback" text', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 2: FAB click opens modal
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: FAB click opens modal ---');
    try {
      await page.click('.feedback-fab');
      const modal = await page.waitForSelector('.feedback-modal', { visible: true, timeout: 5000 });
      const headerText = await modal.$eval('.feedback-header-title', (el) => el.textContent.trim());
      record(
        'Click FAB opens modal with "Send us feedback"',
        headerText === 'Send us feedback',
        `header="${headerText}"`
      );
      await screenshot(page, '02_modal_open');
    } catch (err) {
      record('Click FAB opens modal with "Send us feedback"', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 3: Type selector
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Type selector ---');
    const expectedTypes = [
      { label: 'Bug Report', id: 'bug', placeholder: 'Describe what happened and what you expected...' },
      { label: 'Comment', id: 'comment', placeholder: 'Share your thoughts about Pulse...' },
      { label: 'Suggestion', id: 'suggestion', placeholder: 'What would you like to see on Pulse?' },
    ];

    for (const t of expectedTypes) {
      try {
        // Click the type button matching this label
        const btns = await page.$$('.feedback-type-btn');
        let clicked = false;
        for (const btn of btns) {
          const txt = await btn.evaluate((el) => el.textContent.trim());
          if (txt.includes(t.label)) {
            await btn.click();
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          record(`Type "${t.label}" — click + active state`, false, 'button not found');
          continue;
        }

        await sleep(300);

        // Verify active state
        const activeBtn = await page.$('.feedback-type-btn.active');
        const activeTxt = activeBtn ? await activeBtn.evaluate((el) => el.textContent.trim()) : '';
        const isActive = activeTxt.includes(t.label);

        // Verify placeholder updates
        const placeholder = await page.$eval('.feedback-textarea', (el) => el.placeholder);
        const placeholderMatch = placeholder === t.placeholder;

        record(
          `Type "${t.label}" — click + active state + placeholder`,
          isActive && placeholderMatch,
          `active="${activeTxt}", placeholder="${placeholder.substring(0, 40)}..."`
        );
        await screenshot(page, `03_type_${t.id}`);
      } catch (err) {
        record(`Type "${t.label}" — click + active state + placeholder`, false, err.message);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 4: Empty submit blocked
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Empty submit blocked ---');
    try {
      // Make sure message is empty
      await page.$eval('.feedback-textarea', (el) => { el.value = ''; });
      await page.evaluate(() => {
        const ta = document.querySelector('.feedback-textarea');
        ta.value = '';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // Need to trigger React's onChange via the native setter
      await page.evaluate(() => {
        const ta = document.querySelector('.feedback-textarea');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(ta, '');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(300);

      const isDisabled = await page.$eval('.feedback-submit', (el) => el.disabled);
      record('Submit button disabled when message empty', isDisabled === true, `disabled=${isDisabled}`);
    } catch (err) {
      record('Submit button disabled when message empty', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 5: Screenshot field visibility
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Screenshot field visibility ---');
    const screenshotTests = [
      { type: 'Bug Report', expectVisible: true },
      { type: 'Comment', expectVisible: false },
      { type: 'Suggestion', expectVisible: false },
    ];

    for (const st of screenshotTests) {
      try {
        // Click the type
        const btns = await page.$$('.feedback-type-btn');
        for (const btn of btns) {
          const txt = await btn.evaluate((el) => el.textContent.trim());
          if (txt.includes(st.type)) {
            await btn.click();
            break;
          }
        }
        await sleep(300);

        const screenshotSection = await page.$('.feedback-screenshot-section');
        const screenshotBtn = await page.$('.feedback-screenshot-btn');
        const isVisible = screenshotSection !== null || screenshotBtn !== null;

        record(
          `Screenshot upload ${st.expectVisible ? 'visible' : 'hidden'} for "${st.type}"`,
          isVisible === st.expectVisible,
          `visible=${isVisible}`
        );
      } catch (err) {
        record(`Screenshot upload for "${st.type}"`, false, err.message);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 6: Close modal via X button
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: Close modal via X ---');
    try {
      // Modal should still be open
      const modalBefore = await page.$('.feedback-modal');
      if (!modalBefore) {
        // Re-open
        await page.click('.feedback-fab');
        await page.waitForSelector('.feedback-modal', { visible: true, timeout: 3000 });
      }

      await page.click('.feedback-close');
      await sleep(500);

      const modalAfter = await page.$('.feedback-modal');
      const fabAfter = await page.$('.feedback-fab');
      record(
        'Close button (X) closes modal, FAB reappears',
        modalAfter === null && fabAfter !== null,
        `modal=${modalAfter !== null}, fab=${fabAfter !== null}`
      );
      await screenshot(page, '06_after_close_x');
    } catch (err) {
      record('Close button (X) closes modal, FAB reappears', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 7: Backdrop close
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: Backdrop close ---');
    try {
      // Open modal
      await page.click('.feedback-fab');
      await page.waitForSelector('.feedback-modal', { visible: true, timeout: 3000 });

      // Click backdrop
      const backdrop = await page.$('.feedback-backdrop');
      if (backdrop) {
        await backdrop.click();
      } else {
        // Click outside the modal in the top-left corner
        await page.mouse.click(10, 10);
      }
      await sleep(500);

      const modalAfter = await page.$('.feedback-modal');
      record(
        'Clicking backdrop closes modal',
        modalAfter === null,
        `modal present after backdrop click: ${modalAfter !== null}`
      );
      await screenshot(page, '07_after_backdrop_close');
    } catch (err) {
      record('Clicking backdrop closes modal', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 8: Submit Bug Report
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: Submit Bug Report ---');
    const bugMessage = `Test bug report from automated QA [${TEST_TAG}]`;
    try {
      // Open modal
      const fabBtn = await page.waitForSelector('.feedback-fab', { visible: true, timeout: 3000 });
      await fabBtn.click();
      await page.waitForSelector('.feedback-modal', { visible: true, timeout: 3000 });

      // Select Bug Report type (should already be default, but click explicitly)
      const btns = await page.$$('.feedback-type-btn');
      for (const btn of btns) {
        const txt = await btn.evaluate((el) => el.textContent.trim());
        if (txt.includes('Bug Report')) {
          await btn.click();
          break;
        }
      }
      await sleep(200);

      // Type message
      await page.click('.feedback-textarea');
      await page.type('.feedback-textarea', bugMessage, { delay: 20 });
      await sleep(200);

      // Verify submit is now enabled
      const isEnabled = await page.$eval('.feedback-submit', (el) => !el.disabled);
      if (!isEnabled) {
        record('Submit Bug Report', false, 'Submit button still disabled after typing');
      } else {
        await page.click('.feedback-submit');

        // Wait for success
        const success = await page.waitForSelector('.feedback-success', { visible: true, timeout: 10000 });
        const successText = await success.evaluate((el) => el.textContent.trim());
        record(
          'Submit Bug Report — success message appears',
          successText.includes('Thanks'),
          `success text="${successText}"`
        );
        await screenshot(page, '08_bug_report_success');

        // Wait for modal auto-close
        await sleep(3000);
      }
    } catch (err) {
      record('Submit Bug Report — success message appears', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 9: Submit Suggestion
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Submit Suggestion ---');
    const suggestionMessage = `Add a dark mode feature [${TEST_TAG}]`;
    try {
      // Wait for FAB to reappear after auto-close
      const fabBtn = await page.waitForSelector('.feedback-fab', { visible: true, timeout: 6000 });
      await fabBtn.click();
      await page.waitForSelector('.feedback-modal', { visible: true, timeout: 3000 });

      // Select Suggestion
      const btns = await page.$$('.feedback-type-btn');
      for (const btn of btns) {
        const txt = await btn.evaluate((el) => el.textContent.trim());
        if (txt.includes('Suggestion')) {
          await btn.click();
          break;
        }
      }
      await sleep(200);

      // Type message
      await page.click('.feedback-textarea');
      await page.type('.feedback-textarea', suggestionMessage, { delay: 20 });
      await sleep(200);

      await page.click('.feedback-submit');

      const success = await page.waitForSelector('.feedback-success', { visible: true, timeout: 10000 });
      const successText = await success.evaluate((el) => el.textContent.trim());
      record(
        'Submit Suggestion — success message appears',
        successText.includes('Thanks'),
        `success text="${successText}"`
      );
      await screenshot(page, '09_suggestion_success');

      // Wait for auto-close
      await sleep(3000);
    } catch (err) {
      record('Submit Suggestion — success message appears', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 10: Submit with email
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: Submit with email ---');
    const emailMessage = `Feedback with email from QA [${TEST_TAG}]`;
    const testEmail = 'test@example.com';
    try {
      const fabBtn = await page.waitForSelector('.feedback-fab', { visible: true, timeout: 6000 });
      await fabBtn.click();
      await page.waitForSelector('.feedback-modal', { visible: true, timeout: 3000 });

      // Select Comment type
      const btns = await page.$$('.feedback-type-btn');
      for (const btn of btns) {
        const txt = await btn.evaluate((el) => el.textContent.trim());
        if (txt.includes('Comment')) {
          await btn.click();
          break;
        }
      }
      await sleep(200);

      // Type message
      await page.click('.feedback-textarea');
      await page.type('.feedback-textarea', emailMessage, { delay: 20 });

      // Type email
      await page.click('.feedback-email');
      await page.type('.feedback-email', testEmail, { delay: 20 });
      await sleep(200);

      await page.click('.feedback-submit');

      const success = await page.waitForSelector('.feedback-success', { visible: true, timeout: 10000 });
      const successText = await success.evaluate((el) => el.textContent.trim());
      record(
        'Submit with email — success message appears',
        successText.includes('Thanks'),
        `success text="${successText}"`
      );
      await screenshot(page, '10_email_submit_success');

      // Wait for auto-close
      await sleep(3000);
    } catch (err) {
      record('Submit with email — success message appears', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // TEST 11: Verify data in Supabase
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 11: Verify data in Supabase ---');

    // Wait a moment for records to be fully committed
    await sleep(2000);

    // 11a: Verify bug report
    try {
      const records = await supabaseQuery(
        `select=*&message=like.*${encodeURIComponent(TEST_TAG)}*&type=eq.bug&order=created_at.desc&limit=5`
      );
      const bugRecord = records.find((r) => r.message.includes(bugMessage.substring(0, 30)));
      if (bugRecord) {
        const hasPageUrl = typeof bugRecord.page_url === 'string' && bugRecord.page_url.length > 0;
        const hasViewport = typeof bugRecord.viewport === 'string' && bugRecord.viewport.includes('x');
        const hasUserAgent = typeof bugRecord.user_agent === 'string' && bugRecord.user_agent.length > 0;
        const correctType = bugRecord.type === 'bug';

        record(
          'Supabase: Bug report record exists with correct fields',
          hasPageUrl && hasViewport && hasUserAgent && correctType,
          `type=${bugRecord.type}, page_url=${bugRecord.page_url}, viewport=${bugRecord.viewport}, user_agent=${bugRecord.user_agent?.substring(0, 50)}...`
        );
      } else {
        record('Supabase: Bug report record exists', false, `Found ${records.length} records but none matched`);
      }
    } catch (err) {
      record('Supabase: Bug report record exists', false, err.message);
    }

    // 11b: Verify suggestion
    try {
      const records = await supabaseQuery(
        `select=*&message=like.*${encodeURIComponent(TEST_TAG)}*&type=eq.suggestion&order=created_at.desc&limit=5`
      );
      const sugRecord = records.find((r) => r.message.includes('dark mode'));
      if (sugRecord) {
        const correctType = sugRecord.type === 'suggestion';
        const hasPageUrl = typeof sugRecord.page_url === 'string' && sugRecord.page_url.length > 0;
        record(
          'Supabase: Suggestion record exists with correct type',
          correctType && hasPageUrl,
          `type=${sugRecord.type}, message="${sugRecord.message.substring(0, 50)}..."`
        );
      } else {
        record('Supabase: Suggestion record exists', false, `Found ${records.length} records but none matched`);
      }
    } catch (err) {
      record('Supabase: Suggestion record exists', false, err.message);
    }

    // 11c: Verify comment with email
    try {
      const records = await supabaseQuery(
        `select=*&message=like.*${encodeURIComponent(TEST_TAG)}*&type=eq.comment&order=created_at.desc&limit=5`
      );
      const emailRecord = records.find((r) => r.message.includes('email from QA'));
      if (emailRecord) {
        const correctEmail = emailRecord.email === testEmail;
        const correctType = emailRecord.type === 'comment';
        const hasViewport = typeof emailRecord.viewport === 'string' && emailRecord.viewport.includes('x');
        record(
          'Supabase: Comment record with email exists and fields correct',
          correctEmail && correctType && hasViewport,
          `type=${emailRecord.type}, email=${emailRecord.email}, viewport=${emailRecord.viewport}`
        );
      } else {
        record('Supabase: Comment record with email exists', false, `Found ${records.length} records but none matched`);
      }
    } catch (err) {
      record('Supabase: Comment record with email exists', false, err.message);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Cleanup test records
    // ────────────────────────────────────────────────────────────────────────
    console.log('\n--- Cleanup: removing test records from Supabase ---');
    try {
      await supabaseDelete(`message=like.*${encodeURIComponent(TEST_TAG)}*`);
      console.log('  Test records cleaned up.');
    } catch (err) {
      console.log(`  Warning: cleanup failed — ${err.message}`);
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log('\n\n══════════════════════════════════════════════════');
    console.log('  FEEDBACK WIDGET TEST RESULTS');
    console.log('══════════════════════════════════════════════════');
    for (const r of results) {
      console.log(`  [${r.status}] ${r.name}`);
      if (r.detail) console.log(`         ${r.detail}`);
    }
    console.log('──────────────────────────────────────────────────');
    console.log(`  TOTAL: ${results.length}  |  PASS: ${passCount}  |  FAIL: ${failCount}`);
    console.log('══════════════════════════════════════════════════');
    console.log(`  Screenshots saved in: ${SCREENSHOT_DIR}`);
    console.log('══════════════════════════════════════════════════\n');

    if (consoleErrors.length > 0) {
      console.log('  Console errors captured during test:');
      consoleErrors.forEach((e) => console.log(`    - ${e}`));
      console.log('');
    }

    await browser.close();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (fatalErr) {
    console.error('\nFATAL ERROR:', fatalErr);
    if (browser) await browser.close();
    process.exit(2);
  }
})();
