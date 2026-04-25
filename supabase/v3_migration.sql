-- =============================================================================
-- ProPlan Studio — v3 Migration
-- Run in Supabase SQL Editor after the base schema.
-- Adds: GLB model fields on projects, option_type on options,
--       material_library, saved_configurations tables.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. projects — add R3F / GLB viewer columns
-- ---------------------------------------------------------------------------
alter table projects
  add column if not exists model_url           text,
  add column if not exists model_storage_path  text,
  add column if not exists scene_graph         jsonb,
  add column if not exists env_preset          text default 'apartment',
  add column if not exists camera_defaults     jsonb default '{}';


-- ---------------------------------------------------------------------------
-- 2. options — add option_type, variant_name, material_id, created_at
-- ---------------------------------------------------------------------------
alter table options
  add column if not exists option_type   text not null default 'visibility'
    check (option_type in ('visibility', 'material_variant', 'material_override')),
  add column if not exists variant_name  text,
  add column if not exists material_id   uuid,
  add column if not exists created_at    timestamptz not null default now();


-- ---------------------------------------------------------------------------
-- 3. material_library — shared material assets for material_override options
-- ---------------------------------------------------------------------------
create table if not exists material_library (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  category        text,                        -- "Exterior", "Flooring", etc.
  base_color      text        not null default '#8b8b8b',
  roughness       numeric(4,3) not null default 0.5,
  metalness       numeric(4,3) not null default 0.0,
  normal_map_url  text,
  thumbnail_url   text,
  created_at      timestamptz not null default now()
);

alter table material_library enable row level security;

create policy "Public can read material_library"
  on material_library for select using (true);

create policy "Auth users manage material_library"
  on material_library for all using (auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- 4. saved_configurations — buyer portal shareable links
-- ---------------------------------------------------------------------------
create table if not exists saved_configurations (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references projects (id) on delete cascade,
  lead_id         uuid        references leads (id) on delete set null,
  token           text        not null unique,
  configuration   jsonb       not null default '{}',  -- categoryId → optionId
  total_price     numeric(12,2) not null default 0,
  phase_snapshot  text,
  lot_id          uuid,
  thumbnail_url   text,
  created_at      timestamptz not null default now(),
  accessed_at     timestamptz
);

create index idx_saved_configurations_token      on saved_configurations (token);
create index idx_saved_configurations_project    on saved_configurations (project_id);

alter table saved_configurations enable row level security;

-- Portal links are public-read (anyone with the token can view)
create policy "Public can read saved_configurations by token"
  on saved_configurations for select using (true);

create policy "Auth users manage saved_configurations"
  on saved_configurations for all using (auth.role() = 'authenticated');

-- Service-role inserts from the API route (anon key is not authenticated)
create policy "Service role can insert saved_configurations"
  on saved_configurations for insert with check (true);


-- ---------------------------------------------------------------------------
-- 5. FK from options.material_id → material_library.id
--    (added after material_library exists)
-- ---------------------------------------------------------------------------
alter table options
  add constraint fk_option_material
    foreign key (material_id) references material_library (id) on delete set null
  not valid;

alter table options validate constraint fk_option_material;
