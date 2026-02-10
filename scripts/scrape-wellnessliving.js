#!/usr/bin/env node

/**
 * WellnessLiving Class Scraper
 * Uses Puppeteer to scrape WellnessLiving schedule widgets
 *
 * FIXED (Feb 2026): No longer uses loop counter to assign dates.
 * Instead, parses the actual displayed date from the page after each
 * navigation. If navigation fails (displayed date doesn't change),
 * scraping stops immediately to prevent date duplication.
 *
 * Run: node scripts/scrape-wellnessliving.js
 */

import puppeteer from 'puppeteer';
import {
  classExists,
  insertClass,
  parseTime,
  getTodayPacific,
  deleteOldClasses,
  validateScrapedData
} from './lib/scraper-utils.js';

const DAYS_TO_SCRAPE = 30;

// WellnessLiving studios
const WELLNESS_STUDIOS = [
  {
    name: 'Breathe Fitness Studio',
    businessId: '338540',
    scheduleUrl: 'https://www.wellnessliving.com/schedule/breathe_fitness_squamish',
    address: '1211 Commercial Way, Squamish, BC',
    category: 'Fitness'
  },
  {
    name: 'The Sound Martial Arts',
    businessId: '414578',
    scheduleUrl: 'https://www.wellnessliving.com/schedule/thesoundmartialarts',
    address: '38922 Progress Way, Squamish, BC',
    category: 'Martial Arts'
  },
  // Roundhouse Martial Arts: WellnessLiving page exists but shows no classes
  // (schedule may not be publicly configured). Re-enable when verified.
  // {
  //   name: 'Roundhouse Martial Arts & Fitness',
  //   businessId: null,
  //   scheduleUrl: 'https://www.wellnessliving.com/schedule/roundhouse_martial_arts',
  //   address: '38147 Cleveland Ave #201, Squamish, BC',
  //   category: 'Martial Arts'
  // }
];

const stats = {
  studiosAttempted: 0,
  studiosSuccessful: 0,
  classesFound: 0,
  classesAdded: 0,
  errors: []
};

/**
 * Clean class title - remove time fragments and normalize
 */
function cleanClassTitle(title) {
  if (!title) return 'Fitness Class';

  // Remove time patterns from anywhere in the string
  title = title
    .replace(/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*/gi, '')  // Leading time
    .replace(/\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*$/gi, '')  // Trailing time
    .replace(/\s+with\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/i, '')  // Remove "with Instructor Name"
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter of each word
  if (title) {
    title = title.replace(/\b\w/g, c => c.toUpperCase());
  }

  return title || 'Fitness Class';
}

/**
 * Parse the displayed date from the WellnessLiving schedule page.
 * WellnessLiving pages show date headers like:
 *   "Thursday, February 05, 2026"
 *   "Friday, February 06, 2026"
 * or in day-view mode, a header showing the current displayed date.
 *
 * Returns the date as YYYY-MM-DD, or null if no date could be parsed.
 */
async function parseDisplayedDate(page) {
  try {
    return await page.evaluate(() => {
      const months = ['january', 'february', 'march', 'april', 'may', 'june',
                      'july', 'august', 'september', 'october', 'november', 'december'];

      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // Look for date patterns in the page text
      for (const line of lines) {
        // Pattern 1: "Thursday, February 05, 2026"
        const match1 = line.match(/^\w+,\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
        if (match1) {
          const monthName = match1[1].toLowerCase();
          const day = parseInt(match1[2]);
          const year = parseInt(match1[3]);
          const monthIndex = months.indexOf(monthName);
          if (monthIndex !== -1) {
            return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }

        // Pattern 2: "February 05, 2026" (without day of week)
        const match2 = line.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
        if (match2) {
          const monthName = match2[1].toLowerCase();
          const day = parseInt(match2[2]);
          const year = parseInt(match2[3]);
          const monthIndex = months.indexOf(monthName);
          if (monthIndex !== -1) {
            return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }

        // Pattern 3: "Thu, Feb 5" (short format, assume current year)
        const match3 = line.match(/^\w+,\s+(\w{3})\s+(\d{1,2})$/i);
        if (match3) {
          const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
          const monthAbbr = match3[1].toLowerCase();
          const day = parseInt(match3[2]);
          const monthIndex = shortMonths.indexOf(monthAbbr);
          if (monthIndex !== -1) {
            const year = new Date().getFullYear();
            return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
        }
      }

      return null;
    });
  } catch {
    return null;
  }
}

/**
 * Scrape a single WellnessLiving studio
 */
async function scrapeStudio(browser, studio) {
  console.log(`\n📍 ${studio.name}`);
  console.log(`   Business ID: ${studio.businessId}`);
  console.log('-'.repeat(50));

  stats.studiosAttempted++;
  let page = null;

  const todayStr = getTodayPacific();
  let studioClassesFound = 0;
  let studioClassesAdded = 0;

  try {
    // Delete old classes
    console.log('   Clearing old scraped classes...');
    await deleteOldClasses(studio.name, todayStr, 'wellnessliving');

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Load the schedule page
    console.log('   Loading schedule page...');
    await page.goto(studio.scheduleUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000));

    // Track the previously displayed date to detect stale navigation
    let previousDisplayedDate = null;
    let consecutiveStaleCount = 0;

    // Scrape each day
    for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
      // Navigate to the next day if not the first iteration
      if (dayOffset > 0) {
        const nextButton = await page.$('.rs-schedule-day-next, .wl-schedule-next, [class*="next-day"], button[aria-label*="next"]');
        if (!nextButton) {
          console.log(`   Navigation failed at day ${dayOffset}: no next-day button found. Stopping.`);
          break;
        }

        try {
          await nextButton.click();
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          console.log(`   Navigation failed at day ${dayOffset}: ${e.message}. Stopping.`);
          break;
        }
      }

      // CRITICAL FIX: Parse the ACTUAL displayed date from the page
      // instead of trusting the loop counter (dayOffset).
      const displayedDate = await parseDisplayedDate(page);

      if (!displayedDate) {
        // Could not parse any date from the page. On the first iteration this
        // may mean the page layout is unexpected; on subsequent iterations it
        // means navigation likely failed. Either way, skip this iteration.
        console.log(`   Day ${dayOffset}: could not parse date from page, skipping`);
        consecutiveStaleCount++;
        if (consecutiveStaleCount >= 3) {
          console.log(`   3 consecutive unparseable dates. Navigation is broken. Stopping.`);
          break;
        }
        continue;
      }

      // CRITICAL FIX: Verify navigation actually changed the page.
      // If the displayed date is the same as the previous iteration,
      // navigation failed silently - stop immediately.
      if (displayedDate === previousDisplayedDate) {
        consecutiveStaleCount++;
        if (consecutiveStaleCount >= 2) {
          console.log(`   Navigation stale: displayed date ${displayedDate} unchanged for ${consecutiveStaleCount} iterations. Stopping.`);
          break;
        }
        console.log(`   Warning: displayed date ${displayedDate} same as previous, retrying...`);
        continue;
      }

      // Navigation succeeded - reset stale counter
      consecutiveStaleCount = 0;
      previousDisplayedDate = displayedDate;

      const dateStr = displayedDate;
      const dayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      // Extract classes from the page
      let classes = [];
      try {
        classes = await page.evaluate((studioInfo, date) => {
          const results = [];

          // WellnessLiving schedule selectors
          const selectors = [
            '.rs-schedule-session',
            '.wl-schedule-item',
            '.schedule-class',
            '.class-item',
            '[class*="schedule-row"]',
            '[class*="session-item"]',
            'tr[class*="class"]',
            'div[class*="class-"]'
          ];

          for (const selector of selectors) {
            const items = document.querySelectorAll(selector);
            if (items.length > 0) {
              items.forEach(item => {
                const text = item.textContent || '';

                // Skip if too short or looks like header
                if (text.length < 10 || (text.includes('Time') && text.includes('Class'))) return;

                // Extract time - look for time pattern
                const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
                if (!timeMatch) return;

                // Look for class name in specific elements first
                const nameEl = item.querySelector('.class-name, .session-name, [class*="name"], a, strong, b');
                let className = nameEl ? nameEl.textContent.trim() : '';

                // If no specific element, try to extract class type from full text
                if (!className) {
                  const classTypes = ['yoga', 'pilates', 'barre', 'spin', 'cycle', 'hiit', 'strength',
                                      'cardio', 'boot camp', 'bootcamp', 'circuit', 'core', 'stretch',
                                      'flow', 'power', 'sculpt', 'tone', 'vinyasa', 'hot', 'yin',
                                      'conditioning', 'training'];

                  for (const type of classTypes) {
                    const regex = new RegExp(`([A-Za-z\\s]*${type}[A-Za-z\\s]*)`, 'i');
                    const match = text.match(regex);
                    if (match) {
                      className = match[1].trim();
                      break;
                    }
                  }
                }

                // Extract instructor
                const instructorMatch = text.match(/(?:with|instructor:|by|taught by)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
                const instructor = instructorMatch ? instructorMatch[1].trim() : '';

                if (className) {
                  results.push({
                    rawTitle: className,
                    time: timeMatch[1],
                    instructor: instructor,
                    studioName: studioInfo.name,
                    studioAddress: studioInfo.address,
                    category: studioInfo.category,
                    date: date
                  });
                }
              });
              break;
            }
          }

          // Fallback: scan all text for schedule patterns
          if (results.length === 0) {
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Pattern 1: time and class on same line
            for (const line of lines) {
              if (line.length < 10 || line.length > 100) continue;

              const timeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/);
              const hasClass = /yoga|pilates|barre|spin|hiit|strength|cardio|boot|circuit|core|stretch|flow|power|sculpt|vinyasa|hot|yin|kickbox|bjj|mma|jiu|karate|martial/i.test(line);

              if (timeMatch && hasClass) {
                const nameWithoutTime = line.replace(/\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/gi, '').trim();
                results.push({
                  rawTitle: nameWithoutTime,
                  time: timeMatch[1],
                  instructor: '',
                  studioName: studioInfo.name,
                  studioAddress: studioInfo.address,
                  category: studioInfo.category,
                  date: date
                });
              }
            }

            // Pattern 2: time and class on separate lines (Breathe Fitness format)
            // Look for: "9:30am - 10:30am" followed by class name like "Hot Vinyasa Flow"
            if (results.length === 0) {
              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                const nextLine = lines[i + 1];

                // Check if current line is a time range
                const timeMatch = line.match(/^(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)?$/i);
                if (!timeMatch) continue;

                // Check if next line is a class name (contains fitness keywords)
                const isClassName = /yoga|pilates|barre|spin|hiit|strength|cardio|boot|circuit|core|stretch|flow|power|sculpt|vinyasa|hot|yin|sweat|ffit|traditional|foundations|serenity|hatha|radiant/i.test(nextLine);
                if (!isClassName) continue;

                // Skip if it looks like a date or navigation
                if (/january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|filter|today|week/i.test(nextLine)) continue;

                // Look for instructor on subsequent line
                let instructor = '';
                if (i + 2 < lines.length && /^with\s+/i.test(lines[i + 2])) {
                  instructor = lines[i + 2].replace(/^with\s+/i, '').replace(/\s+SUB$/i, '').trim();
                }

                results.push({
                  rawTitle: nextLine,
                  time: timeMatch[1],
                  instructor: instructor,
                  studioName: studioInfo.name,
                  studioAddress: studioInfo.address,
                  category: studioInfo.category,
                  date: date
                });
              }
            }
          }

          // Deduplicate
          const seen = new Set();
          return results.filter(c => {
            const key = `${c.rawTitle}-${c.time}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }, studio, dateStr);
      } catch (evalError) {
        console.log(`   Warning: Page eval failed ${dayName}: ${evalError.message}`);
        continue;
      }

      if (classes.length > 0) {
        console.log(`   ${dayName}: ${classes.length} classes`);

        for (const cls of classes) {
          // Clean the title to remove time fragments
          cls.title = cleanClassTitle(cls.rawTitle);
          delete cls.rawTitle;

          studioClassesFound++;
          stats.classesFound++;

          cls.time = parseTime(cls.time);
          // Use shared classExists with all 4 fields (title+date+venue+time)
          const exists = await classExists(cls.title, cls.date, cls.studioName, cls.time);
          if (exists) continue;

          // Use shared insertClass with date validation
          cls.venueName = cls.studioName;
          cls.address = cls.studioAddress;
          cls.bookingSystem = 'wellnessliving';
          const success = await insertClass(cls);
          if (success) {
            stats.classesAdded++;
            studioClassesAdded++;
          }
        }
      }
    }

    // Post-scrape validation: detect and remove duplicated schedules
    await validateScrapedData(studio.name, 'wellnessliving');

    console.log(`   ✅ Total: ${studioClassesFound} found, ${studioClassesAdded} added`);
    stats.studiosSuccessful++;

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    stats.errors.push({ studio: studio.name, error: error.message });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Page may already be closed
      }
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('💪 WELLNESSLIVING CLASS SCRAPER');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}`);
  console.log(`Studios: ${WELLNESS_STUDIOS.length}`);
  console.log(`Days to scrape: ${DAYS_TO_SCRAPE}`);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const studio of WELLNESS_STUDIOS) {
      await scrapeStudio(browser, studio);
    }
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Studios:     ${stats.studiosSuccessful}/${stats.studiosAttempted} successful`);
  console.log(`Classes:     ${stats.classesFound} found, ${stats.classesAdded} added`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  • ${e.studio}: ${e.error}`));
  }

  console.log(`\nCompleted: ${new Date().toLocaleString()}`);
}

main().catch(console.error);
