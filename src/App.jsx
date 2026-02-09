import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, CalendarPlus, MapPin, Clock, Star, Check, Bell, Search, Filter, ChevronRight, ChevronLeft, X, Plus, Edit2, Trash2, Eye, Users, DollarSign, AlertCircle, CheckCircle, XCircle, SlidersHorizontal, Building, Wrench, TrendingUp, Phone, Globe, Navigation, Mail, Share2, Ticket, Percent, Tag, Repeat, ExternalLink, Heart, Copy, Info, Gift, Sparkles, Zap, Camera, MessageCircle, Send, WifiOff } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useUserData } from './hooks/useUserData';
import { formatResponseTime } from './lib/businessAnalytics';
import WellnessBooking from './components/WellnessBooking';
import EventDetailModal from './components/modals/EventDetailModal';
import DealDetailModal from './components/modals/DealDetailModal';
import ServiceDetailModal from './components/modals/ServiceDetailModal';
import AuthModal from './components/modals/AuthModal';
import BusinessDashboard from './components/BusinessDashboard';
import AdminDashboard from './components/AdminDashboard';
import ProfileModal from './components/modals/ProfileModal';
import SubmissionModal from './components/modals/SubmissionModal';
import ClaimBusinessModal from './components/modals/ClaimBusinessModal';
import MyCalendarModal from './components/modals/MyCalendarModal';
import MessagesModal from './components/modals/MessagesModal';
import BookingSheet from './components/modals/BookingSheet';
import AdminPanelModal from './components/modals/AdminPanelModal';
import EditVenueModal from './components/modals/EditVenueModal';
import ImageCropperModal from './components/modals/ImageCropperModal';
import './styles/pulse-app.css';

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

// NOTE: expandRecurringEvents is handled in realData.js (see CLAUDE-ARCHIVE.md)

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
  const dealCardRefs = useRef([]);
  const eventCardRefs = useRef([]);
  const serviceCardRefs = useRef([]);
  const classCardRefs = useRef([]);
  const venueCardRefs = useRef([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showClaimBusinessModal, setShowClaimBusinessModal] = useState(false);
  const [claimFormData, setClaimFormData] = useState({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSearchQuery, setClaimSearchQuery] = useState('');
  const [claimSelectedBusiness, setClaimSelectedBusiness] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCalendarToast, setShowCalendarToast] = useState(false);
  const [calendarToastMessage, setCalendarToastMessage] = useState('');

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

  // Admin Business Impersonation State
  const [impersonatedBusiness, setImpersonatedBusiness] = useState(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [impersonateSearchQuery, setImpersonateSearchQuery] = useState('');
  const [previousAdminState, setPreviousAdminState] = useState(null);
  const [selectedClaimedBusinessId, setSelectedClaimedBusinessId] = useState(null);
  // Admin venue management filter state
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('');
  // Admin stats: claimed businesses count
  const [adminClaimedCount, setAdminClaimedCount] = useState(0);
  const [adminVerifiedCount, setAdminVerifiedCount] = useState(0);
  const activeBusiness = impersonatedBusiness || (selectedClaimedBusinessId ? userClaimedBusinesses.find(b => b.id === selectedClaimedBusinessId) : null) || (userClaimedBusinesses.length > 0 ? userClaimedBusinesses[0] : null);
  const isImpersonating = !!impersonatedBusiness;

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState('overview'); // overview, activity, saved, businesses, settings
  const [activityFilter, setActivityFilter] = useState('all');
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
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Cache timestamps to prevent duplicate API requests within 30s
  const fetchTimestamps = useRef({ services: 0, events: 0, deals: 0 });
  const CACHE_TTL = 30000; // 30 seconds

  // Fetch services from Supabase - extracted to be reusable
  const fetchServices = async (force = false) => {
    const now = Date.now();
    if (!force && now - fetchTimestamps.current.services < CACHE_TTL && services.length > 0) return;
    fetchTimestamps.current.services = now;

    setServicesLoading(true);
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, category, address, google_rating, google_reviews, phone, website, email, logo_url')
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
      email: business.email || '',
      logo_url: business.logo_url || null
    }));

    setServices(mappedServices);
    setServicesLoading(false);
  };

  // Fetch services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  // Refresh data when tab becomes visible (catches admin edits, external changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchServices();
        setEventsRefreshKey(k => k + 1);
        setDealsRefreshKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch admin stats (claimed/verified business counts) when admin panel is shown
  useEffect(() => {
    if (!user?.isAdmin) return;
    const fetchAdminStats = async () => {
      try {
        // Count all claims (each unique business_id with a claim)
        const { data: claimsData, error: claimsError } = await supabase
          .from('business_claims')
          .select('business_id, status');
        if (!claimsError && claimsData) {
          // Count unique claimed business IDs
          const uniqueClaimed = new Set(claimsData.map(c => c.business_id).filter(Boolean));
          setAdminClaimedCount(uniqueClaimed.size);
          // Count verified claims
          const uniqueVerified = new Set(claimsData.filter(c => c.status === 'verified').map(c => c.business_id).filter(Boolean));
          setAdminVerifiedCount(uniqueVerified.size);
        }
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      }
    };
    fetchAdminStats();
  }, [user?.isAdmin]);

  // Browser history management for tab navigation
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const validSections = ['classes', 'events', 'deals', 'services', 'wellness'];
    if (validSections.includes(hash)) {
      setCurrentSection(hash);
    } else {
      window.history.replaceState({ section: 'classes' }, '', '#classes');
    }
    const handlePopState = (e) => {
      const section = e.state?.section || window.location.hash.replace('#', '') || 'classes';
      if (validSections.includes(section)) {
        setCurrentSection(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  // ESC to exit impersonation mode (separate effect with proper deps)
  useEffect(() => {
    if (!impersonatedBusiness) return;
    const handleImpersonateEsc = (e) => {
      if (e.key === 'Escape') {
        exitImpersonation();
      }
    };
    window.addEventListener('keydown', handleImpersonateEsc);
    return () => window.removeEventListener('keydown', handleImpersonateEsc);
  }, [impersonatedBusiness]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch events from Supabase on mount
  useEffect(() => {
    async function fetchEvents(force = false) {
      const now = Date.now();
      if (!force && now - fetchTimestamps.current.events < CACHE_TTL && dbEvents.length > 0) return;
      fetchTimestamps.current.events = now;

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
          venueId: event.venue_id || null,
          venueName: event.venue_name || 'Squamish',
          venueAddress: event.venue_address || 'Squamish, BC',
          start: startDate,
          end: endDate,
          tags: event.tags || [event.category || 'Community'],
          category: event.category
            ? event.category.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            : 'Community',
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
  }, [eventsRefreshKey]);

  // Supabase deals data (from database)
  const [dbDeals, setDbDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsRefreshKey, setDealsRefreshKey] = useState(0);

  // Fetch deals from Supabase on mount
  useEffect(() => {
    async function fetchDeals(force = false) {
      const now = Date.now();
      if (!force && now - fetchTimestamps.current.deals < CACHE_TTL && dbDeals.length > 0) return;
      fetchTimestamps.current.deals = now;

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
  }, [dealsRefreshKey]);

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
      const businessId = activeBusiness?.id;
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
      if (activeBusiness?.id) {
        fetchBusinessInbox(activeBusiness.id, businessInboxTab === 'bookings' ? 'booking_request' : 'general_inquiry');
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

  // Admin Business Impersonation Functions
  const enterImpersonation = (venue) => {
    if (!user.isAdmin) return;
    setPreviousAdminState({
      adminTab: adminTab,
      scrollPosition: window.scrollY
    });
    setImpersonatedBusiness({
      id: venue.id,
      name: venue.name,
      address: venue.address || '',
      verified: venue.verified || false,
      category: venue.category || '',
      phone: venue.phone || '',
      website: venue.website || '',
      email: venue.email || '',
      logo_url: venue.logo_url || null
    });
    setImpersonateSearchQuery('');
    setAdminSearchQuery('');
    setView('business');
    window.scrollTo(0, 0);
  };

  const exitImpersonation = () => {
    const savedState = previousAdminState;
    setImpersonatedBusiness(null);
    setView('admin');
    setBusinessAnalytics(null);
    setBusinessConversations([]);
    setSelectedBusinessConversation(null);
    if (savedState) {
      setAdminTab(savedState.adminTab);
      setTimeout(() => window.scrollTo(0, savedState.scrollPosition || 0), 100);
      setPreviousAdminState(null);
    }
  };

  // Load business data when view changes
  useEffect(() => {
    if (view === 'business' && activeBusiness) {
      const businessId = activeBusiness.id;
      fetchBusinessInbox(businessId, 'booking_request');
      fetchBusinessAnalytics(businessId, analyticsPeriod);
    }
  }, [view, activeBusiness?.id, analyticsPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Admin panel state (must be declared before useEffect that uses it)
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [quickAddForm, setQuickAddForm] = useState({ title: '', venueId: '', venueName: '', startTime: '18:00', duration: '60', price: '', recurrence: 'Weekly' });
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editEventForm, setEditEventForm] = useState({ title: '', description: '', date: '', startTime: '', endTime: '', price: '', category: '' });

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
    discountType: 'percent', // for deals: percent, fixed, bogo, free_item
    discountValue: '', // for deals
    originalPrice: '', // for deals
    dealPrice: '', // for deals
    validUntil: '', // for deals
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

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // User authentication state
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  // Build categories dynamically from actual event data, filtered by current section
  const categories = useMemo(() => {
    const catSet = new Set();
    let events = [...REAL_DATA.events, ...dbEvents];
    // Only show categories relevant to the current section
    if (currentSection === 'classes') {
      events = events.filter(e => e.eventType === 'class');
    } else if (currentSection === 'events') {
      events = events.filter(e => e.eventType === 'event');
    }
    events.forEach(e => {
      if (e.category) catSet.add(e.category);
    });
    return ['All', ...Array.from(catSet).sort()];
  }, [dbEvents, currentSection]);

  // Helper to close Add Event modal
  const closeAddEventModal = () => {
    setShowAddEventModal(false);
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
      } else if (submission.type === 'deal') {
        const dealData = {
          title: submission.data.title,
          description: submission.data.description,
          business_name: submission.data.businessName || submission.data.business?.name || '',
          business_address: submission.data.businessAddress || submission.data.business?.address || '',
          category: submission.data.category || 'General',
          discount_type: submission.data.discountType || 'special',
          discount_value: submission.data.discountValue ? parseFloat(submission.data.discountValue) : null,
          original_price: submission.data.originalPrice ? parseFloat(submission.data.originalPrice) : null,
          deal_price: submission.data.dealPrice ? parseFloat(submission.data.dealPrice) : null,
          valid_until: submission.data.validUntil || null,
          terms_conditions: submission.data.terms || '',
          schedule: submission.data.schedule || '',
          status: 'active'
        };

        const { error: insertError } = await supabase
          .from('deals')
          .insert(dealData);

        if (insertError) throw insertError;
      }

      // Update local state
      setPendingSubmissions(prev =>
        prev.map(s => s.id === submissionId ? { ...s, status: 'approved', approvedAt: new Date() } : s)
      );

      showToast('Submission approved and published!', 'success');
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
      const claimData = {
        user_id: session.user.id,
        business_name: claimSelectedBusiness?.name || claimFormData.businessName,
        business_address: claimSelectedBusiness?.address || claimFormData.address || null,
        owner_name: claimFormData.ownerName,
        contact_email: claimFormData.email,
        contact_phone: claimFormData.phone || null,
        owner_role: claimFormData.role,
        status: user.isAdmin ? 'verified' : 'pending'
      };
      // Add business_id if selecting from directory
      if (claimSelectedBusiness?.id) {
        claimData.business_id = claimSelectedBusiness.id;
      }
      const { error } = await supabase.from('business_claims').insert(claimData);
      if (error) throw error;
      setShowClaimBusinessModal(false);
      setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' });
      setClaimSelectedBusiness(null);
      setClaimSearchQuery('');
      if (user.isAdmin) {
        showToast('Business claimed and verified!', 'success');
        // Refresh user data to pick up the new claim
        if (typeof refreshUserData === 'function') refreshUserData();
      } else {
        showToast('Claim submitted! We\'ll review it shortly.', 'success');
      }
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
    if (venueId) {
      const venue = REAL_DATA.venues.find(v => v.id === venueId);
      if (venue?.name) return venue.name;
    }
    // Fallback to venue_name field or title-based name
    return event?.venue_name || event?.title || '';
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
      filtered = filtered.filter(e => e.ageGroup?.includes('Adults') || e.ageGroup === 'All Ages' || e.ageGroup === '19+' || e.ageGroup === 'Teens & Adults');
    }

    // Category
    if (filters.category !== 'all') {
      filtered = filtered.filter(e => e.category === filters.category || (e.tags && e.tags.includes(filters.category)));
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
            setSearchQuery('');
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
      // Use first event's date for formatting to avoid timezone re-parse issues
      const firstEvent = groupedEvents[dateKey][0];
      const date = firstEvent.start;
      const isToday = dateKey === today.toDateString();
      const isTomorrow = dateKey === tomorrow.toDateString();

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
        d.description?.toLowerCase().includes(query) ||
        d.venueName?.toLowerCase().includes(query) ||
        getVenueName(d.venueId, d).toLowerCase().includes(query)
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
          aria-label={isSaved ? "Remove from saved" : "Save to favorites"}
        >
          <Star size={24} fill={isSaved ? "#f59e0b" : "none"} stroke={isSaved ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
        </button>
        <ChevronRight className="event-chevron" size={20} />
      </div>
    );
  });

  return (
    <div className="pulse-app">
      <a href="#main-content" className="skip-to-content" style={{position:'absolute',left:'-9999px',top:'auto',width:'1px',height:'1px',overflow:'hidden',zIndex:9999}} onFocus={(e)=>{e.target.style.position='fixed';e.target.style.left='50%';e.target.style.top='8px';e.target.style.transform='translateX(-50%)';e.target.style.width='auto';e.target.style.height='auto';e.target.style.overflow='visible';e.target.style.background='#1f2937';e.target.style.color='#fff';e.target.style.padding='8px 16px';e.target.style.borderRadius='8px';e.target.style.fontSize='14px';e.target.style.fontWeight='600';e.target.style.textDecoration='none';}} onBlur={(e)=>{e.target.style.position='absolute';e.target.style.left='-9999px';e.target.style.width='1px';e.target.style.height='1px';e.target.style.overflow='hidden';}}>Skip to content</a>
      <div className="view-switcher">
        <button className={view === 'consumer' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) setImpersonatedBusiness(null); setView('consumer'); }}>Consumer</button>
        <button className={view === 'business' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) setImpersonatedBusiness(null); setView('business'); }}>Business</button>
        {user.isAdmin && (
          <button className={view === 'admin' ? 'active' : ''} onClick={() => { if (impersonatedBusiness) { exitImpersonation(); } else { setView('admin'); } }}>Admin</button>
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
                    <button className="header-btn-icon notification-btn" onClick={() => showToast('No new notifications', 'info')}>
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

          {/* Offline Banner */}
          {isOffline && (
            <div role="alert" style={{background: '#fef2f2', color: '#991b1b', padding: '8px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 500, borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
              <WifiOff size={14} />
              You're offline. Some features may be unavailable.
            </div>
          )}

          {/* Top Banner Navigation - Premium */}
          <nav className="top-banner-premium" aria-label="Main navigation">
            <div className="banner-content-premium">
              <div className="banner-tabs" role="tablist" aria-label="Content sections">
                <button
                  role="tab"
                  aria-selected={currentSection === 'classes'}
                  className={`banner-tab ${currentSection === 'classes' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('classes'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'classes' }, '', '#classes'); }}
                >
                  <Calendar size={18} />
                  <span>Classes</span>
                </button>
                <button
                  role="tab"
                  aria-selected={currentSection === 'events'}
                  className={`banner-tab ${currentSection === 'events' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('events'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'events' }, '', '#events'); }}
                >
                  <Star size={18} />
                  <span>Events</span>
                </button>
                <button
                  role="tab"
                  aria-selected={currentSection === 'deals'}
                  className={`banner-tab ${currentSection === 'deals' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('deals'); setServicesSubView('directory'); setFilters(f => ({...f, category: 'all'})); window.history.pushState({ section: 'deals' }, '', '#deals'); }}
                >
                  <DollarSign size={18} />
                  <span>Deals</span>
                </button>
              </div>
              <div className="banner-tabs banner-tabs-row2" role="tablist" aria-label="More sections">
                <button
                  role="tab"
                  aria-selected={currentSection === 'services'}
                  className={`banner-tab ${currentSection === 'services' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('services'); window.history.pushState({ section: 'services' }, '', '#services'); }}
                >
                  <Wrench size={18} />
                  <span>Services</span>
                </button>
                <button
                  role="tab"
                  aria-selected={currentSection === 'wellness'}
                  className={`banner-tab ${currentSection === 'wellness' ? 'active' : ''}`}
                  onClick={() => { setCurrentSection('wellness'); window.history.pushState({ section: 'wellness' }, '', '#wellness'); }}
                >
                  <Heart size={18} />
                  <span>Wellness</span>
                </button>
              </div>
            </div>
          </nav>

          {/* Search Bar - Premium (hidden for wellness which has its own UI) */}
          <div className="search-section-premium" style={currentSection === 'wellness' ? { display: 'none' } : undefined}>
            <div className="search-bar-premium">
              <Search size={20} className="search-icon-premium" />
              <input
                type="text"
                placeholder={`Search ${currentSection}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={`Search ${currentSection}`}
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
                      aria-label="Filter by day"
                    >
                      <option value="today">📅 Upcoming</option>
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
                      aria-label="Filter by time"
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
                      aria-label="Filter by age group"
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
                      aria-label="Filter by category"
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
                      aria-label="Filter by price"
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

          <main className="content" id="main-content">
            {currentSection !== 'wellness' && (
            <div className="results-count" aria-live="polite" aria-atomic="true">
              {currentSection === 'deals' ? (
                dealsLoading ? 'Loading...' : `${filterDeals().filter(d => dealCategoryFilter === 'All' || normalizeDealCategory(d.category) === dealCategoryFilter).length} results`
              ) : currentSection === 'services' ? (
                `${services.filter(s => {
                  if (debouncedSearch) {
                    const query = debouncedSearch.toLowerCase().trim();
                    if (!s.name.toLowerCase().includes(query) && !s.category.toLowerCase().includes(query) && !s.address?.toLowerCase().includes(query)) return false;
                  }
                  if (serviceCategoryFilter === 'All') return true;
                  const mainCategories = ['Restaurants & Dining', 'Retail & Shopping', 'Cafes & Bakeries', 'Outdoor Adventures', 'Auto Services', 'Real Estate', 'Fitness & Gyms', 'Recreation & Sports', 'Health & Wellness', 'Construction & Building', 'Outdoor Gear & Shops', 'Community Services', 'Hotels & Lodging', 'Web & Marketing', 'Financial Services', 'Medical Clinics', 'Photography', 'Attractions', 'Churches & Religious', 'Salons & Spas', 'Arts & Culture'];
                  if (serviceCategoryFilter === 'Other') return !mainCategories.includes(s.category);
                  return s.category === serviceCategoryFilter;
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
                        aria-label="Filter deals by category"
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
                      aria-label={isItemSavedLocal('deal', deal.id) ? "Remove from saved" : "Save to favorites"}
                    >
                      <Star size={24} fill={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "none"} stroke={isItemSavedLocal('deal', deal.id) ? "#f59e0b" : "#9ca3af"} strokeWidth={2} />
                    </button>
                    <ChevronRight className="deal-chevron" size={20} />
                  </div>
                ))}
              </div>
              {/* Deals empty state */}
              {!dealsLoading && filterDeals().filter(d => dealCategoryFilter === 'All' || normalizeDealCategory(d.category) === dealCategoryFilter).length === 0 && (
                <div className="no-results-state" style={{textAlign: 'center', padding: '40px 20px', color: '#6b7280'}}>
                  <DollarSign size={48} style={{color: '#d1d5db', marginBottom: '12px'}} />
                  <h3 style={{color: '#374151', marginBottom: '8px'}}>No deals found</h3>
                  <p>{searchQuery ? `No deals matching "${searchQuery}"` : 'No deals in this category'}</p>
                  {(searchQuery || dealCategoryFilter !== 'All') && (
                    <button onClick={() => { setSearchQuery(''); setDealCategoryFilter('All'); }} className="clear-search-btn" style={{marginTop: '12px', padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600}}>
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
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
                {/* Services Filter */}
                <div className="filters-section" style={{marginTop: '20px'}}>
                  <div className="filters-row-single">
                    <div className="filter-group">
                      <select
                        value={serviceCategoryFilter}
                        onChange={(e) => setServiceCategoryFilter(e.target.value)}
                        className="filter-dropdown"
                        aria-label="Filter services by category"
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
          </main>

          {/* Event/Class Detail Modal */}
          {selectedEvent && (
            <EventDetailModal
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              getVenueName={getVenueName}
              isVerified={isVerified}
              isInMyCalendar={isInMyCalendar}
              addToCalendar={addToCalendar}
              handleBookClick={handleBookClick}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={(msg) => { setCalendarToastMessage(msg); setShowCalendarToast(true); setTimeout(() => setShowCalendarToast(false), 2000); }}
            />
          )}

          {/* Deal Detail Modal */}
          {selectedDeal && (
            <DealDetailModal
              deal={selectedDeal}
              onClose={() => setSelectedDeal(null)}
              getVenueName={getVenueName}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={(msg, type, duration) => {
                if (type === 'error') { showToast(msg, 'error'); return; }
                setCalendarToastMessage(msg);
                setShowCalendarToast(true);
                setTimeout(() => setShowCalendarToast(false), duration || 2000);
              }}
              generateSmartDealTitle={generateSmartDealTitle}
              generateEnhancedDealDescription={generateEnhancedDealDescription}
              getRelatedDeals={getRelatedDeals}
              onSelectDeal={setSelectedDeal}
              session={session}
              onAuthRequired={() => setShowAuthModal(true)}
              supabase={supabase}
              allDeals={[...REAL_DATA.deals, ...dbDeals]}
            />
          )}
          {/* Service Detail Modal */}
          {selectedService && (
            <ServiceDetailModal
              service={selectedService}
              onClose={() => setSelectedService(null)}
              isItemSavedLocal={isItemSavedLocal}
              toggleSave={toggleSave}
              showToast={showToast}
            />
          )}

          {/* Floating Action Button - Premium */}
          <button className="fab-premium" onClick={() => { if (user.isGuest) { setShowAuthModal(true); return; } setShowAddEventModal(true); }}>
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
            <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Add event" onClick={closeAddEventModal}>
              <div className="modal-content add-event-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={closeAddEventModal}><X size={24} /></button>
                <div className="modal-header-premium">
                  <Plus size={32} className="modal-icon" />
                  <h2>Add Your Event</h2>
                  <p>Share your event with the Squamish community</p>
                </div>
                <div className="modal-body-premium">
                  <p style={{ color: '#6b7280', marginBottom: '1.5rem', textAlign: 'center' }}>Choose what you'd like to add to the Squamish community</p>
                  <div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button className="btn-primary" onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('event');
                    }}><Calendar size={18} style={{ marginRight: '0.5rem' }} /> Submit an Event</button>
                    <button className="btn-primary" style={{ background: '#8b5cf6' }} onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('class');
                    }}><Sparkles size={18} style={{ marginRight: '0.5rem' }} /> Submit a Class</button>
                    <button className="btn-primary" style={{ background: '#f59e0b' }} onClick={() => {
                      closeAddEventModal();
                      setShowSubmissionModal(true);
                      setSubmissionStep(1);
                      setSubmissionType('deal');
                    }}><Percent size={18} style={{ marginRight: '0.5rem' }} /> Submit a Deal</button>
                    <button className="btn-secondary" onClick={closeAddEventModal}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Claim Business Modal - Premium Purple Theme */}
          {showClaimBusinessModal && (
            <ClaimBusinessModal
              claimSearchQuery={claimSearchQuery}
              setClaimSearchQuery={setClaimSearchQuery}
              claimSelectedBusiness={claimSelectedBusiness}
              setClaimSelectedBusiness={setClaimSelectedBusiness}
              claimFormData={claimFormData}
              setClaimFormData={setClaimFormData}
              claimSubmitting={claimSubmitting}
              session={session}
              services={services}
              onClose={() => { setShowClaimBusinessModal(false); setClaimFormData({ businessName: '', ownerName: '', email: '', phone: '', role: 'owner', address: '' }); }}
              setShowAuthModal={setShowAuthModal}
              handleClaimBusiness={handleClaimBusiness}
            />
          )}

          {/* My Calendar Modal - Premium */}
          {showMyCalendarModal && (
            <MyCalendarModal
              myCalendar={myCalendar}
              showCalendarToast={showCalendarToast}
              calendarToastMessage={calendarToastMessage}
              onClose={() => setShowMyCalendarModal(false)}
              setCurrentSection={setCurrentSection}
              setCalendarToastMessage={setCalendarToastMessage}
              setShowCalendarToast={setShowCalendarToast}
              getCalendarEventsByDate={getCalendarEventsByDate}
              getVenueName={getVenueName}
              generateGoogleCalendarUrl={generateGoogleCalendarUrl}
              removeFromCalendar={removeFromCalendar}
            />
          )}

          {/* Calendar Toast Notification */}
          {showCalendarToast && (
            <div className="calendar-toast" role="alert" aria-live="assertive">
              <div className="toast-icon">
                <Calendar size={20} />
              </div>
              <span>{calendarToastMessage}</span>
            </div>
          )}

          {/* Submission Modal - Add Event/Class/Deal */}
          {showSubmissionModal && (
            <SubmissionModal
              submissionStep={submissionStep}
              submissionType={submissionType}
              submissionForm={submissionForm}
              setSubmissionForm={setSubmissionForm}
              showImageCropper={showImageCropper}
              cropperImage={cropperImage}
              cropPosition={cropPosition}
              setCropPosition={setCropPosition}
              cropZoom={cropZoom}
              setCropZoom={setCropZoom}
              cropperType={cropperType}
              userClaimedBusinesses={userClaimedBusinesses}
              user={user}
              onClose={closeSubmissionModal}
              setSubmissionStep={setSubmissionStep}
              setSubmissionType={setSubmissionType}
              setShowImageCropper={setShowImageCropper}
              setCropperImage={setCropperImage}
              setCropperType={setCropperType}
              selectSubmissionType={selectSubmissionType}
              selectBusinessType={selectBusinessType}
              removeImage={removeImage}
              handleImageSelect={handleImageSelect}
              handleCropComplete={handleCropComplete}
              submitForApproval={submitForApproval}
              getSelectedBusinessInfo={getSelectedBusinessInfo}
              showToast={showToast}
            />
          )}

          {/* Premium Profile Modal */}
          {showProfileModal && (
            <ProfileModal
              user={user}
              session={session}
              userStats={userStats}
              userAchievements={userAchievements}
              userActivity={userActivity}
              savedItems={savedItems}
              localSavedItems={localSavedItems}
              userClaimedBusinesses={userClaimedBusinesses}
              activeBusiness={activeBusiness}
              profileTab={profileTab}
              setProfileTab={setProfileTab}
              activityFilter={activityFilter}
              setActivityFilter={setActivityFilter}
              savedItemsFilter={savedItemsFilter}
              setSavedItemsFilter={setSavedItemsFilter}
              onClose={() => setShowProfileModal(false)}
              setView={setView}
              setShowClaimBusinessModal={setShowClaimBusinessModal}
              setShowSubmissionModal={setShowSubmissionModal}
              setSubmissionStep={setSubmissionStep}
              setSubmissionType={setSubmissionType}
              setEditingVenue={setEditingVenue}
              setEditVenueForm={setEditVenueForm}
              setShowEditVenueModal={setShowEditVenueModal}
              setUser={setUser}
              setLocalSavedItems={setLocalSavedItems}
              setCalendarToastMessage={setCalendarToastMessage}
              setShowCalendarToast={setShowCalendarToast}
              handleImageSelect={handleImageSelect}
              getVenueName={getVenueName}
              getBusinessForEvent={getBusinessForEvent}
              trackAnalytics={trackAnalytics}
              addToCalendar={addToCalendar}
              updateProfile={updateProfile}
              showToast={showToast}
              toggleSaveItem={toggleSaveItem}
            />
          )}
          {/* Booking Bottom Sheet */}
          {showBookingSheet && bookingEvent && (
            <BookingSheet
              bookingEvent={bookingEvent}
              bookingStep={bookingStep}
              bookingRequestMessage={bookingRequestMessage}
              setBookingRequestMessage={setBookingRequestMessage}
              sendingMessage={sendingMessage}
              onClose={closeBookingSheet}
              getVenueName={getVenueName}
              getBusinessForEvent={getBusinessForEvent}
              trackAnalytics={trackAnalytics}
              addToCalendar={addToCalendar}
              submitBookingRequest={submitBookingRequest}
              setCalendarToastMessage={setCalendarToastMessage}
              setShowCalendarToast={setShowCalendarToast}
            />
          )}

          {/* Booking Confirmation Dialog */}
          {showBookingConfirmation && (
            <div className="modal-overlay confirmation-overlay" role="dialog" aria-modal="true" aria-label="Confirm booking">
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
            <div className="modal-overlay contact-sheet-overlay" role="dialog" aria-modal="true" aria-label="Contact business" onClick={() => setShowContactSheet(false)}>
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
            <MessagesModal
              currentConversation={currentConversation}
              setCurrentConversation={setCurrentConversation}
              conversationsLoading={conversationsLoading}
              conversations={conversations}
              messagesLoading={messagesLoading}
              conversationMessages={conversationMessages}
              messageInput={messageInput}
              setMessageInput={setMessageInput}
              sendingMessage={sendingMessage}
              onClose={() => { setShowMessagesModal(false); setCurrentConversation(null); }}
              fetchMessages={fetchMessages}
              sendMessage={sendMessage}
            />
          )}

          {/* Admin Panel Modal */}
          {showAdminPanel && user.isAdmin && (
            <AdminPanelModal
              adminTab={adminTab}
              setAdminTab={setAdminTab}
              pendingSubmissions={pendingSubmissions}
              onClose={() => setShowAdminPanel(false)}
              setView={setView}
              approveSubmission={approveSubmission}
              rejectSubmission={rejectSubmission}
            />
          )}
        </div>
      )}

      {view === 'business' && (
        <BusinessDashboard
          user={user}
          isImpersonating={isImpersonating}
          impersonatedBusiness={impersonatedBusiness}
          activeBusiness={activeBusiness}
          userClaimedBusinesses={userClaimedBusinesses}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
          businessAnalytics={businessAnalytics}
          dbEvents={dbEvents}
          businessInboxTab={businessInboxTab}
          setBusinessInboxTab={setBusinessInboxTab}
          businessConversations={businessConversations}
          businessConversationsLoading={businessConversationsLoading}
          selectedBusinessConversation={selectedBusinessConversation}
          setSelectedBusinessConversation={setSelectedBusinessConversation}
          businessMessagesLoading={businessMessagesLoading}
          businessMessages={businessMessages}
          businessReplyInput={businessReplyInput}
          setBusinessReplyInput={setBusinessReplyInput}
          sendingMessage={sendingMessage}
          eventsRefreshKey={eventsRefreshKey}
          setShowAuthModal={setShowAuthModal}
          setShowClaimBusinessModal={setShowClaimBusinessModal}
          setSelectedClaimedBusinessId={setSelectedClaimedBusinessId}
          setEditingEvent={setEditingEvent}
          setEditEventForm={setEditEventForm}
          setShowEditEventModal={setShowEditEventModal}
          setShowSubmissionModal={setShowSubmissionModal}
          setSubmissionStep={setSubmissionStep}
          setSubmissionType={setSubmissionType}
          setEditingVenue={setEditingVenue}
          setEditVenueForm={setEditVenueForm}
          setShowEditVenueModal={setShowEditVenueModal}
          setEventsRefreshKey={setEventsRefreshKey}
          fetchServices={fetchServices}
          showToast={showToast}
          exitImpersonation={exitImpersonation}
          fetchBusinessInbox={fetchBusinessInbox}
          fetchBusinessMessages={fetchBusinessMessages}
          markConversationResolved={markConversationResolved}
          sendBusinessReply={sendBusinessReply}
        />
      )}
      {view === 'admin' && (
        <AdminDashboard
          user={user}
          services={services}
          impersonateSearchQuery={impersonateSearchQuery}
          setImpersonateSearchQuery={setImpersonateSearchQuery}
          adminVerifiedCount={adminVerifiedCount}
          adminClaimedCount={adminClaimedCount}
          dbEvents={dbEvents}
          dbDeals={dbDeals}
          REAL_DATA={REAL_DATA}
          adminSearchQuery={adminSearchQuery}
          setAdminSearchQuery={setAdminSearchQuery}
          adminCategoryFilter={adminCategoryFilter}
          setAdminCategoryFilter={setAdminCategoryFilter}
          adminStatusFilter={adminStatusFilter}
          setAdminStatusFilter={setAdminStatusFilter}
          editingVenue={editingVenue}
          setEditingVenue={setEditingVenue}
          setEditVenueForm={setEditVenueForm}
          setShowEditVenueModal={setShowEditVenueModal}
          quickAddForm={quickAddForm}
          setQuickAddForm={setQuickAddForm}
          enterImpersonation={enterImpersonation}
          showToast={showToast}
          fetchServices={fetchServices}
          getPacificDateStr={getPacificDateStr}
          setView={setView}
        />
      )}

      {/* Edit Venue Modal - Global (works from any view) */}
      {showEditVenueModal && editingVenue && (
        <EditVenueModal
          editingVenue={editingVenue}
          editVenueForm={editVenueForm}
          setEditVenueForm={setEditVenueForm}
          onClose={() => { setShowEditVenueModal(false); setEditingVenue(null); }}
          showToast={showToast}
          fetchServices={fetchServices}
        />
      )}

      {/* Edit Event/Class Modal */}
      {showEditEventModal && editingEvent && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Edit event" onClick={() => { setShowEditEventModal(false); setEditingEvent(null); }}>
          <div className="claim-modal-premium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-premium">
              <h2>Edit {editingEvent.eventType === 'class' ? 'Class' : 'Event'}</h2>
              <button className="modal-close-btn" onClick={() => { setShowEditEventModal(false); setEditingEvent(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body-premium">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={editEventForm.title} onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} value={editEventForm.description} onChange={(e) => setEditEventForm(prev => ({ ...prev, description: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={editEventForm.date} onChange={(e) => setEditEventForm(prev => ({ ...prev, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={editEventForm.startTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, startTime: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" value={editEventForm.endTime} onChange={(e) => setEditEventForm(prev => ({ ...prev, endTime: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Price</label>
                  <input type="text" placeholder="Free or $20" value={editEventForm.price} onChange={(e) => setEditEventForm(prev => ({ ...prev, price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input type="text" value={editEventForm.category} onChange={(e) => setEditEventForm(prev => ({ ...prev, category: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-actions-premium">
              <button className="btn-secondary" onClick={() => { setShowEditEventModal(false); setEditingEvent(null); }}>Cancel</button>
              <button className="btn-primary-gradient" onClick={async () => {
                try {
                  const updateData = {
                    title: editEventForm.title,
                    description: editEventForm.description,
                    start_date: editEventForm.date,
                    start_time: editEventForm.startTime,
                    end_time: editEventForm.endTime,
                    category: editEventForm.category
                  };
                  if (editEventForm.price && editEventForm.price.toLowerCase() !== 'free') {
                    updateData.price = editEventForm.price.replace(/[^0-9.]/g, '');
                    updateData.is_free = false;
                  } else {
                    updateData.is_free = true;
                    updateData.price = null;
                  }
                  const { error } = await supabase.from('events').update(updateData).eq('id', editingEvent.id);
                  if (error) throw error;
                  showToast(`"${editEventForm.title}" updated!`, 'success');
                  setShowEditEventModal(false);
                  setEditingEvent(null);
                  setEventsRefreshKey(k => k + 1);
                } catch (err) {
                  console.error('Error updating event:', err);
                  showToast('Failed to update', 'error');
                }
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Image Cropper Modal - Works from any context */}
      {showImageCropper && cropperImage && (
        <ImageCropperModal
          cropperImage={cropperImage}
          cropperType={cropperType}
          cropPosition={cropPosition}
          setCropPosition={setCropPosition}
          cropZoom={cropZoom}
          setCropZoom={setCropZoom}
          onClose={() => { setShowImageCropper(false); setCropPosition({ x: 0, y: 0 }); setCropZoom(1); }}
          handleCropComplete={handleCropComplete}
        />
      )}

      {/* ========== GLOBAL MODALS (render regardless of view) ========== */}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={(msg) => {
            setCalendarToastMessage(msg);
            setShowCalendarToast(true);
            setTimeout(() => setShowCalendarToast(false), 5000);
          }}
        />
      )}

    </div>
  );
}
