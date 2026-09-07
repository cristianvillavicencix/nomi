# RBAC matrix (owner / admin / junior)

Source: `permissionCatalog.ts` + `canAccess.ts`. UI hide is not authorization — PostgREST RLS repeats the same capabilities.

| Resource | Action | Owner | Admin | Junior |
|---|---|---|---|---|
| Invoices (`client_invoices`) | list | yes | yes | no |
| Invoices | create | yes | yes | no |
| Deals / projects | list | yes | yes | yes (scoped) |
| Deals | delete | yes | yes | no |
| Tickets | list | yes | yes | no |
| Tickets | edit | yes | yes | no |
| Settings (`configuration`) | edit | yes | no | no |

## Cross-org (RLS)

Hosted policies for `client_invoices`, `tickets`, and `deals` all require `org_id = current_user_org_id()`. A user in org A cannot `SELECT` org B rows even if they guess ids.

Automated check: `src/lib/permissions/__tests__/rbacMatrix.test.ts`.
