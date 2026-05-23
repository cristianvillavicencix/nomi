# Auditoría del módulo Messages — Nomi CRM

> Auditoría técnica exhaustiva del sistema de mensajería (conversaciones internas + SMS Twilio).  
> **Solo análisis — ningún código fue modificado.**

---

## 1. Modelo de datos completo

### Tablas del módulo Messages

| Tabla | ¿Existe? | Propósito |
|---|---|---|
| `conversations` | ✅ | Hilos: `team_dm`, `project`, `client` |
| `conversation_participants` | ✅ | Participantes DM + `last_read_at` |
| `conversation_messages` | ✅ | Mensajes internos y SMS |
| `organization_messaging_settings` | ✅ | Credenciales Twilio por org |
| `message_templates` | ❌ NO EXISTE | — |
| `message_attachments` | ❌ NO EXISTE | Solo columna `media_url` en messages |
| `message_reactions` | ❌ NO EXISTE | — |

**Tablas relacionadas pero NO parte del módulo Messages:**
- `ticket_messages` — soporte/forms (`support.tickets.*` capabilities), no aparece en `/messages`.
- `contact_notes` — emails Postmark inbound crean **notas**, no conversaciones.

---

### `conversations`

**Migración base:** `supabase/migrations/20260629230000_conversations.sql`

| Campo | Tipo | Nullable |
|---|---|---|
| `id` | `bigint` (identity PK) | NOT NULL |
| `org_id` | `bigint` → `organizations(id)` ON DELETE CASCADE | NOT NULL |
| `type` | `text` CHECK (`team_dm`, `project`, `client`) | NOT NULL |
| `title` | `text` | nullable |
| `deal_id` | `bigint` → `deals(id)` ON DELETE CASCADE | nullable |
| `contact_id` | `bigint` → `contacts(id)` ON DELETE SET NULL | nullable |
| `external_phone` | `text` (E.164 para SMS) | nullable |
| `dm_key` | `text` (par ordenado de member IDs para DMs) | nullable |
| `last_message_at` | `timestamptz` | nullable |
| `created_by_member_id` | `bigint` → `organization_members(id)` ON DELETE SET NULL | nullable |
| `created_at` | `timestamptz` DEFAULT `now()` | NOT NULL |
| `updated_at` | `timestamptz` DEFAULT `now()` | NOT NULL |

**Foreign keys:** `org_id`, `deal_id`, `contact_id`, `created_by_member_id`.

**Índices (producción verificada):**
- `conversations_pkey` — PK (`id`)
- `conversations_org_id_idx` — `(org_id)`
- `conversations_deal_id_idx` — `(deal_id)` WHERE `deal_id IS NOT NULL`
- `conversations_project_deal_uidx` — UNIQUE `(deal_id)` WHERE `type = 'project'`
- `conversations_dm_key_uidx` — UNIQUE `(org_id, dm_key)` WHERE `type = 'team_dm'`
- `conversations_last_message_at_idx` — `(last_message_at DESC NULLS LAST)`
- `conversations_client_phone_uidx` — UNIQUE `(org_id, external_phone)` WHERE `type = 'client'`

**Triggers:**
- `trg_assign_org_id_conversations` — BEFORE INSERT → `trg_assign_org_id_from_session()`
- (indirecto) INSERT en `conversation_messages` actualiza `last_message_at` vía trigger en messages

**RLS — policy activa en producción (`conversations_access`):**

```sql
-- USING
(org_id = current_user_org_id()) AND can_view_conversation(id)

-- WITH CHECK
(org_id = current_user_org_id())
AND (can_view_conversation(id) OR created_by_member_id = current_user_member_id())
```

**Función `can_view_conversation` (producción):**
- Admin → acceso total en org.
- Usuario no scoped → acceso total en org.
- Usuario scoped (`user` preset / `_scoped_to_projects`) → solo si: participante DM, `record_shares` en conversación, o conversación `project`/`client` con `deal_id` asignado vía `can_view_deal()`.

**Filas en producción:** ~4  
**Tasa de crecimiento:** muy baja (~30 mensajes totales); escala según adopción SMS. Sin particionamiento ni archivo.

---

### `conversation_participants`

| Campo | Tipo | Nullable |
|---|---|---|
| `id` | `bigint` PK | NOT NULL |
| `conversation_id` | `bigint` → `conversations(id)` ON DELETE CASCADE | NOT NULL |
| `member_id` | `bigint` → `organization_members(id)` ON DELETE CASCADE | NOT NULL |
| `last_read_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` DEFAULT `now()` | NOT NULL |

**Constraints:** UNIQUE `(conversation_id, member_id)`

**Índices:** PK, UNIQUE anterior, `conversation_participants_member_id_idx` en `(member_id)`.

**RLS — `conversation_participants_access` (producción):**

```sql
-- USING
(member_id = current_user_member_id())
OR EXISTS (
  SELECT 1 FROM conversations c
  WHERE c.id = conversation_participants.conversation_id
    AND c.org_id = current_user_org_id()
    AND can_view_conversation(c.id)
)

-- WITH CHECK — misma lógica
```

**Triggers:** ninguno.

**Filas en producción:** ~3  
**Uso real:** principalmente DMs (`team_dm`); `last_read_at` solo se persiste en DB para DMs (`useMarkConversationRead.ts:11-12`).

---

### `conversation_messages`

| Campo | Tipo | Nullable |
|---|---|---|
| `id` | `bigint` PK | NOT NULL |
| `conversation_id` | `bigint` → `conversations(id)` ON DELETE CASCADE | NOT NULL |
| `author_member_id` | `bigint` → `organization_members(id)` ON DELETE SET NULL | nullable (null en inbound SMS) |
| `body` | `text` | NOT NULL |
| `channel` | `text` CHECK (`internal`, `sms`, `whatsapp`) DEFAULT `internal` | NOT NULL |
| `direction` | `text` CHECK (`outbound`, `inbound`) DEFAULT `outbound` | NOT NULL |
| `external_id` | `text` (Twilio MessageSid) | nullable |
| `media_url` | `text` (MMS; migración `20260629320000`) | nullable |
| `created_at` | `timestamptz` DEFAULT `now()` | NOT NULL |

**Índices:** PK, `conversation_messages_conversation_id_idx` en `(conversation_id, created_at)`.

**Triggers:**
- `trg_conversation_message_touch_conversation` — AFTER INSERT → actualiza `conversations.last_message_at`

**Realtime:** tabla en publication `supabase_realtime`; `replica identity full` (`20260629310000`).

**RLS — `conversation_messages_access` (producción):**

```sql
-- USING
user_can_access_conversation(conversation_id)

-- WITH CHECK
user_can_access_conversation(conversation_id)
AND (
  author_member_id IS NULL
  OR (
    author_member_id = current_user_member_id()
    AND current_member_has_capability('messaging.send')
  )
)
```

**⚠️ DRIFT CRÍTICO:** En producción, `user_can_access_conversation` **NO incluye** `type = 'client'` (solo `project` + creator + participant). En repo, `20260629300000_twilio_messaging.sql` sí lo añade, pero **`20260630230000_user_preset_scope_and_messaging.sql` no actualizó esta función** — solo cambió policies de `conversations` y `participants`.

**Filas en producción:** ~30  
**Crecimiento:** proporcional a SMS/chat; sin TTL ni archivo.

---

### `organization_messaging_settings`

| Campo | Tipo | Nullable |
|---|---|---|
| `org_id` | `bigint` PK → `organizations(id)` ON DELETE CASCADE | NOT NULL |
| `twilio_account_sid` | `text` | nullable |
| `twilio_auth_token` | `text` | nullable (**plain text**) |
| `twilio_phone_number` | `text` | nullable |
| `sms_enabled` | `boolean` DEFAULT `false` | NOT NULL |
| `updated_at` | `timestamptz` DEFAULT `now()` | NOT NULL |

**Índices:** PK, `organization_messaging_settings_phone_idx` en `(twilio_phone_number)` WHERE NOT NULL.

**RLS:** habilitado, pero **sin policies para `authenticated`** — solo `GRANT ALL TO service_role`. Acceso vía Edge Function `messaging_settings` con JWT.

**Triggers:** ninguno.

**Filas en producción:** 1 org configurada, SMS enabled.

---

## 2. Integraciones externas

### Twilio

| Aspecto | Estado |
|---|---|
| Autenticación | `twilio_account_sid` + `twilio_auth_token` en Postgres; Basic Auth hacia API Twilio (`twilio.ts:9-31`) |
| Almacenamiento credenciales | **Plain text** en `organization_messaging_settings`; token nunca expuesto al frontend (`has_auth_token` boolean) |
| Webhook inbound | `POST /functions/v1/twilio_inbound_sms` — URL expuesta en Settings |
| Validación firma | HMAC-SHA1 (`validateTwilioSignature`); prueba múltiples URLs candidatas (`TWILIO_WEBHOOK_URL`, `SUPABASE_URL/functions/v1/...`) |
| Fallback inseguro | Si firma falla pero `AccountSid` del payload = stored SID → **acepta webhook** (`twilio_inbound_sms/index.ts:74-85`) |
| Errores / retry | Sin dead letter queue; errores 500 devueltos a Twilio (Twilio reintenta por su cuenta); outbound falla con 400 al cliente |
| Rate limiting | ❌ NO EXISTE |
| MMS | ⚠️ PARCIAL — outbound: `media_urls[]` (solo primera URL guardada en DB); inbound: descarga de Twilio → bucket `attachments` |
| Delivery receipts | ❌ NO EXISTE — no se procesa status callback de Twilio |
| Costos Twilio | **NO ENCONTRADO** — no hay integración de billing/metrics; volumen prod ~30 msgs → costo negligible |

### WhatsApp Business

**NO EXISTE.** La columna `channel` admite `'whatsapp'` en schema pero no hay edge function, webhook ni UI.

### Email (Postmark)

| Aspecto | Estado |
|---|---|
| Integración Postmark | ✅ Existe (`supabase/functions/postmark/`) |
| ¿Crea conversaciones? | **NO** — crea `contact_notes` en contactos matched por email |
| ¿Envío desde Messages? | **NO** — no hay composer email en `/messages` |

Postmark es **captura de email → CRM notes**, no mensajería unificada.

### Notificaciones internas

| Canal | Implementación |
|---|---|
| In-app toast/banner | `MessagesNotificationsLayer.tsx` — toast + banner flotante en mensajes nuevos |
| Sonido | `messageNotificationSound.ts` |
| Desktop/OS | `messagingDesktopNotifications.ts` (Notification API; opt-in en Settings) |
| Push móvil | ❌ NO EXISTE |
| Email digest | ❌ NO EXISTE |

**Badge sidebar "1":** calculado en frontend por `useMessagesUnreadCounts` → compara `conversation.last_message_at` vs `last_read_at` (participants DB para DMs + **localStorage** `nomi:messages:lastRead` para project/client). Expuesto en `MessagesDock.tsx` y navegación LBS. **No es server-side**; no sincroniza entre dispositivos para project/client.

---

## 3. Edge Functions

### `send_client_sms`

| | |
|---|---|
| **Path** | `supabase/functions/send_client_sms/index.ts` (~190 LOC) |
| **HTTP** | POST |
| **Auth** | JWT (`UserMiddleware`) + capability `messaging.send` |
| **Input** | `{ conversation_id?, contact_id?, deal_id?, body?, media_urls?[] }` |
| **Lógica** | 1) Valida permiso y settings SMS 2) Resuelve/crea conversación `client` 3) `sendTwilioSms()` 4) `insertSmsMessage()` vía service_role 5) Retorna `{ message, conversation }` |
| **Side effects** | Twilio API, INSERT message, trigger actualiza `last_message_at`, Realtime broadcast |
| **Errores** | try/catch → 400 JSON; Twilio errors propagados como mensaje |
| **Tests** | ❌ NO EXISTEN |

### `twilio_inbound_sms`

| | |
|---|---|
| **Path** | `supabase/functions/twilio_inbound_sms/index.ts` (~143 LOC) |
| **HTTP** | POST (form-urlencoded Twilio) |
| **Auth** | Firma Twilio (+ fallback AccountSid — ver bug) |
| **Input** | `From`, `To`, `Body`, `MessageSid`, `NumMedia`, `MediaUrl0..N` |
| **Lógica** | 1) Lookup org por número `To` 2) Valida firma 3) `ensureClientConversation(from)` 4) Dedupe por `external_id` 5) Mirror MMS a Storage 6) `insertSmsMessage(inbound)` 7) TwiML vacío |
| **Side effects** | INSERT message, posible INSERT conversation, Storage upload |
| **Errores** | 403/404/500; log `console.error` |
| **Tests** | ❌ NO EXISTEN |

### `messaging_settings`

| | |
|---|---|
| **Path** | `supabase/functions/messaging_settings/index.ts` (~71 LOC) |
| **HTTP** | POST `{ action: "get" \| "update", ... }` |
| **Auth** | JWT; `update` requiere org administrator |
| **Input get** | `{ action: "get" }` |
| **Input update** | Twilio fields + `sms_enabled`; `keepExistingToken` si auth token vacío |
| **Output** | `MessagingSettingsPublic` (sin token; `has_auth_token`, `webhook_url`) |
| **Tests** | ❌ NO EXISTEN |

### `postmark`

**NO aplica a Messages** — inbound email → contact notes. Documentado aquí solo para evitar confusión.

### Shared helpers

- `_shared/messagingConversations.ts` — CRUD conversaciones/mensajes SMS (service_role)
- `_shared/messagingSettings.ts` — settings CRUD, `findOrgByTwilioPhone` (scan all enabled orgs)
- `_shared/twilio.ts` — send + signature validation
- `_shared/twilioMedia.ts` — inbound MMS mirror

**Bug en `findContactByPhone`:** carga **todos** los contactos de la org y filtra en memoria (`messagingConversations.ts:27-38`) — O(n) por inbound SMS.

---

## 4. Frontend — UI y componentes

### Montaje en router

- Ruta: `/messages` en `src/lbs/LbsCustomRoutes.tsx:94-100`
- Guard: `<ProtectedRoute resource="conversations" action="list">`
- Provider global: `withLbsMessagesProvider` envuelve layout CRM (`CRM.tsx:29`) → `MessagesQuickAccessProvider` (dock, notificaciones, draft SMS)
- Sidebar: `src/lbs/navigation.ts` — item Messages con badge
- Solo modo LBS (`isLbsMode()`)

### Inventario de archivos (`src/lbs/messages/` — 37 archivos)

| Archivo | LOC | Propósito |
|---|---:|---|
| `MessagesPage.tsx` | 92 | Página `/messages`; orquesta inbox + thread |
| `MessagesWorkspace.tsx` | 131 | Layout split inbox/chat |
| `MessagesInboxPanel.tsx` | 268 | Lista conversaciones + búsqueda básica |
| `ConversationThread.tsx` | 261 | Thread + bubbles + composers |
| `ConversationListItem.tsx` | 92 | Item de inbox |
| `ConversationChatHeader.tsx` | 96 | Header del chat |
| `ClientSmsComposer.tsx` | 267 | Composer SMS + MMS upload |
| `MessagesDock.tsx` | 260 | Dock flotante + badge unread |
| `MessagesQuickAccessProvider.tsx` | 163 | Context: dock, drafts, read state |
| `MessagesNotificationsLayer.tsx` | 228 | Realtime → toast/sound/desktop |
| `useInboxConversations.ts` | 217 | Data fetching inbox (multi-query) |
| `useConversationMessages.ts` | 61 | Mensajes + Realtime por conversación |
| `useMessagesInboxRealtime.ts` | 38 | Realtime global INSERT messages |
| `useMessagesUnreadCounts.ts` | 36 | Badge unread |
| `messagesUnreadUtils.ts` | 50 | Lógica read/unread |
| `messagesReadStorage.ts` | 20 | localStorage lastRead |
| `useMarkConversationRead.ts` | 104 | DB last_read_at (solo team_dm) |
| `useClientSms.ts` | 62 | sendClientSms + find conversation |
| `useDirectMessage.ts` | 97 | Crear/abrir DM |
| `NewDirectMessageDialog.tsx` | 190 | UI nuevo DM |
| `NewClientSmsDialog.tsx` | 192 | UI nuevo SMS |
| `OpenClientSmsButton.tsx` | 61 | Botón desde contacto/deal |
| `ProjectTeamChat.tsx` | 32 | Tab messages en deal |
| `useEnsureProjectConversation.ts` | 130 | Auto-crear conversación project |
| `scopedMessaging.ts` | 60 | Filtro frontend scoped users |
| `conversationDisplay.ts` | 149 | Labels, links a deal |
| `conversationUtils.ts` | 49 | Sort, format time |
| `messageContactUtils.ts` | 43 | Nombre contacto, teléfono SMS |
| `smsMediaUpload.ts` | 49 | Upload MMS outbound → bucket público |
| `SmsWebFormPicker.tsx` | 92 | Insertar link form en SMS |
| `MessagesIncomingBanner.tsx` | 74 | Banner mensaje entrante |
| `messagingDesktopNotifications.ts` | 57 | OS notifications |
| `messageNotificationSound.ts` | 34 | Audio alert |
| `messagesRealtimeCache.ts` | 77 | Invalidación React Query cache |
| `messagesQuickAccessContext.ts` | 36 | Context types |
| `withLbsMessagesProvider.tsx` | 25 | HOC provider |
| `useMessagingEnabled.ts` | 17 | Flag SMS enabled |

**Settings relacionados:** `src/lbs/settings/MessagingSettingsSection.tsx` (Twilio config UI).

### Flujos end-to-end

#### 1. Usuario abre `/messages`

```
MessagesPage
  → useInboxConversations() [hasta 6 queries paralelas: participants, project convos, client convos, getMany, deals, contacts, dm participants, members]
  → auto-selecciona primera conversación (useEffect MessagesPage.tsx:43-49)
  → MessagesWorkspace renderiza inbox + thread
```

#### 2. Usuario selecciona conversación

```
onSelectConversation → viewConversation() [context: activeConversationId, mark read localStorage]
  → ConversationThread
  → useConversationMessages(conversationId) [getList perPage:300]
  → useMarkConversationRead (solo team_dm → DB)
  → markConversationRead localStorage (project/client)
  → subscribe Realtime channel conversation_messages:{id}
```

#### 3. Usuario envía mensaje interno (project/DM)

```
ConversationThread.handleSubmit
  → useCreate("conversation_messages", { channel: internal, direction: outbound })
  → PostgREST INSERT (RLS: user_can_access + messaging.send)
  → Trigger actualiza last_message_at
  → Realtime INSERT → useConversationMessages handleInsert → cache update
```

#### 4. Usuario envía SMS

```
ClientSmsComposer.handleSend
  → uploadSmsMedia() × N files → supabase.storage attachments (public URL)
  → dataProvider.sendClientSms() → Edge send_client_sms
  → Twilio API POST Messages.json
  → insertSmsMessage (service_role)
  → Response → appendConversationMessageToCache + refetch
```

#### 5. SMS inbound (Twilio → UI)

```
Twilio POST twilio_inbound_sms
  → validate signature (+ fallback AccountSid)
  → ensureClientConversation(from phone)
  → dedupe external_id
  → mirror MMS → attachments bucket
  → insertSmsMessage(inbound, author_member_id: null)
  → Realtime INSERT
  → useMessagesInboxRealtime / useConversationMessages
  → MessagesNotificationsLayer (toast/sound/desktop si tab oculta o no en thread)
  → Badge unread recalculado (localStorage)
```

---

## 5. Realtime / live updates

| Pregunta | Respuesta |
|---|---|
| ¿Mensajes sin refresh? | ✅ Sí, vía Supabase Realtime `postgres_changes` INSERT en `conversation_messages` |
| Mecanismo | Channels: `conversation_messages:{id}` (thread) + `messages_inbox_dock` (global) |
| LISTEN/NOTIFY manual | ❌ No — solo Realtime publication |
| "Está escribiendo..." | ❌ NO EXISTE |
| Online/offline | ❌ NO EXISTE |
| Latencia típica | ~1–3 s (Postgres → Realtime → React Query cache); no medido formalmente |
| Cleanup subscriptions | ✅ `removeChannel` en cleanup de `useEffect` (`useConversationMessages.ts:55-57`, `useMessagesInboxRealtime.ts:34-36`) |

**Race condition menor:** outbound SMS vía edge function actualiza cache manualmente **y** Realtime puede duplicar append si no deduplica por `id` (cache helper debería merge by id — verificar `messagesRealtimeCache.ts`).

---

## 6. Permisos y seguridad

### Quién ve qué conversaciones

| Capa | Lógica |
|---|---|
| **Frontend** | `scopedMessaging.ts` filtra por deals asignados para preset `user` |
| **RLS `conversations`** | `can_view_conversation(id)` — scoped por deal/participant/share |
| **RLS `conversation_messages`** | `user_can_access_conversation()` — **más permisivo**, no respeta scope de deal |

**Bug crítico:** Usuario scoped que conozca un `conversation_id` de proyecto ajeno puede leer/escribir mensajes vía PostgREST directo aunque no vea la conversación en inbox.

**Bug producción SMS:** `user_can_access_conversation` sin `client` → mensajes SMS posiblemente inaccesibles excepto para `created_by_member_id` o participantes explícitos.

### Quién puede enviar

- Capability `messaging.send` — UI (`useMemberCapability`) + RLS WITH CHECK en INSERT messages + edge `send_client_sms`
- Preset `read_only` → deny send (permission catalog)
- Preset `user` → send allowed

### Mensajes privados / notas internas

❌ NO EXISTE — todo en `conversation_messages` es visible para quien pasa RLS. No hay flag `internal_note` ni separación cliente/equipo en SMS threads.

### Multi-tenant

- Todas las policies anclan `org_id = current_user_org_id()`
- Edge functions validan org del member JWT
- Twilio webhook resuelve org por número destino

### Auditoría

❌ NO EXISTE — sin log de envíos/borrados/edición (DELETE permitido por RLS pero no usado en UI).

### Attachments

- Bucket `attachments` es **público** (`init_db.sql:558` — `public: true`)
- Storage policies: cualquier `authenticated` puede SELECT/INSERT/DELETE en bucket
- URLs MMS son **public URLs** — cualquiera con el link accede (`smsMediaUpload.ts:15-16`, `twilioMedia.ts:52-53`)

### XSS

`ConversationThread.tsx:57` renderiza `message.body` con `whitespace-pre-wrap` **sin sanitizar**. SMS inbound de clientes es vector potencial (React escapa HTML por defecto en texto, pero no hay linkificación segura ni bloqueo de unicode tricks).

### CSRF

Edge functions usan JWT Bearer / Twilio signature — CSRF clásico no aplica a API JSON autenticada.

---

## 7. Features existentes — inventario

### Conversaciones

| Feature | Estado |
|---|---|
| Conversaciones con cliente (SMS Twilio) | ✅ |
| Conversaciones internas team DM | ✅ |
| Conversaciones por proyecto/deal | ✅ |
| Conversaciones grupales (>2 participantes) | ❌ (solo 1:1 DM) |
| Asignar conversación a User | ❌ |
| Etiquetas/tags en conversaciones | ❌ |
| Estados: abierta, cerrada, en espera, urgente | ❌ |
| Marcar leído/no leído | ⚠️ localStorage + partial DB (DM only) |
| Archivar conversación | ❌ |
| Búsqueda full text en mensajes | ❌ |
| Filtros (sin leer, asignadas a mí, etc.) | ❌ |

### Mensajes

| Feature | Estado |
|---|---|
| Adjuntar imágenes | ⚠️ MMS SMS only |
| Adjuntar archivos | ⚠️ MMS parcial (1 archivo guardado en DB) |
| Formato (bold, italic, links) | ❌ plain text |
| Reacciones emoji | ❌ |
| Citar/responder mensaje | ❌ |
| Editar mensaje enviado | ❌ |
| Borrar mensaje | ❌ (RLS permite DELETE, sin UI) |
| Marcar importante | ❌ |
| @menciones | ❌ |
| Notas internas (cliente no ve) | ❌ |
| "Está escribiendo..." | ❌ |
| Read receipts | ❌ |
| Delivery receipts (Twilio) | ❌ |

### Plantillas y automatización

| Feature | Estado |
|---|---|
| Plantillas reutilizables | ❌ |
| Variables `{{client_name}}` | ❌ |
| Plantillas EN/ES | ❌ |
| Auto-responder fuera de horario | ❌ |
| Bot por keywords | ❌ |
| Programar envío | ❌ |
| Secuencias follow-up | ❌ |

### Integraciones

| Feature | Estado |
|---|---|
| SMS Twilio | ✅ |
| MMS Twilio | ⚠️ |
| WhatsApp Business | ❌ |
| Email unificado | ❌ |
| Llamadas voz Twilio | ❌ |
| Voicemail | ❌ |
| Webhooks externos | ❌ |

### AI

| Feature | Estado |
|---|---|
| Resumen conversación | ❌ |
| Sugerencias respuesta | ❌ |
| Traducción EN↔ES | ❌ |
| Detección sentimiento | ❌ |
| Categorización automática | ❌ |

### Reportes

| Feature | Estado |
|---|---|
| Tiempo respuesta promedio | ❌ |
| Mensajes por User | ❌ |
| Conversaciones cerradas vs abiertas | ❌ |
| Volumen por canal | ❌ |

---

## 8. Bugs y problemas conocidos

| # | Severidad | Descripción | Referencia |
|---|---|---|---|
| 1 | **CRÍTICO** | RLS split: `can_view_conversation` (scoped) vs `user_can_access_conversation` (permisivo en messages) | Migraciones `20260630230000` vs `20260522223653` |
| 2 | **CRÍTICO** | Producción: `user_can_access_conversation` sin `type='client'` → SMS threads rotos para mayoría de usuarios | SQL prod verificado 2026-05-22 |
| 3 | **ALTO** | Webhook acepta requests sin firma válida si AccountSid coincide | `twilio_inbound_sms/index.ts:74-85` |
| 4 | **ALTO** | Twilio auth token plain text en DB | `organization_messaging_settings` |
| 5 | **ALTO** | MMS/attachments en bucket público sin auth en URL | `smsMediaUpload.ts:15`, init storage |
| 6 | **MEDIO** | Unread badge depende de localStorage — desincroniza entre dispositivos | `messagesReadStorage.ts`, `useMarkConversationRead.ts:11-12` |
| 7 | **MEDIO** | `findContactByPhone` O(n) todos los contactos por SMS inbound | `messagingConversations.ts:27-38` |
| 8 | **MEDIO** | `findOrgByTwilioPhone` scan lineal de orgs SMS enabled | `messagingSettings.ts:93-108` |
| 9 | **MEDIO** | Sin paginación: 200 convos + 300 msgs/thread | `useInboxConversations.ts:51-75`, `useConversationMessages.ts:23` |
| 10 | **BAJO** | XSS/link injection en body SMS (mitigado parcialmente por React text escape) | `ConversationThread.tsx:57` |
| 11 | **BAJO** | Outbound MMS: solo `media_urls[0]` persistido | `send_client_sms/index.ts:168` |
| 12 | **INFO** | Canal `whatsapp` en schema sin implementación | `conversations.sql:47` |
| 13 | **INFO** | `module_permissions IS NULL` → `current_member_has_capability` retorna true (legacy permissive) | `20260522223653:29-31` |

**TODOs/FIXMEs en código del módulo:** ninguno encontrado (grep vacío en `src/lbs/messages/`).

---

## 9. Performance

| Área | Observación |
|---|---|
| Carga inicial `/messages` | 6+ requests HTTP secuenciales/paralelos vía React Query; sin skeleton optimizado por sección |
| Paginación inbox | ❌ Carga hasta 200 conversaciones (`perPage: 200`) |
| Paginación thread | ❌ Carga hasta 300 mensajes (`perPage: 300`) |
| Índices | Adecuados para queries actuales `(conversation_id, created_at)` y `last_message_at` |
| Índice faltante potencial | `conversation_messages(external_id)` para dedupe lookup (webhook hace SELECT por external_id) |
| N+1 | Inbox: list participants + list project + list client + getMany + getMany deals/contacts/members |
| Bundle / code splitting | `MessagesPage` import estático en `LbsCustomRoutes.tsx` — **sin lazy load** |
| Realtime cleanup | ✅ Correcto en hooks principales |
| Twilio en UI path | SMS outbound: edge function async; UI bloquea con `isSending` — aceptable |

---

## 10. Comparación con competencia

| Capacidad | Front | Intercom | Missive | Twilio Flex | **Nomi hoy** |
|---|---|---|---|---|---|
| Bandeja omnicanal (email/SMS/chat) | ✅ | ✅ | ✅ (email-first) | ✅ | ⚠️ SMS + chat interno |
| Asignación + colaboración en thread | ✅ | ✅ | ✅ | ✅ | ❌ |
| Notas internas | ✅ | ✅ | ✅ | ✅ | ❌ |
| Plantillas + variables | ✅ | ✅ | ✅ | ✅ | ❌ |
| SLA / tiempo respuesta | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Automations / bots | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| WhatsApp | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Mobile app | ✅ | ✅ | ✅ | ✅ | ❌ (PWA only) |
| AI assist | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| Integración CRM deals | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ nativo |

**Para LBS (agencia → contractors latinos):** lo más valioso que la competencia tiene y Nomi no: **comunicación bilingüe con plantillas**, **historial unificado por cliente/proyecto**, **notas internas en SMS threads**, **asignación clara de quién responde**, y **métricas de seguimiento** (tiempo hasta primera respuesta).

---

## 11. Archivos clave

| # | Archivo | LOC | Propósito | Estado |
|---|---|---:|---|---|
| 1 | `src/lbs/messages/MessagesPage.tsx` | 92 | Página principal `/messages` | OK — falta lazy load |
| 2 | `src/lbs/messages/useInboxConversations.ts` | 217 | Fetch inbox multi-query | Needs refactor — N+1, no pagination |
| 3 | `src/lbs/messages/ConversationThread.tsx` | 261 | Thread UI + send internal | OK — XSS review |
| 4 | `src/lbs/messages/ClientSmsComposer.tsx` | 267 | Composer SMS/MMS | OK |
| 5 | `src/lbs/messages/MessagesDock.tsx` | 260 | Dock + badge | OK |
| 6 | `src/lbs/messages/MessagesNotificationsLayer.tsx` | 228 | Notificaciones realtime | OK |
| 7 | `src/lbs/messages/useConversationMessages.ts` | 61 | Messages + realtime | OK — add pagination |
| 8 | `src/lbs/messages/scopedMessaging.ts` | 60 | Filtro scoped frontend | OK — must mirror RLS fix |
| 9 | `src/lbs/messages/messagesUnreadUtils.ts` | 50 | Unread logic | Bugs — localStorage drift |
| 10 | `src/lbs/messages/smsMediaUpload.ts` | 49 | MMS upload | Needs refactor — public bucket |
| 11 | `src/lbs/settings/MessagingSettingsSection.tsx` | ~185 | Twilio settings UI | OK |
| 12 | `supabase/functions/send_client_sms/index.ts` | 190 | Outbound SMS | OK |
| 13 | `supabase/functions/twilio_inbound_sms/index.ts` | 143 | Inbound webhook | **Bugs** — signature fallback |
| 14 | `supabase/functions/_shared/messagingConversations.ts` | 170 | Shared CRUD | Needs refactor — O(n) contact lookup |
| 15 | `supabase/migrations/20260629230000_conversations.sql` | 231 | Schema base | OK |
| 16 | `supabase/migrations/20260630230000_user_preset_scope_and_messaging.sql` | 167 | Scoped RLS conversations | **Incomplete** — didn't update messages fn |
| 17 | `supabase/migrations/20260629300000_twilio_messaging.sql` | 102 | Twilio + client type | OK in repo — drift in prod |
| 18 | `src/components/atomic-crm/providers/supabase/dataProvider.ts` | ~1384+ | Edge invocations | OK |
| 19 | `src/lbs/LbsCustomRoutes.tsx` | — | Route `/messages` | OK |
| 20 | `src/lib/permissions/permissionCatalog.ts` | — | `messaging.send` capability | OK |

---

## 12. Resumen ejecutivo

El módulo Messages es **funcional pero inmaduro**: cubre chat interno por proyecto/DM, SMS saliente/entrante vía Twilio, dock flotante, realtime básico y notificaciones in-app/desktop. Está en uso real pero con **volumen mínimo** (4 conversaciones, 30 mensajes en producción). La arquitectura es razonable (Postgres + RLS + Edge Functions + Supabase Realtime), pero hay **deuda crítica de seguridad en RLS** (`can_view_conversation` vs `user_can_access_conversation` desalineados), **drift de migraciones en producción** (función `user_can_access_conversation` sin tipo `client`), credenciales Twilio en **texto plano**, attachments MMS en bucket **público**, y **cero paginación** en inbox/thread. No hay email unificado, WhatsApp, plantillas, asignación, estados de conversación, ni reportes.

**Top 3 bugs/problemas críticos:**
1. **RLS split + bypass de scope**: `conversations` usa `can_view_conversation` (scoped por deal); `conversation_messages` sigue usando `user_can_access_conversation` (cualquier miembro del org ve mensajes de **todos** los proyectos si conoce `conversation_id`). En producción además falta `type = 'client'` en esa función → hilos SMS probablemente ilegibles para usuarios que no crearon la conversación.
2. **Webhook Twilio con fallback inseguro**: si la firma HMAC falla pero `AccountSid` coincide, el webhook se acepta igual (`twilio_inbound_sms/index.ts:74-85`).
3. **Credenciales Twilio en plain text** en `organization_messaging_settings.twilio_auth_token` (sin cifrado, sin RLS para `authenticated`).

**Top 5 features más valiosas que faltan (para LBS / contractors latinos):**
1. Bandeja unificada SMS + email + WhatsApp con historial por contacto/proyecto.
2. Plantillas bilingües (EN/ES) con variables (`{{client_name}}`, `{{project_name}}`).
3. Asignación de conversación + estados (abierta/cerrada/en espera) + filtros de inbox.
4. Notas internas en el thread (visibles solo al equipo, no al cliente SMS).
5. Delivery/read receipts y reportes de tiempo de respuesta.

**Esfuerzo estimado para “production-grade”:** 4–8 semanas (1 dev senior), asumiendo: unificar RLS, paginación, cifrado de secrets, hardening webhook, plantillas básicas, notas internas, y bandeja con filtros. Email/WhatsApp unificado añadiría 4+ semanas adicionales.

**Recomendación:** **Refactorizar lo existente**, no reescribir. El modelo de datos (`conversations` / `conversation_messages`) es sólido; el problema principal es la capa de permisos y gaps de producto, no la elección de stack.

---

## Apéndice A — Migraciones relacionadas

| Migración | Contenido |
|---|---|
| `20260629230000_conversations.sql` | Tablas + RLS inicial + Realtime |
| `20260629240000_conversations_rls_fix.sql` | Fix recursión RLS |
| `20260629300000_twilio_messaging.sql` | Twilio settings + client conversations |
| `20260629310000_conversation_messages_realtime.sql` | replica identity full |
| `20260629320000_conversation_messages_media.sql` | columna `media_url` |
| `20260522223653_member_capability_messaging_send.sql` | `messaging.send` en RLS messages |
| `20260630230000_user_preset_scope_and_messaging.sql` | `can_view_conversation` scoped |

## Apéndice B — Conteos producción (2026-05-22)

| Tabla | Filas |
|---|---:|
| `conversations` | 4 |
| `conversation_messages` | 30 |
| `conversation_participants` | 3 |
| `organization_messaging_settings` | 1 (SMS enabled) |

---

## Metadatos de auditoría

| Campo | Valor |
|---|---|
| **Fecha** | 2026-05-22 |
| **Commit** | `04f4180c31b88511aa56e1eead1c347e98660c22` |
| **Herramientas** | Lectura de código fuente (`src/lbs/messages/`, edge functions, migraciones SQL), grep (TODO/patterns), `wc -l`, Supabase MCP (`execute_sql` policies/indexes/counts/func defs en producción), referencia cruzada con `SYSTEM_AUDIT.md` |

### Preguntas abiertas

1. **¿Cuánto cuesta Twilio hoy?** — Requiere acceso al dashboard Twilio de LBS; no hay telemetría en app.
2. **¿La migración `20260630230000` está aplicada en todos los entornos?** — Producción tiene `can_view_conversation` pero **no** la versión actualizada de `user_can_access_conversation` con `client`.
3. **¿Hay conversaciones SMS en prod con `deal_id` null?** — Scoped users no las verían; requiere query adicional.
4. **¿Duplicados Realtime en cache?** — Revisar `messagesRealtimeCache.ts` dedupe by id bajo carga concurrente.
5. **¿Política de retención/archivo de mensajes?** — No definida; tabla crecerá indefinidamente.
6. **¿FakeRest emula messaging completo?** — REQUIERE INVESTIGACIÓN ADICIONAL en data generators.

---

*Fin del reporte.*
