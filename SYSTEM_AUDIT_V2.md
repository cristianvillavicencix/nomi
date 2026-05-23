# Nomi CRM — Auditoría Total del Sistema (V2)

> **Fecha:** 2026-05-22  
> **Alcance:** código en repo + migraciones + edge functions + documentación (`SYSTEM_AUDIT.md`, `RBAC_DESIGN.md`, `MESSAGES_AUDIT.md`) + exploración del codebase  
> **Regla:** solo diagnóstico. Sin cambios de código.  
> **Producción referenciada:** Supabase ref `qjglkywmqwqdoaboakao`

---

## A. Executive Summary

**Nomi CRM** es un SaaS multi-tenant para gestión comercial y operaciones, con **dos productos en un solo repo**:

| Modo | Env | Usuario objetivo |
|------|-----|------------------|
| **LBS** (default) | `VITE_PRODUCT_MODE=lbs` | Agencia digital → leads, clientes, proyectos, propuestas, SMS |
| **Contractor** | `VITE_PRODUCT_MODE=contractor` | Constructor/HR → people, time, payroll, payments, reports |

**Stack:** React 19 + Vite + TypeScript + ra-core (react-admin headless) + TanStack Query + Supabase (Postgres 17, Auth, Storage, Edge Functions Deno) + Stripe.

**Métricas del repo:**

| Métrica | Valor |
|---------|-------|
| Archivos TS/TSX en `src/` | ~691 |
| LOC TypeScript total | ~100,241 |
| Migraciones SQL | 118 |
| Edge functions | 21 |
| Monolito `DealShow.tsx` | 5,278 LOC |
| `dataProvider` Supabase | 2,055 LOC |
| `dataProvider` FakeRest | 2,140 LOC |

**Qué resuelve:** pipeline comercial + ejecución de proyecto + (en contractor) nómina y pagos. No es un CRM genérico: es un **monolito modular** que creció por capas (Atomic CRM → multi-tenant → LBS modules → payroll → messaging → RBAC).

**Estado general:** **funcional en producción, arquitectónicamente heterogéneo, con deuda técnica alta en permisos, duplicación de lógica y piezas a medias.** Lo que está bien construido (y conviene conservar): multi-tenant con `org_id`, patrón dataProvider + lifecycle hooks, vistas `*_summary`, edge functions con middleware de auth, módulo LBS de propuestas/forms/tickets, base de messaging reciente.

**Veredicto honesto:** el sistema **no está mal planteado a nivel de datos**, pero **sí está mal gobernado a nivel de producto y capas transversales**. Parece un CRM serio en el backend y un producto "a medias" en UX, permisos y coherencia entre módulos. Sin refactor de gobernanza (RBAC, routing, dataProvider único, descomposición de monolitos), **no escalará** a equipos grandes ni a enterprise.

**Documentos relacionados:**

- `SYSTEM_AUDIT.md` — auditoría RBAC/datos/rutas (2026-05-22)
- `RBAC_DESIGN.md` — diseño RBAC propuesto (no implementado por completo)
- `MESSAGES_AUDIT.md` — auditoría del módulo Messages

---

## 1. Resumen General del Proyecto

### Qué tipo de sistema es

CRM + PSA (Professional Services Automation) + HR/Payroll (modo contractor) + messaging SMS, empaquetado como SaaS con billing Stripe y consola de plataforma (`/sas`).

### Problema que intenta resolver

**LBS:** captar leads → convertir en clientes → cerrar propuestas → ejecutar proyectos → comunicarse con clientes (SMS) → entregar (recursos, briefs, GitHub).

**Contractor:** gestionar empleados, horas, nómina, pagos y rentabilidad por proyecto.

### Flujo principal del negocio (intención)

```
Lead (contact) → Calificación → Cliente (company) → Deal/Project
→ Proposal → Accept → Project execution (tasks, calendar, resources)
→ Client SMS / internal chat → Closeout
```

En contractor, el flujo paralelo es: **People → Time entries → Payroll runs → Payments → Reports**.

### Módulos conectados correctamente

- **Contacts ↔ Companies ↔ Deals** (core CRM sólido)
- **Proposals → Deals** (`accept_proposal` edge function)
- **Forms → Form submissions → Deals/contacts** (intake web)
- **Deal resources / website brief** ↔ project delivery
- **Tasks ↔ Deals/Contacts** + assignees/participants
- **Messaging ↔ Contacts/Deals** (conversaciones `client` y `project`)

### Módulos improvisados o incompletos

| Módulo | Problema |
|--------|----------|
| **Messages** | SMS OK; WhatsApp/Voice = shells 503; unread híbrido localStorage+DB; RLS drift histórico |
| **Meetings** | No hay tabla `meetings`; reutiliza `calendar_events` con filtro UI |
| **Leads / Clients** | No hay tablas propias; mismos `contacts`/`companies` con status distinto — confuso mentalmente |
| **Invoices** | **No existe** como módulo |
| **Estimates** | Parcialmente cubierto por `proposals`, no unificado |
| **Automations** | **No existe** |
| **Email inbox** | Solo inbound Postmark → notes, no bandeja unificada |
| **Mobile (LBS)** | `MobileAdmin` **no incluye rutas LBS** — producto desktop-only de facto |
| **RBAC** | Tres sistemas superpuestos (`administrator`, `roles[]`, `module_permissions`) + RLS no alineado |

### Arquitectura aparente

**Modular monolith frontend** + **Postgres-centric backend** + **Edge Functions para mutaciones complejas/webhooks**. Patrón ra-core Resource/CRUD. Dos dataProviders paralelos (Supabase + FakeRest). Configuración por tenant en `configuration` JSONB + env `VITE_PRODUCT_MODE`.

---

## 2. Mapa Completo del Proyecto

### Estructura real (no existe `app/` ni `modules/` como carpetas raíz)

```
nomi/
├── src/
│   ├── App.tsx                    → <CRM /> único entry
│   ├── components/
│   │   ├── admin/                 # Framework shadcn-admin-kit (~87 files) — MUTABLE
│   │   ├── atomic-crm/            # Core CRM ~15k LOC — contacts, deals, tasks, providers…
│   │   ├── supabase/              # Auth UI (login, OAuth, password)
│   │   └── ui/                    # shadcn/Radix — MUTABLE
│   ├── lbs/                       # Producto LBS ~24k LOC — messages, deals, clients, forms…
│   ├── people/ payroll/ payments/ timeEntries/ reports/ loans/ payrollRuns/  # Contractor HR
│   ├── platform/                  # Consola SaaS /sas
│   ├── lib/                       # queryCache, permissions catalog, i18n
│   └── hooks/
├── supabase/
│   ├── migrations/                # 118 archivos SQL
│   └── functions/                 # 21 edge functions
├── scripts/                       # SQL idempotente para prod (DUPLICA migraciones — riesgo drift)
├── doc/                           # MDX developer docs
└── demo/                          # FakeRest demo entry
```

### Qué hace cada capa

| Carpeta | Rol | Depende de |
|---------|-----|------------|
| `atomic-crm/` | CRUD core, layout, auth, settings | Supabase, ra-core |
| `lbs/` | Rutas y UI LBS-only | atomic-crm resources + custom routes |
| `people/`…`reports/` | HR/payroll contractor | Mismos providers + RLS roles |
| `providers/supabase/` | **~2055 LOC** — toda la lógica server-side custom | Edge functions + PostgREST |
| `providers/fakerest/` | **~2140 LOC** — espejo del anterior | Demo only |
| `supabase/migrations/` | Fuente de verdad schema + RLS | — |
| `supabase/functions/` | Webhooks, billing, messaging, merges | service_role + AuthMiddleware |

### Archivos críticos (top 15)

| Archivo | LOC | Por qué importa |
|---------|-----|-----------------|
| `deals/DealShow.tsx` | **5278** | Monolito: proyecto + finanzas + HR + LBS + tabs |
| `providers/supabase/dataProvider.ts` | **2055** | Toda la API custom |
| `providers/fakerest/dataProvider.ts` | **2140** | Duplicado demo |
| `people/PeopleShow.tsx` | **2129** | Monolito HR |
| `root/CRM.tsx` | **626** | Registry de resources + routing dual mobile/desktop |
| `layout/SidebarLayout.tsx` | **505** | Nav + unread + deals explorer |
| `settings/UsersSettingsSection.tsx` | **1260** | Usuarios + permisos + Stripe seats |
| `lib/permissions/permissionCatalog.ts` | **705** | Catálogo capabilities |
| `lbs/messages/*` | **~55 archivos** | Messaging más activo en desarrollo |
| `lbs/LbsCustomRoutes.tsx` | — | Todas las rutas LBS |
| `lbs/navigation.ts` | — | Sidebar LBS |
| `supabase/functions/users/index.ts` | — | Invites + module_permissions |
| `supabase/functions/send_client_sms/` | — | SMS outbound |
| `supabase/migrations/20260425120000_*` | — | Multi-tenant foundation |
| `supabase/migrations/20260522231046_rbac_unified.sql` | — | RBAC + record_shares |

### Archivos muertos / duplicados / sospechosos

- `lbs/contacts/ContactsListPage.tsx` — **no referenciado en rutas**
- `ModulePlaceholderPage.tsx` + rutas `*-placeholder` — legacy rollout
- `scripts/apply-*.sql` — copias de migraciones (drift con repo)
- Merge SQL function creada y **eliminada** (edge function canonical) — historial confuso

### Componentes demasiado grandes (>800 LOC)

`DealShow`, `PeopleShow`, `PayrollRunsShow`, `LoansShow`, `TimeEntriesList`, `SettingsPage`, `UsersSettingsSection`, `dataProvider` (×2).

### Módulos mezclados

- **DealShow** mezcla: Kanban deal + project ops + commissions + change orders + LBS brief + GitHub + messaging tab + financials
- **Settings** mezcla: branding, users, RBAC tree, messaging/Twilio, workspace
- **Contacts** en LBS = leads Y contactos de cliente según `status` — misma tabla, UX distinta

---

## 3. Módulos del Sistema

### Inventario completo

| Módulo | Objetivo | Completitud | Tablas principales | Edge functions | Problemas |
|--------|----------|-------------|-------------------|----------------|---------|
| **Dashboard** | Pipeline overview | 70% LBS / 80% contractor | `deals`, views | — | Widgets LBS mínimos |
| **Leads** | Pipeline pre-venta | 75% | `contacts` (status lead) | `process_website_intake` | No entidad Lead; confusión con contacts |
| **Clients** | Cuentas cliente | 80% | `companies`, `contacts` | `upsertLbsClient` (DP) | Redirect `/contacts`→`/clients`; tabs complejos |
| **Contacts/Companies** | CRM base | 85% | `contacts`, `companies`, `*_summary` | `merge_contacts` | Core sólido |
| **Deals/Projects** | Pipeline + ejecución | 70% | `deals`, `deal_*` (15+ tablas hijas) | `accept_proposal`, GitHub | **DealShow monolito** |
| **Proposals** | Cotizaciones | 65% | `proposals`, `proposal_line_items` | `accept_proposal` | Sin PDF/email formal; aceptación manual |
| **Contracts** | Contratos | 50% | `contracts` | — | UI lista básica; poco workflow |
| **Web Forms** | Intake público | 75% | `forms`, `form_submissions` | `submit_public_form`, `get_public_form` | Builder custom OK; poco analytics |
| **Tickets** | Helpdesk interno | 55% | `tickets`, `ticket_messages` | — | Sin SLA, sin portal cliente |
| **Tasks** | Operaciones | 80% | `tasks`, `task_assignees`, `task_participants`, `task_tag_notifications` | — | Bien evolucionado; mentions OK |
| **Calendar** | Eventos | 70% | `calendar_events` | — | Protegido como `tasks` en nav (hack) |
| **Meetings** | Video Jitsi | 60% | `calendar_events` | — | **No es módulo real**; filtro sobre calendar |
| **Messages** | SMS + chat interno | 65% | `conversations`, `conversation_messages`, `organization_messaging_settings` | `send_client_sms`, `twilio_inbound_sms`, `messaging_settings` | RLS drift, shells WA/Voice, unread híbrido |
| **People** | HR (contractor) | 75% | `people` | — | Solo contractor mode |
| **Time entries** | Horas | 80% | `time_entries` | — | Reglas complejas payroll |
| **Payroll runs** | Nómina | 75% | `payroll_runs`, `payroll_run_lines` | — | Mucha lógica en SQL functions |
| **Payments** | Pagos empleados | 75% | `payments`, `payment_lines` | — | Integridad referencial fuerte |
| **Loans** | Préstamos empleado | 70% | `employee_loans`, `employee_loan_deductions` | — | Contractor only |
| **Reports** | Rentabilidad | 65% | views `report_*` | — | Contractor only; no LBS equivalent |
| **Settings** | Config tenant | 80% | `configuration`, `organization_members` | `users`, `messaging_settings`, `stripe-billing` | Demasiado en una página |
| **Users/Team** | Miembros org | 75% | `organization_members` | `users` | RBAC UI ≠ RLS completo |
| **Platform/SAS** | Operadores Nomi | 70% | `platform_operators`, `organizations` | `platform-directory`, `stripe-webhook` | Separado del tenant CRM |
| **Billing** | Stripe seats | 70% | cols en `organizations` | `stripe-billing`, `stripe-webhook` | Flag `SKIP_USER_INVITE_BILLING` para bypass |
| **Activity log** | Auditoría UI | 50% | vía queries custom | — | No audit trail formal BD |
| **Invoices** | — | **0%** | — | — | **No existe** |
| **Automations** | — | **0%** | — | — | **No existe** |
| **WhatsApp/Voice** | — | **~5%** | `voice_calls` schema | shells 503 | Placeholders |

### Detalle por módulo clave

#### Dashboard
- **Objetivo:** vista ejecutiva del pipeline y actividad reciente.
- **Estado:** funcional en contractor; LBS tiene widgets mínimos.
- **Dependencias:** `deals`, `tasks`, `contacts_summary`.
- **Debería depender de él pero no lo hace:** Messages unread, calendar próximo, propuestas pendientes.

#### Leads (LBS)
- **Objetivo:** pipeline pre-venta antes de convertir a cliente.
- **Estado:** 75% — UI dedicada en `/leads`, pero datos en `contacts.status`.
- **Tablas:** `contacts`, `companies` (post-conversión).
- **Componentes:** `lbs/leads/*`, `LeadConvertDialog`.
- **Problemas:** no hay entidad Lead; filtros y status mezclados con contactos de cliente.
- **Dependencias downstream:** Clients, Deals, Proposals, Forms intake.

#### Clients (LBS)
- **Objetivo:** cuentas cliente post-conversión.
- **Estado:** 80% — companies + contacts con UX de cliente.
- **Tablas:** `companies`, `contacts`, `deals`.
- **Problemas:** redirect confuso `/contacts` → `/clients`; tabs sobrecargados.

#### Deals / Projects
- **Objetivo:** pipeline comercial + ejecución operacional.
- **Estado:** 70% — funcional pero monolítico en UI.
- **Tablas:** `deals` + 15+ tablas `deal_*`.
- **Edge functions:** `accept_proposal`, `get_github_repo_status`, `get_public_deal_brief`, `submit_project_resources`.
- **Problemas:** `DealShow.tsx` 5278 LOC; finanzas cliente embebidas; HR contractor mezclado.

#### Proposals
- **Objetivo:** cotizaciones formales con line items.
- **Estado:** 65%.
- **Tablas:** `proposals`, `proposal_line_items`.
- **Edge function:** `accept_proposal` — **flujo más limpio del sistema**.
- **Problemas:** sin PDF, sin email formal, sin numeración invoice-like.

#### Messages
- **Objetivo:** SMS cliente + chat interno team/project.
- **Estado:** 65% — activo en desarrollo reciente.
- **Tablas:** `conversations`, `conversation_participants`, `conversation_messages`, `organization_messaging_settings`, `message_templates`, `voice_calls`.
- **Edge functions:** `send_client_sms`, `twilio_inbound_sms`, `messaging_settings`.
- **Problemas:** ver `MESSAGES_AUDIT.md` — RLS drift, unread híbrido, WhatsApp/Voice shells.
- **Dependencias:** Contacts, Deals; debería ser hub de comunicación pero email va por otro camino (Postmark → notes).

#### People / Payroll / Payments (Contractor)
- **Objetivo:** HR completo para constructoras.
- **Estado:** 75% — sofisticado en SQL, monolítico en UI.
- **Tablas:** `people`, `time_entries`, `payroll_runs`, `payroll_run_lines`, `payments`, `payment_lines`, `employee_loans`, `employee_pto_adjustments`.
- **Problemas:** solo visible en `contractor` mode; lógica payroll difícil de testear; `PeopleShow.tsx` 2129 LOC.
- **Conexión LBS:** parcial vía `deal_workers` en DealShow.

---

## 4. Flujo del Negocio

### Cómo funciona HOY (LBS)

```
Lead (contact status=new)
    ↓ qualify / convert
Client (company + contacts)
    ↓ manual or intake form
Deal/Project
    ↓ proposal draft
Proposal → accept_proposal (edge) → deal stage setup
    ↓
Tasks / Calendar / Resources / Brief / GitHub
    ↓
SMS via Messages or Deal tab
    ↓
Project delivery → stage closed
```

### Realidad vs intención

| Paso | Hoy | Problema |
|------|-----|----------|
| Lead | `contacts` con status | OK funcional, mal modelado conceptualmente |
| Convert lead | `convertLeadToClient` | Salta validaciones de negocio a veces |
| Deal | Manual o desde proposal | Duplicación deal/proposal state |
| Proposal → Project | Edge `accept_proposal` | **Bien** — uno de los flujos más limpios |
| Invoices/Payments cliente | `deal_client_payments` en DealShow | **No** módulo invoices; mezclado en deal |
| Messaging | SMS separado de email | Email va a notes vía Postmark, no inbox |
| Completion | Stage `closed` en deal | Sin checklist formal de closeout |

### Flujo contractor (paralelo, desconectado de LBS)

```
People → Time entries (approve) → Payroll run (generate SQL) → Payment → Reports
```

**No se conecta** al flujo LBS salvo vía `deal_workers` / labor cost en DealShow.

### Qué falta

- Entidad **Invoice** formal con numeración, estados, envío
- **Quote/Estimate** unificado con Proposal (hoy solo proposals)
- **Automation** post-accept (tasks template, calendar, SMS welcome)
- **Single customer timeline** (SMS + notes + tasks + deals en una vista)
- **Portal cliente** (forms/resources existen; portal unificado no)

### Qué debería conectarse distinto

- Messages debería colgar de **Contact/Company**, no ser isla con inbox propio
- Calendar/Meetings deberían ser **un módulo** con resource propio en nav
- Financial client payments deberían salir de DealShow → módulo **Billing/AR**

### Pasos duplicados

- Lead status en `contacts` + deal stage en `deals` — dos pipelines paralelos sin sync automático
- Proposal amount + deal `amount` / `estimated_value` / `current_project_value` — tres fuentes de valor
- Notes (Postmark) + Messages (SMS) + Tasks — tres canales sin timeline unificado

---

## 5. Base de Datos

### Convenciones

- **Multi-tenant:** `org_id` en ~40 tablas + trigger `trg_assign_org_id_*`
- **Usuario CRM:** `organization_members` (ex-`sales`) → `auth.users`
- **PKs:** bigint identity en tablas nuevas; algunos legacy
- **Naming:** migración a snake_case (2026-01); restos de camelCase en views/frontend
- **ORM:** NO EXISTE — PostgREST + Supabase JS + SQL en migraciones

### Tablas por dominio (~50+ tablas public)

| Dominio | Tablas | Notas |
|---------|--------|-------|
| Tenancy | `organizations`, `organization_members`, `platform_operators`, `configuration`, `record_shares` | Billing cols en org |
| CRM | `contacts`, `companies`, `deals`, `tasks`, `tags`, `contact_notes`, `deal_notes` | Core |
| LBS sales | `proposals`, `proposal_line_items`, `contracts`, `forms`, `form_submissions`, `tickets`, `ticket_messages` | 20260521 batch |
| Project ops | `deal_salespersons`, `deal_subcontractors`, `deal_workers`, `deal_cost_entries`, `deal_expenses`, `deal_change_orders`, `deal_commissions`, `deal_client_payments`, `deal_resources`, `deal_access_entries`, `deal_subcontractor_entries` | Normalización OK |
| HR/Payroll | `people`, `time_entries`, `payments`, `payment_lines`, `payroll_runs`, `payroll_run_lines`, `employee_loans`, `employee_loan_deductions`, `employee_pto_adjustments` | Lógica pesada en SQL |
| Tasks/Calendar | `task_assignees`, `task_participants`, `task_tag_notifications`, `calendar_events` | Bien separado |
| Messaging | `conversations`, `conversation_participants`, `conversation_messages`, `organization_messaging_settings`, `message_templates`, `voice_calls` | Preview denormalizado reciente |
| Misc | `favicons_excluded_domains`, `init_state` (view) | Menor |

### Tablas que NO existen (pero el producto las implica)

| Entidad implícita | Implementación real |
|-------------------|---------------------|
| `leads` | `contacts.status` in LBS lead statuses |
| `clients` | `companies` + contacts asociados |
| `meetings` | `calendar_events` filtrados en UI |
| `invoices` | `deal_client_payments` parcial |
| `estimates` | `proposals` en draft |

### Problemas de diseño BD

| Issue | Severidad | Detalle |
|-------|-----------|---------|
| Sin tablas `leads`, `clients`, `meetings`, `invoices` | Medio | Semántica en columnas/status — confunde producto y queries |
| `roles[]` + `module_permissions` duplican intent | Alto | Dos fuentes de verdad permisos |
| `configuration` singleton global | Medio | No per-org en tabla; mezclado con org name sync trigger |
| Denormalización messaging | Bajo | `last_message_preview` OK; patrón correcto |
| 118 migraciones | Medio | Historial denso; funciones redefinidas múltiples veces; **drift prod** documentado |
| `attachments` bucket público | **Crítico** | Sin RLS por path; cualquier auth puede leer URLs |
| `init_state` view security_invoker=off | Bajo | Bypass RLS menor |
| Payroll logic en SQL | Medio | Potente pero difícil de testear/versionar |
| Tablas huérfanas potenciales | Bajo | `voice_calls` sin UI; `message_templates` parcial |

### Migraciones sospechosas / críticas

| Migración | Importancia |
|-----------|-------------|
| `20240730075029_init_db.sql` | Foundation (legacy permissive — reemplazada) |
| `20260425120000_organizations_multi_tenant.sql` | **Multi-tenant** |
| `20260430160000_rename_sales_to_organization_members.sql` | Identity model |
| `20260521120000_lbs_crm_modules.sql` | LBS tables |
| `20260522231046_rbac_unified.sql` | RBAC |
| `20260630180000_organization_member_module_permissions.sql` | Granular permissions |
| `20260629230000_conversations.sql` | Messaging |
| `20260630260300_messages_module_foundation.sql` | Templates, voice schema |
| `20260630260000_unify_message_rls.sql` | RLS fix attempt |
| `20260630260600_conversation_last_message_preview.sql` | Inbox perf |
| `20260630260700_delete_empty_conversations.sql` | Cleanup empty convs |
| `scripts/apply-pending-migrations.sql` | **Anti-pattern** — bypass del pipeline git |

### Lógica de negocio mal ubicada

| Lógica | Ubicación actual | Debería estar |
|--------|------------------|---------------|
| Filtro scoped messaging | Frontend `scopedMessaging.ts` | RLS completo |
| Unread counts | localStorage + DB híbrido | Server-side read receipts |
| Lead/client status | UI parcial | CHECK constraints + RPC |
| Payroll rules | SQL functions | OK (con tests) |
| Contact merge | Edge function | OK |
| Proposal acceptance | Edge function | OK |

### Riesgos futuros de escalabilidad

- Inbox queries sin paginación server-side completa en todos los paths
- `DealShow` dispara decenas de queries por visita
- Payroll SQL O(n) por org sin particionamiento
- 118+ migraciones sin squash strategy
- JSONB `module_permissions` sin índice GIN si crece el catálogo

---

## 6. RLS y Seguridad

### Modelo actual

1. **Org isolation:** `org_id = current_user_org_id()` (dominante)
2. **RBAC scoped:** `can_view_deal()`, `record_shares`, assignee/owner
3. **Capabilities:** `current_member_has_capability('messaging.send')`
4. **Admin bypass:** `administrator = true` o preset admin
5. **Platform:** `is_platform_operator()` cross-tenant

### Riesgos detectados

| Riesgo | Severidad | Detalle |
|--------|-----------|---------|
| Split RLS conversations vs messages | **CRÍTICO** | SELECT en `conversations` usa `can_view_conversation`; INSERT/legacy en messages usó `user_can_access_conversation` más permisivo |
| Drift prod vs repo | **CRÍTICO** | Audits documentan funciones SQL en prod sin `type='client'` |
| `module_permissions IS NULL` → capability true | **ALTO** | Legacy permissive en SQL |
| Edge functions `verify_jwt=false` | **ALTO** | OK si AuthMiddleware siempre corre; un bug = bypass total |
| Service role en todas las edge functions | **ALTO** | Auth debe ser perfecta en código |
| Bucket `attachments` público | **CRÍTICO** | URLs adivinables; sin tenant isolation en storage |
| `release_payroll_run_linked_resources()` granted to authenticated | **ALTO** | RPC SECURITY DEFINER — revisar guard de org |
| Twilio webhook fallback sin firma | **ALTO** | Documentado en MESSAGES_AUDIT |
| WhatsApp inbound sin validación | **ALTO** | Shell acepta payloads |
| Secrets Twilio | Medio | Migración pgcrypto; depende de `PGCRYPTO_KEY` en edge |
| Public forms | Medio | Por diseño; validación slug/IDs crítica |

### Storage

| Bucket | Público | RLS |
|--------|---------|-----|
| `attachments` | **Sí** | Autenticado genérico — **mal** |
| `messaging-attachments` | No | Atado a conversation access — **bien** |

### Auth

- Supabase Auth → `auth.users`
- Perfil CRM → `organization_members.user_id`
- JWT verificado en edge via `AuthMiddleware` (`supabase/functions/_shared/authentication.ts`)
- **No confundir** `SB_JWT_ISSUER` local con producción (ver AGENTS.md)

### Policies duplicadas / drift

- Migraciones 20260429120000, 20260629240000, 20260630260000 intentan corregir messaging RLS — señal de iteración sin convergencia
- `SYSTEM_AUDIT.md` documenta discrepancias prod vs repo en funciones `can_view_conversation`

---

## 7. Edge Functions

### Inventario completo (21)

| Función | Qué hace | Tablas | Secrets | Riesgo | Estado |
|---------|----------|--------|---------|--------|--------|
| `users` | Invites, disable, module_permissions | `organization_members`, auth | Stripe, JWT | Medio | **Producción** |
| `merge_contacts` | Merge contacts + reassign FKs | contacts, deals, tasks… | JWT | Medio | OK |
| `send_client_sms` | SMS outbound + conversation | conversations, messages, templates | Twilio, PGCRYPTO | Medio | **Producción** |
| `twilio_inbound_sms` | Webhook inbound SMS | conversations, messages | Twilio sig | **Alto** (fallback) | Producción |
| `messaging_settings` | CRUD Twilio config org | org_messaging_settings | Twilio, PGCRYPTO | Medio | OK |
| `stripe-billing` | Checkout, seats | organizations | Stripe | Medio | OK |
| `stripe-webhook` | Subscription events | organizations | Stripe sig | Bajo | OK |
| `accept_proposal` | Accept → deal stage | proposals, deals | JWT | Medio | OK |
| `submit_public_form` | Public form submit | forms, submissions | — | Medio (público) | OK |
| `get_public_form` | Public form schema | forms | — | Bajo | OK |
| `get_public_deal_brief` | Public brief view | deals, contacts | token | Medio | OK |
| `submit_project_resources` | Client resource upload | deal_resources, storage | — | Medio | OK |
| `process_website_intake` | Website lead intake | contacts, companies, deals | JWT | Medio | OK |
| `postmark` | Inbound email → notes | contact_notes, storage | Basic auth | Medio | OK |
| `get_github_repo_status` | GitHub integration | deals | GitHub token | Bajo | OK |
| `platform-directory` | SaaS operator lookup | auth.users | JWT platform | Medio | OK |
| `update_password` | Password change | auth | — | Bajo | OK |
| `whatsapp_inbound` | WhatsApp webhook | — | — | **Alto** | **Shell** |
| `send_whatsapp` | WhatsApp send | — | — | — | **503** |
| `voice_token` | Twilio voice token | — | — | — | **503** |
| `voice_status_webhook` | Voice status | — | — | Medio | **Shell** |

### Patrón común

- Todas usan `verify_jwt = false` en config.toml
- Auth manual via `AuthMiddleware` + service_role client
- Shared code en `supabase/functions/_shared/`

### Duplicación con frontend

- `dataProvider.ts` replica lógica que podría ser solo PostgREST si RLS fuera completo
- `upsertLbsClient`, lead conversion, deal operations — mix DP + edge

### Qué debería moverse

| Función | Recomendación |
|---------|---------------|
| `accept_proposal` | Mantener edge (multi-step) |
| `merge_contacts` | Mantener edge (transaccional) |
| `send_client_sms` | Mantener edge (Twilio + secrets) |
| CRUD messaging settings | Podría ser RPC + RLS si secrets en vault |
| WhatsApp/Voice shells | Implementar o eliminar del producto |

---

## 8. Frontend / UI / UX

### Fortalezas

- Sidebar floating moderno (shadcn)
- Master-detail en quick views
- Messages workspace reciente (inbox/chat/context) — dirección correcta
- Forms builder y public embed — útil para LBS
- Theming light/dark
- Kanban deals funcional

### Debilidades graves

| Área | Problema |
|------|----------|
| Dual shell mobile/desktop | No es responsive: es **otra app** sin LBS |
| Navegación | LBS nav en `navigation.ts`; contractor hardcoded en `SidebarLayout` — duplicado |
| DealShow | 5278 LOC — inusable a largo plazo |
| Consistencia | Mezcla page-shell, custom routes, Resource CRUD sin patrón único |
| Empty/error states | Irregulares entre módulos LBS |
| Settings | Monolito con demasiadas secciones |
| ProtectedRoute hacks | Calendar/Meetings usan resource `tasks` |
| Amount masking | Solo UI; API sigue exponiendo columnas |
| Messages | Recién pulido; resto del producto no al mismo nivel |

### Routing

- **LBS:** `LbsCustomRoutes.tsx` — rutas custom fuera de Resource registry
- **Contractor:** Resources en `CRM.tsx` + `MobileAdmin` swap
- **Public:** `/forms/:slug`, `/brief/:token`, `/resources/:token`

### Arquitectura UI recomendada

```
App Shell (sidebar + header únicos)
├── Workspace modules (full-bleed): Messages, Calendar, Deal project view
├── CRUD modules (list → show → edit): Leads, Clients, Proposals…
├── Settings hub (sub-routes): /settings/users, /settings/messaging…
└── Public routes (sin shell): /forms/:slug
```

### UX que no escala

- Settings todo en una página scroll infinito
- DealShow tabs sin lazy load completo
- Unread badge calculado con 6+ queries en sidebar
- Sin breadcrumbs consistentes entre módulos LBS

---

## 9. Performance

| Issue | Ubicación | Impacto |
|-------|-----------|---------|
| DealShow carga todo | Un show = decenas de queries | Alto |
| Inbox N+1 | `useInboxConversations` — múltiples getList/getMany | Alto |
| Sin paginación inbox completa | Histórico 200 conv | Medio (parcialmente mejorado) |
| Dual dataProvider | 2× mantenimiento, riesgo divergencia | Medio |
| Render loops | `markConversationRead` (corregido en branch reciente) | Era crítico |
| 118 migraciones | Deploy lento, drift | Medio |
| Realtime subscriptions | Messages OK; falta cleanup audit global | Bajo |
| Virtual inbox | Implementado — bien | — |
| Lazy load Messages | Parcial | Medio |

### React Query

- `staleTime` configurado en `lib/queryCache.ts`
- Invalidations manuales en messaging realtime — riesgo over-invalidation
- Falta prefetch en navegación sidebar → show pages

### Pagination

- List views ra-core con paginación PostgREST estándar
- Inbox messages: paginación reciente pero no en todos los filtros
- Reports: agregaciones en views — OK

---

## 10. Código y Arquitectura

### Calidad

- **TypeScript** consistente en módulos nuevos
- **Convenciones** documentadas en AGENTS.md
- **Tests:** placeholder (`make test` — casi nada); algunos tests en messages utils
- **Lint/typecheck:** `make lint`, `make typecheck` disponibles

### Anti-patterns detectados

1. **God components** (DealShow, PeopleShow, dataProvider)
2. **Parallel FakeRest provider** — deuda ~2140 LOC
3. **Tres sistemas de permisos** (administrator, roles[], module_permissions)
4. **Business logic en useEffect** sin guards (unread loop — lección reciente)
5. **SQL scripts fuera de migraciones** para prod hotfix
6. **Resource registry gigante** en CRM.tsx
7. **ProtectedRoute resource hacks** para calendar/meetings

### Separación de responsabilidades

| Capa | Estado |
|------|--------|
| UI components | Mezclados con data fetching en monolitos |
| Hooks | Buenos en messages; inconsistentes en deals |
| Services/API | Todo en dataProvider — no hay service layer |
| State | ra-core store + React Query + localStorage (messages) |
| Permissions | Catálogo TS + SQL functions — desalineados |

### Deuda técnica cuantificada

| Área | LOC deuda | Esfuerzo refactor |
|------|-----------|-------------------|
| DealShow split | ~4000 a extraer | 2-3 semanas |
| dataProvider dedup | ~2000 | 2 semanas |
| RBAC unification | — | 3-4 semanas |
| Mobile LBS parity | — | 3-4 semanas |
| Messages hardening | — | 1-2 semanas |
| Storage RLS attachments | — | 3-5 días |
| **Total ordenado** | | **~3-4 meses** 1 dev senior |

---

## 11. UX de Negocio / SaaS

### Qué falta para enterprise

- Audit log inmutable
- SSO/SAML enterprise
- Roles custom por org (RBAC_DESIGN fase 3)
- API pública / webhooks outbound
- SLA, automations, reporting unificado
- Mobile real
- Invoice/AR/AP formal

### Qué falta para contractors (LBS clientes finales)

- Comunicación bilingüe con plantillas
- Timeline único cliente
- Portal de estado de proyecto
- SMS + email unificado (crítico para mercado latino)

### Qué parece amateur

- Módulos placeholder aún en rutas
- Meetings como alias de calendar
- Unread badge inconsistente entre dispositivos
- Contractor payroll expuesto en mismo repo sin feature flags claros
- WhatsApp/Voice prometidos en UI pero no implementados

### Qué está bien encaminado

- Multi-tenant + Stripe billing
- Proposal → Project acceptance
- Web forms + project resources upload
- Task system moderno (assignees, mentions)
- Messaging data model
- record_shares para colaboración scoped

### Qué no escalará

- DealShow monolith
- Permisos híbridos
- Public attachments bucket
- Desktop-only LBS
- SQL hotfix scripts vs migration pipeline

---

## 12. Prioridades

### CRÍTICO

1. Unificar RLS messaging (`can_view_conversation` everywhere) y verificar prod = repo
2. Bucket `attachments` → privado + RLS por org/path
3. Eliminar fallback inseguro webhook Twilio
4. Auditar RPCs SECURITY DEFINER expuestos a `authenticated`
5. Alinear `module_permissions NULL` → deny by default en SQL

### ALTO

6. RBAC: una fuente de verdad UI + RLS (implementar RBAC_DESIGN fase 1-2)
7. Partir DealShow en tabs lazy-loaded / sub-routes
8. Unificar dataProvider o generar FakeRest desde contrato
9. Mobile LBS o declarar explícitamente "desktop only" en producto
10. Server-side unread / read receipts

### MEDIO

11. Eliminar código muerto (ContactsListPage, placeholders)
12. Calendar/Meetings como resource real
13. Paginación y cache inbox optimizado
14. Consolidar scripts/ → solo migraciones
15. Tests mínimos en payroll rules + messaging RLS

### BAJO

16. Lazy load Messages route
17. Cosmética UI entre módulos
18. WhatsApp/Voice — implementar o quitar del nav/settings

---

## C. Mapa completo de módulos

```
                    ┌─────────────┐
                    │ organizations│
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
  organization_members  configuration   Stripe billing
           │
     ┌─────┴─────┬──────────────┬─────────────┐
     ▼           ▼              ▼             ▼
 contacts    companies       deals        people (contractor)
 (leads)         │              │
     │           └──────┬───────┘
     │                  ▼
     │         proposals → accept → deal stages
     │                  │
     ├─ forms/tickets   ├─ deal_* (financials)
     │                  ├─ tasks / calendar_events
     └─ conversations ◄─┴─ messages (SMS/chat)
```

---

## D. Diagrama textual de relaciones (frontend)

```
CRM.tsx
├── atomic-crm (contacts, deals, tasks, settings…)
├── lbs/LbsCustomRoutes (calendar, messages, leads, clients…)
├── people|payroll|payments (contractor only)
└── MessagesQuickAccessProvider (LBS wrapper)

dataProvider (supabase)
├── PostgREST (CRUD tables)
├── invokeEdgeFunction → 15+ functions
└── lifecycle hooks (tasks, contacts, deals…)

SidebarLayout
├── LBS_NAV_ITEMS + capability filters
└── useMessagesUnreadCounts → useInboxConversations (6+ queries)

Auth flow
authProvider.ts → organization_members → canAccess.ts / memberModuleAccess.ts
```

---

## E. Problemas críticos (top 10)

1. RLS messaging desalineado / drift producción
2. Storage `attachments` público sin tenant isolation
3. Tres sistemas de permisos (admin + roles[] + module_permissions)
4. DealShow monolito (5278 LOC)
5. Dual dataProvider (~4k LOC duplicados)
6. MobileAdmin sin LBS (producto roto en móvil)
7. Edge functions verify_jwt=false + service role
8. Scripts SQL paralelos a migraciones (drift)
9. Sin módulo invoices; finanzas cliente embebidas en deals
10. WhatsApp/Voice prometidos en UI pero no implementados

---

## F. Riesgos futuros

- **Escala de datos:** inbox/messages sin índices/advisors continuos; payroll SQL complexity O(n) orgs
- **Equipo grande:** RBAC actual no soporta roles custom ni audit
- **Compliance:** PII en contacts + SMS + attachments públicos = exposición legal
- **Multi-producto:** LBS + contractor en un CRM.tsx → cada feature flag aumenta complejidad exponencial
- **Migraciones:** 118+ y subiendo; sin estrategia de squash/reset staging
- **Vendor lock-in parcial:** lógica payroll en SQL functions difícil de portar

---

## G. Arquitectura recomendada

```
┌─────────────────────────────────────────────────────────┐
│ Presentation (React)                                     │
│  modules/{lbs,contractor,shared} — routes colocated       │
│  design-system: admin + ui (frozen interfaces)           │
├─────────────────────────────────────────────────────────┤
│ Application (ra-core + hooks)                            │
│  useCases: acceptProposal, sendSms, runPayroll           │
│  permissions: single capability resolver (sync w/ SQL)    │
├─────────────────────────────────────────────────────────┤
│ API Layer                                                │
│  dataProvider (thin) → PostgREST where RLS complete      │
│  edge functions → webhooks + multi-step mutations only   │
├─────────────────────────────────────────────────────────┤
│ Domain (Postgres)                                        │
│  RLS = law | views for read models | RPC sparingly       │
└─────────────────────────────────────────────────────────┘
```

**Product split recommendation:** mantener monorepo pero **feature packages** `packages/lbs`, `packages/contractor`, `packages/core` con CRM.tsx ensamblador.

---

## H. Qué módulos rehacer

| Rehacer (parcial o total) | Por qué |
|---------------------------|---------|
| **DealShow** | Split obligatorio — no reescritura total |
| **RBAC/Permissions** | Unificar según RBAC_DESIGN.md |
| **Mobile shell** | Rehacer como responsive, no Admin swap |
| **Settings** | Sub-rutas |
| **Unread/Notifications** | Server-side |
| **WhatsApp/Voice** | Implementar o eliminar UI |

---

## I. Qué módulos salvar

- **Core CRM** (contacts, companies, deals CRUD)
- **Multi-tenant + org triggers**
- **Proposals + accept_proposal flow**
- **Web forms + public intake**
- **Tasks** (assignees, mentions, participants)
- **Messaging schema** (`conversations`, `conversation_messages`)
- **Payroll SQL engine** (con tests, no reescribir lógica)
- **Stripe billing integration**
- **record_shares** pattern

---

## J. Plan de refactor por fases

### Fase 0 — Seguridad (2-3 semanas)

- RLS messaging unificado + verificación prod
- Attachments bucket privado
- Webhook hardening
- RBAC NULL → deny

### Fase 1 — Gobernanza (3-4 semanas)

- RBAC fase 1-2 (capability catalog ↔ SQL)
- Eliminar scripts/ hotfix; pipeline migraciones único
- Tests RLS críticos

### Fase 2 — Descomposición UI (4-6 semanas)

- DealShow → `/deals/:id/{overview,financials,team,messages,resources}`
- Settings → sub-routes
- Unificar navegación LBS/contractor

### Fase 3 — Producto (4-8 semanas)

- Messages production-grade (server unread, templates, assignment)
- Customer timeline (contact-centric)
- Invoices MVP o formalizar `deal_client_payments`

### Fase 4 — Escala (ongoing)

- Mobile responsive LBS
- Automations MVP
- Observability (pg_stat_statements, advisors)

---

## K. Orden recomendado para trabajar

1. Seguridad RLS + storage
2. RBAC unification
3. DealShow split
4. Messages hardening (ya en curso)
5. dataProvider consolidation
6. Mobile/responsive
7. Invoices/billing client
8. Automations

---

## L. Lista exacta de archivos importantes

### Frontend core

- `src/components/atomic-crm/root/CRM.tsx`
- `src/components/atomic-crm/providers/supabase/dataProvider.ts`
- `src/components/atomic-crm/providers/supabase/authProvider.ts`
- `src/components/atomic-crm/providers/commons/canAccess.ts`
- `src/components/atomic-crm/providers/commons/crmPermissions.ts`
- `src/components/atomic-crm/providers/commons/memberModuleAccess.ts`
- `src/lib/permissions/permissionCatalog.ts`
- `src/components/atomic-crm/layout/SidebarLayout.tsx`
- `src/components/atomic-crm/settings/SettingsPage.tsx`
- `src/components/atomic-crm/settings/UsersSettingsSection.tsx`

### LBS

- `src/lbs/LbsCustomRoutes.tsx`
- `src/lbs/navigation.ts`
- `src/lbs/routing.ts`
- `src/lbs/productMode.ts`
- `src/lbs/messages/` (directorio completo)
- `src/lbs/deals/DealProjectTabs.tsx`
- `src/lbs/leads/`, `src/lbs/clients/`, `src/lbs/proposals/`

### Contractor

- `src/people/PeopleShow.tsx`
- `src/payrollRuns/PayrollRunsShow.tsx`
- `src/timeEntries/TimeEntriesList.tsx`
- `src/reports/ReportsPage.tsx`

### Backend shared

- `supabase/functions/_shared/authentication.ts`
- `supabase/functions/_shared/messagingConversations.ts`
- `supabase/functions/_shared/memberModulePermissions.ts`
- `supabase/functions/users/index.ts`
- `supabase/functions/send_client_sms/index.ts`
- `supabase/functions/twilio_inbound_sms/index.ts`
- `supabase/functions/accept_proposal/index.ts`

---

## M. Lista de migrations importantes

| Migración | Importancia |
|-----------|-------------|
| `20240730075029_init_db.sql` | Foundation (legacy) |
| `20260425120000_organizations_multi_tenant.sql` | **Multi-tenant** |
| `20260430160000_rename_sales_to_organization_members.sql` | Identity model |
| `20260521120000_lbs_crm_modules.sql` | LBS tables |
| `20260522231046_rbac_unified.sql` | RBAC |
| `20260630180000_organization_member_module_permissions.sql` | Granular permissions |
| `20260629230000_conversations.sql` | Messaging |
| `20260630260300_messages_module_foundation.sql` | Templates, voice schema |
| `20260630260000_unify_message_rls.sql` | RLS fix attempt |
| `20260630260600_conversation_last_message_preview.sql` | Inbox perf |
| `20260630260700_delete_empty_conversations.sql` | Empty conv cleanup |
| `20260630260200_messaging_attachments_private_bucket.sql` | Private messaging storage |

---

## N. Lista de tablas importantes

**Tenancy:** `organizations`, `organization_members`, `record_shares`, `platform_operators`

**CRM:** `contacts`, `companies`, `deals`, `tasks`, `tags`, `contact_notes`, `deal_notes`

**LBS:** `proposals`, `proposal_line_items`, `contracts`, `forms`, `form_submissions`, `tickets`, `ticket_messages`

**Project:** `deal_resources`, `deal_change_orders`, `deal_client_payments`, `deal_commissions`, `deal_workers`, `deal_expenses`, `deal_access_entries`

**Messaging:** `conversations`, `conversation_participants`, `conversation_messages`, `organization_messaging_settings`, `message_templates`

**HR:** `people`, `time_entries`, `payroll_runs`, `payroll_run_lines`, `payments`, `payment_lines`, `employee_loans`

**Calendar:** `calendar_events`

---

## O. Lista de edge functions importantes

**Must-have producción:**

- `users`
- `send_client_sms`
- `twilio_inbound_sms`
- `messaging_settings`
- `stripe-billing`
- `stripe-webhook`
- `merge_contacts`
- `accept_proposal`
- `submit_public_form`
- `get_public_form`

**Secundarias:**

- `process_website_intake`
- `postmark`
- `get_public_deal_brief`
- `submit_project_resources`
- `get_github_repo_status`
- `platform-directory`
- `update_password`

**Eliminar o implementar:**

- `whatsapp_inbound`
- `send_whatsapp`
- `voice_token`
- `voice_status_webhook`

---

## Cierre

Nomi **no es un proyecto amateur** — tiene base multi-tenant real, payroll sofisticado, RBAC en evolución, y módulos LBS que muchos CRMs no tienen (forms públicos, proposal acceptance, SMS nativo). Pero **sí parece construido por acumulación**, no por diseño de producto unificado: dos modos en un binario, tres sistemas de permisos, monolitos UI, migraciones con drift a producción, y módulos prometidos (WhatsApp, voice, invoices) que no existen.

**Recomendación estratégica:** no reescribir desde cero. **Congelar features nuevos 4-6 semanas**, ejecutar Fase 0-1 (seguridad + RBAC), partir DealShow, y luego iterar producto en Messages + customer timeline. El potencial está en ser **CRM vertical para agencias/contratistas latinos con SMS nativo y proyecto integrado** — eso sí es diferenciador si se puliere la capa de permisos y la experiencia unificada del cliente.

---

*Generado: 2026-05-22 · Versión 2 · Complementa `SYSTEM_AUDIT.md`, `RBAC_DESIGN.md`, `MESSAGES_AUDIT.md`*
