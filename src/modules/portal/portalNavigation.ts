import {
  CreditCard,
  FolderOpen,
  Globe,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { PortalCopy } from "@/modules/portal/portalI18n";
import type { PortalView } from "@/modules/portal/portalTypes";

export type PortalNavItem = {
  id: PortalView;
  label: (copy: PortalCopy) => string;
  icon: LucideIcon;
};

export const PORTAL_DELIVERY_NAV: PortalNavItem[] = [
  {
    id: "overview",
    label: (copy) => copy.overviewTab,
    icon: LayoutDashboard,
  },
  {
    id: "hosting",
    label: (copy) => copy.hostingTab,
    icon: Server,
  },
  {
    id: "domain",
    label: (copy) => copy.domainTab,
    icon: Globe,
  },
  {
    id: "credentials",
    label: (copy) => copy.credentialsTab,
    icon: KeyRound,
  },
  {
    id: "billing",
    label: (copy) => copy.billingTab,
    icon: CreditCard,
  },
  {
    id: "files",
    label: (copy) => copy.filesTab,
    icon: FolderOpen,
  },
  {
    id: "handoff",
    label: (copy) => copy.handoffTab,
    icon: ListChecks,
  },
];

export const parsePortalView = (value: string | null): PortalView => {
  if (value === "overview") return "overview";
  if (value === "hosting" || value === "hosting_domain") return "hosting";
  if (value === "domain" || value === "domain_dns") return "domain";
  if (value === "credentials") return "credentials";
  if (value === "billing") return "billing";
  if (value === "files") return "files";
  if (value === "handoff") return "handoff";
  return "overview";
};
