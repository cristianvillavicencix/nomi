import { useMemo, type ReactNode } from "react";
import { Globe } from "lucide-react";
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
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { getCompanyFaviconSources } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import { FaviconAvatarImage } from "@/components/ui/FaviconAvatarImage";
import { AvatarFallback, Avatar as UiAvatar } from "@/components/ui/avatar";
import { OrganizationMemberName } from "@/components/atomic-crm/organizationMembers/OrganizationMemberName";
import type {
  Company,
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  collectBusinessSocialLinks,
  collectPrimaryContactSocialLinks,
  getPrimaryContactFullName,
  type CompanyWithPrimaryContact,
} from "@/modules/clients/clientProfile";
import {
  resolveCompanyEmailForDisplay,
  resolveCompanyPhoneRaw,
} from "@/modules/clients/companyChannelResolvers";
import { ClientQuickActions } from "@/modules/clients/ClientQuickActions";
import {
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/modules/clients/clientSocialLinks";
import {
  getServiceTypeBadgeLabels,
  type ClientServiceType,
} from "@/modules/clients/clientServiceType";
import { getContactFullName } from "@/modules/clients/clientShowUtils";
import { OpenMailComposeLink } from "@/modules/mail/OpenMailComposeLink";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";
import { getClientShowPath, getPersonShowPath } from "@/app/routing";
import {
  EntityIdentityHeader,
  EntityMetaItem,
  formatCompanyLocation,
} from "@/modules/shared/profile";

type ClientSummaryCardProps = {
  record: CompanyWithPrimaryContact;
  serviceType?: ClientServiceType | null;
  onOpenPrimaryContact?: () => void;
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
      <IconButton
        aria-label={label}
        asChild
        variant="secondary"
        className="shrink-0 rounded-full"
      >
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

  const { data: referrerContact } = useGetOne<Contact>(
    "contacts",
    { id: primaryContact?.referred_by_contact_id! },
    { enabled: primaryContact?.referred_by_contact_id != null },
  );

  const { data: referrerCompany } = useGetOne<Company>(
    "companies",
    { id: primaryContact?.referred_by_company_id! },
    {
      enabled:
        primaryContact?.referred_by_company_id != null &&
        primaryContact?.referred_by_contact_id == null,
    },
  );

  const { data: owner } = useGetOne<OrganizationMember>(
    "organization_members",
    { id: record.organization_member_id! },
    { enabled: record.organization_member_id != null },
  );

  const sectorLabel = useMemo(() => {
    if (!record.sector) return null;
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
  const phone = resolveCompanyPhoneRaw(record);
  const email = resolveCompanyEmailForDisplay(record);

  const serviceTypeLabels = useMemo(
    () => getServiceTypeBadgeLabels(serviceType),
    [serviceType],
  );

  const referredByNode = (() => {
    if (referrerContact) {
      return (
        <span>
          Referred by{" "}
          <Link
            to={getPersonShowPath(referrerContact)}
            className="link-action font-medium text-foreground"
          >
            {getContactFullName(referrerContact)}
          </Link>
        </span>
      );
    }
    if (referrerCompany) {
      return (
        <span>
          Referred by{" "}
          <Link
            to={getClientShowPath(referrerCompany.id)}
            className="link-action font-medium text-foreground"
          >
            {referrerCompany.name?.trim() || "Account"}
          </Link>
        </span>
      );
    }
    return null;
  })();

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
        <div className="space-y-1">
          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 link-action"
            >
              <Globe className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{website}</span>
            </a>
          ) : (
            <span>No website</span>
          )}
          {referredByNode}
        </div>
      }
      actions={
        <ClientQuickActions
          record={record}
          primaryContactId={record.primary_contact_id}
          presentation="strip"
        />
      }
    >
      <div className="space-y-3 border-t border-border/60 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <EntityMetaItem label="Phone">
            {phone ? (
              <CrmPhoneLink
                phone={phone}
                contactId={record.primary_contact_id}
                className="link-action"
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </EntityMetaItem>
          <EntityMetaItem label="Email">
            {email && email !== "—" ? (
              <OpenMailComposeLink
                to={email}
                companyId={record.id}
                contactId={record.primary_contact_id ?? undefined}
                className="link-action truncate"
              >
                {email}
              </OpenMailComposeLink>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </EntityMetaItem>
          {locationLabel && locationLabel !== "—" ? (
            <EntityMetaItem
              label="Location"
              valueClassName="whitespace-normal break-words"
            >
              <span className="line-clamp-2 font-normal text-muted-foreground">
                {locationLabel}
              </span>
            </EntityMetaItem>
          ) : null}
          {sectorLabel ? (
            <EntityMetaItem label="Sector">{sectorLabel}</EntityMetaItem>
          ) : null}
          <EntityMetaItem label="Owner">
            {owner ? <OrganizationMemberName member={owner} /> : "—"}
          </EntityMetaItem>
        </div>
      </div>

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
