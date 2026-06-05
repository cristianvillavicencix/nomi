const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SB_PUBLISHABLE_KEY as
  | string
  | undefined;

const invokePublicFunction = async <T>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase is not configured");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as T & {
    message?: string;
    error?: string;
  };
  if (!response.ok) {
    const detail =
      payload.message ??
      payload.error ??
      `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload;
};

export type PublicInvoicePayload = {
  token: string;
  portal_token?: string | null;
  invoice: {
    id: number;
    invoice_number: string;
    issue_date: string;
    due_date: string;
    amount: number;
    subtotal?: number | null;
    discount_amount?: number | null;
    fee_amount?: number | null;
    currency?: string;
    terms?: string | null;
    description: string;
    notes?: string | null;
    status?: string;
    reference?: string | null;
    save_card_for_future_charges?: boolean;
    upfront_percent?: number | null;
    auto_charge_remainder?: boolean | null;
    amount_paid?: number | null;
    remainder_schedule?: import("@/lbs/billing/invoiceRemainderSchedule").InvoiceRemainderScheduleConfig | null;
  };
  line_items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    line_total: number;
    sort_order?: number;
  }>;
  organization: {
    name: string;
    website?: string | null;
    address?: string | null;
  };
  bill_to: {
    company_name?: string | null;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export const fetchPublicInvoice = (token: string) =>
  invokePublicFunction<PublicInvoicePayload>("get_public_invoice", { token });

export const resolvePublicInvoiceShortCode = async (shortCode: string) => {
  const payload = await invokePublicFunction<{ token: string }>(
    "get_public_invoice",
    { short_code: shortCode },
  );
  return payload.token;
};

export const payPublicClientInvoice = (params: {
  token: string;
  paymentMethodId?: string;
}) =>
  invokePublicFunction<{
    invoice: PublicInvoicePayload["invoice"];
    charged_amount: number;
    amount_paid: number;
    balance_due: number;
    paid_in_full: boolean;
    billing_mode?: string;
    auto_charge_scheduled?: boolean;
  }>("pay_client_invoice", {
    public_token: params.token,
    payment_method_id: params.paymentMethodId,
  });
