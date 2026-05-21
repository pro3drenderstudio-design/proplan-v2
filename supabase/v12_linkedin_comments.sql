-- LinkedIn comment generator: persona + session history

CREATE TABLE linkedin_persona (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL DEFAULT 'Malik Adelaja',
  title                TEXT NOT NULL DEFAULT 'Founder',
  company              TEXT NOT NULL DEFAULT 'ProPlan Studio',
  company_description  TEXT NOT NULL DEFAULT 'ProPlan Studio builds 3D home configurators, interactive site maps, and AI render tools for home builders and real estate developers. We help builders give buyers an immersive, digital experience of their community before breaking ground.',
  expertise_areas      TEXT NOT NULL DEFAULT 'PropTech, Real Estate Technology, 3D Visualization, SaaS, B2B Sales, Startup Building',
  industries           TEXT NOT NULL DEFAULT 'Home Builders, Real Estate Developers, PropTech, SaaS, Startup/Founder, Sales & Marketing',
  writing_style        TEXT,
  personal_background  TEXT,
  recent_milestones    TEXT,
  hot_takes            TEXT,
  banned_phrases       TEXT NOT NULL DEFAULT 'Great post, This resonates, Couldn''t agree more, So true, Love this, Such a great point, Totally agree, Well said, Spot on, This is gold',
  extra_context        TEXT,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Seed with one default row
INSERT INTO linkedin_persona (id) VALUES (gen_random_uuid());

CREATE TABLE linkedin_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_snippet  TEXT,
  post_content  TEXT NOT NULL,
  style         TEXT NOT NULL,
  tone          TEXT NOT NULL DEFAULT 'measured',
  custom_angle  TEXT,
  generated     JSONB NOT NULL DEFAULT '[]',
  used_comment  TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_linkedin_sessions_created ON linkedin_sessions (created_at DESC);
