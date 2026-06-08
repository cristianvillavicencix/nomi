import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type InstallmentRow = {
  id: number;
  org_id: number;
  proposal_id: number;
  label: string;
  due_date: string;
  amount: number;
  status: string;
  stripe_payment_intent_id?: string | null;
  paid_at?: string | null;
};

const mapInstallmentStatusToInvoice = (installmentStatus: string) => {
  if (installmentStatus === "paid") return "paid";
  if (installmentStatus === "void" || installmentStatus === "waived") {
    return "void";
  }
  return "draft";
};

export async function issueClientInvoiceFromInstallment(
  supabase: SupabaseClient,
  orgId: number,
  installmentId: number,
) {
  const { data: existing } = await supabase
    .from("client_invoices")
    .select("*")
    .eq("org_id", orgId)
    .eq("installment_id", installmentId)
    .maybeSingle();

  if (existing?.id) {
    return existing;
  }

  const { data: installment, error: installmentError } = await supabase
    .from("proposal_payment_installments")
    .select(
      "id, org_id, proposal_id, label, due_date, amount, status, stripe_payment_intent_id, paid_at",
    )
    .eq("id", installmentId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (installmentError || !installment) {
    throw new Error("Installment not found");
  }

  const row = installment as InstallmentRow;

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, deal_id, company_id, contact_id, currency, title, proposal_number")
    .eq("id", row.proposal_id)
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_client_invoice_number",
    { p_org_id: orgId },
  );

  if (numberError || !invoiceNumber) {
    throw new Error("Could not generate invoice number");
  }

  const now = new Date().toISOString();
  const invoiceStatus = mapInstallmentStatusToInvoice(row.status);

  const { data: invoice, error: insertError } = await supabase
    .from("client_invoices")
    .insert({
      org_id: orgId,
      invoice_number: invoiceNumber as string,
      installment_id: row.id,
      proposal_id: row.proposal_id,
      deal_id: proposal?.deal_id ?? null,
      company_id: proposal?.company_id ?? null,
      contact_id: proposal?.contact_id ?? null,
      issue_date: now.slice(0, 10),
      due_date: row.due_date,
      amount: row.amount,
      currency: proposal?.currency ?? "USD",
      description: row.label,
      status: invoiceStatus,
      paid_at: row.status === "paid" ? row.paid_at ?? now : null,
      stripe_payment_intent_id: row.stripe_payment_intent_id ?? null,
    })
    .select("*")
    .single();

  if (insertError || !invoice) {
    throw new Error(insertError?.message ?? "Could not create invoice");
  }

  return invoice;
}

type InstallmentForAutoIssue = {
  id: number;
  installment_number?: number;
  status?: string;
};

/** Creates a draft invoice for the first pending installment when a proposal is accepted. */
export async function autoIssueInvoiceOnProposalAccept(
  supabase: SupabaseClient,
  orgId: number,
  proposalId: number,
  installments: InstallmentForAutoIssue[],
) {
  const sorted = [...installments].sort(
    (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
  );

  const firstPending = sorted.find(
    (row) =>
      row.status !== "paid" &&
      row.status !== "waived" &&
      row.status !== "void",
  );

  if (firstPending?.id) {
    try {
      await issueClientInvoiceFromInstallment(
        supabase,
        orgId,
        firstPending.id,
      );
    } catch (error) {
      console.error("autoIssueInvoiceOnProposalAccept.installment", error);
    }
    return;
  }

  if (sorted.length === 0) {
    try {
      await issueClientInvoiceFromProposal(supabase, orgId, { proposalId });
    } catch (error) {
      console.error("autoIssueInvoiceOnProposalAccept.proposal", error);
    }
  }
}

type ProposalInvoiceInput = {
  proposalId: number;
  installmentId?: number;
  amount?: number;
  dueDate?: string;
  description?: string;
};

export async function issueClientInvoiceFromProposal(
  supabase: SupabaseClient,
  orgId: number,
  input: ProposalInvoiceInput,
) {
  if (input.installmentId) {
    return issueClientInvoiceFromInstallment(
      supabase,
      orgId,
      input.installmentId,
    );
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select(
      "id, deal_id, company_id, contact_id, currency, title, proposal_number, amount, deposit_amount, balance_amount, valid_until",
    )
    .eq("id", input.proposalId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (proposalError || !proposal) {
    throw new Error("Proposal not found");
  }

  const defaultAmount =
    Number(proposal.deposit_amount) > 0
      ? Number(proposal.deposit_amount)
      : Number(proposal.amount) || 0;
  const amount = input.amount ?? defaultAmount;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invoice amount must be greater than zero");
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultDue =
    proposal.valid_until && String(proposal.valid_until) >= today
      ? String(proposal.valid_until)
      : today;
  const dueDate = input.dueDate ?? defaultDue;

  const proposalLabel = proposal.proposal_number
    ? `#${proposal.proposal_number} — ${proposal.title}`
    : proposal.title;
  const description =
    input.description?.trim() ||
    `Invoice for ${proposalLabel}`;

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_client_invoice_number",
    { p_org_id: orgId },
  );

  if (numberError || !invoiceNumber) {
    throw new Error("Could not generate invoice number");
  }

  const now = new Date().toISOString();

  const { data: invoice, error: insertError } = await supabase
    .from("client_invoices")
    .insert({
      org_id: orgId,
      invoice_number: invoiceNumber as string,
      installment_id: null,
      proposal_id: proposal.id,
      deal_id: proposal.deal_id ?? null,
      company_id: proposal.company_id ?? null,
      contact_id: proposal.contact_id ?? null,
      issue_date: today,
      due_date: dueDate,
      amount,
      currency: proposal.currency ?? "USD",
      description,
      status: "draft",
    })
    .select("*")
    .single();

  if (insertError || !invoice) {
    throw new Error(insertError?.message ?? "Could not create invoice");
  }

  return invoice;
}

export type StandaloneInvoiceLineInput = {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  package_id?: number | null;
  addon_id?: number | null;
  sort_order?: number;
};

export type CreateStandaloneInvoiceInput = {
  company_id?: number | null;
  contact_id?: number | null;
  deal_id?: number | null;
  issue_date?: string;
  due_date: string;
  terms?: string;
  currency?: string;
  subtotal: number;
  discount_amount?: number;
  fee_amount?: number;
  amount: number;
  description: string;
  notes?: string | null;
  reference?: string | null;
  recipient_email?: string | null;
  save_card_for_future_charges?: boolean;
  upfront_percent?: number;
  auto_charge_remainder?: boolean;
  remainder_schedule?: Record<string, unknown> | null;
  sales_person_id?: number | null;
  line_items: StandaloneInvoiceLineInput[];
};

export async function createStandaloneClientInvoice(
  supabase: SupabaseClient,
  orgId: number,
  input: CreateStandaloneInvoiceInput,
) {
  if (!input.line_items.length) {
    throw new Error("Add at least one line item");
  }
  if (!input.company_id && !input.contact_id) {
    throw new Error("Select a client to bill");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Invoice total must be greater than zero");
  }

  const { data: invoiceNumber, error: numberError } = await supabase.rpc(
    "next_client_invoice_number",
    { p_org_id: orgId },
  );

  if (numberError || !invoiceNumber) {
    throw new Error("Could not generate invoice number");
  }

  const today = new Date().toISOString().slice(0, 10);
  const issueDate = input.issue_date ?? today;
  const now = new Date().toISOString();

  const { data: invoice, error: insertError } = await supabase
    .from("client_invoices")
    .insert({
      org_id: orgId,
      invoice_number: invoiceNumber as string,
      company_id: input.company_id ?? null,
      contact_id: input.contact_id ?? null,
      deal_id: input.deal_id ?? null,
      issue_date: issueDate,
      due_date: input.due_date,
      subtotal: input.subtotal,
      discount_amount: input.discount_amount ?? 0,
      fee_amount: input.fee_amount ?? 0,
      amount: input.amount,
      currency: input.currency ?? "USD",
      terms: input.terms ?? "Net 30",
      description: input.description,
      notes: input.notes?.trim() || null,
      reference: input.reference?.trim() || null,
      recipient_email: input.recipient_email?.trim() || null,
      sales_person_id: input.sales_person_id ?? null,
      save_card_for_future_charges: input.save_card_for_future_charges ?? false,
      upfront_percent: input.upfront_percent ?? 100,
      auto_charge_remainder: input.auto_charge_remainder ?? false,
      remainder_schedule: input.remainder_schedule ?? null,
      status: "draft",
    })
    .select("*")
    .single();

  if (insertError || !invoice) {
    throw new Error(insertError?.message ?? "Could not create invoice");
  }

  const lineRows = input.line_items.map((line, index) => {
    const quantity = Number(line.quantity) || 1;
    const unitPrice = Number(line.unit_price) || 0;
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    return {
      org_id: orgId,
      invoice_id: invoice.id,
      description: line.description.trim(),
      quantity,
      unit: line.unit?.trim() || "ea",
      unit_price: unitPrice,
      line_total: lineTotal,
      package_id: line.package_id ?? null,
      addon_id: line.addon_id ?? null,
      sort_order: line.sort_order ?? index,
    };
  });

  const { error: linesError } = await supabase
    .from("client_invoice_line_items")
    .insert(lineRows);

  if (linesError) {
    await supabase.from("client_invoices").delete().eq("id", invoice.id);
    throw new Error(linesError.message ?? "Could not save line items");
  }

  return { ...invoice, updated_at: now };
}

export type UpdateStandaloneInvoiceInput = Omit<
  CreateStandaloneInvoiceInput,
  "deal_id"
>;

export async function updateStandaloneClientInvoice(
  supabase: SupabaseClient,
  orgId: number,
  invoiceId: number,
  input: UpdateStandaloneInvoiceInput,
) {
  if (!input.line_items.length) {
    throw new Error("Add at least one line item");
  }
  if (!input.company_id && !input.contact_id) {
    throw new Error("Select a client to bill");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Invoice total must be greater than zero");
  }

  const { data: existing, error: existingError } = await supabase
    .from("client_invoices")
    .select("id, status, installment_id")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    throw new Error("Invoice not found");
  }

  if (existing.status === "paid" || existing.status === "void") {
    throw new Error("This invoice cannot be edited");
  }

  const now = new Date().toISOString();
  const issueDate = input.issue_date ?? new Date().toISOString().slice(0, 10);

  const { data: invoice, error: updateError } = await supabase
    .from("client_invoices")
    .update({
      company_id: input.company_id ?? null,
      contact_id: input.contact_id ?? null,
      issue_date: issueDate,
      due_date: input.due_date,
      subtotal: input.subtotal,
      discount_amount: input.discount_amount ?? 0,
      fee_amount: input.fee_amount ?? 0,
      amount: input.amount,
      currency: input.currency ?? "USD",
      terms: input.terms ?? "Net 30",
      description: input.description,
      notes: input.notes?.trim() || null,
      reference: input.reference?.trim() || null,
      recipient_email: input.recipient_email?.trim() || null,
      sales_person_id: input.sales_person_id ?? null,
      save_card_for_future_charges: input.save_card_for_future_charges ?? false,
      upfront_percent: input.upfront_percent ?? 100,
      auto_charge_remainder: input.auto_charge_remainder ?? false,
      remainder_schedule: input.remainder_schedule ?? null,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (updateError || !invoice) {
    throw new Error(updateError?.message ?? "Could not update invoice");
  }

  const { error: deleteError } = await supabase
    .from("client_invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId);

  if (deleteError) {
    throw new Error(deleteError.message ?? "Could not update line items");
  }

  const lineRows = input.line_items.map((line, index) => {
    const quantity = Number(line.quantity) || 1;
    const unitPrice = Number(line.unit_price) || 0;
    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    return {
      org_id: orgId,
      invoice_id: invoiceId,
      description: line.description.trim(),
      quantity,
      unit: line.unit?.trim() || "ea",
      unit_price: unitPrice,
      line_total: lineTotal,
      package_id: line.package_id ?? null,
      addon_id: line.addon_id ?? null,
      sort_order: line.sort_order ?? index,
    };
  });

  const { error: linesError } = await supabase
    .from("client_invoice_line_items")
    .insert(lineRows);

  if (linesError) {
    throw new Error(linesError.message ?? "Could not save line items");
  }

  return { ...invoice, updated_at: now };
}

export async function syncClientInvoicePaidFromInstallment(
  supabase: SupabaseClient,
  installmentId: number,
  paidAt?: string | null,
) {
  const now = paidAt ?? new Date().toISOString();
  await supabase
    .from("client_invoices")
    .update({
      status: "paid",
      paid_at: now,
      updated_at: now,
    })
    .eq("installment_id", installmentId)
    .not("status", "eq", "void");
}

export async function markClientInvoiceSent(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
  recipientEmail: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from("client_invoices")
    .select("id, status, scheduled_send_storage_path")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    throw new Error("Invoice not found");
  }

  if (existing.status === "paid" || existing.status === "void") {
    throw new Error("This invoice cannot be marked as sent");
  }

  const storagePath = existing.scheduled_send_storage_path?.trim();
  if (storagePath) {
    await supabase.storage.from("attachments").remove([storagePath]);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_invoices")
    .update({
      status: "sent",
      sent_at: now,
      recipient_email: recipientEmail,
      scheduled_send_at: null,
      scheduled_send_message: null,
      scheduled_send_storage_path: null,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update invoice");
  }

  return data;
}

export async function markClientInvoiceSentManual(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
) {
  const { data: existing, error: existingError } = await supabase
    .from("client_invoices")
    .select("id, status")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    throw new Error("Invoice not found");
  }

  if (existing.status === "paid" || existing.status === "void") {
    throw new Error("This invoice cannot be marked as sent");
  }

  if (existing.status === "sent") {
    return existing;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_invoices")
    .update({
      status: "sent",
      sent_at: now,
      scheduled_send_at: null,
      scheduled_send_message: null,
      scheduled_send_storage_path: null,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not mark invoice as sent");
  }

  return data;
}

export async function voidClientInvoice(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
) {
  const { data: existing, error: existingError } = await supabase
    .from("client_invoices")
    .select("id, status, scheduled_send_storage_path")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    throw new Error("Invoice not found");
  }

  if (existing.status === "paid") {
    throw new Error("Paid invoices cannot be voided");
  }

  if (existing.status === "void") {
    return existing;
  }

  const storagePath = existing.scheduled_send_storage_path?.trim();
  if (storagePath) {
    await supabase.storage.from("attachments").remove([storagePath]);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_invoices")
    .update({
      status: "void",
      scheduled_send_at: null,
      scheduled_send_message: null,
      scheduled_send_storage_path: null,
      updated_at: now,
    })
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not void invoice");
  }

  return data;
}

export async function deleteStandaloneClientInvoice(
  supabase: SupabaseClient,
  invoiceId: number,
  orgId: number,
) {
  const { data: existing, error: existingError } = await supabase
    .from("client_invoices")
    .select("id, status, installment_id, scheduled_send_storage_path")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingError || !existing?.id) {
    throw new Error("Invoice not found");
  }

  if (existing.installment_id) {
    throw new Error("Installment invoices cannot be deleted here");
  }

  if (existing.status !== "draft") {
    throw new Error("Only draft invoices can be deleted");
  }

  const storagePath = existing.scheduled_send_storage_path?.trim();
  if (storagePath) {
    await supabase.storage.from("attachments").remove([storagePath]);
  }

  await supabase
    .from("public_client_invoice_tokens")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId);

  await supabase
    .from("client_invoice_line_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("org_id", orgId);

  const { error: deleteError } = await supabase
    .from("client_invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("org_id", orgId);

  if (deleteError) {
    throw new Error(deleteError.message ?? "Could not delete invoice");
  }

  return { id: invoiceId, deleted: true };
}
