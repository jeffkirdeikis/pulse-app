# Scraper Reference — Pulse App

> This is reference material for scraper work. Read on-demand, not loaded every message.
> Core scraping rules are in `CLAUDE.md`. This file has architecture details.

---

## 5-Step Daily Scrape Pipeline (run-daily-scrape.sh)

| Step | Script | What It Covers | Method |
|------|--------|----------------|--------|
| 1 | `scrape-reliable-sources.js` | 10 venues with booking systems | WellnessLiving, Brandedweb, SendMoreGetBeta APIs |
| 2 | `scrape-orchestrator.js --verified` | ~500 businesses with websites | AI extraction with 5-layer source verification |
| 3 | `scrape-events.js` | Aggregator sites (Together Nest, Eventbrite, Meetup) | Firecrawl + schema extraction |
| 4 | `scrape-venue-events.js` | 8 venue-specific sources (see below) | APIs, HTML parsing, calendar scraping |
| 5 | `scrape-deals.js` | Deal aggregators + business promotions | Firecrawl + AI extraction |

---

## 8 Venue Event Sources (scrape-venue-events.js)

**File**: `scripts/scrape-venue-events.js` — ~268 events/run across 15+ venues

| # | Venue | Data Source | Method |
|---|-------|------------|--------|
| 1 | Trickster's Hideout | WordPress REST API | `wp-json/tribe/events/v1/events` — paginated JSON |
| 2 | Brackendale Art Gallery (BAG) | Eventbrite widget | Fetch events page HTML, parse `data-widget-id`, call Eventbrite API |
| 3 | A-Frame Brewing | Squarespace API | `/api/open/GetItemsByMonth` — returns JSON events |
| 4 | Arrow Wood Games | Tockify widget | `tockify.com/api/ngevent` — JSON feed |
| 5 | Sea to Sky Gondola | Website HTML | Fetch events listing page, parse structured event cards |
| 6 | Squamish Public Library | Communico API | `events.squamishlibrary.ca/api` — paginated JSON |
| 7 | Squamish Arts Council | WordPress Tribe Events API | `squamisharts.com/wp-json/tribe/events/v1/events` — paginated JSON with venue data |
| 8 | Tourism Squamish | Calendar HTML + detail pages | 3-step: calendar grid → event URLs per day → detail page metadata |

### Tourism Squamish Scraper (Most Complex — #8)

Most valuable source (~91 events, 15+ venues) using server-rendered HTML:

1. **Fetch calendar pages** for each month from `exploresquamish.com/festivals-events/event-calendar/`
2. **Parse day→event URL mappings** from HTML `<td>` table cells — calendar grid resolves recurrence patterns
3. **Fetch detail pages** (5 at a time concurrency) to extract: title, time, venue, cost, description

Key design decisions:
- Calendar grid approach avoids parsing "Every Wednesday until..." recurrence text
- `TOURISM_DAILY_SKIP = 15` — events on 15+ days are daily attractions, not events
- Events without parseable time are SKIPPED (not inserted with fake times)
- Venue extraction has two fallback parsers: "Venue" section primary, "Contact & Details" fallback

### Adding a New Venue Source

1. **Check for structured API first** — WordPress Tribe, Squarespace, Tockify, Communico, Eventbrite APIs
2. **If no API, check for calendar HTML** — table-based calendars parse reliably
3. **If neither, use Firecrawl** — last resort, verify output against live page
4. **Add config object** at top of `scrape-venue-events.js` with `tag` and source fields
5. **Create `scrapeVenueName()` function** following existing patterns
6. **Add to `main()` function's** parallel execution and summary logging
7. **Run and verify**: check DB for correct venue names, times, no duplicates

---

## Deals Scraper

**File**: `scripts/scrape-deals.js` — HTML parsing, NO unverified AI extraction
**~18 deals/run** across 15+ venues from 1 structured source

### Why It Was Rebuilt (Feb 12, 2026)

Original used Firecrawl AI extraction on 8 sources — same unverified approach that hallucinated 1,471 fake events. Found 312 hallucinated deals (beer names, menu items, business names as deals). All deleted, scraper rewritten with HTML parsing.

### Source: ExploreSquamish Dining Deals

**URL**: `exploresquamish.com/travel-deals-packages/squamish-dining-deals/`
**Method**: Direct HTML fetch + accordion section parsing (no AI, no Firecrawl)

Parse structure: `<h3 class=accordion__heading><button>` = business names, `<div class="accordion__content-text">` = deal content, `<strong>` = day labels, `<ul><li>` after "HAPPY HOURS" = happy hour venues.

---

## Scraper Data Quality

### Validation After Any Scraper Run

```sql
-- Date duplication detection (ratio > 25 = navigation failed, same schedule stamped on every day)
SELECT venue_name, COUNT(*) as total, COUNT(DISTINCT title) as titles,
  ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT title), 0), 1) as ratio
FROM events WHERE tags @> '{"auto-scraped"}' AND event_type = 'class'
GROUP BY venue_name HAVING COUNT(*)::numeric / NULLIF(COUNT(DISTINCT title), 0) > 20
ORDER BY ratio DESC;

-- Suspicious clustering (placeholder detection)
SELECT start_time, COUNT(*) FROM events
WHERE tags @> '{"auto-scraped"}'
GROUP BY start_time ORDER BY COUNT(*) DESC LIMIT 5;

-- Business listings as events (bad data)
SELECT * FROM events WHERE title = venue_name;

-- Orphaned events
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;
```

### Bad Data Indicators

- Many events at 9:00 AM with `auto-scraped` tag
- Events where title = venue_name
- Holiday events on wrong dates
- Studio with suspiciously low class count (dedup dropping valid records)

---

## Scraper Lessons Learned

### Date Duplication (Feb 5, 2026)

WellnessLiving/Brandedweb scrapers used day-by-day loops with fragile navigation. When navigation failed silently, same page scraped 30 times with different computed dates. **Rule**: Dates must come from parsed page text, API responses, or DOM elements — never from loop counters.

Safeguards: `validateScrapedData()` auto-deletes ratio > 25x, `insertClass()` rejects invalid dates, navigation failures stop scraping.

### Dedup False-Positive (Feb 6, 2026)

`classExists()` checked only `title + date + venue_name` — not `start_time`. Same-title classes at different times dropped (Wild Life Gym lost 50%+). **Rule**: Dedup must include ALL unique fields: `title + date + time + venue`.

### Booking System Detection (Feb 6, 2026)

Roundhouse detected as WellnessLiving but had no public schedule. **Rule**: Always verify booking system actually has public data before adding to scrapers.

### Scraper Rules Summary

| DO | DON'T |
|----|-------|
| Return `null` when parsing fails | Return fallback like `'09:00'` |
| Skip records with missing fields | Insert with fake values |
| Log warnings for debugging | Silently use defaults |
| Include ALL unique fields in dedup | Check only title+date (misses time) |
| Verify booking system has public data | Assume detection means data exists |
| Use greedy regex `[^\n]+` for field extraction | Use lazy `[^\n]+?` with optional groups |
| Verify data in DATABASE after scraping | Trust console output |
| Handle ALL HTML entities (`&#039;`, `&apos;`, etc.) | Assume consistent encoding |
| Prefer aggregator sites | Build individual scrapers per venue |
| Use calendar grid for dates | Re-parse recurrence patterns |
| Add fallback parsers for page layouts | Assume consistent HTML structure |

### Verified AI Extraction Pipeline (5 anti-hallucination layers)

`scripts/lib/verified-extractor.js`:

1. **Signal pre-filter** (free) — pages without dates/times/event keywords never reach AI
2. **Strict AI prompt** — uses `innerText` not HTML, requires `source_quote`, "return empty if none"
3. **Source text verification** — title must appear in page text (80%+ word match), date/time must appear
4. **event-validator.js** — forbidden titles, hallucination patterns, placeholder/clustering detection
5. **Database constraints** — CHECK constraints, holiday triggers, quarantine table

All AI-verified events tagged `['auto-scraped', 'ai-verified', 'website-verified']` with `confidence_score = 0.75`.
