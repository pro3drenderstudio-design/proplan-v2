-- ─────────────────────────────────────────────────────────────────────────────
-- v11: Modular Addon System
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. addons catalog ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addons (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      TEXT UNIQUE NOT NULL,
  name                      TEXT NOT NULL,
  description               TEXT,
  monthly_price_cents       INT  NOT NULL DEFAULT 0,
  included_units            INT,                        -- NULL = unlimited
  unit_label                TEXT,                       -- 'renders' | 'AI credits'
  overage_block_size        INT,
  overage_block_price_cents INT,
  setup_fee_cents           INT  NOT NULL DEFAULT 0,    -- per-request fee (site-maps)
  stripe_price_id_monthly   TEXT,
  stripe_price_id_annually  TEXT,
  show_when_locked          BOOLEAN NOT NULL DEFAULT true,
  sort_order                INT     NOT NULL DEFAULT 0,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the four defined services
INSERT INTO addons (slug, name, description, monthly_price_cents, included_units, unit_label,
                    overage_block_size, overage_block_price_cents, setup_fee_cents, sort_order)
VALUES
  ('configurator',
   '3D Home Configurator',
   'Interactive 3D home configurator embedded on your website. Buyers design their home in real time.',
   49900, NULL, NULL, NULL, NULL, 100000, 1),

  ('ai-renders',
   'AI Render Studio',
   'Generate AI-powered renders of any home model instantly. Includes 250 credits/month.',
   15000, 250, 'AI credits', 75, 5000, 0, 2),

  ('site-maps',
   'Interactive Site Maps',
   'Interactive plat maps showing live lot availability. Buyers click lots and explore.',
   49900, NULL, NULL, NULL, NULL, 50000, 3),

  ('traditional-renders',
   'Traditional 3D Renders',
   'Professional studio-rendered exteriors and interiors. Includes 10 renders/month.',
   50000, 10, 'renders', NULL, NULL, 0, 4)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. builder_addons (which addons each builder has subscribed to) ──────────
CREATE TABLE IF NOT EXISTS builder_addons (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id                  UUID NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  addon_slug                  TEXT NOT NULL REFERENCES addons(slug),
  stripe_subscription_item_id TEXT,
  status                      TEXT NOT NULL DEFAULT 'active',  -- active|canceled|past_due
  credits_remaining           INT,
  credits_reset_at            TIMESTAMPTZ,
  activated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(builder_id, addon_slug)
);

CREATE INDEX IF NOT EXISTS builder_addons_builder_id_idx ON builder_addons(builder_id);

-- ── 3. site_map_requests ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_map_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id          UUID NOT NULL REFERENCES builders(id) ON DELETE CASCADE,
  community_name      TEXT NOT NULL,
  community_address   TEXT,
  estimated_lot_count INT,
  phases              INT  NOT NULL DEFAULT 1,
  plat_map_files      JSONB NOT NULL DEFAULT '[]',
  reference_links     JSONB NOT NULL DEFAULT '[]',
  style_notes         TEXT,
  target_date         DATE,
  status              TEXT NOT NULL DEFAULT 'awaiting_payment',
  -- awaiting_payment | pending_review | in_progress | complete | archived
  setup_fee_cents     INT  NOT NULL,   -- snapshotted from addons.setup_fee_cents at request time
  stripe_session_id   TEXT,
  community_id        UUID REFERENCES communities(id) ON DELETE SET NULL,
  admin_notes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_map_requests_builder_id_idx ON site_map_requests(builder_id);
CREATE INDEX IF NOT EXISTS site_map_requests_status_idx     ON site_map_requests(status);

-- ── 4. crm_integrations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id   UUID NOT NULL REFERENCES builders(id) ON DELETE CASCADE UNIQUE,
  crm_type     TEXT NOT NULL,  -- 'hubspot'|'followupboss'|'zapier'|'lasso'|'csv'
  api_key      TEXT,
  webhook_url  TEXT,
  portal_id    TEXT,
  config       JSONB NOT NULL DEFAULT '{}',
  enabled      BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. extend lots with custom CTA fields ────────────────────────────────────
ALTER TABLE lots
  ADD COLUMN IF NOT EXISTS cta_type  TEXT NOT NULL DEFAULT 'configurator',
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS cta_url   TEXT;
-- cta_type: 'configurator' | 'external' | 'contact' | 'none'

-- ── 6. updated_at triggers for new tables ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_addons') THEN
    CREATE TRIGGER set_updated_at_addons
      BEFORE UPDATE ON addons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_site_map_requests') THEN
    CREATE TRIGGER set_updated_at_site_map_requests
      BEFORE UPDATE ON site_map_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_crm_integrations') THEN
    CREATE TRIGGER set_updated_at_crm_integrations
      BEFORE UPDATE ON crm_integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
