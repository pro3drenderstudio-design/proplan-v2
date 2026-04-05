-- project_messages — chat between builder and ProPlan Studio on a configurator project
-- Run this in Supabase SQL Editor

create table if not exists project_messages (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references projects(id) on delete cascade,
  sender_type text        not null check (sender_type in ('builder', 'admin')),
  sender_id   uuid        not null,
  sender_name text        not null default 'Unknown',
  body        text,
  attachments jsonb       not null default '[]',
  created_at  timestamptz not null default now()
);

create index if not exists idx_project_messages_project on project_messages(project_id, created_at);
alter table project_messages disable row level security;

-- Add 'completed' to render_request_status enum (builder must accept delivery)
alter type render_request_status add value if not exists 'completed';
