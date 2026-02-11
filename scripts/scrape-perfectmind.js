#!/usr/bin/env node

/**
 * PerfectMind BookMe4 Scraper — District of Squamish (Brennan Park)
 *
 * Scrapes class and program schedules from the PerfectMind BookMe4 widget.
 * Covers: swim lessons, fitness, yoga, gymnastics, dance, sports, camps,
 * arena programs, certifications, and more (35 calendars, 8 categories).
 *
 * API Architecture (no browser needed for most data):
 *   - GetCategoriesDataV2: Get all categories and calendar IDs (no auth)
 *   - ClassesV2: Get drop-in class schedules (session cookies + CSRF)
 *   - CoursesV2: Get course/program schedules (browser fallback if HTTP fails)
 *
 * Run standalone:  node scripts/scrape-perfectmind.js
 * Called from:     scrape-reliable-sources.js (booking_system: 'perfectmind')
 */

import https from 'node:https';
import {
  classExists,
  insertClass,
  deleteOldClasses,
  parseTime,
  getTodayPacific,
  getEndDatePacific,
  validateScrapedData,
  retryWithBackoff
} from './lib/scraper-utils.js';
import {
  recordScrapeSuccess,
  recordScrapeFailure
} from './lib/reliable-sources.js';

const BASE_URL = 'https://districtofsquamish.perfectmind.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ============================================================
// HTTP HELPERS (using Node https for raw Set-Cookie access)
// ============================================================

function httpsRequest(method, urlStr, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'User-Agent': UA, ...headers }
    };
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        setCookies: res.headers['set-cookie'] || [],
        body: data
      }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Request timeout')));
    if (body) req.write(body);
    req.end();
  });
}

/** GET with redirect following and cookie accumulation */
async function httpGet(urlStr, cookies = '') {
  let currentUrl = urlStr;
  let allCookies = cookies;

  for (let i = 0; i < 5; i++) {
    const hdrs = { Accept: 'text/html,application/xhtml+xml' };
    if (allCookies) hdrs['Cookie'] = allCookies;

    const resp = await httpsRequest('GET', currentUrl, null, hdrs);

    if (resp.setCookies.length > 0) {
      const fresh = resp.setCookies.map(c => c.split(';')[0]);
      allCookies = allCookies ? allCookies + '; ' + fresh.join('; ') : fresh.join('; ');
    }

    if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
      currentUrl = resp.headers.location.startsWith('http')
        ? resp.headers.location
        : `${BASE_URL}${resp.headers.location}`;
      continue;
    }

    return { ...resp, cookies: allCookies };
  }
  throw new Error('Too many redirects');
}

/** POST with optional cookies and extra headers */
async function httpPost(urlStr, body, contentType, cookies = '', extra = {}) {
  const hdrs = { 'Content-Type': contentType, ...extra };
  if (cookies) hdrs['Cookie'] = cookies;
  return httpsRequest('POST', urlStr, body, hdrs);
}

// ============================================================
// PERFECTMIND API LAYER
// ============================================================

/** Get all categories and calendars (no auth needed) */
async function getCategories(widgetId) {
  const body = JSON.stringify({ widgetId, page: 1, pageSize: 100 });
  const resp = await retryWithBackoff(
    () => httpPost(`${BASE_URL}/Contacts/BookMe4V2/GetCategoriesDataV2?embed=False`, body, 'application/json'),
    { label: 'PerfectMind GetCategories' }
  );
  if (resp.status !== 200) throw new Error(`GetCategories HTTP ${resp.status}`);
  return JSON.parse(resp.body);
}

/** Load a booking page to get session cookies + CSRF token */
async function getSessionAndToken(widgetId, calendarId, pageType) {
  const pageName = pageType === 'Courses' ? 'BookingCoursesPage' : 'Classes';
  const url = `${BASE_URL}/Contacts/BookMe4BookingPages/${pageName}?calendarId=${calendarId}&widgetId=${widgetId}&embed=False`;

  const resp = await httpGet(url);
  if (resp.status !== 200) throw new Error(`Booking page HTTP ${resp.status}`);

  // Extract CSRF token from HTML
  const tokenMatch = resp.body.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if (!tokenMatch) {
    const alt = resp.body.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/);
    if (!alt) throw new Error('CSRF token not found in booking page HTML');
    return { cookies: resp.cookies, token: alt[1] };
  }
  return { cookies: resp.cookies, token: tokenMatch[1] };
}

// ============================================================
// DROP-IN CLASSES (BookingType 2) — HTTP only
// ============================================================

async function scrapeDropInClasses(widgetId, calendar, source) {
  const { cookies, token } = await getSessionAndToken(widgetId, calendar.Id, 'Classes');

  const classes = [];
  let nextKey = null;
  const maxPages = 8; // ~8 weeks

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      __RequestVerificationToken: token,
      calendarId: calendar.Id,
      widgetId,
      page: String(page)
    });
    if (nextKey) params.set('after', nextKey);

    const resp = await httpPost(
      `${BASE_URL}/Contacts/BookMe4BookingPagesV2/ClassesV2`,
      params.toString(),
      'application/x-www-form-urlencoded',
      cookies,
      { 'X-Requested-With': 'XMLHttpRequest' }
    );

    if (resp.status !== 200) break;

    let data;
    try { data = JSON.parse(resp.body); } catch { break; }
    if (!data.classes || data.classes.length === 0) break;

    for (const cls of data.classes) {
      const mapped = mapClass(cls, source);
      if (mapped) classes.push(mapped);
    }

    nextKey = data.nextKey;
    if (!nextKey) break;
    await new Promise(r => setTimeout(r, 300));
  }

  return classes;
}

// ============================================================
// COURSES (BookingType 3) — HTTP first, browser fallback
// ============================================================

async function scrapeCourses(widgetId, calendar, source, browser) {
  const courses = [];

  try {
    const { cookies, token } = await getSessionAndToken(widgetId, calendar.Id, 'Courses');

    // Try CoursesV2 via HTTP first
    const params = new URLSearchParams({
      __RequestVerificationToken: token,
      calendarId: calendar.Id,
      widgetId,
      page: '0'
    });

    const resp = await httpPost(
      `${BASE_URL}/Contacts/BookMe4BookingPagesV2/CoursesV2`,
      params.toString(),
      'application/x-www-form-urlencoded',
      cookies,
      { 'X-Requested-With': 'XMLHttpRequest' }
    );

    if (resp.status === 200) {
      try {
        const data = JSON.parse(resp.body);
        const list = data.courses || data.Courses || [];
        for (const c of list) {
          const mapped = mapCourse(c, source, calendar);
          if (mapped) courses.push(...mapped);
        }

        // Paginate if there's more data
        let nextKey = data.nextKey;
        let page = 1;
        while (nextKey && page < 5) {
          const nextParams = new URLSearchParams({
            __RequestVerificationToken: token,
            calendarId: calendar.Id,
            widgetId,
            page: String(page),
            after: nextKey
          });
          const nextResp = await httpPost(
            `${BASE_URL}/Contacts/BookMe4BookingPagesV2/CoursesV2`,
            nextParams.toString(),
            'application/x-www-form-urlencoded',
            cookies,
            { 'X-Requested-With': 'XMLHttpRequest' }
          );
          if (nextResp.status !== 200) break;
          try {
            const nextData = JSON.parse(nextResp.body);
            const nextList = nextData.courses || nextData.Courses || [];
            for (const c of nextList) {
              const mapped = mapCourse(c, source, calendar);
              if (mapped) courses.push(...mapped);
            }
            nextKey = nextData.nextKey;
          } catch { break; }
          page++;
          await new Promise(r => setTimeout(r, 300));
        }
      } catch { /* JSON parse failure, fall through to browser */ }
    }
  } catch { /* session/token failure, fall through to browser */ }

  // Browser fallback if HTTP returned nothing
  if (courses.length === 0 && browser) {
    const browserCourses = await scrapeCoursesWithBrowser(widgetId, calendar.Id, source, calendar, browser);
    courses.push(...browserCourses);
  }

  return courses;
}

/**
 * Puppeteer fallback: load course page, click all "Show" buttons to expand
 * program sessions, then parse the rendered text for session details.
 *
 * PerfectMind course pages render programs with expandable session lists.
 * Each session shows: date range, day pattern, time, location, instructor, price, status.
 *
 * Example expanded text:
 *   Swimmer 1 #30486
 *   2/10/26 - 3/10/26
 *   Every Tue
 *   05:30 pm - 06:00 pm
 *   Brennan Park Recreation Centre - Beach 2
 *   $18.75 - $37.50
 *   FULL - Waitlist Available
 */
async function scrapeCoursesWithBrowser(widgetId, calendarId, source, calendar, browser) {
  const courses = [];
  let page;

  try {
    page = await browser.newPage();
    await page.setUserAgent(UA);

    const url = `${BASE_URL}/Contacts/BookMe4BookingPages/BookingCoursesPage?calendarId=${calendarId}&widgetId=${widgetId}&embed=False`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click ALL "Show" expander buttons to reveal session details
    const expanderCount = await page.evaluate(() => {
      const expanders = document.querySelectorAll('.bm-group-expander-container');
      expanders.forEach(el => el.click());
      return expanders.length;
    });

    if (expanderCount === 0) return courses;
    // Wait for all sessions to render
    await new Promise(r => setTimeout(r, 3000));

    // Extract all text and parse session blocks
    const pageText = await page.evaluate(() => document.body.innerText);
    const sessions = parseCoursePageText(pageText, source, calendar);
    courses.push(...sessions);

  } catch (err) {
    console.warn(`      Browser course fallback error: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return courses;
}

/** Days-of-week name to JS day number (0=Sunday) */
const DAY_MAP = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
  wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
  sat: 6, saturday: 6
};

/** Parse the full page text from a PerfectMind course page into class entries */
function parseCoursePageText(text, source, calendar) {
  const results = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Session block pattern: "ProgramName #CourseId"
  const sessionHeaderRegex = /^(.+?)\s+#(\d+)$/;
  // Date range: "M/D/YY - M/D/YY"
  const dateRangeRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})$/;
  // Day pattern: "Every Mon" or "Every Mon, Wed, Fri"
  const dayPatternRegex = /^Every\s+(.+)$/i;
  // Time range: "HH:MM am/pm - HH:MM am/pm"
  const timeRegex = /^(\d{1,2}:\d{2}\s*[ap]m)\s*-\s*(\d{1,2}:\d{2}\s*[ap]m)$/i;
  // Price: "$X.XX" or "$X.XX - $Y.YY"
  const priceRegex = /^\$[\d.]+(?:\s*-\s*\$[\d.]+)?$/;

  let i = 0;
  while (i < lines.length) {
    const headerMatch = lines[i].match(sessionHeaderRegex);
    if (!headerMatch) { i++; continue; }

    const programName = headerMatch[1];
    const courseId = headerMatch[2];
    i++;

    // Scan the next few lines for session details
    let dateRange = null, dayPattern = null, startTime = null, endTime = null;
    let location = null, instructor = null, priceDesc = null, status = null;
    const scanEnd = Math.min(i + 10, lines.length);

    while (i < scanEnd) {
      const line = lines[i];

      // Stop if we hit another session header or a program description
      if (sessionHeaderRegex.test(line)) break;
      if (line === 'Show' || line === 'Hide') { i++; continue; }

      const drMatch = line.match(dateRangeRegex);
      if (drMatch) { dateRange = { start: drMatch[1], end: drMatch[2] }; i++; continue; }

      const dpMatch = line.match(dayPatternRegex);
      if (dpMatch) { dayPattern = dpMatch[1]; i++; continue; }

      const tMatch = line.match(timeRegex);
      if (tMatch) { startTime = parseTime(tMatch[1]); endTime = parseTime(tMatch[2]); i++; continue; }

      if (priceRegex.test(line)) { priceDesc = line; i++; continue; }

      // Location line: typically contains "Recreation Centre", "Beach", "Pool", etc.
      if (/recreation|centre|center|pool|arena|gym|studio|room|55 activity/i.test(line) && !location) {
        location = line; i++; continue;
      }

      // Status line: "FULL", "Waitlist", "Register", "Available"
      if (/^(FULL|Waitlist|Register|Available|FULL - Waitlist Available|Spots? available)/i.test(line)) {
        status = line; i++; continue;
      }

      // Instructor: single name line (not matching other patterns)
      if (!instructor && /^[A-Z][a-z]+\s+[A-Z]\.?$/.test(line)) {
        instructor = line; i++; continue;
      }

      i++;
    }

    // Generate class entries if we have enough data
    if (dateRange && startTime) {
      const dates = generateDates(dateRange.start, dateRange.end, dayPattern);

      let price = 0, isFree = false;
      if (priceDesc) {
        const pm = priceDesc.match(/\$?([\d.]+)/);
        if (pm) price = parseFloat(pm[1]);
        if (price === 0) isFree = true;
      }

      const descParts = [];
      if (instructor) descParts.push(`Instructor: ${instructor}`);
      if (location) descParts.push(`Location: ${location}`);
      if (status) descParts.push(`Status: ${status}`);
      if (calendar?.Name) descParts.push(`Program: ${calendar.Name}`);
      descParts.push(`Course #${courseId}`);

      for (const date of dates) {
        results.push({
          title: programName,
          date,
          time: startTime,
          endTime,
          instructor: instructor || null,
          venueName: source.name,
          address: source.address,
          category: mapCategory(programName, location, calendar?.Name),
          bookingSystem: 'perfectmind',
          price,
          isFree,
          priceDescription: priceDesc || 'See venue for pricing',
          description: descParts.join(' | '),
          tags: ['auto-scraped', 'perfectmind', source.name.toLowerCase().replace(/\s+/g, '-')]
        });
      }
    }
  }

  return results;
}

/** Parse a short date like "2/10/26" or "2/10/2026" into YYYY-MM-DD */
function parseShortDate(str) {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  let [month, day, year] = parts.map(Number);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Generate all dates between start and end that match the day pattern */
function generateDates(startStr, endStr, dayPatternStr) {
  const startDate = parseShortDate(startStr);
  const endDate = parseShortDate(endStr);
  if (!startDate || !endDate) return [];

  // Parse day pattern: "Mon" or "Mon, Tue, Wed, Thu, Fri"
  const targetDays = new Set();
  if (dayPatternStr) {
    const dayNames = dayPatternStr.split(/[,\s]+/).filter(Boolean);
    for (const name of dayNames) {
      const lower = name.toLowerCase().substring(0, 3);
      if (DAY_MAP[lower] !== undefined) targetDays.add(DAY_MAP[lower]);
    }
  }

  const dates = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  while (current <= end) {
    if (targetDays.size === 0 || targetDays.has(current.getDay())) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ============================================================
// DATA MAPPING
// ============================================================

/** Map PerfectMind drop-in class to our standard format */
function mapClass(cls, source) {
  // OccurrenceDate: "YYYYMMDD" → "YYYY-MM-DD"
  if (!cls.OccurrenceDate || cls.OccurrenceDate.length !== 8) return null;
  const date = `${cls.OccurrenceDate.substring(0, 4)}-${cls.OccurrenceDate.substring(4, 6)}-${cls.OccurrenceDate.substring(6, 8)}`;

  const startTime = parseTime(cls.FormattedStartTime);
  if (!startTime) return null;
  const endTime = parseTime(cls.FormattedEndTime) || null;

  // Parse price
  let price = 0, isFree = false, priceDescription = 'See venue for pricing';
  if (cls.PriceRange) {
    priceDescription = cls.PriceRange;
    const m = cls.PriceRange.match(/\$?([\d.]+)/);
    if (m) price = parseFloat(m[1]);
    if (price === 0 || /free/i.test(cls.PriceRange)) isFree = true;
  }

  // Build description with rich metadata
  const parts = [];
  if (cls.Instructor?.FullName) parts.push(`Instructor: ${cls.Instructor.FullName}`);
  if (cls.Location) parts.push(`Location: ${cls.Location}${cls.Facility ? ` - ${cls.Facility}` : ''}`);
  if (cls.AgeRestrictions) parts.push(`Ages: ${cls.AgeRestrictions}`);
  if (cls.Spots) parts.push(cls.Spots);
  if (cls.Details) parts.push(cls.Details.substring(0, 200));

  return {
    title: cls.EventName,
    date,
    time: startTime,
    endTime,
    instructor: cls.Instructor?.FullName || null,
    venueName: source.name,
    address: cls.Address?.Street
      ? `${cls.Address.Street}, ${cls.Address.City || 'Squamish'}, BC`
      : source.address,
    category: mapCategory(cls.EventName, cls.Location),
    bookingSystem: 'perfectmind',
    price,
    isFree,
    priceDescription,
    description: parts.join(' | ') || `Recreation class at ${source.name}`,
    tags: ['auto-scraped', 'perfectmind', source.name.toLowerCase().replace(/\s+/g, '-')]
  };
}

/** Map PerfectMind course to our standard format — may return multiple entries */
function mapCourse(course, source, calendar) {
  const results = [];

  // Courses use similar structure to classes in the API response
  const eventName = course.EventName || course.Name;
  if (!eventName) return results;

  // If course has OccurrenceDate (like classes), map directly
  if (course.OccurrenceDate && course.OccurrenceDate.length === 8) {
    const mapped = mapClass(course, source);
    if (mapped) results.push(mapped);
    return results;
  }

  // If course has session dates, extract them
  if (course.FormattedStartDate && course.FormattedStartTime) {
    const dateMatch = course.FormattedStartDate.match(/(\w+),\s+(\w+)\s+(\d+)\w*,?\s*(\d{4})/);
    if (dateMatch) {
      const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const month = months[dateMatch[2].toLowerCase().substring(0, 3)];
      if (month) {
        const date = `${dateMatch[4]}-${month}-${String(dateMatch[3]).padStart(2, '0')}`;
        const startTime = parseTime(course.FormattedStartTime);
        const endTime = parseTime(course.FormattedEndTime) || null;

        if (startTime) {
          let price = 0, isFree = false, priceDescription = 'See venue for pricing';
          if (course.PriceRange) {
            priceDescription = course.PriceRange;
            const m = course.PriceRange.match(/\$?([\d.]+)/);
            if (m) price = parseFloat(m[1]);
            if (price === 0 || /free/i.test(course.PriceRange)) isFree = true;
          }

          const parts = [];
          if (course.Instructor?.FullName) parts.push(`Instructor: ${course.Instructor.FullName}`);
          if (course.Location) parts.push(`Location: ${course.Location}`);
          if (course.AgeRestrictions) parts.push(`Ages: ${course.AgeRestrictions}`);
          if (course.Spots) parts.push(course.Spots);
          if (course.NumberOfSessions) parts.push(`${course.NumberOfSessions} sessions`);
          if (calendar?.Name) parts.push(`Program: ${calendar.Name}`);

          results.push({
            title: eventName,
            date,
            time: startTime,
            endTime,
            instructor: course.Instructor?.FullName || null,
            venueName: source.name,
            address: course.Address?.Street
              ? `${course.Address.Street}, ${course.Address.City || 'Squamish'}, BC`
              : source.address,
            category: mapCategory(eventName, course.Location, calendar?.Name),
            bookingSystem: 'perfectmind',
            price,
            isFree,
            priceDescription,
            description: parts.join(' | ') || `${calendar?.Name || 'Program'} at ${source.name}`,
            tags: ['auto-scraped', 'perfectmind', source.name.toLowerCase().replace(/\s+/g, '-')]
          });
        }
      }
    }
  }

  return results;
}

/** Map PerfectMind activity/location names to Pulse app categories */
function mapCategory(title, location, calendarName) {
  const text = `${title || ''} ${calendarName || ''}`.toLowerCase();
  if (/yoga/i.test(text)) return 'Yoga & Pilates';
  if (/swim/i.test(text)) return 'Swimming';
  if (/aquatic/i.test(text)) return 'Swimming';
  if (/dance/i.test(text)) return 'Dance';
  if (/gymnastic/i.test(text)) return 'Gymnastics';
  if (/martial|karate|judo|jiu/i.test(text)) return 'Martial Arts';
  if (/hockey|skating|arena/i.test(text)) return 'Arena Sports';
  if (/fitness|workout|cardio|strength|hiit|indoor/i.test(text)) return 'Fitness';
  if (/camp/i.test(text)) return 'Camps';
  if (/sport|soccer|basketball|volleyball|badminton/i.test(text)) return 'Sports';
  if (/educational|learning|class/i.test(text)) return 'Education';
  if (/certif/i.test(text)) return 'Certifications';
  if (/birthday/i.test(text)) return 'Birthday Parties';
  if (/play|tot|preschool/i.test(text)) return 'Kids Programs';
  if (/leap/i.test(text)) return 'Kids Programs';
  if (/bus trip/i.test(text)) return 'Activities';
  if (/therapeutic/i.test(text)) return 'Wellness';
  if (/paint|sketch|art|craft/i.test(text)) return 'Arts & Culture';
  if (/drop-in/i.test(text)) return 'Drop-In';
  if (/connect/i.test(text)) return 'Community';
  return 'Recreation';
}

// ============================================================
// MAIN SCRAPER FUNCTION (called by scrape-reliable-sources.js)
// ============================================================

/**
 * Scrape all PerfectMind calendars for a source.
 * @param {object} source - Source config from reliable-sources.js
 * @param {object} browser - Puppeteer browser instance (for course fallback)
 * @returns {{ classesFound: number, classesAdded: number }}
 */
export async function scrapePerfectMindCalendars(source, browser) {
  const widgetId = source.widget_id;
  const venueName = source.name;
  const todayStr = getTodayPacific();

  console.log(`\n📍 ${venueName} (PerfectMind)`);
  console.log('-'.repeat(50));

  // Phase 0: Get all categories and calendars
  console.log('   📋 Fetching category catalog...');
  const categories = await getCategories(widgetId);
  if (!categories || categories.length === 0) {
    throw new Error('No categories returned from PerfectMind widget');
  }

  let totalCalendars = 0;
  for (const cat of categories) totalCalendars += (cat.Calendars || []).length;
  console.log(`   Found ${categories.length} categories, ${totalCalendars} calendars`);

  // Phase 1: Collect all classes from every calendar
  const allClasses = [];
  let calendarsSuccess = 0;
  let calendarsError = 0;

  for (const category of categories) {
    for (const calendar of (category.Calendars || [])) {
      const bookingType = calendar.BookingTypeInfo?.BookingType;
      const label = `${category.Name} > ${calendar.Name}`;

      try {
        let classes;
        if (bookingType === 2) {
          // Drop-in classes — HTTP API (fast, reliable)
          classes = await scrapeDropInClasses(widgetId, calendar, source);
        } else if (bookingType === 3) {
          // Courses — HTTP first, browser fallback
          classes = await scrapeCourses(widgetId, calendar, source, browser);
        } else {
          console.log(`   ⏭️  ${label}: skipping (BookingType ${bookingType})`);
          continue;
        }

        allClasses.push(...classes);
        calendarsSuccess++;
        if (classes.length > 0) {
          console.log(`   ✅ ${label}: ${classes.length} classes`);
        } else {
          console.log(`   ⚪ ${label}: 0 classes`);
        }
      } catch (err) {
        calendarsError++;
        console.warn(`   ❌ ${label}: ${err.message}`);
      }

      // Rate-limit between calendars
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const classesFound = allClasses.length;
  console.log(`\n   📊 Total: ${classesFound} classes from ${calendarsSuccess}/${totalCalendars} calendars (${calendarsError} errors)`);

  if (classesFound === 0) {
    console.warn(`   ⚠️ No classes found for ${venueName} — check PerfectMind widget`);
    return { classesFound: 0, classesAdded: 0 };
  }

  // Phase 2: Delete old PerfectMind data (only after confirming new data exists)
  await deleteOldClasses(venueName, todayStr, 'perfectmind');

  // Phase 3: Insert with dedup
  let classesAdded = 0;
  for (const cls of allClasses) {
    const exists = await classExists(cls.title, cls.date, cls.venueName, cls.time);
    if (exists) continue;

    const success = await insertClass(cls);
    if (success) classesAdded++;
  }

  console.log(`   ✅ ${venueName}: ${classesAdded} added (${classesFound} found)`);
  return { classesFound, classesAdded };
}

// ============================================================
// STANDALONE ENTRY POINT
// ============================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🏛️  PERFECTMIND SCRAPER — District of Squamish');
  console.log('='.repeat(70));
  console.log(`Started: ${new Date().toLocaleString()}`);

  // Import puppeteer for standalone mode
  const puppeteerModule = await import('puppeteer-extra');
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  puppeteerModule.default.use(StealthPlugin());

  const browser = await puppeteerModule.default.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const source = {
    name: 'Brennan Park Recreation Centre',
    widget_id: '15f6af07-39c5-473e-b053-96653f77a406',
    url: 'https://districtofsquamish.perfectmind.com/Contacts/BookMe4?widgetId=15f6af07-39c5-473e-b053-96653f77a406',
    address: '1009 Centennial Way, Squamish, BC',
    category: 'Recreation'
  };

  try {
    const result = await scrapePerfectMindCalendars(source, browser);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ Done: ${result.classesFound} found, ${result.classesAdded} added`);

    // Post-scrape validation
    await validateScrapedData(source.name, 'perfectmind');
    await recordScrapeSuccess(source.name, result.classesFound);
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    await recordScrapeFailure(source.name, error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  console.log('='.repeat(70) + '\n');
}

// Run standalone if executed directly
const isMainModule = process.argv[1]?.endsWith('scrape-perfectmind.js');
if (isMainModule) main();
