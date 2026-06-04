import type { Company, Contact } from "@/components/atomic-crm/types";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";

export const resolveInvoiceRecipientEmail = ({
  company,
  contact,
  fallbackEmail,
}: {
  company?: Company | null;
  contact?: Contact | null;
  fallbackEmail?: string | null;
}) => {
  const ctx = parseLbsClientContextLinks(company?.context_links);
  if (ctx.invoiceEmail?.trim()) return ctx.invoiceEmail.trim();

  const contactEmail =
    contact?.email_jsonb?.find((row) => row.isPrimary)?.value ??
    contact?.email_jsonb?.[0]?.value;
  if (contactEmail?.trim()) return contactEmail.trim();

  if (fallbackEmail?.trim()) return fallbackEmail.trim();
  return "";
};

export const formatContactName = (contact?: Contact | null) =>
  [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || null;
