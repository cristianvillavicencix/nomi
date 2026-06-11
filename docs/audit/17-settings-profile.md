# Settings + Profile

## 1. Purpose

Workspace configuration, users/invites, messaging, web monitor, forms, commercial settings, pipelines, notes/tasks defaults, data import, and user profile (password, avatar).

## 2. Files & components

| Kind | Path |
|------|------|
| Routes | `/settings` (`?tab=`), `/profile` |
| Core | `SettingsPage.tsx`, `ProfilePage.tsx`, `UsersSettingsSection.tsx` |
| LBS sections | `src/lbs/settings/` — messaging, web monitor, forms, commercial, data import, email, GSC, signatures |
| Billing gate | `inviteBillingGate.ts` + Stripe dialogs |

**Settings tabs:** general, users, forms, messaging, web-monitor, commercial, projects, notes, tasks, data

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `configuration` | Singleton row `id=1`; `getConfiguration` / `updateConfiguration` |
| `organization_members` | Users list, invites, avatars |
| `organization_pipeline_stages` | Pipeline editor sync |
| `organizations` | JSON settings (web monitor, etc.) |
| `deals` | Validation when removing pipeline stages |

## 4. External services

| Service | Usage |
|---------|--------|
| **Stripe** | Org seat billing (`stripe-billing`) |
| **Twilio** | SMS settings (`messaging_settings`) |
| **Postmark** | Email settings (`email_settings`) |
| **Google GSC** | OAuth (`google_gsc/*`) |
| **Zoho** | One-shot import (`zoho_oneshot_import`) |

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Configures | Messages, Web Monitor, Forms, Deals pipelines | Settings tabs |
| Invites | Auth | `users` edge function |
| Embeds | Forms v2 | Full forms list in Forms tab |

## 6. Edge functions used by this module

| Function | Purpose |
|----------|---------|
| `users` | Create/update/disable members, invites |
| `update_password` | Admin-triggered reset email |
| `messaging_settings` | Twilio SMS config |
| `email_settings` | Postmark email config |
| `stripe-billing` | Checkout, portal, seats |
| `google_gsc/*` | Search Console OAuth |
| `zoho_oneshot_import` | Data import section |
| `platform-directory` | Platform admin auth user list |

## 7. Status: WORKING

Broad settings surface functional. Invite billing skippable via `SKIP_USER_INVITE_BILLING` / `VITE_SKIP_USER_INVITE_BILLING`.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| LOW | `WebsiteMonitorSettingsSection.tsx` | Spanish UI copy | Violates English UI rule |
| LOW | `dataProvider.signUp()` | Spanish error if called | Public signup disabled anyway |
| LOW | IA | Duplicate forms entry | Settings Forms tab + `/forms-v2` routes |

## 9. Broken connections

- Stripe flows require hosted secrets and webhook endpoints — standard ops dependency.
- GSC disconnect/reconnect cycle depends on Google Cloud OAuth client config.
