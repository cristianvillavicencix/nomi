# Master Plan — Activación e Integración de Deals

> Fecha: 2026-05-25
> Decisión previa: **Opción D** (Activar + Extender + Backfillear) — confirmada en `AUDIT_DEALS_INTEGRATION.md`.
> Alcance de este documento: responder las 14 preguntas abiertas (con datos reales donde sea posible) y construir el plan ejecutable de las 5 fases con checkpoints.
> **No se ha modificado código ni BD para producir este plan.**

---

## Hallazgos críticos antes de planear

Antes de las 14 preguntas, tres datos que cambian la conversación:

1. **El CRM nuevo está prácticamente vacío de operación real.** En LBS hay 5 conversations totales, 0 mensajes outbound/inbound enviados, 0 voice calls, 0 payments, 0 proposals, 0 contracts. Las 110 companies cliente fueron seeded en bloque el `2026-05-21 17:23` (todas en el mismo segundo) — esto fue un import manual previo, no uso orgánico. Los 3 deals existentes son tests/demos.
2. **El historial del negocio vive en Zoho, no en Nomi.** Todo lo que Cristian "sabe" sobre patrones de upsell, ticket promedio, win rate, MRR, etc., está en su cabeza o en Zoho — no en el CRM nuevo. **Esto convierte al backfill (Fase 2) en el cimiento de toda decisión basada en data.**
3. **Mucha infraestructura ya existe y no se está aprovechando.** Encontré:
   - `src/lbs/deals/dealCommissionAutomation.ts` ya crea comisiones automáticas al pasar deal a stage won/delivered/closed_won/completed con 5% por defecto.
   - `supabase/functions/accept_proposal/index.ts` ya crea el deal cuando se acepta una proposal.
   - `supabase/functions/_shared/formV2PostSubmit.ts:109-133` ya crea deal con `stage='lead'` desde forms.
   - `src/lbs/projects/financials/constants.ts:43-47` define `PAYMENT_SCHEDULE_SPLITS = [{Deposit:30%}, {Milestone1:40%}, {Final:30%}]` como template.
   - 11 pipeline stages configurados en `organization_pipeline_stages` (org=3).

Conclusión: este proyecto es **principalmente activación + datos**, no construcción.

---

## Parte 1 — Respuestas a las 14 preguntas

### Pregunta 1 — ¿Cuántos de los 211 clientes están realmente vivos?

**Lo que puedo responder con datos:**

Primer hallazgo: los 211 no son clientes, son contacts con `status='client'`. Los **clientes reales son las companies**, y son **110** (varias companies tienen 2-12 contacts cada una — empleados, dueños, decisor, etc.).

Actividad de las 110 companies cliente medida por máximo(último mensaje outbound, último mensaje inbound, última task, último cambio de deal):

| Ventana | Companies activas |
|---|---|
| 30 días | 2 |
| 90 días | 2 |
| 180 días | 2 |
| 365 días | 2 |
| **Totalmente silenciosas (sin actividad registrada)** | **108** |

Las 108 silenciosas no significa que sean clientes muertos — significa que **el Nomi CRM nunca ha tenido su actividad**. El histórico está en Zoho, email personal, WhatsApp directo, etc.

**Lo que necesito que Cristian decida:**
- Qué definición operativa quiere para "cliente vivo" después del backfill. Tres opciones:
  - **A**: Pagó algo en los últimos 12 meses → es vivo.
  - **B**: Tiene un retainer/maintenance activo → es vivo.
  - **C**: Tuvo cualquier interacción (email, llamada, mensaje) en los últimos 6 meses → es vivo.
- Si rechaza todas: definirlo manualmente revisando lista de 110 (1-2h de trabajo).

**Mi recomendación:** Empezar con definición **A** después del backfill (es la única medible por data). Las companies que no caigan en A pero Cristian sepa que son activas → marcar manualmente con un tag `manually_verified_active`.

---

### Pregunta 2 — ¿Qué patrón de billing aplica a cada tipo de servicio?

**Lo que puedo responder con datos:**

- Único patrón observable: el código ya define `PAYMENT_SCHEDULE_SPLITS = [Deposit 30%, Milestone 40%, Final 30%]` (`src/lbs/projects/financials/constants.ts:43-47`) → esto sugiere que para websites el patrón histórico de LBS es **30/40/30 dividido en hitos**.
- Project types en deals: `website`, `new-website` (LBS es agencia web principalmente).
- `WEB_EXPENSE_CATEGORIES` incluye `ads_spend`, `subcontractor_dev`, `subcontractor_design`, `hosting`, `domain` → sugiere que LBS también vende ads, hosting, mantenimiento, además del website.
- 0 retainers, 0 payments → patrones reales no medibles en BD.

**Lo que necesito que Cristian decida:**

Confirmar la matriz servicio → billing model. Mi mejor adivinanza basada en el código:

| Servicio (probable) | Billing model esperable | Fuente |
|---|---|---|
| Website (one-shot) | 30/40/30 en hitos | template hardcoded ya existe |
| SEO mensual | Retainer mensual fijo | no hay data, suposición |
| Ads management | Retainer mensual + % gasto | `ads_spend` aparece como categoría de gasto |
| Hosting/maintenance | Retainer mensual fijo | `hosting` aparece como categoría + tabla `maintenance_retainers` existe |
| Change orders | One-shot cobro adicional | tabla `deal_change_orders` ya existe |

**Mi recomendación:** Cristian me confirma esta matriz en 5 minutos. Es la base para el diseño de Fase 3 (Subscriptions/Retainers).

---

### Pregunta 3 — ¿Qué CRM previo y con qué acceso?

**Lo que puedo responder con datos:** Nada en BD/repo.

**Lo que ya respondió Cristian:** Zoho CRM, **sin API**, solo CSV export.

**Lo que necesito que Cristian decida adicionalmente:**
- ¿Qué edición de Zoho? (Standard/Pro/Enterprise → afecta qué módulos puede exportar)
- ¿Cuántos deals históricos hay en Zoho (estimación gruesa)? Esto define el costo del backfill.
- ¿Tiene exports de Deals + Contacts + Accounts + Notes? Los 4 son críticos.
- ¿Tiene historial de pagos en Zoho o lo lleva en otra parte (QuickBooks, Stripe, banco, planilla)?

**Mi recomendación:** Antes de iniciar Fase 2, Cristian me entrega los CSVs y reviso muestra para definir mapping.

---

### Pregunta 4 — ¿Pagos de retainer mensual: automáticos o manuales?

**Lo que puedo responder con datos:**

- Stripe está integrado **solo** para billing per-seat de la plataforma Nomi (LBS paga a Nomi). Confirmado en `supabase/functions/stripe-billing/index.ts` + `stripe-webhook/index.ts` + `src/platform/inviteBillingGate.ts`.
- **Stripe NO está integrado para cobros B2C a clientes finales de LBS.**
- `deal_client_payments` tiene campos manuales: `check_number`, `reference_number`, `payment_method` (text libre). No hay foreign key a Stripe.
- 0 pagos registrados.

**Conclusión:** Hoy todo es manual. No hay automatización.

**Lo que necesito que Cristian decida:**
- ¿Quiere automatizar cobros en Fase 3 (Stripe Subscriptions/ACH) o mantenerlo manual?
- Si quiere automatizar: ¿solo recurrentes (retainers) o también one-shots (websites)?

**Mi recomendación:** Fase 3 = generar `deal_client_payments` **planificados** (status='pending') por cron mensual, **manualmente confirmados** cuando entra el dinero (mark as cleared/deposited). Esto da 80% del valor con 20% del esfuerzo. Stripe/ACH integration → Fase 6 opcional fuera del scope original.

---

### Pregunta 5 — ¿Separar opportunity de project en URLs y UI?

**Lo que puedo responder con datos:**

- Hoy todo va a `/deals/:id` y el componente decide qué mostrar según `deals.lifecycle_phase`.
- El campo `lifecycle_phase` (`opportunity` o `delivery`) ya existe.
- La estructura unificada simplifica la conversión opportunity → project (es un UPDATE, no INSERT).
- Conversión inversa (project que vuelve a opportunity) prácticamente no existe en flujos reales.
- Vistas y componentes existentes (deal_activity_unified, ProjectShowPage, financial tabs) asumen URL única.

**Lo que necesito que Cristian decida:** estética, no técnica.

**Opciones:**
- **A**: Mantener `/deals/:id` único con tabs internos (`Sales`, `Project`, `Financials`). Simple, menos código que cambiar.
- **B**: Crear `/opportunities/:id` y `/projects/:id` con redirect automático según `lifecycle_phase`. Más limpio mentalmente, pero rompe bookmarks y URLs compartidos.
- **C**: Subdivisión visual en la misma URL: `/deals?view=sales` y `/deals?view=projects`.

**Mi recomendación: A.** Cambios cosméticos en navegación (sidebar separa "Sales pipeline" y "Active projects" como 2 entradas, ambos van a `/deals` filtrado). Esto evita migrar URLs y mantiene el modelo unificado, que es lo correcto a nivel de BD.

---

### Pregunta 6 — ¿Cada deal es 1 servicio o paquete?

**Lo que puedo responder con datos:**

- Los 3 deals existentes tienen `array_length(contact_ids,1) = 1` (un contacto cada uno).
- `project_type` es **un solo valor** por deal (no array): `website`, `new-website`.
- Tabla `proposal_line_items` existe → permite múltiples line items por proposal (paquete).
- `proposal_line_items` tiene 0 filas en BD.

**Patrón observable:** infraestructura permite paquete, pero el uso real hoy es 1 deal = 1 servicio.

**Lo que necesito que Cristian decida:**
- Cuando vendes website + SEO + ads, ¿es **1 deal** con 3 line items en la proposal, o **3 deals separados** con el mismo `company_id`?

**Implicación técnica:**
- 1 deal por paquete: más simple para el cliente ("compré un proyecto"), pero confunde stages (¿el website está en "launch" pero el SEO en "maintenance"?).
- 1 deal por servicio: más limpio para tracking de delivery, pero más overhead operativo.

**Mi recomendación:** **1 deal por servicio.** Mantiene stages limpios. Los paquetes se documentan en la proposal (line items) y se materializan como N deals al aceptar. La proposal queda como el "contrato paraguas".

---

### Pregunta 7 — Backfill: ¿lifecycle_phase default = delivery o closed_won?

**Lo que puedo responder con datos:**

- 0 deals históricos hoy → backfill = todo nuevo desde Zoho.
- Stages disponibles que cierran un deal: `won`, `closed_won`, `closed_lost`.
- `lifecycle_phase='delivery'` implica que el proyecto está activo en ejecución.
- `lifecycle_phase='opportunity' + stage='closed_won'` implica venta cerrada pero no en ejecución actual.
- Existe campo `archived_at` para sacar deals del feed activo.

**Lo que necesito que Cristian decida:**
- En Zoho, ¿los "deals históricos" están como "completed/closed", o están dejados al final del pipeline pero técnicamente sigue habiendo trabajo recurrente con esos clientes?

**Mi recomendación:** Lógica de backfill por estado de Zoho:

| Estado Zoho | → Nomi `lifecycle_phase` | `stage` | `archived_at` |
|---|---|---|---|
| Won / Closed Won (sin retainer activo) | opportunity | closed_won | hoy |
| Won / Closed Won (con retainer activo conocido) | delivery | maintenance | NULL |
| Lost | opportunity | closed_lost | hoy |
| In progress / Active | delivery | development o launch | NULL |
| Open / Negotiation | opportunity | discovery o proposal_sent | NULL |

Esto mantiene el historial accesible pero no contamina el dashboard activo.

---

### Pregunta 8 — ¿Vendedores con vertical o pipeline compartido?

**Lo que puedo responder con datos:**

Members actuales en LBS (`organization_members.org_id=3`):

| ID | Nombre | Email | Rol | ¿Vende? |
|---|---|---|---|---|
| 4 | Cristian Villavicencio | admin@lbs.bz | administrator | Sí (todo) |
| 3 | Diana Castro | diana.c@lbs.bz | sales_manager + hr + payroll_manager | Sí (sales_manager) |
| 7 | Harold Hernandez | harold@lbs.bz | employee (scoped_to_projects) | No (operativo) |
| 8 | Felix Jimenez | felix@lbs.bz | employee (scoped_to_projects, sin proposals.view) | No (operativo) |

Hoy **solo 2 personas venden** (Cristian + Diana). El "equipo de 3+" futuro es plan, no realidad.

Pipeline: 1 solo (`pipeline_id='default'`).

**Lo que necesito que Cristian decida:**
- Cuando contrate vendedor 3, 4, etc., ¿cada uno será generalista (vende todo) o vertical (uno solo websites, otro solo ads, etc.)?
- ¿Diana hoy vende todos los servicios o solo algunos?

**Mi recomendación:** Empezar Fase 4 asumiendo **pipeline compartido + generalistas**. Si en 6 meses Cristian decide segmentar verticales, agregar `pipeline_id` por vertical es retrocompatible (solo es agregar filas a `organization_pipeline_stages` con otro `pipeline_id`).

---

### Pregunta 9 — ¿Comisión fija o variable?

**Lo que puedo responder con datos:**

- Hoy: **5% por default** sobre `payments_collected` (`DEFAULT_LBS_COMMISSION_PERCENT = 5` en `src/lbs/projects/financials/constants.ts:19`).
- Sistema en `dealCommissionAutomation.ts:34-83` ya crea automáticamente un `deal_commissions` row cuando deal pasa a stage `won|delivered|closed_won|completed`.
- `commission_type` enum soporta `percentage` o `flat`.
- 0 comisiones registradas (porque 0 deals cerrados).

**Patrón actual:** comisión única flat del 5% por payments collected, igual para todos los vendedores y servicios.

**Lo que necesito que Cristian decida:**
- ¿5% sigue siendo el número correcto?
- ¿Diferenciado por servicio? (ej. websites 5%, SEO mensual 10% del primer mes, ads 3% del spend, etc.)
- ¿Diferenciado por vendedor? (ej. junior 3%, senior 7%)
- ¿Bonus por meta? (ej. +2% si pasa de $X mensual)

**Mi recomendación:** Fase 4 mantiene el modelo simple actual (% fijo configurable por LBS). Si Cristian quiere reglas complejas (por servicio/vendedor/meta), se hace Fase 4.5 con tabla `commission_rules`. Bajo riesgo.

---

### Pregunta 10 — ¿Vendedor ve solo sus deals o todos?

**Lo que puedo responder con datos:**

- Hoy no hay RLS scoping por vendedor en `deals`. La RLS es por `org_id`.
- Permisos están en `module_permissions` JSON por miembro (ya existe `_scoped_to_projects: true` para Harold/Felix).
- `deals.salesperson_ids[]` existe y se llena al asignar vendedor.
- Owner (`organization_member_id`) también existe.

**Lo que necesito que Cristian decida:** modelo de visibilidad. Tres patrones comunes:

| Modelo | Descripción | Pro | Con |
|---|---|---|---|
| **Open** | Todos ven todos los deals | Transparencia, ayuda entre vendedores | "Robar" leads, presión competitiva |
| **Strict scoped** | Cada vendedor solo ve sus deals; admin ve todo | Privacidad, foco individual | Falta visibilidad para mentoring |
| **Read all, edit own** | Todos ven todos los deals; solo el owner edita | Transparencia + protección | Casi nadie usa este modelo en práctica |

**Mi recomendación:** **Strict scoped** para LBS (equipo chico, comisiones individuales). Diana, como `sales_manager`, ve todos los deals + comisiones del equipo. Cristian (admin) ve todo.

---

### Pregunta 11 — ¿Anti-Olvido sigue vigilando al cliente activo o sale del radar?

**Lo que puedo responder con datos:**

- Sistema Anti-Olvido (`compute_next_followup`, `enforce_lead_attention`) lee `contacts.lead_stage` y `contacts.next_followup_at`.
- Cuando un deal pasa a stage `won`, hoy **no hay sincronización** que toque `contacts.lead_stage` ni `contacts.snooze_until`.
- Resultado actual: cliente que cerró sigue apareciendo en el radar del Anti-Olvido. Confirmado: `lead_stage` no cambia tras conversión.

**Lo que necesito que Cristian decida:** elegir uno de estos modelos:

| Modelo | Comportamiento |
|---|---|
| **A: Sale completo** | Cuando deal → won/closed_won, `lead_stage='won'` y `snooze_until=2099`. Anti-Olvido los ignora para siempre. |
| **B: Vigilancia post-venta** | Sigue vigilando pero con SLA más relajado (e.g. cliente cerrado debe ser contactado al menos cada 30 días). |
| **C: Solo si tiene retainer** | Si el deal tiene retainer activo, vigilancia continua con SLA mensual. Sin retainer, sale del radar. |

**Mi recomendación:** **A** ahora (Fase 1, simple). En Fase 5 introducir **C** (más útil porque sí quieres que los retainers no se olviden).

---

### Pregunta 12 — ¿Cron también alerta deals proposal_sent >7 días sin actividad?

**Lo que puedo responder con datos:**

- `enforce_lead_attention` edge function corre cada 15min vía Vercel cron (`/api/cron/enforce-attention.ts`).
- Hoy solo mira `contacts` con `next_followup_at < now()`.
- No mira `deals` en absoluto.
- 0 proposals enviadas → no hay data para validar SLA óptimo.

**Lo que necesito que Cristian decida:**
- ¿Cuántos días sin respuesta a una proposal antes de gritar?
- ¿Aplica solo a proposal_sent, o también a discovery, won (kickoff), etc.?

**Mi recomendación:** En Fase 5 agregar SLA por stage de deal (tabla `org_deal_stage_config` análoga a `org_lead_stage_config`):

| Stage | SLA default (días) | Alerta |
|---|---|---|
| proposal_sent | 5 | sin viewed → reminder |
| won (sin kickoff iniciado) | 7 | sin task creada → alerta |
| delivery (sin commit/task done) | 21 | proyecto estancado |
| maintenance (sin contacto con cliente) | 30 | retainer en riesgo |

Estos valores deben ser overridables por LBS desde Settings.

---

### Pregunta 13 — ¿Purga masiva de leads paused antiguos?

**Lo que puedo responder con datos:**

Distribución de los **309 leads en `lead_stage='paused'`** por antigüedad de `first_seen`:

| Antigüedad | Cantidad |
|---|---|
| > 24 meses | 0 |
| 12-24 meses | 9 |
| 6-12 meses | 168 |
| < 6 meses | 132 |
| **Total paused** | **309** |
| **Nunca contactados (last_contacted_at IS NULL)** | **309** ← todos |

Lectura: **todos los 309 paused nunca fueron contactados activamente**. Eso es porque entraron como import/seed o como leads pasivos que nunca se accionaron.

**Lo que necesito que Cristian decida:** Estrategia de cleanup. Mi propuesta:

| Acción | Afecta | Quedarían |
|---|---|---|
| **Conservador** — Marcar como `lost` los paused >12m que nunca fueron contactados | 9 | 300 paused |
| **Medio** — Marcar como `lost` los paused >6m que nunca fueron contactados | 177 | 132 paused |
| **Agresivo** — Marcar como `lost` los paused nunca contactados (todos) | 309 | 0 paused |

**Mi recomendación:** **Medio** (purgar 177 con first_seen > 6m). Los 132 más recientes pueden seguir en el radar; los más viejos ya son ruido. Backup en `lead_stage_legacy` antes de cualquier cambio.

---

### Pregunta 14 — ¿Tolerancia a downtime durante migraciones?

**Lo que puedo responder con datos:**

- Cambios planeados son todos aditivos (nuevas columnas opcionales, nuevas tablas, nuevos triggers que no remplazan existentes). Ningún cambio destructivo identificado.
- Cambios que requieren tabla lock en Postgres: `ADD COLUMN ... NOT NULL DEFAULT X` en tablas grandes. La tabla más grande hoy es `contacts` con ~550 filas → no es un problema de tamaño.
- Backfill desde CSV se hace via `INSERT` en transacciones acotadas → no requiere downtime.
- Trigger de sync deal↔lead se puede deployar con `ALTER FUNCTION ... ` en caliente.

**Conclusión:** Para el volumen actual de LBS, **ningún cambio requiere downtime**.

**Lo que necesito que Cristian decida:** ventanas preferidas para deploy.

**Mi recomendación:** Deploys hot durante semana, sin downtime planeado. Si algún paso requiere ventana excepcional, avisar 48h antes. Hacer backup snapshot antes de cada migración (5 min, automático).

---

## Parte 2 — Plan maestro de las 5 fases

### Fase 1 — Activación y autoflow (1.5 semanas)

**Objetivo de negocio:**
Cerrar el loop **Lead → Cliente → Deal** sin fricción manual. Hoy convertir un lead deja al cliente "huérfano" sin deal asociado. Esto hace imposible ver win rate, monto vendido, comisiones devengadas. Esta fase hace que cada lead ganado produzca un deal automáticamente.

**Duración estimada:** 1.5 semanas (5-8 días dev + 2 días QA + checkpoint).

**Pre-requisitos:**
- Respuestas confirmadas de Cristian a preguntas 5, 6, 10, 11 (modelo de URLs, 1-deal-por-servicio, scoping, anti-olvido post-conversión).
- Snapshot de BD reciente (antes de cambios).

**Entregables:**

1. **Migraciones SQL** (lista, no contenido):
   - `add_deal_lifecycle_post_convert_columns.sql` — agrega `deals.converted_from_contact_id` para audit trail del lead origen.
   - `sync_deal_stage_to_lead_stage_trigger.sql` — trigger BEFORE UPDATE en `deals` que ajusta `contacts.lead_stage` y `contacts.snooze_until` cuando deal cambia de stage. Mapeos: `won|closed_won` → `lead_stage='won'`, `snooze_until='2099-12-31'`; `closed_lost` → `lead_stage='lost'`.

2. **Archivos de código a modificar:**
   - `src/components/atomic-crm/providers/supabase/dataProvider.ts:767-866` (`convertLeadToClient`) → agregar parámetro `createDeal` opcional + lógica de inserción.
   - `src/lbs/leads/ConvertLeadButton.tsx` → checkbox "Create deal for this client" (default ON).
   - `src/lbs/clients/ClientShowPage.tsx` (o equivalente) → CTA primario "New deal" en header con dropdown de tipos de servicio (websites, SEO, ads, maintenance, custom).
   - `src/lbs/deals/DealList.tsx` → tabs internos "Sales Pipeline" (lifecycle_phase=opportunity) / "Active Projects" (delivery) / "Closed" (archived).
   - `src/lbs/navigation.ts` → agregar 2 entradas separadas en sidebar: "Sales Pipeline" y "Active Projects", ambas apuntando a `/deals?view=...`.
   - `supabase/functions/accept_proposal/index.ts` → enviar mensaje al sales rep en in-app inbox cuando proposal se acepta.

3. **UI nueva (wireframes textuales):**
   - `ConvertLeadDialog` con checkbox + dropdown service type + monto pre-poblado de `contact.lead_value_estimate`.
   - Header de `/clients/:id/show` con CTA primario "+ New deal" + dropdown.
   - Sidebar separa "Sales pipeline" 🎯 y "Active projects" 🏗️.

4. **Edge functions a modificar:**
   - `accept_proposal/index.ts` — sin cambios estructurales, solo agregar notificación.
   - `submit_form_v2/index.ts` (`_shared/formV2PostSubmit.ts:109-133`) — ya crea deal, solo verificar default `lifecycle_phase='opportunity'`.

5. **Tests:**
   - Manual: convertir 5 leads → cada uno crea su deal → verificar que `lead_stage` cambia a `won` y `snooze_until` se setea.
   - Manual: cambiar deal a `closed_lost` → verificar que `lead_stage='lost'` y `snooze_until` se setea.
   - Manual: enviar form con `auto_create_lead=true` → verificar deal creado con `lifecycle_phase='opportunity'`.

6. **Documentación:**
   - Update `AGENTS.md` sección "Adding custom fields" con nuevos campos.
   - 1 línea en `CHANGELOG.md`.

**Criterios de aceptación:**
- Al convertir un lead, opcional crear deal con datos pre-rellenados.
- Cambios de stage en deal sincronizan `lead_stage` y `snooze_until` correctamente (no quedan ex-leads "ganados" molestando al Anti-Olvido).
- Cliente en `/clients/:id/show` puede crear nuevo deal en 1 clic (testeo upsell).
- Sidebar muestra Sales Pipeline y Active Projects como 2 entradas distintas.
- Cero regresiones en Anti-Olvido (todos los SLAs siguen funcionando, push notifications igual).

**Riesgos identificados:**
- **Riesgo:** Trigger de sync entra en loop con triggers existentes en `contacts`. → **Mitigación:** Implementar guards `IF NEW.lead_stage IS DISTINCT FROM OLD.lead_stage` y testear con `pg_trigger_depth()`.
- **Riesgo:** Cambio en UI rompe bookmarks de usuarios. → **Mitigación:** Mantener URL `/deals/:id` y solo cambiar navegación. URLs viejos siguen funcionando.
- **Riesgo:** Anti-Olvido empieza a marcar ex-leads como "ganados" en un job batch retroactivo y dispara push notifications duplicados. → **Mitigación:** Trigger solo afecta UPDATEs futuros; data histórica no se modifica.

**Checkpoint con Cristian (fin de Fase 1):**
Demo en vivo:
1. Convertir 1 lead real → ver que se crea el deal.
2. Mover el deal a "Won" → ver que el lead sale del Anti-Olvido.
3. Crear nuevo deal para cliente existente desde `/clients/:id/show`.
4. Aceptar (manualmente desde admin) una proposal → ver que el deal nuevo se crea.

Cristian valida: ¿flujo se siente natural? ¿Hay fricción adicional? Si OK → Fase 2. Si no → iteración 1-2 días.

---

### Fase 2 — Backfill histórico desde Zoho CSV (2.5 semanas)

**Objetivo de negocio:**
Que el Nomi CRM refleje la historia comercial real de los 110 clientes. Sin esto, **todas las métricas son ciegas**: no hay LTV, no hay win rate, no hay revenue histórico, no hay segmentación por antigüedad. Esta fase convierte al Nomi en "el sistema de la verdad" para LBS.

**Duración estimada:** 2.5 semanas (10-14 días) — depende del volumen del CSV y de la limpieza de datos en Zoho.

**Pre-requisitos:**
- Fase 1 desplegada y validada.
- Cristian me entrega **CSV exports completos de Zoho**:
  - `Deals.csv` (mínimo: id, name, amount, stage, won/lost date, account, contact, owner, created)
  - `Contacts.csv` (mínimo: id, name, email, phone, account, owner, lead source, created)
  - `Accounts.csv` (companies — mínimo: id, name, website, industry, owner, created)
  - `Notes.csv` (opcional pero recomendado)
  - `Activities.csv` o `CallLogs.csv` (opcional)
- Confirmación de respuestas a preguntas 1, 2, 7 (definición de "cliente vivo", matriz billing, mapping de phases).

**Entregables:**

1. **Migraciones SQL:**
   - `zoho_import_staging_schema.sql` — crea tablas `zoho_import_staging_deals`, `zoho_import_staging_contacts`, `zoho_import_staging_accounts`, `zoho_import_staging_notes`. Schema espejo del CSV de Zoho.
   - `add_imported_from_audit_columns.sql` — agrega `imported_from text` y `imported_external_id text` a `deals`, `contacts`, `companies`, `deal_client_payments`. Permite trazabilidad y rollback.
   - `zoho_import_views.sql` — views de validación (`zoho_dup_emails`, `zoho_invalid_phones`, `zoho_unmatched_accounts`, etc.).

2. **Archivos de código a crear:**
   - `scripts/zoho_import/01_load_csv_to_staging.ts` — Node script local que sube los CSVs a las tablas staging.
   - `scripts/zoho_import/02_validate.ts` — corre las views de validación y exporta reporte HTML.
   - `scripts/zoho_import/03_match.ts` — algoritmo de matching (email → phone → company name → fuzzy).
   - `scripts/zoho_import/04_apply.ts` — INSERT real en tablas de producción con `imported_from='zoho'`.
   - `scripts/zoho_import/05_audit.ts` — reporte post-import (matches, duplicados, fallidos).
   - `src/lbs/admin/ZohoImportReviewPage.tsx` — UI admin-only para revisar matches dudosos antes de aprobar.

3. **UI nueva:**
   - `/admin/zoho-import` (admin-only) con 4 tabs: "Staging", "Validation", "Matches", "Import". Cristian aprueba cada fase antes de avanzar.
   - Cada match dudoso muestra side-by-side: Zoho record vs candidato Nomi → botones Accept/Reject/Manual edit.

4. **Edge functions:**
   - Ninguna. El backfill corre como script local desde mi máquina (o terminal Cristian) usando service role key.

5. **Tests:**
   - Dry-run: importar staging primero, ver reportes, sin tocar tablas de producción.
   - Test de rollback: `DELETE FROM deals WHERE imported_from='zoho'` debe limpiar todo sin afectar deals nativos.
   - Validación post-import: counts esperados (e.g. deals = sum(Zoho stage closed_won + active + lost)).

6. **Documentación:**
   - `docs/ZOHO_IMPORT_GUIDE.md` — paso a paso para Cristian, screenshots de los reportes esperados.

**Criterios de aceptación:**
- 100% de las companies de Zoho aparecen en Nomi (importadas o ya existentes matched).
- 0 duplicados generados en `contacts` o `companies`.
- 0 deals huérfanos (todo deal tiene company_id y al menos un contact_id).
- Cristian aprueba el reporte final de auditoría.
- Rollback funciona si hay errores detectados post-import.

**Riesgos identificados:**
- **Riesgo:** CSVs de Zoho tienen encodings raros (latin1, windows-1252) → falla parseo. → **Mitigación:** Script de pre-procesamiento que normaliza a UTF-8.
- **Riesgo:** Matching fuzzy genera falsos positivos (e.g. "ABC Corp" matches con "ABC Corporation"). → **Mitigación:** Cristian aprueba manualmente cualquier match con confidence < 95%.
- **Riesgo:** Volumen de deals es mayor a lo esperado y rompe timeline. → **Mitigación:** Después de Cristian me entregue CSV, hago estimación real en 1h y ajusto.
- **Riesgo:** Zoho tiene custom fields que no tienen equivalente en Nomi (e.g. propiedades del deal específicas de un servicio). → **Mitigación:** Importarlos como JSON en `deals.notes` para no perderlos.
- **Riesgo:** Cristian no tiene historial de pagos en Zoho (solo deals). → **Mitigación:** Importar solo deals; pagos quedan como "unknown historical" y se llenan manualmente o desde QuickBooks/banco.

**Checkpoint con Cristian (fin de Fase 2):**
1. Cristian revisa muestra de 20 clientes random en Nomi → confirma que la info que ve coincide con lo que recuerda de Zoho.
2. Cristian abre dashboard de revenue histórico y valida que totales hacen sentido.
3. Reporte final de auditoría aprobado.

---

### Fase 3 — Subscriptions y Retainers (1.5 semanas)

**Objetivo de negocio:**
Capturar y visualizar el **MRR (Monthly Recurring Revenue)** de retainers — fuente de ingreso predecible que hoy no se ve en ningún dashboard. Permite a Cristian saber "¿cuánto dinero entra automáticamente cada mes sin vender nada nuevo?" — métrica crítica para decisiones de contratación.

**Duración estimada:** 1.5 semanas (5-8 días).

**Pre-requisitos:**
- Fase 2 completada (clientes con retainers ya están identificados desde Zoho).
- Confirmación de pregunta 2 (matriz billing por servicio) y pregunta 4 (manual vs Stripe).

**Entregables:**

1. **Migraciones SQL:**
   - `activate_maintenance_retainers_constraints.sql` — la tabla `maintenance_retainers` ya existe; solo agregar FK/index/RLS si faltan.
   - `add_subscriptions_table.sql` — nueva tabla `subscriptions` para retainers no-maintenance (SEO, ads, social media). Schema: `id`, `org_id`, `deal_id`, `service_type`, `monthly_amount`, `billing_day`, `start_date`, `end_date`, `active`, `auto_generate_payment` boolean, `notes`, audit.
   - `subscription_generates_payments_function.sql` — Postgres function `generate_pending_payments_for_period(month, year)` que crea filas en `deal_client_payments` con `status='pending'` para cada subscription/retainer activo.

2. **Archivos de código a crear/modificar:**
   - `src/lbs/projects/tabs/ProjectFinancialsTab.tsx` (modify) — sección "Subscriptions & Retainers" con add/edit/pause/end.
   - `src/lbs/dashboard/MRRWidget.tsx` (new) — widget de MRR para dashboard.
   - `src/lbs/dashboard/RecurringRevenueChart.tsx` (new) — gráfico de evolución MRR.
   - `src/lbs/admin/PendingPaymentsReviewPage.tsx` (new) — UI para confirmar/marcar pagos pendientes como cobrados.

3. **UI nueva:**
   - Subscriptions list por deal: monto, billing day, status, próxima fecha de cobro.
   - Dashboard widget: "MRR actual: $X" con delta vs mes anterior.
   - Sidebar nueva entrada "Recurring revenue" (admin-only).

4. **Edge functions:**
   - `supabase/functions/generate_recurring_payments/index.ts` — corre 1 vez por día via Vercel cron, ejecuta la function `generate_pending_payments_for_period()` para el día de hoy.
   - `api/cron/generate-recurring-payments.ts` — Vercel cron que llama al edge function diariamente.

5. **Tests:**
   - Crear subscription `monthly_amount=100, billing_day=15` → al día 15 del mes siguiente verificar que se creó payment con `status='pending'`.
   - Pausar subscription → verificar que no se generan nuevos pagos.
   - End subscription → verificar que no se genera pago del siguiente mes.

6. **Documentación:**
   - Sección en `AGENTS.md` sobre subscriptions y MRR.

**Criterios de aceptación:**
- Cristian puede activar un retainer mensual en un deal en <30 segundos.
- Cada mes (el día configurado) se generan automáticamente los pagos esperados.
- Dashboard muestra MRR actual + historial 12 meses.
- Al pausar/terminar retainer, no se generan más pagos.

**Riesgos identificados:**
- **Riesgo:** Cron se ejecuta 2 veces el mismo día → pagos duplicados. → **Mitigación:** Lock por mes/año en la function + idempotency key.
- **Riesgo:** Cristian confunde "pago planeado" con "pago recibido". → **Mitigación:** UI distingue claramente `pending` (planeado) vs `cleared` (recibido).
- **Riesgo:** Retainer cambia de monto a mitad del mes. → **Mitigación:** Cambio aplica al siguiente ciclo; mes actual queda intacto.

**Checkpoint con Cristian (fin de Fase 3):**
1. Activar 3 retainers reales (los más obvios después del backfill).
2. Mostrar MRR widget en dashboard.
3. Esperar 1-2 días y verificar que el cron genera pagos pendientes correctamente.

---

### Fase 4 — Equipo, comisiones y multi-pipeline (1.5 semanas)

**Objetivo de negocio:**
Permitir que LBS escale a 3+ vendedores sin caos: cada vendedor ve sus deals, comisiones se calculan solas al cerrar deal, y leads se asignan a vendedor automáticamente. Diana (sales_manager) tiene visibilidad de equipo.

**Duración estimada:** 1.5 semanas (5-8 días).

**Pre-requisitos:**
- Fase 1 completada (lead → deal conectado).
- Respuestas a preguntas 8, 9, 10 (vertical vs generalista, comisión fija vs variable, scoping).

**Entregables:**

1. **Migraciones SQL:**
   - `add_deals_scoped_rls_policies.sql` — RLS adicional en `deals`: SELECT permitido si `organization_member_id = current_user_member_id()` OR `current_user_member_id() = ANY(salesperson_ids)` OR admin/sales_manager.
   - `auto_assign_salesperson_to_lead_trigger.sql` — trigger AFTER INSERT en `contacts` (status='lead') que asigna round-robin entre vendedores activos.
   - `add_lead_assignment_config.sql` — tabla `org_lead_assignment_config` con strategy enum (`round_robin`, `manual`, `least_loaded`).
   - `link_org_members_to_people_salespersons.sql` — script idempotente que para cada `organization_member` con role='sales_*' crea/linkea un `people` row con `type='salesperson'` (necesario para que el sistema de comisiones existente funcione).

2. **Archivos de código a crear/modificar:**
   - `src/lbs/leads/LeadCreatePage.tsx` (modify) — defaulta el `organization_member_id` al round-robin si setting está en `round_robin`.
   - `src/lbs/admin/SalesTeamSettingsPage.tsx` (new) — config de strategy de assignment + comisión % por vendedor opcional.
   - `src/lbs/deals/DealList.tsx` (modify) — filtro "Mine" / "All" (admin solo).
   - `src/lbs/leads/LeadsListPage.tsx` (modify) — mismo filtro.
   - `src/lbs/dashboard/SalesLeaderboard.tsx` (new) — widget admin-only con ranking de vendedores por revenue y comisión devengada.
   - `src/lbs/deals/ConvertDealToWonAction.tsx` (modify) — ya llama internamente a `ensureCommissionsForWonDeal`, solo confirmar wiring.

3. **UI nueva:**
   - Settings → "Sales team" con strategy + % comisión.
   - Sidebar: vendedor común solo ve "My deals" / "My leads"; admin/sales_manager ve "All".
   - Dashboard: leaderboard (admin-only).

4. **Edge functions:**
   - Ninguna nueva. `ensureCommissionsForWonDeal` ya es client-side; sigue siendo client-side.

5. **Tests:**
   - Crear lead → verificar que se asigna al vendedor con menos load.
   - Vendedor A no debe ver deals de Vendedor B (excepto admin/sales_manager).
   - Mover deal a `won` → verificar que se crea `deal_commissions` automáticamente con 5% para el salesperson.
   - Cambiar % comisión en settings → verificar que aplica a nuevos won deals.

6. **Documentación:**
   - `docs/SALES_TEAM_GUIDE.md` para Cristian (cómo configurar nuevos vendedores).

**Criterios de aceptación:**
- Diana ve todos los deals (sales_manager).
- Cristian agrega "Juan" como nuevo vendedor → automáticamente recibe el siguiente lead vía round-robin.
- Juan solo ve sus leads/deals.
- Al pasar deal a won, comisión 5% se crea automáticamente.
- Cristian puede ajustar % comisión global o por vendedor.

**Riesgos identificados:**
- **Riesgo:** RLS muy restrictiva rompe vistas existentes (e.g. `deal_activity_unified`). → **Mitigación:** Vistas se ejecutan con security_invoker; aplican RLS del caller. Testear con cada rol.
- **Riesgo:** Round-robin asigna lead a vendedor en vacaciones / disabled. → **Mitigación:** Filtrar por `disabled=false` y por horario activo (reusar `member_sales_windows` del Anti-Olvido).
- **Riesgo:** Vendedor que se va a la competencia se lleva visibilidad de su pipeline. → **Mitigación:** Admin puede reasignar deals masivamente desde admin panel.

**Checkpoint con Cristian (fin de Fase 4):**
1. Simular agregar 1 vendedor nuevo → recibir leads → cerrar deal → ver comisión.
2. Diana ve dashboard de equipo.
3. Validar que % de comisión es correcto y que basis (payments_collected vs amount) hace sentido para LBS.

---

### Fase 5 — Anti-Olvido extendido a deals (1 semana)

**Objetivo de negocio:**
Que el sistema también vigile **deals estancados**, no solo leads. Hoy una proposal puede quedarse 30 días sin respuesta y nadie se da cuenta. Esta fase aplica los principios del Anti-Olvido al pipeline de ventas y delivery, evitando deals "abandonados".

**Duración estimada:** 1 semana (3-5 días).

**Pre-requisitos:**
- Fases 1, 3 y 4 completadas (deals + retainers + equipo deben estar funcionando).
- Respuestas a preguntas 11 y 12.

**Entregables:**

1. **Migraciones SQL:**
   - `add_org_deal_stage_config.sql` — tabla análoga a `org_lead_stage_config` con SLA por stage de deal.
   - `add_deal_attention_columns.sql` — `deals.last_activity_at`, `deals.next_activity_due_at`, `deals.snooze_until` en `deals`.
   - `compute_next_activity_due_function.sql` — Postgres function análoga a `compute_next_followup` pero para deals.
   - `handle_deal_activity_trigger.sql` — trigger en `conversation_messages`, `tasks`, `deal_notes` que cuando se crea actividad relacionada a un deal actualiza `deals.last_activity_at`.
   - `get_deals_requiring_attention_rpc.sql` — RPC análoga a `get_leads_requiring_attention`.

2. **Archivos de código a crear:**
   - `src/lbs/deals/DealsAttentionPage.tsx` — UI dedicada al pipeline en riesgo.
   - `src/lbs/deals/DealsDebtBanner.tsx` — banner rojo con count de deals atrasados.
   - `src/lbs/deals/SnoozeDealDialog.tsx` — análogo a `SnoozeLeadDialog`.
   - `src/lbs/dashboard/DashboardDealsAttentionCard.tsx` — widget en dashboard.

3. **UI nueva:**
   - Vista `/deals/attention` con deals atrasados ordenados por urgencia.
   - Banner en dashboard si hay deals atrasados.
   - Settings → "Deal SLAs" para que admin configure horas por stage.

4. **Edge functions:**
   - `supabase/functions/enforce_deal_attention/index.ts` (new) — análogo a `enforce_lead_attention`, corre cada 15min, envía push/SMS/WhatsApp.
   - O alternativa más simple: extender `enforce_lead_attention/index.ts` para que también procese deals (1 cron, 2 sources).

5. **Tests:**
   - Crear deal en `proposal_sent`, retroceder `last_activity_at` 8 días → verificar que aparece en attention.
   - Snooze deal 24h → verificar que sale del radar.
   - Marcar actividad → verificar que `last_activity_at` actualiza y deal sale del radar.

6. **Documentación:**
   - Actualizar `LEAD_ATTENTION_DEPLOYMENT.md` con nueva sección "Deal attention".

**Criterios de aceptación:**
- Deals en stage proposal_sent sin actividad >5 días disparan alerta.
- Deals en delivery sin commit/task done >21 días disparan alerta.
- Cristian puede ajustar SLAs por stage desde settings.
- Snooze funciona igual que en leads.

**Riesgos identificados:**
- **Riesgo:** Doble notificación (lead Anti-Olvido + deal Anti-Olvido para el mismo cliente). → **Mitigación:** Dedupe por `contact_id` en el push handler.
- **Riesgo:** Sistema dispara demasiadas alertas y el usuario se desensibiliza. → **Mitigación:** SLAs default conservadores (5/7/21/30 días por stage); Cristian ajusta.

**Checkpoint con Cristian (fin de Fase 5):**
1. Crear 3 deals con SLAs vencidos artificialmente → ver alertas reales.
2. Validar que push/SMS llegan correctamente.
3. Ajustar SLAs si los defaults no encajan con el ritmo del negocio.

---

## Parte 3 — Timeline integrado

Asumiendo dev de 1 persona dedicado tiempo completo, sin imprevistos:

| Semana | Actividad | Entregable / Checkpoint |
|---|---|---|
| **1** | Fase 1 dev (días 1-5) | Lead→Deal autoflow + UI deals tabs |
| **2** | Fase 1 QA + deploy (días 1-2) + Checkpoint Cristian + Fase 2 prep (días 3-5: Cristian exporta Zoho CSV, dev revisa schema) | Fase 1 en prod + CSV Zoho recibidos |
| **3** | Fase 2 dev — schema staging, scripts load, validación | UI `/admin/zoho-import` funcional con CSVs cargados |
| **4** | Fase 2 dev — matching, UI review, apply | Backfill ejecutado en sandbox |
| **5** | Fase 2 apply en prod + Checkpoint Cristian + Fase 3 prep | Backfill prod + Cristian valida |
| **6** | Fase 3 dev — subscriptions, MRR widget, cron | UI subscriptions + MRR widget |
| **7** | Fase 3 QA + deploy + Checkpoint Cristian + Fase 4 prep | Fase 3 en prod |
| **8** | Fase 4 dev — RLS scoped, round-robin, comisiones wired | Vendedores ven solo sus deals + comisiones auto |
| **9** | Fase 4 QA + deploy + Checkpoint Cristian + Fase 5 prep | Fase 4 en prod |
| **10** | Fase 5 dev — deal attention, SLAs, cron extendido | Deal attention page |
| **11** | Fase 5 QA + deploy + Checkpoint final | Sistema completo en prod |

**Total: 11 semanas con buffer.** Si todo va perfecto puede ser 9 semanas; si Zoho CSV está peor que esperado o si Cristian necesita iteraciones, hasta 13.

**Checkpoints obligatorios:** semanas 2, 5, 7, 9, 11. En cada uno Cristian valida y decide si seguir.

---

## Parte 4 — Plan específico para el backfill desde Zoho CSV (Fase 2)

### 4.1 Datos que necesitamos de Zoho

Cristian debe exportar de Zoho los siguientes CSVs (sin filtros, todo el módulo completo):

1. **`Deals.csv`** (módulo Deals/Potentials) — **OBLIGATORIO**
2. **`Contacts.csv`** (módulo Contacts) — **OBLIGATORIO**
3. **`Accounts.csv`** (módulo Accounts = companies) — **OBLIGATORIO**
4. **`Notes.csv`** (módulo Notes) — opcional, recomendado
5. **`Activities.csv`** (módulo Activities = tasks + calls + meetings) — opcional, recomendado
6. **`Products.csv`** o **`Quotes.csv`** si Cristian los usa — opcional

### 4.2 Estructura esperada por archivo

#### Deals.csv (columnas mínimas necesarias)

| Columna | Tipo | Ejemplo | Maps to |
|---|---|---|---|
| Deal ID | text | `12345` | `deals.imported_external_id` |
| Deal Name | text | "Website Megaforce" | `deals.name` |
| Amount | numeric | `1500.00` | `deals.amount` y `deals.original_project_value` |
| Stage | text | "Closed Won" | `deals.stage` (necesita mapping) |
| Closing Date | date | `2024-08-15` | `deals.expected_closing_date` o `deals.actual_completion_date` |
| Account Name | text | "Megaforce Inc" | match a `companies.name` |
| Contact Name | text | "John Smith" | match a `contacts` por nombre+company |
| Owner | text | "Diana Castro" | match a `organization_members` por nombre/email |
| Created Time | datetime | `2024-06-01 10:30:00` | `deals.created_at` |
| Modified Time | datetime | `2024-08-15 16:00:00` | `deals.updated_at` |
| Type | text | "New Business" / "Existing Business" | inferir `lifecycle_phase` |
| Lead Source | text | "Web", "Referral", etc. | mover a campo en deal o note |
| Description | text | freeform | `deals.description` |

#### Contacts.csv

| Columna | Maps to |
|---|---|
| Contact ID | `contacts.imported_external_id` |
| First Name / Last Name | `contacts.first_name` / `contacts.last_name` |
| Email | `contacts.email_jsonb` |
| Phone / Mobile | `contacts.phone_jsonb` |
| Account Name | match a `companies.name` |
| Owner | match a `organization_members` |
| Created Time | `contacts.first_seen` |
| Title | `contacts.title` |
| Lead Source | `contacts.lead_source` |

#### Accounts.csv

| Columna | Maps to |
|---|---|
| Account ID | `companies.imported_external_id` |
| Account Name | `companies.name` |
| Website | `companies.website` |
| Phone | `companies.phone_number` |
| Industry | `companies.sector` |
| Billing City/State/Country | `companies.city/state_abbr/country` |
| Owner | match a `organization_members` |
| Created Time | `companies.created_at` |

### 4.3 Proceso de import (3 sub-fases)

#### 4.3.A — Staging y validación (días 1-3)

1. Cristian sube los CSVs a una carpeta `data/zoho_export/` (gitignored).
2. Dev corre `npm run zoho:load` → poblar tablas `zoho_import_staging_*`.
3. Dev corre `npm run zoho:validate` → genera reporte HTML con:
   - Total filas por archivo
   - Duplicados detectados (por email, phone, name)
   - Emails inválidos (regex check)
   - Accounts sin contact (huérfanas)
   - Deals sin account (huérfanos)
   - Deals con stage que no mapea a ningún Nomi stage
   - Owners que no matchean ningún `organization_member`
4. Cristian revisa reporte. Si hay problemas → corrige CSV y vuelve a step 2.

#### 4.3.B — Matching con datos existentes (días 4-7)

Algoritmo de matching, en orden:

| Prioridad | Match by | Confidence | Action |
|---|---|---|---|
| 1 | Email exacto (lowercase) | 100% | Auto-merge |
| 2 | Phone exacto (normalized E.164) | 95% | Auto-merge |
| 3 | Account name exacto (lowercase, trim) | 90% | Auto-merge |
| 4 | Account name fuzzy (Levenshtein <0.85) | 60-85% | **Cristian aprueba en UI** |
| 5 | Contact name + same account | 80% | **Cristian aprueba en UI** |
| 6 | Sin match | — | Crear nuevo |

UI `/admin/zoho-import/matches`:
- Tabla con cada fila Zoho + candidato Nomi + score + buttons [Accept / Reject / Manual edit].
- Filtros por confidence y por tipo (contacts/accounts/deals).
- "Approve all >95%" para acelerar.

Reporte parcial: matches exactos / probables aprobados / nuevos a crear.

#### 4.3.C — Import final (días 8-10)

1. Cristian aprueba reporte final → "Apply import".
2. Dev corre `npm run zoho:apply` → transacción única que:
   - Inserta nuevos `companies` con `imported_from='zoho'`.
   - Inserta nuevos `contacts` con `imported_from='zoho'` y `status='client'` (si tiene deal asociado) o `status='lead'` (si solo tiene contacto sin deal).
   - Inserta `deals` con stage mapeado, `lifecycle_phase` calculado, FK correctos.
   - Inserta `proposals` shell por cada deal histórico para no romper FK constraint (`title='Imported from Zoho - {deal_name}'`, `status='accepted'`).
   - Preserva timestamps originales (`created_at`, `won_at`, etc.).
   - Si Zoho tenía Notes → inserta `deal_notes` por cada nota.
3. Reporte final automático: counts por tabla, sample de 10 registros.

### 4.4 Validación post-import

Reporte de auditoría que Cristian debe revisar antes de aprobar finalmente:

| Check | Esperado |
|---|---|
| Total companies importadas | ≈ count(Accounts.csv) - matched |
| Total contacts importados | ≈ count(Contacts.csv) - matched |
| Total deals importados | = count(Deals.csv) |
| Companies con 0 deals | Idealmente bajo (sospechoso si son clientes históricos sin deal) |
| Contacts con 0 deal y 0 company | 0 (todos deben pertenecer a algo) |
| Deals con FK inválida (contact_id huérfano) | 0 |
| Distribución de stages | Hace sentido con expectativa de Cristian |
| Revenue histórico total | Coincide ±5% con lo que Cristian recuerda |

Si pasa todos los checks → Cristian aprueba **Apply final**. Si no → rollback (`DELETE FROM ... WHERE imported_from='zoho'`) y vuelta a iterar.

---

## Parte 5 — Preguntas pendientes priorizadas para Cristian

Lista ordenada por urgencia (las primeras bloquean Fase 1).

### P0 — Bloquean Fase 1

1. **Pregunta 5**: ¿URLs unificadas (`/deals/:id` con tabs) o separadas (`/opportunities` vs `/projects`)? — Recomiendo A.
2. **Pregunta 6**: ¿Cada deal = 1 servicio o paquete multi-servicio? — Recomiendo 1 servicio.
3. **Pregunta 11**: ¿Anti-Olvido sigue vigilando cliente cerrado o sale? — Recomiendo A (sale completo, vigilancia retainer en Fase 5).

### P1 — Bloquean Fase 2

4. **Pregunta 3 ampliada**: Confirmar edición Zoho + estimación volumen deals + qué tiene en CSV.
5. **Pregunta 1**: Definición operativa de "cliente vivo" después del backfill — Recomiendo A (último pago en 12m).
6. **Pregunta 2**: Matriz de billing model por tipo de servicio (websites=30/40/30, SEO=retainer, ads=retainer+%, etc.).
7. **Pregunta 7**: Mapping de Zoho stages → Nomi `lifecycle_phase`+`stage` — Recomiendo tabla en respuesta P7.
8. **Pregunta 13**: ¿Purga leads paused antiguos? — Recomiendo Medio (purgar 177 con first_seen >6m).

### P2 — Bloquean Fase 3

9. **Pregunta 4**: ¿Automatización Stripe/ACH en Fase 3 o seguir manual? — Recomiendo manual ahora.

### P3 — Bloquean Fase 4

10. **Pregunta 8**: Vertical vs generalista para futuros vendedores — Recomiendo generalista.
11. **Pregunta 9**: ¿5% sigue siendo el número correcto? ¿Por servicio o por vendedor? — Recomiendo % fijo configurable.
12. **Pregunta 10**: Open / strict scoped / read all-edit own — Recomiendo strict scoped.

### P4 — Bloquean Fase 5

13. **Pregunta 12**: ¿Cron alerta deals proposal_sent >7 días? — Recomiendo sí, default 5 días.

### P5 — General

14. **Pregunta 14**: Tolerancia downtime — Confirmado: ninguno requerido.

---

## Parte 6 — Recomendación de orden de ejecución

El orden 1→2→3→4→5 propuesto en la auditoría **debe cambiar** a la luz de los hallazgos:

### Orden recomendado: **1 → 2 → 4 → 3 → 5**

**Razonamiento:**

1. **Fase 1 primero (como está).** Sin el auto-create deal al convertir lead, no podemos generar pipeline nuevo. Es el cimiento.

2. **Fase 2 después de Fase 1.** El backfill es **el cimiento de toda métrica**. Sin historial:
   - Fase 3 (MRR widget) mostraría números falsos (solo retainers nuevos).
   - Fase 4 (leaderboard de vendedores) no mostraría historial → no sirve para evaluar performance.
   - Fase 5 (deal attention) puede activarse sin backfill, pero sin contexto histórico el sistema no sabe qué es "normal" para LBS.

3. **Fase 4 antes que Fase 3.** Cambio vs el orden original. Razones:
   - Cristian ya tiene 2 personas (él + Diana) que necesitan ver pipelines separados. Si esperamos a Fase 4, los 2-3 meses de backfill+retainers tienen que mostrarse "para todos" y mezclan datos de quién hizo qué.
   - El sistema de comisiones ya existe (`dealCommissionAutomation.ts`), solo falta wiring de people-salesperson y RLS. Trabajo bajo.
   - El backfill (Fase 2) ya importa el `Owner` de Zoho → ese owner debe convertirse en `organization_member_id` correcto del deal. Si Fase 4 ya configuró people-salesperson, el match es directo. Si no, hay que volver a hacerlo.

4. **Fase 3 después de Fase 4.** El MRR ahora se calcula con vendedores ya asignados → leaderboard "MRR por vendedor" sale gratis.

5. **Fase 5 al final.** Anti-Olvido extendido a deals es valioso pero **no urgente** hasta que haya pipeline real activo (que llega después de Fases 1+2). Puede ir en paralelo con polish de Fases 3-4 si hay capacidad extra, o quedar como **opcional** si Cristian decide que el ROI no compensa.

### Visualización del orden recomendado:

```
Semana 1-2:  [Fase 1] Activación lead→deal
                ↓
Semana 3-5:  [Fase 2] Backfill Zoho CSV
                ↓
Semana 6-7:  [Fase 4] Equipo + comisiones + RLS scoped
                ↓
Semana 8-9:  [Fase 3] Subscriptions + MRR
                ↓
Semana 10-11: [Fase 5] Anti-Olvido deals (OPCIONAL)
```

### Caminos posibles para acelerar:

- **Paralelizar Fase 1 + prep de Fase 2.** Mientras dev hace Fase 1, Cristian exporta Zoho. Día 1 de Fase 2 = empezar a procesar staging.
- **Si Cristian descubre que Zoho no tiene la data esperada** (Fase 2 se vuelve más larga): hacer Fase 4 en paralelo con el matching manual de Fase 2.
- **Si recursos lo permiten**, Fase 5 puede ir en paralelo con Fase 3 (son independientes).

### Caminos posibles para reducir scope (si timeline aprieta):

- **Eliminar Fase 5** completamente → ahorro 1 semana, costo: deals estancados no se detectan automáticamente.
- **Diferir Fase 3** a un Q siguiente → ahorro 1.5 semanas, costo: MRR no visible, pero retainers se pueden gestionar manualmente.
- **Backfill mínimo en Fase 2** (solo Deals.csv sin Notes/Activities) → ahorro 4-5 días, costo: pierdes historial conversacional.

---

## Cierre

**Sumario:**
- **5 fases planificadas, ~11 semanas total con buffer.**
- **Orden ajustado**: 1 → 2 → 4 → 3 → 5 (no 1→2→3→4→5).
- **5 checkpoints obligatorios** con Cristian para validar y decidir continuar.
- **14 preguntas** organizadas por prioridad (P0-P5); las 8 P0+P1 deben resolverse antes de tocar código.
- **0 cambios destructivos** identificados.
- **Plan de backfill detallado** porque es el cimiento de todas las métricas downstream.

**Recomendación inmediata para Cristian:**
1. Responder en una sesión las 8 preguntas P0+P1 (≈30 min).
2. Iniciar export Zoho CSV en paralelo (puede tomar 1-2 días con cuenta de Zoho).
3. Confirmar arranque de Fase 1 → dev empieza.

**Pendiente del siguiente paso:** este documento es la última pieza de planning. Cuando Cristian dé luz verde, el siguiente prompt debe ser **"Inicia Fase 1"** + respuestas a P0/P1.

---

**Fin del Master Plan.** Documento generado sin ejecutar migraciones, sin modificar código existente, sin instalar paquetes.
