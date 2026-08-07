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

export type PublicSubscriptionSetupPayload = {
  checkout_url: string;
  subscription_name: string;
  subscription_number?: string | null;
  status?: string | null;
  already_active?: boolean;
};

export const fetchPublicSubscriptionSetupByShortCode = (shortCode: string) =>
  invokePublicFunction<PublicSubscriptionSetupPayload>(
    "get_public_subscription_setup",
    { short_code: shortCode },
  );
