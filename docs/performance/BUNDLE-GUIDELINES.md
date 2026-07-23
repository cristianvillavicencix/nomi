# Bundle size guidelines (Nomi CRM)

Rules for keeping the production JavaScript bundle healthy as mail, billing, tickets, and other modules grow.

## When adding a new CRM feature

1. **New route** — default to `React.lazy` in [`src/app/LbsCustomRoutes.tsx`](../app/LbsCustomRoutes.tsx) with [`LazyRouteFallback`](../app/LazyRouteFallback.tsx).
2. **Heavy library (> ~100 KB)** — dynamic `import()` at the point of use, not at module top level.
3. **Shared barrels** — do not re-export heavy page components from `index.ts` files used by the app shell. Resource barrels (`proposals`, `tickets`, `contracts`) must use `React.lazy` like [`deals/index.ts`](../components/atomic-crm/deals/index.ts).
4. **Public share routes** — lazy-load in [`LbsCustomRoutes.tsx`](../app/LbsCustomRoutes.tsx) with `LazyRoute`; keep only `PublicShareLayout` eager.
5. **After a large feature** — run `npm run build:analyze` and update [`BUNDLE-BASELINE.md`](./BUNDLE-BASELINE.md).

## Lazy-load these vendors (never static import in entry path)

| Library | Loader | Used for |
|---------|--------|----------|
| pdfmake | [`getPdfMake()`](../modules/proposals/pdf/initPdfMake.ts) | Invoice + proposal PDFs |
| xlsx | dynamic import in [`submissionExportUtils.ts`](../modules/forms/submissions/submissionExportUtils.ts) | Excel export |
| mathjs | dynamic import in [`formulaEvaluator.ts`](../lib/forms-v2/formulaEvaluator.ts) | Form formulas |
| jsPDF | dynamic import in PDF export modules | Submission + portal PDFs |
| @twilio/voice-sdk | lazy [`VoiceCallProviderInner`](../modules/voice/VoiceCallProviderInner.tsx) | Voice calls (when enabled) |

## Keep eager (core daily paths)

- Dashboard, contacts, clients/companies hub, accounts hub, leads
- Layout, auth, providers (`MailComposeProvider`, `MessagesQuickAccessProvider`)
- `PublicShareLayout` shell (route components inside are lazy)

## Code splitting patterns

### Lazy route

```tsx
const TicketsOverview = lazy(() =>
  import("@/modules/tickets/TicketsOverview").then((m) => ({
    default: m.TicketsOverview,
  })),
);

<LazyRoute label="Loading tickets…">
  <TicketsOverview />
</LazyRoute>
```

### Lazy vendor

```tsx
const pdfMake = await getPdfMake();
pdfMake.createPdf(docDefinition).getBlob();
```

### Lazy Resource barrel

```tsx
import * as React from "react";

const ProposalsList = React.lazy(() =>
  import("./ProposalsList").then((m) => ({ default: m.ProposalsList })),
);

export default { list: ProposalsList };
```

## Deploy / PWA notes

- [`main.tsx`](../main.tsx) reloads once on stale chunk errors after deploy.
- [`PwaUpdateNotifier`](../components/PwaUpdateNotifier.tsx) prompts when a new service worker is ready.
- `index.html` is not precached; JS/CSS chunks are (see [`vite.config.ts`](../../vite.config.ts)).

## Review checklist (PR author)

- [ ] No new static import of pdfmake, xlsx, mathjs, jspdf, or @twilio/voice-sdk on routes loaded at login
- [ ] New authenticated routes use `LazyRoute` unless explicitly core
- [ ] Resource `index.ts` default exports use `React.lazy` for page components
- [ ] Export actions show loading state if vendor load is async
- [ ] `npm run typecheck` and `npm run check:bundle-size` pass
