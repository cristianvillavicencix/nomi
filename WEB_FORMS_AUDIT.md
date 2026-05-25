# Auditoría completa del módulo Web Forms — Nomi CRM (LBS)

> **Solo análisis — ningún archivo de código fue modificado en esta auditoría.**

---

## 1. Resumen ejecutivo

El módulo **Web Forms** en LBS es un híbrido incompleto: hay **tres productos distintos** empaquetados bajo el mismo nombre (`forms`, rutas `/web-forms`, `/forms/:slug`), pero no forman un sistema cohesivo tipo Typeform. Lo que funciona mejor es el **Website Brief** — un formulario público hardcodeado (`website-intake`) de ~638 LOC de schema que escribe en `deals.website_brief` (jsonb). Lo demás es un **form builder mínimo** (solo text/multiline/required) sin plantillas, sin lógica condicional, sin anti-spam, y con **cero submissions en producción** (`form_submissions` count = **0**) pese a **3 deals con `website_brief` poblado** — señal de que el flujo real es edición interna o persistencia parcial, no el pipeline de submissions documentado en UI.

**Estado general:** el módulo **no aporta valor production-grade** hoy. El usuario tiene razón en usarlo poco. La arquitectura mezcla persistencia en `deals.website_brief`, `form_submissions`, `deal_resources`, y flags en **localStorage** (`briefFormSentStorage.ts`), lo que genera confusión sobre “dónde quedó lo que el cliente envió”. Hay bugs de **multi-tenant** (lookup por `slug` sin `org_id`), **errores silenciados** en inserts, y mensajes genéricos al cliente (“Failed to submit form”) que ocultan la causa real.

### Top 5 bugs / problemas críticos

1. **🔴 Multi-tenant: edge functions resuelven form por `slug` global** — `submit_public_form` y `get_public_form` hacen `.eq("slug", slug).limit(1)` sin filtrar `org_id` (`supabase/functions/submit_public_form/index.ts:164-170`, `get_public_form/index.ts:54-60`). Con varias orgs (prod tiene 5+), un link puede apuntar al form/schema de **otra organización**.
2. **🔴 Insert a `form_submissions` sin verificar error (website-intake)** — tras guardar `deals.website_brief`, el insert es fire-and-forget (`submit_public_form/index.ts:404-411`). Mismo patrón en `process_website_intake/index.ts:470-477`. **Prod: 0 submissions, 3 deals con brief** → pipeline de submissions roto o ignorado.
3. **🔴 Website-intake exige `company_id` + `contact_id` en URL** — sin esos query params el submit falla con 400 (`submit_public_form/index.ts:297-301`), pero el frontend muestra error genérico (`dataProvider.ts:944-946`: `"Failed to submit form"` sin propagar mensaje del edge).
4. **🟠 Dual source of truth** — el equipo ve el brief en `WebsiteBriefTab` (`deals.website_brief`), pero `WebFormShow`, `ClientWebFormsTab` y contadores leen `form_submissions` (vacío). El cliente puede ver “Thank you” mientras el equipo cree que “no llegó nada”.
5. **🟠 `briefFormSentStorage` en localStorage** — estado “form sent” por browser/dispositivo, no por org/deal en BD (`briefFormSentStorage.ts:7-10`). Otro usuario del equipo no ve el mismo estado.

### Top 5 features más valiosas que faltan

1. **Form builder real** con plantillas (brief, contacto, quote, NPS, job app, survey) — hoy solo custom fields planos.
2. **Pipeline confiable de submissions** — una tabla canónica, detalle, export, status workflow, notificaciones.
3. **Anti-spam** (CAPTCHA, rate limit, honeypot) en endpoints públicos sin JWT.
4. **Conditional logic + multi-step** — requisito para briefs largos y NPS/quote flows.
5. **Integración Nomi automática** — contact/lead/deal/task/SMS al submit (parcial solo en `process_website_intake` autenticado).

### Esfuerzo estimado → production-grade

| Fase | Alcance | Esfuerzo |
|------|---------|----------|
| P0 | Fix guardado + multi-tenant + errores visibles + submissions verificadas | 3–5 días |
| P1 | Form builder MVP + plantillas por tipo | 1–2 semanas |
| P2 | Campos completos + conditional + multi-step | 1–2 semanas |
| P3 | Branding + embed + QR | 1 semana |
| P4 | Integración CRM (auto-contact, task, SMS) | 1–2 semanas |
| P5 | Dashboard submissions + analytics | 1–2 semanas |
| P6 | Anti-spam | 3–5 días |

**Total orientativo:** 6–10 semanas para nivel agencia web profesional.

**Recomendación:** **Rebuild del módulo Forms** sobre una arquitectura unificada (`form_definitions`, `form_submissions`, `form_answers`), **reutilizando** `websiteBriefSchema` como plantilla seed del tipo “project brief” y el edge pattern con `service_role`. El código actual de custom forms es demasiado delgado para evolucionar; el brief hardcodeado es valioso pero debe integrarse al nuevo modelo, no mantenerse como camino paralelo.

---

## 2. Modelo de datos completo

### 2.1 Tablas encontradas

| Tabla | Existe | Propósito |
|-------|--------|-----------|
| `public.forms` | ✅ | Definición de form (name, slug, schema jsonb, active) |
| `public.form_submissions` | ✅ | Respuestas enviadas (data jsonb + FKs) |
| `public.deals.website_brief` | ✅ (columna) | Brief de proyecto — **no es tabla forms** pero es almacén principal del intake web |
| `web_forms`, `form_templates`, `form_fields`, `form_responses` | ❌ NO EXISTEN | — |

**Relacionadas (no forms pero en el flujo):**
- `deal_resources` — uploads vía form público `project-resources`
- `deal_notes` — nota automática al submit website-intake

### 2.2 `public.forms`

**Migración:** `supabase/migrations/20260521120000_lbs_crm_modules.sql:102-113`

| Campo | Tipo | Nullable | Tags |
|-------|------|----------|------|
| `id` | bigserial PK | NO | ⚙️ |
| `org_id` | bigint FK → organizations | NO | ⚙️ |
| `name` | text | NO | ⚙️ |
| `slug` | text | NO | 🌐 unique per org `(org_id, slug)` |
| `description` | text | YES | ⚙️ |
| `schema` | jsonb | NO, default `{}` | 📝 definición campos |
| `active` | boolean | NO, default true | ⚙️ |
| `created_at` | timestamptz | NO | ⚙️ |
| `updated_at` | timestamptz | NO | ⚙️ |

**Índices:** `forms_pkey`, `forms_org_id_slug_key` (unique), `forms_org_id_idx`

**Triggers:** `trg_assign_org_id_forms` → `trg_assign_org_id_from_session()` on INSERT

**Seed por org:** `website-intake`, `project-resources` (+ custom ej. org 3: `forms-your`)

**Producción (MCP, 2026-05-25):** ~**11 filas** (2 system forms × 5 orgs + 1 custom form en org 3)

**RLS:**

```sql
-- Policy: "Forms org scoped"
FOR ALL TO authenticated
USING (org_id = current_user_org_id())
WITH CHECK (org_id = current_user_org_id());
```

**Grants:** SELECT/INSERT/UPDATE/DELETE → `authenticated`; ALL → `service_role`

**Nota schema seed:** el seed de `website-intake` guarda `schema.fields` como **array de strings** (`'logo', 'brand_colors'...`), no el formato `{ type: "custom", fields: [...] }` usado por custom forms. El form público **ignora** ese schema y usa `websiteBriefSchema.ts` hardcodeado.

---

### 2.3 `public.form_submissions`

**Migración:** `20260521120000_lbs_crm_modules.sql:115-124`

| Campo | Tipo | Nullable | Tags |
|-------|------|----------|------|
| `id` | bigserial PK | NO | ⚙️ |
| `org_id` | bigint FK → organizations | NO | ⚙️ |
| `form_id` | bigint FK → forms ON DELETE CASCADE | NO | ⚙️ |
| `company_id` | bigint FK → companies | YES | 🌐 |
| `contact_id` | bigint FK → contacts | YES | 🌐 |
| `deal_id` | bigint FK → deals | YES | 🌐 |
| `data` | jsonb | NO, default `{}` | 📝 respuestas |
| `created_at` | timestamptz | NO | ⚙️ |

**Índices:** `form_submissions_pkey`, `form_submissions_form_id_idx` (solo `form_id` — **sin** índice en `deal_id`, `company_id`, `org_id`)

**Triggers:** `trg_assign_org_id_form_submissions` on INSERT

**Producción:** **0 filas** (MCP `SELECT count(*)`)

**RLS:**

```sql
-- Policy: "Form submissions org scoped"
FOR ALL TO authenticated
USING (org_id = current_user_org_id())
WITH CHECK (org_id = current_user_org_id());
```

**Grants:** igual que `forms`. **No hay policy para `anon`** — inserts públicos van vía edge functions (`service_role`).

**Campos ausentes vs. producto maduro:** `status`, `submitted_by_email`, `ip_address`, `user_agent`, `source`, `utm_*`, `processed_at`, `created_by_member_id`

---

### 2.4 `public.deals.website_brief` (columna jsonb)

**Migración:** `20260521120000_lbs_crm_modules.sql:8`

| Campo | Tipo | Tags |
|-------|------|------|
| `website_brief` | jsonb, default `{}` | 📝 **Almacén real del brief web** |

**Producción:** **3 deals** con `website_brief <> '{}'`

**Relación con forms:** `submit_public_form` (slug `website-intake`) escribe aquí vía UPDATE deal (`submit_public_form/index.ts:332-343`), no solo en `form_submissions`.

---

## 3. Frontend — UI y componentes

### 3.1 Inventario de archivos (`src/lbs/web-forms/` + relacionados)

| Path | LOC | Propósito | Hooks / data | Estado |
|------|-----|-----------|--------------|--------|
| `src/lbs/web-forms/index.ts` | 15 | Exports resource | — | OK |
| `src/lbs/web-forms/WebFormsList.tsx` | 122 | Lista interna `/web-forms` | `useGetIdentity`, `useListContext`, `DataTable` | OK |
| `src/lbs/web-forms/WebFormShow.tsx` | 172 | Detalle + submissions + send panel | `useShowContext`, `useGetList`, `useMutation` → `processWebsiteIntake` | ⚠️ submissions vacías en prod |
| `src/lbs/web-forms/WebFormCreate.tsx` | 54 | Crear custom form | `CreateBase`, `WebFormInputs` | OK MVP |
| `src/lbs/web-forms/WebFormEdit.tsx` | 71 | Editar form | `EditBase`; slug system locked | OK |
| `src/lbs/web-forms/WebFormInputs.tsx` | 32 | Name, slug, description, active | `TextInput`, `BooleanInput` | OK |
| `src/lbs/web-forms/WebFormFieldsEditor.tsx` | 148 | Editor campos custom | `useFormContext`, `useWatch` | ⚠️ solo text/multiline |
| `src/lbs/web-forms/customFormSchema.ts` | 78 | Parse/validate schema | — | OK |
| `src/lbs/web-forms/PublicFormPage.tsx` | 248 | Router público por slug | `useMutation` → `submitPublicForm`, `useQuery` → `getPublicDealBrief` | ⚠️ bugs guardado |
| `src/lbs/web-forms/PublicCustomForm.tsx` | 212 | Form custom público | `useQuery` → `getPublicForm`, `submitPublicForm` | ⚠️ |
| `src/lbs/web-forms/PublicProjectResourcesForm.tsx` | 296 | Upload assets público | `submitProjectResources` | OK parcial |
| `src/lbs/web-forms/PublicFormEmbedProvider.tsx` | 73 | Modo embed `?embed=1` | `useSearchParams` | OK |
| `src/lbs/web-forms/SendWebFormPanel.tsx` | 295 | Share link, embed iframe/script | `useGetList` deals, `buildWebFormShareUrl` | ⚠️ |
| `src/lbs/web-forms/SendWebFormPanel.tsx` | — | Email client | mailto | OK |
| `src/lbs/web-forms/webFormLinks.ts` | 49 | URL builders | — | ⚠️ no org token |
| `src/lbs/web-forms/webFormEmbed.ts` | 49 | iframe/script snippets | — | OK |
| `src/lbs/web-forms/webFormConstants.ts` | 31 | System slugs reservados | — | OK |
| `src/lbs/web-forms/intakeMapping.ts` | 30 | Map submission → processWebsiteIntake | — | OK legacy |
| `src/lbs/deals/websiteBriefSchema.ts` | 638 | Schema brief hardcodeado | — | 🌐 core value |
| `src/lbs/deals/WebsiteBriefTab.tsx` | 271 | Tab brief en proyecto | `useGetList` submissions, `getBriefFormSent` | ⚠️ localStorage |
| `src/lbs/deals/WebsiteBriefFormSections.tsx` | ~140 | Secciones UI interna | — | OK |
| `src/lbs/deals/WebsiteBriefSectionSheet.tsx` | 156 | Edit/view sección | — | OK |
| `src/lbs/deals/briefFormSentStorage.ts` | 24 | Flag “sent” localStorage | — | ❌ deuda |
| `src/lbs/deals/SendProjectWebFormDialog.tsx` | 192 | Dialog enviar link desde proyecto | `buildProjectWebFormUrl` | ⚠️ |
| `src/lbs/deals/websiteIntakeForm.ts` | 45 | URL builder con query params | — | OK |
| `src/lbs/messages/SmsWebFormPicker.tsx` | ~97 | Insertar link form en SMS | `useGetList` forms | OK |
| `src/lbs/clients/ClientTabPanels.tsx` | ClientWebFormsTab | Submissions por company | `useGetList` form_submissions | ⚠️ siempre vacío |
| `src/lbs/placeholders.tsx` | WebFormsPlaceholderPage | Legacy placeholder | — | 🏗️ legacy route |

**Edge functions:**

| Path | LOC | Propósito |
|------|-----|-----------|
| `supabase/functions/submit_public_form/index.ts` | 440 | Submit público (brief + custom) |
| `supabase/functions/get_public_form/index.ts` | 85 | Metadata form custom |
| `supabase/functions/get_public_deal_brief/index.ts` | 68 | Prefill brief desde deal |
| `supabase/functions/submit_project_resources/index.ts` | ~215 | Upload archivos público |
| `supabase/functions/process_website_intake/index.ts` | 529 | Intake autenticado (legacy/admin) |

**Rutas:**

| Ruta | Auth | Componente |
|------|------|------------|
| `/web-forms` | ✅ CRM | `WebFormsList` |
| `/web-forms/create` | ✅ | `WebFormCreate` |
| `/web-forms/:id/show` | ✅ | `WebFormShow` |
| `/web-forms/:id/edit` | ✅ | `WebFormEdit` |
| `/forms/:slug` | ❌ público | `PublicFormPage` |
| `/web-forms-placeholder` | ✅ | Legacy placeholder |

Registro en `LbsCustomRoutes.tsx:50` (`/forms/:slug` sin `ProtectedRoute`).

---

### 3.2 Flujos end-to-end

#### A) Usuario interno crea un form

1. `/web-forms` → “New form” → `WebFormCreate`
2. **Form builder:** lista de campos con label/key/required/multiline (`WebFormFieldsEditor`) — **NO** drag-and-drop, **NO** plantillas
3. Schema guardado como `{ type: "custom", fields: [...] }` en `forms.schema`
4. System slugs reservados: `website-intake`, `project-resources` (`webFormConstants.ts:1-4`)

#### B) Usuario interno envía form al cliente

1. Desde `WebFormShow` → `SendWebFormPanel` (requiere seleccionar deal si slug es project-scoped)
2. Desde proyecto → `SendProjectWebFormDialog` en `WebsiteBriefTab`
3. URL: `/forms/{slug}?company_id=&contact_id=&deal_id=`
4. También: embed iframe/script (`SendWebFormPanel`), SMS link (`SmsWebFormPicker`)

#### C) Cliente abre form público

1. URL sin auth, mobile-friendly (Tailwind responsive básico)
2. **website-intake:** form largo multi-sección, campos dinámicos por `project_type` (`getVisibleBriefSections`)
3. **custom:** campos del schema
4. **project-resources:** upload multi-categoría
5. Prefill: si hay `deal_id+company_id+contact_id`, `getPublicDealBrief` carga `website_brief` existente

#### D) Cliente envía form

1. Frontend: `dataProvider.submitPublicForm` → edge `submit_public_form`
2. **website-intake:** UPDATE `deals.website_brief` + INSERT `form_submissions` (sin check error) + INSERT `deal_notes`
3. **custom:** INSERT `form_submissions` only
4. Confirmación: pantalla “Thank you” (`PublicFormPage.tsx:137-146`, `PublicCustomForm.tsx:123-132`)
5. **NO** email/SMS automático al equipo LBS en submit público
6. Validación cliente: custom sí (`validateCustomFormValues`); **website-intake NO valida campos requeridos** antes de submit

#### E) Usuario interno ve respuestas

1. `WebFormShow` → lista `form_submissions` por `form_id` (JSON crudo en `<pre>`)
2. `WebsiteBriefTab` → lee **`deals.website_brief`**, no submissions
3. `ClientWebFormsTab` → submissions por `company_id` (**vacío en prod**)
4. **NO** export CSV/Excel
5. **NO** detalle submission dedicado (solo JSON en show)
6. Botón “Process intake” en `WebFormShow` si slug website-intake y submission sin `deal_id` → `processWebsiteIntake` (flujo legacy paralelo)

---

## 4. WebsiteBriefTab y schema actual

### 4.1 Secciones del schema (`websiteBriefSchema.ts`)

9 secciones con visibilidad condicional por `project_type`:

| ID | Título | Visible para |
|----|--------|--------------|
| `context` | Project context | Todos |
| `scope` | Scope & structure | Modo “pages” |
| `landing` | Landing page | landing-page |
| `campaign` | Campaign & ads | seo, google-ads, social-media, etc. |
| `ecommerce` | E-commerce | ecommerce |
| `redesign` | Redesign | redesign |
| `brand` | Brand & content | new-website, redesign, landing, ecommerce, branding |
| `technical` | Technical & hosting | website types + maintenance |
| `seo` | SEO & analytics | Varios |
| `process` | Process & notes | Todos |

~40+ field keys (goals, sitemap, brand_colors, domain, client_notes, etc.)

### 4.2 ¿Editable por usuario interno?

- **Sí**, vía `WebsiteBriefTab` + `WebsiteBriefSectionSheet` (edición por sección en el deal)
- **Schema NO editable** en Settings — hardcoded en TS
- **Cliente** edita vía form público `/forms/website-intake?...`

### 4.3 Envío del link

- `SendProjectWebFormDialog` → `buildProjectWebFormUrl` con query params
- Copy / mailto / mark sent (`briefFormSentStorage`)

### 4.4 Dónde se guarda progreso del cliente

| Destino | Cuándo |
|---------|--------|
| `deals.website_brief` | Submit website-intake con `deal_id` |
| `form_submissions.data` | Debería — **0 rows prod** |
| localStorage | Solo flag “sent”, **no** respuestas (`briefFormSentStorage.ts`) |

**No hay autosave / draft en BD** mientras el cliente llena el form.

---

## 5. Bug crítico: “los datos no se guardan bien”

### 5.1 Hipótesis confirmadas por código + prod

| # | Causa | Evidencia |
|---|-------|-----------|
| H1 | **Equipo mira `form_submissions`, datos están en `website_brief`** | Prod: 0 submissions, 3 deals con brief |
| H2 | **Insert submission falla silenciosamente** | `submit_public_form/index.ts:404-411` sin `{ error }` check; mismo en `process_website_intake/index.ts:470-477` |
| H3 | **Link sin `company_id`/`contact_id`** | Edge retorna 400; UI muestra “Failed to submit form” genérico (`dataProvider.ts:944-946`) |
| H4 | **Slug resuelve form de otra org** | `.eq("slug").limit(1)` — datos guardados en org/deal incorrecto o 404 |
| H5 | **Form type mismatch** | `SendProjectWebFormDialog` permite elegir custom form; custom **no** actualiza `website_brief` |
| H6 | **Demo FakeRest** | `submitPublicForm` puede no existir → “Form submission is not available” (`PublicFormPage.tsx:169-173`) |

### 5.2 Cadena de fallo (website-intake)

```
Cliente submit
  → dataProvider.submitPublicForm (dataProvider.ts:919-949)
    → edge submit_public_form
      → lookup form by slug ONLY (línea 164-170) ⚠️
      → require company_id + contact_id (línea 297-301) ⚠️
      → UPDATE deals.website_brief (línea 332-343) ✓ si deal existe
      → INSERT form_submissions (línea 404-411) ⚠️ sin verificar error
  → onSuccess: "Thank you" (PublicFormPage.tsx:115-117)
  → Equipo: WebsiteBriefTab lee record.website_brief (OK si update funcionó)
  → Equipo: WebFormShow / ClientWebFormsTab leen form_submissions (VACÍO)
```

### 5.3 Reproducción recomendada (manual)

1. Crear deal con company + contact en prod/staging
2. Generar link desde `SendProjectWebFormDialog` **con** los 3 IDs
3. Llenar form como cliente anónimo → Submit
4. Verificar:
   - `SELECT website_brief FROM deals WHERE id = ?` — ¿tiene data?
   - `SELECT * FROM form_submissions WHERE deal_id = ?` — ¿hay fila?
5. Repetir link **sin** `contact_id` → debe fallar; confirmar mensaje genérico en UI
6. Repetir con slug custom seleccionado en dialog → brief no se actualiza

### 5.4 Try/catch que tragan errores

| Archivo | Línea | Comportamiento |
|---------|-------|----------------|
| `dataProvider.ts` | 944-946 | `throw new Error("Failed to submit form")` — pierde mensaje edge |
| `submit_public_form/index.ts` | 404-411 | Insert submission sin check |
| `process_website_intake/index.ts` | 470-477 | Insert submission sin check |
| `briefFormSentStorage.ts` | 16-22 | catch → return null |

---

## 6. Sistema público (cliente sin auth)

| Aspecto | Estado |
|---------|--------|
| URL | `/forms/:slug?company_id=&contact_id=&deal_id=` |
| Identificación form | Solo `slug` — **sin org token** ⚠️ |
| Auth | No requerida; edge functions `verify_jwt = false` (`config.toml:194-204`) |
| RLS anon INSERT | No — edge usa `service_role` |
| Rate limiting | ❌ NO EXISTE |
| CAPTCHA | ❌ NO EXISTE |
| Honeypot | ❌ NO EXISTE |
| File uploads | ✅ `project-resources` vía base64 → Storage (`submit_project_resources`) |
| CORS | ✅ `OptionsMiddleware` + corsHeaders en edges |
| Prefill deal brief | ✅ `get_public_deal_brief` valida company+contact match deal |

**Riesgo seguridad:** cualquiera con URL válida puede submit; `get_public_deal_brief` expone `website_brief` si conoce IDs (sin token firmado).

---

## 7. Integración con otros módulos

| Módulo | Integración | Estado |
|--------|-------------|--------|
| **Contacts** | Upsert en `process_website_intake` (auth) | ⚠️ solo path autenticado |
| **Leads** | Auto-create deal stage `lead` si no hay deal_id | ⚠️ solo website-intake edge |
| **Deals** | UPDATE `website_brief`, link `deal_id` | ✅ parcial |
| **Messages** | `SmsWebFormPicker` inserta link | ✅ manual |
| **Tasks** | Auto checklist tasks | ⚠️ solo `process_website_intake` autenticado, **no** submit público |
| **Tags** | — | ❌ |
| **Notifications** | — | ❌ no email/SMS on submit |
| **deal_resources** | `project-resources` form | ✅ |
| **deal_notes** | Nota al submit website-intake | ✅ |

---

## 8. Performance y bundle

| Aspecto | Evaluación |
|---------|------------|
| Carga form público | Sin lazy route split específico; carga `websiteBriefSchema` (638 LOC) en bundle del form |
| Lazy loading | ❌ no hay code-split por tipo de form |
| Imágenes | Upload convierte a base64 en cliente — **payload grande** (`PublicProjectResourcesForm`) |
| Validación | O(n) simple en custom; brief sin debounce/autosave |
| Mobile | Tailwind responsive OK; form largo = mucho scroll (no wizard) |
| Bundle impact | Moderado; schema TS estático no tree-shakeable por sección |

---

## 9. RLS y permisos

### Capabilities (`permissionCatalog.ts`)

| Capability | Efecto |
|------------|--------|
| `forms.manage` | CRUD `forms` (list/show/create/edit/delete) |
| `forms.submissions.view` | CRUD `form_submissions` (mismo resource actions) |

**Matriz:** super_admin/admin → manage; user/read_only → submissions.view only.

### Problemas RLS (paralelos a Projects audit)

| Issue | Detalle |
|-------|---------|
| `forms` / `form_submissions` FOR ALL sin capability SQL | Solo `org_id = current_user_org_id()` — capability check es **frontend-only** via `canAccess` |
| Sin scoped delete | Cualquier user con submissions.view puede DELETE cualquier submission de la org |
| Sin INSERT anon | Correcto para seguridad; depende 100% de edge functions |
| Public edges sin org binding | **Crítico** — bypass RLS pero sin validar tenant en slug lookup |

---

## 10. Bugs conocidos (búsqueda activa)

| ID | Severidad | Bug | Ubicación |
|----|-----------|-----|-----------|
| B1 | 🔴 | Slug lookup sin org_id | `submit_public_form/index.ts:164-170`, `get_public_form/index.ts:54-60` |
| B2 | 🔴 | form_submissions insert sin error check | `submit_public_form/index.ts:404-411`, `process_website_intake/index.ts:470-477` |
| B3 | 🔴 | Error genérico oculta causa | `dataProvider.ts:944-946`, `973-976` |
| B4 | 🟠 | website-intake sin validación cliente | `PublicFormPage.tsx:165-176` |
| B5 | 🟠 | briefFormSent en localStorage | `briefFormSentStorage.ts:7-10` |
| B6 | 🟠 | Seed schema website-intake incompatible con custom parser | Migration seed vs `customFormSchema.ts` |
| B7 | 🟠 | SendProjectWebFormDialog permite form incorrecto | `SendProjectWebFormDialog.tsx:124-137` |
| B8 | 🟡 | WebFormShow link submission query param no implementado | `ClientTabPanels.tsx:365` → `?submission=` no usado en show |
| B9 | 🟡 | `get_public_deal_brief` sin rate limit / token | `get_public_deal_brief/index.ts:28-35` |
| B10 | 🟡 | Índices faltantes en submissions | solo `form_id_idx` |

**TODOs/FIXMEs en módulo forms:** NO ENCONTRADOS en `src/lbs/web-forms/`.

---

## 11. Features faltantes (checklist)

### Form builder
- [ ] UI crear form desde cero — ⚠️ parcial (`WebFormCreate` + FieldsEditor)
- [ ] Drag & drop campos — ❌
- [ ] Plantillas predefinidas (brief, contacto, NPS…) — ❌ (brief hardcoded aparte)
- [ ] Editar form existente — ✅
- [ ] Duplicar form — ❌
- [ ] Versionado — ❌

### Tipos de campos
- [ ] Text corto/largo — ⚠️ Input/Textarea
- [ ] Email — ❌ (sin type=email validation)
- [ ] Phone — ❌
- [ ] Number — ❌
- [ ] Date/DateTime — ❌
- [ ] Dropdown — ❌ custom (solo website-intake project_type)
- [ ] Radio — ❌
- [ ] Checkboxes — ❌
- [ ] File upload — ⚠️ solo project-resources form
- [ ] Multi-file — ⚠️ parcial
- [ ] Rating/NPS — ❌
- [ ] Signature — ❌
- [ ] Address autocomplete — ❌
- [ ] Color picker — ❌
- [ ] URL — ❌
- [ ] Rich text — ❌

### Lógica
- [ ] Conditional logic — ⚠️ solo en brief schema (server-side sections), no en custom builder
- [ ] Skip logic — ❌
- [ ] Pre-fill URL params — ⚠️ solo IDs + brief prefill
- [ ] Multi-step wizard — ❌ (brief es long single page)
- [ ] Progress bar — ⚠️ solo interno `BriefProgressBar`, no en público
- [ ] Required fields — ⚠️ custom sí; brief no
- [ ] Custom regex — ❌
- [ ] Calculated fields — ❌

### Personalización / Branding
- [ ] Logo — ❌
- [ ] Colores — ❌
- [ ] Background — ❌
- [ ] Custom font — ❌
- [ ] CSS custom — ❌
- [ ] Welcome screen — ❌
- [ ] Thank you screen — ⚠️ texto fijo genérico
- [ ] Redirect post-submit — ❌

### Distribución
- [ ] Public link — ✅
- [ ] QR code — ❌
- [ ] Embed iframe — ✅ (`webFormEmbed.ts`)
- [ ] Embed script — ⚠️ custom forms only
- [ ] Email-friendly link — ✅ mailto
- [ ] SMS-friendly short link — ❌ (URL larga)

### Submissions / Respuestas
- [ ] Dashboard submissions — ⚠️ lista básica en WebFormShow
- [ ] Filtros — ❌
- [ ] Detalle + timeline — ❌
- [ ] Export CSV/Excel — ❌
- [ ] Export PDF — ❌
- [ ] Email notify team — ❌
- [ ] SMS notify team — ❌
- [ ] Webhook — ❌
- [ ] Auto-reply cliente — ❌
- [ ] Status workflow — ❌

### Integración Nomi
- [ ] Auto contact — ⚠️ solo process_website_intake auth
- [ ] Auto lead — ⚠️ parcial website-intake
- [ ] Asociar deal — ✅ con deal_id param
- [ ] Auto-assign rep — ❌
- [ ] Auto task — ⚠️ solo auth path
- [ ] Mover lead stage — ❌
- [ ] Trigger automation — ❌

### Anti-spam / Security
- [ ] CAPTCHA — ❌
- [ ] Rate limit IP — ❌
- [ ] Honeypot — ❌
- [ ] Email verification — ❌
- [ ] Phone SMS verify — ❌
- [ ] Submission limit — ❌
- [ ] Form expiration — ❌
- [ ] Password protected — ❌

### Analytics
- [ ] Views vs submissions — ❌
- [ ] Conversion rate — ❌
- [ ] Drop-off por field — ❌
- [ ] Avg completion time — ❌
- [ ] UTM tracking — ❌
- [ ] Source tracking — ❌

### AI (opcional)
- [ ] AI-suggest questions — ❌
- [ ] Auto-generate form — ❌
- [ ] Summary respuestas — ❌
- [ ] Sentiment analysis — ❌

---

## 12. Comparación con competencia

| Capacidad | Typeform | Tally | Jotform | Google Forms | **Nomi hoy** |
|-----------|----------|-------|---------|--------------|--------------|
| Form builder visual | ✅ | ✅ | ✅ | ✅ | ⚠️ lista campos |
| Conditional logic | ✅ | ✅ | ✅ | ⚠️ | ⚠️ brief only |
| File uploads | ✅ | ✅ | ✅ | ✅ | ⚠️ resources form |
| Multi-step | ✅ | ✅ | ✅ | ❌ | ❌ |
| CAPTCHA | ✅ | ✅ | ✅ | ✅ | ❌ |
| Custom branding | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| CRM integration | ⚠️ Zapier | ⚠️ | ⚠️ | ❌ | ✅ **nativo** (si funcionara) |
| Analytics | ✅ | ✅ | ✅ | ⚠️ | ❌ |
| Pricing | $25–83/mo | $0–29/mo | $34–99/mo | Free | $0 incluido |

**Ventaja diferenciadora Nomi:** brief + recursos + deal + mensajes + finanzas en un solo CRM Supabase-native.

**Gap principal:** guardado confiable, builder, branding, conditional logic, anti-spam, analytics.

---

## 13. Archivos clave

| # | Archivo | LOC | Propósito | Estado |
|---|---------|-----|-----------|--------|
| 1 | `websiteBriefSchema.ts` | 638 | Schema brief web | 🌐 core |
| 2 | `submit_public_form/index.ts` | 440 | Submit público | 🔴 bugs |
| 3 | `PublicFormPage.tsx` | 248 | UI pública brief | ⚠️ |
| 4 | `process_website_intake/index.ts` | 529 | Intake auth legacy | ⚠️ duplicado |
| 5 | `WebsiteBriefTab.tsx` | 271 | UI interna brief | ⚠️ |
| 6 | `SendWebFormPanel.tsx` | 295 | Distribución | OK |
| 7 | `PublicProjectResourcesForm.tsx` | 296 | Upload público | OK |
| 8 | `WebFormShow.tsx` | 172 | Admin view | ⚠️ |
| 9 | `customFormSchema.ts` | 78 | Custom forms | MVP |
| 10 | `dataProvider.ts` (forms methods) | ~80 | Bridge frontend↔edge | ⚠️ errors |
| 11 | `briefFormSentStorage.ts` | 24 | Sent flag | ❌ |
| 12 | `get_public_form/index.ts` | 85 | Load custom form | 🔴 tenant |
| 13 | `get_public_deal_brief/index.ts` | 68 | Prefill | ⚠️ security |
| 14 | `SendProjectWebFormDialog.tsx` | 192 | Send from project | ⚠️ |
| 15 | `20260521120000_lbs_crm_modules.sql` | — | Schema + RLS | ⚠️ |

---

## 14. Recomendaciones y plan de rediseño

### Opción A — Refactor incremental

**Mantener:**
- `websiteBriefSchema.ts` como plantilla “Project Brief”
- Edge function pattern (`service_role` + CORS)
- Rutas `/forms/:slug` y UI interna `/web-forms`
- Integración deal/company/contact IDs en URL

**Rehacer obligatorio:**
- Tenant-safe lookup: `org_id` en URL (token firmado o subdomain)
- Verificación de todos los inserts + transacciones
- Unificar lectura: brief **desde** latest submission o single write path
- Eliminar localStorage sent flag → columna `deals.brief_form_sent_at` o submission timestamp
- Error messages propagados al cliente
- Índices `form_submissions(deal_id)`, `(company_id)`, `(org_id, created_at desc)`

### Opción B — Rebuild completo (recomendado)

**Nuevo modelo propuesto:**

```
form_templates (slug, type: brief|contact|quote|nps|job|survey, schema_version)
form_instances (org_id, template_id, overrides, branding, active)
form_submissions (answers jsonb, status, metadata, ip, ua)
form_submission_events (audit: viewed, started, submitted)
public_form_tokens (signed: org_id, form_id, deal_id, contact_id, exp)
```

**Reutilizar:** Storage upload pattern, RBAC capabilities (`forms.manage`, `forms.submissions.view`), SMS link insertion.

### Plan priorizado

| Fase | Alcance | Esfuerzo |
|------|---------|----------|
| **P0** | Fix multi-tenant slug + error handling + verify submissions + mensajes claros | 3–5 días |
| **P1** | Form builder MVP + 6 plantillas (brief, contact, quote, NPS, job, survey) | 1–2 semanas |
| **P2** | Tipos de campo + conditional + multi-step wizard | 1–2 semanas |
| **P3** | Branding org + embed + QR | 1 semana |
| **P4** | Auto CRM (contact, deal, task, SMS notify) | 1–2 semanas |
| **P5** | Submissions dashboard, export, analytics | 1–2 semanas |
| **P6** | CAPTCHA + rate limit + honeypot | 3–5 días |

### Soporte de los 6 tipos deseados

| Tipo | Hoy | Con rebuild |
|------|-----|-------------|
| 1. Brief proyecto | ⚠️ hardcoded website-intake | Plantilla `project_brief` desde schema actual |
| 2. Contacto / lead capture | ⚠️ custom form básico | Plantilla `contact` + auto lead |
| 3. Quote request | ❌ | Plantilla con campos budget/timeline/services |
| 4. NPS post-proyecto | ❌ | Plantilla rating 0–10 + comment |
| 5. Job application | ❌ | Plantilla + file upload resume |
| 6. Survey genérico | ⚠️ custom form | Builder libre con tipos ricos |

---

## Metadatos de auditoría

| Campo | Valor |
|-------|-------|
| **Fecha** | 2026-05-25 |
| **Commit** | `f67742fbe75ae79484c7eb63d86ee189087543f5` |
| **Modo producto** | LBS (`VITE_PRODUCT_MODE=lbs`) |
| **Supabase project** | `qjglkywmqwqdoaboakao` |

### Herramientas usadas

- Exploración codebase (grep, glob, read file)
- Supabase MCP `execute_sql` (counts, forms list, policies via migration files)
- Referencias: `SYSTEM_AUDIT.md`, `RBAC_DESIGN.md`, `permissionCatalog.ts`, `PROJECTS_AUDIT.md`, `MESSAGES_AUDIT.md`

### Archivos investigados (principal)

`src/lbs/web-forms/*`, `src/lbs/deals/websiteBriefSchema.ts`, `WebsiteBriefTab.tsx`, `briefFormSentStorage.ts`, `SendProjectWebFormDialog.tsx`, `PublicFormPage.tsx`, `PublicCustomForm.tsx`, `PublicProjectResourcesForm.tsx`, `supabase/functions/submit_public_form/*`, `get_public_form/*`, `get_public_deal_brief/*`, `process_website_intake/*`, `submit_project_resources/*`, `supabase/migrations/20260521120000_lbs_crm_modules.sql`, `20260629200000_project_resources_form.sql`, `dataProvider.ts`, `permissionCatalog.ts`, `ClientTabPanels.tsx`, `SmsWebFormPicker.tsx`, `LbsCustomRoutes.tsx`

### Preguntas abiertas

1. ¿Los 3 `website_brief` en prod se cargaron manualmente en CRM o vía form público? (Revisar `deal_notes` “Website intake form submitted by client” en esos deals.)
2. ¿Hubo errores en logs de `submit_public_form` en Supabase Dashboard durante submits fallidos?
3. ¿Se requiere token firmado en URL o subdomain por org (`lbs.nomicrm.com/forms/...`) para multi-tenant?
4. ¿El form custom `forms-your` (org 3) se usó en producción? ¿Qué feedback específico dio el cliente sobre campos perdidos?
5. ¿Migrar brief hardcoded a JSON editable en Settings o mantener TS schema con codegen?

---

*Fin del reporte — solo análisis, sin cambios de código.*
