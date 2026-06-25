import type { Identifier } from "ra-core";
import type { Company } from "@/components/atomic-crm/types";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import {
  resolveCompanyAddressForDisplay,
  type CompanyAddressDisplaySource,
} from "@/modules/clients/clientAddressUtils";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneForDisplay,
  type CompanyChannelDisplaySource,
} from "@/modules/clients/companyChannelResolvers";
import {
  buildCompanyPayloadFromUpsert,
  clientCreateFormValuesToUpsertInput,
} from "@/modules/clients/lbsClientUpsert";
import type { LucideIcon } from "lucide-react";
import { Mail, MapPin, Phone } from "lucide-react";

export type CompanySummarySource = CompanyAddressDisplaySource &
  CompanyChannelDisplaySource;

export type CompanySummaryDetailLine = {
  key: string;
  icon: LucideIcon;
  text: string;
};

const isDisplayValue = (value: string) =>
  Boolean(value?.trim()) && value.trim() !== "—";

export const getCompanySummaryDetailLines = (
  company: CompanySummarySource | null | undefined,
): CompanySummaryDetailLine[] => {
  if (!company) return [];

  const lines: CompanySummaryDetailLine[] = [];

  const address = resolveCompanyAddressForDisplay(company);
  if (isDisplayValue(address)) {
    lines.push({ key: "address", icon: MapPin, text: address });
  }

  const phone = resolveCompanyPhoneForDisplay(company);
  if (isDisplayValue(phone)) {
    lines.push({ key: "phone", icon: Phone, text: phone });
  }

  const email = resolveCompanyEmailForDisplay(company);
  if (isDisplayValue(email)) {
    lines.push({ key: "email", icon: Mail, text: email });
  }

  return lines;
};

/** Display snapshot after inline company create (before getOne refetch). */
export const clientCreateFormValuesToCompanySnapshot = (
  companyId: Identifier,
  values: ClientCreateFormValues,
  organizationMemberId: Identifier,
): Company => {
  const payload = buildCompanyPayloadFromUpsert(
    clientCreateFormValuesToUpsertInput(values, organizationMemberId),
  );

  return {
    id: companyId,
    name: payload.name,
    sector: payload.sector ?? "",
    phone_number: payload.phone_number ?? "",
    address: payload.address ?? "",
    city: payload.city ?? "",
    state_abbr: payload.state_abbr ?? "",
    zipcode: payload.zipcode ?? "",
    country: payload.country ?? "",
    context_links: payload.context_links,
    website: payload.website ?? "",
    linkedin_url: payload.linkedin_url ?? "",
    description: payload.description ?? "",
    revenue: payload.revenue ?? "",
    tax_identifier: payload.tax_identifier ?? "",
    size: payload.size ?? 1,
    created_at: new Date().toISOString(),
    logo: { src: "", title: "" },
  };
};
