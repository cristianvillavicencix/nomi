import { matchPath } from "react-router";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { LbsNavItem } from "@/app/navigation";

export const matchesNavPattern = (pattern: string, pathname: string) => {
  if (pattern === "/") return pathname === "/";
  if (pattern.endsWith("/*")) {
    const base = pattern.slice(0, -2);
    return pathname === base || pathname.startsWith(`${base}/`);
  }
  return !!matchPath(pattern, pathname);
};

export const canAccessNavItem = (identity: unknown, item: LbsNavItem) => {
  if (item.anyOfCapabilities?.length) {
    return item.anyOfCapabilities.some((capability) =>
      hasMemberCapability(identity as any, capability),
    );
  }
  if (item.capability) {
    return hasMemberCapability(identity as any, item.capability);
  }
  if (item.resource) {
    return canAccess(identity as any, {
      resource: item.resource,
      action: item.action ?? "list",
    });
  }
  return true;
};

export const filterAccessibleNavItems = (
  identity: unknown,
  items: LbsNavItem[],
) => items.filter((item) => canAccessNavItem(identity, item));

export const isClientsNavActive = (pathname: string) =>
  matchesNavPattern("/clients/*", pathname) ||
  matchesNavPattern("/companies/*", pathname) ||
  matchesNavPattern("/contacts/*", pathname);

export const isAccountsNavActive = (pathname: string) =>
  matchesNavPattern("/accounts/*", pathname) ||
  matchesNavPattern("/leads/*", pathname) ||
  matchesNavPattern("/clients/*", pathname) ||
  matchesNavPattern("/companies/*", pathname) ||
  matchesNavPattern("/contacts/*", pathname);
