import { Link } from "react-router";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { getClientShowPath } from "@/app/routing";
import {
  getContactEmail,
  getContactFullName,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { cn } from "@/lib/utils";

const websiteHref = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/\//, "")}`;

const websiteLabel = (value: string) => {
  const label = value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return label ? `${label}/` : value;
};

const formatLocation = (
  source?: {
    address?: string | null;
    city?: string | null;
    state_abbr?: string | null;
    zipcode?: string | null;
  } | null,
) => {
  if (!source) return null;
  const street = source.address?.trim();
  const cityLine = [source.city?.trim(), source.state_abbr?.trim()]
    .filter(Boolean)
    .join(", ");
  const zip = source.zipcode?.trim();
  const parts = [street, cityLine, zip].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

const SummaryRow = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3", className)}>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="text-sm text-foreground">{children}</dd>
  </div>
);

export const TicketClientSummaryCard = ({
  ticket,
  company,
  contact,
  matchedFromEmail = false,
  className,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  matchedFromEmail?: boolean;
  className?: string;
}) => {
  const meta = getTicketListMeta(ticket, company, contact);
  const companyName = company?.name?.trim();
  const contactName = contact ? getContactFullName(contact) : null;
  const contactTitle = contact?.title?.trim();
  const email =
    meta.email ??
    (contact && getContactEmail(contact) !== "—" ? getContactEmail(contact) : null);
  const phoneRaw =
    meta.phone ??
    (contact && getContactPhone(contact) !== "—" ? getContactPhone(contact) : null) ??
    company?.phone_number?.trim();
  const phone = phoneRaw ? formatUsPhoneDisplayFromAny(phoneRaw) : null;
  const address =
    formatLocation(contact) ??
    formatLocation(company) ??
    null;
  const website = meta.website ?? company?.website?.trim() ?? null;

  if (!companyName && !contactName && !email && !phone && !address && !website) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-lg border bg-muted/25 px-3 py-3 sm:px-4",
        className,
      )}
      aria-label="Client summary"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Client details
      </p>

      <dl className="mt-3 space-y-2.5">
        {companyName ? (
          <SummaryRow label="Company">
            {company?.id != null ? (
              <Link
                to={getClientShowPath(company.id)}
                className="font-medium text-primary hover:underline"
              >
                {companyName}
              </Link>
            ) : (
              <span className="font-medium">{companyName}</span>
            )}
          </SummaryRow>
        ) : null}

        {contactName && contactName !== "—" ? (
          <SummaryRow label="Contact">
            <span className="font-medium">{contactName}</span>
            {contactTitle ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {contactTitle}
              </span>
            ) : null}
          </SummaryRow>
        ) : null}

        {email ? (
          <SummaryRow label="Email">
            <a href={`mailto:${email}`} className="text-primary hover:underline">
              {email}
            </a>
          </SummaryRow>
        ) : null}

        {phone ? (
          <SummaryRow label="Phone">
            <a href={`tel:${phoneRaw}`} className="text-primary hover:underline">
              {phone}
            </a>
          </SummaryRow>
        ) : null}

        {address ? (
          <SummaryRow label="Address">
            <span className="text-muted-foreground">{address}</span>
          </SummaryRow>
        ) : null}

        {website ? (
          <SummaryRow label="Website">
            <a
              href={websiteHref(website)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {websiteLabel(website)}
            </a>
          </SummaryRow>
        ) : null}
      </dl>

      <p className="mt-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
        {matchedFromEmail
          ? "Matched an existing CRM contact from this sender's email. Save changes to link this ticket."
          : "Replies on this ticket go to the contact email above."}
      </p>
    </section>
  );
};
