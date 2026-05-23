import type { DataProvider, Identifier } from "ra-core";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";
import {
  DEFAULT_LBS_COMMISSION_PERCENT,
  LBS_COMMISSION_WON_STAGES,
} from "@/lbs/projects/financials/constants";
import type { LbsDeal } from "@/lbs/types";

const normalizeEmail = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

const resolvePersonIdForMember = async (
  dataProvider: DataProvider,
  member: { id: Identifier; email?: string | null },
) => {
  const email = normalizeEmail(member.email);
  if (!email) return null;

  const { data: people } = await dataProvider.getList("people", {
    filter: { "email@eq": email, "type@eq": "salesperson" },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });

  return people[0]?.id ?? null;
};

export const ensureCommissionsForWonDeal = async ({
  dataProvider,
  deal,
}: {
  dataProvider: DataProvider;
  deal: LbsDeal;
}) => {
  const stage = normalizeLbsProjectStage(deal.stage);
  if (!LBS_COMMISSION_WON_STAGES.has(stage)) return 0;

  const assignedMemberIds = Array.isArray(deal.salesperson_ids)
    ? deal.salesperson_ids.map(Number).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (assignedMemberIds.length === 0) return 0;

  const { data: existing = [] } = await dataProvider.getList("deal_commissions", {
    filter: { "deal_id@eq": deal.id },
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
  });

  const existingSalespersonIds = new Set(
    existing.map((row) => Number(row.salesperson_id)).filter(Boolean),
  );

  const { data: members = [] } = await dataProvider.getList(
    "organization_members",
    {
      filter: { "id@in": `(${assignedMemberIds.join(",")})` },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    },
  );

  let created = 0;
  for (const member of members) {
    const personId = await resolvePersonIdForMember(dataProvider, member);
    if (personId == null || existingSalespersonIds.has(Number(personId))) {
      continue;
    }

    await dataProvider.create("deal_commissions", {
      data: {
        deal_id: deal.id,
        salesperson_id: personId,
        commission_type: "percentage",
        commission_value: DEFAULT_LBS_COMMISSION_PERCENT,
        basis: "payments_collected",
        paid: false,
        notes: "Auto-created when project reached won/delivered stage",
      },
    });
    existingSalespersonIds.add(Number(personId));
    created += 1;
  }

  return created;
};

export const getCommissionAutomationMessage = (count: number) => {
  if (count <= 0) return null;
  return count === 1
    ? "1 commission record was created for the assigned salesperson."
    : `${count} commission records were created for assigned salespeople.`;
};
