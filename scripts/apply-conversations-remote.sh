#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$ROOT/scripts/apply-conversations-chat.sql"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Missing SUPABASE_DB_PASSWORD."
  echo "Get it from Supabase → Project Settings → Database → Database password"
  echo ""
  echo "Then run:"
  echo "  SUPABASE_DB_PASSWORD='your-password' $0"
  exit 1
fi

cd "$ROOT"
npx supabase db query --linked --yes -f "$SQL_FILE"

echo "Conversations chat SQL applied successfully."
