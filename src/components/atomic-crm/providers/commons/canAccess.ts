// FIXME: This should be exported from the ra-core package
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
  | "user";

export type AccessIdentity = {
  administrator?: boolean;
  role?: string | null;
  roles?: unknown;
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

  const canAccessFinance = roles.includes("accountant") || roles.includes("payroll_manager");
  const canAccessPeople = roles.includes("hr");
  const canAccessSales =
    roles.includes("sales_manager") ||
    roles.includes("manager") ||
    roles.includes("employee");

  if (params.resource === "sales" || params.resource === "configuration") {
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
