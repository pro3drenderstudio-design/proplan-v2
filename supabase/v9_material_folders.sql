-- v9: material folders for library organisation
-- Folders are free-form buckets (e.g. "Smith Residence", "Standard Library")
-- category on material_library remains the PBR-type label (Exterior, Flooring, etc.)

CREATE TABLE IF NOT EXISTS material_folders (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE material_library
  ADD COLUMN IF NOT EXISTS folder_id uuid
    REFERENCES material_folders(id) ON DELETE SET NULL;

COMMENT ON TABLE  material_folders               IS 'Free-form organisational folders for the material library';
COMMENT ON COLUMN material_library.folder_id     IS 'Optional folder grouping; NULL = unfiled';
