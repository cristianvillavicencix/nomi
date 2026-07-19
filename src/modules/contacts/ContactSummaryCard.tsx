import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { useGetOne } from "ra-core";
import { Badge } from "@/components/ui/badge";

import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { OrganizationMemberName } from "@/components/atomic-crm/organizationMembers/OrganizationMemberName";
import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { collectContactSocialLinks } from "@/modules/clients/clientSocialLinks";
import {
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/modules/clients/clientSocialLinks";
import {
  getContactEmail,
  getContactFullName,
  getContactPhoneRaw,
} from "@/modules/clients/clientShowUtils";
import { CrmPhoneDisplay } from "@/modules/voice/CrmPhoneDisplay";
import { ContactQuickActions } from "@/modules/contacts/ContactQuickActions";
import { getClientShowPath } from "@/app/routing";
import {
  EntityIdentityHeader,
  EntityMetaItem,
  EntityMetaRow,
} from "@/modules/shared/profile";

type ContactSummaryCardProps = {
  record: Contact;
  hideCompanyLink?: boolean;
};

const statusLabel = (status?: string | null) => {
  if (!status) return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
};

const ProfileIconLink = ({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <IconButton aria-label={label} asChild variant="secondary" className="shrink-0 rounded-full">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={label}
        >
          {children}
        </a>
      </IconButton>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const ContactSummaryCard = (props: ContactSummaryCardProps) => {
  const { record, hideCompanyLink = false } = props;
  const fullName = getContactFullName(record);
  const socialLinks = useMemo(
    () => collectContactSocialLinks(record),
    [record],
  );

  const { data: company } = useGetOne(
    "companies",
    { id: record.company_id! },
    { enabled: record.company_id != null },
  );

  const { data: owner } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: record.organization_member_id! },
    { enabled: record.organization_member_id != null },
  );

  const companyName = record.company_name?.trim() || company?.name?.trim();

  if (hideCompanyLink) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <Avatar record={record} width={48} height={48} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{fullName}</h1>
              <Badge variant="secondary">{statusLabel(record.status)}</Badge>
            </div>
            {record.title ? (
              <p className="truncate text-sm text-muted-foreground">
                {record.title}
              </p>
            ) : null}
            <ContactQuickActions
              contactId={record.id}
              contact={record}
              iconRow
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <EntityIdentityHeader
      tone="violet"
      avatar={<Avatar record={record} width={64} height={64} />}
      title={fullName}
      badges={<Badge variant="secondary">{statusLabel(record.status)}</Badge>}
      subtitle={
        <>
          {record.title?.trim() || "Contact"}
          {companyName ? (
            <>
              {" at "}
              {record.company_id ? (
                <Link
                  to={getClientShowPath(record.company_id)}
                  className="link-action font-medium text-foreground"
                >
                  {companyName}
                </Link>
              ) : (
                companyName
              )}
            </>
          ) : null}
        </>
      }
      actions={
        <ContactQuickActions contactId={record.id} contact={record} iconRow />
      }
    >
      <EntityMetaRow>
        <EntityMetaItem label="Owner">
          {owner ? <OrganizationMemberName member={owner} /> : "—"}
        </EntityMetaItem>
        <EntityMetaItem label="Company">
          {record.company_id && companyName ? (
            <Link
              to={getClientShowPath(record.company_id)}
              className="link-action"
            >
              {companyName}
            </Link>
          ) : (
            "—"
          )}
        </EntityMetaItem>
        <EntityMetaItem label="Phone">
          <CrmPhoneDisplay
            phone={getContactPhoneRaw(record)}
            contactId={record.id}
          />
        </EntityMetaItem>
        <EntityMetaItem label="Email">
          {getContactEmail(record) || "—"}
        </EntityMetaItem>
      </EntityMetaRow>

      {socialLinks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3">
          <TooltipProvider delayDuration={200}>
            {socialLinks.map((link: ClientSocialLinkValue) => {
              const { Icon } = getSocialNetworkOption(link.network);
              const label = getSocialLinkLabel(link);
              return (
                <ProfileIconLink
                  key={`${link.url}-${link.network ?? "other"}`}
                  href={normalizeSocialUrl(link.url)}
                  label={label}
                >
                  <Icon className="size-3.5" />
                </ProfileIconLink>
              );
            })}
          </TooltipProvider>
        </div>
      ) : null}
    </EntityIdentityHeader>
  );
};
