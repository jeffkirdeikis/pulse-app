import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface Business {
  id: string
  name: string
  address: string
  google_place_id: string | null
}

// Search for a place and get its place_id
async function findPlaceId(name: string, address: string): Promise<string | null> {
  const query = encodeURIComponent(`${name} ${address} Squamish BC`)
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].place_id
    }
  } catch (error) {
    console.error(`Error finding place_id for ${name}:`, error)
  }
  return null
}

// Get place details (rating, reviews count)
async function getPlaceDetails(placeId: string): Promise<{ rating: number, reviews: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total&key=${GOOGLE_API_KEY}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.result) {
      return {
        rating: data.result.rating || 0,
        reviews: data.result.user_ratings_total || 0
      }
    }
  } catch (error) {
    console.error(`Error getting details for ${placeId}:`, error)
  }
  return null
}

serve(async (req) => {
  try {
    // Get businesses that need updating (no google_place_id or haven't been updated recently)
    const { data: businesses, error } = await supabase
      .from('businesses')
      .select('id, name, address, google_place_id')
      .order('updated_at', { ascending: true })
      .limit(50) // Process 50 at a time to stay within limits

    if (error) throw error

    let updated = 0
    let errors = 0

    for (const business of businesses as Business[]) {
      try {
        // Get or find place_id
        let placeId = business.google_place_id

        if (!placeId) {
          placeId = await findPlaceId(business.name, business.address)
          if (!placeId) {
            console.log(`No place_id found for: ${business.name}`)
            continue
          }
        }

        // Get updated details
        const details = await getPlaceDetails(placeId)

        if (details) {
          // Update the business record
          const { error: updateError } = await supabase
            .from('businesses')
            .update({
              google_place_id: placeId,
              google_rating: details.rating,
              google_reviews: details.reviews,
              updated_at: new Date().toISOString()
            })
            .eq('id', business.id)

          if (updateError) {
            console.error(`Error updating ${business.name}:`, updateError)
            errors++
          } else {
            console.log(`Updated: ${business.name} - Rating: ${details.rating}, Reviews: ${details.reviews}`)
            updated++
          }
        }

        // Rate limiting - 10 requests per second max for Google API
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (err) {
        console.error(`Error processing ${business.name}:`, err)
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: businesses?.length || 0,
        updated,
        errors,
        message: `Updated ${updated} businesses with latest Google data`
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
