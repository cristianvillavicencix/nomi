/** Read JSON error body from a failed supabase.functions.invoke() call. */
export const readSupabaseFunctionErrorMessage = async (
  error: { message?: string; context?: unknown },
  fallback: string,
): Promise<string> => {
  const response = (error as { context?: Response }).context;
  if (response instanceof Response) {
    try {
      const payload = (await response.clone().json()) as {
        message?: string;
        error?: string;
      };
      if (payload?.message) return payload.message;
      if (payload?.error) return payload.error;
    } catch {
      // Fall through.
    }
  }
  return error.message || fallback;
};
