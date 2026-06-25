import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
import { useGetOne } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { getCompanyFaviconSources } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import { FaviconAvatarImage } from "@/components/ui/FaviconAvatarImage";
import {
  AvatarFallback,
  Avatar as UiAvatar,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  collectBusinessSocialLinks,
  collectPrimaryContactSocialLinks,
  getPrimaryContactFullName,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/modules/clients/clientProfile";
import { ClientQuickActions } from "@/modules/clients/ClientQuickActions";
import {
  getSocialLinkLabel,
  getSocialNetworkOption,
  normalizeSocialUrl,
  type ClientSocialLinkValue,
} from "@/modules/clients/clientSocialLinks";
import { formatDateTime } from "@/modules/clients/clientShowUtils";
import {
  CLIENT_SERVICE_TYPE_LABELS,
  type ClientServiceType,
} from "@/modules/clients/clientServiceType";

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

const ProfileSectionTitle = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {children}
  </p>
);

const ProfileFadeText = ({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "h1";
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="relative min-w-0">
      <Tag
        ref={contentRef as never}
        className={cn("truncate pr-6", className)}
      >
        {children}
      </Tag>
      {isOverflowing ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/80 to-transparent"
        />
      ) : null}
    </div>
  );
};

const ProfileFadeLink = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) => {
  const contentRef = useRef<HTMLButtonElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="relative min-w-0">
      <button
        ref={contentRef}
        type="button"
        className="link-action block w-full min-w-0 truncate pr-6 text-left font-medium"
        onClick={onClick}
      >
        {children}
      </button>
      {isOverflowing ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/80 to-transparent"
        />
      ) : null}
    </div>
  );
};

const ProfileInfoRow = ({
  label,
  value,
  fade = true,
}: {
  label: string;
  value: ReactNode;
  fade?: boolean;
}) => (
  <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-center gap-x-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <div className="min-w-0 font-medium">
      {fade ? (
        <ProfileFadeText className="font-medium">{value}</ProfileFadeText>
      ) : (
        value
      )}
    </div>
  </div>
);

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
      <Button
        asChild
        type="button"
        variant="outline"
        size="icon"
        className="size-9 shrink-0 rounded-full"
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
      </Button>
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
  const canOpenPrimary =
    Boolean(onOpenPrimaryContact && record.primary_contact_id);

  const serviceTypeLabels = useMemo(
    () => getServiceTypeBadgeLabels(serviceType),
    [serviceType],
  );

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-4 py-4">
        <div className="flex flex-col items-center text-center">
          <UiAvatar className="size-16">
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

          <div className="relative mt-3 w-full min-w-0 px-1">
            <ProfileFadeText as="h1" className="text-lg font-semibold leading-tight">
              {businessName}
            </ProfileFadeText>
          </div>

          {serviceTypeLabels.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-1">
              {serviceTypeLabels.map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          ) : null}

          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="link-action mt-2 inline-block max-w-full truncate px-1 text-sm"
            >
              {website}
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Sin sitio web</p>
          )}
        </div>

        <div className="mt-4">
          <ClientQuickActions
            record={record}
            primaryContactId={record.primary_contact_id}
          />
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <ProfileSectionTitle>Información clave</ProfileSectionTitle>
          <ProfileInfoRow
            label="Propietario"
            fade={!canOpenPrimary}
            value={
              canOpenPrimary ? (
                <ProfileFadeLink onClick={onOpenPrimaryContact!}>
                  {primaryName}
                </ProfileFadeLink>
              ) : (
                primaryName
              )
            }
          />
          {contactTitle ? (
            <ProfileInfoRow label="Cargo" value={contactTitle} />
          ) : null}
          <ProfileInfoRow label="Teléfono" value={getPrimaryContactPhone(record)} />
          <ProfileInfoRow label="Ciudad" value={record.city?.trim() || "—"} />
          <ProfileInfoRow label="Estado" value={record.state_abbr?.trim() || "—"} />
          <ProfileInfoRow label="País" value={record.country?.trim() || "—"} />
          <ProfileInfoRow label="Sector" value={sectorLabel} />
          <ProfileInfoRow
            label="Creada"
            value={formatDateTime(record.created_at)}
          />
        </div>

        <div className="mt-4 border-t border-border/60 pt-3">
          <ProfileSectionTitle>Redes sociales</ProfileSectionTitle>
          {websiteHref || socialOnlyLinks.length > 0 ? (
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap items-center gap-2">
                {websiteHref ? (
                  <ProfileIconLink
                    href={websiteHref}
                    label={website ?? "Sitio web"}
                  >
                    <Globe className="size-4" />
                  </ProfileIconLink>
                ) : null}
                {socialOnlyLinks.map((link) => {
                  const { Icon } = getSocialNetworkOption(link.network);
                  const label = getSocialLinkLabel(link);

                  return (
                    <ProfileIconLink
                      key={`${link.url}-${link.network ?? "other"}`}
                      href={normalizeSocialUrl(link.url)}
                      label={label}
                    >
                      <Icon className="size-4" />
                    </ProfileIconLink>
                  );
                })}
              </div>
            </TooltipProvider>
          ) : (
            <p className="text-sm text-muted-foreground">Sin redes registradas</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
