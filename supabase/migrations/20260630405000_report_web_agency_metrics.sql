-- Web agency KPIs for LBS reports.

create or replace view public.report_web_agency_metrics
with (security_invoker = true)
as
with monthly as (
  select
    org_id,
    date_trunc('month', created_at)::date as month,
    count(*) filter (where stage in ('closed_won', 'won', 'delivered')) as won_count,
    count(*) filter (where stage in ('closed_lost', 'lost')) as lost_count,
    count(*) as total_count,
    sum(coalesce(current_project_value, amount, 0)) filter (
      where stage in ('closed_won', 'won', 'delivered')
    ) as revenue_won
  from public.deals
  where archived_at is null
  group by org_id, date_trunc('month', created_at)
)
select
  org_id,
  month,
  won_count,
  lost_count,
  total_count,
  case
    when (won_count + lost_count) > 0
      then round(100.0 * won_count / (won_count + lost_count), 1)
    else null
  end as win_rate_percent,
  revenue_won
from monthly;

grant select on public.report_web_agency_metrics to authenticated;
