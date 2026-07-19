# CRM Claude Assistant

Internal chat assistant for Nomi CRM using **Claude (Anthropic Messages API + tool calling)**. Not an embed of claude.ai.

## Product defaults

- **MVP (Phase 1):** global chat + read tools + `navigate_to`
- **Phase 2:** mutations only after UI confirmation (`pending_action`)
- **Phase 3–4:** expand module coverage, feature flag, rate limits

UI copy is English. Users may chat in Spanish or English.

## Architecture

```
CrmAssistantPanel → Edge crm_assistant (JWT) → Anthropic /v1/messages + tools
                         ↓
              User-scoped Supabase client (RLS) + hasMemberCapability
```

### Secrets

- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_MODEL` (optional, default `claude-sonnet-4-6`)

### Feature flag

- Frontend: `VITE_CRM_ASSISTANT_ENABLED=1` (or `true` / `yes` / `on`)
- Workspace toggle: Settings → Integrations → **Ask Nomi** (`organizations.assistant_settings.enabled`)
- Capability: `crm.assistant.use` (admins always; users/read_only per matrix)

## Persistence

| Table | Purpose |
|-------|---------|
| `assistant_conversations` | Thread per member/org |
| `assistant_messages` | user / assistant / tool rows |

RLS: members only see their own conversations in their org.

## Tool catalog

### Phase 1 — read + navigate

| Tool | Capability |
|------|------------|
| `search_contacts` | `crm.contacts.view` |
| `search_companies` | `crm.companies.view` |
| `search_tickets` | `support.tickets.view` |
| `get_ticket_summary` | `support.tickets.view` |
| `search_deals` | `crm.pipeline.view` |
| `list_calendar_events` | `calendar.view` or `crm.tasks.view` |
| `search_invoices` | `proposals.view` + amount masking via `view_amounts.show` |
| `navigate_to` | any authenticated assistant user |

### Phase 2 — confirm mutations

| Tool | Notes |
|------|--------|
| `create_task` | Confirm |
| `schedule_meeting` | Confirm; supports `event_time` |
| `plan_meeting` | Preferred for “meeting with X”; one Confirm may create contact + schedule |
| `add_internal_note` | Confirm |
| `draft_ticket_reply` | Returns draft text; send is separate confirm |
| `update_ticket_status` | Confirm |
| `create_contact_quick` | Confirm |

### Phase 3 — expand

- Deals: `get_deal_summary`
- Messaging: `draft_sms` (confirm)
- Marketing: `list_campaigns` (read-only)
- Billing: `get_invoice` (respect `view_amounts.show`)

Never expose Stripe secrets, auth tokens, or settings write tools.

## Security

1. User JWT + RLS for data access
2. Capability check before each tool
3. Confirm UI for mutations
4. No invented IDs in answers
5. Rate limit: max requests per member per minute

## Files

- Edge: `supabase/functions/crm_assistant/`
- Shared: `supabase/functions/_shared/crmAssistant/`
- UI: `src/modules/assistant/`
- Migration: `supabase/migrations/20260717180000_crm_assistant.sql`
- Eval prompts: [`crm-assistant-evals/prompts.md`](./crm-assistant-evals/prompts.md)

## Deploy checklist

1. Migration applied (`assistant_conversations` / `assistant_messages`)
2. Edge secret `ANTHROPIC_API_KEY` set on the project (shared with website audit)
3. Optional: `ANTHROPIC_MODEL`
4. Deploy: `supabase functions deploy crm_assistant --project-ref <ref>`
5. Frontend: `VITE_CRM_ASSISTANT_ENABLED=1`
6. Smoke: Ask Nomi → search contact → open ticket via navigate_to

## Success criteria (MVP)

- Ask Nomi finds real org contacts/tickets
- `navigate_to` opens the correct route
- Missing permission → clear refusal, not fabricated data
- Build/deploy without breaking existing shell
