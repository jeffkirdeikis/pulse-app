// Booking URL lookup - maps venue names to their class schedule / program pages
// All URLs verified to show actual class/program content (not login forms or clinics)

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
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=7879&fl=true&tabID=7'
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
    type: 'website',
    bookingUrl: 'https://breathesquamish.com/pages/squamish-schedule'
  },
  'Breathe Fitness': {
    type: 'website',
    bookingUrl: 'https://breathesquamish.com/pages/squamish-schedule'
  },
  'The Sound Martial Arts': {
    type: 'website',
    bookingUrl: 'https://www.thesoundmartialarts.com/sound-martial-arts-schedule'
  },
  // Direct websites
  'Ground Up Climbing Centre': {
    type: 'website',
    bookingUrl: 'https://climbgroundup.com/programs/'
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
