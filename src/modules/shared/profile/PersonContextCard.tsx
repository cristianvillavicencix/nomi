import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, Building2 } from "lucide-react";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import type { Contact } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPersonShowPath } from "@/app/routing";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { CrmPhoneDisplay } from "@/modules/voice/CrmPhoneDisplay";
import { cn } from "@/lib/utils";

type PersonContextCardProps = {
  contact: Contact;
  viewProfileHref?: string;
  className?: string;
  onViewProfile?: () => void;
};

/** Compact person identity for Messages / Tickets / Project context panels. */
export const PersonContextCard = ({
  contact,
  viewProfileHref,
  className,
  onViewProfile,
}: PersonContextCardProps) => {
  const name = getContactFullName(contact);
  const email = getContactEmail(contact);
  const phone = getContactPhoneRaw(contact);
  const href = viewProfileHref ?? getPersonShowPath(contact);
  const statusLabel = contact.status
    ? contact.status.charAt(0).toUpperCase() +
      contact.status.slice(1).replace(/_/g, " ")
    : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar record={contact} width={40} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            {statusLabel ? (
              <Badge variant="secondary" className="text-[10px] font-normal">
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          {contact.title?.trim() ? (
            <p className="truncate text-xs text-muted-foreground">
              {contact.title}
            </p>
          ) : null}
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {phone ? (
              <CrmPhoneDisplay phone={phone} contactId={contact.id} />
            ) : null}
            {email !== "—" ? <p className="truncate">{email}</p> : null}
            {!phone && email === "—" ? <p>—</p> : null}
          </div>
        </div>
      </div>
      {onViewProfile ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 w-full gap-1.5"
          onClick={onViewProfile}
        >
          View profile
          <ArrowRight className="size-3.5" />
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 w-full gap-1.5"
          asChild
        >
          <Link to={href}>
            View profile
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
};

type CompanyContextCardProps = {
  companyId: string | number;
  name: string;
  website?: string | null;
  isClient?: boolean;
  viewProfileHref: string;
  className?: string;
  avatar?: ReactNode;
};

/** Compact company identity for context panels. */
export const CompanyContextCard = ({
  name,
  website,
  isClient,
  viewProfileHref,
  className,
  avatar,
}: CompanyContextCardProps) => {
  const websiteHref = website?.trim()
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border bg-card p-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {avatar ?? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">
              {name.trim() || "Account"}
            </p>
            {isClient ? (
              <Badge variant="default" className="text-[10px] font-normal">
                Client
              </Badge>
            ) : null}
          </div>
          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="link-action block truncate text-xs"
            >
              {website}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">No website</p>
          )}
        </div>
      </div>
      <Button variant="secondary" size="sm" className="h-8 w-full gap-1.5" asChild>
        <Link to={viewProfileHref}>
          View account
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
};
