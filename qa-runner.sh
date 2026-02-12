#!/bin/bash
# ============================================================
# PULSE QA RUNNER — Set and forget. Come back to a full report.
# ============================================================
# Usage: ./qa-runner.sh
# Make sure you're in your Pulse project root directory.
# ============================================================

set +e  # Don't abort on individual task failures — we track them in FAILED_TASKS

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  PULSE QA RUNNER — Starting full QA suite${NC}"
echo -e "${GREEN}  $(date)${NC}"
echo -e "${GREEN}============================================================${NC}"


# Create reports directory
mkdir -p qa-reports

# Define all QA tasks — add/remove/reorder as needed
# Format: "Human-readable name|filename-slug"
TASKS=(
  "Consumer View — Classes Tab|classes-tab"
  "Consumer View — Events Tab|events-tab"
  "Consumer View — Deals Tab|deals-tab"
  "Consumer View — Services Tab|services-tab"
  "Consumer View — Wellness Tab|wellness-tab"
  "Auth Flows (Sign up, Login, Logout, Protected Routes)|auth-flows"
  "Profile & User Features (XP, Levels, Settings)|profile-features"
  "Business View (Directory, Search, Filters, Individual Pages)|business-view"
  "Admin View (Dashboard, Management)|admin-view"
  "Navigation & Layout (Header, Footer, Sidebar, Responsive)|navigation-layout"
  "Cross-Cutting Concerns (API errors, Console errors, Performance)|cross-cutting"
  "Edge Cases & Destructive Testing (Double-clicks, Empty inputs, Long strings)|edge-cases"
)

TOTAL=${#TASKS[@]}
CURRENT=0
FAILED_TASKS=()

for task in "${TASKS[@]}"; do
  IFS='|' read -r name slug <<< "$task"
  CURRENT=$((CURRENT + 1))

  echo ""
  echo -e "${YELLOW}[${CURRENT}/${TOTAL}] Starting QA: ${name}${NC}"
  echo -e "${YELLOW}Report will be saved to: qa-reports/${slug}.md${NC}"
  echo "Started at: $(date)"

  # Skip tasks that already have a complete report (>5KB = likely finished)
  if [ -f "qa-reports/${slug}.md" ] && [ "$(wc -c < "qa-reports/${slug}.md")" -gt 5000 ]; then
    echo -e "${GREEN}[${CURRENT}/${TOTAL}] Skipping (report already exists): ${name}${NC}"
    continue
  fi

  # Run Claude Code with a fresh context for this specific task
  # --print flag = non-interactive, single prompt, exits when done
  # Watchdog kills the process after 15 minutes to prevent hanging
  claude --print \
    "YOU ARE RUNNING AUTOMATED QA. Follow these instructions EXACTLY:

1. Read PULSE_QA_PROTOCOL.md first. Understand it fully.

2. Your scope is ONLY: ${name}
   Do NOT test anything outside this scope.

3. STEP 1 — Start the dev server if it's not already running (check first with curl or lsof).

4. STEP 2 — ENUMERATE every interactive element in scope:
   - Every button (list them all by text/label)
   - Every link (list them all with expected destinations)
   - Every input/form field
   - Every dropdown, modal trigger, toggle
   Write this inventory to qa-reports/${slug}.md immediately.

5. STEP 3 — TEST every element you enumerated:
   - Open the app in a browser or use the running dev server
   - For each element, record: what you did, what happened, pass/fail
   - After every 5 checks, SAVE your progress to qa-reports/${slug}.md

6. STEP 4 — Write the final report to qa-reports/${slug}.md in this format:

# QA Report: ${name}
## Date: $(date +%Y-%m-%d)
## Element Inventory
(list all elements found)
## Test Results
| # | Element | Action | Expected | Actual | Status |
|---|---------|--------|----------|--------|--------|
| 1 | ... | ... | ... | ... | ✅/❌/⚠️ |
## Summary
- Total checks: X
- Passes: X
- Failures: X
- Warnings: X
## Critical Issues
(list any ❌ items that block launch)
## Minor Issues
(list any ⚠️ items)

7. SAVE the report to qa-reports/${slug}.md before you finish. This is NON-NEGOTIABLE.

REMEMBER: You are testing the LIVE RUNNING APP, not reading code. Click buttons. Submit forms. Check what actually happens." \
    > "qa-reports/${slug}-log.txt" 2>&1 &
  CLAUDE_PID=$!

  # Watchdog: kill after 15 minutes if still running
  ( sleep 900 && kill $CLAUDE_PID 2>/dev/null && echo -e "${RED}[${CURRENT}/${TOTAL}] TIMEOUT after 15 min: ${name}${NC}" ) &
  WATCHDOG_PID=$!

  # Wait for claude to finish (or be killed by watchdog)
  wait $CLAUDE_PID 2>/dev/null
  RESULT=$?

  # Cancel watchdog if claude finished on its own
  kill $WATCHDOG_PID 2>/dev/null
  wait $WATCHDOG_PID 2>/dev/null

  if [ $RESULT -eq 0 ]; then
    echo -e "${GREEN}[${CURRENT}/${TOTAL}] Completed: ${name}${NC}"
  else
    echo -e "${RED}[${CURRENT}/${TOTAL}] FAILED or timed out: ${name}${NC}"
    FAILED_TASKS+=("$name")
  fi

  echo "Finished at: $(date)"
  echo "---"
done

echo ""
echo -e "${YELLOW}============================================================${NC}"
echo -e "${YELLOW}  All individual QA tasks complete. Generating final report...${NC}"
echo -e "${YELLOW}============================================================${NC}"

# Final aggregation pass with fresh context (15 min timeout)
claude --print \
  "Read ALL .md files in the qa-reports/ directory (not the -log.txt files).

Combine them into a single comprehensive report at qa-reports/FINAL-QA-REPORT.md

Use this structure:

# PULSE — FULL QA REPORT
## Generated: $(date +%Y-%m-%d)

## Executive Summary
- Total pages/sections tested: X
- Total individual checks performed: X (sum from all reports)
- Total passes: X
- Total failures: X
- Total warnings: X
- Overall health score: X% (passes / total checks)

## 🔴 Critical Issues (must fix before launch)
(combine all critical issues from all reports, numbered)

## 🟡 Major Issues (should fix before launch)
(combine all major issues)

## 🟢 Minor Issues (fix when possible)
(combine all minor issues)

## Detailed Results by Section
(include the full table from each individual report)

## Sections That May Need Re-testing
(list any reports that seem incomplete or where the agent may have hit context limits)

Save to qa-reports/FINAL-QA-REPORT.md" \
  > "qa-reports/final-report-log.txt" 2>&1 &
FINAL_PID=$!
( sleep 900 && kill $FINAL_PID 2>/dev/null ) &
FINAL_WATCHDOG=$!
wait $FINAL_PID 2>/dev/null
kill $FINAL_WATCHDOG 2>/dev/null
wait $FINAL_WATCHDOG 2>/dev/null

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  QA COMPLETE${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "📄 Final report: qa-reports/FINAL-QA-REPORT.md"
echo "📁 Individual reports: qa-reports/*.md"
echo "📋 Raw logs: qa-reports/*-log.txt"
echo ""

if [ ${#FAILED_TASKS[@]} -gt 0 ]; then
  echo -e "${RED}⚠️  The following tasks had issues (check their logs):${NC}"
  for ft in "${FAILED_TASKS[@]}"; do
    echo -e "${RED}   - $ft${NC}"
  done
  echo ""
  echo "To re-run a failed task, run it manually:"
  echo '  claude --print "Run QA on [SECTION NAME] following PULSE_QA_PROTOCOL.md. Save to qa-reports/[slug].md"'
fi

echo ""
echo "Done at: $(date)"
