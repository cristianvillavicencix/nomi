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
      (typeof payload === "object" && payload !== null && "msg" in payload
        ? String((payload as { msg?: string }).msg)
        : null) ??
      `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return payload;
};

export type PublicProposalPayload = {
  token: string;
  proposal: {
    id: number;
    title: string;
    status: string;
    amount: number;
    proposal_number?: string | null;
    currency?: string;
    validity_days?: number;
    valid_until?: string | null;
    deposit_amount?: number | null;
    balance_amount?: number | null;
    deposit_percent?: number;
    notes?: string | null;
    sent_at?: string | null;
    viewed_at?: string | null;
    accepted_at?: string | null;
    contract_id?: number | null;
    content?: unknown;
  };
  line_items: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    billing_type?: string;
    billing_interval?: string | null;
  }>;
  installments: Array<{
    installment_number: number;
    label: string;
    due_date: string;
    amount: number;
    status?: string;
  }>;
  contract: {
    id: number;
    status: string;
    signed_at: string | null;
    deposit_paid_at: string | null;
    terms_snapshot: string | null;
  } | null;
  organization: {
    name: string;
    logo_url?: string | null;
  };
};

export const fetchPublicProposal = (token: string) =>
  invokePublicFunction<PublicProposalPayload>("get_public_proposal", {
    token,
    mark_viewed: true,
  });

export const acceptPublicProposal = (proposalId: number, publicToken: string) =>
  invokePublicFunction<{ deal_id: number; contract_id: number | null }>(
    "accept_proposal",
    { proposal_id: proposalId, public_token: publicToken },
  );

export const signPublicProposalContract = ({
  proposalId,
  token,
  signatoryName,
  confirmDeposit,
}: {
  proposalId: number;
  token: string;
  signatoryName: string;
  confirmDeposit: boolean;
}) =>
  invokePublicFunction<{ contract_id: number; signed_at: string }>(
    "sign_proposal_contract",
    {
      proposal_id: proposalId,
      public_token: token,
      signatory_name: signatoryName,
      confirm_deposit: confirmDeposit,
    },
  );

export const resolvePublicProposalShortCode = async (shortCode: string) => {
  const data = await invokePublicFunction<{ token: string }>(
    "get_public_proposal",
    { short_code: shortCode, mark_viewed: false },
  );
  return data.token;
};
