-- v12: Interactive site map enhancements
-- Run in Supabase SQL editor

-- ── Communities: address + coordinates + extras ───────────────────────────────
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS city            TEXT,
  ADD COLUMN IF NOT EXISTS state           TEXT,
  ADD COLUMN IF NOT EXISTS zip             TEXT,
  ADD COLUMN IF NOT EXISTS latitude        NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude       NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS hoa_fee_monthly INT,
  ADD COLUMN IF NOT EXISTS school_district TEXT,
  ADD COLUMN IF NOT EXISTS gallery_images  JSONB NOT NULL DEFAULT '[]';

-- ── Lots: lot size, phase, multiple CTAs, completion date, virtual tour ────────
ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS lot_size_sqft        INT,
  ADD COLUMN IF NOT EXISTS lot_width_ft         INT,
  ADD COLUMN IF NOT EXISTS lot_depth_ft         INT,
  ADD COLUMN IF NOT EXISTS phase                INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ctas                 JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS estimated_completion DATE,
  ADD COLUMN IF NOT EXISTS virtual_tour_url     TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_id        UUID,
  ADD COLUMN IF NOT EXISTS is_coming_soon       BOOLEAN NOT NULL DEFAULT false;

-- ── Floor plans: builder-scoped home model catalog ────────────────────────────
CREATE TABLE IF NOT EXISTS floor_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id         UUID NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  beds               INT,
  baths              NUMERIC(3,1),
  floors             INT,
  sqft               INT,
  garage_spaces      INT,
  home_style         TEXT,   -- 'ranch' | 'two_story' | 'craftsman' | 'modern' | 'colonial' | 'cape_cod'
  base_price         INT,    -- cents
  thumbnail_url      TEXT,
  floor_plan_images  JSONB NOT NULL DEFAULT '[]',  -- [{url, label}]
  project_id         UUID REFERENCES projects(id) ON DELETE SET NULL,  -- optional 3D configurator link
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK from lots to floor_plans (deferred so lots table already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lots_floor_plan_id_fkey'
  ) THEN
    ALTER TABLE lots
      ADD CONSTRAINT lots_floor_plan_id_fkey
      FOREIGN KEY (floor_plan_id) REFERENCES floor_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS: builders can only see their own floor plans
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "builders_own_floor_plans" ON floor_plans
  USING (
    builder_id IN (
      SELECT builder_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Service role bypasses RLS — no separate policy needed for server-side routes
