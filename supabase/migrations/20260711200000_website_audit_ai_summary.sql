-- AI-generated executive summary for completed website audits (Claude via Edge Function).

alter table public.website_audits
  add column if not exists ai_summary_status text,
  add column if not exists ai_summary_json jsonb,
  add column if not exists ai_summary_error text,
  add column if not exists ai_summary_generated_at timestamptz;

alter table public.website_audits
  drop constraint if exists website_audits_ai_summary_status_check;

alter table public.website_audits
  add constraint website_audits_ai_summary_status_check
  check (
    ai_summary_status is null
    or ai_summary_status in ('pending', 'running', 'done', 'failed', 'skipped')
  );

comment on column public.website_audits.ai_summary_status is
  'Claude summary lifecycle: pending → running → done | failed | skipped.';
comment on column public.website_audits.ai_summary_json is
  'Structured AI summary: executive_summary, priority_actions, highlights, etc.';
comment on column public.website_audits.ai_summary_error is
  'Last error when ai_summary_status is failed or skipped.';
comment on column public.website_audits.ai_summary_generated_at is
  'When ai_summary_json was last generated successfully.';
