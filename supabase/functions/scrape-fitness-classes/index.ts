// Supabase Edge Function: Scrape Fitness Classes
// Runs daily via cron to fetch 30 days of classes from Mindbody studios
// Deploy: supabase functions deploy scrape-fitness-classes
// Cron: Set up in Supabase Dashboard > Database > Extensions > pg_cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Fitness studios with Mindbody widget IDs
const FITNESS_STUDIOS = [
  {
    name: 'Shala Yoga',
    widgetId: '189264',
    address: '40383 Tantalus Rd, Unit 3, Squamish, BC',
    category: 'Yoga & Pilates'
  },
  {
    name: 'Wild Life Gym',
    widgetId: '69441',
    address: 'Squamish, BC',
    category: 'Fitness'
  }
]

const DAYS_TO_SCRAPE = 30

interface ClassData {
  title: string
  time: string
  endTime: string
  instructor: string
  studioName: string
  studioAddress: string
  category: string
  date: string
}

async function fetchMindbodySchedule(widgetId: string, date: string): Promise<any> {
  const url = `https://widgets.mindbodyonline.com/widgets/schedules/${widgetId}/load_markup?options%5Bstart_date%5D=${date}`

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function parseClasses(html: string, date: string, studio: typeof FITNESS_STUDIOS[0]): ClassData[] {
  const classes: ClassData[] = []

  // Unescape HTML entities
  html = html
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/')

  // Extract class data using regex
  const classNames = [...html.matchAll(/data-bw-widget-mbo-class-name="([^"]+)"/g)].map(m => m[1])
  const startTimes = [...html.matchAll(/<time class="hc_starttime" datetime="[^"]*">\s*([^<]+)<\/time>/g)].map(m => m[1].trim())
  const endTimes = [...html.matchAll(/<time class="hc_endtime" datetime="[^"]*">\s*([^<]+)<\/time>/g)].map(m => m[1].trim())
  const instructors = [...html.matchAll(/<div class="bw-session__staff"[^>]*>\s*([^\n<]+)/g)].map(m => m[1].trim())

  for (let i = 0; i < classNames.length; i++) {
    const className = classNames[i]
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

    if (className && startTimes[i]) {
      classes.push({
        title: className,
        time: parseTime(startTimes[i]),
        endTime: parseTime(endTimes[i] || ''),
        instructor: instructors[i]?.replace(/\s+/g, ' ').trim() || '',
        studioName: studio.name,
        studioAddress: studio.address,
        category: studio.category,
        date: date
      })
    }
  }

  return classes
}

function parseTime(timeStr: string): string {
  if (!timeStr) return '09:00'

  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/)
  if (match) {
    let hours = parseInt(match[1])
    const minutes = match[2]
    const period = match[3]?.toUpperCase()

    if (period === 'PM' && hours < 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0

    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }

  return '09:00'
}

Deno.serve(async (req) => {
  // Allow manual trigger via POST or scheduled via cron
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const results = {
    studiosProcessed: 0,
    classesFound: 0,
    classesAdded: 0,
    errors: [] as string[]
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  for (const studio of FITNESS_STUDIOS) {
    console.log(`Processing ${studio.name}...`)
    results.studiosProcessed++

    try {
      // Delete old auto-scraped classes for this studio
      await supabase
        .from('events')
        .delete()
        .eq('venue_name', studio.name)
        .eq('event_type', 'class')
        .gte('start_date', todayStr)
        .contains('tags', ['auto-scraped'])

      // Scrape each day
      for (let dayOffset = 0; dayOffset < DAYS_TO_SCRAPE; dayOffset++) {
        const targetDate = new Date(today)
        targetDate.setDate(today.getDate() + dayOffset)
        const dateStr = targetDate.toISOString().split('T')[0]

        const data = await fetchMindbodySchedule(studio.widgetId, dateStr)
        if (!data?.class_sessions) continue

        const classes = parseClasses(data.class_sessions, dateStr, studio)
        results.classesFound += classes.length

        // Insert classes
        for (const cls of classes) {
          const { error } = await supabase
            .from('events')
            .insert({
              title: cls.title,
              description: cls.instructor ? `Instructor: ${cls.instructor}` : `${cls.category} class at ${cls.studioName}`,
              venue_name: cls.studioName,
              venue_address: cls.studioAddress,
              category: cls.category,
              event_type: 'class',
              start_date: cls.date,
              start_time: cls.time,
              end_time: cls.endTime || null,
              price: 0,
              is_free: false,
              price_description: 'See studio for pricing',
              status: 'active',
              verified_at: new Date().toISOString(),
              tags: ['auto-scraped', 'mindbody-api', cls.studioName.toLowerCase().replace(/\s+/g, '-')]
            })

          if (!error) results.classesAdded++
        }

        // Small delay between days
        await new Promise(r => setTimeout(r, 200))
      }
    } catch (error) {
      results.errors.push(`${studio.name}: ${error.message}`)
    }
  }

  console.log('Scrape complete:', results)

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  })
})
