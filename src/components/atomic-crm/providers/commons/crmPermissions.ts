import { getAccessRoles, type AccessIdentity, type AccessRole } from "./canAccess";
import { resolveEffectiveModules } from "./memberModuleAccess";

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

const DEAL_FIN_RESOURCES = new Set([
  "deal_expenses",
  "deal_change_orders",
  "deal_commissions",
  "deal_client_payments",
]);
const DEAL_OPS_RESOURCES = new Set([
  "deal_subcontractor_entries",
  "deal_resources",
  "deal_access_entries",
]);

function salesBand(m: ReturnType<typeof resolveEffectiveModules>) {
  return (
    m.crm ||
    m.proposals ||
    m.forms ||
    m.support ||
    m.messaging ||
    m.deal_operations ||
    m.deal_financials
  );
}

function modulesAllowMutation(
  identity: AccessIdentity,
  permission: CrmPermission,
  resource?: string,
) {
  const mods = resolveEffectiveModules(identity);
  switch (permission) {
    case "payments.view":
    case "payments.manage":
    case "payments.approve":
    case "payments.pay":
      return mods.payroll;
    case "people.view":
      return mods.people || mods.payroll;
    case "people.manage":
      return mods.people;
    case "hours.view":
      return mods.time || mods.people || mods.payroll;
    case "hours.manage":
      return mods.time || mods.people;
    case "hours.approve":
      return mods.time || mods.people || mods.payroll;
    case "sales.view":
    case "sales.manage": {
      if (resource && DEAL_FIN_RESOURCES.has(resource)) {
        return mods.deal_financials && salesBand(mods);
      }
      if (resource && DEAL_OPS_RESOURCES.has(resource)) {
        return mods.deal_operations && (mods.crm || salesBand(mods));
      }
      return salesBand(mods);
    }
    default:
      return false;
  }
}

export const canUseCrmPermission = (
  identity: AccessIdentity | string | null | undefined,
  permission: CrmPermission,
  mutationResource?: string,
) => {
  if (
    identity &&
    typeof identity === "object" &&
    (identity as AccessIdentity).administrator === true
  ) {
    return true;
  }

  const idObj =
    identity && typeof identity === "object" ? (identity as AccessIdentity) : undefined;
  if (idObj?.module_permissions != null) {
    return modulesAllowMutation(idObj, permission, mutationResource);
  }

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
      return hasRole(roles, ["sales_manager", "manager", "employee"]);
    default:
      return false;
  }
};

const getMutationPermission = (
  resource: string,
  action: CrmMutationAction,
  data?: Record<string, unknown>,
): CrmPermission | null => {
  if (
    resource === "payments" ||
    resource === "payment_lines" ||
    resource === "payroll_runs" ||
    resource === "payroll_run_lines" ||
    resource === "employee_loans" ||
    resource === "employee_loan_deductions"
  ) {
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
    resource === "organization_members" ||
    resource === "deals" ||
    resource === "companies" ||
    resource === "contacts" ||
    resource === "deal_notes" ||
    resource === "contact_notes" ||
    resource === "tasks" ||
    resource === "calendar_events" ||
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
  if (
    identity &&
    typeof identity === "object" &&
    (identity as AccessIdentity).administrator === true
  ) {
    return true;
  }
  // Matches RLS on public.configuration — only admins can insert/update rows.
  if (resource === "configuration") {
    return false;
  }
  const permission = getMutationPermission(resource, action, data);
  if (!permission) return true;
  return canUseCrmPermission(identity, permission, resource);
};
