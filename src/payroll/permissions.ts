import { getAccessRoles } from "@/components/atomic-crm/providers/commons/canAccess";

export type PayrollApproverRole = 'owner' | 'admin' | 'accountant';

/**
 * Permission gate for approval actions in Hours/Payroll.
 * Supports multiple identity shapes from different auth providers.
 */
export const canApprovePayroll = (identity: any): boolean => {
  if (!identity) return false;

  const roles = getAccessRoles(identity);
  return (
    roles.includes("admin") ||
    roles.includes("accountant") ||
    roles.includes("payroll_manager") ||
    roles.includes("owner" as PayrollApproverRole)
  );
};
