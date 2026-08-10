import { supabaseAdmin } from "./supabaseAdmin.ts";

export type AddressLinkMatch = {
  contact_id: number | null;
  company_id: number | null;
};

export const normalizeStreetAddress = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const streetSearchTokens = (address: string) => {
  const streetPart = address.split(",")[0]?.trim() ?? address.trim();
  const normalized = normalizeStreetAddress(streetPart);
  const tokens = normalized.split(" ").filter(Boolean);
  const houseNumber = tokens[0]?.match(/^\d+/)?.[0] ?? "";
  const streetWords = tokens.slice(houseNumber ? 1 : 0, 4).join(" ");
  return { houseNumber, streetWords, streetPart };
};

const addressMatchesCandidate = (candidate: string, search: string) => {
  const normalizedCandidate = normalizeStreetAddress(candidate);
  const normalizedSearch = normalizeStreetAddress(search);
  if (!normalizedCandidate || !normalizedSearch) return false;
  if (
    normalizedCandidate.includes(normalizedSearch) ||
    normalizedSearch.includes(normalizedCandidate)
  ) {
    return true;
  }

  const { houseNumber, streetWords } = streetSearchTokens(search);
  if (!houseNumber) return false;
  return (
    normalizedCandidate.includes(houseNumber) &&
    streetWords.length > 0 &&
    streetWords
      .split(" ")
      .every((word) => word.length < 2 || normalizedCandidate.includes(word))
  );
};

export const findContactOrCompanyByAddress = async (
  orgId: number,
  address: string,
): Promise<AddressLinkMatch | null> => {
  const trimmed = address.trim();
  if (trimmed.length < 5) return null;

  const { streetPart } = streetSearchTokens(trimmed);
  const ilikePattern = `%${streetPart.replace(/\s+/g, "%")}%`;

  const { data: companies, error: companyError } = await supabaseAdmin
    .from("companies")
    .select("id, address, city, zipcode")
    .eq("org_id", orgId)
    .not("address", "is", null)
    .ilike("address", ilikePattern)
    .limit(10);

  if (companyError) throw new Error(companyError.message);

  const companyMatches = (companies ?? []).filter((company) =>
    addressMatchesCandidate(
      [company.address, company.city, company.zipcode].filter(Boolean).join(" "),
      trimmed,
    ),
  );

  if (companyMatches.length === 1) {
    const company = companyMatches[0];
    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("org_id", orgId)
      .eq("company_id", company.id)
      .order("id", { ascending: true })
      .limit(1);
    return {
      company_id: company.id,
      contact_id: contacts?.[0]?.id ?? null,
    };
  }

  const { data: contacts, error: contactError } = await supabaseAdmin
    .from("contacts")
    .select("id, company_id, address")
    .eq("org_id", orgId)
    .not("address", "is", null)
    .ilike("address", ilikePattern)
    .limit(10);

  if (contactError) throw new Error(contactError.message);

  const contactMatches = (contacts ?? []).filter((contact) =>
    addressMatchesCandidate(contact.address ?? "", trimmed),
  );

  if (contactMatches.length === 1) {
    return {
      contact_id: contactMatches[0].id,
      company_id: contactMatches[0].company_id ?? null,
    };
  }

  return null;
};
