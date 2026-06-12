import type { GetListParams } from "ra-core";
import { normalizePostgrestIlikeQuery } from "../commons/postgrestSearchQuery";

const CONTACT_SEARCH_COLUMNS = [
  "name",
  "full_name",
  "first_name",
  "last_name",
  "company_name",
  "email",
  "phone",
];

/** Match "Jose Quezada" via first_name + last_name AND; single tokens use @or. */
export const applyContactListSearch = (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  const trimmed = String(q).trim();
  if (!trimmed) {
    return { ...params, filter };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return {
      ...params,
      filter: {
        ...filter,
        "first_name@ilike": normalizePostgrestIlikeQuery(words[0] ?? ""),
        "last_name@ilike": normalizePostgrestIlikeQuery(words.slice(1).join(" ")),
      },
    };
  }

  return applyFullTextSearch(CONTACT_SEARCH_COLUMNS)(params);
};

export const applyFullTextSearch =
  (columns: string[], options: { useContactFtsColumns?: boolean } = {}) =>
  (params: GetListParams) => {
    if (!params.filter?.q) {
      return params;
    }
    const { useContactFtsColumns = true } = options;
    const { q, ...filter } = params.filter;
    const searchTerm = normalizePostgrestIlikeQuery(String(q));
    return {
      ...params,
      filter: {
        ...filter,
        "@or": columns.reduce((acc, column) => {
          if (useContactFtsColumns && column === "email")
            return {
              ...acc,
              [`email_fts@ilike`]: searchTerm,
            };
          if (useContactFtsColumns && column === "phone")
            return {
              ...acc,
              [`phone_fts@ilike`]: searchTerm,
            };
          else
            return {
              ...acc,
              [`${column}@ilike`]: searchTerm,
            };
        }, {}),
      },
    };
  };
