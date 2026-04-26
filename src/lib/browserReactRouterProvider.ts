/**
 * Re-export: implementation lives in `browserReactRouterProvider.tsx` (JSX). This `.ts` shim
 * keeps stale HMR or cached dev requests to `…/browserReactRouterProvider.ts` from 404ing.
 */
export { browserReactRouterProvider } from "./browserReactRouterProvider.tsx";
