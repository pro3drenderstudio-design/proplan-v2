-- v5: Per-project viewer mode toggle (Sketchfab vs Scene Editor / R3F)
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS viewer_mode TEXT
    CHECK (viewer_mode IN ('sketchfab', 'r3f'))
    DEFAULT NULL;

-- NULL means legacy auto-detect: use r3f if model_url is set, else sketchfab.
-- Set to 'sketchfab' or 'r3f' for explicit control.
