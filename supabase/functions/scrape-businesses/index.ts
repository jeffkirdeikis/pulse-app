import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Squamish business directories to scrape
const BUSINESS_SOURCES = [
  {
    name: 'Squamish Chamber of Commerce',
    url: 'https://www.squamishchamber.com/business-directory/',
    type: 'chamber'
  },
  {
    name: 'Tourism Squamish Directory',
    url: 'https://www.tourismsquamish.com/directory/',
    type: 'tourism'
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
            businesses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  address: { type: 'string' },
                  phone: { type: 'string' },
                  website: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        },
        prompt: 'Extract all business listings from this page. Include business name, address, phone number, website, category/type of business, and description if available. Focus on Squamish, BC businesses.'
      }
    })
  })

  return await response.json()
}

// Generate a slug from business name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Map scraped category to our categories
function mapCategory(category: string): string {
  const categoryLower = category?.toLowerCase() || ''

  if (categoryLower.includes('restaurant') || categoryLower.includes('food') || categoryLower.includes('dining')) {
    return 'Restaurants & Dining'
  }
  if (categoryLower.includes('cafe') || categoryLower.includes('coffee') || categoryLower.includes('bakery')) {
    return 'Cafes & Bakeries'
  }
  if (categoryLower.includes('retail') || categoryLower.includes('shop') || categoryLower.includes('store')) {
    return 'Retail & Shopping'
  }
  if (categoryLower.includes('outdoor') || categoryLower.includes('adventure') || categoryLower.includes('tour')) {
    return 'Outdoor Adventures'
  }
  if (categoryLower.includes('fitness') || categoryLower.includes('gym')) {
    return 'Fitness & Gyms'
  }
  if (categoryLower.includes('health') || categoryLower.includes('wellness')) {
    return 'Health & Wellness'
  }
  if (categoryLower.includes('hotel') || categoryLower.includes('lodging') || categoryLower.includes('accommodation')) {
    return 'Hotels & Lodging'
  }
  if (categoryLower.includes('auto') || categoryLower.includes('car') || categoryLower.includes('mechanic')) {
    return 'Auto Services'
  }
  if (categoryLower.includes('construction') || categoryLower.includes('contractor')) {
    return 'Construction & Building'
  }
  if (categoryLower.includes('real estate') || categoryLower.includes('realtor')) {
    return 'Real Estate'
  }

  return category || 'Other'
}

serve(async (req) => {
  try {
    let totalBusinesses = 0
    let newBusinesses = 0
    let errors = 0

    for (const source of BUSINESS_SOURCES) {
      try {
        console.log(`Scraping: ${source.name}`)
        const result = await scrapeUrl(source.url)

        if (result.success && result.data?.extract?.businesses) {
          const businesses = result.data.extract.businesses

          for (const business of businesses) {
            totalBusinesses++

            // Skip if no name
            if (!business.name) continue

            // Check if business already exists (by name)
            const { data: existing } = await supabase
              .from('businesses')
              .select('id')
              .ilike('name', business.name)
              .single()

            if (existing) {
              console.log(`Business exists: ${business.name}`)
              continue
            }

            // Generate unique slug
            const baseSlug = generateSlug(business.name)
            const slug = `${baseSlug}-${Date.now().toString(36)}`

            // Insert new business
            const { error: insertError } = await supabase
              .from('businesses')
              .insert({
                name: business.name,
                slug,
                address: business.address || 'Squamish, BC',
                city: 'Squamish',
                province: 'BC',
                phone: business.phone || null,
                website: business.website || null,
                category: mapCategory(business.category),
                description: business.description || null,
                source: `scrape_${source.type}`,
                status: 'active'
              })

            if (insertError) {
              console.error(`Error inserting business ${business.name}:`, insertError)
              errors++
            } else {
              console.log(`Added new business: ${business.name}`)
              newBusinesses++
            }
          }
        }

        // Rate limiting between sources
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (err) {
        console.error(`Error scraping ${source.name}:`, err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sources_scraped: BUSINESS_SOURCES.length,
        total_businesses_found: totalBusinesses,
        new_businesses_added: newBusinesses,
        errors,
        message: `Scraped ${BUSINESS_SOURCES.length} sources, added ${newBusinesses} new businesses`
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
