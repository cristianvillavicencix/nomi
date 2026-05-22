/**
 * Single source of truth for LBS RBAC capabilities and role presets.
 * See RBAC_DESIGN.md and CLAUDE_CODE_RBAC_PROMPT.md.
 */

export type RoleSlug = "super_admin" | "admin" | "user" | "read_only";

export const ROLE_PRESET_KEY = "_role_preset";
export const CUSTOM_ROLE_PRESET_PREFIX = "custom:";
export const SCOPED_TO_PROJECTS_KEY = "_scoped_to_projects";

export interface Capability {
  id: string;
  area: string;
  label: string;
  description?: string;
  scopeable?: boolean;
}

export interface RolePreset {
  slug: RoleSlug;
  label: string;
  description: string;
  capabilities: string[];
}

type RoleMatrix = Record<RoleSlug, boolean>;

const cap = (
  id: string,
  area: string,
  label: string,
  opts?: { description?: string; scopeable?: boolean },
): Capability => ({
  id,
  area,
  label,
  ...opts,
});

/** Build preset capability id list from matrix rows. */
function presetFromMatrix(
  rows: Array<{ id: string; matrix: RoleMatrix }>,
  role: RoleSlug,
): string[] {
  return rows.filter((row) => row.matrix[role]).map((row) => row.id);
}

const MATRIX_ROWS: Array<{ id: string; area: string; label: string; scopeable?: boolean; matrix: RoleMatrix }> = [
  // Area 1 — CRM
  { id: "crm.contacts.view", area: "CRM", label: "View contacts & leads", matrix: { super_admin: true, admin: true, user: false, read_only: true } },
  { id: "crm.contacts.create", area: "CRM", label: "Create contacts & leads", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.contacts.edit", area: "CRM", label: "Edit contacts & leads", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.contacts.delete", area: "CRM", label: "Delete contacts & leads", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.companies.view", area: "CRM", label: "View clients & companies", matrix: { super_admin: true, admin: true, user: false, read_only: true } },
  { id: "crm.companies.create", area: "CRM", label: "Create clients & companies", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.companies.edit", area: "CRM", label: "Edit clients & companies", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.companies.delete", area: "CRM", label: "Delete clients & companies", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.pipeline.view", area: "CRM", label: "View projects & pipeline", scopeable: true, matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "crm.pipeline.create", area: "CRM", label: "Create projects", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.pipeline.edit", area: "CRM", label: "Edit projects", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.pipeline.delete", area: "CRM", label: "Delete / archive projects", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "crm.upload_images", area: "CRM", label: "Upload images & attachments", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  // Area 2 — Tasks, Notes, Calendar
  { id: "crm.tasks.view", area: "Tasks & calendar", label: "View tasks", scopeable: true, matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "crm.tasks.create", area: "Tasks & calendar", label: "Create tasks", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.tasks.edit", area: "Tasks & calendar", label: "Edit tasks", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.tasks.delete", area: "Tasks & calendar", label: "Delete tasks", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.notes.view", area: "Tasks & calendar", label: "View notes", matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "crm.notes.create", area: "Tasks & calendar", label: "Create notes", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.notes.edit", area: "Tasks & calendar", label: "Edit notes", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "crm.notes.delete", area: "Tasks & calendar", label: "Delete notes", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "calendar.view", area: "Tasks & calendar", label: "View calendar", matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "calendar.manage", area: "Tasks & calendar", label: "Manage calendar events", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "meetings.view", area: "Tasks & calendar", label: "View meetings", matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "meetings.manage", area: "Tasks & calendar", label: "Schedule & edit meetings", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  // Area 3 — Messaging
  { id: "messaging.conversations.view", area: "Messaging", label: "View conversations", scopeable: true, matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "messaging.send", area: "Messaging", label: "Send messages", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "messaging.settings.manage", area: "Messaging", label: "Messaging settings (Twilio)", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  // Area 4 — Proposals & Contracts
  { id: "proposals.view", area: "Proposals & contracts", label: "View proposals", scopeable: true, matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "proposals.create", area: "Proposals & contracts", label: "Create proposals", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "proposals.edit", area: "Proposals & contracts", label: "Edit proposals", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "proposals.send", area: "Proposals & contracts", label: "Send proposals", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "proposals.delete", area: "Proposals & contracts", label: "Delete proposals", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "contracts.view", area: "Proposals & contracts", label: "View contracts", scopeable: true, matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "contracts.create", area: "Proposals & contracts", label: "Create contracts", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "contracts.edit", area: "Proposals & contracts", label: "Edit contracts", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "contracts.delete", area: "Proposals & contracts", label: "Delete contracts", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  // Area 5 — Forms & Support
  { id: "forms.manage", area: "Forms & support", label: "Manage web forms", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "forms.submissions.view", area: "Forms & support", label: "View form submissions", matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "support.tickets.view", area: "Forms & support", label: "View tickets", scopeable: true, matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "support.tickets.manage", area: "Forms & support", label: "Manage tickets", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "support.messages.send", area: "Forms & support", label: "Send ticket messages", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  // Area 6 — Deal operations
  { id: "deal_operations.resources.view", area: "Deal operations", label: "View project resources", matrix: { super_admin: true, admin: true, user: true, read_only: true } },
  { id: "deal_operations.resources.manage", area: "Deal operations", label: "Manage project resources", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "deal_operations.subcontractors.view", area: "Deal operations", label: "View subcontractors", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "deal_operations.subcontractors.manage", area: "Deal operations", label: "Manage subcontractors", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_operations.credentials.view", area: "Deal operations", label: "View project credentials", matrix: { super_admin: true, admin: true, user: true, read_only: false } },
  { id: "deal_operations.credentials.manage", area: "Deal operations", label: "Manage project credentials", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  // Area 7 — Financials
  { id: "view_amounts.show", area: "Financials", label: "Show dollar amounts", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.expenses.view", area: "Financials", label: "View expenses", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.expenses.manage", area: "Financials", label: "Manage expenses", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.change_orders.view", area: "Financials", label: "View change orders", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.change_orders.manage", area: "Financials", label: "Manage change orders", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.collections.view", area: "Financials", label: "View client collections", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.collections.manage", area: "Financials", label: "Manage client collections", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.commissions.view", area: "Financials", label: "View commissions", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "deal_financials.commissions.manage", area: "Financials", label: "Manage commissions", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  // Area 8 — People / Time / Payroll (contractor mode; hidden from LBS nav unless enabled)
  { id: "people.view", area: "People", label: "View employee directory", matrix: { super_admin: true, admin: true, user: false, read_only: true } },
  { id: "people.manage", area: "People", label: "Manage employees", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "people.adjustments.manage", area: "People", label: "Manage PTO & adjustments", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "time.entries.view", area: "Time", label: "View time entries", matrix: { super_admin: true, admin: true, user: false, read_only: true } },
  { id: "time.entries.manage", area: "Time", label: "Manage time entries", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "time.entries.approve", area: "Time", label: "Approve time entries", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "payroll.view", area: "Payroll", label: "View pay runs & payments", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "payroll.manage", area: "Payroll", label: "Manage pay runs", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "payroll.approve", area: "Payroll", label: "Approve pay runs", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "payroll.pay", area: "Payroll", label: "Mark payments as paid", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "payroll.loans.manage", area: "Payroll", label: "Manage loans & deductions", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  // Area 9 — Admin
  { id: "records.share", area: "Administration", label: "Share records with teammates", scopeable: true, matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "admin.users.manage", area: "Administration", label: "Manage users & invites", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
  { id: "admin.settings.manage", area: "Administration", label: "Workspace settings (pipelines, tags)", matrix: { super_admin: true, admin: false, user: false, read_only: false } },
  { id: "admin.billing.manage", area: "Administration", label: "Billing & subscriptions", matrix: { super_admin: true, admin: false, user: false, read_only: false } },
  { id: "reports.view", area: "Administration", label: "View reports", matrix: { super_admin: true, admin: true, user: false, read_only: false } },
];

export const CAPABILITIES: Capability[] = MATRIX_ROWS.map(({ id, area, label, scopeable }) =>
  cap(id, area, label, { scopeable }),
);

export const CAPABILITY_IDS = CAPABILITIES.map((c) => c.id);

const ROLE_DESCRIPTIONS: Record<RoleSlug, { label: string; description: string }> = {
  super_admin: {
    label: "Super Admin",
    description: "Full access including billing and critical workspace settings",
  },
  admin: {
    label: "Admin",
    description: "Manage users and operations; no billing or critical settings",
  },
  user: {
    label: "User",
    description:
      "Assigned projects only — tasks, calendar, and messaging on those projects; no leads, clients, proposals, or amounts",
  },
  read_only: {
    label: "Read-only",
    description: "View-only access to CRM data; no edits, messages, or amounts",
  },
};

const WRITE_CAPABILITY_SUFFIXES = [
  ".create",
  ".edit",
  ".delete",
  ".manage",
  ".send",
  ".approve",
  ".pay",
] as const;

export function isWriteCapability(capId: string): boolean {
  return WRITE_CAPABILITY_SUFFIXES.some((suffix) => capId.endsWith(suffix));
}

export const ROLE_PRESETS: Record<RoleSlug, RolePreset> = (
  ["super_admin", "admin", "user", "read_only"] as RoleSlug[]
).reduce(
  (acc, slug) => {
    acc[slug] = {
      slug,
      label: ROLE_DESCRIPTIONS[slug].label,
      description: ROLE_DESCRIPTIONS[slug].description,
      capabilities: presetFromMatrix(MATRIX_ROWS, slug),
    };
    return acc;
  },
  {} as Record<RoleSlug, RolePreset>,
);

export function isBuiltInRolePreset(value: string): value is RoleSlug {
  return value in ROLE_PRESETS;
}

export function isCustomRolePreset(value: string): boolean {
  return value.startsWith(CUSTOM_ROLE_PRESET_PREFIX);
}

export function getStoredRolePresetKey(
  perms: Record<string, boolean | string | undefined> | null | undefined,
): string | null {
  if (!perms || typeof perms !== "object") return null;
  const raw = perms[ROLE_PRESET_KEY];
  if (typeof raw !== "string") return null;
  if (isBuiltInRolePreset(raw) || isCustomRolePreset(raw)) return raw;
  return null;
}

export function isScopedWorkspaceUser(
  identity: {
    administrator?: boolean;
    roles?: unknown;
    module_permissions?: Record<string, boolean | string | undefined> | null;
  } | null | undefined,
): boolean {
  if (!identity || typeof identity !== "object" || identity.administrator === true) {
    return false;
  }
  const stored = identity.module_permissions;
  if (stored && stored[SCOPED_TO_PROJECTS_KEY] === true) return true;
  const presetKey =
    getStoredRolePresetKey(stored) ?? inferLegacyRolePreset(identity);
  return presetKey === "user";
}

export const RESOURCE_ACTION_TO_CAPABILITY: Record<
  string,
  Record<string, string>
> = {
  contacts: {
    list: "crm.contacts.view",
    show: "crm.contacts.view",
    create: "crm.contacts.create",
    edit: "crm.contacts.edit",
    delete: "crm.contacts.delete",
  },
  companies: {
    list: "crm.companies.view",
    show: "crm.companies.view",
    create: "crm.companies.create",
    edit: "crm.companies.edit",
    delete: "crm.companies.delete",
  },
  deals: {
    list: "crm.pipeline.view",
    show: "crm.pipeline.view",
    create: "crm.pipeline.create",
    edit: "crm.pipeline.edit",
    delete: "crm.pipeline.delete",
  },
  tasks: {
    list: "crm.tasks.view",
    show: "crm.tasks.view",
    create: "crm.tasks.create",
    edit: "crm.tasks.edit",
    delete: "crm.tasks.delete",
  },
  contact_notes: {
    list: "crm.notes.view",
    show: "crm.notes.view",
    create: "crm.notes.create",
    edit: "crm.notes.edit",
    delete: "crm.notes.delete",
  },
  deal_notes: {
    list: "crm.notes.view",
    show: "crm.notes.view",
    create: "crm.notes.create",
    edit: "crm.notes.edit",
    delete: "crm.notes.delete",
  },
  calendar_events: {
    list: "calendar.view",
    show: "calendar.view",
    create: "calendar.manage",
    edit: "calendar.manage",
    delete: "calendar.manage",
  },
  conversations: {
    list: "messaging.conversations.view",
    show: "messaging.conversations.view",
    create: "messaging.send",
    edit: "messaging.send",
    delete: "messaging.send",
  },
  conversation_participants: {
    list: "messaging.conversations.view",
    show: "messaging.conversations.view",
    create: "messaging.send",
    edit: "messaging.send",
    delete: "messaging.send",
  },
  conversation_messages: {
    list: "messaging.conversations.view",
    show: "messaging.conversations.view",
    create: "messaging.send",
    edit: "messaging.send",
    delete: "messaging.send",
  },
  proposals: {
    list: "proposals.view",
    show: "proposals.view",
    create: "proposals.create",
    edit: "proposals.edit",
    delete: "proposals.delete",
  },
  proposal_line_items: {
    list: "proposals.view",
    show: "proposals.view",
    create: "proposals.edit",
    edit: "proposals.edit",
    delete: "proposals.edit",
  },
  contracts: {
    list: "contracts.view",
    show: "contracts.view",
    create: "contracts.create",
    edit: "contracts.edit",
    delete: "contracts.delete",
  },
  forms: {
    list: "forms.manage",
    show: "forms.manage",
    create: "forms.manage",
    edit: "forms.manage",
    delete: "forms.manage",
  },
  form_submissions: {
    list: "forms.submissions.view",
    show: "forms.submissions.view",
    create: "forms.submissions.view",
    edit: "forms.submissions.view",
    delete: "forms.submissions.view",
  },
  tickets: {
    list: "support.tickets.view",
    show: "support.tickets.view",
    create: "support.tickets.manage",
    edit: "support.tickets.manage",
    delete: "support.tickets.manage",
  },
  ticket_messages: {
    list: "support.tickets.view",
    show: "support.tickets.view",
    create: "support.messages.send",
    edit: "support.messages.send",
    delete: "support.messages.send",
  },
  deal_resources: {
    list: "deal_operations.resources.view",
    show: "deal_operations.resources.view",
    create: "deal_operations.resources.manage",
    edit: "deal_operations.resources.manage",
    delete: "deal_operations.resources.manage",
  },
  deal_access_entries: {
    list: "deal_operations.credentials.view",
    show: "deal_operations.credentials.view",
    create: "deal_operations.credentials.manage",
    edit: "deal_operations.credentials.manage",
    delete: "deal_operations.credentials.manage",
  },
  deal_subcontractor_entries: {
    list: "deal_operations.subcontractors.view",
    show: "deal_operations.subcontractors.view",
    create: "deal_operations.subcontractors.manage",
    edit: "deal_operations.subcontractors.manage",
    delete: "deal_operations.subcontractors.manage",
  },
  deal_expenses: {
    list: "deal_financials.expenses.view",
    show: "deal_financials.expenses.view",
    create: "deal_financials.expenses.manage",
    edit: "deal_financials.expenses.manage",
    delete: "deal_financials.expenses.manage",
  },
  deal_change_orders: {
    list: "deal_financials.change_orders.view",
    show: "deal_financials.change_orders.view",
    create: "deal_financials.change_orders.manage",
    edit: "deal_financials.change_orders.manage",
    delete: "deal_financials.change_orders.manage",
  },
  deal_client_payments: {
    list: "deal_financials.collections.view",
    show: "deal_financials.collections.view",
    create: "deal_financials.collections.manage",
    edit: "deal_financials.collections.manage",
    delete: "deal_financials.collections.manage",
  },
  deal_commissions: {
    list: "deal_financials.commissions.view",
    show: "deal_financials.commissions.view",
    create: "deal_financials.commissions.manage",
    edit: "deal_financials.commissions.manage",
    delete: "deal_financials.commissions.manage",
  },
  organization_members: {
    list: "admin.users.manage",
    show: "admin.users.manage",
    create: "admin.users.manage",
    edit: "admin.users.manage",
    delete: "admin.users.manage",
  },
  configuration: {
    list: "admin.settings.manage",
    show: "admin.settings.manage",
    create: "admin.settings.manage",
    edit: "admin.settings.manage",
    delete: "admin.settings.manage",
  },
  reports: {
    list: "reports.view",
    show: "reports.view",
  },
  record_shares: {
    list: "records.share",
    show: "records.share",
    create: "records.share",
    edit: "records.share",
    delete: "records.share",
  },
  people: {
    list: "people.view",
    show: "people.view",
    create: "people.manage",
    edit: "people.manage",
    delete: "people.manage",
  },
  time_entries: {
    list: "time.entries.view",
    show: "time.entries.view",
    create: "time.entries.manage",
    edit: "time.entries.manage",
    delete: "time.entries.manage",
  },
  payments: {
    list: "payroll.view",
    show: "payroll.view",
    create: "payroll.manage",
    edit: "payroll.manage",
    delete: "payroll.manage",
  },
  payroll_runs: {
    list: "payroll.view",
    show: "payroll.view",
    create: "payroll.manage",
    edit: "payroll.manage",
    delete: "payroll.manage",
  },
  employee_loans: {
    list: "payroll.loans.manage",
    show: "payroll.loans.manage",
    create: "payroll.loans.manage",
    edit: "payroll.loans.manage",
    delete: "payroll.loans.manage",
  },
  employee_pto_adjustments: {
    list: "people.adjustments.manage",
    show: "people.adjustments.manage",
    create: "people.adjustments.manage",
    edit: "people.adjustments.manage",
    delete: "people.adjustments.manage",
  },
};

export function getCapabilityForResourceAction(
  resource: string,
  action: string,
): string | undefined {
  return RESOURCE_ACTION_TO_CAPABILITY[resource]?.[action];
}

export function getCapabilitiesForRole(role: RoleSlug): string[] {
  return [...ROLE_PRESETS[role].capabilities];
}

/** Full boolean map for all catalog capabilities. */
export function permissionsMapFromRolePreset(role: RoleSlug): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {
    [ROLE_PRESET_KEY]: role,
  };
  for (const id of CAPABILITY_IDS) {
    out[id] = ROLE_PRESETS[role].capabilities.includes(id);
  }
  return out;
}

export function collapsePermissionsForSave(
  caps: Record<string, boolean | string | undefined> | null | undefined,
  rolePreset?: RoleSlug | null,
): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {};
  for (const id of CAPABILITY_IDS) {
    const value = caps?.[id];
    out[id] = value === true;
  }
  const preset =
    rolePreset ??
    (typeof caps?.[ROLE_PRESET_KEY] === "string"
      ? (caps[ROLE_PRESET_KEY] as RoleSlug)
      : null);
  if (preset && preset in ROLE_PRESETS) {
    out[ROLE_PRESET_KEY] = preset;
  } else if (typeof caps?.[ROLE_PRESET_KEY] === "string" && isCustomRolePreset(caps[ROLE_PRESET_KEY])) {
    out[ROLE_PRESET_KEY] = caps[ROLE_PRESET_KEY] as string;
  }
  return out;
}

export function getStoredRolePreset(
  perms: Record<string, boolean | string | undefined> | null | undefined,
): RoleSlug | null {
  const key = getStoredRolePresetKey(perms);
  if (key && isBuiltInRolePreset(key)) return key;
  return null;
}

export function resolveEffectivePermissions(
  identity: {
    administrator?: boolean;
    roles?: unknown;
    module_permissions?: Record<string, boolean | string | undefined> | null;
  } | string | null | undefined,
): Record<string, boolean | string> {
  if (!identity || typeof identity !== "object") {
    return permissionsMapFromRolePreset("read_only");
  }
  if (identity.administrator === true) {
    return permissionsMapFromRolePreset("super_admin");
  }

  const stored = identity.module_permissions;
  if (stored != null && typeof stored === "object" && !Array.isArray(stored)) {
    const presetKey = getStoredRolePresetKey(stored);
    const out: Record<string, boolean | string> =
      presetKey && isBuiltInRolePreset(presetKey)
        ? { ...permissionsMapFromRolePreset(presetKey) }
        : presetKey && isCustomRolePreset(presetKey)
          ? { [ROLE_PRESET_KEY]: presetKey }
          : {};
    for (const id of CAPABILITY_IDS) {
      if (typeof stored[id] === "boolean") {
        out[id] = stored[id];
      } else if (!(id in out)) {
        out[id] = false;
      }
    }
    if (typeof stored[ROLE_PRESET_KEY] === "string") {
      out[ROLE_PRESET_KEY] = stored[ROLE_PRESET_KEY];
    }
    const effectivePreset =
      getStoredRolePreset(out) ??
      getStoredRolePreset(stored) ??
      inferLegacyRolePreset(identity);
    if (effectivePreset === "user" || effectivePreset === "read_only") {
      out["view_amounts.show"] = false;
    }
    if (effectivePreset === "read_only") {
      for (const id of CAPABILITY_IDS) {
        if (isWriteCapability(id)) {
          out[id] = false;
        }
      }
      out["messaging.send"] = false;
      out["crm.upload_images"] = false;
      out["proposals.view"] = false;
      out["contracts.view"] = false;
      out["reports.view"] = false;
    }
    if (effectivePreset === "user") {
      for (const id of [
        "crm.contacts.view",
        "crm.contacts.create",
        "crm.contacts.edit",
        "crm.companies.view",
        "crm.companies.create",
        "crm.companies.edit",
        "proposals.view",
        "proposals.create",
        "proposals.edit",
        "contracts.view",
        "records.share",
        "people.view",
        "people.manage",
        "people.adjustments.manage",
        "time.entries.view",
        "time.entries.manage",
        "time.entries.approve",
        "payroll.view",
        "payroll.manage",
        "payroll.approve",
        "payroll.pay",
        "payroll.loans.manage",
      ]) {
        out[id] = false;
      }
    }
    return out;
  }

  const legacyPreset = inferLegacyRolePreset(identity);
  const out = permissionsMapFromRolePreset(legacyPreset);
  if (legacyPreset === "user" || legacyPreset === "read_only") {
    out["view_amounts.show"] = false;
  }
  return out;
}

export function hasCapability(
  memberPerms: Record<string, boolean | string | undefined> | null | undefined,
  capId: string,
  opts?: { administrator?: boolean },
): boolean {
  if (opts?.administrator === true) return true;
  if (!capId) return true;
  if (memberPerms != null && typeof memberPerms === "object") {
    if (typeof memberPerms[capId] === "boolean") {
      return memberPerms[capId] as boolean;
    }
    const preset = getStoredRolePreset(memberPerms);
    if (preset && ROLE_PRESETS[preset].capabilities.includes(capId)) {
      return true;
    }
  }
  return false;
}

export function isScopeable(capId: string): boolean {
  return CAPABILITIES.find((c) => c.id === capId)?.scopeable === true;
}

export const MASKED_AMOUNT_FIELDS = [
  "deals.amount",
  "deals.estimated_value",
  "deals.original_project_value",
  "deals.current_project_value",
  "proposals.amount",
  "proposal_line_items.unit_price",
  "companies.revenue",
] as const;

export function maskedFieldsWhenNoAmounts(): readonly string[] {
  return MASKED_AMOUNT_FIELDS;
}

export function getCapabilitiesGroupedByArea(): Array<{
  area: string;
  items: Capability[];
}> {
  const groups = new Map<string, Capability[]>();
  for (const capability of CAPABILITIES) {
    const list = groups.get(capability.area) ?? [];
    list.push(capability);
    groups.set(capability.area, list);
  }
  return Array.from(groups.entries()).map(([area, items]) => ({ area, items }));
}

export function inferLegacyRolePreset(
  identity: {
    administrator?: boolean;
    roles?: unknown;
  },
): RoleSlug {
  if (identity.administrator === true) return "super_admin";
  const roles = Array.isArray(identity.roles)
    ? identity.roles.map((r) => String(r).toLowerCase())
    : [];
  if (roles.includes("admin") || roles.includes("sales_manager") || roles.includes("manager")) {
    return "admin";
  }
  if (
    roles.includes("employee") ||
    roles.includes("designer") ||
    roles.includes("developer") ||
    roles.includes("marketing") ||
    roles.includes("sales") ||
    roles.includes("pm")
  ) {
    return "user";
  }
  return "read_only";
}
