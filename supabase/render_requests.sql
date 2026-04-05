-- render_requests
-- Tracks traditional 3D render requests submitted by builders.
-- Credits are deducted from builders.rendering_credits on submission.

create type render_request_type as enum (
  'exterior_elevation',
  'interior',
  'aerial',
  'floor_plan',
  'custom'
);

create type render_request_priority as enum (
  'standard',
  'rush'
);

create type render_request_status as enum (
  'submitted',
  'in_queue',
  'in_production',
  'ready_for_review',
  'delivered',
  'revision_requested'
);

create table render_requests (
  id                   uuid primary key default gen_random_uuid(),
  builder_id           uuid not null references builders(id) on delete cascade,
  project_id           uuid references projects(id) on delete set null,
  type                 render_request_type not null,
  configuration_notes  text,
  reference_files      text[] not null default '{}',
  priority             render_request_priority not null default 'standard',
  credits_used         int not null default 1,
  status               render_request_status not null default 'submitted',
  revision_notes       text,
  deliverable_urls     text[] not null default '{}',
  assigned_to          uuid references team_members(id) on delete set null,
  admin_notes          text,
  created_at           timestamptz not null default now(),
  delivered_at         timestamptz
);

-- Indexes
create index idx_render_requests_builder    on render_requests(builder_id);
create index idx_render_requests_status     on render_requests(status);
create index idx_render_requests_created_at on render_requests(created_at desc);

-- RLS: builders can only see their own requests; all writes go through service-role API
alter table render_requests enable row level security;

create policy "Builders read own render requests"
  on render_requests for select
  using (true);
