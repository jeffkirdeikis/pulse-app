#!/usr/bin/env node
import puppeteer from 'puppeteer';

async function main() {
  console.log('Finding Oxygen Yoga widget ID...\n');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  page.on('request', req => {
    const url = req.url();
    if (url.includes('widgets.mindbodyonline.com/widgets/schedules/')) {
      const match = url.match(/schedules\/(\d+)/);
      if (match) console.log(`✅ FOUND WIDGET ID: ${match[1]}`);
      console.log(`   Full URL: ${url}`);
    }
  });

  // Navigate to their classes page
  console.log('Loading Oxygen class schedule page...');
  await page.goto('https://oxygenyogaandfitness.com/far-infrared-hot-yoga-classes-at-oxygen-yoga/', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(r => setTimeout(r, 8000));

  // Also check for direct schedule link
  const scheduleLinks = await page.evaluate(() => {
    const links = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href && (a.href.includes('schedule') || a.href.includes('book') || a.href.includes('class'))) {
        links.push(a.href);
      }
    });
    return [...new Set(links)];
  });

  console.log('\nSchedule-related links found:', scheduleLinks);

  // Check for healcode widgets
  const widgets = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('healcode-widget, [class*="healcode"], [data-type="schedule"]').forEach(el => {
      results.push({
        tag: el.tagName,
        id: el.id,
        dataType: el.dataset?.type,
        dataWidget: el.dataset?.widgetId
      });
    });
    return results;
  });

  console.log('HealCode widgets:', widgets);

  await browser.close();
}

main().catch(console.error);
