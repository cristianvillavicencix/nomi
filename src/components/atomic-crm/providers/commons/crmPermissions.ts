import { getAccessRoles, type AccessIdentity, type AccessRole } from "./canAccess";

export type CrmPermission =
  | "payments.view"
  | "payments.manage"
  | "payments.approve"
  | "payments.pay"
  | "people.view"
  | "people.manage"
  | "hours.view"
  | "hours.manage"
  | "hours.approve"
  | "sales.view"
  | "sales.manage";

export type CrmMutationAction = "create" | "update" | "delete";

const hasRole = (roles: AccessRole[], expected: AccessRole[]) =>
  expected.some((role) => roles.includes(role));

export const canUseCrmPermission = (
  identity: AccessIdentity | string | null | undefined,
  permission: CrmPermission,
) => {
  const roles = getAccessRoles(identity);

  if (roles.includes("admin")) {
    return true;
  }

  switch (permission) {
    case "payments.view":
    case "payments.manage":
    case "payments.approve":
    case "payments.pay":
      return hasRole(roles, ["accountant", "payroll_manager"]);
    case "people.view":
      return hasRole(roles, ["hr", "accountant", "payroll_manager"]);
    case "people.manage":
      return hasRole(roles, ["hr"]);
    case "hours.view":
      return hasRole(roles, ["hr", "accountant", "payroll_manager"]);
    case "hours.manage":
      return hasRole(roles, ["hr"]);
    case "hours.approve":
      return hasRole(roles, ["hr", "accountant", "payroll_manager"]);
    case "sales.view":
    case "sales.manage":
      return hasRole(roles, ["sales_manager"]);
    default:
      return false;
  }
};

const getMutationPermission = (
  resource: string,
  action: CrmMutationAction,
  data?: Record<string, unknown>,
): CrmPermission | null => {
  if (resource === "payments" || resource === "payment_lines" || resource === "payroll_runs" || resource === "payroll_run_lines" || resource === "employee_loans" || resource === "employee_loan_deductions") {
    if (action === "update" && data?.status === "approved") return "payments.approve";
    if (action === "update" && data?.status === "paid") return "payments.pay";
    return "payments.manage";
  }

  if (resource === "employee_pto_adjustments" || resource === "people") {
    return "people.manage";
  }

  if (resource === "time_entries") {
    if (action === "update" && data?.status === "approved") return "hours.approve";
    return "hours.manage";
  }

  if (
    resource === "deals" ||
    resource === "companies" ||
    resource === "contacts" ||
    resource === "deal_notes" ||
    resource === "contact_notes" ||
    resource === "tasks" ||
    resource === "deal_subcontractor_entries" ||
    resource === "deal_expenses" ||
    resource === "deal_change_orders" ||
    resource === "deal_commissions" ||
    resource === "deal_client_payments"
  ) {
    return "sales.manage";
  }

  return null;
};

export const canMutateCrmResource = ({
  identity,
  resource,
  action,
  data,
}: {
  identity: AccessIdentity | string | null | undefined;
  resource: string;
  action: CrmMutationAction;
  data?: Record<string, unknown>;
}) => {
  const permission = getMutationPermission(resource, action, data);
  if (!permission) return true;
  return canUseCrmPermission(identity, permission);
};
