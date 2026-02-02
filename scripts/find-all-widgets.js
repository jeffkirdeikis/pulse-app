#!/usr/bin/env node
/**
 * Find widget IDs for all fitness studios
 */
import puppeteer from 'puppeteer';

const STUDIOS = [
  { name: 'Oxygen Yoga', url: 'https://oxygenyogaandfitness.com/squamish/' },
  { name: 'Breathe Fitness', url: 'https://breathesquamish.com/pages/squamish-schedule' },
];

async function findWidgets() {
  console.log('Launching browser...\n');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  for (const studio of STUDIOS) {
    console.log(`\n📍 ${studio.name}`);
    console.log(`   ${studio.url}`);
    console.log('-'.repeat(50));

    const page = await browser.newPage();
    const apiCalls = [];

    page.on('request', req => {
      const url = req.url();
      if (url.includes('mindbody') || url.includes('wellnessliving') || url.includes('healcode')) {
        apiCalls.push(url);

        // Extract IDs
        const mindbodyMatch = url.match(/schedules\/(\d+)/);
        const wellnessMatch = url.match(/k_business=(\d+)/);
        const healcodeMatch = url.match(/widget\/([a-f0-9]+)/i);

        if (mindbodyMatch) console.log(`   ✅ MINDBODY Widget ID: ${mindbodyMatch[1]}`);
        if (wellnessMatch) console.log(`   ✅ WELLNESSLIVING Business ID: ${wellnessMatch[1]}`);
        if (healcodeMatch) console.log(`   ✅ HEALCODE Widget: ${healcodeMatch[1]}`);
      }
    });

    try {
      await page.goto(studio.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));

      // Check page content for widget data
      const widgetData = await page.evaluate(() => {
        const results = {};

        // Look for Mindbody site IDs
        const scripts = document.querySelectorAll('script');
        scripts.forEach(s => {
          const text = s.textContent || '';
          const siteMatch = text.match(/site[_-]?id['":\s]*(\d+)/i);
          if (siteMatch) results.siteId = siteMatch[1];

          const widgetMatch = text.match(/widget[_-]?id['":\s]*['"]?([a-f0-9]+)/i);
          if (widgetMatch) results.widgetId = widgetMatch[1];
        });

        // Check data attributes
        document.querySelectorAll('[data-widget-id], [data-hc-widget], [data-site-id]').forEach(el => {
          if (el.dataset.widgetId) results.dataWidgetId = el.dataset.widgetId;
          if (el.dataset.siteId) results.dataSiteId = el.dataset.siteId;
        });

        // Look for WellnessLiving
        const wlFrame = document.querySelector('iframe[src*="wellnessliving"]');
        if (wlFrame) results.wellnessFrame = wlFrame.src;

        return results;
      });

      if (Object.keys(widgetData).length > 0) {
        console.log('   Page data:', widgetData);
      }

      if (apiCalls.length === 0) {
        console.log('   ❌ No booking API calls detected');
      }

    } catch (err) {
      console.log(`   Error: ${err.message}`);
    }

    await page.close();
  }

  await browser.close();
  console.log('\nDone!');
}

findWidgets().catch(console.error);
