/**
 * Per-member module permissions (Settings → Users).
 * When `module_permissions` is null in DB → legacy `roles[]` only.
 * When set (object) → frontend uses capabilities; `roles[]` is auto-synced server-side for Postgres RLS.
 */
import { isLbsMode } from "@/lbs/productMode";
import {
  CAPABILITY_IDS,
  getStoredRolePreset,
  hasCapability,
  inferLegacyRolePreset,
  permissionsMapFromRolePreset,
  resolveEffectivePermissions,
  type RoleSlug,
} from "@/lib/permissions/permissionCatalog";
import { deriveModuleFlagsFromCapabilities } from "../../settings/workspacePermissionTree";
import type { AccessIdentity, AccessRole } from "./canAccess";
import type { MemberModuleKey, MemberModulePermissions } from "../../types";
import { MEMBER_MODULE_KEYS } from "../../types";

/** Default form / new user: safe minimum (administrator flag still grants full access in app). */
export const defaultModulePermissionsObject = (): Required<
  Record<MemberModuleKey, boolean>
> => ({
  crm: false,
  proposals: false,
  forms: false,
  support: false,
  messaging: false,
  deal_operations: false,
  deal_financials: false,
  payroll: false,
  people: false,
  time: false,
  reports: false,
  view_amounts: false,
});

const allTrue = (): Required<Record<MemberModuleKey, boolean>> => ({
  crm: true,
  proposals: true,
  forms: true,
  support: true,
  messaging: true,
  deal_operations: true,
  deal_financials: true,
  payroll: true,
  people: true,
  time: true,
  reports: true,
  view_amounts: true,
});

function mergeStored(
  stored: MemberModulePermissions | null | undefined,
): Required<Record<MemberModuleKey, boolean>> {
  const base = defaultModulePermissionsObject();
  if (!stored || typeof stored !== "object") return base;
  for (const k of MEMBER_MODULE_KEYS) {
    if (
      k in stored &&
      typeof (stored as Record<string, unknown>)[k] === "boolean"
    ) {
      base[k] = (stored as Record<MemberModuleKey, boolean>)[k] ?? false;
    }
  }
  for (const [k, v] of Object.entries(
    deriveModuleFlagsFromCapabilities(stored as Record<string, unknown>),
  )) {
    if (v === true) {
      base[k as MemberModuleKey] = true;
    }
  }
  return base;
}

/** Pre-fill checkboxes when DB has no explicit module_permissions yet. */
export function deriveModuleDefaultsFromLegacyRoles(
  identity: AccessIdentity | string | null | undefined,
): Required<Record<MemberModuleKey, boolean>> {
  if (!identity || typeof identity !== "object")
    return defaultModulePermissionsObject();
  if (identity.administrator === true) return allTrue();

  const perms = resolveEffectivePermissions(identity);
  return mergeStored(perms as MemberModulePermissions);
}

/** Whether a granular capability (e.g. messaging.send) is enabled for this member. */
export function hasMemberCapability(
  identity: AccessIdentity | string | null | undefined,
  capabilityId: string,
): boolean {
  if (!identity || typeof identity !== "object") return false;
  const perms = resolveEffectivePermissions(identity);
  return hasCapability(perms, capabilityId, {
    administrator: identity.administrator,
  });
}

/** Effective flags for routing + CRM permission checks. */
export function resolveEffectiveModules(
  identity: AccessIdentity | string | null | undefined,
): Required<Record<MemberModuleKey, boolean>> {
  if (!identity || typeof identity !== "object")
    return defaultModulePermissionsObject();
  if (identity.administrator === true) return allTrue();

  const raw = identity.module_permissions;
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return mergeStored(raw as MemberModulePermissions);
  }
  return deriveModuleDefaultsFromLegacyRoles(identity);
}

export function canViewMonetaryAmounts(
  identity: AccessIdentity | string | null | undefined,
): boolean {
  return hasMemberCapability(identity, "view_amounts.show");
}

/** Derive Postgres `roles[]` for RLS (subset of allowed role slugs). */
export function deriveRolesFromModulePermissions(
  mod: MemberModulePermissions | Record<string, boolean | string>,
  administrator: boolean,
): string[] {
  if (administrator) return ["admin"];

  const preset = getStoredRolePreset(mod);
  if (preset === "super_admin") return ["admin"];
  if (preset === "admin") return ["sales_manager"];
  if (preset === "read_only") return ["employee"];
  if (preset === "user") return ["employee"];

  if (isLbsMode()) {
    const perms = mod as Record<string, boolean | string>;
    const roles = new Set<string>();
    if (hasCapability(perms, "admin.users.manage")) roles.add("sales_manager");
    if (
      CAPABILITY_IDS.some(
        (id) =>
          id.startsWith("deal_financials.") &&
          hasCapability(perms, id, { administrator: false }),
      ) ||
      hasCapability(perms, "view_amounts.show", { administrator: false })
    ) {
      roles.add("sales_manager");
    } else if (
      CAPABILITY_IDS.some((id) => hasCapability(perms, id, { administrator: false }))
    ) {
      roles.add("employee");
    }
    return roles.size > 0 ? Array.from(roles) : ["employee"];
  }

  const m = mergeStored(mod as MemberModulePermissions);
  const roles = new Set<string>();
  if (m.payroll) roles.add("payroll_manager");
  if (m.people || m.time) roles.add("hr");
  const crmBand =
    m.crm ||
    m.proposals ||
    m.forms ||
    m.support ||
    m.messaging ||
    m.deal_operations ||
    m.deal_financials;
  if (crmBand) {
    if (m.deal_financials || m.view_amounts) roles.add("sales_manager");
    else roles.add("employee");
  }
  if (m.reports && roles.size === 0) roles.add("employee");
  return Array.from(roles);
}

export function legacyRoleFinance(roles: AccessRole[]): boolean {
  return roles.includes("accountant") || roles.includes("payroll_manager");
}
export function legacyRolePeople(roles: AccessRole[]): boolean {
  return roles.includes("hr");
}
export function legacyRoleSales(roles: AccessRole[]): boolean {
  return (
    roles.includes("sales_manager") ||
    roles.includes("manager") ||
    roles.includes("employee") ||
    roles.includes("sales") ||
    roles.includes("pm") ||
    roles.includes("designer") ||
    roles.includes("developer") ||
    roles.includes("marketing")
  );
}

export function applyRolePresetToPermissions(role: RoleSlug): Record<string, boolean | string> {
  return permissionsMapFromRolePreset(role);
}
