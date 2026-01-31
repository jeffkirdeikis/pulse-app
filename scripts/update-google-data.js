#!/usr/bin/env node

/**
 * Update Google Reviews/Ratings for all businesses
 * Run: node scripts/update-google-data.js
 */

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'REDACTED_GOOGLE_API_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ygpfklhjwwqwrfpsfhue.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'REDACTED_SERVICE_KEY';

async function findPlaceId(name, address) {
  const query = encodeURIComponent(`${name} ${address} Squamish BC`);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].place_id;
    }
  } catch (error) {
    console.error(`Error finding place_id for ${name}:`, error.message);
  }
  return null;
}

async function getPlaceDetails(placeId) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.result) {
      return {
        rating: data.result.rating || 0,
        reviews: data.result.user_ratings_total || 0
      };
    }
  } catch (error) {
    console.error(`Error getting details:`, error.message);
  }
  return null;
}

async function getBusinesses() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/businesses?select=id,name,address,google_place_id&order=updated_at.asc&limit=100`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  return await response.json();
}

async function updateBusiness(id, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/businesses?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      ...data,
      updated_at: new Date().toISOString()
    })
  });
  return response.ok;
}

async function main() {
  console.log('🔄 Fetching businesses from database...\n');

  const businesses = await getBusinesses();
  console.log(`Found ${businesses.length} businesses to update\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < businesses.length; i++) {
    const business = businesses[i];
    process.stdout.write(`[${i + 1}/${businesses.length}] ${business.name.substring(0, 40).padEnd(40)} `);

    try {
      // Get or find place_id
      let placeId = business.google_place_id;

      if (!placeId) {
        placeId = await findPlaceId(business.name, business.address);
        if (!placeId) {
          console.log('⚪ No Google listing found');
          skipped++;
          continue;
        }
      }

      // Get updated details
      const details = await getPlaceDetails(placeId);

      if (details) {
        const success = await updateBusiness(business.id, {
          google_place_id: placeId,
          google_rating: details.rating,
          google_reviews: details.reviews
        });

        if (success) {
          console.log(`✅ ${details.rating}⭐ (${details.reviews} reviews)`);
          updated++;
        } else {
          console.log('❌ Update failed');
          errors++;
        }
      } else {
        console.log('⚪ No details found');
        skipped++;
      }

      // Rate limiting - avoid hitting Google API limits
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⚪ Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
