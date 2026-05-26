# Deployment — Fase 1: Activación de Deals + Sync con Anti-Olvido

Versión: 1.0
Fecha: 2026-05-25 / 2026-05-26 (Día 1 + Día 2 + Día 3)
Autor: Cristian + agente
Estado BD prod (al cierre de Día 3): Migración aplicada y verificada. Anti-Olvido intacto.

---

## 1. Resumen ejecutivo

Fase 1 activa el módulo Deals para que cada conversión de lead a cliente genere
opcionalmente un deal con `stage='closed_won'` + `lifecycle_phase='closed'` y
sincroniza el ciclo de vida del deal con el sistema Anti-Olvido (`contacts.lead_stage`
+ `contacts.snooze_until`) vía trigger Postgres.

Cambios aditivos (sin DROP/RENAME):

- 1 migración SQL:
  - `deals.converted_from_contact_id` (BIGINT, FK → `contacts.id`, ON DELETE SET NULL)
  - Función `public.sync_deal_stage_to_contact_lead_stage()` (security definer)
  - Trigger `trg_sync_deal_to_lead_stage` (AFTER INSERT OR UPDATE en `deals`)
- 8 archivos de frontend modificados (dataProvider + UI: tabs, CTAs, navegación)
- 0 archivos eliminados / renombrados (excepto el item "New project" del dropdown del header de cliente y la entrada "Deals" del sidebar, ambos reemplazados por equivalentes mejor situados)

---

## 2. Lista de cambios aplicados

### 2.1 Base de datos (ya en producción)

Archivo: `supabase/migrations/20260711120000_fase1_deals_activation.sql`

| Objeto | Tipo | Estado |
|---|---|---|
| `deals.converted_from_contact_id` | column BIGINT + index | Aplicada |
| `public.sync_deal_stage_to_contact_lead_stage()` | function security definer | Aplicada |
| `trg_sync_deal_to_lead_stage` | trigger AFTER INSERT OR UPDATE en `deals` | Aplicada (enabled) |

**Mapping `deals.stage` → `contacts.lead_stage`** (implementado dentro de la función):
- `won` | `closed_won` → `lead_stage='won'` + `snooze_until='2099-12-31'`
- `closed_lost` → `lead_stage='lost'` + `snooze_until='2099-12-31'`
- `proposal_sent` → `lead_stage='quoted'`
- `discovery` → `lead_stage='talking'`
- otros → sin cambio

Guard de no-op: `where ... is distinct from ...` previene UPDATEs innecesarios y
loops con triggers existentes.

### 2.2 Frontend (en branch, sin desplegar todavía)

| Archivo | Cambio |
|---|---|
| `src/components/atomic-crm/providers/supabase/dataProvider.ts` | `convertLeadToClient` ahora acepta `createDeal: boolean` (default `true`) y `dealOptions: { projectType, amount, name }`. Lee `interested_service` + `lead_value_estimate` del lead. Crea deal con `stage='closed_won'` + `lifecycle_phase='closed'`. Si `createDeal=false` o no hay info útil, hace el UPDATE `lead_stage='won' + snooze_until='2099-12-31'` directo. |
| `src/lbs/leads/ConvertLeadButton.tsx` | Reescrito: dialog ampliado con checkbox "Create initial deal" (default on), dropdown de service type (de `lbsProjectTypeChoices`), input de amount. Conserva los dos modos (lead con/sin company existente). |
| `src/lbs/clients/ClientProfileHeader.tsx` | Nuevo botón primario "+ New deal" antes del `ClientNewMenu`. Usa `getClientDealCreatePath(record.id, record.primary_contact_id)`. |
| `src/lbs/clients/ClientNewMenu.tsx` | Removido el item "New project" del dropdown. Quedan: Add contact, Text client, New proposal, New ticket. |
| `src/components/atomic-crm/deals/DealList.tsx` | Tabs nuevos arriba (`Sales Pipeline`, `Active Projects`, `Closed`, `Archived`) controlados por `?view=<sales|projects|closed|archived>`. El `filter` del `<List>` se calcula desde el view. Side-effect: cuando el URL no tiene `?view=`, se redirige a `?view=sales` con `replace`. |
| `src/lbs/navigation.ts` | Item "Deals" (umbrella) eliminado. Se reemplaza por dos entradas: **Sales Pipeline** (`/deals?view=sales`, icono `TrendingUp`) y **Active Projects** (`/deals?view=projects`, icono `FolderKanban`). Ambas con `matchSearch` para resaltar de forma exclusiva. |
| `src/components/atomic-crm/layout/SidebarLayout.tsx` | `isActive` ahora acepta `matchSearch?: Record<string,string>` y verifica query params para que las dos entradas de Deals no se resalten al mismo tiempo. |
| `src/components/atomic-crm/layout/Header.tsx` | Mismo cambio para top-nav (tablet/desktop). |

---

## 3. Verificación post-deploy ya ejecutada (BD producción)

| Test | Resultado |
|---|---|
| Tabla `deals` tiene columna `converted_from_contact_id` con FK + index | ✅ |
| Función `sync_deal_stage_to_contact_lead_stage` existe con `security definer` | ✅ |
| Trigger `trg_sync_deal_to_lead_stage` está enabled en `deals` (after insert/update) | ✅ |
| Test 3 trigger end-to-end (7 sub-casos, dummy data) | ✅ — limpiado |
| Anti-Olvido baseline (leads=339, clients=211, paused=309, frozen=0) | ✅ — sin cambios respecto al Día 0 |
| `make typecheck` | ✅ |
| `npx prettier --check` en archivos tocados | ✅ |
| `npx eslint` en archivos tocados | ✅ (0 errores; 10 warnings preexistentes en `dataProvider.ts` no relacionados) |

---

## 4. Pasos para desplegar el frontend

1. Push a la branch que use Vercel.
2. Verificar que la build pasa.
3. Cuando el deploy esté live, hacer **Test 1, Test 2, Test 4, Test 6, Test 7** manuales en la app.
4. Si todo OK, merge a `main`.

Las migraciones SQL ya están aplicadas en producción, así que **el deploy frontend
es seguro de hacer en cualquier momento** (no requiere coordinación con DB).

> ⚠️ Si por algún motivo se necesita rollback antes de los tests UI:
> el frontend nuevo tolera la BD nueva. La BD nueva tolera el frontend antiguo
> (la columna nueva queda NULL, el trigger nunca dispara si nadie crea deals
> con `contact_id` no nulo). Es decir, son compatibles en cualquier orden.

---

## 5. Tests manuales pendientes (ejecutar después del deploy frontend)

Tomados de `PLAN_FASE_1.md` § 6. Aquí en forma compacta para checklist post-deploy.

### Test 1 — Convert lead con `createDeal=true`
1. Crear un lead nuevo en `/leads` con: `first_name`, `last_name`, `email`, `interested_service='website'`, `lead_value_estimate=2500`.
2. Abrir la ficha del lead, click **Convert to client**.
3. En el dialog:
   - Si no tiene company: escribir nombre de la empresa.
   - Checkbox "Create initial deal" → ON (default).
   - Service type ya viene preseleccionado en `website`.
   - Amount preseleccionado en `2500`.
   - Click **Convert**.
4. Esperado:
   - Redirige a `/clients/:id/show`.
   - En BD: `contacts.status='client'`, `contacts.lead_stage='won'`, `contacts.snooze_until='2099-12-31 00:00:00+00'`.
   - En BD: `deals` nuevo con `stage='closed_won'`, `lifecycle_phase='closed'`, `amount=2500`, `project_type='website'`, `converted_from_contact_id=<lead id>`.
   - En `/deals?view=closed` aparece el deal.

### Test 2 — Convert lead con `createDeal=false`
1. Crear otro lead, abrir, **Convert to client**.
2. Dejar el checkbox **OFF** ("Create initial deal").
3. Click Convert.
4. Esperado:
   - Redirige al cliente nuevo.
   - `contacts.status='client'`, `lead_stage='won'`, `snooze_until='2099-12-31'`.
   - **NO** se creó deal nuevo (`select * from deals where contact_id=<id>` → 0 filas).
   - El lead sale del Anti-Olvido (no aparece en `/leads/attention`).

### Test 4 — CTA "+ New deal" en cliente
1. Abrir cualquier cliente en `/clients/:id/show`.
2. Click el botón **+ New deal** (primary, antes del dropdown "New").
3. Esperado: navega a la pantalla de creación de deal con `company_id` y `contact_id` precargados.
4. El item "New project" YA NO está en el dropdown junto a Edit (ahora lo reemplaza el CTA primario).

### Test 5 — Anti-Olvido intacto
1. Abrir `/leads/attention` antes y después del deploy.
2. Conteo de leads "owed" no cambia (mismos leads, mismo cron output).
3. (Opcional) Revisar logs del edge function `enforce_lead_attention`: corre sin error.

### Test 6 — Tabs en /deals
1. Default `/deals` → redirige a `/deals?view=sales`, tab "Sales Pipeline" activo.
2. Click **Active Projects** → `/deals?view=projects` → board muestra deals con `lifecycle_phase='delivery'`.
3. Click **Closed** → `/deals?view=closed` → muestra los deals creados por conversiones.
4. Click **Archived** → `/deals?view=archived` → muestra deals con `archived_at` no nulo.
5. Search box y filtros siguen funcionando en cada tab.

### Test 7 — Sidebar nuevas entradas
1. Click **Sales Pipeline** en el sidebar → va a `/deals?view=sales`. Resalta solo "Sales Pipeline".
2. Click **Active Projects** → va a `/deals?view=projects`. Resalta solo "Active Projects".
3. Ya no hay entrada "Deals" en el sidebar.

---

## 6. Rollback (en caso de necesidad)

### 6.1 Rollback BD (revertir migración)
```sql
DROP TRIGGER IF EXISTS trg_sync_deal_to_lead_stage ON public.deals;
DROP FUNCTION IF EXISTS public.sync_deal_stage_to_contact_lead_stage();
ALTER TABLE public.deals DROP COLUMN IF EXISTS converted_from_contact_id;
```
Costo: ~5 segundos. No destructivo si nadie llenó la columna (al cierre de Día 3,
hay 0 filas con `converted_from_contact_id IS NOT NULL`).

### 6.2 Rollback frontend
Revertir el commit del PR de Fase 1. Las apis del dataProvider mantienen
retrocompatibilidad: `convertLeadToClient` con la firma antigua sigue funcionando
(los nuevos parámetros son opcionales con defaults sensatos).

### 6.3 Estado mixto (BD nueva + frontend viejo)
Compatible. El trigger no dispara hasta que alguien cree un deal con `contact_id`
y `stage` mapeable. Frontend viejo nunca crea esos deals.

---

## 7. Métricas a monitorear post-deploy (primera semana)

| Métrica | Query / Lugar | Esperado |
|---|---|---|
| Conversiones que crean deal | `select count(*) from deals where converted_from_contact_id is not null` | Crece con cada conversión real |
| Conversiones SIN deal | `select count(*) from contacts where status='client' and lead_stage='won' and id not in (select converted_from_contact_id from deals where converted_from_contact_id is not null)` | Cualquier conversión con createDeal=false |
| Anti-Olvido funcional | `/leads/attention` (UI) | Mismo número de leads "owed" día a día (ajustado por nuevas conversiones que sacan al lead del radar) |
| Trigger sin errores | Supabase Logs → `Database` | 0 errores en `pg_logs` con texto `sync_deal_stage_to_contact_lead_stage` |
| Edge function enforce_lead_attention | Supabase Logs → `Edge Functions` | Cron corre cada hora sin error |

---

## 8. Lo que NO está en Fase 1 (ver `DEFERRED_NOTES.md`)

- Backfill del CSV histórico de Zoho a `deals`.
- Métricas / dashboards de pipeline (conversion rates, deal velocity).
- Notificaciones automáticas cuando un deal cambia de stage.
- Permisos finos en `deals` (delegation a contractors, share links).
- UI de "marcar como ganado/perdido" inline en el board del deal (ya existe vía edit).
