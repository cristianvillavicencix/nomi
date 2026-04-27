-- Add CASCADE on org_id FKs so deleting an organization removes all its tenant data.

-- organization_members
alter table public.organization_members drop constraint sales_org_id_fkey;
alter table public.organization_members
  add constraint organization_members_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- contacts
alter table public.contacts drop constraint contacts_org_id_fkey;
alter table public.contacts
  add constraint contacts_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- companies
alter table public.companies drop constraint companies_org_id_fkey;
alter table public.companies
  add constraint companies_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- deals
alter table public.deals drop constraint deals_org_id_fkey;
alter table public.deals
  add constraint deals_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- contact_notes
alter table public.contact_notes drop constraint contact_notes_org_id_fkey;
alter table public.contact_notes
  add constraint contact_notes_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- deal_notes
alter table public.deal_notes drop constraint deal_notes_org_id_fkey;
alter table public.deal_notes
  add constraint deal_notes_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- tasks
alter table public.tasks drop constraint tasks_org_id_fkey;
alter table public.tasks
  add constraint tasks_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;

-- tags
alter table public.tags drop constraint tags_org_id_fkey;
alter table public.tags
  add constraint tags_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete cascade;
