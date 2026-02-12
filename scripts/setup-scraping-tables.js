#!/usr/bin/env node

/**
 * Setup Scraping Tables
 * Creates the scraping_sources table for tracking discovered sources
 *
 * Run: node scripts/setup-scraping-tables.js
 */

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './lib/env.js';

const SUPABASE_KEY = SUPABASE_SERVICE_KEY();

const CREATE_TABLE_SQL = `
-- Scraping sources table (tracks all discovered and manual sources)
CREATE TABLE IF NOT EXISTS scraping_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),
  name TEXT NOT NULL,
  booking_system TEXT,
  widget_id TEXT,
  studio_id TEXT,
  url TEXT,
  schedule_url TEXT,
  address TEXT,
  category TEXT,
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,

  -- Scraping metadata
  last_scraped TIMESTAMPTZ,
  last_scrape_success BOOLEAN,
  last_error TEXT,
  last_class_count INTEGER,
  last_event_count INTEGER,
  consecutive_failures INTEGER DEFAULT 0,

  -- Discovery metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT false,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(name, booking_system)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_scraping_sources_active ON scraping_sources(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scraping_sources_system ON scraping_sources(booking_system);
CREATE INDEX IF NOT EXISTS idx_scraping_sources_priority ON scraping_sources(priority DESC);

-- Add confidence columns to events if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'confidence_score') THEN
    ALTER TABLE events ADD COLUMN confidence_score DECIMAL(3,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'verified_at') THEN
    ALTER TABLE events ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'verification_sources') THEN
    ALTER TABLE events ADD COLUMN verification_sources INTEGER DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE scraping_sources ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY IF NOT EXISTS "Service role full access to scraping_sources"
  ON scraping_sources
  FOR ALL
  USING (true)
  WITH CHECK (true);
`;

async function setupTables() {
  console.log('🔧 Setting up scraping tables...\n');

  try {
    // Execute SQL via Supabase RPC or REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: CREATE_TABLE_SQL })
    });

    if (response.ok) {
      console.log('✅ Tables created successfully!');
    } else {
      // RPC might not exist, try direct table creation check
      console.log('⚠️  RPC not available. Checking if table exists...');

      const checkResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/scraping_sources?limit=1`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      if (checkResponse.ok) {
        console.log('✅ scraping_sources table already exists!');
      } else {
        console.log('\n❌ Table does not exist. Please run this SQL in the Supabase dashboard:\n');
        console.log('='.repeat(70));
        console.log(CREATE_TABLE_SQL);
        console.log('='.repeat(70));
      }
    }

    // Test inserting a sample row
    console.log('\n🧪 Testing table access...');
    const testResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/scraping_sources?select=count`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'count=exact',
          'Range': '0-0'
        }
      }
    );

    if (testResponse.ok) {
      const count = testResponse.headers.get('content-range')?.split('/')[1] || '0';
      console.log(`✅ Table accessible. Current sources: ${count}`);
    } else {
      console.log('❌ Cannot access table. Check permissions.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

setupTables();
