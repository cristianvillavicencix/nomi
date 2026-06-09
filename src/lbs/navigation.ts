import type { LucideIcon } from "lucide-react";
import {
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

export const LBS_NAV_GROUPS: LbsNavGroup[] = [
  {
    id: "pipeline",
    label: "Pipeline",
    icon: Building2,
    items: [
      {
        to: "/clients",
        label: "Clients",
        icon: Building2,
        activePattern: "/clients/*",
        capability: "crm.companies.view",
        resource: "companies",
        action: "list",
      },
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
 * Status values on `contacts` that mark the row as a "lead" (vs. a client
 * contact). The pipeline position itself lives in `contacts.lead_stage`
 * (new/contacted/talking/quoted/closing/paused/won/lost) — these are just
 * the lifecycle bucket markers.
 *
 * Legacy values ('warm', 'cold', 'prospect') are kept so existing rows
 * stay visible until migrated.
 */
export const LBS_LEAD_STATUSES = ["lead", "warm", "cold", "prospect"] as const;

/** People linked to client companies (post-conversion or assigned). */
export const LBS_CONTACT_STATUSES = ["client", "contact"] as const;

export const LBS_CLIENT_STATUS = "client";
