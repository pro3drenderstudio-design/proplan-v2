-- v4: Per-mesh material assignments on options
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE options
  ADD COLUMN IF NOT EXISTS material_assignments JSONB DEFAULT '[]'::jsonb;

-- Structure: [{ "mesh_name": "Door_Frame", "material_id": "uuid" }, ...]
-- Used by material_override options to apply different materials per mesh.
-- Supersedes the single material_id field for multi-part meshes.
