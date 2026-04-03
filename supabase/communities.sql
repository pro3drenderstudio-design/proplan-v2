-- ── Communities ──────────────────────────────────────────────────────────────
-- A community is a development with multiple lots, each optionally tied to a
-- home model (project). The site_map_url holds a bird's-eye plan image.

CREATE TABLE IF NOT EXISTS communities (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_slug text        REFERENCES builders(company_slug) ON DELETE SET NULL,
  name         text        NOT NULL,
  slug         text        NOT NULL,
  description  text,
  site_map_url text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS communities_slug_idx ON communities(company_slug, slug);

-- ── Lots ─────────────────────────────────────────────────────────────────────
-- Each lot belongs to a community. polygon is a JSONB array of [x, y] pairs
-- expressed as percentages (0–100) of the site map image dimensions.

CREATE TABLE IF NOT EXISTS lots (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  lot_number   text        NOT NULL,
  status       text        NOT NULL DEFAULT 'available'
                           CHECK (status IN ('available', 'reserved', 'sold')),
  project_id   uuid        REFERENCES projects(id) ON DELETE SET NULL,
  polygon      jsonb       NOT NULL DEFAULT '[]',
  price_modifier integer   DEFAULT 0,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Buyer-facing pages read communities/lots anonymously.
-- All writes go through the service-role API routes (bypass RLS).

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communities_public_read" ON communities
  FOR SELECT USING (true);

CREATE POLICY "lots_public_read" ON lots
  FOR SELECT USING (true);
