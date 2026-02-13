#!/bin/bash

# Daily Scrape Runner - Scrapes EVERYTHING, EVERY TIME
#
# CRITICAL RULE: Every single business in the Squamish directory (~500 businesses)
# must be scraped on every run. No exceptions. No skips. No silent failures.
#
# This script runs ALL scrapers in sequence:
# 1. Reliable sources (10 venues with dedicated booking system scrapers)
# 2. Full orchestrator (ALL businesses with AI-verified extraction)
# 3. Community events (aggregator sites: Together Nest, Eventbrite, Meetup, etc.)
# 4. Venue-specific event scrapers (Trickster's Hideout, Brackendale Art Gallery)
# 5. Deals (ExploreSquamish dining deals + happy hours — HTML parsing, no AI)
#
# UPDATED Feb 10, 2026: Restored full scraping coverage. Previously only ran
# scrape-reliable-sources.js (10 venues). Now runs ALL scrapers to cover
# the entire business directory.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/pulse-scraper.log"

echo "" >> "$LOG_FILE"
echo "================================================================" >> "$LOG_FILE"
echo "$(date): STARTING FULL DAILY SCRAPE — ALL BUSINESSES" >> "$LOG_FILE"
echo "================================================================" >> "$LOG_FILE"

cd "$PROJECT_DIR"

# STEP 1: Reliable sources (dedicated booking system scrapers — fast, high priority)
echo "$(date): [1/4] Running reliable sources scraper (10 booking system venues)..." >> "$LOG_FILE"
node scripts/scrape-reliable-sources.js >> "$LOG_FILE" 2>&1
echo "$(date): [1/4] Reliable sources complete" >> "$LOG_FILE"

# STEP 2: Full orchestrator — scrapes ALL businesses with websites
# Uses --verified flag for AI extraction with source text verification
echo "$(date): [2/4] Running full orchestrator (ALL ~500 businesses)..." >> "$LOG_FILE"
node scripts/scrape-orchestrator.js --verified >> "$LOG_FILE" 2>&1
echo "$(date): [2/4] Full orchestrator complete" >> "$LOG_FILE"

# STEP 3: Community events (aggregator sites)
echo "$(date): [3/5] Running community events scraper..." >> "$LOG_FILE"
node scripts/scrape-events.js >> "$LOG_FILE" 2>&1
echo "$(date): [3/5] Community events complete" >> "$LOG_FILE"

# STEP 4: Venue-specific event scrapers (8 sources)
# Trickster's (WP API), BAG (Eventbrite widget), A-Frame (Squarespace API),
# Arrow Wood Games (Tockify), Sea to Sky Gondola, Squamish Library (Communico API),
# Squamish Arts Council (WP Tribe Events API), Tourism Squamish (calendar + detail pages)
# — all use JS-rendered or API-based event pages that generic AI extraction can't reach.
echo "$(date): [4/5] Running venue event scrapers (8 sources)..." >> "$LOG_FILE"
node scripts/scrape-venue-events.js >> "$LOG_FILE" 2>&1
echo "$(date): [4/5] Venue event scrapers complete" >> "$LOG_FILE"

# STEP 5: Deals
echo "$(date): [5/5] Running deals scraper..." >> "$LOG_FILE"
node scripts/scrape-deals.js >> "$LOG_FILE" 2>&1
echo "$(date): [5/5] Deals scraper complete" >> "$LOG_FILE"

echo "================================================================" >> "$LOG_FILE"
echo "$(date): FULL DAILY SCRAPE COMPLETED — ALL 5 SCRAPERS RAN" >> "$LOG_FILE"
echo "================================================================" >> "$LOG_FILE"
