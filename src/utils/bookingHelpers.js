// Booking systems lookup - maps venue names to their booking URLs
// Sources: Mindbody, WellnessLiving, JaneApp scrapers

export const BOOKING_SYSTEMS = {
  // Mindbody Widget API
  'Shala Yoga': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/ws?studioid=189264',
    widgetId: '189264'
  },
  'Wild Life Gym': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/ws?studioid=69441',
    widgetId: '69441'
  },
  // Mindbody Classic Interface
  'Squamish Barbell': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=7879&tg=7',
    studioId: '7879'
  },
  'Seed Studio': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=5729485&tg=7',
    studioId: '5729485'
  },
  // Mindbody BrandedWeb
  'Oxygen Yoga & Fitness': {
    type: 'mindbody',
    bookingUrl: 'https://oxygenyogaandfitness.com/squamish/schedule/',
    widgetId: '5922581a2'
  },
  'Oxygen Yoga & Fitness Squamish': {
    type: 'mindbody',
    bookingUrl: 'https://oxygenyogaandfitness.com/squamish/schedule/',
    widgetId: '5922581a2'
  },
  // WellnessLiving
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
  // Ground Up Climbing - direct website
  'Ground Up Climbing Centre': {
    type: 'website',
    bookingUrl: 'https://groundupclimbing.ca/schedule'
  },
  // Mountain Fitness Center
  'Mountain Fitness Center': {
    type: 'website',
    bookingUrl: 'https://mountainfitnesscenter.ca/'
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
