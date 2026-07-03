import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Briefcase,
  CalendarDays,
  FileSignature,
  FileText,
  Globe,
  Home,
  LayoutGrid,
  ListChecks,
  Megaphone,
  Receipt,
  Ticket,
  UserPlus,
  Users,
  Video,
  MessageSquare,
} from "lucide-react";

export type LbsNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  activePattern: string;
  capability?: string;
  resource?: string;
  action?: string;
};

export type LbsNavCollapsibleGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  storageKey: string;
  children: LbsNavItem[];
};

export type LbsNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: LbsNavItem[];
};

export type LbsNavCollapsibleSection = {
  id: string;
  label: string;
  icon: LucideIcon;
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
  icon: LayoutGrid,
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

/** Top-level links before the Clients section. */
export const LBS_NAV_STANDALONE: LbsNavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: Home,
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

/** Single sidebar entry for the unified Clients hub. */
export const LBS_CLIENTS_NAV_ITEM: LbsNavItem = {
  to: "/clients",
  label: "Clients",
  icon: Users,
  activePattern: "/clients/*",
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
    icon: CalendarDays,
    activePattern: "/tasks/*",
    capability: "crm.tasks.view",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/meetings",
    label: "Meeting",
    icon: Video,
    activePattern: "/meetings/*",
    capability: "meetings.view",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/messages",
    label: "Messages",
    icon: MessageSquare,
    activePattern: "/messages/*",
    capability: "messaging.conversations.view",
    resource: "conversations",
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
    icon: FileSignature,
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
        icon: FileSignature,
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
        to: "/reports",
        label: "Reports",
        icon: BarChart2,
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
