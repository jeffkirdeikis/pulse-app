#!/bin/bash

# Setup automated daily class scraping
# Runs at 6 AM, 12 PM, and 6 PM - but only actually scrapes once per day
# The wrapper script checks for a daily lock file and skips if already done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/pulse-scraper.log"

echo "=== Pulse Class Scraper - Cron Setup ==="
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

# Create cron entries for 6 AM, 12 PM, and 6 PM
# The run-daily-scrape.sh script handles the "only once per day" logic
CRON_6AM="0 6 * * * $PROJECT_DIR/scripts/run-daily-scrape.sh"
CRON_12PM="0 12 * * * $PROJECT_DIR/scripts/run-daily-scrape.sh"
CRON_6PM="0 18 * * * $PROJECT_DIR/scripts/run-daily-scrape.sh"

echo "This will add cron jobs at:"
echo "  • 6:00 AM"
echo "  • 12:00 PM"
echo "  • 6:00 PM"
echo ""
echo "Only the first attempt each day will run. Others skip automatically."
echo ""

read -p "Do you want to install these cron jobs? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Remove existing pulse scraper cron jobs
    if crontab -l 2>/dev/null | grep -q "pulse\|scrape"; then
        echo "Removing old cron jobs..."
        crontab -l 2>/dev/null | grep -v "pulse\|scrape" | crontab -
    fi

    # Add the new cron jobs
    (crontab -l 2>/dev/null; echo "$CRON_6AM"; echo "$CRON_12PM"; echo "$CRON_6PM") | crontab -

    echo ""
    echo "✅ Cron jobs installed!"
    echo ""
    echo "Current cron jobs:"
    crontab -l
    echo ""
    echo "Logs will be written to: $LOG_FILE"
    echo ""
    echo "To remove these cron jobs later, run:"
    echo "  crontab -e"
    echo "  (then delete the lines containing run-daily-scrape.sh)"
else
    echo "Cancelled. No changes made."
fi

echo ""
echo "To run the scraper manually:"
echo "  npm run scrape:all"
echo ""
echo "To check logs:"
echo "  tail -f $LOG_FILE"
echo ""
echo "To force a re-run today (skip the 'already ran' check):"
echo "  rm /tmp/pulse-scrape-\$(date +%Y-%m-%d).done && npm run scrape:all"
