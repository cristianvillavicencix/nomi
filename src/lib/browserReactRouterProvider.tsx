import * as React from "react";
import { createBrowserRouter, RouterProvider as ReactRouterProvider, useInRouterContext } from "react-router";
import { reactRouterProvider } from "ra-core";

const routerProviderFuture = { v7_startTransition: false };

const future = {
  v7_fetcherPersist: false,
  v7_normalizeFormMethod: false,
  v7_partialHydration: false,
  v7_relativeSplatPath: false,
  v7_skipActionErrorRevalidation: false,
} as const;

/**
 * Like ra-core’s default `reactRouterProvider.RouterWrapper` (createHashRouter), but uses
 * the real URL path. The default hash router only reads the fragment after `#`, so a visit
 * to e.g. https://app/sas/ still resolves the app route to `/` and shows the CRM dashboard
 * instead of platform routes under `/sas`.
 */
const BrowserRouterWrapper = ({
  basename,
  children,
}: {
  basename?: string;
  children: React.ReactNode;
}) => {
  const isInRouter = useInRouterContext();
  if (isInRouter) {
    return <>{children}</>;
  }
  const router = createBrowserRouter(
    [{ path: "*", element: <>{children}</> }],
    { basename: basename || undefined, future },
  );
  return <ReactRouterProvider router={router} future={routerProviderFuture} />;
};

/**
 * drop-in `routerProvider` for `<Admin routerProvider={…} />` to fix path-based `/sas`, `/login`, etc.
 */
export const browserReactRouterProvider = {
  ...reactRouterProvider,
  RouterWrapper: BrowserRouterWrapper,
};
