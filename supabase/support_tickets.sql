-- Support Tickets table
-- Run this in your Supabase SQL editor

create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  builder_name  text,
  builder_email text,
  subject       text not null,
  category      text not null default 'general',
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  message       text not null,
  status        text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to   text,
  admin_notes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for filtering by status
create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_created_at_idx on public.support_tickets(created_at desc);

-- RLS: allow service role full access; anon/authenticated read is blocked by default
alter table public.support_tickets enable row level security;

-- Allow the service role (API routes) to insert/update/select
-- Note: The support API route uses the service role key, so no explicit policy needed for service role.
-- Allow no direct client access (all operations go through the API route)
