import type { Icon } from "@phosphor-icons/react";
import {
  Briefcase,
  CalendarBlank,
  ChartBar,
  ChatCircle,
  EnvelopeSimple,
  FileText,
  Globe,
  HardDrives,
  House,
  ListChecks,
  Megaphone,
  PenNib,
  Receipt,
  SquaresFour,
  Ticket,
  UserPlus,
  Users,
  VideoCamera,
} from "@phosphor-icons/react";

export type LbsNavItem = {
  to: string;
  label: string;
  icon: Icon;
  activePattern: string;
  capability?: string;
  /** If set, access if the member has any of these capabilities. */
  anyOfCapabilities?: string[];
  resource?: string;
  action?: string;
};

export type LbsNavCollapsibleGroup = {
  id: string;
  label: string;
  icon: Icon;
  storageKey: string;
  children: LbsNavItem[];
};

export type LbsNavGroup = {
  id: string;
  label: string;
  icon: Icon;
  items: LbsNavItem[];
};

export type LbsNavCollapsibleSection = {
  id: string;
  label: string;
  icon: Icon;
  storageKey: string;
};

export const LBS_NAV_SECONDARY_GROUP_IDS = [
  "close-billing",
  "daily-work",
  "tools",
] as const;

/** Collapsed by default — Close & bill, Daily work, Tools. */
export const LBS_MORE_NAV_COLLAPSIBLE: LbsNavCollapsibleSection = {
  id: "more",
  label: "More",
  icon: SquaresFour,
  storageKey: "sidebar_more_open",
};

export const splitLbsNavGroups = (groups: LbsNavGroup[]) => {
  const secondaryIds = new Set<string>(LBS_NAV_SECONDARY_GROUP_IDS);
  return {
    primary: groups.filter((group) => !secondaryIds.has(group.id)),
    secondary: groups.filter((group) => secondaryIds.has(group.id)),
  };
};

export const filterLbsNavItems = (
  items: LbsNavItem[],
  options?: { websiteMonitorEnabled?: boolean },
) =>
  items.filter(
    (item) =>
      !(item.to === "/web-monitor" && options?.websiteMonitorEnabled === false),
  );

export const filterLbsNavGroups = (
  groups: LbsNavGroup[],
  options?: { websiteMonitorEnabled?: boolean },
): LbsNavGroup[] =>
  groups
    .map((group) => ({
      ...group,
      items: filterLbsNavItems(group.items, options),
    }))
    .filter((group) => group.items.length > 0);

/** Top-level links before the Clients / Accounts section. */
export const LBS_NAV_STANDALONE: LbsNavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: House,
    activePattern: "/",
    capability: "crm.pipeline.view",
    resource: "deals",
    action: "list",
  },
  {
    to: "/leads",
    label: "Pipeline",
    icon: UserPlus,
    activePattern: "/leads/*",
    capability: "crm.contacts.view",
    resource: "contacts",
    action: "list",
  },
];

/**
 * Dashboard-only standalone items when Accounts hub is enabled
 * (Pipeline is merged into Accounts).
 */
export const LBS_NAV_STANDALONE_WITH_ACCOUNTS_HUB: LbsNavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: House,
    activePattern: "/",
    capability: "crm.pipeline.view",
    resource: "deals",
    action: "list",
  },
];

/** Single sidebar entry for the unified Clients hub (legacy / flag off). */
export const LBS_CLIENTS_NAV_ITEM: LbsNavItem = {
  to: "/clients",
  label: "Clients",
  icon: Users,
  activePattern: "/clients/*",
};

/** Single sidebar entry for the Accounts hub (companies + pipeline). */
export const LBS_ACCOUNTS_NAV_ITEM: LbsNavItem = {
  to: "/accounts",
  label: "Accounts",
  icon: Users,
  activePattern: "/accounts/*",
};

/** Top-level links after Clients (no group header). */
export const LBS_NAV_AFTER_CLIENTS: LbsNavItem[] = [
  {
    to: "/deals",
    label: "Projects",
    icon: Briefcase,
    activePattern: "/deals/*",
    capability: "crm.pipeline.view",
    resource: "deals",
    action: "list",
  },
  {
    to: "/tickets",
    label: "Tickets",
    icon: Ticket,
    activePattern: "/tickets/*",
    capability: "support.tickets.view",
    resource: "tickets",
    action: "list",
  },
  {
    to: "/billing",
    label: "Invoices",
    icon: Receipt,
    activePattern: "/billing/*",
    capability: "proposals.view",
    resource: "proposal_payment_installments",
    action: "list",
  },
  {
    to: "/tasks",
    label: "Calendar",
    icon: CalendarBlank,
    activePattern: "/tasks/*",
    capability: "crm.tasks.view",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/meetings",
    label: "Meeting",
    icon: VideoCamera,
    activePattern: "/meetings/*",
    capability: "meetings.view",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/messages",
    label: "Messages",
    icon: ChatCircle,
    activePattern: "/messages/*",
    capability: "messaging.conversations.view",
    resource: "conversations",
    action: "list",
  },
  {
    to: "/mail",
    label: "Mail",
    icon: EnvelopeSimple,
    activePattern: "/mail/*",
    anyOfCapabilities: ["mail.org.view", "mail.personal.view"],
    resource: "mail_threads",
    action: "list",
  },
  {
    to: "/marketing",
    label: "Marketing",
    icon: Megaphone,
    activePattern: "/marketing/*",
    capability: "marketing.view",
    resource: "marketing_campaigns",
    action: "list",
  },
];

export const LBS_NAV_GROUPS: LbsNavGroup[] = [
  {
    id: "close-billing",
    label: "Close & bill",
    icon: PenNib,
    items: [
      {
        to: "/proposals",
        label: "Proposals",
        icon: FileText,
        activePattern: "/proposals/*",
        capability: "proposals.view",
        resource: "proposals",
        action: "list",
      },
      {
        to: "/contracts",
        label: "Contracts",
        icon: PenNib,
        activePattern: "/contracts/*",
        capability: "contracts.view",
        resource: "contracts",
        action: "list",
      },
    ],
  },
  {
    id: "daily-work",
    label: "Daily work",
    icon: ListChecks,
    items: [],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Globe,
    items: [
      {
        to: "/web-monitor",
        label: "Web Monitor",
        icon: Globe,
        activePattern: "/web-monitor/*",
        capability: "crm.companies.view",
        resource: "monitored_websites",
        action: "list",
      },
      {
        to: "/hostinger",
        label: "Hostinger",
        icon: HardDrives,
        activePattern: "/hostinger/*",
        capability: "crm.companies.view",
        resource: "hostinger_domains",
        action: "list",
      },
      {
        to: "/reports",
        label: "Reports",
        icon: ChartBar,
        activePattern: "/reports/*",
        capability: "reports.view",
        resource: "reports",
        action: "list",
      },
    ],
  },
];

export const LBS_PLACEHOLDER_MODULES = {
  proposals: {
    title: "Proposals",
    description:
      "Create and send proposals, track views, and convert accepted quotes into projects.",
    phase: 4,
  },
  contracts: {
    title: "Contracts",
    description:
      "Manage contract drafts, signatures, and active agreements linked to clients and projects.",
    phase: 4,
  },
  billing: {
    title: "Billing",
    description:
      "Track invoices (INV-YYYY-####), email PDFs, collect payments, and view monthly revenue.",
    phase: 4,
  },
  webForms: {
    title: "Web Forms",
    description:
      "Build intake forms that feed clients, projects, files, tasks, and notes.",
    phase: 5,
  },
  tickets: {
    title: "Tickets",
    description:
      "Simple helpdesk for client support linked to clients, projects, and team members.",
    phase: 6,
  },
} as const;

/** Flat list for top navigation and legacy callers. */
export const LBS_NAV_ITEMS: LbsNavItem[] = [
  ...LBS_NAV_STANDALONE,
  LBS_CLIENTS_NAV_ITEM,
  ...LBS_NAV_AFTER_CLIENTS,
  ...LBS_NAV_GROUPS.flatMap((group) => group.items),
];

/** Flat list when Accounts hub replaces Pipeline + Clients. */
export const LBS_NAV_ITEMS_WITH_ACCOUNTS_HUB: LbsNavItem[] = [
  ...LBS_NAV_STANDALONE_WITH_ACCOUNTS_HUB,
  LBS_ACCOUNTS_NAV_ITEM,
  ...LBS_NAV_AFTER_CLIENTS,
  ...LBS_NAV_GROUPS.flatMap((group) => group.items),
];

/**
 * Contact status filters — canonical choices live in `@/modules/constants/contactStatus`.
 * Legacy values remain in filter arrays until cleanup script 04 is applied.
 */
export {
  CONTACT_STATUS_CHOICES,
  CONTACT_STATUS_LEGACY_MAP,
  isContactDirectoryStatus,
  isLeadLifecycleStatus,
  LBS_CLIENT_STATUS,
  LBS_CONTACT_STATUSES,
  LBS_CONTACT_STATUSES_FOR_FILTER,
  LBS_CONTACT_STATUSES_LEGACY,
  LBS_LEAD_STATUSES,
  LBS_LEAD_STATUSES_FOR_FILTER,
  LBS_LEAD_STATUSES_LEGACY,
} from "@/modules/constants/contactStatus";
export type { ContactStatusValue } from "@/modules/constants/contactStatus";
