const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SB_PUBLISHABLE_KEY as string | undefined;

export class PublicEdgeFunctionError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PublicEdgeFunctionError";
    this.status = status;
  }
}

/** Public edge functions (verify_jwt = false) — bypasses supabase-js invoke + auth locks. */
export const invokePublicEdgeFunction = async <T>(
  functionName: string,
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal },
): Promise<T> => {
  if (!supabaseUrl || !supabaseKey) {
    throw new PublicEdgeFunctionError("Supabase is not configured");
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  let payload:
    | (T & { message?: string; error?: string; status?: number })
    | null = null;

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // ignore empty or non-JSON bodies
  }

  if (!response.ok) {
    const detail =
      payload?.message ??
      payload?.error ??
      `Request failed (${response.status})`;
    throw new PublicEdgeFunctionError(detail, response.status);
  }

  return payload as T;
};
