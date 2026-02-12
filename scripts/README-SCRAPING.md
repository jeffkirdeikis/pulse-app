# Pulse AI-Powered Scraping System

## Overview

The scraping system has 3 main components:

1. **AI Extraction** (`lib/ai-extractor.js`) - Uses Claude to extract events from ANY webpage format
2. **Source Discovery** (`discover-new-sources.js`) - Automatically finds new Squamish event sources
3. **Multi-Source Verification** (`lib/source-verification.js`) - Cross-references events for accuracy

## Setup

### 1. Add Anthropic API Key

Add to `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...your-key-here
```

Get your key from: https://console.anthropic.com/

### 2. Create Database Tables

The tables are auto-created, but here's the schema for reference:

```sql
-- Discovered sources table
CREATE TABLE discovered_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  booking_system TEXT,
  widget_id TEXT,
  category TEXT,
  business_name TEXT,
  scrape_priority INTEGER,
  scrape_method TEXT,
  event_frequency TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'discovered',
  notes TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event verification columns (added to events table)
ALTER TABLE events ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);
ALTER TABLE events ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS verification_sources INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS merged_from UUID[];
```

## Usage

### Run Full AI Scraper
```bash
npm run scrape:ai
# or
node scripts/scrape-with-ai.js
```

### Discover New Sources
```bash
npm run scrape:ai:discover
# or
node scripts/scrape-with-ai.js --discover
```

### Verify Existing Events
```bash
npm run scrape:ai:verify
# or
node scripts/scrape-with-ai.js --verify
```

### Scrape Single URL
```bash
node scripts/scrape-with-ai.js --url https://example.com/events
```

## How It Works

### 1. AI Extraction

Instead of fragile CSS selectors, Claude reads the entire webpage and extracts:
- Event titles
- Dates and times
- Descriptions
- Prices
- Categories

This works on ANY website format without custom code.

### 2. Source Discovery

The system searches Google for:
- "squamish yoga studio schedule"
- "squamish fitness classes"
- "squamish events calendar"
- etc.

For each result, it:
1. Checks if URL is already known
2. Visits the page
3. Detects booking systems (Mindbody, WellnessLiving, etc.)
4. Uses AI to categorize and prioritize

### 3. Multi-Source Verification

Trust scores by source type:
| Source Type | Trust Score |
|-------------|-------------|
| Direct APIs (Mindbody, WellnessLiving) | 0.95 |
| Official sources (District, Tourism) | 0.90 |
| Widget scraping | 0.88 |
| Aggregators | 0.70-0.75 |
| Web scraping | 0.60-0.65 |
| Community (verified) | 0.85 |
| Community (unverified) | 0.50 |

Events found in multiple sources get a confidence boost (up to +0.30).

## Existing Scrapers

The AI scraper complements these existing scrapers:

| Scraper | Platform | Studios |
|---------|----------|---------|
| `scrape-fitness-classes.js` | Mindbody API | Shala Yoga, Wild Life Gym |
| `scrape-wellnessliving.js` | WellnessLiving API | Breathe Fitness |
| `scrape-mindbody-classic.js` | Mindbody Classic | Squamish Barbell |
| `scrape-events.js` | Community aggregators | District of Squamish, Tourism |

## Cost Considerations

The AI scraper uses Claude API calls:
- ~$0.003 per event extracted
- ~$0.001 per event validated
- ~$0.002 per source categorized

For 100 events/day = ~$0.40/day or ~$12/month

## Monitoring

Check scraper stats:
```sql
-- Events by confidence score
SELECT
  CASE
    WHEN confidence_score >= 0.9 THEN 'High (90%+)'
    WHEN confidence_score >= 0.7 THEN 'Medium (70-90%)'
    ELSE 'Low (<70%)'
  END as confidence_level,
  COUNT(*)
FROM events
WHERE confidence_score IS NOT NULL
GROUP BY 1;

-- Sources by status
SELECT status, COUNT(*) FROM discovered_sources GROUP BY status;

-- Events by source type
SELECT unnest(tags) as source, COUNT(*)
FROM events
WHERE tags IS NOT NULL
GROUP BY 1
ORDER BY 2 DESC;
```
