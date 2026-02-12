CREATE TABLE technical_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_type VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  source_document VARCHAR(255),
  source_section VARCHAR(100),
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(definition_type, key)
);
