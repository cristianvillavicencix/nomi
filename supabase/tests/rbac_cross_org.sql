-- Cross-org RLS: every sensitive policy must pin org_id to current_user_org_id().
-- Run on staging: psql or Supabase SQL editor.

select c.relname as table,
       p.polname as policy,
       pg_get_expr(p.polqual, p.polrelid) as using_expr
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('client_invoices', 'tickets', 'deals')
  and p.polqual is not null
  and pg_get_expr(p.polqual, p.polrelid) not like '%current_user_org_id()%';

-- Expect zero rows. A leftover policy without org pin is a cross-tenant leak.
