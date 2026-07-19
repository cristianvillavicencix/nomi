// FIXME: This should be exported from the ra-core package
import {
  getCapabilityForResourceAction,
  hasCapability,
  resolveEffectivePermissions,
} from "@/lib/permissions/permissionCatalog";
import type { MemberModulePermissions } from "../../types";

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

  if (LBS_DENIED_RESOURCES.has(params.resource)) {
    return false;
  }
  if (
    params.resource === "mail_accounts" ||
    params.resource === "mail_threads" ||
    params.resource === "mail_messages"
  ) {
    if (typeof identity !== "object") return false;
    const perms = resolveEffectivePermissions(identity);
    const opts = { administrator: identity.administrator };
    if (params.action === "delete") {
      return (
        hasCapability(perms, "mail.org.manage", opts) ||
        hasCapability(perms, "mail.personal.manage", opts)
      );
    }
    if (params.action === "create" || params.action === "edit") {
      if (params.resource === "mail_accounts") {
        return (
          hasCapability(perms, "mail.org.manage", opts) ||
          hasCapability(perms, "mail.personal.manage", opts)
        );
      }
      return (
        hasCapability(perms, "mail.org.send", opts) ||
        hasCapability(perms, "mail.personal.send", opts) ||
        hasCapability(perms, "mail.org.manage", opts) ||
        hasCapability(perms, "mail.personal.manage", opts)
      );
    }
    return (
      hasCapability(perms, "mail.org.view", opts) ||
      hasCapability(perms, "mail.personal.view", opts)
    );
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
};
