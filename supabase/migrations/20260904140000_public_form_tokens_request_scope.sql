-- Store form request scope on the token so share URLs stay short (/f/{code})
-- instead of encoding sections/services in the query string.
alter table public.public_form_tokens
  add column if not exists request_scope jsonb;

comment on column public.public_form_tokens.request_scope is
  'Optional share scope: { sections: string[], presetServices?: string[] }';
