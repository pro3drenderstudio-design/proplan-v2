-- =============================================================================
-- ProPlan Studio — v6 Migration
-- Run in Supabase SQL Editor.
-- Adds: extended material properties JSONB column to material_library.
-- Also requires creating a "textures" storage bucket (public).
-- =============================================================================

ALTER TABLE material_library
  ADD COLUMN IF NOT EXISTS properties JSONB NOT NULL DEFAULT '{}';

-- Index for faster JSON queries if needed later
CREATE INDEX IF NOT EXISTS idx_material_library_properties
  ON material_library USING gin (properties);

-- ─── Storage bucket ─────────────────────────────────────────────────────────
-- Creates the "textures" bucket if it doesn't already exist.
-- 20 MB per file limit; public so uploaded URLs are readable without auth.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'textures',
  'textures',
  true,
  20971520,   -- 20 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/tiff',
        'image/bmp','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read texture files (public CDN-style access)
CREATE POLICY "Public read textures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'textures');

-- Allow authenticated users (service role bypasses this anyway) to upload
CREATE POLICY "Auth upload textures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'textures');

-- Allow authenticated users to delete
CREATE POLICY "Auth delete textures"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'textures');
