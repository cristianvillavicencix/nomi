# Re-auditoría del módulo Messages — POST-Codex changes

> Auditoría exhaustiva del estado **actual** del módulo Messages en Nomi CRM (modo LBS), comparada con `MESSAGES_AUDIT.md`.  
> **Solo análisis — ningún bug de Messages fue corregido en esta sesión** (sí se limpiaron errores ESLint del repo y duplicados accidentales `* 2.tsx`).

---

## Sección 1 — Diff post-Codex

### Metodología git (Paso 0)

```bash
git log --oneline -30 -- src/lbs/messages/ ...
git log --pretty=format:"%h | %an | %s | %ad" --date=short -50 -- src/lbs/messages/
git diff bba6062..HEAD -- src/lbs/messages/
git diff --name-only bba6062..HEAD
```

**Commit de referencia Claude Code (último del rediseño Messages):** `bba6062`  
**HEAD al auditar:** `a21801d3f69c376286cd84cf3ee446f41c33c96e`

### Commits posteriores a `bba6062` que tocaron Messages

| Commit | Autor | Fecha | Resumen |
|---|---|---|---|
| `4f3ac06` | cristianvillavicencix (+ Co-authored Cursor) | 2026-05-23 | **feat(lbs): agency project workspace, messaging hardening, contractor split** — cambios grandes en Messages |
| `1917b27` | cristianvillavicencix | 2026-05-23 | **cha** — añadió archivos duplicados `* 2.tsx` (artefacto Codex) |
| `a21801d` | cristianvillavicencix | 2026-05-23 | chore: prettier/eslint (sin lógica Messages) |

**Nota:** No hay commits con autor "Codex" explícito. Los cambios post-`bba6062` atribuibles a otro agente son **`4f3ac06`** (Co-authored Cursor) y **`1917b27`** (duplicados).

### Archivos Messages modificados (`bba6062..HEAD`)

52 archivos, **+2446 / −687** líneas en `src/lbs/messages/`.

**Cambios significativos detectados:**

| Área | Archivo | Qué cambió |
|---|---|---|
| **Realtime / cache** | `useConversationMessages.ts` | Paginación local (`olderMessages`), sort **ASC → DESC**, hook `loadOlder` vía Supabase directo |
| **Realtime / cache** | `messagesRealtimeCache.ts` | Añadió `touchConversationLists` + `patchConversationInList`; query key interno sigue en **ASC** |
| **Unread** | `messagesReadStorage.ts` | **ELIMINADO** — ya no hay localStorage |
| **Unread** | `persistConversationRead.ts`, `useMarkConversationRead.ts` | Read state **100% DB** (`conversation_participants.last_read_at`) para todos los tipos |
| **Unread** | `useMessagesUnreadCounts.ts` | Solo DB via `participations` |
| **Notificaciones** | `MessagesNotificationsLayer.tsx` | Comentarios/toast logic ajustados; sigue montado globalmente |
| **Inbox** | `useInboxConversations.ts` | Refactor grande: `pageSize` 30, filtros scoped, menos `perPage: 200` |
| **UI redesign** | `MessagesPage`, `MessagesWorkspace`, `inbox/*`, `context/*` | Hub con tabs, filtros, context panel |
| **Artefactos Codex** | `* 2.tsx` (5 archivos) | Duplicados añadidos en `1917b27` — **eliminados en esta sesión** al limpiar ESLint |

### Qué NO tocó Codex/post-bba6062

- Edge functions `twilio_inbound_sms`, `send_client_sms` (sin diff en este rango)
- Migraciones RLS hotfix `#1` (`20260630260000`) — ya aplicadas antes
- `messageNotificationSound.ts`, `messagingDesktopNotifications.ts` — sin cambios funcionales relevantes

---

## Sección 2 — Estado feature-by-feature

| Feature | Estado audit original (`MESSAGES_AUDIT.md`) | Estado actual | ¿Cambió? | ¿Funciona? |
|---|---|---|---|---|
| Realtime mensajes nuevos (thread abierto) | ✅ funciona | ❌ **regresión reportada** | **Sí** (`4f3ac06` sort DESC + cache) | Inbound SMS no aparece sin refresh |
| Realtime global inbox | ✅ `useMessagesInboxRealtime` | ⚠️ montado pero depende del mismo cache | Sí | Parcial — invalida listas pero merge roto |
| Badge unread sidebar | ⚠️ híbrido localStorage + DB | ✅ solo DB | **Sí** (mejora arquitectural) | ⚠️ no reacciona en tiempo real |
| Badge dock flotante | ✅ | ✅ misma fuente `useMessagesUnreadCounts` | No | ⚠️ mismo bug que sidebar |
| Mark as read | ⚠️ solo `team_dm` en DB | ✅ todos los tipos vía `persistConversationRead` | **Sí** (mejora) | ✅ al abrir conversación |
| Toast in-app | ✅ `MessagesNotificationsLayer` | ⚠️ montado globalmente | Menor | ❌ no dispara si realtime/cache falla |
| Sonido | ✅ Web Audio API | ✅ sin cambios | No | ❌ bloqueado sin user gesture + sin evento |
| Desktop/OS notification | ✅ opt-in Settings | ✅ sin cambios | No | ❌ requiere permiso previo en Settings |
| RLS unificado | ❌ bug crítico (audit) | ✅ `can_view_conversation` unificado | **Sí** (hotfix migración) | ✅ verificado prod SQL |
| Twilio inbound insert | ✅ | ✅ mensajes inbound en DB | No | ✅ (`author_member_id IS NULL`, `deleted_at NULL`) |
| Paginación thread | ❌ hasta 300 msgs | ⚠️ parcial (50 + loadOlder) | **Sí** | ⚠️ loadOlder bypass React Query |
| Paginación inbox | ❌ hasta 200 | ⚠️ 30 por tipo + getMany | **Sí** | OK para volúmenes actuales |
| localStorage read map | ⚠️ drift cross-device | ❌ eliminado | **Sí** | ✅ resuelto |
| Archivos duplicados `* 2.tsx` | — | ❌ existían (Codex) | **Sí** | N/A — eliminados en ESLint cleanup |
| WhatsApp / Voice shells | — | ✅ shells sin lógica | Nuevo | N/A |

---

## Sección 3 — Causa raíz del problema 1 (realtime roto)

### Veredicto: **Hipótesis E (cache React Query incompatible) — culpable principal**

Evidencia en cadena:

#### 1. Regresión introducida en `4f3ac06`

`useConversationMessages.ts` cambió el sort de la query principal:

```38:39:src/lbs/messages/useConversationMessages.ts
      pagination: { page: 1, perPage: PAGE_SIZE },
      sort: { field: "created_at", order: "DESC" },
```

Antes (pre-`4f3ac06`): `order: "ASC"`. El helper de cache **no fue actualizado**:

```13:16:src/lbs/messages/messagesRealtimeCache.ts
const CONVERSATION_MESSAGES_LIST_PARAMS = {
  pagination: { page: 1, perPage: 50 },
  sort: { field: "created_at", order: "ASC" as const },
};
```

#### 2. `mergeMessageIntoList` asume orden ASC (append al final)

```55:58:src/lbs/messages/messagesRealtimeCache.ts
  return {
    ...old,
    data: [...old.data, message],
    total: old.total + 1,
```

Con cache **DESC** (newest-first desde API), append al final coloca el mensaje nuevo en la posición del mensaje **más antiguo**, no del más reciente.

#### 3. `useConversationMessages` invierte el array para display cronológico

```43:44:src/lbs/messages/useConversationMessages.ts
  const messages = useMemo(() => {
    const merged = [...olderMessages, ...[...latestMessages].reverse()];
```

Tras append incorrecto + reverse, el inbound puede:
- Aparecer **arriba** del thread (fuera del scroll habitual abajo), o
- No integrarse visualmente si el usuario está scrolleado al final esperando el bubble abajo

**Comportamiento usuario:** “no aparece hasta salir y volver” — consistente con **refetch completo al remount** que trae orden correcto desde servidor, bypassing el cache merge roto.

#### 4. `refreshConversationLists` no compensa de forma fiable

```120:122:src/lbs/messages/messagesRealtimeCache.ts
export const refreshConversationLists = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
};
```

Se llama tras cada INSERT (`useConversationMessages.ts:101`, `useMessagesInboxRealtime.ts:29`) pero:
- Solo invalida `conversations`, **no** `conversation_messages`
- Depende de refetch async; el merge incorrecto puede renderizar antes del refetch
- Race: merge malo → UI stale → usuario no ve mensaje

### Hipótesis descartadas o secundarias

| Hipótesis | Veredicto | Evidencia |
|---|---|---|
| **A — RLS bloquea realtime inbound** | ❌ Descartada para admin/non-scoped | Policy prod: `deleted_at IS NULL AND user_can_access_conversation(...)`. Inbound rows existen (`id=36`, `author_member_id=null`). RLS unificado incluye `type='client'` |
| **B — Publication / replica identity** | ❌ Descartada | `conversation_messages` ∈ `supabase_realtime`, `relreplident=FULL` (SQL prod 2026-05-23) |
| **C — Subscription frontend rota** | ⚠️ Secundaria | Subscriptions existen y tienen cleanup correcto. El handler **sí corre** pero escribe cache incorrecto |
| **D — Sin canal global** | ❌ Descartada | Existen **3** canales globales: `messages_inbox_dock`, `messages_incoming_notifications`, + per-conversation |

### Snippet exacto del bug

**Archivo:líneas — desajuste sort + merge:**

- `useConversationMessages.ts:38-39` — query DESC
- `messagesRealtimeCache.ts:13-16` — query key ASC
- `messagesRealtimeCache.ts:55-58` — append incompatible con DESC
- Introducido en: `4f3ac06` (Co-authored Cursor)

---

## Sección 4 — Causa raíz del problema 2 (notificaciones rotas)

Las notificaciones comparten el **mismo evento Realtime INSERT** que el thread. Si el usuario reporta **ambos** rotos, hay causas adicionales específicas de notificaciones:

### 4.1 Badge sidebar / dock — ⚠️ parcialmente roto

**Montaje:** ✅ global

```172:177:src/lbs/messages/MessagesQuickAccessProvider.tsx
  return (
    <MessagesQuickAccessContext.Provider value={value}>
      {children}
      <MessagesNotificationsLayer />
      <MessagesDock />
```

**Sidebar badge:** ✅ wired

```167:167:src/components/atomic-crm/layout/SidebarLayout.tsx
  const { totalUnread: messagesUnreadCount } = useMessagesUnreadCounts();
```

**Cálculo:** ✅ solo DB (mejora vs audit original)

```14:22:src/lbs/messages/messagesUnreadUtils.ts
export const isConversationUnread = (conversation, participations) => {
  if (!conversation.last_message_at) return false;
  const readAt = getConversationReadAt(conversation.id, participations);
  if (!readAt) return true;
  return Date.parse(conversation.last_message_at) > Date.parse(readAt);
};
```

**Por qué no sube el badge en realtime:**

1. `touchConversationLists` solo parchea queries `{ queryKey: ["conversations"] }` tipo **getList**
2. `useInboxConversations` compone la lista final vía **`useGetMany`** (`useInboxConversations.ts:87-92`) — query key distinta, **no recibe el patch**
3. `refreshConversationLists` invalida `conversations` pero el unread count necesita que `last_message_at` del conversation object en cache getMany se actualice **antes** del refetch — ventana donde badge = 0

**Además:** al abrir conversación, `viewConversation` marca read inmediatamente (`MessagesQuickAccessProvider.tsx:64-67`), lo cual es correcto UX pero hace que badge baje a 0 aunque el thread no muestre el mensaje nuevo.

### 4.2 Sonido — ❌ silencioso en la práctica

```11:33:src/lbs/messages/messageNotificationSound.ts
export const playMessageNotificationSound = () => {
  const context = getAudioContext();
  ...
  void context.resume().then(() => { ... playTone ... });
};
```

- Web Audio **requiere user gesture** previo para `AudioContext.resume()` en browsers modernos
- Se invoca desde handler Realtime (`MessagesNotificationsLayer.tsx:132`) — **sin gesture**
- Si el evento Realtime llega, `resume()` puede fallar silenciosamente → sin sonido

### 4.3 Notificación SO / desktop — ❌ opt-in manual

```37:48:src/lbs/messages/messagingDesktopNotifications.ts
export const showMessagingDesktopNotification = (...) => {
  ...
  if (Notification.permission !== "granted") return;
```

Permiso solo se pide en **Settings → Desktop alerts** (`DesktopMessageAlertsSection.tsx:29-32`), no al login ni al entrar a Messages. Usuario que no fue a Settings → **nunca** verá OS notification.

### 4.4 Layer global — ✅ montado, ⚠️ lógica de filtro

`MessagesNotificationsLayer` montado en root layout vía `withLbsMessagesProvider` → `MessagesQuickAccessProvider` → ✅ correcto.

Filtro que suprime notificación si estás viendo el mismo thread:

```29:31:src/lbs/messages/MessagesNotificationsLayer.tsx
  if (String(message.conversation_id) === String(activeConversationId ?? "")) {
    return false;
  }
```

Correcto para toast/sound, pero si el thread **no renderiza** el mensaje (bug cache), el usuario tampoco recibe notificación aunque esté “en” la conversación — empeora percepción de “todo roto”.

### Resumen notificaciones

| Sub-problema | Causa raíz | Archivo:línea |
|---|---|---|
| Badge no sube | `touchConversationLists` no parchea `getMany`; invalidation async | `messagesRealtimeCache.ts:73-92`, `useInboxConversations.ts:87-92` |
| Sin sonido | AudioContext sin user gesture | `messageNotificationSound.ts:29` |
| Sin OS notification | Permiso no granted (solo Settings) | `messagingDesktopNotifications.ts:48`, `DesktopMessageAlertsSection.tsx` |
| Sin toast | Mismo handler Realtime; si INSERT no procesa o `shouldNotifyForMessage` filtra | `MessagesNotificationsLayer.tsx:166-203` |

---

## Sección 5 — Plan de corrección priorizado

### Crítico (P0)

| # | Cambio | Archivos | Complejidad | Tests |
|---|---|---|---|---|
| 1 | **Alinear sort order**: cambiar `CONVERSATION_MESSAGES_LIST_PARAMS.order` a `DESC` O mejor: eliminar query key hardcoded y usar solo predicate | `messagesRealtimeCache.ts` | **XS** | Extender `messagesRealtimeCache.test.ts` con caso DESC |
| 2 | **Fix merge para DESC**: prepend `[message, ...old.data]` cuando sort es DESC, o normalizar siempre a ASC internamente | `messagesRealtimeCache.ts` | **S** | Unit test merge DESC |
| 3 | **Invalidar también `conversation_messages`** en `refreshConversationLists` | `messagesRealtimeCache.ts` | **XS** | — |
| 4 | **Parchear getMany conversations** en `touchConversationLists` (queryKey `["conversations","getMany",...]`) | `messagesRealtimeCache.ts` | **S** | Integration manual |

### Alto (P1)

| # | Cambio | Archivos | Complejidad | Tests |
|---|---|---|---|---|
| 5 | Pre-warm AudioContext en primer click del usuario (login / open Messages) | `messageNotificationSound.ts`, `MessagesQuickAccessProvider.tsx` | **S** | Manual browser |
| 6 | Prompt suave de desktop notifications al primer inbound o al entrar `/messages` | `MessagesNotificationsLayer.tsx` o `MessagesPage.tsx` | **S** | Manual |
| 7 | Consolidar 3 canales Realtime duplicados en uno solo + fan-out local | `useConversationMessages.ts`, `useMessagesInboxRealtime.ts`, `MessagesNotificationsLayer.tsx` | **M** | Manual latency |
| 8 | Añadir `conversations` a `supabase_realtime` publication para patch `last_message_at` nativo | migración SQL | **S** | SQL verify |

### Medio (P2)

| # | Cambio | Archivos | Complejidad |
|---|---|---|---|
| 9 | Eliminar archivos duplicados restantes si reaparecen | `src/lbs/messages/**` | XS |
| 10 | Unificar `loadOlder` con React Query (misma query key) | `useConversationMessages.ts` | M |
| 11 | Tests E2E: inbound SMS → thread + badge + toast | nuevo spec | L |

---

## Sección 6 — Otros bugs descubiertos

1. **Triplicación de subscriptions Realtime** — 3 listeners INSERT en `conversation_messages` por sesión (per-thread + inbox + notifications). Desperdicio de conexiones Supabase.

2. **Artefactos Codex `* 2.tsx`** — commit `1917b27` duplicó 5 archivos Messages. Riesgo de import accidental. Eliminados en cleanup ESLint de esta sesión.

3. **`loadOlder` bypass dataProvider** — query directa Supabase con `.is("deleted_at", null)` pero `useGetList` no filtra `deleted_at` explícitamente — posible inconsistencia si soft-delete se usa.

4. **ESLint sub-check GitHub** — 89 errores preexistentes bloqueaban check cosmético `ESLint` en lint-action; **resuelto en esta sesión** (83→0 errors).

5. **Internal notes en SMS** — schema prod ahora incluye `is_internal_note` en RLS WITH CHECK; audit original decía que no existía. Documentación desactualizada, no bug funcional.

6. **`conversations` replica identity DEFAULT** — updates a `last_message_at` vía trigger no emiten payload completo en Realtime (solo messages está en publication anyway).

---

## Sección 7 — Recomendaciones arquitecturales

1. **Single source of truth para query keys Messages** — exportar factory compartida entre `useConversationMessages` y `messagesRealtimeCache`. El desajuste ASC/DESC es un anti-patrón clásico post-refactor.

2. **Un Realtime channel, múltiples reducers** — patrón event bus local en lugar de 3 `.channel()` paralelos.

3. **No mezclar Supabase directo + React Query** en `loadOlder` — rompe dedupe y invalidation.

4. **Codex/AI commits** — el commit `1917b27` ("cha") añadió duplicados sin borrar originales. Establecer regla: post-agent diff review obligatorio en `src/lbs/messages/`.

5. **Notification UX** — separar “mensaje en thread activo” (solo append UI) de “notificar” (badge + sonido si tab hidden). Hoy ambos fallan juntos por cache.

6. **Brutal honesty:** el commit `4f3ac06` mejoró arquitectura unread (DB-only) pero **rompió realtime** al cambiar sort sin actualizar cache helper — regresión evitable con un test de integración de 20 líneas.

---

## Sección 8 — Resumen ejecutivo

El módulo Messages tiene **buena arquitectura post-rediseño** (provider global, DB-only unread, RLS unificado, inbox hub moderno), pero sufrió una **regresión crítica en commit `4f3ac06`** cuando `useConversationMessages` pasó a sort DESC sin actualizar `messagesRealtimeCache.ts` (sigue ASC + merge append). Eso explica por qué **inbound SMS no aparece en el thread sin refresh** y por qué **badge/notificaciones no reaccionan** (dependen del mismo pipeline Realtime + cache de conversaciones vía getMany no parcheado). Codex/Cursor también dejó **archivos duplicados `* 2.tsx`** en commit `1917b27`. La infra Supabase (RLS, publication, inbound inserts) está **sana**. Trabajo estimado de corrección: **~1–2 días** (P0 cache fix = horas; P1 notificaciones = medio día; tests = medio día).

---

## Apéndice — Verificaciones SQL (Supabase MCP, prod)

```sql
-- Publication
SELECT pubname, tablename FROM pg_publication_tables
WHERE tablename IN ('conversation_messages', 'conversations');
-- → solo conversation_messages

-- Replica identity
SELECT relname, relreplident FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE relname IN ('conversation_messages', 'conversations');
-- → messages: FULL, conversations: DEFAULT

-- RLS policy
SELECT qual FROM pg_policies WHERE tablename = 'conversation_messages';
-- → (deleted_at IS NULL) AND user_can_access_conversation(conversation_id)

-- Inbound sample
SELECT id, conversation_id, author_member_id, direction, channel, deleted_at
FROM conversation_messages WHERE direction = 'inbound' ORDER BY created_at DESC LIMIT 5;
-- → rows OK, author_member_id NULL
```

---

## Metadatos

| Campo | Valor |
|---|---|
| **Fecha** | 2026-05-23 |
| **Commit hash** | `a21801d3f69c376286cd84cf3ee446f41c33c96e` |
| **Herramientas** | `git log/diff`, lectura estática código, Supabase MCP `execute_sql`, ESLint |
| **Test manual app** | NO EJECUTADO — sin stack local levantado ni SMS de prueba en esta sesión |

### Archivos investigados (críticos)

- `src/lbs/messages/useConversationMessages.ts`
- `src/lbs/messages/useMessagesInboxRealtime.ts`
- `src/lbs/messages/MessagesNotificationsLayer.tsx`
- `src/lbs/messages/messagesRealtimeCache.ts`
- `src/lbs/messages/MessagesDock.tsx`
- `src/lbs/messages/useMessagesUnreadCounts.ts`
- `src/lbs/messages/useMarkConversationRead.ts`
- `src/lbs/messages/persistConversationRead.ts`
- `src/lbs/messages/messagingDesktopNotifications.ts`
- `src/lbs/messages/messageNotificationSound.ts`
- `src/lbs/messages/withLbsMessagesProvider.tsx`
- `src/lbs/messages/MessagesQuickAccessProvider.tsx`
- `src/lbs/messages/useInboxConversations.ts`
- `src/components/atomic-crm/layout/SidebarLayout.tsx`
- `src/lbs/settings/DesktopMessageAlertsSection.tsx`
- `supabase/functions/twilio_inbound_sms/index.ts` (sin diff post-bba6062; referenciado)
- `MESSAGES_AUDIT.md`, `permissionCatalog.ts`, migraciones RLS

### Preguntas abiertas

1. ¿El usuario que reporta el bug es **admin** o **scoped user**? (scoped + deal no asignado podría no recibir Realtime aunque RLS esté unificado)
2. ¿Hay errores en **browser console** tipo `CHANNEL_ERROR` o `Unauthorized` en Realtime?
3. ¿El usuario habilitó **Desktop message alerts** en Settings?
4. ¿Reproducible solo en **thread abierto** o también en background tab?
5. ¿Vercel prod corre exactamente `a21801d` o un deploy anterior a `4f3ac06`?
