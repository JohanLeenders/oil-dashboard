-- Klantprofielen persistent opslaan na import wizard.
-- Elke import wordt bewaard: meerdere imports per klant mogelijk (tijdreeks).

CREATE TABLE customer_import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  import_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_filename VARCHAR(500),

  -- Geaggregeerde mix (JSONB array van {category, quantity_kg, revenue})
  product_mix JSONB NOT NULL DEFAULT '[]',

  -- Cherry-picker analyse resultaat (volledige CherryPickerAnalysis)
  analysis JSONB NOT NULL DEFAULT '{}',

  -- Totalen
  total_kg DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_excluded_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Metadata
  balance_score DECIMAL(5,2),
  is_cherry_picker BOOLEAN DEFAULT false,
  opportunity_cost DECIMAL(14,2) DEFAULT 0,

  -- Uitgesloten items (JSONB array)
  excluded_items JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index: snel ophalen van profielen per klant, nieuwste eerst
CREATE INDEX idx_import_profiles_customer
  ON customer_import_profiles (customer_id, import_date DESC);

-- Comment
COMMENT ON TABLE customer_import_profiles IS
  'Persistent opslag van klant import profielen uit de import wizard. Elke rij is één import sessie met cherry-picker analyse.';
