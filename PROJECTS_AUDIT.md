# Auditoría completa del módulo Projects/Deals — Nomi CRM (LBS)

> **Solo análisis — ningún archivo de código fue modificado en esta auditoría.**

---

## Resumen ejecutivo

El módulo **Projects/Deals** es el núcleo operativo de LBS en producción: la UI dice "Projects", la API y la BD usan el recurso `deals`, y la ruta canónica es **`/deals`** (`/projects` redirige). En modo LBS (`VITE_PRODUCT_MODE=lbs`), el detalle de proyecto vive en `ProjectShowPage` + `ProjectWorkspaceTabs` (~12 tabs orientados a agencia web). El Kanban compartido (`DealList` + `@hello-pangea/dnd`) funciona para listar y mover deals, pero arrastra **deuda técnica de construcción/contractor** (subcontractors, workers, `ContractorDealShow.tsx` de 5.7k LOC) mientras LBS ya tiene piezas web sólidas (brief, GitHub, credenciales, recursos, lifecycle).

**Estado general:** funcional para un equipo pequeño con pocos proyectos (prod: **4 deals**, tablas financieras casi vacías), pero **no production-grade** para una agencia web con volumen, RBAC fino, finanzas integradas en el workspace LBS, ni colaboración en tiempo real.

### Top 5 bugs / problemas críticos

1. **`can_view_deal()` compara `person_id` vs `salesperson_ids` que en LBS guardan `organization_member.id`** — usuarios scoped asignados al proyecto pueden quedar sin acceso (`supabase/migrations/20260522231046_rbac_unified.sql:187-189` vs `LbsDealInputs.tsx:381-382`).
2. **`syncProjectAssignments` es no-op en LBS** — `deal_salespersons` / junction tables nunca se sincronizan; prod tiene **0 filas** en todas las tablas junction (`deal_salespersons`, `deal_subcontractors`, `deal_workers`).
3. **`deal_access_entries.password` en texto plano** — sin cifrado ni audit log; RLS solo por `org_id`, **sin** `can_view_deal()` (`20260521190000_deal_access_entries.sql`).
4. **Kanban capped a 100 deals** sin paginación UI (`DealList.tsx:77-84`) — stages con >100 cards se truncan silenciosamente; re-index en drag hace hasta **N+1 updates** por movimiento (`DealListContent.tsx:184-300`).
5. **Sin realtime en `deals`** — dos usuarios en el pipeline no ven cambios del otro hasta refresh manual.

### Top 5 features más valiosas que faltan (LBS web dev)

1. Finanzas en workspace LBS: expenses, change orders, commissions (solo existen en `ContractorDealShow`).
2. Client portal + flujo de aprobación de mockups/copy.
3. Launch checklist bloqueante pre-go-live (hoy solo task template en automations).
4. Timeline/Gantt o milestones visuales con dependencias.
5. Cifrado + audit log para credenciales (`deal_access_entries`).

### Top 5 elementos legacy construcción a limpiar (UI, no BD)

1. Tabs Subcontractors / Hours / Expenses en `ContractorDealShow` (5.7k LOC).
2. Campos `subcontractor_ids`, `worker_ids`, `value_includes_material` en formularios contractor.
3. `deal_subcontractor_entries` UI (facturas de subs).
4. `project_address` como campo prominente (opcional en web).
5. `deal_cost_entries` con tipos `material` / `labor` orientados a obra.

### Esfuerzo estimado → production-grade web agency

| Fase | Alcance | Esfuerzo |
|------|---------|----------|
| P0 — Bugs RBAC + credenciales | Fix `can_view_deal` para org members; RLS access entries; encrypt passwords | 1–2 semanas |
| P1 — LBS financials en workspace | Port tabs payments/expenses/CO/commissions a LBS o unified show | 2–3 semanas |
| P2 — UX pipeline | Paginación Kanban, realtime deals, rollback drag errors | 1–2 semanas |
| P3 — Web agency features | Client portal, launch gate, maintenance tracking | 4–8 semanas |

**Recomendación:** **Refactor incremental**, no rebuild. La capa LBS (`src/lbs/deals/`, `src/lbs/projects/`) es el camino correcto; deprecar `ContractorDealShow` en LBS mode y extraer tabs financieros reutilizables.

---

## 1. Modelo de datos completo

**Producción (Supabase remoto, snapshot 2026-05-23):**

| Tabla | Filas aprox. | Crecimiento estimado |
|-------|--------------|----------------------|
| `deals` | 4 | Bajo hoy; escala con ventas |
| `deal_access_entries` | 1 | Por proyecto web |
| `deal_notes` | 0 | Medio |
| `deal_expenses` | 0 | Medio |
| `deal_change_orders` | 0 | Bajo–medio |
| `deal_client_payments` | 0 | Por milestone |
| `deal_commissions` | 0 | Por deal cerrado |
| `deal_cost_entries` | 0 | Legacy contractor |
| `deal_subcontractor_entries` | 0 | Legacy contractor |
| `deal_resources` | 0 | Alto (assets web) |
| `deal_salespersons` | 0 | Junction (no usada en LBS) |
| `deal_subcontractors` | 0 | Legacy |
| `deal_workers` | 0 | Legacy |

---

### 1.1 `public.deals`

**Migraciones clave:** `20240730075029_init_db.sql`, `20260310113000_projects_module_foundation.sql`, `20260311190000_project_details_operational_tabs.sql`, `20260521120000_lbs_crm_modules.sql`, `20260630260800_lbs_agency_project_lifecycle.sql`, `20260629130000_deal_github_repo.sql`, `20260630261000_deals_website_content.sql`

| Campo | Tipo | Nullable | Tags |
|-------|------|----------|------|
| `id` | bigint PK | NO | ⚙️ |
| `name` | text | NO | ⚙️ |
| `company_id` | bigint FK → companies | YES | 🌐 |
| `contact_id` | bigint FK → contacts | YES | 🌐 |
| `contact_ids` | bigint[] | YES | 🌐 legacy array |
| `company_name` | text | YES | 🌐 |
| `category` | text | YES | ⚙️ |
| `stage` | text | NO | 🌐 pipeline Kanban |
| `pipeline_id` | text | NO, default `'default'` | 🌐 |
| `description` | text | YES | ⚙️ |
| `amount` | bigint | YES | 💰 |
| `estimated_value` | numeric(12,2) | YES | 💰 |
| `original_project_value` | numeric(12,2) | YES | 💰 |
| `current_project_value` | numeric(12,2) | YES | 💰 (trigger CO) |
| `value_includes_material` | boolean | NO, default false | 🏗️ 💰 |
| `salesperson_ids` | bigint[] | NO, default `{}` | 🌐 ⚠️ LBS = org_member ids |
| `subcontractor_ids` | bigint[] | NO, default `{}` | 🏗️ |
| `worker_ids` | bigint[] | NO, default `{}` | 🏗️ |
| `project_address` | text | YES | 🏗️ opcional web |
| `project_place_id` | text | YES | 🏗️ |
| `project_address_meta` | jsonb | YES | 🏗️ |
| `project_type` | text | YES | 🌐 re-purposeado LBS |
| `website_brief` | jsonb | YES, default `{}` | 🌐 **CRÍTICO** |
| `website_content` | jsonb | NO, default `{"pages":[]}` | 🌐 |
| `github_repo` | text | YES | 🌐 **CRÍTICO** |
| `lifecycle_phase` | text | NO, default `'delivery'` | 🌐 |
| `delivery_status` | text | YES | 🌐 |
| `accepted_proposal_id` | bigint FK → proposals | YES | 🌐 |
| `priority` | text | NO, default `'normal'` | 🌐 |
| `start_date` / `expected_end_date` / `actual_completion_date` | date | YES | 🌐 / 🏗️ |
| `estimated_completion_time` | text | YES | 🏗️ |
| `organization_member_id` | bigint FK | YES | ⚙️ owner |
| `org_id` | bigint FK | NO | ⚙️ |
| `index` | smallint | YES | ⚙️ Kanban order |
| `archived_at` | timestamptz | YES | ⚙️ |
| `created_at` / `updated_at` | timestamptz | NO | ⚙️ |
| `last_message_*` | — | — | N/A (conversations) |

**Índices:** GIN en `salesperson_ids`, `worker_ids`, `subcontractor_ids`; btree en `pipeline_id`, `lifecycle_phase`, `github_repo` (partial), etc.

**Triggers:**
- `trg_deals_assign_org` — auto `org_id`
- `set_deal_organization_member_id_trigger` — default owner
- `trg_recompute_deal_current_project_value_on_deals` — recalcula `current_project_value`

**RLS (efectivo):**

```sql
-- SELECT (scoped)
create policy "deals_select_scoped" on public.deals
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.view')
    and public.can_view_deal(id)
  );

create policy "deals_insert_same_org" on public.deals
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "deals_update_same_org" on public.deals
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "deals_delete_same_org" on public.deals
  for delete to authenticated
  using (org_id = public.current_user_org_id());
```

**Bug RLS:** `can_view_deal` para scoped users:

```sql
-- 20260522231046_rbac_unified.sql:187-189
or public.current_user_person_id() = any (d.salesperson_ids)
or public.current_user_person_id() = any (d.worker_ids)
or public.current_user_person_id() = any (d.subcontractor_ids)
```

En LBS, `salesperson_ids` referencia **`organization_members`**, no `people` → asignación rota para scoped users.

---

### 1.2 `public.deal_notes`

Renombrada desde `"dealNotes"`. Campos: `id`, `deal_id`, `type`, `text`, `date`, `organization_member_id`, `attachments` (jsonb[]), `org_id`.

**RLS:** org-scoped CRUD (`deal_notes_*_same_org`). **Sin** `can_view_deal`.

---

### 1.3 Junction tables (`deal_salespersons`, `deal_subcontractors`, `deal_workers`)

Estructura: `(id, deal_id, person_id, created_at)` — FK `person_id` → **`people`**, no `organization_members`.

**RLS:** EXISTS en `deals.org_id`. **Triggers:** ninguno.

**Inconsistencia:** arrays en `deals` vs junction; `syncProjectAssignments` (`projectAssignments.ts:49-52`) **skipped en LBS** → junction siempre vacía en prod.

---

### 1.4 `public.deal_cost_entries` 🏗️

`cost_type` check: `material`, `labor`, `payroll`, `commission`, `other`. Orientado construcción.

---

### 1.5 `public.deal_subcontractor_entries` 🏗️ 💰

Subcontratistas con `status`, `invoice_number`, `cost_amount`, `material_included`. Tab contractor.

---

### 1.6 `public.deal_expenses` 💰

Campos: `expense_type`, `vendor`, `description`, `amount`, `purchase_date`, `paid`, `attachments`, `notes`.

---

### 1.7 `public.deal_change_orders` 💰

`status` check: `draft`, `sent`, `approved`, `rejected`. **Trigger** recalcula `current_project_value` vía `20260311201500`.

---

### 1.8 `public.deal_client_payments` 💰

`payment_method`, `status` (pending/cleared/bounced/deposited), `check_number`, etc.

---

### 1.9 `public.deal_commissions` 💰

`commission_type` (fixed/percentage), `basis` (payments_collected/custom), `paid`, `salesperson_id` → **people**.

---

### 1.10 `public.deal_resources` 🌐

`category`, `label`, `file` (jsonb), `visibility` (internal/client/public), `mime_kind`. RLS usa **`can_view_deal(deal_id)`**.

---

### 1.11 `public.deal_access_entries` 🌐 🔒

Credenciales: `label`, `url`, `username`, **`password` (text plano)**, `notes`.

**RLS:** solo `org_id` — **NO** `can_view_deal`:

```sql
create policy "Deal access entries org scoped" on public.deal_access_entries
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());
```

Cualquier miembro autenticado del org con capability de credentials puede ver **todas** las credenciales del org si conoce el deal_id.

---

### 1.12 Vista `public.report_project_profitability`

```sql
-- 20260227165000 — revenue = deals.amount, cost = time_entries labor only
-- NO incluye deal_expenses, change_orders, commissions
```

Usada en `ProjectProfitabilityReportPage.tsx` — **no** en detalle de deal LBS.

---

## 2. Frontend — UI y componentes

### 2.1 Routing

| Ruta | Comportamiento |
|------|----------------|
| `/deals` | Lista Kanban / tabla |
| `/deals/:id/show` | Detalle (`DealShow` → LBS o Contractor) |
| `/deals/create` | Crear proyecto |
| `/deals/:id` | Edit dialog |
| `/projects` | **Redirect → `/deals`** (`CRM.tsx`) |

Recurso ra-core: **`deals`**. Label UI: **"Projects"**.

### 2.2 Inventario de archivos (~19.900 LOC en 88 archivos)

#### `src/components/atomic-crm/deals/` (~3.926 LOC)

| Archivo | LOC | Propósito | Estado |
|---------|-----|-----------|--------|
| `DealList.tsx` | 529 | Shell lista, filtros, board/table toggle | OK, cap 100 |
| `DealListContent.tsx` | 303 | Kanban DnD + persist stage | ⚠️ race/refetch |
| `DealTableView.tsx` | 474 | Vista tabla + batch getMany | OK |
| `DealCard.tsx` | 101 | Card Kanban | OK |
| `DealColumn.tsx` | 61 | Columna + total $$ | OK |
| `DealCreate.tsx` | 187 | Create contractor | 🏗️ legacy path |
| `DealEdit.tsx` | 111 | Edit dialog | OK |
| `DealInputs.tsx` | 659 | Form contractor | 🏗️ |
| `DealShow.tsx` | 24 | Router LBS/Contractor | OK |
| `DealsExplorerPanel.tsx` | 240 | Sidebar explorer | OK |
| `ProjectStageFlow.tsx` | 189 | Stage stepper header | 🌐 |
| `projectAssignments.ts` | 63 | Sync junction | ⚠️ LBS no-op |
| `projectForm.ts` | 122 | Payload normalize | OK |
| `pipelines.ts` / `stages.ts` | 85 | Pipeline config | OK |

#### `src/lbs/deals/` (~7.859 LOC)

| Archivo | LOC | Propósito | Estado |
|---------|-----|-----------|--------|
| `WebsiteBriefTab.tsx` | 271 | Brief sections + web form | 🌐 ⚠️ localStorage sent flag |
| `websiteBriefSchema.ts` | 638 | Schema brief | 🌐 |
| `ProjectSecurityTab.tsx` | 555 | Credenciales | 🌐 🔒 plain passwords |
| `ProjectResourcesTab.tsx` | 316 | Assets / wireframes | 🌐 |
| `LbsDealInputs.tsx` | 422 | Form LBS create/edit | 🌐 |
| `LbsProjectOverviewTab.tsx` | 198 | Overview | 🌐 |
| `ProjectGithubLink.tsx` | 175 | Repo link + status | 🌐 |
| `dealStageTaskTemplates.ts` | 179 | Auto tasks on stage | 🌐 |
| `lbsAgencyProjectModel.ts` | 172 | Constants pipeline web | 🌐 |
| `* 2.ts` duplicates | — | Backups accidentales | ❌ limpiar |

#### `src/lbs/projects/` (~2.353 LOC)

| Archivo | LOC | Propósito | Estado |
|---------|-----|-----------|--------|
| `ProjectShowPage.tsx` | 299 | Shell show LBS | OK |
| `ProjectWorkspaceTabs.tsx` | 378 | 12 tabs | OK |
| `AgencyProjectCreateForm.tsx` | 252 | Create flow | 🌐 |
| `tabs/ProjectPaymentsTab.tsx` | 181 | Pagos cliente | ⚠️ parcial |
| `tabs/ProjectScopeTab.tsx` | 125 | Propuesta aceptada | 🌐 |
| `tabs/ProjectContentTab.tsx` | 186 | Website content pages | 🌐 |
| `tabs/ProjectScheduleTab.tsx` | 18 | Placeholder | ❌ stub |
| `tabs/ProjectActivityTab.tsx` | 62 | Activity | ⚠️ básico |
| `projectStageAutomations.ts` | 107 | Tasks on stage | 🌐 |

#### `src/contractor/deals/ContractorDealShow.tsx` — **5.772 LOC** 🏗️

Monolito con todos los tabs financieros + subcontractors. **No se usa en LBS mode** pero sigue en bundle (lazy).

---

### 2.3 Flujos end-to-end

#### 1) Usuario abre `/deals`

```
DealList → <List perPage={100} pagination={null}>
  → useListContext fetches deals (archived_at null)
  → DealLayout → board: DealListContent | table: DealTableView
  → DealsExplorerPanel (sidebar en show) perPage 200
```

#### 2) Drag deal a otro stage

```
onDragEnd → updateDealStageLocal (optimistic)
  → updateDealStage → getList both columns + Promise.all updates
  → refetch() full list
  → LBS: createStageTasksForDeal + notify toast
```

**Issues:** sin rollback si API falla; refetch agresivo; cap 100 en re-index queries.

#### 3) Abrir detalle `/deals/:id/show`

```
DealShow → isLbsMode() ?
  ProjectShowPage (ShowBase deals)
    → header: stage flow, delivery urgency, SMS, share
    → ProjectWorkspaceTabs (?tab=overview|scope|...)
  : ContractorDealShow (5.7k LOC)
```

#### 4) Crear deal

```
/deals/create → ProjectCreateFlow → AgencyProjectCreateForm
  → normalizeProjectPayload → dataProvider.create("deals")
  → LBS: no syncProjectAssignments
```

#### 5) Añadir gasto / CO / pago

- **LBS:** solo `ProjectPaymentsTab` → `deal_client_payments`
- **Contractor:** tabs completos en `ContractorDealShow`

#### 6) Asignar salesperson

- **LBS:** `LbsDealInputs` → `ReferenceArrayInput` `salesperson_ids` → `organization_members`
- **Contractor:** `DealInputs` → `people` type=salesperson + `syncProjectAssignments`

---

## 3. Vista Kanban / Pipeline

| Aspecto | Implementación |
|---------|----------------|
| Librería | `@hello-pangea/dnd` |
| Paginación | **Ninguna** — max 100 deals total en lista |
| Optimistic | Sí (local state) |
| Persist | Async updates + `refetch()` |
| Filtros | Company, category, pipeline_id, "Only mine" |
| Búsqueda | Spotlight global (no in-board search) |
| Total $$ columna | Sí — `DealColumn` + `MoneyText` + `useCanViewAmounts` |
| Stages custom | vía `ConfigurationContext` / pipelines config |
| 100+ deals | **Truncado silencioso**; drag re-index puede desincronizar |

**Performance drag:** cross-column = 2× `getList` + hasta `(n+m)` updates en paralelo.

---

## 4. Vista detalle del deal (LBS tabs)

Query param: `?tab=` (`dealProjectTabUtils.ts`).

| Tab | Componente | ¿Funciona? | Notas |
|-----|------------|------------|-------|
| Overview | `LbsProjectOverviewTab.tsx` | ✅ | Montos, fechas, equipo |
| Scope | `ProjectScopeTab.tsx` | ⚠️ | Requiere `accepted_proposal_id` |
| Brief | `WebsiteBriefTab.tsx` | ✅ 🌐 | Secciones editables; sent flag en **localStorage** |
| Content | `ProjectContentTab.tsx` | ⚠️ 🌐 | Pages JSON; básico |
| Assets | `ProjectResourcesTab.tsx` | ✅ 🌐 | Upload + categorías |
| Tasks | inline `ProjectWorkspaceTabs` | ✅ | Usa tasks globales |
| Schedule | `ProjectScheduleTab.tsx` | ❌ | **Stub ~18 LOC** |
| Messages | `ProjectMessagesTab.tsx` | ✅ | Conversación proyecto |
| Payments | `ProjectPaymentsTab.tsx` | ⚠️ 💰 | CRUD básico; sin milestones |
| Activity | `ProjectActivityTab.tsx` | ⚠️ | Limitado |
| Settings | `ProjectSettingsTab.tsx` | ✅ | Incluye `ProjectSecurityTab` credenciales |
| — Proposals | link desde Scope | ⚠️ | No tab dedicado |
| — Contracts | NO ENCONTRADO | ❌ | Sin tab en workspace LBS |
| — Expenses | NO en LBS | ❌ | Solo contractor |
| — Change orders | NO en LBS | ❌ | Solo contractor |
| — Commissions | NO en LBS | ❌ | Solo contractor |
| — Subcontractors | NO en LBS | ✅ oculto | 🏗️ |
| — Workers | NO en LBS | ✅ oculto | 🏗️ |
| — GitHub | `ProjectGithubLink` en header/overview | ⚠️ 🌐 | Link + status, no PR tracking |
| — Activity log | parcial | ⚠️ | No audit trail completo |

---

## 5. Asignación de personas

### Salesperson (LBS)

- **UI:** `LbsDealInputs.tsx:381-382` — `salesperson_ids` → `organization_members`
- **Persist:** array en `deals.salesperson_ids` ✅
- **Junction:** `syncProjectAssignments` **no corre** en LBS → `deal_salespersons` vacía
- **RBAC visibility:** `can_view_deal` usa `person_id` ❌ **incompatible**

### Salesperson (Contractor)

- **UI:** `DealInputs.tsx` — `people` salesperson
- **Sync:** `deal_salespersons` junction ✅

### Subcontractors / Workers 🏗️

- Arrays + junction tables + UI solo en `ContractorDealShow` / `DealInputs`
- `worker_ids`: **sin UI dedicada** en LBS; schema existe

### Comisiones

- Tab `DealCommissionsTab` contractor-only
- `salesperson_id` → `people`; **no auto-create** al asignar salesperson
- Manual CRUD

---

## 6. Finanzas del deal

### Gastos (`deal_expenses`) — contractor only

UI completa en `ContractorDealShow` ~2538. Campos: vendor, paid flag, attachments. Sin categorías web-specific.

### Change orders — contractor only

Workflow status draft→sent→approved→rejected. **Trigger** actualiza `current_project_value`. Sin notificación cliente. Sin distinción scope creep vs billable en UI.

### Pagos cliente

- **LBS:** `ProjectPaymentsTab.tsx` — amount, reference, status pending; totales Project/Collected/Balance
- Sin schedule milestones, sin link a proposals/contracts, sin reminders

### Comisiones — contractor only

Fixed/percentage; basis payments_collected. Tracking paid/unpaid manual.

### Profit / Margin

- Vista `report_project_profitability` — labor hours only, no expenses
- **No** profit view en deal show LBS
- `DealSummaryTab` contractor agrega todo — no portado a LBS

---

## 7. RLS y permisos

### Capabilities (`permissionCatalog.ts`)

| Capability | Uso |
|------------|-----|
| `crm.pipeline.view/create/edit/delete` | CRUD deals |
| `deal_operations.resources.*` | deal_resources |
| `deal_operations.credentials.*` | deal_access_entries |
| `deal_operations.subcontractors.*` | 🏗️ subcontractor entries |
| `deal_financials.expenses/change_orders/collections/commissions.*` | Tablas financieras |
| `view_amounts.show` | `MoneyText` / `useCanViewAmounts` en UI |

### Scoping

- `can_view_deal(id)` — admin bypass; scoped users por owner, **person arrays**, record_shares
- `record_shares` — `resource_type = 'deals'`; UI `ShareRecordModal` en `ProjectShowPage`
- **Bug:** LBS assignment IDs no matchean person_id check

### UPDATE deals

Cualquier miembro del org puede UPDATE cualquier deal del org (no scoped en UPDATE policy) — **similar riesgo a Messages pre-fix**.

---

## 8. Performance

| Métrica | Hallazgo |
|---------|----------|
| Carga `/deals` | 1× getList deals (100) + config; table view +2 getMany (companies, contacts, members) |
| Carga show LBS | ShowBase 1 deal + lazy tab queries (payments, resources, tasks, etc.) |
| N+1 Kanban | Cards usan datos del list; ReferenceField company en card → **no extra fetch per card** si company_id denormalizado |
| Bundle | `ContractorDealShow` lazy pero 5.7k LOC chunk |
| Realtime | **NO EXISTE** para deals |
| Memory | `DealListContent` eslint-disable deps en useEffect — posible stale closure |
| Drag | Múltiples updates paralelos sin transaction |

**Queries típicas al abrir Kanban:** `GET /deals?archived_at=is.null&order=index.desc&limit=100`

---

## 9. Bugs conocidos

| # | Severidad | Descripción | Ubicación |
|---|-----------|-------------|-----------|
| B1 | 🔴 | `salesperson_ids` org_member vs `can_view_deal` person_id | `rbac_unified.sql:187`, `LbsDealInputs.tsx:381` |
| B2 | 🔴 | Passwords credenciales sin cifrar | `deal_access_entries.password`, `ProjectSecurityTab.tsx` |
| B3 | 🟠 | Kanban silent cap 100 deals | `DealList.tsx:77-84` |
| B4 | 🟠 | Drag fail sin rollback UI | `DealListContent.tsx:91-115` |
| B5 | 🟠 | `deal_access_entries` RLS sin deal scoping | migration `20260521190000` |
| B6 | 🟡 | Brief "form sent" solo localStorage | `briefFormSentStorage.ts:7-10` |
| B7 | 🟡 | Duplicate `* 2.tsx` backup files | `src/lbs/deals/`, `src/lbs/projects/` |
| B8 | 🟡 | `catch { notify warning }` traga error stage tasks | `DealListContent.tsx:109-113` |
| B9 | 🟡 | `report_project_profitability` revenue = `amount` no `current_project_value` | view SQL |
| B10 | 🟡 | UPDATE deals no respeta scoped visibility | RLS update policy |

**TODOs/FIXMEs en módulo:** **NO ENCONTRADOS** (código limpio de markers, pero deuda implícita).

---

## 10. Legacy construcción a limpiar

| Elemento | Tipo | Ubicación | Acción recomendada |
|----------|------|-----------|-------------------|
| `subcontractor_ids` | column | `deals` | Mantener BD; ocultar UI LBS ✅ ya oculto |
| `worker_ids` | column | `deals` | Mantener; ocultar UI |
| `deal_subcontractors` / `deal_workers` | tables | DB | Mantener; no UI LBS |
| `deal_subcontractor_entries` | table + tab | ContractorDealShow | Ocultar LBS ✅ |
| `deal_cost_entries` cost_type material/labor | schema | DB | Ocultar; re-label para web ops |
| `value_includes_material` | column | deals | Ocultar en forms web |
| `project_address*` | columns | deals | Opcional, no required |
| `ContractorDealShow.tsx` | UI 5772 LOC | contractor/ | No cargar en LBS bundle |
| `DealInputs.tsx` assignment section | UI | atomic-crm/deals | Solo contractor mode |
| `actual_completion_date` | column | deals | Renombrar label → "Launched date" web |

**Estrategia:** feature flag `org.industry` o usar `isLbsMode()` (ya parcial). **NO** drop columns.

---

## 11. Features faltantes para web agency

### Brief y discovery

| Feature | Estado |
|---------|--------|
| Brief editable por secciones | ✅ `WebsiteBriefTab` + schema |
| Templates por tipo proyecto | ⚠️ `lbsAgencyProjectTypes` labels, no template content |
| Cliente llena brief vía link | ⚠️ `SendProjectWebFormDialog` + form_submissions |
| Aprobación brief pre-start | ⚠️ section approval en schema; no gate bloqueante |

### Design phase

| Feature | Estado |
|---------|--------|
| Galería wireframes/mockups | ⚠️ `deal_resources` por categoría |
| Version tracking | ❌ |
| Client approval system | ❌ |

### Development

| Feature | Estado |
|---------|--------|
| GitHub repo link | ✅ `github_repo` + `ProjectGithubLink` |
| PR/branch tracking | ❌ |
| Staging/production URLs | ❌ |
| Tech stack field | ❌ |

### Launch checklist

| Feature | Estado |
|---------|--------|
| Pre-launch items (SEO, SSL, etc.) | ⚠️ task template en `projectStageAutomations.ts:48-50` |
| Checklist UI marcable | ❌ |
| Block go-live until complete | ❌ |

### Maintenance

| Feature | Estado |
|---------|--------|
| Maintenance contract flag | ⚠️ project_type `maintenance` |
| Hours used vs included | ❌ |
| Maintenance tickets | ❌ |

### Access management 🔒

| Feature | Estado |
|---------|--------|
| Presets hosting/WP/GA/etc. | ✅ `PROJECT_ACCESS_PRESETS` |
| CRUD credenciales | ✅ `ProjectSecurityTab` |
| Encryption passwords | ❌ plain text |
| Audit log accesos | ❌ |

### PM general

| Feature | Estado |
|---------|--------|
| Gantt / timeline visual | ❌ (`ProjectScheduleTab` stub) |
| Milestones | ❌ |
| Time tracking por deal | ⚠️ `time_entries.project_id` contractor hours tab |
| Budget vs actual | ❌ en LBS workspace |
| Risk tracker | ❌ |

### Cliente-facing

| Feature | Estado |
|---------|--------|
| Client portal | ❌ |
| Approval requests | ❌ |
| File sharing cliente | ⚠️ resources visibility `client` |
| Status updates automáticos | ❌ |

### Reportes

| Feature | Estado |
|---------|--------|
| Win rate | ❌ |
| Revenue por mes | ⚠️ reports module separado |
| Profitability por proyecto | ⚠️ view + report page, no deal tab |
| Sales rep performance | ❌ |
| Aging proyectos | ❌ |

### Automatizaciones

| Feature | Estado |
|---------|--------|
| Stage → task templates | ✅ `dealStageTaskTemplates` + `projectStageAutomations` |
| Stage → notify team | ❌ |
| Client email on stage change | ❌ |
| Auto invoice per milestone | ❌ |

---

## 12. Comparación con competencia

| Capacidad | ClickUp | Monday | Asana | Basecamp | **Nomi hoy (LBS)** |
|-----------|---------|--------|-------|----------|-------------------|
| Kanban customizable | ✅ | ✅ | ✅ | ⚠️ | ✅ pipelines config |
| Gantt | ✅ | ✅ | ✅ | ❌ | ❌ stub Schedule tab |
| Client portal | ⚠️ | ✅ | ⚠️ | ✅ | ❌ |
| Time tracking | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ contractor hours only |
| Financials nativos | ❌ | ⚠️ | ❌ | ❌ | ✅ DB completa; ⚠️ LBS UI parcial |
| Web dev specific | ❌ | ❌ | ❌ | ❌ | ⚠️ brief, github, creds, resources |
| Credentials vault | ⚠️ integrations | ⚠️ | ❌ | ❌ | ⚠️ sin encrypt |
| SMS integrado | ❌ | ❌ | ❌ | ❌ | ✅ ventaja Nomi |

**Ventaja diferenciadora Nomi:** finanzas + CRM + mensajes + credenciales + brief en un solo producto Supabase-native.

**Gap vs competencia:** client portal, Gantt, realtime collaboration, mobile polish.

---

## 13. Archivos clave

| # | Archivo | LOC | Propósito | Estado |
|---|---------|-----|-----------|--------|
| 1 | `DealList.tsx` | 529 | Entry list/board | ⚠️ cap 100 |
| 2 | `DealListContent.tsx` | 303 | Kanban DnD | ⚠️ drag races |
| 3 | `DealTableView.tsx` | 474 | Table view | OK |
| 4 | `ProjectShowPage.tsx` | 299 | LBS show shell | OK |
| 5 | `ProjectWorkspaceTabs.tsx` | 378 | Tab router | OK |
| 6 | `WebsiteBriefTab.tsx` | 271 | Web brief | 🌐 |
| 7 | `websiteBriefSchema.ts` | 638 | Brief data model | 🌐 |
| 8 | `ProjectSecurityTab.tsx` | 555 | Credentials | 🔒 ⚠️ |
| 9 | `ProjectResourcesTab.tsx` | 316 | Assets | 🌐 |
| 10 | `LbsDealInputs.tsx` | 422 | LBS forms | ⚠️ RBAC ids |
| 11 | `projectAssignments.ts` | 63 | Junction sync | ⚠️ LBS skip |
| 12 | `dealStageTaskTemplates.ts` | 179 | Auto tasks | 🌐 |
| 13 | `projectStageAutomations.ts` | 107 | Stage hooks | 🌐 |
| 14 | `ProjectPaymentsTab.tsx` | 181 | LBS payments | ⚠️ parcial |
| 15 | `ContractorDealShow.tsx` | 5772 | Contractor monolith | 🏗️ legacy |
| 16 | `DealInputs.tsx` | 659 | Contractor forms | 🏗️ |
| 17 | `lbsAgencyProjectModel.ts` | 172 | Pipeline constants | 🌐 |
| 18 | `permissionCatalog.ts` | — | RBAC map | referencia |
| 19 | `20260522231046_rbac_unified.sql` | — | can_view_deal | ⚠️ bug LBS |
| 20 | `AgencyProjectCreateForm.tsx` | 252 | Create LBS | OK |

---

## 14. Plan de rediseño priorizado

### P0 — Seguridad y acceso (1–2 semanas)

1. Fix `can_view_deal` — comparar `salesperson_ids` con `organization_members.id` para LBS (o unify on junction table).
2. RLS `deal_access_entries` → add `can_view_deal(deal_id)`.
3. Encrypt passwords at rest (pgsodium or app-layer) + reveal audit log.

### P1 — Paridad financiera LBS (2–3 semanas)

1. Extract financial tabs from `ContractorDealShow` into shared components.
2. Mount Expenses, Change Orders, Commissions in `ProjectWorkspaceTabs` behind capabilities.
3. Profit summary card on Overview using `current_project_value` − expenses − labor.

### P2 — Pipeline UX (1–2 semanas)

1. Pagination or virtual scroll per column; remove silent 100 cap.
2. Supabase realtime subscription on `deals` for multi-user boards.
3. Drag error rollback + toast on failure.

### P3 — Web agency differentiation (4–8 semanas)

1. Launch checklist tab (block stage → launch until complete).
2. Client portal (read-only scope, assets, approvals).
3. Milestones + timeline (replace Schedule stub).
4. Maintenance retainer tracking.

### P4 — Legacy cleanup (ongoing)

1. Hide contractor UI paths when `isLbsMode()`.
2. Delete duplicate `* 2.tsx` files.
3. Document `project_type` as web service taxonomy.

---

## Metadatos de auditoría

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-05-23 |
| **Commit** | `c427b653b16f88a4ee06dae56aa4777a0ee05297` |
| **Modo producto** | LBS (`VITE_PRODUCT_MODE=lbs`) |
| **Herramientas** | Exploración codebase, `grep`, migraciones SQL, Supabase MCP `execute_sql` (row counts), lectura `SYSTEM_AUDIT.md`, `RBAC_DESIGN.md`, `permissionCatalog.ts`, `MESSAGES_REAUDIT.md` |
| **Archivos investigados** | ~88 archivos en `src/components/atomic-crm/deals/`, `src/lbs/deals/`, `src/lbs/projects/`, `src/contractor/deals/`; 15+ migraciones Supabase |

### Preguntas abiertas

1. ¿Existe data histórica en `subcontractor_ids` / `deal_subcontractor_entries` en orgs contractor que impida unificar IDs en `salesperson_ids`?
2. ¿Cuál es el pipeline stage config real en producción (custom vs `lbsAgencyPipelineStages`)?
3. ¿Se planea mantener `ContractorDealShow` para otra org/industry o solo LBS web?
4. ¿Hay integración GitHub OAuth planificada o solo URL manual?
5. ¿Política de retención para `deal_access_entries.password` — rotation, who viewed?

---

## 15. Checkpoint final — Rediseño Web Agency (post-implementación)

> **Fecha checkpoint:** 2026-05-23  
> **Commit:** `2bd71fa` (`main`)  
> **Alcance:** Fases 0–4 del plan Web Agency Edition

### Entregables del plan

| Fase | Estado | Notas |
|------|--------|-------|
| **0** — Limpieza legacy contractor | ✅ | `ContractorDealShow` fuera del bundle LBS (lazy chunk contractor-only) |
| **1** — Seguridad P0 | ✅ | `can_view_deal` LBS, RLS scoped, passwords cifrados, audit log, edge `access_entry_password` |
| **2** — Finanzas LBS | ✅ | Expenses, Change Orders, Commissions, Payments milestones, Profit summary |
| **3** — Pipeline UX | ✅ | 11 stages web agency, kanban paginado, realtime, drag rollback, org pipeline stages |
| **4** — Web agency features | ✅ | Launch checklist + gating, portal token, milestones/timeline, maintenance, tech URLs, reports |

### Verificación automatizada (2026-05-23)

| Check | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `VITE_PRODUCT_MODE=lbs npm run build` | ✅ — `ContractorDealShow` **no** aparece en chunks `dist/assets/*.js` |
| `npm run test` | ⚪ placeholder (sin unit tests) |
| Edge functions desplegadas | ✅ `access_entry_password`, `client_portal` |
| Tablas nuevas en remoto | ✅ 10/10 (`deal_access_entry_audit`, launch checklist, portal, milestones, maintenance, `organization_pipeline_stages`) |
| Columnas `deals` | ✅ `tech_stack`, `staging_url`, `production_url` |
| RLS scoped | ✅ `deals_*_scoped`, `deal_access_entries_*_scoped`, `deal_notes_*_scoped` |
| Realtime `deals` | ✅ publicación activa |
| Seed data | ✅ 40 launch checklist templates, 55 org pipeline stages |

### Test manual — 15 flujos

Estado tras revisión de código + schema remoto. **Browser QA pendiente** en staging/prod.

| # | Flujo | Código / BD | Browser QA |
|---|-------|-------------|------------|
| 1 | Login admin → Kanban stages web agency | ✅ `LBS_WEB_PIPELINE_STAGES`, `organization_pipeline_stages` | ☐ |
| 2 | Crear deal → asignar salesperson → mover a Design → auto-tasks | ✅ stage automations + templates | ☐ |
| 3 | Tab Expenses → gasto → Profit Summary | ✅ `ExpensesTab`, `ProfitSummaryCard` | ☐ |
| 4 | Tab Change Orders → aprobar → `current_project_value` | ✅ `ChangeOrdersTab` + trigger CO | ☐ |
| 5 | Tab Commissions → auto al mover a Won | ✅ `CommissionsTab` + stage hook | ☐ |
| 6 | Tab Payments → milestones de pago | ✅ `ProjectPaymentsTab` | ☐ |
| 7 | Tab Launch → checklist desde template | ✅ `LaunchChecklistTab`, 40 templates | ☐ |
| 8 | Mover a Launch con checklist completa | ✅ `launchChecklistGate.ts` | ☐ |
| 9 | Tab Security → credential cifrada en BD | ✅ edge + `password_encrypted` | ☐ |
| 10 | Tab Activity → log de cambios | ✅ `ProjectActivityTab` | ☐ |
| 11 | Invitar cliente → portal con token | ✅ `ClientPortalSection`, edge `client_portal` | ☐ |
| 12 | Cliente aprueba mockup → notificación team | ⚠️ schema `deal_approvals`; **sin UI respond** | ☐ |
| 13 | Crear milestone → timeline | ✅ `ProjectScheduleTab` (CSS timeline, no frappe-gantt) | ☐ |
| 14 | Log hours retainer → contador | ✅ `MaintenanceTab` | ☐ |
| 15 | Reports → win rate y revenue | ✅ `/reports` LBS + `report_web_agency_metrics` | ☐ |

### Gaps conocidos (fuera del MVP entregado)

- UI de aprobaciones cliente + notificación al equipo (flujo #12).
- Portal: login `auth.users` completo; hoy es token read-only MVP.
- Gantt drag-and-drop (frappe-gantt no instalado).
- Health-check periódico de staging/production URLs.
- Reporte aging deals (solo win rate + revenue en vista actual).

### Bugs de auditoría original — resolución

| # | Problema original | Estado post-rediseño |
|---|-------------------|----------------------|
| 1 | `can_view_deal` person vs org_member | ✅ Fixed migration `20260630300000` |
| 2 | `syncProjectAssignments` no-op | ✅ Deprecated en LBS |
| 3 | Passwords plain text | ✅ pgcrypto + edge function |
| 4 | Kanban cap 100 | ✅ Per-stage pagination (`useStageDeals`) |
| 5 | Sin realtime deals | ✅ `useDealsRealtime` + publication |

---

*Fin del reporte.*
