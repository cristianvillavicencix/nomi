import { isLbsMode } from "@/lbs/productMode";
import type { MemberModuleKey, MemberModulePermissions } from "../types";

export type WorkspacePermissionItem = {
  id: string;
  label: string;
};

export type WorkspacePermissionGroup = {
  moduleKey: MemberModuleKey;
  label: string;
  items: WorkspacePermissionItem[];
};

const WORKSPACE_PERMISSION_GROUPS: WorkspacePermissionGroup[] = [
  {
    moduleKey: "crm",
    label: "CRM",
    items: [
      { id: "crm.contacts", label: "Contacts & companies" },
      { id: "crm.pipeline", label: "Pipeline & projects" },
      { id: "crm.tasks", label: "Tasks" },
      { id: "crm.notes", label: "Notes & activity" },
      { id: "crm.upload_images", label: "Upload images & files" },
    ],
  },
  {
    moduleKey: "proposals",
    label: "Proposals",
    items: [
      { id: "proposals.documents", label: "Proposals & contracts" },
      { id: "proposals.line_items", label: "Line items" },
    ],
  },
  {
    moduleKey: "forms",
    label: "Forms",
    items: [
      { id: "forms.manage", label: "Create & edit forms" },
      { id: "forms.submissions", label: "View submissions" },
    ],
  },
  {
    moduleKey: "support",
    label: "Support",
    items: [
      { id: "support.tickets", label: "Tickets" },
      { id: "support.messages", label: "Ticket messages" },
    ],
  },
  {
    moduleKey: "messaging",
    label: "Messaging",
    items: [
      { id: "messaging.conversations", label: "Conversations" },
      { id: "messaging.send", label: "Send messages" },
    ],
  },
  {
    moduleKey: "deal_operations",
    label: "Deal operations",
    items: [
      { id: "deal_operations.resources", label: "Resources & scheduling" },
      { id: "deal_operations.subcontractors", label: "Subcontractors" },
    ],
  },
  {
    moduleKey: "deal_financials",
    label: "Deal financials",
    items: [
      { id: "deal_financials.expenses", label: "Expenses" },
      { id: "deal_financials.change_orders", label: "Change orders" },
      { id: "deal_financials.collections", label: "Client collections" },
    ],
  },
  {
    moduleKey: "payroll",
    label: "Payroll",
    items: [
      { id: "payroll.runs", label: "Pay runs & payouts" },
      { id: "payroll.loans", label: "Loans & deductions" },
    ],
  },
  {
    moduleKey: "people",
    label: "People",
    items: [
      { id: "people.directory", label: "Employee directory" },
      { id: "people.adjustments", label: "PTO & adjustments" },
    ],
  },
  {
    moduleKey: "time",
    label: "Time",
    items: [{ id: "time.entries", label: "Time entries" }],
  },
  {
    moduleKey: "reports",
    label: "Reports",
    items: [{ id: "reports.workspace", label: "Reports workspace" }],
  },
  {
    moduleKey: "view_amounts",
    label: "Amount visibility",
    items: [{ id: "view_amounts.show", label: "Show dollar amounts" }],
  },
];

const LBS_MODULE_KEYS = new Set<MemberModuleKey>([
  "crm",
  "proposals",
  "forms",
  "support",
  "messaging",
  "deal_operations",
  "deal_financials",
  "view_amounts",
]);

export const getWorkspacePermissionGroups = (): WorkspacePermissionGroup[] =>
  isLbsMode()
    ? WORKSPACE_PERMISSION_GROUPS.filter((group) =>
        LBS_MODULE_KEYS.has(group.moduleKey),
      )
    : WORKSPACE_PERMISSION_GROUPS;

export function deriveModuleFlagsFromCapabilities(
  stored: Record<string, unknown> | null | undefined,
): Partial<Record<MemberModuleKey, boolean>> {
  const flags: Partial<Record<MemberModuleKey, boolean>> = {};
  if (!stored || typeof stored !== "object") return flags;

  for (const group of getWorkspacePermissionGroups()) {
    const anyChild = group.items.some((item) => stored[item.id] === true);
    if (anyChild || stored[group.moduleKey] === true) {
      flags[group.moduleKey] = true;
    }
  }
  return flags;
}

/** Flat map for the permission tree form (module keys + capability ids). */
export function expandPermissionsForForm(
  stored: MemberModulePermissions | null | undefined,
  effectiveModules: Required<Record<MemberModuleKey, boolean>>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};

  for (const group of getWorkspacePermissionGroups()) {
    const hasStoredChildren = group.items.some(
      (item) =>
        stored != null &&
        typeof stored === "object" &&
        typeof stored[item.id] === "boolean",
    );

    for (const item of group.items) {
      if (
        stored != null &&
        typeof stored === "object" &&
        typeof stored[item.id] === "boolean"
      ) {
        out[item.id] = stored[item.id] as boolean;
      } else if (hasStoredChildren) {
        out[item.id] = false;
      } else {
        out[item.id] = effectiveModules[group.moduleKey];
      }
    }

    out[group.moduleKey] = effectiveModules[group.moduleKey];
  }

  return out;
}

/** Persist capability ids and synced module keys for RLS. */
export function collapsePermissionsForSave(
  caps: Record<string, boolean> | null | undefined,
): MemberModulePermissions {
  const out: MemberModulePermissions = {};
  if (!caps || typeof caps !== "object") return out;

  for (const [key, value] of Object.entries(caps)) {
    if (typeof value === "boolean") {
      out[key] = value;
    }
  }

  for (const group of getWorkspacePermissionGroups()) {
    const anyChild = group.items.some((item) => caps[item.id] === true);
    out[group.moduleKey] = anyChild || caps[group.moduleKey] === true;
  }

  return out;
}
