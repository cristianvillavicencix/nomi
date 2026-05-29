import { useState } from "react";
import {
  ChevronLeft,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Trash,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  RecordContextProvider,
  useDelete,
  useGetOne,
  useNotify,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/admin/confirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Status } from "@/components/atomic-crm/misc/Status";
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { getCompanyFaviconSrc } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import {
  AvatarFallback,
  AvatarImage,
  Avatar as UiAvatar,
} from "@/components/ui/avatar";
import { mailtoHref, mapsHref, normalizePhoneForTel } from "@/lib/linking";
import {
  formatClientHeaderAddress,
  collectBusinessSocialLinks,
  collectClientEmails,
  getClientStatus,
  getExtraClientEmails,
  getPrimaryContactEmailFromContact,
  getPrimaryContactFullName,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import { ClientExtraEmailsIndicator } from "@/lbs/clients/ClientExtraEmailsIndicator";
import { ClientNewMenu } from "@/lbs/clients/ClientNewMenu";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";
import { OpenClientSmsButton } from "@/lbs/messages/OpenClientSmsButton";
import { SendFormButton } from "@/lbs/forms-v2/share/SendFormButton";
import {
  getClientDealCreatePath,
  getClientEditPath,
  getClientsListPath,
} from "@/lbs/routing";
import type { Contact } from "@/components/atomic-crm/types";

type ClientProfileHeaderProps = {
  record: CompanyWithPrimaryContact;
  onAddContact: () => void;
};

export const ClientProfileHeader = ({
  record,
  onAddContact,
}: ClientProfileHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotify();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteOne, { isPending: isDeleting }] = useDelete();

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: record.primary_contact_id! },
    { enabled: !!record.primary_contact_id },
  );

  const personNameFromRecord = getPrimaryContactFullName(record);
  const personNameFromContact = primaryContact
    ? `${primaryContact.first_name ?? ""} ${primaryContact.last_name ?? ""}`.trim()
    : "";
  const personName =
    personNameFromRecord !== "—"
      ? personNameFromRecord
      : personNameFromContact || "—";
  const businessName = record.name?.trim() || "";
  const contactEmail = getPrimaryContactEmailFromContact(primaryContact);
  const allEmails = collectClientEmails(record, primaryContact);
  const displayEmail =
    contactEmail !== "—" ? contactEmail : (allEmails[0]?.email ?? "");
  const extraEmails = getExtraClientEmails(
    record,
    primaryContact,
    displayEmail || undefined,
  );
  const phone = getPrimaryContactPhone(record);
  const businessSocialLinks = collectBusinessSocialLinks(record);
  const address = formatClientHeaderAddress(record, primaryContact?.address);
  const status = getClientStatus(record);
  const emailValue = displayEmail;
  const phoneValue = phone !== "—" ? phone : "";
  const emailLink = emailValue ? mailtoHref(emailValue) : "";
  const phoneLink = phoneValue ? normalizePhoneForTel(phoneValue) : null;
  const faviconSrc = getCompanyFaviconSrc(record);
  const website = record.website?.trim();
  const websiteHref = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  const handleDelete = () => {
    deleteOne(
      "companies",
      { id: record.id, previousData: record },
      {
        onSuccess: () => {
          notify("Client deleted", { type: "info" });
          setDeleteOpen(false);
          navigate(getClientsListPath());
        },
        onError: () => {
          notify("Failed to delete client", { type: "error" });
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="mb-2 px-0 link-action"
        onClick={() => navigate(location.state?.from ?? -1)}
      >
        <ChevronLeft className="size-4" />
        Back
      </Button>

      <div className="rounded-xl border bg-muted/20 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <UiAvatar className="size-10 shrink-0 self-center">
              {faviconSrc ? (
                <AvatarImage
                  src={faviconSrc}
                  alt={businessName || personName}
                  className="object-contain"
                />
              ) : null}
              <AvatarFallback className="text-sm">
                {getCompanyAvatarFallback({
                  name: businessName,
                  contact_name: personName !== "—" ? personName : undefined,
                  email: emailValue || undefined,
                })}
              </AvatarFallback>
            </UiAvatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base leading-relaxed">
                  <span className="font-semibold">{businessName || "—"}</span>
                  {personName !== "—" ? (
                    <>
                      <span className="text-muted-foreground"> | </span>
                      <span>{personName}</span>
                    </>
                  ) : null}
                </p>
                {status !== "—" ? <Status status={status} /> : null}
              </div>
              {phoneLink?.display || emailValue ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {phoneLink?.display ? (
                    phoneLink.telHref ? (
                      <a href={phoneLink.telHref} className="link-action">
                        {phoneLink.display}
                      </a>
                    ) : (
                      <span>{phoneLink.display}</span>
                    )
                  ) : null}
                  {phoneLink?.display && emailValue ? (
                    <span className="text-muted-foreground"> | </span>
                  ) : null}
                  {emailValue ? (
                    <>
                      <a href={emailLink} className="link-action break-all">
                        {emailValue}
                      </a>
                      <ClientExtraEmailsIndicator extraEmails={extraEmails} />
                    </>
                  ) : null}
                </p>
              ) : null}
              {address && address !== "—" ? (
                <p className="text-sm text-muted-foreground">
                  <a
                    href={mapsHref(address)}
                    target="_blank"
                    rel="noreferrer"
                    className="link-action"
                  >
                    {address}
                  </a>
                </p>
              ) : null}
              {websiteHref ? (
                <p className="text-sm">
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="link-action inline-flex items-center gap-1"
                  >
                    {website}
                    <ExternalLink className="size-3.5" />
                  </a>
                </p>
              ) : null}
              {businessSocialLinks.length > 0 ? (
                <ClientSocialLinksDisplay links={businessSocialLinks} />
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:justify-end">
            <SendFormButton
              context={{
                type: "company",
                company_id: Number(record.id),
                contact_id:
                  record.primary_contact_id != null
                    ? Number(record.primary_contact_id)
                    : primaryContact?.id != null
                      ? Number(primaryContact.id)
                      : undefined,
                resourceName: businessName || personName,
              }}
            />
            <OpenClientSmsButton contact={primaryContact} />
            <Button asChild variant="outline" size="sm">
              <Link to={getClientEditPath(record.id)}>Edit</Link>
            </Button>
            <Button asChild size="sm">
              <Link
                to={getClientDealCreatePath(
                  record.id,
                  record.primary_contact_id,
                )}
              >
                <Plus className="size-4" />
                New deal
              </Link>
            </Button>
            <ClientNewMenu
              companyId={record.id}
              primaryContactId={record.primary_contact_id}
              primaryContact={primaryContact}
              onAddContact={onAddContact}
              size="icon"
            />
            <RecordContextProvider value={record}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash className="size-4" />
                    Delete client
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </RecordContextProvider>
          </div>
        </div>
      </div>

      <Confirm
        isOpen={deleteOpen}
        title="Delete this client?"
        content="This removes the client company record. Linked contacts and projects may remain in the system."
        confirm="Delete"
        confirmColor="warning"
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
        loading={isDeleting}
      />
    </>
  );
};
