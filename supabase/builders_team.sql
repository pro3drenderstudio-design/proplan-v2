-- ============================================================
-- ProPlan Studio — Builders, Team Members & Auth Migration
-- Run this in Supabase SQL Editor.
-- ============================================================

-- builders table
CREATE TABLE IF NOT EXISTS builders (
  id                      uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name            text    NOT NULL,
  company_slug            text    UNIQUE NOT NULL,
  website_url             text,
  primary_contact_name    text,
  contact_email           text,
  phone                   text,
  plan_tier               text    DEFAULT 'starter',
  billing_cycle           text    DEFAULT 'monthly',
  billing_address         text,
  city                    text,
  state                   text,
  zip                     text,
  tax_id                  text,
  ein                     text,
  status                  text    DEFAULT 'active',
  location                text,
  notes                   text,
  logo_url                text,
  accent_color            text    DEFAULT '#3B82F6',
  billing_email           text,
  vat_tax_id              text,
  payment_method_last4    text,
  payment_method_type     text    DEFAULT 'Visa',
  payment_method_expiry   text,
  seats_included          integer DEFAULT 10,
  seats_used              integer DEFAULT 0,
  rendering_credits       integer DEFAULT 1250,
  rendering_credits_total integer DEFAULT 5000,
  max_projects            integer DEFAULT 25,
  max_monthly_quotes      integer DEFAULT 100,
  max_storage_gb          integer DEFAULT 50,
  active_projects_count   integer DEFAULT 0,
  monthly_quotes_count    integer DEFAULT 0,
  storage_used_gb         numeric DEFAULT 0,
  client_since            timestamp with time zone DEFAULT now(),
  created_at              timestamp with time zone DEFAULT now(),
  updated_at              timestamp with time zone DEFAULT now()
);

-- Add logo/accent if table already exists
ALTER TABLE builders ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE builders ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#3B82F6';

-- team_members table (covers both admin staff and builder staff)
CREATE TABLE IF NOT EXISTS team_members (
  id             uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name           text    NOT NULL,
  email          text    UNIQUE NOT NULL,
  role           text    DEFAULT 'viewer',
  permissions    jsonb   DEFAULT '{}',
  builder_id     uuid    REFERENCES builders(id) ON DELETE CASCADE,
  invite_token   text    UNIQUE,
  invite_status  text    DEFAULT 'pending',
  invite_sent_at timestamp with time zone,
  last_activity  timestamp with time zone DEFAULT now(),
  created_at     timestamp with time zone DEFAULT now()
);

-- Add invite columns if table already exists
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS builder_id uuid REFERENCES builders(id) ON DELETE CASCADE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_token text UNIQUE;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_status text DEFAULT 'pending';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invite_sent_at timestamp with time zone;

-- profiles table (links Supabase auth users to roles & builders)
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid    PRIMARY KEY,
  email          text,
  full_name      text,
  role           text    DEFAULT 'builder_member',
  builder_id     uuid    REFERENCES builders(id) ON DELETE SET NULL,
  team_member_id uuid    REFERENCES team_members(id) ON DELETE SET NULL,
  avatar_url     text,
  created_at     timestamp with time zone DEFAULT now()
);

-- Disable RLS on all (same pattern as existing tables)
ALTER TABLE builders      DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members  DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles      DISABLE ROW LEVEL SECURITY;

-- Seed builders from existing project company_slugs (optional, uncomment to run)
-- INSERT INTO builders (company_name, company_slug)
-- SELECT DISTINCT
--   initcap(replace(company_slug, '-', ' ')),
--   company_slug
-- FROM projects
-- WHERE company_slug IS NOT NULL
-- ON CONFLICT (company_slug) DO NOTHING;
