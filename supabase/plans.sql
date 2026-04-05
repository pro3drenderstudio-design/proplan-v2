-- plans
-- Defines subscription plan tiers and their limits.
-- Editable from /admin/plans — changes affect new subscriptions + monthly credit resets.

create table plans (
  id                          uuid primary key default gen_random_uuid(),
  name                        text unique not null,        -- 'launch', 'studio', 'scale'
  display_name                text not null,               -- 'Launch', 'Studio', 'Scale'
  price_monthly               int not null,                -- cents
  price_annually              int not null,                -- cents (full year)
  rendering_credits_monthly   int not null default 15,     -- traditional renders / mo
  ai_credits_monthly          int not null default 150,    -- AI renders / mo
  max_projects                int not null default 2,      -- -1 = unlimited
  seats_included              int not null default 1,
  max_storage_gb              int not null default 5,
  includes_sitemaps           boolean not null default false,
  stripe_price_id_monthly     text,
  stripe_price_id_annually    text,
  is_active                   boolean not null default true,
  sort_order                  int not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create or replace function update_plans_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_plans_updated_at
  before update on plans
  for each row execute function update_plans_updated_at();

-- RLS: read-only public, writes via service-role only
alter table plans enable row level security;
create policy "Public read plans" on plans for select using (true);

-- ── Seed data ─────────────────────────────────────────────────────────────────

insert into plans (name, display_name, price_monthly, price_annually, rendering_credits_monthly, ai_credits_monthly, max_projects, seats_included, max_storage_gb, includes_sitemaps, sort_order)
values
  ('launch', 'Launch', 69900, 696840,  15,   150,  2,  2,  10,  false, 1),
  ('studio', 'Studio', 149900, 1499880, 50,  400,  5,  5,  25,  true,  2),
  ('scale',  'Scale',  249900, 2499000, -1,  1000, -1, 15, 100, true,  3);

-- ── Stripe fields + plan_id on builders ──────────────────────────────────────
-- Run these alters to add Stripe and plan linkage to builders.

alter table builders
  add column if not exists stripe_customer_id        text unique,
  add column if not exists stripe_subscription_id    text unique,
  add column if not exists stripe_subscription_status text default 'trialing',
  add column if not exists current_period_end         timestamptz,
  add column if not exists plan_id                   uuid references plans(id) on delete set null;

-- Note: team_members.role is a plain text column — no enum to extend.
