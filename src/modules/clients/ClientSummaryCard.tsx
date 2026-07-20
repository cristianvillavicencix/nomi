import { useMemo, type ReactNode } from "react";
import { useGetOne } from "ra-core";
import { Badge } from "@/components/ui/badge";

import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { getCompanyFaviconSources } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import { FaviconAvatarImage } from "@/components/ui/FaviconAvatarImage";
import { AvatarFallback, Avatar as UiAvatar } from "@/components/ui/avatar";
import { OrganizationMemberName } from "@/components/atomic-crm/organizationMembers/OrganizationMemberName";
import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  collectBusinessSocialLinks,
  collectPrimaryContactSocialLinks,
  getPrimaryContactFullName,
  getPrimaryContactPhoneRaw,
  type CompanyWithPrimaryContact,
} from "@/modules/clients/clientProfile";
import { CrmPhoneDisplay } from "@/modules/voice/CrmPhoneDisplay";
import { ClientQuickActions } from "@/modules/clients/ClientQuickActions";
import {
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/modules/clients/clientSocialLinks";
import {
  CLIENT_SERVICE_TYPE_LABELS,
  type ClientServiceType,
} from "@/modules/clients/clientServiceType";
import {
  EntityIdentityHeader,
  EntityMetaItem,
  EntityMetaRow,
  formatCompanyLocation,
} from "@/modules/shared/profile";

type ClientSummaryCardProps = {
  record: CompanyWithPrimaryContact;
  serviceType?: ClientServiceType | null;
  onOpenPrimaryContact?: () => void;
};

const getServiceTypeBadgeLabels = (
  serviceType: ClientServiceType | null | undefined,
): string[] => {
  if (!serviceType) return [];
  if (serviceType === "both") {
    return [
      CLIENT_SERVICE_TYPE_LABELS.website,
      CLIENT_SERVICE_TYPE_LABELS.xactimate,
    ];
  }
  return [CLIENT_SERVICE_TYPE_LABELS[serviceType]];
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

const dedupeSocialLinks = (links: ClientSocialLinkValue[]) => {
  const seen = new Set<string>();
  return links.filter((link) => {
    const url = normalizeSocialUrl(link.url).toLowerCase();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

export const ClientSummaryCard = ({
  record,
  serviceType,
  onOpenPrimaryContact,
}: ClientSummaryCardProps) => {
  const { companySectors } = useConfigurationContext();
  const businessName = record.name?.trim() || "—";
  const faviconSources = getCompanyFaviconSources(record);
  const website = record.website?.trim();
  const websiteHref = website
    ? website.startsWith("http")
      ? website
      : `https://${website}`
    : null;

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: record.primary_contact_id! },
    { enabled: !!record.primary_contact_id },
  );

  const { data: owner } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: record.organization_member_id! },
    { enabled: record.organization_member_id != null },
  );

  const sectorLabel = useMemo(() => {
    if (!record.sector) return "—";
    return (
      companySectors.find((entry) => entry.value === record.sector)?.label ??
      record.sector
    );
  }, [companySectors, record.sector]);

  const socialLinks = useMemo(
    () =>
      dedupeSocialLinks([
        ...collectBusinessSocialLinks(record),
        ...collectPrimaryContactSocialLinks(record, primaryContact),
      ]),
    [record, primaryContact],
  );

  const websiteKey = websiteHref
    ? normalizeSocialUrl(websiteHref).toLowerCase()
    : "";
  const socialOnlyLinks = socialLinks.filter(
    (link) => normalizeSocialUrl(link.url).toLowerCase() !== websiteKey,
  );

  const primaryName = getPrimaryContactFullName(record);
  const contactTitle = primaryContact?.title?.trim();
  const canOpenPrimary = Boolean(
    onOpenPrimaryContact && record.primary_contact_id,
  );
  const locationLabel = formatCompanyLocation(record);

  const serviceTypeLabels = useMemo(
    () => getServiceTypeBadgeLabels(serviceType),
    [serviceType],
  );

  return (
    <EntityIdentityHeader
      tone="sky"
      avatar={
        <UiAvatar className="size-16 shrink-0">
          <FaviconAvatarImage
            sources={faviconSources}
            alt={businessName}
            className="object-contain"
          />
          <AvatarFallback className="text-base">
            {getCompanyAvatarFallback({
              name: businessName !== "—" ? businessName : undefined,
            })}
          </AvatarFallback>
        </UiAvatar>
      }
      title={businessName}
      badges={
        <>
          {record.is_client ? (
            <Badge variant="default" className="text-xs">
              Client
            </Badge>
          ) : null}
          {serviceTypeLabels.map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </>
      }
      subtitle={
        websiteHref ? (
          <a
            href={websiteHref}
            target="_blank"
            rel="noreferrer"
            className="link-action inline-block max-w-full truncate"
          >
            {website}
          </a>
        ) : (
          <span>No website</span>
        )
      }
      actions={
        <ClientQuickActions
          record={record}
          primaryContactId={record.primary_contact_id}
        />
      }
    >
      <EntityMetaRow columnsClassName="sm:grid-cols-2 lg:grid-cols-[minmax(7rem,1.1fr)_minmax(4.5rem,0.65fr)_minmax(12rem,2.4fr)_minmax(7rem,0.95fr)_minmax(5rem,0.8fr)]">
        <EntityMetaItem label="Primary contact">
          {canOpenPrimary ? (
            <button
              type="button"
              className="link-action truncate text-left"
              onClick={onOpenPrimaryContact}
            >
              {primaryName}
              {contactTitle ? (
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  {contactTitle}
                </span>
              ) : null}
            </button>
          ) : (
            primaryName
          )}
        </EntityMetaItem>
        <EntityMetaItem label="Owner">
          {owner ? <OrganizationMemberName member={owner} /> : "—"}
        </EntityMetaItem>
        <EntityMetaItem
          label="Location"
          valueClassName="whitespace-normal break-words"
        >
          {locationLabel}
        </EntityMetaItem>
        <EntityMetaItem label="Phone">
          <CrmPhoneDisplay
            phone={getPrimaryContactPhoneRaw(record)}
            contactId={record.primary_contact_id}
          />
        </EntityMetaItem>
        <EntityMetaItem label="Sector">{sectorLabel}</EntityMetaItem>
      </EntityMetaRow>

      {socialOnlyLinks.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3">
          <TooltipProvider delayDuration={200}>
            {socialOnlyLinks.map((link) => {
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
