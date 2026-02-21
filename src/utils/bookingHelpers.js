// Booking systems lookup - maps venue names to their booking URLs
// Sources: Mindbody, WellnessLiving, JaneApp scrapers

const BOOKING_SYSTEMS = {
  // Venue websites with embedded booking widgets (best UX — no Cloudflare issues)
  'Shala Yoga': {
    type: 'website',
    bookingUrl: 'https://shalayoga.ca/booking'
  },
  'Wild Life Gym': {
    type: 'website',
    bookingUrl: 'https://wildlifegym.com/group-class-schedule/'
  },
  'Squamish Barbell': {
    type: 'janeapp',
    bookingUrl: 'https://squamishbarbell.janeapp.com/'
  },
  'Seed Studio': {
    type: 'website',
    bookingUrl: 'https://www.seedsquamish.com/class-schedule'
  },
  'Oxygen Yoga & Fitness': {
    type: 'website',
    bookingUrl: 'https://oxygenyogaandfitness.com/squamish/'
  },
  'Oxygen Yoga & Fitness Squamish': {
    type: 'website',
    bookingUrl: 'https://oxygenyogaandfitness.com/squamish/'
  },
  // WellnessLiving (these work reliably)
  'Breathe Fitness Studio': {
    type: 'wellnessliving',
    bookingUrl: 'https://www.wellnessliving.com/schedule/breathe_fitness_squamish',
    businessId: '338540'
  },
  'Breathe Fitness': {
    type: 'wellnessliving',
    bookingUrl: 'https://www.wellnessliving.com/schedule/breathe_fitness_squamish',
    businessId: '338540'
  },
  'The Sound Martial Arts': {
    type: 'wellnessliving',
    bookingUrl: 'https://www.wellnessliving.com/schedule/thesoundmartialarts',
    businessId: '414578'
  },
  // Direct websites
  'Ground Up Climbing Centre': {
    type: 'website',
    bookingUrl: 'https://climbgroundup.com/'
  },
  'Mountain Fitness Center': {
    type: 'website',
    bookingUrl: 'https://mountainfitnesscenter.ca/classes'
  }
};

// Helper to get booking URL for a venue
export const getBookingUrl = (venueName) => {
  if (!venueName) return null;

  // Direct lookup
  if (BOOKING_SYSTEMS[venueName]) {
    return BOOKING_SYSTEMS[venueName].bookingUrl;
  }

  // Fuzzy match - check if venue name contains known business
  const normalizedName = venueName.toLowerCase();
  for (const [key, value] of Object.entries(BOOKING_SYSTEMS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return value.bookingUrl;
    }
  }

  return null;
};

// Helper to get booking system type
export const getBookingType = (venueName) => {
  if (!venueName) return null;

  if (BOOKING_SYSTEMS[venueName]) {
    return BOOKING_SYSTEMS[venueName].type;
  }

  const normalizedName = venueName.toLowerCase();
  for (const [key, value] of Object.entries(BOOKING_SYSTEMS)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return value.type;
    }
  }

  return null;
};
