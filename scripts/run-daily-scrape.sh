#!/bin/bash

# Daily Scrape Runner - Only runs once per day
# This script checks if scraping already happened today and skips if so

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOCK_FILE="/tmp/pulse-scrape-$(date +%Y-%m-%d).done"
LOG_FILE="/tmp/pulse-scraper.log"

# Check if already ran today
if [ -f "$LOCK_FILE" ]; then
    echo "$(date): Scrape already completed today, skipping" >> "$LOG_FILE"
    exit 0
fi

echo "$(date): Starting daily scrape..." >> "$LOG_FILE"

cd "$PROJECT_DIR"

# Run Mindbody scraper
echo "$(date): Running Mindbody scraper..." >> "$LOG_FILE"
node scripts/scrape-fitness-classes.js >> "$LOG_FILE" 2>&1

# Run WellnessLiving scraper
echo "$(date): Running WellnessLiving scraper..." >> "$LOG_FILE"
node scripts/scrape-wellnessliving.js >> "$LOG_FILE" 2>&1

# Run Brandedweb scraper (Oxygen Yoga)
echo "$(date): Running Brandedweb scraper..." >> "$LOG_FILE"
node scripts/scrape-brandedweb.js >> "$LOG_FILE" 2>&1

# Run SendMoreGetBeta scraper (The Ledge)
echo "$(date): Running SendMoreGetBeta scraper..." >> "$LOG_FILE"
node scripts/scrape-sendmoregetbeta.js >> "$LOG_FILE" 2>&1

# Run Classic Mindbody scraper (Squamish Barbell, Seed Studio)
echo "$(date): Running Classic Mindbody scraper..." >> "$LOG_FILE"
node scripts/scrape-mindbody-classic.js >> "$LOG_FILE" 2>&1

# Mark as done for today
touch "$LOCK_FILE"
echo "$(date): Daily scrape completed" >> "$LOG_FILE"

# Clean up old lock files (older than 2 days)
find /tmp -name "pulse-scrape-*.done" -mtime +2 -delete 2>/dev/null
