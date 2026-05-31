import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type ProposalRow = {
  id: number;
  org_id: number;
  company_id?: number | null;
  contact_id?: number | null;
  deal_id?: number | null;
  organization_member_id?: number | null;
  title: string;
  status: string;
  amount?: number | null;
  proposal_number?: string | null;
  validity_days?: number | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  currency?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  recurring_summary?: Array<{
    description: string;
    amount: number;
    interval: string;
  }> | null;
  contract_id?: number | null;
};

type LineItemRow = {
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  billing_type?: string | null;
  billing_interval?: string | null;
  sort_order?: number | null;
};

type InstallmentRow = {
  id: number;
  installment_number: number;
  label: string;
  due_date: string;
  amount: number;
  billing_type?: string | null;
  status?: string | null;
};

export const mergeContractTerms = (
  body: string,
  variables: Record<string, string>,
) =>
  body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? "");

export const formatMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export const buildLineItemsText = (lines: LineItemRow[]) =>
  lines
    .map((line) => {
      const qty = line.quantity ?? 1;
      const price = line.unit_price ?? 0;
      const total = Math.round(qty * price * 100) / 100;
      const recurring =
        line.billing_type === "recurring"
          ? ` (${line.billing_interval ?? "monthly"})`
          : "";
      return `- ${line.description}${recurring}: ${formatMoney(total)}`;
    })
    .join("\n");

export const buildPaymentScheduleText = (installments: InstallmentRow[]) =>
  installments
    .map(
      (row) =>
        `${row.installment_number}. ${row.label} — ${row.due_date}: ${formatMoney(row.amount)}`,
    )
    .join("\n");

export const buildRecurringTermsText = (
  recurring:
    | Array<{ description: string; amount: number; interval: string }>
    | null
    | undefined,
) =>
  (recurring ?? [])
    .map(
      (row) =>
        `- ${row.description}: ${formatMoney(row.amount)}/${row.interval}`,
    )
    .join("\n") || "None";

export const buildContractVariables = ({
  proposal,
  contactName,
  clientAddress,
  lineItems,
  installments,
  termsVersion,
}: {
  proposal: ProposalRow;
  contactName: string;
  clientAddress: string;
  lineItems: LineItemRow[];
  installments: InstallmentRow[];
  termsVersion: string;
}) => {
  const currency = proposal.currency ?? "USD";
  const total = proposal.amount ?? 0;
  const deposit = proposal.deposit_amount ?? 0;
  const balance = proposal.balance_amount ?? 0;

  return {
    client_name: contactName || "Client",
    client_address: clientAddress || "—",
    contract_date: new Date().toISOString().slice(0, 10),
    proposal_number: proposal.proposal_number ?? String(proposal.id),
    accepted_at: new Date().toISOString().slice(0, 10),
    line_items: buildLineItemsText(lineItems),
    total_amount: formatMoney(total, currency),
    deposit_amount: formatMoney(deposit, currency),
    balance_amount: formatMoney(balance, currency),
    currency,
    payment_schedule: buildPaymentScheduleText(installments),
    recurring_terms: buildRecurringTermsText(proposal.recurring_summary),
    proposal_validity_days: String(proposal.validity_days ?? 30),
    terms_version: termsVersion,
    timeline: "As agreed in proposal",
    revision_rounds: "2",
    client_response_days: "5",
    cancel_notice_days: "30",
    late_days: "15",
    late_fee: "1.5% monthly",
    warranty_days: "30",
  };
};

export async function resolveDealForProposal(
  supabase: SupabaseClient,
  proposal: ProposalRow,
  memberId?: number | null,
) {
  if (proposal.deal_id) {
    const { data: existingDeal } = await supabase
      .from("deals")
      .select("id, stage, lifecycle_phase, accepted_proposal_id")
      .eq("id", proposal.deal_id)
      .maybeSingle();

    if (existingDeal?.id) {
      return existingDeal.id as number;
    }
  }

  if (proposal.contact_id) {
    const { data: opportunityDeal } = await supabase
      .from("deals")
      .select("id")
      .eq("org_id", proposal.org_id)
      .eq("contact_id", proposal.contact_id)
      .eq("lifecycle_phase", "opportunity")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (opportunityDeal?.id) {
      return opportunityDeal.id as number;
    }
  }

  const contactIds = proposal.contact_id ? [proposal.contact_id] : [];
  const { data: newDeal, error } = await supabase
    .from("deals")
    .insert({
      org_id: proposal.org_id,
      organization_member_id: memberId ?? proposal.organization_member_id,
      name: proposal.title,
      company_id: proposal.company_id,
      contact_id: proposal.contact_id,
      contact_ids: contactIds,
      stage: "setup",
      amount: proposal.amount ?? 0,
      estimated_value: proposal.amount ?? 0,
      description: proposal.notes ?? "",
      category: "website",
      project_type: "website",
      lifecycle_phase: "delivery",
      delivery_status: "planning",
      accepted_proposal_id: proposal.id,
      priority: "normal",
    })
    .select("id")
    .single();

  if (error || !newDeal?.id) {
    throw new Error("Failed to create project");
  }

  return newDeal.id as number;
}

export async function createContractFromProposal(
  supabase: SupabaseClient,
  proposal: ProposalRow,
  dealId: number,
  lineItems: LineItemRow[],
  installments: InstallmentRow[],
  scheduleId?: number | null,
) {
  if (proposal.contract_id) {
    const { data: existing } = await supabase
      .from("contracts")
      .select("id")
      .eq("id", proposal.contract_id)
      .maybeSingle();
    if (existing?.id) return existing.id as number;
  }

  const { data: existingForProposal } = await supabase
    .from("contracts")
    .select("id")
    .eq("proposal_id", proposal.id)
    .maybeSingle();

  if (existingForProposal?.id) {
    return existingForProposal.id as number;
  }

  let contactName = "Client";
  let clientAddress = "—";

  if (proposal.contact_id) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("first_name, last_name, address")
      .eq("id", proposal.contact_id)
      .maybeSingle();
    if (contact) {
      contactName =
        [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
        contactName;
      clientAddress = contact.address ?? clientAddress;
    }
  }

  const { data: activeTerms } = await supabase
    .from("organization_contract_terms")
    .select("version, title, body_markdown, default_variables")
    .eq("org_id", proposal.org_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const termsVersion = activeTerms?.version ?? "1.0";
  const variables = {
    ...(activeTerms?.default_variables as Record<string, string> | undefined),
    ...buildContractVariables({
      proposal,
      contactName,
      clientAddress,
      lineItems,
      installments,
      termsVersion,
    }),
  };

  const termsBody = activeTerms?.body_markdown ?? "";
  const termsSnapshot = termsBody
    ? mergeContractTerms(termsBody, variables)
    : null;

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      org_id: proposal.org_id,
      company_id: proposal.company_id,
      contact_id: proposal.contact_id,
      proposal_id: proposal.id,
      deal_id: dealId,
      organization_member_id: proposal.organization_member_id,
      title: activeTerms?.title ?? `Contract — ${proposal.title}`,
      status: "pending_signature",
      terms_version: termsVersion,
      terms_snapshot: termsSnapshot,
      expires_at: proposal.valid_until,
      payment_schedule_id: scheduleId ?? null,
      notes: proposal.notes,
    })
    .select("id")
    .single();

  if (error || !contract?.id) {
    throw new Error("Failed to create contract");
  }

  await supabase
    .from("proposals")
    .update({ contract_id: contract.id })
    .eq("id", proposal.id);

  if (scheduleId) {
    await supabase
      .from("proposal_payment_schedules")
      .update({ contract_id: contract.id })
      .eq("id", scheduleId);
  }

  return contract.id as number;
}

export async function syncInstallmentsToDealPayments(
  supabase: SupabaseClient,
  dealId: number,
  installments: InstallmentRow[],
) {
  const { data: existing } = await supabase
    .from("deal_client_payments")
    .select("reference_number")
    .eq("deal_id", dealId);

  const existingRefs = new Set(
    (existing ?? [])
      .map((row) => row.reference_number)
      .filter(Boolean) as string[],
  );

  for (const installment of installments) {
    const ref = `proposal-installment-${installment.id}`;
    if (existingRefs.has(ref)) continue;

    await supabase.from("deal_client_payments").insert({
      deal_id: dealId,
      payment_date: installment.due_date,
      amount: installment.amount,
      payment_method: "other",
      reference_number: ref,
      status: installment.status === "paid" ? "cleared" : "pending",
      notes: installment.label,
    });
  }
}

export async function syncRecurringToRetainers(
  supabase: SupabaseClient,
  orgId: number,
  dealId: number,
  recurring:
    | Array<{ description: string; amount: number; interval: string }>
    | null
    | undefined,
) {
  if (!recurring?.length) return;

  const { data: existing } = await supabase
    .from("maintenance_retainers")
    .select("id, notes")
    .eq("deal_id", dealId)
    .eq("active", true);

  const existingNotes = new Set(
    (existing ?? []).map((row) => row.notes).filter(Boolean),
  );

  for (const row of recurring) {
    if (existingNotes.has(row.description)) continue;

    const monthlyAmount =
      row.interval === "yearly"
        ? Math.round((row.amount / 12) * 100) / 100
        : row.interval === "weekly"
          ? Math.round(row.amount * 4 * 100) / 100
          : row.amount;

    await supabase.from("maintenance_retainers").insert({
      org_id: orgId,
      deal_id: dealId,
      monthly_hours_included: 0,
      monthly_amount: monthlyAmount,
      notes: row.description,
      active: true,
    });
  }
}

export async function activateAcceptedDeal(
  supabase: SupabaseClient,
  dealId: number,
  proposalId: number,
  amount: number,
) {
  await supabase
    .from("deals")
    .update({
      accepted_proposal_id: proposalId,
      stage: "setup",
      lifecycle_phase: "delivery",
      delivery_status: "planning",
      amount,
      estimated_value: amount,
      current_project_value: amount,
      original_project_value: amount,
    })
    .eq("id", dealId);
}
