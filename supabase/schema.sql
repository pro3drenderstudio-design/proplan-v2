-- =============================================================================
-- ProPlan Studio — Core Schema Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Order matters: projects → categories → options → geometry_rules
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. projects
--    One row per house model. The sketchfab_uid drives which 3D model loads.
-- -----------------------------------------------------------------------------
create table if not exists projects (
  id               uuid           primary key default gen_random_uuid(),
  name             text           not null,
  sketchfab_uid    text           not null unique,
  base_price       numeric(12, 2) not null default 0,
  beds             smallint       not null default 0 check (beds >= 0),
  baths            numeric(3, 1)  not null default 0 check (baths >= 0),
  camera_defaults  jsonb          not null default '{}'::jsonb,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now()
);

-- camera_defaults shape (stored as JSONB):
-- {
--   "blueprint": { "pos": [0, 20, 0], "target": [0, 0, 0], "fov": 60 },
--   "interior":  { "pos": [0, 2, 5],  "target": [0, 1, 0], "fov": 75 },
--   "exterior":  { "pos": [10, 5, 15],"target": [0, 2, 0], "fov": 65 }
-- }

comment on table  projects                  is 'Top-level house models available in the configurator.';
comment on column projects.sketchfab_uid    is 'Sketchfab model UID used to initialise the viewer iframe.';
comment on column projects.base_price       is 'Starting price before any option selections are applied.';
comment on column projects.camera_defaults  is 'Per-phase camera positions. Shape: { blueprint, interior, exterior } each with pos[], target[], fov.';

-- Auto-update updated_at on every write
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. categories
--    Option groups scoped to a project and a phase.
--    e.g. "Flooring" (interior), "Garage Type" (exterior)
-- -----------------------------------------------------------------------------
create table if not exists categories (
  id               uuid        primary key default gen_random_uuid(),
  project_id       uuid        not null references projects (id) on delete cascade,
  name             text        not null,
  phase            text        not null
                    check (phase in ('blueprint', 'interior', 'exterior')),
  default_option   text,       -- marketing_name of the pre-selected option (nullable)
  is_mandatory     boolean     not null default false,
  camera_override  jsonb,      -- optional close-up camera when this category is active
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now()
);

-- camera_override shape (same as camera_defaults phases):
-- { "pos": [1.2, 1.5, 0.8], "target": [1.2, 1.0, 0.4], "fov": 40 }

comment on table  categories                  is 'Option groups belonging to a project, scoped to a configurator phase.';
comment on column categories.default_option   is 'marketing_name of the option pre-selected on load. Null = no default.';
comment on column categories.is_mandatory     is 'If true, the user must select an option before proceeding.';
comment on column categories.camera_override  is 'Moves the camera to a close-up when this category panel is open.';

create index idx_categories_project_phase on categories (project_id, phase, sort_order);


-- -----------------------------------------------------------------------------
-- 3. options
--    Individual selectable choices within a category.
--    node_list maps directly to Sketchfab node names.
-- -----------------------------------------------------------------------------
create table if not exists options (
  id               uuid           primary key default gen_random_uuid(),
  category_id      uuid           not null references categories (id) on delete cascade,
  friendly_name    text           not null,
  node_list        text[]         not null default '{}',
  price_impact     numeric(10, 2) not null default 0,
  sort_order       integer        not null default 0,
  created_at       timestamptz    not null default now()
);

comment on table  options               is 'Selectable options within a category.';
comment on column options.friendly_name is 'User-facing label shown in the UI panel (e.g. "Ash Grey").';
comment on column options.node_list     is 'Sketchfab node names shown when this option is active. Maps to instance.show().';
comment on column options.price_impact  is 'Dollar delta applied to the project base_price. Negative = discount.';

create index idx_options_category on options (category_id, sort_order);


-- -----------------------------------------------------------------------------
-- 4. geometry_rules
--    Node-level dependency/conflict rules scoped to a project.
--    e.g. "If Side Load Garage is selected, hide Front Load Garage nodes"
-- -----------------------------------------------------------------------------
create table if not exists geometry_rules (
  id                  uuid        primary key default gen_random_uuid(),
  project_id          uuid        not null references projects (id) on delete cascade,
  node_id             text        not null,    -- Sketchfab node name this rule targets
  parent_option_name  text        not null,    -- friendly_name of the option that triggers this rule
  action              text        not null default 'hide'
                        check (action in ('hide', 'show')),
  context             text,                    -- free-text note, e.g. "conflicts with front-load"
  created_at          timestamptz not null default now()
);

comment on table  geometry_rules                     is 'Node visibility rules triggered by an option selection.';
comment on column geometry_rules.node_id             is 'Sketchfab node name to show or hide when the rule fires.';
comment on column geometry_rules.parent_option_name  is 'The friendly_name of the option whose selection triggers this rule.';
comment on column geometry_rules.action              is 'hide or show.';
comment on column geometry_rules.context             is 'Optional human-readable note about why this rule exists.';

create index idx_geometry_rules_project    on geometry_rules (project_id);
create index idx_geometry_rules_option     on geometry_rules (parent_option_name);


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table projects        enable row level security;
alter table categories      enable row level security;
alter table options         enable row level security;
alter table geometry_rules  enable row level security;

-- Configurator (anon key) can read everything
create policy "Public read projects"       on projects       for select using (true);
create policy "Public read categories"     on categories     for select using (true);
create policy "Public read options"        on options        for select using (true);
create policy "Public read geometry_rules" on geometry_rules for select using (true);

-- Only authenticated users (admin dashboard / service role) can write
create policy "Auth write projects"        on projects       for all using (auth.role() = 'authenticated');
create policy "Auth write categories"      on categories     for all using (auth.role() = 'authenticated');
create policy "Auth write options"         on options        for all using (auth.role() = 'authenticated');
create policy "Auth write geometry_rules"  on geometry_rules for all using (auth.role() = 'authenticated');
