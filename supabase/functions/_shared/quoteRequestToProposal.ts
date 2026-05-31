import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SERVICE_LABELS: Record<string, string> = {
  website_design: "Website design",
  ecommerce: "E-commerce website",
  landing_page: "Landing page",
  seo: "SEO services",
  maintenance: "Website maintenance",
  other: "Custom services",
};

const BUDGET_SUGGESTED: Record<string, number> = {
  under_2k: 1500,
  "2k_5k": 3500,
  "5k_10k": 7500,
  "10k_25k": 17500,
  "25k_plus": 30000,
};

const extractAnswer = (answers: Record<string, unknown>, key: string) => {
  const value = answers[key];
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  return String(value);
};

export async function createProposalFromQuoteRequest(
  supabase: SupabaseClient,
  orgId: number,
  submission: {
    id: number;
    contact_id?: number | null;
    company_id?: number | null;
    deal_id?: number | null;
  },
  answers: Record<string, unknown>,
  memberId?: number | null,
) {
  const name = extractAnswer(answers, "name") ?? "Quote request";
  const serviceType =
    extractAnswer(answers, "service_type") ??
    extractAnswer(answers, "interest_in") ??
    "other";
  const budgetRange = extractAnswer(answers, "budget_range");
  const projectDescription =
    extractAnswer(answers, "project_description") ??
    extractAnswer(answers, "business_description") ??
    "";

  const lineDescription =
    SERVICE_LABELS[serviceType] ?? serviceType.replace(/_/g, " ");
  const suggestedPrice = budgetRange
    ? (BUDGET_SUGGESTED[budgetRange] ?? 5000)
    : 5000;

  const title = `Quote: ${name} — ${lineDescription}`;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);
  const validUntilKey = validUntil.toISOString().slice(0, 10);

  const depositAmount = Math.round(suggestedPrice * 0.5 * 100) / 100;
  const balanceAmount = Math.round((suggestedPrice - depositAmount) * 100) / 100;

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .insert({
      org_id: orgId,
      company_id: submission.company_id,
      contact_id: submission.contact_id,
      deal_id: submission.deal_id,
      organization_member_id: memberId,
      title,
      status: "draft",
      amount: suggestedPrice,
      one_time_total: suggestedPrice,
      deposit_percent: 50,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      validity_days: 30,
      valid_until: validUntilKey,
      notes: projectDescription || null,
      payment_schedule_config: {
        installment_frequency: "weekly",
        installment_count: 4,
        deposit_due_date: validUntilKey,
      },
      recurring_summary: [],
    })
    .select("id")
    .single();

  if (proposalError || !proposal?.id) {
    console.error("quoteRequestToProposal.proposal_error", proposalError);
    return null;
  }

  const proposalId = proposal.id as number;
  const proposalNumber = `PROP-${new Date().getFullYear()}-${String(proposalId).padStart(4, "0")}`;

  await supabase
    .from("proposals")
    .update({ proposal_number: proposalNumber })
    .eq("id", proposalId);

  await supabase.from("proposal_line_items").insert({
    proposal_id: proposalId,
    description: lineDescription,
    quantity: 1,
    unit_price: suggestedPrice,
    line_total: suggestedPrice,
    billing_type: "one_time",
    sort_order: 0,
  });

  const { data: schedule } = await supabase
    .from("proposal_payment_schedules")
    .insert({
      org_id: orgId,
      proposal_id: proposalId,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      deposit_due_date: validUntilKey,
      installment_frequency: "weekly",
      installment_count: 4,
    })
    .select("id")
    .single();

  const perInstallment =
    Math.round((balanceAmount / 4) * 100) / 100;
  let allocated = 0;
  const installments = [
    {
      org_id: orgId,
      schedule_id: schedule?.id,
      proposal_id: proposalId,
      installment_number: 1,
      label: "Deposit (50%)",
      due_date: validUntilKey,
      amount: depositAmount,
      billing_type: "one_time",
      status: "pending",
      payment_method: "manual",
    },
  ];

  for (let index = 0; index < 4; index += 1) {
    const isLast = index === 3;
    const amount = isLast
      ? Math.round((balanceAmount - allocated) * 100) / 100
      : perInstallment;
    allocated += amount;
    const due = new Date(validUntil);
    due.setDate(due.getDate() + 7 * (index + 1));
    installments.push({
      org_id: orgId,
      schedule_id: schedule?.id,
      proposal_id: proposalId,
      installment_number: index + 2,
      label: `Installment ${index + 1} of 4`,
      due_date: due.toISOString().slice(0, 10),
      amount,
      billing_type: "one_time",
      status: "pending",
      payment_method: "manual",
    });
  }

  await supabase.from("proposal_payment_installments").insert(installments);

  await supabase
    .from("form_submissions_v2")
    .update({ proposal_id: proposalId })
    .eq("id", submission.id);

  return proposalId;
}
