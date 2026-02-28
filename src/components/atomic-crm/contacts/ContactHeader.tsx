import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
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
  const phoneLink = primaryPhone ? normalizePhoneForTel(primaryPhone) : null;
  const emailLink = primaryEmail ? mailtoHref(primaryEmail) : "";
  const address = record.address?.trim() ?? "";

  return (
    <div className="mb-4 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar />
        <div className="min-w-0 flex-1">
          <h5 className="truncate text-xl font-semibold">
            {record.first_name} {record.last_name}
          </h5>
          <div className="inline-flex max-w-full text-sm text-muted-foreground">
            {record.title}
            {record.title && record.company_id != null && " at "}
            {record.company_id != null && (
              <Link
                to={`/companies/${record.company_id}/show`}
                state={{ from: `${location.pathname}${locationSearch}` }}
                className="link-action truncate"
              >
                &nbsp;{record.company_name ?? "Company"}
              </Link>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex shrink-0 gap-2",
            isMobile ? "flex-col items-stretch" : "items-center",
          )}
        >
          <TagsListEdit buttonOnly />
          <AddTask display="chip" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
            <span className="sr-only">Edit contact</span>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        <div className="min-w-0 space-y-2">
          <div className="text-2xl font-semibold leading-tight">
            {record.first_name} {record.last_name}
          </div>
          <div className="min-w-0 text-sm text-muted-foreground">
            {record.company_id != null ? (
              <Link
                to={`/companies/${record.company_id}/show`}
                state={{ from: `${location.pathname}${locationSearch}` }}
                className="link-action"
              >
                {record.company_name ?? "Company"}
              </Link>
            ) : (
              "—"
            )}
          </div>
          <div className="min-w-0 text-sm text-muted-foreground">
            {address ? (
              <a
                href={mapsHref(address)}
                target="_blank"
                rel="noreferrer"
                className="link-action block"
                title={address}
              >
                {address}
              </a>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex flex-col gap-4",
            isMobile ? "items-start" : "items-end text-right",
          )}
        >
          <HeaderMetaItem
            label="EMAIL"
            value={
              emailLink ? (
                <a href={emailLink} className="link-action text-sm break-all">
                  {primaryEmail}
                </a>
              ) : (
                "—"
              )
            }
          />
          <HeaderMetaItem
            label="PHONE"
            value={
              phoneLink?.telHref ? (
                <a href={phoneLink.telHref} className="link-action text-sm">
                  {phoneLink.display}
                </a>
              ) : (
                "—"
              )
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm text-muted-foreground md:flex-row md:flex-wrap md:gap-4">
        <span>
          Added on{" "}
          {record.first_seen
            ? new Date(record.first_seen).toLocaleDateString()
            : "—"}
        </span>
        <span>
          Last activity{" "}
          {record.last_seen
            ? new Date(record.last_seen).toLocaleDateString()
            : "—"}
        </span>
      </div>
    </div>
  );
};

const HeaderMetaItem = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="min-w-0">
    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="min-w-0 text-sm">{value}</div>
  </div>
);
