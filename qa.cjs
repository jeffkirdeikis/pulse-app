/**
 * QA Verification Script
 *
 * Runs after every code change. Catches:
 * - Build failures
 * - Runtime crashes (ReferenceError, TypeError, etc.)
 * - Error boundary rendering
 * - Console errors
 * - Blank screens
 *
 * Exit code 0 = PASS, non-zero = FAIL
 */
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function runQA() {
  const errors = [];
  const warnings = [];
  const screenshots = [];

  // Step 1: Build
  console.log('\n' + BOLD + '═══ QA Step 1/3: Build ═══' + RESET);
  try {
    execSync('npm run build', { stdio: 'pipe', cwd: __dirname });
    console.log(GREEN + '  ✓ Build passed' + RESET);
  } catch (e) {
    const output = e.stderr?.toString() || e.stdout?.toString() || 'Unknown build error';
    errors.push('BUILD FAILED: ' + output.slice(0, 500));
    console.log(RED + '  ✗ Build FAILED' + RESET);
    printResults(errors, warnings, screenshots);
    process.exit(1);
  }

  // Step 2: Check if dev server is running
  console.log(BOLD + '═══ QA Step 2/3: Dev Server Check ═══' + RESET);
  let serverRunning = false;
  try {
    const http = require('http');
    await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:5173/', (res) => {
        serverRunning = res.statusCode === 200;
        resolve();
      });
      req.on('error', () => resolve());
      req.setTimeout(2000, () => { req.destroy(); resolve(); });
    });
  } catch {
    serverRunning = false;
  }

  if (!serverRunning) {
    console.log(YELLOW + '  ⚠ Dev server not running on :5173 — skipping browser tests' + RESET);
    console.log(YELLOW + '    Run "npm run dev" first for full QA' + RESET);
    warnings.push('Dev server not running — browser tests skipped');
    printResults(errors, warnings, screenshots);
    process.exit(0);
  }
  console.log(GREEN + '  ✓ Dev server running' + RESET);

  // Step 3: Browser tests
  console.log(BOLD + '═══ QA Step 3/3: Browser Tests ═══' + RESET);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 932 });

  // Collect console errors
  const consoleErrors = [];
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known noisy errors
      if (!text.includes('favicon') && !text.includes('net::ERR') && !text.includes('404')) {
        consoleErrors.push(text);
      }
    }
  });

  // Load the page
  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (e) {
    errors.push('Page failed to load: ' + e.message);
    await browser.close();
    printResults(errors, warnings, screenshots);
    process.exit(1);
  }
  await new Promise(r => setTimeout(r, 2000));

  // Check for error boundary
  const errorBoundaryVisible = await page.evaluate(() => {
    const allText = document.body?.innerText || '';
    return allText.includes('Something went wrong') || allText.includes('Error Details');
  });

  if (errorBoundaryVisible) {
    // Get the error details
    const errorText = await page.evaluate(() => {
      const details = document.querySelector('details pre');
      return details ? details.textContent : 'No details available';
    });
    errors.push('ERROR BOUNDARY TRIGGERED: ' + errorText.slice(0, 300));
    console.log(RED + '  ✗ Error boundary is showing — app crashed!' + RESET);
  } else {
    console.log(GREEN + '  ✓ No error boundary — app renders' + RESET);
  }

  // Check for blank screen
  const hasContent = await page.evaluate(() => {
    const body = document.body;
    return body && body.innerText.trim().length > 50;
  });

  if (!hasContent) {
    errors.push('BLANK SCREEN: Page has no meaningful content');
    console.log(RED + '  ✗ Blank screen detected' + RESET);
  } else {
    console.log(GREEN + '  ✓ Page has content' + RESET);
  }

  // Check for critical UI elements
  const hasPulseHeader = await page.evaluate(() => {
    return document.body.innerText.includes('PULSE');
  });
  if (!hasPulseHeader) {
    errors.push('MISSING UI: PULSE header not found');
    console.log(RED + '  ✗ PULSE header missing' + RESET);
  } else {
    console.log(GREEN + '  ✓ PULSE header present' + RESET);
  }

  // Check console errors
  if (consoleErrors.length > 0) {
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('ReferenceError') ||
      e.includes('TypeError') ||
      e.includes('SyntaxError') ||
      e.includes('Cannot access') ||
      e.includes('is not defined') ||
      e.includes('is not a function')
    );
    if (criticalErrors.length > 0) {
      criticalErrors.forEach(e => errors.push('CONSOLE ERROR: ' + e.slice(0, 200)));
      console.log(RED + `  ✗ ${criticalErrors.length} critical console error(s)` + RESET);
    } else {
      console.log(YELLOW + `  ⚠ ${consoleErrors.length} non-critical console error(s)` + RESET);
      consoleErrors.forEach(e => warnings.push('Console: ' + e.slice(0, 150)));
    }
  } else {
    console.log(GREEN + '  ✓ No console errors' + RESET);
  }

  // Take screenshot
  const screenshotPath = '/tmp/qa-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  screenshots.push(screenshotPath);
  console.log(GREEN + `  ✓ Screenshot saved: ${screenshotPath}` + RESET);

  await browser.close();

  // Print results
  printResults(errors, warnings, screenshots);
  process.exit(errors.length > 0 ? 1 : 0);
}

function printResults(errors, warnings, screenshots) {
  console.log('\n' + BOLD + '═══════════════════════════════════════' + RESET);
  if (errors.length === 0) {
    console.log(GREEN + BOLD + '  ✅ QA PASSED' + RESET);
  } else {
    console.log(RED + BOLD + '  ❌ QA FAILED — ' + errors.length + ' error(s)' + RESET);
    errors.forEach(e => console.log(RED + '    • ' + e + RESET));
  }
  if (warnings.length > 0) {
    console.log(YELLOW + '  ⚠ ' + warnings.length + ' warning(s)' + RESET);
    warnings.forEach(w => console.log(YELLOW + '    • ' + w + RESET));
  }
  if (screenshots.length > 0) {
    console.log('\n  📸 Screenshots to verify:');
    screenshots.forEach(s => console.log('    → Read ' + s));
  }
  console.log(BOLD + '═══════════════════════════════════════' + RESET + '\n');
}

runQA().catch(err => {
  console.error(RED + 'QA script crashed: ' + err.message + RESET);
  process.exit(1);
});
