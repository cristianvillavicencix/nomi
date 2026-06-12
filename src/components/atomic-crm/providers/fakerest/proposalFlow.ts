import type { DataProvider, Identifier } from "ra-core";
import type {
  Contract,
  Proposal,
  ProposalLineItem,
  ProposalPaymentInstallment,
} from "@/modules/types";

type PublicProposalToken = {
  id: number;
  token: string;
  short_code: string;
  org_id: number;
  proposal_id: number;
  expires_at: string;
  uses_count: number;
  created_at: string;
};

const randomToken = () =>
  crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

const randomShortCode = () => Math.random().toString(36).slice(2, 9);

export const fakeSendProposal = async (
  dataProvider: DataProvider,
  proposalId: Identifier,
) => {
  const { data: proposal } = await dataProvider.getOne<Proposal>("proposals", {
    id: proposalId,
  });

  const token = randomToken();
  const shortCode = randomShortCode();
  const expiresAt =
    proposal.valid_until != null
      ? new Date(`${proposal.valid_until}T23:59:59`).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await dataProvider.create("public_proposal_tokens", {
    data: {
      token,
      short_code: shortCode,
      org_id: proposal.org_id ?? 1,
      proposal_id: proposalId,
      expires_at: expiresAt,
      uses_count: 0,
    },
  });

  const now = new Date().toISOString();
  await dataProvider.update("proposals", {
    id: proposalId,
    data: { status: "sent", sent_at: now },
    previousData: proposal,
  });

  if (proposal.deal_id) {
    const { data: deal } = await dataProvider.getOne("deals", {
      id: proposal.deal_id,
    });
    await dataProvider.update("deals", {
      id: proposal.deal_id,
      data: { stage: "proposal_sent", lifecycle_phase: "opportunity" },
      previousData: deal,
    });
  }

  if (proposal.contact_id) {
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: proposal.contact_id,
    });
    await dataProvider.update("contacts", {
      id: proposal.contact_id,
      data: { lead_stage: "quoted" },
      previousData: contact,
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/proposal/${token}`;
  const short_url = `${origin}/pr/${shortCode}`;

  return {
    token,
    short_code: shortCode,
    url,
    short_url,
    expires_at: expiresAt,
  };
};

export const fakeAcceptProposal = async (
  dataProvider: DataProvider,
  proposalId: Identifier,
) => {
  const { data: proposal } = await dataProvider.getOne<Proposal>("proposals", {
    id: proposalId,
  });

  if (proposal.accepted_at && proposal.deal_id) {
    return {
      deal_id: proposal.deal_id,
      proposal_id: proposalId,
      contract_id: proposal.contract_id ?? null,
    };
  }

  let dealId = proposal.deal_id ?? null;

  if (!dealId) {
    const { data: deal } = await dataProvider.create("deals", {
      data: {
        org_id: proposal.org_id ?? 1,
        name: proposal.title,
        company_id: proposal.company_id,
        contact_id: proposal.contact_id,
        contact_ids: proposal.contact_id ? [proposal.contact_id] : [],
        stage: "pending_payment",
        lifecycle_phase: "opportunity",
        accepted_proposal_id: proposalId,
        amount: proposal.amount ?? 0,
        estimated_value: proposal.amount ?? 0,
        category: "website",
        project_type: "website",
      },
    });
    dealId = deal.id;
  }

  const { data: lineItems } = await dataProvider.getList<ProposalLineItem>(
    "proposal_line_items",
    {
      filter: { "proposal_id@eq": proposalId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "sort_order", order: "ASC" },
    },
  );

  const { data: installments } =
    await dataProvider.getList<ProposalPaymentInstallment>(
      "proposal_payment_installments",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "installment_number", order: "ASC" },
      },
    );

  const now = new Date().toISOString();
  await dataProvider.update("proposals", {
    id: proposalId,
    data: {
      status: "accepted",
      accepted_at: now,
      deal_id: dealId,
    },
    previousData: proposal,
  });

  const { data: contract } = await dataProvider.create<Contract>("contracts", {
    data: {
      org_id: proposal.org_id ?? 1,
      company_id: proposal.company_id,
      contact_id: proposal.contact_id,
      proposal_id: proposalId,
      deal_id: dealId,
      title: `Contract — ${proposal.title}`,
      status: "pending_signature",
      terms_version: "1.0",
      terms_snapshot: "Demo contract terms snapshot.",
      expires_at: proposal.valid_until,
    },
  });

  await dataProvider.update("proposals", {
    id: proposalId,
    data: { contract_id: contract.id },
    previousData: {
      ...proposal,
      status: "accepted",
      accepted_at: now,
      deal_id: dealId,
    },
  });

  for (const installment of installments) {
    try {
      await dataProvider.create("deal_client_payments", {
        data: {
          deal_id: dealId,
          payment_date: installment.due_date,
          amount: installment.amount,
          payment_method: "other",
          reference_number: `proposal-installment-${installment.id}`,
          status: installment.status === "paid" ? "cleared" : "pending",
          notes: installment.label,
        },
      });
    } catch {
      /* resource may be unavailable in older demo db */
    }
  }

  for (const line of lineItems.filter(
    (row) => row.billing_type === "recurring",
  )) {
    try {
      await dataProvider.create("maintenance_retainers", {
        data: {
          org_id: proposal.org_id ?? 1,
          deal_id: dealId,
          monthly_hours_included: 0,
          monthly_amount: line.unit_price ?? 0,
          notes: line.description,
          active: true,
        },
      });
    } catch {
      /* optional in demo */
    }
  }

  if (proposal.contact_id) {
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: proposal.contact_id,
    });
    await dataProvider.update("contacts", {
      id: proposal.contact_id,
      data: { lead_stage: "closing" },
      previousData: contact,
    });
  }

  return {
    deal_id: dealId,
    proposal_id: proposalId,
    contract_id: contract.id,
  };
};

export const fakeSignProposalContract = async (
  dataProvider: DataProvider,
  proposalId: Identifier,
  signatoryName: string,
) => {
  const { data: proposal } = await dataProvider.getOne<Proposal>("proposals", {
    id: proposalId,
  });
  if (!proposal.contract_id) {
    throw new Error("Proposal must be accepted before signing");
  }

  const now = new Date().toISOString();
  const { data: contract } = await dataProvider.getOne<Contract>("contracts", {
    id: proposal.contract_id,
  });
  await dataProvider.update("contracts", {
    id: proposal.contract_id,
    data: {
      status: "signed",
      signed_at: now,
      signatory_name: signatoryName,
    },
    previousData: contract,
  });

  if (proposal.deal_id) {
    const { data: deal } = await dataProvider.getOne("deals", {
      id: proposal.deal_id,
    });
    await dataProvider.update("deals", {
      id: proposal.deal_id,
      data: { stage: "pending_payment", lifecycle_phase: "opportunity" },
      previousData: deal,
    });
  }

  return { contract_id: proposal.contract_id, signed_at: now };
};

export const fakePayProposalDeposit = async (
  dataProvider: DataProvider,
  proposalId: Identifier,
) => {
  const { data: proposal } = await dataProvider.getOne<Proposal>("proposals", {
    id: proposalId,
  });
  if (!proposal.contract_id || !proposal.deal_id) {
    throw new Error("Proposal must be accepted and signed");
  }

  const now = new Date().toISOString();
  const { data: contract } = await dataProvider.getOne<Contract>("contracts", {
    id: proposal.contract_id,
  });
  await dataProvider.update("contracts", {
    id: proposal.contract_id,
    data: { deposit_paid_at: now },
    previousData: contract,
  });

  const { data: installments } =
    await dataProvider.getList<ProposalPaymentInstallment>(
      "proposal_payment_installments",
      {
        filter: { "proposal_id@eq": proposalId },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "installment_number", order: "ASC" },
      },
    );

  const depositRow =
    installments.find((row) => row.installment_number === 1) ??
    installments.find((row) => row.label?.toLowerCase().includes("deposit"));

  if (depositRow?.id) {
    await dataProvider.update("proposal_payment_installments", {
      id: depositRow.id,
      data: { status: "paid", paid_at: now, payment_method: "mock" },
      previousData: depositRow,
    });
    try {
      await dataProvider.update("deal_client_payments", {
        id: `proposal-installment-${depositRow.id}`,
        data: { status: "cleared" },
        previousData: {},
      });
    } catch {
      /* match by reference in list */
      const { data: payments } = await dataProvider.getList(
        "deal_client_payments",
        {
          filter: {
            "deal_id@eq": proposal.deal_id,
            "reference_number@eq": `proposal-installment-${depositRow.id}`,
          },
          pagination: { page: 1, perPage: 1 },
        },
      );
      if (payments[0]?.id) {
        await dataProvider.update("deal_client_payments", {
          id: payments[0].id,
          data: { status: "cleared" },
          previousData: payments[0],
        });
      }
    }
  }

  const allPaid = installments.every((row) => {
    if (depositRow?.id && row.id === depositRow.id) return true;
    return (
      row.status === "paid" ||
      row.status === "skipped" ||
      row.status === "waived"
    );
  });

  if (allPaid) {
    await dataProvider.update("proposals", {
      id: proposalId,
      data: { status: "paid_in_full" },
      previousData: proposal,
    });

    const { data: deal } = await dataProvider.getOne("deals", {
      id: proposal.deal_id,
    });
    await dataProvider.update("deals", {
      id: proposal.deal_id,
      data: {
        stage: "won",
        lifecycle_phase: "delivery",
        delivery_status: "planning",
      },
      previousData: deal,
    });

    if (proposal.contact_id) {
      const { data: contact } = await dataProvider.getOne("contacts", {
        id: proposal.contact_id,
      });
      await dataProvider.update("contacts", {
        id: proposal.contact_id,
        data: { status: "client", lead_stage: "won" },
        previousData: contact,
      });
    }
  }

  return { deposit_paid_at: now, deal_id: proposal.deal_id, paid_in_full: allPaid };
};

export type { PublicProposalToken };
