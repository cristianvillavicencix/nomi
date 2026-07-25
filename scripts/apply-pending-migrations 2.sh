#!/usr/bin/env bash
# Apply pending local migrations to the linked hosted Supabase project.
# Drops summary views before migrations that replace them without DROP (Postgres limitation).

set -euo pipefail
cd "$(dirname "$0")/.."

PENDING_FILE="${1:-/tmp/pending_local_migrations.txt}"
if [[ ! -f "$PENDING_FILE" ]]; then
  npx supabase migration list --linked 2>/dev/null | awk -F '|' '
    NR>2 {
      local=$1; remote=$2
      gsub(/ /, "", local); gsub(/ /, "", remote)
      if (local != "" && remote == "") print local
    }
  ' | sort -u > "$PENDING_FILE"
fi

query_bool() {
  npx supabase db query --linked "$1" 2>/dev/null | python3 -c "
import sys, json, re
t = sys.stdin.read()
m = re.search(r'\{.*\}', t, re.S)
if not m:
    print('0')
    raise SystemExit
rows = json.loads(m.group()).get('rows', [{}])
val = rows[0].get('exists') if rows else None
print('1' if val in (True, 't', 'true', 1, '1') else '0')
" || echo 0
}

PUBLIC_TABLES_FILE=/tmp/nomi_public_tables.txt
refresh_public_tables() {
  npx supabase db query --linked "select tablename from pg_tables where schemaname='public' order by 1;" 2>/dev/null | python3 -c "
import sys, json, re
t = sys.stdin.read()
m = re.search(r'\{.*\}', t, re.S)
rows = json.loads(m.group()).get('rows', []) if m else []
open('$PUBLIC_TABLES_FILE', 'w').write('\n'.join(r['tablename'] for r in rows))
" || true
}
refresh_public_tables

apply_sql_file() {
  local version="$1"
  local file="$2"
  local tmp
  tmp=$(mktemp)
  cp "$file" "$tmp"

  if grep -qi 'create or replace view public\.contacts_summary' "$tmp" \
    && ! grep -qi 'drop view if exists public\.contacts_summary' "$tmp"; then
    {
      echo 'drop view if exists public.contacts_summary cascade;'
      cat "$tmp"
    } > "${tmp}.wrapped" && mv "${tmp}.wrapped" "$tmp"
  fi

  if grep -qi 'create or replace view public\.companies_summary' "$tmp" \
    && ! grep -qi 'drop view if exists public\.companies_summary' "$tmp"; then
    {
      echo 'drop view if exists public.companies_summary cascade;'
      cat "$tmp"
    } > "${tmp}.wrapped" && mv "${tmp}.wrapped" "$tmp"
  fi

  python3 - "$tmp" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path).read()
drops = []
for view in re.findall(r'create or replace view public\.([a-z_][a-z0-9_]*)', text, flags=re.I):
    if re.search(rf'drop view if exists public\.{view}\b', text, flags=re.I):
        continue
    drops.append(f'drop view if exists public.{view} cascade;')
if drops:
    text = '\n'.join(drops) + '\n' + text
open(path, 'w').write(text)
PY

  if grep -q 'alter table public\.people' "$tmp"; then
    if [[ "$(query_bool "select to_regclass('public.people') is not null as exists;")" != "1" ]]; then
      awk '
        /^alter table public\.people/ { skip=1; next }
        skip && /^[[:space:]]*add column/ { next }
        skip && /^[[:space:]]*;/ { skip=0; next }
        { print }
      ' "$tmp" > "${tmp}.no_people" && mv "${tmp}.no_people" "$tmp"
    fi
  fi

  if [[ "$(query_bool "select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='current_user_person_id') as exists;")" != "1" ]] \
    && grep -q 'current_user_person_id' "$tmp"; then
    sed -i '' '/or public\.current_user_person_id()/d' "$tmp" 2>/dev/null || \
      sed -i '/or public\.current_user_person_id()/d' "$tmp"
  fi

  sed -i '' 's/drop function if exists public\.user_can_access_conversation(bigint);/drop function if exists public.user_can_access_conversation(bigint) cascade;/g' "$tmp" 2>/dev/null || \
    sed -i 's/drop function if exists public\.user_can_access_conversation(bigint);/drop function if exists public.user_can_access_conversation(bigint) cascade;/g' "$tmp"

  if [[ "$(query_bool "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='task_tag_notifications' and column_name='person_id') as exists;")" != "1" ]]; then
    python3 - "$tmp" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path).read()
text = re.sub(
    r"\s+and \(\s*task_tag_notifications\.person_id is null\s*or exists \(\s*select 1\s*from public\.people p\s*where p\.id = task_tag_notifications\.person_id\s*and p\.org_id = public\.current_user_org_id\(\)\s*\)\s*\)",
    "",
    text,
    flags=re.S,
)
open(path, "w").write(text)
PY
  fi

  if [[ "$(query_bool "select to_regclass('public.people') is not null as exists;")" != "1" ]]; then
    python3 - "$tmp" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path).read()
text = re.sub(
    r"alter table if exists public\.calendar_events\s+add column if not exists person_id bigint references public\.people\(id\)[^;]*;",
    "-- skipped: people table removed",
    text,
    flags=re.S,
)
open(path, "w").write(text)
PY
  fi

  if grep -q 'project_resources_wizard' "$tmp"; then
    python3 - "$tmp" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path).read()
text = (
    "delete from public.form_templates a using public.form_templates b "
    "where a.slug = b.slug and a.org_id is not distinct from b.org_id and a.id > b.id;\n"
    + text
)
text = re.sub(
    r"from public\.organizations o\s+cross join public\.form_templates t\s+where t\.slug = 'project_resources_wizard'\s+and t\.is_system = true",
    "from public.organizations o\n"
    "join lateral (\n"
    "  select id, schema from public.form_templates\n"
    "  where slug = 'project_resources_wizard' and is_system = true\n"
    "  order by id\n"
    "  limit 1\n"
    ") t on true",
    text,
    flags=re.S,
)
open(path, "w").write(text)
PY
  fi

  if grep -q 'pg_cron' "$tmp" && [[ "$(query_bool "select exists(select 1 from pg_extension where extname='pg_cron') as exists;")" == "1" ]]; then
    sed -i '' '/create extension if not exists pg_cron/d' "$tmp" 2>/dev/null || sed -i '/create extension if not exists pg_cron/d' "$tmp"
    sed -i '' '/grant usage on schema cron/d' "$tmp" 2>/dev/null || sed -i '/grant usage on schema cron/d' "$tmp"
    sed -i '' '/grant all privileges on all tables in schema cron/d' "$tmp" 2>/dev/null || sed -i '/grant all privileges on all tables in schema cron/d' "$tmp"
  fi

  if grep -q 'pg_net' "$tmp" && [[ "$(query_bool "select exists(select 1 from pg_extension where extname='pg_net') as exists;")" == "1" ]]; then
    sed -i '' '/create extension if not exists pg_net/d' "$tmp" 2>/dev/null || sed -i '/create extension if not exists pg_net/d' "$tmp"
  fi

  if grep -q 'cron.schedule' "$tmp"; then
    python3 - "$tmp" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path).read()
text = re.sub(
    r'\$\$\s*(select\s+public\.[^$]+?;\s*)\$\$',
    r'$cron$\1$cron$',
    text,
    flags=re.S | re.I,
)
open(path, 'w').write(text)
PY
  fi

  python3 - "$tmp" "$PUBLIC_TABLES_FILE" <<'PY'
import re, sys
path, tables_file = sys.argv[1], sys.argv[2]
tables = set(open(tables_file).read().splitlines()) if open(tables_file).read().strip() else set()
text = open(path).read()
for table in sorted(set(re.findall(r'public\.([a-z_][a-z0-9_]*)', text)), key=len, reverse=True):
    if table in tables:
        continue
    text = re.sub(rf'alter table public\.{re.escape(table)}\b[^;]*;', '', text, flags=re.I)
    text = re.sub(rf'update public\.{re.escape(table)}\b[^;]*;', '', text, flags=re.I | re.S)
    text = re.sub(rf'drop trigger if exists [^\n]+ on public\.{re.escape(table)};', '', text, flags=re.I)
    text = re.sub(
        rf'create trigger [^\n]+\n\s*before insert on public\.{re.escape(table)}\b[^;]*;',
        '',
        text,
        flags=re.I | re.S,
    )
open(path, 'w').write(text)
PY

  echo "=== Applying $file ==="
  if npx supabase db query --linked --file "$tmp" >/tmp/migration_apply.log 2>&1; then
    echo "  applied $file"
  elif grep -qE 'already exists|duplicate key value|duplicate_object' /tmp/migration_apply.log; then
    echo "  idempotent skip $file"
  else
    echo "FAIL $version ($file)"
    tail -20 /tmp/migration_apply.log
    rm -f "$tmp"
    return 1
  fi
  rm -f "$tmp"
}

apply_one() {
  local version="$1"
  local files=()
  while IFS= read -r f; do
    files+=("$f")
  done < <(ls supabase/migrations/"${version}"_*.sql 2>/dev/null | sort)

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "SKIP missing file for $version"
    return 0
  fi

  for file in "${files[@]}"; do
    if ! apply_sql_file "$version" "$file"; then
      return 1
    fi
  done

  npx supabase migration repair "$version" --status applied --linked --yes >/dev/null
  echo "OK $version"
}

failed=0
while IFS= read -r version; do
  [[ -z "$version" ]] && continue
  if ! apply_one "$version"; then
    failed=1
    echo "Stopped at $version"
    break
  fi
done < "$PENDING_FILE"

if [[ "$failed" -eq 0 ]]; then
  echo "All pending migrations applied."
fi

exit "$failed"
