import { Link } from "react-router";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { getClientShowPath } from "@/app/routing";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";
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
  stacked = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  stacked?: boolean;
}) => {
  if (stacked) {
    return (
      <div className={cn("space-y-1", className)}>
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="min-w-0 break-words text-sm leading-snug text-foreground">
          {children}
        </dd>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3",
        className,
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">
        {children}
      </dd>
    </div>
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

  const stacked = variant === "panel";

  return (
    <section
      className={cn(
        stacked ? "min-w-0" : "rounded-lg border bg-muted/25 px-3 py-3 sm:px-4",
        className,
      )}
      aria-label="Client summary"
    >
      <p
        className={cn(
          "font-semibold uppercase tracking-wide text-muted-foreground",
          stacked ? "text-[11px]" : "text-xs",
        )}
      >
        Client details
      </p>

      <dl className={cn("mt-3", stacked ? "space-y-3.5" : "space-y-2.5")}>
        {companyName ? (
          <SummaryRow label="Company" stacked={stacked}>
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
          <SummaryRow label="Contact" stacked={stacked}>
            <span className="font-medium">{contactName}</span>
            {contactTitle ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {contactTitle}
              </span>
            ) : null}
          </SummaryRow>
        ) : null}

        {email ? (
          <SummaryRow label="Email" stacked={stacked}>
            <a
              href={`mailto:${email}`}
              className="break-all text-primary hover:underline"
            >
              {email}
            </a>
          </SummaryRow>
        ) : null}

        {phoneRaw ? (
          <SummaryRow label="Phone" stacked={stacked}>
            <CrmPhoneLink
              phone={phoneRaw}
              contactId={contact?.id}
              dealId={ticket.deal_id}
              className="text-primary hover:underline"
            />
          </SummaryRow>
        ) : null}

        {address ? (
          <SummaryRow label="Address" stacked={stacked}>
            <span className="text-muted-foreground">{address}</span>
          </SummaryRow>
        ) : null}

        {website ? (
          <SummaryRow label="Website" stacked={stacked}>
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

      <p
        className={cn(
          "text-xs text-muted-foreground",
          stacked
            ? "mt-4 border-t border-border/60 pt-3 leading-relaxed"
            : "mt-3 border-t border-border/60 pt-2.5",
        )}
      >
        {matchedFromEmail
          ? "Matched an existing CRM contact from this sender's email. Save changes to link this ticket."
          : "Replies on this ticket go to the contact email above."}
      </p>
    </section>
  );
};
