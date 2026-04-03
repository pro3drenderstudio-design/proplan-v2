-- =============================================================================
-- variable_map
-- Direct mirror of the Bubble Variable Map table.
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

create table if not exists variable_map (
  id               uuid           primary key default gen_random_uuid(),
  marketing_name   text           not null,
  node_names       text[]         not null default '{}',
  price_impact     numeric(10, 2) not null default 0,
  category         text           not null,
  created_at       timestamptz    not null default now()
);

comment on table  variable_map                  is 'Selectable options migrated from the Bubble Variable Map.';
comment on column variable_map.marketing_name   is 'User-facing label shown in the configurator panel.';
comment on column variable_map.node_names       is 'Sketchfab node names shown/hidden when this option is active.';
comment on column variable_map.price_impact     is 'Dollar amount added to the running total. Negative values are discounts.';
comment on column variable_map.category         is 'Groups related options, e.g. "Flooring", "Garage Type".';

-- Index for the most common query pattern: fetch all options for a category
create index idx_variable_map_category on variable_map (category);

-- RLS
alter table variable_map enable row level security;

create policy "Public can read variable_map"
  on variable_map for select using (true);

create policy "Auth users manage variable_map"
  on variable_map for all using (auth.role() = 'authenticated');
