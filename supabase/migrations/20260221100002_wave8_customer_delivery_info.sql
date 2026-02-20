-- Wave 8: Customer delivery information for Storteboom bestelschema
-- Stores delivery address, transport provider, and delivery days per customer

CREATE TABLE IF NOT EXISTS customer_delivery_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) UNIQUE,
  delivery_address TEXT,
  transport_provider TEXT,          -- e.g. "Koops", "Eigen vervoer"
  transport_by_koops BOOLEAN DEFAULT false,
  putten_delivery_day TEXT CHECK (putten_delivery_day IN ('maandag','dinsdag','woensdag','donderdag','vrijdag')),
  nijkerk_delivery_day TEXT CHECK (nijkerk_delivery_day IN ('maandag','dinsdag','woensdag','donderdag','vrijdag')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customer_delivery_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_delivery_info"
  ON customer_delivery_info FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_delivery_info"
  ON customer_delivery_info FOR ALL TO anon USING (true) WITH CHECK (true);
