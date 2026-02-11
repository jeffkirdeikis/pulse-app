# Pulse App — Scraping Coverage Audit

**Last updated:** Feb 10, 2026
**Source directory:** `squamish_business_directory_updated.xlsx` (~656 businesses)

---

## Coverage Summary

| Tier | Count | Method | Schedule |
|------|-------|--------|----------|
| Dedicated booking system scrapers | 12 | Mindbody/WellnessLiving/Brandedweb/SMGB/PerfectMind/MarianaTek | 6x daily |
| Businesses with websites | ~620 | `scrape-orchestrator.js --verified` | 2x daily |
| Event aggregators | 19 sources | `scrape-events.js` | 2x daily |
| Deal aggregators | 8+ sources | `scrape-deals.js` | 1x daily |
| Businesses without websites | ~26 | Manual data entry only | Not covered |

---

## Crontab Schedule

```
# Reliable sources (12 booking system venues): 6x daily
0 6,9,12,15,18,21 * * * node scripts/scrape-reliable-sources.js

# Full orchestrator (ALL businesses): 2x daily at 2AM and 2PM
0 2,14 * * * node scripts/scrape-orchestrator.js --verified

# Community events (aggregators): 2x daily at 5AM and 5PM
0 5,17 * * * node scripts/scrape-events.js

# Deals: 1x daily at 4AM
0 4 * * * node scripts/scrape-deals.js
```

---

## Dedicated Booking System Scrapers (12 venues)

These have the highest data reliability — they parse structured booking system data directly.

| # | Business | Booking System | ID | Script | Data |
|---|----------|---------------|----|--------|------|
| 1 | Shala Yoga | Mindbody Widget | 189264 | scrape-reliable-sources.js | Classes |
| 2 | Wild Life Gym | Mindbody Widget | 69441 | scrape-reliable-sources.js | Classes |
| 3 | Squamish Barbell | Mindbody Classic | studio:7879 | scrape-reliable-sources.js | Classes |
| 4 | Seed Studio | Mindbody Classic | studio:5729485 | scrape-reliable-sources.js | Classes |
| 5 | Mountain Fitness Center | Mindbody Classic | studio:265219 | scrape-reliable-sources.js | Classes |
| 6 | Breathe Fitness Studio | WellnessLiving | studio:338540 | scrape-reliable-sources.js | Classes |
| 7 | The Sound Martial Arts | WellnessLiving | studio:414578 | scrape-reliable-sources.js | Classes |
| 8 | Roundhouse Martial Arts | Mariana Tek | tenant:roundhousesquamish | scrape-marianatek.js | 117 classes (Boxing, BJJ, MMA, Muay Thai, Kickboxing) |
| 9 | Oxygen Yoga & Fitness | Brandedweb | 5922581a2 | scrape-reliable-sources.js | Classes |
| 10 | The Ledge Climbing Centre | SendMoreGetBeta | 13326 | scrape-reliable-sources.js | Classes |
| 11 | Brennan Park Recreation Centre | PerfectMind | widget:15f6af07 | scrape-perfectmind.js | Classes, Courses, Swim Lessons (1,500+ entries) |
| 12 | *(Total across all venues)* | | | | |

---

## Event Aggregator Sources (scrape-events.js)

| # | Source | URL | Data |
|---|--------|-----|------|
| 1 | Together Nest - Activities | together-nest.com/discover?category=activities | Classes/Activities |
| 2 | Together Nest - Events | together-nest.com/discover?category=events | Events |
| 3 | Together Nest - All | together-nest.com/discover | All |
| 4 | Sea to Sky Kids | seatoskykids.ca/directory/ | Family Activities |
| 5 | Explore Squamish | exploresquamish.com/festivals-events/event-calendar/ | Events |
| 6 | Meetup Squamish | meetup.com/find/?location=ca--bc--squamish | Events |
| 7 | Eventbrite Squamish | eventbrite.com/d/canada--squamish/events/ | Events |
| 8 | District of Squamish Rec | squamish.ca/rec/ | Activities |
| 9 | Downtown Squamish | downtownsquamish.com/listings/ | Activities |
| 10 | Tourism Squamish | tourismsquamish.com/events/ | Events |
| 11 | Squamish Chief | squamishchief.com/local-events | Events |
| 12 | District of Squamish Events | squamish.ca/events/ | Events |
| 13 | Squamish Arts Council | squamishartscouncil.com/events | Events |
| 14 | Sea to Sky Community Services | sscs.ca/events/ | Events |
| 15 | The Wilder Events | thewilder.ca/events | Events |
| 16 | Squamish Nation Events | squamish.net/events-gatherings/calendar/ | Events |
| 17 | Squamish Chamber Events | squamishchamber.com/events-programming/ | Events |
| 18 | The Locals Board Events | thelocalsboard.com/events/ | Events |
| 19 | Sweet Threads Yarn & Fibre | sweetthreads.com/events | Classes/Events |

---

## Deal Sources (scrape-deals.js)

| # | Source | URL | Data |
|---|--------|-----|------|
| 1 | Squamish Adventure | squamishadventure.com/local-squamish-deals/ | Deals |
| 2 | The Locals Board | thelocalsboard.com/sea-to-sky-business-directory/ | Directory/Deals |
| 3 | BC Buy Local | bcbuylocal.com/communities/squamish/ | Directory/Deals |
| 4 | Tourism Squamish Deals | tourismsquamish.com/deals/ | Deals |
| 5 | Explore Squamish | exploresquamish.com/business/ | Directory/Deals |
| 6 | Squamish Chamber | squamishchamber.com/explore/ | Directory/Deals |
| 7 | Downtown Squamish | downtownsquamish.com/listings/ | Directory/Deals |
| 8 | Squamish Chief Classifieds | squamishchief.com/classifieds | Classifieds/Deals |
| + | Business websites (20/run) | Individual business sites | Deals |
