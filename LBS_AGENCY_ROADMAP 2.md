# LBS Agency Platform — Roadmap & Separation Plan

> **Objetivo:** Reenfocar Nomi CRM modo LBS como plataforma de agencia marketing/web. Contractor mode se conserva pero aislado.  
> **Regla:** implementación por fases con checkpoints compilables.  
> **Fecha:** 2026-05-22

---

## A. Diagnóstico — qué está mezclado

### Contaminación principal

| Área | Problema | Severidad |
|------|----------|-----------|
| `DealShow.tsx` (5278 LOC) | ~3500 LOC contractor tabs compiladas en bundle LBS (dead branch) | **Crítico** |
| `DealInputs.tsx` | Campos construction: address, material, original/current value, workers | Alto |
| `LbsDealInputs.tsx` | `salesperson_ids` → `people` (tabla HR contractor) | Alto |
| `CRM.tsx` | Child resources contractor registrados globalmente en LBS | Medio |
| `projectForm.ts` | Setea `original_project_value`, `value_includes_material` en LBS | Medio |
| `projectAssignments.ts` | Sync `deal_subcontractors` en create | Medio |
| `DealCreate.tsx` | `syncProjectAssignments` incluye subcontractor_ids | Medio |
| `defaultConfiguration.ts` | `defaultPayrollSettings` cargado siempre | Bajo |
| `permissionCatalog.ts` | Caps `deals.original_project_value` visibles en LBS | Bajo |

### Lo que LBS ya hace bien (aislado)

- Rutas `/people`, `/payroll_runs`, `/payments`, `/reports` → redirect en LBS
- Resources `people`, `time_entries`, etc. no registrados en LBS
- `DealProjectTabs` — tabs agency-only
- Nav `LBS_NAV_ITEMS` — sin payroll/people

### Lo que sigue filtrándose

1. **Bundle size:** DealShow importa `@/timeEntries/helpers`, tabs contractor inline
2. **Data model:** `deals.subcontractor_ids`, `worker_ids`, `value_includes_material` escribibles desde API
3. **Create form:** Referencia `people` para team assign
4. **Global resources:** `deal_subcontractor_entries`, `deal_expenses`, `deal_change_orders`, `deal_commissions` registrados en LBS CRM.tsx

---

## B. Nueva arquitectura LBS Projects

```
Agency Project Workspace
├── Domain: deals row + lifecycle_phase=delivery
├── UI: ProjectShowPage (LBS) — reemplaza DealShow branch
├── Create: AgencyProjectCreateFlow — reemplaza DealCreate LBS path
├── Tabs: Overview | Scope | Brief | Content | Assets | Tasks | Schedule | Messages | Payments | Activity | Settings
└── Automations: dealStageTaskTemplates + hooks on stage change
```

**No tabla `projects` separada** (Opción C — ver PROJECTS_AUDIT.md).

---

## C. Plan por fases

| Fase | Nombre | Entregable | Riesgo |
|------|--------|------------|--------|
| **1** | Auditoría separación | Este doc + sección abajo | Ninguno |
| **2** | Modelo agency | Migración + constants + types | Bajo |
| **3** | Create form | AgencyProjectCreateForm | Medio |
| **4** | Project detail | ProjectShowPage + lazy tabs | Alto |
| **5** | Assets | Private storage + visibility | **Crítico** seguridad |
| **6** | Content system | website_content JSONB o tabla | Medio |
| **7** | Approvals | JSONB approvals en brief/content | Medio |
| **8** | Automations | Stage hooks + templates | Bajo |
| **9** | Limpieza contractor | Split bundles, hide resources | Medio |
| **10** | QA + docs | Checklist producción | Bajo |

---

## FASE 1 — Auditoría de separación (detalle)

### 1. Archivos contractor mezclados con LBS

#### Monolito compartido (debe split)

| Archivo | LOC contractor | Acción |
|---------|----------------|--------|
| `src/components/atomic-crm/deals/DealShow.tsx` | ~3500 | Extraer a `ContractorDealShow.tsx`; LBS → `ProjectShowPage.tsx` |
| `src/components/atomic-crm/deals/DealInputs.tsx` | ~630 | LBS usa `LbsDealInputs`; contractor queda en DealInputs |
| `src/components/atomic-crm/deals/projectForm.ts` | parcial | Branch LBS vs contractor en normalize |
| `src/components/atomic-crm/deals/projectAssignments.ts` | 100% | LBS: solo org members; contractor: people junctions |

#### Imports contractor en DealShow (LBS bundle)

```typescript
// DealShow.tsx — contractor-only imports que LBS carga innecesariamente:
import { calculateHours, splitRegularOvertimeHours } from "@/timeEntries/helpers";
// Types: DealSubcontractorEntry, DealExpense, DealChangeOrder, DealCommission, DealClientPayment
// Inline components: DealHoursTab, DealSubcontractorsTab, DealExpensesTab,
//   DealChangeOrdersTab, DealCommissionsTab, DealPaymentsTab, DealDocumentsTab...
```

#### Archivos 100% contractor (OK en contractor mode)

```
src/people/*
src/payrollRuns/*
src/payments/*
src/timeEntries/*
src/reports/*
src/loans/*
src/payroll/*
src/reports/ProjectProfitabilityReportPage.tsx
```

#### Registrados en CRM.tsx globalmente (contaminan LBS PostgREST client)

```typescript
// Siempre registrados (incluso LBS):
<Resource name="deal_subcontractor_entries" />
<Resource name="deal_expenses" />
<Resource name="deal_change_orders" />
<Resource name="deal_commissions" />
<Resource name="deal_client_payments" />  // LBS necesita — mover a LBS block
<Resource name="deal_notes" />
```

### 2. Componentes a mover fuera del bundle LBS

| Componente | Destino |
|------------|---------|
| `DealHoursTab` | `src/contractor/deals/tabs/DealHoursTab.tsx` |
| `DealSubcontractorsTab` | `src/contractor/deals/tabs/` |
| `DealExpensesTab` | `src/contractor/deals/tabs/` |
| `DealChangeOrdersTab` | `src/contractor/deals/tabs/` |
| `DealCommissionsTab` | `src/contractor/deals/tabs/` |
| `DealPaymentsTab` | Shared → `src/lbs/deals/tabs/ProjectPaymentsTab.tsx` (LBS) + contractor copy |
| `DealSummaryTab` contractor | `ContractorDealShow` |

### 3. Imports contractor en Project/Deal UI LBS

| Archivo LBS | Import contractor | Fix |
|-------------|-------------------|-----|
| `LbsDealInputs.tsx` | `ReferenceArrayInput reference="people"` | → `organization_members` |
| `ProjectAssignedAvatars.tsx` | `salesperson_ids` → people | → assigned member ids |
| `DealCreate.tsx` | `syncProjectAssignments` subcontractors | LBS: skip subcontractors |
| `DealEdit.tsx` | sync salespersons + subcontractors | Branch LBS |
| `projectForm.ts` | original/current value, material | Skip en LBS |

### 4. Eliminar del bundle LBS (Fase 9)

- [ ] Lazy import `ContractorDealShow` solo en `!isLbsMode()`
- [ ] `@/timeEntries/helpers` fuera de DealShow LBS path
- [ ] `deal_subcontractor_entries`, `deal_expenses`, `deal_change_orders`, `deal_commissions` resources → contractor-only block
- [ ] `defaultPayrollSettings` lazy en ConfigurationContext contractor

### 5. Queda en contractor mode

- Todo `src/people/`, payroll, payments, time entries, reports
- `DealInputs.tsx` completo con address, material, workers
- Contractor DealShow tabs
- `deal_cost_entries`, `deal_workers` junctions
- Project profitability report

### 6. Shared components OK

- `TaskTable`, `AddTask`, `TaskFormContent` (branches LBS exist)
- `ShareRecordModal`, `MoneyText`, `canAccess`
- `DealList`, Kanban, `ProjectStageFlow`
- `WebsiteBriefTab`, `ProjectResourcesTab`, `DealProjectTabs` (rename → ProjectWorkspaceTabs)
- Calendar, Messages modules
- Core CRM: contacts, companies, tasks, notes

---

## FASE 2 — Definición Agency Project (implementado)

Ver `src/lbs/deals/lbsAgencyProjectModel.ts` y migración `20260630260800_lbs_agency_project_lifecycle.sql`.

### Tipos de proyecto LBS

| ID | Label |
|----|-------|
| `website` | Website |
| `seo` | SEO |
| `google-ads` | Google Ads |
| `social-media` | Social Media |
| `branding` | Branding |
| `automation` | Automation |
| `crm-setup` | CRM Setup |
| `maintenance` | Maintenance / Hosting |

Legacy types (`new-website`, `redesign`, etc.) mapeados via `normalizeAgencyProjectType()`.

### Campos nuevos en `deals`

| Campo | Uso |
|-------|-----|
| `lifecycle_phase` | `opportunity` \| `delivery` \| `closed` |
| `delivery_status` | Sub-estado operativo (planning, in_design, …) |
| `accepted_proposal_id` | FK proposal aceptada |
| `priority` | low \| normal \| high \| urgent |

### Campos a dejar de usar en LBS UI (no borrar BD)

- `subcontractor_ids`, `worker_ids`
- `value_includes_material`
- `original_project_value`, `current_project_value` (usar `amount` + proposal)
- `project_address`, `project_place_id` (construction site)
- `deal_subcontractor_entries`, `deal_expenses`, `deal_change_orders`, `deal_commissions`

### Flujo de etapas

```
Lead → Client → Proposal → [accept] → Project (lifecycle_phase=delivery)
  → Brief → Assets → Tasks → Review → Launch → Completed (lifecycle_phase=closed)
```

**Kanban `stage` (5 columns):** setup → in_progress → client_review → launch → delivered  
**`delivery_status` (detalle):** planning, waiting_client, in_design, in_development, internal_review, client_review, revisions, ready_to_launch, launched, completed, on_hold, cancelled

---

## FASE 3–10 — Resumen (implementación futura)

### Fase 3 — Create Form

- Nuevo `AgencyProjectCreateDialog.tsx` multi-step
- Campos dinámicos por `project_type`
- Require: company_id, contact_id, project_type, name
- Default: lifecycle_phase=delivery, delivery_status=planning
- Block create without client
- Optional: accepted_proposal_id picker
- Auto: tasks + missing asset flags via `dealStageTaskTemplates`

### Fase 4 — Project Detail

- `src/lbs/projects/ProjectShowPage.tsx` (~200 LOC shell)
- Lazy tabs bajo `src/lbs/projects/tabs/`
- DealShow.tsx → router: LBS ? ProjectShowPage : ContractorDealShow

### Fase 5 — Assets

- Extend `deal_resources.visibility`
- Private bucket + signed URLs
- RLS `can_view_deal(deal_id)`

### Fase 6 — Content

- `deals.website_content jsonb` — pages array con SEO fields
- Tab Content UI

### Fase 7 — Approvals

- `website_brief._approvals` + `website_content.pages[].approval`
- O tabla `project_approvals` si crece

### Fase 8 — Automations

- Extend `dealStageTaskTemplates.ts`
- Hook on stage change in ProjectShowPage
- SMS templates on client_review

### Fase 9 — Limpieza

- Move contractor tabs
- CRM.tsx resource split
- Remove people refs from LBS forms

---

## D. Archivos exactos (todas las fases)

### Crear (nuevos)

```
src/lbs/projects/ProjectShowPage.tsx
src/lbs/projects/ProjectCreateFlow.tsx (evolve from ProjectCreateFlow)
src/lbs/projects/tabs/*.tsx (11 tabs)
src/lbs/deals/lbsAgencyProjectModel.ts ✅ Fase 2
src/contractor/deals/ContractorDealShow.tsx (extract from DealShow)
supabase/migrations/20260630260800_lbs_agency_project_lifecycle.sql ✅ Fase 2
```

### Modificar

```
src/components/atomic-crm/deals/DealShow.tsx → thin router
src/lbs/deals/lbsProjectConstants.ts ✅ Fase 2
src/components/atomic-crm/types.ts ✅ Fase 2
src/lbs/types.ts ✅ Fase 2
src/components/atomic-crm/deals/projectForm.ts ✅ Fase 2
supabase/functions/accept_proposal/index.ts ✅ Fase 2
src/components/atomic-crm/root/CRM.tsx (Fase 9)
src/lbs/deals/LbsDealInputs.tsx (Fase 3)
```

### Ocultar LBS / eliminar bundle (Fase 9)

```
DealShow contractor tabs (move, not delete)
deal_subcontractor_entries resource from LBS
```

---

## E. Migraciones

| Migración | Fase | Contenido |
|-----------|------|-----------|
| `20260630260800_lbs_agency_project_lifecycle.sql` | 2 | lifecycle_phase, delivery_status, accepted_proposal_id, priority |
| `20260630260900_deal_resources_visibility.sql` | 5 | visibility, mime_kind |
| `20260630261000_deals_website_content.sql` | 6 | website_content jsonb |
| `20260630261100_project_approvals.sql` | 7 | optional table |

---

## F. Componentes nuevos (lista)

- `ProjectShowPage`, `ProjectOverviewTab`, `ProjectScopeTab`, `ProjectContentTab`, `ProjectAssetsTab`, `ProjectScheduleTab`, `ProjectPaymentsTab`, `ProjectActivityTab`, `ProjectSettingsTab`
- `AgencyProjectCreateForm`
- `LaunchChecklist`, `MissingAssetsPanel`, `ProjectHealthCards`
- `ContractorDealShow` (extract)

---

## G. Componentes a ocultar/eliminar del bundle LBS

- DealHoursTab, DealSubcontractorsTab, DealExpensesTab, DealChangeOrdersTab, DealCommissionsTab (move to contractor)
- Contractor summary metrics in DealShow
- `people` reference in LbsDealInputs
- Material/expense labels

---

## H. Diseño Create Form (Fase 3)

**Step 1 — Client & basics:** name, company, contact, project_type, proposal (optional)  
**Step 2 — Timeline:** start_date, expected_end_date, priority, team (org members)  
**Step 3 — Type-specific:** dynamic fields → `website_brief` + `intake_answers` jsonb  
**Step 4 — Review & create:** summary + checklist preview

---

## I. Diseño Project Detail (Fase 4)

Ver PROJECTS_AUDIT.md sección I + 11 tabs arriba. Context panel sticky derecha.

---

## J. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Romper contractor DealShow | Extract, no delete; test contractor build |
| Datos legacy stages | LEGACY_LBS_STAGE_MAP + backfill migration |
| people vs org_members team | Fase 3 migration path for salesperson_ids |
| Public attachments | Fase 5 before more client uploads |
| Prod migration | Additive columns only; no DROP |

---

## K. Orden de implementación

1. ✅ **Fase 1** — Auditoría (este documento)
2. ✅ **Fase 2** — Modelo BD + constants + accept_proposal
3. ✅ **Fase 9 parcial** — Split DealShow → `ProjectShowPage` + `ContractorDealShow`
4. ✅ **Fase 5** — Assets: visibility, bucket `project-files`, signed URLs, RLS
5. ✅ **Fase 3** — `AgencyProjectCreateForm` multi-step (4 pasos)
6. ✅ **Fase 4** — Project detail tabs lazy + context panel
7. ✅ **Fase 6** — `website_content` JSONB + Content tab
8. ✅ **Fase 7** — Approvals JSONB en brief (`_approvals`) + content pages
9. ✅ **Fase 8** — Stage automations + task templates on create/stage change
10. ✅ **Fase 9 completa** — CRM resource split (contractor resources fuera de LBS)
11. ✅ **Fase 10** — `make typecheck` + lint OK

---

## L. Estado actual (2026-05-22)

| Entregable | Estado |
|------------|--------|
| Migraciones `60800`–`61000` | En repo — aplicar con `npx supabase migration up` |
| `DealShow.tsx` router | ✅ |
| `ContractorDealShow.tsx` | ✅ lazy contractor-only |
| `ProjectShowPage` + 11 tabs | ✅ |
| `AgencyProjectCreateForm` | ✅ 4-step wizard |
| Assets privados + signed URLs | ✅ frontend + `submit_project_resources` |
| Team assign `organization_members` | ✅ (array `salesperson_ids`, sin junction LBS) |
| Brief/content approvals | ✅ schema + UI badges (acciones en Content tab) |
| Contractor resources en LBS CRM | ✅ ocultos |

**Pendiente manual:** deploy migraciones + edge functions en prod; QA funcional en staging.

---

*Checkpoint: `npm run typecheck` y `npm run lint` pasan. Rollback Fase 2: revert migration + constants.*
