import type { DataProvider, Identifier } from "ra-core";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import {
  getLbsProjectStageLabel,
  normalizeLbsProjectStage,
} from "@/lbs/deals/lbsProjectConstants";
import {
  getIncompleteBriefSections,
  getProjectBriefProgress,
} from "@/lbs/deals/projectBriefProgress";
import { isLbsMode } from "@/lbs/productMode";
import type { LbsDeal } from "@/lbs/types";

type StageTaskTemplate = {
  type: string;
  text: string;
  priority?: string;
  dueDaysOffset: number;
  internal?: boolean;
};

export const STAGE_TASK_TEMPLATES: Record<string, StageTaskTemplate[]> = {
  won: [
    {
      type: "brief-review",
      text: "Review accepted scope and confirm project setup",
      priority: "high",
      dueDaysOffset: 2,
    },
    {
      type: "content-request",
      text: "Request content and assets from client",
      dueDaysOffset: 5,
    },
    {
      type: "internal",
      text: "Internal project setup checklist",
      internal: true,
      dueDaysOffset: 1,
    },
  ],
  review: [
    {
      type: "design-approval",
      text: "Collect client review and approval",
      priority: "high",
      dueDaysOffset: 3,
    },
  ],
  launch: [
    {
      type: "launch",
      text: "Run launch checklist and final QA",
      priority: "high",
      dueDaysOffset: 2,
    },
  ],
  closed_won: [
    {
      type: "client-follow-up",
      text: "Confirm handoff and close out project documentation",
      dueDaysOffset: 3,
    },
  ],
  setup: [
    {
      type: "brief-review",
      text: "Review accepted scope and confirm project setup",
      priority: "high",
      dueDaysOffset: 2,
    },
  ],
  client_review: [
    {
      type: "design-approval",
      text: "Collect client review and approval",
      priority: "high",
      dueDaysOffset: 3,
    },
  ],
  delivered: [
    {
      type: "client-follow-up",
      text: "Confirm handoff and close out project documentation",
      dueDaysOffset: 3,
    },
  ],
};

const getDealContactId = (deal: LbsDeal): Identifier | null =>
  deal.contact_id ??
  (Array.isArray(deal.contact_ids) && deal.contact_ids.length > 0
    ? deal.contact_ids[0]
    : null);

export const createBriefGapTasksForDeal = async ({
  dataProvider,
  deal,
  organizationMemberId,
}: {
  dataProvider: DataProvider;
  deal: LbsDeal;
  organizationMemberId?: Identifier;
}) => {
  if (!isLbsMode()) return 0;

  const contactId = getDealContactId(deal);
  if (!contactId || !organizationMemberId) return 0;

  const progress = getProjectBriefProgress(deal);
  if (progress.percent >= 100) return 0;

  const incomplete = getIncompleteBriefSections(deal);
  if (incomplete.length === 0) return 0;

  const { data: existingTasks } = await dataProvider.getList("tasks", {
    filter: { "deal_id@eq": deal.id, "done_date@is": null },
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });

  const existingTexts = new Set(
    existingTasks.map((task) => String(task.text ?? "").toLowerCase()),
  );

  let created = 0;
  for (const sectionTitle of incomplete.slice(0, 3)) {
    const text = `Complete brief: ${sectionTitle}`;
    if (existingTexts.has(text.toLowerCase())) continue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    await dataProvider.create("tasks", {
      data: normalizeTaskCreateData({
        contact_id: contactId,
        deal_id: deal.id,
        type: "brief-review",
        text,
        priority: "high",
        due_date: dueDate.toISOString().slice(0, 10),
        organization_member_id: organizationMemberId,
      }),
    });
    created += 1;
  }

  return created;
};

export const createStageTasksForDeal = async ({
  dataProvider,
  deal,
  newStage,
  previousStage,
  organizationMemberId,
}: {
  dataProvider: DataProvider;
  deal: LbsDeal;
  newStage: string;
  previousStage?: string | null;
  organizationMemberId?: Identifier;
}) => {
  if (!isLbsMode()) return 0;
  const normalized = normalizeLbsProjectStage(newStage);
  if (previousStage && normalizeLbsProjectStage(previousStage) === normalized) {
    return 0;
  }

  const templates = STAGE_TASK_TEMPLATES[normalized];
  if (!templates?.length) return 0;

  const contactId = getDealContactId(deal);
  if (!contactId || !organizationMemberId) return 0;

  for (const template of templates) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.dueDaysOffset);
    await dataProvider.create("tasks", {
      data: normalizeTaskCreateData({
        contact_id: contactId,
        deal_id: deal.id,
        type: template.type,
        text: template.text,
        priority: template.priority ?? "normal",
        internal: template.internal ?? false,
        due_date: dueDate.toISOString().slice(0, 10),
        organization_member_id: organizationMemberId,
      }),
    });
  }

  return templates.length;
};

export const getStageTasksCreatedMessage = (
  newStage: string,
  count: number,
) => {
  if (count === 0) return null;
  const label = getLbsProjectStageLabel(newStage);
  return `${count} task${count === 1 ? "" : "s"} added for ${label}`;
};
