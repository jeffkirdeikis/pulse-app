// Booking URL lookup - maps venue names to their class schedule / program pages
// URLs sourced from each venue's own website navigation links
// Mindbody studioIDs verified against venue websites

const BOOKING_SYSTEMS = {
  // Mindbody venues — direct schedule URLs with verified studioIDs
  'Shala Yoga': {
    type: 'website',
    bookingUrl: 'https://shalayoga.ca/booking'  // embeds Mindbody widget (studioid 353274)
  },
  'Wild Life Gym': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=527949&fl=true&tabID=7'
  },
  'Squamish Barbell': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=7879&fl=true&tabID=7'
  },
  'Seed Studio': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/ws?studioid=5729485&stype=-7&sView=day&sLoc=0'
  },
  'Oxygen Yoga & Fitness': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/ws?studioid=5736498&stype=-8&sTG=24&sView=day&sLoc=1'
  },
  'Oxygen Yoga & Fitness Squamish': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/ws?studioid=5736498&stype=-8&sTG=24&sView=day&sLoc=1'
  },
  // Venue website schedule pages (no Mindbody)
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
  'Ground Up Climbing Centre': {
    type: 'website',
    bookingUrl: 'https://climbgroundup.com/programs/'
  },
  'Mountain Fitness Center': {
    type: 'mindbody',
    bookingUrl: 'https://clients.mindbodyonline.com/classic/mainclass?studioid=265219&fl=true&tabID=7'
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
