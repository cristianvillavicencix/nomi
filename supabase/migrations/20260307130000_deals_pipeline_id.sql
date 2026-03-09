alter table if exists public.deals
add column if not exists pipeline_id text;

update public.deals
set pipeline_id = 'default'
where pipeline_id is null;

alter table if exists public.deals
alter column pipeline_id set default 'default';

alter table if exists public.deals
alter column pipeline_id set not null;

create index if not exists deals_pipeline_id_idx on public.deals (pipeline_id);
