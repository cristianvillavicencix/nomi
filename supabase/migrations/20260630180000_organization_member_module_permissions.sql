-- Fine-grained module toggles per org member (UI + frontend auth).
-- Nullable = legacy behaviour (derive from roles[]); non-null JSON = explicit modules.

alter table public.organization_members
  add column if not exists module_permissions jsonb;

comment on column public.organization_members.module_permissions is
  'Optional map of module keys to booleans. When set, frontend resolves access from this map and syncs roles[] for RLS. When null, roles[] alone drive access.';
