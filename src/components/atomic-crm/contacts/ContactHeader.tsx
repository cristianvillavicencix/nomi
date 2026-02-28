import { Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router";

import { mailtoHref, mapsHref, normalizePhoneForTel } from "@/lib/linking";
import type { Contact } from "../types";
import { AddTask } from "../tasks/AddTask";
import { TagsListEdit } from "./TagsListEdit";
import { Avatar } from "./Avatar";

export const ContactHeader = ({
  record,
  locationSearch,
  onEdit,
  isMobile = false,
}: {
  record: Contact;
  locationSearch: string;
  onEdit: () => void;
  isMobile?: boolean;
}) => {
  const location = useLocation();

  const primaryEmail =
    record.email_jsonb?.find((entry) => entry.email?.trim())?.email?.trim() ?? "";
  const primaryPhone =
    record.phone_jsonb?.find((entry) => entry.number?.trim())?.number?.trim() ?? "";
  const emailLink = primaryEmail ? mailtoHref(primaryEmail) : "";
  const phoneLink = primaryPhone ? normalizePhoneForTel(primaryPhone) : null;
  const address = record.address?.trim() ?? "";
  const statusLabel = record.status
    ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
    : "Active";

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-5">
      <div
        className={cn(
          "flex gap-4",
          isMobile ? "flex-col" : "items-start justify-between",
        )}
      >
        <div className="flex min-w-0 gap-4">
          <Avatar />
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold">
                {record.first_name} {record.last_name}
              </h1>
              <Badge variant="secondary">{statusLabel}</Badge>
              <TagsListEdit hideButton />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">
                {record.title || "Contact"}
                {record.company_id != null && " at "}
                {record.company_id != null ? (
                  <Link
                    to={`/companies/${record.company_id}/show`}
                    state={{ from: `${location.pathname}${locationSearch}` }}
                    className="link-action"
                  >
                    {record.company_name ?? "Company"}
                  </Link>
                ) : null}
              </span>
              <span className="inline-flex items-center gap-2">
                <Phone className="size-4" />
                {phoneLink?.telHref ? (
                  <a href={phoneLink.telHref} className="link-action">
                    {phoneLink.display}
                  </a>
                ) : (
                  "—"
                )}
              </span>
              <span className="inline-flex items-center gap-2">
                <Mail className="size-4" />
                {emailLink ? (
                  <a href={emailLink} className="link-action break-all">
                    {primaryEmail}
                  </a>
                ) : (
                  "—"
                )}
              </span>
              <span className="inline-flex min-w-0 items-center gap-2">
                <MapPin className="size-4 shrink-0" />
                {address ? (
                  <a
                    href={mapsHref(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="link-action truncate"
                  >
                    {address}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex gap-2",
            isMobile ? "flex-wrap" : "items-center justify-end",
          )}
        >
          <TagsListEdit buttonOnly />
          <AddTask display="chip" />
          <Button onClick={onEdit}>Edit Profile</Button>
        </div>
      </div>
    </div>
  );
};
