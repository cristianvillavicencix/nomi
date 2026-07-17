# CRM UX system

Layered reuse so modules do not fork the same jobs.

## Layers

1. **Entity open** — Full / Preview / Context (see [PROFILE-SYSTEM.md](./PROFILE-SYSTEM.md))
2. **Chrome** — hub list+selection, collapsible right rail, empty/loading, back link
3. **Atoms** — identity header, quick actions, status pill, meta row

## Immediate (shipped / in progress)

- Profile kit + company/contact cleanup
- Accounts preview aligned to shared identity
- Messages context embeds person/company cards
- Cursor rules: `.cursor/rules/profile-ux.mdc`, `.cursor/rules/crm-ux-system.mdc`

## Roadmap (Phase C+)

| Priority | System | Direction |
|----------|--------|-----------|
| P0 | EmptyState | One empty primitive (icon, title, description, CTA) |
| P0 | Skeletons | List / Detail / Panel skeleton primitives |
| P0 | PageBackLink | One back policy (list vs history); English only |
| P0 | Hub selection contract | Document + converge Accounts / Tickets / Messages |
| P1 | EntityQuickActions | Unified Call / Email / SMS / More |
| P1 | StatusPill | Shared pill + domain color maps |
| P1 | Stage change shell | Confirm + optional note |
| P1 | Collapsible rail | One rail; domain body slots |
| P1 | RelatedSection | Accordion only; drop legacy static branch |
| P1 | HubPageHeader | Shared hub title + view toggle |
| P2 | Dialog/Sheet consolidation | Prefer CreateFormDialogShell; preview = Sheet |
| P2 | Invoice status helper | Shared CRM helper; portal wraps i18n |
| P2 | Stale routes | Purge hard-coded `/companies/.../show` |

## Target folders

```
src/modules/shared/
  profile/   # identity, meta, location, context cards
  chrome/    # EmptyState, skeletons, PageBackLink, HubPageHeader (future)
  status/    # StatusPill (future)
  actions/   # EntityQuickActions (future)
```

## Policy notes

- **Deals:** full-page workspace is OK until hubs adopt preview; do not invent a third open gesture without updating this doc.
- **Portal / proposal i18n:** intentional bilingual — leave alone when sweeping English CRM chrome.
