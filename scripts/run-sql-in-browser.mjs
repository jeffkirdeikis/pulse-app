import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrationInBrowser() {
  console.log('='.repeat(60));
  console.log('RUNNING MIGRATION VIA BROWSER AUTOMATION');
  console.log('='.repeat(60));

  // Read migration SQL
  const migrationPath = path.join(__dirname, '../supabase/migrations/004_booking_messaging_system.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('\nLaunching browser...');

  const browser = await puppeteer.launch({
    headless: false, // Show the browser so user can see/help if needed
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    console.log('Opening Supabase SQL Editor...');
    await page.goto('https://supabase.com/dashboard/project/ygpfklhjwwqwrfpsfhue/sql/new', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for either the SQL editor or login page
    console.log('Waiting for page to load...');
    await page.waitForTimeout(3000);

    // Check if we need to login
    const loginButton = await page.$('button:has-text("Sign in")');
    if (loginButton) {
      console.log('\n⚠️  Please log in to Supabase in the browser window.');
      console.log('   After logging in, the script will continue automatically.\n');

      // Wait for navigation after login (up to 2 minutes)
      await page.waitForNavigation({ timeout: 120000, waitUntil: 'networkidle2' });
      await page.goto('https://supabase.com/dashboard/project/ygpfklhjwwqwrfpsfhue/sql/new', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    }

    console.log('Looking for SQL editor...');
    await page.waitForTimeout(3000);

    // Try to find the Monaco editor or CodeMirror editor
    const editorSelector = '.monaco-editor textarea, .cm-content, [role="textbox"]';

    try {
      await page.waitForSelector(editorSelector, { timeout: 10000 });
      console.log('Found SQL editor!');

      // Click on the editor to focus it
      await page.click('.monaco-editor, .cm-editor, [data-testid="sql-editor"]');
      await page.waitForTimeout(500);

      // Clear any existing content and paste new SQL
      await page.keyboard.down('Meta');
      await page.keyboard.press('a');
      await page.keyboard.up('Meta');
      await page.waitForTimeout(200);

      // Type the SQL (in chunks to avoid issues with large content)
      console.log('Pasting SQL migration...');
      await page.evaluate((sqlContent) => {
        // Try to find and set the editor content
        const textarea = document.querySelector('.monaco-editor textarea');
        if (textarea) {
          textarea.value = sqlContent;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, sql);

      // Alternative: use clipboard
      await page.evaluate(async (sqlContent) => {
        await navigator.clipboard.writeText(sqlContent);
      }, sql);

      await page.keyboard.down('Meta');
      await page.keyboard.press('v');
      await page.keyboard.up('Meta');
      await page.waitForTimeout(1000);

      console.log('SQL pasted. Looking for Run button...');

      // Find and click the Run button
      const runButton = await page.$('button:has-text("Run"), [data-testid="run-query-button"]');
      if (runButton) {
        console.log('Clicking Run button...');
        await runButton.click();
        console.log('\n✅ Migration submitted! Check the browser for results.');
      } else {
        // Try keyboard shortcut
        console.log('Trying keyboard shortcut (Cmd+Enter)...');
        await page.keyboard.down('Meta');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Meta');
        console.log('\n✅ Migration submitted via keyboard shortcut! Check the browser for results.');
      }

      // Wait for result
      await page.waitForTimeout(5000);
      console.log('\nLeaving browser open for you to verify the results.');
      console.log('Close the browser window when done.\n');

      // Keep browser open for user to see results
      await new Promise(resolve => {
        page.on('close', resolve);
        browser.on('disconnected', resolve);
      });

    } catch (e) {
      console.log('\n⚠️  Could not find SQL editor automatically.');
      console.log('The browser is open - please:');
      console.log('1. Make sure you are logged in');
      console.log('2. Paste the SQL (Cmd+V) in the editor');
      console.log('3. Click "Run"');
      console.log('\nThe SQL migration is in your clipboard.');

      // Copy SQL to clipboard
      await page.evaluate(async (sqlContent) => {
        await navigator.clipboard.writeText(sqlContent);
      }, sql);

      // Wait for user to close browser
      await new Promise(resolve => {
        browser.on('disconnected', resolve);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
}

runMigrationInBrowser().catch(console.error);
