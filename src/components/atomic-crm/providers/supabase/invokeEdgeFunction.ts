import { supabase } from "./supabase";

export const invokeEdgeFunction = async <TData = unknown>(
  functionName: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) => {
  const getSessionToken = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session?.access_token;
  };

  const invokeWithToken = async (token?: string) =>
    supabase.functions.invoke<TData>(functionName, {
      ...options,
      headers: {
        apikey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  const token = await getSessionToken();
  let result = await invokeWithToken(token);

  const status = result.error?.context?.status;
  if (status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retryToken = refreshed.data.session?.access_token;
    result = await invokeWithToken(retryToken);
  }

  return result;
};

export const readEdgeFunctionErrorMessage = async (
  error: { message?: string; context?: unknown },
  fallback: string,
): Promise<string> => {
  const response = (error as { context?: Response }).context;
  if (response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as { message?: string };
      if (payload?.message) {
        return payload.message;
      }
    } catch {
      try {
        const text = (await response.clone().text()).trim();
        if (text) {
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed?.message) return parsed.message;
        }
      } catch {
        // Fall through to generic message below.
      }
    }
  }

  if (
    error.message &&
    !error.message.includes("Edge Function returned a non-2xx status code")
  ) {
    return error.message;
  }

  return fallback;
};
