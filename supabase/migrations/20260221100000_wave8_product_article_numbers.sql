-- Wave 8: Product article numbers (vacuum / niet-vacuum per locatie)
-- Maps Storteboom bestelschema article numbers to products

CREATE TABLE IF NOT EXISTS product_article_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  location TEXT NOT NULL CHECK (location IN ('putten', 'nijkerk')),
  article_type TEXT NOT NULL CHECK (article_type IN ('vacuum', 'niet_vacuum')),
  article_number TEXT NOT NULL,
  packaging_size TEXT,  -- e.g. "15kg", "10kg", "250kg"
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, location, article_type)
);

-- RLS
ALTER TABLE product_article_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_article_numbers"
  ON product_article_numbers FOR SELECT TO anon USING (true);

CREATE POLICY "anon_write_article_numbers"
  ON product_article_numbers FOR ALL TO anon USING (true) WITH CHECK (true);
