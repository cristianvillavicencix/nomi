/**
 * Normalize a user search string for PostgREST `ilike` filters.
 *
 * ra-data-postgrest splits `ilike` values on whitespace. With 3+ words that
 * triggers a library bug that emits bare `ilike.*word*` clauses (400 errors).
 * Joining words with `%` keeps a single token and matches phrases in order.
 */
export const normalizePostgrestIlikeQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;

  const escaped = trimmed.replace(/[%_\\]/g, "\\$&");
  return escaped.replace(/\s+/g, "%");
};
