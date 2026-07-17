# Profile system

Shared identity UI for **person** (contact/lead), **company**, and later **project/deal**.

## Modes

| Mode | Surfaces | Shared pieces |
|------|----------|-----------------|
| Full | Company / contact show pages | `EntityIdentityHeader`, `EntityMetaRow`, `ProfileFullViewLayout`, Related |
| Preview | Accounts company/person sheets | Same identity blocks + compact tabs |
| Context | Messages / Tickets / Project side panels | `PersonContextCard`, `CompanyContextCard` + View profile |

## Kit location

`src/modules/shared/profile/`

- `EntityIdentityHeader` — avatar, title, badges, subtitle (website / title-at-company)
- `EntityMetaItem` / `EntityMetaRow` — labeled meta grid
- `formatCompanyLocation` — complete address line
- `PersonContextCard` / `CompanyContextCard` — compact embed for context panels

Entity wrappers (`ClientSummaryCard`, `ContactSummaryCard`) stay thin and compose the kit.

## Do not

- Duplicate website/phone/email as text + icon for the same value
- Put `Created` in the scan header
- List Projects in Related when Projects is a center tab
- Invent a one-off “who is this?” block in Messages/Tickets
