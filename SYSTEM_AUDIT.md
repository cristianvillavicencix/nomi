# Nomi CRM — System Audit (RBAC Readiness)

> **Fecha de auditoría:** 2026-05-22  
> **Alcance:** código en repo + esquema PostgreSQL en Supabase (producción, ref `qjglkywmqwqdoaboakao`)  
> **Nota:** Este documento describe el estado actual. No incluye cambios propuestos ni código modificado.

---

## 1. STACK TÉCNICO

| Componente | Detalle |
|---|---|
| **Framework principal** | **React 19.1.0** + **Vite 7.3.0** (SPA, **NO** Next.js / Laravel / Django) |
| **Lenguaje / runtime** | **TypeScript ~5.8** → JavaScript en browser; Edge Functions en **Deno** |
| **Base de datos** | **PostgreSQL 17** (Supabase hosted + local via Supabase CLI) |
| **ORM / query builder** | **NO EXISTE ORM**. Acceso vía **Supabase JS** + **PostgREST** (`ra-data-postgrest` / `@supabase/supabase-js`). SQL en migraciones. |
| **Autenticación** | **Supabase Auth** (`auth.users`) + perfil CRM en `public.organization_members`. Wrapper: `ra-supabase-core` + `authProvider.ts`. |
| **App logic / CRUD** | **ra-core 5.14** (react-admin headless) + **shadcn-admin-kit** |
| **Data fetching** | **TanStack React Query 5.90** |
| **Forms** | **React Hook Form 7.71** (via ra-core `Form`) |
| **Routing** | **React Router 7.13** |
| **UI** | **Tailwind CSS 4.1**, **shadcn/ui** (Radix), **lucide-react** |
| **Backend adicional** | **Supabase Edge Functions** (Deno), **RLS** en Postgres, **Storage** (attachments) |
| **Billing** | **Stripe** (edge functions `stripe-billing`, `stripe-webhook`) |
| **Modos de producto** | `VITE_PRODUCT_MODE`: **`lbs`** (default, Latino Business Services) o **`contractor`** |

### Estructura de carpetas (2–3 niveles)

```
nomi/
├── src/
│   ├── App.tsx                    # Entry → <CRM />
│   ├── components/
│   │   ├── admin/                 # shadcn-admin-kit (mutable)
│   │   ├── atomic-crm/            # ~15k LOC CRM core
│   │   │   ├── contacts/ companies/ deals/ tasks/ notes/ settings/ ...
│   │   │   ├── providers/         # supabase + fakerest dataProviders, auth
│   │   │   ├── root/CRM.tsx       # Resources, routes, layout
│   │   │   └── layout/            # SidebarLayout
│   │   ├── supabase/              # Auth UI helpers
│   │   └── ui/                    # shadcn components (mutable)
│   ├── lbs/                       # LBS-specific modules (leads, messages, proposals…)
│   ├── people/ payroll/ payments/ timeEntries/ reports/  # Contractor HR/payroll
│   ├── platform/                  # SaaS operator console (/sas)
│   └── lib/ hooks/
├── supabase/
│   ├── migrations/                # 105+ SQL migrations
│   └── functions/                 # 17 Edge Functions
├── doc/                           # Developer docs (MDX)
└── test-data/
```

---

## 2. MODELO DE DATOS

### Convenciones globales

- **Multi-tenant:** casi todas las tablas tienen `org_id` → `organizations.id`.
- **Usuario CRM:** `organization_members` (antes `sales`) enlazado a `auth.users` via `user_id` (uuid).
- **Proyectos:** tabla `deals` (UI: “Projects” en LBS, pipeline Kanban).
- **Leads:** **NO EXISTE tabla `leads`**. Leads = filas en `contacts` con `status` en pipeline LBS (`new`, `contacted`, `qualified`, etc.).
- **Clients:** **NO EXISTE tabla `clients`**. Clients = `companies` (+ contactos asociados) en modo LBS.
- **Meetings:** **NO EXISTE tabla `meetings`**. Reutiliza `calendar_events` (filtrado en UI).
- **RLS:** habilitado en todas las tablas públicas listadas abajo.
- **Vistas de lectura:** `contacts_summary`, `companies_summary`, vistas `report_*` (solo lectura).

### Leyenda — campos sensibles

- 💰 **Financiero:** montos, tarifas, salarios, comisiones, precios, budgets, pagos.
- 🔐 **Sensible:** credenciales, tokens, datos bancarios, PII fuerte.

---

### `organizations` (tenant / workspace)

| Campo | Tipo | Notas |
|---|---|---|
| id | bigint PK | |
| name | text | |
| created_at | timestamptz | |
| stripe_customer_id | text | 💰 🔐 |
| stripe_subscription_id | text | 💰 |
| stripe_seat_price_id | text | 💰 |
| billing_status | text | 💰 |
| billable_seat_count | integer | 💰 |
| price_per_seat_usd_monthly | numeric | 💰 default 20 |
| disabled_at | timestamptz | |
| email, phone, address, website | text | 🔐 |

**Relaciones:** padre de casi todas las tablas vía `org_id`.

---

### `organization_members` (usuarios CRM / login profile)

| Campo | Tipo | Notas |
|---|---|---|
| id | bigint PK | |
| user_id | uuid | → `auth.users.id` |
| org_id | bigint FK | → organizations |
| first_name, last_name, email | text | 🔐 |
| administrator | boolean | **Flag admin org** |
| disabled | boolean | |
| roles | text[] | **Roles legacy para RLS** (admin, accountant, hr, employee, sales_manager, …) |
| module_permissions | jsonb | **Permisos granulares** (módulos + capabilities tipo `messaging.send`) |
| avatar | jsonb | |

**Relaciones:** referenciado como `organization_member_id` en contacts, deals, notes, etc.

---

### `platform_operators` (consola SaaS Nomi, NO tenant CRM)

| Campo | Tipo |
|---|---|
| user_id | uuid PK → auth.users |
| created_at | timestamptz |

---

### `configuration` (singleton app config por instancia)

| Campo | Tipo |
|---|---|
| id | integer PK (1) |
| config | jsonb | Deal stages, branding, etc. |

---

### `init_state`

| Campo | Tipo |
|---|---|
| is_initialized | bigint | Flag si el CRM ya tiene admin inicial |

---

### Módulo CRM — Contacts / Leads

#### `contacts`

| Campo | Tipo | Sensible |
|---|---|---|
| id | bigint PK | |
| org_id | bigint FK | |
| first_name, last_name, title, gender, background | text | |
| email_jsonb, phone_jsonb | jsonb | 🔐 |
| address, linkedin_url | text | 🔐 |
| status | text | Lead vs client (`LBS_LEAD_STATUSES`, `LBS_CONTACT_STATUSES`) |
| lead_source, interested_service | text | |
| company_id | bigint FK → companies | |
| organization_member_id | bigint FK | |
| tags | bigint[] | |
| avatar | jsonb | |
| first_seen, last_seen | timestamptz | |
| has_newsletter | boolean | |

**Relaciones:** belongs_to company, organization_member; has_many tasks, notes, proposals, tickets, conversations.

#### `contacts_summary` (VIEW)

Agrega `company_name`, `nb_tasks`, FTS email/phone. Mismos campos base + agregados.

---

### Módulo CRM — Companies / Clients

#### `companies`

| Campo | Tipo | Sensible |
|---|---|---|
| id | bigint PK | |
| org_id | bigint FK | |
| name, sector, size, description | text | |
| website, linkedin_url, phone_number | text | |
| address, city, zipcode, state_abbr, country | text | |
| revenue | text | 💰 (texto libre) |
| tax_identifier | text | 💰 🔐 |
| logo, context_links | json/jsonb | |
| primary_contact_id | bigint FK → contacts | |
| organization_member_id | bigint FK | |
| created_at | timestamptz | |

#### `companies_summary` (VIEW)

Agrega `nb_deals`, `nb_contacts`, datos del primary contact.

---

### Módulo CRM — Projects / Deals (pipeline)

#### `deals`

| Campo | Tipo | Sensible |
|---|---|---|
| id | bigint PK | |
| org_id | bigint FK | |
| name, description, category, stage, pipeline_id | text | |
| company_id, contact_id | bigint FK | |
| contact_ids | bigint[] | |
| amount | bigint | 💰 |
| estimated_value | numeric | 💰 |
| original_project_value | numeric | 💰 |
| current_project_value | numeric | 💰 |
| value_includes_material | boolean | 💰 |
| company_name, project_address, project_type | text | |
| project_place_id, project_address_meta | text/jsonb | |
| website_brief | jsonb | |
| github_repo | text | |
| salesperson_ids, subcontractor_ids, worker_ids | bigint[] | |
| start_date, expected_end_date, actual_completion_date | date | |
| expected_closing_date, archived_at | timestamptz | |
| organization_member_id | bigint FK | |
| index | smallint | Kanban order |
| notes | text | |
| created_at, updated_at | timestamptz | |

**Relaciones:** hub central — proposals, contracts, tasks, calendar_events, deal_* financial/ops tables, conversations.

---

### Notes & Tasks

#### `contact_notes` / `deal_notes`

| Campos clave | Tipo |
|---|---|
| id, org_id, text, date, status/type, attachments | |
| contact_id / deal_id | FK |
| organization_member_id | FK |

#### `tasks`

| Campo | Tipo |
|---|---|
| id, org_id, type, text, priority, internal | |
| contact_id, deal_id | FK (contact_id nullable) |
| organization_member_id | FK |
| due_date, done_date, created_at | timestamptz |
| assignee_person_ids, collaborator_person_ids, mentioned_member_ids | bigint[] |

#### `task_assignees`, `task_participants`, `task_tag_notifications`

Tablas puente para asignaciones, participantes y notificaciones @mention.

---

### Calendar & Meetings

#### `calendar_events`

| Campo | Tipo |
|---|---|
| id, org_id, title, description, event_date, event_time | |
| duration_minutes, remind_before_minutes | |
| meeting_url | 🔐 (URL reunión) |
| deal_id, contact_id, company_id, person_id, organization_member_id | FK |
| completed_at, created_at, updated_at | |

**Meetings en UI:** página `/meetings` filtra estos registros (no tabla separada).

---

### Messaging

#### `conversations`

| Campo | Tipo |
|---|---|
| id, org_id, type (team_dm, client, project, …), title | |
| deal_id, contact_id, external_phone, dm_key | |
| created_by_member_id | FK |
| last_message_at, created_at, updated_at | |

#### `conversation_participants`

conversation_id, member_id, last_read_at

#### `conversation_messages`

| Campo | Tipo |
|---|---|
| body, channel, direction, media_url | |
| author_member_id | FK |
| external_id | (Twilio SID) |

#### `organization_messaging_settings`

| Campo | Tipo | Sensible |
|---|---|---|
| org_id | PK/FK | |
| twilio_account_sid, twilio_auth_token, twilio_phone_number | text | 🔐 |
| sms_enabled | boolean | |
| updated_at | timestamptz | |

---

### Proposals & Contracts (LBS)

#### `proposals`

| Campo | Tipo | Sensible |
|---|---|---|
| id, org_id, title, status, content, notes | | |
| amount | numeric | 💰 |
| valid_until, sent_at, viewed_at, accepted_at, rejected_at | | |
| company_id, contact_id, deal_id, organization_member_id | FK | |

#### `proposal_line_items`

| Campo | Tipo | Sensible |
|---|---|---|
| description, quantity | | |
| unit_price | numeric | 💰 |
| sort_order | integer | |
| proposal_id | FK | |

#### `contracts`

Similar a proposals: title, status, document, file, signed_at, expires_at, FKs a company/contact/deal/proposal.

---

### Web Forms (LBS)

#### `forms`

| Campo | Tipo |
|---|---|
| id, org_id, name, slug, description, schema (jsonb), active | |

#### `form_submissions`

| Campo | Tipo |
|---|---|
| form_id, org_id, company_id, contact_id, deal_id | FK |
| data | jsonb | Puede contener PII del submitter |

---

### Support / Tickets (LBS)

#### `tickets`

subject, status, priority, FKs company/contact/deal/assignee/organization_member

#### `ticket_messages`

body, attachments, author_member_id

---

### Deal operations & financials (project tabs)

| Tabla | Campos financieros 💰 | Otros sensibles 🔐 |
|---|---|---|
| `deal_expenses` | amount, paid | vendor, attachments |
| `deal_change_orders` | amount | |
| `deal_client_payments` | amount | check/reference numbers |
| `deal_commissions` | commission_value | |
| `deal_cost_entries` | amount | |
| `deal_subcontractor_entries` | cost_amount | invoice attachments |
| `deal_resources` | — | files |
| `deal_access_entries` | — | **password**, username, url (credenciales proyecto) |
| `deal_salespersons`, `deal_subcontractors`, `deal_workers` | — | junction deal↔people |

---

### People / HR (modo contractor — oculto en LBS sidebar)

#### `people`

| Campo | Tipo | Sensible |
|---|---|---|
| type, first_name, last_name, phone, email, status | | 🔐 |
| pay_type, compensation_type, compensation_unit, compensation_amount | | 💰 |
| hourly_rate, salary_rate, day_rate, commission_rate | numeric | 💰 |
| weekly/monthly/biweekly/annual_salary amounts | numeric | 💰 |
| bank_*, routing_number, account_number, zelle_*, check_pay_to_name | text | 💰 🔐 |
| identification_number | text | 🔐 |
| approver_roles | text[] | Roles HR |
| PTO balances, pay_schedule, overtime_* | mixed | 💰 |

#### `employee_pto_adjustments`

days_delta, adjustment_type, reason

#### `employee_loans` / `employee_loan_deductions`

original_amount, remaining_balance, fixed_installment_amount, deducted_amount — 💰

---

### Time & Payroll (contractor mode)

#### `time_entries`

hours, regular_hours, overtime_hours, payable_hours, break/lunch minutes, status, approval fields; FK person, project (deal), payroll_run, payment_run

#### `payments` / `payment_lines`

💰 total_gross, total_net, rate, amount, bonuses, deductions, regular_pay, overtime_pay, total_pay, receipt URLs

#### `payroll_runs` / `payroll_run_lines`

💰 gross_pay, net_pay, deductions, base_salary_amount, loan_deductions, manual_deduction_total

---

### Reporting (views)

| Vista | Campos 💰 |
|---|---|
| `report_labor_cost_by_person` | total_labor_cost, total_hours |
| `report_payroll_summary` | total_gross, total_net |
| `report_project_profitability` | total_labor_cost, total_revenue, profit |
| `report_sales_commissions_by_salesperson` | total_commission |

---

### Misc

| Tabla | Propósito |
|---|---|
| `tags` | id, name, color, org_id |
| `favicons_excluded_domains` | Dominios excluidos de favicon fetch |

### Auth (Supabase — schema `auth`, NO en `public`)

| Tabla | Notas |
|---|---|
| `auth.users` | Email, password hash, metadata. Enlazado a `organization_members.user_id`. **NO EXISTE** tabla `users` en `public`. |

---

## 3. SISTEMA DE USUARIOS ACTUAL

### Tabla de usuarios

**Sí:** `public.organization_members` (+ `auth.users` de Supabase).

Campos de control de acceso:
- `administrator` (boolean) — admin de la org; bypass total en frontend.
- `roles` (text[]) — slugs sincronizados para **RLS Postgres** (`admin`, `accountant`, `payroll_manager`, `hr`, `sales_manager`, `manager`, `employee`, …).
- `module_permissions` (jsonb, nullable) — mapa de módulos y capabilities (`crm`, `messaging.send`, …). Si es `null`, aplica lógica legacy desde `roles[]`.
- `disabled` — bloquea login (`authProvider.checkAuth`).

### Roles y permisos existentes

**Sí, sistema híbrido en evolución:**

| Capa | Ubicación | Qué hace |
|---|---|---|
| **Admin flag** | `organization_members.administrator` | Acceso total UI + RLS admin |
| **Roles array** | `organization_members.roles[]` | RLS Postgres (`current_user_has_any_role`, políticas por tabla) |
| **Module permissions** | `module_permissions` JSON | UI routing, sidebar, `canAccess`, árbol Settings → Users |
| **Capability keys** | ej. `messaging.send`, `crm.upload_images` | Parcialmente enforced (messaging.send en RLS + edge); muchos aún solo UI |
| **CRM permissions** | `crmPermissions.ts` | `payments.view`, `people.manage`, `sales.manage`, etc. — mutaciones HR/payroll/deals |
| **Amount visibility** | `view_amounts` module + `canViewMonetaryAmounts()` | Enmascara montos en UI |

**NO EXISTE** tabla separada `roles`, `permissions`, `role_permissions` normalizada. **NO EXISTE** RBAC clásico con many-to-many roles↔permissions en BD.

### Login / sesión

1. Supabase Auth (email/password, SSO hooks en migraciones).
2. Tras login, `authProvider.getIdentity()` lee `organization_members` por `user_id`.
3. Identity expuesta a ra-core: `{ id, fullName, avatar, administrator, roles, module_permissions }`.
4. Sesión JWT en Supabase client; cache local en `localStorage` (`RaStore.auth.current_sale`).

### Middleware de autenticación

| Capa | Archivo | Función |
|---|---|---|
| **Auth provider** | `src/components/atomic-crm/providers/supabase/authProvider.ts` | `checkAuth`, `getIdentity`, `canAccess` |
| **Route guard** | `src/components/atomic-crm/root/CRM.tsx` → `ProtectedRoute` | `useCanAccess({ resource, action })` |
| **Sidebar** | `SidebarLayout.tsx` | `canAccess(identity, { resource, action })` |
| **Mutations** | `dataProvider.ts` wrapper | `canMutateCrmResource()` antes de create/update/delete |
| **Edge Functions** | `supabase/functions/_shared/authentication.ts` | `AuthMiddleware`, `UserMiddleware` — JWT manual (`verify_jwt = false` en config) |
| **Postgres RLS** | migraciones SQL | Políticas por org + roles; funciones `current_user_org_id()`, `current_user_member_id()`, `current_member_has_capability()` |

### `is_admin` / similar

- **`organization_members.administrator`** — equivalente a org admin.
- **`roles` includes `'admin'`** — sincronizado cuando administrator=true.
- **`platform_operators`** — admin plataforma SaaS (`/sas`), separado del tenant CRM.
- **`people.approver_roles`** — array en registro HR, no usuario login.

---

## 4. RUTAS Y ENDPOINTS

### Frontend — rutas principales

#### Públicas (sin layout CRM)

| Ruta | Componente | Auth |
|---|---|---|
| `/sign-up` | SignupPage | No |
| `/sign-in` | (ra-core login) | No |
| `/forgot-password`, `/set-password` | Forgot/Set password | No |
| `/forms/:slug` | PublicFormPage (LBS) | **No** — formulario público |
| `/auth-callback.html` | OAuth callback | No |

#### Autenticadas — comunes

| Ruta | Recurso protegido | Modo |
|---|---|---|
| `/` | Dashboard (deals) | Ambos |
| `/profile` | ProfilePage | Auth only |
| `/settings` | SettingsPage | Admin (`configuration` edit) |
| `/deals/*` | deals | Ambos |
| `/contacts/*`, `/companies/*` | contacts, companies | Contractor |
| `/tasks/*` | tasks | Ambos |
| `/organization_members/*` | organization_members | Admin |

#### LBS (`VITE_PRODUCT_MODE=lbs`) — sidebar modules

| Ruta UI | Mapeo datos | ProtectedRoute resource |
|---|---|---|
| `/` Dashboard | deals dashboard | deals list |
| `/leads` | contacts (lead status) | contacts list |
| `/clients` | companies | companies list |
| `/deals` Projects | deals | deals list |
| `/calendar` | calendar_events | tasks list * |
| `/meetings` | calendar_events | tasks list * |
| `/messages` | conversations | conversations list |
| `/tasks` | tasks | tasks list |
| `/proposals` | proposals | proposals list |
| `/contracts` | contracts | contracts list |
| `/web-forms` | forms | forms list |
| `/tickets` | tickets | tickets list (user menu) |

\* Calendar/Meetings usan resource `tasks` en nav por conveniencia; datos en `calendar_events`.

#### Contractor mode — sidebar adicional

| Ruta | Recurso |
|---|---|
| `/people/*` | people |
| `/time_entries/*` | time_entries |
| `/payments/*`, `/payroll_runs/*`, `/employee_loans/*` | payroll resources |
| `/reports/*` | reports (custom pages) |

#### Platform console (operadores Nomi)

| Ruta | Auth |
|---|---|
| `/sas/*` | `platform_operators` — **NO** requiere `organization_members` |

---

### API — PostgREST (Supabase REST)

**Base:** `https://<project>.supabase.co/rest/v1/`

Auto-generado para cada tabla/vista en schema `public`. Operaciones estándar:

| Método | Patrón | Auth |
|---|---|---|
| GET | `/rest/v1/{table}?select=...` | JWT Bearer (RLS) |
| POST | `/rest/v1/{table}` | JWT + RLS |
| PATCH | `/rest/v1/{table}?id=eq.{id}` | JWT + RLS |
| DELETE | `/rest/v1/{table}?id=eq.{id}` | JWT + RLS |

**Protección:** todas las tablas tenant tienen RLS; requests sin JWT fallan (excepto políticas `anon` en endpoints públicos limitados).

**Recursos expuestos al frontend** (registrados en `CRM.tsx` como `<Resource>`):  
`deals`, `contacts`, `companies`, `tasks`, `contact_notes`, `deal_notes`, `organization_members`, `tags`, `people`, `time_entries`, `payments`, `payment_lines`, `payroll_runs`, `payroll_run_lines`, `employee_loans`, `employee_loan_deductions`, `employee_pto_adjustments`, `proposals`, `contracts`, `forms`, `form_submissions`, `tickets`, `ticket_messages`, `conversations`, `conversation_participants`, `conversation_messages`, `deal_*` (financial/ops), `deal_resources`, `deal_access_entries`, `proposal_line_items`.

---

### Edge Functions (`/functions/v1/{name}`)

Todas tienen **`verify_jwt = false`** en `supabase/config.toml`; validación manual en código.

| Función | Método | Auth en código | Propósito |
|---|---|---|---|
| `users` | POST, PATCH | JWT + org member admin | Invitar/editar usuarios, module_permissions |
| `update_password` | POST | JWT | Reset password flow |
| `merge_contacts` | POST | JWT | Fusión contactos |
| `accept_proposal` | POST | Token/link | Aceptar propuesta (público/semi) |
| `process_website_intake` | POST | Varía | Intake web |
| `submit_public_form` | POST | **Público** (validación slug) | Enviar web form |
| `get_public_form` | GET | **Público** | Leer schema form |
| `get_public_deal_brief` | GET | Token | Brief proyecto público |
| `submit_project_resources` | POST | Token/link | Recursos proyecto |
| `get_github_repo_status` | POST | JWT | Estado repo GitHub |
| `messaging_settings` | GET/POST | JWT + admin | Twilio settings |
| `send_client_sms` | POST | JWT + `messaging.send` | Enviar SMS |
| `twilio_inbound_sms` | POST | Twilio signature | Webhook inbound |
| `stripe-billing` | POST | JWT + admin | Checkout, portal, seats |
| `stripe-webhook` | POST | Stripe signature | Webhooks billing |
| `platform-directory` | GET | Platform operator | Consola SaaS |
| `postmark` | POST | Postmark | Inbound email → notes |

---

## 5. UI Y NAVEGACIÓN

### Dónde está el sidebar

| Modo | Archivo | Líneas clave |
|---|---|---|
| **LBS** | `src/components/atomic-crm/layout/SidebarLayout.tsx` | `SidebarNavigation` ~163–267: itera `LBS_NAV_ITEMS` |
| **Contractor** | Mismo archivo | ~269–487: items hardcoded (Dashboard, CRM, Operations, Reports) |
| **Definición items LBS** | `src/lbs/navigation.ts` | `LBS_NAV_ITEMS` líneas 27–116, `LBS_USER_MENU_NAV_ITEMS` 118–135 |

### Cómo se renderiza

- **Array TypeScript** (`LBS_NAV_ITEMS`), **NO** desde base de datos.
- Cada item: `{ to, label, icon, activePattern, resource?, action? }`.
- Render: `.filter(item => canAccess(identity, { resource, action }))` → `.map()` → componente `SidebarItem`.

### Lógica condicional show/hide

**Sí, múltiples capas:**

1. **`isLbsMode()`** — sidebar LBS vs contractor (estructura distinta).
2. **`canAccess(identity, { resource, action })`** — por item de nav (module_permissions o roles legacy).
3. **Contractor sidebar** — bloques `canViewSales`, `canViewPeople`, `canViewHours`, `canViewPayments`, `canViewPayroll`, `canViewReports`.
4. **`ProtectedRoute`** en `CRM.tsx` — redirige a `/` si no hay acceso.
5. **`<Resource>` registration** — recursos no registrados no tienen rutas CRUD auto.
6. **LBS mode redirects** — oculta rutas contractor (`/people/*` → `/`).

---

## 6. PUNTOS CRÍTICOS PARA RBAC

### Acoplamiento

| Aspecto | Estado |
|---|---|
| Permisos UI | Centralizados en `canAccess.ts`, `memberModuleAccess.ts`, `crmPermissions.ts` — **buena base** |
| Permisos BD | RLS usa **`roles[]`**, no `module_permissions` JSON directamente (excepto `current_member_has_capability` reciente) |
| Enforcement granular | **Incompleto** — muchas capabilities del árbol Settings solo afectan UI; RLS aún role-based |
| Duplicación | Lógica roles/modules replicada en edge `_shared/memberModulePermissions.ts` |

### Queries centralizadas vs dispersas

- **Lecturas/escrituras CRUD:** centralizadas en `dataProvider.ts` (PostgREST) + hooks ra-core.
- **Queries custom:** métodos en dataProvider (`getScopedTasks`, `sendClientSms`, …).
- **SQL complejo:** vistas DB + algunas RPC/migraciones.
- **Componentes:** a veces llaman `supabase.from()` directo (settings billing, messages realtime) — **dispersión moderada**.

### Capa de servicios / repositorios

**NO EXISTE** capa repository formal. Patrón:
- Frontend: dataProvider + React Query
- Backend: RLS + Edge Functions
- Sin services layer TypeScript compartido entre UI y edge (excepto `_shared/` parcial en Deno)

### Recomendaciones técnicas para RBAC en este stack

1. **Modelo objetivo:** mantener `organization_members` como principal; evolucionar `module_permissions` hacia capabilities completas OR normalizar tablas `roles` / `member_roles` / `role_capabilities` si necesitas RBAC clásico auditable.

2. **Single source of truth:** hoy hay **3 fuentes** (module_permissions UI, roles[] RLS, crmPermissions mutaciones). Unificar:
   - Postgres functions que lean `module_permissions` JSON (patrón `current_member_has_capability`).
   - Sincronizar `roles[]` automáticamente desde capabilities (ya parcial en edge `users`).

3. **Enforcement order:** RLS (obligatorio) → Edge Functions → dataProvider guards → UI hides. Hoy el orden está invertido en muchos módulos (UI only).

4. **Migración incremental:** 
   - Fase 1: capabilities por módulo sidebar (ya iniciado).
   - Fase 2: RLS policies por capability/resource/action.
   - Fase 3: field-level (view_amounts ya existe como precedente).

5. **Testing:** no hay suite de tests permisos — añadir tests integración RLS + e2e por rol.

6. **Audit log:** **NO EXISTE** tabla audit de cambios de permisos.

---

## 7. ARCHIVOS CLAVE (RBAC)

| # | Archivo | Rol |
|---|---|---|
| 1 | `src/components/atomic-crm/providers/commons/canAccess.ts` | Punto central `canAccess()` — routing UI por resource/action |
| 2 | `src/components/atomic-crm/providers/commons/memberModuleAccess.ts` | Resuelve módulos efectivos, RLS resource mapping, `hasMemberCapability()` |
| 3 | `src/components/atomic-crm/settings/workspacePermissionTree.ts` | Árbol capabilities UI (CRM, messaging.send, …) |
| 4 | `src/components/atomic-crm/settings/UsersSettingsSection.tsx` | UI admin asignar permisos por usuario |
| 5 | `src/components/atomic-crm/providers/commons/crmPermissions.ts` | Permisos mutación HR/payroll/sales (`canMutateCrmResource`) |
| 6 | `src/components/atomic-crm/providers/supabase/authProvider.ts` | Sesión, identity, puente `canAccess` ↔ ra-core |
| 7 | `src/components/atomic-crm/providers/supabase/dataProvider.ts` | CRUD PostgREST + guards mutación + edge calls |
| 8 | `src/components/atomic-crm/root/CRM.tsx` | Registro resources, `ProtectedRoute`, rutas custom |
| 9 | `src/components/atomic-crm/layout/SidebarLayout.tsx` | Nav condicional por permisos |
| 10 | `src/lbs/navigation.ts` | Definición sidebar LBS + resource mapping |
| 11 | `supabase/functions/users/index.ts` | Persistencia usuarios, module_permissions, sync roles[] |
| 12 | `supabase/functions/_shared/memberModulePermissions.ts` | Normalización permisos edge (mirror frontend) |
| 13 | `supabase/migrations/*_harden_role_permissions.sql` + RLS migrations | Políticas Postgres por rol |
| 14 | `supabase/migrations/20260630180000_organization_member_module_permissions.sql` | Columna `module_permissions` |
| 15 | `supabase/migrations/20260522223653_member_capability_messaging_send.sql` | `current_member_has_capability()` + RLS messaging |

---

## RESUMEN EJECUTIVO

**Nomi CRM** es una SPA **React + Vite + TypeScript** con backend **Supabase (PostgreSQL 17 + Auth + Edge Functions)**, sin ORM tradicional: el frontend usa **ra-core/shadcn-admin-kit** contra **PostgREST**, y la seguridad real depende de **RLS** en Postgres. El producto opera en dos modos (**LBS** para agencia/servicios con Leads, Messages, Proposals, etc.; **contractor** con People, Payroll, Time), multi-tenant vía `organizations.org_id`. El sidebar del usuario (Dashboard, Leads, Clients, Projects, Calendar, Meetings, Messages, Tasks, Proposals, Contracts, Web Forms) está definido en arrays TypeScript y filtrado por `canAccess()`. **Ya existe un sistema híbrido de acceso** — no RBAC clásico — basado en `organization_members.administrator`, un array `roles[]` sincronizado para RLS, y un JSON `module_permissions` con módulos y capabilities granulares recién introducidas; la UI y parte del backend (ej. `messaging.send`) los respetan, pero **RLS sigue mayormente acoplado a roles legacy**, y muchas capabilities del árbol de Settings aún no tienen enforcement en BD. El sistema está **parcialmente preparado** para evolucionar a RBAC: hay puntos centralizados en frontend y el patrón `current_member_has_capability()` muestra el camino, pero falta unificar las tres capas (UI, mutaciones, RLS) y completar el mapeo capability→política SQL antes de considerarlo RBAC production-grade.

---

*Generado por auditoría estática del repositorio y consulta al esquema Supabase. Verificar migraciones locales vs remoto antes de implementar cambios.*
