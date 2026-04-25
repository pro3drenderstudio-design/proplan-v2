-- v8: add max_communities to plans and builders
-- -1 = unlimited (default for existing plans)

alter table plans
  add column if not exists max_communities int not null default -1;

alter table builders
  add column if not exists max_communities   integer default -1,
  add column if not exists active_communities_count integer default 0;

-- Update active_communities_count from existing data
update builders b
set active_communities_count = (
  select count(*) from communities c where c.company_slug = b.company_slug
);

comment on column plans.max_communities    is '-1 = unlimited';
comment on column builders.max_communities is '-1 = unlimited; copied from plan on subscribe';
