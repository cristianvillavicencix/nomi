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
    throw new Error(
      payload.message ?? payload.error ?? `Request failed (${response.status})`,
    );
  }
  return payload;
};

export type PublicSubscriptionAgreementPayload = {
  short_code: string;
  subscription_id: number;
  subscription_name: string;
  subscription_number?: string | null;
  amount: number;
  currency: string;
  billing_interval: "weekly" | "monthly" | "yearly";
  line_items: Array<Record<string, unknown>>;
  terms_markdown: string;
  terms_version?: string | null;
  contract_title?: string | null;
  organization_name?: string | null;
  client_name?: string | null;
  client_address?: string | null;
  status?: string | null;
  already_active?: boolean;
  already_signed?: boolean;
  signatory_name?: string | null;
  card_on_file?: boolean;
  needs_card?: boolean;
};

export const fetchPublicSubscriptionAgreement = (shortCode: string) =>
  invokePublicFunction<PublicSubscriptionAgreementPayload>(
    "get_public_subscription_agreement",
    { short_code: shortCode },
  );

export const signPublicSubscriptionAgreement = (input: {
  short_code: string;
  signatory_name: string;
  signature_png: string;
  base_url?: string;
}) =>
  invokePublicFunction<{ checkout_url: string; signed: boolean }>(
    "sign_subscription_agreement",
    input,
  );
