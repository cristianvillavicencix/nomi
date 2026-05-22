// FIXME: This should be exported from the ra-core package
import { isLbsMode } from "@/lbs/productMode";
import type { MemberModulePermissions } from "../../types";
import {
  canAccessResourceWithModules,
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

export const getAccessRoles = (identity: string | AccessIdentity | null | undefined): AccessRole[] => {
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
      const normalized = String(role ?? "").trim().toLowerCase();
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

export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  identity: string | AccessIdentity,
  params: CanAccessParams<RecordType>,
) => {
  const roles = getAccessRoles(identity);

  if (roles.includes("admin")) {
    return true;
  }

  if (typeof identity === "object" && identity.module_permissions != null) {
    return canAccessResourceWithModules(
      params.resource,
      identity as AccessIdentity,
      isLbsMode(),
      params.action,
    );
  }

  const canAccessFinance = legacyRoleFinance(roles);
  const canAccessPeople = legacyRolePeople(roles);
  const canAccessSales = legacyRoleSales(roles);

  if (params.resource === "organization_members" || params.resource === "configuration") {
    return false;
  }

  if (isLbsMode()) {
    if (
      params.resource === "payments" ||
      params.resource === "payment_lines" ||
      params.resource === "payroll_runs" ||
      params.resource === "payroll_run_lines" ||
      params.resource === "employee_loans" ||
      params.resource === "employee_loan_deductions" ||
      params.resource === "people" ||
      params.resource === "time_entries" ||
      params.resource === "reports"
    ) {
      return false;
    }

    if (
      params.resource === "deals" ||
      params.resource === "companies" ||
      params.resource === "contacts" ||
      params.resource === "tasks" ||
      params.resource === "calendar_events" ||
      params.resource === "task_assignees" ||
      params.resource === "task_participants" ||
      params.resource === "task_tag_notifications" ||
      params.resource === "proposals" ||
      params.resource === "contracts" ||
      params.resource === "forms" ||
      params.resource === "form_submissions" ||
      params.resource === "tickets" ||
      params.resource === "ticket_messages" ||
      params.resource === "conversations" ||
      params.resource === "conversation_participants" ||
      params.resource === "conversation_messages" ||
      params.resource === "proposal_line_items" ||
      params.resource === "deal_resources" ||
      params.resource === "deal_access_entries"
    ) {
      return canAccessSales;
    }

    return true;
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
