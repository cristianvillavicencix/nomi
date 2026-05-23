import type { DataProvider, Identifier } from "ra-core";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import {
  normalizeAgencyProjectType,
  type LbsAgencyProjectType,
} from "@/lbs/deals/lbsAgencyProjectModel";
import type { LbsDeal } from "@/lbs/types";

type ProjectTypeTaskTemplate = {
  type: string;
  text: string;
  priority?: string;
  dueDaysOffset: number;
  internal?: boolean;
};

export const PROJECT_TYPE_TASK_TEMPLATES: Record<
  LbsAgencyProjectType,
  ProjectTypeTaskTemplate[]
> = {
  website: [
    {
      type: "kickoff",
      text: "Schedule project kickoff and confirm scope",
      priority: "high",
      dueDaysOffset: 2,
    },
    {
      type: "content-request",
      text: "Request content, logo, and assets from client",
      dueDaysOffset: 5,
    },
    {
      type: "internal",
      text: "Create sitemap and page structure outline",
      internal: true,
      dueDaysOffset: 3,
    },
  ],
  seo: [
    {
      type: "seo-audit",
      text: "Run initial SEO audit and baseline report",
      priority: "high",
      dueDaysOffset: 3,
    },
    {
      type: "keyword-research",
      text: "Complete keyword research and priority targets",
      dueDaysOffset: 5,
    },
  ],
  "google-ads": [
    {
      type: "ads-setup",
      text: "Set up ad accounts and conversion tracking",
      priority: "high",
      dueDaysOffset: 2,
    },
    {
      type: "campaign-structure",
      text: "Build campaign structure and ad groups",
      dueDaysOffset: 5,
    },
  ],
  "social-media": [
    {
      type: "content-calendar",
      text: "Draft content calendar and posting schedule",
      dueDaysOffset: 3,
    },
    {
      type: "brand-voice",
      text: "Confirm brand voice and visual guidelines",
      dueDaysOffset: 5,
    },
  ],
  branding: [
    {
      type: "brand-discovery",
      text: "Complete brand discovery questionnaire",
      priority: "high",
      dueDaysOffset: 2,
    },
    {
      type: "style-guide",
      text: "Prepare mood board and style direction",
      dueDaysOffset: 7,
    },
  ],
  automation: [
    {
      type: "workflow-mapping",
      text: "Map current workflows and automation opportunities",
      dueDaysOffset: 3,
    },
    {
      type: "integration-inventory",
      text: "Inventory tools and integration requirements",
      dueDaysOffset: 5,
    },
  ],
  "crm-setup": [
    {
      type: "pipeline-config",
      text: "Configure CRM pipeline and deal stages",
      priority: "high",
      dueDaysOffset: 2,
    },
    {
      type: "data-import",
      text: "Plan contact and company data import",
      dueDaysOffset: 5,
    },
  ],
  maintenance: [
    {
      type: "hosting-audit",
      text: "Audit hosting, SSL, and backup status",
      dueDaysOffset: 2,
    },
    {
      type: "maintenance-plan",
      text: "Document maintenance schedule and SLAs",
      dueDaysOffset: 5,
    },
  ],
};

const getDealContactId = (deal: LbsDeal): Identifier | null =>
  deal.contact_id ??
  (Array.isArray(deal.contact_ids) && deal.contact_ids.length > 0
    ? deal.contact_ids[0]
    : null);

const offsetDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const createProjectTypeTasksForDeal = async ({
  dataProvider,
  deal,
  organizationMemberId,
}: {
  dataProvider: DataProvider;
  deal: LbsDeal;
  organizationMemberId?: Identifier;
}) => {
  const key = normalizeAgencyProjectType(deal.project_type);
  const templates = PROJECT_TYPE_TASK_TEMPLATES[key] ?? [];
  const contactId = getDealContactId(deal);
  if (!contactId || !organizationMemberId || templates.length === 0) return 0;

  let created = 0;
  for (const template of templates) {
    await dataProvider.create("tasks", {
      data: normalizeTaskCreateData({
        contact_id: contactId,
        deal_id: deal.id,
        type: template.type,
        text: template.text,
        priority: template.priority ?? "normal",
        internal: template.internal ?? false,
        due_date: offsetDate(template.dueDaysOffset),
        organization_member_id: organizationMemberId,
      }),
    });
    created += 1;
  }
  return created;
};
