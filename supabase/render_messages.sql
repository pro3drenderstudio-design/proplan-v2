-- Render Messages — chat between builder and ProPlan Studio team on a render request
-- Run in Supabase SQL Editor

-- Add title to render_requests (for naming the render project)
alter table render_requests add column if not exists title text;

-- Add builder_id to renders (AI renders) so we can filter per-builder
alter table renders add column if not exists builder_id uuid references builders(id) on delete set null;

-- Chat messages table
create table if not exists render_messages (
  id                uuid        primary key default gen_random_uuid(),
  render_request_id uuid        not null references render_requests(id) on delete cascade,
  sender_type       text        not null check (sender_type in ('builder', 'admin')),
  sender_id         uuid        not null,
  sender_name       text        not null default 'Unknown',
  body              text,
  attachments       jsonb       not null default '[]',
  is_delivery       boolean     not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists idx_render_messages_request on render_messages(render_request_id, created_at);
alter table render_messages disable row level security;

-- Completion date proposal workflow
alter table render_requests
  add column if not exists proposed_completion_date  timestamptz,
  add column if not exists completion_date_status    text not null default 'none';

-- Drop and recreate the check constraint so it includes 'counter_proposed'.
-- Safe to run even on a fresh DB — IF NOT EXISTS / DROP IF EXISTS handle both cases.
alter table render_requests
  drop constraint if exists render_requests_completion_date_status_check;

alter table render_requests
  add constraint render_requests_completion_date_status_check
  check (completion_date_status in ('none', 'proposed', 'accepted', 'declined', 'counter_proposed'));
