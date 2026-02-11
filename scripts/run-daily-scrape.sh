#!/bin/bash

# Daily Scrape Runner - Only runs once per day
# This script checks if scraping already happened today and skips if so
#
# UPDATED Feb 10, 2026: Now uses unified scraper (scrape-reliable-sources.js)
# which handles all 10 venues with delete-after-insert safety pattern.

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

# Run unified reliable sources scraper (all 10 venues)
echo "$(date): Running unified scraper..." >> "$LOG_FILE"
node scripts/scrape-reliable-sources.js >> "$LOG_FILE" 2>&1

# Mark as done for today
touch "$LOCK_FILE"
echo "$(date): Daily scrape completed" >> "$LOG_FILE"

# Clean up old lock files (older than 2 days)
find /tmp -name "pulse-scrape-*.done" -mtime +2 -delete 2>/dev/null
