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
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("client_invoices")
    .update({
      status: "sent",
      sent_at: now,
      recipient_email: recipientEmail,
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
