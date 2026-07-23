# Bundle baseline (Nomi CRM)

Track production bundle sizes after each optimization PR. Run `npm run build:analyze` and update this table.

## How to measure

```bash
npm run build:analyze
npm run check:bundle-size   # CI guard (+10% vs baseline below)
```

- Open `dist/stats.html` (Rollup Visualizer treemap)
- Entry chunk: largest `dist/assets/index-*.js`
- Gzip sizes appear in the Vite build summary

## Baseline history

| Date | Commit | Entry JS (parsed) | Entry gzip | Precache entries | Notes |
|------|--------|-------------------|------------|------------------|-------|
| 2026-07-23 | 51ca7ec7 | 8,229 KB (~8.0 MiB) | 2,720 KB | ~92 (~10.2 MiB) | pdfmake, xlsx, mathjs, jspdf in main chunk |
| 2026-07-23 | (bundle R1) | 4,497 KB (~4.4 MiB) | 1,331 KB | ~117 (~10.4 MiB) | Lazy vendors + lazy routes; entry -45% parsed |
| 2026-07-23 | (bundle R2) | 3,202 KB (~3.1 MiB) | 956 KB | ~181 (~10.4 MiB) | Lazy Resource barrels, settings/reports, public routes, Twilio defer |

**Current CI guard baseline:** 3,202 KB parsed / 956 KB gzip (+10% threshold in `scripts/check-bundle-size.mjs`).

### Top chunks (after round 2)

| File | Parsed |
|------|--------|
| `index-*.js` (entry) | ~3.1 MiB |
| `pdf-vendor-*.js` | ~1.9 MiB (lazy) |
| `mathjs-vendor-*.js` | ~777 KB (lazy) |
| `xlsx-vendor-*.js` | ~453 KB (lazy) |
| `jspdf-vendor-*.js` | ~399 KB (lazy) |
| `twilio-vendor-*.js` | ~265 KB (lazy, voice only) |
| `nivo-bar-*.js` | ~234 KB (lazy, reports/dashboard) |
| `html2canvas-vendor-*.js` | ~207 KB (lazy) |
| `supabase-vendor-*.js` | ~177 KB |
| `MailPage-*.js` | ~74 KB (lazy route) |
| `DealList-*.js` | ~62 KB |

### Top chunks (pre-optimization)

| File | Parsed |
|------|--------|
| `index-*.js` (entry) | ~8.0 MiB |
| `html2canvas.esm-*.js` | ~202 KB |
| `ProjectShowPage-*.js` | ~175 KB |

## Targets (orientative)

- Entry parsed: **-60%** vs original baseline (achieved: ~61%)
- Entry gzip: **< ~1,000 KB** (achieved: ~956 KB)
- New CRM routes: lazy by default (see `BUNDLE-GUIDELINES.md`)

## After each PR

Add a row to the table above with commit hash and sizes. Update `scripts/check-bundle-size.mjs` if the shrink was intentional.

## Manual regression checklist

Run after each bundle optimization PR:

- [x] Login + dashboard loads (typecheck + build pass)
- [x] Core eager routes unchanged (contacts, deals, layout)
- [x] Lazy routes use Suspense / LazyRouteFallback
- [x] Resource barrels (proposals, tickets, contracts) lazy like deals
- [x] Public share routes lazy-wrapped
- [x] Voice provider deferred when voice disabled
- [x] PDF exports use mutation loading states
- [x] CI bundle guard passes
- [ ] Mail: inbox + global compose (manual)
- [ ] Tickets: list + show + reply (manual)
- [ ] Billing: invoice PDF send (manual)
- [ ] Public form with formula field (manual)
- [ ] Deploy preview chunk reload (manual)

## Convention

Features not needed at login should use **lazy routes** (`React.lazy` in `LbsCustomRoutes.tsx`), **lazy Resource barrels**, or **dynamic import** at point of use (PDF, Excel, formulas).
