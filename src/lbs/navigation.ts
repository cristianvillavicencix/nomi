import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  FileSignature,
  FileText,
  FolderKanban,
  FormInput,
  Home,
  ListChecks,
  Settings,
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
  resource?: string;
  action?: string;
};

export const LBS_NAV_ITEMS: LbsNavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: Home,
    activePattern: "/",
    resource: "deals",
    action: "list",
  },
  {
    to: "/leads",
    label: "Leads",
    icon: UserPlus,
    activePattern: "/leads/*",
    resource: "contacts",
    action: "list",
  },
  {
    to: "/clients",
    label: "Clients",
    icon: Building2,
    activePattern: "/clients/*",
    resource: "companies",
    action: "list",
  },
  {
    to: "/deals",
    label: "Projects",
    icon: FolderKanban,
    activePattern: "/deals/*",
    resource: "deals",
    action: "list",
  },
  {
    to: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    activePattern: "/calendar/*",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/meetings",
    label: "Meetings",
    icon: Video,
    activePattern: "/meetings/*",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/messages",
    label: "Messages",
    icon: MessageSquare,
    activePattern: "/messages/*",
    resource: "conversations",
    action: "list",
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: ListChecks,
    activePattern: "/tasks/*",
    resource: "tasks",
    action: "list",
  },
  {
    to: "/proposals",
    label: "Proposals",
    icon: FileText,
    activePattern: "/proposals/*",
    resource: "proposals",
    action: "list",
  },
  {
    to: "/contracts",
    label: "Contracts",
    icon: FileSignature,
    activePattern: "/contracts/*",
    resource: "contracts",
    action: "list",
  },
  {
    to: "/web-forms",
    label: "Web Forms",
    icon: FormInput,
    activePattern: "/web-forms/*",
    resource: "forms",
    action: "list",
  },
];

export const LBS_USER_MENU_NAV_ITEMS: LbsNavItem[] = [
  {
    to: "/tickets",
    label: "Tickets",
    icon: Ticket,
    activePattern: "/tickets/*",
    resource: "tickets",
    action: "list",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    activePattern: "/settings/*",
    resource: "configuration",
    action: "edit",
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

/** Lead pipeline statuses (contacts table, no separate leads table). */
export const LBS_LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "proposal-sent",
  "lost",
] as const;

/** People linked to client companies (post-conversion or assigned). */
export const LBS_CONTACT_STATUSES = ["client", "contact"] as const;

export const LBS_CLIENT_STATUS = "client";
