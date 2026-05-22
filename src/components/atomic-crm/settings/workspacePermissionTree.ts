import { isLbsMode } from "@/lbs/productMode";
import {
  CAPABILITIES,
  collapsePermissionsForSave as collapseCatalogPermissions,
  getCapabilitiesGroupedByArea,
  getStoredRolePreset,
  inferLegacyRolePreset,
  permissionsMapFromRolePreset,
  ROLE_PRESET_KEY,
  type RoleSlug,
} from "@/lib/permissions/permissionCatalog";
import type { MemberModuleKey, MemberModulePermissions } from "../types";

export type WorkspacePermissionItem = {
  id: string;
  label: string;
  scopeable?: boolean;
};

export type WorkspacePermissionGroup = {
  area: string;
  label: string;
  items: WorkspacePermissionItem[];
};

const CONTRACTOR_GROUPS: WorkspacePermissionGroup[] = [
  {
    area: "payroll",
    label: "Payroll",
    items: [
      { id: "payroll.runs", label: "Pay runs & payouts" },
      { id: "payroll.loans", label: "Loans & deductions" },
    ],
  },
  {
    area: "people",
    label: "People",
    items: [
      { id: "people.directory", label: "Employee directory" },
      { id: "people.adjustments", label: "PTO & adjustments" },
    ],
  },
  {
    area: "time",
    label: "Time",
    items: [{ id: "time.entries", label: "Time entries" }],
  },
];

const lbsGroupsFromCatalog = (): WorkspacePermissionGroup[] =>
  getCapabilitiesGroupedByArea().map(({ area, items }) => ({
    area,
    label: area,
    items: items.map((cap) => ({
      id: cap.id,
      label: cap.label,
      scopeable: cap.scopeable,
    })),
  }));

export const getWorkspacePermissionGroups = (): WorkspacePermissionGroup[] =>
  isLbsMode()
    ? lbsGroupsFromCatalog()
    : [...lbsGroupsFromCatalog(), ...CONTRACTOR_GROUPS];

export function deriveModuleFlagsFromCapabilities(
  stored: Record<string, unknown> | null | undefined,
): Partial<Record<MemberModuleKey, boolean>> {
  const flags: Partial<Record<MemberModuleKey, boolean>> = {};
  if (!stored || typeof stored !== "object") return flags;

  const modulePrefixes: Record<MemberModuleKey, string> = {
    crm: "crm.",
    proposals: "proposals.",
    forms: "forms.",
    support: "support.",
    messaging: "messaging.",
    deal_operations: "deal_operations.",
    deal_financials: "deal_financials.",
    payroll: "payroll.",
    people: "people.",
    time: "time.",
    reports: "reports.",
    view_amounts: "view_amounts.",
  };

  for (const [modKey, prefix] of Object.entries(modulePrefixes) as Array<
    [MemberModuleKey, string]
  >) {
    const anyChild = Object.entries(stored).some(
      ([key, value]) => key.startsWith(prefix) && value === true,
    );
    if (anyChild || stored[modKey] === true) {
      flags[modKey] = true;
    }
  }
  return flags;
}

export function expandPermissionsForForm(
  stored: MemberModulePermissions | null | undefined,
  identity?: {
    administrator?: boolean;
    roles?: unknown;
    module_permissions?: MemberModulePermissions | null;
  },
): Record<string, boolean | string> {
  const preset =
    getStoredRolePreset(stored) ??
    (identity ? inferLegacyRolePreset(identity) : ("user" as RoleSlug));
  const base = permissionsMapFromRolePreset(preset);

  if (stored != null && typeof stored === "object") {
    for (const cap of CAPABILITIES) {
      if (typeof stored[cap.id] === "boolean") {
        base[cap.id] = stored[cap.id] as boolean;
      }
    }
    if (typeof stored[ROLE_PRESET_KEY] === "string") {
      base[ROLE_PRESET_KEY] = stored[ROLE_PRESET_KEY];
    }
  }

  if (!isLbsMode()) {
    for (const group of CONTRACTOR_GROUPS) {
      for (const item of group.items) {
        if (typeof stored?.[item.id] === "boolean") {
          base[item.id] = stored[item.id] as boolean;
        }
      }
    }
  }

  return base;
}

export function collapsePermissionsForSave(
  caps: Record<string, boolean | string | undefined> | null | undefined,
  rolePreset?: RoleSlug | null,
): MemberModulePermissions {
  const preset =
    rolePreset ??
    (typeof caps?.[ROLE_PRESET_KEY] === "string"
      ? (caps[ROLE_PRESET_KEY] as RoleSlug)
      : null);

  const out = collapseCatalogPermissions(caps, preset) as MemberModulePermissions;

  if (!isLbsMode()) {
    for (const group of CONTRACTOR_GROUPS) {
      for (const item of group.items) {
        out[item.id] = caps?.[item.id] === true;
      }
    }
  }

  for (const [modKey, enabled] of Object.entries(
    deriveModuleFlagsFromCapabilities(out as Record<string, unknown>),
  )) {
    if (enabled === true) {
      out[modKey as MemberModuleKey] = true;
    }
  }

  return out;
}

export { ROLE_PRESET_KEY, ROLE_PRESETS, type RoleSlug } from "@/lib/permissions/permissionCatalog";
