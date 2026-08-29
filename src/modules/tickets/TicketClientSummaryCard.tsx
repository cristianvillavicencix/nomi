import { Link } from "react-router";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { getCompanyFaviconSources } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FaviconAvatarImage } from "@/components/ui/FaviconAvatarImage";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
import { TicketMetaSep } from "@/modules/tickets/TicketMetaSep";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
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
    country?: string | null;
  } | null,
) => {
  if (!source) return null;
  const street = source.address?.trim();
  const cityLine = [source.city?.trim(), source.state_abbr?.trim()]
    .filter(Boolean)
    .join(", ");
  const zip = source.zipcode?.trim();
  const country = source.country?.trim();
  const parts = [street, [cityLine, zip].filter(Boolean).join(" "), country]
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
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
  <div
    className={cn(
      "grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3",
      className,
    )}
  >
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
  </div>
);

const PanelIdentity = ({
  ticket,
  company,
  contact,
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  matchedFromEmail?: boolean;
}) => {
  const meta = getTicketListMeta(ticket, company, contact);
  const companyName = company?.name?.trim() || null;
  const contactName =
    contact && getContactFullName(contact) !== "—"
      ? getContactFullName(contact)
      : ticket.requester_name?.trim() || null;
  const email =
    meta.email ??
    (contact && getContactEmail(contact) !== "—"
      ? getContactEmail(contact)
      : null) ??
    ticket.requester_email?.trim() ??
    null;
  const phoneRaw =
    meta.phone ??
    (contact ? getContactPhoneRaw(contact) || null : null) ??
    company?.phone_number?.trim() ??
    null;
  const address = formatLocation(contact) ?? formatLocation(company) ?? null;
  const website = meta.website ?? company?.website?.trim() ?? null;
  const faviconSources = company ? getCompanyFaviconSources(company) : [];

  if (
    !companyName &&
    !contactName &&
    !email &&
    !phoneRaw &&
    !address &&
    !website
  ) {
    return null;
  }

  const displayName = companyName || contactName || "Account";

  const contactLineParts: ReactNode[] = [];
  if (contactName) {
    contactLineParts.push(
      contact?.id != null ? (
        <Link
          key="name"
          to={getPersonShowPath(contact)}
          className="font-medium text-foreground hover:underline"
        >
          {contactName}
        </Link>
      ) : (
        <span key="name" className="font-medium text-foreground">
          {contactName}
        </span>
      ),
    );
  }
  if (email) {
    contactLineParts.push(
      <a
        key="email"
        href={`mailto:${email}`}
        className="break-all text-primary hover:underline"
      >
        {email}
      </a>,
    );
  }
  if (phoneRaw) {
    contactLineParts.push(
      <CrmPhoneLink
        key="phone"
        phone={phoneRaw}
        contactId={contact?.id}
        dealId={ticket.deal_id}
        className="text-primary hover:underline"
      />,
    );
  }

  return (
    <section className="min-w-0" aria-label="Account identity">
      <div className="flex flex-col items-center text-center">
        <Avatar className="size-14 rounded-2xl border bg-muted/40 shadow-xs">
          {faviconSources.length > 0 ? (
            <FaviconAvatarImage
              sources={faviconSources}
              alt={displayName}
              className="object-contain p-1.5"
            />
          ) : null}
          <AvatarFallback className="rounded-2xl text-sm">
            {company ? (
              getCompanyAvatarFallback({
                name: companyName ?? undefined,
              })
            ) : (
              <Building2 className="size-5 text-muted-foreground" />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3 w-full min-w-0 space-y-0.5">
          {company?.id != null && companyName ? (
            <Link
              to={getClientShowPath(company.id)}
              className="block truncate text-base font-semibold leading-snug text-foreground hover:underline"
            >
              {companyName}
            </Link>
          ) : (
            <p className="truncate text-base font-semibold leading-snug text-foreground">
              {displayName}
            </p>
          )}

          {website ? (
            <a
              href={websiteHref(website)}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-primary hover:underline"
            >
              {websiteLabel(website)}
            </a>
          ) : null}

          {address ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {address}
            </p>
          ) : null}

          {contactLineParts.length > 0 ? (
            <p className="mt-2 flex flex-wrap items-center justify-center gap-y-0.5 text-xs leading-snug text-muted-foreground">
              {contactLineParts.map((part, index) => (
                <span key={index} className="inline-flex items-center">
                  {index > 0 ? <TicketMetaSep /> : null}
                  {part}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export const TicketClientSummaryCard = ({
  ticket,
  company,
  contact,
  matchedFromEmail = false,
  className,
  variant = "default",
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  matchedFromEmail?: boolean;
  className?: string;
  variant?: "default" | "panel";
}) => {
  if (variant === "panel") {
    return (
      <div className={className}>
        <PanelIdentity
          ticket={ticket}
          company={company}
          contact={contact}
        />
      </div>
    );
  }

  const meta = getTicketListMeta(ticket, company, contact);
  const companyName = company?.name?.trim();
  const contactName = contact ? getContactFullName(contact) : null;
  const contactTitle = contact?.title?.trim();
  const email =
    meta.email ??
    (contact && getContactEmail(contact) !== "—"
      ? getContactEmail(contact)
      : null);
  const phoneRaw =
    meta.phone ??
    (contact ? getContactPhoneRaw(contact) || null : null) ??
    company?.phone_number?.trim();
  const address = formatLocation(contact) ?? formatLocation(company) ?? null;
  const website = meta.website ?? company?.website?.trim() ?? null;

  if (
    !companyName &&
    !contactName &&
    !email &&
    !phoneRaw &&
    !address &&
    !website
  ) {
    return null;
  }

  return (
    <section
      className={cn("rounded-lg border bg-muted/25 px-3 py-3 sm:px-4", className)}
      aria-label="Client summary"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Account details
      </p>

      <dl className="mt-3 space-y-2.5">
        {companyName ? (
          <SummaryRow label="Account">
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
            <a
              href={`mailto:${email}`}
              className="break-all text-primary hover:underline"
            >
              {email}
            </a>
          </SummaryRow>
        ) : null}

        {phoneRaw ? (
          <SummaryRow label="Phone">
            <CrmPhoneLink
              phone={phoneRaw}
              contactId={contact?.id}
              dealId={ticket.deal_id}
              className="text-primary hover:underline"
            />
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
              className="break-all text-primary hover:underline"
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
