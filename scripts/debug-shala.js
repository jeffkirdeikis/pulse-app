#!/usr/bin/env node

/**
 * Debug script to see what Puppeteer sees on Shala's schedule page
 */

import puppeteer from 'puppeteer';

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log('Loading Shala schedule page...');
  await page.goto('https://shalayoga.ca/schedule/', { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait extra time for HealCode widget to load
  console.log('Waiting for widget to load...');
  await new Promise(r => setTimeout(r, 8000));

  // Take screenshot
  await page.screenshot({ path: 'shala-screenshot.png', fullPage: true });
  console.log('Screenshot saved to shala-screenshot.png');

  // Get page content
  const content = await page.content();

  // Look for iframes
  const iframes = await page.$$('iframe');
  console.log(`\nFound ${iframes.length} iframes`);

  for (let i = 0; i < iframes.length; i++) {
    const src = await iframes[i].evaluate(el => el.src);
    console.log(`  iframe ${i}: ${src}`);
  }

  // Look for HealCode elements
  const healcodeElements = await page.$$('[class*="healcode"], [id*="healcode"]');
  console.log(`\nFound ${healcodeElements.length} HealCode elements`);

  // Look for schedule-related elements
  const scheduleElements = await page.$$('[class*="schedule"], [class*="class"], [class*="session"]');
  console.log(`Found ${scheduleElements.length} schedule-related elements`);

  // Get all visible text
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('\n--- Page text (first 2000 chars) ---');
  console.log(bodyText.substring(0, 2000));

  // Look for specific yoga class keywords
  const hasYogaClasses = bodyText.toLowerCase().includes('yoga') ||
                          bodyText.toLowerCase().includes('hatha') ||
                          bodyText.toLowerCase().includes('vinyasa');
  console.log(`\nContains yoga class keywords: ${hasYogaClasses}`);

  // Check if there's a Mindbody/HealCode widget script
  const scripts = await page.$$eval('script', scripts =>
    scripts.map(s => s.src || s.textContent?.substring(0, 100)).filter(Boolean)
  );
  const healcodeScript = scripts.find(s => s.includes('healcode') || s.includes('mindbody'));
  console.log(`\nHealCode/Mindbody script found: ${!!healcodeScript}`);

  // Headless mode - close immediately

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
