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

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Module keys plus dotted capability ids (e.g. messaging.send) and _role_preset. */
export type ModulePermissionRecord = Record<string, boolean | string>;

export function deriveModuleFlagsFromCapabilities(
  stored: Record<string, unknown>,
): Partial<Record<ModuleKey, boolean>> {
  const flags: Partial<Record<ModuleKey, boolean>> = {};
  for (const modKey of MODULE_KEYS) {
    const prefix = `${modKey}.`;
    const anyChild = Object.entries(stored).some(
      ([key, value]) => key.startsWith(prefix) && value === true,
    );
    if (anyChild || stored[modKey] === true) {
      flags[modKey] = true;
    }
  }
  return flags;
}

export function normalizeModulePermissions(
  raw: unknown,
): ModulePermissionRecord {
  const out: ModulePermissionRecord = {};
  for (const k of MODULE_KEYS) out[k] = false;

  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    for (const [key, val] of Object.entries(o)) {
      if (typeof val === "boolean" || typeof val === "string") out[key] = val;
    }
  }

  for (const [modKey, enabled] of Object.entries(
    deriveModuleFlagsFromCapabilities(out),
  )) {
    if (enabled === true) {
      out[modKey] = true;
    }
  }

  return out;
}

export function hasMemberCapability(
  member:
    | {
        administrator?: boolean | null;
        module_permissions?: unknown;
      }
    | null
    | undefined,
  capabilityId: string,
): boolean {
  if (!member) return false;
  if (member.administrator === true) return true;

  const stored =
    member.module_permissions != null &&
    typeof member.module_permissions === "object" &&
    !Array.isArray(member.module_permissions)
      ? (member.module_permissions as Record<string, unknown>)
      : null;

  const modKey = capabilityId.split(".")[0] as ModuleKey;
  const modulePrefix = `${modKey}.`;

  const moduleEnabled =
    stored?.[modKey] === true ||
    Object.entries(stored ?? {}).some(
      ([key, value]) => key.startsWith(modulePrefix) && value === true,
    );

  if (!moduleEnabled) return false;

  if (stored == null) return true;

  if (typeof stored[capabilityId] === "boolean") {
    return stored[capabilityId] as boolean;
  }

  const hasGranular = Object.keys(stored).some((key) =>
    key.startsWith(modulePrefix),
  );
  if (hasGranular) return false;

  return stored[modKey] === true;
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
