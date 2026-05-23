import type { DataProvider, Identifier } from "ra-core";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";
import { createProjectTypeTasksForDeal } from "@/lbs/projects/projectTypeAutomations";
import type { LbsDeal } from "@/lbs/types";

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

/**
 * Simple stage-change hooks for LBS agency projects (Phase 8).
 * No external webhooks — tasks + optional future SMS templates.
 */
export const runProjectStageAutomations = async ({
  dataProvider,
  deal,
  previousStage,
  organizationMemberId,
}: {
  dataProvider: DataProvider;
  deal: LbsDeal;
  previousStage?: string | null;
  organizationMemberId?: Identifier;
}) => {
  const normalized = normalizeLbsProjectStage(deal.stage);
  const prev = previousStage ? normalizeLbsProjectStage(previousStage) : null;
  if (prev === normalized) return;

  if (normalized === "client_review") {
    await ensureTask(dataProvider, deal, organizationMemberId, {
      type: "client-review",
      text: "Send client review link and follow up",
      priority: "high",
      dueDaysOffset: 1,
    });
  }

  if (normalized === "launch") {
    await ensureTask(dataProvider, deal, organizationMemberId, {
      type: "launch",
      text: "Complete launch checklist (DNS, SSL, analytics, redirects)",
      priority: "high",
      dueDaysOffset: 0,
    });
  }
};

export const runProjectCreateAutomations = async ({
  dataProvider,
  deal,
  organizationMemberId,
}: {
  dataProvider: DataProvider;
  deal: LbsDeal;
  organizationMemberId?: Identifier;
}) =>
  createProjectTypeTasksForDeal({ dataProvider, deal, organizationMemberId });

const ensureTask = async (
  dataProvider: DataProvider,
  deal: LbsDeal,
  organizationMemberId: Identifier | undefined,
  template: { type: string; text: string; priority?: string; dueDaysOffset: number },
) => {
  const contactId = getDealContactId(deal);
  if (!contactId || !organizationMemberId) return;

  const { data: existing } = await dataProvider.getList("tasks", {
    filter: { "deal_id@eq": deal.id, "done_date@is": null },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });

  if (existing.some((t) => String(t.text).toLowerCase() === template.text.toLowerCase())) {
    return;
  }

  await dataProvider.create("tasks", {
    data: normalizeTaskCreateData({
      contact_id: contactId,
      deal_id: deal.id,
      type: template.type,
      text: template.text,
      priority: template.priority ?? "normal",
      due_date: offsetDate(template.dueDaysOffset),
      organization_member_id: organizationMemberId,
    }),
  });
};
