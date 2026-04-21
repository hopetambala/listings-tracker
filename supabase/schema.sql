-- Listings Tracker Tables
-- These tables extend the shared Supabase database with listings-tracker specific data

-- Properties table
CREATE TABLE IF NOT EXISTS listings_tracker_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_link TEXT NOT NULL,
  street_address TEXT,
  mls_number TEXT,
  listing_price NUMERIC NOT NULL,
  sold_price NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'withdrawn')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: add status if table already exists
ALTER TABLE listings_tracker_properties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'withdrawn'));

-- Migration: drop UNIQUE constraint on code to allow multiple properties per code
ALTER TABLE listings_tracker_access_codes DROP CONSTRAINT IF EXISTS listings_tracker_access_codes_code_key;

-- Prices history table
CREATE TABLE IF NOT EXISTS listings_tracker_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES listings_tracker_properties(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Photos table
CREATE TABLE IF NOT EXISTS listings_tracker_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES listings_tracker_properties(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  is_key_photo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: add is_key_photo if table already exists
ALTER TABLE listings_tracker_photos ADD COLUMN IF NOT EXISTS is_key_photo BOOLEAN DEFAULT FALSE;

-- Migration: structured property attributes for $/sqft + comparison views
ALTER TABLE listings_tracker_properties ADD COLUMN IF NOT EXISTS bedrooms INTEGER;
ALTER TABLE listings_tracker_properties ADD COLUMN IF NOT EXISTS bathrooms NUMERIC;
ALTER TABLE listings_tracker_properties ADD COLUMN IF NOT EXISTS square_feet INTEGER;
ALTER TABLE listings_tracker_properties ADD COLUMN IF NOT EXISTS year_built INTEGER;
ALTER TABLE listings_tracker_properties ADD COLUMN IF NOT EXISTS listed_at DATE;
UPDATE listings_tracker_properties SET listed_at = created_at::date WHERE listed_at IS NULL;

-- Access codes table
CREATE TABLE IF NOT EXISTS listings_tracker_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES listings_tracker_properties(id) ON DELETE CASCADE,
  code VARCHAR(4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Migration: per-code buyer budget + label (nullable)
ALTER TABLE listings_tracker_access_codes ADD COLUMN IF NOT EXISTS target_price NUMERIC;
ALTER TABLE listings_tracker_access_codes ADD COLUMN IF NOT EXISTS buyer_label TEXT;

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE listings_tracker_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings_tracker_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings_tracker_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings_tracker_access_codes ENABLE ROW LEVEL SECURITY;

-- Properties: Admin full access, public read via access codes
DROP POLICY IF EXISTS "Admin full access to own properties" ON listings_tracker_properties;
CREATE POLICY "Admin full access to own properties" ON listings_tracker_properties
  FOR ALL USING (auth.uid() = admin_id) WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "Public read properties via access codes" ON listings_tracker_properties;
CREATE POLICY "Public read properties via access codes" ON listings_tracker_properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings_tracker_access_codes
      WHERE property_id = id
    )
  );

DROP POLICY IF EXISTS "Users can insert properties via access codes" ON listings_tracker_properties;
CREATE POLICY "Users can insert properties via access codes" ON listings_tracker_properties
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update properties via access codes" ON listings_tracker_properties;
CREATE POLICY "Users can update properties via access codes" ON listings_tracker_properties
  FOR UPDATE USING (true) WITH CHECK (true);

-- Prices: Admin can read/write all, users can read and insert
DROP POLICY IF EXISTS "Admin full access to prices" ON listings_tracker_prices;
CREATE POLICY "Admin full access to prices" ON listings_tracker_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM listings_tracker_properties
      WHERE id = property_id AND admin_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings_tracker_properties
      WHERE id = property_id AND admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read prices via access codes" ON listings_tracker_prices;
CREATE POLICY "Users can read prices via access codes" ON listings_tracker_prices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings_tracker_access_codes
      WHERE property_id = property_id
    )
  );

DROP POLICY IF EXISTS "Users can insert prices" ON listings_tracker_prices;
CREATE POLICY "Users can insert prices" ON listings_tracker_prices
  FOR INSERT WITH CHECK (true);

-- Photos: Admin can read/write all, users can read and insert
DROP POLICY IF EXISTS "Admin full access to photos" ON listings_tracker_photos;
CREATE POLICY "Admin full access to photos" ON listings_tracker_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM listings_tracker_properties
      WHERE id = property_id AND admin_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings_tracker_properties
      WHERE id = property_id AND admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can read photos via access codes" ON listings_tracker_photos;
CREATE POLICY "Users can read photos via access codes" ON listings_tracker_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings_tracker_access_codes
      WHERE property_id = property_id
    )
  );

DROP POLICY IF EXISTS "Users can insert photos" ON listings_tracker_photos;
CREATE POLICY "Users can insert photos" ON listings_tracker_photos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete photos" ON listings_tracker_photos;
CREATE POLICY "Users can delete photos" ON listings_tracker_photos
  FOR DELETE USING (true);

-- Access codes: Admin only for write, public read by code value
DROP POLICY IF EXISTS "Admin full access to codes" ON listings_tracker_access_codes;
CREATE POLICY "Admin full access to codes" ON listings_tracker_access_codes
  FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can insert codes when adding properties" ON listings_tracker_access_codes;
CREATE POLICY "Users can insert codes when adding properties" ON listings_tracker_access_codes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public read access codes by code value" ON listings_tracker_access_codes;
CREATE POLICY "Public read access codes by code value" ON listings_tracker_access_codes
  FOR SELECT USING (true);

-- Create indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_listings_tracker_properties_admin_id ON listings_tracker_properties(admin_id);
CREATE INDEX IF NOT EXISTS idx_listings_tracker_prices_property_id ON listings_tracker_prices(property_id);
CREATE INDEX IF NOT EXISTS idx_listings_tracker_photos_property_id ON listings_tracker_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_listings_tracker_access_codes_property_id ON listings_tracker_access_codes(property_id);
CREATE INDEX IF NOT EXISTS idx_listings_tracker_access_codes_code ON listings_tracker_access_codes(code);
