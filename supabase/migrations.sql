-- =============================================================================
-- ProPlan Studio — Supabase Schema
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New Query)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. option_groups
--    Represents a category of choices shown in the UI panel.
--    e.g. "Flooring", "Garage Type", "Roof Style"
-- -----------------------------------------------------------------------------
create table if not exists option_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,             -- display label, e.g. "Flooring"
  phase       text        not null              -- which phase this group appears in
                check (phase in ('blueprint', 'interior', 'exterior')),
  sort_order  integer     not null default 0,   -- ascending order in the UI panel
  created_at  timestamptz not null default now()
);

comment on table  option_groups              is 'UI groupings of configurable options, scoped to a phase.';
comment on column option_groups.phase        is 'One of: blueprint, interior, exterior.';
comment on column option_groups.sort_order   is 'Controls display order within a phase panel (0 = first).';

create index idx_option_groups_phase on option_groups (phase, sort_order);


-- -----------------------------------------------------------------------------
-- 2. variables
--    Mirrors the Bubble "Variable Map". Each row is a single selectable option
--    (e.g. "Ash Grey Flooring", "Side Load Garage").
-- -----------------------------------------------------------------------------
create table if not exists variables (
  id               uuid        primary key default gen_random_uuid(),
  group_id         uuid        not null references option_groups (id) on delete cascade,
  marketing_name   text        not null,             -- label shown to the end user
  node_names       text[]      not null default '{}',-- Sketchfab nodes toggled by this option
  price_impact     numeric(10, 2) not null default 0,-- positive = adds cost, negative = discount
  is_default       boolean     not null default false,-- pre-selected when the group first loads
  sort_order       integer     not null default 0,
  created_at       timestamptz not null default now()
);

comment on table  variables                    is 'Selectable options within an option_group.';
comment on column variables.node_names         is 'Array of Sketchfab node names shown/hidden when this option is active.';
comment on column variables.price_impact       is 'Dollar amount added to the running total. Use negative values for discounts.';
comment on column variables.is_default         is 'If true, this option is selected by default when the configurator loads.';

create index idx_variables_group on variables (group_id, sort_order);


-- -----------------------------------------------------------------------------
-- 3. geometry_rules
--    Dependency / conflict rules between variables.
--    e.g. "If Side Load Garage is selected → hide Front Load Garage nodes"
--
--    action:
--      'hide'  — hide the target variable's nodes when the trigger is selected
--      'show'  — force-show the target variable's nodes when the trigger is selected
--      'require' — auto-select the target variable when the trigger is selected
--      'exclude' — deselect / prevent the target variable when the trigger is selected
-- -----------------------------------------------------------------------------
create type geometry_rule_action as enum ('hide', 'show', 'require', 'exclude');

create table if not exists geometry_rules (
  id                  uuid        primary key default gen_random_uuid(),
  trigger_variable_id uuid        not null references variables (id) on delete cascade,
  target_variable_id  uuid        not null references variables (id) on delete cascade,
  action              geometry_rule_action not null,
  created_at          timestamptz not null default now(),

  -- A trigger+target+action combination must be unique
  constraint uq_geometry_rule unique (trigger_variable_id, target_variable_id, action),
  -- A variable cannot trigger a rule against itself
  constraint chk_no_self_rule check (trigger_variable_id <> target_variable_id)
);

comment on table  geometry_rules                      is 'Dependency rules between variables (e.g. conflict, requirement).';
comment on column geometry_rules.trigger_variable_id  is 'The variable whose selection activates this rule.';
comment on column geometry_rules.target_variable_id   is 'The variable affected when the rule fires.';
comment on column geometry_rules.action               is 'hide | show | require | exclude';

create index idx_geometry_rules_trigger on geometry_rules (trigger_variable_id);
create index idx_geometry_rules_target  on geometry_rules (target_variable_id);


-- -----------------------------------------------------------------------------
-- Row Level Security
-- Enable RLS on all tables. The anon key can read; only authenticated users
-- (your admin dashboard) can insert/update/delete.
-- -----------------------------------------------------------------------------
alter table option_groups    enable row level security;
alter table variables        enable row level security;
alter table geometry_rules   enable row level security;

-- Public read (the configurator iframe is unauthenticated)
create policy "Public can read option_groups"  on option_groups  for select using (true);
create policy "Public can read variables"      on variables      for select using (true);
create policy "Public can read geometry_rules" on geometry_rules for select using (true);

-- Authenticated write (Supabase dashboard / admin service role)
create policy "Auth users manage option_groups"  on option_groups  for all using (auth.role() = 'authenticated');
create policy "Auth users manage variables"      on variables      for all using (auth.role() = 'authenticated');
create policy "Auth users manage geometry_rules" on geometry_rules for all using (auth.role() = 'authenticated');


-- -----------------------------------------------------------------------------
-- Sample data — delete before going to production
-- -----------------------------------------------------------------------------
do $$
declare
  grp_flooring   uuid;
  grp_garage     uuid;
  var_ash        uuid;
  var_oak        uuid;
  var_side_load  uuid;
  var_front_load uuid;
begin
  -- option_groups
  insert into option_groups (name, phase, sort_order) values ('Flooring',    'interior', 1) returning id into grp_flooring;
  insert into option_groups (name, phase, sort_order) values ('Garage Type', 'exterior', 2) returning id into grp_garage;

  -- variables for Flooring
  insert into variables (group_id, marketing_name, node_names, price_impact, is_default) values
    (grp_flooring, 'Ash Grey',   '{Flooring_AshGrey}',  0,    true)  returning id into var_ash;
  insert into variables (group_id, marketing_name, node_names, price_impact) values
    (grp_flooring, 'Oak Timber', '{Flooring_OakTimber}', 1200) returning id into var_oak;

  -- variables for Garage
  insert into variables (group_id, marketing_name, node_names, price_impact, is_default) values
    (grp_garage, 'Front Load', '{Garage_FrontLoad}', 0,    true)  returning id into var_front_load;
  insert into variables (group_id, marketing_name, node_names, price_impact) values
    (grp_garage, 'Side Load',  '{Garage_SideLoad}',  3500) returning id into var_side_load;

  -- geometry_rule: selecting Side Load hides Front Load nodes
  insert into geometry_rules (trigger_variable_id, target_variable_id, action) values
    (var_side_load, var_front_load, 'hide');

  -- geometry_rule: selecting Front Load hides Side Load nodes
  insert into geometry_rules (trigger_variable_id, target_variable_id, action) values
    (var_front_load, var_side_load, 'hide');
end $$;
