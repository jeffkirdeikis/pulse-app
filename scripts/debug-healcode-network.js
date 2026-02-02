#!/usr/bin/env node

/**
 * Debug script to intercept HealCode/Mindbody network requests
 * This will help us find the actual API endpoints used
 */

import puppeteer from 'puppeteer';

async function main() {
  console.log('Launching browser with network interception...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Collect all network requests
  const apiRequests = [];

  page.on('request', request => {
    const url = request.url();
    // Look for API calls, especially HealCode/Mindbody related
    if (url.includes('healcode') ||
        url.includes('mindbody') ||
        url.includes('api') ||
        url.includes('schedule') ||
        url.includes('class') ||
        url.includes('widget')) {
      console.log(`📤 REQUEST: ${request.method()} ${url.substring(0, 120)}`);
      apiRequests.push({
        method: request.method(),
        url: url,
        headers: request.headers()
      });
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('healcode') ||
        url.includes('mindbody') ||
        url.includes('api') ||
        url.includes('schedule') ||
        url.includes('class')) {
      console.log(`📥 RESPONSE: ${response.status()} ${url.substring(0, 100)}`);

      // Try to get response body for JSON responses
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const body = await response.json();
          console.log('   JSON Response:', JSON.stringify(body).substring(0, 500));
        }
      } catch (e) {}
    }
  });

  console.log('Loading Shala Yoga schedule page...\n');
  await page.goto('https://shalayoga.ca/schedule/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  // Wait for widget to fully load
  console.log('\nWaiting 10 seconds for all async requests...\n');
  await new Promise(r => setTimeout(r, 10000));

  // Try clicking on a future date
  console.log('Clicking on date "1" (Feb 1)...');
  await page.evaluate(() => {
    const elements = document.querySelectorAll('td, div, span, a');
    for (const el of elements) {
      if (el.textContent?.trim() === '1' && el.offsetWidth > 20 && el.offsetWidth < 80) {
        el.click();
        console.log('Clicked!');
        return true;
      }
    }
    return false;
  });

  await new Promise(r => setTimeout(r, 5000));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Total API requests captured: ${apiRequests.length}`);
  console.log('='.repeat(60));

  if (apiRequests.length > 0) {
    console.log('\nAll captured requests:');
    apiRequests.forEach((req, i) => {
      console.log(`\n${i + 1}. ${req.method} ${req.url}`);
    });
  }

  // Look for any widgets or embeds
  console.log('\n\nSearching for embedded widgets...');
  const widgets = await page.evaluate(() => {
    const results = [];

    // Check for iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      results.push({ type: 'iframe', src: iframe.src });
    });

    // Check for script tags that might load widgets
    document.querySelectorAll('script[src]').forEach(script => {
      if (script.src.includes('healcode') || script.src.includes('mindbody') || script.src.includes('widget')) {
        results.push({ type: 'script', src: script.src });
      }
    });

    // Check for data attributes
    document.querySelectorAll('[data-widget-id], [data-healcode-widget], [data-mindbody]').forEach(el => {
      results.push({
        type: 'widget-element',
        tag: el.tagName,
        id: el.id,
        class: el.className,
        dataAttributes: Object.keys(el.dataset)
      });
    });

    return results;
  });

  console.log('Found widgets:', JSON.stringify(widgets, null, 2));

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
