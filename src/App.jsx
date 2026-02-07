import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, CalendarPlus, MapPin, Clock, Star, Check, Bell, Search, Filter, ChevronRight, ChevronLeft, X, Plus, Edit2, Trash2, Eye, Users, DollarSign, AlertCircle, CheckCircle, XCircle, SlidersHorizontal, Building, Wrench, TrendingUp, Phone, Globe, Navigation, Mail, Share2, Ticket, Percent, Tag, Repeat, ExternalLink, Heart, Copy, Info, Gift, Sparkles, Zap, Camera, MessageCircle, Send } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useUserData } from './hooks/useUserData';
import { formatResponseTime } from './lib/businessAnalytics';
import WellnessBooking from './components/WellnessBooking';

// All dates/times in this app are in Squamish (Pacific) time, regardless of user's location.
const PACIFIC_TZ = 'America/Vancouver';

/** Get current Date adjusted to Pacific timezone */
function getPacificNow() {
  // Get current time string in Pacific, then parse it back to a Date
  const pacificStr = new Date().toLocaleString('en-US', { timeZone: PACIFIC_TZ });
  return new Date(pacificStr);
}

/** Get today's date string (YYYY-MM-DD) in Pacific timezone */
function getPacificDateStr() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

/** Create a Date object for a Pacific date + time (from DB fields) */
function pacificDate(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '09:00').split(':').map(Number);
  // Build an ISO string with Pacific offset, then let JS parse it
  // Use toLocaleString roundtrip to get correct Pacific-local Date
  const fakeLocal = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const localStr = fakeLocal.toLocaleString('en-US', { timeZone: PACIFIC_TZ });
  // The offset between fakeLocal (user's TZ) and Pacific TZ
  const pacificEquiv = new Date(localStr);
  const offset = fakeLocal.getTime() - pacificEquiv.getTime();
  return new Date(fakeLocal.getTime() + offset);
}

/** Format options for displaying dates/times always in Pacific timezone */
const PACIFIC_DATE_OPTS = { timeZone: PACIFIC_TZ };

// Booking systems lookup - maps venue names to their booking URLs
// Sources: Mindbody, WellnessLiving, JaneApp scrapers
const BOOKING_SYSTEMS = {
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
const getBookingUrl = (venueName) => {
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
const getBookingType = (venueName) => {
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

// Real Squamish data from Tourism Squamish and local businesses
const REAL_DATA = {
  venues: [
    { id: 'v1', name: 'Ground Up Climbing Centre', address: '1201 Commercial Pl', category: 'Fitness' },
    { id: 'v2', name: 'The BAG (Brennan Arts Gallery)', address: '38134 Cleveland Ave', category: 'Arts & Culture' },
    { id: 'v3', name: "Trickster's Hideout", address: '38036 Cleveland Ave', category: 'Nightlife' },
    { id: 'v4', name: 'Arrow Wood Games', address: '37991 2nd Ave', category: 'Community' },
    { id: 'v5', name: 'Squamish Canyon', address: 'Darrell Bay', category: 'Outdoors' },
    { id: 'v6', name: 'Cheakamus Centre', address: 'Paradise Valley', category: 'Nature' },
    { id: 'v7', name: 'Whistler Olympic Park', address: 'Callaghan Valley', category: 'Outdoors' },
    { id: 'v8', name: 'The Backyard', address: '1201 Hunter Pl', category: 'Community' },
    { id: 'v9', name: 'Squamish Public Library', address: '37907 2nd Ave', category: 'Community' },
    { id: 'v10', name: 'Breathe Fitness Studio', address: 'Downtown Squamish', category: 'Fitness' },
    { id: 'v11', name: 'Wild Life Gym', address: 'Squamish Way', category: 'Fitness' },
    { id: 'v12', name: 'Mountain Fitness Center', address: 'Industrial Way', category: 'Fitness' },
    { id: 'v13', name: 'A-Frame Brewing', address: 'Commercial Way', category: 'Food & Drink' },
    { id: 'v14', name: 'Howe Sound Biosphere', address: 'Squamish Valley', category: 'Nature' },
    { id: 'v15', name: 'Oxygen Yoga & Fitness', address: 'Downtown Squamish', category: 'Fitness' },
    { id: 'v16', name: 'Seed Studio', address: 'Cleveland Ave', category: 'Wellness' },
    { id: 'v17', name: 'Brennan Park Aquatic Centre', address: '1009 Centennial Way', category: 'Recreation' },
    { id: 'v18', name: 'Squamish Dance Centre', address: 'Squamish, BC', category: 'Arts' },
    { id: 'v19', name: 'Howe Sound Dance Academy', address: 'Squamish, BC', category: 'Arts' },
    { id: 'v20', name: 'Act Alive Academy', address: 'Squamish, BC', category: 'Performing Arts' },
    { id: 'v21', name: 'Squamish Taekwondo Academy', address: 'Squamish, BC', category: 'Martial Arts' },
    { id: 'v22', name: 'The Sound Martial Arts', address: '115-1111 Pioneer Way', category: 'Martial Arts' },
    { id: 'v23', name: 'Aikidaily International Academy', address: 'Squamish, BC', category: 'Martial Arts' },
    { id: 'v24', name: 'Fili Space Fitness', address: 'Squamish, BC', category: 'Fitness' },
    { id: 'v25', name: 'Sea to Sky Gondola', address: 'Highway 99', category: 'Attraction' },
    { id: 'v26', name: 'Watershed Grill', address: '456 Main St', category: 'Food & Drink' },
    { id: 'v27', name: 'House of Lager', address: 'Squamish, BC', category: 'Food & Drink' },
    { id: 'v28', name: 'The Broken Seal', address: 'Squamish, BC', category: 'Food & Drink' },
    { id: 'v29', name: 'F45 Training Squamish', address: '12-1257 Commercial Way', category: 'Fitness' },
    { id: 'v30', name: 'Anytime Fitness', address: 'Squamish, BC', category: 'Fitness' },
    { id: 'v31', name: 'Clubflex 24 Hour Fitness', address: 'Squamish, BC', category: 'Fitness' },
    { id: 'v32', name: 'Squamish Athletic Club', address: 'Downtown Squamish', category: 'Fitness' },
    { id: 'v33', name: 'Dance Directions', address: 'Squamish, BC', category: 'Arts' },
    { id: 'v34', name: 'The Performing Arts Centre', address: 'Squamish, BC', category: 'Arts' },
    { id: 'v35', name: 'Roundhouse Squamish', address: 'Cleveland Ave', category: 'Martial Arts' },
    { id: 'v36', name: 'Mountain Jiujitsu Squamish', address: '110, 39455 Discovery Way', category: 'Martial Arts' },
    { id: 'v37', name: 'Flow Training Centre', address: 'Squamish, BC', category: 'Martial Arts' },
    { id: 'v38', name: 'Squamish Arts', address: 'Squamish, BC', category: 'Arts & Culture' }
,
    { id: 'v200', name: 'The Watershed Grill' },
    { id: 'v201', name: 'Fergie\'s Café' },
    { id: 'v202', name: 'The Salted Vine Kitchen + Bar' },
    { id: 'v203', name: 'Saha Eatery' },
    { id: 'v204', name: 'The Locavore Bar & Grill' },
    { id: 'v205', name: 'Chef Big D\'s Restaurant & Grill' },
    { id: 'v206', name: 'Zephyr Café at The BAG' },
    { id: 'v207', name: 'The Crabapple Café' },
    { id: 'v208', name: 'Mags99 Fried Chicken & Mexican Cantina' },
    { id: 'v209', name: 'Timberwolf Restaurant & Lounge' },
    { id: 'v210', name: 'Lil Chef Bistro' },
    { id: 'v211', name: 'Sushi Sen Japanese Restaurant' },
    { id: 'v212', name: 'Taka Ramen & Sushi' },
    { id: 'v213', name: 'The Copper Coil Still & Grill' },
    { id: 'v214', name: 'Haru Fusion Cuisine' },
    { id: 'v215', name: 'The Broken Seal' },
    { id: 'v216', name: 'Freebird' },
    { id: 'v217', name: 'The Buvette' },
    { id: 'v218', name: 'Taste of Saigon' },
    { id: 'v219', name: 'Steve\'s Poké Bar' },
    { id: 'v220', name: 'Manpuku Sushi' },
    { id: 'v221', name: 'Match Eatery & Public House' },
    { id: 'v222', name: 'Sea to Sky Gondola - Taste of the Summit' },
    { id: 'v223', name: 'Britannia Autostrada Oyster Bar' },
    { id: 'v224', name: 'Norman Ruiz' },
    { id: 'v225', name: 'Fox & Oak' },
    { id: 'v226', name: 'Sunflower Bakery & Cafe' },
    { id: 'v227', name: 'Tall Tree Bakery' },
    { id: 'v228', name: 'Cloudburst Cafe' },
    { id: 'v229', name: 'Caffe Garibaldi' },
    { id: 'v230', name: '1914 Coffee' },
    { id: 'v231', name: 'Peak & Pour' },
    { id: 'v232', name: 'Wonderlands Plants & Coffee' },
    { id: 'v233', name: 'Noshy Cafe' },
    { id: 'v234', name: 'Tuba Cafe' },
    { id: 'v235', name: 'The Waiting Room Cafe' },
    { id: 'v236', name: 'Chatterbox Cafe' },
    { id: 'v237', name: 'RideHub Cafe' },
    { id: 'v238', name: 'Outbound Station' },
    { id: 'v239', name: 'Co-Pilot Cafe (Sea to Sky Gondola)' },
    { id: 'v240', name: 'FILI Space' },
    { id: 'v241', name: 'Purebread' },
    { id: 'v242', name: 'Xoco Chocolate Co' },
    { id: 'v243', name: 'The Funky Monkey Boutique' },
    { id: 'v244', name: 'Nootka and Sea' },
    { id: 'v245', name: 'Random &' },
    { id: 'v246', name: 'Walmart' },
    { id: 'v247', name: 'Empire Of Dirt' },
    { id: 'v248', name: 'Pearl\'s Value & Vintage' },
    { id: 'v249', name: 'Gather Books & Lovely Things' },
    { id: 'v250', name: 'Mountain Threads' },
    { id: 'v251', name: 'Urban Alpine' },
    { id: 'v252', name: 'XMarket Squamish' },
    { id: 'v253', name: 'Grateful Gift Shop' },
    { id: 'v254', name: 'Stong\'s Market' },
    { id: 'v255', name: 'Peak Provisions Mountain Grocery & Goods' },
    { id: 'v256', name: 'BC Liquor Store' },
    { id: 'v257', name: 'Save-On-Foods' },
    { id: 'v258', name: 'Nesters Market' },
    { id: 'v259', name: 'IGA' },
    { id: 'v260', name: 'Canadian Tire' },
    { id: 'v261', name: 'Home Hardware' },
    { id: 'v262', name: 'Shoppers Drug Mart' },
    { id: 'v263', name: 'London Drugs' },
    { id: 'v264', name: 'Winners' },
    { id: 'v265', name: 'Anna\'s Interiors' },
    { id: 'v266', name: 'Billies Flower House' },
    { id: 'v267', name: 'Fall Line Fitness (Physio, Chiro, Massage)' },
    { id: 'v268', name: 'Mountain Fitness Center' },
    { id: 'v269', name: 'Wild Life Gym' },
    { id: 'v270', name: 'Breathe Fitness Studio' },
    { id: 'v271', name: 'Oxygen Yoga & Fitness' },
    { id: 'v272', name: 'TargetZone Fitness' },
    { id: 'v273', name: 'Core Intentions' },
    { id: 'v274', name: 'The Yoga Studio' },
    { id: 'v275', name: 'Anytime Fitness' },
    { id: 'v276', name: 'CrossFit Squamish' },
    { id: 'v277', name: 'Howe Sound Secondary Pool' },
    { id: 'v278', name: 'Brennan Park Recreation Centre' },
    { id: 'v279', name: 'Executive Suites Hotel & Resort' },
    { id: 'v280', name: 'Sandman Hotel & Suites' },
    { id: 'v281', name: 'Howe Sound Inn' },
    { id: 'v282', name: 'Hotel Squamish' },
    { id: 'v283', name: 'Squamish Adventure Inn (Hostel)' },
    { id: 'v284', name: 'Sea to Sky Hotel' },
    { id: 'v285', name: 'Crash Hotel Squamish' },
    { id: 'v286', name: 'Mountain Retreat Hotel' },
    { id: 'v287', name: 'Squamish Budget Inn' },
    { id: 'v288', name: 'Sunwolf Riverside Resort' },
    { id: 'v289', name: 'Sweeney Bride Squamish' },
    { id: 'v290', name: 'Hair salons - various' },
    { id: 'v291', name: 'Spa services - various' },
    { id: 'v292', name: 'Squamish Public Library' },
    { id: 'v293', name: 'Sea to Sky Gondola' },
    { id: 'v294', name: 'Britannia Mine Museum' },
    { id: 'v295', name: 'Railway Museum of British Columbia' },
    { id: 'v296', name: 'Shannon Falls Provincial Park' },
    { id: 'v297', name: 'Stawamus Chief Provincial Park' },
    { id: 'v298', name: 'Alice Lake Provincial Park' },
    { id: 'v299', name: 'Porteau Cove Provincial Park' },
    { id: 'v300', name: 'Brackendale Eagle Reserve' },
    { id: 'v301', name: 'Squamish Estuary' },
    { id: 'v302', name: 'Black Box Cuisine' },
    { id: 'v303', name: 'Various food trucks' },
    { id: 'v304', name: 'Ice cream shops' },
    { id: 'v305', name: 'Pet stores' },
    { id: 'v306', name: 'Squamish Native Art Store' },
    { id: 'v307', name: 'Brackendale Art Gallery' },
    { id: 'v308', name: 'Karen Cooper Gallery' },
    { id: 'v309', name: 'Cam Sherk Notary Public' },
    { id: 'v310', name: 'Ironwood Notary Public' },
    { id: 'v311', name: 'Park & Associates Notaries Public' },
    { id: 'v312', name: 'The UPS Store Squamish' },
    { id: 'v313', name: 'Shop N Drop' },
    { id: 'v314', name: 'Shala Yoga' },
    { id: 'v315', name: 'Core Intentions Pilates | Yoga | Aerial' },
    { id: 'v316', name: 'Breathe Fitness Studio' },
    { id: 'v317', name: 'Seed Studio' },
    { id: 'v318', name: 'Oxygen Yoga & Fitness Squamish' },
    { id: 'v319', name: 'Chief Yoga and Wellness' },
    { id: 'v320', name: 'Wild Life Gym' },
    { id: 'v321', name: 'Body Storm Fitness' },
    { id: 'v322', name: 'Break The Chain Fitness' },
    { id: 'v323', name: 'Club Flex Squamish' },
    { id: 'v324', name: 'The Wellness Room' },
    { id: 'v325', name: 'Anchor Health and Wellness' },
    { id: 'v326', name: 'Squamish Barbell Clinic' },
    { id: 'v327', name: 'Deep Flow Healing' },
    { id: 'v328', name: 'Inner Moves Wellness Center' },
    { id: 'v329', name: 'Shred Shed Repairs' },
    { id: 'v330', name: 'Oceanside Collision' },
    { id: 'v331', name: 'Noble House' },
    { id: 'v332', name: 'Sea to Sky Nails and Lashes' },
    { id: 'v333', name: 'Mountain View Nails & Spa' },
    { id: 'v334', name: 'Awesome Hair Salon' },
    { id: 'v335', name: 'T & A Nail Salon' },
    { id: 'v336', name: 'Cloud 9 Beautique Salon & Medical Spa' },
    { id: 'v337', name: 'Sparrow MD' },
    { id: 'v338', name: 'Climb On Equipment' },
    { id: 'v339', name: 'Nesters Market Squamish' },
    { id: 'v340', name: 'Save-On-Foods Squamish' },
    { id: 'v341', name: 'IGA Squamish' },
    { id: 'v342', name: 'Walmart Squamish' },
    { id: 'v343', name: 'Canadian Tire Squamish' },
    { id: 'v344', name: 'Home Hardware Squamish' },
    { id: 'v345', name: 'Shoppers Drug Mart Squamish' },
    { id: 'v346', name: 'London Drugs Squamish' },
    { id: 'v347', name: 'Fox & Oak' },
    { id: 'v348', name: 'The Squamish Store' },
    { id: 'v349', name: 'Green Olive Market & Cafe' },
    { id: 'v350', name: 'Cleveland Meats' },
    { id: 'v351', name: 'Kitchen Quickies' },
    { id: 'v352', name: 'Lucas Teas' },
    { id: 'v353', name: 'Sea to Sky Books' },
    { id: 'v354', name: 'Darcie Schellenberg Notary' },
    { id: 'v355', name: 'Squamish Food Bank' },
    { id: 'v356', name: 'Brennan Park Recreation Centre' },
    { id: 'v357', name: 'Kululu Cafe' },
    { id: 'v358', name: 'Essence of India Restaurant' },
    { id: 'v359', name: 'Umai Sushi & Grill' },
    { id: 'v360', name: 'Fortune Kitchen' },
    { id: 'v361', name: 'Flipside Burgers' },
    { id: 'v362', name: 'Pizza Factory' },
    { id: 'v363', name: 'Fresh Slice Pizza' },
    { id: 'v364', name: 'Domino\'s Pizza Squamish' },
    { id: 'v365', name: 'Subway Squamish' },
    { id: 'v366', name: 'Tim Hortons Squamish' },
    { id: 'v367', name: 'Starbucks Squamish' },
    { id: 'v368', name: 'McDonald\'s Squamish' },
    { id: 'v369', name: 'A&W Squamish' },
    { id: 'v370', name: 'Wendy\'s Squamish' },
    { id: 'v371', name: 'Boston Pizza Squamish' },
    { id: 'v372', name: 'White Spot Squamish' },
    { id: 'v373', name: 'Dairy Queen Squamish' },
    { id: 'v374', name: 'Alice and Brohm Ice Cream' },
    { id: 'v375', name: 'Narwhals Ice Cream' },
    { id: 'v376', name: 'RideHub Bike Shop & Cafe' },
    { id: 'v377', name: 'Dialed In Cycling' },
    { id: 'v378', name: 'Arrow Wood Games' },
    { id: 'v379', name: 'Ground Up Climbing Centre' },
    { id: 'v380', name: 'Squamish Valley Tours' },
    { id: 'v381', name: 'Canadian Coastal Adventures' },
    { id: 'v382', name: 'The Squamish Chief' },
    { id: 'v383', name: 'Squamish Hostel' },
    { id: 'v384', name: 'Mountain Retreat Lodge' },
    { id: 'v385', name: 'Brackendale Art Gallery' },
    { id: 'v386', name: 'CrossFit Squamish' },
    { id: 'v387', name: 'Summit Fitness Squamish' },
    { id: 'v388', name: 'Pinnacle Fitness Squamish' },
    { id: 'v389', name: 'Mountain Strong Fitness' },
    { id: 'v390', name: 'Sea to Sky Fitness' },
    { id: 'v391', name: 'The Essence Wellness Centre' },
    { id: 'v392', name: 'Shift Wellness Squamish' },
    { id: 'v393', name: 'Canadian Outback Rafting' },
    { id: 'v394', name: 'Blazing Saddles Adventures' },
    { id: 'v395', name: 'Squamish Rock Guides' },
    { id: 'v396', name: 'Mountain Skills Academy' },
    { id: 'v397', name: 'Squamish Trails Society' },
    { id: 'v398', name: 'Stawamus Chief Guides' },
    { id: 'v399', name: 'Howe Sound Adventures' },
    { id: 'v400', name: 'A-Frame Brewing' },
    { id: 'v401', name: 'Backcountry Brewing' },
    { id: 'v402', name: 'Locavore Bar & Grill' },
    { id: 'v403', name: 'Cloudburst Cafe' },
    { id: 'v404', name: 'Crabapple Cafe' },
    { id: 'v405', name: 'Shady Tree Pub' },
    { id: 'v406', name: 'Free Bird Table & Oyster Bar' },
    { id: 'v407', name: 'Salted Vine Kitchen + Bar' },
    { id: 'v408', name: 'Taka Ramen + Sushi' },
    { id: 'v409', name: 'Cyrus Cafe' },
    { id: 'v410', name: 'Sunny Chibas' },
    { id: 'v411', name: 'Nourish Kitchen' },
    { id: 'v412', name: 'Zephyr Cafe' },
    { id: 'v413', name: 'Norman Rudy\'s' },
    { id: 'v414', name: 'Mile One Eating House' },
    { id: 'v415', name: 'The Summit Restaurant' },
    { id: 'v416', name: 'Seize the Souvlaki' },
    { id: 'v417', name: 'Kululu Japanese Food' },
    { id: 'v418', name: 'The Locavore Food Truck' },
    { id: 'v419', name: 'Luz Tacos' },
    { id: 'v420', name: 'Taco Del Mar' },
    { id: 'v421', name: 'Grateful Gift Shop' },
    { id: 'v422', name: 'Wild and Heart Boutique' },
    { id: 'v423', name: 'Random & Co Consignment' },
    { id: 'v424', name: 'Billies House' },
    { id: 'v425', name: 'One Earth' },
    { id: 'v426', name: 'Gather Bookshop' },
    { id: 'v427', name: 'Book Mountain' },
    { id: 'v428', name: 'Create Makerspace' },
    { id: 'v429', name: 'Oracle Emporium' },
    { id: 'v430', name: 'Little Fern Baby & Kids' },
    { id: 'v431', name: 'Wildflower & Twigs' },
    { id: 'v432', name: 'Capra Running' },
    { id: 'v433', name: 'Climb On Equipment' },
    { id: 'v434', name: 'Company Store Britannia' },
    { id: 'v435', name: 'Howe Sound Inn' },
    { id: 'v436', name: 'Sandman Hotel Squamish' },
    { id: 'v437', name: 'Executive Suites Hotel' },
    { id: 'v438', name: 'Crash Hotel Squamish' },
    { id: 'v439', name: 'Klahanie Campground' },
    { id: 'v440', name: 'Alice Lake Campground' },
    { id: 'v441', name: 'Squamish Valley Campground' },
    { id: 'v442', name: 'Paradise Valley Campground' },
    { id: 'v443', name: 'Dryden Creek Campground' },
    { id: 'v444', name: 'Squamish Public Library' },
    { id: 'v445', name: 'Brennan Park Leisure Centre' },
    { id: 'v446', name: 'Squamish Rock Climbing' },
    { id: 'v447', name: 'Squamish Pet Supply' },
    { id: 'v448', name: 'BC Transit Squamish' },
    { id: 'v449', name: 'Unique Slow Rise Bakery' },
    { id: 'v450', name: 'Mountain Woman Coffee' },
    { id: 'v451', name: 'Squamish Coffee Company' },
    { id: 'v452', name: 'Chief Roasters' },
    { id: 'v453', name: 'Chief Wellness Centre' },
    { id: 'v454', name: 'Britannia Autostrada Oyster Bar' },
    { id: 'v455', name: 'Match Eatery Squamish' },
    { id: 'v456', name: 'Elements Casino Squamish' },
    { id: 'v457', name: 'Mountain Grind Coffee' },
    { id: 'v458', name: 'Billies House Kids Store' },
    { id: 'v459', name: 'Tantalus Bike Shop' },
    { id: 'v460', name: 'Corsa Cycles' },
    { id: 'v461', name: 'Squamish Cycle' },
    { id: 'v462', name: 'Britannia Mine Museum' },
    { id: 'v463', name: 'Railway Museum of BC' },
    { id: 'v464', name: 'Sunflower Bakery Cafe' },
    { id: 'v465', name: 'Mocaccino Coffee' },
    { id: 'v466', name: 'Ground Coffee' },
    { id: 'v467', name: 'Rise & Grind Cafe' },
    { id: 'v468', name: 'Nesters Coffee Bar' },
    { id: 'v469', name: 'Mountain Spa Squamish' },
    { id: 'v470', name: 'Serenity Wellness Spa' },
    { id: 'v471', name: 'Infrared Sauna Squamish' },
    { id: 'v472', name: 'Chief Chocolates' },
  
    { id: 'v473', name: 'Tacofino' },
    { id: 'v474', name: 'The Broken Seal' },
    { id: 'v475', name: 'Copper Beach Bar' },
    { id: 'v476', name: 'Raincity Distillery' },
    { id: 'v477', name: 'A-FRAME Brewery' },
    { id: 'v478', name: 'Locavore Bar & Grill' },
    { id: 'v479', name: "Trickster's Hideout" }
  ],

  
  events: [
    { id: 'e1', title: 'Hot Yoga Flow', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 6, 0), end: new Date(2026, 0, 27, 7, 0), tags: ['Fitness', 'Yoga'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Hot Yoga Flow' },
    { id: 'e2', title: 'Hot Vinyasa', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 7, 15), end: new Date(2026, 0, 27, 8, 15), tags: ['Fitness', 'Yoga'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Hot Vinyasa' },
    { id: 'e3', title: 'Hot Barre', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 10, 0), tags: ['Fitness', 'Barre'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Hot Barre' },
    { id: 'e4', title: 'Lunchtime Flow', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 12, 15), end: new Date(2026, 0, 27, 13, 0), tags: ['Fitness', 'Yoga'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Lunchtime Flow' },
    { id: 'e5', title: 'Hot Power Yoga', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 17, 30), end: new Date(2026, 0, 27, 18, 30), tags: ['Fitness', 'Yoga'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Hot Power Yoga' },
    { id: 'e6', title: 'Hot Cardio Barre', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 18, 45), end: new Date(2026, 0, 27, 19, 45), tags: ['Fitness', 'Barre'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Hot Cardio Barre' },
    { id: 'e7', title: 'Yin Yoga', eventType: 'class', venueId: 'v10', start: new Date(2026, 0, 27, 19, 45), end: new Date(2026, 0, 27, 20, 45), tags: ['Wellness', 'Yoga'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Yin Yoga' },
    { id: 'e8', title: 'Hot Vinyasa & Power Core', eventType: 'class', venueId: 'v15', start: new Date(2026, 0, 27, 6, 0), end: new Date(2026, 0, 27, 7, 15), tags: ['Fitness', 'Yoga'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Hot Vinyasa & Power Core' },
    { id: 'e9', title: 'Hot Fusion', eventType: 'class', venueId: 'v15', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 10, 0), tags: ['Fitness', 'Fusion'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Hot Fusion' },
    { id: 'e10', title: 'Booty & Abs Blast', eventType: 'class', venueId: 'v15', start: new Date(2026, 0, 27, 10, 15), end: new Date(2026, 0, 27, 11, 15), tags: ['Fitness', 'Strength'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Booty & Abs Blast' },
    { id: 'e11', title: 'Hot Boxing', eventType: 'class', venueId: 'v15', start: new Date(2026, 0, 27, 17, 30), end: new Date(2026, 0, 27, 18, 30), tags: ['Fitness', 'Boxing'], ageGroup: 'Adults', price: '$24', recurrence: 'weekly', description: 'Hot Boxing' },
    { id: 'e12', title: 'Beginner Pilates', eventType: 'class', venueId: 'v16', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 10, 0), tags: ['Fitness', 'Pilates'], ageGroup: 'Adults', price: '$25', recurrence: 'weekly', description: 'Beginner Pilates' },
    { id: 'e13', title: 'Level 2 Reformer', eventType: 'class', venueId: 'v16', start: new Date(2026, 0, 27, 11, 30), end: new Date(2026, 0, 27, 12, 30), tags: ['Fitness', 'Pilates'], ageGroup: 'Adults', price: '$28', recurrence: 'weekly', description: 'Level 2 Reformer' },
    { id: 'e14', title: 'Level 2 Reformer Evening', eventType: 'class', venueId: 'v16', start: new Date(2026, 0, 27, 17, 30), end: new Date(2026, 0, 27, 18, 30), tags: ['Fitness', 'Pilates'], ageGroup: 'Adults', price: '$28', recurrence: 'weekly', description: 'Level 2 Reformer Evening' },
    { id: 'e15', title: 'Spin Class', eventType: 'class', venueId: 'v12', start: new Date(2026, 0, 27, 6, 0), end: new Date(2026, 0, 27, 6, 45), tags: ['Fitness', 'Cardio'], ageGroup: 'Adults', price: '$18', recurrence: 'weekly', description: 'Spin Class' },
    { id: 'e16', title: 'Core & Strength', eventType: 'class', venueId: 'v12', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 10, 0), tags: ['Fitness', 'Strength'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Core & Strength' },
    { id: 'e17', title: 'CrossFit Style WOD', eventType: 'class', venueId: 'v12', start: new Date(2026, 0, 27, 17, 30), end: new Date(2026, 0, 27, 18, 30), tags: ['Fitness', 'CrossFit'], ageGroup: 'Adults', price: '$25', recurrence: 'weekly', description: 'CrossFit Style WOD' },
    { id: 'e18', title: 'Strength Training', eventType: 'class', venueId: 'v11', start: new Date(2026, 0, 27, 6, 30), end: new Date(2026, 0, 27, 7, 30), tags: ['Fitness', 'Strength'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Strength Training' },
    { id: 'e19', title: 'Adventure Fitness', eventType: 'class', venueId: 'v11', start: new Date(2026, 0, 27, 17, 0), end: new Date(2026, 0, 27, 18, 0), tags: ['Fitness', 'Training'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Adventure Fitness' },
    { id: 'e20', title: 'CrossFit Morning', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 6, 0), end: new Date(2026, 0, 27, 7, 15), tags: ['CrossFit', 'Fitness'], ageGroup: 'Adults', price: '$25', recurrence: 'weekly', description: 'CrossFit Morning' },
    { id: 'e21', title: 'Conjugate Powerlifting', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 10, 30), tags: ['Powerlifting', 'Strength'], ageGroup: 'Adults', price: '$28', recurrence: 'weekly', description: 'Conjugate Powerlifting' },
    { id: 'e22', title: 'Perinatal Fitness', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 10, 0), end: new Date(2026, 0, 27, 11, 0), tags: ['Wellness', 'Prenatal'], ageGroup: 'Adults', price: '$22', recurrence: 'weekly', description: 'Perinatal Fitness' },
    { id: 'e23', title: 'CrossFit Midday', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 12, 0), end: new Date(2026, 0, 27, 13, 15), tags: ['CrossFit', 'Fitness'], ageGroup: 'Adults', price: '$25', recurrence: 'weekly', description: 'CrossFit Midday' },
    { id: 'e24', title: 'CrossFit Kids (5-12)', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 16, 0), end: new Date(2026, 0, 27, 17, 0), tags: ['Kids', 'CrossFit'], ageGroup: 'Kids', price: '$20', recurrence: 'weekly', description: 'CrossFit Kids (5-12)' },
    { id: 'e25', title: 'Teen Lifters (13-18)', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 16, 0), end: new Date(2026, 0, 27, 17, 30), tags: ['Teens', 'Strength'], ageGroup: 'Teens & Adults', price: '$22', recurrence: 'weekly', description: 'Teen Lifters (13-18)' },
    { id: 'e26', title: 'CrossFit Evening', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 16, 30), end: new Date(2026, 0, 27, 17, 45), tags: ['CrossFit', 'Fitness'], ageGroup: 'Adults', price: '$25', recurrence: 'weekly', description: 'CrossFit Evening' },
    { id: 'e27', title: 'CrossFit Late', eventType: 'class', venueId: 'v1', start: new Date(2026, 0, 27, 18, 0), end: new Date(2026, 0, 27, 19, 15), tags: ['CrossFit', 'Fitness'], ageGroup: 'Adults', price: '$25', recurrence: 'weekly', description: 'CrossFit Late' },
    { id: 'e28', title: 'Pilates Movement', eventType: 'class', venueId: 'v24', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 10, 0), tags: ['Fitness', 'Pilates'], ageGroup: 'Adults', price: '$24', recurrence: 'weekly', description: 'Pilates Movement' },
    { id: 'e29', title: 'Cardio Dance Party', eventType: 'class', venueId: 'v24', start: new Date(2026, 0, 27, 17, 45), end: new Date(2026, 0, 27, 18, 45), tags: ['Fitness', 'Dance'], ageGroup: 'Adults', price: '$20', recurrence: 'weekly', description: 'Cardio Dance Party' },
    { id: 'e30', title: 'Lane Swim', eventType: 'class', venueId: 'v17', start: new Date(2026, 0, 27, 6, 0), end: new Date(2026, 0, 27, 7, 30), tags: ['Swimming', 'Fitness'], ageGroup: 'All Ages', price: '$6', recurrence: 'weekly', description: 'Lane Swim' },
    { id: 'e31', title: 'Aquafit', eventType: 'class', venueId: 'v17', start: new Date(2026, 0, 27, 9, 0), end: new Date(2026, 0, 27, 9, 45), tags: ['Fitness', 'Aquatic'], ageGroup: 'Adults', price: '$12', recurrence: 'weekly', description: 'Aquafit' },
    { id: 'e32', title: 'Public Swim', eventType: 'class', venueId: 'v17', start: new Date(2026, 0, 27, 13, 0), end: new Date(2026, 0, 27, 15, 0), tags: ['Swimming', 'Recreation'], ageGroup: 'All Ages', price: '$6', recurrence: 'weekly', description: 'Public Swim' },
    { id: 'e33', title: 'Kids Swim Lessons', eventType: 'class', venueId: 'v17', start: new Date(2026, 0, 27, 15, 30), end: new Date(2026, 0, 27, 16, 15), tags: ['Kids', 'Swimming'], ageGroup: 'Kids', price: '$15', recurrence: 'weekly', description: 'Kids Swim Lessons' },
    { id: 'e34', title: 'Adult Swim Lessons', eventType: 'class', venueId: 'v17', start: new Date(2026, 0, 27, 16, 45), end: new Date(2026, 0, 27, 17, 30), tags: ['Adults', 'Swimming'], ageGroup: 'Adults', price: '$18', recurrence: 'weekly', description: 'Adult Swim Lessons' },
    { id: 'e35', title: 'Lane Swim Evening', eventType: 'class', venueId: 'v17', start: new Date(2026, 0, 27, 18, 0), end: new Date(2026, 0, 27, 20, 0), tags: ['Swimming', 'Fitness'], ageGroup: 'All Ages', price: '$6', recurrence: 'weekly', description: 'Lane Swim Evening' },
    { id: 'e36', title: 'Public Skate', eventType: 'class', venueId: 'v14', start: new Date(2026, 0, 27, 12, 0), end: new Date(2026, 0, 27, 13, 30), tags: ['Ice Sports', 'Recreation'], ageGroup: 'All Ages', price: '$6', recurrence: 'weekly', description: 'Public Skate' },
    { id: 'e37', title: 'Hockey Skills Development', eventType: 'class', venueId: 'v14', start: new Date(2026, 0, 27, 16, 30), end: new Date(2026, 0, 27, 17, 30), tags: ['Kids', 'Hockey'], ageGroup: 'Kids', price: '$25', recurrence: 'weekly', description: 'Hockey Skills Development' },
    { id: 'e38', title: 'Little Tigers Taekwondo (3-5)', eventType: 'class', venueId: 'v21', start: new Date(2026, 0, 27, 16, 0), end: new Date(2026, 0, 27, 17, 0), tags: ['Kids', 'Martial Arts'], ageGroup: 'Kids', price: '$20', recurrence: 'weekly', description: 'Little Tigers Taekwondo (3-5)' },
    { id: 'e39', title: 'Beginner Taekwondo (6-8)', eventType: 'class', venueId: 'v21', start: new Date(2026, 0, 27, 17, 0), end: new Date(2026, 0, 27, 17, 45), tags: ['Kids', 'Martial Arts'], ageGroup: 'Kids', price: '$22', recurrence: 'weekly', description: 'Beginner Taekwondo (6-8)' },
    { id: 'e40', title: 'Intermediate Taekwondo (9-12)', eventType: 'class', venueId: 'v21', start: new Date(2026, 0, 27, 18, 0), end: new Date(2026, 0, 27, 19, 0), tags: ['Kids', 'Martial Arts'], ageGroup: 'Kids', price: '$24', recurrence: 'weekly', description: 'Intermediate Taekwondo (9-12)' },
    { id: 'e41', title: 'Advanced Taekwondo (Teens)', eventType: 'class', venueId: 'v21', start: new Date(2026, 0, 27, 19, 0), end: new Date(2026, 0, 27, 20, 0), tags: ['Teens', 'Martial Arts'], ageGroup: 'Teens & Adults', price: '$26', recurrence: 'weekly', description: 'Advanced Taekwondo (Teens)' },
    { id: 'e42', title: "Women's Kickboxing", eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 9, 30), end: new Date(2026, 0, 27, 10, 30), tags: ['Adults', 'Kickboxing', 'Martial Arts'], ageGroup: 'Adults', price: '$28', recurrence: 'weekly', description: "Women's Kickboxing" },
    { id: 'e43', title: 'Little Kids KB (Ages 4-8)', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 15, 30), end: new Date(2026, 0, 27, 16, 10), tags: ['Kids', 'Kickboxing', 'Martial Arts'], ageGroup: 'Kids', price: '$24', recurrence: 'weekly', description: 'Little Kids Kickboxing Ages 4-8' },
    { id: 'e44', title: 'Kids Kickboxing (Ages 8-12)', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 16, 15), end: new Date(2026, 0, 27, 17, 0), tags: ['Kids', 'Kickboxing', 'Martial Arts'], ageGroup: 'Kids', price: '$26', recurrence: 'weekly', description: 'Kids Kickboxing Ages 8-12' },
    { id: 'e45', title: 'Youth Boxing Class (12-Teens)', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 17, 0), end: new Date(2026, 0, 27, 17, 50), tags: ['Teens', 'Boxing', 'Martial Arts'], ageGroup: 'Teens & Adults', price: '$26', recurrence: 'weekly', description: 'Youth Boxing Class 12-Teens' },
    { id: 'e46', title: 'Youth Jiu Jitsu', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 17, 10), end: new Date(2026, 0, 27, 17, 55), tags: ['Teens', 'Jiu Jitsu', 'Martial Arts'], ageGroup: 'Teens & Adults', price: '$28', recurrence: 'weekly', description: 'Youth Jiu Jitsu' },
    { id: 'e47', title: 'Jiu Jitsu - No GI', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 18, 0), end: new Date(2026, 0, 27, 19, 0), tags: ['Adults', 'Jiu Jitsu', 'Martial Arts'], ageGroup: 'Adults', price: '$32', recurrence: 'weekly', description: 'Jiu Jitsu No GI' },
    { id: 'e48', title: 'Kickboxing - Adults & Teens', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 19, 0), end: new Date(2026, 0, 27, 20, 0), tags: ['Adults', 'Kickboxing', 'Martial Arts'], ageGroup: 'Adults', price: '$30', recurrence: 'weekly', description: 'Kickboxing Adults & Teens' },
    { id: 'e50', title: 'Private Group Training', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 16, 20), end: new Date(2026, 0, 27, 17, 5), tags: ['Adults', 'Training', 'Martial Arts'], ageGroup: 'All Ages', price: '$40', recurrence: 'weekly', description: 'Private Group Training' },
    { id: 'e51', title: 'U18 Hockey Training', eventType: 'class', venueId: 'v22', start: new Date(2026, 0, 27, 15, 30), end: new Date(2026, 0, 27, 16, 20), tags: ['Kids', 'Hockey', 'Training'], ageGroup: 'Kids', price: '$30', recurrence: 'weekly', description: 'U18 Hockey Training' },
    { id: 'e52', title: 'Adult Aikido', eventType: 'class', venueId: 'v23', start: new Date(2026, 0, 27, 19, 0), end: new Date(2026, 0, 27, 20, 30), tags: ['Adults', 'Aikido'], ageGroup: 'Adults', price: '$26', recurrence: 'weekly', description: 'Adult Aikido' },
    { id: 'e53', title: 'Tiny Dancers (3-5)', eventType: 'class', venueId: 'v18', start: new Date(2026, 0, 27, 16, 0), end: new Date(2026, 0, 27, 16, 45), tags: ['Kids', 'Dance'], ageGroup: 'Kids', price: '$18', recurrence: 'weekly', description: 'Tiny Dancers (3-5)' },
    { id: 'e54', title: 'Jazz Kids (7-12)', eventType: 'class', venueId: 'v18', start: new Date(2026, 0, 27, 17, 30), end: new Date(2026, 0, 27, 18, 30), tags: ['Kids', 'Dance'], ageGroup: 'Kids', price: '$20', recurrence: 'weekly', description: 'Jazz Kids (7-12)' },
    { id: 'e55', title: 'Creative Dance (2-4)', eventType: 'class', venueId: 'v19', start: new Date(2026, 0, 27, 15, 30), end: new Date(2026, 0, 27, 16, 15), tags: ['Kids', 'Dance'], ageGroup: 'Kids', price: '$16', recurrence: 'weekly', description: 'Creative Dance (2-4)' },
    { id: 'e56', title: 'Tap Dance', eventType: 'class', venueId: 'v19', start: new Date(2026, 0, 27, 17, 0), end: new Date(2026, 0, 27, 17, 45), tags: ['Kids', 'Dance'], ageGroup: 'Kids', price: '$20', recurrence: 'weekly', description: 'Tap Dance' },
    { id: 'e57', title: 'Musical Theater Kids (7-12)', eventType: 'class', venueId: 'v20', start: new Date(2026, 0, 27, 16, 0), end: new Date(2026, 0, 27, 17, 15), tags: ['Kids', 'Performing Arts'], ageGroup: 'Kids', price: '$22', recurrence: 'weekly', description: 'Musical Theater Kids (7-12)' },
    { id: 'e58', title: 'Enchanted Forest at Squamish Canyon', eventType: 'event', venueId: 'v5', start: new Date(2026, 0, 27, 17, 0), end: new Date(2026, 0, 27, 21, 0), tags: ['Family', 'Outdoors & Nature', 'Lights'], ageGroup: 'All Ages', price: '$25', recurrence: 'weekly', description: 'Enchanted Forest at Squamish Canyon', featured: true },
    { id: 'e59', title: 'Ore and Orcas: Howe Sound Ecosystem', eventType: 'event', venueId: 'v14', start: new Date(2026, 0, 27, 10, 0), end: new Date(2026, 0, 27, 17, 0), tags: ['Outdoors & Nature', 'Education'], ageGroup: 'All Ages', price: '$15', recurrence: 'weekly', description: 'Ore and Orcas: Howe Sound Ecosystem' },
    { id: 'e60', title: 'Catan League', eventType: 'event', venueId: 'v8', start: new Date(2026, 0, 27, 19, 0), end: new Date(2026, 0, 27, 22, 0), tags: ['Games', 'Community'], ageGroup: 'Teens & Adults', price: '$5', recurrence: 'weekly', description: 'Catan League' }
  ],
  
  deals: [
    { id: 'd1', title: 'Family Night', description: 'Family Night - Kids eat for half price + special milkshake menu', venueId: 'v8', schedule: 'Mondays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd2', title: '$15 select burgers & 1/2 price bottles of wine', description: '$15 select burgers & 1/2 price bottles of wine', venueId: 'v8', schedule: 'Tuesdays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd3', title: 'Date Night: Surf N\' Turf for 2', description: 'Date Night: Surf N\' Turf for 2 - $75 (includes bottle of red or white wine)', venueId: 'v216', schedule: 'Monday to Wednesday', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd4', title: 'Burger & A Beer', description: 'Burger & A Beer - $20 (Beef or veggie burger with fries and 16oz brew or 5oz wine or non-alc beverage)', venueId: 'v281', schedule: 'Monday-Friday 11:30AM-2PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd5', title: 'Kids eat free (12yrs and under with adult entree purchase)', description: 'Kids eat free (12yrs and under with adult entree purchase)', venueId: 'v221', schedule: 'Tuesdays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd6', title: 'All veggie burritos $12, All veggie tacos $5', description: 'All veggie burritos $12, All veggie tacos $5', venueId: 'v473', schedule: 'Mondays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd7', title: '2 Fish tacos for $12', description: '2 Fish tacos for $12', venueId: 'v473', schedule: 'Tuesdays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd8', title: 'Nachos $16', description: 'Nachos $16', venueId: 'v473', schedule: 'Wednesdays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd9', title: 'Chips & Guac $10', description: 'Chips & Guac $10', venueId: 'v473', schedule: 'Thursdays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd10', title: 'Chips & Queso $8', description: 'Chips & Queso $8', venueId: 'v473', schedule: 'Fridays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd11', title: 'Loaded tots $8', description: 'Loaded tots $8', venueId: 'v473', schedule: 'Saturdays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd12', title: 'Stadium Nachos $10', description: 'Stadium Nachos $10', venueId: 'v473', schedule: 'Sundays', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd13', title: 'Happy Hour + $5 draft beer all day every day', description: 'Happy Hour + $5 draft beer all day every day', venueId: 'v473', schedule: 'Daily 3PM-6PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd14', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v474', schedule: 'Daily before 5pm and after 9pm', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd15', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v475', schedule: 'Monday-Friday 3PM-6PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd16', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v281', schedule: 'Daily 3PM-5PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd17', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v202', schedule: 'Wednesday-Sunday 3PM-5PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd18', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v216', schedule: 'Daily 3PM-6PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd19', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v476', schedule: 'Sunday-Thursday 4PM-6PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd20', title: 'Hoppy Hours', description: 'Hoppy Hours', venueId: 'v477', schedule: 'Daily 6PM-close', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd21', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v478', schedule: 'Daily 2PM-5PM', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd22', title: 'Happy Hour', description: 'Happy Hour', venueId: 'v479', schedule: 'Wed 5-7pm, Thurs 1-7pm, Fri & Sat 7-9pm, Sun 5-10pm', featured: false, category: 'Food & Drink', savingsPercent: 0 },
    { id: 'd23', title: 'Happy Hour', description: 'Happy Hour - 15% off all food', venueId: 'v203', schedule: 'Monday-Friday 3PM-5PM', featured: false, category: 'Food & Drink', savingsPercent: 0 }
  ],


  services: [
    {
      id: 's1',
      name: '1914 Coffee',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 195,
      address: '38123 2nd Ave',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's2',
      name: '99 North Movers & Delivery',
      category: 'Moving & Storage',
      rating: 5,
      reviews: 10,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's3',
      name: 'A-FRAME Brewing Company',
      category: 'Breweries & Distilleries',
      rating: 4.3,
      reviews: 394,
      address: '1-38927 Queens Way',
      phone: '(604) 892-0777',
      website: 'aframebrewing.com',
      email: 'info@aframebrewing.com'
    },
    {
      id: 's4',
      name: 'A&W Squamish',
      category: 'Restaurants & Dining',
      rating: 3.7,
      reviews: 1000,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-4848',
      website: 'https://aw.ca',
      email: 'squamish@aw.ca'
    },
    {
      id: 's5',
      name: 'Ajay Thomas Photography',
      category: 'Photography',
      rating: 5,
      reviews: 17,
      address: '1188 Main Street #82, Squamish, BC V8B 0Z3',
      phone: '',
      website: 'ajaythomasphotography.com',
      email: 'info@ajaythomasphotography.com'
    },
    {
      id: 's6',
      name: 'Alice and Brohm Ice Cream',
      category: 'Ice Cream & Desserts',
      rating: 4.8,
      reviews: 254,
      address: '38129 2nd Ave',
      phone: '(604) 815-8822',
      website: 'https://aliceandbrohm.ca',
      email: 'info@aliceandbrohm.ca'
    },
    {
      id: 's7',
      name: 'Alice Lake Campground',
      category: 'Campgrounds',
      rating: 4.7,
      reviews: 162,
      address: '201-38142 Cleveland Ave',
      phone: '(604) 815-2884',
      website: 'https://bcparks.ca',
      email: 'info@bcparks.ca'
    },
    {
      id: 's8',
      name: 'Alice Lake Provincial Park',
      category: 'Attractions',
      rating: 4.6,
      reviews: 2388,
      address: 'Alice Lake Road, Squamish, BC V0N 1H0',
      phone: '',
      website: '',
      email: 'info@bcparks.ca'
    },
    {
      id: 's9',
      name: 'All Time Moving & Storage',
      category: 'Moving & Storage',
      rating: 4.9,
      reviews: 191,
      address: '39100 Queens Way, Squamish, BC V8B 0K8',
      phone: '(604) 902-6683',
      website: 'alltimemoving.ca',
      email: 'info@alltimemoving.ca'
    },
    {
      id: 's10',
      name: 'Alpenlofts Veterinary Hospital',
      category: 'Veterinary',
      rating: 4.4,
      reviews: 169,
      address: '40446 Tantalus Rd',
      phone: '(604) 898-9089',
      website: 'https://alpenloftsvet.ca',
      email: 'info@alpenloftsvet.ca'
    },
    {
      id: 's11',
      name: 'Ambience Floors',
      category: 'Flooring',
      rating: 4.9,
      reviews: 56,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's12',
      name: 'Ameera Shums Notary',
      category: 'Notaries',
      rating: 4.6,
      reviews: 22,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's14',
      name: 'Anytime Fitness',
      category: 'Fitness & Gyms',
      rating: 4.4,
      reviews: 216,
      address: '40258 Glenalder Pl',
      phone: '(604) 390-3488',
      website: '',
      email: 'squamishbc@anytimefitness.ca'
    },
    {
      id: 's15',
      name: 'Anytime Roofing Ltd',
      category: 'Roofing',
      rating: 4.9,
      reviews: 54,
      address: 'Squamish (mobile service)',
      phone: '(778) 710-7104',
      website: 'anytimeroofing.ca',
      email: ''
    },
    {
      id: 's16',
      name: 'Arrow Wood Games',
      category: 'Entertainment',
      rating: 4.9,
      reviews: 76,
      address: '38129 2nd Ave',
      phone: '(604) 815-4466',
      website: 'https://arrowwoodgames.ca',
      email: 'info@arrowwoodgames.ca'
    },
    {
      id: 's17',
      name: 'Atwell Dental',
      category: 'Dental',
      rating: 4.7,
      reviews: 42,
      address: '8-40437 Tantalus Rd',
      phone: '(604) 567-1155',
      website: 'atwelldental.com',
      email: 'info@atwelldental.com'
    },
    {
      id: 's18',
      name: 'Avant Life Church Squamish',
      category: 'Churches & Religious',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '',
      website: 'avantlifechurch.com',
      email: 'info@avantlifechurch.com'
    },
    {
      id: 's19',
      name: 'Awesome Hair Salon',
      category: 'Salons & Spas',
      rating: 4.4,
      reviews: 225,
      address: '38145 Cleveland Ave',
      phone: '(604) 892-4567',
      website: 'https://awesomehairsquamish.ca',
      email: 'info@awesomehairsquamish.ca'
    },
    {
      id: 's20',
      name: 'Backcountry Brewing',
      category: 'Breweries & Distilleries',
      rating: 4.7,
      reviews: 1345,
      address: '405-1201 Commercial Way',
      phone: '604-567-2739',
      website: 'backcountrybrewing.com',
      email: 'ben@backcountrybrewing.com'
    },
    {
      id: 's22',
      name: 'BC Ambulance Service Squamish',
      category: 'Emergency Services',
      rating: 4.2,
      reviews: 118,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5211',
      website: 'https://bcehs.ca',
      email: 'squamish@bcehs.ca'
    },
    {
      id: 's23',
      name: 'BC Liquor Store',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 280,
      address: '1005 B Industrial Way',
      phone: '(604) 892-3955',
      website: '',
      email: ''
    },
    {
      id: 's24',
      name: 'BC SPCA Sea to Sky',
      category: 'Community Services',
      rating: 4.7,
      reviews: 52,
      address: '1005 B Industrial Way, Squamish, BC V8B 0H1',
      phone: '(604) 898-9890',
      website: '',
      email: 'seatosky@spca.bc.ca'
    },
    {
      id: 's25',
      name: 'BC Timberframe Company',
      category: 'Construction & Building',
      rating: 4,
      reviews: 4,
      address: '39550 Government Road',
      phone: '(604) 892-1088',
      website: '',
      email: 'info@bctimberframe.ca'
    },
    {
      id: 's26',
      name: 'BC Transit Squamish',
      category: 'Transportation',
      rating: 3.5,
      reviews: 25,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2951',
      website: 'https://bctransit.com',
      email: 'squamish@bctransit.com'
    },
    {
      id: 's27',
      name: 'Be Clean Naturally',
      category: 'Retail & Shopping',
      rating: 4.7,
      reviews: 24,
      address: '38140 Cleveland Ave',
      phone: '(604) 898-8889',
      website: '',
      email: 'hello@becleannaturally.ca'
    },
    {
      id: 's28',
      name: 'Best Quality Roofing',
      category: 'Roofing',
      rating: 4.5,
      reviews: 24,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's29',
      name: 'Big Valley Heating & Sheet Metal Ltd',
      category: 'Plumbing & HVAC',
      rating: 4.9,
      reviews: 66,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's30',
      name: 'Billies Flower House',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 141,
      address: '38133 Cleveland Ave',
      phone: '(604) 892-9232',
      website: '',
      email: 'billies@billieshouse.com'
    },
    {
      id: 's31',
      name: 'Billies House',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 141,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2859',
      website: 'https://billieshouse.ca',
      email: 'info@billieshouse.ca'
    },
    {
      id: 's32',
      name: 'Billies House Kids Store',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 141,
      address: '38042 Cleveland Ave',
      phone: '(604) 892-9310',
      website: 'https://billieshouse.ca',
      email: 'info@billieshouse.ca'
    },
    {
      id: 's33',
      name: 'Black Box Cuisine',
      category: 'Food Trucks',
      rating: 5,
      reviews: 184,
      address: 'Cliffside Cider',
      phone: '(604) 389-9458',
      website: '',
      email: 'theblackboxcuisine@gmail.com'
    },
    {
      id: 's34',
      name: 'Black Forest Electric',
      category: 'Electrical',
      rating: 5,
      reviews: 49,
      address: '38924 Queens Way',
      phone: '(604) 892-3344',
      website: 'https://blackforestelectric.ca',
      email: 'info@blackforestelectric.ca'
    },
    {
      id: 's35',
      name: 'Black Tusk Web Design',
      category: 'Web & Marketing',
      rating: 5,
      reviews: 1,
      address: '116-1201 Commercial Way, Squamish, BC V0N 3G0',
      phone: '(604) 849-1922',
      website: 'blacktuskweb.com',
      email: 'info@blacktuskweb.com'
    },
    {
      id: 's36',
      name: 'Blackcomb Aviation',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 507,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's37',
      name: 'Blazing Saddles Adventures',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 37,
      address: '38129 2nd Ave',
      phone: '(604) 815-2818',
      website: 'https://blazingsaddlesadventures.com',
      email: 'info@blazingsaddlesadventures.com'
    },
    {
      id: 's38',
      name: 'Blazing Saddles Adventures (E-bike Tours)',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 37,
      address: '1861 Mamquam Rd',
      phone: '(604) 902-2294',
      website: 'blazingsaddlesadventures.com',
      email: 'info@blazingsaddlesadventures.com'
    },
    {
      id: 's39',
      name: 'Blownaway Beauty',
      category: 'Salons & Spas',
      rating: 4.9,
      reviews: 43,
      address: '40383 Tantalus Rd',
      phone: '(604) 815-9999',
      website: 'https://blownawaybeauty.ca',
      email: 'info@blownawaybeauty.ca'
    },
    {
      id: 's40',
      name: 'Blue Water Concepts',
      category: 'Construction & Building',
      rating: 4.9,
      reviews: 35,
      address: '111-1091 Commercial Pl',
      phone: '(604) 389-8554',
      website: 'bluewaterconcepts.ca',
      email: ''
    },
    {
      id: 's41',
      name: 'Blueline Contracting',
      category: 'Construction & Building',
      rating: 4.7,
      reviews: 15,
      address: '38146 Behrner Dr',
      phone: '',
      website: 'bluelinecontracting.com',
      email: 'admin@bluelinecontracting.com'
    },
    {
      id: 's42',
      name: 'BlueShore Financial Squamish',
      category: 'Financial Services',
      rating: 2.9,
      reviews: 7,
      address: '38027 Cleveland Ave',
      phone: '(604) 982-8000',
      website: 'https://blueshorefinancial.com',
      email: 'squamish@blueshorefinancial.com'
    },
    {
      id: 's43',
      name: 'BMO Bank of Montreal',
      category: 'Financial Services',
      rating: 3.1,
      reviews: 31,
      address: '38201 Cleveland Ave, Squamish, BC V8B 0B1',
      phone: '(604) 892-3591',
      website: '',
      email: ''
    },
    {
      id: 's44',
      name: 'Body Storm Fitness',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 173,
      address: '40330 Tantalus Rd',
      phone: '(604) 848-4644',
      website: 'https://bodystormfitness.ca',
      email: 'info@bodystormfitness.ca'
    },
    {
      id: 's45',
      name: 'Book Mountain',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 1161,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2862',
      website: 'https://bookmountain.ca',
      email: 'info@bookmountain.ca'
    },
    {
      id: 's46',
      name: 'Boston Pizza Squamish',
      category: 'Restaurants & Dining',
      rating: 3.6,
      reviews: 668,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-4050',
      website: 'https://bostonpizza.com',
      email: 'squamish@bostonpizza.com'
    },
    {
      id: 's47',
      name: 'Brackendale Art Gallery',
      category: 'Arts & Culture',
      rating: 4.8,
      reviews: 200,
      address: '41950 Government Road, Brackendale, BC V0N 1H0',
      phone: '(604) 898-3333',
      website: '',
      email: 'careers@brackendaleartgallery.com'
    },
    {
      id: 's48',
      name: 'Brackendale Eagle Reserve',
      category: 'Attractions',
      rating: 4.5,
      reviews: 133,
      address: 'Government Road (Eagle Run Dyke viewing area), Brackendale, BC V0N 1H0',
      phone: '',
      website: '',
      email: 'info@bcparks.ca'
    },
    {
      id: 's49',
      name: 'Brackendale Farm',
      category: 'Farms & Markets',
      rating: 4,
      reviews: 4,
      address: 'Government Road, Brackendale, BC V0N 1H0',
      phone: '(604) 815-2982',
      website: 'https://brackendalefarm.ca',
      email: 'info@brackendalefarm.ca'
    },
    {
      id: 's51',
      name: 'Break The Chain Fitness',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 3,
      address: '38127 2nd Ave',
      phone: '(604) 389-8603',
      website: 'https://breakthechainfit.com',
      email: 'info@breakthechainfit.com'
    },
    {
      id: 's52',
      name: 'Breathe Fitness Studio',
      category: 'Fitness & Gyms',
      rating: 4.6,
      reviews: 18,
      address: '38127 2nd Ave',
      phone: '(604) 727-7390',
      website: 'breathesquamish.com',
      email: 'info@breathefitnessstudio.ca'
    },
    {
      id: 's53',
      name: 'Brennan Park Arena',
      category: 'Recreation & Sports',
      rating: 4.2,
      reviews: 419,
      address: '1009 Centennial Way',
      phone: '(604) 898-3604',
      website: 'https://squamish.ca',
      email: 'arena@squamish.ca'
    },
    {
      id: 's54',
      name: 'Brennan Park Leisure Centre',
      category: 'Recreation & Sports',
      rating: 4.2,
      reviews: 419,
      address: '1009 Centennial Way',
      phone: '(604) 898-3604',
      website: 'https://squamish.ca',
      email: 'brennanpark@squamish.ca'
    },
    {
      id: 's55',
      name: 'Brennan Park Recreation Centre',
      category: 'Recreation & Sports',
      rating: 4.2,
      reviews: 419,
      address: '1009 Centennial Way',
      phone: '(604) 898-3604',
      website: '',
      email: ''
    },
    {
      id: 's56',
      name: 'Britannia Autostrada Oyster Bar',
      category: 'Restaurants & Dining',
      rating: 4.7,
      reviews: 62,
      address: '115 Main Street, Britannia Beach, BC V8B 1A7',
      phone: '(604) 894-0660',
      website: '',
      email: ''
    },
    {
      id: 's57',
      name: 'Britannia Mine Museum',
      category: 'Attractions',
      rating: 4.7,
      reviews: 2791,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's58',
      name: 'Caffe Garibaldi',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 256,
      address: '2590 Portree Way',
      phone: '(844) 427-4225',
      website: 'caffegaribaldi.ca',
      email: 'info@caffegaribaldi.ca'
    },
    {
      id: 's59',
      name: 'Cam Sherk Notary Public',
      category: 'Notaries',
      rating: 4.5,
      reviews: 25,
      address: '201-38142 Cleveland Ave',
      phone: '(604) 567-8711',
      website: 'camsherknotary.com',
      email: 'info@camsherknotary.com'
    },
    {
      id: 's60',
      name: 'Canada Post Squamish',
      category: 'Postal & Shipping',
      rating: 2.9,
      reviews: 56,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5212',
      website: 'https://canadapost-postescanada.ca',
      email: 'squamish@canadapost.ca'
    },
    {
      id: 's61',
      name: 'Canada West Mountain School',
      category: 'Outdoor Adventures',
      rating: 4.8,
      reviews: 65,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2821',
      website: 'https://themountainschool.com',
      email: 'info@themountainschool.com'
    },
    {
      id: 's62',
      name: 'Canadian Coastal Adventures',
      category: 'Outdoor Adventures',
      rating: 4.6,
      reviews: 39,
      address: '38129 2nd Ave',
      phone: '(604) 815-6655',
      website: 'https://canadiancoastaladventures.ca',
      email: 'info@canadiancoastaladventures.ca'
    },
    {
      id: 's63',
      name: 'Canadian Outback Rafting',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 984,
      address: '38146 Behrner Dr',
      phone: '(604) 815-2817',
      website: 'https://canadianoutback.com',
      email: 'info@canadianoutback.com'
    },
    {
      id: 's64',
      name: 'Canadian Tire',
      category: 'Retail & Shopping',
      rating: 3.9,
      reviews: 650,
      address: '1851 Mamquam Rd',
      phone: '(604) 898-2227',
      website: '',
      email: ''
    },
    {
      id: 's65',
      name: 'Canadian Tire Squamish',
      category: 'Retail & Shopping',
      rating: 3.9,
      reviews: 650,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-3344',
      website: 'https://canadiantire.ca',
      email: 'squamish@canadiantire.ca'
    },
    {
      id: 's66',
      name: 'Capilano University (Squamish Campus)',
      category: 'Education',
      rating: 5,
      reviews: 5,
      address: '38027 Cleveland Ave',
      phone: '(604) 986-1911',
      website: '',
      email: 'squamish@capilanou.ca'
    },
    {
      id: 's67',
      name: 'Capilano University Squamish',
      category: 'Education',
      rating: 5,
      reviews: 5,
      address: '38027 Cleveland Ave',
      phone: '(604) 986-1911',
      website: 'https://capilanou.ca',
      email: 'squamish@capilanou.ca'
    },
    {
      id: 's68',
      name: 'Capra Running',
      category: 'Outdoor Gear & Shops',
      rating: 4.8,
      reviews: 109,
      address: '38147 Cleveland Ave',
      phone: '(604) 815-2869',
      website: 'https://caprarunning.com',
      email: 'info@caprarunning.com'
    },
    {
      id: 's69',
      name: 'Carson Automotive',
      category: 'Auto Services',
      rating: 4.7,
      reviews: 128,
      address: '2595 Mamquam Rd, Squamish, BC V8B 0H4',
      phone: '(604) 898-9845',
      website: 'carsonauto.ca',
      email: ''
    },
    {
      id: 's70',
      name: 'Century 21 Squamish',
      category: 'Real Estate',
      rating: 4,
      reviews: 81,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2895',
      website: 'https://century21squamish.ca',
      email: 'info@century21squamish.ca'
    },
    {
      id: 's72',
      name: 'Chatterbox Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.3,
      reviews: 88,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's75',
      name: 'Chief BMX Track',
      category: 'Recreation & Sports',
      rating: 5,
      reviews: 6,
      address: 'Squamish',
      phone: '(604) 815-2985',
      website: 'https://squamish.ca',
      email: 'parks@squamish.ca'
    },
    {
      id: 's76',
      name: 'Chief Car Wash',
      category: 'Auto Services',
      rating: 4,
      reviews: 190,
      address: '40200 Tantalus Rd',
      phone: '(604) 815-3033',
      website: 'https://chiefcarwash.ca',
      email: 'info@chiefcarwash.ca'
    },
    {
      id: 's77',
      name: 'Chief Chocolates',
      category: 'Specialty Food',
      rating: 4.6,
      reviews: 169,
      address: '38020 Cleveland Ave',
      phone: '(604) 815-3054',
      website: 'https://chiefchocolates.ca',
      email: 'info@chiefchocolates.ca'
    },
    {
      id: 's78',
      name: 'Chief Electric',
      category: 'Electrical',
      rating: 5,
      reviews: 2,
      address: '38930 Progress Way',
      phone: '(604) 815-2903',
      website: 'https://chiefelectric.ca',
      email: 'info@chiefelectric.ca'
    },
    {
      id: 's79',
      name: 'Chief Fencing',
      category: 'Home Improvement',
      rating: 4.2,
      reviews: 5,
      address: 'Squamish',
      phone: '(604) 815-3021',
      website: 'https://chieffencing.ca',
      email: 'info@chieffencing.ca'
    },
    {
      id: 's80',
      name: 'Chief Roasters',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 205,
      address: '38129 2nd Ave',
      phone: '(604) 815-2961',
      website: 'https://chiefroasters.ca',
      email: 'info@chiefroasters.ca'
    },
    {
      id: 's81',
      name: 'Chief Training Squamish',
      category: 'Fitness & Gyms',
      rating: 4.9,
      reviews: 38,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2804',
      website: 'https://chieftraining.ca',
      email: 'info@chieftraining.ca'
    },
    {
      id: 's82',
      name: 'Chief Wellness Centre',
      category: 'Health & Wellness',
      rating: 4.8,
      reviews: 17,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2966',
      website: 'https://chiefwellness.ca',
      email: 'info@chiefwellness.ca'
    },
    {
      id: 's83',
      name: 'Church of the Holy Cross',
      category: 'Churches & Religious',
      rating: 4.5,
      reviews: 2,
      address: '38127 2nd Ave',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's84',
      name: 'CIBC Squamish',
      category: 'Financial Services',
      rating: 3.9,
      reviews: 34,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5285',
      website: 'https://cibc.com',
      email: 'squamish@cibc.com'
    },
    {
      id: 's85',
      name: 'Cleveland Lawson LLP',
      category: 'Legal Services',
      rating: 1,
      reviews: 1,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2889',
      website: 'https://clevelandlawson.ca',
      email: 'info@clevelandlawson.ca'
    },
    {
      id: 's86',
      name: 'Cleveland Meats',
      category: 'Grocery & Markets',
      rating: 4.9,
      reviews: 76,
      address: '38147 Cleveland Ave',
      phone: '(604) 892-5566',
      website: 'https://clevelandmeats.ca',
      email: 'info@clevelandmeats.ca'
    },
    {
      id: 's87',
      name: 'Cliffside Cider',
      category: 'Breweries & Distilleries',
      rating: 4.7,
      reviews: 356,
      address: '#103-37760 2nd Ave',
      phone: '778-389-3343',
      website: 'cliffsidecider.ca',
      email: 'info@cliffsidecider.com'
    },
    {
      id: 's88',
      name: 'Climb On Equipment',
      category: 'Outdoor Gear & Shops',
      rating: 4.8,
      reviews: 358,
      address: '37873 Cleveland Ave',
      phone: '(604) 892-2243',
      website: '',
      email: 'info@climbon.com'
    },
    {
      id: 's89',
      name: 'Cloud 9 Beautique Salon & Medical Spa',
      category: 'Salons & Spas',
      rating: 4.6,
      reviews: 51,
      address: '40383 Tantalus Rd',
      phone: '(604) 892-7788',
      website: 'https://cloud9beautique.ca',
      email: 'info@cloud9beautique.ca'
    },
    {
      id: 's90',
      name: 'Cloudburst Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.3,
      reviews: 147,
      address: '11-1861 Mamquam Rd',
      phone: '(604) 898-1969',
      website: '',
      email: 'info@cloudburstcafe.ca'
    },
    {
      id: 's91',
      name: 'Club Flex Squamish',
      category: 'Fitness & Gyms',
      rating: 4.7,
      reviews: 101,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3539',
      website: 'https://clubflexsquamish.com',
      email: 'info@clubflexsquamish.com'
    },
    {
      id: 's92',
      name: 'Co-Pilot Cafe (Sea to Sky Gondola)',
      category: 'Cafes & Bakeries',
      rating: 4.2,
      reviews: 114,
      address: '36800 Highway 99, Squamish, BC V8B 0B6',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's93',
      name: 'Coast Capital Savings',
      category: 'Financial Services',
      rating: 4.5,
      reviews: 2,
      address: '1325 Pemberton Ave, Squamish, BC V8B 0J8',
      phone: '1-888-517-7000',
      website: '',
      email: ''
    },
    {
      id: 's94',
      name: 'Coast Essential Construction',
      category: 'Construction & Building',
      rating: 5,
      reviews: 5,
      address: '110-39279 Queens Way',
      phone: '(604) 390-2299',
      website: '',
      email: ''
    },
    {
      id: 's95',
      name: 'Coast Performance Rehab Squamish',
      category: 'Physiotherapy & Rehab',
      rating: 4.9,
      reviews: 44,
      address: '38027 Cleveland Ave',
      phone: '(604) 567-0355',
      website: 'https://coastperformancerehab.com',
      email: 'squamish@coastperformancerehab.com'
    },
    {
      id: 's96',
      name: 'Coast to Mountain Construction',
      category: 'Construction & Building',
      rating: 4.4,
      reviews: 10,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-5544',
      website: 'https://coasttomountain.ca',
      email: 'info@coasttomountain.ca'
    },
    {
      id: 's97',
      name: 'Coastal Church Squamish',
      category: 'Churches & Religious',
      rating: 4.3,
      reviews: 1035,
      address: '40900 Tantalus Rd (Executive Suites Hotel), Squamish, BC',
      phone: '(604) 684-8475',
      website: 'coastalchurch.org',
      email: 'squamish@coastalchurch.org'
    },
    {
      id: 's98',
      name: 'Company Store Britannia',
      category: 'Retail & Shopping',
      rating: 4.9,
      reviews: 730,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's99',
      name: 'Concrete Blonde Hair & Body Studio',
      category: 'Salons & Spas',
      rating: 4.5,
      reviews: 572,
      address: '38129 2nd Ave',
      phone: '(604) 892-8808',
      website: 'https://concreteblondesquamish.ca',
      email: 'info@concreteblondesquamish.ca'
    },
    {
      id: 's100',
      name: 'Core Intentions',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 7,
      address: '20-38922 Queens Way',
      phone: '(778) 242-2673',
      website: '',
      email: ''
    },
    {
      id: 's101',
      name: 'Core Intentions Pilates | Yoga | Aerial',
      category: 'Yoga & Pilates',
      rating: 4.8,
      reviews: 93,
      address: '20-38922 Queens Way',
      phone: '(778) 242-2673',
      website: 'https://coreintentions.com',
      email: 'info@coreintentions.com'
    },
    {
      id: 's102',
      name: 'Corsa Cycles',
      category: 'Outdoor Gear & Shops',
      rating: 4.6,
      reviews: 198,
      address: '38123 Cleveland Ave',
      phone: '(604) 892-3331',
      website: '',
      email: 'info@corsacycles.com'
    },
    {
      id: 's103',
      name: 'Crabapple Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.6,
      reviews: 1120,
      address: '38123 2nd Ave',
      phone: '(604) 815-2834',
      website: 'https://crabapplecafe.ca',
      email: 'info@crabapplecafe.ca'
    },
    {
      id: 's104',
      name: 'Crankpots Ceramic Studio',
      category: 'Arts & Culture',
      rating: 3,
      reviews: 2,
      address: '38129 2nd Ave',
      phone: '(604) 892-8899',
      website: 'https://crankpots.ca',
      email: 'info@crankpots.ca'
    },
    {
      id: 's105',
      name: 'Crash Hotel Squamish',
      category: 'Hotels & Lodging',
      rating: 4,
      reviews: 545,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9584',
      website: '',
      email: 'squamish@crashhotel.com'
    },
    {
      id: 's106',
      name: 'Create Makerspace',
      category: 'Arts & Culture',
      rating: 5,
      reviews: 54,
      address: '38129 2nd Ave',
      phone: '(604) 815-2864',
      website: 'https://createmakerspace.ca',
      email: 'info@createmakerspace.ca'
    },
    {
      id: 's107',
      name: 'CrossFit Squamish',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 28,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-1177',
      website: '',
      email: 'info@crossfitsquamish.com'
    },
    {
      id: 's108',
      name: 'Cypress Hardwood Flooring Ltd',
      category: 'Flooring',
      rating: 5,
      reviews: 7,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's109',
      name: 'Cyrus Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.8,
      reviews: 161,
      address: '38086 Cleveland Ave',
      phone: '(604) 390-2221',
      website: 'https://cyruscafe.ca',
      email: 'info@cyruscafe.ca'
    },
    {
      id: 's110',
      name: 'Dairy Queen Squamish',
      category: 'Ice Cream & Desserts',
      rating: 3.7,
      reviews: 289,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5556',
      website: 'https://dairyqueen.com',
      email: 'squamish@dairyqueen.ca'
    },
    {
      id: 's111',
      name: 'Darby Magill Photography',
      category: 'Photography',
      rating: 5,
      reviews: 125,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's112',
      name: 'DeckPros',
      category: 'Home Improvement',
      rating: 5,
      reviews: 63,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's113',
      name: 'Deep Flow Healing',
      category: 'Massage & Bodywork',
      rating: 5,
      reviews: 15,
      address: '38018 Cleveland Ave',
      phone: '(604) 390-0555',
      website: 'https://deepflowhealing.ca',
      email: 'info@deepflowhealing.ca'
    },
    {
      id: 's114',
      name: 'Dialed In Cycling',
      category: 'Outdoor Gear & Shops',
      rating: 5,
      reviews: 185,
      address: '38927 Progress Way',
      phone: '(604) 892-9171',
      website: 'https://dialedincycling.com',
      email: 'info@dialedincycling.com'
    },
    {
      id: 's115',
      name: 'Diamond Head Dental',
      category: 'Dental',
      rating: 5,
      reviews: 117,
      address: '203-40147 Glenalder Pl',
      phone: '604-898-4200',
      website: 'dhdental.com',
      email: ''
    },
    {
      id: 's116',
      name: 'Diamond Head Development',
      category: 'Construction & Building',
      rating: 5,
      reviews: 10,
      address: '38164 2nd Ave',
      phone: '(604) 849-0769',
      website: 'dhdev.ca',
      email: 'admin@dhdev.ca'
    },
    {
      id: 's117',
      name: 'Diamond Head Medical Clinic',
      category: 'Medical Clinics',
      rating: 3.9,
      reviews: 41,
      address: '37989 Cleveland Ave',
      phone: '604-892-5526',
      website: 'diamondheadmedical.com',
      email: ''
    },
    {
      id: 's118',
      name: 'Diamond Head Motors',
      category: 'Auto Services',
      rating: 4,
      reviews: 156,
      address: '1008 Industrial Way, Squamish, BC V8B 0G9',
      phone: '(604) 892-3365',
      website: '',
      email: ''
    },
    {
      id: 's119',
      name: 'Diamondhead Outfitters',
      category: 'Outdoor Adventures',
      rating: 4.5,
      reviews: 250,
      address: '15986 Squamish Valley Rd',
      phone: '(604) 898-1277',
      website: '',
      email: 'info@diamondheadoutfitters.com'
    },
    {
      id: 's120',
      name: 'Direct Heat',
      category: 'Plumbing & HVAC',
      rating: 3.8,
      reviews: 1258,
      address: '38930 Progress Way',
      phone: '(604) 815-8888',
      website: 'https://directheat.ca',
      email: 'info@directheat.ca'
    },
    {
      id: 's121',
      name: 'Dirty Dog Grooming',
      category: 'Pet Services',
      rating: 4.5,
      reviews: 19,
      address: '38129 2nd Ave',
      phone: '(604) 815-1234',
      website: 'https://dirtydoggrooming.ca',
      email: 'info@dirtydoggrooming.ca'
    },
    {
      id: 's122',
      name: 'District of Squamish',
      category: 'Government',
      rating: 3.1,
      reviews: 7,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5217',
      website: 'squamish.ca',
      email: 'info@squamish.ca'
    },
    {
      id: 's124',
      name: 'Downtown Squamish BIA',
      category: 'Community Services',
      rating: 4.2,
      reviews: 2528,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2926',
      website: 'https://downtownsquamish.com',
      email: 'info@downtownsquamish.com'
    },
    {
      id: 's125',
      name: 'Driftwood Dance Academy',
      category: 'Dance & Movement',
      rating: 5,
      reviews: 18,
      address: '38929 Progress Way',
      phone: '(604) 892-8808',
      website: 'https://driftwooddance.ca',
      email: 'info@driftwooddance.ca'
    },
    {
      id: 's126',
      name: 'Dryden Creek Campground',
      category: 'Campgrounds',
      rating: 3,
      reviews: 2,
      address: '201-38142 Cleveland Ave',
      phone: '(604) 815-2887',
      website: 'https://drydencreekcampground.ca',
      email: 'info@drydencreekcampground.ca'
    },
    {
      id: 's127',
      name: 'Duro Construction',
      category: 'Construction & Building',
      rating: 5,
      reviews: 4,
      address: '38926 Queens Way',
      phone: '(604) 898-9011',
      website: '',
      email: ''
    },
    {
      id: 's128',
      name: 'E Mechler & Associates Inc. (CPA)',
      category: 'Accounting & Tax',
      rating: 5,
      reviews: 2,
      address: '38035 Cleveland Avenue',
      phone: '604-892-3554',
      website: 'ema-cpa.ca',
      email: 'admin@ema-cpa.ca'
    },
    {
      id: 's129',
      name: 'Eagleview Veterinary Hospital',
      category: 'Veterinary',
      rating: 4.6,
      reviews: 179,
      address: '38168 2nd Ave',
      phone: '(604) 892-5747',
      website: 'https://eagleviewvet.ca',
      email: 'info@eagleviewvet.ca'
    },
    {
      id: 's130',
      name: 'Edgetech Automotive',
      category: 'Auto Services',
      rating: 5,
      reviews: 56,
      address: '14-38918 Progress Way, Squamish, BC',
      phone: '(604) 892-0100',
      website: 'edgetechautomotive.com',
      email: ''
    },
    {
      id: 's131',
      name: 'Elaho Medical Clinic',
      category: 'Medical Clinics',
      rating: 4.6,
      reviews: 18,
      address: '1337 Pemberton Ave',
      phone: '604-892-5688',
      website: 'elahoclinic.com',
      email: ''
    },
    {
      id: 's132',
      name: 'Elements Casino Squamish',
      category: 'Entertainment',
      rating: 3.6,
      reviews: 247,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-0005',
      website: 'https://elementscasino.com',
      email: 'squamish@elementscasino.com'
    },
    {
      id: 's133',
      name: 'Empire Of Dirt',
      category: 'Retail & Shopping',
      rating: 4.9,
      reviews: 37,
      address: '38020 Cleveland Ave',
      phone: '(604) 815-2857',
      website: 'https://empireofdirt.ca',
      email: 'info@empireofdirt.ca'
    },
    {
      id: 's134',
      name: 'Escape Route',
      category: 'Outdoor Gear & Shops',
      rating: 4.9,
      reviews: 1077,
      address: '40222 Glenalder Pl',
      phone: '(604) 892-3228',
      website: '',
      email: 'squamish@escaperoute.ca'
    },
    {
      id: 's135',
      name: 'Essence of India Restaurant',
      category: 'Restaurants & Dining',
      rating: 4.5,
      reviews: 566,
      address: '40167 Glenalder Pl',
      phone: '(604) 892-3232',
      website: 'https://essenceofindia.ca',
      email: 'info@essenceofindia.ca'
    },
    {
      id: 's136',
      name: 'Executive Suites Hotel',
      category: 'Hotels & Lodging',
      rating: 4.3,
      reviews: 1035,
      address: '40900 Tantalus Rd',
      phone: '(604) 815-0048',
      website: 'https://executivesuitessquamish.com',
      email: 'info@executivesuitessquamish.com'
    },
    {
      id: 's137',
      name: 'Executive Suites Hotel & Resort',
      category: 'Hotels & Lodging',
      rating: 4.3,
      reviews: 1035,
      address: '40900 Tantalus Road, Squamish, BC V8B 0R3',
      phone: '(604) 815-0048',
      website: 'executivesuitessquamish.com',
      email: 'reservations@executivehotels.net'
    },
    {
      id: 's138',
      name: 'Fall Line Fitness (Physio, Chiro, Massage)',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 29,
      address: '3-39359 Queens Way',
      phone: '(604) 898-6572',
      website: 'falllinefitness.ca',
      email: 'info@falllinefitness.ca'
    },
    {
      id: 's140',
      name: 'Fetish for Shoes',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 15,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2858',
      website: 'https://fetishforshoes.ca',
      email: 'info@fetishforshoes.ca'
    },
    {
      id: 's141',
      name: 'FILI Space',
      category: 'Cafes & Bakeries',
      rating: 4.8,
      reviews: 59,
      address: '105-1870 Dowad Dr',
      phone: '(778) 894-0085',
      website: '',
      email: ''
    },
    {
      id: 's142',
      name: 'Float House Squamish',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 79,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3049',
      website: 'https://floathousesquamish.ca',
      email: 'info@floathousesquamish.ca'
    },
    {
      id: 's143',
      name: 'Fly Fishing Squamish',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 55,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-5544',
      website: 'https://flyfishingsquamish.ca',
      email: 'info@flyfishingsquamish.ca'
    },
    {
      id: 's144',
      name: 'Fortune Kitchen',
      category: 'Restaurants & Dining',
      rating: 4.2,
      reviews: 177,
      address: '40167 Glenalder Pl',
      phone: '(604) 892-8988',
      website: 'https://fortunekitchensquamish.ca',
      email: 'info@fortunekitchensquamish.ca'
    },
    {
      id: 's145',
      name: 'Four Elements Esthetics',
      category: 'Salons & Spas',
      rating: 4.7,
      reviews: 20,
      address: '38127 2nd Ave',
      phone: '(604) 892-9000',
      website: 'https://fourelementsesthetics.com',
      email: 'info@fourelementsesthetics.com'
    },
    {
      id: 's146',
      name: 'Fox & Oak',
      category: 'Cafes & Bakeries',
      rating: 4.6,
      reviews: 1054,
      address: '1396 Main St',
      phone: '778-894-0879',
      website: 'foxandoak.ca',
      email: 'hello@foxandoak.ca'
    },
    {
      id: 's147',
      name: 'Free Bird Table & Oyster Bar',
      category: 'Restaurants & Dining',
      rating: 4.2,
      reviews: 229,
      address: '38018 Cleveland Ave',
      phone: '(604) 815-2837',
      website: 'https://freebirdtable.ca',
      email: 'info@freebirdtable.ca'
    },
    {
      id: 's148',
      name: 'Freebird',
      category: 'Restaurants & Dining',
      rating: 4.2,
      reviews: 229,
      address: '40900 Tantalus Rd',
      phone: '(604) 815-2076',
      website: '',
      email: 'hello@thefreebird.ca'
    },
    {
      id: 's149',
      name: 'Fresh Ayre Daycare',
      category: 'Childcare',
      rating: 5,
      reviews: 3,
      address: '1250 Judd Rd, Brackendale, BC V0N 1H0',
      phone: '(778) 668-2396',
      website: 'freshayredaycare.com',
      email: 'info@freshayredaycare.com'
    },
    {
      id: 's150',
      name: 'Fresh Slice Pizza',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 388,
      address: '40236 Glenalder Pl',
      phone: '(604) 892-7799',
      website: 'https://freshslice.com',
      email: 'squamish@freshslice.com'
    },
    {
      id: 's151',
      name: 'Gabriela Le Photography',
      category: 'Photography',
      rating: 5,
      reviews: 49,
      address: '38016 Cleveland Ave',
      phone: '',
      website: 'gabrielalephotography.com',
      email: 'hello@gabrielalephotography.com'
    },
    {
      id: 's152',
      name: 'Garibaldi Dental Clinic',
      category: 'Dental',
      rating: 4.8,
      reviews: 149,
      address: '2590 Portree Way',
      phone: '(604) 892-3231',
      website: 'https://garibaldidental.ca',
      email: 'info@garibaldidental.ca'
    },
    {
      id: 's153',
      name: 'Garibaldi Guiding',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 9,
      address: '2590 Portree Way',
      phone: '(604) 815-2825',
      website: 'https://garibaldiguiding.ca',
      email: 'info@garibaldiguiding.ca'
    },
    {
      id: 's154',
      name: 'Garibaldi Highlands Preschool',
      category: 'Childcare',
      rating: 5,
      reviews: 1,
      address: '2590 Portree Way',
      phone: '(604) 848-8344',
      website: 'sscs.ca',
      email: 'info@garibaldihighlandspreschool.com'
    },
    {
      id: 's155',
      name: 'Garibaldi Plumbing Inc',
      category: 'Plumbing & HVAC',
      rating: 1,
      reviews: 1,
      address: '2590 Portree Way',
      phone: '604-892-3387',
      website: '',
      email: ''
    },
    {
      id: 's156',
      name: 'Garibaldi Veterinary Hospital',
      category: 'Veterinary',
      rating: 4.3,
      reviews: 129,
      address: '2590 Portree Way',
      phone: '(604) 898-9019',
      website: 'https://gvh.ca',
      email: 'info@gvh.ca'
    },
    {
      id: 's157',
      name: 'Gather Books & Lovely Things',
      category: 'Retail & Shopping',
      rating: 5,
      reviews: 46,
      address: '38127 2nd Ave',
      phone: '(778) 862-5404',
      website: '',
      email: 'programs@gatherbookshop.com'
    },
    {
      id: 's158',
      name: 'Gather Bookshop',
      category: 'Retail & Shopping',
      rating: 5,
      reviews: 46,
      address: '38127 2nd Ave',
      phone: '(604) 815-2861',
      website: 'https://gatherbookshop.ca',
      email: 'info@gatherbookshop.ca'
    },
    {
      id: 's159',
      name: 'Genesis West HVAC',
      category: 'Plumbing & HVAC',
      rating: 4.4,
      reviews: 8,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's160',
      name: 'Geo Cider',
      category: 'Breweries & Distilleries',
      rating: 4.5,
      reviews: 271,
      address: '318-1201 Commercial Way',
      phone: '(778) 733-1080',
      website: '',
      email: 'contact@geocider.co'
    },
    {
      id: 's161',
      name: 'Geo Ciders',
      category: 'Breweries & Distilleries',
      rating: 4.5,
      reviews: 271,
      address: '318-1201 Commercial Way',
      phone: '(778) 733-1080',
      website: 'https://geociders.com',
      email: 'info@geociders.com'
    },
    {
      id: 's163',
      name: 'Gondola Store',
      category: 'Outdoor Gear & Shops',
      rating: 4.7,
      reviews: 12122,
      address: '36800 Highway 99 (Sea to Sky Gondola Summit), Squamish, BC V8B 0B6',
      phone: '(604) 815-2876',
      website: 'https://seatoskygondola.com',
      email: 'info@seatoskygondola.com'
    },
    {
      id: 's164',
      name: 'Good2Go Automotive',
      category: 'Auto Services',
      rating: 4.8,
      reviews: 245,
      address: '1488 Pemberton Ave, Squamish, BC V8B 0A9',
      phone: '(604) 898-8331',
      website: 'good2goauto.ca',
      email: 'info@good2goauto.ca'
    },
    {
      id: 's165',
      name: 'Grass Routes Agency',
      category: 'Web & Marketing',
      rating: 2.2,
      reviews: 101,
      address: '39920 Government Road #14, Squamish, BC V8B 0G5',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's166',
      name: 'Grateful Gift Shop',
      category: 'Retail & Shopping',
      rating: 5,
      reviews: 129,
      address: '37830 3rd Ave',
      phone: '(877) 672-1447',
      website: 'gratefulgiftshop.com',
      email: ''
    },
    {
      id: 's167',
      name: 'Green Olive Market & Cafe',
      category: 'Grocery & Markets',
      rating: 4.8,
      reviews: 527,
      address: '38161 Cleveland Ave',
      phone: '(604) 390-0010',
      website: 'https://greenolivemarket.ca',
      email: 'info@greenolivemarket.ca'
    },
    {
      id: 's168',
      name: 'Grinning Weasel Photography',
      category: 'Photography',
      rating: 5,
      reviews: 11,
      address: '210-38026 2nd Avenue, Squamish, BC V8B 0C2',
      phone: '(604) 815-3082',
      website: 'grinningweasel.com',
      email: 'hello@grinningweasel.com'
    },
    {
      id: 's169',
      name: 'Ground Coffee',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 687,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-3011',
      website: 'https://groundcoffee.ca',
      email: 'info@groundcoffee.ca'
    },
    {
      id: 's170',
      name: 'Ground Up Climbing Centre',
      category: 'Fitness & Gyms',
      rating: 4.3,
      reviews: 208,
      address: '38929 Progress Way',
      phone: '(604) 815-9988',
      website: 'https://groundupclimbing.ca',
      email: 'info@groundupclimbing.ca'
    },
    {
      id: 's171',
      name: 'GSK Chartered Professional Accountants LLP',
      category: 'Accounting & Tax',
      rating: 4.2,
      reviews: 13,
      address: 'Suite 402, 37989 Cleveland Ave',
      phone: '(604) 892-9100',
      website: 'gskllp.ca',
      email: 'info@gskllp.ca'
    },
    {
      id: 's172',
      name: 'Gusto Movers',
      category: 'Moving & Storage',
      rating: 5,
      reviews: 101,
      address: '2024 Balsam Way, Squamish, BC V8B 0W1',
      phone: '(778) 970-0263',
      website: 'gustomovers.com',
      email: 'info@gustomovers.com'
    },
    {
      id: 's173',
      name: 'H&R Block',
      category: 'Financial Services',
      rating: 3.3,
      reviews: 27,
      address: '1305 Pemberton Avenue #3, Squamish, BC V8B 0B6',
      phone: '(604) 892-3624',
      website: '',
      email: 'Squamish@hrblock.ca'
    },
    {
      id: 's174',
      name: 'H&R Block Squamish',
      category: 'Accounting & Tax',
      rating: 3.3,
      reviews: 27,
      address: '1305 Pemberton Avenue #3, Squamish, BC V8B 0B6',
      phone: '(604) 892-3624',
      website: 'hrblock.ca',
      email: 'Squamish@hrblock.ca'
    },
    {
      id: 's175',
      name: 'Happimess Art Studio',
      category: 'Arts & Culture',
      rating: 5,
      reviews: 17,
      address: '39455 Discovery Way Unit 106, Squamish, BC V8B 0R5',
      phone: '(604) 837-3890',
      website: '',
      email: 'info@happimess.net'
    },
    {
      id: 's176',
      name: 'Haru Fusion Cuisine',
      category: 'Restaurants & Dining',
      rating: 4.9,
      reviews: 778,
      address: '40022 Government Rd',
      phone: '(604) 567-7774',
      website: '',
      email: ''
    },
    {
      id: 's177',
      name: 'Highlands Medical Clinic',
      category: 'Medical Clinics',
      rating: 3.1,
      reviews: 40,
      address: '40200 Tantalus Rd',
      phone: '(604) 815-2909',
      website: 'https://highlandsmedical.ca',
      email: 'info@highlandsmedical.ca'
    },
    {
      id: 's178',
      name: 'Home Depot Squamish',
      category: 'Retail & Shopping',
      rating: 4,
      reviews: 419,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-1011',
      website: 'https://homedepot.ca',
      email: 'squamish@homedepot.ca'
    },
    {
      id: 's179',
      name: 'Home Hardware',
      category: 'Retail & Shopping',
      rating: 4.3,
      reviews: 53,
      address: '610-1200 Hunter Pl',
      phone: '(604) 892-3711',
      website: '',
      email: ''
    },
    {
      id: 's180',
      name: 'Home Hardware Squamish',
      category: 'Retail & Shopping',
      rating: 4.3,
      reviews: 53,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3551',
      website: 'https://homehardware.ca',
      email: 'squamish@homehardware.ca'
    },
    {
      id: 's181',
      name: 'Hotel Squamish',
      category: 'Hotels & Lodging',
      rating: 3.4,
      reviews: 279,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9584',
      website: '',
      email: ''
    },
    {
      id: 's182',
      name: 'House of Lager',
      category: 'Breweries & Distilleries',
      rating: 4.5,
      reviews: 151,
      address: '37010 Village Crescent, Squamish, BC V8B 0Z7',
      phone: '(604) 567-9148',
      website: '',
      email: 'info@houseoflagerbrewing.com'
    },
    {
      id: 's183',
      name: 'Howe Sound Boat Charters',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 429,
      address: 'Squamish',
      phone: '(604) 815-3039',
      website: 'https://howesoundcharters.ca',
      email: 'info@howesoundcharters.ca'
    },
    {
      id: 's184',
      name: 'Howe Sound Inn',
      category: 'Breweries & Distilleries',
      rating: 4.2,
      reviews: 2528,
      address: '37801 Cleveland Ave',
      phone: '604-892-2603',
      website: 'howesound.com',
      email: 'hsibrew@howesound.com'
    },
    {
      id: 's185',
      name: 'Howe Sound Inn & Brewing',
      category: 'Breweries & Distilleries',
      rating: 4.2,
      reviews: 2528,
      address: '37801 Cleveland Ave',
      phone: '604-892-2603',
      website: 'howesound.com',
      email: 'info@howesound.com'
    },
    {
      id: 's186',
      name: 'Howe Sound Sheet Metal',
      category: 'Plumbing & HVAC',
      rating: 4.4,
      reviews: 7,
      address: '38920 Queens Way',
      phone: '(604) 892-5242',
      website: 'https://howesoundsheetmetal.ca',
      email: 'info@howesoundsheetmetal.ca'
    },
    {
      id: 's187',
      name: 'HUB International Squamish',
      category: 'Insurance',
      rating: 5,
      reviews: 4,
      address: '38027 Cleveland Ave',
      phone: '',
      website: 'hubinternational.com',
      email: 'squamish@hubinternational.com'
    },
    {
      id: 's189',
      name: 'ICBC Squamish',
      category: 'Insurance',
      rating: 2.5,
      reviews: 106,
      address: '38027 Cleveland Ave',
      phone: '(604) 661-2233',
      website: 'https://icbc.com',
      email: 'squamish@icbc.com'
    },
    {
      id: 's190',
      name: 'IGA',
      category: 'Retail & Shopping',
      rating: 4.3,
      reviews: 378,
      address: '1200 Hunter Pl',
      phone: '(604) 815-0088',
      website: '',
      email: ''
    },
    {
      id: 's191',
      name: 'IGA Squamish',
      category: 'Grocery & Markets',
      rating: 4.3,
      reviews: 378,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5255',
      website: 'https://iga.net',
      email: 'squamish@iga.net'
    },
    {
      id: 's192',
      name: 'Infrared Sauna Squamish',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 41,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3050',
      website: 'https://infraredsquamish.ca',
      email: 'info@infraredsquamish.ca'
    },
    {
      id: 's193',
      name: 'Inner Moves Wellness Center',
      category: 'Massage & Bodywork',
      rating: 4.9,
      reviews: 53,
      address: '38129 2nd Ave',
      phone: '(604) 849-0123',
      website: 'https://innermoveswellness.ca',
      email: 'info@innermoveswellness.ca'
    },
    {
      id: 's194',
      name: 'Interlock Metal Roofing (BC) Ltd',
      category: 'Roofing',
      rating: 4.4,
      reviews: 126,
      address: '1005 B Industrial Way',
      phone: '1-866-733-5811',
      website: 'roofbc.com',
      email: ''
    },
    {
      id: 's195',
      name: 'Ironwood Notary Public',
      category: 'Notaries',
      rating: 4.6,
      reviews: 36,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's196',
      name: 'JB Autocare',
      category: 'Auto Services',
      rating: 4.4,
      reviews: 75,
      address: '9-38918 Progress Way, Squamish, BC V8B 0K7',
      phone: '(604) 815-0085',
      website: 'jbautocare.com',
      email: 'brad@distinctauto.ca'
    },
    {
      id: 's197',
      name: 'Jenkins Marzban Logan LLP',
      category: 'Legal Services',
      rating: 3,
      reviews: 31,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's198',
      name: 'Julie Phoenix - Macdonald Realty',
      category: 'Real Estate',
      rating: 5,
      reviews: 41,
      address: '38090 Cleveland Ave',
      phone: '(604) 815-3001',
      website: 'https://juliephoenix.com',
      email: 'julie@juliephoenix.com'
    },
    {
      id: 's199',
      name: 'Julie Phoenix (Stilhavn)',
      category: 'Real Estate',
      rating: 5,
      reviews: 41,
      address: 'Squamish',
      phone: '604-849-4990',
      website: 'juliephoenix.com',
      email: ''
    },
    {
      id: 's200',
      name: 'Kal Tire',
      category: 'Auto Services',
      rating: 4.3,
      reviews: 182,
      address: '38925 Production Way',
      phone: '(604) 892-1070',
      website: '',
      email: '[email protected]'
    },
    {
      id: 's201',
      name: 'Kal Tire Squamish',
      category: 'Auto Services',
      rating: 4.3,
      reviews: 182,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-1070',
      website: 'https://kaltire.com',
      email: 'squamish@kaltire.com'
    },
    {
      id: 's202',
      name: 'Karen Cooper Gallery',
      category: 'Arts & Culture',
      rating: 4.6,
      reviews: 30,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's203',
      name: 'Katie McLachlan Real Estate',
      category: 'Real Estate',
      rating: 5,
      reviews: 30,
      address: 'Squamish',
      phone: '(604) 213-0833',
      website: 'katiemclachlan.com',
      email: 'katie@myseatosky.com'
    },
    {
      id: 's204',
      name: 'Keystone Carpentry',
      category: 'Home Improvement',
      rating: 5,
      reviews: 3,
      address: 'Squamish (mobile service)',
      phone: '(438) 884-5042',
      website: '',
      email: ''
    },
    {
      id: 's205',
      name: 'Kiddie Cloud Montessori',
      category: 'Childcare',
      rating: 5,
      reviews: 2,
      address: '38320 Westway Ave',
      phone: '(604) 390-0729',
      website: 'kiddiecloudmontessoripreschool.com',
      email: 'info@kiddiecloudmontessori.com'
    },
    {
      id: 's206',
      name: 'Klahanie Campground',
      category: 'Campgrounds',
      rating: 3.7,
      reviews: 630,
      address: '201-38142 Cleveland Ave',
      phone: '(604) 815-2883',
      website: 'https://klahaniecampground.com',
      email: 'info@klahaniecampground.com'
    },
    {
      id: 's207',
      name: 'Kootenay Deluxe Construction',
      category: 'Home Improvement',
      rating: 5,
      reviews: 62,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's208',
      name: 'Kululu Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 319,
      address: '38086 Cleveland Ave',
      phone: '(604) 815-4455',
      website: 'https://kululucafe.ca',
      email: 'info@kululucafe.ca'
    },
    {
      id: 's209',
      name: 'Kululu Japanese Food',
      category: 'Food Trucks',
      rating: 4.9,
      reviews: 319,
      address: 'Squamish',
      phone: '(604) 815-2850',
      website: 'https://kululufood.ca',
      email: 'info@kululufood.ca'
    },
    {
      id: 's210',
      name: 'Kybe Electric',
      category: 'Electrical',
      rating: 4.6,
      reviews: 41,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's211',
      name: 'La Toile',
      category: 'Web & Marketing',
      rating: 5,
      reviews: 1,
      address: '1565 Depot Road, Squamish, BC V0N 1H0',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's212',
      name: 'Law Offices of Douglas B. Chiasson',
      category: 'Legal Services',
      rating: 3.4,
      reviews: 17,
      address: '3-38003 2nd Ave',
      phone: '(604) 892-2211',
      website: 'dbchiasson.com',
      email: 'info@dbchiasson.com'
    },
    {
      id: 's213',
      name: 'Legacy Custom Floors',
      category: 'Flooring',
      rating: 4.7,
      reviews: 27,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's214',
      name: 'Lifemark Physiotherapy Squamish',
      category: 'Physiotherapy & Rehab',
      rating: 5,
      reviews: 99,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5200',
      website: 'https://lifemark.ca',
      email: 'squamish@lifemark.ca'
    },
    {
      id: 's215',
      name: 'Lil Chef Bistro',
      category: 'Restaurants & Dining',
      rating: 4.5,
      reviews: 673,
      address: '40365 Tantalus Rd',
      phone: '(604) 390-2433',
      website: '',
      email: ''
    },
    {
      id: 's216',
      name: 'Lindsay McGhee Designs',
      category: 'Creative Services',
      rating: 5,
      reviews: 2,
      address: 'Squamish (home office)',
      phone: '',
      website: 'lindsaymcghee.com',
      email: 'hello@lindsaymcghee.com'
    },
    {
      id: 's217',
      name: 'Little Peak Daycare',
      category: 'Childcare',
      rating: 5,
      reviews: 2,
      address: '1534 Depot Rd, Brackendale',
      phone: '(647) 302-0457',
      website: 'littlepeaksquamish.com',
      email: 'maddy@littlepeaksquamish.com'
    },
    {
      id: 's218',
      name: 'LivWell Integrated Health',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 23,
      address: '38155 2nd Ave',
      phone: '(604) 815-2809',
      website: 'https://livwellsquamish.com',
      email: 'info@livwellsquamish.com'
    },
    {
      id: 's219',
      name: 'Locavore Bar & Grill',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 711,
      address: '1861 Mamquam Rd',
      phone: '(604) 815-2832',
      website: 'https://locavorebarandgrill.com',
      email: 'info@locavorebarandgrill.com'
    },
    {
      id: 's220',
      name: 'London Drugs',
      category: 'Retail & Shopping',
      rating: 4,
      reviews: 200,
      address: '40282 Glenalder Pl',
      phone: '(604) 898-8270',
      website: '',
      email: ''
    },
    {
      id: 's221',
      name: 'London Drugs Squamish',
      category: 'Retail & Shopping',
      rating: 4,
      reviews: 200,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5171',
      website: 'https://londondrugs.com',
      email: 'squamish@londondrugs.com'
    },
    {
      id: 's222',
      name: 'Lorenz Developments',
      category: 'Construction & Building',
      rating: 4.4,
      reviews: 13,
      address: '1B-38927 Queens Way',
      phone: '(778) 378-7652',
      website: '',
      email: 'jason@lorenzdevelopments.com'
    },
    {
      id: 's223',
      name: 'Lucas Teas',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 58,
      address: '38020 Cleveland Ave',
      phone: '(604) 390-0055',
      website: 'https://lucasteas.ca',
      email: 'info@lucasteas.ca'
    },
    {
      id: 's224',
      name: 'Lululemon Squamish',
      category: 'Retail & Shopping',
      rating: 4.5,
      reviews: 158,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-0020',
      website: 'https://lululemon.com',
      email: 'squamish@lululemon.com'
    },
    {
      id: 's225',
      name: 'Luz Tacos',
      category: 'Food Trucks',
      rating: 4.3,
      reviews: 445,
      address: 'A-Frame Brewing',
      phone: '(604) 815-2852',
      website: 'https://luztacos.ca',
      email: 'info@luztacos.ca'
    },
    {
      id: 's226',
      name: 'Macdonald Realty (Scott McQuade)',
      category: 'Real Estate',
      rating: 5,
      reviews: 6,
      address: '38090 Cleveland Ave',
      phone: '604-815-1985',
      website: 'squamish.com',
      email: ''
    },
    {
      id: 's227',
      name: 'Macdonald Realty Squamish',
      category: 'Real Estate',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5592',
      website: 'https://macdonaldrealty.com',
      email: 'squamish@macdonaldrealty.com'
    },
    {
      id: 's229',
      name: 'Mags99 Fried Chicken & Mexican Cantina',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 2079,
      address: '38146 Behrner Dr',
      phone: '604-657-6247',
      website: 'magssquamish.com',
      email: ''
    },
    {
      id: 's230',
      name: 'Manpuku Sushi',
      category: 'Restaurants & Dining',
      rating: 4.8,
      reviews: 222,
      address: '38105 2nd Ave',
      phone: '(604) 567-7874',
      website: '',
      email: ''
    },
    {
      id: 's231',
      name: 'Marks Work Wearhouse',
      category: 'Retail & Shopping',
      rating: 3.9,
      reviews: 167,
      address: '40200 Tantalus Rd',
      phone: '(604) 892-4411',
      website: 'https://marks.com',
      email: 'squamish@marks.com'
    },
    {
      id: 's232',
      name: 'Marwick Marketing',
      category: 'Web & Marketing',
      rating: 4.9,
      reviews: 56,
      address: '38146 Behrner Dr',
      phone: '(604) 390-0065',
      website: '',
      email: ''
    },
    {
      id: 's233',
      name: 'Match Eatery & Public House',
      category: 'Restaurants & Dining',
      rating: 3.9,
      reviews: 435,
      address: '9000 Valley Dr',
      phone: '(604) 892-2946',
      website: '',
      email: 'matchpub.squamish@gatewaycasinos.ca'
    },
    {
      id: 's234',
      name: 'Match Eatery Squamish',
      category: 'Restaurants & Dining',
      rating: 3.9,
      reviews: 435,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2972',
      website: 'https://matcheatery.ca',
      email: 'squamish@matcheatery.ca'
    },
    {
      id: 's236',
      name: 'MEC (Mountain Equipment Company)',
      category: 'Outdoor Gear & Shops',
      rating: 4.1,
      reviews: 2364,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's237',
      name: 'MEC Squamish',
      category: 'Outdoor Gear & Shops',
      rating: 5,
      reviews: 117,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-0122',
      website: 'https://mec.ca',
      email: 'squamish@mec.ca'
    },
    {
      id: 's238',
      name: 'Mechyannick Automotive Clinic',
      category: 'Auto Services',
      rating: 4.8,
      reviews: 273,
      address: '2016 Paco Rd, Squamish, BC V8B 0J6',
      phone: '(604) 892-5222',
      website: 'mechyannick.ca',
      email: 'mechyannick@gmail.com'
    },
    {
      id: 's239',
      name: 'Mile One Eating House',
      category: 'Restaurants & Dining',
      rating: 4.5,
      reviews: 1348,
      address: '38146 Behrner Dr',
      phone: '(604) 815-2846',
      website: 'https://mileoneeatinghouse.com',
      email: 'info@mileoneeatinghouse.com'
    },
    {
      id: 's240',
      name: 'Mocaccino Coffee',
      category: 'Cafes & Bakeries',
      rating: 4.8,
      reviews: 195,
      address: '38018 Cleveland Ave',
      phone: '(604) 815-3010',
      website: 'https://mocaccinocoffee.ca',
      email: 'info@mocaccinocoffee.ca'
    },
    {
      id: 's241',
      name: 'Modern Concept Contracting',
      category: 'Construction & Building',
      rating: 5,
      reviews: 7,
      address: '38146 Behrner Dr',
      phone: '(604) 902-0956',
      website: 'modernconceptcontracting.com',
      email: ''
    },
    {
      id: 's242',
      name: 'Mountain Deck & Railing',
      category: 'Home Improvement',
      rating: 5,
      reviews: 1,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-3022',
      website: 'https://mountaindeck.ca',
      email: 'info@mountaindeck.ca'
    },
    {
      id: 's243',
      name: 'Mountain Dog Daycare',
      category: 'Pet Services',
      rating: 5,
      reviews: 6,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2941',
      website: 'https://mountaindogdaycare.ca',
      email: 'info@mountaindogdaycare.ca'
    },
    {
      id: 's244',
      name: 'Mountain Fitness Center',
      category: 'Fitness & Gyms',
      rating: 4.5,
      reviews: 191,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 567-8008',
      website: 'mountainfitnesscenter.ca',
      email: 'info@mountainfitness.ca'
    },
    {
      id: 's245',
      name: 'Mountain FM',
      category: 'Media',
      rating: 3.8,
      reviews: 4,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 892-6060',
      website: 'https://mountainfm.com',
      email: 'info@mountainfm.com'
    },
    {
      id: 's246',
      name: 'Mountain Grind Coffee',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 33,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2974',
      website: 'https://mountaingrindcoffee.ca',
      email: 'info@mountaingrindcoffee.ca'
    },
    {
      id: 's247',
      name: 'Mountain Law Corporation',
      category: 'Legal Services',
      rating: 5,
      reviews: 7,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's248',
      name: 'Mountain Lens Media',
      category: 'Creative Services',
      rating: 5,
      reviews: 9,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2969',
      website: 'https://mountainlensmedia.ca',
      email: 'info@mountainlensmedia.ca'
    },
    {
      id: 's249',
      name: 'Mountain Meals',
      category: 'Catering',
      rating: 3.9,
      reviews: 243,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-3052',
      website: 'https://mountainmeals.ca',
      email: 'info@mountainmeals.ca'
    },
    {
      id: 's250',
      name: 'Mountain Retreat Hotel',
      category: 'Hotels & Lodging',
      rating: 3.6,
      reviews: 518,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-0883',
      website: '',
      email: ''
    },
    {
      id: 's251',
      name: 'Mountain Retreat Lodge',
      category: 'Hotels & Lodging',
      rating: 3.6,
      reviews: 518,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-6543',
      website: 'https://mountainretreat.ca',
      email: 'info@mountainretreat.ca'
    },
    {
      id: 's252',
      name: 'Mountain Shoe Repair',
      category: 'Repair Services',
      rating: 4.8,
      reviews: 98,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-3041',
      website: 'https://mountainshoerepair.ca',
      email: 'info@mountainshoerepair.ca'
    },
    {
      id: 's253',
      name: 'Mountain Skills Academy',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 17,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2820',
      website: 'https://mountainskillsacademy.com',
      email: 'info@mountainskillsacademy.com'
    },
    {
      id: 's254',
      name: 'Mountain Skills Academy & Adventures',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 17,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 938-9242',
      website: 'mountainskillsacademy.com',
      email: 'info@mountainskillsacademy.com'
    },
    {
      id: 's255',
      name: 'Mountain Spa Squamish',
      category: 'Salons & Spas',
      rating: 4.9,
      reviews: 30,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3047',
      website: 'https://mountainspasquamish.ca',
      email: 'info@mountainspasquamish.ca'
    },
    {
      id: 's256',
      name: 'Mountain Spirit Healing',
      category: 'Health & Wellness',
      rating: 4.9,
      reviews: 30,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2963',
      website: 'https://mountainspirithealing.ca',
      email: 'info@mountainspirithealing.ca'
    },
    {
      id: 's257',
      name: 'Mountain Tax Services',
      category: 'Accounting & Tax',
      rating: 5,
      reviews: 2,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-3015',
      website: 'https://mountaintax.ca',
      email: 'info@mountaintax.ca'
    },
    {
      id: 's258',
      name: 'Mountain Transmission',
      category: 'Auto Services',
      rating: 4.5,
      reviews: 89,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-3035',
      website: 'https://mountaintransmission.ca',
      email: 'info@mountaintransmission.ca'
    },
    {
      id: 's259',
      name: 'Mountain View Construction',
      category: 'Construction & Building',
      rating: 5,
      reviews: 27,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2900',
      website: 'https://mountainviewconstruction.ca',
      email: 'info@mountainviewconstruction.ca'
    },
    {
      id: 's260',
      name: 'Mountain View Nails & Spa',
      category: 'Salons & Spas',
      rating: 3.6,
      reviews: 82,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-0088',
      website: 'https://mountainviewnails.ca',
      email: 'info@mountainviewnails.ca'
    },
    {
      id: 's261',
      name: 'Mountain View Painting',
      category: 'Home Improvement',
      rating: 4.8,
      reviews: 18,
      address: '38146 Behrner Dr',
      phone: '(604) 815-2233',
      website: 'https://mountainviewpainting.ca',
      email: 'info@mountainviewpainting.ca'
    },
    {
      id: 's262',
      name: 'Mr. Tooth Dental House',
      category: 'Dental',
      rating: 4.9,
      reviews: 37,
      address: '103-40775 Tantalus Rd',
      phone: '(604) 898-4318',
      website: 'mrtoothdental.com',
      email: 'info@mrtoothdental.com'
    },
    {
      id: 's263',
      name: 'Narwhals Ice Cream',
      category: 'Ice Cream & Desserts',
      rating: 4.7,
      reviews: 143,
      address: '38220 Highway 99',
      phone: '(604) 390-0123',
      website: 'https://narwhalsicecream.ca',
      email: 'info@narwhalsicecream.ca'
    },
    {
      id: 's264',
      name: 'Natalie Yu Acupuncture',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 4,
      address: 'Squamish',
      phone: '(604) 815-2811',
      website: 'https://natalieyuacupuncture.ca',
      email: 'info@natalieyuacupuncture.ca'
    },
    {
      id: 's266',
      name: 'Nelcan Electric LTD',
      category: 'Electrical',
      rating: 4.9,
      reviews: 133,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's267',
      name: 'Nesters Coffee Bar',
      category: 'Cafes & Bakeries',
      rating: 3.9,
      reviews: 512,
      address: '40188 Glenalder Pl',
      phone: '(604) 815-3013',
      website: 'https://nestersmarket.com',
      email: 'squamish@nestersmarket.com'
    },
    {
      id: 's268',
      name: 'Nesters Market',
      category: 'Retail & Shopping',
      rating: 4.3,
      reviews: 378,
      address: '1200 Hunter Pl',
      phone: '(604) 815-0733',
      website: '',
      email: ''
    },
    {
      id: 's269',
      name: 'Nesters Market Squamish',
      category: 'Grocery & Markets',
      rating: 4.3,
      reviews: 378,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5255',
      website: 'https://nestersmarket.com',
      email: 'squamish@nestersmarket.com'
    },
    {
      id: 's270',
      name: 'New Era Plumbing & Heating Ltd',
      category: 'Plumbing & HVAC',
      rating: 5,
      reviews: 4,
      address: '38146 Behrner Dr',
      phone: '(604) 815-7792',
      website: 'neweraplumbing.com',
      email: 'info@neweraplumbing.com'
    },
    {
      id: 's271',
      name: 'Newport Auto',
      category: 'Auto Services',
      rating: 4.4,
      reviews: 117,
      address: '5-38927 Queens Way, Squamish, BC V8B 0K9',
      phone: '(604) 892-5100',
      website: 'newportauto.ca',
      email: 'newportautoinc@mechanicnet.com'
    },
    {
      id: 's272',
      name: 'NexGen Hearing',
      category: 'Health & Wellness',
      rating: 4.5,
      reviews: 21,
      address: '1335 Pemberton Ave',
      phone: '(604) 815-0808',
      website: '',
      email: 'squamish@nexgenhearing.com'
    },
    {
      id: 's273',
      name: 'Nolan Rivers - RE/MAX Sea to Sky',
      category: 'Real Estate',
      rating: 4.2,
      reviews: 6,
      address: '38024 Fourth Ave',
      phone: '(778) 229-7487',
      website: 'https://nolanrivers.ca',
      email: 'nolan@myseatosky.com'
    },
    {
      id: 's274',
      name: 'Nootka and Sea',
      category: 'Retail & Shopping',
      rating: 4.5,
      reviews: 45,
      address: '38024 Fourth Ave',
      phone: '(604) 849-2517',
      website: '',
      email: ''
    },
    {
      id: 's276',
      name: 'Norman Ruiz',
      category: 'Restaurants & Dining',
      rating: 5,
      reviews: 98,
      address: 'Squamish',
      phone: '(604) 815-7978',
      website: '',
      email: 'info@normanrudys.ca'
    },
    {
      id: 's277',
      name: 'North Arm Farm',
      category: 'Farms & Markets',
      rating: 4.6,
      reviews: 398,
      address: '1888 Sea to Sky Hwy',
      phone: '(604) 898-9328',
      website: 'https://northarmfarm.com',
      email: 'info@northarmfarm.com'
    },
    {
      id: 's278',
      name: 'Noshy Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.6,
      reviews: 75,
      address: '1307 Pemberton Ave',
      phone: '(604) 390-1739',
      website: '',
      email: 'noshysquamish@gmail.com'
    },
    {
      id: 's279',
      name: 'NotaryPro Squamish',
      category: 'Notaries',
      rating: 4.6,
      reviews: 22,
      address: '38027 Cleveland Ave',
      phone: '1-888-313-0909',
      website: 'notarypro.ca',
      email: ''
    },
    {
      id: 's280',
      name: 'Nourish Kitchen',
      category: 'Restaurants & Dining',
      rating: 4.6,
      reviews: 1325,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2842',
      website: 'https://nourishkitchensquamish.ca',
      email: 'info@nourishkitchensquamish.ca'
    },
    {
      id: 's281',
      name: 'Oakwyn Realty',
      category: 'Real Estate',
      rating: 3.5,
      reviews: 64,
      address: 'Squamish',
      phone: '(604) 620-6788',
      website: '',
      email: ''
    },
    {
      id: 's282',
      name: 'Oceanside Collision',
      category: 'Auto Services',
      rating: 4.5,
      reviews: 162,
      address: '38924 Queens Way',
      phone: '(604) 892-5588',
      website: 'https://oceansidecollision.ca',
      email: 'info@oceansidecollision.ca'
    },
    {
      id: 's283',
      name: 'OK Tire',
      category: 'Auto Services',
      rating: 4.7,
      reviews: 180,
      address: '101-39002 Discovery Way, Squamish, BC V8B 0E5',
      phone: '(604) 892-9558',
      website: '',
      email: 'squamish@oktire.com'
    },
    {
      id: 's284',
      name: 'OK Tire Squamish',
      category: 'Auto Services',
      rating: 4.7,
      reviews: 180,
      address: '101-39002 Discovery Way, Squamish, BC V8B 0E5',
      phone: '(604) 892-9558',
      website: 'https://oktire.com',
      email: 'squamish@oktire.com'
    },
    {
      id: 's285',
      name: 'Optomeyes Squamish',
      category: 'Optometry & Vision',
      rating: 4.9,
      reviews: 861,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5055',
      website: 'https://optomeyessquamish.ca',
      email: 'squamish@optomeyes.ca'
    },
    {
      id: 's286',
      name: 'OurSquamish',
      category: 'Community Services',
      rating: 4.5,
      reviews: 737,
      address: '38027 Cleveland Ave',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's287',
      name: 'Outbound Station',
      category: 'Cafes & Bakeries',
      rating: 4.3,
      reviews: 547,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's288',
      name: 'Oxygen Yoga & Fitness',
      category: 'Fitness & Gyms',
      rating: 4.8,
      reviews: 54,
      address: '38338 Buckley Ave',
      phone: '(604) 338-9293',
      website: 'oxygenyogaandfitness.com',
      email: 'squamish@oxygenyogafitness.com'
    },
    {
      id: 's289',
      name: 'Oxygen Yoga & Fitness Squamish',
      category: 'Yoga & Pilates',
      rating: 4.8,
      reviews: 54,
      address: '38027 Cleveland Ave',
      phone: '(604) 338-9293',
      website: 'https://oxygenyogaandfitness.com/squamish',
      email: 'squamish@oxygenyogaandfitness.com'
    },
    {
      id: 's290',
      name: 'Paradise Valley Campground',
      category: 'Campgrounds',
      rating: 4.4,
      reviews: 334,
      address: '201-38142 Cleveland Ave',
      phone: '(604) 815-2886',
      website: 'https://paradisevalley.ca',
      email: 'info@paradisevalley.ca'
    },
    {
      id: 's291',
      name: 'Paragon Kids Inc.',
      category: 'Childcare',
      rating: 5,
      reviews: 2,
      address: '38398 Hemlock Ave',
      phone: '(604) 329-8258',
      website: 'paragonkidschildcare.com',
      email: 'brackendale@paragonkidschildcare.com'
    },
    {
      id: 's292',
      name: 'Park & Associates Notaries Public',
      category: 'Notaries',
      rating: 4.9,
      reviews: 71,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's293',
      name: 'Patagonia Squamish',
      category: 'Retail & Shopping',
      rating: 4.5,
      reviews: 250,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-5000',
      website: 'https://patagonia.ca',
      email: 'squamish@patagonia.ca'
    },
    {
      id: 's294',
      name: 'Paula Owen Photography',
      category: 'Photography',
      rating: 5,
      reviews: 14,
      address: '40612 Highlands Way North, Squamish, BC V0N 1T0',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's295',
      name: 'Peak & Pour',
      category: 'Cafes & Bakeries',
      rating: 5,
      reviews: 43,
      address: '37801 Cleveland Ave (Sea to Sky Gondola Base)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's296',
      name: 'Peak Experience Counselling',
      category: 'Mental Health',
      rating: 5,
      reviews: 6,
      address: '38155 2nd Ave #200',
      phone: '(604) 815-8000',
      website: 'https://peakexperiencecounselling.com',
      email: 'info@peakexperiencecounselling.com'
    },
    {
      id: 's297',
      name: 'Peak Integrated Health',
      category: 'Physiotherapy & Rehab',
      rating: 5,
      reviews: 111,
      address: '1201 Commercial Way',
      phone: '(604) 390-3555',
      website: 'https://peakintegratedhealth.com',
      email: 'info@peakintegratedhealth.com'
    },
    {
      id: 's298',
      name: 'Peak Provisions Grocery',
      category: 'Grocery & Markets',
      rating: 4.5,
      reviews: 127,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2865',
      website: 'https://peakprovisions.ca',
      email: 'info@peakprovisions.ca'
    },
    {
      id: 's299',
      name: 'Peak Provisions Mountain Grocery & Goods',
      category: 'Retail & Shopping',
      rating: 4.5,
      reviews: 127,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(778) 266-2176',
      website: '',
      email: 'info@peakprovisionsgrocer.com'
    },
    {
      id: 's301',
      name: 'Penfolds Roofing & Solar',
      category: 'Roofing',
      rating: 4.2,
      reviews: 99,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's302',
      name: 'Physiofocus Squamish',
      category: 'Physiotherapy & Rehab',
      rating: 5,
      reviews: 50,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3000',
      website: 'https://physiofocus.ca',
      email: 'squamish@physiofocus.ca'
    },
    {
      id: 's303',
      name: 'Pipeline Plumbing & Heating',
      category: 'Plumbing & HVAC',
      rating: 4.6,
      reviews: 78,
      address: '38146 Behrner Dr',
      phone: '(604) 892-3010',
      website: '',
      email: 'chris@pipelinebc.ca'
    },
    {
      id: 's304',
      name: 'Pizza Factory',
      category: 'Restaurants & Dining',
      rating: 4.8,
      reviews: 527,
      address: '38161 Cleveland Ave',
      phone: '(604) 892-5566',
      website: 'https://pizzafactorysquamish.ca',
      email: 'info@pizzafactorysquamish.ca'
    },
    {
      id: 's305',
      name: 'Porteau Cove Provincial Park',
      category: 'Attractions',
      rating: 4.8,
      reviews: 1161,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's306',
      name: 'Precision Optical',
      category: 'Optometry & Vision',
      rating: 5,
      reviews: 2,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2863',
      website: 'https://precisionoptical.ca',
      email: 'info@precisionoptical.ca'
    },
    {
      id: 's307',
      name: 'Precision Optical Squamish',
      category: 'Optometry & Vision',
      rating: 5,
      reviews: 41,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9004',
      website: 'https://precisionoptical.ca',
      email: 'info@precisionoptical.ca'
    },
    {
      id: 's308',
      name: 'Purebread',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 288,
      address: '40147 Glenalder Pl #105',
      phone: '(604) 390-0071',
      website: '',
      email: 'hello@purebread.ca'
    },
    {
      id: 's309',
      name: 'Quest University Canada',
      category: 'Education',
      rating: 4.7,
      reviews: 55,
      address: '3200 University Boulevard, Squamish, BC V8B 0N8',
      phone: '(604) 898-8000',
      website: 'questu.ca',
      email: 'admissions@questu.ca'
    },
    {
      id: 's310',
      name: 'Quick Lane Squamish',
      category: 'Auto Services',
      rating: 4.1,
      reviews: 169,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3673',
      website: 'https://quicklane.com',
      email: 'squamish@quicklane.com'
    },
    {
      id: 's311',
      name: 'Race & Company LLP Lawyers',
      category: 'Legal Services',
      rating: 3.3,
      reviews: 19,
      address: '301-37989 Cleveland Ave',
      phone: '(604) 892-5254',
      website: '',
      email: 'info@raceandco.com'
    },
    {
      id: 's312',
      name: 'Railway Museum of BC',
      category: 'Attractions',
      rating: 4.4,
      reviews: 1059,
      address: '1005 B Industrial Way',
      phone: '(604) 898-9336',
      website: 'https://wcra.org',
      email: 'info@wcra.org'
    },
    {
      id: 's313',
      name: 'Railway Museum of British Columbia',
      category: 'Attractions',
      rating: 4.4,
      reviews: 1059,
      address: '39645 Government Road, Squamish, BC V8B 0B6',
      phone: '(604) 898-9336',
      website: '',
      email: 'info@wcra.org'
    },
    {
      id: 's314',
      name: 'Rain City Homes Ltd',
      category: 'Home Improvement',
      rating: 4.9,
      reviews: 28,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's315',
      name: 'Raincity Distillery',
      category: 'Breweries & Distilleries',
      rating: 4.9,
      reviews: 317,
      address: '38167 Cleveland Ave',
      phone: '(604) 815-2830',
      website: 'https://raincitydistillery.com',
      email: 'info@raincitydistillery.com'
    },
    {
      id: 's316',
      name: 'Random &',
      category: 'Retail & Shopping',
      rating: 4.2,
      reviews: 92,
      address: '38071 Cleveland Ave',
      phone: '(604) 390-2440',
      website: '',
      email: ''
    },
    {
      id: 's317',
      name: 'Random & Co Consignment',
      category: 'Retail & Shopping',
      rating: 4.2,
      reviews: 92,
      address: '38145 Cleveland Ave',
      phone: '(604) 390-2440',
      website: 'https://randomandco.ca',
      email: 'info@randomandco.ca'
    },
    {
      id: 's318',
      name: 'RBC Royal Bank',
      category: 'Financial Services',
      rating: 2.7,
      reviews: 41,
      address: '1005 B Industrial Way',
      phone: '(604) 892-3555',
      website: '',
      email: ''
    },
    {
      id: 's319',
      name: 'RBC Royal Bank Squamish',
      category: 'Financial Services',
      rating: 2.7,
      reviews: 41,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3555',
      website: 'https://rbc.com',
      email: 'squamish@rbc.com'
    },
    {
      id: 's320',
      name: 'RDC Fine Homes',
      category: 'Construction & Building',
      rating: 4.8,
      reviews: 34,
      address: 'Squamish',
      phone: '(604) 932-3618',
      website: 'rdcfinehomes.com',
      email: ''
    },
    {
      id: 's321',
      name: 'RE/MAX Sea to Sky Real Estate',
      category: 'Real Estate',
      rating: 4.2,
      reviews: 6,
      address: '38024 Fourth Ave',
      phone: '604-892-3571',
      website: 'myseatosky.com',
      email: ''
    },
    {
      id: 's322',
      name: 'RideHub',
      category: 'Outdoor Gear & Shops',
      rating: 4.9,
      reviews: 332,
      address: '40330 Tantalus Rd',
      phone: '(778) 400-6333',
      website: '',
      email: 'info@ridehub.ca'
    },
    {
      id: 's323',
      name: 'RideHub Bike Shop & Cafe',
      category: 'Outdoor Gear & Shops',
      rating: 4.9,
      reviews: 332,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-4494',
      website: 'https://ridehubsquamish.com',
      email: 'info@ridehubsquamish.com'
    },
    {
      id: 's324',
      name: 'RideHub Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 16,
      address: '40330 Tantalus Rd',
      phone: '(778) 400-6333',
      website: '',
      email: 'info@ridehubsquamish.com'
    },
    {
      id: 's325',
      name: 'Rise & Grind Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 145,
      address: '38129 2nd Ave',
      phone: '(604) 815-3012',
      website: 'https://riseandgrind.ca',
      email: 'info@riseandgrind.ca'
    },
    {
      id: 's326',
      name: 'Sacred Heart Catholic Church',
      category: 'Churches & Religious',
      rating: 4.7,
      reviews: 29,
      address: '38036 2nd Ave',
      phone: '(604) 892-5070',
      website: 'https://sacredheartsquamish.ca',
      email: 'info@sacredheartsquamish.ca'
    },
    {
      id: 's327',
      name: 'Saha Eatery',
      category: 'Restaurants & Dining',
      rating: 4.5,
      reviews: 956,
      address: '38128 2 Ave',
      phone: '604-567-5888',
      website: 'sahaeatery.ca',
      email: 'sahaeatery@gmail.com'
    },
    {
      id: 's329',
      name: 'Salted Vine Kitchen + Bar',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 424,
      address: '38018 Cleveland Ave',
      phone: '(604) 815-2838',
      website: 'https://saltedvine.com',
      email: 'info@saltedvine.com'
    },
    {
      id: 's330',
      name: 'Sandman Hotel & Suites',
      category: 'Hotels & Lodging',
      rating: 4.3,
      reviews: 1108,
      address: '39400 Discovery Way, Squamish, BC V8B 0R5',
      phone: '(604) 848-6000',
      website: 'sandmanhotels.com/squamish',
      email: 'gm_squamish@sandman.ca'
    },
    {
      id: 's331',
      name: 'Sandman Hotel Squamish',
      category: 'Hotels & Lodging',
      rating: 4.3,
      reviews: 1108,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9584',
      website: 'https://sandmanhotels.com',
      email: 'squamish@sandmanhotels.com'
    },
    {
      id: 's332',
      name: 'Save-On-Foods',
      category: 'Retail & Shopping',
      rating: 4.1,
      reviews: 461,
      address: '1301 Pemberton Ave',
      phone: '(604) 892-5976',
      website: '',
      email: ''
    },
    {
      id: 's333',
      name: 'Save-On-Foods Squamish',
      category: 'Grocery & Markets',
      rating: 4.1,
      reviews: 461,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5911',
      website: 'https://saveonfoods.com',
      email: 'squamish@saveonfoods.com'
    },
    {
      id: 's334',
      name: 'Scandinavian Style',
      category: 'Retail & Shopping',
      rating: 4.2,
      reviews: 31,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-4455',
      website: 'https://scandinaviastyle.ca',
      email: 'info@scandinaviastyle.ca'
    },
    {
      id: 's335',
      name: 'Scott McQuade - SQUAMISH.com',
      category: 'Real Estate',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3002',
      website: 'https://squamish.com',
      email: 'scott@squamish.com'
    },
    {
      id: 's336',
      name: 'Sea to Sky Accounting',
      category: 'Accounting & Tax',
      rating: 4.3,
      reviews: 6,
      address: '38146 Behrner Dr',
      phone: '(604) 815-2892',
      website: 'https://seatoskyaccounting.ca',
      email: 'info@seatoskyaccounting.ca'
    },
    {
      id: 's337',
      name: 'Sea to Sky Acupuncture',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 65,
      address: '38024 Fourth Ave',
      phone: '(604) 815-0099',
      website: 'https://seatoskyacupuncture.ca',
      email: 'info@seatoskyacupuncture.ca'
    },
    {
      id: 's338',
      name: 'Sea to Sky Adventure Company',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 363,
      address: '38024 Fourth Ave',
      phone: '(604) 567-2453',
      website: 'seatoskyadventurecompany.com',
      email: 'info@seatoskyadventure.com'
    },
    {
      id: 's339',
      name: 'Sea to Sky Aggregates',
      category: 'Construction & Building',
      rating: 5,
      reviews: 7,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3046',
      website: 'https://seatoskyaggregates.ca',
      email: 'info@seatoskyaggregates.ca'
    },
    {
      id: 's340',
      name: 'Sea To Sky Air',
      category: 'Outdoor Adventures',
      rating: 5,
      reviews: 363,
      address: '38024 Fourth Ave',
      phone: '(604) 898-1975',
      website: '',
      email: 'fly@seatoskyair.ca'
    },
    {
      id: 's341',
      name: 'Sea to Sky Catering',
      category: 'Catering',
      rating: 5,
      reviews: 86,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3053',
      website: 'https://seatoskycatering.ca',
      email: 'info@seatoskycatering.ca'
    },
    {
      id: 's342',
      name: 'Sea to Sky Child Development Centre',
      category: 'Childcare',
      rating: 4.6,
      reviews: 40,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2912',
      website: 'https://seatoskycdc.ca',
      email: 'info@seatoskycdc.ca'
    },
    {
      id: 's343',
      name: 'Sea to Sky Community Health',
      category: 'Medical Clinics',
      rating: 4.6,
      reviews: 40,
      address: '102-1909 Maple Dr',
      phone: '(604) 892-2293',
      website: '',
      email: ''
    },
    {
      id: 's344',
      name: 'Sea to Sky Community Health Centre',
      category: 'Medical Clinics',
      rating: 4.6,
      reviews: 40,
      address: '102-1909 Maple Dr',
      phone: '(604) 892-5555',
      website: 'https://vch.ca',
      email: 'squamish@vch.ca'
    },
    {
      id: 's345',
      name: 'Sea to Sky Community Services',
      category: 'Community Services',
      rating: 4.6,
      reviews: 40,
      address: '102-1909 Maple Dr',
      phone: '(604) 892-5796',
      website: 'https://sscs.ca',
      email: 'info@sscs.ca'
    },
    {
      id: 's346',
      name: 'Sea to Sky Community Services - Honeybees',
      category: 'Childcare',
      rating: 4.6,
      reviews: 40,
      address: '102-1909 Maple Dr',
      phone: '604-567-3114',
      website: 'sscs.ca',
      email: ''
    },
    {
      id: 's347',
      name: 'Sea to Sky Community Services Society',
      category: 'Community Services',
      rating: 4.6,
      reviews: 40,
      address: '102-1909 Maple Dr',
      phone: '604-892-5796',
      website: 'sscs.ca',
      email: 'info@sscs.ca'
    },
    {
      id: 's348',
      name: 'Sea to Sky Concrete',
      category: 'Construction & Building',
      rating: 5,
      reviews: 7,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3019',
      website: 'https://seatoskyconcrete.ca',
      email: 'info@seatoskyconcrete.ca'
    },
    {
      id: 's349',
      name: 'Sea to Sky Courier & Freight',
      category: 'Couriers & Delivery',
      rating: 4.9,
      reviews: 112,
      address: '38024 Fourth Ave',
      phone: '(604) 892-8484',
      website: '',
      email: ''
    },
    {
      id: 's350',
      name: 'Sea to Sky Dry Cleaners',
      category: 'Dry Cleaning & Laundry',
      rating: 4.8,
      reviews: 25,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2976',
      website: 'https://seatoskycleaners.ca',
      email: 'info@seatoskycleaners.ca'
    },
    {
      id: 's351',
      name: 'Sea to Sky Electric',
      category: 'Electrical',
      rating: 5,
      reviews: 1,
      address: '38024 Fourth Ave',
      phone: '(604) 815-7777',
      website: 'https://seatoskyelectric.ca',
      email: 'info@seatoskyelectric.ca'
    },
    {
      id: 's352',
      name: 'Sea to Sky Events',
      category: 'Event Services',
      rating: 4.7,
      reviews: 12122,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2953',
      website: 'https://seatoskyevents.ca',
      email: 'info@seatoskyevents.ca'
    },
    {
      id: 's353',
      name: 'Sea to Sky Gondola',
      category: 'Attractions',
      rating: 4.7,
      reviews: 12122,
      address: '36800 Highway 99, Squamish, BC V8B 0B6',
      phone: '604-892-2550',
      website: 'seatoskygondola.com',
      email: 'info@seatoskygondola.com'
    },
    {
      id: 's354',
      name: 'Sea to Sky Gondola - Taste of the Summit',
      category: 'Restaurants & Dining',
      rating: 4.7,
      reviews: 12122,
      address: '36800 Highway 99, Squamish, BC V8B 0B6',
      phone: '604-892-2550',
      website: 'seatoskygondola.com',
      email: ''
    },
    {
      id: 's355',
      name: 'Sea to Sky Hotel',
      category: 'Hotels & Lodging',
      rating: 3.7,
      reviews: 345,
      address: '38024 Fourth Ave',
      phone: '1-800-531-1530',
      website: '',
      email: ''
    },
    {
      id: 's356',
      name: 'Sea to Sky Marine',
      category: 'Marine Services',
      rating: 5,
      reviews: 1,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3038',
      website: 'https://seatoskymarine.ca',
      email: 'info@seatoskymarine.ca'
    },
    {
      id: 's357',
      name: 'Sea to Sky Movers',
      category: 'Moving & Storage',
      rating: 4.8,
      reviews: 22,
      address: '38024 Fourth Ave',
      phone: '(778) 656-1502',
      website: 'seatoskymoving.ca',
      email: 'info@seatoskymoving.ca'
    },
    {
      id: 's358',
      name: 'Sea to Sky Naturopathy',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 1,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2211',
      website: 'https://seatoskynaturopathy.ca',
      email: 'info@seatoskynaturopathy.ca'
    },
    {
      id: 's359',
      name: 'Sea to Sky Nordic',
      category: 'Recreation & Sports',
      rating: 4.7,
      reviews: 12122,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3030',
      website: 'https://seatoskynordic.ca',
      email: 'info@seatoskynordic.ca'
    },
    {
      id: 's360',
      name: 'Sea to Sky Paving',
      category: 'Paving',
      rating: 5,
      reviews: 7,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3024',
      website: 'https://seatoskypaving.ca',
      email: 'info@seatoskypaving.ca'
    },
    {
      id: 's361',
      name: 'Sea to Sky Pet Services',
      category: 'Pet Services',
      rating: 4.9,
      reviews: 39,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2942',
      website: 'https://seatoskypets.ca',
      email: 'info@seatoskypets.ca'
    },
    {
      id: 's362',
      name: 'Sea to Sky Photography',
      category: 'Photography',
      rating: 5,
      reviews: 31,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2968',
      website: 'https://seatoskyphoto.ca',
      email: 'info@seatoskyphoto.ca'
    },
    {
      id: 's363',
      name: 'Sea to Sky Shuttle',
      category: 'Transportation',
      rating: 4.7,
      reviews: 12122,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2949',
      website: 'https://seatoskyshuttle.ca',
      email: 'info@seatoskyshuttle.ca'
    },
    {
      id: 's364',
      name: 'Sea to Sky Sports Physiotherapy',
      category: 'Physiotherapy & Rehab',
      rating: 4.9,
      reviews: 158,
      address: '38127 2nd Ave',
      phone: '(604) 892-5121',
      website: 'https://seatoskyphysio.com',
      email: 'info@seatoskyphysio.com'
    },
    {
      id: 's365',
      name: 'Sea to Sky Studios',
      category: 'Photography',
      rating: 5,
      reviews: 31,
      address: '38024 Fourth Ave',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's366',
      name: 'Sea to Sky Tech',
      category: 'Technology & IT',
      rating: 4.8,
      reviews: 46,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2946',
      website: 'https://seatoskytech.ca',
      email: 'info@seatoskytech.ca'
    },
    {
      id: 's367',
      name: 'Sea To Sky Toastmasters',
      category: 'Community Services',
      rating: 5,
      reviews: 1,
      address: '38024 Fourth Ave',
      phone: '604-356-1005',
      website: '',
      email: ''
    },
    {
      id: 's368',
      name: 'Sea to Sky Translation',
      category: 'Professional Services',
      rating: 5,
      reviews: 6,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3016',
      website: 'https://seatoskytranslation.ca',
      email: 'info@seatoskytranslation.ca'
    },
    {
      id: 's369',
      name: 'Sea to Sky Tree Service',
      category: 'Landscaping',
      rating: 4.7,
      reviews: 13,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2979',
      website: 'https://seatoskytrees.ca',
      email: 'info@seatoskytrees.ca'
    },
    {
      id: 's370',
      name: 'Sea to Sky Upholstery',
      category: 'Repair Services',
      rating: 4.8,
      reviews: 6,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3043',
      website: 'https://seatoskyupholstery.ca',
      email: 'info@seatoskyupholstery.ca'
    },
    {
      id: 's371',
      name: 'Sea to Sky Urgent Care',
      category: 'Medical Clinics',
      rating: 3.2,
      reviews: 85,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2911',
      website: 'https://seatoskyurgentcare.ca',
      email: 'info@seatoskyurgentcare.ca'
    },
    {
      id: 's372',
      name: 'Sea-to-Sky Walk-in Clinic',
      category: 'Medical Clinics',
      rating: 3.2,
      reviews: 85,
      address: '38024 Fourth Ave',
      phone: '604-898-5555',
      website: '',
      email: ''
    },
    {
      id: 's373',
      name: 'Seize the Souvlaki',
      category: 'Food Trucks',
      rating: 4.5,
      reviews: 47,
      address: '38127 2nd Ave',
      phone: '(604) 815-2849',
      website: 'https://seizethesouvlaki.ca',
      email: 'info@seizethesouvlaki.ca'
    },
    {
      id: 's374',
      name: 'Service BC Squamish',
      category: 'Government',
      rating: 4.6,
      reviews: 19,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5225',
      website: 'https://servicebc.gov.bc.ca',
      email: 'squamish@gov.bc.ca'
    },
    {
      id: 's375',
      name: 'Shady Tree Pub',
      category: 'Restaurants & Dining',
      rating: 4.2,
      reviews: 841,
      address: '40446 Government Rd',
      phone: '(604) 815-2836',
      website: 'https://shadytreepub.ca',
      email: 'info@shadytreepub.ca'
    },
    {
      id: 's376',
      name: 'Shala Yoga',
      category: 'Yoga & Pilates',
      rating: 4.9,
      reviews: 127,
      address: '40383 Tantalus Rd, Unit 3',
      phone: '(604) 243-9853',
      website: 'https://shalayoga.ca',
      email: 'info@shalayoga.ca'
    },
    {
      id: 's377',
      name: 'Shannon Falls Provincial Park',
      category: 'Attractions',
      rating: 4.7,
      reviews: 3436,
      address: 'Highway 99 (2km south of Squamish), BC',
      phone: '',
      website: '',
      email: 'info@bcparks.ca'
    },
    {
      id: 's378',
      name: 'Shift Wellness Squamish',
      category: 'Health & Wellness',
      rating: 4.8,
      reviews: 94,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2810',
      website: 'https://shiftwellness.ca',
      email: 'info@shiftwellness.ca'
    },
    {
      id: 's379',
      name: 'Shop N Drop',
      category: 'Couriers & Delivery',
      rating: 4.9,
      reviews: 28,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's380',
      name: 'Shoppers Drug Mart',
      category: 'Retail & Shopping',
      rating: 3.9,
      reviews: 137,
      address: '1339 Pemberton Ave',
      phone: '(604) 892-5258',
      website: '',
      email: 'squamish@shoppersdrugmart.ca'
    },
    {
      id: 's381',
      name: 'Shoppers Drug Mart Squamish',
      category: 'Pharmacy',
      rating: 3.9,
      reviews: 137,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5241',
      website: 'https://shoppersdrugmart.ca',
      email: 'squamish@shoppersdrugmart.ca'
    },
    {
      id: 's382',
      name: 'Shred Shed Repairs',
      category: 'Auto Services',
      rating: 5,
      reviews: 127,
      address: '114-1091 Commercial Place, Squamish, BC V8B 1B5',
      phone: '(778) 668-7433',
      website: '',
      email: ''
    },
    {
      id: 's383',
      name: 'Simon Hudson (Macdonald Realty)',
      category: 'Real Estate',
      rating: 5,
      reviews: 47,
      address: '38090 Cleveland Ave',
      phone: '(604) 892-8155',
      website: 'simonhudson.ca',
      email: 'simon@simonhudson.ca'
    },
    {
      id: 's384',
      name: 'Sound Mind Counselling Centre',
      category: 'Mental Health',
      rating: 5,
      reviews: 2,
      address: '38155 2nd Ave',
      phone: '(604) 849-3228',
      website: 'https://squamishcounselling.ca',
      email: 'connect@squamishcounselling.ca'
    },
    {
      id: 's385',
      name: 'Sparrow MD',
      category: 'Salons & Spas',
      rating: 4.8,
      reviews: 317,
      address: '38155 2nd Ave',
      phone: '(604) 390-3366',
      website: 'https://sparrowmd.ca',
      email: 'info@sparrowmd.ca'
    },
    {
      id: 's386',
      name: 'Splash Car Wash Squamish',
      category: 'Auto Services',
      rating: 4,
      reviews: 190,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-5432',
      website: 'https://splashcarwash.ca',
      email: 'squamish@splashcarwash.ca'
    },
    {
      id: 's387',
      name: 'Squamish Academy of Music',
      category: 'Education',
      rating: 5,
      reviews: 12,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-8877',
      website: 'https://squamishacademyofmusic.ca',
      email: 'info@squamishacademyofmusic.ca'
    },
    {
      id: 's388',
      name: 'Squamish Acupuncture',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 40,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-1100',
      website: 'https://squamishacupuncture.ca',
      email: 'info@squamishacupuncture.ca'
    },
    {
      id: 's389',
      name: 'Squamish Adventure Centre',
      category: 'Outdoor Adventures',
      rating: 4.5,
      reviews: 737,
      address: '38027 Cleveland Ave',
      phone: '(778) 743-8118',
      website: 'exploresquamish.com',
      email: 'info@tourismsquamish.com'
    },
    {
      id: 's390',
      name: 'Squamish Adventure Inn (Hostel)',
      category: 'Hotels & Lodging',
      rating: 4.5,
      reviews: 862,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9240',
      website: 'squamishhostel.com',
      email: 'info@squamishhostel.com'
    },
    {
      id: 's391',
      name: 'Squamish Alterations & Tailoring',
      category: 'Repair Services',
      rating: 4.7,
      reviews: 106,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3040',
      website: 'https://squamishalterations.ca',
      email: 'info@squamishalterations.ca'
    },
    {
      id: 's392',
      name: 'Squamish Aquatic Centre',
      category: 'Recreation & Sports',
      rating: 4.5,
      reviews: 38,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-3604',
      website: 'https://squamish.ca/aquatic',
      email: 'aquaticcentre@squamish.ca'
    },
    {
      id: 's393',
      name: 'Squamish Arts Council',
      category: 'Arts & Culture',
      rating: 5,
      reviews: 3,
      address: '38027 Cleveland Ave',
      phone: '',
      website: 'squamisharts.com',
      email: 'info@squamisharts.com'
    },
    {
      id: 's394',
      name: 'Squamish Auto Glass',
      category: 'Auto Services',
      rating: 5,
      reviews: 122,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3032',
      website: 'https://squamishautoglass.ca',
      email: 'info@squamishautoglass.ca'
    },
    {
      id: 's395',
      name: 'Squamish Baptist Church',
      category: 'Churches & Religious',
      rating: 4.8,
      reviews: 15,
      address: '2262 Read Cres, Squamish, BC V8B 0L1',
      phone: '(604) 898-3737',
      website: 'squamishbaptist.org',
      email: 'info@squamishbaptist.org'
    },
    {
      id: 's396',
      name: 'Squamish Barbell Clinic',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 28,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-1234',
      website: 'https://squamishbarbell.com',
      email: 'info@squamishbarbell.com'
    },
    {
      id: 's397',
      name: 'Squamish Baseball Association',
      category: 'Recreation & Sports',
      rating: 5,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3027',
      website: 'https://squamishbaseball.ca',
      email: 'info@squamishbaseball.ca'
    },
    {
      id: 's398',
      name: 'Squamish Bookkeeping Services',
      category: 'Accounting & Tax',
      rating: 5,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3014',
      website: 'https://squamishbookkeeping.ca',
      email: 'info@squamishbookkeeping.ca'
    },
    {
      id: 's399',
      name: 'Squamish Budget Inn',
      category: 'Hotels & Lodging',
      rating: 1.7,
      reviews: 65,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-0007',
      website: '',
      email: 'SQUAMISHGM@SHAW.CA'
    },
    {
      id: 's400',
      name: 'Squamish Business Advisory',
      category: 'Professional Services',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2893',
      website: 'https://squamishbusiness.ca',
      email: 'info@squamishbusiness.ca'
    },
    {
      id: 's401',
      name: 'Squamish Catering Co',
      category: 'Catering',
      rating: 5,
      reviews: 124,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3051',
      website: 'https://squamishcatering.ca',
      email: 'info@squamishcatering.ca'
    },
    {
      id: 's402',
      name: 'Squamish Chamber of Commerce',
      category: 'Community Services',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-4990',
      website: 'squamishchamber.com',
      email: 'info@squamishchamber.com'
    },
    {
      id: 's403',
      name: 'Squamish Coffee Company',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 195,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2960',
      website: 'https://squamishcoffee.ca',
      email: 'info@squamishcoffee.ca'
    },
    {
      id: 's404',
      name: 'Squamish Community Foundation',
      category: 'Community Services',
      rating: 4.8,
      reviews: 9,
      address: '38027 Cleveland Ave',
      phone: '(604) 848-8683',
      website: 'squamishfoundation.com',
      email: 'info@squamishfoundation.com'
    },
    {
      id: 's405',
      name: 'Squamish Computer Repair',
      category: 'Technology & IT',
      rating: 4.9,
      reviews: 90,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2947',
      website: 'https://squamishcomputerrepair.ca',
      email: 'info@squamishcomputerrepair.ca'
    },
    {
      id: 's406',
      name: 'Squamish Constellation Festival',
      category: 'Events & Festivals',
      rating: 5,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-7777',
      website: 'https://constellationfest.ca',
      email: 'info@constellationfest.ca'
    },
    {
      id: 's407',
      name: 'Squamish Counselling Centre',
      category: 'Mental Health',
      rating: 5,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5000',
      website: 'https://squamishcounsellingcentre.com',
      email: 'info@squamishcounsellingcentre.com'
    },
    {
      id: 's408',
      name: 'Squamish Courier',
      category: 'Couriers & Delivery',
      rating: 4.6,
      reviews: 174,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3017',
      website: 'https://squamishcourier.ca',
      email: 'info@squamishcourier.ca'
    },
    {
      id: 's409',
      name: 'Squamish Credit Union',
      category: 'Financial Services',
      rating: 4.5,
      reviews: 2,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-8350',
      website: '',
      email: ''
    },
    {
      id: 's410',
      name: 'Squamish Custom Homes',
      category: 'Construction & Building',
      rating: 5,
      reviews: 17,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5566',
      website: 'https://squamishcustomhomes.ca',
      email: 'info@squamishcustomhomes.ca'
    },
    {
      id: 's411',
      name: 'Squamish Cycle',
      category: 'Outdoor Gear & Shops',
      rating: 4.8,
      reviews: 45,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3009',
      website: 'https://squamishcycle.ca',
      email: 'info@squamishcycle.ca'
    },
    {
      id: 's412',
      name: 'Squamish Days Loggers Sports',
      category: 'Events & Festivals',
      rating: 4.9,
      reviews: 12,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9244',
      website: 'https://squamishdays.org',
      email: 'info@squamishdays.org'
    },
    {
      id: 's413',
      name: 'Squamish Dental Clinic',
      category: 'Dental',
      rating: 5,
      reviews: 410,
      address: '38027 Cleveland Ave',
      phone: '604-892-3548',
      website: 'squamishdentalclinic.ca',
      email: ''
    },
    {
      id: 's414',
      name: 'Squamish Dental Group',
      category: 'Dental',
      rating: 5,
      reviews: 410,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3548',
      website: 'squamishdentalgroup.com',
      email: ''
    },
    {
      id: 's415',
      name: 'Squamish Detailing',
      category: 'Auto Services',
      rating: 4.5,
      reviews: 43,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-4321',
      website: 'https://squamishdetailing.ca',
      email: 'info@squamishdetailing.ca'
    },
    {
      id: 's416',
      name: 'Squamish Diagnostic Center',
      category: 'Health & Wellness',
      rating: 4.2,
      reviews: 118,
      address: '38027 Cleveland Ave',
      phone: '(604) 243-1570',
      website: '',
      email: 'squamishdiagnostic@gmail.com'
    },
    {
      id: 's417',
      name: 'Squamish Disc Golf',
      category: 'Recreation & Sports',
      rating: 4.7,
      reviews: 20,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2986',
      website: 'https://squamishdiscgolf.ca',
      email: 'info@squamishdiscgolf.ca'
    },
    {
      id: 's418',
      name: 'Squamish Dog Walking',
      category: 'Pet Services',
      rating: 4.9,
      reviews: 22,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-0033',
      website: 'https://squamishdogwalking.ca',
      email: 'info@squamishdogwalking.ca'
    },
    {
      id: 's419',
      name: 'Squamish Drywall',
      category: 'Construction & Building',
      rating: 5,
      reviews: 17,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3020',
      website: 'https://squamishdrywall.ca',
      email: 'info@squamishdrywall.ca'
    },
    {
      id: 's420',
      name: 'Squamish Estuary',
      category: 'Attractions',
      rating: 4.8,
      reviews: 92,
      address: '38027 Cleveland Ave',
      phone: '',
      website: '',
      email: 'info@bcparks.ca'
    },
    {
      id: 's421',
      name: 'Squamish Farmers Market',
      category: 'Grocery & Markets',
      rating: 4.6,
      reviews: 224,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2983',
      website: 'https://squamishfarmersmarket.ca',
      email: 'info@squamishfarmersmarket.ca'
    },
    {
      id: 's422',
      name: 'Squamish Flooring',
      category: 'Flooring',
      rating: 4.6,
      reviews: 47,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3344',
      website: 'https://squamishflooring.ca',
      email: 'info@squamishflooring.ca'
    },
    {
      id: 's423',
      name: 'Squamish Flowers',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 141,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2955',
      website: 'https://squamishflowers.ca',
      email: 'info@squamishflowers.ca'
    },
    {
      id: 's424',
      name: 'Squamish Food Bank',
      category: 'Community Services',
      rating: 4.8,
      reviews: 9,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5877',
      website: 'https://squamishfoodbank.com',
      email: 'info@squamishfoodbank.com'
    },
    {
      id: 's425',
      name: 'Squamish Ford',
      category: 'Auto Services',
      rating: 4.1,
      reviews: 169,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3673',
      website: 'https://squamishford.com',
      email: 'info@squamishford.com'
    },
    {
      id: 's426',
      name: 'Squamish Funeral Chapel',
      category: 'Funeral Services',
      rating: 5,
      reviews: 16,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3683',
      website: 'https://squamishfuneralchapel.com',
      email: 'info@squamishfuneralchapel.com'
    },
    {
      id: 's427',
      name: 'Squamish Garage Doors',
      category: 'Home Improvement',
      rating: 4.8,
      reviews: 39,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3023',
      website: 'https://squamishgaragedoors.ca',
      email: 'info@squamishgaragedoors.ca'
    },
    {
      id: 's428',
      name: 'Squamish General Contracting',
      category: 'Construction & Building',
      rating: 5,
      reviews: 12,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2898',
      website: 'https://squamishgc.ca',
      email: 'info@squamishgc.ca'
    },
    {
      id: 's429',
      name: 'Squamish General Hospital',
      category: 'Medical Clinics',
      rating: 4.2,
      reviews: 118,
      address: '38027 Cleveland Ave',
      phone: '604-892-5211',
      website: '',
      email: ''
    },
    {
      id: 's430',
      name: 'Squamish Golf & Country Club',
      category: 'Recreation & Sports',
      rating: 4.6,
      reviews: 325,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-9521',
      website: 'https://squamishgolf.ca',
      email: 'info@squamishgolf.ca'
    },
    {
      id: 's431',
      name: 'Squamish Helping Hands Society',
      category: 'Community Services',
      rating: 4,
      reviews: 20,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-3000',
      website: 'squamishhelpinghands.ca',
      email: 'info@squamishhelpinghands.ca'
    },
    {
      id: 's432',
      name: 'Squamish Hostel',
      category: 'Hotels & Lodging',
      rating: 4.5,
      reviews: 862,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9240',
      website: 'https://squamishostel.com',
      email: 'info@squamishostel.com'
    },
    {
      id: 's433',
      name: 'Squamish IT Solutions',
      category: 'Technology & IT',
      rating: 4.9,
      reviews: 56,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-0000',
      website: 'https://squamishit.ca',
      email: 'info@squamishit.ca'
    },
    {
      id: 's434',
      name: 'Squamish Laundromat',
      category: 'Dry Cleaning & Laundry',
      rating: 4,
      reviews: 236,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2975',
      website: 'https://squamishlaundromat.ca',
      email: 'info@squamishlaundromat.ca'
    },
    {
      id: 's435',
      name: 'Squamish Locksmith',
      category: 'Repair Services',
      rating: 5,
      reviews: 127,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2977',
      website: 'https://squamishlocksmith.ca',
      email: 'info@squamishlocksmith.ca'
    },
    {
      id: 's436',
      name: 'Squamish Medical Clinic',
      category: 'Medical Clinics',
      rating: 3.5,
      reviews: 33,
      address: '38027 Cleveland Ave',
      phone: '604-892-3535',
      website: 'squamishmedicalclinic.com',
      email: 'info@squamishmedicalclinic.ca'
    },
    {
      id: 's437',
      name: 'Squamish Midwifery',
      category: 'Healthcare',
      rating: 5,
      reviews: 3,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2965',
      website: 'https://squamishmidwifery.ca',
      email: 'info@squamishmidwifery.ca'
    },
    {
      id: 's438',
      name: 'Squamish Mills',
      category: 'Industry',
      rating: 5,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3045',
      website: 'https://squamishmills.ca',
      email: 'info@squamishmills.ca'
    },
    {
      id: 's439',
      name: 'Squamish Minor Hockey',
      category: 'Recreation & Sports',
      rating: 4.2,
      reviews: 419,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3026',
      website: 'https://squamishminorhockey.ca',
      email: 'info@squamishminorhockey.ca'
    },
    {
      id: 's440',
      name: 'Squamish Mortgage Solutions',
      category: 'Financial Services',
      rating: 5,
      reviews: 108,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3008',
      website: 'https://squamishmortgage.ca',
      email: 'info@squamishmortgage.ca'
    },
    {
      id: 's441',
      name: 'Squamish Muffler & Brakes',
      category: 'Auto Services',
      rating: 4.4,
      reviews: 75,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3034',
      website: 'https://squamishmuffler.ca',
      email: 'info@squamishmuffler.ca'
    },
    {
      id: 's442',
      name: 'Squamish Multifaith Association',
      category: 'Churches & Religious',
      rating: 5,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 848-4807',
      website: 'squamishmultifaith.org',
      email: 'info@squamishmultifaith.org'
    },
    {
      id: 's443',
      name: 'Squamish Nation',
      category: 'Squamish Nation',
      rating: 3,
      reviews: 2,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5166',
      website: 'https://squamish.net',
      email: 'info@squamish.net'
    },
    {
      id: 's444',
      name: 'Squamish Native Art Store',
      category: 'Arts & Culture',
      rating: 4.3,
      reviews: 16,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-2349',
      website: '',
      email: ''
    },
    {
      id: 's445',
      name: 'Squamish Naturopathic Clinic',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 89,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3322',
      website: 'https://squamishnaturopathic.ca',
      email: 'info@squamishnaturopathic.ca'
    },
    {
      id: 's446',
      name: 'Squamish Off-Road Cycling Association',
      category: 'Recreation & Sports',
      rating: 2.5,
      reviews: 2,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2933',
      website: 'https://sorca.ca',
      email: 'info@sorca.ca'
    },
    {
      id: 's447',
      name: 'Squamish Painting',
      category: 'Home Improvement',
      rating: 5,
      reviews: 21,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-0088',
      website: 'https://squamishpainting.ca',
      email: 'info@squamishpainting.ca'
    },
    {
      id: 's448',
      name: 'Squamish Pentecostal Assembly',
      category: 'Churches & Religious',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3680',
      website: 'https://squamishpentecostal.ca',
      email: 'info@squamishpentecostal.ca'
    },
    {
      id: 's449',
      name: 'Squamish Pet Resort',
      category: 'Pet Services',
      rating: 4.9,
      reviews: 269,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2940',
      website: 'https://squamishpetresort.ca',
      email: 'info@squamishpetresort.ca'
    },
    {
      id: 's450',
      name: 'Squamish Pet Supply',
      category: 'Pet Services',
      rating: 4.8,
      reviews: 62,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2943',
      website: 'https://squamishpetsupply.ca',
      email: 'info@squamishpetsupply.ca'
    },
    {
      id: 's451',
      name: 'Squamish Photographers',
      category: 'Photography',
      rating: 5,
      reviews: 5,
      address: '38027 Cleveland Ave',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's452',
      name: 'Squamish Public Library',
      category: 'Library',
      rating: 4.6,
      reviews: 88,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3110',
      website: '',
      email: 'info@squamishlibrary.ca'
    },
    {
      id: 's453',
      name: 'Squamish Reiki & Energy Healing',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 15,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2962',
      website: 'https://squamishreiki.ca',
      email: 'info@squamishreiki.ca'
    },
    {
      id: 's454',
      name: 'Squamish Reporter',
      category: 'Media',
      rating: 4.7,
      reviews: 35,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2967',
      website: 'https://squamishreporter.com',
      email: 'info@squamishreporter.com'
    },
    {
      id: 's455',
      name: 'Squamish River Fishing',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 55,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-4433',
      website: 'https://squamishriverfishing.ca',
      email: 'info@squamishriverfishing.ca'
    },
    {
      id: 's456',
      name: 'Squamish Rock Climbing',
      category: 'Recreation & Sports',
      rating: 4.9,
      reviews: 104,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2934',
      website: 'https://squamishclimbing.org',
      email: 'info@squamishclimbing.org'
    },
    {
      id: 's457',
      name: 'Squamish Rock Guides',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 104,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2819',
      website: 'https://squamishguides.com',
      email: 'info@squamishguides.com'
    },
    {
      id: 's458',
      name: 'Squamish Rock Gym',
      category: 'Fitness & Gyms',
      rating: 4.3,
      reviews: 208,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-5522',
      website: 'https://squamishclimbing.com',
      email: 'info@squamishclimbing.com'
    },
    {
      id: 's459',
      name: 'Squamish Rope Runner Park',
      category: 'Outdoor Adventures',
      rating: 4.5,
      reviews: 737,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-4623',
      website: '',
      email: 'info@roperunnersquamish.com'
    },
    {
      id: 's460',
      name: 'Squamish Running Club',
      category: 'Recreation & Sports',
      rating: 4.8,
      reviews: 109,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2935',
      website: 'https://squamishrunning.ca',
      email: 'info@squamishrunning.ca'
    },
    {
      id: 's461',
      name: 'Squamish RV & Marine',
      category: 'Marine Services',
      rating: 4.9,
      reviews: 192,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3036',
      website: 'https://squamishrv.ca',
      email: 'info@squamishrv.ca'
    },
    {
      id: 's462',
      name: 'Squamish Sailing Club',
      category: 'Recreation & Sports',
      rating: 4.4,
      reviews: 72,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3028',
      website: 'https://squamishsailing.ca',
      email: 'info@squamishsailing.ca'
    },
    {
      id: 's463',
      name: 'Squamish Search and Rescue',
      category: 'Emergency Services',
      rating: 5,
      reviews: 6,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2929',
      website: 'https://squamishsar.ca',
      email: 'info@squamishsar.ca'
    },
    {
      id: 's464',
      name: 'Squamish Self Storage',
      category: 'Moving & Storage',
      rating: 4.9,
      reviews: 330,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5588',
      website: 'https://squamishselfstorage.ca',
      email: 'info@squamishselfstorage.ca'
    },
    {
      id: 's465',
      name: 'Squamish Seniors Centre',
      category: 'Community Centre',
      rating: 4.6,
      reviews: 16,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-1066',
      website: 'https://squamishseniors.ca',
      email: 'info@squamishseniors.ca'
    },
    {
      id: 's466',
      name: 'Squamish Skate Park',
      category: 'Recreation & Sports',
      rating: 4.8,
      reviews: 19,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2984',
      website: 'https://squamish.ca',
      email: 'parks@squamish.ca'
    },
    {
      id: 's467',
      name: 'Squamish SPCA',
      category: 'Pet Services',
      rating: 4.7,
      reviews: 52,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-7722',
      website: 'https://spca.bc.ca/location/squamish',
      email: 'squamish@spca.bc.ca'
    },
    {
      id: 's468',
      name: 'Squamish Tandoori',
      category: 'Restaurants & Dining',
      rating: 3.6,
      reviews: 668,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2847',
      website: 'https://squamishtandoori.ca',
      email: 'info@squamishtandoori.ca'
    },
    {
      id: 's469',
      name: 'Squamish Taxi',
      category: 'Transportation',
      rating: 3.8,
      reviews: 203,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2948',
      website: 'https://squamishtaxi.ca',
      email: 'info@squamishtaxi.ca'
    },
    {
      id: 's470',
      name: 'Squamish Tennis Club',
      category: 'Recreation & Sports',
      rating: 4.2,
      reviews: 419,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2938',
      website: 'https://squamishtennis.ca',
      email: 'info@squamishtennis.ca'
    },
    {
      id: 's471',
      name: 'Squamish Terminals',
      category: 'Event Venues',
      rating: 4.3,
      reviews: 63,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2920',
      website: 'https://squamishterminals.com',
      email: 'info@squamishterminals.com'
    },
    {
      id: 's472',
      name: 'Squamish Terminals Ltd',
      category: 'Industry',
      rating: 4.3,
      reviews: 63,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3531',
      website: 'https://squamishterminals.com',
      email: 'info@squamishterminals.com'
    },
    {
      id: 's473',
      name: 'Squamish Trails Society',
      category: 'Outdoor Adventures',
      rating: 4.8,
      reviews: 76,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2822',
      website: 'https://squamishtrails.ca',
      email: 'info@squamishtrails.ca'
    },
    {
      id: 's474',
      name: 'Squamish United Church',
      category: 'Churches & Religious',
      rating: 4.4,
      reviews: 7,
      address: '38014 Fourth Ave, Squamish, BC V8B 0A3',
      phone: '(604) 892-5727',
      website: 'squamishunitedchurch.org',
      email: 'secretary@squamishunitedchurch.org'
    },
    {
      id: 's475',
      name: 'Squamish Valley Campground',
      category: 'Campgrounds',
      rating: 3.8,
      reviews: 281,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2885',
      website: 'https://squamishvalleycampground.ca',
      email: 'info@squamishvalleycampground.ca'
    },
    {
      id: 's476',
      name: 'Squamish Valley Tours',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 55,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-7766',
      website: 'https://squamishvalleytours.ca',
      email: 'info@squamishvalleytours.ca'
    },
    {
      id: 's477',
      name: 'Squamish Veterinary Hospital',
      category: 'Veterinary',
      rating: 4.8,
      reviews: 135,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5722',
      website: 'https://squamishvet.ca',
      email: 'info@squamishvet.ca'
    },
    {
      id: 's478',
      name: 'Squamish Walk-In Clinic',
      category: 'Medical Clinics',
      rating: 3.2,
      reviews: 85,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2910',
      website: 'https://squamishwalkin.ca',
      email: 'info@squamishwalkin.ca'
    },
    {
      id: 's479',
      name: 'Squamish Watch Repair',
      category: 'Repair Services',
      rating: 4.9,
      reviews: 37,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3042',
      website: 'https://squamishwatchrepair.ca',
      email: 'info@squamishwatchrepair.ca'
    },
    {
      id: 's480',
      name: 'Squamish Watersports',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 951,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2816',
      website: 'https://squamishwatersports.com',
      email: 'info@squamishwatersports.com'
    },
    {
      id: 's481',
      name: 'Squamish Web Design',
      category: 'Web & Marketing',
      rating: 4,
      reviews: 4,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2944',
      website: 'https://squamishwebdesign.ca',
      email: 'info@squamishwebdesign.ca'
    },
    {
      id: 's482',
      name: 'Squamish Wedding Planning',
      category: 'Event Services',
      rating: 5,
      reviews: 61,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2952',
      website: 'https://squamishweddings.ca',
      email: 'info@squamishweddings.ca'
    },
    {
      id: 's483',
      name: 'Squamish Welcome Centre',
      category: 'Community Services',
      rating: 4.5,
      reviews: 27,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-4142',
      website: 'canadahelps.org',
      email: 'info@welcomesquamish.ca'
    },
    {
      id: 's484',
      name: 'Squamish Windsports Society',
      category: 'Outdoor Adventures',
      rating: 4.8,
      reviews: 145,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2932',
      website: 'https://squamishwindsports.com',
      email: 'info@squamishwindsports.com'
    },
    {
      id: 's485',
      name: 'Squamish Yacht Club',
      category: 'Recreation & Sports',
      rating: 4.4,
      reviews: 72,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3037',
      website: 'https://squamishyc.ca',
      email: 'info@squamishyc.ca'
    },
    {
      id: 's486',
      name: 'Squamish Youth Resource Centre',
      category: 'Community Services',
      rating: 4.6,
      reviews: 40,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5796',
      website: 'https://squamishyouth.ca',
      email: 'info@squamishyouth.ca'
    },
    {
      id: 's488',
      name: 'Starbucks Squamish',
      category: 'Cafes & Bakeries',
      rating: 4,
      reviews: 558,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5200',
      website: 'https://starbucks.ca',
      email: 'squamish@starbucks.ca'
    },
    {
      id: 's489',
      name: 'Stawamus Chief Guides',
      category: 'Outdoor Adventures',
      rating: 4.9,
      reviews: 593,
      address: 'Squamish',
      phone: '(604) 815-2823',
      website: 'https://stawamuschiefguides.ca',
      email: 'info@stawamuschiefguides.ca'
    },
    {
      id: 's490',
      name: 'Sterling Landscaping',
      category: 'Landscaping',
      rating: 4.1,
      reviews: 9,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's492',
      name: 'Stilhavn Real Estate',
      category: 'Real Estate',
      rating: 5,
      reviews: 23,
      address: '1388 Main Street, Squamish, BC V8B 1A4',
      phone: '(604) 398-7999',
      website: 'stilhavn.com',
      email: 'info@stilhavn.com'
    },
    {
      id: 's494',
      name: 'Straight Line Plumbing & Heating',
      category: 'Plumbing & HVAC',
      rating: 5,
      reviews: 1,
      address: '38146 Behrner Dr',
      phone: '(604) 935-8771',
      website: '',
      email: ''
    },
    {
      id: 's495',
      name: 'Studio A Squamish',
      category: 'Photography',
      rating: 5,
      reviews: 18,
      address: '38027 Cleveland Ave',
      phone: '',
      website: 'studioasquamish.com',
      email: 'info@studioasquamish.com'
    },
    {
      id: 's496',
      name: 'Subway Squamish',
      category: 'Restaurants & Dining',
      rating: 3.4,
      reviews: 143,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-7827',
      website: 'https://subway.com',
      email: 'squamish@subway.com'
    },
    {
      id: 's497',
      name: 'Sunflower Bakery & Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 417,
      address: '38086 Cleveland Ave',
      phone: '(604) 892-2231',
      website: '',
      email: 'info@sunflowerbakerycafe.com'
    },
    {
      id: 's498',
      name: 'Sunflower Bakery Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.5,
      reviews: 417,
      address: '38086 Cleveland Ave',
      phone: '(604) 892-2231',
      website: 'https://sunflowerbakerycafe.ca',
      email: 'info@sunflowerbakerycafe.ca'
    },
    {
      id: 's499',
      name: 'Sunny Chibas',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 1983,
      address: 'Highway 99',
      phone: '(604) 815-2841',
      website: 'https://sunnychibas.ca',
      email: 'info@sunnychibas.ca'
    },
    {
      id: 's500',
      name: 'Sunwolf Riverside Resort',
      category: 'Hotels & Lodging',
      rating: 4.6,
      reviews: 282,
      address: '70002 Squamish Valley Rd',
      phone: '(604) 898-1537',
      website: 'sunwolf.net',
      email: 'info@sunwolf.net'
    },
    {
      id: 's501',
      name: 'Sushi Sen Japanese Restaurant',
      category: 'Restaurants & Dining',
      rating: 4.2,
      reviews: 865,
      address: '40382 Tantalus Rd, Garibaldi Highlands',
      phone: '604-898-8235',
      website: 'sushisen.ca',
      email: ''
    },
    {
      id: 's502',
      name: 'Sweeney Bride Squamish',
      category: 'Salons & Spas',
      rating: 4.6,
      reviews: 10,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5131',
      website: '',
      email: ''
    },
    {
      id: 's503',
      name: 'T & A Nail Salon',
      category: 'Salons & Spas',
      rating: 5,
      reviews: 18,
      address: '1307 Pemberton Ave #2B',
      phone: '(604) 390-0099',
      website: 'https://tanailsalon.ca',
      email: 'info@tanailsalon.ca'
    },
    {
      id: 's504',
      name: 'Taco Del Mar',
      category: 'Restaurants & Dining',
      rating: 4,
      reviews: 450,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's505',
      name: 'Taka Ramen & Sushi',
      category: 'Restaurants & Dining',
      rating: 4.7,
      reviews: 589,
      address: '40167 Glenalder Pl',
      phone: '(604) 390-0077',
      website: 'https://takaramen.ca',
      email: 'info@takaramen.ca'
    },
    {
      id: 's506',
      name: 'Taka Ramen + Sushi',
      category: 'Restaurants & Dining',
      rating: 4.7,
      reviews: 589,
      address: '40167 Glenalder Pl',
      phone: '(604) 390-0077',
      website: 'https://takaramen.ca',
      email: 'info@takaramen.ca'
    },
    {
      id: 's507',
      name: 'Tall Tree Bakery',
      category: 'Cafes & Bakeries',
      rating: 4.8,
      reviews: 240,
      address: '404-1201 Commercial Way, Squamish, BC V8B 0V1',
      phone: '(604) 849-0951',
      website: '',
      email: 'info@talltreebakery.com'
    },
    {
      id: 's508',
      name: 'Tandoori Flame',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 436,
      address: '40330 Tantalus Rd',
      phone: '(604) 449-1991',
      website: '',
      email: 'info@tandooriflamesquamish.com'
    },
    {
      id: 's509',
      name: 'Tantalus Bike Shop',
      category: 'Outdoor Gear & Shops',
      rating: 4.7,
      reviews: 171,
      address: '40194 Glenalder Pl',
      phone: '(604) 898-2588',
      website: '',
      email: 'info@tantalusbikeshop.com'
    },
    {
      id: 's510',
      name: 'Tantalus Dental',
      category: 'Dental',
      rating: 5,
      reviews: 169,
      address: '12-40437 Tantalus Rd',
      phone: '(604) 898-5300',
      website: 'tantalusdental.com',
      email: ''
    },
    {
      id: 's511',
      name: 'TargetZone Fitness',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 29,
      address: '40168 Garibaldi Way',
      phone: '604-898-9771',
      website: '',
      email: ''
    },
    {
      id: 's512',
      name: 'Taste of Saigon',
      category: 'Restaurants & Dining',
      rating: 4.7,
      reviews: 521,
      address: '38038 Cleveland Ave',
      phone: '(604) 390-0088',
      website: '',
      email: ''
    },
    {
      id: 's513',
      name: 'TD Bank Squamish',
      category: 'Financial Services',
      rating: 3.9,
      reviews: 31,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5284',
      website: 'https://td.com',
      email: 'squamish@td.com'
    },
    {
      id: 's514',
      name: 'TD Canada Trust',
      category: 'Financial Services',
      rating: 3.9,
      reviews: 31,
      address: '1200 Hunter Place Unit 210, Squamish, BC V8B 0G8',
      phone: '(604) 892-8300',
      website: '',
      email: ''
    },
    {
      id: 's515',
      name: 'Terra Nova Medical Clinic',
      category: 'Medical Clinics',
      rating: 4.3,
      reviews: 9,
      address: '1870 Dowad Drive, Suite 102',
      phone: '604-898-6700',
      website: 'terranovamedical.ca',
      email: 'info@terranovamedical.ca'
    },
    {
      id: 's516',
      name: 'The Broken Seal',
      category: 'Restaurants & Dining',
      rating: 4.9,
      reviews: 243,
      address: '38038 Loggers Lane',
      phone: '',
      website: '',
      email: 'contact@thebrokenseal.ca'
    },
    {
      id: 's517',
      name: 'The Buvette',
      category: 'Restaurants & Dining',
      rating: 4.4,
      reviews: 223,
      address: '1323 Vancouver St',
      phone: '',
      website: '',
      email: 'hello.thebuvette@gmail.com'
    },
    {
      id: 's518',
      name: 'The Copper Coil Still & Grill',
      category: 'Restaurants & Dining',
      rating: 4.4,
      reviews: 2010,
      address: '38127 2nd Ave',
      phone: '(604) 892-0646',
      website: '',
      email: 'info@thecoppercoil.com'
    },
    {
      id: 's519',
      name: 'The Copper Kraken Tattoo Emporium',
      category: 'Arts & Culture',
      rating: 4.9,
      reviews: 11,
      address: '38127 2nd Ave',
      phone: '(604) 389-8821',
      website: '',
      email: ''
    },
    {
      id: 's520',
      name: 'The Crabapple Café',
      category: 'Restaurants & Dining',
      rating: 4.6,
      reviews: 1120,
      address: '38127 2nd Ave',
      phone: '604-898-1991',
      website: 'crabapplecafe.ca',
      email: ''
    },
    {
      id: 's521',
      name: 'The Essence Wellness Centre',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 138,
      address: '38127 2nd Ave',
      phone: '(604) 815-2808',
      website: 'https://theessenceclinic.com',
      email: 'info@theessenceclinic.com'
    },
    {
      id: 's522',
      name: 'The Funky Monkey Boutique',
      category: 'Retail & Shopping',
      rating: 3.8,
      reviews: 11,
      address: '38127 2nd Ave',
      phone: '(604) 892-7474',
      website: '',
      email: ''
    },
    {
      id: 's523',
      name: 'The Ledge Climbing Centre',
      category: 'Fitness & Gyms',
      rating: 4.3,
      reviews: 81,
      address: '38127 2nd Ave',
      phone: '(604) 892-7773',
      website: 'https://theledgeclimbing.com',
      email: 'info@theledgeclimbing.com'
    },
    {
      id: 's524',
      name: 'The Locavore Bar & Grill',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 711,
      address: '38127 2nd Ave',
      phone: '604-390-1078',
      website: 'locavorebarandgrill.com',
      email: 'info@locavorebarandgrill.com'
    },
    {
      id: 's525',
      name: 'The Locavore Food Truck',
      category: 'Food Trucks',
      rating: 4.3,
      reviews: 711,
      address: '38127 2nd Ave',
      phone: '(604) 815-2851',
      website: 'https://locavorefoodtruck.ca',
      email: 'info@locavorefoodtruck.ca'
    },
    {
      id: 's526',
      name: 'The Rock Church',
      category: 'Churches & Religious',
      rating: 5,
      reviews: 5,
      address: '38127 2nd Ave',
      phone: '(604) 849-2564',
      website: 'therocksquamish.com',
      email: 'info@therocksquamish.com'
    },
    {
      id: 's527',
      name: 'The Royal Canadian Legion Squamish',
      category: 'Community Services',
      rating: 4.6,
      reviews: 5,
      address: '40194 Glenalder Place, Garibaldi Highlands, BC V0N 1T0',
      phone: '(604) 898-9368',
      website: '',
      email: 'rcl277@shaw.ca'
    },
    {
      id: 's528',
      name: 'The Salted Vine Kitchen + Bar',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 424,
      address: '38127 2nd Ave',
      phone: '604-390-1910',
      website: 'saltedvine.ca',
      email: 'info@saltedvine.ca'
    },
    {
      id: 's529',
      name: 'The Sound Martial Arts',
      category: 'Martial Arts',
      rating: 5,
      reviews: 63,
      address: '38127 2nd Ave',
      phone: '(604) 848-5099',
      website: 'https://thesoundmartialarts.com',
      email: 'thesoundsquamish@gmail.com'
    },
    {
      id: 's530',
      name: 'The Squamish Chief',
      category: 'Media',
      rating: 4.7,
      reviews: 35,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9161',
      website: 'https://squamishchief.com',
      email: 'editor@squamishchief.com'
    },
    {
      id: 's531',
      name: 'The Summit Restaurant',
      category: 'Restaurants & Dining',
      rating: 4.7,
      reviews: 12122,
      address: '38127 2nd Ave',
      phone: '(604) 815-2848',
      website: 'https://seatoskygondola.com',
      email: 'info@seatoskygondola.com'
    },
    {
      id: 's532',
      name: 'The UPS Store Squamish',
      category: 'Couriers & Delivery',
      rating: 2.8,
      reviews: 69,
      address: '38109 Second Ave, Squamish, BC V8B 0T7',
      phone: '(604) 390-1100',
      website: '',
      email: 'store471@theupsstore.ca'
    },
    {
      id: 's533',
      name: 'The Waiting Room Cafe',
      category: 'Cafes & Bakeries',
      rating: 5,
      reviews: 4,
      address: '38146 Behrner Dr',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's534',
      name: 'The Watershed Grill',
      category: 'Restaurants & Dining',
      rating: 4.5,
      reviews: 3668,
      address: '38127 2nd Ave',
      phone: '604-898-6665',
      website: 'thewatershedgrill.com',
      email: 'info@thewatershedgrill.com'
    },
    {
      id: 's535',
      name: 'The Web Division',
      category: 'Web & Marketing',
      rating: 4,
      reviews: 4,
      address: '38127 2nd Ave',
      phone: '(604) 849-3416',
      website: 'thewebdivision.ca',
      email: 'yanick.dev@gmail.com'
    },
    {
      id: 's536',
      name: 'The Wellness Room',
      category: 'Health & Wellness',
      rating: 5,
      reviews: 65,
      address: '38127 2nd Ave',
      phone: '(604) 390-1112',
      website: 'https://yourwellnessroom.ca',
      email: 'info@yourwellnessroom.ca'
    },
    {
      id: 's537',
      name: 'The Yoga Studio',
      category: 'Fitness & Gyms',
      rating: 4.8,
      reviews: 6,
      address: '37776 2nd Ave, Squamish, BC V8B 0K1',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's538',
      name: 'Tim Hortons Squamish',
      category: 'Cafes & Bakeries',
      rating: 3.8,
      reviews: 1258,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9266',
      website: 'https://timhortons.ca',
      email: 'squamish@timhortons.ca'
    },
    {
      id: 's539',
      name: 'Timberwolf Restaurant & Lounge',
      category: 'Restaurants & Dining',
      rating: 4.3,
      reviews: 379,
      address: '38922 Progress Way',
      phone: '604-815-4424',
      website: 'timberwolfrestaurant.com',
      email: 'timberwolfsquamish@gmail.com'
    },
    {
      id: 's540',
      name: 'Tin Mun Mun Daycare (Squamish Nation)',
      category: 'Childcare',
      rating: 2,
      reviews: 1,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9114',
      website: 'squamish.net',
      email: ''
    },
    {
      id: 's541',
      name: 'Tip Toe Flooring',
      category: 'Flooring',
      rating: 5,
      reviews: 9,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's542',
      name: 'Toews & Company Lawyers',
      category: 'Legal Services',
      rating: 3.9,
      reviews: 7,
      address: '201-1364 Pemberton Ave',
      phone: '(604) 892-5378',
      website: 'toewsco.net',
      email: 'info@toewsco.net'
    },
    {
      id: 's543',
      name: 'Totem Hall',
      category: 'Event Venues',
      rating: 4.7,
      reviews: 114,
      address: '38131 2nd Ave',
      phone: '(604) 815-2922',
      website: 'https://totemhall.ca',
      email: 'info@totemhall.ca'
    },
    {
      id: 's544',
      name: 'Truth Plumbing & HVAC Ltd',
      category: 'Plumbing & HVAC',
      rating: 4.8,
      reviews: 296,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's545',
      name: 'Tuba Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 233,
      address: '38114 2nd Ave',
      phone: '(604) 767-2640',
      website: '',
      email: ''
    },
    {
      id: 's546',
      name: 'TY Electric Inc',
      category: 'Electrical',
      rating: 5,
      reviews: 109,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's547',
      name: 'Umai Sushi & Grill',
      category: 'Restaurants & Dining',
      rating: 4.9,
      reviews: 83,
      address: '40167 Glenalder Pl',
      phone: '(604) 390-0028',
      website: 'https://umaisquamish.ca',
      email: 'info@umaisquamish.ca'
    },
    {
      id: 's548',
      name: 'Unique Slow Rise Bakery',
      category: 'Cafes & Bakeries',
      rating: 4.2,
      reviews: 200,
      address: 'Klahanie Campground',
      phone: '(604) 815-2957',
      website: 'https://uniqueslowrise.ca',
      email: 'info@uniqueslowrise.ca'
    },
    {
      id: 's549',
      name: 'UNWIND Integrated Health Clinic',
      category: 'Physiotherapy & Rehab',
      rating: 5,
      reviews: 41,
      address: '38167 Cleveland Ave',
      phone: '(604) 892-5688',
      website: 'https://unwindsquamish.com',
      email: 'info@unwindsquamish.com'
    },
    {
      id: 's550',
      name: 'Urban Alpine',
      category: 'Outdoor Gear & Shops',
      rating: 4.5,
      reviews: 121,
      address: '40262 Glenalder Pl',
      phone: '(604) 567-4492',
      website: '',
      email: 'info@urbanalpine.com'
    },
    {
      id: 's551',
      name: 'Valhalla Pure Outfitters',
      category: 'Outdoor Gear & Shops',
      rating: 4.5,
      reviews: 250,
      address: '1200 Hunter Pl #805',
      phone: '(604) 892-9092',
      website: '',
      email: 'squamish@valhalla-pure.com'
    },
    {
      id: 's552',
      name: 'Vancity Squamish',
      category: 'Financial Services',
      rating: 4.5,
      reviews: 2,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5575',
      website: 'https://vancity.com',
      email: 'squamish@vancity.com'
    },
    {
      id: 's553',
      name: 'VentureWeb Design',
      category: 'Web & Marketing',
      rating: 4,
      reviews: 4,
      address: '102-41105 Tantalus Rd',
      phone: '(604) 815-4542',
      website: 'ventureweb.net',
      email: 'info@ventureweb.net'
    },
    {
      id: 's554',
      name: 'Vertical Reality Sports',
      category: 'Outdoor Gear & Shops',
      rating: 4.7,
      reviews: 18,
      address: '38147 2nd Ave',
      phone: '(604) 892-8248',
      website: 'https://verticalreality.ca',
      email: 'info@verticalreality.ca'
    },
    {
      id: 's555',
      name: 'Vertical Reality Sports Store',
      category: 'Outdoor Gear & Shops',
      rating: 4.7,
      reviews: 18,
      address: '38147 2nd Ave',
      phone: '(604) 892-8248',
      website: 'https://verticalreality.ca',
      email: 'info@verticalreality.ca'
    },
    {
      id: 's556',
      name: 'Vrè Nord Delivery Co.',
      category: 'Couriers & Delivery',
      rating: 4.7,
      reviews: 32,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's557',
      name: 'Walmart',
      category: 'Retail & Shopping',
      rating: 3.5,
      reviews: 933,
      address: '39210 Discovery Way, Squamish, BC V8B 0N1',
      phone: '(604) 815-4337',
      website: '',
      email: ''
    },
    {
      id: 's558',
      name: 'Walmart Squamish',
      category: 'Retail & Shopping',
      rating: 3.5,
      reviews: 933,
      address: '39210 Discovery Way, Squamish, BC V8B 0N1',
      phone: '(604) 892-1700',
      website: 'https://walmart.ca',
      email: 'squamish@walmart.ca'
    },
    {
      id: 's560',
      name: 'Westland Insurance Squamish',
      category: 'Insurance',
      rating: 4.9,
      reviews: 528,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5251',
      website: 'https://westlandinsurance.ca',
      email: 'squamish@westlandinsurance.ca'
    },
    {
      id: 's561',
      name: 'Whistler Courier',
      category: 'Couriers & Delivery',
      rating: 4.6,
      reviews: 174,
      address: '38610 Loggers Ln, Squamish, BC V8B 0H2',
      phone: '(604) 892-0666',
      website: '',
      email: 'info@whistlercourier.com'
    },
    {
      id: 's562',
      name: 'Whistler Printing & Signs',
      category: 'Printing & Signs',
      rating: 4.3,
      reviews: 6,
      address: '38146 Behrner Dr',
      phone: '(604) 892-5577',
      website: 'https://whistlerprinting.com',
      email: 'print@whistlerprinting.com'
    },
    {
      id: 's563',
      name: 'Whistler Printing & Signs Ltd',
      category: 'Printing & Signs',
      rating: 4.3,
      reviews: 6,
      address: '38146 Behrner Dr',
      phone: '(604) 932-1944',
      website: 'whistlerprinting.com',
      email: 'print@whistlerprinting.com'
    },
    {
      id: 's564',
      name: 'Whistler Real Estate Co',
      category: 'Real Estate',
      rating: 5,
      reviews: 1,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2896',
      website: 'https://whistlerrealestate.ca',
      email: 'squamish@whistlerrealestate.ca'
    },
    {
      id: 's565',
      name: 'White Spot Squamish',
      category: 'Restaurants & Dining',
      rating: 4.2,
      reviews: 1378,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-4434',
      website: 'https://whitespot.ca',
      email: 'squamish@whitespot.ca'
    },
    {
      id: 's566',
      name: 'Wicks Electric',
      category: 'Electrical',
      rating: 4.9,
      reviews: 258,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's567',
      name: 'Wild and Heart Boutique',
      category: 'Retail & Shopping',
      rating: 4.4,
      reviews: 14,
      address: '38036 Cleveland Ave',
      phone: '(604) 815-2855',
      website: 'https://wildandheart.com',
      email: 'hello@wildandheart.com'
    },
    {
      id: 's568',
      name: 'Wild Life Gym',
      category: 'Fitness & Gyms',
      rating: 5,
      reviews: 32,
      address: '317-1201 Commercial Way',
      phone: '(604) 390-0029',
      website: 'wildlifegym.com',
      email: 'info@wildlifegym.com'
    },
    {
      id: 's569',
      name: 'Wildflower & Twigs',
      category: 'Retail & Shopping',
      rating: 4.9,
      reviews: 28,
      address: '38020 Cleveland Ave',
      phone: '(604) 815-2868',
      website: 'https://wildflowerandtwigs.ca',
      email: 'info@wildflowerandtwigs.ca'
    },
    {
      id: 's570',
      name: 'Willowbrae Childcare Academy',
      category: 'Childcare',
      rating: 5,
      reviews: 4,
      address: 'Unit 109, 38147 Laurelwood Rd',
      phone: '(604) 612-9554',
      website: 'willowbraechildcaresquamish.com',
      email: 'squamish@willowbraechildcare.com'
    },
    {
      id: 's571',
      name: 'Winners',
      category: 'Retail & Shopping',
      rating: 4.3,
      reviews: 943,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's572',
      name: 'Wire Chief Electric',
      category: 'Electrical',
      rating: 4.9,
      reviews: 81,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's573',
      name: 'Wonderlands Plants & Coffee',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 159,
      address: '39767 Government Rd #105',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's574',
      name: 'Woodfibre LNG',
      category: 'Energy & Utilities',
      rating: 3.5,
      reviews: 43,
      address: '104-38070 Loggers Lane, Squamish, BC V8B 0Z9',
      phone: '(604) 815-3044',
      website: 'https://woodfibrelng.ca',
      email: 'info@woodfibrelng.ca'
    },
    {
      id: 's575',
      name: 'XMarket Squamish',
      category: 'Retail & Shopping',
      rating: 5,
      reviews: 24,
      address: '38027 Cleveland Ave',
      phone: '(604) 390-1079',
      website: '',
      email: ''
    },
    {
      id: 's576',
      name: 'Xoco Chocolate Co',
      category: 'Cafes & Bakeries',
      rating: 4.9,
      reviews: 134,
      address: '38020 Cleveland Ave',
      phone: '(604) 892-9446',
      website: '',
      email: 'info@xoco.ca'
    },
    {
      id: 's577',
      name: 'Yoshida Dubé Chartered Accountants',
      category: 'Accounting & Tax',
      rating: 4.3,
      reviews: 17,
      address: 'Squamish, BC',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's578',
      name: 'Zavitz Insurance & Wealth',
      category: 'Insurance',
      rating: 5,
      reviews: 4,
      address: '101-39666 Government Rd',
      phone: '(604) 702-9890',
      website: 'hubinternational.com',
      email: 'jarrett@zavitzinsurance.com'
    },
    {
      id: 's579',
      name: 'Zephyr Cafe',
      category: 'Cafes & Bakeries',
      rating: 4.4,
      reviews: 1138,
      address: '38084 Cleveland Ave',
      phone: '(604) 815-2843',
      website: 'https://zephyrcafe.ca',
      email: 'info@zephyrcafe.ca'
    },
    {
      id: 's580',
      name: 'Zephyr Café at The BAG',
      category: 'Restaurants & Dining',
      rating: 4.4,
      reviews: 1138,
      address: '38127 2nd Ave',
      phone: '604-898-3333',
      website: 'zephyrcafe.ca',
      email: ''
    },
    {
      id: 's561',
      name: 'Fergie\'s Café',
      category: 'Restaurants & Dining',
      rating: null,
      reviews: null,
      address: '70002 Squamish Valley Rd, Brackendale',
      phone: '604-892-0254',
      website: 'fergiescafe.ca',
      email: 'fergies@sunwolf.net'
    },
    {
      id: 's562',
      name: 'Chef Big D\'s Restaurant & Grill',
      category: 'Restaurants & Dining',
      rating: null,
      reviews: null,
      address: '38042 Cleveland Ave',
      phone: '604-567-3330',
      website: '',
      email: ''
    },
    {
      id: 's563',
      name: 'Steve\'s Poké Bar',
      category: 'Restaurants & Dining',
      rating: null,
      reviews: null,
      address: 'A2-38355 Cleveland Ave',
      phone: '(604) 567-7653',
      website: '',
      email: ''
    },
    {
      id: 's564',
      name: 'Gillespie\'s Fine Spirits',
      category: 'Breweries & Distilleries',
      rating: null,
      reviews: null,
      address: '8-38918 Progress Way',
      phone: '(604) 390-1122',
      website: '',
      email: 'info@gillespiesfinespirits.com'
    },
    {
      id: 's565',
      name: 'Altus Mountain Guides',
      category: 'Outdoor Activities',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 848-8543',
      website: 'altusmountainguides.com',
      email: 'info@altusmountainguides.com'
    },
    {
      id: 's566',
      name: 'Pearl\'s Value & Vintage',
      category: 'Retail & Shopping',
      rating: null,
      reviews: null,
      address: '38130 Cleveland Ave',
      phone: '(604) 892-5699',
      website: '',
      email: ''
    },
    {
      id: 's567',
      name: 'Stong\'s Market',
      category: 'Retail & Shopping',
      rating: null,
      reviews: null,
      address: '38078 Cleveland Ave',
      phone: '(604) 567-9444',
      website: '',
      email: ''
    },
    {
      id: 's568',
      name: 'Anna\'s Interiors',
      category: 'Retail & Shopping',
      rating: null,
      reviews: null,
      address: '38052 Cleveland Ave',
      phone: '(604) 892-6369',
      website: '',
      email: 'info@annasinteriors.ca'
    },
    {
      id: 's569',
      name: 'First Peak Contracting',
      category: 'Construction & Contractors',
      rating: null,
      reviews: null,
      address: '38146 Behrner Dr',
      phone: '604-898-9011',
      website: 'firstpeakcontracting.com',
      email: 'hello@firstpeakcontracting.com'
    },
    {
      id: 's570',
      name: 'WoodRidge Construction',
      category: 'Construction & Contractors',
      rating: null,
      reviews: null,
      address: 'Squamish',
      phone: '(604) 390-0087',
      website: 'woodridge.build',
      email: 'info@woodridge.build'
    },
    {
      id: 's571',
      name: 'Schreyer Construction',
      category: 'Construction & Contractors',
      rating: null,
      reviews: null,
      address: 'Squamish',
      phone: '604-932-1116',
      website: 'schreyerconstruction.com',
      email: 'katarina@schreyerconstruction.com'
    },
    {
      id: 's572',
      name: 'Timber Wolf Homes Ltd',
      category: 'Construction & Contractors',
      rating: null,
      reviews: null,
      address: '1122 Pioneer St',
      phone: '604-815-9977',
      website: '',
      email: ''
    },
    {
      id: 's573',
      name: 'Howe Sound Secondary Pool',
      category: 'Fitness & Wellness',
      rating: null,
      reviews: null,
      address: '38430 Buckley Ave',
      phone: '(604) 892-5261',
      website: '',
      email: 'hss@sd48.bc.ca'
    },
    {
      id: 's574',
      name: 'Engel & Völkers Squamish',
      category: 'Real Estate',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(778) 733-0611',
      website: 'squamish.evrealestate.com',
      email: ''
    },
    {
      id: 's575',
      name: 'Hunters Automotive Services',
      category: 'Auto Services',
      rating: null,
      reviews: null,
      address: '122-39002 Discovery Way, Squamish, BC V8B 0E5',
      phone: '(604) 815-4418',
      website: '',
      email: 'huntersauto@shaw.ca'
    },
    {
      id: 's576',
      name: 'Jonny Mechanic (Mobile)',
      category: 'Auto Services',
      rating: null,
      reviews: null,
      address: 'Squamish',
      phone: '(250) 341-1853',
      website: 'squamishmechanic.ca',
      email: ''
    },
    {
      id: 's577',
      name: 'Squamish Law Corporation',
      category: 'Professional Services',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-1763',
      website: '',
      email: ''
    },
    {
      id: 's578',
      name: 'Squamish Elementary School',
      category: 'Education',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9307',
      website: '',
      email: 'squamish@sd48.bc.ca'
    },
    {
      id: 's579',
      name: 'Howe Sound Secondary School',
      category: 'Education',
      rating: null,
      reviews: null,
      address: '38430 Buckley Ave',
      phone: '(604) 892-5261',
      website: '',
      email: 'hss@sd48.bc.ca'
    },
    {
      id: 's580',
      name: 'Squamish RCMP',
      category: 'Government',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-6100',
      website: '',
      email: ''
    },
    {
      id: 's581',
      name: 'Squamish Fire Rescue',
      category: 'Government',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-9666',
      website: '',
      email: 'sfr@squamish.ca'
    },
    {
      id: 's582',
      name: 'BC Ambulance Service',
      category: 'Government',
      rating: null,
      reviews: null,
      address: '1005 B Industrial Way',
      phone: '911',
      website: '',
      email: ''
    },
    {
      id: 's583',
      name: 'Stawamus Chief Provincial Park',
      category: 'Attractions',
      rating: null,
      reviews: null,
      address: '36800 Highway 99, Squamish, BC',
      phone: '',
      website: '',
      email: 'info@bcparks.ca'
    },
    {
      id: 's584',
      name: 'Totem Preschool (Squamish Nation)',
      category: 'Childcare & Education',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-9015',
      website: 'squamish.net',
      email: ''
    },
    {
      id: 's585',
      name: 'Hawthorn Landscape',
      category: 'Landscaping & Lawn Care',
      rating: null,
      reviews: null,
      address: 'Squamish (mobile service)',
      phone: '(778) 970-0933',
      website: 'hawthornlandscape.ca',
      email: 'info@hawthornlandscape.ca'
    },
    {
      id: 's586',
      name: 'Perfect Pitch Landscaping',
      category: 'Landscaping & Lawn Care',
      rating: null,
      reviews: null,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: 'info@perfectpitchlandscaping.ca'
    },
    {
      id: 's587',
      name: 'DesRoche Property Maintenance',
      category: 'Landscaping & Lawn Care',
      rating: null,
      reviews: null,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's588',
      name: 'Jim\'s Mowing Squamish',
      category: 'Landscaping & Lawn Care',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '1-833-999-5467',
      website: 'jimsmowing.ca',
      email: ''
    },
    {
      id: 's589',
      name: 'R.A.W. Home Services',
      category: 'Cleaning Services',
      rating: null,
      reviews: null,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's590',
      name: 'Elena\'s Cleaning Services',
      category: 'Cleaning Services',
      rating: null,
      reviews: null,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's591',
      name: 'JB Candid Photo',
      category: 'Photography',
      rating: null,
      reviews: null,
      address: 'Squamish (home studio)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's592',
      name: 'Sea to Sky Art House',
      category: 'Arts & Culture',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's593',
      name: 'Geometry Mural Company',
      category: 'Arts & Culture',
      rating: null,
      reviews: null,
      address: 'Squamish (mobile service)',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's594',
      name: 'Substrate Studios',
      category: 'Web & Marketing',
      rating: null,
      reviews: null,
      address: 'Squamish (home office)',
      phone: '',
      website: 'substratestudios.ca',
      email: 'hello@substratestudios.ca'
    },
    {
      id: 's595',
      name: 'LevelUp Web Agency',
      category: 'Web & Marketing',
      rating: null,
      reviews: null,
      address: 'Squamish (home office)',
      phone: '(778) 266-0169',
      website: 'levelupwebdesign.ca',
      email: 'info@levelupwebdesign.ca'
    },
    {
      id: 's596',
      name: 'L8P Digital Marketing',
      category: 'Web & Marketing',
      rating: null,
      reviews: null,
      address: '38146 Behrner Dr',
      phone: '604-848-4104',
      website: 'l8p.ca',
      email: 'info@l8p.ca'
    },
    {
      id: 's597',
      name: 'Fullstack Web Studio',
      category: 'Web & Marketing',
      rating: null,
      reviews: null,
      address: '2000 Diamond Road, Squamish, BC V0N 1T0',
      phone: '',
      website: '',
      email: ''
    },
    {
      id: 's598',
      name: 'Nomatik Design',
      category: 'Web & Marketing',
      rating: null,
      reviews: null,
      address: 'Squamish (home office)',
      phone: '',
      website: '',
      email: 'steph@nomatik.ca'
    },
    {
      id: 's599',
      name: 'Darcie Schellenberg Notary Corporation',
      category: 'Notaries',
      rating: null,
      reviews: null,
      address: '301-37989 Cleveland Ave',
      phone: '(604) 815-4811',
      website: 'dsnotary.ca',
      email: 'info@dsnotary.ca'
    },
    {
      id: 's600',
      name: 'The River Church',
      category: 'Churches & Religious',
      rating: null,
      reviews: null,
      address: '38127 2nd Ave',
      phone: '',
      website: 'intheriver.ca',
      email: 'riverchurchinsquamish@gmail.com'
    },
    {
      id: 's601',
      name: 'Communities That Care Squamish',
      category: 'Non-Profits & Community',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '604-849-2252',
      website: '',
      email: ''
    },
    {
      id: 's602',
      name: 'Community Futures of Howe Sound',
      category: 'Non-Profits & Community',
      rating: null,
      reviews: null,
      address: '102-1909 Maple Dr, Squamish, BC V8B 0T1',
      phone: '(604) 892-5467',
      website: '',
      email: 'info@cfhowesound.com'
    },
    {
      id: 's603',
      name: 'Seed Studio',
      category: 'Pilates/Massage/Acupuncture',
      rating: null,
      reviews: null,
      address: '38018 Cleveland Ave',
      phone: '(604) 390-0033',
      website: 'https://seedsquamish.com',
      email: 'info@seedsquamish.com'
    },
    {
      id: 's604',
      name: 'Chief Yoga and Wellness',
      category: 'Yoga Studio',
      rating: null,
      reviews: null,
      address: '38033 Cleveland Ave',
      phone: '(604) 849-4626',
      website: 'https://chiefyoga.ca',
      email: 'info@chiefyoga.ca'
    },
    {
      id: 's605',
      name: 'Anchor Health and Wellness',
      category: 'Massage Therapy/Rmt',
      rating: null,
      reviews: null,
      address: '38129 2nd Ave',
      phone: '(604) 390-0044',
      website: 'https://anchorsquamish.ca',
      email: 'info@anchorsquamish.ca'
    },
    {
      id: 's606',
      name: 'Be The Way Guidance & Counselling',
      category: 'Counselling',
      rating: null,
      reviews: null,
      address: '38127 2nd Ave',
      phone: '(604) 815-0100',
      website: 'https://betheway.ca',
      email: 'info@betheway.ca'
    },
    {
      id: 's607',
      name: 'Sea to Sky Eye Care',
      category: 'Optometrist',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 892-5020',
      website: 'https://seatoskyeyecare.ca',
      email: 'info@seatoskyeyecare.ca'
    },
    {
      id: 's608',
      name: 'Pawsitive Training',
      category: 'Dog Training',
      rating: null,
      reviews: null,
      address: '38129 2nd Ave',
      phone: '(604) 390-0123',
      website: 'https://pawsitivetraining.ca',
      email: 'info@pawsitivetraining.ca'
    },
    {
      id: 's609',
      name: 'Happy Tails Pet Sitting',
      category: 'Pet Sitting',
      rating: null,
      reviews: null,
      address: '38146 Behrner Dr',
      phone: '(604) 390-5678',
      website: 'https://happytailssquamish.ca',
      email: 'info@happytailssquamish.ca'
    },
    {
      id: 's610',
      name: 'Hunter\'s Automotive Services',
      category: 'Auto Repair',
      rating: null,
      reviews: null,
      address: '38925 Queens Way',
      phone: '(604) 892-3322',
      website: 'https://huntersauto.ca',
      email: 'info@huntersauto.ca'
    },
    {
      id: 's611',
      name: 'Noble House',
      category: 'Hair Salon/Barber',
      rating: null,
      reviews: null,
      address: '38012 Cleveland Ave',
      phone: '(604) 390-0011',
      website: 'https://noblehousesquamish.com',
      email: 'info@noblehousesquamish.com'
    },
    {
      id: 's612',
      name: 'Sea to Sky Nails and Lashes',
      category: 'Nail Salon',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 390-5555',
      website: 'https://seatoskynails.ca',
      email: 'info@seatoskynails.ca'
    },
    {
      id: 's613',
      name: 'BettyNaiLash',
      category: 'Nails/Lashes',
      rating: null,
      reviews: null,
      address: '38020 Cleveland Ave',
      phone: '(604) 390-1122',
      website: 'https://bettynailash.ca',
      email: 'info@bettynailash.ca'
    },
    {
      id: 's614',
      name: 'RS Heating & Plumbing',
      category: 'Heating/Plumbing',
      rating: null,
      reviews: null,
      address: '38146 Behrner Dr',
      phone: '(604) 892-5433',
      website: 'https://rsheating.ca',
      email: 'info@rsheating.ca'
    },
    {
      id: 's615',
      name: 'CustomAir Sea to Sky',
      category: 'Hvac',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 892-8822',
      website: 'https://customair.ca',
      email: 'squamish@customair.ca'
    },
    {
      id: 's616',
      name: 'Sea to Sky Roofing',
      category: 'Roofing',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 898-1234',
      website: 'https://seatoskyroofing.ca',
      email: 'info@seatoskyroofing.ca'
    },
    {
      id: 's617',
      name: 'Rexall Squamish',
      category: 'Pharmacy',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-3456',
      website: 'https://rexall.ca',
      email: 'squamish@rexall.ca'
    },
    {
      id: 's618',
      name: 'The Squamish Store',
      category: 'Gift Shop/Souvenirs',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-4994',
      website: 'https://tourismsquamish.com',
      email: 'info@tourismsquamish.com'
    },
    {
      id: 's619',
      name: 'Kitchen Quickies',
      category: 'Kitchen/Home Store',
      rating: null,
      reviews: null,
      address: '38145 Cleveland Ave',
      phone: '(604) 892-9990',
      website: 'https://kitchenquickies.ca',
      email: 'info@kitchenquickies.ca'
    },
    {
      id: 's620',
      name: 'Sea to Sky Books',
      category: 'Bookstore',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 892-3612',
      website: 'https://seatoskybooks.ca',
      email: 'info@seatoskybooks.ca'
    },
    {
      id: 's621',
      name: 'Royal LePage Black Tusk Realty',
      category: 'Real Estate',
      rating: null,
      reviews: null,
      address: '3-1900 Garibaldi Way',
      phone: '(604) 892-5557',
      website: 'https://blacktuskrealty.ca',
      email: 'info@blacktuskrealty.ca'
    },
    {
      id: 's622',
      name: 'Sutton West Coast Realty',
      category: 'Real Estate',
      rating: null,
      reviews: null,
      address: '38129 2nd Ave',
      phone: '(604) 892-5557',
      website: 'https://suttonwestcoast.com',
      email: 'squamish@suttonwestcoast.com'
    },
    {
      id: 's623',
      name: 'Pemberton Holmes Squamish',
      category: 'Real Estate',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5590',
      website: 'https://pembertonholmes.com',
      email: 'squamish@pembertonholmes.com'
    },
    {
      id: 's624',
      name: 'Darcie Schellenberg Notary',
      category: 'Notary Public',
      rating: null,
      reviews: null,
      address: '301-37989 Cleveland Ave',
      phone: '(604) 892-5290',
      website: 'https://dsnotary.ca',
      email: 'info@dsnotary.ca'
    },
    {
      id: 's625',
      name: 'Squamish Montessori School',
      category: 'Preschool/Montessori',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5502',
      website: 'https://squamishmontessori.ca',
      email: 'michelle@smsed.ca'
    },
    {
      id: 's626',
      name: 'Sea to Sky Learning',
      category: 'Tutoring',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-1234',
      website: 'https://seatoskylearning.ca',
      email: 'info@seatoskylearning.ca'
    },
    {
      id: 's627',
      name: 'Flipside Burgers',
      category: 'Burgers',
      rating: null,
      reviews: null,
      address: '38117 2nd Ave',
      phone: '(604) 815-1330',
      website: 'https://flipsideburgers.ca',
      email: 'info@flipsideburgers.ca'
    },
    {
      id: 's628',
      name: 'Domino\'s Pizza Squamish',
      category: 'Pizza',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-4444',
      website: 'https://dominos.ca',
      email: 'squamish@dominos.ca'
    },
    {
      id: 's629',
      name: 'McDonald\'s Squamish',
      category: 'Fast Food',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 898-3922',
      website: 'https://mcdonalds.ca',
      email: 'squamish@mcdonalds.ca'
    },
    {
      id: 's630',
      name: 'Wendy\'s Squamish',
      category: 'Fast Food',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-2002',
      website: 'https://wendys.ca',
      email: 'squamish@wendys.ca'
    },
    {
      id: 's631',
      name: 'Staples Squamish',
      category: 'Office Supplies/Printing',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 892-5566',
      website: 'https://staples.ca',
      email: 'squamish@staples.ca'
    },
    {
      id: 's632',
      name: 'Sea to Sky Music School',
      category: 'Music School',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-4433',
      website: 'https://seatoskymusic.ca',
      email: 'info@seatoskymusic.ca'
    },
    {
      id: 's633',
      name: 'Squamish Cleaning Services',
      category: 'Cleaning Services',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-9876',
      website: 'https://squamishcleaning.ca',
      email: 'info@squamishcleaning.ca'
    },
    {
      id: 's634',
      name: 'Squamish Security Services',
      category: 'Security Services',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-7654',
      website: 'https://squamishsecurity.ca',
      email: 'info@squamishsecurity.ca'
    },
    {
      id: 's635',
      name: 'Peak Body Training - Marcy Peaker',
      category: 'Fitness & Wellness',
      rating: null,
      reviews: null,
      address: 'Squamish',
      phone: '(604) 815-2801',
      website: 'https://peakbodytraining.com',
      email: 'marcy@peakbodytraining.com'
    },
    {
      id: 's636',
      name: 'Summit Fitness Squamish',
      category: 'Fitness & Wellness',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2802',
      website: 'https://mysummitfitness.com',
      email: 'info@mysummitfitness.com'
    },
    {
      id: 's637',
      name: 'Pinnacle Fitness Squamish',
      category: 'Fitness & Wellness',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2803',
      website: 'https://pinnaclefitness.co',
      email: 'info@pinnaclefitness.co'
    },
    {
      id: 's638',
      name: 'Mountain Strong Fitness',
      category: 'Fitness/Strength Training',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2805',
      website: 'https://mountainstrongfitness.ca',
      email: 'info@mountainstrongfitness.ca'
    },
    {
      id: 's639',
      name: 'Sea to Sky Fitness',
      category: 'Fitness Studio',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2806',
      website: 'https://seatoskyfitness.ca',
      email: 'info@seatoskyfitness.ca'
    },
    {
      id: 's640',
      name: 'Elevation Performance',
      category: 'Sports Performance',
      rating: null,
      reviews: null,
      address: '38929 Progress Way',
      phone: '(604) 815-2807',
      website: 'https://elevationperformance.ca',
      email: 'info@elevationperformance.ca'
    },
    {
      id: 's641',
      name: 'Chang\'s Clinic Acupuncture',
      category: 'Acupuncture/Herbs',
      rating: null,
      reviews: null,
      address: '38155 2nd Ave',
      phone: '(604) 815-2812',
      website: 'https://squamishneedle.com',
      email: 'info@squamishneedle.com'
    },
    {
      id: 's642',
      name: 'Terri\'s TCM & Colonics',
      category: 'Acupuncture/Colonics',
      rating: null,
      reviews: null,
      address: '38129 2nd Ave',
      phone: '(604) 815-2813',
      website: 'https://tcmcolonics.com',
      email: 'info@tcmcolonics.com'
    },
    {
      id: 's643',
      name: 'Sea to Sky Holistic Health',
      category: 'Holistic Health',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2814',
      website: 'https://seatoskyholistichealth.ca',
      email: 'info@seatoskyholistichealth.ca'
    },
    {
      id: 's644',
      name: 'Mountain Healing Arts',
      category: 'Holistic Health',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2815',
      website: 'https://mountainhealingarts.ca',
      email: 'info@mountainhealingarts.ca'
    },
    {
      id: 's645',
      name: 'Howe Sound Adventures',
      category: 'Adventure Tours',
      rating: null,
      reviews: null,
      address: 'Squamish',
      phone: '(604) 815-2824',
      website: 'https://howesoundadventures.ca',
      email: 'info@howesoundadventures.ca'
    },
    {
      id: 's646',
      name: 'A-Frame Brewing',
      category: 'Craft Brewery',
      rating: null,
      reviews: null,
      address: '38918 Progress Way',
      phone: '(604) 892-0777',
      website: 'https://aframebrewing.com',
      email: 'info@aframebrewing.com'
    },
    {
      id: 's647',
      name: 'Chef Big D\'s',
      category: 'Bbq/American',
      rating: null,
      reviews: null,
      address: '38147 Cleveland Ave',
      phone: '(604) 815-2835',
      website: 'https://chefbigd.ca',
      email: 'info@chefbigd.ca'
    },
    {
      id: 's648',
      name: 'Mag\'s 99 Diner',
      category: 'Diner',
      rating: null,
      reviews: null,
      address: '40261 Government Rd',
      phone: '(604) 815-2844',
      website: 'https://mags99diner.ca',
      email: 'info@mags99diner.ca'
    },
    {
      id: 's649',
      name: 'Norman Rudy\'s',
      category: 'Restaurant/Pub',
      rating: null,
      reviews: null,
      address: '40900 Tantalus Rd',
      phone: '(604) 815-7978',
      website: 'https://normanrudys.com',
      email: 'info@normanrudys.ca'
    },
    {
      id: 's650',
      name: 'One Earth',
      category: 'Gift Shop',
      rating: null,
      reviews: null,
      address: '38020 Cleveland Ave',
      phone: '(604) 815-2860',
      website: 'https://oneearth.ca',
      email: 'info@oneearth.ca'
    },
    {
      id: 's651',
      name: 'Oracle Emporium',
      category: 'Metaphysical Shop',
      rating: null,
      reviews: null,
      address: '38020 Cleveland Ave',
      phone: '(604) 815-2866',
      website: 'https://oracleemporium.ca',
      email: 'info@oracleemporium.ca'
    },
    {
      id: 's652',
      name: 'Little Fern Baby & Kids',
      category: 'Baby/Kids Clothing',
      rating: null,
      reviews: null,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2867',
      website: 'https://littlefern.ca',
      email: 'info@littlefern.ca'
    },
    {
      id: 's653',
      name: 'Squamish Law Group',
      category: 'Law Firm',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2890',
      website: 'https://squamishlawgroup.ca',
      email: 'info@squamishlawgroup.ca'
    },
    {
      id: 's654',
      name: 'Murray Fenton CPA',
      category: 'Accounting',
      rating: null,
      reviews: null,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-2891',
      website: 'https://murrayfentoncpa.ca',
      email: 'info@murrayfentoncpa.ca'
    },
    {
      id: 's655',
      name: 'Squamish Property Management',
      category: 'Property Management',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2897',
      website: 'https://squamishpm.ca',
      email: 'info@squamishpm.ca'
    },
    {
      id: 's656',
      name: 'Sea to Sky Builders',
      category: 'Home Builder',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2899',
      website: 'https://seatoskybuilders.ca',
      email: 'info@seatoskybuilders.ca'
    },
    {
      id: 's657',
      name: 'Coastal Carpentry',
      category: 'Carpentry',
      rating: null,
      reviews: null,
      address: 'Squamish',
      phone: '(604) 815-2901',
      website: 'https://coastalcarpentry.ca',
      email: 'info@coastalcarpentry.ca'
    },
    {
      id: 's658',
      name: 'Tantalus Electric',
      category: 'Electrical',
      rating: null,
      reviews: null,
      address: '38924 Queens Way',
      phone: '(604) 815-2904',
      website: 'https://tantaluselectric.ca',
      email: 'info@tantaluselectric.ca'
    },
    {
      id: 's659',
      name: 'Squamish Glass & Mirror',
      category: 'Glass/Windows',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2905',
      website: 'https://squamishglass.ca',
      email: 'info@squamishglass.ca'
    },
    {
      id: 's660',
      name: 'Sea to Sky Windows & Doors',
      category: 'Windows/Doors',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2906',
      website: 'https://seatoskywindows.ca',
      email: 'info@seatoskywindows.ca'
    },
    {
      id: 's661',
      name: 'Don Ross Middle School',
      category: 'Middle School',
      rating: null,
      reviews: null,
      address: '40433 Friedel Cres',
      phone: '(604) 892-9307',
      website: 'https://sd48.bc.ca',
      email: 'donross@sd48.bc.ca'
    },
    {
      id: 's662',
      name: 'West Coast Railway Heritage Park',
      category: 'Heritage Railway',
      rating: null,
      reviews: null,
      address: '39645 Government Rd',
      phone: '(604) 898-9336',
      website: 'https://wcra.org',
      email: 'info@wcra.org'
    },
    {
      id: 's663',
      name: 'Squamish Volunteer Fire Department',
      category: 'Fire Department',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2930',
      website: 'https://squamish.ca',
      email: 'fire@squamish.ca'
    },
    {
      id: 's664',
      name: 'Squamish Triathlon Club',
      category: 'Triathlon Club',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2936',
      website: 'https://squamishtri.ca',
      email: 'info@squamishtri.ca'
    },
    {
      id: 's665',
      name: 'Mountain Digital Media',
      category: 'Digital Marketing',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2945',
      website: 'https://mountaindigitalmedia.ca',
      email: 'info@mountaindigitalmedia.ca'
    },
    {
      id: 's666',
      name: 'Squamish Connector Bus',
      category: 'Bus Service',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2950',
      website: 'https://squamishconnector.ca',
      email: 'info@squamishconnector.ca'
    },
    {
      id: 's667',
      name: 'Mountain Occasions',
      category: 'Event Planning',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2954',
      website: 'https://mountainoccasions.ca',
      email: 'info@mountainoccasions.ca'
    },
    {
      id: 's668',
      name: 'Blossoms by the Sea',
      category: 'Florist',
      rating: null,
      reviews: null,
      address: '38127 2nd Ave',
      phone: '(604) 815-2956',
      website: 'https://blossomsbythesea.ca',
      email: 'info@blossomsbythesea.ca'
    },
    {
      id: 's669',
      name: 'Rain Forest Dogs',
      category: 'Hot Dogs',
      rating: null,
      reviews: null,
      address: '38127 2nd Ave',
      phone: '(604) 815-2958',
      website: 'https://rainforestdogs.ca',
      email: 'info@rainforestdogs.ca'
    },
    {
      id: 's670',
      name: 'Mountain Woman Coffee',
      category: 'Coffee Roaster',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2959',
      website: 'https://mountainwomancoffee.ca',
      email: 'info@mountainwomancoffee.ca'
    },
    {
      id: 's671',
      name: 'Sea to Sky Doula Services',
      category: 'Doula Services',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-2964',
      website: 'https://seatoskydoula.ca',
      email: 'info@seatoskydoula.ca'
    },
    {
      id: 's672',
      name: 'Squamish Design Co',
      category: 'Graphic Design',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2970',
      website: 'https://squamishdesign.ca',
      email: 'info@squamishdesign.ca'
    },
    {
      id: 's673',
      name: 'Mountain Pest Control',
      category: 'Pest Control',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-2978',
      website: 'https://mountainpestcontrol.ca',
      email: 'info@mountainpestcontrol.ca'
    },
    {
      id: 's674',
      name: 'Squamish Septic Services',
      category: 'Septic Services',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-2980',
      website: 'https://squamishseptic.ca',
      email: 'info@squamishseptic.ca'
    },
    {
      id: 's675',
      name: 'Pin Drop Real Estate Team',
      category: 'Real Estate Team',
      rating: null,
      reviews: null,
      address: '38090 Cleveland Ave',
      phone: '(604) 815-3003',
      website: 'https://pindroprealestate.ca',
      email: 'info@pindroprealestate.ca'
    },
    {
      id: 's676',
      name: 'Jenna Franze - Stilhavn Real Estate',
      category: 'Real Estate',
      rating: null,
      reviews: null,
      address: '1388 Main Street, Squamish, BC V8B 1A4',
      phone: '(604) 398-7999',
      website: 'https://jennafranze.ca',
      email: 'jenna@jennafranze.ca'
    },
    {
      id: 's677',
      name: 'Team Kelly Mortgage Specialists',
      category: 'Mortgage Broker',
      rating: null,
      reviews: null,
      address: '38145 Cleveland Ave',
      phone: '(604) 815-3006',
      website: 'https://teamkelly.ca',
      email: 'michelle@teamkelly.ca'
    },
    {
      id: 's678',
      name: 'Sea to Sky Mortgages',
      category: 'Mortgage Broker',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3007',
      website: 'https://seatoskymortgages.ca',
      email: 'info@seatoskymortgages.ca'
    },
    {
      id: 's679',
      name: 'Mountain Masonry',
      category: 'Masonry',
      rating: null,
      reviews: null,
      address: '200-1410 Alpha Lake Rd, Whistler (serves Squamish)',
      phone: '(604) 815-3018',
      website: 'https://mountainmasonry.ca',
      email: 'info@mountainmasonry.ca'
    },
    {
      id: 's680',
      name: 'Squamish Soccer Association',
      category: 'Soccer Club',
      rating: null,
      reviews: null,
      address: '38027 Cleveland Ave',
      phone: '(604) 815-3025',
      website: 'https://squamishsoccer.ca',
      email: 'info@squamishsoccer.ca'
    },
    {
      id: 's681',
      name: 'St. John\'s Anglican Church',
      category: 'Church',
      rating: null,
      reviews: null,
      address: '1930 Diamond Rd',
      phone: '(604) 898-5100',
      website: 'https://stjohnssquamish.ca',
      email: 'info@stjohnssquamish.ca'
    },
    {
      id: 's682',
      name: 'Sea to Sky Church',
      category: 'Church',
      rating: null,
      reviews: null,
      address: '38024 Fourth Ave',
      phone: '(604) 815-3031',
      website: 'https://seatoskychurch.ca',
      email: 'info@seatoskychurch.ca'
    },
    {
      id: 's683',
      name: 'Serenity Wellness Spa',
      category: 'Day Spa',
      rating: null,
      reviews: null,
      address: '38155 2nd Ave',
      phone: '(604) 815-3048',
      website: 'https://serenityspasquamish.ca',
      email: 'info@serenityspasquamish.ca'
    }
  ]


};

// Expand recurring weekly events across the full week

// Service categories for filtering
const SERVICE_CATEGORIES = [
  'All',
  'Accounting & Tax',
  'Arts & Culture',
  'Attractions',
  'Auto Services',
  'Breweries & Distilleries',
  'Cafes & Bakeries',
  'Campgrounds',
  'Catering',
  'Childcare',
  'Churches & Religious',
  'Community Services',
  'Construction & Building',
  'Couriers & Delivery',
  'Creative Services',
  'Dance & Movement',
  'Dental',
  'Dry Cleaning & Laundry',
  'Education',
  'Electrical',
  'Emergency Services',
  'Energy & Utilities',
  'Entertainment',
  'Event Services',
  'Event Venues',
  'Events & Festivals',
  'Farms & Markets',
  'Financial Services',
  'Fitness & Gyms',
  'Flooring',
  'Food Trucks',
  'Funeral Services',
  'Government',
  'Grocery & Markets',
  'Health & Wellness',
  'Healthcare',
  'Home Improvement',
  'Hotels & Lodging',
  'Ice Cream & Desserts',
  'Industry',
  'Insurance',
  'Landscaping',
  'Legal Services',
  'Marine Services',
  'Martial Arts',
  'Massage & Bodywork',
  'Media',
  'Medical Clinics',
  'Mental Health',
  'Moving & Storage',
  'Notaries',
  'Optometry & Vision',
  'Outdoor Adventures',
  'Outdoor Gear & Shops',
  'Paving',
  'Pet Services',
  'Pharmacy',
  'Photography',
  'Physiotherapy & Rehab',
  'Plumbing & HVAC',
  'Postal & Shipping',
  'Printing & Signs',
  'Professional Services',
  'Real Estate',
  'Recreation & Sports',
  'Repair Services',
  'Restaurants & Dining',
  'Retail & Shopping',
  'Roofing',
  'Salons & Spas',
  'Specialty Food',
  'Squamish Nation',
  'Technology & IT',
  'Transportation',
  'Veterinary',
  'Web & Marketing',
  'Yoga & Pilates'
];

const expandRecurringEvents = (baseEvents) => {
  const expanded = [];
  let idCounter = 1;
  
  baseEvents.forEach(event => {
    if (event.recurrence === 'weekly') {
      // Generate for 7 days (Mon-Sun)
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const newStart = new Date(event.start);
        newStart.setDate(newStart.getDate() + dayOffset);
        const newEnd = new Date(event.end);
        newEnd.setDate(newEnd.getDate() + dayOffset);
        
        expanded.push({
          ...event,
          id: `e${idCounter++}`,
          start: newStart,
          end: newEnd
        });
      }
    } else {
      expanded.push({...event, id: `e${idCounter++}`});
    }
  });
  
  return expanded;
};

// NOTE: Don't call expandRecurringEvents here - it's already called in realData.js
// Calling it twice causes 4x duplication (see CLAUDE-ARCHIVE.md)

// Smart Deal Title Generator - creates clean, compelling titles (max ~50 chars)
const generateSmartDealTitle = (deal, venueName = '') => {
  const { title = '' } = deal;

  // Generic titles that need enhancement
  const genericTitles = ['happy hour', 'family night', 'date night', 'special', 'deal', 'promo', 'offer'];
  const isGeneric = genericTitles.some(g => title.toLowerCase().trim() === g);

  // Check if title already looks good (has price/value and is reasonable length)
  const hasGoodValue = /\$\d+|\d+%|free|half price|bogo/i.test(title);
  if (hasGoodValue && title.length <= 45 && !isGeneric) {
    return title;
  }

  // For generic titles, add venue name
  if (isGeneric && venueName) {
    return `${title} @ ${venueName}`;
  }

  // If title is too long, try to shorten it smartly
  if (title.length > 45) {
    // Try to cut at a natural break point
    const shortened = title.substring(0, 42);
    const lastSpace = shortened.lastIndexOf(' ');
    if (lastSpace > 25) {
      return shortened.substring(0, lastSpace) + '...';
    }
    return shortened + '...';
  }

  return title || 'Special Offer';
};

// Enhanced Deal Description Generator - creates rich, informative descriptions
const generateEnhancedDealDescription = (deal, venueName = '') => {
  const { title = '', description = '', category = '', discount = '', schedule = '' } = deal;
  const businessName = venueName || deal.venueName || 'this local business';

  // If there's already a UNIQUE good description (different from title, > 80 chars), use it enhanced
  if (description && description.length > 80 && description.toLowerCase() !== title.toLowerCase()) {
    return `${description} Available at ${businessName}. Stop by to take advantage of this offer!`;
  }

  // Build a rich, informative description
  const parts = [];

  // Start with what the deal IS (the key offer)
  const dealOffer = title || description || 'Special offer';

  // Category-specific context
  const categoryContext = {
    'Food & Drink': `Hungry? ${businessName} has you covered with this deal: ${dealOffer}.`,
    'Retail': `Looking to save? Check out this offer from ${businessName}: ${dealOffer}.`,
    'Health & Wellness': `Invest in yourself with this special from ${businessName}: ${dealOffer}.`,
    'Entertainment': `Fun awaits at ${businessName}! ${dealOffer}.`,
    'Services': `${businessName} is offering: ${dealOffer}.`,
    'Beauty': `Treat yourself at ${businessName}: ${dealOffer}.`,
    'Fitness': `Get active and save at ${businessName}: ${dealOffer}.`,
    'Other': `${businessName} presents: ${dealOffer}.`
  };

  parts.push(categoryContext[category] || categoryContext['Other']);

  // Add schedule prominently
  if (schedule && schedule.toLowerCase() !== 'anytime') {
    parts.push(`This deal is available ${schedule}.`);
  }

  // Add discount info if different from title
  if (discount && !title.toLowerCase().includes(discount.toLowerCase())) {
    parts.push(`Save ${discount}!`);
  }

  // Add extra detail if description has more info than title
  if (description && description.length > 10 && description.toLowerCase() !== title.toLowerCase()) {
    const cleanDesc = description.replace(/\.$/, '');
    if (!parts[0].toLowerCase().includes(cleanDesc.toLowerCase())) {
      parts.push(cleanDesc + '.');
    }
  }

  // Closing call to action
  parts.push(`Don't miss out—visit ${businessName} and mention this deal!`);

  return parts.join(' ');
};

// Deal Category Normalizer - maps 40+ scraped categories to 8 UI categories
const DEAL_CATEGORY_MAP = {
  // Food & Drink
  'Food & Drink': 'Food & Drink',
  'Restaurants & Dining': 'Food & Drink',
  'Cafes & Bakeries': 'Food & Drink',
  'Breweries & Distilleries': 'Food & Drink',
  'Craft Brewery': 'Food & Drink',
  'Grocery & Markets': 'Food & Drink',
  'Farms & Markets': 'Food & Drink',
  'Catering': 'Food & Drink',

  // Fitness
  'Fitness': 'Fitness',
  'Fitness & Gyms': 'Fitness',
  'Fitness & Wellness': 'Fitness',
  'Yoga & Pilates': 'Fitness',

  // Wellness
  'Wellness': 'Wellness',
  'Health & Wellness': 'Wellness',
  'Medical Clinics': 'Wellness',
  'Dental': 'Wellness',
  'Pharmacy': 'Wellness',
  'Veterinary': 'Wellness',

  // Family
  'Family': 'Family',
  'Childcare': 'Family',
  'Childcare & Education': 'Family',
  'Middle School': 'Family',

  // Recreation & Entertainment
  'Recreation': 'Recreation',
  'Recreation & Sports': 'Recreation',
  'Entertainment': 'Recreation',
  'Outdoor Adventures': 'Recreation',
  'Arts & Culture': 'Recreation',
  'Events & Festivals': 'Recreation',
  'Attractions': 'Recreation',
  'Heritage Railway': 'Recreation',

  // Accommodations
  'Accommodations': 'Accommodations',
  'Hotels & Lodging': 'Accommodations',

  // Shopping & Retail
  'Shopping': 'Shopping',
  'Retail & Shopping': 'Shopping',
  'Outdoor Gear & Shops': 'Shopping',
  'Office Supplies/Printing': 'Shopping',

  // Services (catch-all for professional services)
  'Services': 'Services',
  'Auto Services': 'Services',
  'Financial Services': 'Services',
  'Notaries': 'Services',
  'Accounting & Tax': 'Services',
  'Event Services': 'Services',
  'Moving & Storage': 'Services',
  'Pest Control': 'Services',
  'Roofing': 'Services',
  'Hvac': 'Services',
  'Plumbing & HVAC': 'Services',
  'Postal & Shipping': 'Services',
  'Squamish Nation': 'Services'
};

// Normalize a deal's category to one of the UI categories
const normalizeDealCategory = (category) => {
  if (!category) return 'Other';
  return DEAL_CATEGORY_MAP[category] || 'Other';
};

// Deal Quality Scorer - ranks deals by actual value to surface the best ones
const calculateDealScore = (deal) => {
  let score = 0;

  // Extract discount info from various fields
  const discountValue = deal.discountValue || deal.discount_value || 0;
  const discountType = deal.discountType || deal.discount_type || '';
  const savingsPercent = deal.savingsPercent || 0;
  const originalPrice = deal.originalPrice || deal.original_price || 0;
  const dealPrice = deal.dealPrice || deal.deal_price || 0;
  const title = (deal.title || '').toLowerCase();
  const discount = (deal.discount || '').toLowerCase();

  // Parse percentage from title or discount string (e.g., "40% off", "Save 20%")
  const percentMatch = (title + ' ' + discount).match(/(\d+)\s*%/);
  const parsedPercent = percentMatch ? parseInt(percentMatch[1]) : 0;
  const effectivePercent = discountValue > 0 && discountType === 'percent' ? discountValue :
                          savingsPercent > 0 ? savingsPercent : parsedPercent;

  // Parse dollar amount from title (e.g., "$50 off", "Save $20")
  const dollarMatch = (title + ' ' + discount).match(/\$(\d+)/);
  const parsedDollar = dollarMatch ? parseInt(dollarMatch[1]) : 0;
  const effectiveDollar = discountValue > 0 && discountType === 'fixed' ? discountValue : parsedDollar;

  // Calculate actual savings if we have prices
  const actualSavings = originalPrice && dealPrice ? originalPrice - dealPrice : 0;

  // Score based on percentage discount
  if (effectivePercent >= 50) score += 100;
  else if (effectivePercent >= 40) score += 85;
  else if (effectivePercent >= 30) score += 70;
  else if (effectivePercent >= 20) score += 55;
  else if (effectivePercent >= 10) score += 40;

  // Score based on dollar savings
  if (effectiveDollar >= 100 || actualSavings >= 100) score += 90;
  else if (effectiveDollar >= 50 || actualSavings >= 50) score += 70;
  else if (effectiveDollar >= 25 || actualSavings >= 25) score += 50;
  else if (effectiveDollar >= 10 || actualSavings >= 10) score += 30;

  // Bonus for specific deal types
  if (title.includes('free') || discountType === 'free_item') score += 45;
  if (title.includes('bogo') || title.includes('buy one get one')) score += 60;
  if (title.includes('half price') || title.includes('1/2 price')) score += 55;

  // Bonus for having concrete pricing info
  if (dealPrice > 0) score += 10;
  if (originalPrice > 0 && dealPrice > 0) score += 15;

  // Featured deals get a boost
  if (deal.featured) score += 25;

  // Penalty for vague deals with no real value
  if (discountType === 'special' && !effectivePercent && !effectiveDollar && score < 20) {
    score = Math.max(5, score - 20);
  }

  return score;
};

// Get deal tier for visual badges
const _getDealTier = (deal) => {
  const score = calculateDealScore(deal);
  if (score >= 80) return { tier: 'hot', label: '🔥 Hot Deal', color: '#ef4444' };
  if (score >= 50) return { tier: 'great', label: '💎 Great Value', color: '#8b5cf6' };
  if (score >= 30) return { tier: 'good', label: '✓ Good Deal', color: '#10b981' };
  return null;
};

// Get prominent savings text for deal cards (e.g., "40% OFF", "SAVE $50")
const getDealSavingsDisplay = (deal) => {
  const discountValue = deal.discountValue || deal.discount_value || 0;
  const discountType = deal.discountType || deal.discount_type || '';
  const savingsPercent = deal.savingsPercent || 0;
  const originalPrice = deal.originalPrice || deal.original_price || 0;
  const dealPrice = deal.dealPrice || deal.deal_price || 0;
  const title = (deal.title || '').toLowerCase();
  const discount = (deal.discount || '').toLowerCase();

  // Check for percentage discount
  if (discountType === 'percent' && discountValue > 0) {
    return { text: `${Math.round(discountValue)}% OFF`, type: 'percent' };
  }
  if (savingsPercent > 0) {
    return { text: `${savingsPercent}% OFF`, type: 'percent' };
  }

  // Check for dollar savings
  if (discountType === 'fixed' && discountValue > 0) {
    return { text: `SAVE $${Math.round(discountValue)}`, type: 'dollar' };
  }
  if (originalPrice && dealPrice && originalPrice > dealPrice) {
    const savings = Math.round(originalPrice - dealPrice);
    return { text: `SAVE $${savings}`, type: 'dollar' };
  }

  // Parse from title
  const percentMatch = (title + ' ' + discount).match(/(\d+)\s*%/);
  if (percentMatch && parseInt(percentMatch[1]) >= 10) {
    return { text: `${percentMatch[1]}% OFF`, type: 'percent' };
  }

  const dollarMatch = title.match(/save\s*\$(\d+)/i) || title.match(/\$(\d+)\s*off/i);
  if (dollarMatch && parseInt(dollarMatch[1]) >= 10) {
    return { text: `SAVE $${dollarMatch[1]}`, type: 'dollar' };
  }

  // Check for special deal types
  if (discountType === 'free_item' || title.includes('free')) {
    return { text: 'FREE', type: 'free' };
  }
  if (title.includes('bogo') || title.includes('buy one get one')) {
    return { text: 'BOGO', type: 'bogo' };
  }
  if (title.includes('half price') || title.includes('1/2 price')) {
    return { text: '50% OFF', type: 'percent' };
  }

  // Show price if available
  if (dealPrice > 0) {
    return { text: `$${dealPrice}`, type: 'price' };
  }

  return null;
};

// Check if a deal has real value (filter out vague "specials")
const isRealDeal = (deal) => {
  const score = calculateDealScore(deal);
  // Only show deals with a minimum score (has some concrete value)
  return score >= 15;
};

// Helper to get related deals from the same business
const getRelatedDeals = (currentDeal, allDeals) => {
  if (!currentDeal) return [];

  const currentVenue = currentDeal.venueName || currentDeal.venueId;
  if (!currentVenue) return [];

  return allDeals.filter(deal => {
    if (deal.id === currentDeal.id) return false;
    const dealVenue = deal.venueName || deal.venueId;
    // Match by venue name (case insensitive) or venue ID
    return dealVenue && (
      dealVenue === currentVenue ||
      (typeof dealVenue === 'string' && typeof currentVenue === 'string' &&
       dealVenue.toLowerCase() === currentVenue.toLowerCase())
    );
  });
};

export default function PulseApp() {
  const [view, setView] = useState('consumer');
  const [currentSection, setCurrentSection] = useState('classes'); // classes, events, deals, services, wellness - DEFAULT TO CLASSES
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [userServiceRating, setUserServiceRating] = useState(0);
  const [hoverServiceRating, setHoverServiceRating] = useState(0);
  const dealCardRefs = useRef([]);
  const eventCardRefs = useRef([]);
  const serviceCardRefs = useRef([]);
  const classCardRefs = useRef([]);
  const venueCardRefs = useRef([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showClaimBusinessModal, setShowClaimBusinessModal] = useState(false);
  const [claimFormData, setClaimFormData] = useState({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCalendarToast, setShowCalendarToast] = useState(false);
  const [calendarToastMessage, setCalendarToastMessage] = useState('');
  const [newEventCategories, setNewEventCategories] = useState([]);

  // Helper function to show toast messages
  const showToast = useCallback((message, _type = 'info') => {
    setCalendarToastMessage(message);
    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);
  }, []);

  // User data from Supabase (replaces all hardcoded dummy data)
  const {
    session,
    isAuthenticated,
    loading: _userLoading,
    user,
    userStats,
    userAchievements,
    userActivity,
    savedItems,
    myCalendar,
    userClaimedBusinesses,
    setUser,
    updateProfile,
    updateAvatar,
    updateCoverPhoto,
    toggleSaveItem,
    isItemSaved,
    registerForEvent,
    refreshUserData,
    signOut
  } = useUserData();

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState('overview'); // overview, activity, saved, businesses, settings
  const [_editingProfile, _setEditingProfile] = useState(false);
  const [_profileForm, _setProfileForm] = useState({});

  const [savedItemsFilter, setSavedItemsFilter] = useState('event');
  const [localSavedItems, setLocalSavedItems] = useState(() => {
    // Initialize from localStorage for persistence without login
    try {
      const saved = localStorage.getItem('pulse_local_saves');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showMyCalendarModal, setShowMyCalendarModal] = useState(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('All');
  const [dealCategoryFilter, setDealCategoryFilter] = useState('All');
  const [servicesSubView, setServicesSubView] = useState('directory'); // directory | booking

  // Supabase services data
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Supabase events data (from database)
  const [dbEvents, setDbEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Fetch services from Supabase - extracted to be reusable
  const fetchServices = async () => {
    setServicesLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, category, address, google_rating, google_reviews, phone, website, email')
      .eq('status', 'active')
      .order('google_rating', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching services:', error);
      setServicesLoading(false);
      return;
    }

    // Map Supabase fields to expected UI fields
    const mappedServices = data.map(business => ({
      id: business.id,
      name: business.name,
      category: business.category || 'Other',
      address: business.address || '',
      rating: business.google_rating,
      reviews: business.google_reviews,
      phone: business.phone || '',
      website: business.website || '',
      email: business.email || ''
    }));

    setServices(mappedServices);
    setServicesLoading(false);
  };

  // Fetch services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        // Close any open modal
        setSelectedEvent(null);
        setSelectedDeal(null);
        setSelectedService(null);
        setShowAuthModal(false);
        setShowClaimBusinessModal(false);
        setShowSubmissionModal(false);
        setShowProfileModal(false);
        setShowAdminPanel(false);
        setShowEditVenueModal(false);
        setShowMessagesModal(false);
        setShowAddEventModal(false);
        setShowMyCalendarModal(false);
        setShowBookingSheet(false);
        setShowContactSheet(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Fetch events from Supabase on mount
  useEffect(() => {
    async function fetchEvents() {
      setEventsLoading(true);
      // Always use Squamish (Pacific) date, regardless of user's timezone
      const localDateStr = getPacificDateStr();

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'active')
        .gte('start_date', localDateStr)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        setEventsLoading(false);
        return;
      }

      // Map Supabase events to the UI format
      const mappedEvents = data.map(event => {
        // Parse date/time as Pacific (Squamish) time, regardless of user's timezone
        let startTimeStr = event.start_time || '09:00';
        let [hours, minutes] = startTimeStr.split(':').map(Number);

        // Fix suspicious times: classes at 1-5 AM are likely data errors, default to 9 AM
        // Also fix weird times like XX:26 which indicate scraping errors
        if (hours >= 1 && hours <= 5) {
          hours = 9;
          minutes = 0;
        } else if (minutes === 26) {
          minutes = 0;
        }

        const fixedStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const startDate = pacificDate(event.start_date, fixedStartTime);

        let endDate;
        if (event.end_time) {
          let [endHours, endMinutes] = event.end_time.split(':').map(Number);
          if (endHours >= 1 && endHours <= 5) {
            endHours = 10;
            endMinutes = 0;
          } else if (endMinutes === 26) {
            endMinutes = 0;
          }
          const fixedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
          endDate = pacificDate(event.start_date, fixedEndTime);
        } else {
          endDate = pacificDate(event.start_date, `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        }

        return {
          id: event.id,
          title: event.title,
          eventType: event.event_type === 'class' ? 'class' : 'event',
          venueId: null,
          venueName: event.venue_name || 'Squamish',
          venueAddress: event.venue_address || 'Squamish, BC',
          start: startDate,
          end: endDate,
          tags: event.tags || [event.category || 'Community'],
          ageGroup: 'All Ages',
          price: event.is_free ? 'Free' : (event.price_description || (event.price ? `$${event.price}` : 'Free')),
          recurrence: 'none',
          description: event.description || '',
          featured: event.featured || false,
          image: event.image_url
        };
      });

      setDbEvents(mappedEvents);
      setEventsLoading(false);
    }

    fetchEvents();
  }, []);

  // Supabase deals data (from database)
  const [dbDeals, setDbDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);

  // Fetch deals from Supabase on mount
  useEffect(() => {
    async function fetchDeals() {
      setDealsLoading(true);
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deals:', error);
        setDealsLoading(false);
        return;
      }

      // Map Supabase deals to the UI format
      const mappedDeals = data.map(deal => ({
        id: deal.id,
        title: deal.title,
        venueId: null,
        venueName: deal.business_name || 'Local Business',
        venueAddress: deal.business_address || 'Squamish, BC',
        category: deal.category || 'Other',
        description: deal.description || '',
        // Keep raw values for scoring
        discountType: deal.discount_type,
        discountValue: deal.discount_value,
        originalPrice: deal.original_price,
        dealPrice: deal.deal_price,
        // Formatted display string
        discount: deal.discount_type === 'percent' ? `${deal.discount_value}% off` :
                  deal.discount_type === 'fixed' ? `$${deal.discount_value} off` :
                  deal.discount_type === 'bogo' ? 'Buy One Get One' :
                  deal.discount_type === 'free_item' ? 'Free Item' : 'Special Offer',
        validUntil: deal.valid_until,
        terms: deal.terms_conditions || '',
        image: deal.image_url,
        featured: deal.featured || false
      }));

      setDbDeals(mappedDeals);
      setDealsLoading(false);
    }

    fetchDeals();
  }, []);

  // Fetch user conversations when messages modal opens
  const fetchConversations = async () => {
    if (!user?.id) {
      setConversations([]);
      setConversationsLoading(false);
      return;
    }
    setConversationsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: user.id });
      if (error) throw error;
      setConversations(data || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setConversations([]);
    } finally {
      setConversationsLoading(false);
    }
  };

  // Fetch messages for a specific conversation
  const fetchMessages = async (conversationId) => {
    if (!conversationId) return;
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: 50
      });
      if (error) throw error;
      setConversationMessages(data || []);
      // Mark as read
      await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
        p_reader_type: 'user'
      });
    } catch (err) {
      console.error('Error fetching messages:', err);
      setConversationMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!messageInput.trim() || !currentConversation || sendingMessage || !user?.id) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase.rpc('send_message', {
        p_conversation_id: currentConversation.id,
        p_sender_id: user.id,
        p_sender_type: 'user',
        p_content: messageInput.trim()
      });
      if (error) throw error;
      setMessageInput('');
      await fetchMessages(currentConversation.id);
    } catch (err) {
      console.error('Error sending message:', err);
      showToast('Failed to send message. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // Start a new conversation with a business
  const startConversation = async (businessId, subject, initialMessage) => {
    if (!user?.id || !businessId) return null;
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        p_user_id: user.id,
        p_business_id: businessId,
        p_subject: subject,
        p_initial_message: initialMessage
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error starting conversation:', err);
      return null;
    }
  };

  // Track analytics event
  const trackAnalytics = async (eventType, businessId, referenceId = null) => {
    try {
      await supabase.from('business_analytics').insert({
        business_id: businessId,
        event_type: eventType,
        user_id: user?.id || null,
        reference_id: referenceId
      });
    } catch (err) {
      console.error('Analytics tracking error:', err);
    }
  };

  // Get business info for an event, including booking URL from lookup
  const getBusinessForEvent = (event) => {
    const venueName = getVenueName(event.venueId, event);
    const venue = REAL_DATA.venues.find(v => v.name === venueName);
    const bookingUrl = getBookingUrl(venueName) || event.bookingUrl;
    const bookingType = getBookingType(venueName);

    return {
      id: venue?.id || event.venueId,
      name: venueName,
      booking_url: bookingUrl,
      booking_type: bookingType,
      ...venue
    };
  };

  // Handle booking button click
  const handleBookClick = (event) => {
    const business = getBusinessForEvent(event);

    // Track booking click
    trackAnalytics('booking_click', business.id, event.id);

    setBookingEvent(event);
    setIframeLoaded(false);
    setIframeFailed(false);
    setBookingRequestMessage('');

    // Determine booking step based on whether business has booking URL
    const hasBookingUrl = business.booking_url;
    if (hasBookingUrl) {
      setBookingStep('iframe');
    } else {
      setBookingStep('request');
    }

    setShowBookingSheet(true);
  };

  // Close booking sheet and show confirmation
  const closeBookingSheet = () => {
    const business = bookingEvent ? getBusinessForEvent(bookingEvent) : null;
    const hasBookingUrl = business?.booking_url;

    setShowBookingSheet(false);

    // Only show confirmation if there was a booking URL (user might have booked externally)
    if (hasBookingUrl && bookingStep === 'iframe') {
      setShowBookingConfirmation(true);
    }
  };

  // Handle booking confirmation response
  const handleBookingConfirmation = async (didBook) => {
    if (didBook && bookingEvent) {
      const business = getBusinessForEvent(bookingEvent);

      // Track confirmed booking
      await trackAnalytics('booking_confirmed', business.id, bookingEvent.id);

      // Add to calendar
      addToCalendar(bookingEvent);

      setCalendarToastMessage('Great! Added to your calendar');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 2000);
    }

    setShowBookingConfirmation(false);
    setBookingEvent(null);
  };

  // Submit booking request (for businesses without booking URL)
  const submitBookingRequest = async () => {
    if (!bookingEvent) return;

    const business = getBusinessForEvent(bookingEvent);

    setSendingMessage(true);
    try {
      const subject = `Booking Request: ${bookingEvent.title}`;
      const message = `Hi, I'd like to book:\n\n` +
        `Class: ${bookingEvent.title}\n` +
        `Date: ${bookingEvent.start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' })}\n` +
        `Time: ${bookingEvent.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}\n\n` +
        (bookingRequestMessage ? `Message: ${bookingRequestMessage}` : '');

      const conversationId = await startConversation(business.id, subject, message);

      if (conversationId) {
        // Track message received
        await trackAnalytics('message_received', business.id, bookingEvent.id);

        setShowBookingSheet(false);
        setBookingEvent(null);

        setCalendarToastMessage('Request sent! You\'ll hear back soon.');
        setShowCalendarToast(true);
        setTimeout(() => {
          setShowCalendarToast(false);
          // Open messages to show the sent request
          openMessages();
        }, 1500);
      }
    } catch (err) {
      console.error('Error submitting booking request:', err);
      showToast('Failed to send request. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle iframe load/error - kept for future use
  const _handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  const _handleIframeError = () => {
    setIframeFailed(true);
  };

  // Handle contact business - kept for future use
  const _handleContactBusiness = (business) => {
    if (user.isGuest) {
      setShowAuthModal(true);
      return;
    }
    setContactBusiness(business);
    setContactSubject('');
    setContactMessage('');
    setShowContactSheet(true);
  };

  // Submit contact form
  const submitContactForm = async () => {
    if (!contactMessage.trim() || !contactBusiness) return;
    setSendingMessage(true);
    try {
      const conversationId = await startConversation(
        contactBusiness.id,
        contactSubject || `Inquiry about ${contactBusiness.name}`,
        contactMessage.trim()
      );
      if (conversationId) {
        // Track message received
        await trackAnalytics('message_received', contactBusiness.id);

        setShowContactSheet(false);
        setContactBusiness(null);
        setContactSubject('');
        setContactMessage('');

        setCalendarToastMessage('Message sent!');
        setShowCalendarToast(true);
        setTimeout(() => setShowCalendarToast(false), 2000);
      }
    } catch (err) {
      console.error('Error submitting contact form:', err);
      showToast('Failed to send message. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // Open messages modal
  const openMessages = () => {
    if (user.isGuest) {
      setShowAuthModal(true);
      return;
    }
    fetchConversations();
    setShowMessagesModal(true);
    setCurrentConversation(null);
  };

  // Fetch business inbox conversations
  const fetchBusinessInbox = async (businessId, type = 'all') => {
    if (!businessId) return;
    setBusinessConversationsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_business_inbox', {
        p_business_id: businessId,
        p_filter_type: type === 'all' ? null : type
      });
      if (error) throw error;
      setBusinessConversations(data || []);
    } catch (err) {
      console.error('Error fetching business inbox:', err);
      setBusinessConversations([]);
    } finally {
      setBusinessConversationsLoading(false);
    }
  };

  // Fetch messages for a business conversation
  const fetchBusinessMessages = async (conversationId) => {
    if (!conversationId) return;
    setBusinessMessagesLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_conversation_messages', {
        p_conversation_id: conversationId,
        p_limit: 50
      });
      if (error) throw error;
      setBusinessMessages(data || []);
      // Mark as read by business
      await supabase.rpc('mark_conversation_read', {
        p_conversation_id: conversationId,
        p_reader_type: 'business'
      });
    } catch (err) {
      console.error('Error fetching business messages:', err);
      setBusinessMessages([]);
    } finally {
      setBusinessMessagesLoading(false);
    }
  };

  // Send reply from business
  const sendBusinessReply = async () => {
    if (!businessReplyInput.trim() || !selectedBusinessConversation) return;
    setSendingMessage(true);
    try {
      const businessId = userClaimedBusinesses[0]?.id;
      const { error } = await supabase.rpc('send_message', {
        p_conversation_id: selectedBusinessConversation.id,
        p_sender_id: businessId,
        p_sender_type: 'business',
        p_content: businessReplyInput.trim()
      });
      if (error) throw error;
      setBusinessReplyInput('');
      await fetchBusinessMessages(selectedBusinessConversation.id);
    } catch (err) {
      console.error('Error sending reply:', err);
      showToast('Failed to send reply. Please try again.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // Mark conversation as resolved
  const markConversationResolved = async (conversationId) => {
    try {
      await supabase
        .from('conversations')
        .update({ status: 'resolved' })
        .eq('id', conversationId);

      // Refresh inbox
      if (userClaimedBusinesses[0]?.id) {
        fetchBusinessInbox(userClaimedBusinesses[0].id, businessInboxTab === 'bookings' ? 'booking_request' : 'general_inquiry');
      }
      setSelectedBusinessConversation(null);
    } catch (err) {
      console.error('Error marking resolved:', err);
    }
  };

  // Business Analytics State
  const [businessAnalytics, setBusinessAnalytics] = useState(null);
  const [_analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30); // days

  // Fetch business analytics
  const fetchBusinessAnalytics = async (businessId, days = 30) => {
    if (!businessId) return;
    setAnalyticsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_business_analytics_summary', {
        p_business_id: businessId,
        p_days: days
      });
      if (error) throw error;
      setBusinessAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setBusinessAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load business data when view changes
  useEffect(() => {
    if (view === 'business' && userClaimedBusinesses.length > 0) {
      const businessId = userClaimedBusinesses[0].id;
      fetchBusinessInbox(businessId, 'booking_request');
      fetchBusinessAnalytics(businessId, analyticsPeriod);
    }
  }, [view, userClaimedBusinesses, analyticsPeriod]);

  // Admin panel state (must be declared before useEffect that uses it)
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('pending'); // 'pending', 'approved', 'rejected'

  // Load pending submissions when admin panel opens
  useEffect(() => {
    if (showAdminPanel && user?.isAdmin) {
      loadPendingSubmissions();
    }
  }, [showAdminPanel, user?.isAdmin]);

  // Submission system state
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionStep, setSubmissionStep] = useState(1); // 1: type select, 2: form, 3: success
  const [submissionType, setSubmissionType] = useState(null); // 'event', 'class', 'deal'
  
  // User's claimed businesses (empty until they claim one)
  const [submissionForm, setSubmissionForm] = useState({
    businessType: '', // 'claimed', 'new', 'individual'
    selectedBusinessId: '',
    businessName: '',
    businessAddress: '',
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    price: '',
    ageGroup: '',
    category: '',
    recurrence: 'none',
    schedule: '', // for deals
    terms: '', // for deals
    squareImage: null, // 1:1 image
    bannerImage: null, // 3:1 image
    squareImagePreview: '',
    bannerImagePreview: ''
  });
  
  // Image cropping state
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [cropperType, setCropperType] = useState(null); // 'square' or 'banner'
  const [cropperImage, setCropperImage] = useState(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [_isDragging, _setIsDragging] = useState(false);
  const [_dragStart, _setDragStart] = useState({ x: 0, y: 0 });
  const _cropperRef = useRef(null);

  // User authentication state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Filter states - all dropdowns
  const [filters, setFilters] = useState({
    day: 'today', // today, tomorrow, thisWeekend, nextWeek, anytime
    time: 'all', // all, or specific times like '6:00', '6:30', '7:00', etc
    age: 'all', // all, kids, adults
    category: 'all', // all, music, fitness, arts, etc
    price: 'all' // all, free, paid
  });
  const [showFilters, setShowFilters] = useState(false);

  // Kids age range filter state
  const [kidsAgeRange, setKidsAgeRange] = useState([0, 18]);
  const ageRangeOptions = [
    { label: 'Prenatal', min: -1, max: 0 },
    { label: '0-1', min: 0, max: 1 },
    { label: '1-2', min: 1, max: 2 },
    { label: '2-5', min: 2, max: 5 },
    { label: '5-7', min: 5, max: 7 },
    { label: '7-10', min: 7, max: 10 },
    { label: '10-13', min: 10, max: 13 },
    { label: '13-18', min: 13, max: 18 }
  ];

  // Booking & Messaging State
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [bookingEvent, setBookingEvent] = useState(null);
  const [bookingStep, setBookingStep] = useState('iframe'); // iframe, request, confirmation
  const [_iframeLoaded, setIframeLoaded] = useState(false);
  const [_iframeFailed, setIframeFailed] = useState(false);
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false);
  const [bookingRequestMessage, setBookingRequestMessage] = useState('');
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [showEditVenueModal, setShowEditVenueModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [editVenueForm, setEditVenueForm] = useState({ name: '', address: '', phone: '', website: '', email: '', category: '' });
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [contactBusiness, setContactBusiness] = useState(null);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');

  // Business Inbox State
  const [businessInboxTab, setBusinessInboxTab] = useState('bookings'); // bookings, messages
  const [businessConversations, setBusinessConversations] = useState([]);
  const [businessConversationsLoading, setBusinessConversationsLoading] = useState(false);
  const [selectedBusinessConversation, setSelectedBusinessConversation] = useState(null);
  const [businessMessages, setBusinessMessages] = useState([]);
  const [businessMessagesLoading, setBusinessMessagesLoading] = useState(false);
  const [businessReplyInput, setBusinessReplyInput] = useState('');

  const categories = ['All', 'Music', 'Fitness', 'Arts', 'Community', 'Games', 'Wellness', 'Outdoors & Nature', 'Nightlife', 'Family', 'Food & Drink'];

  // Helper to close Add Event modal and reset form
  const closeAddEventModal = () => {
    setShowAddEventModal(false);
    setNewEventCategories([]);
  };

  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = (event) => {
    const startDate = event.start.toISOString().replace(/-|:|\.\d+/g, '');
    const endDate = event.end.toISOString().replace(/-|:|\.\d+/g, '');
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(event.description || '');
    const location = encodeURIComponent(getVenueName(event.venueId, event) + ', Squamish, BC');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
  };

  // Add event to both Google Calendar and My Calendar
  const addToCalendar = async (event) => {
    // Add to internal calendar if not already there
    const isAlreadyInCalendar = myCalendar.some(e => e.eventId === event.id || e.id === event.id);

    if (!isAlreadyInCalendar && isAuthenticated) {
      await registerForEvent({
        id: event.id,
        eventType: event.eventType || 'event',
        title: event.title,
        date: event.start ? event.start.toISOString().split('T')[0] : event.date,
        time: event.start ? event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' }) : event.time,
        venue: getVenueName(event.venueId, event),
        address: event.location || event.address || '',
        ...event
      });
      setCalendarToastMessage(`"${event.title}" added to My Calendar!`);
    } else if (isAlreadyInCalendar) {
      setCalendarToastMessage(`"${event.title}" is already in your calendar`);
    } else {
      setCalendarToastMessage('Sign in to add events to your calendar');
    }

    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);

    // Open Google Calendar in new tab
    window.open(generateGoogleCalendarUrl(event), '_blank');
  };

  // Remove event from My Calendar
  const removeFromCalendar = async (_eventId) => {
    if (!isAuthenticated) return;
    // For now, just show toast - full removal would need a Supabase function
    setCalendarToastMessage('Event removed from My Calendar');
    setShowCalendarToast(true);
    setTimeout(() => setShowCalendarToast(false), 3000);
    refreshUserData(); // Refresh to get updated calendar
  };

  // Check if event is in My Calendar
  const isInMyCalendar = (eventId) => {
    return myCalendar.some(e => e.eventId === eventId || e.id === eventId);
  };

  // Get events grouped by date for calendar view
  const getCalendarEventsByDate = () => {
    const grouped = {};
    myCalendar.forEach(event => {
      const dateKey = event.start.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    // Sort by date
    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, events]) => ({
        date: new Date(date),
        events: events.sort((a, b) => a.start - b.start)
      }));
  };

  // ========== SUBMISSION SYSTEM HELPERS ==========
  
  // Open submission modal
  const openSubmissionModal = () => {
    setSubmissionStep(1);
    setSubmissionType(null);
    setSubmissionForm({
      businessType: '',
      selectedBusinessId: '',
      businessName: '',
      businessAddress: '',
      title: '',
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      price: '',
      ageGroup: '',
      category: '',
      recurrence: 'none',
      schedule: '',
      terms: '',
      squareImage: null,
      bannerImage: null,
      squareImagePreview: '',
      bannerImagePreview: ''
    });
    setShowImageCropper(false);
    setCropperImage(null);
    setShowSubmissionModal(true);
    setShowProfileMenu(false);
  };

  // Close submission modal
  const closeSubmissionModal = () => {
    setShowSubmissionModal(false);
    setSubmissionStep(1);
    setSubmissionType(null);
    setShowImageCropper(false);
    setCropperImage(null);
  };

  // Handle type selection and move to form
  const selectSubmissionType = (type) => {
    setSubmissionType(type);
    setSubmissionStep(2); // Go directly to form
  };

  // Handle business type selection
  const selectBusinessType = (type, businessId = null) => {
    if (type === 'claimed' && businessId) {
      const business = userClaimedBusinesses.find(b => b.id === businessId);
      setSubmissionForm(prev => ({
        ...prev,
        businessType: 'claimed',
        selectedBusinessId: businessId,
        businessName: business?.name || '',
        businessAddress: business?.address || ''
      }));
    } else if (type === 'new') {
      setSubmissionForm(prev => ({
        ...prev,
        businessType: 'new',
        selectedBusinessId: '',
        businessName: '',
        businessAddress: ''
      }));
    } else if (type === 'individual') {
      setSubmissionForm(prev => ({
        ...prev,
        businessType: 'individual',
        selectedBusinessId: '',
        businessName: user.name,
        businessAddress: 'Squamish, BC'
      }));
    }
  };

  // Handle image selection
  const handleImageSelect = (e, imageType) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCropperImage(event.target.result);
        setCropperType(imageType);
        setCropPosition({ x: 0, y: 0 });
        setCropZoom(1);
        setShowImageCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle crop completion with canvas
  const handleCropComplete = async () => {
    // Save the image with crop metadata
    // In production, server would use position/zoom to create actual crop
    const cropData = {
      image: cropperImage,
      position: cropPosition,
      zoom: cropZoom,
      type: cropperType
    };
    
    if (cropperType === 'square') {
      setSubmissionForm(prev => ({
        ...prev,
        squareImage: cropData,
        squareImagePreview: cropperImage
      }));
    } else if (cropperType === 'banner') {
      setSubmissionForm(prev => ({
        ...prev,
        bannerImage: cropData,
        bannerImagePreview: cropperImage
      }));
    } else if (cropperType === 'profileAvatar') {
      // Convert base64 to File and upload to Supabase Storage
      const response = await fetch(cropperImage);
      const blob = await response.blob();
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const { error } = await updateAvatar(file);
      if (error) {
        setCalendarToastMessage('Error uploading avatar. Please try again.');
        setShowCalendarToast(true);
        setTimeout(() => setShowCalendarToast(false), 3000);
      } else {
        setCalendarToastMessage('Profile photo updated!');
        setShowCalendarToast(true);
        setTimeout(() => setShowCalendarToast(false), 3000);
      }
    } else if (cropperType === 'profileCover') {
      // Convert base64 to File and upload to Supabase Storage
      const response = await fetch(cropperImage);
      const blob = await response.blob();
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
      const { error } = await updateCoverPhoto(file);
      if (error) {
        setCalendarToastMessage('Error uploading cover photo. Please try again.');
        setShowCalendarToast(true);
        setTimeout(() => setShowCalendarToast(false), 3000);
      } else {
        setCalendarToastMessage('Cover photo updated!');
        setShowCalendarToast(true);
        setTimeout(() => setShowCalendarToast(false), 3000);
      }
    }
    
    setShowImageCropper(false);
    setCropperImage(null);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
  };

  // Remove image
  const removeImage = (imageType) => {
    if (imageType === 'square') {
      setSubmissionForm(prev => ({
        ...prev,
        squareImage: null,
        squareImagePreview: ''
      }));
    } else if (imageType === 'banner') {
      setSubmissionForm(prev => ({
        ...prev,
        bannerImage: null,
        bannerImagePreview: ''
      }));
    }
  };

  // Get selected business info
  const getSelectedBusinessInfo = () => {
    if (submissionForm.businessType === 'claimed') {
      return userClaimedBusinesses.find(b => b.id === submissionForm.selectedBusinessId);
    }
    return null;
  };

  // Submit for admin approval - persists to database
  const submitForApproval = async () => {
    const selectedBusiness = getSelectedBusinessInfo();

    try {
      const submissionData = {
        item_type: submissionType,
        action: 'create',
        data: {
          ...submissionForm,
          submittedBy: { name: user.name, email: user.email },
          business: {
            type: submissionForm.businessType,
            name: submissionForm.businessName || selectedBusiness?.name,
            address: submissionForm.businessAddress,
            verified: selectedBusiness?.verified || false
          },
          images: {
            square: submissionForm.squareImagePreview,
            banner: submissionForm.bannerImagePreview
          }
        },
        source: 'web_app',
        business_id: selectedBusiness?.id || null,
        submitted_by: user.id || null,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('pending_items')
        .insert(submissionData)
        .select()
        .single();

      if (error) throw error;

      // Update local state with the new submission
      setPendingSubmissions(prev => [...prev, {
        id: data.id,
        type: data.item_type,
        status: data.status,
        submittedAt: new Date(data.created_at),
        submittedBy: { name: user.name, email: user.email },
        business: submissionData.data.business,
        data: data.data,
        images: submissionData.data.images
      }]);

      setSubmissionStep(3); // Success step
      showToast('Submission sent for review!', 'success');
    } catch (err) {
      console.error('Submission error:', err);
      showToast('Failed to submit. Please try again.', 'error');
    }
  };

  // Admin: Approve submission - updates database and creates the item
  const approveSubmission = async (submissionId) => {
    try {
      // Get the submission data
      const submission = pendingSubmissions.find(s => s.id === submissionId);
      if (!submission) return;

      // Update pending_items status
      const { error: updateError } = await supabase
        .from('pending_items')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Create the actual event/class/deal in the events table
      if (submission.type === 'event' || submission.type === 'class') {
        const eventData = {
          title: submission.data.title,
          description: submission.data.description,
          start_date: submission.data.date,
          start_time: submission.data.startTime,
          end_time: submission.data.endTime,
          venue_name: submission.data.businessName || submission.business?.name,
          venue_id: submission.business_id,
          event_type: submission.type,
          category: submission.data.category,
          price: submission.data.price,
          recurrence: submission.data.recurrence,
          tags: ['user-submitted'],
          status: 'active'
        };

        const { error: insertError } = await supabase
          .from('events')
          .insert(eventData);

        if (insertError) throw insertError;
      }

      // Update local state
      setPendingSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: 'approved', approvedAt: new Date() } : s)
      );

      showToast('Submission approved and published!', 'success');

      // Refresh events to show the new item - trigger a page reload for simplicity
      if (submission.type === 'event' || submission.type === 'class') {
        // The useEffect will refetch events on next render
        showToast('Submission approved! Refresh to see the new item.', 'success');
      }
    } catch (_err) {
      showToast('Failed to approve. Please try again.', 'error');
    }
  };

  // Admin: Reject submission - updates database
  const rejectSubmission = async (submissionId, reason) => {
    try {
      const { error } = await supabase
        .from('pending_items')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason
        })
        .eq('id', submissionId);

      if (error) throw error;

      setPendingSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: 'rejected', rejectedAt: new Date(), rejectReason: reason } : s)
      );

      showToast('Submission rejected.', 'info');
    } catch (err) {
      console.error('Rejection error:', err);
      showToast('Failed to reject. Please try again.', 'error');
    }
  };

  // Load pending submissions from database
  const loadPendingSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setPendingSubmissions(data.map(item => ({
          id: item.id,
          type: item.item_type,
          status: item.status,
          submittedAt: new Date(item.created_at),
          submittedBy: item.data?.submittedBy || { name: 'Unknown', email: '' },
          business: item.data?.business || {},
          data: item.data || {},
          images: item.data?.images || {},
          rejectReason: item.review_notes
        })));
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  };

  // Get available time slots from actual events (30-min intervals)
  const getAvailableTimeSlots = () => {
    const slots = new Set();
    const allEvents = [...REAL_DATA.events, ...dbEvents];
    const filteredByDay = allEvents.filter(e => {
      const now = getPacificNow();
      if (filters.day === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return e.start >= today && e.start < tomorrow;
      }
      return true;
    });

    filteredByDay.forEach(event => {
      const hour = event.start.getHours();
      const minute = event.start.getMinutes();
      const timeStr = `${hour}:${String(minute).padStart(2, '0')}`;
      slots.add(timeStr);
    });

    return Array.from(slots).sort((a, b) => {
      const [aHour, aMin] = a.split(':').map(Number);
      const [bHour, bMin] = b.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
  };

  const handleSignOut = async () => {
    await signOut();
    setShowProfileMenu(false);
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        setAuthMode('signin');
      }
    } catch {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: {
            full_name: authName,
            name: authName
          }
        }
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthError('');
        // Check if email confirmation is required (no session returned) or user is auto-logged in
        if (data?.session) {
          // Email confirmation disabled - user is logged in
          setCalendarToastMessage('Account created! Welcome to Pulse!');
        } else {
          // Email confirmation required
          setCalendarToastMessage('Check your email to confirm your account!');
        }
        setShowCalendarToast(true);
        setTimeout(() => setShowCalendarToast(false), 5000);
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        setAuthName('');
        setAuthMode('signin');
      }
    } catch {
      setAuthError('An unexpected error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleClaimBusiness = async () => {
    if (!claimFormData.businessName || !claimFormData.ownerName || !claimFormData.email) {
      setCalendarToastMessage('Please fill in all required fields');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 3000);
      return;
    }
    if (!session?.user?.id) {
      // This shouldn't happen since we show sign-in prompt, but just in case
      setShowClaimBusinessModal(false);
      setShowAuthModal(true);
      return;
    }
    setClaimSubmitting(true);
    try {
      const { error } = await supabase.from('business_claims').insert({
        user_id: session.user.id,
        business_name: claimFormData.businessName,
        business_address: claimFormData.address || null,
        owner_name: claimFormData.ownerName,
        contact_email: claimFormData.email,
        contact_phone: claimFormData.phone || null,
        owner_role: claimFormData.role,
        status: 'pending'
      });
      if (error) throw error;
      setShowClaimBusinessModal(false);
      setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
      setCalendarToastMessage('Claim submitted successfully!');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 5000);
    } catch (error) {
      console.error('Error submitting claim:', error);
      setCalendarToastMessage('Error submitting claim. Please try again.');
      setShowCalendarToast(true);
      setTimeout(() => setShowCalendarToast(false), 3000);
    } finally {
      setClaimSubmitting(false);
    }
  };

  const getVenueName = (venueId, event) => {
    // For database events that have venueName directly
    if (event?.venueName) return event.venueName;
    // For hardcoded events with venueId
    return REAL_DATA.venues.find(v => v.id === venueId)?.name || 'Squamish';
  };
  const isVerified = (venueId) => REAL_DATA.venues.find(v => v.id === venueId)?.verified || false;
  
  const _getTimeUntil = (date) => {
    const hours = Math.floor((date - getPacificNow()) / (1000 * 60 * 60));
    if (hours < 0) return 'Past';
    if (hours < 1) return 'Soon';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const filterEvents = () => {
    const now = getPacificNow(); // Always filter based on Squamish time
    // Combine hardcoded events with database events
    let filtered = [...REAL_DATA.events, ...dbEvents];

    // Filter out bad data - titles that are just booking status, not actual class names
    filtered = filtered.filter(e => {
      const title = e.title || '';
      // Skip entries where title is just booking status like "(8 Reserved, 2 Open)"
      if (/^\(\d+\s+Reserved,\s+\d+\s+Open\)$/.test(title)) return false;
      // Skip entries with no meaningful title
      if (title.length < 3) return false;
      return true;
    });

    // Filter by section (events vs classes)
    if (currentSection === 'events') {
      filtered = filtered.filter(e => e.eventType === 'event');
    } else if (currentSection === 'classes') {
      filtered = filtered.filter(e => e.eventType === 'class');
    }

    // Day filtering - for infinite scroll, we get events for next 30 days when "today" is selected
    // Only show events that haven't started yet (filter out past events from today)
    if (filters.day === 'today') {
      const thirtyDaysLater = new Date(now);
      thirtyDaysLater.setDate(now.getDate() + 30);
      filtered = filtered.filter(e => e.start >= now && e.start < thirtyDaysLater);
    } else if (filters.day === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(tomorrow.getDate() + 1);
      filtered = filtered.filter(e => e.start >= tomorrow && e.start < dayAfter);
    } else if (filters.day === 'thisWeekend') {
      const friday = new Date(now);
      const daysUntilFriday = (5 - now.getDay() + 7) % 7;
      friday.setDate(now.getDate() + daysUntilFriday);
      friday.setHours(0, 0, 0, 0);
      const monday = new Date(friday);
      monday.setDate(friday.getDate() + 3);
      filtered = filtered.filter(e => e.start >= friday && e.start < monday);
    } else if (filters.day === 'nextWeek') {
      const nextMonday = new Date(now);
      const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7;
      nextMonday.setDate(now.getDate() + daysUntilNextMonday);
      nextMonday.setHours(0, 0, 0, 0);
      const followingSunday = new Date(nextMonday);
      followingSunday.setDate(nextMonday.getDate() + 7);
      filtered = filtered.filter(e => e.start >= nextMonday && e.start < followingSunday);
    }
    // 'anytime' shows all future events

    // Search query
    if (searchQuery?.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(e =>
        e.title?.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        getVenueName(e.venueId, e).toLowerCase().includes(query) ||
        e.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Age filtering
    if (filters.age === 'kids') {
      filtered = filtered.filter(e => {
        // Basic kids filter - must be for kids or all ages
        if (!e.ageGroup?.includes('Kids') && e.ageGroup !== 'All Ages') return false;

        // If specific age range is selected, match against event titles/descriptions
        if (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18) {
          // Extract age numbers from title/description
          const text = `${e.title} ${e.description}`.toLowerCase();

          // Check for prenatal
          if (kidsAgeRange[0] === -1 && kidsAgeRange[1] === 0) {
            return text.includes('prenatal') || text.includes('perinatal') || text.includes('pregnant');
          }

          // Try to extract age range from title like "(3-5)" or "Ages 4-8"
          const ageMatch = text.match(/(?:ages?\s*)?(\d+)\s*[-–]\s*(\d+)/i);
          if (ageMatch) {
            const eventMinAge = parseInt(ageMatch[1]);
            const eventMaxAge = parseInt(ageMatch[2]);
            // Check if event age range overlaps with selected range
            return eventMinAge <= kidsAgeRange[1] && eventMaxAge >= kidsAgeRange[0];
          }

          // If no age range found in title, include it (generic kids class)
          return true;
        }

        return true;
      });
    } else if (filters.age === 'adults') {
      filtered = filtered.filter(e => e.ageGroup?.includes('Adults') || e.ageGroup === '19+' || e.ageGroup === 'Teens & Adults');
    }

    // Category
    if (filters.category !== 'all') {
      filtered = filtered.filter(e => e.tags.includes(filters.category));
    }

    // Time of day
    // Time filtering - show classes from selected time onwards
    if (filters.time !== 'all') {
      const [filterHour, filterMin] = filters.time.split(':').map(Number);
      const filterMinutes = filterHour * 60 + filterMin;
      
      filtered = filtered.filter(e => {
        const eventHour = e.start.getHours();
        const eventMin = e.start.getMinutes();
        const eventMinutes = eventHour * 60 + eventMin;
        return eventMinutes >= filterMinutes;
      });
    }

    // Price
    if (filters.price === 'free') {
      filtered = filtered.filter(e => e.price?.toLowerCase() === 'free');
    } else if (filters.price === 'paid') {
      filtered = filtered.filter(e => e.price?.toLowerCase() !== 'free' && e.price);
    }

    // Location - simplified for demo
    if (filters.location !== 'all') {
      // In real app, would filter by venue location
      // For now, just keep all results
    }

    // Sort by featured, then by date
    return filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.start - b.start;
    });
  };

  // Group events by date for infinite scroll with dividers
  const groupEventsByDate = (events) => {
    const grouped = {};
    
    events.forEach(event => {
      const dateKey = event.start.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    
    return grouped;
  };

  // Render events with date dividers
  const renderEventsWithDividers = () => {
    // Show loading state while fetching database events
    if (eventsLoading) {
      return (
        <div className="loading-state" style={{padding: '40px 20px', textAlign: 'center'}}>
          <div style={{fontSize: '14px', color: '#6b7280'}}>Loading {currentSection}...</div>
        </div>
      );
    }

    const events = filterEvents();
    if (events.length === 0) {
      return (
        <div className="empty-state">
          <p>No {currentSection} found matching your filters.</p>
          <button onClick={() => {
            setFilters({ day: 'today', age: 'all', category: 'all', time: 'all', price: 'all', location: 'all' });
            setKidsAgeRange([0, 18]);
          }}>
            Clear Filters
          </button>
        </div>
      );
    }

    const groupedEvents = groupEventsByDate(events);
    const dateKeys = Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b));
    const now = getPacificNow();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let globalEventIndex = 0; // Global counter for refs

    return dateKeys.map((dateKey, index) => {
      const date = new Date(dateKey);
      const isToday = date.toDateString() === today.toDateString();
      const isTomorrow = date.toDateString() === tomorrow.toDateString();
      
      let dateLabelText;
      if (isToday) {
        dateLabelText = 'Today';
      } else if (isTomorrow) {
        dateLabelText = 'Tomorrow';
      } else {
        dateLabelText = date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' });
      }
      
      const fullDateSubtext = date.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      return (
        <div key={dateKey}>
          {index > 0 && <div className="date-divider">
            <div className="date-divider-line"></div>
            <div className="date-divider-content">
              <div className="date-divider-label">{dateLabelText}</div>
              {(isToday || isTomorrow) && <div className="date-divider-subtext">{fullDateSubtext}</div>}
            </div>
            <div className="date-divider-line"></div>
          </div>}
          
          {groupedEvents[dateKey].map((event) => {
            const currentIndex = globalEventIndex++;
            return <EventCard key={event.id} event={event} ref={(el) => eventCardRefs.current[currentIndex] = el} />;
          })}
        </div>
      );
    });
  };

  const filterDeals = () => {
    // Combine hardcoded deals with database deals
    let filtered = [...REAL_DATA.deals, ...dbDeals];

    // Filter out vague deals with no real value
    filtered = filtered.filter(deal => isRealDeal(deal));

    if (searchQuery?.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(d =>
        d.title?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
      );
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(d => d.category === filters.category);
    }

    // Sort by deal score (best deals first)
    return filtered.sort((a, b) => {
      const scoreA = calculateDealScore(a);
      const scoreB = calculateDealScore(b);
      return scoreB - scoreA; // Higher score = better deal = first
    });
  };

  const toggleSave = useCallback(async (id, type, name = '', data = {}) => {
    const itemKey = `${type}-${id}`;

    if (!isAuthenticated) {
      // Use local storage when not logged in
      setLocalSavedItems(prev => {
        const exists = prev.includes(itemKey);
        const newSaves = exists
          ? prev.filter(k => k !== itemKey)
          : [...prev, itemKey];
        localStorage.setItem('pulse_local_saves', JSON.stringify(newSaves));
        return newSaves;
      });
      return;
    }

    // Optimistic update for logged-in users
    const wasIncluded = localSavedItems.includes(itemKey);
    setLocalSavedItems(prev => {
      const exists = prev.includes(itemKey);
      return exists ? prev.filter(k => k !== itemKey) : [...prev, itemKey];
    });

    try {
      const result = await toggleSaveItem(type, String(id), name, data);
      if (result?.error) {
        // Revert optimistic update on error
        setLocalSavedItems(prev => wasIncluded ? [...prev, itemKey] : prev.filter(k => k !== itemKey));
        showToast('Failed to save. Please try again.', 'error');
      }
    } catch {
      // Revert optimistic update on error
      setLocalSavedItems(prev => wasIncluded ? [...prev, itemKey] : prev.filter(k => k !== itemKey));
      showToast('Failed to save. Please try again.', 'error');
    }
  }, [isAuthenticated, toggleSaveItem, localSavedItems, showToast]);

  // Combined check for saved items (local + database)
  const isItemSavedLocal = useCallback((type, id) => {
    const itemKey = `${type}-${id}`;
    return localSavedItems.includes(itemKey) || isItemSaved(type, String(id));
  }, [localSavedItems, isItemSaved]);

  // Debounce search for smoother performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Intersection Observer for deal card animations
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('deal-card-visible');
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      dealCardRefs.current.forEach((card) => {
        if (card) {
          observer.observe(card);
          // Check if already visible on first load
          const rect = card.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            card.classList.add('deal-card-visible');
          }
        }
      });

      return () => {
        dealCardRefs.current.forEach((card) => {
          if (card) observer.unobserve(card);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [currentSection, dealCategoryFilter, searchQuery]);

  // Intersection Observer for event card animations
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('event-card-visible');
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      eventCardRefs.current.forEach((card) => {
        if (card) {
          observer.observe(card);
          // Check if already visible on first load
          const rect = card.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            card.classList.add('event-card-visible');
          }
        }
      });

      return () => {
        eventCardRefs.current.forEach((card) => {
          if (card) observer.unobserve(card);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [currentSection, filters, searchQuery]);

  // Intersection Observer for service card animations
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('service-card-visible');
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      serviceCardRefs.current.forEach((card) => {
        if (card) {
          observer.observe(card);
          // Check if already visible on first load
          const rect = card.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            card.classList.add('service-card-visible');
          }
        }
      });

      return () => {
        serviceCardRefs.current.forEach((card) => {
          if (card) observer.unobserve(card);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [currentSection, serviceCategoryFilter, searchQuery]);

  // Intersection Observer for class card animations
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('class-card-visible');
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      classCardRefs.current.forEach((card) => {
        if (card) {
          observer.observe(card);
          // Check if already visible on first load
          const rect = card.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            card.classList.add('class-card-visible');
          }
        }
      });

      return () => {
        classCardRefs.current.forEach((card) => {
          if (card) observer.unobserve(card);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [currentSection]);

  // Intersection Observer for venue card animations
  useEffect(() => {
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('venue-card-visible');
            }
          });
        },
        {
          threshold: 0.2,
          rootMargin: '0px 0px -50px 0px'
        }
      );

      venueCardRefs.current.forEach((card) => {
        if (card) observer.observe(card);
      });

      return () => {
        venueCardRefs.current.forEach((card) => {
          if (card) observer.unobserve(card);
        });
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [currentSection]);

  const EventCard = React.forwardRef(({ event }, ref) => {
    const itemType = event.eventType === 'class' ? 'class' : 'event';
    const isSaved = isItemSavedLocal(itemType, event.id);

    const handleSave = async (e) => {
      e.stopPropagation();
      await toggleSave(event.id, itemType, event.title, { venue: getVenueName(event.venueId, event), date: event.start ? event.start.toISOString() : event.date });
    };

    return (
      <div ref={ref} className="event-card" onClick={() => setSelectedEvent(event)}>
        <div className="event-card-header">
          <div className="event-title-section">
            <h3>{event.title}</h3>
            {REAL_DATA.venues.find(v => v.id === event.venueId)?.verified && (
              <div
                className="verified-badge-premium-inline"
                onClick={(e) => e.stopPropagation()}
                data-tooltip="Verified"
              >
                <Check size={12} strokeWidth={3} />
              </div>
            )}
          </div>
        </div>

        <div className="event-card-body">
          <div className="event-detail-row">
            <div className="event-detail-item">
              <div className="detail-icon">
                <Calendar size={16} />
              </div>
              <span className="detail-text">{event.start.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="event-detail-item">
              <div className="detail-icon">
                <Clock size={16} />
              </div>
              <span className="detail-text">{event.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="event-detail-row">
            <div className="event-detail-item venue-item">
              <div className="detail-icon">
                <MapPin size={16} />
              </div>
              <span className="detail-text">{getVenueName(event.venueId, event)}</span>
            </div>
          </div>

          <div className="event-badges-row">
            {event.ageGroup && <span className="event-badge age-badge">{event.ageGroup}</span>}
            {event.price && <span className="event-badge price-badge">{event.price}</span>}
            {event.recurrence !== 'none' && <span className="event-badge recurrence-badge">Recurring {event.recurrence}</span>}
          </div>
        </div>

        {/* Book button for classes */}
        {event.eventType === 'class' && (
          <button
            className="event-book-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleBookClick(event);
            }}
          >
            Book
          </button>
        )}

        <button
          className={`save-star-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          data-tooltip={isSaved ? "Saved" : "Save"}
        >
          <Star size={24} fill={isSaved ? "#f59e0b" : "none"} stroke={isSaved ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
        </button>
        <ChevronRight className="event-chevron" size={20} />
      </div>
    );
  });

  return (
    <div className="pulse-app">
      <div className="view-switcher">
        <button className={view === 'consumer' ? 'active' : ''} onClick={() => setView('consumer')}>Consumer</button>
        <button className={view === 'business' ? 'active' : ''} onClick={() => setView('business')}>Business</button>
        {user.isAdmin && (
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>
        )}
      </div>

      {view === 'consumer' && (
        <div className="consumer-view">
          <header className="app-header-premium">
            <div className="header-container-premium">
              <div className="logo-area-premium">
                <div className="pulse-logo-premium">
                  <svg className="pulse-icon-premium" viewBox="0 0 100 120" fill="none">
                    <defs>
                      <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{stopColor: '#60a5fa'}} />
                        <stop offset="100%" style={{stopColor: '#3b82f6'}} />
                      </linearGradient>
                    </defs>
                    {/* Location Pin Outline - teardrop shape */}
                    <path d="M50 8C33 8 19 22 19 39C19 52 28 63 50 95C72 63 81 52 81 39C81 22 67 8 50 8Z" 
                          stroke="url(#pulseGradient)" 
                          strokeWidth="7" 
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"/>
                    
                    {/* Large Circle inside pin */}
                    <circle cx="50" cy="39" r="22" 
                            stroke="url(#pulseGradient)" 
                            strokeWidth="7" 
                            fill="none"/>
                    
                    {/* Pulse wave - centered and simplified */}
                    <path d="M33 39 L38 39 L42 33 L46 45 L50 28 L54 45 L58 33 L62 39 L67 39" 
                          stroke="url(#pulseGradient)" 
                          strokeWidth="4" 
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"/>
                  </svg>
                  <div className="logo-text-container">
                    <span className="logo-text-premium">PULSE</span>
                    <span className="city-tag">Squamish</span>
                  </div>
                </div>
              </div>
              
              <div className="header-actions-premium">
                {user.isGuest ? (
                  <button className="sign-in-btn" onClick={() => setShowAuthModal(true)}>
                    Sign In
                  </button>
                ) : (
                  <>
                    <button className="header-btn-icon messages-btn" onClick={openMessages}>
                      <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageCircle size={22} strokeWidth={2} />
                      </div>
                    </button>
                    <button className="header-btn-icon notification-btn">
                      <div style={{ color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bell size={22} strokeWidth={2} />
                      </div>
                      <span className="notification-dot"></span>
                    </button>
                    <div className="profile-btn" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                      <div className="profile-avatar">{user.avatar ? <img src={user.avatar} alt="" onError={(e) => { console.error('Avatar failed to load:', user.avatar); e.target.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U')}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Top Banner Navigation - Premium */}
          <div className="top-banner-premium">
            <div className="banner-content-premium">
              <div className="banner-tabs">
                <button
                  className={`banner-tab ${currentSection === 'classes' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('classes'); setServicesSubView('directory'); }}
                >
                  <Calendar size={18} />
                  <span>Classes</span>
                </button>
                <button
                  className={`banner-tab ${currentSection === 'events' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('events'); setServicesSubView('directory'); }}
                >
                  <Star size={18} />
                  <span>Events</span>
                </button>
                <button
                  className={`banner-tab ${currentSection === 'deals' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('deals'); setServicesSubView('directory'); }}
                >
                  <DollarSign size={18} />
                  <span>Deals</span>
                </button>
              </div>
              <div className="banner-tabs banner-tabs-row2">
                <button
                  className={`banner-tab ${currentSection === 'services' ? 'active' : ''}`}
                  onClick={() => setCurrentSection('services')}
                >
                  <Wrench size={18} />
                  <span>Services</span>
                </button>
                <button
                  className={`banner-tab ${currentSection === 'wellness' ? 'active' : ''}`}
                  onClick={() => setCurrentSection('wellness')}
                >
                  <Heart size={18} />
                  <span>Wellness</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search Bar - Premium (hidden for wellness which has its own UI) */}
          <div className="search-section-premium" style={currentSection === 'wellness' ? { display: 'none' } : undefined}>
            <div className="search-bar-premium">
              <Search size={20} className="search-icon-premium" />
              <input 
                type="text" 
                placeholder={`Search ${currentSection}...`} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
              {searchQuery && (
                <button 
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Premium Filter System - Clean 5-Filter Layout */}
          {(currentSection === 'events' || currentSection === 'classes') && (
            <>
              {/* Filters Toggle Button */}
              <div className="filters-toggle-section">
                <button 
                  className="filters-toggle-btn"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal size={18} />
                  <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                  <ChevronRight 
                    size={18} 
                    style={{ 
                      transform: showFilters ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }} 
                  />
                </button>
              </div>

              {/* Filters Section - Collapsible */}
              {showFilters && (
              <div className="filters-section">
                <div className="filters-row-top">
                  {/* Day Filter */}
                  <div className="filter-group">
                    <select 
                      value={filters.day} 
                      onChange={(e) => setFilters({...filters, day: e.target.value})}
                      className="filter-dropdown"
                    >
                      <option value="today">📅 Today</option>
                      <option value="tomorrow">Tomorrow</option>
                      <option value="thisWeekend">This Weekend</option>
                      <option value="nextWeek">Next Week</option>
                      <option value="anytime">Anytime</option>
                    </select>
                  </div>

                  {/* Time Filter - Dynamic 30-min slots */}
                  <div className="filter-group">
                    <select 
                      value={filters.time} 
                      onChange={(e) => setFilters({...filters, time: e.target.value})}
                      className="filter-dropdown"
                    >
                      <option value="all">🕐 All Times</option>
                      {getAvailableTimeSlots().map(timeSlot => {
                        const [hour, min] = timeSlot.split(':');
                        const hourNum = parseInt(hour);
                        const period = hourNum >= 12 ? 'PM' : 'AM';
                        const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                        const displayMin = min === '00' ? '' : `:${min}`;
                        return (
                          <option key={timeSlot} value={timeSlot}>
                            {displayHour}{displayMin} {period}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Age Filter */}
                  <div className="filter-group">
                    <select
                      value={filters.age}
                      onChange={(e) => {
                        setFilters({...filters, age: e.target.value});
                        if (e.target.value !== 'kids') {
                          setKidsAgeRange([0, 18]); // Reset when not kids
                        }
                      }}
                      className={`filter-dropdown ${filters.age === 'kids' ? 'filter-active' : ''}`}
                    >
                      <option value="all">👥 All Ages</option>
                      <option value="kids">Kids</option>
                      <option value="adults">Adults</option>
                    </select>
                  </div>
                </div>

                {/* Kids Age Range Slider - Shows when Kids is selected */}
                {filters.age === 'kids' && (
                  <div className="kids-age-slider-section">
                    <div className="age-slider-header">
                      <span className="age-slider-label">Age Range</span>
                      <span className="age-slider-value">
                        {kidsAgeRange[0] === -1 ? 'Prenatal' : `${kidsAgeRange[0]} yrs`} - {kidsAgeRange[1]} yrs
                      </span>
                    </div>

                    {/* Dual Range Slider */}
                    <div className="age-slider-container">
                      <div className="age-slider-track">
                        <div
                          className="age-slider-fill"
                          style={{
                            left: `${((kidsAgeRange[0] + 1) / 19) * 100}%`,
                            width: `${((kidsAgeRange[1] - kidsAgeRange[0]) / 19) * 100}%`
                          }}
                        />
                      </div>
                      <input
                        type="range"
                        min="-1"
                        max="18"
                        value={kidsAgeRange[0]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val < kidsAgeRange[1]) {
                            setKidsAgeRange([val, kidsAgeRange[1]]);
                          }
                        }}
                        className="age-slider age-slider-min"
                      />
                      <input
                        type="range"
                        min="-1"
                        max="18"
                        value={kidsAgeRange[1]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (val > kidsAgeRange[0]) {
                            setKidsAgeRange([kidsAgeRange[0], val]);
                          }
                        }}
                        className="age-slider age-slider-max"
                      />
                    </div>

                    {/* Quick Select Buttons */}
                    <div className="age-range-buttons">
                      {ageRangeOptions.map((opt) => {
                        const isSelected = kidsAgeRange[0] <= opt.min && kidsAgeRange[1] >= opt.max;
                        const isExactMatch = kidsAgeRange[0] === opt.min && kidsAgeRange[1] === opt.max;
                        return (
                          <button
                            key={opt.label}
                            className={`age-range-btn ${isExactMatch ? 'active' : isSelected ? 'in-range' : ''}`}
                            onClick={() => setKidsAgeRange([opt.min, opt.max])}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                      <button
                        className={`age-range-btn ${kidsAgeRange[0] === 0 && kidsAgeRange[1] === 18 ? 'active' : ''}`}
                        onClick={() => setKidsAgeRange([0, 18])}
                      >
                        All Kids
                      </button>
                    </div>
                  </div>
                )}

                <div className="filters-row-bottom">
                  {/* Category Filter */}
                  <div className="filter-group">
                    <select 
                      value={filters.category} 
                      onChange={(e) => setFilters({...filters, category: e.target.value})}
                      className="filter-dropdown"
                    >
                      <option value="all">🏷️ All Categories</option>
                      {categories.slice(1).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  {/* Price Filter */}
                  <div className="filter-group">
                    <select 
                      value={filters.price} 
                      onChange={(e) => setFilters({...filters, price: e.target.value})}
                      className="filter-dropdown"
                    >
                      <option value="all">💵 All Prices</option>
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  {/* Reset Button */}
                  {(() => {
                    const hasActiveFilters = filters.day !== 'today' || filters.time !== 'all' ||
                                            filters.age !== 'all' || filters.category !== 'all' || filters.price !== 'all' ||
                                            (kidsAgeRange[0] !== 0 || kidsAgeRange[1] !== 18);
                    return hasActiveFilters ? (
                      <button
                        onClick={() => {
                          setFilters({day: 'today', time: 'all', age: 'all', category: 'all', price: 'all'});
                          setKidsAgeRange([0, 18]);
                        }}
                        className="reset-btn"
                      >
                        ↺ Reset
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
            </>
          )}

          <div className="content">
            {currentSection !== 'wellness' && (
            <div className="results-count">
              {currentSection === 'deals' ? (
                dealsLoading ? 'Loading...' : `${filterDeals().filter(d => dealCategoryFilter === 'All' || normalizeDealCategory(d.category) === dealCategoryFilter).length} results`
              ) : currentSection === 'services' ? (
                `${REAL_DATA.services.filter(s => {
                  if (serviceCategoryFilter === 'All') return true;
                  const normalizedCategory = s.category.toLowerCase();
                  const filterLower = serviceCategoryFilter.toLowerCase();
                  if (filterLower.includes('construction')) return normalizedCategory.includes('construction') || normalizedCategory.includes('contractor') || normalizedCategory.includes('home builder');
                  if (filterLower.includes('electrical')) return normalizedCategory.includes('electric');
                  if (filterLower.includes('plumbing')) return normalizedCategory.includes('plumb') || normalizedCategory.includes('hvac') || normalizedCategory.includes('heating');
                  if (filterLower.includes('landscaping')) return normalizedCategory.includes('landscap') || normalizedCategory.includes('lawn');
                  if (filterLower.includes('painting')) return normalizedCategory.includes('paint');
                  if (filterLower.includes('roofing')) return normalizedCategory.includes('roof');
                  if (filterLower.includes('flooring')) return normalizedCategory.includes('floor');
                  if (filterLower.includes('cleaning')) return normalizedCategory.includes('clean');
                  if (filterLower.includes('tree')) return normalizedCategory.includes('tree');
                  if (serviceCategoryFilter === 'Other') return !normalizedCategory.includes('construction') && !normalizedCategory.includes('electric') && !normalizedCategory.includes('plumb') && !normalizedCategory.includes('hvac') && !normalizedCategory.includes('landscap') && !normalizedCategory.includes('paint') && !normalizedCategory.includes('roof') && !normalizedCategory.includes('floor') && !normalizedCategory.includes('clean') && !normalizedCategory.includes('tree');
                  return normalizedCategory.includes(filterLower);
                }).length} results`
              ) : (
                eventsLoading ? 'Loading...' : `${filterEvents().length} results`
              )}
            </div>
            )}

            {currentSection === 'deals' ? (
              <>
                {/* Deals Filter */}
                <div className="filters-section" style={{marginTop: '20px'}}>
                  <div className="filters-row-single">
                    <div className="filter-group">
                      <select
                        value={dealCategoryFilter}
                        onChange={(e) => setDealCategoryFilter(e.target.value)}
                        className="filter-dropdown"
                      >
                        <option value="All">💰 All Deals</option>
                        <option value="Food & Drink">🍔 Food & Drink</option>
                        <option value="Shopping">🛍️ Shopping</option>
                        <option value="Services">🔧 Services</option>
                        <option value="Fitness">💪 Fitness</option>
                        <option value="Recreation">🎯 Recreation</option>
                        <option value="Wellness">🧘 Wellness</option>
                        <option value="Accommodations">🏨 Accommodations</option>
                        <option value="Family">👨‍👩‍👧‍👦 Family</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="deals-grid">
                  {filterDeals()
                    .filter(deal => {
                      if (dealCategoryFilter === 'All') return true;
                      // Use normalized category for filtering
                      return normalizeDealCategory(deal.category) === dealCategoryFilter;
                    })
                    .map((deal, index) => (
                  <div
                    key={deal.id}
                    className="deal-card"
                    onClick={() => setSelectedDeal(deal)}
                    ref={(el) => dealCardRefs.current[index] = el}
                  >
                    {/* Prominent savings badge at top */}
                    {getDealSavingsDisplay(deal) && (
                      <div className={`deal-savings-badge savings-${getDealSavingsDisplay(deal).type}`}>
                        {getDealSavingsDisplay(deal).text}
                      </div>
                    )}

                    <div className="deal-card-header-new">
                      <div className="deal-title-section">
                        <h3>{generateSmartDealTitle(deal, getVenueName(deal.venueId, deal))}</h3>
                        {deal.verified && (
                          <div
                            className="verified-badge-premium"
                            onClick={(e) => e.stopPropagation()}
                            data-tooltip="Verified"
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="deal-card-body-new">
                      <div className="deal-detail-row">
                        <div className="deal-detail-item">
                          <div className="detail-icon venue-icon">
                            <MapPin size={16} />
                          </div>
                          <span className="detail-text">{getVenueName(deal.venueId, deal)}</span>
                        </div>
                      </div>

                      {deal.schedule && (
                        <div className="deal-detail-row">
                          <div className="deal-detail-item full-width">
                            <div className="detail-icon clock-icon">
                              <Clock size={16} />
                            </div>
                            <span className="detail-text">{deal.schedule}</span>
                          </div>
                        </div>
                      )}

                      {deal.description && deal.description.toLowerCase() !== deal.title.toLowerCase() && (
                        <p className="deal-description-new">{deal.description.length > 80 ? deal.description.substring(0, 77) + '...' : deal.description}</p>
                      )}
                    </div>

                    <button
                      className={`save-star-btn ${isItemSavedLocal('deal', deal.id) ? 'saved' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSave(deal.id, 'deal', deal.title, { venue: getVenueName(deal.venueId, deal) });
                      }}
                      data-tooltip={isItemSavedLocal('deal', deal.id) ? "Saved" : "Save"}
                    >
                      <Star size={24} fill={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "none"} stroke={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
                    </button>
                    <ChevronRight className="deal-chevron" size={20} />
                  </div>
                ))}
              </div>
              </>
            ) : currentSection === 'services' ? (
              <>
                {servicesSubView === 'booking' ? (
                  <WellnessBooking
                    onBack={() => setServicesSubView('directory')}
                    isAuthenticated={isAuthenticated}
                    session={session}
                    showToast={showToast}
                    setShowAuthModal={setShowAuthModal}
                  />
                ) : (
                <>
                {/* Wellness Booking Banner */}
                <div
                  className="wb-launch-banner"
                  onClick={() => setServicesSubView('booking')}
                  style={{
                    margin: '16px 24px 0',
                    padding: '20px',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Heart size={18} />
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.9 }}>New Feature</span>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.3px' }}>Book Wellness</h3>
                    <p style={{ fontSize: '13px', opacity: 0.85, margin: 0 }}>
                      Find massage, physio, chiro & acupuncture openings across Squamish
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', fontSize: '13px', fontWeight: 600 }}>
                      <span>Browse availability</span>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '120px',
                    height: '120px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: '-30px',
                    right: '40px',
                    width: '80px',
                    height: '80px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '50%',
                  }} />
                </div>

                {/* Services Filter */}
                <div className="filters-section" style={{marginTop: '20px'}}>
                  <div className="filters-row-single">
                    <div className="filter-group">
                      <select
                        value={serviceCategoryFilter}
                        onChange={(e) => setServiceCategoryFilter(e.target.value)}
                        className="filter-dropdown"
                      >
                        <option value="All">🔧 All Services</option>
                        <option value="Restaurants & Dining">🍽️ Restaurants & Dining</option>
                        <option value="Retail & Shopping">🛍️ Retail & Shopping</option>
                        <option value="Cafes & Bakeries">☕ Cafes & Bakeries</option>
                        <option value="Outdoor Adventures">🏔️ Outdoor Adventures</option>
                        <option value="Auto Services">🚗 Auto Services</option>
                        <option value="Real Estate">🏘️ Real Estate</option>
                        <option value="Fitness & Gyms">💪 Fitness & Gyms</option>
                        <option value="Recreation & Sports">⚽ Recreation & Sports</option>
                        <option value="Health & Wellness">🧘 Health & Wellness</option>
                        <option value="Construction & Building">🏗️ Construction & Building</option>
                        <option value="Outdoor Gear & Shops">🎒 Outdoor Gear & Shops</option>
                        <option value="Community Services">🤝 Community Services</option>
                        <option value="Hotels & Lodging">🏨 Hotels & Lodging</option>
                        <option value="Web & Marketing">💻 Web & Marketing</option>
                        <option value="Financial Services">💰 Financial Services</option>
                        <option value="Medical Clinics">🏥 Medical Clinics</option>
                        <option value="Photography">📸 Photography</option>
                        <option value="Attractions">🎡 Attractions</option>
                        <option value="Churches & Religious">⛪ Churches & Religious</option>
                        <option value="Salons & Spas">💇 Salons & Spas</option>
                        <option value="Arts & Culture">🎨 Arts & Culture</option>
                        <option value="Other">📋 Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Search Results Count */}
                {debouncedSearch && (
                  <div className="search-results-count">
                    <span className="results-text">
                      {(() => {
                        const count = services.filter(service => {
                          const query = debouncedSearch.toLowerCase().trim();
                          return service.name.toLowerCase().includes(query) ||
                                 service.category.toLowerCase().includes(query) ||
                                 service.address?.toLowerCase().includes(query);
                        }).length;
                        return count === 0 ? 'No results' : `${count} result${count !== 1 ? 's' : ''} for "${searchQuery}"`;
                      })()}
                    </span>
                  </div>
                )}
                
                <div className="services-grid" key={debouncedSearch}>
                  {servicesLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                      Loading services...
                    </div>
                  ) : services
                    .filter(service => {
                      // Search filter - search in name, category, and address
                      if (debouncedSearch) {
                        const query = debouncedSearch.toLowerCase().trim();
                        const nameMatch = service.name.toLowerCase().includes(query);
                        const categoryMatch = service.category.toLowerCase().includes(query);
                        const addressMatch = service.address?.toLowerCase().includes(query);
                        if (!nameMatch && !categoryMatch && !addressMatch) {
                          return false;
                        }
                      }
                      
                      // Category filter
                      if (serviceCategoryFilter === 'All') return true;

                      // Main categories with 10+ businesses - exact match
                      const mainCategories = [
                        'Restaurants & Dining', 'Retail & Shopping', 'Cafes & Bakeries',
                        'Outdoor Adventures', 'Auto Services', 'Real Estate',
                        'Fitness & Gyms', 'Recreation & Sports', 'Health & Wellness',
                        'Construction & Building', 'Outdoor Gear & Shops', 'Community Services',
                        'Hotels & Lodging', 'Web & Marketing', 'Financial Services',
                        'Medical Clinics', 'Photography', 'Attractions',
                        'Churches & Religious', 'Salons & Spas', 'Arts & Culture'
                      ];

                      // "Other" catches everything not in main categories
                      if (serviceCategoryFilter === 'Other') {
                        return !mainCategories.includes(service.category);
                      }

                      // Exact category match
                      return service.category === serviceCategoryFilter;
                    })
                    .sort((a, b) => {
                      // Tiered sorting system
                      const aReviews = a.reviews || 0;
                      const bReviews = b.reviews || 0;
                      const aRating = a.rating || 0;
                      const bRating = b.rating || 0;
                      
                      // Tier 1: 50+ reviews AND 4+ stars
                      const aIsTier1 = aReviews >= 50 && aRating >= 4;
                      const bIsTier1 = bReviews >= 50 && bRating >= 4;
                      
                      // If one is Tier 1 and other isn't, Tier 1 comes first
                      if (aIsTier1 && !bIsTier1) return -1;
                      if (!aIsTier1 && bIsTier1) return 1;
                      
                      // Within same tier, sort by rating (highest first), then by reviews as tiebreaker
                      if (bRating !== aRating) return bRating - aRating;
                      return bReviews - aReviews;
                    })
                    .map((service, index) => {
                      // Check if this is a Tier 1 business (50+ reviews AND 4+ stars)
                      const isTier1 = (service.reviews || 0) >= 50 && (service.rating || 0) >= 4;
                      
                      // Generate social proof - uses real Pulse data when available, falls back to Google data
                      const getSocialProof = (svc, idx, tier1) => {
                        const reviews = svc.reviews || 0;
                        const rating = svc.rating || 0;

                        // If service has pre-fetched Pulse social proof data, use it
                        if (svc.pulseData) {
                          const pd = svc.pulseData;
                          // Jobs completed on Pulse
                          if (pd.jobs_completed >= 100) {
                            return { type: 'volume', text: `📈 ${pd.jobs_completed}+ jobs completed on Pulse` };
                          }
                          // Neighbors hired
                          if (pd.neighbor_hires >= 3) {
                            return { type: 'neighbor', text: `👥 ${pd.neighbor_hires} neighbors hired them` };
                          }
                          // Fast response
                          if (pd.response_time_minutes && pd.response_time_minutes <= 60) {
                            const timeText = formatResponseTime(pd.response_time_minutes);
                            return { type: 'response', text: `⚡ Responds in ${timeText}` };
                          }
                          // Testimonial
                          if (pd.testimonial) {
                            const quote = pd.testimonial.quote.length > 40
                              ? pd.testimonial.quote.substring(0, 40) + '...'
                              : pd.testimonial.quote;
                            return { type: 'testimonial', text: `💬 "${quote}" — ${pd.testimonial.author}` };
                          }
                          // Satisfaction rate
                          if (pd.satisfaction_rate >= 95) {
                            return { type: 'satisfaction', text: `✅ ${pd.satisfaction_rate}% satisfaction rate` };
                          }
                          // Years active
                          if (pd.years_active >= 5) {
                            return { type: 'longevity', text: `📅 ${pd.years_active} years serving Squamish` };
                          }
                          // Some jobs completed
                          if (pd.jobs_completed >= 10) {
                            return { type: 'trusted', text: `✅ ${pd.jobs_completed} jobs completed on Pulse` };
                          }
                        }

                        // Fallback to Google data
                        if (tier1 && idx < 3 && rating >= 4.5) {
                          return { type: 'rank', text: `⭐ Top rated in ${svc.category.split('&')[0].trim()}` };
                        }

                        if (rating >= 4.8 && reviews >= 50) {
                          return { type: 'excellent', text: `⭐ ${rating} rating from ${reviews} Google reviews` };
                        }

                        if (rating >= 4.5 && reviews >= 100) {
                          return { type: 'popular', text: `📍 ${reviews}+ reviews on Google` };
                        }

                        if (rating >= 4.5 && reviews >= 20) {
                          return { type: 'highrated', text: `⭐ Highly rated (${rating}/5)` };
                        }

                        if (reviews >= 50) {
                          return { type: 'reviewed', text: `📍 ${reviews} Google reviews` };
                        }

                        if (rating >= 4.0) {
                          return { type: 'rated', text: `⭐ ${rating}/5 on Google` };
                        }

                        // Default - just show it's a local business
                        return { type: 'default', text: '📍 Local Squamish Business' };
                      };

                      const socialProof = getSocialProof(service, index, isTier1);
                      
                      return (
                    <div key={service.id} className="service-card" ref={(el) => serviceCardRefs.current[index] = el} onClick={() => setSelectedService(service)}>
                      <div className="service-card-header-new">
                        <div className="service-title-section">
                          <h3>{service.name}</h3>
                          
                        </div>
                        {service.rating && (
                          <div className="service-rating-badge">
                            <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                            <span>{service.rating}</span>
                            {service.reviews && <span className="review-count">({service.reviews})</span>}
                          </div>
                        )}
                      </div>

                      <div className="service-card-body-new">
                        <div className="service-detail-row">
                          <div className="service-detail-item">
                            <div className="detail-icon category-icon">
                              <Wrench size={16} />
                            </div>
                            <span className="detail-text service-category-text">{service.category}</span>
                          </div>
                        </div>

                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(service.name + ' ' + service.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="service-detail-row service-link-row"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="service-detail-item">
                            <div className="detail-icon location-icon">
                              <MapPin size={16} />
                            </div>
                            <span className="detail-text detail-link">{service.address}</span>
                          </div>
                        </a>
                      </div>

                      {/* Social Proof Banner with Arrow */}
                      <div className={`service-social-proof ${socialProof.type}`}>
                        <span className="social-proof-text">{socialProof.text}</span>
                        <div className="social-proof-arrow">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                      );
                    })}
                </div>
                {/* No results state for services */}
                {debouncedSearch && services.filter(service => {
                  const query = debouncedSearch.toLowerCase().trim();
                  return service.name.toLowerCase().includes(query) ||
                         service.category.toLowerCase().includes(query) ||
                         service.address?.toLowerCase().includes(query);
                }).length === 0 && (
                  <div className="no-results-state">
                    <div className="no-results-icon">🔍</div>
                    <h3>No businesses found for "{searchQuery}"</h3>
                    <p>Try a different search term or browse all services</p>
                    <button onClick={() => setSearchQuery('')} className="clear-search-btn">
                      Clear Search
                    </button>
                  </div>
                )}
              </>
                )}
              </>
            ) : currentSection === 'wellness' ? (
              <WellnessBooking
                onBack={() => setCurrentSection('services')}
                isAuthenticated={isAuthenticated}
                session={session}
                showToast={showToast}
                setShowAuthModal={setShowAuthModal}
              />
            ) : (
              <div className="events-list">
                {renderEventsWithDividers()}
              </div>
            )}
          </div>

          {/* Event/Class Detail Modal - Premium */}
          {selectedEvent && (
            <div className="modal-overlay event-modal-overlay" onClick={() => setSelectedEvent(null)}>
              <div className="event-detail-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn event-close" onClick={() => setSelectedEvent(null)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M1 13L13 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                
                {/* Hero Section */}
                <div className={`event-hero ${selectedEvent.eventType === 'class' ? 'class-hero' : ''}`}>
                  <div className="event-hero-content">
                    <div className="event-hero-badges">
                      {selectedEvent.eventType === 'class' ? (
                        <span className="event-type-pill class-pill">
                          <Sparkles size={12} />
                          Class
                        </span>
                      ) : (
                        <span className="event-type-pill event-pill">
                          <Zap size={12} />
                          Event
                        </span>
                      )}
                      {selectedEvent.recurrence !== 'none' && (
                        <span className="recurring-pill">
                          <Repeat size={12} />
                          {selectedEvent.recurrence}
                        </span>
                      )}
                    </div>
                    <h1 className="event-hero-title">{selectedEvent.title}</h1>
                    <div className="event-hero-venue">
                      <MapPin size={16} />
                      <span>{getVenueName(selectedEvent.venueId, selectedEvent)}</span>
                      {isVerified(selectedEvent.venueId) && (
                        <div className="venue-verified-badge">
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Date/Time Card */}
                <div className="event-datetime-card">
                  <div className="datetime-icon">
                    <Calendar size={24} />
                  </div>
                  <div className="datetime-content">
                    <div className="datetime-date">
                      {selectedEvent.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="datetime-time">
                      {selectedEvent.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })} - {selectedEvent.end.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    className={`add-calendar-btn ${isInMyCalendar(selectedEvent.id) ? 'added' : ''}`}
                    onClick={() => addToCalendar(selectedEvent)}
                    style={{
                      width: '44px',
                      height: '44px',
                      minWidth: '44px',
                      background: isInMyCalendar(selectedEvent.id)
                        ? '#dcfce7'
                        : '#ffffff',
                      border: isInMyCalendar(selectedEvent.id) ? '2px solid #bbf7d0' : '2px solid #c7d2fe',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}
                  >
                    <div style={{ color: isInMyCalendar(selectedEvent.id) ? '#047857' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isInMyCalendar(selectedEvent.id) ? (
                        <Check size={22} strokeWidth={3} />
                      ) : (
                        <CalendarPlus size={22} strokeWidth={2} />
                      )}
                    </div>
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="event-quick-actions">
                  {selectedEvent.eventType === 'class' && (
                    <button
                      className="quick-action-btn book-class-highlight"
                      onClick={() => handleBookClick(selectedEvent)}
                    >
                      <div className="quick-action-icon book-class">
                        <Ticket size={20} />
                      </div>
                      <span>Book</span>
                    </button>
                  )}
                  <button
                    className={`quick-action-btn ${isItemSavedLocal(selectedEvent.eventType === 'class' ? 'class' : 'event', selectedEvent.id) ? 'saved' : ''}`}
                    onClick={() => toggleSave(selectedEvent.id, selectedEvent.eventType === 'class' ? 'class' : 'event', selectedEvent.title, { venue: selectedEvent.venue, date: selectedEvent.date })}
                  >
                    <div className={`quick-action-icon save ${isItemSavedLocal(selectedEvent.eventType === 'class' ? 'class' : 'event', selectedEvent.id) ? 'saved' : ''}`}>
                      <Star size={20} fill={isItemSavedLocal(selectedEvent.eventType === 'class' ? 'class' : 'event', selectedEvent.id) ? 'currentColor' : 'none'} />
                    </div>
                    <span>{isItemSavedLocal(selectedEvent.eventType === 'class' ? 'class' : 'event', selectedEvent.id) ? 'Saved' : 'Save'}</span>
                  </button>
                  <button
                    className="quick-action-btn"
                    onClick={async () => {
                      const shareData = {
                        title: selectedEvent.title,
                        text: `Check out ${selectedEvent.title} at ${getVenueName(selectedEvent.venueId, selectedEvent)}`,
                        url: window.location.href
                      };
                      try {
                        if (navigator.share) {
                          await navigator.share(shareData);
                        } else {
                          await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
                          setCalendarToastMessage('Link copied to clipboard!');
                          setShowCalendarToast(true);
                          setTimeout(() => setShowCalendarToast(false), 2000);
                        }
                      } catch (err) {
                        console.error('Error sharing:', err);
                      }
                    }}
                  >
                    <div className="quick-action-icon share">
                      <Share2 size={20} />
                    </div>
                    <span>Share</span>
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getVenueName(selectedEvent.venueId, selectedEvent) + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-action-btn"
                  >
                    <div className="quick-action-icon directions">
                      <Navigation size={20} />
                    </div>
                    <span>Directions</span>
                  </a>
                </div>

                {/* Details Section */}
                <div className="event-section">
                  <h2 className="event-section-title">Details</h2>
                  <div className="event-details-grid">
                    {selectedEvent.price && (
                      <div className="event-detail-card">
                        <div className="event-detail-icon price-icon">
                          <DollarSign size={20} />
                        </div>
                        <div className="event-detail-content">
                          <span className="event-detail-label">Price</span>
                          <span className="event-detail-value">{selectedEvent.price}</span>
                        </div>
                      </div>
                    )}
                    {selectedEvent.ageGroup && (
                      <div className="event-detail-card">
                        <div className="event-detail-icon age-icon">
                          <Users size={20} />
                        </div>
                        <div className="event-detail-content">
                          <span className="event-detail-label">Age Group</span>
                          <span className="event-detail-value">{selectedEvent.ageGroup}</span>
                        </div>
                      </div>
                    )}
                    <div className="event-detail-card">
                      <div className="event-detail-icon venue-icon">
                        <Building size={20} />
                      </div>
                      <div className="event-detail-content">
                        <span className="event-detail-label">Venue</span>
                        <span className="event-detail-value">{getVenueName(selectedEvent.venueId, selectedEvent)}</span>
                      </div>
                    </div>
                    <div className="event-detail-card">
                      <div className="event-detail-icon time-icon">
                        <Clock size={20} />
                      </div>
                      <div className="event-detail-content">
                        <span className="event-detail-label">Duration</span>
                        <span className="event-detail-value">
                          {Math.round((selectedEvent.end - selectedEvent.start) / (1000 * 60))} min
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div className="event-section">
                  <h2 className="event-section-title">About</h2>
                  <p className="event-about-text">{selectedEvent.description}</p>
                </div>

                {/* CTA Section */}
                <div className="event-cta-section">
                  {selectedEvent.eventType === 'class' && (
                    <a
                      href={selectedEvent.bookingUrl || `https://www.google.com/search?q=${encodeURIComponent(getVenueName(selectedEvent.venueId, selectedEvent) + ' Squamish book class')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="event-cta-btn primary book-class-btn"
                    >
                      <ExternalLink size={18} />
                      Book Class
                    </a>
                  )}
                  <button
                    className={`event-cta-btn ${selectedEvent.eventType === 'class' ? 'secondary' : 'primary'} ${isInMyCalendar(selectedEvent.id) ? 'added' : ''}`}
                    onClick={() => addToCalendar(selectedEvent)}
                  >
                    {isInMyCalendar(selectedEvent.id) ? (
                      <>
                        <Check size={18} />
                        Added to Calendar
                      </>
                    ) : (
                      <>
                        <Calendar size={18} />
                        Add to Calendar
                      </>
                    )}
                  </button>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getVenueName(selectedEvent.venueId, selectedEvent) + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-cta-btn secondary"
                  >
                    <MapPin size={18} />
                    View Venue
                  </a>
                </div>

                {/* Footer */}
                <div className="event-modal-footer">
                  <p>Event information may change. Please verify with organizer.</p>
                </div>
              </div>
            </div>
          )}

          {/* Deal Detail Modal - Premium */}
          {selectedDeal && (
            <div className="modal-overlay deal-modal-overlay" onClick={() => setSelectedDeal(null)}>
              <div className="deal-detail-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn deal-close" onClick={() => setSelectedDeal(null)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display: 'block'}}>
                    <path d="M1 1L13 13M1 13L13 1" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                
                {/* Hero Section */}
                <div className="deal-hero">
                  <div className="deal-hero-content">
                    {selectedDeal.verified && (
                      <div className="deal-hero-badges">
                        <span className="verified-pill">
                          <Check size={12} />
                          Verified
                        </span>
                      </div>
                    )}
                    <h1 className="deal-hero-title">{generateSmartDealTitle(selectedDeal, getVenueName(selectedDeal.venueId, selectedDeal))}</h1>
                    <div className="deal-hero-venue">
                      <MapPin size={16} />
                      <span>{getVenueName(selectedDeal.venueId, selectedDeal)}</span>
                    </div>
                  </div>
                </div>

                {/* Schedule Card */}
                <div className="deal-schedule-card">
                  <div className="schedule-icon">
                    <Clock size={24} />
                  </div>
                  <div className="schedule-content">
                    <div className="schedule-label">Available</div>
                    <div className="schedule-value">{selectedDeal.schedule}</div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="deal-quick-actions">
                  <button
                    className={`quick-action-btn ${isItemSavedLocal('deal', selectedDeal.id) ? 'saved' : ''}`}
                    onClick={() => toggleSave(selectedDeal.id, 'deal', selectedDeal.title, { business: selectedDeal.venueName })}
                  >
                    <div className={`quick-action-icon save ${isItemSavedLocal('deal', selectedDeal.id) ? 'saved' : ''}`}>
                      <Star size={20} fill={isItemSavedLocal('deal', selectedDeal.id) ? 'currentColor' : 'none'} />
                    </div>
                    <span>{isItemSavedLocal('deal', selectedDeal.id) ? 'Saved' : 'Save'}</span>
                  </button>
                  <button
                    className="quick-action-btn"
                    onClick={async () => {
                      const shareData = {
                        title: selectedDeal.title,
                        text: `Check out this deal: ${selectedDeal.title} at ${getVenueName(selectedDeal.venueId, selectedDeal)}`,
                        url: window.location.href
                      };
                      try {
                        if (navigator.share) {
                          await navigator.share(shareData);
                        } else {
                          await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
                          setCalendarToastMessage('Link copied to clipboard!');
                          setShowCalendarToast(true);
                          setTimeout(() => setShowCalendarToast(false), 2000);
                        }
                      } catch (err) {
                        console.error('Error sharing:', err);
                      }
                    }}
                  >
                    <div className="quick-action-icon share">
                      <Share2 size={20} />
                    </div>
                    <span>Share</span>
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(getVenueName(selectedDeal.venueId, selectedDeal) + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-action-btn"
                  >
                    <div className="quick-action-icon directions">
                      <Navigation size={20} />
                    </div>
                    <span>Directions</span>
                  </a>
                </div>

                {/* About Section */}
                <div className="deal-section">
                  <h2 className="deal-section-title">About This Deal</h2>
                  <p className="deal-about-text">
                    {generateEnhancedDealDescription(selectedDeal, getVenueName(selectedDeal.venueId, selectedDeal))}
                  </p>
                </div>

                {/* Details Section */}
                <div className="deal-section">
                  <h2 className="deal-section-title">Details</h2>
                  <div className="deal-details-grid">
                    <div className="deal-detail-card">
                      <div className="deal-detail-icon venue-icon">
                        <Building size={20} />
                      </div>
                      <div className="deal-detail-content">
                        <span className="deal-detail-label">Location</span>
                        <span className="deal-detail-value">{getVenueName(selectedDeal.venueId, selectedDeal)}</span>
                      </div>
                    </div>
                    <div className="deal-detail-card">
                      <div className="deal-detail-icon time-icon">
                        <Clock size={20} />
                      </div>
                      <div className="deal-detail-content">
                        <span className="deal-detail-label">Schedule</span>
                        <span className="deal-detail-value">{selectedDeal.schedule}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terms Section */}
                {selectedDeal.terms && (
                  <div className="deal-section">
                    <h2 className="deal-section-title">Terms & Conditions</h2>
                    <div className="deal-terms-card">
                      <Info size={18} className="terms-icon" />
                      <p className="deal-terms-text">{selectedDeal.terms}</p>
                    </div>
                  </div>
                )}

                {/* More from this Business Section */}
                {(() => {
                  const allDeals = [...REAL_DATA.deals, ...dbDeals];
                  const relatedDeals = getRelatedDeals(selectedDeal, allDeals);
                  if (relatedDeals.length === 0) return null;

                  return (
                    <div className="deal-section">
                      <h2 className="deal-section-title">
                        More from {getVenueName(selectedDeal.venueId, selectedDeal)}
                      </h2>
                      <div className="related-deals-grid">
                        {relatedDeals.slice(0, 3).map(deal => (
                          <div
                            key={deal.id}
                            className="related-deal-card"
                            onClick={() => setSelectedDeal(deal)}
                          >
                            <div className="related-deal-content">
                              <h4 className="related-deal-title">
                                {generateSmartDealTitle(deal, getVenueName(deal.venueId, deal))}
                              </h4>
                              {deal.discount && (
                                <span className="related-deal-discount">{deal.discount}</span>
                              )}
                              {deal.schedule && (
                                <span className="related-deal-schedule">
                                  <Clock size={12} />
                                  {deal.schedule}
                                </span>
                              )}
                            </div>
                            <ChevronRight size={18} className="related-deal-arrow" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* CTA Section */}
                <div className="deal-cta-section">
                  <button
                    className="deal-cta-btn primary"
                    onClick={async () => {
                      if (!session?.user) {
                        setShowAuthModal(true);
                        return;
                      }
                      // Generate redemption code
                      const redemptionCode = `PULSE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                      // Track redemption in database
                      const { error } = await supabase.from('deal_redemptions').insert({
                        user_id: session.user.id,
                        deal_id: selectedDeal.id,
                        business_id: selectedDeal.businessId || null,
                        redemption_code: redemptionCode,
                        status: 'pending',
                        savings_amount: selectedDeal.savingsPercent || null
                      });
                      if (error) {
                        console.error('Error tracking redemption:', error);
                        setCalendarToastMessage(`Deal saved! Show this to ${getVenueName(selectedDeal.venueId, selectedDeal)} to redeem.`);
                      } else {
                        setCalendarToastMessage(`Redemption code: ${redemptionCode} - Show this to ${getVenueName(selectedDeal.venueId, selectedDeal)}!`);
                      }
                      setShowCalendarToast(true);
                      setTimeout(() => setShowCalendarToast(false), 5000);
                    }}
                  >
                    <Ticket size={18} />
                    Redeem Deal
                  </button>
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getVenueName(selectedDeal.venueId, selectedDeal) + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="deal-cta-btn secondary"
                  >
                    <MapPin size={18} />
                    View Location
                  </a>
                </div>

                {/* Footer */}
                <div className="deal-modal-footer">
                  <p>Deal terms subject to change. Please verify with business.</p>
                </div>
              </div>
            </div>
          )}

          {/* Service Detail Modal - Premium */}
          {selectedService && (
            <div className="modal-overlay service-modal-overlay" onClick={() => { setSelectedService(null); setUserServiceRating(0); setHoverServiceRating(0); }}>
              <div className="service-detail-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn service-close" onClick={() => { setSelectedService(null); setUserServiceRating(0); setHoverServiceRating(0); }}><X size={24} /></button>
                
                {/* Hero Section */}
                <div className="service-hero">
                  <div className="service-hero-content">
                    <div className="service-hero-category">
                      <span className="category-pill">{selectedService.category}</span>
                    </div>
                    <h1 className="service-hero-title">{selectedService.name}</h1>
                    <div className="service-hero-location">
                      <MapPin size={16} />
                      <span>{selectedService.address}</span>
                    </div>
                  </div>
                  
                  {/* Rating Card */}
                  {selectedService.rating && (
                    <div className="service-rating-card">
                      <div className="rating-score">{selectedService.rating}</div>
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star 
                            key={star} 
                            size={16} 
                            fill={star <= Math.round(selectedService.rating) ? '#fbbf24' : 'none'} 
                            stroke="#fbbf24" 
                          />
                        ))}
                      </div>
                      <div className="rating-reviews">{selectedService.reviews?.toLocaleString()} Google reviews</div>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="service-quick-actions">
                  <a 
                    href={`tel:${selectedService.phone}`} 
                    className={`quick-action-btn ${!selectedService.phone ? 'disabled' : ''}`}
                    onClick={(e) => !selectedService.phone && e.preventDefault()}
                  >
                    <div className="quick-action-icon call">
                      <Phone size={20} />
                    </div>
                    <span>Call</span>
                  </a>
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedService.name + ' ' + selectedService.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-action-btn"
                  >
                    <div className="quick-action-icon directions">
                      <Navigation size={20} />
                    </div>
                    <span>Directions</span>
                  </a>
                  <a 
                    href={selectedService.website || `https://www.google.com/search?q=${encodeURIComponent(selectedService.name + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="quick-action-btn"
                  >
                    <div className="quick-action-icon website">
                      <Globe size={20} />
                    </div>
                    <span>Website</span>
                  </a>
                  <button
                    className={`quick-action-btn ${isItemSavedLocal('service', selectedService.id) ? 'saved' : ''}`}
                    onClick={() => toggleSave(selectedService.id, 'service', selectedService.name, { category: selectedService.category })}
                  >
                    <div className={`quick-action-icon save ${isItemSavedLocal('service', selectedService.id) ? 'saved' : ''}`}>
                      <Star size={20} fill={isItemSavedLocal('service', selectedService.id) ? 'currentColor' : 'none'} />
                    </div>
                    <span>{isItemSavedLocal('service', selectedService.id) ? 'Saved' : 'Save'}</span>
                  </button>
                </div>

                {/* About Section */}
                <div className="service-section">
                  <h2 className="service-section-title">About</h2>
                  <p className="service-about-text">
                    {selectedService.description || `${selectedService.name} is a ${selectedService.category.toLowerCase()} business located in Squamish, BC.`}
                  </p>
                </div>

                {/* Details Section */}
                <div className="service-section">
                  <h2 className="service-section-title">Details</h2>
                  <div className="service-details-grid">
                    <div className="detail-card">
                      <div className="detail-card-icon">
                        <Wrench size={20} />
                      </div>
                      <div className="detail-card-content">
                        <span className="detail-label">Category</span>
                        <span className="detail-value">{selectedService.category}</span>
                      </div>
                    </div>
                    
                    <div className="detail-card">
                      <div className="detail-card-icon">
                        <MapPin size={20} />
                      </div>
                      <div className="detail-card-content">
                        <span className="detail-label">Location</span>
                        <span className="detail-value">{selectedService.address}</span>
                      </div>
                    </div>
                    
                    {selectedService.phone && (
                      <div className="detail-card">
                        <div className="detail-card-icon">
                          <Phone size={20} />
                        </div>
                        <div className="detail-card-content">
                          <span className="detail-label">Phone</span>
                          <span className="detail-value">{selectedService.phone}</span>
                        </div>
                      </div>
                    )}
                    
                    {selectedService.email && (
                      <div className="detail-card">
                        <div className="detail-card-icon">
                          <Mail size={20} />
                        </div>
                        <div className="detail-card-content">
                          <span className="detail-label">Email</span>
                          <span className="detail-value">{selectedService.email}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rating & Community Section */}
                <div className="service-section">
                  <div className="rating-community-card">
                    {/* Rating Display */}
                    <div className="rating-display">
                      <div className="rating-score">
                        <span className="rating-number">{selectedService.rating || '—'}</span>
                        <div className="rating-meta">
                          <div className="rating-stars-row">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star 
                                key={star} 
                                size={18} 
                                fill={star <= Math.round(selectedService.rating || 0) ? '#fbbf24' : '#e5e7eb'} 
                                stroke={star <= Math.round(selectedService.rating || 0) ? '#fbbf24' : '#e5e7eb'}
                              />
                            ))}
                          </div>
                          <span className="rating-count">{selectedService.reviews?.toLocaleString() || 0} reviews</span>
                        </div>
                      </div>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedService.name + ' Squamish BC')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="google-reviews-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google Reviews
                        <ChevronRight size={16} />
                      </a>
                    </div>

                    {/* Divider */}
                    <div className="rating-divider"></div>

                    {/* Rate This Business */}
                    <div className="rate-this-business">
                      <p className="rate-prompt">Used this business?</p>
                      <h3 className="rate-title">Share your experience</h3>
                      <div 
                        className="rate-stars-interactive"
                        onMouseLeave={() => setHoverServiceRating(0)}
                      >
                        {[1, 2, 3, 4, 5].map(star => (
                          <button 
                            key={star} 
                            className="rate-star-btn"
                            onMouseEnter={() => setHoverServiceRating(star)}
                            onClick={(e) => { 
                              e.stopPropagation();
                              setUserServiceRating(star);
                            }}
                          >
                            <Star 
                              size={32} 
                              fill={(hoverServiceRating || userServiceRating) >= star ? '#fbbf24' : '#e5e7eb'} 
                              stroke={(hoverServiceRating || userServiceRating) >= star ? '#f59e0b' : '#d1d5db'} 
                            />
                          </button>
                        ))}
                      </div>
                      <p className="rate-helper">
                        {userServiceRating > 0 
                          ? `You rated ${userServiceRating} star${userServiceRating > 1 ? 's' : ''} — Thanks!` 
                          : 'Tap a star to rate'}
                      </p>
                    </div>
                  </div>

                  {/* Trust Indicators */}
                  <div className="trust-indicators">
                    {(selectedService.reviews || 0) >= 50 && (selectedService.rating || 0) >= 4 && (
                      <div className="trust-badge verified">
                        <CheckCircle size={16} />
                        <span>Top Rated</span>
                      </div>
                    )}
                    {(selectedService.reviews || 0) >= 100 && (
                      <div className="trust-badge popular">
                        <Users size={16} />
                        <span>Popular Choice</span>
                      </div>
                    )}
                    <div className="trust-badge local">
                      <MapPin size={16} />
                      <span>Squamish Local</span>
                    </div>
                  </div>
                </div>

                {/* CTA Section */}
                <div className="service-cta-section">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedService.name + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="service-cta-btn primary"
                  >
                    <Navigation size={18} />
                    View on Google Maps
                  </a>
                  <a 
                    href={selectedService.website || `https://www.google.com/search?q=${encodeURIComponent(selectedService.name + ' Squamish BC')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="service-cta-btn secondary"
                  >
                    <Globe size={18} />
                    {selectedService.website ? 'Visit Website' : 'Search Online'}
                  </a>
                </div>

                {/* Footer */}
                <div className="service-modal-footer">
                  <p>Information sourced from Google. Last updated recently.</p>
                  <button className="report-btn">Report an issue</button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Action Button - Premium */}
          <button className="fab-premium" onClick={() => setShowAddEventModal(true)}>
            <Plus size={24} strokeWidth={2.5} />
            <span className="fab-label">Add Event</span>
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="profile-menu-overlay" onClick={() => setShowProfileMenu(false)}>
              <div className="profile-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="profile-menu-header">
                  <div className="profile-avatar large">{user.avatar ? <img src={user.avatar} alt="" /> : (user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U')}</div>
                  <div className="profile-menu-info">
                    <h3>{user.name || 'Guest'}</h3>
                    <p>{user.email || 'Not signed in'}</p>
                  </div>
                </div>
                <div className="profile-menu-divider"></div>
                <div className="profile-menu-items">
                  <button className="profile-menu-item" onClick={() => { setShowProfileModal(true); setProfileTab('overview'); setShowProfileMenu(false); }}>
                    <Users size={18} />
                    <span>My Profile</span>
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowMyCalendarModal(true); setShowProfileMenu(false); }}>
                    <Calendar size={18} />
                    <span>My Calendar</span>
                    {myCalendar.length > 0 && <span className="menu-badge">{myCalendar.length}</span>}
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowProfileModal(true); setProfileTab('saved'); setShowProfileMenu(false); }}>
                    <Star size={18} />
                    <span>Saved Items</span>
                  </button>
                  <div className="profile-menu-divider"></div>
                  <button className="profile-menu-item" onClick={openSubmissionModal}>
                    <Plus size={18} />
                    <span>Add Event / Class / Deal</span>
                  </button>
                  <button className="profile-menu-item" onClick={() => { setShowClaimBusinessModal(true); setShowProfileMenu(false); }}>
                    <Building size={18} />
                    <span>Claim Business</span>
                  </button>
                  {user.isAdmin && (
                    <>
                      <div className="profile-menu-divider"></div>
                      <button className="profile-menu-item admin" onClick={() => { setShowAdminPanel(true); setShowProfileMenu(false); }}>
                        <Eye size={18} />
                        <span>Admin Panel</span>
                        {pendingSubmissions.filter(s => s.status === 'pending').length > 0 && (
                          <span className="menu-badge admin">{pendingSubmissions.filter(s => s.status === 'pending').length}</span>
                        )}
                      </button>
                    </>
                  )}
                  <div className="profile-menu-divider"></div>
                  <button className="profile-menu-item" onClick={() => { setShowProfileModal(true); setProfileTab('settings'); setShowProfileMenu(false); }}>
                    <SlidersHorizontal size={18} />
                    <span>Settings</span>
                  </button>
                </div>
                <div className="profile-menu-divider"></div>
                <button className="profile-menu-item logout" onClick={handleSignOut}>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* Add Event Modal */}
          {showAddEventModal && (
            <div className="modal-overlay" onClick={closeAddEventModal}>
              <div className="modal-content add-event-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={closeAddEventModal}><X size={24} /></button>
                <div className="modal-header-premium">
                  <Plus size={32} className="modal-icon" />
                  <h2>Add Your Event</h2>
                  <p>Share your event with the Squamish community</p>
                </div>
                <div className="modal-body-premium">
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Event Name *</label>
                      <input type="text" placeholder="e.g., Yoga in the Park" className="form-input" />
                    </div>
                    <div className="form-group full-width">
                      <label>Categories (select up to 2) *</label>
                      <div className="category-checkbox-grid">
                        {categories.filter(cat => cat !== 'All').map(cat => {
                          const isChecked = newEventCategories.includes(cat);
                          const isDisabled = !isChecked && newEventCategories.length >= 2;
                          
                          return (
                            <label 
                              key={cat} 
                              className={`category-checkbox-label ${isDisabled ? 'disabled' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewEventCategories([...newEventCategories, cat]);
                                  } else {
                                    setNewEventCategories(newEventCategories.filter(c => c !== cat));
                                  }
                                }}
                              />
                              <span className="checkbox-text">{cat}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="form-help-text">
                        {newEventCategories.length === 0 && 'Select 1-2 categories that best describe your event'}
                        {newEventCategories.length === 1 && 'You can select 1 more category'}
                        {newEventCategories.length === 2 && '✓ Maximum categories selected'}
                      </p>
                    </div>
                    <div className="form-group full-width">
                      <label>Description *</label>
                      <textarea placeholder="Tell us about your event..." className="form-textarea"></textarea>
                    </div>
                    <div className="form-group">
                      <label>Date & Time *</label>
                      <input type="datetime-local" className="form-input" />
                    </div>
                    <div className="form-group">
                      <label>Location *</label>
                      <input type="text" placeholder="Venue or address" className="form-input" />
                    </div>
                    <div className="form-group">
                      <label>Price</label>
                      <input type="text" placeholder="Free or $20" className="form-input" />
                    </div>
                    <div className="form-group">
                      <label>Age Group</label>
                      <select className="form-input">
                        <option>All Ages</option>
                        <option>Kids</option>
                        <option>Adults</option>
                        <option>Teens & Adults</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={closeAddEventModal}>Cancel</button>
                    <button className="btn-primary" onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('event');
                    }}>Submit Event</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Claim Business Modal - Premium Purple Theme */}
          {showClaimBusinessModal && (
            <div className="modal-overlay" onClick={() => { setShowClaimBusinessModal(false); setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' }); }}>
              <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
                <button className="claim-modal-close" onClick={() => { setShowClaimBusinessModal(false); setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' }); }}><X size={24} /></button>

                {/* Purple Gradient Header */}
                <div className="claim-modal-header">
                  <div className="claim-modal-icon">
                    <Building size={32} />
                  </div>
                  <h2>Claim Your Business</h2>
                  <p>Get access to analytics, manage your listings, and connect with customers</p>
                </div>

                {/* Form Body */}
                <div className="claim-modal-body">
                  {!session?.user ? (
                    <div className="claim-signin-prompt">
                      <div className="signin-message">
                        <AlertCircle size={24} />
                        <p>Please sign in to claim your business</p>
                      </div>
                      <button className="claim-signin-btn" onClick={() => { setShowClaimBusinessModal(false); setShowAuthModal(true); }}>
                        Sign In to Continue
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="claim-form-grid">
                        <div className="claim-form-group full">
                          <label>Business Name *</label>
                          <input type="text" placeholder="e.g., The Sound Martial Arts" value={claimFormData.businessName} onChange={(e) => setClaimFormData({...claimFormData, businessName: e.target.value})} />
                        </div>
                        <div className="claim-form-group">
                          <label>Your Name *</label>
                          <input type="text" placeholder="Full name" value={claimFormData.ownerName} onChange={(e) => setClaimFormData({...claimFormData, ownerName: e.target.value})} />
                        </div>
                        <div className="claim-form-group">
                          <label>Email *</label>
                          <input type="email" placeholder="your@email.com" value={claimFormData.email} onChange={(e) => setClaimFormData({...claimFormData, email: e.target.value})} />
                        </div>
                        <div className="claim-form-group">
                          <label>Phone</label>
                          <input type="tel" placeholder="(604) 555-1234" value={claimFormData.phone} onChange={(e) => setClaimFormData({...claimFormData, phone: e.target.value})} />
                        </div>
                        <div className="claim-form-group">
                          <label>Role</label>
                          <select value={claimFormData.role} onChange={(e) => setClaimFormData({...claimFormData, role: e.target.value})}>
                            <option value="owner">Owner</option>
                            <option value="manager">Manager</option>
                            <option value="representative">Authorized Representative</option>
                          </select>
                        </div>
                        <div className="claim-form-group full">
                          <label>Business Address</label>
                          <input type="text" placeholder="Street address in Squamish" value={claimFormData.address} onChange={(e) => setClaimFormData({...claimFormData, address: e.target.value})} />
                        </div>
                      </div>

                      <div className="claim-benefits">
                        <div className="claim-benefit">
                          <CheckCircle size={18} />
                          <span>Manage your business profile</span>
                        </div>
                        <div className="claim-benefit">
                          <CheckCircle size={18} />
                          <span>View analytics & insights</span>
                        </div>
                        <div className="claim-benefit">
                          <CheckCircle size={18} />
                          <span>Respond to reviews</span>
                        </div>
                        <div className="claim-benefit">
                          <CheckCircle size={18} />
                          <span>Create deals & promotions</span>
                        </div>
                      </div>

                      <div className="claim-modal-actions">
                        <button className="claim-cancel-btn" onClick={() => { setShowClaimBusinessModal(false); setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' }); }}>Cancel</button>
                        <button className="claim-submit-btn" onClick={handleClaimBusiness} disabled={claimSubmitting}>{claimSubmitting ? 'Submitting...' : 'Submit Claim'}</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* My Calendar Modal - Premium */}
          {showMyCalendarModal && (
            <div className="modal-overlay calendar-modal-overlay" onClick={() => setShowMyCalendarModal(false)}>
              <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn calendar-close" onClick={() => setShowMyCalendarModal(false)}><X size={24} /></button>
                
                {/* Calendar Header */}
                <div className="calendar-header">
                  <div className="calendar-header-content">
                    <div className="calendar-icon-wrapper">
                      <Calendar size={28} />
                    </div>
                    <div>
                      <h1>My Calendar</h1>
                      <p>{myCalendar.length} upcoming event{myCalendar.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>

                {/* Calendar Content */}
                <div className="calendar-content">
                  {myCalendar.length === 0 ? (
                    <div className="calendar-empty">
                      <div className="empty-calendar-icon">
                        <Calendar size={48} />
                      </div>
                      <h3>No Events Yet</h3>
                      <p>Add events from the Events & Classes section to build your personal calendar</p>
                      <button 
                        className="browse-events-btn"
                        onClick={() => { setShowMyCalendarModal(false); setCurrentSection('events'); }}
                      >
                        Browse Events
                      </button>
                    </div>
                  ) : (
                    <div className="calendar-events-list">
                      {getCalendarEventsByDate().map(({ date, events }) => (
                        <div key={date.toISOString()} className="calendar-date-group">
                          <div className="calendar-date-header">
                            <div className="calendar-date-badge">
                              <span className="date-day">{date.getDate()}</span>
                              <span className="date-month">{date.toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'short' })}</span>
                            </div>
                            <div className="calendar-date-info">
                              <span className="date-weekday">{date.toLocaleString('en-US', { timeZone: PACIFIC_TZ, weekday: 'long' })}</span>
                              <span className="date-full">{date.toLocaleString('en-US', { timeZone: PACIFIC_TZ, month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                          <div className="calendar-date-events">
                            {events.map(event => (
                              <div key={event.id} className={`calendar-event-card ${event.eventType === 'class' ? 'class' : 'event'}`}>
                                <div className="calendar-event-time">
                                  <span>{event.start.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
                                  <span className="time-separator">-</span>
                                  <span>{event.end.toLocaleString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
                                </div>
                                <div className="calendar-event-details">
                                  <div className="calendar-event-header">
                                    <h4>{event.title}</h4>
                                    {event.eventType === 'class' && (
                                      <span className="calendar-event-badge class">Class</span>
                                    )}
                                  </div>
                                  <div className="calendar-event-venue">
                                    <MapPin size={14} />
                                    <span>{getVenueName(event.venueId, event)}</span>
                                  </div>
                                </div>
                                <div className="calendar-event-actions">
                                  <a 
                                    href={generateGoogleCalendarUrl(event)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="calendar-action-btn google"
                                    title="Open in Google Calendar"
                                  >
                                    <ExternalLink size={16} />
                                  </a>
                                  <button 
                                    className="calendar-action-btn remove"
                                    onClick={() => removeFromCalendar(event.id)}
                                    title="Remove from calendar"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Calendar Footer */}
                {myCalendar.length > 0 && (
                  <div className="calendar-footer">
                    <a 
                      href="https://calendar.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="google-calendar-link"
                    >
                      <Globe size={16} />
                      Open Google Calendar
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calendar Toast Notification */}
          {showCalendarToast && (
            <div className="calendar-toast">
              <div className="toast-icon">
                <Calendar size={20} />
              </div>
              <span>{calendarToastMessage}</span>
            </div>
          )}

          {/* Submission Modal - Add Event/Class/Deal */}
          {showSubmissionModal && (
            <div className="modal-overlay submission-modal-overlay" onClick={closeSubmissionModal}>
              <div className="submission-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn submission-close" onClick={closeSubmissionModal}><X size={24} /></button>
                
                {/* Step 1: Select Type */}
                {submissionStep === 1 && (
                  <>
                    <div className="submission-header">
                      <div className="submission-header-content">
                        <div className="submission-icon-wrapper">
                          <Plus size={28} />
                        </div>
                        <div>
                          <h1>Add to Pulse</h1>
                          <p>Share something with the Squamish community</p>
                        </div>
                      </div>
                    </div>
                    <div className="submission-content">
                      <h3 className="step-title">What would you like to add?</h3>
                      <div className="type-selection-grid">
                        <button className="type-card event" onClick={() => selectSubmissionType('event')}>
                          <div className="type-card-icon">
                            <Zap size={32} />
                          </div>
                          <h4>Event</h4>
                          <p>One-time or recurring community events</p>
                        </button>
                        <button className="type-card class" onClick={() => selectSubmissionType('class')}>
                          <div className="type-card-icon">
                            <Sparkles size={32} />
                          </div>
                          <h4>Class</h4>
                          <p>Fitness, art, music, or educational classes</p>
                        </button>
                        <button className="type-card deal" onClick={() => selectSubmissionType('deal')}>
                          <div className="type-card-icon">
                            <Percent size={32} />
                          </div>
                          <h4>Deal</h4>
                          <p>Special offers and promotions</p>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 2: Form with Business Selector and Images */}
                {submissionStep === 2 && (
                  <>
                    <div className={`submission-header ${submissionType}`}>
                      <div className="submission-header-content">
                        <div className={`submission-icon-wrapper ${submissionType}`}>
                          {submissionType === 'event' && <Zap size={28} />}
                          {submissionType === 'class' && <Sparkles size={28} />}
                          {submissionType === 'deal' && <Percent size={28} />}
                        </div>
                        <div>
                          <h1>Add {submissionType === 'event' ? 'Event' : submissionType === 'class' ? 'Class' : 'Deal'}</h1>
                          <p>Fill in the details</p>
                        </div>
                      </div>
                    </div>
                    <div className="submission-content scrollable">
                      <div className="submission-form">
                        
                        {/* Business Selector Section */}
                        <div className="form-group full">
                          <label>Who is hosting this? *</label>
                          <div className="business-selector">
                            {/* My Claimed Businesses */}
                            {userClaimedBusinesses.length > 0 ? (
                              <div className="business-selector-section">
                                <span className="selector-label">My Businesses</span>
                                {userClaimedBusinesses.map(biz => (
                                  <button 
                                    key={biz.id}
                                    className={`business-option ${submissionForm.businessType === 'claimed' && submissionForm.selectedBusinessId === biz.id ? 'selected' : ''}`}
                                    onClick={() => selectBusinessType('claimed', biz.id)}
                                  >
                                    <div className="business-option-avatar">
                                      <Building size={18} />
                                    </div>
                                    <div className="business-option-info">
                                      <span className="business-option-name">{biz.name}</span>
                                      <span className="business-option-address">{biz.address}</span>
                                    </div>
                                    {biz.verified && (
                                      <span className="business-option-verified">
                                        <Check size={12} />
                                      </span>
                                    )}
                                    {submissionForm.businessType === 'claimed' && submissionForm.selectedBusinessId === biz.id && (
                                      <div className="option-check"><Check size={16} /></div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="business-selector-section">
                                <div className="no-businesses-notice">
                                  <Building size={20} />
                                  <div>
                                    <span>No claimed businesses yet</span>
                                    <p>Claim your business from your profile to post as a verified business</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Options */}
                            <div className="business-selector-section">
                              <span className="selector-label">{userClaimedBusinesses.length > 0 ? 'Other Options' : 'Select an Option'}</span>
                              <button 
                                className={`business-option ${submissionForm.businessType === 'new' ? 'selected' : ''}`}
                                onClick={() => selectBusinessType('new')}
                              >
                                <div className="business-option-avatar new">
                                  <Plus size={18} />
                                </div>
                                <div className="business-option-info">
                                  <span className="business-option-name">New Business / Organization</span>
                                  <span className="business-option-address">Add a business not yet on Pulse</span>
                                </div>
                                {submissionForm.businessType === 'new' && (
                                  <div className="option-check"><Check size={16} /></div>
                                )}
                              </button>
                              <button 
                                className={`business-option ${submissionForm.businessType === 'individual' ? 'selected' : ''}`}
                                onClick={() => selectBusinessType('individual')}
                              >
                                <div className="business-option-avatar individual">
                                  <Users size={18} />
                                </div>
                                <div className="business-option-info">
                                  <span className="business-option-name">Community Member</span>
                                  <span className="business-option-address">Hosting as an individual, not a business</span>
                                </div>
                                {submissionForm.businessType === 'individual' && (
                                  <div className="option-check"><Check size={16} /></div>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* New Business Name (only if "new" selected) */}
                        {submissionForm.businessType === 'new' && (
                          <>
                            <div className="form-group full">
                              <label>Business / Organization Name *</label>
                              <input 
                                type="text" 
                                placeholder="e.g., Breathe Fitness Studio"
                                value={submissionForm.businessName}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, businessName: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group full">
                              <label>Business Address</label>
                              <input 
                                type="text" 
                                placeholder="e.g., 1234 Main St, Squamish"
                                value={submissionForm.businessAddress}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, businessAddress: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                          </>
                        )}

                        {/* Image Upload Section */}
                        <div className="form-group full">
                          <label>Images</label>
                          <div className="image-upload-grid">
                            {/* Square Image (1:1) */}
                            <div className="image-upload-card square">
                              <div className="image-upload-label">
                                <span>Square Image</span>
                                <span className="image-ratio">1:1</span>
                              </div>
                              {submissionForm.squareImagePreview ? (
                                <div className="image-preview square">
                                  <img src={submissionForm.squareImagePreview} alt="Square preview" />
                                  <button className="remove-image-btn" onClick={() => removeImage('square')}>
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <label className="image-upload-area square">
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => handleImageSelect(e, 'square')}
                                    style={{ display: 'none' }}
                                  />
                                  <div className="upload-placeholder">
                                    <Plus size={24} />
                                    <span>Add Photo</span>
                                  </div>
                                </label>
                              )}
                            </div>

                            {/* Banner Image (3:1) */}
                            <div className="image-upload-card banner">
                              <div className="image-upload-label">
                                <span>Banner Image</span>
                                <span className="image-ratio">3:1</span>
                              </div>
                              {submissionForm.bannerImagePreview ? (
                                <div className="image-preview banner">
                                  <img src={submissionForm.bannerImagePreview} alt="Banner preview" />
                                  <button className="remove-image-btn" onClick={() => removeImage('banner')}>
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <label className="image-upload-area banner">
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={(e) => handleImageSelect(e, 'banner')}
                                    style={{ display: 'none' }}
                                  />
                                  <div className="upload-placeholder">
                                    <Plus size={24} />
                                    <span>Add Banner</span>
                                  </div>
                                </label>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="form-group full">
                          <label>{submissionType === 'deal' ? 'Deal Title' : submissionType === 'class' ? 'Class Name' : 'Event Title'} *</label>
                          <input 
                            type="text" 
                            placeholder={submissionType === 'deal' ? 'e.g., Happy Hour 50% Off Apps' : submissionType === 'class' ? 'e.g., Hot Yoga Flow' : 'e.g., Live Music Night'}
                            value={submissionForm.title}
                            onChange={(e) => setSubmissionForm(prev => ({ ...prev, title: e.target.value }))}
                            className="form-input"
                          />
                        </div>

                        <div className="form-group full">
                          <label>Description *</label>
                          <textarea 
                            placeholder="Tell people what to expect..."
                            value={submissionForm.description}
                            onChange={(e) => setSubmissionForm(prev => ({ ...prev, description: e.target.value }))}
                            className="form-input textarea"
                            rows={3}
                          />
                        </div>

                        {/* Event/Class specific fields */}
                        {(submissionType === 'event' || submissionType === 'class') && (
                          <>
                            <div className="form-group">
                              <label>Date *</label>
                              <input 
                                type="date" 
                                value={submissionForm.date}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, date: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group half">
                              <label>Start Time *</label>
                              <input 
                                type="time" 
                                value={submissionForm.startTime}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, startTime: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group half">
                              <label>End Time *</label>
                              <input 
                                type="time" 
                                value={submissionForm.endTime}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, endTime: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group">
                              <label>Recurrence</label>
                              <select 
                                value={submissionForm.recurrence}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, recurrence: e.target.value }))}
                                className="form-input"
                              >
                                <option value="none">One-time event</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Price</label>
                              <input 
                                type="text" 
                                placeholder="e.g., $25 or Free"
                                value={submissionForm.price}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, price: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group">
                              <label>Age Group</label>
                              <select 
                                value={submissionForm.ageGroup}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, ageGroup: e.target.value }))}
                                className="form-input"
                              >
                                <option value="">All Ages</option>
                                <option value="Kids (0-12)">Kids (0-12)</option>
                                <option value="Teens (13-17)">Teens (13-17)</option>
                                <option value="Adults (18+)">Adults (18+)</option>
                                <option value="Seniors (65+)">Seniors (65+)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Category *</label>
                              <select 
                                value={submissionForm.category}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, category: e.target.value }))}
                                className="form-input"
                              >
                                <option value="">Select category...</option>
                                <option value="Music">Music</option>
                                <option value="Fitness">Fitness</option>
                                <option value="Arts">Arts</option>
                                <option value="Community">Community</option>
                                <option value="Wellness">Wellness</option>
                                <option value="Outdoors & Nature">Outdoors & Nature</option>
                                <option value="Food & Drink">Food & Drink</option>
                                <option value="Family">Family</option>
                                <option value="Nightlife">Nightlife</option>
                              </select>
                            </div>
                          </>
                        )}

                        {/* Deal specific fields */}
                        {submissionType === 'deal' && (
                          <>
                            <div className="form-group full">
                              <label>Schedule / Availability *</label>
                              <input 
                                type="text" 
                                placeholder="e.g., Mon-Fri 3-6pm, Weekends Only"
                                value={submissionForm.schedule}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, schedule: e.target.value }))}
                                className="form-input"
                              />
                            </div>
                            <div className="form-group full">
                              <label>Terms & Conditions</label>
                              <textarea 
                                placeholder="e.g., Cannot be combined with other offers..."
                                value={submissionForm.terms}
                                onChange={(e) => setSubmissionForm(prev => ({ ...prev, terms: e.target.value }))}
                                className="form-input textarea"
                                rows={2}
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="submission-notice">
                        <Info size={18} />
                        <p>All submissions are reviewed by our team before going live. You'll receive a notification once approved.</p>
                      </div>

                      <div className="submission-actions">
                        <button className="btn-back" onClick={() => setSubmissionStep(1)}>
                          Back
                        </button>
                        <button 
                          className="btn-submit"
                          onClick={submitForApproval}
                          disabled={!submissionForm.title || !submissionForm.description || !submissionForm.businessType || (submissionForm.businessType === 'new' && !submissionForm.businessName)}
                        >
                          Submit for Review
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 3: Success */}
                {submissionStep === 3 && (
                  <>
                    <div className="submission-success">
                      <div className="success-animation">
                        <div className="success-circle">
                          <Check size={48} />
                        </div>
                      </div>
                      <h2>Submitted for Review!</h2>
                      <p>Our team will review your {submissionType} and notify you once it's approved. This usually takes 24-48 hours.</p>
                      <div className="success-details">
                        <div className="detail-row">
                          <span className="label">Type:</span>
                          <span className="value">{submissionType === 'event' ? 'Event' : submissionType === 'class' ? 'Class' : 'Deal'}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Title:</span>
                          <span className="value">{submissionForm.title}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Host:</span>
                          <span className="value">{submissionForm.businessName}</span>
                        </div>
                      </div>
                      <button className="btn-done" onClick={closeSubmissionModal}>
                        Done
                      </button>
                    </div>
                  </>
                )}

                {/* Image Cropper Modal - Using global cropper at end of file instead
                   This duplicate is kept for reference but controlled by showImageCropper */}
                {showImageCropper && cropperImage && (
                  <div className="cropper-overlay" onClick={() => { setShowImageCropper(false); setCropPosition({ x: 0, y: 0 }); setCropZoom(1); }}>
                    <div className="cropper-modal" onClick={(e) => e.stopPropagation()}>
                      <div className="cropper-header">
                        <h3>{cropperType === 'profileAvatar' ? 'Crop Profile Photo' : cropperType === 'profileCover' ? 'Crop Cover Photo' : 'Crop Image'}</h3>
                        <span className="cropper-ratio">{(cropperType === 'square' || cropperType === 'profileAvatar') ? '1:1 Square' : '3:1 Banner'}</span>
                      </div>
                      <div className="cropper-content">
                        <div className="cropper-container">
                          <div 
                            className={`cropper-frame ${cropperType === 'profileAvatar' ? 'square profileAvatar' : cropperType === 'profileCover' ? 'banner' : cropperType}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const img = e.currentTarget.querySelector('.cropper-image');
                              img.dataset.dragging = 'true';
                              img.dataset.startX = e.clientX;
                              img.dataset.startY = e.clientY;
                              img.dataset.origX = cropPosition.x;
                              img.dataset.origY = cropPosition.y;
                              img.style.cursor = 'grabbing';
                            }}
                            onMouseMove={(e) => {
                              const img = e.currentTarget.querySelector('.cropper-image');
                              if (img.dataset.dragging !== 'true') return;
                              const dx = e.clientX - parseFloat(img.dataset.startX);
                              const dy = e.clientY - parseFloat(img.dataset.startY);
                              const newX = parseFloat(img.dataset.origX) + dx;
                              const newY = parseFloat(img.dataset.origY) + dy;
                              img.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px)) scale(${cropZoom})`;
                              img.dataset.currentX = newX;
                              img.dataset.currentY = newY;
                            }}
                            onMouseUp={(e) => {
                              const img = e.currentTarget.querySelector('.cropper-image');
                              if (img.dataset.dragging === 'true') {
                                img.dataset.dragging = 'false';
                                img.style.cursor = 'grab';
                                setCropPosition({ 
                                  x: parseFloat(img.dataset.currentX || cropPosition.x), 
                                  y: parseFloat(img.dataset.currentY || cropPosition.y) 
                                });
                              }
                            }}
                            onMouseLeave={(e) => {
                              const img = e.currentTarget.querySelector('.cropper-image');
                              if (img.dataset.dragging === 'true') {
                                img.dataset.dragging = 'false';
                                img.style.cursor = 'grab';
                                setCropPosition({ 
                                  x: parseFloat(img.dataset.currentX || cropPosition.x), 
                                  y: parseFloat(img.dataset.currentY || cropPosition.y) 
                                });
                              }
                            }}
                            onTouchStart={(e) => {
                              const img = e.currentTarget.querySelector('.cropper-image');
                              const touch = e.touches[0];
                              img.dataset.dragging = 'true';
                              img.dataset.startX = touch.clientX;
                              img.dataset.startY = touch.clientY;
                              img.dataset.origX = cropPosition.x;
                              img.dataset.origY = cropPosition.y;
                            }}
                            onTouchMove={(e) => {
                              const img = e.currentTarget.querySelector('.cropper-image');
                              if (img.dataset.dragging !== 'true') return;
                              const touch = e.touches[0];
                              const dx = touch.clientX - parseFloat(img.dataset.startX);
                              const dy = touch.clientY - parseFloat(img.dataset.startY);
                              const newX = parseFloat(img.dataset.origX) + dx;
                              const newY = parseFloat(img.dataset.origY) + dy;
                              img.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px)) scale(${cropZoom})`;
                              img.dataset.currentX = newX;
                              img.dataset.currentY = newY;
                            }}
                            onTouchEnd={(e) => {
                              const img = e.currentTarget.querySelector('.cropper-image');
                              if (img.dataset.dragging === 'true') {
                                img.dataset.dragging = 'false';
                                setCropPosition({ 
                                  x: parseFloat(img.dataset.currentX || cropPosition.x), 
                                  y: parseFloat(img.dataset.currentY || cropPosition.y) 
                                });
                              }
                            }}
                          >
                            <img 
                              src={cropperImage} 
                              alt="Crop preview"
                              className="cropper-image"
                              style={{
                                transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px)) scale(${cropZoom})`,
                                cursor: 'grab'
                              }}
                              draggable={false}
                            />
                          </div>
                          <div className="cropper-grid-overlay">
                            <div className="grid-h-1"></div>
                            <div className="grid-h-2"></div>
                            <div className="grid-v-1"></div>
                            <div className="grid-v-2"></div>
                          </div>
                        </div>
                        <p className="cropper-hint">Drag image to reposition</p>
                        <div className="cropper-controls">
                          <button 
                            className="zoom-btn"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.target.setPointerCapture(e.pointerId);
                              const img = document.querySelector('.cropper-image');
                              const slider = document.querySelector('.zoom-slider');
                              if (!img || !slider) return;
                              
                              img.style.transition = 'transform 0.05s linear';
                              let raf;
                              const updateZoom = () => {
                                const currentZoom = Math.max(0.5, parseFloat(slider.value) - 0.015);
                                slider.value = currentZoom;
                                const x = parseFloat(img.dataset.currentX) || 0;
                                const y = parseFloat(img.dataset.currentY) || 0;
                                img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${currentZoom})`;
                                img.dataset.currentZoom = currentZoom;
                                raf = requestAnimationFrame(updateZoom);
                              };
                              raf = requestAnimationFrame(updateZoom);
                              
                              e.target.onpointerup = () => {
                                cancelAnimationFrame(raf);
                                img.style.transition = '';
                                setCropZoom(parseFloat(slider.value));
                                e.target.onpointerup = null;
                              };
                            }}
                          >−</button>
                          <input 
                            type="range" 
                            min="0.5" 
                            max="3" 
                            step="any"
                            defaultValue="1"
                            key={showImageCropper ? 'open' : 'closed'}
                            className="zoom-slider"
                            ref={(el) => {
                              if (!el) return;
                              el.oninput = () => {
                                const img = document.querySelector('.cropper-image');
                                if (!img) return;
                                const zoom = el.value;
                                const x = parseFloat(img.dataset.currentX) || 0;
                                const y = parseFloat(img.dataset.currentY) || 0;
                                img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${zoom})`;
                                img.dataset.currentZoom = zoom;
                              };
                              el.onchange = () => {
                                setCropZoom(parseFloat(el.value));
                              };
                            }}
                          />
                          <button 
                            className="zoom-btn"
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.target.setPointerCapture(e.pointerId);
                              const img = document.querySelector('.cropper-image');
                              const slider = document.querySelector('.zoom-slider');
                              if (!img || !slider) return;
                              
                              img.style.transition = 'transform 0.05s linear';
                              let raf;
                              const updateZoom = () => {
                                const currentZoom = Math.min(3, parseFloat(slider.value) + 0.015);
                                slider.value = currentZoom;
                                const x = parseFloat(img.dataset.currentX) || 0;
                                const y = parseFloat(img.dataset.currentY) || 0;
                                img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${currentZoom})`;
                                img.dataset.currentZoom = currentZoom;
                                raf = requestAnimationFrame(updateZoom);
                              };
                              raf = requestAnimationFrame(updateZoom);
                              
                              e.target.onpointerup = () => {
                                cancelAnimationFrame(raf);
                                img.style.transition = '';
                                setCropZoom(parseFloat(slider.value));
                                e.target.onpointerup = null;
                              };
                            }}
                          >+</button>
                        </div>
                      </div>
                      <div className="cropper-actions">
                        <button className="cropper-btn cancel" onClick={() => { setShowImageCropper(false); setCropPosition({ x: 0, y: 0 }); setCropZoom(1); }}>
                          Cancel
                        </button>
                        <button className="cropper-btn apply" onClick={handleCropComplete}>
                          Apply Crop
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Premium Profile Modal */}
          {showProfileModal && (
            <div className="modal-overlay profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
              <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn profile-close" onClick={() => setShowProfileModal(false)}><X size={24} /></button>
                
                {/* Hidden file inputs for profile images */}
                <input 
                  type="file" 
                  id="profile-cover-input" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={(e) => handleImageSelect(e, 'profileCover')}
                />
                <input 
                  type="file" 
                  id="profile-avatar-input" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={(e) => handleImageSelect(e, 'profileAvatar')}
                />
                
                {/* Profile Hero Section */}
                <div className="profile-hero">
                  <div className={`profile-cover ${!user.coverPhoto ? 'no-photo' : ''}`} style={{ backgroundImage: user.coverPhoto ? `url(${user.coverPhoto})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)' }}>
                    <button className="cover-edit-btn" onClick={() => document.getElementById('profile-cover-input').click()}>
                      <Camera size={16} />
                      <span>{user.coverPhoto ? 'Change Cover' : 'Add Cover Photo'}</span>
                    </button>
                  </div>
                  <div className="profile-hero-body">
                    <div className="profile-avatar-wrapper">
                      <div className="profile-avatar-large">
                        {user.avatar ? <img src={user.avatar} alt="" /> : (user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U')}
                        <button className="avatar-edit-btn" onClick={() => document.getElementById('profile-avatar-input').click()}>
                          <Camera size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="profile-hero-details">
                      <div className="profile-hero-info">
                        <h1>{user.name || 'Guest User'}</h1>
                        <p className="profile-location"><MapPin size={14} /> {user.location}</p>
                        <p className="profile-member-since">Member since {user.memberSince ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Today'}</p>
                      </div>
                      <div className="profile-hero-stats">
                        <div className="hero-stat">
                          <span className="stat-number">{userStats.eventsAttended}</span>
                          <span className="stat-label">Events</span>
                        </div>
                        <div className="hero-stat">
                          <span className="stat-number">{userStats.businessesSupported}</span>
                          <span className="stat-label">Businesses</span>
                        </div>
                        <div className="hero-stat">
                          <span className="stat-number">{userAchievements.filter(a => a.earned).length}</span>
                          <span className="stat-label">Badges</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Tabs */}
                <div className="profile-tabs">
                  <button className={`profile-tab ${profileTab === 'overview' ? 'active' : ''}`} onClick={() => setProfileTab('overview')}>
                    <Users size={16} />
                    <span>Overview</span>
                  </button>
                  <button className={`profile-tab ${profileTab === 'activity' ? 'active' : ''}`} onClick={() => setProfileTab('activity')}>
                    <Clock size={16} />
                    <span>Activity</span>
                  </button>
                  <button className={`profile-tab ${profileTab === 'saved' ? 'active' : ''}`} onClick={() => setProfileTab('saved')}>
                    <Heart size={16} />
                    <span>Saved</span>
                  </button>
                  <button className={`profile-tab ${profileTab === 'businesses' ? 'active' : ''}`} onClick={() => { setShowProfileModal(false); setView('business'); }}>
                    <Building size={16} />
                    <span>My Businesses</span>
                  </button>
                  <button className={`profile-tab ${profileTab === 'settings' ? 'active' : ''}`} onClick={() => setProfileTab('settings')}>
                    <SlidersHorizontal size={16} />
                    <span>Settings</span>
                  </button>
                </div>

                {/* Tab Content */}
                <div className="profile-tab-content">
                  
                  {/* Overview Tab */}
                  {profileTab === 'overview' && (
                    <div className="profile-overview">
                      
                      {/* Level & XP Card */}
                      <div className="level-card">
                        <div className="level-card-header">
                          <div className="level-badge">
                            <span className="level-number">{userStats.level}</span>
                            <span className="level-label">LEVEL</span>
                          </div>
                          <div className="level-info">
                            <h3>Local Legend</h3>
                            <p>{userStats.xpToNextLevel} XP to Level {userStats.level + 1}</p>
                          </div>
                          <div className="total-xp">
                            <Sparkles size={16} />
                            <span>{userStats.totalXP.toLocaleString()} XP</span>
                          </div>
                        </div>
                        <div className="xp-progress-bar">
                          <div className="xp-progress-fill" style={{ width: `${((userStats.xpForCurrentLevel - userStats.xpToNextLevel) / userStats.xpForCurrentLevel) * 100}%` }}></div>
                        </div>
                        <div className="level-card-footer">
                          <div className="streak-box">
                            <Zap size={18} className="streak-icon" />
                            <div className="streak-info">
                              <span className="streak-number">{userStats.currentStreak}</span>
                              <span className="streak-label">Day Streak</span>
                            </div>
                          </div>
                          <div className="rank-box">
                            <TrendingUp size={18} className="rank-icon" />
                            <div className="rank-info">
                              <span className="rank-number">#{userStats.communityRank}</span>
                              <span className="rank-label">of {userStats.totalMembers.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="hero-score-box">
                            <Heart size={18} className="hero-icon" />
                            <div className="hero-info">
                              <span className="hero-number">{userStats.localHeroScore}</span>
                              <span className="hero-label">Hero Score</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bio Section */}
                      <div className="profile-section">
                        <h3>About</h3>
                        <p className="profile-bio">{user.bio}</p>
                        <div className="profile-interests">
                          {user.interests.map((interest, idx) => (
                            <span key={idx} className="interest-tag">{interest}</span>
                          ))}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="profile-section">
                        <h3>Community Impact</h3>
                        <div className="stats-grid">
                          <div className="stat-card purple">
                            <div className="stat-card-icon"><Calendar size={20} /></div>
                            <div className="stat-card-content">
                              <span className="stat-card-number">{userStats.eventsAttended}</span>
                              <span className="stat-card-label">Events Attended</span>
                            </div>
                          </div>
                          <div className="stat-card green">
                            <div className="stat-card-icon"><Sparkles size={20} /></div>
                            <div className="stat-card-content">
                              <span className="stat-card-number">{userStats.classesCompleted}</span>
                              <span className="stat-card-label">Classes Completed</span>
                            </div>
                          </div>
                          <div className="stat-card orange">
                            <div className="stat-card-icon"><Percent size={20} /></div>
                            <div className="stat-card-content">
                              <span className="stat-card-number">{userStats.dealsRedeemed}</span>
                              <span className="stat-card-label">Deals Redeemed</span>
                            </div>
                          </div>
                          <div className="stat-card blue">
                            <div className="stat-card-icon"><Building size={20} /></div>
                            <div className="stat-card-content">
                              <span className="stat-card-number">{userStats.businessesSupported}</span>
                              <span className="stat-card-label">Businesses Supported</span>
                            </div>
                          </div>
                          <div className="stat-card pink">
                            <div className="stat-card-icon"><Star size={20} /></div>
                            <div className="stat-card-content">
                              <span className="stat-card-number">{userStats.reviewsWritten}</span>
                              <span className="stat-card-label">Reviews Written</span>
                            </div>
                          </div>
                          <div className="stat-card teal">
                            <div className="stat-card-icon"><MapPin size={20} /></div>
                            <div className="stat-card-content">
                              <span className="stat-card-number">{userStats.checkIns}</span>
                              <span className="stat-card-label">Check-ins</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Achievements Section */}
                      <div className="profile-section">
                        <div className="section-header">
                          <h3>Achievements</h3>
                          <span className="badge-count">{userAchievements.filter(a => a.earned).length} / {userAchievements.length}</span>
                        </div>
                        <div className="achievements-grid">
                          {userAchievements.map(achievement => (
                            <div key={achievement.id} className={`achievement-card ${achievement.earned ? 'earned' : 'locked'}`}>
                              <div className="achievement-icon" style={{ background: achievement.earned ? achievement.color : '#e5e7eb' }}>
                                {achievement.icon === 'Sparkles' && <Sparkles size={20} />}
                                {achievement.icon === 'MapPin' && <MapPin size={20} />}
                                {achievement.icon === 'Heart' && <Heart size={20} />}
                                {achievement.icon === 'Percent' && <Percent size={20} />}
                                {achievement.icon === 'Star' && <Star size={20} />}
                                {achievement.icon === 'Building' && <Building size={20} />}
                                {achievement.icon === 'Calendar' && <Calendar size={20} />}
                                {achievement.icon === 'Users' && <Users size={20} />}
                                {achievement.icon === 'Zap' && <Zap size={20} />}
                                {achievement.icon === 'TrendingUp' && <TrendingUp size={20} />}
                              </div>
                              <div className="achievement-info">
                                <span className="achievement-name">{achievement.name}</span>
                                <span className="achievement-desc">{achievement.description}</span>
                                {!achievement.earned && (
                                  <div className="achievement-progress">
                                    <div className="progress-bar">
                                      <div className="progress-fill" style={{ width: `${(achievement.progress / achievement.target) * 100}%`, background: achievement.color }}></div>
                                    </div>
                                    <span className="progress-text">{achievement.progress} / {achievement.target}</span>
                                  </div>
                                )}
                                {achievement.earned && (
                                  <span className="achievement-xp">+{achievement.xp} XP</span>
                                )}
                              </div>
                              {achievement.earned && <div className="achievement-check"><Check size={14} /></div>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Activity Preview */}
                      <div className="profile-section">
                        <div className="section-header">
                          <h3>Recent Activity</h3>
                          <button className="see-all-btn" onClick={() => setProfileTab('activity')}>See All</button>
                        </div>
                        <div className="activity-preview">
                          {userActivity.slice(0, 3).map(activity => (
                            <div key={activity.id} className="activity-item">
                              <div className={`activity-icon ${activity.type}`}>
                                {activity.type === 'event' && <Calendar size={14} />}
                                {activity.type === 'deal' && <Percent size={14} />}
                                {activity.type === 'class' && <Sparkles size={14} />}
                                {activity.type === 'review' && <Star size={14} />}
                                {activity.type === 'checkin' && <MapPin size={14} />}
                              </div>
                              <div className="activity-content">
                                <span className="activity-action">{activity.action} <strong>{activity.title}</strong></span>
                                <span className="activity-business">{activity.business}</span>
                              </div>
                              <span className="activity-date">{new Date(activity.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity Tab */}
                  {profileTab === 'activity' && (
                    <div className="profile-activity">
                      <div className="activity-filters">
                        <button className="activity-filter active">All</button>
                        <button className="activity-filter">Events</button>
                        <button className="activity-filter">Classes</button>
                        <button className="activity-filter">Deals</button>
                        <button className="activity-filter">Reviews</button>
                      </div>
                      <div className="activity-list">
                        {userActivity.map(activity => (
                          <div key={activity.id} className="activity-item-full">
                            <div className={`activity-icon-large ${activity.type}`}>
                              {activity.type === 'event' && <Calendar size={18} />}
                              {activity.type === 'deal' && <Percent size={18} />}
                              {activity.type === 'class' && <Sparkles size={18} />}
                              {activity.type === 'review' && <Star size={18} />}
                              {activity.type === 'checkin' && <MapPin size={18} />}
                            </div>
                            <div className="activity-content-full">
                              <span className="activity-type-badge">{activity.type}</span>
                              <h4>{activity.action} {activity.title}</h4>
                              <p><Building size={12} /> {activity.business}</p>
                            </div>
                            <div className="activity-meta">
                              <span className="activity-date-full">{new Date(activity.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Saved Tab */}
                  {profileTab === 'saved' && (
                    <div className="profile-saved">
                      <div className="saved-tabs">
                        <button className={`saved-tab ${!savedItemsFilter || savedItemsFilter === 'event' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('event')}>
                          <Calendar size={14} />
                          Events
                          <span className="saved-count">{savedItems.filter(s => s.type === 'event').length + localSavedItems.filter(s => s.type === 'event').length}</span>
                        </button>
                        <button className={`saved-tab ${savedItemsFilter === 'class' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('class')}>
                          <Sparkles size={14} />
                          Classes
                          <span className="saved-count">{savedItems.filter(s => s.type === 'class').length + localSavedItems.filter(s => s.type === 'class').length}</span>
                        </button>
                        <button className={`saved-tab ${savedItemsFilter === 'deal' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('deal')}>
                          <Percent size={14} />
                          Deals
                          <span className="saved-count">{savedItems.filter(s => s.type === 'deal').length + localSavedItems.filter(s => s.type === 'deal').length}</span>
                        </button>
                        <button className={`saved-tab ${savedItemsFilter === 'business' ? 'active' : ''}`} onClick={() => setSavedItemsFilter('business')}>
                          <Building size={14} />
                          Businesses
                          <span className="saved-count">{savedItems.filter(s => s.type === 'business').length + localSavedItems.filter(s => s.type === 'business').length}</span>
                        </button>
                      </div>
                      <div className="saved-items-grid">
                        {[...savedItems, ...localSavedItems]
                          .filter(item => !savedItemsFilter || savedItemsFilter === 'event' ? item.type === 'event' : item.type === savedItemsFilter)
                          .map((item, idx) => (
                          <div key={item.itemId || idx} className="saved-item-card">
                            <div className="saved-item-image" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                              <span className="saved-item-date">{item.type}</span>
                            </div>
                            <div className="saved-item-content">
                              <h4>{item.name || item.itemName || 'Saved Item'}</h4>
                              <p><MapPin size={12} /> {item.data?.venue || item.venue || 'Squamish'}</p>
                            </div>
                            <button
                              className="saved-item-remove"
                              onClick={async () => {
                                if (session?.user) {
                                  await toggleSaveItem(item.type, item.itemId, item.name);
                                } else {
                                  setLocalSavedItems(prev => prev.filter(s => s.itemId !== item.itemId));
                                }
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {[...savedItems, ...localSavedItems].filter(item => !savedItemsFilter || savedItemsFilter === 'event' ? item.type === 'event' : item.type === savedItemsFilter).length === 0 && (
                          <div className="no-saved-items" style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                            <Star size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <h4>No saved items yet</h4>
                            <p>Tap the star icon on any event, class, or deal to save it here!</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* My Businesses Tab */}
                  {profileTab === 'businesses' && (
                    <div className="profile-businesses">
                      {userClaimedBusinesses.length === 0 ? (
                        <div className="no-businesses">
                          <div className="no-businesses-icon">
                            <Building size={48} />
                          </div>
                          <h3>No businesses claimed yet</h3>
                          <p>Claim your business to unlock powerful analytics, engage with customers, and grow your revenue.</p>
                          
                          {/* Benefits Preview */}
                          <div className="biz-benefits-preview">
                            <div className="benefit-item">
                              <TrendingUp size={20} />
                              <span>Track views & engagement</span>
                            </div>
                            <div className="benefit-item">
                              <Users size={20} />
                              <span>Connect with customers</span>
                            </div>
                            <div className="benefit-item">
                              <Calendar size={20} />
                              <span>Post events & deals</span>
                            </div>
                            <div className="benefit-item">
                              <Star size={20} />
                              <span>Manage reviews</span>
                            </div>
                          </div>
                          
                          <button className="claim-business-btn" onClick={() => { setShowClaimBusinessModal(true); setShowProfileModal(false); }}>
                            <Plus size={18} />
                            Claim Your Business
                          </button>
                          <p className="claim-subtext">Free to claim • Verify in under 5 minutes</p>
                        </div>
                      ) : (
                        <>
                          {/* Business Performance Score */}
                          <div className="biz-score-card">
                            <div className="biz-score-header">
                              <div className="biz-score-ring">
                                <svg viewBox="0 0 100 100">
                                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                                  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#scoreGradient)" strokeWidth="8" 
                                    strokeDasharray={`${0 / 1000 * 283} 283`} 
                                    strokeLinecap="round"
                                    transform="rotate(-90 50 50)" />
                                  <defs>
                                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#10b981" />
                                      <stop offset="100%" stopColor="#34d399" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                                <div className="biz-score-value">
                                  <span className="score-num">--</span>
                                  <span className="score-label">PULSE SCORE</span>
                                </div>
                              </div>
                              <div className="biz-score-info">
                                <h3>Welcome to Your Dashboard</h3>
                                <p>Complete your profile to start building your Pulse Score</p>
                              </div>
                            </div>
                            <div className="biz-score-breakdown">
                              <div className="score-factor">
                                <span className="factor-label">Profile Completion</span>
                                <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#10b981'}}></div></div>
                                <span className="factor-value">--</span>
                              </div>
                              <div className="score-factor">
                                <span className="factor-label">Customer Engagement</span>
                                <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#3b82f6'}}></div></div>
                                <span className="factor-value">--</span>
                              </div>
                              <div className="score-factor">
                                <span className="factor-label">Response Rate</span>
                                <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#8b5cf6'}}></div></div>
                                <span className="factor-value">--</span>
                              </div>
                              <div className="score-factor">
                                <span className="factor-label">Content Quality</span>
                                <div className="factor-bar"><div className="factor-fill" style={{width: '0%', background: '#f59e0b'}}></div></div>
                                <span className="factor-value">--</span>
                              </div>
                            </div>
                          </div>

                          {/* Key Metrics Grid */}
                          <div className="biz-metrics-section">
                            <h3>This Week's Performance</h3>
                            <div className="biz-metrics-grid">
                              <div className="biz-metric-card">
                                <div className="metric-icon blue"><Eye size={20} /></div>
                                <div className="metric-data">
                                  <span className="metric-value">0</span>
                                  <span className="metric-label">Profile Views</span>
                                </div>
                                <div className="metric-trend neutral">
                                  <span>—</span>
                                </div>
                              </div>
                              <div className="biz-metric-card">
                                <div className="metric-icon green"><Users size={20} /></div>
                                <div className="metric-data">
                                  <span className="metric-value">0</span>
                                  <span className="metric-label">Followers</span>
                                </div>
                                <div className="metric-trend neutral">
                                  <span>—</span>
                                </div>
                              </div>
                              <div className="biz-metric-card">
                                <div className="metric-icon purple"><Heart size={20} /></div>
                                <div className="metric-data">
                                  <span className="metric-value">0</span>
                                  <span className="metric-label">Saves</span>
                                </div>
                                <div className="metric-trend neutral">
                                  <span>—</span>
                                </div>
                              </div>
                              <div className="biz-metric-card">
                                <div className="metric-icon orange"><Star size={20} /></div>
                                <div className="metric-data">
                                  <span className="metric-value">--</span>
                                  <span className="metric-label">Avg Rating</span>
                                </div>
                                <div className="metric-trend neutral">
                                  <span>—</span>
                                </div>
                              </div>
                              <div className="biz-metric-card">
                                <div className="metric-icon teal"><Percent size={20} /></div>
                                <div className="metric-data">
                                  <span className="metric-value">0</span>
                                  <span className="metric-label">Deals Redeemed</span>
                                </div>
                                <div className="metric-trend up">
                                  <TrendingUp size={14} />
                                  <span>+45%</span>
                                </div>
                              </div>
                              <div className="biz-metric-card">
                                <div className="metric-icon pink"><Calendar size={20} /></div>
                                <div className="metric-data">
                                  <span className="metric-value">34</span>
                                  <span className="metric-label">Event RSVPs</span>
                                </div>
                                <div className="metric-trend up">
                                  <TrendingUp size={14} />
                                  <span>+28%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Weekly Goals */}
                          <div className="biz-goals-section">
                            <div className="section-header">
                              <h3>Weekly Goals</h3>
                              <span className="goals-reward">Complete all for +500 XP</span>
                            </div>
                            <div className="biz-goals-list">
                              <div className="biz-goal completed">
                                <div className="goal-check"><Check size={14} /></div>
                                <div className="goal-info">
                                  <span className="goal-title">Post a new event or deal</span>
                                  <span className="goal-xp">+100 XP</span>
                                </div>
                              </div>
                              <div className="biz-goal completed">
                                <div className="goal-check"><Check size={14} /></div>
                                <div className="goal-info">
                                  <span className="goal-title">Respond to 5 reviews</span>
                                  <span className="goal-xp">+75 XP</span>
                                </div>
                              </div>
                              <div className="biz-goal in-progress">
                                <div className="goal-progress">3/5</div>
                                <div className="goal-info">
                                  <span className="goal-title">Get 5 new reviews</span>
                                  <div className="goal-progress-bar">
                                    <div className="goal-progress-fill" style={{width: '60%'}}></div>
                                  </div>
                                </div>
                                <span className="goal-xp">+150 XP</span>
                              </div>
                              <div className="biz-goal">
                                <div className="goal-empty"></div>
                                <div className="goal-info">
                                  <span className="goal-title">Reach 3,000 profile views</span>
                                  <div className="goal-progress-bar">
                                    <div className="goal-progress-fill" style={{width: '95%'}}></div>
                                  </div>
                                </div>
                                <span className="goal-xp">+175 XP</span>
                              </div>
                            </div>
                          </div>

                          {/* Business Achievements */}
                          <div className="biz-achievements-section">
                            <div className="section-header">
                              <h3>Business Badges</h3>
                              <span className="badge-count">0 / 10</span>
                            </div>
                            <div className="biz-badges-grid">
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Check size={18} /></div>
                                <span>Verified</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Star size={18} /></div>
                                <span>Top Rated</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Zap size={18} /></div>
                                <span>Quick Responder</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><TrendingUp size={18} /></div>
                                <span>Rising Star</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Heart size={18} /></div>
                                <span>Community Fave</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Calendar size={18} /></div>
                                <span>Event Pro</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Percent size={18} /></div>
                                <span>Deal Maker</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Users size={18} /></div>
                                <span>1K Followers</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Building size={18} /></div>
                                <span>5K Followers</span>
                              </div>
                              <div className="biz-badge locked">
                                <div className="badge-icon"><Sparkles size={18} /></div>
                                <span>Superhost</span>
                              </div>
                            </div>
                          </div>

                          {/* Insights & Tips */}
                          <div className="biz-insights-section">
                            <h3>💡 Growth Tips</h3>
                            <div className="insights-list">
                              <div className="insight-card hot">
                                <div className="insight-badge">Get Started</div>
                                <p>Post your first <strong>deal or event</strong> to start attracting customers on Pulse.</p>
                                <button className="insight-action" onClick={() => {
                                  setShowSubmissionModal(true);
                                  setSubmissionStep(1);
                                  setSubmissionType('deal');
                                }}>Create Deal</button>
                              </div>
                              <div className="insight-card">
                                <div className="insight-badge">Tip</div>
                                <p>Complete your business profile to <strong>build trust</strong> with potential customers.</p>
                                <button className="insight-action" onClick={() => {
                                  if (userClaimedBusinesses.length > 0) {
                                    const biz = userClaimedBusinesses[0];
                                    setEditingVenue(biz);
                                    setEditVenueForm({
                                      name: biz.name || '',
                                      address: biz.address || '',
                                      phone: biz.phone || '',
                                      website: biz.website || '',
                                      email: biz.email || '',
                                      category: biz.category || ''
                                    });
                                    setShowEditVenueModal(true);
                                  } else {
                                    showToast('No business to edit', 'error');
                                  }
                                }}>Edit Profile</button>
                              </div>
                              <div className="insight-card">
                                <div className="insight-badge">Tip</div>
                                <p>Respond to inquiries quickly to improve customer satisfaction and earn badges.</p>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="biz-quick-actions">
                            <button className="quick-action-btn primary">
                              <Plus size={18} />
                              New Event
                            </button>
                            <button className="quick-action-btn">
                              <Percent size={18} />
                              New Deal
                            </button>
                            <button className="quick-action-btn">
                              <Edit2 size={18} />
                              Edit Profile
                            </button>
                            <button className="quick-action-btn">
                              <TrendingUp size={18} />
                              Full Analytics
                            </button>
                          </div>

                          <button className="add-another-business">
                            <Plus size={16} />
                            Claim Another Business
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Settings Tab */}
                  {profileTab === 'settings' && (
                    <div className="profile-settings">
                      {/* Account Settings */}
                      <div className="settings-section">
                        <h3>Account</h3>
                        <div className="settings-group">
                          <div className="setting-item">
                            <div className="setting-info">
                              <label>Full Name</label>
                              <input type="text" value={user.name} onChange={(e) => setUser(prev => ({ ...prev, name: e.target.value }))} />
                            </div>
                          </div>
                          <div className="setting-item">
                            <div className="setting-info">
                              <label>Email</label>
                              <input type="email" value={user.email} onChange={(e) => setUser(prev => ({ ...prev, email: e.target.value }))} />
                            </div>
                          </div>
                          <div className="setting-item">
                            <div className="setting-info">
                              <label>Phone</label>
                              <input type="tel" value={user.phone} placeholder="Add phone number" onChange={(e) => setUser(prev => ({ ...prev, phone: e.target.value }))} />
                            </div>
                          </div>
                          <div className="setting-item">
                            <div className="setting-info">
                              <label>Bio</label>
                              <textarea value={user.bio} onChange={(e) => setUser(prev => ({ ...prev, bio: e.target.value }))} rows={3} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Notification Settings */}
                      <div className="settings-section">
                        <h3>Notifications</h3>
                        <div className="settings-group">
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">Event Reminders</span>
                              <span className="setting-toggle-desc">Get notified before events you've saved</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.notifications.eventReminders} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...prev.notifications, eventReminders: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">New Deals</span>
                              <span className="setting-toggle-desc">Get notified about new deals in your area</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.notifications.newDeals} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...prev.notifications, newDeals: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">Weekly Digest</span>
                              <span className="setting-toggle-desc">Receive a weekly summary of what's happening</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.notifications.weeklyDigest} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...prev.notifications, weeklyDigest: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">Business Updates</span>
                              <span className="setting-toggle-desc">Updates from businesses you follow</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.notifications.businessUpdates} onChange={(e) => setUser(prev => ({ ...prev, notifications: { ...prev.notifications, businessUpdates: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Privacy Settings */}
                      <div className="settings-section">
                        <h3>Privacy</h3>
                        <div className="settings-group">
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">Show Activity</span>
                              <span className="setting-toggle-desc">Let others see your recent activity</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.privacy.showActivity} onChange={(e) => setUser(prev => ({ ...prev, privacy: { ...prev.privacy, showActivity: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">Show Saved Items</span>
                              <span className="setting-toggle-desc">Let others see items you've saved</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.privacy.showSavedItems} onChange={(e) => setUser(prev => ({ ...prev, privacy: { ...prev.privacy, showSavedItems: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          <div className="setting-toggle">
                            <div className="setting-toggle-info">
                              <span className="setting-toggle-label">Show Attendance</span>
                              <span className="setting-toggle-desc">Show which events you're attending</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={user.privacy.showAttendance} onChange={(e) => setUser(prev => ({ ...prev, privacy: { ...prev.privacy, showAttendance: e.target.checked } }))} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Interests */}
                      <div className="settings-section">
                        <h3>Interests</h3>
                        <p className="settings-desc">Select categories to personalize your experience</p>
                        <div className="interests-grid">
                          {['Fitness', 'Music', 'Arts', 'Food & Drink', 'Outdoors & Nature', 'Wellness', 'Community', 'Family', 'Nightlife', 'Games'].map(interest => (
                            <button 
                              key={interest} 
                              className={`interest-btn ${user.interests.includes(interest) ? 'selected' : ''}`}
                              onClick={() => {
                                setUser(prev => ({
                                  ...prev,
                                  interests: prev.interests.includes(interest) 
                                    ? prev.interests.filter(i => i !== interest)
                                    : [...prev.interests, interest]
                                }));
                              }}
                            >
                              {user.interests.includes(interest) && <Check size={14} />}
                              {interest}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="settings-section">
                        <button
                          className="save-profile-btn"
                          onClick={async () => {
                            const { error } = await updateProfile({
                              name: user.name,
                              phone: user.phone,
                              bio: user.bio,
                              location: user.location,
                              interests: user.interests,
                              socialLinks: user.socialLinks,
                              notifications: user.notifications,
                              privacy: user.privacy
                            });
                            if (error) {
                              setCalendarToastMessage('Error saving profile. Please try again.');
                            } else {
                              setCalendarToastMessage('Profile saved successfully!');
                            }
                            setShowCalendarToast(true);
                            setTimeout(() => setShowCalendarToast(false), 3000);
                          }}
                          style={{
                            width: '100%',
                            padding: '14px 24px',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            marginBottom: '24px'
                          }}
                        >
                          Save Profile
                        </button>
                      </div>

                      {/* Danger Zone */}
                      <div className="settings-section danger">
                        <h3>Danger Zone</h3>
                        <div className="danger-actions">
                          <button className="danger-btn" onClick={() => {
                            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                              showToast('Please contact support to delete your account', 'info');
                            }
                          }}>
                            <Trash2 size={16} />
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking Bottom Sheet */}
          {showBookingSheet && bookingEvent && (
            <div className="modal-overlay booking-sheet-overlay" onClick={closeBookingSheet}>
              <div className={`booking-bottom-sheet ${bookingStep === 'iframe' ? 'full-height' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle" />
                <button className="close-btn sheet-close" onClick={closeBookingSheet}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                {/* Header - always shown */}
                <div className="sheet-header">
                  <h2>{bookingStep === 'request' ? 'Request to Book' : 'Book Now'}</h2>
                  <p className="sheet-subtitle">{getVenueName(bookingEvent.venueId, bookingEvent)}</p>
                  <div className="sheet-event-details">
                    <div className="event-title-row">{bookingEvent.title}</div>
                    <div className="sheet-event-info">
                      <Calendar size={14} />
                      <span>{bookingEvent.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="dot">•</span>
                      <Clock size={14} />
                      <span>{bookingEvent.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                {/* External booking view - for businesses with booking URLs */}
                {bookingStep === 'iframe' && (() => {
                  const business = getBusinessForEvent(bookingEvent);
                  const bookingUrl = business?.booking_url;
                  const bookingType = business?.booking_type;
                  const systemName = bookingType === 'mindbody' ? 'Mindbody' :
                                    bookingType === 'wellnessliving' ? 'WellnessLiving' :
                                    bookingType === 'janeapp' ? 'JaneApp' : 'their website';

                  return (
                    <div className="external-booking-container">
                      <div className="booking-system-badge">
                        {bookingType === 'mindbody' && (
                          <img src="https://www.mindbodyonline.com/sites/default/files/public/favicon.ico" alt="" />
                        )}
                        {bookingType === 'wellnessliving' && (
                          <img src="https://www.wellnessliving.com/favicon.ico" alt="" />
                        )}
                        {!bookingType && <ExternalLink size={20} />}
                        <span>Book via {systemName}</span>
                      </div>

                      <p className="booking-instruction">
                        Click below to complete your booking on {getVenueName(bookingEvent.venueId, bookingEvent)}'s booking page.
                      </p>

                      <a
                        href={bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="open-booking-btn"
                        onClick={() => {
                          // Track that they opened the booking page
                          trackAnalytics('booking_click', business?.id, bookingEvent.id);
                        }}
                      >
                        <Ticket size={20} />
                        Open Booking Page
                      </a>

                      <button
                        className="add-calendar-secondary"
                        onClick={() => {
                          addToCalendar(bookingEvent);
                          setCalendarToastMessage('Added to your calendar!');
                          setShowCalendarToast(true);
                          setTimeout(() => setShowCalendarToast(false), 2000);
                        }}
                      >
                        <Calendar size={18} />
                        Add to Calendar
                      </button>

                      <p className="booking-note">
                        After booking, come back and let us know so we can track it for you.
                      </p>
                    </div>
                  );
                })()}

                {/* Request to book form */}
                {bookingStep === 'request' && (
                  <div className="booking-request-form">
                    <div className="request-info-card">
                      <Info size={18} />
                      <p>This business doesn't have online booking. Send them a request and they'll get back to you.</p>
                    </div>

                    <div className="form-field">
                      <label>Add a message (optional)</label>
                      <textarea
                        placeholder="Any special requests or questions..."
                        value={bookingRequestMessage}
                        onChange={(e) => setBookingRequestMessage(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <button
                      className="send-request-btn"
                      onClick={submitBookingRequest}
                      disabled={sendingMessage}
                    >
                      {sendingMessage ? (
                        <>
                          <div className="spinner-small" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Send Booking Request
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Booking Confirmation Dialog */}
          {showBookingConfirmation && (
            <div className="modal-overlay confirmation-overlay">
              <div className="confirmation-dialog">
                <div className="confirmation-icon">
                  <CheckCircle size={48} />
                </div>
                <h3>Did you complete your booking?</h3>
                <p>Let us know so we can add it to your calendar.</p>
                <div className="confirmation-buttons">
                  <button
                    className="confirm-btn yes"
                    onClick={() => handleBookingConfirmation(true)}
                  >
                    <Check size={18} />
                    Yes, I booked
                  </button>
                  <button
                    className="confirm-btn no"
                    onClick={() => handleBookingConfirmation(false)}
                  >
                    No, just browsing
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contact Business Sheet */}
          {showContactSheet && contactBusiness && (
            <div className="modal-overlay contact-sheet-overlay" onClick={() => setShowContactSheet(false)}>
              <div className="contact-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle" />
                <button className="close-btn sheet-close" onClick={() => setShowContactSheet(false)}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M1 13L13 1" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                <div className="sheet-header">
                  <h2>Contact Business</h2>
                  <p className="sheet-subtitle">{contactBusiness.name}</p>
                </div>

                <div className="contact-form">
                  <div className="form-field">
                    <label>Subject (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Class inquiry, Booking question"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Message</label>
                    <textarea
                      placeholder="Write your message here..."
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <button
                    className="send-message-btn"
                    onClick={submitContactForm}
                    disabled={!contactMessage.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <>
                        <div className="spinner-small" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages Modal */}
          {showMessagesModal && (
            <div className="modal-overlay messages-modal-overlay" onClick={() => setShowMessagesModal(false)}>
              <div className="messages-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn messages-close" onClick={() => { setShowMessagesModal(false); setCurrentConversation(null); }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M1 13L13 1" stroke="#374151" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>

                {!currentConversation ? (
                  <>
                    <div className="messages-header">
                      <MessageCircle size={24} />
                      <h2>Messages</h2>
                    </div>

                    <div className="conversations-list">
                      {conversationsLoading ? (
                        <div className="loading-state">
                          <div className="spinner" />
                          <p>Loading conversations...</p>
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="empty-state">
                          <MessageCircle size={48} />
                          <h3>No messages yet</h3>
                          <p>Start a conversation by contacting a business</p>
                        </div>
                      ) : (
                        conversations.map(conv => (
                          <div
                            key={conv.id}
                            className={`conversation-item ${conv.unread_count > 0 ? 'unread' : ''}`}
                            onClick={() => {
                              setCurrentConversation(conv);
                              fetchMessages(conv.id);
                            }}
                          >
                            <div className="conv-avatar">
                              {conv.business_name?.charAt(0) || 'B'}
                            </div>
                            <div className="conv-content">
                              <div className="conv-header">
                                <span className="conv-name">{conv.business_name}</span>
                                <span className="conv-time">
                                  {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : ''}
                                </span>
                              </div>
                              <p className="conv-preview">
                                {conv.last_message_preview || conv.subject || 'No messages yet'}
                              </p>
                            </div>
                            {conv.unread_count > 0 && (
                              <div className="unread-badge">{conv.unread_count}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="chat-header">
                      <button className="back-btn" onClick={() => setCurrentConversation(null)}>
                        <ChevronLeft size={20} />
                      </button>
                      <div className="chat-info">
                        <h3>{currentConversation.business_name}</h3>
                        <span className="chat-subject">{currentConversation.subject}</span>
                      </div>
                    </div>

                    <div className="messages-container">
                      {messagesLoading ? (
                        <div className="loading-state">
                          <div className="spinner" />
                        </div>
                      ) : conversationMessages.length === 0 ? (
                        <div className="empty-chat">
                          <p>No messages in this conversation yet</p>
                        </div>
                      ) : (
                        conversationMessages.map(msg => (
                          <div
                            key={msg.id}
                            className={`message-bubble ${msg.sender_type === 'user' ? 'sent' : 'received'}`}
                          >
                            <p>{msg.content}</p>
                            <span className="message-time">
                              {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="message-input-container">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <button
                        className="send-btn"
                        onClick={sendMessage}
                        disabled={!messageInput.trim() || sendingMessage}
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Admin Panel Modal */}
          {showAdminPanel && user.isAdmin && (
            <div className="modal-overlay admin-modal-overlay" onClick={() => setShowAdminPanel(false)}>
              <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn admin-close" onClick={() => setShowAdminPanel(false)}><X size={24} /></button>
                
                <div className="admin-header">
                  <div className="admin-header-content">
                    <div className="admin-icon-wrapper">
                      <Eye size={28} />
                    </div>
                    <div>
                      <h1>Admin Panel</h1>
                      <p>Review and approve submissions</p>
                    </div>
                  </div>
                </div>

                <div className="admin-content">
                  <div className="admin-tabs">
                    <button className={`admin-tab ${adminTab === 'pending' ? 'active' : ''}`} onClick={() => setAdminTab('pending')}>
                      Pending
                      {pendingSubmissions.filter(s => s.status === 'pending').length > 0 && (
                        <span className="tab-badge">{pendingSubmissions.filter(s => s.status === 'pending').length}</span>
                      )}
                    </button>
                    <button className={`admin-tab ${adminTab === 'approved' ? 'active' : ''}`} onClick={() => setAdminTab('approved')}>
                      Approved
                      {pendingSubmissions.filter(s => s.status === 'approved').length > 0 && (
                        <span className="tab-badge">{pendingSubmissions.filter(s => s.status === 'approved').length}</span>
                      )}
                    </button>
                    <button className={`admin-tab ${adminTab === 'rejected' ? 'active' : ''}`} onClick={() => setAdminTab('rejected')}>
                      Rejected
                      {pendingSubmissions.filter(s => s.status === 'rejected').length > 0 && (
                        <span className="tab-badge">{pendingSubmissions.filter(s => s.status === 'rejected').length}</span>
                      )}
                    </button>
                  </div>

                  <div className="admin-submissions">
                    {pendingSubmissions.filter(s => s.status === adminTab).length === 0 ? (
                      <div className="admin-empty">
                        <CheckCircle size={48} />
                        <h3>{adminTab === 'pending' ? 'All caught up!' : `No ${adminTab} submissions`}</h3>
                        <p>{adminTab === 'pending' ? 'No pending submissions to review' : `There are no ${adminTab} submissions yet`}</p>
                      </div>
                    ) : (
                      pendingSubmissions.filter(s => s.status === adminTab).map(submission => (
                        <div key={submission.id} className="admin-submission-card">
                          <div className="submission-card-header">
                            <div className={`submission-type-badge ${submission.type}`}>
                              {submission.type === 'event' && <Zap size={14} />}
                              {submission.type === 'class' && <Sparkles size={14} />}
                              {submission.type === 'deal' && <Percent size={14} />}
                              {submission.type}
                            </div>
                            <span className="submission-time">
                              {new Date(submission.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h4>{submission.data.title}</h4>
                          <p className="submission-business">
                            <Building size={14} />
                            {submission.business.name}
                            {submission.business.verified && <Check size={12} className="verified-mini" />}
                          </p>
                          <p className="submission-desc">{submission.data.description}</p>
                          <div className="submission-meta">
                            <span>By: {submission.submittedBy.name}</span>
                            <span>{submission.submittedBy.email}</span>
                          </div>
                          <div className="admin-actions">
                            <button 
                              className="admin-btn approve"
                              onClick={() => approveSubmission(submission.id)}
                            >
                              <Check size={16} />
                              Approve
                            </button>
                            <button 
                              className="admin-btn reject"
                              onClick={() => rejectSubmission(submission.id, 'Does not meet guidelines')}
                            >
                              <X size={16} />
                              Reject
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'business' && (
        <div className="business-view-premium">
          {/* Check if user is authenticated first */}
          {user.isGuest ? (
            <div className="no-business-view">
              <div className="no-biz-content">
                <div className="no-biz-icon">
                  <Building size={64} />
                </div>
                <h2>Sign In Required</h2>
                <p>Sign in to access the Business Dashboard and manage your business on Pulse.</p>
                <button className="claim-biz-btn-large" onClick={() => setShowAuthModal(true)}>
                  Sign In
                </button>
              </div>
            </div>
          ) : userClaimedBusinesses.length === 0 ? (
            <div className="no-business-view">
              <div className="no-biz-content">
                <div className="no-biz-icon">
                  <Building size={64} />
                </div>
                <h2>Welcome to Business Dashboard</h2>
                <p>Claim your business to unlock powerful analytics, engage with customers, and grow your revenue.</p>
                
                <div className="biz-benefits-grid">
                  <div className="biz-benefit">
                    <TrendingUp size={24} />
                    <h4>Track Performance</h4>
                    <p>Views, clicks, bookings & revenue</p>
                  </div>
                  <div className="biz-benefit">
                    <Users size={24} />
                    <h4>Grow Audience</h4>
                    <p>Followers, engagement & reach</p>
                  </div>
                  <div className="biz-benefit">
                    <Zap size={24} />
                    <h4>Earn Rewards</h4>
                    <p>XP, badges & leaderboard rank</p>
                  </div>
                  <div className="biz-benefit">
                    <Calendar size={24} />
                    <h4>Post Events</h4>
                    <p>Classes, deals & promotions</p>
                  </div>
                </div>
                
                <button className="claim-biz-btn-large" onClick={() => setShowClaimBusinessModal(true)}>
                  <Plus size={20} />
                  Claim Your Business
                </button>
                <p className="claim-note">Free to claim • Verify in under 5 minutes</p>
              </div>
            </div>
          ) : (
            <>
              {/* Premium Header */}
              <div className="premium-header">
                <div className="premium-header-content">
                  <div className="header-left">
                    <div className="venue-avatar-upload" onClick={() => showToast('Logo upload coming soon!', 'info')}>
                      <div className="venue-avatar">
                        <span className="venue-initial">{userClaimedBusinesses[0].name.charAt(0)}</span>
                      </div>
                      <div className="upload-overlay">
                        <Edit2 size={20} />
                      </div>
                    </div>
                    <div className="header-text">
                      <h1>{userClaimedBusinesses[0].name}</h1>
                      <p className="header-subtitle">{userClaimedBusinesses[0].address}</p>
                    </div>
                  </div>
                  <div className="header-right">
                    {userClaimedBusinesses[0].verified && (
                      <div className="verification-badge-premium">
                        <CheckCircle size={18} />
                        <span>Verified</span>
                      </div>
                    )}
                    {userClaimedBusinesses.length > 1 && (
                      <select className="business-selector">
                        {userClaimedBusinesses.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Pulse Score Card */}
              <div className="biz-pulse-score-card">
                <div className="pulse-score-left">
                  <div className="pulse-score-ring">
                    <svg viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pulseGradient)" strokeWidth="10" 
                        strokeDasharray={`${0 / 1000 * 327} 327`} 
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)" />
                      <defs>
                        <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="pulse-score-center">
                      <span className="pulse-score-num">--</span>
                      <span className="pulse-score-label">PULSE</span>
                    </div>
                  </div>
                </div>
                <div className="pulse-score-right">
                  <div className="pulse-score-title">
                    <h3>Build Your Score</h3>
                  </div>
                  <p>Complete your profile and engage with customers to build your Pulse Score</p>
                </div>
                <div className="pulse-score-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Profile</span>
                    <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                    <span className="breakdown-val">--</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Engagement</span>
                    <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                    <span className="breakdown-val">--</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Response</span>
                    <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                    <span className="breakdown-val">--</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Quality</span>
                    <div className="breakdown-bar"><div style={{width: '0%'}}></div></div>
                    <span className="breakdown-val">--</span>
                  </div>
                </div>
              </div>

              {/* Time Period Selector */}
              <div className="analytics-controls">
                <div className="time-selector">
                  <button className={`time-btn ${analyticsPeriod === 30 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(30)}>Last 30 Days</button>
                  <button className={`time-btn ${analyticsPeriod === 90 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(90)}>Last 90 Days</button>
                  <button className={`time-btn ${analyticsPeriod === 365 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(365)}>This Year</button>
                  <button className={`time-btn ${analyticsPeriod === 9999 ? 'active' : ''}`} onClick={() => setAnalyticsPeriod(9999)}>All Time</button>
                </div>
              </div>

              {/* Premium Stats Grid - Real Analytics */}
              <div className="premium-stats-grid">
                <div className="premium-stat-card views">
                  <div className="stat-header">
                    <span className="stat-label">Profile Views</span>
                    <Eye size={20} className="stat-icon-float" />
                  </div>
                  <div className="stat-main">
                    <div className="stat-value-large">
                      {businessAnalytics?.totals?.profile_views?.toLocaleString() || '0'}
                    </div>
                    <div className="stat-change neutral">
                      <span className="change-text">Last {analyticsPeriod} days</span>
                    </div>
                  </div>
                  <div className="stat-chart">
                    <div className="mini-bars">
                      {(businessAnalytics?.daily_breakdown?.slice(-7) || []).map((day, i) => (
                        <div key={i} className="mini-bar" style={{height: `${Math.min(100, (day.profile_views || 0) * 10)}%`}}></div>
                      ))}
                      {!businessAnalytics?.daily_breakdown && [40, 20, 30, 25, 35, 40, 45].map((h, i) => (
                        <div key={i} className="mini-bar" style={{height: `${h}%`, opacity: 0.3}}></div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card clicks">
                  <div className="stat-header">
                    <span className="stat-label">Class/Event Views</span>
                    <Users size={20} className="stat-icon-float" />
                  </div>
                  <div className="stat-main">
                    <div className="stat-value-large">
                      {((businessAnalytics?.totals?.class_views || 0) + (businessAnalytics?.totals?.event_views || 0)).toLocaleString()}
                    </div>
                    <div className="stat-change neutral">
                      <span className="change-text">Last {analyticsPeriod} days</span>
                    </div>
                  </div>
                  <div className="stat-submetrics">
                    <div className="submetric">
                      <span className="submetric-value">{businessAnalytics?.totals?.class_views || 0}</span>
                      <span className="submetric-label">Classes</span>
                    </div>
                    <div className="submetric">
                      <span className="submetric-value">{businessAnalytics?.totals?.event_views || 0}</span>
                      <span className="submetric-label">Events</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card bookings">
                  <div className="stat-header">
                    <span className="stat-label">Booking Clicks</span>
                    <Ticket size={20} className="stat-icon-float" />
                  </div>
                  <div className="stat-main">
                    <div className="stat-value-large">
                      {businessAnalytics?.totals?.booking_clicks?.toLocaleString() || '0'}
                    </div>
                    <div className="stat-change neutral">
                      <span className="change-text">Last {analyticsPeriod} days</span>
                    </div>
                  </div>
                  <div className="stat-submetrics">
                    <div className="submetric">
                      <span className="submetric-value">{businessAnalytics?.totals?.bookings_confirmed || 0}</span>
                      <span className="submetric-label">Confirmed</span>
                    </div>
                  </div>
                </div>

                <div className="premium-stat-card messages">
                  <div className="stat-header">
                    <span className="stat-label">Messages</span>
                    <MessageCircle size={20} className="stat-icon-float" />
                  </div>
                  <div className="stat-main">
                    <div className="stat-value-large">
                      {businessAnalytics?.totals?.messages_received?.toLocaleString() || '0'}
                    </div>
                    <div className="stat-change neutral">
                      <span className="change-text">Last {analyticsPeriod} days</span>
                    </div>
                  </div>
                  <div className="stat-submetrics">
                    <div className="submetric">
                      <span className="submetric-value">{businessAnalytics?.totals?.total_events || 0}</span>
                      <span className="submetric-label">Total interactions</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Goals Section */}
              <div className="premium-section goals-section">
                <div className="section-header-premium">
                  <h2>Weekly Goals</h2>
                  <div className="goals-reward-badge">
                    <Sparkles size={14} />
                    <span>Complete all for +500 XP</span>
                  </div>
                </div>
                
                <div className="goals-grid">
                  <div className="goal-card completed">
                    <div className="goal-status"><Check size={16} /></div>
                    <div className="goal-content">
                      <span className="goal-title">Post a new event or deal</span>
                      <span className="goal-xp">+100 XP</span>
                    </div>
                  </div>
                  <div className="goal-card completed">
                    <div className="goal-status"><Check size={16} /></div>
                    <div className="goal-content">
                      <span className="goal-title">Respond to 5 reviews</span>
                      <span className="goal-xp">+75 XP</span>
                    </div>
                  </div>
                  <div className="goal-card in-progress">
                    <div className="goal-status progress">3/5</div>
                    <div className="goal-content">
                      <span className="goal-title">Get 5 new reviews</span>
                      <div className="goal-progress-bar"><div style={{width: '60%'}}></div></div>
                    </div>
                    <span className="goal-xp">+150 XP</span>
                  </div>
                  <div className="goal-card">
                    <div className="goal-status empty"></div>
                    <div className="goal-content">
                      <span className="goal-title">Reach 15,000 profile views</span>
                      <div className="goal-progress-bar"><div style={{width: '86%'}}></div></div>
                    </div>
                    <span className="goal-xp">+175 XP</span>
                  </div>
                </div>
              </div>

              {/* Business Badges */}
              <div className="premium-section badges-section">
                <div className="section-header-premium">
                  <h2>Business Badges</h2>
                  <span className="badge-progress">0 / 10 earned</span>
                </div>

                <div className="badges-showcase">
                  <div className="badge-item locked">
                    <div className="badge-icon"><Check size={18} /></div>
                    <span>Verified</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Star size={18} /></div>
                    <span>Top Rated</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Zap size={18} /></div>
                    <span>Quick Reply</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><TrendingUp size={18} /></div>
                    <span>Rising Star</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Heart size={18} /></div>
                    <span>Community Fave</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Calendar size={18} /></div>
                    <span>Event Pro</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Percent size={18} /></div>
                    <span>Deal Maker</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Users size={18} /></div>
                    <span>1K Followers</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Building size={18} /></div>
                    <span>5K Followers</span>
                  </div>
                  <div className="badge-item locked">
                    <div className="badge-icon"><Sparkles size={18} /></div>
                    <span>Superhost</span>
                  </div>
                </div>
              </div>

              {/* Growth Insights */}
              <div className="premium-section insights-section">
                <div className="section-header-premium">
                  <h2>💡 Growth Tips</h2>
                </div>

                <div className="insights-cards">
                  <div className="insight-item hot">
                    <div className="insight-tag">Get Started</div>
                    <p>Post your first <strong>deal or event</strong> to start attracting customers on Pulse.</p>
                    <button className="insight-btn" onClick={() => {
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('deal');
                    }}>Create Deal</button>
                  </div>
                  <div className="insight-item">
                    <div className="insight-tag">Tip</div>
                    <p>Complete your business profile to <strong>build trust</strong> with potential customers.</p>
                    <button className="insight-btn" onClick={() => {
                      if (userClaimedBusinesses.length > 0) {
                        const biz = userClaimedBusinesses[0];
                        setEditingVenue(biz);
                        setEditVenueForm({
                          name: biz.name || '',
                          address: biz.address || '',
                          phone: biz.phone || '',
                          website: biz.website || '',
                          email: biz.email || '',
                          category: biz.category || ''
                        });
                        setShowEditVenueModal(true);
                      } else {
                        showToast('No business to edit', 'error');
                      }
                    }}>Edit Profile</button>
                  </div>
                  <div className="insight-item">
                    <div className="insight-tag">Tip</div>
                    <p>Keep your business profile updated and respond promptly to customer inquiries.</p>
                  </div>
                </div>
              </div>

              {/* How to Improve Your Score */}
              <div className="premium-section score-tips-section">
                <div className="section-header-premium">
                  <h2>📈 How to Improve Your Pulse Score</h2>
                </div>
                
                <div className="score-tips-grid">
                  <div className="score-tip-card">
                    <div className="tip-header">
                      <div className="tip-score">
                        <span className="tip-score-val">92</span>
                        <span className="tip-score-max">/100</span>
                      </div>
                      <span className="tip-label">Engagement</span>
                    </div>
                    <div className="tip-progress">
                      <div className="tip-progress-fill" style={{width: '92%', background: 'linear-gradient(90deg, #10b981, #34d399)'}}></div>
                    </div>
                    <p className="tip-description">How often customers interact with your listings</p>
                    <div className="tip-actions">
                      <div className="tip-action">
                        <Check size={14} />
                        <span>Post events weekly</span>
                      </div>
                      <div className="tip-action">
                        <Check size={14} />
                        <span>Add photos to listings</span>
                      </div>
                      <div className="tip-action pending">
                        <Plus size={14} />
                        <span>Create a deal (+5 pts)</span>
                      </div>
                    </div>
                  </div>

                  <div className="score-tip-card">
                    <div className="tip-header">
                      <div className="tip-score">
                        <span className="tip-score-val">88</span>
                        <span className="tip-score-max">/100</span>
                      </div>
                      <span className="tip-label">Response Rate</span>
                    </div>
                    <div className="tip-progress">
                      <div className="tip-progress-fill" style={{width: '88%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'}}></div>
                    </div>
                    <p className="tip-description">How quickly you respond to reviews & messages</p>
                    <div className="tip-actions">
                      <div className="tip-action">
                        <Check size={14} />
                        <span>Reply within 24 hrs</span>
                      </div>
                      <div className="tip-action pending">
                        <Plus size={14} />
                        <span>3 reviews need response (+4 pts)</span>
                      </div>
                      <div className="tip-action pending">
                        <Plus size={14} />
                        <span>Enable notifications (+3 pts)</span>
                      </div>
                    </div>
                  </div>

                  <div className="score-tip-card needs-attention">
                    <div className="tip-header">
                      <div className="tip-score">
                        <span className="tip-score-val">76</span>
                        <span className="tip-score-max">/100</span>
                      </div>
                      <span className="tip-label">Content Quality</span>
                      <span className="needs-work-badge">Needs Work</span>
                    </div>
                    <div className="tip-progress">
                      <div className="tip-progress-fill" style={{width: '76%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'}}></div>
                    </div>
                    <p className="tip-description">Completeness & quality of your profile & events</p>
                    <div className="tip-actions">
                      <div className="tip-action">
                        <Check size={14} />
                        <span>Business verified</span>
                      </div>
                      <div className="tip-action pending urgent">
                        <AlertCircle size={14} />
                        <span>Add business hours (+8 pts)</span>
                      </div>
                      <div className="tip-action pending urgent">
                        <AlertCircle size={14} />
                        <span>Upload cover photo (+6 pts)</span>
                      </div>
                      <div className="tip-action pending">
                        <Plus size={14} />
                        <span>Complete description (+4 pts)</span>
                      </div>
                    </div>
                  </div>

                  <div className="score-tip-card">
                    <div className="tip-header">
                      <div className="tip-score">
                        <span className="tip-score-val">95</span>
                        <span className="tip-score-max">/100</span>
                      </div>
                      <span className="tip-label">Customer Satisfaction</span>
                      <span className="excellent-badge">Excellent</span>
                    </div>
                    <div className="tip-progress">
                      <div className="tip-progress-fill" style={{width: '95%', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'}}></div>
                    </div>
                    <p className="tip-description">Based on ratings, reviews & repeat customers</p>
                    <div className="tip-actions">
                      <div className="tip-action">
                        <Check size={14} />
                        <span>4.8 star average</span>
                      </div>
                      <div className="tip-action">
                        <Check size={14} />
                        <span>42% repeat customers</span>
                      </div>
                      <div className="tip-action">
                        <Check size={14} />
                        <span>0 unresolved complaints</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performing Events/Classes */}
              <div className="premium-section">
                <div className="section-header-premium">
                  <h2>🏆 Top Performing</h2>
                  <button className="btn-text">View all analytics →</button>
                </div>
                
                <div className="top-classes-grid">
                  {[
                    { name: "No data yet", type: "Deal", views: 0, conversions: 0, revenue: "$0", growth: 0 },
                  ].map((item, i) => (
                    <div key={i} className="top-class-card">
                      <div className="class-card-header">
                        <div className="class-rank-badge">#{i + 1}</div>
                        <div className="class-title-section">
                          <h3>{item.name}</h3>
                          <span className="class-type-badge">{item.type}</span>
                        </div>
                        <div className="class-growth-badge">
                          <TrendingUp size={14} />
                          <span>+{item.growth}%</span>
                        </div>
                      </div>
                      <div className="class-card-stats">
                        <div className="class-stat-item">
                          <div className="stat-icon views-icon">
                            <Eye size={16} />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{item.views.toLocaleString()}</div>
                            <div className="stat-label">Views</div>
                          </div>
                        </div>
                        <div className="class-stat-divider"></div>
                        <div className="class-stat-item">
                          <div className="stat-icon bookings-icon">
                            <Users size={16} />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{item.conversions}</div>
                            <div className="stat-label">Conversions</div>
                          </div>
                        </div>
                        <div className="class-stat-divider"></div>
                        <div className="class-stat-item">
                          <div className="stat-icon revenue-icon">
                            <DollarSign size={16} />
                          </div>
                          <div className="stat-content">
                            <div className="stat-value">{item.revenue}</div>
                            <div className="stat-label">Revenue</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Your Listings Management */}
              <div className="premium-section">
                <div className="section-header-premium">
                  <h2>Your Active Listings</h2>
                  <div className="section-actions">
                    <button className="btn-secondary"><SlidersHorizontal size={18} /> Filter</button>
                    <button className="btn-primary-gradient"><Plus size={18} /> Add New</button>
                  </div>
                </div>

                <div className="listings-table-container">
                  <table className="listings-table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Views</th>
                        <th>Conversions</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        // Analytics data will be populated from database
                      ].map((listing, idx) => (
                        <tr key={idx} className="listing-row">
                          <td>
                            <div className="listing-name-cell">
                              <span className="listing-name">{listing.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`type-badge ${listing.type.toLowerCase()}`}>{listing.type}</span>
                          </td>
                          <td>
                            <span className={`status-badge ${listing.status.toLowerCase()}`}>
                              <span className="status-dot"></span>
                              {listing.status}
                            </span>
                          </td>
                          <td>
                            <span className="metric-cell">{listing.views.toLocaleString()}</span>
                          </td>
                          <td>
                            <span className="metric-cell">{listing.conversions}</span>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button className="action-btn-sm" title="Edit"><Edit2 size={14} /></button>
                              <button className="action-btn-sm" title="Analytics"><TrendingUp size={14} /></button>
                              <button className="action-btn-sm" title="Duplicate"><Copy size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audience Insights */}
              <div className="premium-section audience-section">
                <div className="section-header-premium">
                  <h2>👥 Audience Insights</h2>
                </div>
                
                <div className="audience-grid">
                  <div className="audience-card">
                    <h4>Peak Activity Times</h4>
                    <div className="peak-times">
                      <div className="peak-time">
                        <span className="peak-day">Friday</span>
                        <span className="peak-hour">6-8 PM</span>
                        <span className="peak-badge">Most Active</span>
                      </div>
                      <div className="peak-time">
                        <span className="peak-day">Saturday</span>
                        <span className="peak-hour">12-2 PM</span>
                      </div>
                      <div className="peak-time">
                        <span className="peak-day">Thursday</span>
                        <span className="peak-hour">5-7 PM</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="audience-card">
                    <h4>Customer Demographics</h4>
                    <div className="demo-bars">
                      <div className="demo-bar">
                        <span className="demo-label">25-34</span>
                        <div className="demo-progress"><div style={{width: '45%'}}></div></div>
                        <span className="demo-pct">45%</span>
                      </div>
                      <div className="demo-bar">
                        <span className="demo-label">35-44</span>
                        <div className="demo-progress"><div style={{width: '28%'}}></div></div>
                        <span className="demo-pct">28%</span>
                      </div>
                      <div className="demo-bar">
                        <span className="demo-label">18-24</span>
                        <div className="demo-progress"><div style={{width: '18%'}}></div></div>
                        <span className="demo-pct">18%</span>
                      </div>
                      <div className="demo-bar">
                        <span className="demo-label">45+</span>
                        <div className="demo-progress"><div style={{width: '9%'}}></div></div>
                        <span className="demo-pct">9%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="audience-card">
                    <h4>Top Interests</h4>
                    <div className="interest-tags">
                      <span className="interest-tag-sm">Food & Drink</span>
                      <span className="interest-tag-sm">Live Music</span>
                      <span className="interest-tag-sm">Nightlife</span>
                      <span className="interest-tag-sm">Local Events</span>
                      <span className="interest-tag-sm">Happy Hour</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Inbox Section */}
              <div className="premium-section inbox-section">
                <div className="section-header-premium">
                  <h2>📬 Inbox</h2>
                  <div className="inbox-tabs">
                    <button
                      className={`inbox-tab ${businessInboxTab === 'bookings' ? 'active' : ''}`}
                      onClick={() => {
                        setBusinessInboxTab('bookings');
                        fetchBusinessInbox(userClaimedBusinesses[0]?.id, 'booking_request');
                      }}
                    >
                      Booking Requests
                      {businessConversations.filter(c => c.type === 'booking_request' && c.unread_count > 0).length > 0 && (
                        <span className="inbox-badge">{businessConversations.filter(c => c.type === 'booking_request' && c.unread_count > 0).length}</span>
                      )}
                    </button>
                    <button
                      className={`inbox-tab ${businessInboxTab === 'messages' ? 'active' : ''}`}
                      onClick={() => {
                        setBusinessInboxTab('messages');
                        fetchBusinessInbox(userClaimedBusinesses[0]?.id, 'general_inquiry');
                      }}
                    >
                      Messages
                      {businessConversations.filter(c => c.type === 'general_inquiry' && c.unread_count > 0).length > 0 && (
                        <span className="inbox-badge">{businessConversations.filter(c => c.type === 'general_inquiry' && c.unread_count > 0).length}</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="inbox-content">
                  {businessConversationsLoading ? (
                    <div className="inbox-loading">
                      <div className="spinner" />
                      <p>Loading...</p>
                    </div>
                  ) : selectedBusinessConversation ? (
                    <div className="inbox-thread">
                      <div className="thread-header">
                        <button className="back-btn" onClick={() => setSelectedBusinessConversation(null)}>
                          <ChevronLeft size={20} />
                        </button>
                        <div className="thread-info">
                          <h4>{selectedBusinessConversation.user_name || 'Customer'}</h4>
                          <span className="thread-subject">{selectedBusinessConversation.subject}</span>
                        </div>
                        <button
                          className="resolve-btn"
                          onClick={() => markConversationResolved(selectedBusinessConversation.id)}
                        >
                          <Check size={16} />
                          Resolve
                        </button>
                      </div>

                      <div className="thread-messages">
                        {businessMessagesLoading ? (
                          <div className="inbox-loading">
                            <div className="spinner" />
                          </div>
                        ) : businessMessages.length === 0 ? (
                          <p className="no-messages">No messages yet</p>
                        ) : (
                          businessMessages.map(msg => (
                            <div
                              key={msg.id}
                              className={`thread-message ${msg.sender_type === 'business' ? 'sent' : 'received'}`}
                            >
                              <p>{msg.content}</p>
                              <span className="msg-time">
                                {new Date(msg.created_at).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="thread-reply">
                        <input
                          type="text"
                          placeholder="Type your reply..."
                          value={businessReplyInput}
                          onChange={(e) => setBusinessReplyInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendBusinessReply()}
                        />
                        <button
                          className="send-reply-btn"
                          onClick={sendBusinessReply}
                          disabled={!businessReplyInput.trim() || sendingMessage}
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  ) : businessConversations.length === 0 ? (
                    <div className="inbox-empty">
                      <MessageCircle size={48} />
                      <h3>No {businessInboxTab === 'bookings' ? 'booking requests' : 'messages'} yet</h3>
                      <p>When customers reach out, their messages will appear here.</p>
                    </div>
                  ) : (
                    <div className="inbox-list">
                      {businessConversations.map(conv => (
                        <div
                          key={conv.id}
                          className={`inbox-item ${conv.unread_count > 0 ? 'unread' : ''}`}
                          onClick={() => {
                            setSelectedBusinessConversation(conv);
                            fetchBusinessMessages(conv.id);
                          }}
                        >
                          <div className="inbox-avatar">
                            {(conv.user_name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="inbox-item-content">
                            <div className="inbox-item-header">
                              <span className="inbox-item-name">{conv.user_name || 'Customer'}</span>
                              <span className="inbox-item-time">
                                {conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString() : ''}
                              </span>
                            </div>
                            <p className="inbox-item-subject">{conv.subject}</p>
                            <p className="inbox-item-preview">{conv.last_message_preview || 'No messages yet'}</p>
                          </div>
                          {conv.unread_count > 0 && (
                            <div className="inbox-unread-badge">{conv.unread_count}</div>
                          )}
                          <ChevronRight size={16} className="inbox-chevron" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="premium-section actions-section">
                <div className="quick-actions-grid">
                  <button className="qa-btn primary">
                    <Plus size={20} />
                    <span>New Event</span>
                  </button>
                  <button className="qa-btn">
                    <Percent size={20} />
                    <span>New Deal</span>
                  </button>
                  <button className="qa-btn">
                    <Edit2 size={20} />
                    <span>Edit Profile</span>
                  </button>
                  <button className="qa-btn">
                    <TrendingUp size={20} />
                    <span>Full Analytics</span>
                  </button>
                </div>
              </div>

              {/* Help Cards */}
              <div className="quick-actions-section">
                <div className="quick-action-card">
                  <div className="qa-icon">📊</div>
                  <h3>Download Report</h3>
                  <p>Get detailed analytics for this month</p>
                  <button className="btn-outline">Download PDF</button>
                </div>
                <div className="quick-action-card">
                  <div className="qa-icon">✉️</div>
                  <h3>Contact Support</h3>
                  <p>Need help? Our team is here for you</p>
                  <button className="btn-outline">Get Help</button>
                </div>
                <div className="quick-action-card">
                  <div className="qa-icon">🎯</div>
                  <h3>Boost Visibility</h3>
                  <p>Feature your listings for more reach</p>
                  <button className="btn-outline">Upgrade</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {view === 'admin' && (
        <div className="admin-view-premium">
          {/* Check if user is authenticated and admin */}
          {!user.isAdmin ? (
            <div className="no-business-view">
              <div className="no-biz-content">
                <div className="no-biz-icon">
                  <AlertCircle size={64} />
                </div>
                <h2>Access Restricted</h2>
                <p>You need admin privileges to access this dashboard.</p>
                <button className="claim-biz-btn-large" onClick={() => setView('consumer')}>
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            <>
          {/* Premium Admin Header */}
          <div className="admin-header-premium">
            <div className="admin-header-content">
              <div>
                <h1>Admin Dashboard</h1>
                <p className="admin-subtitle">System Overview & Management</p>
              </div>
              <div className="admin-header-actions">
                <button className="btn-secondary"><SlidersHorizontal size={18} /> Settings</button>
                <button className="btn-primary-gradient"><Plus size={18} /> Add Venue</button>
              </div>
            </div>
          </div>

          {/* System Stats */}
          <div className="admin-stats-premium">
            <div className="admin-stat-box success">
              <div className="stat-icon-wrapper success">
                <CheckCircle size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{REAL_DATA.venues.length}</div>
                <div className="stat-label">Total Venues</div>
                <div className="stat-change">0 verified businesses</div>
              </div>
            </div>

            <div className="admin-stat-box info">
              <div className="stat-icon-wrapper info">
                <Calendar size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{Math.round((REAL_DATA.events.length + dbEvents.length) / 7)}</div>
                <div className="stat-label">Weekly Classes</div>
                <div className="stat-change">{REAL_DATA.events.length + dbEvents.length} total instances</div>
              </div>
            </div>

            <div className="admin-stat-box warning">
              <div className="stat-icon-wrapper warning">
                <AlertCircle size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{REAL_DATA.venues.length}</div>
                <div className="stat-label">Unclaimed Venues</div>
                <div className="stat-change">Awaiting business claims</div>
              </div>
            </div>

            <div className="admin-stat-box primary">
              <div className="stat-icon-wrapper primary">
                <DollarSign size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{REAL_DATA.deals.length + dbDeals.length}</div>
                <div className="stat-label">Active Deals</div>
                <div className="stat-change">0 verified</div>
              </div>
            </div>
          </div>

          {/* Scraping System Status */}
          <div className="premium-section">
            <div className="section-header-premium">
              <div>
                <h2>🤖 Web Scraping System</h2>
                <p className="section-subtitle">Automated venue data collection</p>
              </div>
              <div className="section-actions">
                <button className="btn-secondary"><SlidersHorizontal size={18} /> Configure</button>
                <button className="btn-primary-gradient"><Plus size={18} /> Run Scrape Now</button>
              </div>
            </div>

            <div className="scraping-dashboard">
              <div className="scrape-overview-cards">
                <div className="scrape-card success-card">
                  <div className="scrape-card-header">
                    <Clock size={20} />
                    <span>Next Scheduled Run</span>
                  </div>
                  <div className="scrape-card-value">Tonight at 2:00 AM</div>
                  <div className="scrape-card-footer">
                    <CheckCircle size={14} />
                    <span>System ready</span>
                  </div>
                </div>

                <div className="scrape-card info-card">
                  <div className="scrape-card-header">
                    <Clock size={20} />
                    <span>Last Run Duration</span>
                  </div>
                  <div className="scrape-card-value">47 minutes</div>
                  <div className="scrape-card-footer">
                    <CheckCircle size={14} />
                    <span>Completed 2hrs ago</span>
                  </div>
                </div>

                <div className="scrape-card success-card">
                  <div className="scrape-card-header">
                    <CheckCircle size={20} />
                    <span>Changes Detected</span>
                  </div>
                  <div className="scrape-card-value">23 updates</div>
                  <div className="scrape-card-footer">
                    <span>12 new, 11 modified</span>
                  </div>
                </div>

                <div className="scrape-card error-card">
                  <div className="scrape-card-header">
                    <XCircle size={20} />
                    <span>Failed Scrapes</span>
                  </div>
                  <div className="scrape-card-value">3 errors</div>
                  <div className="scrape-card-footer">
                    <AlertCircle size={14} />
                    <span>Review required</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Log */}
              <div className="activity-log">
                <h3>Recent Scraping Activity</h3>
                <div className="log-list">
                  {[
                    { time: '2:15 AM', venue: 'The Sound Martial Arts', status: 'success', changes: 2, color: 'success' },
                    { time: '2:14 AM', venue: 'Breathe Fitness Studio', status: 'success', changes: 0, color: 'success' },
                    { time: '2:13 AM', venue: 'Oxygen Yoga & Fitness', status: 'success', changes: 1, color: 'success' },
                    { time: '2:12 AM', venue: 'Ground Up Climbing', status: 'error', changes: 0, color: 'error' },
                    { time: '2:11 AM', venue: 'Mountain Fitness Center', status: 'success', changes: 3, color: 'success' },
                  ].map((log, i) => (
                    <div key={i} className={`log-item log-${log.color}`}>
                      <div className="log-icon">
                        {log.status === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      </div>
                      <div className="log-content">
                        <div className="log-venue">{log.venue}</div>
                        <div className="log-meta">
                          <span className="log-time">{log.time}</span>
                          <span className="log-separator">•</span>
                          <span className="log-changes">{log.changes} changes detected</span>
                        </div>
                      </div>
                      <div className={`log-status status-${log.status}`}>
                        {log.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Venue Management */}
          <div className="premium-section">
            <div className="section-header-premium">
              <h2>Venue Management</h2>
              <div className="admin-search-filters">
                <div className="search-box-admin">
                  <Search size={18} />
                  <input type="text" placeholder="Search venues..." />
                </div>
                <select className="filter-select-admin">
                  <option>All Categories</option>
                  <option>Fitness</option>
                  <option>Martial Arts</option>
                  <option>Arts & Culture</option>
                </select>
                <select className="filter-select-admin">
                  <option>All Status</option>
                  <option>Verified</option>
                  <option>Pending</option>
                  <option>Unverified</option>
                </select>
              </div>
            </div>

            <div className="venues-grid-admin">
              {services.slice(0, 12).map((venue, idx) => {
                const classCount = dbEvents.filter(e => e.venueId === venue.id).length;
                return (
                  <div key={venue.id} className="venue-card-admin" ref={(el) => venueCardRefs.current[idx] = el}>
                    <div className="venue-card-header">
                      <div className="venue-avatar-admin">
                        {venue.name.charAt(0)}
                      </div>
                      <div className="venue-status-indicators">
                        {venue.verified && (
                          <span className="indicator-badge verified">
                            <Check size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="venue-card-content">
                      <h3>{venue.name}</h3>
                      <p className="venue-address">{venue.address}</p>
                      <div className="venue-meta-row">
                        <span className="meta-badge">{venue.category}</span>
                        <span className="meta-text">{classCount} classes</span>
                      </div>
                    </div>
                    {/* Stats will be populated from real analytics data */}
                    <div className="venue-card-actions">
                      <button className="action-btn-mini" onClick={() => {
                        console.log('EDIT BUTTON CLICKED for venue:', venue.name);
                        console.log('Setting editingVenue and showEditVenueModal...');
                        setEditingVenue(venue);
                        setEditVenueForm({
                          name: venue.name || '',
                          address: venue.address || '',
                          phone: venue.phone || '',
                          website: venue.website || '',
                          email: venue.email || '',
                          category: venue.category || ''
                        });
                        setShowEditVenueModal(true);
                        console.log('showEditVenueModal set to true');
                      }}><Edit2 size={14} /></button>
                      <button className="action-btn-mini" onClick={() => setSelectedService(venue)}><Eye size={14} /></button>
                      <button className="action-btn-mini danger" onClick={async () => {
                        if (confirm(`Delete ${venue.name}? This cannot be undone.`)) {
                          try {
                            const { error } = await supabase
                              .from('businesses')
                              .update({ status: 'inactive' })
                              .eq('id', venue.id);
                            if (error) throw error;
                            showToast(`${venue.name} deleted`, 'success');
                            await fetchServices();
                          } catch (err) {
                            console.error('Error deleting:', err);
                            showToast('Failed to delete business', 'error');
                          }
                        }
                      }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Add Section */}
          <div className="premium-section">
            <div className="section-header-premium">
              <h2>Quick Add Class/Event</h2>
            </div>
            <div className="quick-add-premium">
              <div className="form-grid-admin">
                <div className="form-field-admin">
                  <label>Class Title</label>
                  <input type="text" placeholder="e.g. Hot Yoga Flow" />
                </div>
                <div className="form-field-admin">
                  <label>Venue</label>
                  <select>
                    <option>Select venue...</option>
                    {REAL_DATA.venues.slice(0, 10).map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field-admin">
                  <label>Start Time</label>
                  <input type="time" defaultValue="18:00" />
                </div>
                <div className="form-field-admin">
                  <label>Duration</label>
                  <select>
                    <option>30 minutes</option>
                    <option>45 minutes</option>
                    <option>60 minutes</option>
                    <option>90 minutes</option>
                  </select>
                </div>
                <div className="form-field-admin">
                  <label>Price</label>
                  <input type="text" placeholder="$20" />
                </div>
                <div className="form-field-admin">
                  <label>Recurrence</label>
                  <select>
                    <option>Weekly</option>
                    <option>Daily</option>
                    <option>Bi-weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
              </div>
              <button className="btn-primary-gradient btn-large-admin">
                <Plus size={20} /> Add Class
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* Edit Venue Modal - Global (works from any view) */}
      {showEditVenueModal && editingVenue && (
        <div className="modal-overlay" onClick={() => { setShowEditVenueModal(false); setEditingVenue(null); }}>
          <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
            <button className="claim-modal-close" onClick={() => { setShowEditVenueModal(false); setEditingVenue(null); }}><X size={24} /></button>

            <div className="claim-modal-header">
              <div className="claim-modal-icon">
                <Edit2 size={32} />
              </div>
              <h2>Edit Business</h2>
              <p>Update information for {editingVenue.name}</p>
            </div>

            <div className="claim-modal-body">
              <div className="claim-form-grid">
                <div className="claim-form-group full">
                  <label>Business Name</label>
                  <input
                    type="text"
                    placeholder="Business name"
                    value={editVenueForm.name}
                    onChange={(e) => setEditVenueForm({...editVenueForm, name: e.target.value})}
                  />
                </div>
                <div className="claim-form-group full">
                  <label>Address</label>
                  <input
                    type="text"
                    placeholder="Street address"
                    value={editVenueForm.address}
                    onChange={(e) => setEditVenueForm({...editVenueForm, address: e.target.value})}
                  />
                </div>
                <div className="claim-form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    placeholder="(604) 555-1234"
                    value={editVenueForm.phone}
                    onChange={(e) => setEditVenueForm({...editVenueForm, phone: e.target.value})}
                  />
                </div>
                <div className="claim-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="contact@business.com"
                    value={editVenueForm.email}
                    onChange={(e) => setEditVenueForm({...editVenueForm, email: e.target.value})}
                  />
                </div>
                <div className="claim-form-group">
                  <label>Website</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={editVenueForm.website}
                    onChange={(e) => setEditVenueForm({...editVenueForm, website: e.target.value})}
                  />
                </div>
                <div className="claim-form-group">
                  <label>Category</label>
                  <input
                    type="text"
                    placeholder="e.g., Fitness, Restaurant"
                    value={editVenueForm.category}
                    onChange={(e) => setEditVenueForm({...editVenueForm, category: e.target.value})}
                  />
                </div>
              </div>

              <div className="claim-modal-actions">
                <button className="claim-cancel-btn" onClick={() => { setShowEditVenueModal(false); setEditingVenue(null); }}>Cancel</button>
                <button className="claim-submit-btn" onClick={async () => {
                  console.log('SAVE CHANGES CLICKED');
                  console.log('editingVenue:', editingVenue);
                  console.log('editingVenue.id:', editingVenue?.id);
                  console.log('editVenueForm:', editVenueForm);

                  if (!editingVenue?.id) {
                    showToast('Error: No venue ID found', 'error');
                    return;
                  }

                  try {
                    console.log('Updating business with ID:', editingVenue.id);
                    const { data, error } = await supabase
                      .from('businesses')
                      .update({
                        name: editVenueForm.name,
                        address: editVenueForm.address,
                        phone: editVenueForm.phone,
                        email: editVenueForm.email,
                        website: editVenueForm.website,
                        category: editVenueForm.category
                      })
                      .eq('id', editingVenue.id)
                      .select();

                    console.log('Supabase update response - data:', data, 'error:', error);

                    if (error) throw error;

                    // Check if any rows were actually updated
                    if (!data || data.length === 0) {
                      console.error('No rows updated - likely RLS policy blocking update');
                      showToast('Update blocked - check database permissions', 'error');
                      return;
                    }

                    showToast('Business updated successfully!', 'success');
                    setShowEditVenueModal(false);
                    setEditingVenue(null);
                    // Refetch services to show updated data
                    await fetchServices();
                  } catch (err) {
                    console.error('Error updating business:', err);
                    showToast('Failed to update business', 'error');
                  }
                }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Image Cropper Modal - Works from any context */}
      {showImageCropper && cropperImage && (
        <div className="cropper-overlay-global" onClick={() => { setShowImageCropper(false); setCropPosition({ x: 0, y: 0 }); setCropZoom(1); }}>
          <div className="cropper-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cropper-header">
              <h3>{cropperType === 'profileAvatar' ? 'Crop Profile Photo' : cropperType === 'profileCover' ? 'Crop Cover Photo' : 'Crop Image'}</h3>
              <span className="cropper-ratio">{(cropperType === 'square' || cropperType === 'profileAvatar') ? '1:1 Square' : '3:1 Banner'}</span>
            </div>
            <div className="cropper-content">
              <div className="cropper-container">
                <div 
                  className={`cropper-frame ${cropperType === 'profileAvatar' ? 'square profileAvatar' : cropperType === 'profileCover' ? 'banner' : cropperType}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const img = e.currentTarget.querySelector('.cropper-image');
                    img.dataset.dragging = 'true';
                    img.dataset.startX = e.clientX;
                    img.dataset.startY = e.clientY;
                    img.dataset.origX = cropPosition.x;
                    img.dataset.origY = cropPosition.y;
                    img.style.cursor = 'grabbing';
                    img.style.transition = 'none'; // Disable transition during drag
                  }}
                  onMouseMove={(e) => {
                    const img = e.currentTarget.querySelector('.cropper-image');
                    if (img.dataset.dragging !== 'true') return;
                    const dx = e.clientX - parseFloat(img.dataset.startX);
                    const dy = e.clientY - parseFloat(img.dataset.startY);
                    const newX = parseFloat(img.dataset.origX) + dx;
                    const newY = parseFloat(img.dataset.origY) + dy;
                    img.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px)) scale(${cropZoom})`;
                    img.dataset.currentX = newX;
                    img.dataset.currentY = newY;
                  }}
                  onMouseUp={(e) => {
                    const img = e.currentTarget.querySelector('.cropper-image');
                    if (img.dataset.dragging === 'true') {
                      img.dataset.dragging = 'false';
                      img.style.cursor = 'grab';
                      img.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
                      setCropPosition({ 
                        x: parseFloat(img.dataset.currentX || cropPosition.x), 
                        y: parseFloat(img.dataset.currentY || cropPosition.y) 
                      });
                    }
                  }}
                  onMouseLeave={(e) => {
                    const img = e.currentTarget.querySelector('.cropper-image');
                    if (img && img.dataset.dragging === 'true') {
                      img.dataset.dragging = 'false';
                      img.style.cursor = 'grab';
                      img.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
                      setCropPosition({ 
                        x: parseFloat(img.dataset.currentX || cropPosition.x), 
                        y: parseFloat(img.dataset.currentY || cropPosition.y) 
                      });
                    }
                  }}
                  onTouchStart={(e) => {
                    const img = e.currentTarget.querySelector('.cropper-image');
                    const touch = e.touches[0];
                    img.dataset.dragging = 'true';
                    img.dataset.startX = touch.clientX;
                    img.style.transition = 'none'; // Disable transition during drag
                    img.dataset.startY = touch.clientY;
                    img.dataset.origX = cropPosition.x;
                    img.dataset.origY = cropPosition.y;
                  }}
                  onTouchMove={(e) => {
                    const img = e.currentTarget.querySelector('.cropper-image');
                    if (img.dataset.dragging !== 'true') return;
                    const touch = e.touches[0];
                    const dx = touch.clientX - parseFloat(img.dataset.startX);
                    const dy = touch.clientY - parseFloat(img.dataset.startY);
                    const newX = parseFloat(img.dataset.origX) + dx;
                    const newY = parseFloat(img.dataset.origY) + dy;
                    img.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px)) scale(${cropZoom})`;
                    img.dataset.currentX = newX;
                    img.dataset.currentY = newY;
                  }}
                  onTouchEnd={(e) => {
                    const img = e.currentTarget.querySelector('.cropper-image');
                    if (img.dataset.dragging === 'true') {
                      img.dataset.dragging = 'false';
                      img.style.transition = 'transform 0.1s ease-out'; // Re-enable transition
                      setCropPosition({ 
                        x: parseFloat(img.dataset.currentX || cropPosition.x), 
                        y: parseFloat(img.dataset.currentY || cropPosition.y) 
                      });
                    }
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.05 : 0.05;
                    const newZoom = Math.max(1, Math.min(3, cropZoom + delta));
                    setCropZoom(newZoom);
                  }}
                >
                  <img 
                    src={cropperImage} 
                    alt="Crop preview"
                    className="cropper-image global-cropper-img"
                    style={{
                      transform: `translate(calc(-50% + ${cropPosition.x}px), calc(-50% + ${cropPosition.y}px)) scale(${cropZoom})`,
                      cursor: 'grab',
                      transition: 'transform 0.1s ease-out'
                    }}
                    draggable={false}
                  />
                  <div className="cropper-grid-overlay">
                    <div className="grid-h-1"></div>
                    <div className="grid-h-2"></div>
                    <div className="grid-v-1"></div>
                    <div className="grid-v-2"></div>
                  </div>
                </div>
              </div>
              <p className="cropper-hint">Drag to reposition • Scroll to zoom</p>
              <div className="cropper-controls smooth-zoom">
                <button 
                  className="zoom-btn"
                  onClick={() => setCropZoom(prev => Math.max(1, prev - 0.15))}
                >−</button>
                <input 
                  type="range" 
                  min="1" 
                  max="3" 
                  step="0.005"
                  value={cropZoom}
                  onChange={(e) => {
                    const newZoom = parseFloat(e.target.value);
                    // Direct DOM update for smooth visual feedback
                    const img = document.querySelector('.global-cropper-img');
                    if (img) {
                      const x = cropPosition.x;
                      const y = cropPosition.y;
                      img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${newZoom})`;
                    }
                    setCropZoom(newZoom);
                  }}
                  className="zoom-slider"
                />
                <button 
                  className="zoom-btn"
                  onClick={() => setCropZoom(prev => Math.min(3, prev + 0.15))}
                >+</button>
              </div>
            </div>
            <div className="cropper-actions">
              <button className="cropper-btn cancel" onClick={() => { setShowImageCropper(false); setCropPosition({ x: 0, y: 0 }); setCropZoom(1); }}>
                Cancel
              </button>
              <button className="cropper-btn apply" onClick={handleCropComplete}>
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== GLOBAL MODALS (render regardless of view) ========== */}

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => { setShowAuthModal(false); setAuthError(''); setAuthEmail(''); setAuthPassword(''); setAuthName(''); }}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={() => { setShowAuthModal(false); setAuthError(''); setAuthEmail(''); setAuthPassword(''); setAuthName(''); }}><X size={24} /></button>
            <div className="auth-modal-header">
              <div className="auth-logo">
                <MapPin size={32} />
              </div>
              <h2>{authMode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
              <p>{authMode === 'signin' ? 'Sign in to save events and connect with Squamish' : 'Join the Squamish community today'}</p>
            </div>
            <div className="auth-modal-body">
              <button className="auth-btn google" onClick={async () => {
                const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
                if (error) console.error('Auth error:', error);
              }}>
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <form onSubmit={authMode === 'signin' ? handleEmailSignIn : handleEmailSignUp} className="auth-form">
                {authMode === 'signup' && (
                  <div className="auth-form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="auth-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder={authMode === 'signup' ? 'Create a password (min 6 chars)' : 'Your password'}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                {authError && (
                  <div className="auth-error">
                    <AlertCircle size={16} />
                    <span>{authError}</span>
                  </div>
                )}
                <button type="submit" className="auth-btn email" disabled={authLoading}>
                  <Mail size={20} />
                  {authLoading ? 'Please wait...' : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
                </button>
              </form>
              <div className="auth-switch">
                {authMode === 'signin' ? (
                  <p>Don't have an account? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }}>Sign Up</button></p>
                ) : (
                  <p>Already have an account? <button onClick={() => { setAuthMode('signin'); setAuthError(''); }}>Sign In</button></p>
                )}
              </div>
            </div>
            <div className="auth-modal-footer">
              <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .pulse-app { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; background: #fff; min-height: 100vh; color: #000; }
        .view-switcher { position: fixed; top: 20px; right: 20px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 6px; display: flex; gap: 6px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .view-switcher button { background: transparent; border: none; color: #374151; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .view-switcher button:hover { background: #f9fafb; }
        .view-switcher button.active { background: #2563eb; color: #fff; box-shadow: 0 2px 8px rgba(37,99,235,0.2); }
        .consumer-view { max-width: 420px; margin: 0 auto; background: #fff; min-height: 100vh; box-shadow: 0 0 0 1px #e5e7eb; }
        
        /* ========== PREMIUM HEADER ========== */
        .app-header-premium {
          background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
          border-bottom: 1px solid #e5e7eb;
          padding: 16px 0;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .header-container-premium {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .logo-area-premium {
          display: flex;
          align-items: center;
        }
        
        .pulse-logo-premium {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .pulse-icon-premium {
          width: 36px;
          height: 44px;
          filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2));
          animation: gentlePulse 3s ease-in-out infinite;
        }
        
        @keyframes gentlePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .logo-text-container {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .logo-text-premium {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.5px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .city-tag {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .header-actions-premium {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-btn-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          color: #374151;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .header-btn-icon:hover {
          background: #f3f4f6;
          transform: scale(1.05);
        }

        .header-btn-icon svg {
          stroke: #374151 !important;
          stroke-width: 2 !important;
        }

        .messages-btn:hover {
          color: #3b82f6;
        }

        .messages-btn:hover svg {
          stroke: #3b82f6 !important;
        }

        .notification-btn:hover svg {
          stroke: #f59e0b !important;
        }

        .sign-in-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }

        .sign-in-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }

        /* Event Card Book Button */
        .event-book-btn {
          position: absolute;
          bottom: 16px;
          right: 48px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          font-size: 13px;
          font-weight: 600;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }

        .event-book-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }

        /* Booking Bottom Sheet */
        .booking-sheet-overlay,
        .contact-sheet-overlay {
          align-items: flex-end !important;
          padding: 0 !important;
        }

        .booking-bottom-sheet,
        .contact-bottom-sheet {
          width: 100%;
          max-height: 80vh;
          background: white;
          border-radius: 24px 24px 0 0;
          padding: 24px;
          position: relative;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .sheet-handle {
          width: 40px;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          margin: 0 auto 20px;
        }

        .sheet-close {
          position: absolute;
          top: 24px;
          right: 24px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f3f4f6;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .sheet-header {
          margin-bottom: 24px;
        }

        .sheet-header h2 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px;
        }

        .sheet-subtitle {
          font-size: 16px;
          color: #6b7280;
          margin: 0;
        }

        .sheet-event-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          font-size: 14px;
          color: #9ca3af;
        }

        .sheet-event-info .dot {
          font-size: 8px;
        }

        .sheet-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sheet-option-btn {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
          color: inherit;
        }

        .sheet-option-btn:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .sheet-option-btn.primary {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-color: #93c5fd;
        }

        .sheet-option-btn.primary:hover {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }

        .option-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .option-icon.contact {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .option-icon.calendar {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        }

        .option-content {
          flex: 1;
          text-align: left;
        }

        .option-title {
          display: block;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .option-desc {
          display: block;
          font-size: 13px;
          color: #6b7280;
          margin-top: 2px;
        }

        .option-arrow {
          color: #9ca3af;
        }

        /* Contact Form */
        .contact-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-field label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .form-field input,
        .form-field textarea {
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.2s;
          position: relative;
          z-index: 100;
          pointer-events: auto !important;
          -webkit-user-select: text;
          user-select: text;
        }

        .form-field input:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-field textarea {
          resize: none;
        }

        .send-message-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 24px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .send-message-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-message-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }

        .spinner-small {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* Booking Sheet */
        .booking-bottom-sheet.full-height {
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        /* External Booking Container */
        .external-booking-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 0;
          text-align: center;
        }

        .booking-system-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f3f4f6;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          margin-bottom: 16px;
        }

        .booking-system-badge img {
          width: 16px;
          height: 16px;
          border-radius: 4px;
        }

        .booking-instruction {
          color: #6b7280;
          font-size: 14px;
          margin: 0 0 24px;
          line-height: 1.5;
          max-width: 300px;
        }

        .open-booking-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          font-size: 17px;
          font-weight: 600;
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }

        .open-booking-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
        }

        .add-calendar-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px 24px;
          margin-top: 12px;
          background: #f3f4f6;
          color: #374151;
          font-size: 15px;
          font-weight: 500;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-calendar-secondary:hover {
          background: #e5e7eb;
        }

        .booking-note {
          color: #9ca3af;
          font-size: 12px;
          margin: 20px 0 0;
        }

        .sheet-event-details {
          margin-top: 12px;
          padding: 12px 16px;
          background: #f9fafb;
          border-radius: 12px;
        }

        .event-title-row {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 6px;
        }

        .sheet-event-info svg {
          color: #6b7280;
        }


        /* Booking Request Form */
        .booking-request-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .request-info-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #fef3c7;
          border-radius: 12px;
          color: #92400e;
        }

        .request-info-card svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .request-info-card p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
        }

        .send-request-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 24px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-request-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-request-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        /* Booking Confirmation Dialog */
        .confirmation-overlay {
          background: rgba(0, 0, 0, 0.6) !important;
        }

        .confirmation-dialog {
          background: white;
          border-radius: 24px;
          padding: 32px;
          max-width: 340px;
          text-align: center;
          animation: scaleIn 0.2s ease;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .confirmation-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .confirmation-icon svg {
          color: #16a34a;
        }

        .confirmation-dialog h3 {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .confirmation-dialog p {
          color: #6b7280;
          margin: 0 0 24px;
          font-size: 14px;
        }

        .confirmation-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .confirm-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .confirm-btn.yes {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .confirm-btn.yes:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .confirm-btn.no {
          background: #f3f4f6;
          color: #6b7280;
        }

        .confirm-btn.no:hover {
          background: #e5e7eb;
        }

        /* Messages Modal */
        .messages-modal-overlay {
          padding: 0 !important;
        }

        .messages-modal {
          width: 100%;
          height: 100%;
          max-width: 480px;
          max-height: 100%;
          background: white;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 768px) {
          .messages-modal {
            max-height: 80vh;
            border-radius: 24px;
            margin: auto;
          }
        }

        .messages-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f3f4f6;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .messages-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 24px;
          border-bottom: 1px solid #f3f4f6;
        }

        .messages-header h2 {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .messages-header svg {
          color: #3b82f6;
        }

        .conversations-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .conversation-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .conversation-item:hover {
          background: #f9fafb;
        }

        .conversation-item.unread {
          background: #eff6ff;
        }

        .conv-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 18px;
        }

        .conv-content {
          flex: 1;
          min-width: 0;
        }

        .conv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .conv-name {
          font-weight: 600;
          color: #111827;
        }

        .conv-time {
          font-size: 12px;
          color: #9ca3af;
        }

        .conv-preview {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .unread-badge {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #3b82f6;
          color: white;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Chat View */
        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-bottom: 1px solid #f3f4f6;
        }

        .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f3f4f6;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .chat-info h3 {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .chat-subject {
          font-size: 13px;
          color: #6b7280;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message-bubble {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 16px;
        }

        .message-bubble.sent {
          align-self: flex-end;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message-bubble.received {
          align-self: flex-start;
          background: #f3f4f6;
          color: #111827;
          border-bottom-left-radius: 4px;
        }

        .message-bubble p {
          margin: 0;
          font-size: 15px;
          line-height: 1.4;
        }

        .message-time {
          display: block;
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.7;
        }

        .message-input-container {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #f3f4f6;
          background: white;
        }

        .message-input-container input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 15px;
          outline: none;
        }

        .message-input-container input:focus {
          border-color: #3b82f6;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-btn:not(:disabled):hover {
          transform: scale(1.05);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #6b7280;
        }

        .empty-state svg {
          color: #d1d5db;
          margin-bottom: 16px;
        }

        .empty-state h3 {
          font-size: 18px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 8px;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
        }

        .empty-chat {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          font-size: 14px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 12px;
        }

        .loading-state .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }


        /* Floating Action Button - Premium */
        .fab-premium {
          position: fixed;
          bottom: 32px;
          right: 32px;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100;
          overflow: visible;
        }
        
        .fab-premium:hover {
          transform: translateY(-4px) scale(1.05);
          box-shadow: 0 12px 48px rgba(37, 99, 235, 0.5);
        }
        
        .fab-premium:active {
          transform: translateY(-2px) scale(1);
        }
        
        .fab-label {
          position: absolute;
          right: 72px;
          background: #111827;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        
        .fab-label::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-left: 6px solid #111827;
        }
        
        .fab-premium:hover .fab-label {
          opacity: 1;
          right: 80px;
        }
        
        /* Profile Menu Dropdown */
        .profile-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 999;
        }
        
        .profile-menu-dropdown {
          position: fixed;
          top: 76px;
          right: 20px;
          width: 280px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
          border: 1px solid #e5e7eb;
          overflow: hidden;
          animation: slideInDown 0.2s ease-out;
        }
        
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .profile-menu-header {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        }
        
        .profile-avatar.large {
          width: 56px;
          height: 56px;
          font-size: 18px;
        }
        
        .profile-menu-info h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px 0;
        }
        
        .profile-menu-info p {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }
        
        .profile-menu-divider {
          height: 1px;
          background: #e5e7eb;
        }
        
        .profile-menu-items {
          padding: 8px;
        }
        
        .profile-menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #374151;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        
        .profile-menu-item:hover {
          background: #f0f9ff;
          color: #2563eb;
        }
        
        .profile-menu-item svg {
          flex-shrink: 0;
          opacity: 0.6;
        }
        
        .profile-menu-item:hover svg {
          opacity: 1;
        }
        
        .profile-menu-item.logout {
          color: #ef4444;
          font-weight: 600;
          justify-content: center;
        }
        
        .profile-menu-item.logout:hover {
          background: #fef2f2;
        }
        
        .header-btn-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        
        .header-btn-icon:hover {
          background: #ffffff;
          border-color: #3b82f6;
          color: #3b82f6;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
        }

        /* Force icon visibility - Lucide icons use stroke for rendering */
        .header-btn-icon svg,
        .header-btn-icon svg path,
        .header-btn-icon svg line,
        .header-btn-icon svg polyline,
        .header-btn-icon svg circle {
          stroke: #374151 !important;
          stroke-width: 2 !important;
        }

        .header-btn-icon:hover svg,
        .header-btn-icon:hover svg path,
        .header-btn-icon:hover svg line,
        .header-btn-icon:hover svg polyline,
        .header-btn-icon:hover svg circle {
          stroke: #3b82f6 !important;
        }

        .notification-btn .notification-dot {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          background: #ef4444;
          border: 2px solid #ffffff;
          border-radius: 50%;
          animation: notificationPulse 2s ease-in-out infinite;
        }
        
        @keyframes notificationPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          50% { transform: scale(1.1); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        
        .profile-btn {
          cursor: pointer;
        }
        
        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          color: white;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
          overflow: hidden;
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .profile-btn:hover .profile-avatar {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
        }
        
        /* ========== PREMIUM TOP BANNER ========== */
        .top-banner-premium {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          overflow: hidden;
        }
        
        .banner-content-premium {
          max-width: 420px;
          margin: 0 auto;
          padding: 0;
        }
        
        .banner-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
        }

        .banner-tabs.banner-tabs-row2 {
          grid-template-columns: repeat(2, 1fr);
          border-top: 1px solid #f3f4f6;
        }
        
        .banner-tab {
          padding: 14px 12px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .banner-tab:hover {
          color: #3b82f6;
          background: #f9fafb;
        }
        
        .banner-tab.active {
          color: #2563eb;
          border-bottom-color: #2563eb;
          background: linear-gradient(to bottom, rgba(59, 130, 246, 0.05), transparent);
        }
        
        .banner-tab svg {
          transition: transform 0.2s;
          flex-shrink: 0;
        }
        
        .banner-tab.active svg {
          transform: scale(1.1);
        }
        
        .banner-tab span {
          white-space: nowrap;
        }
        
        /* ========== PREMIUM SEARCH BAR ========== */
        .search-section-premium {
          background: white;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .search-bar-premium {
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
        }
        
        .search-icon-premium {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          transition: color 0.2s;
        }
        
        .search-bar-premium:focus-within .search-icon-premium {
          color: #3b82f6;
        }
        
        .search-bar-premium input {
          width: 100%;
          padding: 14px 48px 14px 48px;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 15px;
          color: #111827;
          transition: all 0.2s ease;
        }
        
        .search-bar-premium input:focus {
          outline: none;
          background: white;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
        
        .search-bar-premium input::placeholder {
          color: #9ca3af;
          transition: color 0.2s;
        }
        
        .search-bar-premium input:focus::placeholder {
          color: #c7c7c7;
        }
        
        .search-clear-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: #e5e7eb;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.15s ease;
          opacity: 0;
          animation: fadeIn 0.15s ease forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-50%) scale(0.8); }
          to { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        
        .search-clear-btn:hover {
          background: #d1d5db;
          color: #374151;
        }
        
        .search-clear-btn:active {
          transform: translateY(-50%) scale(0.95);
        }
        
        /* ========== FILTERS TOGGLE BUTTON ========== */
        .filters-toggle-section {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: 12px 20px;
        }
        
        .filters-toggle-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          color: #374151;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .filters-toggle-btn:hover {
          background: #f0f9ff;
          border-color: #3b82f6;
          color: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12);
        }
        
        .filters-toggle-btn svg {
          flex-shrink: 0;
        }
        
        /* ========== CLEAN FILTER SYSTEM - 2 ROWS ========== */
        .filters-section {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: 12px 20px;
          animation: slideDown 0.2s ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
            padding-top: 12px;
            padding-bottom: 12px;
          }
        }
        
        .filters-row-top {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }

        .filters-row-single {
          display: flex;
          margin-bottom: 10px;
        }

        .filters-row-single .filter-group {
          flex: 0 0 auto;
          min-width: 180px;
        }
        
        .filters-row-bottom {
          display: grid;
          grid-template-columns: 1.5fr 1fr auto;
          gap: 10px;
          align-items: center;
        }
        
        .filter-group {
          display: flex;
        }
        
        .filter-dropdown {
          width: 100%;
          background: #ffffff;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          cursor: pointer;
          transition: all 0.2s ease;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%233b82f6' d='M8 10.5L4 6.5h8z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 42px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        }
        
        .filter-dropdown:hover {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.12);
          transform: translateY(-1px);
        }
        
        .filter-dropdown:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 2px 8px rgba(59, 130, 246, 0.15);
          transform: translateY(-1px);
        }

        .filter-dropdown.filter-active {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }

        .filter-dropdown option {
          padding: 10px;
          background: #ffffff;
          color: #111827;
          font-weight: 500;
        }
        
        .filter-dropdown option:hover {
          background: #f0f9ff;
        }
        
        .filter-dropdown option:checked {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          font-weight: 600;
        }
        
        .reset-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 10px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
        }
        
        .reset-btn:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
        }

        /* ========== KIDS AGE SLIDER - Premium Design ========== */
        .kids-age-slider-section {
          background: #ffffff;
          border-radius: 20px;
          padding: 20px 24px;
          margin-top: 12px;
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
          animation: slideDown 0.3s ease-out;
        }

        .age-slider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .age-slider-label {
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .age-slider-value {
          font-size: 14px;
          font-weight: 700;
          color: #3b82f6;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          padding: 6px 16px;
          border-radius: 100px;
          border: none;
        }

        .age-slider-container {
          position: relative;
          height: 40px;
          margin-bottom: 20px;
          padding: 0 6px;
        }

        .age-slider-track {
          position: absolute;
          top: 50%;
          left: 6px;
          right: 6px;
          transform: translateY(-50%);
          height: 6px;
          background: #f1f5f9;
          border-radius: 100px;
          border: none;
        }

        .age-slider-fill {
          position: absolute;
          top: 0;
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 100px;
        }

        .age-slider {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          pointer-events: none;
          z-index: 2;
        }

        .age-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          background: #ffffff;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(59, 130, 246, 0.2), inset 0 0 0 2px #3b82f6;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .age-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 6px 20px rgba(59, 130, 246, 0.3), inset 0 0 0 2px #2563eb;
        }

        .age-slider::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }

        .age-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          background: #ffffff;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(59, 130, 246, 0.2), inset 0 0 0 2px #3b82f6;
        }

        .age-range-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
        }

        .age-range-btn {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 100px;
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .age-range-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .age-range-btn.active {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
          transform: translateY(-1px);
        }

        .age-range-btn.in-range {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
        }

        @media (max-width: 768px) {
          .kids-age-slider-section {
            padding: 16px 18px;
            margin-top: 10px;
            border-radius: 16px;
          }

          .age-slider-header {
            margin-bottom: 16px;
          }

          .age-slider-container {
            margin-bottom: 16px;
          }

          .age-range-buttons {
            gap: 8px;
          }

          .age-range-btn {
            padding: 8px 14px;
            font-size: 13px;
          }
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .filters-toggle-section {
            padding: 10px 16px;
          }
          
          .filters-toggle-btn {
            font-size: 14px;
            padding: 11px 16px;
          }
          
          .filters-section {
            padding: 10px 16px;
          }
          
          .filters-row-top {
            grid-template-columns: 1fr;
            gap: 8px;
            margin-bottom: 8px;
          }
          
          .filters-row-bottom {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .filters-row-single .filter-group {
            min-width: 160px;
          }
          
          .filter-dropdown {
            font-size: 14px;
            padding: 11px 14px;
            padding-right: 40px;
            border-radius: 10px;
          }
          
          .reset-btn {
            width: 100%;
            justify-content: center;
          }
          
          .fab-premium {
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
          }
          
          .fab-label {
            display: none;
          }
          
          .profile-menu-dropdown {
            right: 16px;
            width: calc(100vw - 32px);
            max-width: 320px;
          }
        }
        
        /* OLD STYLES REMOVED */
        
        .content { padding: 20px; background: #f9fafb; min-height: calc(100vh - 380px); }
        .results-count { font-size: 13px; font-weight: 600; color: #6b7280; margin-bottom: 16px; }
        .events-list { display: flex; flex-direction: column; gap: 12px; }
        
        .date-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 24px 0 16px 0;
        }
        
        .date-divider-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
        }
        
        .date-divider-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        
        .date-divider-label {
          font-size: 16px;
          font-weight: 700;
          color: #2563eb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .date-divider-subtext {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }
        .event-card { 
          background: #fff; 
          border: 1px solid #e5e7eb; 
          border-radius: 16px; 
          padding: 20px; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          position: relative; 
          display: flex; 
          flex-direction: column;
          gap: 16px; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        
        .event-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #2563eb 100%);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }
        
        .event-card.event-card-visible::before {
          transform: scaleX(1);
        }
        
        .event-card:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #2563eb;
        }

        .event-card:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s ease;
        }

        @media (hover: none) {
          .event-card:hover {
            transform: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            border-color: #e5e7eb;
          }
          
          .event-card:active {
            transform: scale(0.98);
            background: #f9fafb;
          }
        } 
          box-shadow: 0 8px 24px rgba(0,0,0,0.08); 
          border-color: #2563eb; 
        }

        .event-card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .event-title-section {
          display: block;
          margin-right: 50px;
        }

        .event-title-section h3 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .event-card-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .event-detail-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .event-detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .event-detail-item.venue-item {
          flex: 1;
          min-width: 0;
        }

        .detail-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          flex-shrink: 0;
        }

        .detail-text {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-badges-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .event-badge {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
        }

        .event-badge.age-badge {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .event-badge.price-badge {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }

        .event-badge.recurrence-badge {
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
        }

        .event-chevron {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          transition: all 0.2s;
        }

        .event-card:hover .event-chevron {
          color: #2563eb;
          transform: translateY(-50%) translateX(4px);
        }
        
        .verified-badge-premium-inline {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
          border: 2px solid white;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }
        
        .verified-badge-premium-inline:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.4);
        }
        
        .verified-badge-premium-inline::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .verified-badge-premium-inline:hover::after {
          opacity: 1;
          transition: opacity 0s;
        }
        
        .verified-badge-premium-inline::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #1f2937;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0s;
        }
        
        .verified-badge-premium-inline:hover::before {
          opacity: 1;
          transition: opacity 0s;
        }
        .save-star-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .save-star-btn:hover {
          transform: scale(1.15);
        }

        .save-star-btn:hover svg {
          stroke: #f59e0b;
        }

        .save-star-btn:active {
          transform: scale(0.95);
        }

        .save-star-btn.saved svg {
          filter: drop-shadow(0 2px 4px rgba(245, 158, 11, 0.4));
        }

        .save-star-btn.saved:hover svg {
          filter: drop-shadow(0 4px 8px rgba(245, 158, 11, 0.5));
        }

        .deal-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        
        .class-badge { position: absolute; top: 12px; right: 80px; background: #8b5cf6; color: #fff; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .class-badge.large { position: static; display: inline-block; margin-bottom: 12px; font-size: 12px; padding: 6px 14px; }
        .featured-badge { position: absolute; top: 12px; right: 12px; background: linear-gradient(135deg, #f59e0b, #dc2626); padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; box-shadow: 0 2px 8px rgba(245,158,11,0.3); }
        .featured-badge.large { position: static; display: inline-block; margin-bottom: 12px; font-size: 12px; padding: 6px 14px; }
        .verified-badge { position: absolute; top: 12px; left: 12px; background: #d1fae5; border: 1px solid #10b981; color: #047857; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
        .verified-badge.large { position: static; margin-bottom: 12px; padding: 6px 14px; font-size: 13px; }

        /* Deal Savings Badge - prominent display of discount */
        .deal-savings-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.5px;
          width: fit-content;
        }

        .deal-savings-badge.savings-percent {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
        }

        .deal-savings-badge.savings-dollar {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
        }

        .deal-savings-badge.savings-free,
        .deal-savings-badge.savings-bogo {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          color: white;
        }

        .deal-savings-badge.savings-price {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
        }

        /* Premium Deals Grid */
        .deals-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); 
          gap: 24px;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .deal-card { 
          background: #fff;
          border: 1px solid #e5e7eb; 
          border-radius: 16px; 
          padding: 20px; 
          cursor: pointer; 
          transition: all 0.2s ease; 
          position: relative; 
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        .deal-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #2563eb 100%);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }
        
        .deal-card.deal-card-visible::before {
          transform: scaleX(1);
        }
        
        .deal-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #2563eb;
        }

        .deal-card:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s ease;
        }

        @media (hover: none) {
          .deal-card:hover {
            transform: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            border-color: #e5e7eb;
          }

          .deal-card:active {
            transform: scale(0.98);
            background: #f9fafb;
          }
        }

        .deal-card-header-new {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .deal-title-section {
          display: block;
          margin-right: 50px;
        }

        .deal-title-section h3 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .savings-badge-new {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3px;
          box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .deal-card-body-new {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .deal-detail-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .deal-detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .deal-detail-item.full-width {
          flex: 1;
          min-width: 0;
        }

        .venue-icon {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }

        .clock-icon {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #15803d;
        }

        .deal-description-new {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .deal-chevron {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          transition: all 0.2s;
        }

        .deal-card:hover .deal-chevron {
          color: #2563eb;
          transform: translateY(-50%) translateX(4px);
        }
        
        .verified-badge-premium {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
          border: 2px solid white;
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .verified-badge-premium:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }
        
        .verified-badge-premium::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
        }
        
        .verified-badge-premium:hover::after {
          opacity: 1;
          transition: opacity 0s;
        }
        
        .verified-badge-premium::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #1f2937;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0s;
          z-index: 1000;
        }
        
        .verified-badge-premium:hover::before {
          opacity: 1;
          transition: opacity 0s;
        }
        
        .verified-badge-premium {
          text-align: center;
          padding: 32px 32px 24px 32px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .modal-icon {
          color: #3b82f6;
          margin-bottom: 16px;
        }
        
        .modal-header-premium h2 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 8px;
        }
        
        .modal-header-premium p {
          font-size: 14px;
          color: #6b7280;
        }
        
        .modal-body-premium {
          padding: 32px;
        }
        
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .form-group.full-width {
          grid-column: 1 / -1;
        }
        
        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }
        
        .form-input {
          width: 100%;
          padding: 12px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.2s;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .form-textarea {
          width: 100%;
          min-height: 100px;
          padding: 12px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          resize: vertical;
          transition: all 0.2s;
          font-family: inherit;
        }
        
        .form-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .category-checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 8px;
        }
        
        .category-checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #ffffff;
        }
        
        .category-checkbox-label:hover:not(.disabled) {
          border-color: #3b82f6;
          background: #f0f9ff;
        }
        
        .category-checkbox-label.disabled {
          cursor: not-allowed;
          opacity: 0.5;
          background: #f9fafb;
        }
        
        .category-checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #3b82f6;
        }
        
        .category-checkbox-label input[type="checkbox"]:disabled {
          cursor: not-allowed;
        }
        
        .category-checkbox-label:has(input:checked) {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        
        .checkbox-text {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          user-select: none;
        }
        
        .category-checkbox-label:has(input:checked) .checkbox-text {
          color: #1e40af;
          font-weight: 600;
        }
        
        .form-help-text {
          font-size: 13px;
          color: #6b7280;
          margin-top: 8px;
          font-style: italic;
        }
        
        .file-upload-area {
          border: 2px dashed #d1d5db;
          border-radius: 10px;
          padding: 32px;
          text-align: center;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .file-upload-area:hover {
          border-color: #3b82f6;
          background: #f0f9ff;
        }
        
        .file-upload-area p {
          font-size: 14px;
          margin-top: 8px;
        }
        
        .benefits-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 20px;
          background: #f0f9ff;
          border-radius: 12px;
          margin-bottom: 24px;
        }
        
        .benefit-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }
        
        .benefit-item svg {
          color: #10b981;
          flex-shrink: 0;
        }
        
        .modal-actions {
          display: flex;
          gap: 12px;
        }
        
        .btn-primary {
          flex: 1;
          padding: 14px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.35);
        }
        
        .btn-secondary {
          flex: 1;
          padding: 14px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          color: #374151;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }
        
        /* ========== PREMIUM BUSINESS PORTAL ========== */
        .business-view-premium {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 0;
        }
        
        .premium-header {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 24px 40px;
        }
        
        .premium-header-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .venue-avatar-upload {
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
        }

        .venue-avatar-upload:hover {
          transform: scale(1.05);
        }

        .venue-avatar-upload:hover .upload-overlay {
          opacity: 1;
        }

        .venue-avatar {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .upload-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .upload-overlay span {
          color: white;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .upload-overlay svg {
          color: white;
        }
        
        .venue-initial {
          margin-top: 2px;
        }
        
        .header-text h1 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        
        .header-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 4px 0 0 0;
        }
        
        .verification-badge-premium {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          border-radius: 8px;
          color: #059669;
          font-size: 14px;
          font-weight: 600;
        }
        
        .analytics-controls {
          background: white;
          padding: 16px 40px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .time-selector {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          gap: 8px;
        }
        
        .time-btn {
          padding: 8px 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .time-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }
        
        .time-btn.active {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-color: #667eea;
          color: white;
        }
        
        .premium-stats-grid {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 40px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        
        .premium-stat-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }
        
        .premium-stat-card:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        
        .premium-stat-card.views:before { background: linear-gradient(90deg, #667eea, #764ba2); }
        .premium-stat-card.clicks:before { background: linear-gradient(90deg, #f093fb, #f5576c); }
        .premium-stat-card.bookings:before { background: linear-gradient(90deg, #4facfe, #00f2fe); }
        .premium-stat-card.revenue:before { background: linear-gradient(90deg, #43e97b, #38f9d7); }
        
        .premium-stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.15);
        }
        
        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .stat-icon-float {
          color: #d1d5db;
        }
        
        .stat-main {
          margin-bottom: 16px;
        }
        
        .stat-value-large {
          font-size: 36px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
          margin-bottom: 8px;
        }
        
        .stat-change {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 600;
        }
        
        .stat-change.positive {
          color: #059669;
        }
        
        .change-arrow {
          font-size: 16px;
        }
        
        .stat-chart {
          margin-top: 12px;
        }
        
        .mini-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 40px;
        }
        
        .mini-bar {
          flex: 1;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          border-radius: 2px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        
        .mini-bar:hover {
          opacity: 1;
        }
        
        .stat-submetrics {
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }
        
        .submetric {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .submetric-value {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        
        .submetric-label {
          font-size: 12px;
          color: #9ca3af;
        }
        
        .premium-section {
          max-width: 1400px;
          margin: 0 auto 32px;
          padding: 0 40px;
        }

        /* Business Inbox Styles */
        .inbox-section {
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 24px;
          margin-left: 40px;
          margin-right: 40px;
        }

        .inbox-tabs {
          display: flex;
          gap: 8px;
        }

        .inbox-tab {
          padding: 8px 16px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 8px;
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .inbox-tab:hover {
          background: rgba(255,255,255,0.15);
        }

        .inbox-tab.active {
          background: white;
          color: #111827;
        }

        .inbox-badge {
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        .inbox-content {
          background: white;
          border-radius: 12px;
          margin-top: 16px;
          min-height: 300px;
          overflow: hidden;
        }

        .inbox-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .inbox-loading .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .inbox-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #6b7280;
        }

        .inbox-empty svg {
          color: #d1d5db;
          margin-bottom: 16px;
        }

        .inbox-empty h3 {
          font-size: 16px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 8px;
        }

        .inbox-empty p {
          margin: 0;
          font-size: 14px;
        }

        .inbox-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .inbox-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background 0.2s;
        }

        .inbox-item:hover {
          background: #f9fafb;
        }

        .inbox-item.unread {
          background: #eff6ff;
        }

        .inbox-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          flex-shrink: 0;
        }

        .inbox-item-content {
          flex: 1;
          min-width: 0;
        }

        .inbox-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .inbox-item-name {
          font-weight: 600;
          color: #111827;
          font-size: 14px;
        }

        .inbox-item-time {
          font-size: 12px;
          color: #9ca3af;
        }

        .inbox-item-subject {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin: 0 0 4px;
        }

        .inbox-item-preview {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .inbox-unread-badge {
          background: #3b82f6;
          color: white;
          font-size: 11px;
          font-weight: 600;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .inbox-chevron {
          color: #9ca3af;
        }

        /* Thread View */
        .inbox-thread {
          display: flex;
          flex-direction: column;
          height: 400px;
        }

        .thread-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid #f3f4f6;
        }

        .thread-header .back-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f3f4f6;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #374151;
        }

        .thread-info {
          flex: 1;
        }

        .thread-info h4 {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .thread-subject {
          font-size: 13px;
          color: #6b7280;
        }

        .resolve-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .thread-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .thread-message {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 16px;
        }

        .thread-message.sent {
          align-self: flex-end;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .thread-message.received {
          align-self: flex-start;
          background: #f3f4f6;
          color: #111827;
          border-bottom-left-radius: 4px;
        }

        .thread-message p {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
        }

        .msg-time {
          display: block;
          font-size: 11px;
          margin-top: 4px;
          opacity: 0.7;
        }

        .thread-reply {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #f3f4f6;
        }

        .thread-reply input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
        }

        .thread-reply input:focus {
          border-color: #3b82f6;
        }

        .send-reply-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .send-reply-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .section-header-premium {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .section-header-premium h2 {
          font-size: 20px;
          font-weight: 700;
          color: white;
          margin: 0;
        }
        
        .section-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          margin: 4px 0 0 0;
        }
        
        .section-actions {
          display: flex;
          gap: 12px;
        }
        
        .btn-secondary {
          padding: 10px 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover {
          background: #f9fafb;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .btn-primary-gradient {
          padding: 10px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .btn-primary-gradient:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }
        
        .btn-text {
          background: none;
          border: none;
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }
        
        .btn-text:hover {
          color: white;
        }
        
        .top-classes-grid {
          display: grid;
          gap: 16px;
        }
        
        .top-class-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        
        .top-class-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #2563eb 100%);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }
        
        .top-class-card.class-card-visible::before {
          transform: scaleX(1);
        }
        
        .top-class-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          border-color: #2563eb;
        }

        .class-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .class-rank-badge {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          color: #2563eb;
          flex-shrink: 0;
        }

        .class-title-section {
          flex: 1;
          min-width: 0;
        }

        .class-title-section h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.3;
        }

        .class-growth-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border: 1px solid #86efac;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          color: #059669;
          flex-shrink: 0;
        }

        .class-card-stats {
          display: flex;
          gap: 20px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
        }

        .class-stat-item {
          flex: 1;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-icon.views-icon {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #2563eb;
        }

        .stat-icon.bookings-icon {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }

        .stat-icon.revenue-icon {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          color: #059669;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          line-height: 1;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .class-stat-divider {
          width: 1px;
          background: #e5e7eb;
          margin: 4px 0;
        }
        
        .premium-table-container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .premium-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .premium-table thead {
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .premium-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .premium-table-row {
          border-bottom: 1px solid #f3f4f6;
          transition: background 0.2s;
        }
        
        .premium-table-row:hover {
          background: #f9fafb;
        }
        
        .premium-table td {
          padding: 16px;
        }
        
        .class-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .class-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        
        .class-details {
          flex: 1;
        }
        
        .class-name {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }
        
        .class-meta-text {
          font-size: 13px;
          color: #6b7280;
        }
        
        .schedule-badge {
          padding: 4px 10px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          text-transform: capitalize;
        }
        
        .status-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .status-dot.active {
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
        }
        
        .status-text {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }
        
        .verified-mini {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #059669;
          color: white;
        }
        
        .performance-cell {
          display: flex;
          gap: 12px;
        }
        
        .perf-metric {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
        }
        
        .actions-cell {
          display: flex;
          gap: 8px;
        }
        
        .action-btn-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-btn-icon:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
          color: #374151;
        }
        
        .action-btn-icon.danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        
        .quick-actions-section {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 40px 40px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        
        .quick-action-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .qa-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .quick-action-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px 0;
        }
        
        .quick-action-card p {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 16px 0;
        }
        
        .btn-outline {
          padding: 10px 20px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .btn-outline:hover {
          border-color: #667eea;
          color: #667eea;
          transform: translateY(-2px);
        }

        /* No Business View */
        .no-business-view {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .no-biz-content {
          text-align: center;
          max-width: 600px;
        }

        .no-biz-icon {
          width: 120px;
          height: 120px;
          background: rgba(255,255,255,0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.8);
          margin: 0 auto 28px;
        }

        .no-biz-content h2 {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
        }

        .no-biz-content > p {
          font-size: 16px;
          color: rgba(255,255,255,0.7);
          margin: 0 0 32px;
          line-height: 1.6;
        }

        .biz-benefits-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 32px;
        }

        .biz-benefit {
          background: rgba(255,255,255,0.1);
          padding: 24px;
          border-radius: 16px;
          text-align: left;
        }

        .biz-benefit svg {
          color: #fbbf24;
          margin-bottom: 12px;
        }

        .biz-benefit h4 {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 4px;
        }

        .biz-benefit p {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          margin: 0;
        }

        .claim-biz-btn-large {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 36px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border: none;
          border-radius: 14px;
          color: #1e1b4b;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4);
        }

        .claim-biz-btn-large:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(251, 191, 36, 0.5);
        }

        .claim-note {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          margin-top: 16px;
        }

        /* Verification Badge */
        .verification-badge-premium {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #d1fae5;
          color: #059669;
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .business-selector {
          padding: 8px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          margin-left: 12px;
        }

        /* Pulse Score Card */
        .biz-pulse-score-card {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          margin: 0 40px 24px;
          border-radius: 24px;
          padding: 32px;
          display: flex;
          gap: 32px;
          align-items: center;
          color: #fff;
        }

        .pulse-score-ring {
          position: relative;
          width: 120px;
          height: 120px;
          flex-shrink: 0;
        }

        .pulse-score-ring svg {
          width: 100%;
          height: 100%;
        }

        .pulse-score-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .pulse-score-num {
          display: block;
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
        }

        .pulse-score-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1.5px;
          opacity: 0.7;
        }

        .pulse-score-right {
          flex: 1;
        }

        .pulse-score-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .pulse-score-title h3 {
          font-size: 22px;
          font-weight: 700;
          margin: 0;
          color: #fff;
        }

        .pulse-rank-badge {
          background: rgba(251, 191, 36, 0.2);
          color: #fbbf24;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
        }

        .pulse-score-right p {
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          margin: 0 0 12px;
        }

        .pulse-score-change {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 600;
        }

        .pulse-score-breakdown {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 200px;
        }

        .breakdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .breakdown-label {
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          width: 80px;
        }

        .breakdown-bar {
          flex: 1;
          height: 6px;
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
          overflow: hidden;
        }

        .breakdown-bar div {
          height: 100%;
          background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 3px;
        }

        .breakdown-val {
          font-size: 12px;
          font-weight: 700;
          width: 25px;
          text-align: right;
        }

        /* Goals Section */
        .goals-section {
          background: white;
          margin: 0 40px 24px;
          border-radius: 20px;
          padding: 28px;
        }

        .goals-reward-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #fef3c7;
          color: #f59e0b;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 700;
        }

        .goals-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .goal-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
          background: #f9fafb;
          border-radius: 14px;
          transition: all 0.2s ease;
        }

        .goal-card.completed {
          background: #ecfdf5;
        }

        .goal-card.in-progress {
          background: #eff6ff;
        }

        .goal-status {
          width: 36px;
          height: 36px;
          background: #e5e7eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .goal-card.completed .goal-status {
          background: #10b981;
          color: #fff;
        }

        .goal-status.progress {
          background: #3b82f6;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
        }

        .goal-status.empty {
          background: #e5e7eb;
        }

        .goal-content {
          flex: 1;
          min-width: 0;
        }

        .goal-title {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 6px;
        }

        .goal-progress-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .goal-progress-bar div {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 3px;
        }

        .goal-xp {
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
          white-space: nowrap;
        }

        .goal-card.completed .goal-xp {
          color: #10b981;
          text-decoration: line-through;
          opacity: 0.6;
        }

        /* Badges Section */
        .badges-section {
          background: white;
          margin: 0 40px 24px;
          border-radius: 20px;
          padding: 28px;
        }

        .badge-progress {
          font-size: 13px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 12px;
          border-radius: 12px;
        }

        .badges-showcase {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }

        .badge-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 18px;
          background: #f9fafb;
          border-radius: 14px;
          min-width: 90px;
          transition: all 0.2s ease;
        }

        .badge-item:hover {
          transform: translateY(-2px);
        }

        .badge-item .badge-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--badge-color, #e5e7eb);
          color: #fff;
        }

        .badge-item.locked .badge-icon {
          background: #e5e7eb;
          color: #9ca3af;
        }

        .badge-item.locked {
          opacity: 0.5;
        }

        .badge-item span {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }

        /* Insights Section */
        .insights-section {
          background: white;
          margin: 0 40px 24px;
          border-radius: 20px;
          padding: 28px;
        }

        .insights-cards {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .insight-item {
          padding: 20px;
          background: #f9fafb;
          border-radius: 14px;
        }

        .insight-item.hot {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }

        .insight-tag {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: rgba(0,0,0,0.1);
          padding: 4px 10px;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .insight-item.hot .insight-tag {
          background: #f59e0b;
          color: #fff;
        }

        .insight-item p {
          font-size: 14px;
          color: #374151;
          margin: 0 0 14px;
          line-height: 1.5;
        }

        .insight-btn {
          background: #111827;
          color: #fff;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .insight-btn:hover {
          background: #374151;
        }

        .insight-item.hot .insight-btn {
          background: #f59e0b;
        }

        /* Actions Section */
        .actions-section {
          margin: 0 40px 40px;
        }

        .quick-actions-grid {
          display: flex;
          gap: 14px;
        }

        .qa-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 18px 20px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .qa-btn:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .qa-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: #fff;
        }

        .qa-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
        }

        /* Score Tips Section */
        .score-tips-section {
          background: white;
          margin: 0 40px 24px;
          border-radius: 20px;
          padding: 28px;
        }

        .score-tips-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .score-tip-card {
          background: #f9fafb;
          border-radius: 16px;
          padding: 24px;
          border: 1px solid #e5e7eb;
        }

        .score-tip-card.needs-attention {
          background: #fffbeb;
          border-color: #fcd34d;
        }

        .tip-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .tip-score {
          display: flex;
          align-items: baseline;
        }

        .tip-score-val {
          font-size: 32px;
          font-weight: 800;
          color: #111827;
        }

        .tip-score-max {
          font-size: 14px;
          color: #9ca3af;
          margin-left: 2px;
        }

        .tip-label {
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
        }

        .needs-work-badge {
          background: #fef3c7;
          color: #d97706;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          margin-left: auto;
        }

        .excellent-badge {
          background: #d1fae5;
          color: #059669;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          margin-left: auto;
        }

        .tip-progress {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .tip-progress-fill {
          height: 100%;
          border-radius: 4px;
        }

        .tip-description {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 16px;
        }

        .tip-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tip-action {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #10b981;
        }

        .tip-action.pending {
          color: #6b7280;
        }

        .tip-action.pending.urgent {
          color: #f59e0b;
          font-weight: 600;
        }

        /* Top Performing Cards */
        .top-classes-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .top-class-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
        }

        .class-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .class-rank-badge {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
        }

        .class-title-section {
          flex: 1;
        }

        .class-title-section h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px;
        }

        .class-type-badge {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .class-growth-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #d1fae5;
          color: #059669;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .class-card-stats {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .class-stat-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon.views-icon {
          background: #dbeafe;
          color: #2563eb;
        }

        .stat-icon.bookings-icon {
          background: #fef3c7;
          color: #d97706;
        }

        .stat-icon.revenue-icon {
          background: #d1fae5;
          color: #059669;
        }

        .stat-content .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }

        .stat-content .stat-label {
          font-size: 12px;
          color: #6b7280;
        }

        .class-stat-divider {
          width: 1px;
          height: 40px;
          background: #e5e7eb;
        }

        /* Listings Table */
        .listings-table-container {
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
        }

        .listings-table {
          width: 100%;
          border-collapse: collapse;
        }

        .listings-table th {
          text-align: left;
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .listings-table td {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .listing-row:last-child td {
          border-bottom: none;
        }

        .listing-name-cell .listing-name {
          font-weight: 600;
          color: #111827;
        }

        .type-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .type-badge.deal {
          background: #fef3c7;
          color: #d97706;
        }

        .type-badge.event {
          background: #dbeafe;
          color: #2563eb;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-badge.active {
          background: #d1fae5;
          color: #059669;
        }

        .status-badge.active .status-dot {
          background: #10b981;
        }

        .status-badge.scheduled {
          background: #dbeafe;
          color: #2563eb;
        }

        .status-badge.scheduled .status-dot {
          background: #3b82f6;
        }

        .metric-cell {
          font-weight: 600;
          color: #111827;
        }

        .actions-cell {
          display: flex;
          gap: 8px;
        }

        .action-btn-sm {
          width: 32px;
          height: 32px;
          border: none;
          background: #f3f4f6;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn-sm:hover {
          background: #e5e7eb;
          color: #111827;
        }

        /* Audience Section */
        .audience-section {
          background: white;
          margin: 0 40px 24px;
          border-radius: 20px;
          padding: 28px;
        }

        .audience-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .audience-card {
          background: #f9fafb;
          border-radius: 14px;
          padding: 20px;
        }

        .audience-card h4 {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px;
        }

        .peak-times {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .peak-time {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .peak-day {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          width: 70px;
        }

        .peak-hour {
          font-size: 13px;
          color: #6b7280;
        }

        .peak-badge {
          background: #fef3c7;
          color: #d97706;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          margin-left: auto;
        }

        .demo-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .demo-bar {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .demo-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          width: 40px;
        }

        .demo-progress {
          flex: 1;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .demo-progress div {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 4px;
        }

        .demo-pct {
          font-size: 12px;
          font-weight: 700;
          color: #374151;
          width: 35px;
          text-align: right;
        }

        .interest-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .interest-tag-sm {
          background: #eff6ff;
          color: #2563eb;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        /* Quick Actions Section */
        .quick-actions-section {
          display: flex;
          gap: 20px;
          margin: 0 40px 40px;
        }

        .quick-action-card {
          flex: 1;
          background: white;
          border-radius: 16px;
          padding: 24px;
          text-align: center;
        }

        .quick-action-card .qa-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .quick-action-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .quick-action-card p {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 16px;
        }

        .btn-outline {
          padding: 10px 20px;
          background: none;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-outline:hover {
          border-color: #667eea;
          color: #667eea;
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: #f3f4f6;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-primary-gradient {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary-gradient:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-text {
          background: none;
          border: none;
          color: #667eea;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-text:hover {
          text-decoration: underline;
        }

        .section-actions {
          display: flex;
          gap: 12px;
        }

        @media (max-width: 768px) {
          .biz-pulse-score-card {
            flex-direction: column;
            margin: 0 16px 20px;
            padding: 24px;
          }

          .pulse-score-breakdown {
            width: 100%;
          }

          .goals-section, .badges-section, .insights-section, .actions-section,
          .score-tips-section, .audience-section {
            margin-left: 16px;
            margin-right: 16px;
          }

          .goals-grid, .score-tips-grid {
            grid-template-columns: 1fr;
          }

          .quick-actions-grid {
            flex-wrap: wrap;
          }

          .qa-btn {
            flex: 1 1 45%;
          }

          .biz-benefits-grid {
            grid-template-columns: 1fr;
          }

          .audience-grid {
            grid-template-columns: 1fr;
          }

          .quick-actions-section {
            flex-direction: column;
            margin-left: 16px;
            margin-right: 16px;
          }

          .class-card-stats {
            flex-wrap: wrap;
            gap: 16px;
          }

          .class-stat-divider {
            display: none;
          }
        }
        }
        
        /* ========== PREMIUM ADMIN PORTAL ========== */
        .admin-view-premium {
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          min-height: 100vh;
          padding: 0;
        }
        
        .admin-header-premium {
          background: white;
          border-bottom: 1px solid #e5e7eb;
          padding: 24px 40px;
        }
        
        .admin-header-content {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .admin-header-content h1 {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          margin: 0;
        }
        
        .admin-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 4px 0 0 0;
        }
        
        .admin-header-actions {
          display: flex;
          gap: 12px;
        }
        
        .admin-stats-premium {
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px 40px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        
        .admin-stat-box {
          background: white;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: all 0.2s;
        }
        
        .admin-stat-box:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }
        
        .stat-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .stat-icon-wrapper.success { background: #ecfdf5; color: #059669; }
        .stat-icon-wrapper.info { background: #eff6ff; color: #2563eb; }
        .stat-icon-wrapper.warning { background: #fef3c7; color: #d97706; }
        .stat-icon-wrapper.primary { background: #f3e8ff; color: #7c3aed; }
        
        .stat-content {
          flex: 1;
        }
        
        .stat-number {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
          margin-bottom: 6px;
        }
        
        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 4px;
        }
        
        .stat-change {
          font-size: 12px;
          color: #9ca3af;
        }
        
        .scraping-dashboard {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .scrape-overview-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .scrape-card {
          padding: 20px;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
        }
        
        .scrape-card.success-card { background: #ecfdf5; border-color: #a7f3d0; }
        .scrape-card.info-card { background: #eff6ff; border-color: #bfdbfe; }
        .scrape-card.error-card { background: #fef2f2; border-color: #fecaca; }
        
        .scrape-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          margin-bottom: 12px;
        }
        
        .scrape-card-value {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 8px;
        }
        
        .scrape-card-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #6b7280;
        }
        
        .activity-log h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px 0;
        }
        
        .log-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .log-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }
        
        .log-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .log-item.log-success .log-icon { background: #ecfdf5; color: #059669; }
        .log-item.log-error .log-icon { background: #fef2f2; color: #dc2626; }
        
        .log-content {
          flex: 1;
        }
        
        .log-venue {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
        }
        
        .log-meta {
          font-size: 12px;
          color: #6b7280;
          display: flex;
          gap: 6px;
        }
        
        .log-separator {
          color: #d1d5db;
        }
        
        .log-status {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        
        .log-status.status-success {
          background: #ecfdf5;
          color: #059669;
        }
        
        .log-status.status-error {
          background: #fef2f2;
          color: #dc2626;
        }
        
        .admin-search-filters {
          display: flex;
          gap: 12px;
        }
        
        .search-box-admin {
          flex: 1;
          position: relative;
        }
        
        .search-box-admin svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }
        
        .search-box-admin input {
          width: 100%;
          padding: 10px 12px 10px 40px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          color: #111827;
        }
        
        .filter-select-admin {
          padding: 10px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
        }
        
        .venues-grid-admin {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        
        .venue-card-admin {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        
        .venue-card-admin::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #2563eb 100%);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }
        
        .venue-card-admin.venue-card-visible::before {
          transform: scaleX(1);
        }
        
        .venue-card-admin:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }
        
        .venue-card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        
        .venue-avatar-admin {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
          color: white;
        }
        
        .venue-status-indicators {
          display: flex;
          gap: 4px;
        }
        
        .indicator-badge {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .indicator-badge.verified {
          background: #059669;
          color: white;
        }
        
        .venue-card-content h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 6px 0;
        }
        
        .venue-address {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 12px;
          display: block;
        }
        
        .venue-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .meta-badge {
          padding: 3px 8px;
          background: #eff6ff;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #2563eb;
        }
        
        .meta-text {
          font-size: 13px;
          color: #6b7280;
        }
        
        .venue-card-stats {
          display: flex;
          gap: 16px;
          padding: 12px 0;
          border-top: 1px solid #f3f4f6;
          border-bottom: 1px solid #f3f4f6;
          margin-bottom: 12px;
        }
        
        .mini-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
        }
        
        .venue-card-actions {
          display: flex;
          gap: 8px;
        }
        
        .action-btn-mini {
          flex: 1;
          padding: 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .action-btn-mini:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
          color: #374151;
        }
        
        .action-btn-mini.danger:hover {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        
        .quick-add-premium {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .form-grid-admin {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .form-field-admin {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .form-field-admin label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }
        
        .form-field-admin input,
        .form-field-admin select {
          padding: 10px 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          position: relative;
          z-index: 100;
          pointer-events: auto !important;
          -webkit-user-select: text;
          user-select: text;
        }
        
        .btn-large-admin {
          width: 100%;
          padding: 14px;
          font-size: 16px;
        }
        
        @media (max-width: 1200px) {
          .premium-stats-grid,
          .admin-stats-premium {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .venues-grid-admin {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (max-width: 768px) {
          .premium-stats-grid,
          .admin-stats-premium,
          .quick-actions-section,
          .scrape-overview-cards,
          .venues-grid-admin,
          .form-grid-admin {
            grid-template-columns: 1fr;
          }
        }
        
        /* OLD STYLES REMOVED */
        .verification-status { display: flex; align-items: center; gap: 8px; background: #d1fae5; border: 1px solid #10b981; color: #047857; padding: 8px 16px; border-radius: 10px; font-size: 14px; font-weight: 700; }
        .business-stats, .admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .stat-card svg { color: #2563eb; }
        .stat-value { font-size: 28px; font-weight: 800; color: #111827; }
        .stat-label { font-size: 13px; color: #6b7280; margin-top: 4px; font-weight: 500; }
        
        /* Premium Services Section */
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 24px;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .service-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
          transition: all 0.2s ease, opacity 0.25s ease, transform 0.25s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 16px;
          cursor: pointer;
          animation: cardFadeIn 0.3s ease forwards;
        }
        
        @keyframes cardFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .services-grid {
          animation: gridFadeIn 0.2s ease;
        }
        
        @keyframes gridFadeIn {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }

        .service-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 50%, #2563eb 100%);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }
        
        .service-card.service-card-visible::before {
          transform: scaleX(1);
        }

        .service-card.verified {
          border-color: #93c5fd;
        }

        .service-card.unverified {
          opacity: 0.90;
        }

        .service-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #2563eb;
        }

        .service-card:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s ease;
        }

        @media (hover: none) {
          .service-card:hover {
            transform: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            border-color: #e5e7eb;
          }
          
          .service-card:active {
            transform: scale(0.98);
            background: #f9fafb;
          }
        }

        .service-card-header-new {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .service-title-section {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .service-title-section h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          flex: 1;
        }

        .service-rating-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #d97706;
          flex-shrink: 0;
        }

        
        .review-count {
          font-size: 12px;
          font-weight: 500;
          color: #b45309;
          margin-left: 2px;
        }

        .service-card-body-new {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .service-detail-row {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .service-link-row {
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .service-link-row:hover .detail-link {
          color: #2563eb;
        }

        .service-detail-item {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .category-icon {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #2563eb;
        }

        .reviews-icon {
          background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
          color: #db2777;
        }

        .location-icon {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }

        .phone-icon {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #15803d;
        }

        .service-category-text {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
          color: #6b7280;
        }

        .detail-link {
          transition: color 0.2s;
        }

        .service-website-btn-new {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .service-website-btn-new:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        /* Social Proof Banner */
        .service-social-proof {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 10px 10px 10px 14px;
          font-size: 13px;
          font-weight: 600;
          color: #166534;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .service-social-proof:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .social-proof-text {
          flex: 1;
          line-height: 1.3;
        }

        .social-proof-arrow {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255,255,255,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .service-social-proof:hover .social-proof-arrow {
          background: rgba(255,255,255,0.9);
          transform: translateX(2px);
        }

        /* Neighbor - Warm Coral */
        .service-social-proof.neighbor {
          background: linear-gradient(135deg, #fff5f5 0%, #ffe4e6 100%);
          border-color: #fecdd3;
          color: #be123c;
        }

        /* Rank - Rich Orange */
        .service-social-proof.rank {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          border-color: #fdba74;
          color: #c2410c;
        }

        /* Volume - Emerald Green */
        .service-social-proof.volume {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border-color: #6ee7b7;
          color: #047857;
        }

        /* Monthly - Rose Pink */
        .service-social-proof.monthly {
          background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
          border-color: #f9a8d4;
          color: #be185d;
        }

        /* Testimonial - Purple */
        .service-social-proof.testimonial {
          background: linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%);
          border-color: #c4b5fd;
          color: #6d28d9;
          font-style: italic;
        }

        /* Response - Teal */
        .service-social-proof.response {
          background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
          border-color: #5eead4;
          color: #0f766e;
        }

        /* Longevity - Warm Slate */
        .service-social-proof.longevity {
          background: linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%);
          border-color: #d6d3d1;
          color: #57534e;
        }

        /* Satisfaction - Fresh Green */
        .service-social-proof.satisfaction {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-color: #86efac;
          color: #15803d;
        }

        /* Service Action Buttons */
        .service-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .service-action-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .service-action-btn.primary {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .service-action-btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .service-action-icons {
          display: flex;
          gap: 8px;
        }

        .service-icon-btn {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          border: 2px solid #e5e7eb;
          background: #fff;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .service-icon-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
          background: #eff6ff;
        }

        .service-chevron {
          position: absolute;
          right: 20px;
          top: 20px;
          color: #9ca3af;
          transition: all 0.2s;
          pointer-events: none;
        }

        .service-card:hover .service-chevron {
          color: #2563eb;
          transform: translateX(4px);
        }

          padding: 8px;
          margin: 0 -8px;
        }

        .service-detail-link:hover {
          background: #f3f4f6;
          color: #3b82f6;
        }

        .service-detail-link:hover svg {
          color: #3b82f6;
        }

        .service-detail svg {
          color: #9ca3af;
          flex-shrink: 0;
        }


        .verified-badge-premium {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          flex-shrink: 0;
        }

        /* Modal and Utility Classes */
        .empty-state { text-align: center; padding: 40px 20px; }
        .empty-state p { color: #6b7280; margin-bottom: 16px; }
        .empty-state button { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        
        /* Search Results Count */
        .search-results-count {
          padding: 12px 24px;
          background: linear-gradient(180deg, #f0f9ff 0%, #fff 100%);
          border-bottom: 1px solid #e0f2fe;
          animation: fadeSlideIn 0.2s ease;
        }
        
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .results-text {
          font-size: 14px;
          font-weight: 500;
          color: #0369a1;
        }
        
        /* No Results State */
        .no-results-state {
          text-align: center;
          padding: 60px 24px;
          background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
          border-radius: 20px;
          margin: 20px;
        }
        .no-results-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .no-results-state h3 {
          font-size: 20px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 8px 0;
        }
        .no-results-state p {
          font-size: 15px;
          color: #6b7280;
          margin: 0 0 20px 0;
        }
        .clear-search-btn {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          border: none;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
        }
        .clear-search-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
        }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }

        /* Global fix: Ensure ALL inputs in modals are interactable AND visible */
        .modal-overlay input,
        .modal-overlay textarea,
        .modal-overlay select {
          position: relative !important;
          z-index: 100 !important;
          pointer-events: auto !important;
          -webkit-user-select: text !important;
          user-select: text !important;
          cursor: text;
          color: #1f2937 !important;
          background: #fff !important;
        }
        .modal-overlay select { cursor: pointer; }

        /* Global fix: Ensure ALL buttons in modals are clickable */
        .modal-overlay button {
          position: relative !important;
          z-index: 200 !important;
          pointer-events: auto !important;
          cursor: pointer !important;
        }
        .modal-content { background: #fff; border-radius: 20px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; border: 1px solid #e5e7eb; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .close-btn { position: absolute; top: 16px; right: 16px; background: #f3f4f6; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #374151; cursor: pointer; transition: 0.2s; z-index: 10; }
        .close-btn:hover { background: #e5e7eb; color: #111827; }
        .event-detail, .deal-detail { padding: 32px; }
        .event-detail h1, .deal-detail h1 { font-size: 28px; font-weight: 800; margin-bottom: 20px; color: #111827; }
        .event-meta { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
        .meta-item { display: flex; align-items: center; gap: 8px; color: #374151; font-size: 15px; font-weight: 500; }
        .meta-item.price { color: #059669; font-weight: 600; }
        .meta-item.recurring { color: #2563eb; font-weight: 600; }
        .event-description, .deal-description { color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .event-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
        .tag { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; }
        .deal-terms { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 24px; }
        .deal-terms h3 { font-size: 14px; font-weight: 700; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .deal-terms p { font-size: 14px; color: #374151; line-height: 1.5; }
        .event-actions { display: flex; gap: 12px; margin-bottom: 24px; }
        .action-btn { flex: 1; background: #fff; border: 1px solid #e5e7eb; color: #374151; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .action-btn:hover { background: #f9fafb; border-color: #9ca3af; }
        .action-btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
        .action-btn.primary:hover { background: #1d4ed8; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
        .action-btn.saved { background: #fef3c7; border-color: #fbbf24; color: #92400e; }
        .saved-section h2 { font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #111827; }
        
        /* Add Event Modal */
        .add-event-modal {
          max-width: 600px;
        }

        /* Auth Modal */
        .auth-modal {
          background: #fff;
          border-radius: 24px;
          max-width: 400px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .auth-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #f3f4f6;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #6b7280;
          z-index: 10;
          transition: all 0.2s;
        }

        .auth-modal-close:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .auth-modal-header {
          padding: 40px 32px 24px;
          text-align: center;
          border-bottom: 1px solid #e5e7eb;
        }

        .auth-logo {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #fff;
        }

        .auth-modal-header h2 {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .auth-modal-header p {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
        }

        .auth-modal-body {
          padding: 24px 32px;
        }

        .auth-btn {
          width: 100%;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s;
          margin-bottom: 12px;
        }

        .auth-btn.google {
          background: #fff;
          border: 1px solid #e5e7eb;
          color: #374151;
        }

        .auth-btn.google:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .auth-btn.email {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: #fff;
        }

        .auth-btn.email:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 20px 0;
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }

        .auth-divider span {
          font-size: 13px;
          color: #9ca3af;
        }

        .auth-modal-footer {
          padding: 16px 32px 24px;
          text-align: center;
        }

        .auth-modal-footer p {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-form-group label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }

        .auth-form-group input {
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 15px;
          color: #1f2937;
          background: #fff;
          transition: all 0.2s;
          position: relative;
          z-index: 100;
          pointer-events: auto !important;
          -webkit-user-select: text;
          user-select: text;
        }

        .auth-form-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .auth-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 13px;
        }

        .auth-switch {
          text-align: center;
          margin-top: 8px;
        }

        .auth-switch p {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        .auth-switch button {
          background: none;
          border: none;
          color: #3b82f6;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
        }

        .auth-switch button:hover {
          text-decoration: underline;
        }

        .auth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Premium Claim Business Modal */
        .claim-modal-premium {
          background: #fff;
          border-radius: 24px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .claim-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #fff;
          z-index: 10;
          transition: background 0.2s;
        }

        .claim-modal-close:hover {
          background: rgba(255,255,255,0.3);
        }

        .claim-modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B46C1 100%);
          padding: 40px 32px 32px;
          text-align: center;
          border-radius: 24px 24px 0 0;
        }

        .claim-modal-icon {
          width: 72px;
          height: 72px;
          background: rgba(255,255,255,0.15);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: #fff;
        }

        .claim-modal-header h2 {
          font-size: 26px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 8px;
        }

        .claim-modal-header p {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          margin: 0;
        }

        .claim-modal-body {
          padding: 28px;
          position: relative;
          z-index: 5;
        }

        .claim-signin-prompt {
          text-align: center;
          padding: 20px 0;
        }

        .signin-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #6b7280;
          margin-bottom: 20px;
        }

        .signin-message svg {
          color: #f59e0b;
        }

        .claim-signin-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          border: none;
          padding: 14px 32px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .claim-signin-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .claim-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        .claim-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .claim-form-group.full {
          grid-column: 1 / -1;
        }

        .claim-form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .claim-form-group input,
        .claim-form-group select {
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          background: #f9fafb;
          color: #1f2937 !important;
          transition: all 0.2s;
          position: relative;
          z-index: 100;
          cursor: text;
          pointer-events: auto !important;
          -webkit-user-select: text;
          user-select: text;
        }

        .claim-form-group input:focus,
        .claim-form-group select:focus {
          outline: none;
          border-color: #667eea;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .claim-benefits {
          background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
          border-radius: 12px;
          padding: 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }

        .claim-benefit {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #374151;
        }

        .claim-benefit svg {
          color: #667eea;
          flex-shrink: 0;
        }

        .claim-modal-actions {
          display: flex;
          gap: 12px;
        }

        .claim-cancel-btn {
          flex: 1;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          color: #374151;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .claim-cancel-btn:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .claim-submit-btn {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .claim-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .claim-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        @media (max-width: 480px) {
          .claim-form-grid {
            grid-template-columns: 1fr;
          }
          .claim-benefits {
            grid-template-columns: 1fr;
          }
          /* Fix view switcher overlap on mobile */
          .view-switcher {
            position: fixed;
            top: auto;
            bottom: 20px;
            right: 50%;
            transform: translateX(50%);
            z-index: 999;
          }
        }

        /* ========== PREMIUM EVENT/CLASS DETAIL MODAL ========== */
        .event-detail-modal {
          background: #ffffff;
          border-radius: 24px;
          max-width: 580px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.1);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        .event-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: none;
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          max-width: 32px;
          max-height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 20;
          box-shadow: none;
          padding: 0;
          flex-shrink: 0;
        }

        .event-close:hover {
          background: rgba(0,0,0,0.4);
          transform: scale(1.05);
        }

        .event-close svg {
          width: 14px;
          height: 14px;
          stroke: #fff !important;
          stroke-width: 1.5 !important;
          fill: none !important;
        }

        /* Event Hero */
        .event-hero {
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #4338ca 100%);
          padding: 40px 28px 32px;
          position: relative;
          overflow: hidden;
        }

        .event-hero.class-hero {
          background: linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%);
        }

        .event-hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        .event-hero-content {
          position: relative;
          z-index: 1;
        }

        .event-hero-badges {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .event-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          color: #fff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .event-type-pill.class-pill {
          background: rgba(16, 185, 129, 0.3);
        }

        .event-type-pill.event-pill {
          background: rgba(139, 92, 246, 0.3);
        }

        .recurring-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.9);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .event-hero-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
          line-height: 1.2;
          letter-spacing: -0.5px;
        }

        .event-hero-venue {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          font-weight: 500;
        }

        .venue-verified-badge {
          width: 18px;
          height: 18px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        /* DateTime Card */
        .event-datetime-card {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: -20px 20px 0;
          padding: 16px 20px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          position: relative;
          z-index: 5;
          border: 1px solid #f3f4f6;
        }

        .datetime-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #7c3aed;
          flex-shrink: 0;
        }

        .class-hero + .event-datetime-card .datetime-icon {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #059669;
        }

        .datetime-content {
          flex: 1;
        }

        .datetime-date {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 2px;
        }

        .datetime-time {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }

        .add-calendar-btn {
          width: 40px;
          height: 40px;
          min-width: 40px;
          min-height: 40px;
          background: #f3f4f6;
          border: none;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .add-calendar-btn:hover {
          background: #e5e7eb;
          transform: scale(1.05);
        }

        /* No special SVG rules - let Lucide handle it with color inheritance */

        /* Event Quick Actions */
        .event-quick-actions {
          display: flex;
          justify-content: space-around;
          padding: 24px 20px 20px;
          margin-top: 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        /* Event Sections */
        .event-section {
          padding: 24px 28px;
          border-bottom: 1px solid #f3f4f6;
        }

        .event-section:last-of-type {
          border-bottom: none;
        }

        .event-section-title {
          font-size: 13px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 16px;
        }

        .event-about-text {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        }

        /* Event Details Grid */
        .event-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .event-detail-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #f3f4f6;
        }

        .event-detail-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .event-detail-icon.price-icon {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #16a34a;
        }

        .event-detail-icon.age-icon {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #2563eb;
        }

        .event-detail-icon.venue-icon {
          background: linear-gradient(135deg, #fae8ff 0%, #f5d0fe 100%);
          color: #a855f7;
        }

        .event-detail-icon.time-icon {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }

        .event-detail-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .event-detail-label {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .event-detail-value {
          font-size: 14px;
          color: #111827;
          font-weight: 600;
        }

        /* Event Tags */
        .event-tags-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .event-tag-pill {
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
          color: #6d28d9;
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid #c4b5fd;
        }

        .class-hero ~ .event-section .event-tag-pill {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #047857;
          border-color: #6ee7b7;
        }

        /* Event CTA */
        .event-cta-section {
          padding: 24px 28px;
          display: flex;
          gap: 12px;
        }

        .event-cta-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }

        .event-cta-btn.primary {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(124,58,237,0.3);
        }

        .event-cta-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(124,58,237,0.4);
        }

        .event-cta-btn.primary:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s ease;
        }

        .class-hero ~ .event-cta-section .event-cta-btn.primary {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          box-shadow: 0 4px 14px rgba(5,150,105,0.3);
        }

        .class-hero ~ .event-cta-section .event-cta-btn.primary:hover {
          box-shadow: 0 6px 20px rgba(5,150,105,0.4);
        }

        .event-cta-btn.secondary {
          background: #f9fafb;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .event-cta-btn.secondary:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .event-cta-btn.secondary:active {
          transform: scale(0.98);
          background: #e5e7eb;
        }

        /* Event Footer */
        .event-modal-footer {
          padding: 16px 28px 24px;
          text-align: center;
          border-top: 1px solid #f3f4f6;
        }

        .event-modal-footer p {
          font-size: 12px;
          color: #9ca3af;
        }

        /* ========== PREMIUM SUBMISSION MODAL ========== */
        .submission-modal {
          background: #ffffff;
          border-radius: 24px;
          max-width: 560px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.1);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }

        .submission-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 20;
        }

        .submission-header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          padding: 32px 28px;
          position: relative;
        }

        .submission-header.event {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
        }

        .submission-header.class {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }

        .submission-header.deal {
          background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%);
        }

        .submission-header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .submission-icon-wrapper {
          width: 56px;
          height: 56px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .submission-icon-wrapper.event { background: rgba(124,58,237,0.3); }
        .submission-icon-wrapper.class { background: rgba(5,150,105,0.3); }
        .submission-icon-wrapper.deal { background: rgba(220,38,38,0.3); }

        .submission-header h1 {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .submission-header p {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          margin: 0;
        }

        .submission-content {
          padding: 28px;
        }

        .submission-content.scrollable {
          overflow-y: auto;
          max-height: calc(90vh - 160px);
          -webkit-overflow-scrolling: touch;
        }

        .step-title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 20px 0;
        }

        /* Type Selection */
        .type-selection-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .type-card {
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .type-card:hover {
          border-color: #2563eb;
          background: #fff;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        }

        .type-card.event:hover { border-color: #7c3aed; }
        .type-card.class:hover { border-color: #059669; }
        .type-card.deal:hover { border-color: #dc2626; }

        .type-card-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          margin: 0 auto 12px;
        }

        .type-card.event .type-card-icon {
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
          color: #7c3aed;
        }

        .type-card.class .type-card-icon {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #059669;
        }

        .type-card.deal .type-card-icon {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #dc2626;
        }

        .type-card h4 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 6px 0;
        }

        .type-card p {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
          line-height: 1.4;
        }

        /* Business Check */
        .business-check-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
        }

        .claimed-business-info {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .business-avatar {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
        }

        .business-details h4 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .business-details p {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 8px 0;
        }

        .verified-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #d1fae5;
          color: #047857;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
        }

        .business-choice-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .choice-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .choice-btn.yes {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: #fff;
        }

        .choice-btn.yes:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(5,150,105,0.3);
        }

        .choice-btn.no {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .choice-btn.no:hover {
          background: #e5e7eb;
        }

        /* Submission Form */
        .submission-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .submission-form .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .submission-form .form-group.full {
          grid-column: span 2;
        }

        .submission-form .form-group.half {
          grid-column: span 1;
        }

        .submission-form label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .submission-form .form-input {
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          transition: all 0.2s ease;
          background: #fff;
        }

        .submission-form .form-input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .submission-form .form-input.textarea {
          resize: vertical;
          min-height: 80px;
        }

        .selected-business {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          color: #166534;
          font-weight: 600;
          font-size: 14px;
        }

        .selected-business .verified-check {
          color: #16a34a;
        }

        .submission-notice {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #fef3c7;
          border: 1px solid #fde68a;
          border-radius: 12px;
          margin-top: 20px;
        }

        .submission-notice svg {
          color: #d97706;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .submission-notice p {
          font-size: 13px;
          color: #92400e;
          margin: 0;
          line-height: 1.5;
        }

        .submission-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-back {
          flex: 1;
          padding: 14px 20px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-back:hover {
          background: #e5e7eb;
        }

        .btn-submit {
          flex: 2;
          padding: 14px 20px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(37,99,235,0.3);
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.4);
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Success State */
        .submission-success {
          padding: 48px 28px;
          text-align: center;
        }

        .success-animation {
          margin-bottom: 24px;
        }

        .success-circle {
          width: 88px;
          height: 88px;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          margin: 0 auto;
          animation: successPop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes successPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .submission-success h2 {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 12px 0;
        }

        .submission-success > p {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 28px 0;
          line-height: 1.6;
        }

        .success-details {
          background: #f9fafb;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          text-align: left;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          font-size: 13px;
          color: #6b7280;
        }

        .detail-row .value {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
        }

        .btn-done {
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-done:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(37,99,235,0.3);
        }

        /* Profile Menu Highlight */
        .profile-menu-item.highlight {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
          border-radius: 8px;
          margin: 0 -8px;
          padding-left: 16px;
          padding-right: 16px;
        }

        .profile-menu-item.admin {
          color: #7c3aed;
        }

        .menu-badge.admin {
          background: #dc2626;
        }

        /* ========== ADMIN PANEL MODAL ========== */
        .admin-modal {
          background: #ffffff;
          border-radius: 24px;
          max-width: 640px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }

        .admin-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.95);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          cursor: pointer;
          z-index: 20;
        }

        .admin-header {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          padding: 32px 28px;
        }

        .admin-header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .admin-icon-wrapper {
          width: 56px;
          height: 56px;
          background: rgba(255,255,255,0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .admin-header h1 {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .admin-header p {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          margin: 0;
        }

        .admin-content {
          flex: 1;
          overflow-y: auto;
        }

        .admin-tabs {
          display: flex;
          gap: 8px;
          padding: 16px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .admin-tab {
          padding: 10px 16px;
          background: #f3f4f6;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .admin-tab.active {
          background: #7c3aed;
          color: #fff;
        }

        .tab-badge {
          background: #fff;
          color: #7c3aed;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 10px;
        }

        .admin-submissions {
          padding: 20px 24px;
        }

        .admin-empty {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }

        .admin-empty svg {
          color: #10b981;
          margin-bottom: 16px;
        }

        .admin-empty h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px 0;
        }

        .admin-empty p {
          font-size: 14px;
          margin: 0;
        }

        .admin-submission-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 12px;
        }

        .submission-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .submission-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .submission-type-badge.event {
          background: #ede9fe;
          color: #6d28d9;
        }

        .submission-type-badge.class {
          background: #d1fae5;
          color: #047857;
        }

        .submission-type-badge.deal {
          background: #fee2e2;
          color: #dc2626;
        }

        .submission-time {
          font-size: 12px;
          color: #9ca3af;
        }

        .admin-submission-card h4 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px 0;
        }

        .submission-business {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #374151;
          margin: 0 0 8px 0;
        }

        .verified-mini {
          color: #10b981;
        }

        .submission-desc {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .submission-meta {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .admin-actions {
          display: flex;
          gap: 10px;
        }

        .admin-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .admin-btn.approve {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: #fff;
        }

        .admin-btn.approve:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(5,150,105,0.3);
        }

        .admin-btn.reject {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .admin-btn.reject:hover {
          background: #fee2e2;
        }

        /* Mobile Submission Modal */
        @media (max-width: 600px) {
          .submission-modal-overlay,
          .admin-modal-overlay {
            padding: 0;
            align-items: flex-end;
          }

          .submission-modal,
          .admin-modal {
            max-width: 100%;
            border-radius: 24px 24px 0 0;
            max-height: 92vh;
            animation: modalSlideUpMobile 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          }

          .submission-modal::before,
          .admin-modal::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            z-index: 25;
          }

          .submission-close,
          .admin-close {
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
            background: rgba(0,0,0,0.3);
            color: #fff;
          }

          .submission-header,
          .admin-header {
            padding: 28px 20px 24px;
            padding-top: 36px;
          }

          .submission-header h1,
          .admin-header h1 {
            font-size: 20px;
          }

          .submission-icon-wrapper,
          .admin-icon-wrapper {
            width: 48px;
            height: 48px;
          }

          .submission-content {
            padding: 20px;
          }

          .type-selection-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .type-card {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            text-align: left;
          }

          .type-card-icon {
            width: 48px;
            height: 48px;
            margin: 0;
            flex-shrink: 0;
          }

          .type-card-icon svg {
            width: 24px;
            height: 24px;
          }

          .submission-form {
            grid-template-columns: 1fr;
          }

          .submission-form .form-group.full,
          .submission-form .form-group.half {
            grid-column: span 1;
          }

          .submission-actions {
            flex-direction: column;
          }

          .btn-back, .btn-submit {
            flex: none;
            width: 100%;
          }

          .btn-submit {
            order: -1;
          }

          .admin-tabs {
            padding: 12px 16px;
            overflow-x: auto;
          }

          .admin-submissions {
            padding: 16px;
          }

          .admin-submission-card {
            padding: 16px;
          }

          .admin-actions {
            flex-direction: column;
          }
        }

        /* ========== BUSINESS SELECTOR ========== */
        .business-selector {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .business-selector-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .selector-label {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding-left: 4px;
        }

        .business-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          width: 100%;
        }

        .business-option:hover {
          border-color: #2563eb;
          background: #fff;
        }

        .business-option.selected {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .business-option-avatar {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          flex-shrink: 0;
        }

        .business-option-avatar.new {
          background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
          color: #059669;
        }

        .business-option-avatar.individual {
          background: linear-gradient(135deg, #fae8ff 0%, #f5d0fe 100%);
          color: #a855f7;
        }

        .business-option-info {
          flex: 1;
          min-width: 0;
        }

        .business-option-name {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
        }

        .business-option-address {
          display: block;
          font-size: 12px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .business-option-verified {
          width: 20px;
          height: 20px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .option-check {
          width: 28px;
          height: 28px;
          background: #2563eb;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        /* ========== IMAGE UPLOAD ========== */
        .image-upload-grid {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 16px;
        }

        .image-upload-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .image-upload-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #6b7280;
        }

        .image-ratio {
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #9ca3af;
        }

        .image-upload-area {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .image-upload-area:hover {
          border-color: #2563eb;
          background: #eff6ff;
        }

        .image-upload-area.square {
          aspect-ratio: 1;
        }

        .image-upload-area.banner {
          aspect-ratio: 3/1;
          min-height: 80px;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: #9ca3af;
        }

        .upload-placeholder span {
          font-size: 12px;
          font-weight: 500;
        }

        .image-preview {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #e5e7eb;
        }

        .image-preview.square {
          aspect-ratio: 1;
        }

        .image-preview.banner {
          aspect-ratio: 3/1;
        }

        .image-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .remove-image-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 28px;
          height: 28px;
          background: rgba(0,0,0,0.6);
          border: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .remove-image-btn:hover {
          background: #dc2626;
        }

        /* ========== IMAGE CROPPER ========== */
        .cropper-overlay,
        .cropper-overlay-global {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }

        .cropper-overlay-global {
          z-index: 3000;
        }

        .cropper-modal {
          background: #fff;
          border-radius: 20px;
          max-width: 450px;
          width: 100%;
          overflow: hidden;
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cropper-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .cropper-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .cropper-ratio {
          background: #dbeafe;
          color: #1d4ed8;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .cropper-content {
          padding: 24px;
          background: #f9fafb;
        }

        .cropper-container {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .cropper-frame {
          position: relative;
          background: #000;
          overflow: hidden;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          cursor: grab;
        }

        .cropper-frame:active {
          cursor: grabbing;
        }

        .cropper-frame.square {
          aspect-ratio: 1;
        }

        .cropper-frame.square.profileAvatar {
          border-radius: 50%;
        }

        .cropper-frame.square.profileAvatar .cropper-grid-overlay {
          border-radius: 50%;
        }

        .cropper-frame.banner {
          aspect-ratio: 3/1;
        }

        .cropper-image {
          position: absolute;
          top: 50%;
          left: 50%;
          max-width: none;
          min-width: 100%;
          min-height: 100%;
          object-fit: cover;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
          will-change: transform;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
        }

        .cropper-grid-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          border: 2px solid rgba(255,255,255,0.8);
          border-radius: 12px;
        }

        .cropper-grid-overlay .grid-h-1,
        .cropper-grid-overlay .grid-h-2 {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(255,255,255,0.4);
        }

        .cropper-grid-overlay .grid-h-1 { top: 33.33%; }
        .cropper-grid-overlay .grid-h-2 { top: 66.66%; }

        .cropper-grid-overlay .grid-v-1,
        .cropper-grid-overlay .grid-v-2 {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(255,255,255,0.4);
        }

        .cropper-grid-overlay .grid-v-1 { left: 33.33%; }
        .cropper-grid-overlay .grid-v-2 { left: 66.66%; }

        .cropper-hint {
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 16px 0;
        }

        .cropper-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          padding: 12px 14px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .cropper-controls.smooth-zoom {
          background: #f9fafb;
          padding: 16px 20px;
          border-radius: 16px;
          gap: 12px;
        }

        .zoom-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: #f3f4f6;
          color: #374151;
          font-size: 20px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .smooth-zoom .zoom-btn {
          width: 40px;
          height: 40px;
          background: #fff;
          border: 1px solid #e5e7eb;
          font-size: 22px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }

        .zoom-btn:hover {
          background: #e5e7eb;
        }

        .smooth-zoom .zoom-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .zoom-btn:active {
          background: #d1d5db;
          transform: scale(0.95);
        }

        .zoom-slider {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          background: transparent;
          border-radius: 3px;
          outline: none;
          cursor: pointer;
          margin: 0 8px;
          touch-action: none;
        }

        .smooth-zoom .zoom-slider {
          height: 8px;
        }

        .zoom-slider::-webkit-slider-runnable-track {
          height: 6px;
          background: linear-gradient(to right, #e0e7ff 0%, #6366f1 50%, #e0e7ff 100%);
          border-radius: 3px;
        }

        .smooth-zoom .zoom-slider::-webkit-slider-runnable-track {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
        }

        .zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 32px;
          height: 32px;
          background: #fff;
          border: 2px solid #6366f1;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 10px rgba(99,102,241,0.35);
          margin-top: -13px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .smooth-zoom .zoom-slider::-webkit-slider-thumb {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: 3px solid #fff;
          box-shadow: 0 2px 12px rgba(102, 126, 234, 0.5);
          margin-top: -8px;
        }

        .smooth-zoom .zoom-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.6);
        }

        .zoom-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          background: #f5f5ff;
        }

        .smooth-zoom .zoom-slider::-webkit-slider-thumb:active {
          transform: scale(1.1);
          background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
        }

        .zoom-slider::-moz-range-track {
          height: 6px;
          background: linear-gradient(to right, #e0e7ff 0%, #6366f1 50%, #e0e7ff 100%);
          border-radius: 3px;
        }

        .smooth-zoom .zoom-slider::-moz-range-track {
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
        }

        .zoom-slider::-moz-range-thumb {
          width: 32px;
          height: 32px;
          background: #fff;
          border: 2px solid #6366f1;
          border-radius: 50%;
          cursor: grab;
          box-shadow: 0 2px 10px rgba(99,102,241,0.35);
        }

        .smooth-zoom .zoom-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: 3px solid #fff;
          box-shadow: 0 2px 12px rgba(102, 126, 234, 0.5);
        }

        .zoom-slider::-moz-range-thumb:active {
          cursor: grabbing;
        }

        .cropper-actions {
          display: flex;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }

        .cropper-btn {
          flex: 1;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .cropper-btn.cancel {
          background: #f3f4f6;
          color: #374151;
        }

        .cropper-btn.cancel:hover {
          background: #e5e7eb;
        }

        .cropper-btn.apply {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
        }

        .cropper-btn.apply:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }

        .cropper-actions {
          display: flex;
          gap: 12px;
          padding: 20px 24px;
          border-top: 1px solid #e5e7eb;
        }

        .cropper-btn {
          flex: 1;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .cropper-btn.cancel {
          background: #f3f4f6;
          color: #374151;
        }

        .cropper-btn.cancel:hover {
          background: #e5e7eb;
        }

        .cropper-btn.apply {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
        }

        .cropper-btn.apply:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }

        /* No Businesses Notice */
        .no-businesses-notice {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border: 1px dashed #d1d5db;
          border-radius: 12px;
          color: #6b7280;
        }

        .no-businesses-notice svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .no-businesses-notice span {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }

        .no-businesses-notice p {
          font-size: 12px;
          color: #9ca3af;
          margin: 4px 0 0 0;
        }

        /* Mobile Image Upload */
        @media (max-width: 600px) {
          .image-upload-grid {
            grid-template-columns: 1fr;
          }

          .image-upload-area.square {
            max-width: 150px;
          }

          .image-preview.square {
            max-width: 150px;
          }

          .cropper-modal {
            max-width: 100%;
            margin: 0 16px;
          }
        }

        /* ========== PREMIUM PROFILE MODAL ========== */
        .profile-modal-overlay {
          z-index: 1500;
        }

        .profile-modal {
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          background: #fff;
          border-radius: 28px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow:
            0 24px 80px rgba(0,0,0,0.25),
            0 8px 32px rgba(0,0,0,0.12),
            0 0 0 1px rgba(0,0,0,0.05);
        }

        .profile-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 10;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(8px);
          border-radius: 50%;
          width: 36px;
          height: 36px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transition: all 0.2s ease;
        }

        .profile-close:hover {
          background: #fff;
          transform: scale(1.05);
        }

        /* Profile Hero - Premium Centered Design */
        .profile-hero {
          position: relative;
          flex-shrink: 0;
          background: #fff;
        }

        .profile-cover {
          height: 120px;
          background-size: cover;
          background-position: center;
          position: relative;
        }

        .cover-edit-btn {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0,0,0,0.08);
          color: #374151;
          padding: 10px 16px;
          border-radius: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
          box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        }

        /* When there's a cover photo, hide by default and show on hover */
        .profile-cover:not(.no-photo) .cover-edit-btn {
          opacity: 0;
          background: rgba(0,0,0,0.7);
          color: #fff;
          border-color: transparent;
        }

        .profile-cover:not(.no-photo):hover .cover-edit-btn {
          opacity: 1;
        }

        /* When no photo, always show with light style */
        .profile-cover.no-photo .cover-edit-btn {
          opacity: 1;
        }

        .cover-edit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }

        .profile-cover.no-photo .cover-edit-btn:hover {
          background: #fff;
        }

        .profile-cover:not(.no-photo) .cover-edit-btn:hover {
          background: rgba(0,0,0,0.85);
        }

        .cover-edit-btn svg {
          flex-shrink: 0;
        }

        .cover-edit-btn span {
          letter-spacing: 0.1px;
          white-space: nowrap;
        }

        .profile-hero-body {
          padding: 0 32px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .profile-avatar-wrapper {
          margin-top: -52px;
          margin-bottom: 16px;
          display: flex;
          justify-content: center;
        }

        .profile-avatar-large {
          width: 104px;
          height: 104px;
          min-width: 104px;
          min-height: 104px;
          background: linear-gradient(145deg, #667eea 0%, #764ba2 50%, #9f7aea 100%);
          border-radius: 50%;
          border: 4px solid #fff;
          box-shadow:
            0 4px 24px rgba(102, 126, 234, 0.3),
            0 8px 32px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          font-weight: 600;
          color: #fff;
          position: relative;
          letter-spacing: -1px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          overflow: visible;
        }

        .profile-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }

        .avatar-edit-btn {
          position: absolute !important;
          bottom: 0 !important;
          right: 0 !important;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          border: 3px solid #fff !important;
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          min-height: 34px !important;
          border-radius: 50% !important;
          cursor: pointer;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 2px 12px rgba(102, 126, 234, 0.5);
          color: #fff !important;
          transition: all 0.2s ease;
          padding: 0 !important;
          margin: 0 !important;
          flex-shrink: 0 !important;
        }

        .avatar-edit-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.6);
        }

        .avatar-edit-btn svg {
          width: 16px !important;
          height: 16px !important;
          flex-shrink: 0;
        }

        .profile-hero-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          width: 100%;
        }

        .profile-hero-info {
          text-align: center;
        }

        .profile-hero-info h1 {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
          line-height: 1.2;
          letter-spacing: -0.5px;
        }

        .profile-location {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 4px;
          font-weight: 500;
        }

        .profile-location svg {
          color: #9ca3af;
        }

        .profile-member-since {
          font-size: 13px;
          color: #9ca3af;
          margin: 0;
          font-weight: 400;
        }

        .profile-hero-stats {
          display: flex;
          gap: 32px;
          padding: 16px 24px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-radius: 16px;
          border: 1px solid #e2e8f0;
        }

        .hero-stat {
          text-align: center;
          min-width: 60px;
        }

        .hero-stat .stat-number {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.2;
          letter-spacing: -0.5px;
        }

        .hero-stat .stat-label {
          font-size: 11px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
          margin-top: 2px;
          display: block;
        }

        /* Profile Tabs */
        .profile-tabs {
          display: flex;
          gap: 0;
          padding: 0 16px;
          border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
          scrollbar-width: none;
          background: #fff;
          flex-shrink: 0;
        }

        .profile-tabs::-webkit-scrollbar {
          display: none;
        }

        .profile-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 14px 16px;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          white-space: nowrap;
          position: relative;
          transition: all 0.2s ease;
        }

        .profile-tab:hover {
          color: #374151;
        }

        .profile-tab.active {
          color: #2563eb;
        }

        .profile-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #2563eb;
          border-radius: 2px 2px 0 0;
        }

        /* Tab Content */
        .profile-tab-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: #fafbfc;
        }

        .profile-overview,
        .profile-activity,
        .profile-saved,
        .profile-businesses,
        .profile-settings {
          padding-top: 0;
        }

        /* Level Card - Gamification */
        .level-card {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 32px;
          color: #fff;
        }

        .level-card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .level-badge {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(251, 191, 36, 0.4);
        }

        .level-number {
          font-size: 24px;
          font-weight: 800;
          color: #1e1b4b;
          line-height: 1;
        }

        .level-label {
          font-size: 8px;
          font-weight: 700;
          color: #1e1b4b;
          letter-spacing: 1px;
        }

        .level-info {
          flex: 1;
        }

        .level-info h3 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px;
          color: #fff;
        }

        .level-info p {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          margin: 0;
        }

        .total-xp {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.15);
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
        }

        .total-xp svg {
          color: #fbbf24;
        }

        .xp-progress-bar {
          height: 10px;
          background: rgba(255,255,255,0.2);
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 20px;
        }

        .xp-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%);
          border-radius: 5px;
          transition: width 0.5s ease;
        }

        .level-card-footer {
          display: flex;
          justify-content: space-around;
          gap: 12px;
        }

        .streak-box, .rank-box, .hero-score-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.1);
          padding: 12px 16px;
          border-radius: 12px;
          flex: 1;
        }

        .streak-icon { color: #fb923c; }
        .rank-icon { color: #34d399; }
        .hero-icon { color: #f472b6; }

        .streak-info, .rank-info, .hero-info {
          display: flex;
          flex-direction: column;
        }

        .streak-number, .rank-number, .hero-number {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.2;
        }

        .streak-label, .rank-label, .hero-label {
          font-size: 10px;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Profile Sections */
        .profile-section {
          margin-bottom: 36px;
        }

        .profile-section:last-child {
          margin-bottom: 0;
        }

        .profile-section h3 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 18px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .section-header h3 {
          margin: 0;
        }

        .badge-count {
          font-size: 12px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 10px;
          border-radius: 12px;
        }

        .see-all-btn {
          background: none;
          border: none;
          color: #2563eb;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .profile-bio {
          font-size: 15px;
          color: #4b5563;
          line-height: 1.7;
          margin: 0 0 20px;
        }

        .profile-interests {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .interest-tag {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .interest-tag:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(37,99,235,0.2);
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .stat-card {
          background: #f9fafb;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .stat-card-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .stat-card.purple .stat-card-icon { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .stat-card.green .stat-card-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .stat-card.orange .stat-card-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .stat-card.blue .stat-card-icon { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .stat-card.pink .stat-card-icon { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); }
        .stat-card.teal .stat-card-icon { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); }

        .stat-card-content {
          min-width: 0;
        }

        .stat-card-number {
          display: block;
          font-size: 22px;
          font-weight: 700;
          color: #111827;
        }

        .stat-card-label {
          font-size: 11px;
          color: #6b7280;
        }

        /* Achievements Grid */
        .achievements-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .achievement-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
          position: relative;
          transition: all 0.2s ease;
        }

        .achievement-card:hover {
          border-color: #d1d5db;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transform: translateY(-2px);
        }

        .achievement-card.locked {
          opacity: 0.6;
        }

        .achievement-card.locked:hover {
          transform: none;
        }

        .achievement-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .achievement-card.locked .achievement-icon {
          color: #9ca3af;
        }

        .achievement-info {
          flex: 1;
          min-width: 0;
        }

        .achievement-name {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 2px;
        }

        .achievement-desc {
          display: block;
          font-size: 11px;
          color: #6b7280;
        }

        .achievement-date {
          display: block;
          font-size: 10px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .achievement-xp {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          color: #f59e0b;
          background: #fef3c7;
          padding: 2px 8px;
          border-radius: 6px;
          margin-top: 6px;
        }

        .achievement-progress {
          margin-top: 8px;
        }

        .progress-bar {
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 10px;
          color: #9ca3af;
        }

        .achievement-check {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 22px;
          height: 22px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        /* Activity Items */
        .activity-preview {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9fafb;
          border-radius: 12px;
        }

        .activity-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .activity-icon.event { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .activity-icon.deal { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .activity-icon.class { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .activity-icon.review { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .activity-icon.checkin { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); }

        .activity-content {
          flex: 1;
          min-width: 0;
        }

        .activity-action {
          display: block;
          font-size: 13px;
          color: #374151;
        }

        .activity-action strong {
          color: #111827;
        }

        .activity-business {
          display: block;
          font-size: 11px;
          color: #9ca3af;
        }

        .activity-date {
          font-size: 11px;
          color: #9ca3af;
          white-space: nowrap;
        }

        /* Activity Tab Full */
        .activity-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .activity-filter {
          padding: 8px 16px;
          background: #f3f4f6;
          border: none;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .activity-filter.active {
          background: #2563eb;
          color: #fff;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item-full {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
        }

        .activity-icon-large {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .activity-icon-large.event { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .activity-icon-large.deal { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .activity-icon-large.class { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .activity-icon-large.review { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .activity-icon-large.checkin { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); }

        .activity-content-full {
          flex: 1;
          min-width: 0;
        }

        .activity-type-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 2px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
        }

        .activity-content-full h4 {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px;
        }

        .activity-content-full p {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #6b7280;
          margin: 0;
        }

        .activity-date-full {
          font-size: 12px;
          color: #9ca3af;
          white-space: nowrap;
        }

        /* Saved Tab */
        .saved-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
        }

        .saved-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: #f3f4f6;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }

        .saved-tab.active {
          background: #2563eb;
          color: #fff;
        }

        .saved-count {
          background: rgba(0,0,0,0.1);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        }

        .saved-tab.active .saved-count {
          background: rgba(255,255,255,0.2);
        }

        .saved-items-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .saved-item-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          overflow: hidden;
          position: relative;
        }

        .saved-item-image {
          height: 100px;
          position: relative;
        }

        .saved-item-date {
          position: absolute;
          top: 8px;
          left: 8px;
          background: rgba(0,0,0,0.6);
          color: #fff;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        .saved-item-content {
          padding: 12px;
        }

        .saved-item-content h4 {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 6px;
        }

        .saved-item-content p {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 4px;
        }

        .saved-item-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #9ca3af;
        }

        .saved-item-remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          background: rgba(0,0,0,0.6);
          border: none;
          border-radius: 50%;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .saved-item-card:hover .saved-item-remove {
          opacity: 1;
        }

        /* My Businesses Tab */
        .no-businesses {
          text-align: center;
          padding: 60px 20px;
        }

        .no-businesses-icon {
          width: 100px;
          height: 100px;
          background: #f3f4f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          margin: 0 auto 24px;
        }

        .no-businesses h3 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .no-businesses p {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 24px;
          max-width: 300px;
          margin-left: auto;
          margin-right: auto;
        }

        .claim-business-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .business-manage-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .business-manage-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .business-manage-avatar {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
        }

        .business-manage-info h4 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px;
        }

        .business-manage-info p {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 6px;
        }

        .verified-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #d1fae5;
          color: #059669;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .business-manage-stats {
          display: flex;
          gap: 24px;
          padding: 16px 0;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 16px;
        }

        .biz-stat {
          text-align: center;
        }

        .biz-stat-num {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }

        .biz-stat-label {
          font-size: 11px;
          color: #6b7280;
        }

        .business-manage-actions {
          display: flex;
          gap: 8px;
        }

        .biz-action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 16px;
          background: #f3f4f6;
          border: none;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .biz-action-btn:hover {
          background: #e5e7eb;
        }

        .add-another-business {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: none;
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          color: #6b7280;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .add-another-business:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        /* Benefits Preview */
        .biz-benefits-preview {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin: 24px 0;
          text-align: left;
        }

        .benefit-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #f9fafb;
          border-radius: 12px;
          font-size: 13px;
          color: #374151;
        }

        .benefit-item svg {
          color: #2563eb;
          flex-shrink: 0;
        }

        .claim-subtext {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 12px;
        }

        /* Business Score Card */
        .biz-score-card {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 28px;
          color: #fff;
        }

        .biz-score-header {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 24px;
        }

        .biz-score-ring {
          position: relative;
          width: 100px;
          height: 100px;
          flex-shrink: 0;
        }

        .biz-score-ring svg {
          width: 100%;
          height: 100%;
        }

        .biz-score-value {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .score-num {
          display: block;
          font-size: 28px;
          font-weight: 800;
          line-height: 1;
        }

        .score-label {
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 1px;
          opacity: 0.7;
        }

        .biz-score-info {
          flex: 1;
        }

        .biz-score-info h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 6px;
          color: #fff;
        }

        .biz-score-info p {
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          margin: 0 0 10px;
        }

        .score-trend {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .biz-score-breakdown {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .score-factor {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .factor-label {
          font-size: 12px;
          width: 130px;
          color: rgba(255,255,255,0.8);
        }

        .factor-bar {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
          overflow: hidden;
        }

        .factor-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .factor-value {
          font-size: 13px;
          font-weight: 700;
          width: 30px;
          text-align: right;
        }

        /* Business Metrics */
        .biz-metrics-section {
          margin-bottom: 28px;
        }

        .biz-metrics-section h3 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px;
        }

        .biz-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .biz-metric-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .metric-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .metric-icon.blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
        .metric-icon.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .metric-icon.purple { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
        .metric-icon.orange { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .metric-icon.teal { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); }
        .metric-icon.pink { background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); }

        .metric-data {
          flex: 1;
        }

        .metric-value {
          display: block;
          font-size: 26px;
          font-weight: 800;
          color: #111827;
          line-height: 1.1;
        }

        .metric-label {
          font-size: 12px;
          color: #6b7280;
        }

        .metric-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .metric-trend.up {
          color: #10b981;
        }

        .metric-trend.down {
          color: #ef4444;
        }

        .metric-trend.neutral {
          color: #9ca3af;
        }

        /* Business Goals */
        .biz-goals-section {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 28px;
        }

        .biz-goals-section .section-header {
          margin-bottom: 20px;
        }

        .goals-reward {
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
          background: #fef3c7;
          padding: 4px 12px;
          border-radius: 20px;
        }

        .biz-goals-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .biz-goal {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 14px;
          transition: all 0.2s ease;
        }

        .biz-goal.completed {
          background: #ecfdf5;
        }

        .biz-goal.in-progress {
          background: #eff6ff;
        }

        .goal-check {
          width: 32px;
          height: 32px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }

        .goal-progress {
          width: 32px;
          height: 32px;
          background: #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .goal-empty {
          width: 32px;
          height: 32px;
          background: #e5e7eb;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .goal-info {
          flex: 1;
          min-width: 0;
        }

        .goal-title {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 4px;
        }

        .goal-progress-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .goal-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 3px;
        }

        .goal-xp {
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
          white-space: nowrap;
        }

        .biz-goal.completed .goal-xp {
          color: #10b981;
          text-decoration: line-through;
          opacity: 0.6;
        }

        /* Business Badges */
        .biz-achievements-section {
          margin-bottom: 28px;
        }

        .biz-badges-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .biz-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 14px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          min-width: 90px;
          transition: all 0.2s ease;
        }

        .biz-badge:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        .biz-badge .badge-icon {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
        }

        .biz-badge.locked .badge-icon {
          background: #e5e7eb;
          color: #9ca3af;
        }

        .biz-badge.locked {
          opacity: 0.6;
        }

        .biz-badge span {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-align: center;
        }

        /* Business Insights */
        .biz-insights-section {
          margin-bottom: 28px;
        }

        .biz-insights-section h3 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px;
        }

        .insights-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .insight-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 18px;
        }

        .insight-card.hot {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #fbbf24;
        }

        .insight-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: #f3f4f6;
          padding: 4px 10px;
          border-radius: 6px;
          margin-bottom: 10px;
        }

        .insight-card.hot .insight-badge {
          background: #f59e0b;
          color: #fff;
        }

        .insight-card p {
          font-size: 14px;
          color: #374151;
          margin: 0 0 14px;
          line-height: 1.5;
        }

        .insight-card p strong {
          color: #111827;
        }

        .insight-action {
          background: #111827;
          color: #fff;
          border: none;
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .insight-action:hover {
          background: #374151;
        }

        .insight-card.hot .insight-action {
          background: #f59e0b;
        }

        .insight-card.hot .insight-action:hover {
          background: #d97706;
        }

        /* Quick Actions */
        .biz-quick-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .quick-action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 16px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .quick-action-btn:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .quick-action-btn.primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #fff;
        }

        .quick-action-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }

        /* Settings Tab */
        .settings-section {
          margin-bottom: 32px;
        }

        .settings-section h3 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }

        .settings-desc {
          font-size: 13px;
          color: #6b7280;
          margin: 0 0 16px;
        }

        .settings-group {
          background: #f9fafb;
          border-radius: 16px;
          overflow: hidden;
        }

        .setting-item {
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .setting-item:last-child {
          border-bottom: none;
        }

        .setting-info label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }

        .setting-info input,
        .setting-info textarea {
          width: 100%;
          padding: 10px 14px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          color: #111827;
          transition: all 0.2s ease;
          position: relative;
          z-index: 100;
          pointer-events: auto !important;
          -webkit-user-select: text;
          user-select: text;
        }

        .setting-info input:focus,
        .setting-info textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }

        .setting-info textarea {
          resize: vertical;
          min-height: 80px;
        }

        .setting-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .setting-toggle:last-child {
          border-bottom: none;
        }

        .setting-toggle-info {
          flex: 1;
        }

        .setting-toggle-label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
        }

        .setting-toggle-desc {
          font-size: 12px;
          color: #6b7280;
        }

        .toggle-switch {
          position: relative;
          width: 50px;
          height: 28px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #e5e7eb;
          transition: 0.3s;
          border-radius: 28px;
        }

        .toggle-slider::before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }

        .toggle-switch input:checked + .toggle-slider {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        }

        .toggle-switch input:checked + .toggle-slider::before {
          transform: translateX(22px);
        }

        /* Interests Grid */
        .interests-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .interest-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          background: #f3f4f6;
          border: 2px solid transparent;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .interest-btn:hover {
          border-color: #d1d5db;
        }

        .interest-btn.selected {
          background: #eff6ff;
          border-color: #2563eb;
          color: #1d4ed8;
        }

        /* Danger Zone */
        .settings-section.danger h3 {
          color: #dc2626;
        }

        .danger-actions {
          display: flex;
          gap: 12px;
        }

        .danger-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          color: #dc2626;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .danger-btn:hover {
          background: #fee2e2;
        }

        /* Mobile Profile */
        @media (max-width: 600px) {
          .profile-modal {
            max-height: 100vh;
            border-radius: 0;
          }

          .profile-hero-body {
            text-align: center;
          }

          .profile-avatar-wrapper {
            display: flex;
            justify-content: center;
          }

          .profile-hero-details {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 16px;
          }

          .profile-hero-info {
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .profile-location {
            justify-content: center;
          }

          .profile-hero-stats {
            justify-content: center;
          }

          .profile-tabs {
            padding: 0 12px;
          }

          .profile-tab span {
            display: none;
          }

          .profile-tab {
            padding: 14px 12px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .achievements-grid {
            grid-template-columns: 1fr;
          }

          .saved-items-grid {
            grid-template-columns: 1fr;
          }

          .business-manage-actions {
            flex-direction: column;
          }

          .interests-grid {
            justify-content: center;
          }

          .biz-metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .biz-score-header {
            flex-direction: column;
            text-align: center;
          }

          .biz-quick-actions {
            flex-wrap: wrap;
          }

          .quick-action-btn {
            flex: 1 1 45%;
          }

          .level-card-footer {
            flex-wrap: wrap;
          }

          .streak-box, .rank-box, .hero-score-box {
            flex: 1 1 45%;
          }

          .benefit-item {
            font-size: 12px;
          }
        }

        /* ========== PREMIUM MY CALENDAR MODAL ========== */
        .calendar-modal {
          background: #ffffff;
          border-radius: 24px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow: hidden;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.1);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
        }

        .calendar-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 20;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .calendar-header {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
          padding: 32px 28px;
          position: relative;
          overflow: hidden;
        }

        .calendar-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        .calendar-header-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .calendar-icon-wrapper {
          width: 56px;
          height: 56px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .calendar-header h1 {
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .calendar-header p {
          font-size: 14px;
          color: rgba(255,255,255,0.8);
          margin: 0;
        }

        .calendar-content {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* Empty State */
        .calendar-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          text-align: center;
        }

        .empty-calendar-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          margin-bottom: 20px;
        }

        .calendar-empty h3 {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px 0;
        }

        .calendar-empty p {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 24px 0;
          max-width: 280px;
        }

        .browse-events-btn {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(37,99,235,0.3);
        }

        .browse-events-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.4);
        }

        /* Calendar Events List */
        .calendar-events-list {
          padding: 20px;
        }

        .calendar-date-group {
          margin-bottom: 24px;
        }

        .calendar-date-group:last-child {
          margin-bottom: 0;
        }

        .calendar-date-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        .calendar-date-badge {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }

        .date-day {
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
        }

        .date-month {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.9;
        }

        .calendar-date-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .date-weekday {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
        }

        .date-full {
          font-size: 13px;
          color: #6b7280;
        }

        .calendar-date-events {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .calendar-event-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 14px;
          border: 1px solid #f3f4f6;
          transition: all 0.2s ease;
        }

        .calendar-event-card:hover {
          background: #fff;
          border-color: #e5e7eb;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .calendar-event-card.class {
          border-left: 4px solid #059669;
        }

        .calendar-event-card.event {
          border-left: 4px solid #7c3aed;
        }

        .calendar-event-time {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 65px;
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .time-separator {
          font-size: 10px;
          color: #9ca3af;
        }

        .calendar-event-details {
          flex: 1;
          min-width: 0;
        }

        .calendar-event-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .calendar-event-header h4 {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .calendar-event-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          flex-shrink: 0;
        }

        .calendar-event-badge.class {
          background: #d1fae5;
          color: #047857;
        }

        .calendar-event-venue {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #6b7280;
        }

        .calendar-event-actions {
          display: flex;
          gap: 8px;
        }

        .calendar-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .calendar-action-btn.google {
          background: #f3f4f6;
          color: #374151;
        }

        .calendar-action-btn.google:hover {
          background: #e5e7eb;
        }

        .calendar-action-btn.remove {
          background: #fef2f2;
          color: #dc2626;
        }

        .calendar-action-btn.remove:hover {
          background: #fee2e2;
        }

        .calendar-footer {
          padding: 16px 24px;
          border-top: 1px solid #f3f4f6;
          text-align: center;
        }

        .google-calendar-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #2563eb;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .google-calendar-link:hover {
          color: #1d4ed8;
        }

        /* Calendar Toast */
        .calendar-toast {
          position: fixed;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: #111827;
          color: #fff;
          padding: 14px 24px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          z-index: 2000;
          animation: toastSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes toastSlideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .toast-icon {
          width: 32px;
          height: 32px;
          background: rgba(37,99,235,0.2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #60a5fa;
        }

        /* Add to Calendar Button States */
        .add-calendar-btn.added {
          background: #dcfce7;
          color: #16a34a;
          border-color: #bbf7d0;
        }

        .event-cta-btn.primary.added {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          box-shadow: 0 4px 14px rgba(5,150,105,0.3);
        }

        /* Menu Badge */
        .menu-badge {
          background: #2563eb;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: auto;
        }

        /* Mobile Calendar Modal */
        @media (max-width: 600px) {
          .calendar-modal-overlay {
            padding: 0;
            align-items: flex-end;
          }

          .calendar-modal {
            max-width: 100%;
            width: 100%;
            border-radius: 24px 24px 0 0;
            max-height: 92vh;
            animation: modalSlideUpMobile 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          }

          .calendar-modal::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            z-index: 25;
          }

          .calendar-close {
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
            background: rgba(0,0,0,0.3);
            border: none;
            color: #fff;
          }

          .calendar-header {
            padding: 28px 20px 24px;
            padding-top: 36px;
          }

          .calendar-header h1 {
            font-size: 20px;
          }

          .calendar-icon-wrapper {
            width: 48px;
            height: 48px;
          }

          .calendar-events-list {
            padding: 16px;
          }

          .calendar-date-header {
            gap: 12px;
          }

          .calendar-date-badge {
            width: 46px;
            height: 46px;
            border-radius: 12px;
          }

          .date-day {
            font-size: 18px;
          }

          .calendar-event-card {
            padding: 14px;
            gap: 12px;
            flex-wrap: wrap;
          }

          .calendar-event-time {
            min-width: 55px;
            font-size: 12px;
          }

          .calendar-event-header h4 {
            font-size: 14px;
          }

          .calendar-event-actions {
            width: 100%;
            justify-content: flex-end;
            margin-top: 8px;
            padding-top: 12px;
            border-top: 1px solid #f3f4f6;
          }

          .calendar-empty {
            padding: 40px 24px;
          }

          .calendar-toast {
            bottom: 90px;
            left: 16px;
            right: 16px;
            transform: none;
            border-radius: 12px;
          }

          @keyframes toastSlideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        }

        /* ========== PREMIUM DEAL DETAIL MODAL ========== */
        .deal-detail-modal {
          background: #ffffff;
          border-radius: 24px;
          max-width: 580px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.1);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        .deal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: #f3f4f6;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 20;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .deal-close:hover {
          background: #e5e7eb;
          transform: scale(1.05);
          color: #111827;
        }

        /* Deal Hero */
        .deal-hero {
          background: linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #b91c1c 100%);
          padding: 40px 28px 32px;
          position: relative;
          overflow: hidden;
        }

        .deal-hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        .deal-hero-content {
          position: relative;
          z-index: 1;
        }

        .deal-hero-badges {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .deal-type-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(10px);
          color: #fff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid rgba(255,255,255,0.3);
        }

        .verified-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.3);
          color: #fff;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid rgba(16, 185, 129, 0.5);
        }

        .deal-hero-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
          line-height: 1.2;
          letter-spacing: -0.5px;
        }

        .deal-hero-venue {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          font-weight: 500;
        }

        /* Discount Badge */
        .deal-discount-badge {
          position: absolute;
          top: 24px;
          right: 70px;
          background: #fff;
          border-radius: 12px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          z-index: 5;
        }

        .deal-discount-badge svg {
          color: #dc2626;
        }

        .deal-discount-badge span {
          font-size: 11px;
          font-weight: 800;
          color: #dc2626;
          letter-spacing: 0.5px;
        }

        /* Schedule Card */
        .deal-schedule-card {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: -20px 20px 0;
          padding: 16px 20px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          position: relative;
          z-index: 5;
          border: 1px solid #f3f4f6;
        }

        .schedule-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #dc2626;
          flex-shrink: 0;
        }

        .schedule-content {
          flex: 1;
        }

        .schedule-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 2px;
        }

        .schedule-value {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        /* Deal Quick Actions */
        .deal-quick-actions {
          display: flex;
          justify-content: space-around;
          padding: 24px 20px 20px;
          margin-top: 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        /* Deal Sections */
        .deal-section {
          padding: 24px 28px;
          border-bottom: 1px solid #f3f4f6;
        }

        .deal-section:last-of-type {
          border-bottom: none;
        }

        .deal-section-title {
          font-size: 13px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 16px;
        }

        .deal-about-text {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        }

        /* Deal Details Grid */
        .deal-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .deal-detail-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #f3f4f6;
        }

        .deal-detail-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .deal-detail-icon.venue-icon {
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #dc2626;
        }

        .deal-detail-icon.time-icon {
          background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
          color: #ea580c;
        }

        .deal-detail-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .deal-detail-label {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .deal-detail-value {
          font-size: 14px;
          color: #111827;
          font-weight: 600;
        }

        /* Deal Terms Card */
        .deal-terms-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: #fef3c7;
          border-radius: 12px;
          border: 1px solid #fde68a;
        }

        .terms-icon {
          color: #d97706;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .deal-terms-text {
          font-size: 14px;
          line-height: 1.6;
          color: #92400e;
          margin: 0;
        }

        /* Related Deals Grid */
        .related-deals-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .related-deal-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .related-deal-card:hover {
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          border-color: #cbd5e1;
          transform: translateX(4px);
        }

        .related-deal-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        .related-deal-title {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .related-deal-discount {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-size: 11px;
          font-weight: 700;
          border-radius: 6px;
          width: fit-content;
        }

        .related-deal-schedule {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #64748b;
        }

        .related-deal-arrow {
          color: #94a3b8;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .related-deal-card:hover .related-deal-arrow {
          color: #64748b;
          transform: translateX(2px);
        }

        /* Deal CTA */
        .deal-cta-section {
          padding: 24px 28px;
          display: flex;
          gap: 12px;
        }

        .deal-cta-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }

        .deal-cta-btn.primary {
          background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(220,38,38,0.3);
        }

        .deal-cta-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(220,38,38,0.4);
        }

        .deal-cta-btn.primary:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s ease;
        }

        .deal-cta-btn.secondary {
          background: #f9fafb;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .deal-cta-btn.secondary:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .deal-cta-btn.secondary:active {
          transform: scale(0.98);
          background: #e5e7eb;
        }

        /* Deal Footer */
        .deal-modal-footer {
          padding: 16px 28px 24px;
          text-align: center;
          border-top: 1px solid #f3f4f6;
        }

        .deal-modal-footer p {
          font-size: 12px;
          color: #9ca3af;
        }

        /* Quick action share icon */
        .quick-action-icon.share {
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #4f46e5;
        }

        /* ========== PREMIUM SERVICE DETAIL MODAL ========== */
        .service-detail-modal {
          background: #ffffff;
          border-radius: 24px;
          max-width: 580px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          box-shadow: 0 25px 80px rgba(0,0,0,0.25), 0 10px 30px rgba(0,0,0,0.1);
          animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .service-close {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.1);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #374151;
          cursor: pointer;
          transition: all 0.2s ease;
          z-index: 20;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .service-close:hover {
          background: #fff;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        /* Hero Section */
        .service-hero {
          background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
          padding: 40px 28px 32px;
          position: relative;
          overflow: hidden;
        }

        .service-hero::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          opacity: 0.5;
        }

        .service-hero-content {
          position: relative;
          z-index: 1;
        }

        .service-hero-category {
          margin-bottom: 12px;
        }

        .category-pill {
          display: inline-block;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(10px);
          color: #fff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .service-hero-title {
          font-size: 28px;
          font-weight: 800;
          color: #fff;
          margin-bottom: 12px;
          line-height: 1.2;
          letter-spacing: -0.5px;
        }

        .service-hero-location {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,0.8);
          font-size: 14px;
          font-weight: 500;
        }

        /* Rating Card */
        .service-rating-card {
          position: absolute;
          bottom: -40px;
          right: 24px;
          background: #fff;
          border-radius: 16px;
          padding: 16px 20px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          text-align: center;
          min-width: 110px;
          z-index: 5;
          border: 1px solid #f3f4f6;
        }

        .rating-score {
          font-size: 36px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
          margin-bottom: 6px;
        }

        .rating-stars {
          display: flex;
          justify-content: center;
          gap: 2px;
          margin-bottom: 6px;
        }

        .rating-reviews {
          font-size: 11px;
          color: #6b7280;
          font-weight: 500;
        }

        /* Quick Actions */
        .service-quick-actions {
          display: flex;
          justify-content: space-around;
          padding: 24px 20px 20px;
          margin-top: 20px;
          border-bottom: 1px solid #f3f4f6;
        }

        .quick-action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.2s ease;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
        }

        .quick-action-btn:hover {
          transform: translateY(-2px);
        }

        .quick-action-btn.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .quick-action-btn.disabled:hover {
          transform: none;
        }

        .quick-action-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .quick-action-icon.call {
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #16a34a;
        }

        .quick-action-icon.directions {
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          color: #2563eb;
        }

        .quick-action-icon.website {
          background: linear-gradient(135deg, #fae8ff 0%, #f5d0fe 100%);
          color: #a855f7;
        }

        .quick-action-icon.save {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #d97706;
        }

        .quick-action-icon.save.saved {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #fff;
        }

        .quick-action-icon.book-class {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .quick-action-btn.book-class-highlight {
          position: relative;
        }

        .quick-action-btn.book-class-highlight span {
          color: #059669;
          font-weight: 600;
        }

        .quick-action-btn.book-class-highlight::after {
          content: '';
          position: absolute;
          top: -4px;
          right: -4px;
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          border: 2px solid #fff;
        }

        .quick-action-btn:hover .quick-action-icon {
          transform: scale(1.08);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .quick-action-btn:active .quick-action-icon {
          transform: scale(0.95);
          transition: transform 0.1s ease;
        }

        @media (hover: none) {
          .quick-action-btn:hover .quick-action-icon {
            transform: none;
            box-shadow: none;
          }
          
          .quick-action-btn:active .quick-action-icon {
            transform: scale(0.92);
            opacity: 0.8;
          }
        }

        /* Sections */
        .service-section {
          padding: 24px 28px;
          border-bottom: 1px solid #f3f4f6;
        }

        .service-section:last-of-type {
          border-bottom: none;
        }

        .service-section-title {
          font-size: 13px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 16px;
        }

        .service-about-text {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        }

        /* Details Grid */
        .service-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .detail-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #f3f4f6;
        }

        .detail-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .detail-card-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .detail-label {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .detail-value {
          font-size: 14px;
          color: #111827;
          font-weight: 600;
          word-break: break-word;
        }

        /* Rating & Community Card */
        .rating-community-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          overflow: hidden;
        }

        .rating-display {
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .rating-score {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .rating-number {
          font-size: 48px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
        }

        .rating-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rating-stars-row {
          display: flex;
          gap: 2px;
        }

        .rating-count {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
        }

        .google-reviews-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }

        .google-reviews-link:hover {
          background: #f9fafb;
          border-color: #d1d5db;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          transform: translateY(-1px);
        }

        .google-icon {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
        }

        .rating-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 0 24px;
        }

        .rate-this-business {
          padding: 24px;
          text-align: center;
        }

        .rate-prompt {
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 4px 0;
        }

        .rate-title {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 16px 0;
        }

        .rate-stars-interactive {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .rate-star-btn {
          background: none;
          border: none;
          padding: 6px;
          cursor: pointer;
          transition: transform 0.15s ease;
          border-radius: 8px;
        }

        .rate-star-btn:hover {
          transform: scale(1.15);
        }

        .rate-star-btn:active {
          transform: scale(0.95);
        }

        .rate-star-btn svg {
          transition: all 0.15s ease;
          display: block;
        }

        .rate-helper {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          min-height: 20px;
          transition: all 0.2s;
        }

        /* Trust Indicators */
        .trust-indicators {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }

        .trust-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .trust-badge.verified {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          color: #047857;
        }

        .trust-badge.popular {
          background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%);
          color: #be185d;
        }

        .trust-badge.local {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
        }

        /* CTA Section */
        .service-cta-section {
          padding: 24px 28px;
          display: flex;
          gap: 12px;
        }

        .service-cta-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }

        .service-cta-btn.primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          box-shadow: 0 4px 14px rgba(37,99,235,0.3);
        }

        .service-cta-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.4);
        }

        .service-cta-btn.primary:active {
          transform: translateY(0) scale(0.98);
          transition: transform 0.1s ease;
        }

        .service-cta-btn.secondary {
          background: #f9fafb;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .service-cta-btn.secondary:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .service-cta-btn.secondary:active {
          transform: scale(0.98);
          background: #e5e7eb;
        }

        @media (hover: none) {
          .service-cta-btn.primary:hover {
            transform: none;
            box-shadow: 0 4px 14px rgba(37,99,235,0.3);
          }
          
          .service-cta-btn.primary:active {
            transform: scale(0.98);
            opacity: 0.9;
          }
          
          .service-cta-btn.secondary:hover {
            background: #f9fafb;
            border-color: #e5e7eb;
          }
          
          .service-cta-btn.secondary:active {
            transform: scale(0.98);
            background: #e5e7eb;
          }
        }

        /* Footer */
        .service-modal-footer {
          padding: 16px 28px 24px;
          text-align: center;
          border-top: 1px solid #f3f4f6;
        }

        .service-modal-footer p {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 8px;
        }

        .report-btn {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          text-decoration: underline;
          transition: color 0.2s;
        }

        .report-btn:hover {
          color: #374151;
        }

        /* Service card clickable */
        .service-card {
          cursor: pointer;
        }

        /* ========== RESPONSIVE: EVENT & DEAL MODALS ========== */
        @media (max-width: 600px) {
          .event-modal-overlay,
          .deal-modal-overlay {
            padding: 0;
            align-items: flex-end;
          }

          .event-detail-modal,
          .deal-detail-modal {
            max-width: 100%;
            width: 100%;
            margin: 0;
            border-radius: 24px 24px 0 0;
            max-height: 92vh;
            animation: modalSlideUpMobile 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          }

          .event-detail-modal::before,
          .deal-detail-modal::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            z-index: 25;
          }

          .event-close,
          .deal-close {
            top: 12px;
            right: 12px;
            width: 32px;
            height: 32px;
            min-width: 32px;
            min-height: 32px;
            max-width: 32px;
            max-height: 32px;
          }

          .event-hero,
          .deal-hero {
            padding: 32px 20px 28px;
            padding-top: 36px;
          }

          .event-hero-title,
          .deal-hero-title {
            font-size: 22px;
            padding-right: 40px;
          }

          .event-hero-badges,
          .deal-hero-badges {
            flex-wrap: wrap;
          }

          .event-type-pill,
          .deal-type-pill,
          .recurring-pill,
          .verified-pill {
            font-size: 11px;
            padding: 5px 10px;
          }

          .deal-discount-badge {
            top: 16px;
            right: 60px;
            padding: 10px 12px;
          }

          .deal-discount-badge svg {
            width: 20px;
            height: 20px;
          }

          .deal-discount-badge span {
            font-size: 10px;
          }

          .event-datetime-card,
          .deal-schedule-card {
            margin: -16px 16px 0;
            padding: 14px 16px;
            border-radius: 14px;
          }

          .datetime-icon,
          .schedule-icon {
            width: 44px;
            height: 44px;
          }

          .datetime-icon svg,
          .schedule-icon svg {
            width: 20px;
            height: 20px;
          }

          .datetime-date {
            font-size: 15px;
          }

          .datetime-time,
          .schedule-value {
            font-size: 13px;
          }

          .add-calendar-btn {
            width: 36px;
            height: 36px;
          }

          .event-quick-actions,
          .deal-quick-actions {
            padding: 16px 12px;
            margin-top: 8px;
          }

          .event-section,
          .deal-section {
            padding: 20px 16px;
          }

          .event-section-title,
          .deal-section-title {
            font-size: 12px;
            margin-bottom: 12px;
          }

          .event-about-text,
          .deal-about-text {
            font-size: 14px;
          }

          .event-details-grid,
          .deal-details-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .event-detail-card,
          .deal-detail-card {
            padding: 12px;
          }

          .event-detail-icon,
          .deal-detail-icon {
            width: 32px;
            height: 32px;
          }

          .event-detail-icon svg,
          .deal-detail-icon svg {
            width: 16px;
            height: 16px;
          }

          .event-detail-label,
          .deal-detail-label {
            font-size: 10px;
          }

          .event-detail-value,
          .deal-detail-value {
            font-size: 13px;
          }

          .event-tags-grid {
            gap: 6px;
          }

          .event-tag-pill {
            font-size: 12px;
            padding: 6px 12px;
          }

          .deal-terms-card {
            padding: 14px;
          }

          .deal-terms-text {
            font-size: 13px;
          }

          .event-cta-section,
          .deal-cta-section {
            padding: 16px;
            flex-direction: column;
            gap: 10px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .event-cta-btn,
          .deal-cta-btn {
            padding: 16px 20px;
            font-size: 15px;
            border-radius: 14px;
          }

          .event-modal-footer,
          .deal-modal-footer {
            padding: 12px 16px 16px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .event-modal-footer p,
          .deal-modal-footer p {
            font-size: 11px;
          }
        }

        /* Small phones */
        @media (max-width: 375px) {
          .event-hero-title,
          .deal-hero-title {
            font-size: 20px;
          }

          .deal-discount-badge {
            display: none;
          }

          .datetime-icon,
          .schedule-icon {
            width: 40px;
            height: 40px;
          }
        }

        /* Responsive adjustments for service modal */
        @media (max-width: 600px) {
          .service-modal-overlay {
            padding: 0;
            align-items: flex-end;
          }

          .service-detail-modal {
            max-width: 100%;
            width: 100%;
            margin: 0;
            border-radius: 24px 24px 0 0;
            max-height: 92vh;
            animation: modalSlideUpMobile 0.35s cubic-bezier(0.32, 0.72, 0, 1);
          }

          @keyframes modalSlideUpMobile {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Drag handle indicator */
          .service-detail-modal::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            z-index: 25;
          }

          .service-close {
            top: 12px;
            right: 12px;
            width: 36px;
            height: 36px;
            background: rgba(0,0,0,0.3);
            border: none;
            color: #fff;
          }

          .service-close:hover {
            background: rgba(0,0,0,0.5);
          }

          .service-hero {
            padding: 28px 20px 24px;
            padding-top: 36px; /* Account for drag handle */
          }

          .service-hero-title {
            font-size: 22px;
            line-height: 1.25;
            padding-right: 40px; /* Space for close button */
          }

          .service-hero-location {
            font-size: 13px;
          }

          .category-pill {
            font-size: 11px;
            padding: 5px 12px;
          }

          .service-rating-card {
            position: relative;
            bottom: auto;
            right: auto;
            margin-top: 16px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            width: fit-content;
            border-radius: 12px;
          }

          .rating-score {
            font-size: 24px;
            margin-bottom: 0;
          }

          .rating-stars {
            margin-bottom: 0;
            gap: 1px;
          }

          .rating-stars svg {
            width: 14px;
            height: 14px;
          }

          .rating-reviews {
            font-size: 10px;
          }

          /* Quick actions - optimized for thumb zone */
          .service-quick-actions {
            margin-top: 0;
            padding: 16px 12px;
            gap: 4px;
            position: sticky;
            top: 0;
            background: #fff;
            z-index: 10;
            border-bottom: 1px solid #f3f4f6;
          }

          .quick-action-btn {
            padding: 8px 4px;
            font-size: 11px;
            min-width: 70px;
          }

          .quick-action-icon {
            width: 48px;
            height: 48px;
            border-radius: 16px;
          }

          .quick-action-btn span {
            font-weight: 500;
          }

          /* Sections */
          .service-section {
            padding: 20px 16px;
          }

          .service-section-title {
            font-size: 12px;
            margin-bottom: 12px;
          }

          .service-about-text {
            font-size: 14px;
            line-height: 1.6;
          }

          /* Details grid - single column on mobile */
          .service-details-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .detail-card {
            padding: 12px;
          }

          .detail-card-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }

          .detail-card-icon svg {
            width: 16px;
            height: 16px;
          }

          .detail-label {
            font-size: 10px;
          }

          .detail-value {
            font-size: 13px;
          }

          /* Rating community card - mobile */
          .rating-community-card {
            border-radius: 12px;
          }

          .rating-display {
            padding: 20px;
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .rating-score {
            width: 100%;
            justify-content: flex-start;
          }

          .rating-number {
            font-size: 40px;
          }

          .google-reviews-link {
            width: 100%;
            justify-content: center;
          }

          .rate-this-business {
            padding: 20px;
          }

          .rate-title {
            font-size: 16px;
          }

          .rate-star-btn svg {
            width: 28px;
            height: 28px;
          }

          .trust-indicators {
            margin-top: 12px;
          }

          .trust-badge {
            padding: 6px 10px;
            font-size: 11px;
          }

          /* CTA buttons - full width stacked */
          .service-cta-section {
            padding: 16px;
            flex-direction: column;
            gap: 10px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .service-cta-btn {
            padding: 16px 20px;
            font-size: 15px;
            border-radius: 14px;
          }

          .service-cta-btn.primary {
            order: 1;
          }

          .service-cta-btn.secondary {
            order: 2;
          }

          /* Footer */
          .service-modal-footer {
            padding: 12px 16px 16px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }

          .service-modal-footer p {
            font-size: 11px;
          }

          .report-btn {
            font-size: 11px;
          }
        }

        /* Small phones */
        @media (max-width: 375px) {
          .service-hero-title {
            font-size: 20px;
          }

          .quick-action-btn {
            min-width: 60px;
            font-size: 10px;
          }

          .quick-action-icon {
            width: 44px;
            height: 44px;
          }

          .rating-number {
            font-size: 36px;
          }
        }

        /* Tablet adjustments */
        @media (min-width: 601px) and (max-width: 768px) {
          .service-detail-modal {
            max-width: 540px;
          }

          .service-rating-card {
            bottom: -30px;
          }

          .service-quick-actions {
            margin-top: 10px;
          }
        }

        @media (max-width: 768px) {
          .deals-grid {
            grid-template-columns: 1fr;
            padding: 16px;
            gap: 16px;
          }
          
          .deal-card {
            padding: 20px;
          }
          
          .deal-card h3 {
            font-size: 18px;
          }
          
          .services-grid {
            grid-template-columns: 1fr;
            padding: 16px;
            gap: 16px;
          }
          
          .service-card {
            padding: 20px;
          }

          .service-social-proof {
            font-size: 12px;
            padding: 8px 8px 8px 12px;
          }

          .social-proof-arrow {
            width: 24px;
            height: 24px;
          }
        }

      `}</style>
    </div>
  );
}
