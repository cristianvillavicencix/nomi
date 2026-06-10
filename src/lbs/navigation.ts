import type { LucideIcon } from "lucide-react";
import {
  BookUser,
  Briefcase,
  Building2,
  CalendarDays,
  FileSignature,
  FileText,
  Globe,
  Home,
  ListChecks,
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

export const filterLbsNavItems = (
  items: LbsNavItem[],
  options?: { websiteMonitorEnabled?: boolean },
) =>
  items.filter(
    (item) =>
      !(
        item.to === "/web-monitor" &&
        options?.websiteMonitorEnabled === false
      ),
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

/** Top-level links rendered outside group headers. */
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
    label: "Leads",
    icon: UserPlus,
    activePattern: "/leads/*",
    capability: "crm.contacts.view",
    resource: "contacts",
    action: "list",
  },
];

export const LBS_CLIENTS_NAV_COLLAPSIBLE: LbsNavCollapsibleGroup = {
  id: "clients",
  label: "Clients",
  icon: Users,
  storageKey: "sidebar_clients_open",
  children: [
    {
      to: "/companies",
      label: "Companies",
      icon: Building2,
      activePattern: "/companies/*",
      capability: "crm.companies.view",
      resource: "companies",
      action: "list",
    },
    {
      to: "/contacts",
      label: "Contacts",
      icon: BookUser,
      activePattern: "/contacts/*",
      capability: "crm.contacts.view",
      resource: "contacts",
      action: "list",
    },
  ],
};

export const LBS_NAV_GROUPS: LbsNavGroup[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    icon: Building2,
    items: [
      {
        to: "/deals",
        label: "Deals",
        icon: Briefcase,
        activePattern: "/deals/*",
        capability: "crm.pipeline.view",
        resource: "deals",
        action: "list",
      },
    ],
  },
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
      {
        to: "/billing",
        label: "Billing",
        icon: Receipt,
        activePattern: "/billing/*",
        capability: "proposals.view",
        resource: "proposal_payment_installments",
        action: "list",
      },
    ],
  },
  {
    id: "daily-work",
    label: "Daily work",
    icon: ListChecks,
    items: [
      {
        to: "/tasks",
        label: "Tasks",
        icon: ListChecks,
        activePattern: "/tasks/*",
        capability: "crm.tasks.view",
        resource: "tasks",
        action: "list",
      },
      {
        to: "/calendar",
        label: "Calendar",
        icon: CalendarDays,
        activePattern: "/calendar/*",
        capability: "calendar.view",
        resource: "calendar_events",
        action: "list",
      },
      {
        to: "/meetings",
        label: "Meetings",
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
        to: "/tickets",
        label: "Tickets",
        icon: Ticket,
        activePattern: "/tickets/*",
        capability: "support.tickets.view",
        resource: "tickets",
        action: "list",
      },
    ],
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
    ],
  },
];

/** Flat list for top navigation and legacy callers. */
export const LBS_NAV_ITEMS: LbsNavItem[] = [
  ...LBS_NAV_STANDALONE,
  ...LBS_CLIENTS_NAV_COLLAPSIBLE.children,
  ...LBS_NAV_GROUPS.flatMap((group) => group.items),
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

/**
 * Contact status filters — canonical choices live in `@/lbs/constants/contactStatus`.
 * Legacy values remain in filter arrays until cleanup script 04 is applied.
 */
export {
  CONTACT_STATUS_CHOICES,
  CONTACT_STATUS_LEGACY_MAP,
  LBS_CLIENT_STATUS,
  LBS_CONTACT_STATUSES,
  LBS_LEAD_STATUSES,
} from "@/lbs/constants/contactStatus";
export type { ContactStatusValue } from "@/lbs/constants/contactStatus";
