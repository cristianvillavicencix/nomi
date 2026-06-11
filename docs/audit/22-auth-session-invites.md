# Auth, Session & Invites

## 1. Purpose

Invite-only authentication: login, SSO, password reset/set, OAuth consent, session identity mapped to `organization_members`, and admin user invites.

## 2. Files & components

| Kind | Path |
|------|------|
| Routes (noLayout) | `/login`, `/set-password`, `/forgot-password`, `/oauth/consent` |
| Disabled signup | `/sign-up/*` → redirect `/login` |
| Auth provider | `src/components/atomic-crm/providers/supabase/authProvider.ts` |
| Login | `LoginPage.tsx`, `SSOAuthButton.tsx` |
| Password | `set-password-page.tsx`, `forgot-password-page.tsx` |
| Invites | `UsersSettingsSection.tsx`, `inviteBillingGate.ts` |
| Legacy | `SignupPage.tsx` exists but route redirects |

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `auth.users` | Supabase Auth |
| `organization_members` | CRM identity, roles, permissions |
| `init_state.is_initialized` | First-run gate in `checkAuth` |

## 4. External services

| Service | Usage |
|---------|--------|
| **Supabase Auth** | Email/password, SSO, magic links |
| **Stripe** | Seat billing on invite (optional skip flag) |

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Gates | All CRM modules | `checkAuth`, RLS via JWT |
| Settings | Users tab | Invites via `users` edge function |
| Profile | `/profile` | Password change client-side |

## 6. Edge functions used by this module

| Function | Purpose |
|----------|---------|
| `users` | Create/update/disable members |
| `update_password` | Reset email for invited users |
| `stripe-billing` | Seat checks on invite |

## 7. Status: WORKING

Invite-only flow functional. Public signup explicitly disabled.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| LOW | `authProvider.checkAuth` | Spanish error message | *"Tu cuenta ya no tiene acceso..."* — should be English |
| LOW | `dataProvider.signUp()` | Spanish error | Dead path but violates English UI rule |
| LOW | Ops | JWT verification | Do not set hosted `SB_JWT_ISSUER` to localhost (see `AGENTS.md`) |

## 9. Broken connections

- User must have matching `organization_members` row — missing row forces sign-out (by design).
- `checkError` ignores 403 (RLS) — intentional for partial list visibility.
