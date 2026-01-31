# CLAUDE.md - Project Instructions for Claude Code

## MANDATORY RULES

### 1. ALWAYS QA YOUR OWN WORK
- After ANY code change, run the app and verify it works
- Check the browser at http://localhost:5173/
- Look for console errors
- Test the specific feature you changed
- Do NOT mark a task complete until you've verified it works

### 2. COMPLETE THE FULL TASK
- Do not stop halfway
- If you change a button, verify the button works end-to-end
- If you fix an icon, check it appears correctly AND functions correctly
- If you add a feature, test all user flows

### 3. BE THOROUGH
- When editing UI, check both desktop and mobile views
- When editing data, verify it saves to Supabase AND displays correctly
- When fixing bugs, confirm the bug is actually fixed

### 4. REPORT WHAT YOU VERIFIED
After every task, tell me:
- What you changed
- How you tested it
- What you saw (screenshot description or console output)
- Any issues found and fixed

## PROJECT CONTEXT
- This is Pulse, a community platform for Squamish BC
- Frontend: React + Vite
- Database: Supabase (664 businesses)
- The app runs at http://localhost:5173/

## KEY FILES
- src/App.jsx - Main app (large file, 25k+ lines and growing)
- src/hooks/useUserData.js - User data and save functionality
- src/lib/supabase.js - Database connection
- src/lib/gamification.js - XP system
