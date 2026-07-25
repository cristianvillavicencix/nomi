export type ProjectCreateMode = "manual" | "web-form";

export const buildProjectCreatePath = (options?: {
  companyId?: string | number | null;
  contactId?: string | number | null;
  mode?: ProjectCreateMode;
}) => {
  const params = new URLSearchParams();
  params.set("mode", options?.mode ?? "manual");
  if (options?.companyId != null) {
    params.set("company_id", String(options.companyId));
  }
  if (options?.contactId != null) {
    params.set("contact_id", String(options.contactId));
  }
  return `/deals/create?${params.toString()}`;
};

export const getNewDealManualCreatePath = (
  companyId?: string | number | null,
  contactId?: string | number | null,
) =>
  buildProjectCreatePath({
    companyId,
    contactId,
    mode: "manual",
  });

export const getNewDealRequestFormPath = (
  companyId?: string | number | null,
  contactId?: string | number | null,
) =>
  buildProjectCreatePath({
    companyId,
    contactId,
    mode: "web-form",
  });
