alter table public.form_instances
  add column if not exists custom_font_url text,
  add column if not exists custom_css text;

comment on column public.form_instances.custom_font_url is
  'Optional Google Fonts or other stylesheet URL applied on the public form';
comment on column public.form_instances.custom_css is
  'Optional sanitized custom CSS injected on the public form page';
