#!/usr/bin/env node

/**
 * Discover Mindbody/HealCode widget IDs from fitness studio websites
 * Run: node scripts/discover-widget-ids.js
 */

import puppeteer from 'puppeteer';

const STUDIOS_TO_CHECK = [
  { name: 'Shala Yoga', url: 'https://shalayoga.ca/schedule/', known: '189264' },
  { name: 'Oxygen Yoga & Fitness Squamish', url: 'https://oxygenyogaandfitness.com/squamish/' },
  { name: 'Breathe Fitness Studio', url: 'https://breathesquamish.com/' },
  { name: 'Core Intentions', url: 'https://coreintentions.com/' },
  { name: 'Chief Yoga and Wellness', url: 'https://chiefyoga.ca/' },
  { name: 'Ground Up Climbing Centre', url: 'https://groundupclimbing.ca/' },
  { name: 'Body Storm Fitness', url: 'https://bodystormfitness.ca/' },
  { name: 'The Sound Martial Arts', url: 'https://thesoundmartialarts.com/' },
  { name: 'Seed Studio', url: 'https://seedsquamish.com/' },
  { name: 'Driftwood Dance Academy', url: 'https://driftwooddance.ca/' },
  { name: 'CrossFit Squamish', url: 'https://crossfitsquamish.com/' },
  { name: 'Club Flex Squamish', url: 'https://clubflexsquamish.com/' },
  { name: 'Chief Training Squamish', url: 'https://chieftraining.ca/' },
];

async function findWidgetId(page, studio) {
  console.log(`\n📍 ${studio.name}`);
  console.log(`   URL: ${studio.url}`);

  try {
    // Set up request interception to capture Mindbody API calls
    const widgetIds = [];
    const bookingSystems = [];

    page.on('request', request => {
      const url = request.url();

      // Look for Mindbody widget API calls
      if (url.includes('widgets.mindbodyonline.com/widgets/schedules/')) {
        const match = url.match(/schedules\/(\d+)/);
        if (match) {
          widgetIds.push({ type: 'mindbody', id: match[1] });
        }
      }

      // Look for HealCode widget calls
      if (url.includes('healcode') && url.includes('widget')) {
        const match = url.match(/widget\/([a-f0-9]+)/i);
        if (match) {
          widgetIds.push({ type: 'healcode', id: match[1] });
        }
      }

      // Look for WellnessLiving
      if (url.includes('wellnessliving.com')) {
        bookingSystems.push('wellnessliving');
      }

      // Look for JaneApp
      if (url.includes('janeapp.com') || url.includes('jane.app')) {
        bookingSystems.push('janeapp');
      }

      // Look for Momence
      if (url.includes('momence.com')) {
        bookingSystems.push('momence');
      }
    });

    await page.goto(studio.url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for widgets to load
    await new Promise(r => setTimeout(r, 5000));

    // Also check page content for widget IDs
    const pageWidgetIds = await page.evaluate(() => {
      const results = [];

      // Check for data attributes
      document.querySelectorAll('[data-widget-id], [data-healcode-widget], [data-bw-widget-id]').forEach(el => {
        const id = el.dataset.widgetId || el.dataset.healcodeWidget || el.dataset.bwWidgetId;
        if (id) results.push({ type: 'data-attr', id });
      });

      // Check for Mindbody site ID in scripts
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        const text = script.textContent || '';
        const siteMatch = text.match(/site[_-]?id['":\s]+(\d+)/i);
        if (siteMatch) results.push({ type: 'site-id', id: siteMatch[1] });
      });

      // Check for HealCode widget embed
      const healcodeWidgets = document.querySelectorAll('healcode-widget, [class*="healcode"]');
      healcodeWidgets.forEach(w => {
        const id = w.getAttribute('data-widget-id') || w.id?.match(/\d+/)?.[0];
        if (id) results.push({ type: 'healcode-element', id });
      });

      // Check for schedule/booking links
      const links = document.querySelectorAll('a[href*="schedule"], a[href*="book"], a[href*="class"]');
      const scheduleUrls = [];
      links.forEach(link => {
        if (link.href && !link.href.includes('javascript')) {
          scheduleUrls.push(link.href);
        }
      });

      return { widgets: results, scheduleUrls: scheduleUrls.slice(0, 3) };
    });

    // Combine results
    const allWidgets = [...widgetIds, ...pageWidgetIds.widgets];
    const uniqueWidgets = [...new Map(allWidgets.map(w => [w.id, w])).values()];

    if (uniqueWidgets.length > 0) {
      console.log(`   ✅ Found widget IDs:`);
      uniqueWidgets.forEach(w => console.log(`      ${w.type}: ${w.id}`));
      return { studio: studio.name, widgets: uniqueWidgets, system: 'mindbody' };
    }

    if (bookingSystems.length > 0) {
      console.log(`   📋 Booking system: ${[...new Set(bookingSystems)].join(', ')}`);
      return { studio: studio.name, system: bookingSystems[0], widgets: [] };
    }

    if (pageWidgetIds.scheduleUrls.length > 0) {
      console.log(`   🔗 Schedule pages found:`);
      pageWidgetIds.scheduleUrls.forEach(url => console.log(`      ${url}`));
      return { studio: studio.name, scheduleUrls: pageWidgetIds.scheduleUrls, widgets: [] };
    }

    console.log(`   ❌ No booking widget found`);
    return { studio: studio.name, widgets: [], system: 'unknown' };

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { studio: studio.name, error: error.message, widgets: [] };
  }
}

async function main() {
  console.log('🔍 MINDBODY WIDGET ID DISCOVERY\n');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });

  const results = [];

  for (const studio of STUDIOS_TO_CHECK) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const result = await findWidgetId(page, studio);
    results.push(result);

    await page.close();
    await new Promise(r => setTimeout(r, 2000));
  }

  await browser.close();

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 DISCOVERY SUMMARY');
  console.log('='.repeat(60));

  const withWidgets = results.filter(r => r.widgets?.length > 0);
  const withSystems = results.filter(r => r.system && r.system !== 'unknown');

  console.log(`\nStudios with Mindbody widgets: ${withWidgets.length}`);
  withWidgets.forEach(r => {
    console.log(`  • ${r.studio}: ${r.widgets.map(w => w.id).join(', ')}`);
  });

  console.log(`\nStudios with other booking systems: ${withSystems.filter(r => r.widgets?.length === 0).length}`);
  withSystems.filter(r => r.widgets?.length === 0).forEach(r => {
    console.log(`  • ${r.studio}: ${r.system}`);
  });

  // Output config for scraper
  console.log('\n\n📋 SCRAPER CONFIG (copy to scrape-fitness-classes.js):');
  console.log('='.repeat(60));
  console.log('const FITNESS_STUDIOS = [');
  withWidgets.forEach(r => {
    const widgetId = r.widgets[0]?.id;
    if (widgetId) {
      console.log(`  {
    name: '${r.studio}',
    widgetId: '${widgetId}',
    address: 'Squamish, BC',
    category: 'Fitness',
    bookingSystem: 'mindbody'
  },`);
    }
  });
  console.log('];');
}

main().catch(console.error);
