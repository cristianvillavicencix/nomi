export const isSupabaseSchemaMissingError = (
  error: unknown,
  table?: string,
) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (
    !normalized.includes("schema cache") &&
    !normalized.includes("could not find the table")
  ) {
    return false;
  }

  if (table) {
    return normalized.includes(table.toLowerCase());
  }

  return true;
};

export const getSupabaseSchemaMissingMessage = (table: string) =>
  `The "${table}" table is not in your Supabase database yet. Apply pending migrations with: npx supabase db push -p YOUR_DB_PASSWORD (password in Supabase Dashboard → Project Settings → Database).`;

export const supabaseTableQueryOptions = (table: string) => ({
  retry: (failureCount: number, error: unknown) =>
    !isSupabaseSchemaMissingError(error, table) && failureCount < 2,
});
