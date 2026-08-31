import type { Identifier } from "ra-core";
import { resolvePublicAppBaseUrl } from "@/lib/publicAppUrl";
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

    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
    }>("issue_client_invoice", {
      method: "POST",
      body,
    });

    if (error) {
      console.error("issue_client_invoice.error", error);
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to issue invoice"),
      );
    }

    if (!data?.invoice) {
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

    if (error) {
      console.error("syncProposalInvoices.error", error);
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to sync proposal invoices",
        ),
      );
    }

    if (!Array.isArray(data?.invoices)) {
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
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
    }>("create_client_invoice", {
      method: "POST",
      body,
    });

    if (error || !data?.invoice) {
      console.error("create_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to create invoice",
            )
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
    smsOnly,
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
    smsOnly?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
      email_sent?: boolean;
      email_skipped?: boolean;
      sms_sent?: boolean;
      sms_skipped?: boolean;
    }>("send_client_invoice", {
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
        sms_only: smsOnly === true,
        ...(cc?.length ? { cc } : {}),
        ...(bcc?.length ? { bcc } : {}),
        ...(smsTo?.trim() ? { sms_to: smsTo.trim() } : {}),
        ...(smsBody?.trim() ? { sms_body: smsBody.trim() } : {}),
        ...(contactId != null ? { contact_id: Number(contactId) } : {}),
      },
    });

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
    voidReason,
  }: {
    invoiceId: Identifier;
    action: "mark_sent" | "void" | "delete";
    voidReason?: string;
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
        ...(voidReason ? { void_reason: voidReason } : {}),
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
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
    }>("schedule_client_invoice", {
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
    });

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
    const { data, error } = await invokeEdgeFunction<{
      invoice: Record<string, unknown>;
    }>("update_client_invoice", {
      method: "POST",
      body: {
        invoice_id: Number(invoiceId),
        ...body,
      },
    });

    if (error || !data?.invoice) {
      console.error("update_client_invoice.error", error);
      throw new Error(
        error
          ? await readEdgeFunctionErrorMessage(
              error,
              "Failed to update invoice",
            )
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
  async createClientSubscription(body: {
    company_id?: number | null;
    contact_id?: number | null;
    deal_id?: number | null;
    reference_number?: string | null;
    name: string;
    amount: number;
    currency?: string;
    billing_interval: "weekly" | "monthly" | "yearly";
    line_items?: Array<Record<string, unknown>>;
    starts_at?: string | null;
    ends_at?: string | null;
    enrollment_mode?: "direct" | "agreement";
    agreement_terms_markdown?: string | null;
    payment_mode?: "saved_card" | "staff_card" | "request_setup";
    payment_method_id?: string | null;
    send_email?: boolean;
    send_sms?: boolean;
    email_to?: string | null;
    sms_to?: string | null;
    message?: string | null;
    subject?: string | null;
    base_url?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      subscription: Record<string, unknown>;
      checkout_url?: string | null;
      agreement_share_url?: string | null;
      used_saved_card?: boolean;
      used_staff_card?: boolean;
      email_sent?: boolean;
      sms_sent?: boolean;
    }>("create_client_subscription", {
      method: "POST",
      body,
    });

    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to create subscription",
        ),
      );
    }

    if (!data?.subscription) {
      throw new Error("Failed to create subscription");
    }

    return data;
  },
  async prepareClientSubscriptionPayment(body: {
    company_id?: number | null;
    contact_id?: number | null;
    email_to?: string | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      client_secret: string;
      publishable_key: string;
      stripe_customer_id: string;
    }>("prepare_client_subscription_payment", {
      method: "POST",
      body,
    });

    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to prepare subscription payment",
        ),
      );
    }

    if (!data?.client_secret) {
      throw new Error("Failed to prepare subscription payment");
    }

    return data;
  },
  async manageClientSubscription(params: {
    subscriptionId: Identifier;
    action:
      | "pause"
      | "resume"
      | "cancel_now"
      | "cancel_at_period_end"
      | "undo_cancel"
      | "reactivate"
      | "send_setup"
      | "request_card_update"
      | "update_payment_method"
      | "list_payment_methods"
      | "detach_payment_method"
      | "update"
      | "apply_payment"
      | "sync_stripe";
    name?: string | null;
    description?: string | null;
    amount?: number | null;
    billing_interval?: "weekly" | "monthly" | "yearly" | null;
    ends_at?: string | null;
    reference_number?: string | null;
    deal_id?: number | null;
    line_items?: Array<Record<string, unknown>>;
    payment_mode?: "saved_card" | "staff_card" | "request_setup" | null;
    payment_method_id?: string | null;
    send_email?: boolean;
    send_sms?: boolean;
    email_to?: string | null;
    sms_to?: string | null;
    message?: string | null;
    subject?: string | null;
    base_url?: string | null;
    /** Days until auto-resume for pause. Null = until manual resume. */
    pause_days?: number | null;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      subscription?: Record<string, unknown>;
      checkout_url?: string | null;
      setup_link_stale?: boolean;
      synced?: boolean;
      reason?: string;
      used_saved_card?: boolean;
      used_staff_card?: boolean;
      email_sent?: boolean;
      sms_sent?: boolean;
      payment_methods?: Array<{
        id: string;
        brand: string | null;
        last4: string;
        exp_month: number | null;
        exp_year: number | null;
      }>;
      detached?: boolean;
    }>("manage_client_subscription", {
      method: "POST",
      body: {
        subscription_id: Number(params.subscriptionId),
        action: params.action,
        name: params.name,
        description: params.description,
        amount: params.amount,
        billing_interval: params.billing_interval,
        ends_at: params.ends_at,
        reference_number: params.reference_number,
        deal_id: params.deal_id,
        line_items: params.line_items,
        payment_mode: params.payment_mode,
        payment_method_id: params.payment_method_id,
        send_email: params.send_email,
        send_sms: params.send_sms,
        email_to: params.email_to,
        sms_to: params.sms_to,
        message: params.message,
        subject: params.subject,
        base_url: params.base_url ?? resolvePublicAppBaseUrl(),
        pause_days: params.pause_days,
      },
    });

    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to update subscription",
        ),
      );
    }

    if (
      params.action === "list_payment_methods" ||
      params.action === "detach_payment_method"
    ) {
      return data ?? {};
    }

    if (!data?.subscription) {
      throw new Error("Failed to update subscription");
    }

    return data;
  },
};
