# Web Forms Rebuild — Auditoría de verificación (Partes A–G)

**Fecha:** 22 de mayo de 2026  
**Commit HEAD (git):** `85238721fe91a4a2f920c591304696c20d828a73` (`feat(forms): auto-create contact, lead, and task on form submission`)  
**Estado del working tree:** Parte G implementada pero **sin commitear** (~40 archivos modificados/eliminados, incl. submissions dashboard, analytics, eliminación legacy local)  
**Herramientas:** inspección de código, `git log`, `make typecheck`, `make build`, `make lint`, Supabase MCP (`execute_sql`, `list_edge_functions`, `list_migrations`)  
**Documentos guía encontrados en repo:** solo `WEB_FORMS_AUDIT.md`. No existen en el repo: `WEB_FORMS_FULL_REBUILD_PROMPT.md`, `WEB_FORMS_PART_B_PROMPT.md`, `NOTIFICATION_PHONE_HOTFIX_PROMPT.md`, `WEB_FORMS_PARTS_C_TO_G_PROMPT.md`. La verificación se basó en el checklist del usuario, el código y el historial git.

---

## 1. Resumen ejecutivo

El rebuild de Web Forms está **funcionalmente muy avanzado** en las Partes A–F (commiteadas y desplegadas en su mayoría), con arquitectura v2 sólida: tablas nuevas, plantillas system, builder visual, renderer público, tokens firmados, anti-spam, SMS al equipo, brief integrado y distribución (QR, short URLs, embed). La **Parte G existe en el working tree** (lista/detalle de submissions, export, analytics, `record_form_event`), pero **no está commiteada ni integrada en un release taggeado**, y la eliminación legacy local **no está reflejada en producción** (edge functions viejas siguen ACTIVE en Supabase).

De ~145 ítems del checklist: **~98 ✅ (~68%)**, **~32 ⚠️ (~22%)**, **~15 ❌ (~10%)**. El núcleo del producto (crear form → compartir → llenar → submit → SMS → brief) está operativo. Los huecos más importantes son: **Parte G sin commit**, **legacy aún deployado en remoto**, **SendFormButton ausente en conversaciones Messages**, **filtros incompletos en `/forms-v2`**, **`briefFormSentStorage.ts` huérfano**, **analytics sin datos en prod** (`form_submission_events` count = 0), y **regresión potencial** al eliminar rutas slug `website-intake` / `project-resources` sin migrar esos flujos a tokens v2.

**Regresiones vecinas:** no se detectaron roturas de compilación en Messages/Projects/Contacts; cambios en tabs de client/deals apuntan correctamente a `form_submissions_v2` (en working tree). **Lint falla** por Prettier en ~58 archivos (deuda de formato, no solo forms).

**Recomendación:** **no dar por terminado al 100%** hasta: (1) commitear y revisar Parte G, (2) undeploy/eliminar edge legacy en Supabase, (3) cerrar gaps F/G (Send form en Messages thread, filtros listado), (4) borrar código muerto (`briefFormSentStorage`), (5) smoke test manual de los 15 flujos del spec.

---

## 2. Verificación parte por parte

Leyenda: ✅ implementado y verificado (código + BD/build) · ⚠️ parcial o sin verificación runtime completa · ❌ falta o incorrecto

### 2.1 Parte A — Arquitectura nueva

#### Schema BD

| Ítem | Estado | Nota |
|------|--------|------|
| Tabla `form_templates` | ✅ | Migración `20260701180000_forms_v2_architecture.sql`; prod aplicada como `20260525014244` |
| Tabla `form_instances` | ✅ | Columnas spec + extras (`custom_*`, `task_*`) vía migraciones posteriores |
| Tabla `form_submissions_v2` | ✅ | Status check, metadata, FKs |
| Tabla `form_submission_events` | ✅ | Event types según spec |
| Tabla `public_form_tokens` | ✅ | + `short_code`, `is_preview` en migraciones/deploy |
| Índices spec | ✅ | `idx_form_instances_org_slug`, submissions, events, tokens |
| RLS policies | ⚠️ | Policies presentes; `form_submissions_v2_update` **sin `WITH CHECK`** (riesgo de reassign cross-org si columna mutable) — `20260701180000:205-210` |
| Triggers org_id | ✅ | `set_form_instance_defaults`, `set_form_template_org_id` |

#### Plantillas system

| Ítem | Estado | Nota |
|------|--------|------|
| 7 plantillas system | ✅ | SQL prod: `SELECT COUNT(*) FROM form_templates WHERE is_system = true` → **7** |
| `is_system = true` | ✅ | |
| Schema JSON válido | ✅ | Refinadas en `20260703120000_refine_system_form_templates.sql` |
| 7 instances por org | ✅ | Prod: 5 orgs × 7 = **35** instances |

#### Migración de data

| Ítem | Estado | Nota |
|------|--------|------|
| Deals con `website_brief` → `form_submissions_v2` | ✅ | Prod: **3** submissions con `deal_id` (esperado 3) |
| Sin pérdida de data | ⚠️ | Count coincide; no se comparó contenido JSON campo a campo |

#### Edge functions

| Ítem | Estado | Nota |
|------|--------|------|
| `submit_form_v2` | ✅ | ACTIVE v6 en prod |
| `get_form_by_token` | ✅ | ACTIVE v3 |
| `generate_form_token` | ✅ | ACTIVE v4 |
| Honeypot | ✅ | `submit_form_v2/index.ts:45-47` — retorna `{ok:true}` sin insert |
| reCAPTCHA | ⚠️ | Código presente; `RECAPTCHA_SECRET_KEY` en secrets **no verificable** desde repo; `.env.development` tiene site key |
| Rate limit IP | ✅ | Ventana 1h, evento `rate_limited` |
| Insert verifica error | ✅ | Checks explícitos post-insert en submit path |

#### Brief end-to-end

| Ítem | Estado | Nota |
|------|--------|------|
| `WebsiteBriefTab` lee `form_submissions_v2` | ✅ | `WebsiteBriefTab.tsx:72-92` + tokens |
| `SendProjectWebFormDialog` genera token | ✅ | Usa `generateFormToken` v2 |
| Submit actualiza `deals.website_brief` Y submissions | ✅ | `submit_form_v2/index.ts:257-268` |
| `briefFormSentStorage` eliminado | ❌ | Archivo **sigue existiendo** `src/lbs/deals/briefFormSentStorage.ts` — **0 imports** |

#### SMS notification

| Ítem | Estado | Nota |
|------|--------|------|
| `notifyFormSubmission.ts` | ✅ | `supabase/functions/_shared/notifyFormSubmission.ts` |
| Orden phone: notification → auth → metadata | ✅ | `resolveMemberPhone:38-60` |
| Twilio | ⚠️ | Integración presente; envío real no probado en esta auditoría |

#### Test SQL Parte A

```sql
-- Ejecutado vía Supabase MCP (prod)
form_templates is_system = 7
form_instances = 35 (7 por org × 5 orgs)
form_submissions_v2 = 3 (deal_id NOT NULL = 3)
public_form_tokens = 9 (preview = 3)
form_submission_events = 0
```

---

### 2.2 Parte B — Form Builder visual

| Ítem | Estado | Nota |
|------|--------|------|
| Ruta `/forms-v2` | ✅ | `LbsCustomRoutes.tsx:238-244` |
| Lista con columnas | ✅ | Name, type, submissions, last, active, actions |
| Filtros tipo/status | ❌ | Solo **search por nombre** — `FormsListPage.tsx:92-96` |
| Botón "+ New form" | ✅ | |
| Sidebar "Forms" → `/forms-v2` | ✅ | `navigation.ts:120-123` |
| Dialog 7 plantillas + Blank | ✅ | `TEMPLATE_OPTIONS` incluye `blank` — `formBuilderConstants.ts:75-80` |
| Ruta `/forms-v2/:id/edit` | ✅ | |
| Layout 3 columnas desktop | ✅ | `FormBuilderWorkspace.tsx` |
| Tabs mobile | ✅ | Fields / Canvas / Settings — `:116-122` |
| Palette 14 tipos | ⚠️ | **16 inputs + 3 layout** (section, heading, divider); spec pedía 14 field types |
| @dnd-kit | ✅ | Instalado y usado |
| Drag palette → canvas | ✅ | |
| Reordenar en section | ✅ | |
| Drag cross-section | ✅ | `FormBuilderWorkspace.tsx:106-106` |
| Keyboard drag | ⚠️ | `KeyboardSensor` registrado; sin coords custom — accesibilidad básica |
| Click field → settings | ✅ | |
| Label → preview | ✅ | |
| Auto-save 3s | ✅ | `FormBuilderContext.tsx:122-131` |
| Cmd+S | ✅ | `:133-142` |
| Toast al guardar | ✅ | |
| 14 tipos individuales | ✅ | Todos renderizados en `FormFieldRenderer` / `FieldPreview` |
| Section divider | ✅ | Tipo `divider` en palette layout |
| Settings 7 tabs | ⚠️ | **8 tabs** (añadido **Versions**): `FormSettingsSheet.tsx:212-221` |
| Tab Branding upload | ✅ | Parte E — no placeholder |
| Tab Distribution embed | ✅ | Snippet funcional v2 |
| Preview token 1h / max 1 | ✅ | `generate_form_token/index.ts:76-91` |
| Preview no persiste | ✅ | `submit_form_v2/index.ts:64-82` |
| Org defaults notify | ✅ | Migración `org_default_form_notify_members` + UI Settings |

---

### 2.3 Hotfix notification_phone

| Ítem | Estado | Nota |
|------|--------|------|
| Columna `notification_phone` | ✅ | Prod confirmado |
| Constraint E.164 | ✅ | `notification_phone_format` CHECK en prod |
| Índice parcial org | ⚠️ | No re-verificado índice por nombre; columna OK |
| Helper orden correcto | ✅ | Post-fix commit `2e395b3` |
| UI `/profile` | ✅ | `ProfileNotificationsSection.tsx:31-44` |
| UI Settings status visual | ✅ | `FormNotificationsSection.tsx`, `MemberPhoneStatus.tsx` |
| `submit_form_v2` redeploy | ✅ | v6 ACTIVE |

---

### 2.4 Parte C — Plantillas + versionado

| Ítem | Estado | Nota |
|------|--------|------|
| Project Brief refinado | ✅ | Migración refine — secciones condicionales |
| Contact / Lead / Quote / NPS / Job refinados | ✅ | |
| Generic Survey simple | ✅ | Explícitamente unchanged en migration |
| Duplicate as custom | ✅ | `FormsListPage.tsx:134-156,289-296` |
| `form_instance_versions` + RLS | ✅ | Migración `20260703120100` |
| Trigger archive | ✅ | |
| UI tab Versions | ✅ | `FormVersionsTab.tsx` |
| Diff / restore | ✅ | |

---

### 2.5 Parte D — Conditional + wizard + formulas

| Ítem | Estado | Nota |
|------|--------|------|
| `visible_when` fields/sections | ✅ | |
| Operadores spec | ✅ | 12 ops en `conditionalLogic.ts` |
| AND/OR compuestos | ✅ | |
| UI builder | ✅ | `ConditionalLogicEditor.tsx` |
| Public renderer eval | ✅ | |
| Edge no valida hidden required | ✅ | `formV2Schema.ts` + conditional mirror |
| Wizard multi-step | ✅ | |
| Toggle wizard mode | ✅ | Settings Advanced |
| Stepper + progress | ✅ | |
| Previous/Next + validación | ✅ | |
| localStorage recovery | ✅ | Banner Continue/Start over |
| mathjs + formula type | ✅ | |
| Real-time update | ✅ | |

---

### 2.6 Parte E — Branding + embed + QR + short URLs

| Ítem | Estado | Nota |
|------|--------|------|
| Bucket `form-branding` | ✅ | Prod: bucket public=true |
| Storage policies | ⚠️ | Bucket existe; policies no auditadas línea a línea |
| `FormImageUpload` | ✅ | |
| Logo/background en renderer | ✅ | |
| `custom_font_url`, `custom_css` | ✅ | Columnas en prod |
| CSS sanitizado | ✅ | `sanitizeCustomCss.ts` — no omitido |
| QR PNG download | ✅ | `FormQRCode.tsx` + `qrcode` npm |
| `short_code` | ✅ | Columna + generator |
| `/f/:shortCode` | ✅ | `ShortUrlRedirect.tsx` |
| `resolve_short_code` | ✅ | ACTIVE v1 prod |
| `forms_embed_js` | ✅ | ACTIVE v1 prod |
| Embed `?embed=1` + postMessage | ✅ | `PublicFormEmbedProvider.tsx` |

---

### 2.7 Parte F — Send form everywhere

| Ítem | Estado | Nota |
|------|--------|------|
| `SendFormButton.tsx` | ✅ | |
| Contextos contact/company/deal/lead | ✅ | Tipos en `sendFormTypes.ts` |
| Contexto **conversation** | ⚠️ | Tipo definido; **no hay botón en UI de Messages/conversation thread** |
| Variantes button/icon/menu-item | ⚠️ | Solo variant `button` usada en headers |
| `SendFormDialog` | ✅ | Form picker, expiry, max uses, message |
| 3 métodos Email/SMS/Copy | ✅ | |
| Contact header | ✅ | `ContactHeader.tsx:146` |
| Client/Company header | ✅ | `ClientProfileHeader.tsx:211` |
| Project/Deal header | ✅ | `ProjectShowPage.tsx:275` |
| Lead show | ✅ | Vía `LeadShowPage` → `ContactHeader` |
| Slash `/form` SMS composer | ✅ | `ClientSmsComposer.tsx:108,293` |
| Forms list row SendForm | ❌ | Row tiene Copy link, no `SendFormButton` |
| SMS → conversation_messages | ✅ | `SendFormDialog.tsx:160-165` via `useSendClientSms` |
| Auto-create contact/lead/task | ✅ | `formV2PostSubmit.ts` |
| Task assignee + title template | ✅ | Migración + UI Integrations |

---

### 2.8 Parte G — Dashboard + analytics + legacy

**Nota:** código verificado en **working tree** (uncommitted). Deploy parcial: `record_form_event` ACTIVE; frontend G no en commit HEAD.

| Ítem | Estado | Nota |
|------|--------|------|
| `/forms-v2/submissions` | ✅ | `SubmissionsListPage.tsx` (working tree) |
| Filtros spec | ⚠️ | Form multi, status, dates, contact/deal, UTM, submitter — **falta filtro UTM en source_url** (solo `utm_source@ilike`) |
| Tabla + bulk actions | ✅ | reviewed/spam/delete/export |
| `/forms-v2/submissions/:id` | ✅ | `SubmissionDetailPage.tsx` |
| 3 columnas metadata/answers/timeline | ✅ | |
| Answers schema-aware | ✅ | `submissionAnswerRenderer.tsx` |
| Activity timeline | ⚠️ | Query heurística por IP/window; eventos pre-submit sin session id |
| Status workflow | ⚠️ | Select funciona; **`reviewed_by_member_id` no se setea** — `SubmissionDetailPage.tsx:95-108` |
| Create contact / Reply SMS/email | ✅ | |
| Create deal | ❌ | No implementado en detail actions |
| Export CSV/Excel/PDF | ✅ | `xlsx`, `jspdf` instalados |
| `/forms-v2/:id/analytics` | ✅ | `FormAnalyticsPage.tsx` |
| Métricas cards | ✅ | |
| Drop-off por field | ✅ | |
| Charts **recharts** | ❌ → ⚠️ | Usa **`@nivo/bar`** (decisión unilateral) |
| Pie chart by source | ❌ | Tabla top sources, no pie |
| Submissions over time | ✅ | Bar chart nivo |
| Event `viewed` | ✅ | `get_form_by_token` insert — no duplicado en frontend |
| Event `started` | ✅ | `useFormEventRecorder.ts` |
| Event `field_completed` | ⚠️ | On **change**, no onBlur como spec |
| Event `field_focused` | ❌ | En edge ALLOW list pero **no emitido** desde frontend |
| Event `abandoned` | ⚠️ | `useEffect` cleanup — **poco confiable** en tab close |
| Event `submitted` | ✅ | Edge `submit_form_v2` insert |
| `record_form_event` deploy | ✅ | ACTIVE v1 prod |
| Legacy `web-forms/` eliminado | ⚠️ | **Local sí** (git delete); **prod edge legacy ACTIVE** |
| Edge legacy eliminadas remoto | ❌ | `submit_public_form`, `get_public_form`, `process_website_intake`, `submit_project_resources` **ACTIVE** |
| `briefFormSentStorage` eliminado | ❌ | Archivo huérfano persiste |
| `intakeMapping.ts` eliminado | ✅ | Borrado con web-forms (local) |
| Routes sin `/web-forms` | ⚠️ | Redirect a `/forms-v2` (local); prod frontend depende de deploy |
| Sin imports rotos | ✅ | `make typecheck` + `make build` OK en working tree |

---

## 3. Análisis de commits

**Rango rebuild:** `675365a` … `8523872` = **41 commits** (Partes A–F commiteadas).

| Parte | Commits aprox. | Notas |
|-------|----------------|-------|
| A | 9 | Arquitectura, seed, migrate, 3 edge fn, brief, renderer, SMS |
| B | 15 | Builder, dnd-kit, settings, preview, validation, list |
| Hotfix phone | 4 | Columna, helper, profile, settings UI |
| C | 3 | Clone template, routing fix, settings fix (template migration bundled) |
| D | 3 | Conditional, formula, wizard |
| E | 5 | Branding, fonts/css, QR, short URL, embed |
| F | 2 | SendForm, post-submit actions |
| **G** | **0** | **Todo en working tree sin commit** |

**Commits `fix(forms)` / relacionados:** `cef382b`, `fe2121d`, `2e395b3`, `c275bcc` (4 fixes — señal de bugs durante rebuild).

**Commits mezclados:** `c275bcc` mezcla fix settings + template migration; `d580b63` bundle clone + versioning.

**TODO/WIP en commits:** ninguno encontrado en mensajes `675365a..8523872`.

---

## 4. Decisiones tomadas sin consultar

| Decisión | Spec | Realidad | Referencia |
|----------|------|----------|------------|
| Charts analytics | recharts | `@nivo/bar` | `FormAnalyticsPage.tsx:5` |
| Settings tabs | 7 | 8 (+ Versions) | `FormSettingsSheet.tsx:212-221` |
| Field palette count | 14 types | 16 + layout types + formula | `formBuilderConstants.ts:10-29` |
| Slug URLs públicas | Mantener legacy slugs | Token-only; slug → "Form link required" | `FormPublicEntry.tsx` |
| Project resources form | Reemplazar o mantener | **Eliminado localmente** sin equivalente v2 token flow | `projectResourceConstants.ts` URL `/forms/project-resources` rota post-G.5 |
| `field_completed` tracking | onBlur | onChange (first non-empty) | `PublicFormRenderer.tsx:382-384` |
| Pie chart sources | PieChart | Tabla | `FormAnalyticsPage.tsx` |
| Legacy undeploy | Eliminar edge fn remoto | Solo borrado en repo local | MCP `list_edge_functions` |
| Part G commit cadence | 3 commits separados | 0 commits | `git status` |

---

## 5. Bugs y regresiones

### Bugs introducidos / pendientes

| ID | Severidad | Descripción | Ubicación |
|----|-----------|-------------|-----------|
| B1 | 🟠 | Parte G sin commit — riesgo de pérdida / deploy inconsistente | git working tree |
| B2 | 🟠 | Edge legacy **sigue ACTIVE** en Supabase tras delete local | MCP edge functions |
| B3 | 🟡 | `briefFormSentStorage.ts` huérfano | `src/lbs/deals/briefFormSentStorage.ts` |
| B4 | 🟡 | RLS `form_submissions_v2_update` sin `WITH CHECK` | migration `:205-210` |
| B5 | 🟡 | Submit error genérico si falla invoke transport | `dataProvider.ts:1051-1054` |
| B6 | 🟡 | Status update no guarda `reviewed_by_member_id` | `SubmissionDetailPage.tsx:95-108` |
| B7 | 🟡 | Analytics prod vacío (0 events) — tracking no validado E2E | SQL prod |
| B8 | 🟡 | `abandoned` event poco confiable (solo React unmount) | `useFormEventRecorder.ts:72-80` |
| B9 | 🟠 | URL pública `/forms/project-resources` deja de funcionar post legacy removal | `FormPublicEntry.tsx` |
| B10 | 🟡 | `get_public_deal_brief` + dataProvider hook legacy restante | `dataProvider.ts:876+` |

### Regresiones módulos vecinos

| Módulo | Estado | Nota |
|--------|--------|------|
| Messages | ⚠️ | SMS `/form` OK; falta SendForm en thread UI |
| Projects / WebsiteBriefTab | ✅ | Migrado a v2 tokens + submissions |
| Contacts / Clients tabs | ✅ | Working tree: links a `/forms-v2/submissions/:id` |
| Settings | ✅ | Form notifications + phone status OK |

### Bugs específicos checklist

| Pregunta | Estado |
|----------|--------|
| RLS rechaza UPDATE form_instances user normal? | ✅ Correcto — requiere `forms.manage` |
| Tokens expirados → mensaje claro? | ✅ Edge 410 + UI "Form unavailable" |
| Submissions huérfanas? | ⚠️ No auditado; FK `form_instance_id` ON DELETE CASCADE |
| Honeypot silencioso sin insert? | ✅ |
| Rate limit X-Forwarded-For? | ✅ Primer IP del header |

---

## 6. Estado de deploys

### Edge functions v2 (prod)

| Function | Status | Version |
|----------|--------|---------|
| submit_form_v2 | ✅ ACTIVE | 6 |
| get_form_by_token | ✅ ACTIVE | 3 |
| generate_form_token | ✅ ACTIVE | 4 |
| resolve_short_code | ✅ ACTIVE | 1 |
| forms_embed_js | ✅ ACTIVE | 1 |
| record_form_event | ✅ ACTIVE | 1 |

### Edge functions legacy (prod) — **deberían eliminarse**

| Function | Status |
|----------|--------|
| submit_public_form | ❌ ACTIVE |
| get_public_form | ❌ ACTIVE |
| process_website_intake | ❌ ACTIVE |
| submit_project_resources | ❌ ACTIVE |
| get_public_deal_brief | ⚠️ ACTIVE (aún usado por dataProvider) |

### Migraciones prod (forms-related)

Aplicadas: `forms_v2_architecture`, `forms_v2_system_templates`, `forms_v2_migrate_data`, `org_default_form_notify_members`, `organization_members_notification_phone`, `refine_system_form_templates`, `form_instance_versions`, `public_form_tokens_short_code`.

Columnas/branding/task verificadas en prod vía `information_schema` (logo, custom_*, task_*, short_code).

### Storage

| Bucket | Estado |
|--------|--------|
| form-branding | ✅ public |
| attachments | ✅ public |

---

## 7. Secrets y config

| Secret / env | Estado |
|--------------|--------|
| `RECAPTCHA_SECRET_KEY` (Supabase) | ⚠️ No verificable desde repo |
| `VITE_RECAPTCHA_SITE_KEY` | ⚠️ Presente en `.env.development` (no commitear) |
| Twilio secrets | ⚠️ Asumidos existentes (Messages funciona en prod según contexto previo) |
| `PUBLIC_APP_URL` | ⚠️ Opcional en `notifyFormSubmission.ts:65-71` |

---

## 8. Performance y bundle

| Métrica | Valor |
|---------|-------|
| `make build` | ✅ Pasa (working tree) |
| Main chunk | **~4,366 KB** minified (`index-XcrWc8-W.js`) — incluye mathjs, xlsx, jspdf, qrcode, nivo, dnd-kit |
| Lazy loading forms admin | ❌ No — pages importadas estáticamente en routes |
| Public renderer bundle split | ⚠️ No hay code-split dedicado; public routes comparten bundle principal |
| Imports legacy | ✅ Eliminados en working tree (salvo `customFormSchemaLegacy` para FakeRest demo) |

---

## 9. Tests

| Test | Resultado |
|------|-----------|
| `npm run typecheck` | ✅ Pasa |
| `npm run build` | ✅ Pasa |
| `npm run lint` | ❌ Falla Prettier (~58 archivos, incl. forms-v2 nuevos) |
| Tests automatizados | ❌ Repo placeholder — sin unit/e2e forms |
| Tests manuales 15 flujos | ❌ No ejecutados en esta auditoría |

---

## 10. Documentación

| Ítem | Estado |
|------|--------|
| README forms | ❌ Sin sección forms-v2 |
| Comentarios código complejo | ⚠️ Mínimos (aceptable) |
| Schema documentado | ⚠️ Solo en migraciones SQL |
| Guía interna crear forms | ❌ |

---

## 11. Resumen priorizado

### 11.1 Lo perfecto (✅)

- Arquitectura BD v2 completa en prod (7 templates, 35 instances, 3 migrated submissions).
- Builder visual drag-and-drop con auto-save, preview tokens, 8-tab settings.
- Conditional logic, wizard, formula fields end-to-end.
- Public renderer: branding, embed, reCAPTCHA/honeypot/rate limit, file/signature/rating.
- Token pipeline: generate → get → submit → SMS notify → post-submit auto-actions.
- Distribution: QR, short URLs, embed script deployados.
- SendForm en contact/client/deal/lead + SMS `/form`.
- Parte G código (lista, detalle, export, analytics) compila y build OK en working tree.

### 11.2 Lo parcial (⚠️)

- Parte G sin commit/deploy frontend coordinado.
- Legacy eliminado localmente pero **vivo en Supabase**.
- Filtros listado forms (solo search) y submissions (UTM parcial).
- Analytics: nivo vs recharts, sin pie chart, **0 events en prod**.
- Event tracking: field_completed onChange, abandoned unreliable, no field_focused.
- SendForm: sin botón en Messages conversation; sin variant icon/menu en CRM headers.
- RLS update policy sin WITH CHECK.
- Runtime E2E no verificado en UI.

### 11.3 Lo que falta (❌)

- Commits Parte G (3 commits spec).
- Undeploy edge functions legacy en Supabase.
- Eliminar `briefFormSentStorage.ts`.
- SendFormButton en Messages thread / FormsList row actions.
- Create deal desde submission detail.
- Pie chart analytics; field_focused events.
- Documentación README/guía.
- Tests automatizados.

### 11.4 Bugs encontrados (🚨)

Ver sección 5 — prioritarios: **B1, B2, B9** (deploy/consistency + project-resources URL).

### 11.5 Decisiones unilaterales (🤔)

Ver sección 4.

---

## 12. Recomendaciones

### Casi listo — fixes priorizados (~2–4 días)

1. **Commit + PR Parte G** (3 commits semánticos) — 2h  
2. **Undeploy** legacy edge functions en Supabase — 1h  
3. **Delete** `briefFormSentStorage.ts` — 15min  
4. **SendFormButton** en Messages + Forms list — 4h  
5. **Smoke test** 15 flujos manual — 4h  
6. **RLS WITH CHECK** en submissions update — 1h  
7. **Set `reviewed_by_member_id`** on status change — 1h  
8. **Prettier** en archivos forms-v2 — 30min  

### Deuda aceptable (nice-to-have)

- Migrar pie chart / recharts (o documentar nivo como estándar del repo).
- Code-split public form route.
- field_focused + sendBeacon para abandoned.

### Hotfix urgente si se deploya G.5 sin más cambios

- **`/forms/project-resources`** dejará de funcionar — migrar a token v2 o mantener edge mínima.

---

## Metadatos de auditoría

| Campo | Valor |
|-------|-------|
| Fecha | 2026-05-22 |
| Commit auditado (HEAD) | `85238721fe91a4a2f920c591304696c20d828a73` |
| Working tree | Parte G + legacy removal **uncommitted** |
| MCP queries | counts templates/instances/submissions/tokens/events; buckets; columns; RLS policies; edge function list; migrations list |
| Archivos clave | `src/lbs/forms-v2/**`, `supabase/functions/submit_form_v2/**`, `supabase/migrations/202607*.sql`, `LbsCustomRoutes.tsx`, `dataProvider.ts` |

### Score final

| Categoría | % |
|-----------|---|
| **Completas (✅)** | **~68%** (98/145 ítems) |
| **Parciales (⚠️)** | **~22%** (32/145) |
| **Faltantes (❌)** | **~10%** (15/145) |

**Veredicto:** Rebuild **~85% funcional** en código; **~70% production-ready** por gaps de deploy, commit, legacy remoto y validación runtime. **No cerrar el proyecto** hasta commit G + undeploy legacy + smoke tests.
