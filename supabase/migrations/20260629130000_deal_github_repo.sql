alter table if exists public.deals
  add column if not exists github_repo text;

create index if not exists deals_github_repo_idx on public.deals (github_repo)
  where github_repo is not null;

comment on column public.deals.github_repo is 'GitHub repository slug (owner/repo) linked to this project';
