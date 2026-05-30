import { useMemo, type ReactNode } from "react";
import { useGetOne } from "ra-core";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCompanyAvatarFallback } from "@/components/atomic-crm/companies/CompanyAvatar";
import { getCompanyFaviconSrc } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";
import {
  AvatarFallback,
  AvatarImage,
  Avatar as UiAvatar,
} from "@/components/ui/avatar";
import type { Contact } from "@/components/atomic-crm/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  collectBusinessSocialLinks,
  formatCompanyAddress,
  getPrimaryContactFullName,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";

const ProfileField = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="space-y-1">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="font-medium">{value}</div>
  </div>
);

type ClientInformacionTabProps = {
  record: CompanyWithPrimaryContact;
  onOpenPrimaryContact?: () => void;
};

export const ClientInformacionTab = ({
  record,
  onOpenPrimaryContact,
}: ClientInformacionTabProps) => {
  const { companySectors } = useConfigurationContext();
  const sectorLabel = useMemo(() => {
    if (!record.sector) return "—";
    return (
      companySectors.find((entry) => entry.value === record.sector)?.label ??
      record.sector
    );
  }, [companySectors, record.sector]);

  const { data: primaryContact } = useGetOne<Contact>(
    "contacts",
    { id: record.primary_contact_id! },
    { enabled: !!record.primary_contact_id },
  );

  const businessSocialLinks = collectBusinessSocialLinks(record);
  const primaryName = getPrimaryContactFullName(record);
  const businessName = record.name?.trim() || "—";
  const faviconSrc = getCompanyFaviconSrc(record);

  return (
    <div className="space-y-4">
      <Card className="gap-0 py-0">
        <CardContent className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <UiAvatar className="size-10 shrink-0">
              {faviconSrc ? (
                <AvatarImage
                  src={faviconSrc}
                  alt={businessName}
                  className="object-contain"
                />
              ) : null}
              <AvatarFallback className="text-xs">
                {getCompanyAvatarFallback({
                  name: businessName !== "—" ? businessName : undefined,
                })}
              </AvatarFallback>
            </UiAvatar>
            <div className="min-w-0">
              <p className="font-semibold">{businessName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {record.website?.trim() || "Sin sitio web"}
              </p>
            </div>
          </div>
          {businessSocialLinks.length > 0 ? (
            <ClientSocialLinksDisplay links={businessSocialLinks} />
          ) : null}
        </CardContent>
      </Card>

      {record.description?.trim() ? (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="text-sm font-semibold">
              Descripción de la empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {record.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-sm font-semibold">
            Información de la empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <ProfileField
            label="Contacto principal / propietario"
            value={
              onOpenPrimaryContact && record.primary_contact_id ? (
                <button
                  type="button"
                  className="link-action text-left font-medium"
                  onClick={onOpenPrimaryContact}
                >
                  {primaryName}
                </button>
              ) : (
                primaryName
              )
            }
          />
          <ProfileField
            label="Dirección completa"
            value={formatCompanyAddress(record)}
          />
          <ProfileField label="Sector" value={sectorLabel} />
          <ProfileField
            label="País"
            value={record.country?.trim() || "—"}
          />
          <ProfileField
            label="Ciudad"
            value={record.city?.trim() || "—"}
          />
          <ProfileField
            label="Teléfono"
            value={record.phone_number?.trim() || "—"}
          />
          {primaryContact?.title?.trim() ? (
            <ProfileField label="Cargo" value={primaryContact.title} />
          ) : null}
          <ProfileField
            label="Redes sociales"
            value={
              businessSocialLinks.length > 0 ? (
                <ClientSocialLinksDisplay links={businessSocialLinks} />
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
};
