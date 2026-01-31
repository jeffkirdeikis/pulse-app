import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Squamish event sources to scrape
const EVENT_SOURCES = [
  {
    name: 'Tourism Squamish Events',
    url: 'https://www.tourismsquamish.com/events/',
    type: 'tourism'
  },
  {
    name: 'Squamish Chief Events',
    url: 'https://www.squamishchief.com/local-news/events',
    type: 'news'
  },
  {
    name: 'District of Squamish',
    url: 'https://squamish.ca/events/',
    type: 'municipal'
  }
]

// Scrape a URL using Firecrawl
async function scrapeUrl(url: string): Promise<any> {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'extract'],
      extract: {
        schema: {
          type: 'object',
          properties: {
            events: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  date: { type: 'string' },
                  time: { type: 'string' },
                  location: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' }
                }
              }
            }
          }
        },
        prompt: 'Extract all upcoming events from this page. Include title, date, time, location/venue, description, and link to event details if available.'
      }
    })
  })

  return await response.json()
}

// Parse date string to Date object
function parseEventDate(dateStr: string): Date | null {
  try {
    // Try various date formats
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) return date

    // Add more parsing logic as needed for specific formats
    return null
  } catch {
    return null
  }
}

serve(async (req) => {
  try {
    let totalEvents = 0
    let newEvents = 0
    let errors = 0

    for (const source of EVENT_SOURCES) {
      try {
        console.log(`Scraping: ${source.name}`)
        const result = await scrapeUrl(source.url)

        if (result.success && result.data?.extract?.events) {
          const events = result.data.extract.events

          for (const event of events) {
            totalEvents++

            // Skip if no title
            if (!event.title) continue

            // Parse date
            const eventDate = parseEventDate(event.date)
            if (!eventDate || eventDate < new Date()) continue // Skip past events

            // Check if event already exists (by title and date)
            const { data: existing } = await supabase
              .from('events')
              .select('id')
              .eq('title', event.title)
              .eq('start_date', eventDate.toISOString().split('T')[0])
              .single()

            if (existing) {
              console.log(`Event exists: ${event.title}`)
              continue
            }

            // Insert new event
            const { error: insertError } = await supabase
              .from('events')
              .insert({
                title: event.title,
                description: event.description || '',
                venue_name: event.location || 'Squamish',
                venue_address: event.location || 'Squamish, BC',
                category: 'Community',
                event_type: 'event',
                start_date: eventDate.toISOString().split('T')[0],
                start_time: event.time || '09:00',
                status: 'active',
                tags: [source.type, 'auto-scraped']
              })

            if (insertError) {
              console.error(`Error inserting event ${event.title}:`, insertError)
              errors++
            } else {
              console.log(`Added new event: ${event.title}`)
              newEvents++
            }
          }
        }

        // Rate limiting between sources
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (err) {
        console.error(`Error scraping ${source.name}:`, err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sources_scraped: EVENT_SOURCES.length,
        total_events_found: totalEvents,
        new_events_added: newEvents,
        errors,
        message: `Scraped ${EVENT_SOURCES.length} sources, added ${newEvents} new events`
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
