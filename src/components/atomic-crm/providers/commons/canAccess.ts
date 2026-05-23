// FIXME: This should be exported from the ra-core package
import { isLbsMode } from "@/lbs/productMode";
import {
  getCapabilityForResourceAction,
  hasCapability,
  resolveEffectivePermissions,
} from "@/lib/permissions/permissionCatalog";
import type { MemberModulePermissions } from "../../types";
import {
  legacyRoleFinance,
  legacyRolePeople,
  legacyRoleSales,
} from "./memberModuleAccess";

type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

export type AccessRole =
  | "admin"
  | "accountant"
  | "payroll_manager"
  | "hr"
  | "sales_manager"
  | "manager"
  | "employee"
  | "user"
  | "sales"
  | "pm"
  | "designer"
  | "developer"
  | "marketing";

export type AccessIdentity = {
  administrator?: boolean;
  role?: string | null;
  roles?: unknown;
  /** When set, fine-grained modules apply; roles[] is synced for RLS. */
  module_permissions?: MemberModulePermissions | null;
  user_metadata?: {
    role?: string | null;
    roles?: unknown;
  } | null;
};

export const getAccessRoles = (
  identity: string | AccessIdentity | null | undefined,
): AccessRole[] => {
  if (!identity) return [];

  if (typeof identity === "string") {
    return identity ? [identity as AccessRole] : [];
  }

  const roles = new Set<AccessRole>();

  if (identity.administrator === true) {
    roles.add("admin");
  }

  const singleRole = String(identity.role ?? identity.user_metadata?.role ?? "")
    .trim()
    .toLowerCase();
  if (singleRole) {
    roles.add(singleRole as AccessRole);
  }

  const arrayRoles = identity.roles ?? identity.user_metadata?.roles;
  if (Array.isArray(arrayRoles)) {
    for (const role of arrayRoles) {
      const normalized = String(role ?? "")
        .trim()
        .toLowerCase();
      if (normalized) {
        roles.add(normalized as AccessRole);
      }
    }
  }

  if (roles.size === 0) {
    roles.add("user");
  }

  return Array.from(roles);
};

export const hasAnyRole = (
  identity: string | AccessIdentity | null | undefined,
  expectedRoles: AccessRole[],
) => {
  const roles = getAccessRoles(identity);
  return expectedRoles.some((role) => roles.includes(role));
};

const LBS_DENIED_RESOURCES = new Set([
  "payments",
  "payment_lines",
  "payroll_runs",
  "payroll_run_lines",
  "employee_loans",
  "employee_loan_deductions",
  "people",
  "time_entries",
]);

const canAccessViaCatalog = (
  identity: AccessIdentity | null | undefined,
  resource: string,
  action: string,
): boolean | null => {
  if (!identity || typeof identity !== "object") return false;
  const capId = getCapabilityForResourceAction(resource, action);
  if (!capId) return null;
  const perms = resolveEffectivePermissions(identity);
  return hasCapability(perms, capId, {
    administrator: identity.administrator,
  });
};

export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  identity: string | AccessIdentity | null | undefined,
  params: CanAccessParams<RecordType>,
) => {
  if (identity == null) return false;

  if (typeof identity === "object" && identity.administrator === true) {
    return true;
  }

  if (isLbsMode()) {
    if (LBS_DENIED_RESOURCES.has(params.resource)) {
      return false;
    }
    if (params.resource === "reports") {
      const hit = canAccessViaCatalog(identity, "reports", params.action);
      return hit ?? false;
    }
    const catalogHit = canAccessViaCatalog(
      identity,
      params.resource,
      params.action,
    );
    if (catalogHit != null) {
      return catalogHit;
    }
    return true;
  }

  const roles = getAccessRoles(identity);

  if (roles.includes("admin")) {
    return true;
  }

  const canAccessFinance = legacyRoleFinance(roles);
  const canAccessPeople = legacyRolePeople(roles);
  const canAccessSales = legacyRoleSales(roles);

  if (
    params.resource === "organization_members" ||
    params.resource === "configuration"
  ) {
    return false;
  }

  if (
    params.resource === "payments" ||
    params.resource === "payment_lines" ||
    params.resource === "payroll_runs" ||
    params.resource === "payroll_run_lines" ||
    params.resource === "employee_loans" ||
    params.resource === "employee_loan_deductions"
  ) {
    return canAccessFinance;
  }

  if (params.resource === "people" || params.resource === "time_entries") {
    return canAccessPeople || canAccessFinance;
  }

  if (
    params.resource === "deals" ||
    params.resource === "companies" ||
    params.resource === "contacts"
  ) {
    return canAccessSales;
  }

  if (params.resource === "reports") {
    return canAccessFinance || canAccessPeople || canAccessSales;
  }

  return true;
};
