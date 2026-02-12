const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, 'test-results', 'oauth-screenshots');
const BASE_URL = 'http://localhost:5173';

(async () => {
  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const consoleMessages = [];
  const consoleErrors = [];
  const networkErrors = [];

  console.log('=== Google OAuth Sign-In Flow Test ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 }
  });

  const page = await browser.newPage();

  // Capture all console messages
  page.on('console', (msg) => {
    const text = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleMessages.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture page errors (uncaught exceptions)
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGE ERROR: ${err.message}`);
  });

  // Capture failed network requests
  page.on('requestfailed', (req) => {
    networkErrors.push(`FAILED: ${req.method()} ${req.url()} - ${req.failure()?.errorText || 'unknown'}`);
  });

  try {
    // ---- Step 1: Open the page ----
    console.log('1. Opening http://localhost:5173/ ...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('   Page loaded successfully.');

    // ---- Step 2: Take initial screenshot ----
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-page-loaded.png'),
      fullPage: false
    });
    console.log('   Screenshot saved: 01-page-loaded.png');

    // ---- Step 3: Click "Sign In" button to open auth modal ----
    console.log('\n2. Looking for "Sign In" button...');

    // Wait for the Sign In button to appear
    const signInSelector = 'button.sign-in-btn';
    await page.waitForSelector(signInSelector, { timeout: 10000 });
    console.log('   Found "Sign In" button. Clicking...');
    await page.click(signInSelector);

    // Wait for the auth modal to appear
    await page.waitForSelector('.auth-modal', { timeout: 5000 });
    console.log('   Auth modal opened.');

    // ---- Step 4: Screenshot the auth modal ----
    await new Promise(r => setTimeout(r, 1000)); // let animations settle
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-auth-modal.png'),
      fullPage: false
    });
    console.log('   Screenshot saved: 02-auth-modal.png');

    // ---- Step 5: Click "Continue with Google" ----
    console.log('\n3. Looking for "Continue with Google" button...');

    const googleBtnSelector = 'button.auth-btn.google';
    await page.waitForSelector(googleBtnSelector, { timeout: 5000 });
    console.log('   Found "Continue with Google" button. Clicking...');

    // Record URL before click
    const urlBefore = page.url();
    console.log(`   URL before click: ${urlBefore}`);

    // Listen for navigation events
    let navigationOccurred = false;
    let navigationUrl = null;

    // Set up navigation listener before clicking
    const navigationPromise = page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 10000
    }).then(() => {
      navigationOccurred = true;
      navigationUrl = page.url();
    }).catch(() => {
      // Navigation may not occur if it's a popup or same-page action
    });

    // Also listen for new pages (popups)
    let popupPage = null;
    const popupPromise = new Promise((resolve) => {
      browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
          popupPage = await target.page();
          resolve(popupPage);
        }
      });
      setTimeout(() => resolve(null), 8000);
    });

    // Click the button
    await page.click(googleBtnSelector);
    console.log('   Clicked "Continue with Google".');

    // ---- Step 6: Wait for redirect / response ----
    console.log('\n4. Waiting 5 seconds for redirect/response...');

    // Wait for navigation or popup
    await Promise.race([
      navigationPromise,
      popupPromise,
      new Promise(r => setTimeout(r, 5000))
    ]);

    // Extra wait to let things settle
    await new Promise(r => setTimeout(r, 2000));

    // ---- Step 7: Capture current state ----
    const urlAfter = page.url();
    console.log(`\n5. Current URL after click: ${urlAfter}`);

    // Check if a popup was opened
    if (popupPage) {
      const popupUrl = popupPage.url();
      console.log(`   Popup opened with URL: ${popupUrl}`);

      await popupPage.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-google-popup.png'),
        fullPage: false
      });
      console.log('   Screenshot saved: 03-google-popup.png');
    }

    // Take screenshot of current main page state
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-after-google-click.png'),
      fullPage: false
    });
    console.log('   Screenshot saved: 03-after-google-click.png');

    // ---- Step 8: Analysis ----
    console.log('\n=== ANALYSIS ===\n');

    // Did URL change?
    if (urlAfter !== urlBefore) {
      console.log(`REDIRECT DETECTED:`);
      console.log(`  From: ${urlBefore}`);
      console.log(`  To:   ${urlAfter}`);

      if (urlAfter.includes('accounts.google.com')) {
        console.log('\n  RESULT: Successfully redirected to Google OAuth consent page.');
        console.log('  The Supabase OAuth configuration is working correctly.');

        // Take a better screenshot of the Google page after it loads
        try {
          await page.waitForSelector('body', { timeout: 5000 });
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '04-google-consent-page.png'),
            fullPage: false
          });
          console.log('  Screenshot saved: 04-google-consent-page.png');
        } catch (e) {
          // Already have screenshot
        }
      } else if (urlAfter.includes('supabase')) {
        console.log('\n  RESULT: Redirected to Supabase auth endpoint.');
        console.log('  This is an intermediate step - Supabase should then redirect to Google.');
      } else {
        console.log('\n  RESULT: Redirected to an unexpected URL.');
        console.log('  This may indicate a configuration issue.');
      }
    } else {
      console.log('NO REDIRECT occurred. URL stayed the same.');
      console.log(`  Current URL: ${urlAfter}`);

      // Check if there's an error displayed on the page
      const errorText = await page.evaluate(() => {
        const errorEl = document.querySelector('.auth-error');
        return errorEl ? errorEl.textContent : null;
      });

      if (errorText) {
        console.log(`\n  AUTH ERROR DISPLAYED: "${errorText}"`);
      }

      // Check for any visible error messages on the page
      const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
      if (pageText.toLowerCase().includes('error') || pageText.toLowerCase().includes('failed')) {
        console.log('\n  Page may contain error messages. Check screenshot for details.');
      }
    }

    // ---- Step 9: Console errors report ----
    console.log('\n=== CONSOLE ERRORS ===\n');
    if (consoleErrors.length === 0) {
      console.log('No console errors detected during the flow.');
    } else {
      console.log(`${consoleErrors.length} console error(s) detected:`);
      consoleErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }

    // Network errors
    console.log('\n=== NETWORK ERRORS ===\n');
    if (networkErrors.length === 0) {
      console.log('No network request failures detected.');
    } else {
      console.log(`${networkErrors.length} network failure(s):`);
      networkErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }

    // All console messages for debugging
    console.log('\n=== ALL CONSOLE MESSAGES (for debugging) ===\n');
    if (consoleMessages.length === 0) {
      console.log('No console messages captured.');
    } else {
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
    }

    console.log('\n=== SCREENSHOTS SAVED ===\n');
    const files = fs.readdirSync(SCREENSHOT_DIR);
    files.forEach(f => {
      console.log(`  ${path.join(SCREENSHOT_DIR, f)}`);
    });

  } catch (err) {
    console.error('\nTEST FAILED WITH ERROR:', err.message);
    console.error(err.stack);

    // Take error screenshot
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'ERROR-screenshot.png'),
        fullPage: false
      });
      console.log(`\nError screenshot saved to: ${path.join(SCREENSHOT_DIR, 'ERROR-screenshot.png')}`);
    } catch (ssErr) {
      console.error('Could not take error screenshot:', ssErr.message);
    }
  } finally {
    await browser.close();
    console.log('\nBrowser closed. Test complete.');
  }
})();
