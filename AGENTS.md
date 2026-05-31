# AGENTS.md

## Project Overview

Nomi CRM is a full-featured CRM built with React, shadcn-admin-kit, and Supabase. It provides contact management, task tracking, notes, email capture, and deal management with a Kanban board.

## Development Commands

### Setup
```bash
make install          # Install dependencies (frontend, backend, local Supabase)
make start            # Start full stack with real API (Supabase + Vite dev server)
make stop             # Stop the stack
make start-demo       # Start full-stack with FakeRest data provider
```

### Hosted Supabase (no local Docker)

**Default team workflow:** local Vite (`make start` / `npm run dev`) talks to the **hosted Supabase project** (`VITE_SUPABASE_URL` in `.env.development`), not a local Docker stack. Docker is optional and often not running.

Implications for agents and scripts:

- Apply migrations with **`npx supabase db push --project-ref <ref>`** or Supabase MCP `apply_migration` — not `supabase migration up` / `db reset` (those need local Docker).
- Deploy edge functions with **`supabase functions deploy … --project-ref <ref>`** — not `supabase functions serve`.
- Edge function secrets live in the **hosted** Dashboard / `supabase secrets set --project-ref …`.
- **`WEB_AUDIT_WORKER_URL`** must be a URL reachable from Supabase Edge (public worker or tunnel), not `http://127.0.0.1` unless you tunnel.
- **Web Report worker (Google Cloud Run):** `workers/web-audit/` — `./scripts/deploy-cloud-run.sh`; set `WEB_AUDIT_WORKER_URL` + `WEB_AUDIT_WORKER_SECRET` on Supabase. See `workers/web-audit/CLOUD_RUN.md`. Fly.io is legacy fallback.
- Do **not** set hosted `SB_JWT_ISSUER` to `http://127.0.0.1:54321/auth/v1` (breaks JWT verification against production tokens).

Optional local Supabase (Docker): see “Accessing Local Services” below — only if you explicitly start the local stack.

### Testing and Code Quality

```bash
make test             # Placeholder (no unit tests in repo)
make typecheck        # Run TypeScript type checking
make lint             # Run ESLint and Prettier checks
```

### Building

```bash
make build            # Build production bundle (runs tsc + vite build)
```

### Database Management

```bash
npx supabase migration new <name>  # Create new migration
npx supabase migration up          # Apply migrations locally
npx supabase db push               # Push migrations to remote
npx supabase db reset              # Reset local database (destructive)
```

### Registry (Shadcn Components)

```bash
make registry-gen     # Generate registry.json (runs automatically on pre-commit)
make registry-build   # Build Shadcn registry
```

## Architecture

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: React Router v7
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Application Logic**: shadcn-admin-kit + ra-core (react-admin headless)
- **UI Components**: Shadcn UI + Radix UI
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + REST API + Auth + Storage + Edge Functions)
- **Testing**: Vitest

### Directory Structure

```
src/
├── components/
│   ├── admin/              # Shadcn Admin Kit components (mutable dependency)
│   ├── atomic-crm/         # Main CRM application code (~15,000 LOC)
│   │   ├── activity/       # Activity logs
│   │   ├── companies/      # Company management
│   │   ├── contacts/       # Contact management (includes CSV import/export)
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── deals/          # Deal pipeline (Kanban)
│   │   ├── filters/        # List filters
│   │   ├── layout/         # App layout components
│   │   ├── login/          # Authentication pages
│   │   ├── misc/           # Shared utilities
│   │   ├── notes/          # Note management
│   │   ├── providers/      # Data providers (Supabase + FakeRest)
│   │   ├── root/           # Root CRM component
│   │   ├── sales/          # Sales team management
│   │   ├── settings/       # Settings page
│   │   ├── simple-list/    # List components
│   │   ├── tags/           # Tag management
│   │   └── tasks/          # Task management
│   ├── supabase/           # Supabase-specific auth components
│   └── ui/                 # Shadcn UI components (mutable dependency)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── App.tsx                 # Application entry point

supabase/
├── functions/              # Edge functions (user management, inbound email)
└── migrations/             # Database migrations
```

### Key Architecture Patterns

For more details, check out the doc/src/content/docs/developers/architecture-choices.mdx document.

#### Mutable Dependencies

The codebase includes mutable dependencies that should be modified directly if needed:
- `src/components/admin/`: Shadcn Admin Kit framework code
- `src/components/ui/`: Shadcn UI components

#### Configuration via `<CRM>` Component

The `src/App.tsx` file renders the `<CRM>` component, which accepts props for domain-specific configuration:
- `contactGender`: Gender options
- `companySectors`: Company industry sectors
- `dealCategories`, `dealStages`, `dealPipelineStatuses`: Deal configuration
- `noteStatuses`: Note status options with colors
- `taskTypes`: Task type options
- `logo`, `title`: Branding
- `lightTheme`, `darkTheme`: Theme customization
- `disableTelemetry`: Opt-out of anonymous usage tracking

#### Database Views

Complex queries are handled via database views to simplify frontend code and reduce HTTP overhead. For example, `contacts_summary` provides aggregated contact data including task counts.

#### Database Triggers

User data syncs between Supabase's `auth.users` table and the CRM's `sales` table via triggers (see `supabase/migrations/20240730075425_init_triggers.sql`).

#### Edge Functions

Located in `supabase/functions/`:
- User management (creating/updating users, account disabling)
- Inbound email webhook processing

#### Data Providers

Two data providers are available:
1. **Supabase** (default): Production backend using PostgreSQL
2. **FakeRest**: In-browser fake API for development/demos, resets on page reload

When using FakeRest, database views are emulated in the frontend. Test data generators are in `src/components/atomic-crm/providers/fakerest/dataGenerator/`.

#### Filter Syntax

List filters follow the `ra-data-postgrest` convention with operator concatenation: `field_name@operator` (e.g., `first_name@eq`). The FakeRest adapter maps these to FakeRest syntax at runtime.

## Development Workflows

### Path Aliases

The project uses TypeScript path aliases configured in `tsconfig.json` and `components.json`:
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`
- `@/components/ui` → `src/components/ui`

### Adding Custom Fields

When modifying contact or company data structures:
1. Create a migration: `npx supabase migration new <name>`
2. Update the sample CSV: `src/components/atomic-crm/contacts/contacts_export.csv`
3. Update the import function: `src/components/atomic-crm/contacts/useContactImport.tsx`
4. If using FakeRest, update data generators in `src/components/atomic-crm/providers/fakerest/dataGenerator/`
5. Don't forget to update the views
6. Don't forget the export functions
7. Don't forget the contact merge logic

### Running with Test Data

Import `test-data/contacts.csv` via the Contacts page → Import button.

### Git Hooks

- Pre-commit: Automatically runs `make registry-gen` to update `registry.json`

### Google Places autocomplete

Address and business-name fields use `VITE_GOOGLE_PLACES_API_KEY` (`.env.development` + Vercel). Shared code: `src/lib/googlePlaces/`, UI: `GooglePlacesAutocompleteInput`.

If the **Places API (New)** endpoint returns **403**, the app automatically retries with the **legacy Places API** (must be enabled separately in Google Cloud).

**Fix 403 permanently (Google Cloud Console):**

1. [APIs & Services → Library](https://console.cloud.google.com/apis/library) → enable **Places API (New)** (`places.googleapis.com`).
2. Also enable **Places API** (legacy) if you rely on the fallback.
3. [Credentials](https://console.cloud.google.com/apis/credentials) → your browser key → **API restrictions**: allow both Places APIs (or “Don’t restrict” for testing).
4. **Application restrictions**: HTTP referrers — add `http://localhost:5173/*`, `https://lbs.bz/*`, and your Vercel preview URLs.
5. Ensure **billing** is enabled on the GCP project.

### Accessing Local Services During Development

**Hosted Supabase (typical):** Dashboard and API at the project URL in `.env.development` (e.g. `https://<ref>.supabase.co`). No local ports required.

**Optional local Supabase (Docker only, if running `supabase start`):**

- Frontend: http://localhost:5173/
- Supabase Dashboard: http://localhost:54323/
- REST API: http://127.0.0.1:54321
- Storage (attachments): http://localhost:54323/project/default/storage/buckets/attachments
- Inbucket (email testing): http://localhost:54324/

### Internal installs without per-seat invite billing

To keep Stripe (Checkout, webhooks, etc.) wired for future use **but stop blocking new users** behind subscription or seat counts:

1. Set **`SKIP_USER_INVITE_BILLING=1`** (or `true` / `yes` / `on`) in Supabase **Edge Function** secrets for the **`users`** function.
2. Set **`VITE_SKIP_USER_INVITE_BILLING=1`** in the Vite frontend build env so Settings → Users does not open subscribe/add-seat dialogs.

Redeploy the `users` function and rebuild/redeploy the app after changing these. To enforce paid seats again, remove both flags.

Secrets on the hosted project cannot be set from this repo; from the CLI (with Supabase CLI linked), run:

```bash
supabase secrets set SKIP_USER_INVITE_BILLING=1 --project-ref <your-project-ref>
```

Or set **SKIP_USER_INVITE_BILLING** = `1` under **Dashboard → Edge Functions → `users` → Secrets**. For local `supabase functions serve`, see `supabase/functions/.env` (tracked in git as `!supabase/functions/.env`). The frontend picks up **`VITE_SKIP_USER_INVITE_BILLING`** from `.env.development` during `make start` — add the same variable to your production host/Vite env when you deploy builds.

**JWT / Edge Functions (`users` POST 401):** Do **not** set **`SB_JWT_ISSUER`** in hosted secrets to `http://127.0.0.1:54321/auth/v1` — that mirrors local dev only and breaks `AuthMiddleware` JWT verification against production tokens. Omit `SB_JWT_ISSUER` in production or point it only at tooling that truly needs it. Issuer verification uses **`SUPABASE_URL` + `/auth/v1`** (see `supabase/functions/_shared/authentication.ts`).

## Important Notes

- **Language:** The user may chat in Spanish, but the product UI, code comments, commits, and repo docs are **English**. See `.cursor/rules/english-ui.mdc`.
- The codebase is intentionally small (~15,000 LOC in `src/components/atomic-crm`) for easy customization
- Modify files in `src/components/admin` and `src/components/ui` directly - they are meant to be customized
- User deletion is not supported to avoid data loss; use account disabling instead
- Filter operators must be supported by the `supabaseAdapter` when using FakeRest
