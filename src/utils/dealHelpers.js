// Deal utility functions extracted from App.jsx
// Smart title generation, scoring, categorization, and display helpers

// Smart Deal Title Generator - creates clean, compelling titles (max ~50 chars)
export const generateSmartDealTitle = (deal, venueName = '') => {
  const { title = '' } = deal;

  // Generic titles that need enhancement
  const genericTitles = ['happy hour', 'family night', 'date night', 'special', 'deal', 'promo', 'offer'];
  const isGeneric = genericTitles.some(g => title.toLowerCase().trim() === g);

  // Check if title already looks good (has price/value and is reasonable length)
  const hasGoodValue = /\$\d+|\d+%|\bfree\b|\bhalf\s+price\b|\bbogo\b/i.test(title);
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
export const generateEnhancedDealDescription = (deal, venueName = '') => {
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
export const DEAL_CATEGORY_MAP = {
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

  // Entertainment
  'Entertainment': 'Entertainment',
  'Attractions': 'Entertainment',
  'Arts & Culture': 'Entertainment',
  'Recreation & Sports': 'Entertainment',

  // Retail
  'Retail': 'Retail',
  'Retail & Shopping': 'Retail',
  'Outdoor Gear & Shops': 'Retail',

  // Beauty
  'Beauty': 'Beauty',
  'Salons & Spas': 'Beauty',
  'Massage & Bodywork': 'Beauty',

  // Services
  'Services': 'Services',
  'Auto Services': 'Services',
  'Home Improvement': 'Services',
  'Professional Services': 'Services',
  'Real Estate': 'Services',
  'Technology & IT': 'Services',
};

// Normalize a deal's category to one of the UI categories
export const normalizeDealCategory = (category) => {
  if (!category) return 'Other';
  return DEAL_CATEGORY_MAP[category] || 'Other';
};

// Deal Quality Scorer - ranks deals by actual value to surface the best ones
export const calculateDealScore = (deal) => {
  let score = 0;

  // Extract discount info from various fields
  const discountValue = deal.discountValue ?? deal.discount_value ?? 0;
  const discountType = deal.discountType || deal.discount_type || '';
  const savingsPercent = deal.savingsPercent ?? 0;
  const originalPrice = deal.originalPrice ?? deal.original_price ?? 0;
  const dealPrice = deal.dealPrice ?? deal.deal_price ?? 0;
  const hasDealPrice = deal.dealPrice != null || deal.deal_price != null;
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

  // Calculate actual savings if we have prices (hasDealPrice distinguishes "free" from "unknown")
  const actualSavings = originalPrice > 0 && hasDealPrice ? originalPrice - dealPrice : 0;

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

// Get prominent savings text for deal cards (e.g., "40% OFF", "SAVE $50")
export const getDealSavingsDisplay = (deal) => {
  const discountValue = deal.discountValue ?? deal.discount_value ?? 0;
  const discountType = deal.discountType || deal.discount_type || '';
  const savingsPercent = deal.savingsPercent ?? 0;
  const originalPrice = deal.originalPrice ?? deal.original_price ?? 0;
  const dealPrice = deal.dealPrice ?? deal.deal_price ?? 0;
  const hasDealPrice = deal.dealPrice != null || deal.deal_price != null;
  const title = (deal.title || '').toLowerCase();
  const discount = (deal.discount || '').toLowerCase();

  // Check for percentage discount
  if (discountType === 'percent' && discountValue > 0) {
    return { text: `${Math.round(discountValue)}% OFF`, type: 'percent' };
  }
  if (savingsPercent > 0) {
    return { text: `${Math.round(savingsPercent)}% OFF`, type: 'percent' };
  }

  // Check for dollar savings
  if (discountType === 'fixed' && discountValue > 0) {
    return { text: `SAVE $${Math.round(discountValue)}`, type: 'dollar' };
  }
  if (originalPrice > 0 && hasDealPrice && originalPrice > dealPrice) {
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
export const isRealDeal = (deal) => {
  const score = calculateDealScore(deal);
  // Only show deals with a minimum score (has some concrete value)
  return score >= 15;
};

// Helper to get related deals from the same business
export const getRelatedDeals = (currentDeal, allDeals) => {
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
