# PLAN_FASE_1 — Activación de Deals + Sync con Anti-Olvido

> Fecha: 2026-05-25
> Estado: **PLAN PARA APROBACIÓN. NO IMPLEMENTAR HASTA RECIBIR "APROBADO".**
> Reglas: solo lectura ejecutada. Cero código modificado. Cero BD modificada.

---

## 0. Hallazgos críticos del paso de inspección (esto cambia algunos detalles del prompt)

Investigué BD + código y descubrí varias cosas que afectan el plan original. Las pongo arriba para que las apruebes o me corrijas antes de codear.

### H1 — Sintaxis SQL del trigger del prompt es inválida en Postgres
Tu prompt propuso `CREATE TRIGGER ... AFTER INSERT OR UPDATE OF stage ON deals`. Postgres **no permite** `OF column` cuando el evento combina INSERT con UPDATE; `OF column` solo es válido para UPDATE puro. Solución: usar `AFTER INSERT OR UPDATE` (sin `OF stage`) y mover el check al cuerpo (`IF TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage THEN`). Esto preserva el comportamiento. Ver migración debajo.

### H2 — Triggers existentes en deals/contacts que coexisten con el nuevo
Inspección via `pg_trigger`:

**`contacts`:**
- `contact_saved` BEFORE INSERT OR UPDATE → `handle_contact_saved()`. Solo modifica `new.avatar` desde `new.email_jsonb`. **No toca lead_stage ni snooze_until. No hay loop.**
- `set_contact_organization_member_id_trigger` BEFORE INSERT only.
- `trg_contacts_assign_org` BEFORE INSERT only.

**`deals`:**
- `trg_deals_system_stage_change_log` AFTER UPDATE OF stage → llama a `post_project_system_message()` (postea mensaje al chat del deal). **No toca contacts.**
- `trg_deals_system_delivery_status_log` AFTER UPDATE OF delivery_status.
- `trg_deals_system_create_log` AFTER INSERT.
- `trg_deals_system_team_log` AFTER UPDATE OF salesperson_ids.
- `trg_recompute_deal_current_project_value_on_deals` AFTER INSERT OR UPDATE OF (amount, estimated_value, original_project_value).
- `trg_deals_assign_org` BEFORE INSERT.
- `set_deal_organization_member_id_trigger` BEFORE INSERT.

**Conclusión:** mi trigger `trg_sync_deal_to_lead_stage` AFTER INSERT OR UPDATE en deals → UPDATE en contacts. Postgres ejecuta los triggers AFTER UPDATE en orden alfabético (`trg_recompute...` < `trg_sync_deal...`). El mensaje del system_message_log se postea igual, sin interferencia. **No hay loop ni conflicto.**

### H3 — Constraints reales en deals
- `deals.stage`: **NO tiene CHECK constraint** (es text libre). Valores canónicos vienen de `organization_pipeline_stages.key`. Mi trigger CASE puede mapear cualquier string; valores no esperados caen a `ELSE lead_stage` (preserva el actual).
- `deals.lifecycle_phase` CHECK: solo `opportunity | delivery | closed`. Para `createDeal=true` desde `convertLeadToClient` usaremos `'opportunity'` (sale recién cerrada, no en ejecución).
- `deals.delivery_status` CHECK no aplica para deals creados desde convert (lo dejamos NULL).
- `deals.contact_id` ON DELETE SET NULL — perfecto para `converted_from_contact_id` (mismo patrón).

### H4 — Tipos de columnas en contacts
- `lead_stage` → `text` nullable, **sin CHECK constraint**. Cualquier valor pasa.
- `snooze_until` → `timestamptz` nullable. El prompt usa `'2099-12-31'::timestamp`. Cast más seguro: `'2099-12-31 00:00:00+00'::timestamptz` para evitar warnings de TZ.
- `lead_value_estimate` → `numeric(12,2)` nullable.
- `interested_service` → `text` nullable.

### H5 — `convertLeadToClient` actual NO trae `interested_service` ni `lead_value_estimate`
`dataProvider.ts:781-783` solo hace SELECT de `id, first_name, last_name, organization_member_id, company_id, org_id`. **Hay que extender el SELECT** para incluir los campos que el deal nuevo necesita (`interested_service`, `lead_value_estimate`).

### H6 — `ConvertLeadButton` tiene dos modos hoy (con/sin company existente)
Lead sin `company_id` → input "Client company name". Lead con `company_id` → confirma con el nombre ya existente. **El nuevo dialog debe preservar esos dos modos** y SUMAR la sección "Create deal".

### H7 — `ClientNewMenu.tsx:92-95` es el dropdown enterrado con "New project"
Vive dentro de `ClientProfileHeader.tsx:228` (componente "icon" en la barra de acciones del header). El CTA prominente debe sumarse al header sin romper el dropdown (mantenemos el dropdown para "New proposal", "New ticket", "Add contact" — solo promovemos el botón de deal afuera).

### H8 — `/deals` ya tiene una UI rica con board/list view y pipeline selector
`DealList.tsx` ya implementa Board vs List, search, pipeline selector (oculto en LBS mode), "Only mine" switch, archived list. **La nueva navegación con tabs (Sales/Active Projects/Closed/Archived) se debe sumar sin destruir esto.** Propongo agregar un `Tabs` arriba de la barra existente que cambia el filtro server-side. URLs siguen siendo `/deals` con query param `?view=sales|projects|closed|archived`. La sidebar nueva apunta a esas URLs con query.

### H9 — `lbsProjectTypeChoices` (constante existente) es la fuente canónica de service types
`src/lbs/deals/lbsProjectConstants.ts:1-16`. Valores: `website`, `seo`, `google-ads`, `social-media`, `branding`, `automation`, `crm-setup`, `maintenance`. **El dropdown del dialog de conversión debe usar esta lista**, no inventar valores nuevos.

### H10 — Sistema de comisiones automáticas ya wireado
`dealCommissionAutomation.ts` ejecuta `ensureCommissionsForWonDeal` cuando un deal pasa a stage `won|delivered|closed_won|completed`. Como **mi convertLeadToClient va a crear el deal directamente con `stage='won'`**, el sistema de comisiones se va a disparar. ✅ Comportamiento correcto si hay `salesperson_ids` poblado. ⚠️ Para LBS hoy los deals no tienen `salesperson_ids` poblado (Fase 4). Resultado: comisión NO se creará (es lo que esperamos). No es bug.

### H11 — No tengo separación dev/prod en este repo
El MCP de Supabase apunta a producción (`org_id=3` es LBS real). No existe un proyecto dev separado obvio. **Para "aplicar en dev primero" necesito que me confirmes el flujo:**
- Opción A: Aplicar local con `npx supabase db reset` + `migration up` en una copia local.
- Opción B: Crear un branch de Supabase (preview) si está disponible.
- Opción C: Aplicar directo en prod con backup snapshot antes (riesgo bajo porque cambios son aditivos).

Esto va a la sección de Deployment al final del plan.

### H12 — Fechas de migraciones
La última migración existente es `20260710180000_contacts_status_normalization.sql` (10 julio 2026), pero estamos a 25 mayo 2026. Convención en este repo es usar el datetime al que se aplicará, no la fecha de hoy. Para asegurar orden, usaré **`20260711120000`** como timestamp del archivo (el siguiente después de la última migración aplicada).

---

## 1. Resumen ejecutivo del plan

Fase 1 consiste en:
1. **1 migración SQL aditiva** (1 columna nueva en `deals`, 1 función nueva, 1 trigger nuevo). Sin DROP, sin renombres, sin cambios destructivos.
2. **1 modificación al método `convertLeadToClient`** del dataProvider (~30 líneas añadidas).
3. **1 dialog nuevo** en `ConvertLeadButton.tsx` con checkbox + service type + amount (extiende el dialog existente, no reemplaza).
4. **1 CTA primario "+ New deal"** en `ClientProfileHeader.tsx`, alineado con el dropdown existente.
5. **1 cambio en `ClientNewMenu.tsx`**: quitar "New project" del dropdown (queda en CTA prominente). Conservar "New proposal", "New ticket", "Add contact", "Text client".
6. **1 cambio en `DealList.tsx`**: agregar Tabs (Sales | Active Projects | Closed | Archived) que cambian filtro server-side según `?view=` query param.
7. **2 entradas nuevas en sidebar** (`navigation.ts`): "Sales Pipeline" y "Active Projects". Mantenemos "Deals" como entrada general (umbrella).

**Total: 1 migración + 6 archivos modificados + 0 archivos nuevos de código de producción.** Sin dependencias nuevas, sin secrets nuevos, sin tablas nuevas.

---

## 2. Archivos exactos a tocar

### 2.1 Crear (nuevos)
| Path | Propósito |
|---|---|
| `supabase/migrations/20260711120000_fase1_deals_activation.sql` | Migración con columna + función + trigger |
| `PLAN_FASE_1.md` | Este documento (ya existe al leer este texto) |
| `DEFERRED_NOTES.md` | Notas de cosas que detecté y NO implemento (creado al final si surge algo) |
| `DEPLOYMENT_FASE_1.md` | Plan de deployment + rollback (creado al final del dev) |

### 2.2 Modificar (existentes)
| Path | Líneas aprox. | Cambio |
|---|---|---|
| `src/components/atomic-crm/providers/supabase/dataProvider.ts` | ~767-866 | Extender SELECT + nuevos parámetros `createDeal`, `dealOptions` + INSERT a deals + UPDATE de `lead_stage`/`snooze_until` |
| `src/lbs/leads/ConvertLeadButton.tsx` | toda | Dialog ampliado: checkbox "Create deal" + service dropdown + amount input. Tipo del retorno extendido. |
| `src/lbs/clients/ClientProfileHeader.tsx` | ~228 | Sumar `<Button>` primario "+ New deal" antes de `<ClientNewMenu>` |
| `src/lbs/clients/ClientNewMenu.tsx` | ~91-96 | Eliminar item "New project" del dropdown |
| `src/components/atomic-crm/deals/DealList.tsx` | ~52-90 + nuevo componente Tabs | Agregar tabs view-switcher al inicio + ajustar `filter={}` según `?view=` query param |
| `src/lbs/navigation.ts` | ~28-128 | Agregar 2 entries: "Sales Pipeline" y "Active Projects" |

### 2.3 NO tocar (verificado y descartado)
- `src/components/atomic-crm/deals/DealsExplorerPanel.tsx` — solo es panel info, no necesita cambios.
- `src/lbs/deals/ProjectCreateFlow.tsx` — ya acepta `company_id` + `contact_id` de query string; no necesita cambios.
- `src/lbs/deals/lbsProjectConstants.ts` — la constante `lbsProjectTypeChoices` se reusa tal cual.
- `src/lbs/deals/dealCommissionAutomation.ts` — sigue funcionando igual; el deal nuevo con `stage='won'` lo disparará automáticamente cuando haya salesperson_ids (Fase 4).
- Supabase functions: ninguna nueva ni modificada en Fase 1.

---

## 3. Migración SQL completa (texto exacto del archivo)

**Path:** `supabase/migrations/20260711120000_fase1_deals_activation.sql`

```sql
-- =====================================================================
-- Fase 1 — Activación de Deals + Sync con Anti-Olvido
-- =====================================================================
-- Objetivo: cerrar el loop Lead -> Cliente -> Deal sin romper el sistema
-- Anti-Olvido (lead_attention) recién instalado.
--
-- Cambios:
--   1. deals.converted_from_contact_id (audit trail del lead origen)
--   2. function sync_deal_stage_to_contact_lead_stage()
--      mapea deal.stage -> contacts.lead_stage y maneja snooze_until
--   3. trigger trg_sync_deal_to_lead_stage en deals (AFTER INSERT OR UPDATE)
--
-- Política de mapping (deal.stage -> contact.lead_stage):
--   won, closed_won   -> 'won'    + snooze_until = '2099-12-31'
--   closed_lost       -> 'lost'   + snooze_until = '2099-12-31'
--   proposal_sent     -> 'quoted' (sin tocar snooze_until)
--   discovery         -> 'talking'(sin tocar snooze_until)
--   otros             -> sin cambios (preserva lead_stage actual)
--
-- Notas de seguridad:
--   - El trigger es AFTER (no BEFORE), no afecta la fila del deal.
--   - Si deal.contact_id es NULL, el trigger es no-op (return new).
--   - WHERE clause evita UPDATEs redundantes (no loop).
--   - No reemplaza otros triggers existentes en deals o contacts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit column: deals.converted_from_contact_id
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists converted_from_contact_id bigint
    references public.contacts(id) on delete set null;

create index if not exists idx_deals_converted_from_contact_id
  on public.deals (converted_from_contact_id)
  where converted_from_contact_id is not null;

comment on column public.deals.converted_from_contact_id is
  'Audit trail: contacts.id del lead que generó este deal al ser convertido a cliente. NULL para deals creados por otras vías (form, manual desde admin, accept_proposal).';

-- ---------------------------------------------------------------------
-- 2. Función de sincronización deal.stage -> contact.lead_stage
-- ---------------------------------------------------------------------
create or replace function public.sync_deal_stage_to_contact_lead_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_lead_stage text;
  v_should_freeze     boolean;
begin
  -- Skip si el deal no está atado a un contact concreto.
  if new.contact_id is null then
    return new;
  end if;

  -- Solo procesar si stage realmente cambió (o es INSERT, donde OLD es NULL).
  if TG_OP = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  -- Calcular target lead_stage según el deal.stage actual.
  v_target_lead_stage := case new.stage
    when 'won'           then 'won'
    when 'closed_won'    then 'won'
    when 'closed_lost'   then 'lost'
    when 'proposal_sent' then 'quoted'
    when 'discovery'     then 'talking'
    else null  -- valor null -> no cambia lead_stage en el UPDATE
  end;

  v_should_freeze := new.stage in ('won', 'closed_won', 'closed_lost');

  -- UPDATE solo si hay algo nuevo que aplicar.
  -- v_target_lead_stage IS NULL significa "no remapear" (stage no monitoreado).
  update public.contacts c
  set
    lead_stage = coalesce(v_target_lead_stage, c.lead_stage),
    snooze_until = case
      when v_should_freeze then '2099-12-31 00:00:00+00'::timestamptz
      else c.snooze_until
    end
  where c.id = new.contact_id
    and (
      -- Cambio en lead_stage:
      (v_target_lead_stage is not null
       and c.lead_stage is distinct from v_target_lead_stage)
      -- O cambio en snooze_until (deal cerrado):
      or (v_should_freeze
          and c.snooze_until is distinct from '2099-12-31 00:00:00+00'::timestamptz)
    );

  return new;
end;
$$;

comment on function public.sync_deal_stage_to_contact_lead_stage() is
  'Mantiene contacts.lead_stage y contacts.snooze_until coherentes con el deal.stage. Llamado por trg_sync_deal_to_lead_stage. Idempotente y libre de loops (WHERE clause evita UPDATEs no-op).';

-- ---------------------------------------------------------------------
-- 3. Trigger en deals
-- ---------------------------------------------------------------------
drop trigger if exists trg_sync_deal_to_lead_stage on public.deals;

create trigger trg_sync_deal_to_lead_stage
  after insert or update on public.deals
  for each row
  execute function public.sync_deal_stage_to_contact_lead_stage();

-- =====================================================================
-- FIN Fase 1 migration
-- =====================================================================
```

### 3.1 Verificación previa a aplicar (lo correré primero como SELECTs)

Antes de aplicar la migración correré estas verificaciones (no modifican nada):

```sql
-- ✅ No existe ya la columna
select column_name from information_schema.columns
where table_schema='public' and table_name='deals' and column_name='converted_from_contact_id';
-- esperado: 0 filas

-- ✅ No existe ya la función
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='sync_deal_stage_to_contact_lead_stage';
-- esperado: 0 filas

-- ✅ No existe ya el trigger
select tgname from pg_trigger where tgname='trg_sync_deal_to_lead_stage';
-- esperado: 0 filas

-- ✅ Confirmar tipos asumidos
select column_name, udt_name from information_schema.columns
where table_schema='public' and table_name='contacts'
  and column_name in ('lead_stage','snooze_until');
-- esperado: lead_stage=text, snooze_until=timestamptz
```

### 3.2 Smoke test post-migración (SELECTs, sin escritura)

```sql
-- Confirmar que el trigger está activo
select tgname, tgenabled from pg_trigger where tgname='trg_sync_deal_to_lead_stage';
-- esperado: tgenabled='O' (active)
```

Los tests escritos (INSERT/UPDATE deal y verificar contacts) están en la sección 6.

---

## 4. Cambio detallado por archivo de código

### 4.1 `src/components/atomic-crm/providers/supabase/dataProvider.ts`

**Función:** `convertLeadToClient` (líneas 767-866).

**Cambios:**

1. **Extender SELECT del contact** (línea 781-783) para incluir `interested_service`, `lead_value_estimate`, `lead_stage`, `snooze_until`. (Los últimos 2 los uso para no machacar valores si algo raro pasa).

2. **Cambiar signature**:
   ```ts
   convertLeadToClient({
     contactId,
     companyName,
     createDeal = true,
     dealOptions,
   }: {
     contactId: Identifier;
     companyName: string;
     createDeal?: boolean;
     dealOptions?: {
       projectType?: string | null;  // valores de lbsProjectTypeChoices
       amount?: number | null;
       name?: string | null;
     };
   })
   ```

3. **Lógica nueva al final** (después del UPDATE de contacts.status='client'):
   - Si `createDeal === true`:
     - Resolver `effectiveProjectType = dealOptions.projectType ?? contact.interested_service ?? null`.
     - Resolver `effectiveAmount = dealOptions.amount ?? contact.lead_value_estimate ?? 0`.
     - Resolver `dealName = dealOptions.name ?? `${labelOfProjectType(effectiveProjectType) ?? 'Initial service'} – ${trimmedName}` `.
     - **Solo si** (`effectiveProjectType != null` OR `effectiveAmount > 0` OR `dealOptions.name != null`) → INSERT a deals.
     - Sino → skip (evita crear deal vacío sin info útil).
   - `INSERT INTO deals (...)`:
     - `name`: dealName
     - `stage`: `'won'`
     - `lifecycle_phase`: `'opportunity'`
     - `amount`: effectiveAmount
     - `estimated_value`: effectiveAmount
     - `company_id`: companyId
     - `contact_id`: contactId
     - `contact_ids`: `[contactId]`
     - `project_type`: effectiveProjectType
     - `organization_member_id`: contact.organization_member_id (lo setea el trigger BEFORE INSERT si viene null)
     - `org_id`: contact.org_id (lo setea el trigger BEFORE INSERT si viene null)
     - `converted_from_contact_id`: contactId
   - Capturar `newDealId`.
4. **El trigger BD se encarga** de:
   - Setear `contacts.lead_stage = 'won'`.
   - Setear `contacts.snooze_until = '2099-12-31'`.
   - **Cliente NO necesita hacer esto manualmente.** Si por alguna razón el trigger no existe o falla, hago un UPDATE explícito de fallback como red de seguridad.
5. **Si `createDeal === false`:**
   - El usuario explícitamente NO quiere deal. Pero sigue siendo cliente cerrado en venta.
   - **No tenemos deal para disparar el trigger**, entonces necesito UPDATE explícito en `contacts`:
     - `lead_stage = 'won'`
     - `snooze_until = '2099-12-31'`
   - Esto cumple criterio del prompt: "Lead_stage también debe cambiar a 'won' y salir del Anti-Olvido".

6. **Retorno actualizado**: `{ company_id, contact_id, deal_id }` (donde `deal_id` puede ser `null` si no se creó deal).

7. **Helper local `labelOfProjectType`** importado desde `lbsProjectConstants.ts` o inline en el archivo:
   ```ts
   const labelOfProjectType = (id: string | null | undefined): string | null => {
     if (!id) return null;
     return lbsProjectTypeChoices.find(c => c.value === id)?.label ?? id;
   };
   ```

**Estimación:** ~40 líneas añadidas, 1 línea modificada (SELECT). Sin DELETE de código existente.

---

### 4.2 `src/lbs/leads/ConvertLeadButton.tsx`

**Cambios:**

1. **Nuevo estado local:**
   ```ts
   const [createDeal, setCreateDeal] = useState(true);
   const [serviceType, setServiceType] = useState<string>(
     record.interested_service ?? ""
   );
   const [amount, setAmount] = useState<string>(
     record.lead_value_estimate != null ? String(record.lead_value_estimate) : ""
   );
   ```

2. **Sync con record cuando cambie** (`useEffect` para repopular si el record se actualiza).

3. **mutationFn** ahora envía:
   ```ts
   convertLeadToClient({
     contactId: record.id,
     companyName: ...,
     createDeal,
     dealOptions: createDeal
       ? {
           projectType: serviceType || null,
           amount: amount ? Number(amount) : null,
         }
       : undefined,
   })
   ```

4. **Dialog ampliado** (wireframe en sección 5.A).

5. **Validación**: si `createDeal=true` y NO hay (`serviceType` || amount válido) → permitir igual (el dataProvider decide si crea o no).

6. **onSuccess** redirige a `/clients/:company_id/show` (igual que hoy). Si se creó deal, opcional toast extra "Deal created".

**Estimación:** ~40 líneas añadidas dentro del componente, sin tocar la estructura externa.

---

### 4.3 `src/lbs/clients/ClientProfileHeader.tsx`

**Cambios mínimos:**

1. **Importar** `getClientDealCreatePath` (ya importado en `ClientNewMenu` con la misma función).
2. **Agregar botón** "+ New deal" en el bloque de acciones (línea ~210), **antes** del `<SendFormButton>` o **entre** `<Edit>` y `<ClientNewMenu>`:
   ```tsx
   <Button asChild variant="default" size="sm">
     <Link to={getClientDealCreatePath(record.id, record.primary_contact_id)}>
       <Plus className="size-4" />
       New deal
     </Link>
   </Button>
   ```
3. **Sin remover nada**. El dropdown "New" sigue ahí; solo perdió la opción "New project" (sección 4.4).

**Wireframe:** sección 5.B.

**Estimación:** +5 líneas, 1 import.

---

### 4.4 `src/lbs/clients/ClientNewMenu.tsx`

**Cambios:**

1. **Eliminar** el `<DropdownMenuItem>` "New project" (líneas 91-96).
2. **Eliminar** el import de `getClientDealCreatePath` (si no se usa en otro lado del archivo) o dejarlo si lo usa el helper interno.
3. **Conservar** "Add contact", "Text client", "New proposal", "New ticket".

**Razón:** El CTA de deal ahora es prominente afuera del dropdown.

**Estimación:** -6 líneas, 0 nuevas.

---

### 4.5 `src/components/atomic-crm/deals/DealList.tsx`

**Cambios más extensos pero acotados:**

1. **Importar `Tabs`** de `@/components/ui/tabs`.

2. **Leer `view` de `useSearchParams`** dentro de `DealList`:
   ```ts
   const [searchParams, setSearchParams] = useSearchParams();
   const view = (searchParams.get("view") ?? "sales") as DealsView;
   ```

3. **Map view → filter dinámico**:
   ```ts
   const filterByView = (v: DealsView) => {
     switch (v) {
       case "sales":
         return {
           "archived_at@is": null,
           "lifecycle_phase@eq": "opportunity",
           "stage@not.in": "(closed_won,closed_lost)",
         };
       case "projects":
         return {
           "archived_at@is": null,
           "lifecycle_phase@eq": "delivery",
         };
       case "closed":
         return {
           "archived_at@is": null,
           "stage@in": "(closed_won,closed_lost)",
         };
       case "archived":
         return {
           "archived_at@not.is": null,
         };
     }
   };
   ```

4. **Tabs UI** justo antes de `<List>` o como child decoration:
   ```tsx
   <Tabs value={view} onValueChange={(v) => {
     const next = new URLSearchParams(searchParams);
     next.set("view", v);
     setSearchParams(next, { replace: true });
   }}>
     <TabsList>
       <TabsTrigger value="sales">Sales Pipeline</TabsTrigger>
       <TabsTrigger value="projects">Active Projects</TabsTrigger>
       <TabsTrigger value="closed">Closed</TabsTrigger>
       <TabsTrigger value="archived">Archived</TabsTrigger>
     </TabsList>
   </Tabs>
   ```

5. **Reemplazar** `filter={{ "archived_at@is": null }}` por `filter={filterByView(view)}`.

6. **DealLayout / vistas internas**: sin cambios. El filtro server-side se aplica antes de que `DealListContent` / `LbsDealBoardContent` rendericen. **Funcionará igual el board, igual el list view, igual el search, igual el "Only mine" switch.**

7. **Edge case**: si `view='archived'`, queremos forzar la vista de lista (no board), porque el board con archivados es raro. Decisión: respetar la preferencia del usuario; archived list ya existe (`DealArchivedList`) y se sigue mostrando como mini-sección. Vamos a dejar el comportamiento simple primero y ajustar si Cristian lo pide en el checkpoint.

**Wireframe:** sección 5.C.

**Estimación:** ~30 líneas añadidas. El componente queda más limpio.

---

### 4.6 `src/lbs/navigation.ts`

**Cambios:**

1. **Insertar 2 nuevos items** después del existente "Deals" (línea 56-64). Mantenemos "Deals" como entrada general/umbrella (lleva a `/deals` con `view=sales` default).

   ```ts
   {
     to: "/deals?view=sales",
     label: "Sales Pipeline",
     icon: TrendingUp, // de lucide-react
     activePattern: "/deals*", // se activa para cualquier /deals
     capability: "crm.pipeline.view",
     resource: "deals",
     action: "list",
   },
   {
     to: "/deals?view=projects",
     label: "Active Projects",
     icon: FolderKanban,
     activePattern: "/deals*",
     capability: "crm.pipeline.view",
     resource: "deals",
     action: "list",
   },
   ```

2. **Import** del icono `TrendingUp` de lucide-react.

3. **Mantener** la entrada "Deals" existente (label sin cambios). Es el umbrella.

**Riesgo de UX:** 3 entradas que apuntan a `/deals` puede confundir. Alternativa: **eliminar la entrada "Deals" umbrella** y dejar solo "Sales Pipeline" + "Active Projects". El usuario puede ver "Closed" / "Archived" desde las pestañas adentro. Te pregunto sobre esto en sección 13.

**Estimación:** +12 líneas + 1 import.

---

## 5. Wireframes textuales

### 5.A — Dialog ampliado de `ConvertLeadButton`

```
┌─ Dialog: Convert lead to client ─────────────────────────────┐
│                                                              │
│ Convert lead to client                                       │
│ A new client company will be created and linked to this      │
│ contact.                                                     │
│                                                              │
│ Client company name *                                        │
│ [Acme Corp_________________________________________]          │
│                                                              │
│ ─────────────────────────────────────────────────────────    │
│                                                              │
│ [✓] Create initial deal for this client                      │
│                                                              │
│     Service type                                             │
│     [▼ Website                                  ]            │
│     [   SEO / local SEO                          ]           │
│     [   Google Ads campaign                      ]           │
│     [   Social media management                  ]           │
│     [   Branding / identity                      ]           │
│     [   Automation                               ]           │
│     [   CRM Setup                                ]           │
│     [   Maintenance / Hosting                    ]           │
│                                                              │
│     Estimated amount ($)                                     │
│     [2500__________________________________________]          │
│                                                              │
│     Deal will be created in stage "Won" and linked to        │
│     this client.                                             │
│                                                              │
│ ─────────────────────────────────────────────────────────    │
│                              [ Cancel ]  [ Convert ]         │
└──────────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- Si lead ya tiene company existente: campo "Client company name" se reemplaza por mensaje "Already linked to **Acme Corp**" (igual que hoy).
- Si checkbox desmarcado: las secciones de service type y amount se ocultan.
- Si `interested_service` ya viene del lead: pre-selecciona en el dropdown.
- Si `lead_value_estimate` viene del lead: pre-llena el amount.

### 5.B — Header de `/clients/:id/show` con CTA primario

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back                                                             │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 🏢 Acme Corp | John Smith                            [client] │ │
│ │ ☎ (305) 555-1234 | ✉ john@acme.com                            │ │
│ │ 📍 Miami, FL                                                   │ │
│ │ 🌐 acme.com ↗                                                  │ │
│ │                                                                │ │
│ │   [📤 Send form] [💬 SMS] [Edit] [➕ New deal] [+ New ▼] [⋯] │ │
│ │                                              ▲                 │ │
│ │                                CTA primario (este es nuevo)    │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ [Overview] [Contacts] [Projects] [Financial] [Activity]            │
│ ...                                                                │
└────────────────────────────────────────────────────────────────────┘
```

**Decisión de UX:**
- "+ New deal" va con `variant="default"` (azul/primario fondo).
- "+ New ▼" sigue siendo `variant="outline"` (dropdown con Add contact, New proposal, New ticket, Text client).

### 5.C — `/deals` con Tabs

```
┌───────────────────────────────────────────────────────────────────────┐
│ [Sales Pipeline] [Active Projects] [Closed] [Archived]                │
│        ▲                                                              │
│   tabs nuevos                                                         │
│                                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐   │
│ │ 🔍 Search deals...                       [Board][List] [⚙][📤] │   │
│ │                                                       [+ New Deal]│  │
│ └─────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ Sales Pipeline view (active):                                         │
│   Filter applied: lifecycle_phase=opportunity AND stage∉(closed_*)    │
│                                                                       │
│ ┌──────┬───────────┬────────────┐                                     │
│ │ Lead │ Discovery │ Proposal   │  ← kanban (board view)              │
│ │      │           │ Sent       │                                     │
│ │ [×3] │ [×2]      │ [×1]       │                                     │
│ └──────┴───────────┴────────────┘                                     │
└───────────────────────────────────────────────────────────────────────┘
```

**Tab "Active Projects" view:**
```
   Filter: lifecycle_phase=delivery
   Stages mostrados: design, development, review, launch, maintenance
   Kanban por stage (igual layout).
```

**Tab "Closed" view:**
```
   Filter: stage IN (closed_won, closed_lost)
   Vista: lista (fuerza list view? — propuesta: respetar preferencia, ajustar si feedback negativo)
```

**Tab "Archived" view:**
```
   Filter: archived_at IS NOT NULL
   Vista: lista solo-lectura (no permitir cambios desde aquí).
```

### 5.D — Sidebar (propuesta default)

```
┌──────────────┐
│ Nomi         │
├──────────────┤
│ 🏠 Dashboard │
│ 👤 Leads     │
│ 🏢 Clients   │
│ 📁 Deals       ← umbrella (mantener? ver sección 13)
│   📈 Sales Pipeline    ← NUEVO
│   🏗️  Active Projects  ← NUEVO
│ 📅 Calendar  │
│ ...          │
└──────────────┘
```

**Alternativa propuesta** (te pregunto en sección 13): eliminar "Deals" umbrella y solo dejar las 2 sub-entradas.

---

## 6. Tests manuales (los correré yo en dev/local)

### Test 1 — `convertLeadToClient` con `createDeal=true`
1. Crear lead `Test Lead 1` con `interested_service='website'`, `lead_value_estimate=2500`, sin company.
2. Click "Convert to client" → marcar checkbox "Create initial deal", confirmar service="Website", amount=2500.
3. **Assert:** redirige a `/clients/:id/show`.
4. **Assert BD:**
   - `contacts.status='client'`, `contacts.lead_stage='won'`, `contacts.snooze_until='2099-12-31 00:00:00+00'`.
   - `companies` nuevo con el nombre.
   - `deals` nuevo con `stage='won'`, `lifecycle_phase='opportunity'`, `amount=2500`, `project_type='website'`, `converted_from_contact_id=<test lead id>`.
5. **Assert UI:** el deal aparece en `/deals?view=closed` (porque stage='won' es terminal en sales pipeline) y en el tab "Closed".

   ⚠️ **Atención:** el prompt dice "verificar que aparece en /deals tab 'Closed'", pero por mi filter `stage@in (closed_won, closed_lost)`, un deal con stage='won' (no 'closed_won') NO aparece en Closed. Para que cumpla el criterio del prompt, una de dos opciones:
   - Opción A: cambiar `stage='won'` por `stage='closed_won'` al crear el deal (semánticamente más correcto: la venta está cerrada y ganada, no en negociación).
   - Opción B: incluir `'won'` en el filtro del tab "Closed": `stage@in (won, closed_won, closed_lost)`.
   
   **Mi recomendación: Opción A** (usar `closed_won` al crear). Razón: `won` se usa para "negociación cerrada con éxito, listo para empezar delivery"; `closed_won` se usa para "venta cerrada definitivamente, sin delivery activo". Como Cristian dijo que el lead que se convierte es "asumimos conversión = venta cerrada", `closed_won` es semánticamente más preciso. **Esto necesita tu confirmación. Sección 13 P0.**

### Test 2 — `convertLeadToClient` con `createDeal=false`
1. Crear lead `Test Lead 2` similar al 1.
2. Click convert → desmarcar checkbox.
3. **Assert BD:**
   - `contacts.status='client'`, `contacts.lead_stage='won'`, `contacts.snooze_until='2099-12-31'`.
   - `deals`: 0 deals nuevos para ese cliente.
4. **Assert UI:** no aparece deal en ningún tab.

### Test 3 — Trigger sync_deal_stage_to_contact_lead_stage
3a. **INSERT con stage='lead'**: crear deal manualmente con stage='lead' → contact.lead_stage NO cambia (el CASE no mapea 'lead' explícitamente, cae a `else null` → no remapeo).
3b. **UPDATE stage 'lead' → 'discovery'**: contact.lead_stage='talking'.
3c. **UPDATE stage 'discovery' → 'proposal_sent'**: contact.lead_stage='quoted'.
3d. **UPDATE stage 'proposal_sent' → 'won'**: contact.lead_stage='won', snooze_until='2099-12-31'.
3e. **UPDATE stage 'won' → 'closed_lost'**: contact.lead_stage='lost', snooze_until permanece '2099-12-31'.
3f. **INSERT deal con stage='closed_won' sin contact_id**: NO falla, no actualiza nada.
3g. **UPDATE deal con stage='won' (sin cambio real, stage='won' → 'won')**: NO ejecuta UPDATE en contacts (guard `IS DISTINCT FROM`).

### Test 4 — Cliente existente compra otro servicio (upsell)
1. Cliente existente en `/clients/:id/show`.
2. Click "+ New deal" → redirect a `/deals/create?company_id=X&contact_id=Y`.
3. Elegir "Manual" → llenar form → submit.
4. **Assert BD:** deal nuevo con `company_id`, `contact_id`, `contact_ids=[Y]`. `converted_from_contact_id=NULL` (no vino de conversión de lead).
5. **Assert UI:** aparece en `/deals?view=sales` si `lifecycle_phase=opportunity`.

### Test 5 — Anti-Olvido NO se ve afectado
1. Antes de la migración: snapshot de `select count(*) from contacts where status='lead' and snooze_until is null` y `select count(*) from get_leads_requiring_attention(4, 100)`.
2. Después de la migración + tests 1-4: mismos SELECTs, mismos resultados (asumiendo que las muestras de test no impactan los 309 leads paused reales).
3. **Assert manual:** abrir `/leads/attention` → mismos leads, mismo banner, mismo cron output.
4. **Assert backend:** abrir log de `enforce_lead_attention` edge function → corre sin error.

### Test 6 — Tabs en /deals
1. Default `/deals` → tab "Sales Pipeline" activo.
2. Click "Active Projects" → URL pasa a `/deals?view=projects` → filter aplica, board muestra deals en delivery.
3. Click "Closed" → muestra deals cerrados.
4. Click "Archived" → muestra archived list.
5. Search + filters siguen funcionando en cada tab.

### Test 7 — Sidebar nuevas entradas
1. Click "Sales Pipeline" → va a `/deals?view=sales`.
2. Click "Active Projects" → va a `/deals?view=projects`.
3. Click "Deals" (umbrella) → va a `/deals` (sin query) → default a "Sales Pipeline".

---

## 7. Riesgos identificados + mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Mi trigger entra en loop con otros triggers existentes en deals/contacts | Baja | Alto | Inspección exhaustiva ya hecha en sección H2. WHERE clause con `IS DISTINCT FROM` previene UPDATEs no-op. `handle_contact_saved` solo toca `avatar`. |
| R2 | Trigger se dispara en INSERT batch (e.g. backfill futuro) y satura BD | Media | Bajo | Trigger es liviano (1 UPDATE corto con WHERE indexed). Para batches grandes, podemos hacer `DISABLE TRIGGER` temporal en Fase 2. Documentado en `DEFERRED_NOTES`. |
| R3 | UI tabs rompe el board view actual de `LbsDealBoardContent` | Baja | Medio | El filtro server-side se aplica antes; el board recibe data pre-filtrada. No tocamos `LbsDealBoardContent`. |
| R4 | `stage='won'` no aparece en tab "Closed" (filtro asume stage canónico `closed_won`) | Alta | Bajo | Sección 6 Test 1 explica: usar `closed_won` al crear desde convertLeadToClient (Opción A recomendada). |
| R5 | Cliente convertido sin `interested_service` ni `lead_value_estimate` no crea deal aunque `createDeal=true` | Alta | Bajo | Es comportamiento deseado. UI muestra service dropdown y amount input para que el usuario lo llene en el momento del convert. |
| R6 | El nuevo CTA "+ New deal" rompe layout responsive en mobile | Media | Bajo | Tailwind responsive: en pantallas chicas, el botón se contrae a icon-only (`size="icon"` + `<Plus/>`). Probaremos en mobile. |
| R7 | Aplicar migración en prod sin haber probado en dev | Alta | Alto | **Pendiente decisión de Cristian.** Ver sección 9 Deployment. |
| R8 | Trigger se aplica pero algún deal histórico tenía `contact_id` con `status != 'lead'` y se le cambia `lead_stage` indeseadamente | Baja | Bajo | Solo afecta contacts con `id IN (deal.contact_id)`. En LBS hoy solo 3 deals existen, todos test data. El backfill (Fase 2) cargará deals históricos pero `lead_stage` NULL en cliente histórico no afecta UX. |
| R9 | Cambios al sidebar confunden usuarios actuales (3 entradas Deals) | Media | Bajo | Sección 13 pregunto si prefieres umbrella o solo 2 sub-entradas. |
| R10 | `dealCommissionAutomation.ensureCommissionsForWonDeal` se dispara cuando creamos deal con stage='won' o 'closed_won' | Alta | **Positivo** | Es comportamiento deseado: si el deal tiene `salesperson_ids` poblado, crea la comisión automática. Como hoy LBS no usa salesperson_ids (espera Fase 4), no se crea nada. ✅ Sin daño. |

---

## 8. Orden de ejecución paso a paso

Asumo que recibo "APROBADO" + respuesta a la pregunta P0 de sección 13.

### Día 1 (~3-4h)
1. **Crear DB snapshot manual** (Supabase Dashboard → Database → Backups) o esperar el backup nocturno. ⚠️ Si vamos a prod directo.
2. **Correr SELECTs de verificación previa** (sección 3.1).
3. **Crear migración SQL** `supabase/migrations/20260711120000_fase1_deals_activation.sql`.
4. **Aplicar migración** según el flujo que Cristian elija (sección 9).
5. **Correr smoke test post-migración** (sección 3.2).
6. **Test 3** (trigger directo via SQL): INSERT/UPDATE deals dummy y verificar contacts.
7. **Borrar los test deals dummy** (`DELETE FROM deals WHERE name LIKE 'TEST%'`).

### Día 2 (~4-5h)
8. **Modificar `dataProvider.ts`** (sección 4.1).
9. **Modificar `ConvertLeadButton.tsx`** (sección 4.2).
10. **Test 1, Test 2** manuales (con lead real de testing).
11. **Modificar `ClientProfileHeader.tsx`** + `ClientNewMenu.tsx` (secciones 4.3, 4.4).
12. **Test 4** manual.

### Día 3 (~3-4h)
13. **Modificar `DealList.tsx`** (sección 4.5) — agregar Tabs.
14. **Modificar `navigation.ts`** (sección 4.6).
15. **Test 6, Test 7** manuales.
16. **Test 5** (Anti-Olvido no afectado): correr SELECTs comparativos y abrir UI de attention.
17. **Lint + typecheck**: `make lint && make typecheck`.
18. **Generar `DEPLOYMENT_FASE_1.md`** con pasos exactos para producción.
19. **Reportar a Cristian** con los resultados de los 7 tests + screenshots clave + diff de archivos modificados.

### Checkpoint
20. **Cristian valida en demo en vivo** los 4 flujos del checkpoint del master plan (convertir lead, mover deal a won, crear deal desde cliente existente, aceptar proposal manualmente).
21. Si OK → deploy a producción según `DEPLOYMENT_FASE_1.md`.
22. Si requiere iteración → 1-2 días de ajustes.

---

## 9. Deployment plan (preview)

El `DEPLOYMENT_FASE_1.md` final se generará al terminar el dev. Vista previa de su estructura:

### 9.1 Pre-flight
- DB snapshot reciente (max 1h antes).
- Confirmar que no hay otra migración pendiente.
- Branch `main` deployado con éxito en hosting.

### 9.2 Secrets / env vars adicionales
**Ninguno.** Fase 1 no agrega Twilio/Push/Stripe nuevas integraciones.

### 9.3 Pasos de deploy
1. **Aplicar migración:**
   - Local: `npx supabase db push` o vía SQL editor del Dashboard.
   - Production: aplicar via `npx supabase db push --linked` o pegar SQL en Dashboard SQL editor.
2. **Verificar trigger activo** (smoke test sección 3.2).
3. **Deploy frontend** (push a `main` → auto deploy en Vercel).
4. **Smoke test en prod:**
   - Convertir 1 lead de prueba (preferiblemente uno propio, no de cliente real).
   - Verificar deal aparece y `lead_stage='won'`.
   - Verificar Anti-Olvido sigue mostrando los 309 paused.

### 9.4 Plan de rollback
- **Si el trigger causa errores en INSERT/UPDATE deals:**
  ```sql
  drop trigger if exists trg_sync_deal_to_lead_stage on public.deals;
  ```
  El deal-creation sigue funcionando. `lead_stage` y `snooze_until` no se sincronizan automáticamente. UX sigue siendo manejable.

- **Si la columna nueva causa problemas (improbable, es nullable):**
  ```sql
  alter table public.deals drop column if exists converted_from_contact_id;
  ```

- **Si el frontend rompe:** revert del commit en git + redeploy.

- **Si convertLeadToClient crea deals indeseados:**
  ```sql
  delete from public.deals where created_at >= '<deploy_time>' and converted_from_contact_id is not null;
  update public.contacts set lead_stage = ..., snooze_until = ... where ...; -- revert
  ```

### 9.5 Smoke test post-deploy
- Abrir `/deals?view=sales` → carga sin errores.
- Abrir `/deals?view=projects` → carga sin errores.
- Abrir `/clients/<id>/show` → ver botón "+ New deal".
- Abrir `/leads/<id>/show` → click "Convert to client" → ver dialog ampliado.
- Backend: `select count(*) from deals` → no debe haber crecido inexplicablemente.

---

## 10. Criterios de aceptación (copia exacta del prompt + check de cumplimiento)

| Criterio | Implementación |
|---|---|
| ✅ Convertir un lead crea automáticamente su deal (con opción de skip) | Cambio 4.1 + 4.2: checkbox "Create deal" |
| ✅ Stages de deals sincronizan con contacts.lead_stage vía trigger | Migración sección 3 |
| ✅ Cerrar un deal (won/lost) saca al contact del Anti-Olvido | Trigger setea `snooze_until='2099-12-31'` |
| ✅ Existe CTA "New Deal" prominente en cada cliente | Cambio 4.3 |
| ✅ Página /deals tiene tabs por lifecycle_phase | Cambio 4.5 |
| ✅ Sidebar muestra Sales Pipeline y Active Projects separados | Cambio 4.6 |
| ✅ Tests manuales pasan | Sección 6 |
| ✅ Sistema Anti-Olvido sigue idéntico para leads sin deal | Test 5 |
| ✅ Migración probada en dev, documentada para prod | Pendiente decisión Cristian sobre flujo dev/prod (sección 9) |
| ✅ DEPLOYMENT_FASE_1.md listo | Se genera al final del dev (paso 18) |

---

## 11. Cosas que detecté y NO implemento (van a `DEFERRED_NOTES.md` al final)

Confirmo que estas son tentaciones de scope creep que voy a documentar para futuras fases sin tocarlas ahora:

1. **Banner "Este cliente no tiene deals registrados"** del prompt original (Cambio 3): es UI nice-to-have pero **no es crítica para Fase 1**. Lo pongo en `DEFERRED_NOTES.md` para que decidas si lo agregamos en un sprint corto.
2. **Sincronización inversa contact.lead_stage → deal.stage**: no necesaria.
3. **Notificación en chat al sales rep cuando proposal se acepta**: pertenece a Fase 4 o Fase 5.
4. **RLS scoping por vendedor en deals**: Fase 4.
5. **`/deals/attention` page con deals estancados**: Fase 5.
6. **Wiring de `organization_members.id` ↔ `people.id` (salesperson)**: Fase 4 — bloquea comisiones automáticas pero no es de Fase 1.
7. **Subscriptions / MRR**: Fase 3.
8. **Backfill desde Zoho**: Fase 2.

---

## 12. Cambios verificados que el prompt original NO mencionó pero recomiendo

- ✅ **Extender SELECT de contact en `convertLeadToClient`** (H5): necesario para tener acceso a `interested_service` y `lead_value_estimate` (sin esto el deal sale vacío).
- ✅ **Guard "no crear deal vacío"** si no hay service_type ni amount: para evitar deals fantasma.
- ✅ **UPDATE explícito de `lead_stage`/`snooze_until` cuando `createDeal=false`**: porque el trigger no se dispara si no hay deal.
- ✅ **Helper `labelOfProjectType`**: para generar nombre legible del deal.
- ✅ **Mover `stage='won'` → `'closed_won'`** (R4 / sección 13 P0): para que aparezca correctamente en el tab "Closed".

---

## 13. Preguntas P0 pendientes (necesito tu respuesta antes de codear)

### P0.1 — Stage al crear deal desde convertLeadToClient: `'won'` o `'closed_won'`?

**Contexto:** En el pipeline LBS hay 2 stages "won":
- `won` (order_index 4): "venta cerrada, listo para arrancar delivery"
- `closed_won` (order_index 10): "deal terminado completamente, sin delivery activo"

**Tu prompt dice:** `stage: 'won'` (asumimos conversión = venta cerrada).

**Pero el criterio de aceptación del prompt dice:** "Verificar que aparece en /deals tab 'Closed'". Mi filter para Closed es `stage@in (closed_won, closed_lost)`. Si creamos con `stage='won'`, no aparece en Closed.

**Opciones:**
- **A** (recomendada): cambiar a `stage='closed_won'`. Conversión = venta totalmente cerrada. El cliente puede crear un nuevo deal manual cuando arranque delivery activo de un servicio específico.
- **B**: mantener `stage='won'`. Cambiar mi filter Closed a `stage@in (won, closed_won, closed_lost)`. Mezcla wons "vivos" con cerrados.
- **C**: el deal creado por convert siempre va a `lifecycle_phase='delivery'` con `stage='design'` o similar. Implica que la conversión también marca el arranque del proyecto.

**Mi recomendación: A**. ¿Confirmas?

### P0.2 — Sidebar: 2 o 3 entradas de Deals?

**Opciones:**
- **A** (recomendada): eliminar "Deals" umbrella, dejar solo "Sales Pipeline" + "Active Projects". Más limpio. El usuario llega a Closed/Archived por las tabs internas.
- **B**: mantener "Deals" umbrella + 2 sub-entradas. Tres entradas que apuntan a la misma URL.

**Mi recomendación: A**. ¿Confirmas?

### P0.3 — Flujo dev/prod para la migración (H11)

**Opciones:**
- **A**: aplicas tú mismo via Dashboard SQL editor en prod con backup previo (riesgo bajo, cambios aditivos).
- **B**: corro local con `npx supabase db reset` + `migration up` en mi máquina (necesito que confirmes que es seguro destruir mi DB local).
- **C**: tienes algún branch/preview de Supabase para esto.

**Mi recomendación: A** con DB snapshot manual primero (cambios son 100% aditivos: solo CREATE/ADD, ningún DROP).

### P0.4 — Banner "Este cliente no tiene deals"

El prompt original lo pedía. Lo dejé en `DEFERRED_NOTES.md` para no inflar Fase 1. ¿Está OK posponerlo o lo quieres en Fase 1?

---

## 14. Estado

**🛑 ESPERANDO "APROBADO" + respuestas a P0.1/P0.2/P0.3/P0.4.**

Cuando recibas APROBADO con esos 4 puntos, ejecutaré en orden de la sección 8. Al terminar generaré:
- `DEPLOYMENT_FASE_1.md`
- `DEFERRED_NOTES.md`
- Reporte de resultados de los 7 tests
- Diff de archivos modificados para review

**No voy a tocar código hasta recibir la luz verde.**
