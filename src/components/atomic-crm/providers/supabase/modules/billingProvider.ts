import type { Identifier } from "ra-core";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

export const billingProvider = {
  async issueClientInvoice({
    installmentId,
    proposalId,
    amount,
    dueDate,
    description,
  }: {
    installmentId?: Identifier;
    proposalId?: Identifier;
    amount?: number;
    dueDate?: string;
    description?: string;
  }) {
    const body: Record<string, unknown> = {};
    if (installmentId != null) {
      body.installment_id = Number(installmentId);
    }
    if (proposalId != null) {
      body.proposal_id = Number(proposalId);
    }
    if (amount != null) body.amount = amount;
    if (dueDate) body.due_date = dueDate;
    if (description) body.description = description;

    const { data, error } = await invokeEdgeFunction<{ invoice: Record<string, unknown> }>(
      "issue_client_invoice",
      {
        method: "POST",
        body,
      },
    );

    if (error || !data?.invoice) {
      console.error("issue_client_invoice.error", error);
      throw new Error("Failed to issue invoice");
    }

    return data.invoice;
  },
  async syncProposalInvoices({ proposalId }: { proposalId: Identifier }) {
    const { data, error } = await invokeEdgeFunction<{
      invoices: Record<string, unknown>[];
    }>("issue_client_invoice", {
      method: "POST",
      body: {
        proposal_id: Number(proposalId),
        sync_all_installments: true,
      },
    });

    if (error || !data?.invoices) {
      console.error("syncProposalInvoices.error", error);
      throw new Error("Failed to sync proposal invoices");
    }

    return data.invoices;
  },
  async createStandaloneClientInvoice(body: {
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
    sales_person_id?: number | null;
    save_card_for_future_charges?: boolean;
    upfront_percent?: number;
    auto_charge_remainder?: boolean;
    remainder_schedule?: Record<string, unknown> | null;
    line_items: Array<{
      description: string;
      quantity: number;
      unit?: string;
      unit_price: number;
      package_id?: number | null;
      addon_id?: number | null;
      sort_order?: number;
    }>;
  }) {
    const { data, error } = await invokeEdgeFunction<{ invoice: Record<string, unknown> }>(
      "create_client_invoice",
      {
        method: "POST",
        body,
      },
    );

    if (error || !data?.invoice) {
      console.error("create_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Failed to create invoice")
          : "Failed to create invoice",
      );
    }

    return data.invoice;
  },
  async sendClientInvoice({
    invoiceId,
    to,
    message,
    htmlMessage,
    pdfBase64,
    filename,
    subject,
    smsTo,
    smsBody,
    contactId,
    cc,
    bcc,
    linkOnly,
  }: {
    invoiceId: Identifier;
    to: string;
    message?: string;
    htmlMessage?: string;
    pdfBase64?: string;
    filename?: string;
    subject?: string;
    smsTo?: string;
    smsBody?: string;
    contactId?: Identifier;
    cc?: string[];
    bcc?: string[];
    linkOnly?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
      email_sent?: boolean;
      email_skipped?: boolean;
      sms_sent?: boolean;
      sms_skipped?: boolean;
    }>(
      "send_client_invoice",
      {
        method: "POST",
        body: {
          invoice_id: Number(invoiceId),
          to,
          message,
          html_message: htmlMessage,
          pdf_base64: pdfBase64,
          filename,
          subject,
          link_only: linkOnly === true,
          ...(cc?.length ? { cc } : {}),
          ...(bcc?.length ? { bcc } : {}),
          ...(smsTo?.trim() ? { sms_to: smsTo.trim() } : {}),
          ...(smsBody?.trim() ? { sms_body: smsBody.trim() } : {}),
          ...(contactId != null ? { contact_id: Number(contactId) } : {}),
        },
      },
    );

    if (error || !data?.invoice) {
      console.error("send_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Failed to send invoice")
          : "Failed to send invoice",
      );
    }

    return data;
  },
  async manageClientInvoice({
    invoiceId,
    action,
  }: {
    invoiceId: Identifier;
    action: "mark_sent" | "void" | "delete";
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice?: Record<string, unknown>;
      deleted?: boolean;
      id?: number;
    }>("manage_client_invoice", {
      method: "POST",
      body: {
        invoice_id: Number(invoiceId),
        action,
      },
    });

    if (error) {
      console.error("manage_client_invoice.error", error);
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Could not update invoice"),
      );
    }

    return data;
  },
  async resendClientInvoicePaymentReceipt({
    invoiceId,
    paymentIntentId,
    chargedAmount,
    force,
  }: {
    invoiceId: Identifier;
    paymentIntentId?: string;
    chargedAmount?: number;
    force?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice_id: number;
      payment_intent_id: string;
      charged_amount: number;
      receipt_sent: boolean;
      already_sent?: boolean;
    }>("resend_client_invoice_payment_receipt", {
      method: "POST",
      body: {
        invoice_id: Number(invoiceId),
        ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
        ...(chargedAmount != null ? { charged_amount: chargedAmount } : {}),
        ...(force ? { force: true } : {}),
      },
    });

    if (error || !data?.receipt_sent) {
      console.error("sendClientInvoicePaymentReceipt.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to send payment receipt",
            )
          : "Failed to send payment receipt",
      );
    }

    return data;
  },
  async chargeClientInvoiceOnFile({
    invoiceId,
    amount,
  }: {
    invoiceId: Identifier;
    amount?: number;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
      charged_amount: number;
      amount_paid: number;
      balance_due: number;
      paid_in_full: boolean;
      receipt_sent?: boolean;
    }>("charge_client_invoice_on_file", {
      method: "POST",
      body: {
        invoice_id: Number(invoiceId),
        ...(amount != null ? { amount } : {}),
      },
    });

    if (error || !data?.invoice) {
      console.error("chargeClientInvoiceOnFile.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Could not charge the card on file",
            )
          : "Could not charge the card on file",
      );
    }

    return data;
  },
  async sendClientInvoicePaymentLink({
    invoiceId,
    to,
    message,
    subject,
    smsTo,
    smsBody,
    sendSms,
  }: {
    invoiceId: Identifier;
    to?: string;
    message?: string;
    subject?: string;
    smsTo?: string;
    smsBody?: string;
    sendSms?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      sent: boolean;
      to: string;
      payment_url: string;
      invoice_id: number;
      sms_sent?: boolean;
      sms_skipped?: boolean;
    }>("send_client_invoice_payment_link", {
      method: "POST",
      body: {
        invoice_id: Number(invoiceId),
        base_url: window.location.origin,
        ...(to ? { to } : {}),
        ...(message ? { message } : {}),
        ...(subject ? { subject } : {}),
        ...(sendSms ? { send_sms: true } : {}),
        ...(smsTo ? { sms_to: smsTo } : {}),
        ...(smsBody ? { sms_body: smsBody } : {}),
      },
    });

    if (error || !data?.sent) {
      console.error("sendClientInvoicePaymentLink.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Could not send payment link",
            )
          : "Could not send payment link",
      );
    }

    return data;
  },
  async scheduleClientInvoice({
    invoiceId,
    to,
    message,
    scheduledSendAt,
    pdfBase64,
    filename,
    smsTo,
    smsBody,
  }: {
    invoiceId: Identifier;
    to: string;
    message?: string;
    scheduledSendAt: string;
    pdfBase64: string;
    filename?: string;
    smsTo?: string;
    smsBody?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{ invoice: Record<string, unknown> }>(
      "schedule_client_invoice",
      {
        method: "POST",
        body: {
          invoice_id: Number(invoiceId),
          to,
          message,
          scheduled_send_at: scheduledSendAt,
          pdf_base64: pdfBase64,
          filename,
          ...(smsTo?.trim() ? { sms_to: smsTo.trim() } : {}),
          ...(smsBody?.trim() ? { sms_body: smsBody.trim() } : {}),
        },
      },
    );

    if (error || !data?.invoice) {
      console.error("schedule_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to schedule invoice send",
            )
          : "Failed to schedule invoice send",
      );
    }

    return data.invoice;
  },
  async updateStandaloneClientInvoice(
    invoiceId: Identifier,
    body: {
      company_id?: number | null;
      contact_id?: number | null;
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
      sales_person_id?: number | null;
      save_card_for_future_charges?: boolean;
      upfront_percent?: number;
      auto_charge_remainder?: boolean;
      remainder_schedule?: Record<string, unknown> | null;
      line_items: Array<{
        description: string;
        quantity: number;
        unit?: string;
        unit_price: number;
        package_id?: number | null;
        addon_id?: number | null;
        sort_order?: number;
      }>;
    },
  ) {
    const { data, error } = await invokeEdgeFunction<{ invoice: Record<string, unknown> }>(
      "update_client_invoice",
      {
        method: "POST",
        body: {
          invoice_id: Number(invoiceId),
          ...body,
        },
      },
    );

    if (error || !data?.invoice) {
      console.error("update_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(error, "Failed to update invoice")
          : "Failed to update invoice",
      );
    }

    return data.invoice;
  },
  async shareClientInvoice({
    invoiceId,
    baseUrl,
  }: {
    invoiceId: Identifier;
    baseUrl?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      token: string;
      short_code: string;
      url: string;
      short_url: string;
      expires_at: string;
      invoice_id: number;
    }>("share_client_invoice", {
      method: "POST",
      body: {
        invoice_id: Number(invoiceId),
        base_url: baseUrl ?? window.location.origin,
      },
    });

    if (error || !data?.url) {
      console.error("share_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to generate invoice link",
            )
          : "Failed to generate invoice link",
      );
    }

    return data;
  },
  async stripeCreateCheckoutSession(params: {
    orgId: number;
    returnPath?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      url?: string;
      id?: string;
    }>("stripe-billing", {
      method: "POST",
      body: {
        action: "create_checkout",
        org_id: params.orgId,
        return_path: params.returnPath ?? "/sas",
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to start Stripe checkout",
      );
    }
    if (data?.url && typeof window !== "undefined") {
      window.location.assign(data.url);
    }
    return data;
  },
  async stripeBillingPortal(params: { orgId: number; returnPath?: string }) {
    const { data, error } = await invokeEdgeFunction<{ url?: string }>(
      "stripe-billing",
      {
        method: "POST",
        body: {
          action: "billing_portal",
          org_id: params.orgId,
          return_path: params.returnPath ?? "/sas",
        },
      },
    );
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to open billing portal",
      );
    }
    if (data?.url && typeof window !== "undefined") {
      window.location.assign(data.url);
    }
    return data;
  },
  async stripeSyncSeats(params: { orgId: number }) {
    const { data, error } = await invokeEdgeFunction<{
      ok: boolean;
      quantity?: number;
      skipped?: boolean;
    }>("stripe-billing", {
      method: "POST",
      body: { action: "sync_seats", org_id: params.orgId },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to sync seats to Stripe",
      );
    }
    return data;
  },
  async stripeAddOneSeat(params: { orgId: number; returnPath?: string }) {
    const { data, error } = await invokeEdgeFunction<{
      ok: boolean;
      quantity?: number;
      previous?: number;
    }>("stripe-billing", {
      method: "POST",
      body: {
        action: "add_one_seat",
        org_id: params.orgId,
        return_path: params.returnPath ?? "/settings?tab=users",
      },
    });
    if (error) {
      throw new Error(
        (error as { message?: string }).message ??
          "Failed to add a seat in Stripe",
      );
    }
    return data;
  },
};
