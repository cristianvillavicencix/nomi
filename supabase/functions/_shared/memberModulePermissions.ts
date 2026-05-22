/** Mirrors app logic in `src/.../memberModuleAccess.ts` for Edge `users` function. */

const MODULE_KEYS = [
  "crm",
  "proposals",
  "forms",
  "support",
  "messaging",
  "deal_operations",
  "deal_financials",
  "payroll",
  "people",
  "time",
  "reports",
  "view_amounts",
] as const;

export type ModulePermissionRecord = Record<
  (typeof MODULE_KEYS)[number],
  boolean
>;

export function normalizeModulePermissions(
  raw: unknown,
): ModulePermissionRecord {
  const out = {} as ModulePermissionRecord;
  for (const k of MODULE_KEYS) out[k] = false;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const k of MODULE_KEYS) {
      if (typeof o[k] === "boolean") out[k] = o[k];
    }
  }
  return out;
}

export function hasAnyOperationalModule(mod: ModulePermissionRecord): boolean {
  for (const k of MODULE_KEYS) {
    if (k === "view_amounts") continue;
    if (mod[k]) return true;
  }
  return false;
}

export function deriveRolesFromModules(mod: ModulePermissionRecord): string[] {
  const roles = new Set<string>();
  if (mod.payroll) roles.add("payroll_manager");
  if (mod.people || mod.time) roles.add("hr");
  const crmBand =
    mod.crm ||
    mod.proposals ||
    mod.forms ||
    mod.support ||
    mod.messaging ||
    mod.deal_operations ||
    mod.deal_financials;
  if (crmBand) {
    if (mod.deal_financials || mod.view_amounts) roles.add("sales_manager");
    else roles.add("employee");
  }
  if (mod.reports && roles.size === 0) roles.add("employee");
  return Array.from(roles);
}
