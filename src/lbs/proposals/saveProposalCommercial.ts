import type { DataProvider, Identifier } from "ra-core";
import type {
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
  ProposalPaymentSchedule,
} from "@/lbs/types";
import {
  calculateProposalTotals,
  computeValidUntil,
  formatProposalNumber,
  generatePaymentInstallments,
  lineTotal,
  recurringSummaryFromLines,
  type PaymentScheduleConfig,
  type ProposalLineDraft,
} from "@/lbs/proposals/proposalCommercialUtils";
import {
  DEFAULT_CURRENCY,
  DEFAULT_DEPOSIT_PERCENT,
  DEFAULT_VALIDITY_DAYS,
} from "@/lbs/proposals/proposalCommercialConstants";

export type SaveProposalCommercialInput = {
  orgId: number;
  proposal: Partial<Proposal> & {
    title: string;
    company_id?: Identifier | null;
    contact_id?: Identifier | null;
    deal_id?: Identifier | null;
    organization_member_id?: Identifier | null;
  };
  lines: ProposalLineDraft[];
  scheduleConfig: PaymentScheduleConfig;
  validityDays?: number;
  depositPercent?: number;
};

const deleteExistingChildren = async (
  dataProvider: DataProvider,
  proposalId: Identifier,
) => {
  const [lineItems, schedules] = await Promise.all([
    dataProvider.getList<ProposalLineItem>("proposal_line_items", {
      filter: { "proposal_id@eq": proposalId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    }),
    dataProvider.getList<ProposalPaymentSchedule>(
      "proposal_payment_schedules",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    ),
  ]);

  const scheduleIds = schedules.data.map((schedule) => schedule.id);
  if (scheduleIds.length > 0) {
    const installments = await dataProvider.getList<ProposalPaymentInstallment>(
      "proposal_payment_installments",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 500 },
        sort: { field: "id", order: "ASC" },
      },
    );
    await Promise.all(
      installments.data.map((row) =>
        dataProvider.delete("proposal_payment_installments", {
          id: row.id,
          previousData: row,
        }),
      ),
    );
  }

  await Promise.all([
    ...lineItems.data.map((row) =>
      dataProvider.delete("proposal_line_items", {
        id: row.id,
        previousData: row,
      }),
    ),
    ...schedules.data.map((row) =>
      dataProvider.delete("proposal_payment_schedules", {
        id: row.id,
        previousData: row,
      }),
    ),
  ]);
};

export const saveProposalCommercial = async (
  dataProvider: DataProvider,
  input: SaveProposalCommercialInput,
  existingProposalId?: Identifier | null,
) => {
  const validityDays = input.validityDays ?? DEFAULT_VALIDITY_DAYS;
  const depositPercent = input.depositPercent ?? DEFAULT_DEPOSIT_PERCENT;
  const totals = calculateProposalTotals(input.lines, depositPercent);
  const validUntil = computeValidUntil(validityDays);
  const recurringSummary = recurringSummaryFromLines(input.lines);
  const installments = generatePaymentInstallments({
    depositAmount: totals.depositAmount,
    balanceAmount: totals.balanceAmount,
    config: input.scheduleConfig,
  });

  const proposalPayload: Partial<Proposal> = {
    ...input.proposal,
    status: input.proposal.status ?? "draft",
    amount: totals.grandTotalOneTime,
    one_time_total: totals.oneTimeTotal,
    deposit_percent: depositPercent,
    deposit_amount: totals.depositAmount,
    balance_amount: totals.balanceAmount,
    currency: input.proposal.currency ?? DEFAULT_CURRENCY,
    validity_days: validityDays,
    valid_until: validUntil,
    payment_schedule_config: input.scheduleConfig as Record<string, unknown>,
    recurring_summary: recurringSummary,
    org_id: input.orgId,
  };

  let proposalId = existingProposalId ?? null;
  let proposalRecord: Proposal;

  if (proposalId != null) {
    const { data: previousData } = await dataProvider.getOne<Proposal>(
      "proposals",
      { id: proposalId },
    );
    await deleteExistingChildren(dataProvider, proposalId);
    const { data } = await dataProvider.update<Proposal>("proposals", {
      id: proposalId,
      data: proposalPayload,
      previousData,
    });
    proposalRecord = data;
  } else {
    const { data } = await dataProvider.create<Proposal>("proposals", {
      data: proposalPayload as Proposal,
    });
    proposalRecord = data;
    proposalId = data.id;

    const proposalNumber = formatProposalNumber(input.orgId, Number(proposalId));
    const { data: numbered } = await dataProvider.update<Proposal>("proposals", {
      id: proposalId,
      data: { proposal_number: proposalNumber },
      previousData: data,
    });
    proposalRecord = numbered;
  }

  await Promise.all(
    input.lines.map((line, index) =>
      dataProvider.create<ProposalLineItem>("proposal_line_items", {
        data: {
          proposal_id: proposalId!,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          line_total: lineTotal(line.quantity, line.unit_price),
          package_id: line.package_id ?? null,
          addon_id: line.addon_id ?? null,
          billing_type: line.billing_type,
          billing_interval: line.billing_interval ?? null,
          sort_order: line.sort_order ?? index,
        },
      }),
    ),
  );

  const { data: schedule } = await dataProvider.create<ProposalPaymentSchedule>(
    "proposal_payment_schedules",
    {
      data: {
        org_id: input.orgId,
        proposal_id: proposalId!,
        deposit_amount: totals.depositAmount,
        balance_amount: totals.balanceAmount,
        deposit_due_date: input.scheduleConfig.deposit_due_date ?? validUntil,
        installment_frequency: input.scheduleConfig.installment_frequency,
        installment_count: input.scheduleConfig.installment_count,
        currency: proposalRecord.currency ?? DEFAULT_CURRENCY,
      },
    },
  );

  await Promise.all(
    installments.map((installment) =>
      dataProvider.create<ProposalPaymentInstallment>(
        "proposal_payment_installments",
        {
          data: {
            org_id: input.orgId,
            schedule_id: schedule.id,
            proposal_id: proposalId!,
            installment_number: installment.installment_number,
            label: installment.label,
            due_date: installment.due_date,
            amount: installment.amount,
            billing_type: installment.billing_type,
            status: "pending",
            payment_method: "manual",
          },
        },
      ),
    ),
  );

  return { proposal: proposalRecord, schedule, installments };
};
