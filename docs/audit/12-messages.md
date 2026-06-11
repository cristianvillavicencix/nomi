# Messages

## 1. Purpose

Team DMs and client SMS conversations: inbox, thread view, templates, realtime updates, unread counts, quick-access dock. Optional voice dialer UI (stub).

## 2. Files & components

| Kind | Path |
|------|------|
| Route | `/messages` — lazy `MessagesPage` in `LbsCustomRoutes.tsx` |
| Core | `src/lbs/messages/` — inbox, workspace, thread, composer, realtime |
| Providers | `withLbsMessagesProvider`, `MessagesQuickAccessProvider` |
| Read state | `useMarkConversationRead.ts`, `persistConversationRead.ts` |
| Dialer stub | `src/lbs/messages/dialer/DialerPanel.tsx` |
| Settings | `MessagingSettingsSection` (Settings tab) |

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `conversations`, `conversation_participants`, `conversation_messages` | Thread CRUD, unread |
| `message_templates` | SMS templates |
| `voice_calls` | Schema for voice (unused in UI) |
| RPC | `ensure_project_conversation` |

## 4. External services

| Service | Usage |
|---------|--------|
| **Twilio** | Outbound SMS (`send_client_sms`), inbound webhook (`twilio_inbound_sms`) |
| **Supabase Realtime** | Live message updates |
| **Meta WhatsApp** | Stub only — `send_whatsapp`, `whatsapp_inbound` (**DORMANT**) |
| **Twilio Voice** | Stub — `voice_token`, `voice_status_webhook` (**DORMANT**) |

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Links to | Contacts | Client conversations keyed by phone |
| Links to | Deals | Optional `deal_id` on conversations |
| Links to | Forms v2 | SMS form picker uses `upload_form_file` |
| Settings | Messaging | Twilio credentials via `messaging_settings` edge function |

## 6. Edge functions used by this module

| Function | Invoked from | Purpose |
|----------|--------------|---------|
| `send_client_sms` | `dataProvider.sendClientSms()` | Outbound client SMS |
| `messaging_settings` | `dataProvider` get/update/test | Twilio config |
| `twilio_inbound_sms` | **Webhook** (Twilio) | Inbound SMS |
| `upload_form_file` | Form attachment in SMS composer | File upload |

**DORMANT — pending Meta appeal (not deletion candidates):**

| Function | Status |
|----------|--------|
| `send_whatsapp` | Returns 503; intentional stub |
| `whatsapp_inbound` | Webhook shell; logs only |
| `voice_token` | Returns 503; `DialerPanel` UI disabled |
| `voice_status_webhook` | Twilio webhook shell |

## 7. Status: PARTIAL

SMS + team chat **WORKING** when Twilio is configured. Voice and WhatsApp are **DORMANT** stubs.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| MEDIUM | `DialerPanel.tsx` | Call button disabled | Comment: UI until `voice_token` configured; edge returns 503 |
| LOW | Realtime | Missed live updates if publication off | Depends on Supabase Realtime on `conversation_messages` |
| LOW | Desktop only | No messages on mobile admin shell | `renderLbsCustomRoutes()` not in `MobileAdmin` |

## 9. Broken connections

- Voice: UI exists but no working `voice_token` integration.
- WhatsApp: settings may exist but product path is blocked pending Meta appeal.
