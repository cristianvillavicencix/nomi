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

const looksLikeEmail = (value: string) => value.includes("@");

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const looksLikePhone = (value: string) => {
  const digits = digitsOnly(value);
  return digits.length >= 7 && /^[\d\s+\-().]+$/.test(value);
};

/** Match "Jose Quezada" via first_name + last_name AND; emails/phones get dedicated paths. */
export const applyContactListSearch = (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  const trimmed = String(q).trim();
  if (!trimmed) {
    return { ...params, filter };
  }

  if (looksLikeEmail(trimmed)) {
    const searchTerm = normalizePostgrestIlikeQuery(trimmed);
    return {
      ...params,
      filter: {
        ...filter,
        "@or": {
          "email_fts@ilike": searchTerm,
          "name@ilike": searchTerm,
          "company_name@ilike": searchTerm,
        },
      },
    };
  }

  if (looksLikePhone(trimmed)) {
    return {
      ...params,
      filter: {
        ...filter,
        "phone_fts@ilike": normalizePostgrestIlikeQuery(digitsOnly(trimmed)),
      },
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return {
      ...params,
      filter: {
        ...filter,
        "first_name@ilike": normalizePostgrestIlikeQuery(words[0] ?? ""),
        "last_name@ilike": normalizePostgrestIlikeQuery(
          words.slice(1).join(" "),
        ),
      },
    };
  }

  return applyFullTextSearch(CONTACT_SEARCH_COLUMNS)(params);
};

const COMPANY_SEARCH_COLUMNS = [
  "name",
  "phone_number",
  "website",
  "zipcode",
  "city",
  "state_abbr",
  "primary_contact_first_name",
  "primary_contact_last_name",
];

export const applyCompanyListSearch = (params: GetListParams) => {
  if (!params.filter?.q) {
    return params;
  }
  const { q, ...filter } = params.filter;
  const trimmed = String(q).trim();
  if (!trimmed) {
    return { ...params, filter };
  }

  if (looksLikeEmail(trimmed)) {
    const searchTerm = normalizePostgrestIlikeQuery(trimmed);
    return {
      ...params,
      filter: {
        ...filter,
        "@or": {
          "primary_contact_email_jsonb::text@ilike": searchTerm,
          "name@ilike": searchTerm,
          "website@ilike": searchTerm,
        },
      },
    };
  }

  if (looksLikePhone(trimmed)) {
    return {
      ...params,
      filter: {
        ...filter,
        "primary_contact_phone_jsonb::text@ilike": normalizePostgrestIlikeQuery(
          digitsOnly(trimmed),
        ),
      },
    };
  }

  return applyFullTextSearch(COMPANY_SEARCH_COLUMNS, {
    useContactFtsColumns: false,
  })(params);
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
