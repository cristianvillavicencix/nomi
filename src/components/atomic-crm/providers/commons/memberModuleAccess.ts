/**
 * Per-member module permissions (Settings → Users).
 * When `module_permissions` is null in DB → legacy `roles[]` only.
 * When set (object) → frontend uses modules; `roles[]` is auto-synced server-side for Postgres RLS.
 */
import type { AccessIdentity, AccessRole } from "./canAccess";
import { getWorkspacePermissionGroups } from "../../settings/workspacePermissionTree";
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

const getRoleSet = (
  identity: AccessIdentity | string | null | undefined,
): Set<string> => {
  if (!identity || typeof identity !== "object") return new Set();
  const out = new Set<string>();
  if (identity.administrator === true) out.add("admin");
  const arr = identity.roles;
  if (Array.isArray(arr)) {
    for (const r of arr) {
      const x = String(r ?? "")
        .trim()
        .toLowerCase();
      if (x) out.add(x);
    }
  }
  return out;
};

/** Pre-fill checkboxes when DB has no explicit module_permissions yet. */
export function deriveModuleDefaultsFromLegacyRoles(
  identity: AccessIdentity | string | null | undefined,
): Required<Record<MemberModuleKey, boolean>> {
  if (!identity || typeof identity !== "object")
    return defaultModulePermissionsObject();
  if (identity.administrator === true) return allTrue();

  const roles = getRoleSet(identity);
  const finance = roles.has("accountant") || roles.has("payroll_manager");
  const hr = roles.has("hr");
  const salesHeavy =
    roles.has("sales_manager") ||
    roles.has("manager") ||
    roles.has("sales") ||
    roles.has("pm");
  const salesLight =
    roles.has("employee") ||
    roles.has("designer") ||
    roles.has("developer") ||
    roles.has("marketing");

  const hasCrmBand = salesHeavy || salesLight;
  const m = defaultModulePermissionsObject();
  if (finance) {
    m.payroll = true;
    m.reports = true;
    m.view_amounts = true;
    m.deal_financials = true;
  }
  if (hr) {
    m.people = true;
    m.time = true;
    m.reports = true;
  }
  if (hasCrmBand) {
    m.crm = true;
    m.proposals = true;
    m.forms = true;
    m.support = true;
    m.messaging = true;
    m.deal_operations = true;
    m.reports = true;
  }
  if (salesHeavy) {
    m.deal_financials = true;
    m.view_amounts = true;
  }
  if (salesLight && !salesHeavy) {
    m.deal_financials = false;
    m.view_amounts = false;
  }
  return m;
}

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
    deriveModuleFlagsFromStoredCapabilities(
      stored as Record<string, unknown>,
    ),
  )) {
    if (v === true) {
      base[k as MemberModuleKey] = true;
    }
  }
  return base;
}

function deriveModuleFlagsFromStoredCapabilities(
  stored: Record<string, unknown>,
): Partial<Record<MemberModuleKey, boolean>> {
  const flags: Partial<Record<MemberModuleKey, boolean>> = {};
  for (const modKey of MEMBER_MODULE_KEYS) {
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

const WRITE_ACTIONS = new Set(["create", "edit", "delete", "write"]);

function capabilityForResourceAction(
  resource: string,
  action: string,
): string | null {
  if (!WRITE_ACTIONS.has(action)) return null;
  if (
    resource === "conversation_messages" ||
    resource === "conversations" ||
    resource === "conversation_participants"
  ) {
    return "messaging.send";
  }
  return null;
}

/** Whether a granular capability (e.g. messaging.send) is enabled for this member. */
export function hasMemberCapability(
  identity: AccessIdentity | string | null | undefined,
  capabilityId: string,
): boolean {
  if (!identity || typeof identity !== "object") return false;
  if (identity.administrator === true) return true;

  const group = getWorkspacePermissionGroups().find((entry) =>
    entry.items.some((item) => item.id === capabilityId),
  );
  if (!group) return true;

  const modules = resolveEffectiveModules(identity);
  if (!modules[group.moduleKey]) return false;

  const stored = identity.module_permissions;
  if (stored == null || typeof stored !== "object") {
    return modules[group.moduleKey];
  }

  if (typeof stored[capabilityId] === "boolean") {
    return stored[capabilityId] as boolean;
  }

  const hasGranular = group.items.some(
    (item) => typeof stored[item.id] === "boolean",
  );
  if (hasGranular) return false;

  return modules[group.moduleKey];
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
  return resolveEffectiveModules(identity).view_amounts;
}

/** Derive Postgres `roles[]` for RLS (subset of allowed role slugs). */
export function deriveRolesFromModulePermissions(
  mod: MemberModulePermissions,
  administrator: boolean,
): string[] {
  if (administrator) return ["admin"];
  const m = mergeStored(mod);
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
  if (m.reports && roles.size === 0) {
    roles.add("employee");
  }
  return Array.from(roles);
}

const LBS_PAYROLL = new Set([
  "payments",
  "payment_lines",
  "payroll_runs",
  "payroll_run_lines",
  "employee_loans",
  "employee_loan_deductions",
]);

const LBS_CRM_BUNDLE = new Set([
  "deals",
  "companies",
  "contacts",
  "tasks",
  "calendar_events",
  "task_assignees",
  "task_participants",
  "task_tag_notifications",
  "deal_notes",
  "contact_notes",
]);

const LBS_PROPOSALS = new Set([
  "proposals",
  "contracts",
  "proposal_line_items",
]);
const LBS_FORMS = new Set(["forms", "form_submissions"]);
const LBS_SUPPORT = new Set(["tickets", "ticket_messages"]);
const LBS_MESSAGING = new Set([
  "conversations",
  "conversation_participants",
  "conversation_messages",
]);
const LBS_DEAL_OPS = new Set([
  "deal_resources",
  "deal_access_entries",
  "deal_subcontractor_entries",
]);
const LBS_DEAL_FIN = new Set([
  "deal_expenses",
  "deal_change_orders",
  "deal_commissions",
  "deal_client_payments",
]);

function moduleAllowsLbsResource(
  resource: string,
  mods: Required<Record<MemberModuleKey, boolean>>,
): boolean | null {
  if (mods.reports && resource === "reports") return true;
  if (LBS_PAYROLL.has(resource)) return mods.payroll;
  if (resource === "employee_pto_adjustments") return mods.people;
  if (resource === "people") return mods.people;
  if (resource === "time_entries")
    return mods.time || mods.people || mods.payroll;
  if (LBS_CRM_BUNDLE.has(resource)) return mods.crm;
  if (LBS_PROPOSALS.has(resource)) return mods.proposals;
  if (LBS_FORMS.has(resource)) return mods.forms;
  if (LBS_SUPPORT.has(resource)) return mods.support;
  if (LBS_MESSAGING.has(resource)) return mods.messaging;
  if (LBS_DEAL_OPS.has(resource)) return mods.deal_operations;
  if (LBS_DEAL_FIN.has(resource)) return mods.deal_financials;
  return null;
}

function moduleAllowsContractorResource(
  resource: string,
  mods: Required<Record<MemberModuleKey, boolean>>,
): boolean | null {
  if (resource === "reports") {
    return mods.reports && (mods.payroll || mods.people || mods.crm);
  }
  if (LBS_PAYROLL.has(resource)) return mods.payroll;
  if (resource === "employee_pto_adjustments") return mods.people;
  if (resource === "people") return mods.people;
  if (resource === "time_entries")
    return mods.time || mods.people || mods.payroll;
  if (
    resource === "deals" ||
    resource === "companies" ||
    resource === "contacts"
  )
    return mods.crm;
  return null;
}

export function canAccessResourceWithModules(
  resource: string,
  identity: AccessIdentity,
  isLbs: boolean,
  action = "list",
): boolean {
  const mods = resolveEffectiveModules(identity);
  const hit = isLbs
    ? moduleAllowsLbsResource(resource, mods)
    : moduleAllowsContractorResource(resource, mods);
  if (hit === false) return false;

  const writeCapability = capabilityForResourceAction(resource, action);
  if (writeCapability != null) {
    return hasMemberCapability(identity, writeCapability);
  }

  if (hit != null) return hit;
  return true;
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
