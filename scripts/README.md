# Pulse Scraper Scripts

## Quick Start

```bash
# Scrape fitness classes (30 days)
npm run scrape:classes

# Scrape community events
npm run scrape:events

# Scrape everything
npm run scrape:all
```

## Automated Scraping

### Option 1: GitHub Actions (Recommended)

The workflow at `.github/workflows/scrape-classes.yml` runs daily at 6 AM UTC.

**Setup:**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `SUPABASE_URL`: https://ygpfklhjwwqwrfpsfhue.supabase.co
   - `SUPABASE_KEY`: Your Supabase service key
   - `FIRECRAWL_API_KEY`: Your Firecrawl API key

### Option 2: Local Cron (macOS/Linux)

```bash
# Open crontab editor
crontab -e

# Add this line to run daily at 6 AM local time:
0 6 * * * cd /path/to/pulse-app && /usr/local/bin/node scripts/scrape-fitness-classes.js >> /tmp/pulse-scraper.log 2>&1
```

### Option 3: Manual

Just run `npm run scrape:classes` whenever you want to refresh the data.

## Adding New Studios

The fitness class scraper uses the Mindbody Widget API. To add a new studio:

1. Go to the studio's schedule page
2. Open browser DevTools → Network tab
3. Refresh and look for requests to `widgets.mindbodyonline.com`
4. Find the widget ID in the URL (e.g., `/schedules/189264/`)
5. Add to `FITNESS_STUDIOS` array in `scrape-fitness-classes.js`:

```javascript
{
  name: 'Studio Name',
  widgetId: '123456',  // The ID you found
  address: 'Address, Squamish, BC',
  category: 'Yoga & Pilates',  // or 'Fitness', 'Dance', etc.
  bookingSystem: 'mindbody'
}
```

## Currently Supported Studios

| Studio | Widget ID | Status |
|--------|-----------|--------|
| Shala Yoga | 189264 | ✅ Working |

## Scripts

| Script | Purpose |
|--------|---------|
| `scrape-fitness-classes.js` | Scrapes Mindbody studio schedules (30 days) |
| `scrape-events.js` | Scrapes community events from Together Nest, etc. |
| `discover-widget-ids.js` | Helps find Mindbody widget IDs for new studios |
| `debug-healcode-network.js` | Debug tool for inspecting widget network calls |
