alter table public.public_form_tokens
  add column if not exists short_code text;

create unique index if not exists idx_form_tokens_short_code
  on public.public_form_tokens (short_code)
  where short_code is not null;
