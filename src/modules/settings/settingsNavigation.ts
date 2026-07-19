import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  CreditCard,
  Database,
  FileText,
  GitBranch,
  MessageSquare,
  Package,
  Plug,
  ScrollText,
  Ticket,
  Users,
} from "lucide-react";

export const SETTINGS_TAB_IDS = [
  "company",
  "notifications",
  "users",
  "connectors",
  "communications",
  "tickets",
  "forms",
  "products",
  "proposals",
  "billing",
  "workflows",
  "data",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export const WORKFLOWS_SECTION_IDS = ["pipelines", "leads", "tasks"] as const;
export type WorkflowsSectionId = (typeof WORKFLOWS_SECTION_IDS)[number];

/** Integrations sub-tabs: Twilio, Mail (ESP), Mailboxes (CRM Mail), Google, Stripe, Hostinger, Ask Sigma. */
export const CONNECTORS_SECTION_IDS = [
  "twilio",
  "mail",
  "mailboxes",
  "google",
  "stripe",
  "hostinger",
  "ask-nomi",
] as const;
export type ConnectorsSectionId = (typeof CONNECTORS_SECTION_IDS)[number];

const LEGACY_CONNECTORS_SECTION: Record<string, ConnectorsSectionId> = {
  sms: "twilio",
  marketing: "twilio",
  voice: "twilio",
  whatsapp: "twilio",
  email: "mail",
  "mail-accounts": "mailboxes",
  mailbox: "mailboxes",
  search: "google",
  stripe: "stripe",
  billing: "stripe",
  hostinger: "hostinger",
  assistant: "ask-nomi",
  nomi: "ask-nomi",
  ai: "ask-nomi",
  claude: "ask-nomi",
};

/** In-app Messages composer content (CRM database, not external). */
export const COMMUNICATIONS_SECTION_IDS = ["templates", "signature"] as const;
export type CommunicationsSectionId =
  (typeof COMMUNICATIONS_SECTION_IDS)[number];

export const TICKETS_SECTION_IDS = [
  "outbound",
  "inbound",
  "automations",
  "notifications",
  "workflow",
  "billing",
  "spam",
  "sla",
  "macros",
  "templates",
  "signature",
  "reply_templates",
] as const;
export type TicketsSectionId = (typeof TICKETS_SECTION_IDS)[number];

const LEGACY_TICKETS_SECTION: Record<string, TicketsSectionId> = {
  inbox: "outbound",
  inboxes: "outbound",
  templates: "reply_templates",
};

export const FORMS_SECTION_IDS = ["list"] as const;
export type FormsSectionId = (typeof FORMS_SECTION_IDS)[number];

export const NOTIFICATIONS_SECTION_IDS = ["personal", "workspace"] as const;
export type NotificationsSectionId =
  (typeof NOTIFICATIONS_SECTION_IDS)[number];

export const DATA_SECTION_IDS = ["zoho", "import", "duplicates"] as const;
export type DataSectionId = (typeof DATA_SECTION_IDS)[number];

export const COMPANY_SECTION_IDS = ["profile", "branding"] as const;
export type CompanySectionId = (typeof COMPANY_SECTION_IDS)[number];

export type SettingsNavItem = {
  id: SettingsTabId;
  label: string;
  icon: LucideIcon;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    id: "organization",
    label: "Organization",
    items: [{ id: "company", label: "Company profile", icon: Building2 }],
  },
  {
    id: "account",
    label: "Account",
    items: [{ id: "notifications", label: "Notifications", icon: Bell }],
  },
  {
    id: "team",
    label: "Team",
    items: [{ id: "users", label: "Users & access", icon: Users }],
  },
  {
    id: "integrations",
    label: "Connectors",
    items: [{ id: "connectors", label: "Integrations", icon: Plug }],
  },
  {
    id: "product",
    label: "Product",
    items: [
      { id: "forms", label: "Forms", icon: FileText },
      { id: "communications", label: "Messaging", icon: MessageSquare },
      { id: "tickets", label: "Tickets", icon: Ticket },
      { id: "products", label: "Products", icon: Package },
      { id: "proposals", label: "Proposals", icon: ScrollText },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "workflows", label: "Pipelines & fields", icon: GitBranch },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [{ id: "data", label: "Data import", icon: Database }],
  },
];

const LEGACY_TAB_ALIASES: Record<string, SettingsTabId> = {
  general: "company",
  messaging: "connectors",
  projects: "workflows",
  notes: "workflows",
  tasks: "workflows",
  plans: "users",
  roles: "users",
  "web-monitor": "connectors",
  commercial: "products",
  catalog: "products",
};

const DEFAULT_SECTION_BY_TAB: Partial<Record<SettingsTabId, string>> = {
  workflows: "pipelines",
  connectors: "twilio",
  communications: "templates",
  tickets: "outbound",
  forms: "list",
  notifications: "personal",
  data: "zoho",
  company: "profile",
};

const isSettingsTabId = (value: string): value is SettingsTabId =>
  (SETTINGS_TAB_IDS as readonly string[]).includes(value);

const isWorkflowsSectionId = (value: string): value is WorkflowsSectionId =>
  (WORKFLOWS_SECTION_IDS as readonly string[]).includes(value);

const isConnectorsSectionId = (value: string): value is ConnectorsSectionId =>
  (CONNECTORS_SECTION_IDS as readonly string[]).includes(value);

const isCommunicationsSectionId = (
  value: string,
): value is CommunicationsSectionId =>
  (COMMUNICATIONS_SECTION_IDS as readonly string[]).includes(value);

const isTicketsSectionId = (value: string): value is TicketsSectionId =>
  (TICKETS_SECTION_IDS as readonly string[]).includes(value);

const isFormsSectionId = (value: string): value is FormsSectionId =>
  (FORMS_SECTION_IDS as readonly string[]).includes(value);

const isNotificationsSectionId = (
  value: string,
): value is NotificationsSectionId =>
  (NOTIFICATIONS_SECTION_IDS as readonly string[]).includes(value);

const isDataSectionId = (value: string): value is DataSectionId =>
  (DATA_SECTION_IDS as readonly string[]).includes(value);

const isCompanySectionId = (value: string): value is CompanySectionId =>
  (COMPANY_SECTION_IDS as readonly string[]).includes(value);

export const resolveSettingsRoute = (searchParams: URLSearchParams) => {
  const rawTab = searchParams.get("tab");
  const sectionParam = searchParams.get("section");

  let normalizedTab = rawTab ? (LEGACY_TAB_ALIASES[rawTab] ?? rawTab) : null;

  if (rawTab === "commercial" && sectionParam === "billing") {
    normalizedTab = "billing";
  } else if (
    sectionParam === "catalog" ||
    (rawTab === "commercial" &&
      sectionParam !== "billing" &&
      sectionParam !== "contracts")
  ) {
    normalizedTab = "products";
  } else if (rawTab === "commercial" && sectionParam === "contracts") {
    normalizedTab = "proposals";
  } else if (rawTab === "proposals" && sectionParam === "catalog") {
    normalizedTab = "products";
  } else if (rawTab === "connectors" && sectionParam === "content") {
    normalizedTab = "communications";
  } else if (rawTab === "connectors" && sectionParam === "notifications") {
    normalizedTab = "notifications";
  } else if (rawTab === "connectors" && sectionParam === "tickets") {
    normalizedTab = "tickets";
  } else if (
    rawTab === "forms" &&
    sectionParam === "notifications"
  ) {
    normalizedTab = "notifications";
  }

  const tab: SettingsTabId = isSettingsTabId(normalizedTab ?? "")
    ? (normalizedTab as SettingsTabId)
    : "company";

  let workflowsSection: WorkflowsSectionId = "pipelines";
  if (isWorkflowsSectionId(sectionParam ?? "")) {
    workflowsSection = sectionParam as WorkflowsSectionId;
  } else if (rawTab === "notes") {
    workflowsSection = "leads";
  } else if (rawTab === "tasks") {
    workflowsSection = "tasks";
  } else if (rawTab === "projects") {
    workflowsSection = "pipelines";
  }

  let connectorsSection: ConnectorsSectionId = "twilio";
  if (isConnectorsSectionId(sectionParam ?? "")) {
    connectorsSection = sectionParam as ConnectorsSectionId;
  } else if (
    sectionParam &&
    LEGACY_CONNECTORS_SECTION[sectionParam]
  ) {
    connectorsSection = LEGACY_CONNECTORS_SECTION[sectionParam];
  } else if (rawTab === "web-monitor" || rawTab === "messaging") {
    connectorsSection = rawTab === "web-monitor" ? "google" : "twilio";
  }

  let communicationsSection: CommunicationsSectionId = "templates";
  if (isCommunicationsSectionId(sectionParam ?? "")) {
    communicationsSection = sectionParam as CommunicationsSectionId;
  } else if (rawTab === "connectors" && sectionParam === "content") {
    communicationsSection = "templates";
  }

  let ticketsSection: TicketsSectionId = "outbound";
  if (isTicketsSectionId(sectionParam ?? "")) {
    ticketsSection = sectionParam as TicketsSectionId;
  } else if (sectionParam && LEGACY_TICKETS_SECTION[sectionParam]) {
    ticketsSection = LEGACY_TICKETS_SECTION[sectionParam];
  } else if (rawTab === "connectors" && sectionParam === "tickets") {
    ticketsSection = "outbound";
  }

  let formsSection: FormsSectionId = "list";
  if (isFormsSectionId(sectionParam ?? "")) {
    formsSection = sectionParam as FormsSectionId;
  }

  let notificationsSection: NotificationsSectionId = "personal";
  if (isNotificationsSectionId(sectionParam ?? "")) {
    notificationsSection = sectionParam as NotificationsSectionId;
  } else if (
    (rawTab === "connectors" || rawTab === "forms") &&
    sectionParam === "notifications"
  ) {
    notificationsSection = "workspace";
  }

  let dataSection: DataSectionId = "zoho";
  if (isDataSectionId(sectionParam ?? "")) {
    dataSection = sectionParam as DataSectionId;
  }

  let companySection: CompanySectionId = "profile";
  if (isCompanySectionId(sectionParam ?? "")) {
    companySection = sectionParam as CompanySectionId;
  }

  return {
    tab,
    workflowsSection,
    connectorsSection,
    communicationsSection,
    ticketsSection,
    formsSection,
    notificationsSection,
    dataSection,
    companySection,
  };
};

export const getSettingsTabLabel = (tab: SettingsTabId) => {
  for (const group of SETTINGS_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.id === tab);
    if (item) return item.label;
  }
  return "Settings";
};

export const buildSettingsSearchParams = (
  tab: SettingsTabId,
  section?: string,
) => {
  const params = new URLSearchParams();
  params.set("tab", tab);
  const defaultSection = DEFAULT_SECTION_BY_TAB[tab];
  if (section && defaultSection && section !== defaultSection) {
    params.set("section", section);
  } else if (section && !defaultSection) {
    params.set("section", section);
  }
  return params;
};
