# Auditoría: Integración de Deals en Nomi CRM

> Fecha: 2026-05-25
> Alcance: análisis read-only del estado del Nomi CRM (org LBS, `org_id=3`) para decidir si integrar/activar Deals como módulo central.
> Reglas de la auditoría: solo lectura. No se ha modificado código, BD ni dependencias.

---

## 1. Resumen ejecutivo

**Lo que encontré:** Nomi CRM **ya tiene** un modelo de Deals completo y maduro: la tabla `deals` existe con 44 columnas, FK a `companies`/`contacts`/`proposals`/`contracts`, 11 stages que cubren todo el ciclo (sales → delivery → cierre), un campo `lifecycle_phase` (`opportunity`|`delivery`) que distingue venta vs ejecución, y más de 15 tablas satélite (`deal_milestones`, `deal_client_payments`, `deal_commissions`, `deal_expenses`, `deal_change_orders`, `deal_approvals`, `maintenance_retainers`, `project_deliveries`, etc.). La infraestructura para registrar pipeline de ventas, facturación parcial, comisiones y retainers ya está construida.

**Datos reales en producción (org LBS):**
- 339 leads (`contacts.status='lead'`), 211 clientes (`status='client'`)
- **3 deals totales**, 0 proposals, 0 contracts, 0 client payments, 0 maintenance retainers
- 0 companies con 2+ deals registrados (el upsell no se está capturando)
- 33 tasks, 28 de ellas ya atadas a un `deal_id`

**¿Recomiendo implementar Deals ahora? PARCIAL.**

No hay nada que "implementar como tabla nueva" — ya existe. Lo que recomiendo es una fase de **activación + extensión** del modelo existente: cerrar el gap entre el lead que se convierte a cliente y el deal que nunca se crea, sincronizar `lead_stage` (Sistema Anti-Olvido) con `deals.stage`, hacer prominente el flujo de upsell para clientes recurrentes, y backfill histórico de los 211 clientes desde el CRM previo. **Rediseñar desde cero (Opción C) es overengineering** y rompe el Sistema Anti-Olvido recién instalado.

---

## 2. Estado actual de la base de datos

### 2.1 Tablas relevantes (org LBS, `org_id=3`)

#### `contacts` — 28 columnas
**Identidad y contacto:** `id`, `first_name`, `last_name`, `gender`, `title`, `avatar`, `email_jsonb`, `phone_jsonb`, `address`, `linkedin_url`, `background`
**Auditoría:** `first_seen`, `last_seen`, `created_at` (implícito)
**Lifecycle / lead pipeline:** `status` (lead|client|contact), `lead_stage` (new|contacted|talking|quoted|closing|paused|won|lost), `last_contacted_at`, `next_followup_at`, `snooze_until`, `lead_value_estimate`
**Relaciones:** `company_id`, `organization_member_id` (owner), `org_id`, `referred_by_company_id`
**Otros:** `tags[]`, `has_newsletter`, `lead_source`, `interested_service`, `status_legacy` (backup post-normalización)

#### `companies` — 21 columnas
`id`, `name`, `sector`, `size`, `website`, `linkedin_url`, `phone_number`, `address`, `city`, `state_abbr`, `zipcode`, `country`, `revenue`, `description`, `tax_identifier`, `logo`, `context_links` (JSON), `organization_member_id`, `org_id`, `primary_contact_id` (FK → contacts), `created_at`

#### `deals` — 44 columnas (ENTIDAD CENTRAL DE VENTAS+PROYECTOS)
**Identidad:** `id`, `name`, `description`, `notes`, `category`, `priority`
**Sales:** `stage` (11 valores), `amount`, `estimated_value`, `expected_closing_date`, `archived_at`, `index`, `pipeline_id` (default='default')
**Proyecto / delivery:** `project_type`, `project_address`, `project_address_meta` (jsonb), `start_date`, `expected_end_date`, `actual_completion_date`, `estimated_completion_time`, `delivery_status`, `website_brief` (jsonb), `website_content` (jsonb), `tech_stack` (jsonb), `staging_url`, `production_url`, `github_repo`
**Financiero:** `original_project_value`, `current_project_value`, `value_includes_material`
**Relaciones:** `company_id` (FK), `contact_id` (FK), `contact_ids[]`, `salesperson_ids[]`, `subcontractor_ids[]`, `worker_ids[]`, `organization_member_id` (owner), `accepted_proposal_id` (FK → proposals), `org_id`
**Discriminador clave:** `lifecycle_phase` (`opportunity` o `delivery`)
**Auditoría:** `created_at`, `updated_at`, `company_name` (denormalizado)

#### `proposals` — 19 columnas
`id`, `org_id`, `company_id`, `contact_id`, `deal_id` (FK al deal generado), `organization_member_id`, `title`, `status` (draft|sent|viewed|accepted|rejected), `amount`, `valid_until`, `sent_at`, `viewed_at`, `accepted_at`, `rejected_at`, `content` (jsonb), `notes`, `created_at`, `updated_at`, `created_by_member_id`

#### `proposal_line_items` — 6 columnas
`id`, `proposal_id` (FK), `description`, `quantity`, `unit_price`, `sort_order`

#### `contracts` — 17 columnas
`id`, `org_id`, `company_id`, `contact_id`, `proposal_id`, `deal_id`, `organization_member_id`, `title`, `status` (draft|signed|expired), `signed_at`, `expires_at`, `document` (jsonb), `file` (jsonb), `notes`, `created_at`, `updated_at`, `created_by_member_id`

#### `deal_client_payments` — 13 columnas (cobros del cliente al deal)
`id`, `deal_id`, `payment_date`, `amount`, `payment_method`, `check_number`, `reference_number`, `status`, `attachments`, `notes`, `created_at`, `updated_at`, `created_by_member_id`

#### `deal_milestones` — 12 columnas (hitos con fechas, opcionalmente de cobro)
`id`, `org_id`, `deal_id`, `title`, `description`, `start_date`, `due_date`, `completed_at`, `order_index`, `depends_on_milestone_id`, `color`, `created_at`

#### `deal_change_orders` — 12 columnas (cambios de alcance con $$ asociado)
`id`, `deal_id`, `title`, `description`, `change_date`, `amount`, `reason`, `status`, `attachments`, `created_at`, `updated_at`, `created_by_member_id`

#### `deal_commissions` — 11 columnas
`id`, `deal_id`, `salesperson_id`, `commission_type`, `commission_value`, `basis`, `paid`, `notes`, `created_at`, `updated_at`, `created_by_member_id`

#### `deal_expenses` — 13 columnas
`id`, `deal_id`, `expense_type`, `vendor`, `description`, `amount`, `purchase_date`, `paid`, `attachments`, `notes`, `created_at`, `updated_at`, `created_by_member_id`

#### `deal_approvals` — 13 columnas
`id`, `org_id`, `deal_id`, `resource_type`, `resource_url`, `title`, `description`, `status`, `requested_by_member_id`, `responded_at`, `response_comment`, `created_at`, `expires_at`

#### `maintenance_retainers` — 10 columnas (recurring monthly per deal)
`id`, `org_id`, `deal_id`, `monthly_hours_included`, `monthly_amount`, `billing_day`, `start_date`, `end_date`, `active`, `created_at`

#### `tasks` — 15 columnas
`id`, `contact_id`, `deal_id`, `type`, `text`, `due_date`, `done_date`, `organization_member_id`, `org_id`, `priority`, `internal`, `assignee_person_ids[]`, `collaborator_person_ids[]`, `mentioned_member_ids[]`, `created_at`

#### Tablas adicionales con FK a `deals` (no detalladas, solo enumeradas)
`deal_resources`, `deal_launch_checklist_items`, `deal_subcontractor_entries`, `deal_subcontractors`, `deal_workers`, `deal_salespersons`, `deal_access_entries`, `deal_access_entry_audit`, `deal_cost_entries`, `deal_notes`, `project_deliveries`, `project_delivery_corporate_emails`, `project_delivery_domains`, `project_delivery_log`, `project_delivery_notifications`, `client_portal_deal_access`

#### Mensajería
- `conversations` (22 cols) — campos `deal_id`, `contact_id`, `assignee_member_id`
- `conversation_messages` (14 cols)
- `conversation_participants` (5 cols)
- `message_templates` (13 cols)
- `voice_calls` (17 cols)

#### Forms V2
- `forms` (9), `form_instances` (34), `form_submissions_v2` (22 — incluye `contact_id`, `company_id`, `deal_id`), `form_submission_events` (9), `form_templates` (11), `public_form_tokens` (14 — incluye `deal_id`)

#### Sistema Anti-Olvido (Fase 1, recién instalado)
- `org_lead_stage_config` (10) — SLAs por stage
- `lead_snooze_log` (8) — auditoría de snoozes
- `member_escalation_settings` (13) — preferencias de notificación por usuario
- `member_sales_windows` (8) — ventanas de trabajo por usuario
- `push_subscriptions` (9)

#### NO existe
- **`invoices`** — no hay tabla de facturas formal. La función la cumple `deal_client_payments` (pagos recibidos) + `proposals` (cotizaciones que hacen las veces de "monto a cobrar").
- **`subscriptions`** — no hay tabla genérica de suscripciones. Solo existe `maintenance_retainers` que está atado a `deal_id`.
- **`customers` separada de `companies`** — el modelo unifica todo bajo `companies` + `contacts.status`.

### 2.2 Relaciones (foreign keys reales extraídas de `information_schema`)

```
organizations ◄── org_id en todas las tablas org-scoped

companies (id) ◄── contacts.company_id
                 ◄── contacts.referred_by_company_id
                 ◄── deals.company_id
                 ◄── proposals.company_id
                 ◄── contracts.company_id
                 ◄── tickets.company_id
                 ◄── form_submissions_v2.company_id
                 ◄── public_form_tokens.company_id

companies.primary_contact_id ──► contacts (id)

contacts (id) ◄── deals.contact_id
              ◄── deals.contact_ids[]   (array, no FK estricta)
              ◄── proposals.contact_id
              ◄── contracts.contact_id
              ◄── tasks.contact_id
              ◄── conversations.contact_id
              ◄── tickets.contact_id
              ◄── form_submissions_v2.contact_id
              ◄── public_form_tokens.contact_id

deals (id)    ◄── tasks.deal_id
              ◄── proposals.deal_id        (proposal puede generar un deal)
              ◄── contracts.deal_id
              ◄── conversations.deal_id
              ◄── tickets.deal_id
              ◄── form_submissions_v2.deal_id
              ◄── public_form_tokens.deal_id
              ◄── deal_milestones.deal_id
              ◄── deal_client_payments.deal_id
              ◄── deal_change_orders.deal_id
              ◄── deal_commissions.deal_id
              ◄── deal_expenses.deal_id
              ◄── deal_approvals.deal_id
              ◄── deal_resources.deal_id
              ◄── deal_launch_checklist_items.deal_id
              ◄── deal_subcontractor_entries.deal_id
              ◄── deal_access_entries.deal_id
              ◄── deal_notes.deal_id
              ◄── maintenance_retainers.deal_id
              ◄── project_deliveries.deal_id
              ◄── client_portal_deal_access.deal_id

deals.accepted_proposal_id ──► proposals (id)
proposals.deal_id ──► deals (id)              (relación 1:1 bidireccional)

proposals (id) ◄── proposal_line_items.proposal_id
               ◄── contracts.proposal_id

organization_members ◄── *.organization_member_id (owner)
                       ◄── *.created_by_member_id
                       ◄── conversations.assignee_member_id
                       ◄── deal_approvals.requested_by_member_id
                       ◄── etc.

conversations (id) ◄── conversation_messages.conversation_id
                   ◄── conversation_participants.conversation_id

contacts (id) ◄── lead_snooze_log.contact_id   (Anti-Olvido)
```

### 2.3 ¿Existe ya el concepto de Deal?

**SÍ. Está implementado y conectado a casi todo, pero está sub-utilizado.**

Evidencia:
- Tabla `deals` con 44 columnas (la tabla más rica del schema, junto con `people`).
- Campo `deals.lifecycle_phase` separa explícitamente `opportunity` (venta) de `delivery` (proyecto en ejecución).
- 11 pipeline stages configurados en `organization_pipeline_stages` para LBS (`lead`, `discovery`, `proposal_sent`, `won`, `design`, `development`, `review`, `launch`, `maintenance`, `closed_won`, `closed_lost`).
- Edge function `supabase/functions/accept_proposal/index.ts` ya crea un deal automáticamente cuando una proposal se acepta (línea 49: `from("deals").insert(...)`).
- Edge function `supabase/functions/_shared/formV2PostSubmit.ts:109-133` crea un deal automáticamente con `stage='lead'` cuando un form configurado con `auto_create_lead=true` recibe submission.
- Vista `deal_activity_unified` agrega mensajes + notes + expenses + change orders + payments + tasks por `deal_id` en un feed unificado.
- Existen helpers de UI `getClientDealCreatePath(companyId, contactId)` en `src/lbs/routing.ts:35` y botón "New project" en `src/lbs/clients/ClientNewMenu.tsx:92`.

Lo que NO está conectado:
- **No hay auto-creación de deal cuando un Lead se convierte a Cliente** (función `convertLeadToClient` en `src/components/atomic-crm/providers/supabase/dataProvider.ts:767-866` solo cambia `status='client'` y vincula company, no toca `deals`).
- **No hay sincronización entre `contacts.lead_stage` (Anti-Olvido) y `deals.stage`** — son dos pipelines paralelos que no se hablan.
- **El CTA "New deal" para clientes recurrentes está enterrado** en un dropdown ("ClientNewMenu" → opción "New project"). No hay un botón prominente que invite al upsell.

---

## 3. Cómo se distingue Lead vs Cliente hoy

**No hay tabla separada de "leads".** La distinción es por el campo `contacts.status` y se gestiona en código en varios puntos:

### En código:
- **`src/lbs/navigation.ts:178-188`** define `LBS_LEAD_STATUSES = ['lead', 'warm', 'cold', 'prospect']` (los 3 últimos son legacy). Cualquier `contact` cuyo `status` esté en este array se considera lead.
- **`src/lbs/routing.ts:21-22`** expone `isLeadStatus(status)` que checa contra ese array.
- **`src/lbs/routing.ts:49-55`** `getPersonShowPath(contact)` decide si rutear a `/leads/:id/show` o `/contacts/:id/show` según `isLeadStatus(contact.status)`.
- **`src/lbs/leads/LeadsListPage.tsx:42-44`** filtra la lista por `status@in (lead,warm,cold,prospect)`.
- **`src/lbs/leads/ConvertLeadButton.tsx`** muestra el botón solo si `isLead && hasConvert`. Al click, llama a `dataProvider.convertLeadToClient`.

### En BD:
- **`status='lead'`** → 339 filas (LBS): lead activo
- **`status='client'`** → 211 filas: contacto de un cliente activo
- **`status='contact'`** → 1 fila: contacto secundario no-cliente
- Columna nueva `contacts.status_legacy` guarda el valor original previo a la normalización 2026-05.

### Pipeline interno del lead (independiente del status):
La columna `contacts.lead_stage` (introducida en la migración `20260710150000_lead_attention_system.sql`) almacena la posición en el pipeline de sales con valores `new | contacted | talking | quoted | closing | paused | won | lost`. Esto es lo que usa el Sistema Anti-Olvido para sus SLAs.

**Distribución actual (`lead_stage`):** 3 `new`, 23 `contacted`, 309 `paused`, 4 que entraron por backfill.

### Inconsistencia detectada:
Antes de los cambios de hoy (que están aplicados), `LBS_LEAD_STATUSES = ['new','contacted','qualified','proposal-sent','lost']`, pero `contacts.status` real era `'lead'`. Eso hacía que la lista `/leads` no mostrara ningún registro (resultado: 0 rows mostradas a pesar de 335 leads en BD). Esta auditoría refleja el estado POST-corrección.

---

## 4. Flujo actual de ventas (paso a paso real)

### 4.1 — Entrada de un lead

**Canal A: form público (más común)**
- Submission llega a `supabase/functions/submit_form_v2/index.ts`.
- Si el form_instance tiene `auto_create_contact=true` → `supabase/functions/_shared/formV2PostSubmit.ts:54-107` crea un `contacts` row con datos del form.
- Si además tiene `auto_create_lead=true` → `formV2PostSubmit.ts:109-133` crea un `deals` row con `stage='lead'`, `contact_id`, `contact_ids=[contactId]`. **Este es el único path actual donde una entrada de lead crea un deal automático.**
- Triggers BEFORE INSERT en `contacts` (post-fix de hoy) asignan `org_id` y `organization_member_id` desde la sesión.

**Canal B: manual desde admin**
- `src/lbs/leads/LeadCreatePage.tsx` renderiza el form (post-fix: defaults `status='lead'`, `lead_stage='new'`).
- Llama a `dataProvider.create('contacts', data)`. NO crea deal asociado.

**Canal C: mensajes entrantes**
- `supabase/functions/twilio_inbound_sms/index.ts`, `whatsapp_inbound/index.ts`, `voice_status_webhook/index.ts` crean un `contacts` (si no existe match por teléfono) + `conversations`. NO crean deal.

### 4.2 — Lead se convierte a cliente

**Punto único:** `src/components/atomic-crm/providers/supabase/dataProvider.ts:767-866` función `convertLeadToClient({contactId, companyName})`.

Pasos:
1. Lee el contact (línea 779-789).
2. Si tiene `company_id` ya válido → lo usa. Si no → busca company por nombre (línea 809-817) o crea una nueva (línea 822-831).
3. **`update contacts set status='client', company_id=X`** (línea 846-852).
4. Si la company recién encontrada/creada no tiene `primary_contact_id` → lo setea al contact id (línea 858-862).
5. Retorna `{company_id, contact_id}` y la UI redirige a `/clients/:company_id/show`.

**Lo que NO ocurre:**
- `contacts.lead_stage` no cambia (sigue donde estaba: `talking`, `quoted`, etc.).
- `contacts.snooze_until` no se setea → el Sistema Anti-Olvido sigue marcando al ex-lead como pendiente.
- **No se crea ningún `deals` row.**

### 4.3 — Cliente quiere comprar algo más (upsell)

Flujo permitido por el código:
- En `/clients/:companyId/show`, el componente `src/lbs/clients/ClientNewMenu.tsx:92` muestra un item "New project" en un dropdown.
- Click → navega a `/deals/create?company_id=X&contact_id=Y` (vía helper `getClientDealCreatePath` en `src/lbs/routing.ts:35`).
- Se abre `src/lbs/deals/ProjectCreateFlow.tsx` → `NewProjectChooserDialog` → opción Manual o Web form.
- Manual → `src/lbs/projects/AgencyProjectCreateForm.tsx` crea `deals` con `company_id`, `contact_id` preseteados y stage default.

**Realidad operativa:** 0 companies con 2+ deals registrados → el flujo existe en código pero **nadie lo está usando**.

### 4.4 — Aceptación de proposal → creación automática de deal

**Edge function:** `supabase/functions/accept_proposal/index.ts:12-110`

Pasos:
1. Recibe `proposal_id` (línea 21-25).
2. Verifica que el proposal exista y pertenezca al org del usuario (línea 27-36).
3. Si la proposal ya tiene `deal_id` → retorna ese id (idempotente, línea 38-46).
4. Inserta nuevo `deals` con `stage='setup'`, `lifecycle_phase='delivery'`, `delivery_status='planning'`, `accepted_proposal_id=proposalId`, `amount` copiado de la proposal (línea 49-70).
5. Actualiza `proposals.accepted_at` y `proposals.deal_id` (línea 77-84).

**Estado operativo:** 0 proposals existen en producción → este flujo nunca se ha ejecutado.

### 4.5 — Pagos del cliente

Cuando se recibe un pago, se inserta manualmente en `deal_client_payments` desde el tab financiero del deal (`src/lbs/projects/tabs/ProjectFinancialsTab.tsx`). No hay automatización via Stripe/Plaid; el tracking es manual.

**Estado:** 0 pagos registrados.

### 4.6 — Mensajería ligada al deal

`conversation_messages` con `direction='outbound'` y `kind != 'system'` disparan el trigger `handle_outbound_message_contact_touch` (definido en migración `20260710150000_lead_attention_system.sql`). Este trigger:
- Lee `conversation.contact_id`.
- Actualiza `contacts.last_contacted_at` y recalcula `next_followup_at` vía `compute_next_followup(contact_id, ts)`.

**Importante:** el trigger NO mira `conversations.deal_id`, solo `contact_id`. Es decir, el Sistema Anti-Olvido es 100% contact-centric.

---

## 5. Dependencias del Sistema de Atención a Leads (Fase 1)

### 5.1 Tablas que usa
- `contacts` (columnas: `lead_stage`, `last_contacted_at`, `next_followup_at`, `snooze_until`, `lead_value_estimate`)
- `org_lead_stage_config`
- `lead_snooze_log`
- `member_escalation_settings`
- `member_sales_windows`
- `push_subscriptions`
- `conversation_messages` (solo lectura via trigger)
- `conversations` (lectura para resolver contact_id)

### 5.2 Funciones de BD / RPCs
- `public.compute_next_followup(contact_id, ts)` — calcula próxima fecha de follow-up según `org_lead_stage_config.sla_hours`
- `public.handle_outbound_message_contact_touch()` — trigger en `conversation_messages` (INSERT)
- `public.get_leads_requiring_attention()` — RPC para el dashboard del usuario
- `public.get_lead_debt_summary()` — RPC para el banner rojo
- `public.get_leads_requiring_attention_for_member(member_id)` — RPC admin que pasa por encima de RLS (usada por el cron)

### 5.3 Edge function
- `supabase/functions/enforce_lead_attention/index.ts` — corre cada 15min vía Vercel cron (`/api/cron/enforce-attention.ts` + `vercel.json`). Lee `member_escalation_settings` + `member_sales_windows`, calcula urgencia por miembro, dispara push/SMS/WhatsApp via Twilio + Web Push.

### 5.4 Frontend
- `src/lbs/leads/LeadsAttentionPage.tsx`
- `src/lbs/leads/LeadsDebtBanner.tsx`
- `src/lbs/leads/SnoozeLeadDialog.tsx`
- `src/lbs/leads/LeadAttentionTitleBadge.tsx`
- `src/lbs/leads/DashboardLeadAttentionCard.tsx`
- `src/lbs/leads/ProfilePushNotificationsSection.tsx`
- `src/lbs/leads/leadAttentionApi.ts`, `src/lbs/leads/pushSubscription.ts`
- `src/sw.ts` (service worker con push handler)

### 5.5 ¿Qué se rompe si introducimos cambios?

| Cambio propuesto | Impacto al Anti-Olvido |
|---|---|
| Agregar columnas nuevas a `contacts` | **Ninguno.** El sistema lee columnas específicas, no `SELECT *`. |
| Crear nuevas tablas (e.g. `subscriptions`) | **Ninguno.** El sistema no conoce esas tablas. |
| Modificar `contacts.status` enum | **Ninguno directo.** El sistema mira `lead_stage`, no `status`. |
| Modificar `contacts.lead_stage` enum | **ALTO.** Romperia `compute_next_followup`, `get_leads_requiring_attention`. Requiere actualizar `org_lead_stage_config` en paralelo. |
| Agregar trigger en `deals.stage` que actualice `contacts.lead_stage` | **Coordinable.** El nuevo trigger debería respetar los valores válidos de `lead_stage` y no entrar en loop con triggers existentes. Bajo riesgo si se diseña con cuidado. |
| Modificar `handle_outbound_message_contact_touch` | **MEDIO.** Cambios al trigger afectan directamente el SLA tracking. Cada cambio debe testearse contra el cómputo de `next_followup_at`. |
| Agregar `deal_id` lookup en `conversations` para tocar también un campo en `deals` | **BAJO.** Se puede hacer en un trigger separado sin tocar el actual. |
| Dropear `contacts.lead_stage` | **CRÍTICO. ROMPE TODO el Anti-Olvido.** No hacerlo. |
| Renombrar `contacts.next_followup_at` o `last_contacted_at` | **CRÍTICO.** Mismas razones. |

---

## 6. Recomendación arquitectónica

### Opción A — No implementar/activar Deals

**Pros:**
- Cero riesgo técnico.
- Cero tiempo de desarrollo.
- Anti-Olvido sigue funcionando intacto.

**Contras:**
- **Win-rate invisible:** no podrás medir cuántos de tus leads cierran (cierran fuera del CRM).
- **Historial de clientes ciego:** 211 clientes activos y no sabes qué te compraron, cuándo, ni por cuánto.
- **Upsell no se trackea:** dices que la mayoría compra 2+ servicios, pero el CRM muestra 0 upsells.
- **MRR/retainers invisibles:** `maintenance_retainers` y `deal_client_payments` quedarán siempre en 0.
- **Imposible escalar con equipo:** los 3+ vendedores futuros no podrán ver "sus" deals, ni tendrán comisiones automáticas.
- **El módulo ya construido (deals, proposals, contracts, milestones, payments, commissions) queda como tech debt sin justificación.**

**¿Qué pierdes en 6 meses?** Visibilidad financiera completa del negocio y capacidad de delegar ventas a un equipo. Por tu propio reporte (100+ clientes activos, mayoría con 2+ servicios, equipo creciendo a 3+), el costo de no activar Deals empieza a ser alto rápidamente.

### Opción B — Deals minimalista (tabla nueva, no rompe nada)

**No aplica.** La tabla `deals` ya existe con 44 columnas. Crear una tabla nueva paralela sería un error.

Si la pregunta se reinterpreta como "activar Deals con cambios mínimos al modelo existente":

**Pros:**
- Bajo riesgo (cambios aditivos).
- Aprovecha 100% de la infraestructura existente.
- Compatible con Anti-Olvido.
- Esfuerzo: 1 semana de dev.

**Contras:**
- No resuelve el problema del backfill histórico de 211 clientes (clientes invisibles).
- No agrega multi-pipeline ni scoping por vendedor (necesarios para equipo de 3+).
- No agrega subscriptions/MRR (necesario si la mayoría compra retainers).

**Cambios concretos (3 quirúrgicos):**
1. Modificar `convertLeadToClient` en `dataProvider.ts:767` para crear opcionalmente un `deals` row con `stage='won'`, `lifecycle_phase='opportunity'`, `contact_id`, `company_id`.
2. Agregar trigger BEFORE UPDATE en `deals.stage` que mantenga `contacts.lead_stage` sincronizado (mapeo: `won`/`closed_won` → `lead_stage='won'`, `closed_lost` → `lead_stage='lost'`, etc.) y setee `contacts.snooze_until='2099-12-31'` para sacar al contact del Anti-Olvido cuando se cierre el deal.
3. Subir el botón "New deal" del dropdown en `ClientNewMenu.tsx` a un CTA primario en el header de `/clients/:id/show`.

### Opción C — Rediseño completo

**Pros:**
- Diseño limpio sin la deuda histórica del modelo `deals` hybrid.
- Posibilidad de separar conceptualmente `opportunities`, `projects`, `customers`, `invoices`, `subscriptions` en tablas dedicadas.

**Contras / Riesgos:**
- 3-4 meses de trabajo (incluyendo migración de datos).
- Hay que migrar 339 contacts + 211 clients + 3 deals + Sistema Anti-Olvido completo + todas las tablas satélite (proposals, contracts, milestones, payments, commissions, expenses, etc.).
- Anti-Olvido (recién instalado) probablemente requeriría rediseño paralelo.
- Riesgo de regresiones en flujos críticos (form submissions, message routing, calendar, financial reports).
- Costo de oportunidad: 3-4 meses no construyendo features para clientes.

### Opción D — Activar + Extender + Backfillear (propuesta nueva, recomendada)

Punto medio: hace todo lo de B pero también suma:

1. **Backfill histórico**: importar desde Zoho CRM (que el usuario mencionó como CRM previo) los deals/payments de los 211 clientes existentes.
2. **Multi-pipeline por vendedor**: extender RLS de `deals` para que cada vendedor vea sus deals; admin ve todo.
3. **Subscriptions/MRR**: activar `maintenance_retainers` + nueva tabla `subscriptions` para retainers no-de-maintenance.
4. **Workflow real de proposals**: link público shareable + flujo de aceptación cliente → trigger del edge function `accept_proposal` ya existente.
5. **Anti-Olvido extendido (opcional)**: extender cron para también vigilar deals estancados (e.g. `proposal_sent >7 días sin actividad`).

**Esfuerzo estimado:** 5-8 semanas.
**Riesgo:** bajo-medio (aditivo, no destructivo).
**Cubre el contexto real reportado por el usuario:** 100+ clientes activos, mayoría con upsell, equipo de 3+ vendedores, billing mixto.

### Mi recomendación: **D**

Justificación con datos del CRM real:

- **211 clientes "vivos" reportados** vs **0 deals históricos en BD**: la pérdida de visibilidad histórica del negocio es crítica y solo se resuelve con backfill (Opción B no lo cubre).
- **Mayoría compra 2+ servicios reportado** vs **0 companies con 2+ deals en BD**: el patrón de upsell no se está capturando. Necesitas Opción D punto 1 + 3 + 4 para hacerlo posible y visible.
- **Equipo creciendo a 3+ vendedores reportado** vs **un solo pipeline `default` configurado**: sin multi-pipeline y RLS por vendedor, escalar el equipo es operativamente difícil.
- **Billing mix (upfront / 50-50 / hitos / retainer) reportado** vs **0 milestones y 0 retainers activos**: la infraestructura para soportar billing flexible existe (`deal_milestones` + `deal_client_payments` + `maintenance_retainers`) pero no se está aprovechando. Opción D punto 3 la activa.
- **Anti-Olvido Fase 1 acaba de entrar en producción**: Opción C la rompería. Opción D la respeta (es 100% aditiva sobre `contacts.lead_stage`).
- **Opción A** deja todo este valor en la mesa por evitar 5-8 semanas de trabajo: mal trade-off dado el volumen real.

---

## 7. Plan en fases (si decide implementar Opción D)

### Fase 1 — Activación + autoflow (1 semana)
**Objetivo:** cerrar el loop Lead → Cliente → Deal sin fricción.

- Modificar `convertLeadToClient` (`dataProvider.ts:767`) para opcionalmente crear un `deals` row pre-rellenado (`stage='won'`, `lifecycle_phase='opportunity'`, `project_type=contact.interested_service`, `estimated_value=contact.lead_value_estimate`).
- Agregar trigger BD `sync_deal_stage_to_lead_stage` en `deals` BEFORE UPDATE para mantener `contacts.lead_stage` y `contacts.snooze_until` consistentes con la transición de stages.
- Reubicar el botón "New deal" en `/clients/:id/show` como CTA primario.
- Renombrar/reorganizar la UI `/deals` con tabs `Sales pipeline` (lifecycle_phase=opportunity) / `Active projects` (delivery) / `Closed` (archived).
- Activar workflow de proposals: link público shareable + email send + landing pública de aceptación.

### Fase 2 — Backfill histórico (1 semana)
**Objetivo:** que el CRM refleje la historia comercial real de los 211 clientes.

- Conectar API de Zoho CRM (token OAuth) o exportar CSV.
- Script ETL que para cada Zoho deal crea `deals` row con `company_id` matched por email del primary contact o nombre de empresa.
- Para deals históricos sin proposal asociado, crear shell de `proposals` para que `deals.accepted_proposal_id` apunte a algo.
- Importar pagos históricos a `deal_client_payments`.
- Reporte de auditoría post-backfill: companies sin deal, deals sin payment, gaps detectados.

### Fase 3 — Suscripciones / Retainers (1-2 semanas)
**Objetivo:** capturar MRR de retainers de maintenance y SEO/Ads recurrentes.

- Activar tabla `maintenance_retainers` que ya existe (campos: `monthly_amount`, `billing_day`, `start_date`, `end_date`, `active`).
- Nueva tabla `subscriptions` para retainers de otros servicios (SEO, ads, social media).
- Cron job que genera `deal_client_payments` programados mensualmente (status='pending') y notifica al admin.
- Dashboard de MRR (`/dashboard?widget=mrr`).
- UI para activar/pausar/cambiar retainer desde el tab financiero del deal.

### Fase 4 — Equipo + comisiones + multi-pipeline (1-2 semanas)
**Objetivo:** habilitar 3+ vendedores con permisos correctos y comisiones automáticas.

- RLS scoping en `deals`: cada vendedor ve sus deals (los que él creó o donde está en `salesperson_ids`); admin ve todo.
- Activar `deal_commissions` con cálculo automático al pasar deal a `won`.
- Vista "My deals" por vendedor en sidebar.
- Lead assignment: nuevo lead → auto-asignar al vendedor con menos carga (round-robin) o manual.
- Activar `organization_pipeline_stages` para soportar múltiples pipelines (e.g. uno por tipo de servicio o uno por vendedor) si se requiere.

### Fase 5 — Anti-Olvido extendido (opcional, 1 semana)
**Objetivo:** que el sistema también vigile deals estancados, no solo leads.

- Extender `enforce_lead_attention` edge function para también buscar deals con:
  - `stage='proposal_sent'` y sin actividad >7 días.
  - `stage='won'` y sin actividad/kickoff >14 días.
  - `lifecycle_phase='delivery'` y sin commit/task done >30 días.
- Nuevas RPCs `get_deals_requiring_attention()` paralelas a las de leads.
- UI dedicada `/deals/attention` o integración en el dashboard existente.

---

## 8. Preguntas que necesito que Cristian responda

Preguntas que no pude responder leyendo el código y que afectan el diseño:

### Sobre el contexto del negocio
1. **De los 211 clientes con `status='client'`, ¿cuántos son realmente "vivos" hoy?** ¿Hay un patrón para identificarlos (ej. último pago en 6 meses)?
2. **¿Qué patrón de billing aplica a cada tipo de servicio?** (e.g. websites=50/50, SEO=mensual, ads=mensual+performance). Esto determina cómo modelar milestones vs subscriptions.
3. **¿Qué CRM exacto venías usando antes (Zoho)?** ¿Edición Standard/Pro/Enterprise? ¿Tienes acceso API? ¿Cuántos registros de deals/pagos tiene allá?
4. **Cuando un cliente activo te paga el retainer mensual, ¿se cobra automáticamente (Stripe/ACH) o lo registras manual?**

### Sobre el modelo
5. **¿Quieres separar `opportunity` (preventa) de `project` (postventa) en URLs y UI?** Hoy ambas son `/deals/:id`. ¿Te parece OK mantenerlo unificado con tabs internos o prefieres rutas separadas (`/deals` vs `/projects`)?
6. **¿Cada deal debe ser "1 servicio" o puede ser "paquete de 2-3 servicios"?** Esto afecta si necesitamos `deal_line_items` o si seguimos con un deal por servicio.
7. **Cuando creas un deal histórico via backfill, ¿el `lifecycle_phase` por defecto debe ser `delivery` (asumiendo que es algo ya entregado) o `closed_won` con `archived_at`?**

### Sobre el equipo
8. **¿Los 3+ vendedores futuros venden los mismos servicios o cada uno tiene una vertical (e.g. uno solo websites, otro solo ads)?** Esto define si necesitamos 1 pipeline compartido o N pipelines.
9. **¿La comisión es porcentaje fijo o varía según servicio/vendedor?** Define el cálculo en `deal_commissions`.
10. **¿Un vendedor puede ver leads/deals de otro vendedor o estrictamente solo los suyos?**

### Sobre el Anti-Olvido
11. **Cuando un cliente ya cerró deal y arranca el proyecto, ¿quieres que el Sistema Anti-Olvido SIGA vigilando su comunicación (e.g. project manager debe contestar en X horas) o sale completamente del radar?**
12. **¿Quieres que el cron `enforce_lead_attention` también te alerte si un deal en `proposal_sent` lleva >7 días sin actividad?**

### Sobre la migración
13. **Para los 339 leads actuales (la mayoría en `paused`), ¿quieres una purga masiva (e.g. todos los `paused` con `first_seen` >12 meses pasan a `lost`)?** Si no, van a seguir contando en métricas para siempre.
14. **¿Cuál es tu nivel de tolerancia a downtime durante las migraciones?** Algunos cambios de schema requieren brief downtime; otros se pueden hacer hot.

---

**Fin de la auditoría.** Documento generado sin ejecutar migraciones, sin modificar código existente, sin instalar paquetes. Lista para decisión del usuario.
