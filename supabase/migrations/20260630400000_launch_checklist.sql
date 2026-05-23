-- Launch checklist items per deal + org templates (LBS web agency).

create table if not exists public.launch_checklist_templates (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  project_type text,
  category text not null check (
    category in (
      'seo',
      'analytics',
      'security',
      'performance',
      'content',
      'legal',
      'backup',
      'other'
    )
  ),
  label text not null,
  description text,
  is_required boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.deal_launch_checklist_items (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  category text not null check (
    category in (
      'seo',
      'analytics',
      'security',
      'performance',
      'content',
      'legal',
      'backup',
      'other'
    )
  ),
  label text not null,
  description text,
  is_required boolean not null default true,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by_member_id bigint references public.organization_members (id) on delete set null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists deal_launch_checklist_items_deal_idx
  on public.deal_launch_checklist_items (deal_id, order_index);
create index if not exists launch_checklist_templates_org_idx
  on public.launch_checklist_templates (org_id, project_type, order_index);

alter table public.launch_checklist_templates enable row level security;
alter table public.deal_launch_checklist_items enable row level security;

grant select, insert, update, delete on public.launch_checklist_templates to authenticated;
grant select, insert, update, delete on public.deal_launch_checklist_items to authenticated;

create policy "launch_checklist_templates_select"
  on public.launch_checklist_templates for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "launch_checklist_templates_mutate"
  on public.launch_checklist_templates for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "deal_launch_checklist_items_select"
  on public.deal_launch_checklist_items for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_launch_checklist_items_insert"
  on public.deal_launch_checklist_items for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "deal_launch_checklist_items_update"
  on public.deal_launch_checklist_items for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_launch_checklist_items_delete"
  on public.deal_launch_checklist_items for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  );

insert into public.launch_checklist_templates (
  org_id, project_type, category, label, description, is_required, order_index
)
select
  o.id,
  'website',
  t.category,
  t.label,
  t.description,
  t.is_required,
  t.order_index
from public.organizations o
cross join (
  values
    ('seo', 'Meta tags configured', 'Title, description, OG tags on key pages', true, 1),
    ('seo', 'Sitemap and robots.txt', 'Search engines can crawl the site', true, 2),
    ('analytics', 'GA4 / analytics installed', 'Tracking verified on production', true, 3),
    ('security', 'SSL active', 'HTTPS enforced on production domain', true, 4),
    ('performance', 'Core pages optimized', 'Images compressed, lazy loading enabled', true, 5),
    ('content', '404 and contact pages', 'Error page and contact details verified', true, 6),
    ('legal', 'Privacy / terms pages', 'Legal pages linked in footer', false, 7),
    ('backup', 'Backup configured', 'Restore process documented', true, 8)
) as t (category, label, description, is_required, order_index)
where not exists (
  select 1
  from public.launch_checklist_templates existing
  where existing.org_id = o.id
    and existing.project_type = 'website'
    and existing.label = t.label
);
