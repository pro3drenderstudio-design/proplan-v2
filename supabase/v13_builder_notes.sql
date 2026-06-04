-- Builder CRM notes for admin use
CREATE TABLE builder_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_builder_notes_builder ON builder_notes (builder_id, created_at DESC);
