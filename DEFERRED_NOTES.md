# Deferred Notes — Fase 1 Deals + Anti-Olvido

Cosas que aparecieron durante la auditoría / diseño / implementación y se decidió
**no hacer ahora** para mantener el scope de Fase 1 manejable.

---

## A. Datos / Migraciones

### A.1 Backfill del CSV histórico de Zoho a `deals`
- **Scope:** ~1500 deals históricos del CSV exportado de Zoho deben cargarse para tener métricas de pipeline real.
- **Razón de diferir:** requiere mapeo cuidadoso de stages/usuarios/companies, y al menos un dry-run en un dataset reducido. Si lo hacemos a la vez que la activación, una caída del trigger en pleno backfill bloquea todo.
- **Plan sugerido:** Fase 2, posterior a 1 semana de "vuelo" del trigger en producción.
- **Mitigación temporal:** durante el backfill se hará `ALTER TABLE deals DISABLE TRIGGER trg_sync_deal_to_lead_stage` para evitar miles de UPDATEs a `contacts.lead_stage`.

### A.2 Backfill de `converted_from_contact_id` para deals existentes pre-Fase-1
- **Scope:** los 3 deals actuales en producción no tienen `converted_from_contact_id` poblado (la columna es nueva).
- **Razón de diferir:** ninguno fue creado vía `convertLeadToClient`. No hay relación lead→deal histórica que recuperar.
- **Plan:** dejar NULL. Si hace falta para análisis, se puede backfill manual con un script de matching por `contact_id`.

### A.3 Constraint check en `deals` para invariante `lifecycle_phase='closed' ↔ stage IN ('closed_won','closed_lost','delivered')`
- **Scope:** garantizar que estados terminales en `stage` siempre vengan acompañados de `lifecycle_phase='closed'`.
- **Razón de diferir:** los datos existentes probablemente violan la invariante (no se hizo backfill al introducir `lifecycle_phase`). Si añadimos un check constraint, podemos bloquear updates legítimos.
- **Plan:** primero un audit (`select stage, lifecycle_phase, count(*) from deals group by 1,2`), luego limpieza, luego constraint.

---

## B. Frontend / UX

### B.1 Default deal stage configurable por organización
- **Scope:** hoy hardcoded `stage='closed_won'`, `lifecycle_phase='closed'` para deals generados por conversión.
- **Razón de diferir:** YAGNI. LBS es la única org viva y este es el comportamiento deseado.
- **Plan:** si entra otra org con flujo distinto (e.g., conversión = oportunidad activa), exponer en `dealCategories` / config.

### B.2 UI inline para mover un deal entre `lifecycle_phase`
- **Scope:** drag-and-drop entre tabs "Sales Pipeline" / "Active Projects" / "Closed".
- **Razón de diferir:** hoy se hace vía edit del deal (`DealEdit`) — funcional pero no rápido. Mejora de UX, no de funcionalidad.
- **Plan:** Fase 3 (workflow polish).

### B.3 Toast / banner cuando el trigger mueve un lead fuera del Anti-Olvido
- **Scope:** cuando un deal cambia a `closed_won`, el lead/cliente sale del radar de Anti-Olvido silenciosamente. Sería útil un toast: "John Doe was removed from Anti-Olvido — deal closed".
- **Razón de diferir:** requiere infraestructura de notificación in-app que aún no existe.
- **Plan:** Fase 4 (cuando se haga la inbox/inbox unificada).

### B.4 Tab `Archived` con vista de solo lectura forzada
- **Scope:** hoy en tab "Archived" sigue activa la lógica de `LbsDealBoardContent` (drag para mover stages, edit). Idealmente archived = read-only.
- **Razón de diferir:** requiere agregar prop al board y propagar.
- **Plan:** si feedback negativo del usuario, agregar guard de "no mutar archivados desde aquí".

### B.5 Diseño responsivo del CTA "+ New deal" en mobile
- **Scope:** en pantallas chicas el botón aparece con texto. Probable que se desborde la action bar.
- **Razón de diferir:** baja prioridad — admin tool usado mayormente desktop.
- **Plan:** si feedback en mobile, usar `<Button size="icon">` con tooltip "New deal" en breakpoints `< md`.

### B.6 "Recently converted" indicator en el cliente
- **Scope:** cuando un cliente fue creado por conversión, mostrar un badge "Converted from lead on 2026-05-25 by @cristian".
- **Razón de diferir:** la info ya está en BD (`deals.converted_from_contact_id`, `contacts.created_at`), pero la UI es scope adicional.
- **Plan:** Fase 2 cuando se haga el rediseño del header del cliente.

---

## C. Backend / Infra

### C.1 Edge function `convert_lead_to_client`
- **Scope:** mover la lógica de `convertLeadToClient` del dataProvider del frontend a una edge function.
- **Razón de diferir:** funciona bien client-side hoy. Hacerlo server-side da más control transaccional pero agrega round-trip.
- **Plan:** si en el futuro queremos llamarlo desde otros frontends (mobile app, webhook), promover.

### C.2 Idempotencia más estricta del trigger
- **Scope:** hoy el trigger usa `is distinct from` para guard, lo cual es suficiente. Pero un INSERT batch enorme (10k deals con `contact_id`) ejecutaría 10k UPDATEs a `contacts`.
- **Razón de diferir:** no hay batches grandes en horizon próximo. El backfill (A.1) bypasses el trigger con DISABLE.
- **Plan:** si en el futuro se hacen imports masivos sin disable, mover a un trigger de statement-level con un `WITH ... INSERT INTO contacts ... SELECT ...` agregado.

### C.3 Webhook / outbound notification cuando se crea un deal desde conversión
- **Scope:** notificar a Slack / email cuando alguien convierte un lead.
- **Razón de diferir:** mensaje de Slack genérico ya cubre creaciones de deals si está configurado a nivel BD (no lo está).
- **Plan:** Fase 5 (alertas + workflows).

### C.4 Auditoría: tabla `deal_events` o `deal_audit_log`
- **Scope:** registrar cada cambio de stage de un deal con `who/when/from/to/reason`.
- **Razón de diferir:** Supabase Logs ya captura las queries. Una tabla dedicada es scope adicional.
- **Plan:** Fase 3 si surge necesidad de timeline visual.

---

## D. Métricas / Reporting

### D.1 Dashboard "Sales pipeline overview"
- **Scope:** widget en `/` con `deals_in_sales`, `deals_in_delivery`, `total_pipeline_value`, `won_this_month`.
- **Razón de diferir:** requiere queries agregadas (DBT-style) o RPC. Fuera de scope de Fase 1.
- **Plan:** Fase 2.

### D.2 Conversion rate report
- **Scope:** % de leads que se convierten a clientes, segmentado por `lead_source` / `interested_service` / mes.
- **Razón de diferir:** requiere haber acumulado suficiente data (mínimo 1 mes).
- **Plan:** Fase 4.

### D.3 Deal velocity (tiempo promedio entre stages)
- **Scope:** cuánto tarda un deal en promedio en `discovery → proposal_sent → closed_won`.
- **Razón de diferir:** requiere implementar D.4 (registro de transiciones) o aceptar imprecisión usando `updated_at` snapshots.
- **Plan:** Fase 4.

---

## E. Permisos / Seguridad

### E.1 RLS para `deals.converted_from_contact_id`
- **Scope:** asegurar que solo usuarios con acceso al contacto vean la FK.
- **Razón de diferir:** RLS actual de `deals` ya cubre visibilidad. La columna nueva hereda esas reglas.
- **Plan:** si surge un caso de leak (poco probable), restringir SELECT.

### E.2 Endpoint "delegar deal a contractor" expuesto al trigger
- **Scope:** cuando se delega, el `organization_member_id` cambia. ¿El trigger debe disparar?
- **Razón de diferir:** el trigger solo se dispara con cambios de `stage`. Cambios de `organization_member_id` no lo activan. Comportamiento correcto.
- **Plan:** no action.

---

## F. Tests / QA

### F.1 Tests automáticos (vitest) para `convertLeadToClient`
- **Scope:** unit tests de la función con casos: `createDeal=true` con info, `createDeal=true` sin info, `createDeal=false`, lead sin company existente, lead con company existente.
- **Razón de diferir:** el repo no tiene infraestructura de tests del dataProvider (mocking de Supabase).
- **Plan:** si se establece esa infra, agregar test suite.

### F.2 E2E test (Playwright) del flow de conversión
- **Scope:** simular click "Convert", llenar dialog, verificar redirect y data en BD.
- **Razón de diferir:** no hay Playwright en el repo.
- **Plan:** futuro hardening.

### F.3 Test de carga del trigger con 1000 inserts simultáneos
- **Scope:** validar que el trigger no degrada performance en imports grandes.
- **Razón de diferir:** ver C.2. No hay batches grandes próximos.
- **Plan:** parte del A.1 (cuando se haga el backfill, medir y mitigar).

---

## G. Documentación

### G.1 Diagrama actualizado de `Lead → Client → Deal → Project`
- **Scope:** un diagrama mermaid en `SYSTEM_AUDIT.md` que refleje el nuevo flujo con `converted_from_contact_id` y el trigger.
- **Razón de diferir:** el doc `AUDIT_DEALS_INTEGRATION.md` ya documenta el estado pre-Fase-1.
- **Plan:** al cerrar Fase 2 actualizar el system audit master.

### G.2 Tutorial para usuarios "Cómo convertir un lead correctamente"
- **Scope:** guía con screenshots para el equipo de ventas.
- **Razón de diferir:** la UI está documentada implícitamente en el flow (intuitivo).
- **Plan:** si llegan preguntas repetidas, hacer un doc en Notion / Loom.
