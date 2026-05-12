-- Patch: add reference_links column to site_map_requests (if not already present)
ALTER TABLE site_map_requests
  ADD COLUMN IF NOT EXISTS reference_links JSONB NOT NULL DEFAULT '[]';
