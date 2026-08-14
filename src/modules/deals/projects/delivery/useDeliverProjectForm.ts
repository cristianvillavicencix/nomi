import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useGetList } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  DEFAULT_INCLUDED_PAGES,
  DEFAULT_PORTAL_ENABLED_SECTIONS,
} from "@/modules/portal/portalTypes";
import { buildPortalHostingMetaPayload } from "@/modules/portal/portalDeliveryMeta";
import { parseDomainFromUrl } from "@/modules/portal/portalResourceUtils";
import { resolveProjectDeploymentUrls } from "@/modules/deals/projects/projectDeploymentUrls";
import type {
  DealAccessEntry,
  LbsDeal,
  ProjectDelivery,
} from "@/modules/types";

export type DeliverProjectManualOverride = {
  reason: string;
  force_approved_items: Array<{
    id?: number;
    label: string;
    category?: string | null;
  }>;
};

export type UseDeliverProjectFormOptions = {
  record: LbsDeal;
  enabled?: boolean;
  defaultMaintenanceMonths?: number;
  maintenanceReviewDate?: string;
  manualOverride?: DeliverProjectManualOverride;
};

export const useDeliverProjectForm = ({
  record,
  enabled = true,
  defaultMaintenanceMonths = 3,
  maintenanceReviewDate,
  manualOverride,
}: UseDeliverProjectFormOptions) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const brief =
    record.website_brief && typeof record.website_brief === "object"
      ? record.website_brief
      : {};

  const [siteUrl, setSiteUrl] = useState("");
  const [planName, setPlanName] = useState("");
  const [hostingRenewalDate, setHostingRenewalDate] = useState("");
  const [hostingProvider, setHostingProvider] = useState("");
  const [hostingPanelUrl, setHostingPanelUrl] = useState("");
  const [hostingLocation, setHostingLocation] = useState("");
  const [hostingManagedBy, setHostingManagedBy] = useState<"lbs" | "client">(
    "lbs",
  );
  const [includedPages, setIncludedPages] = useState<string[]>(
    DEFAULT_INCLUDED_PAGES,
  );
  const [maintenanceMonths, setMaintenanceMonths] = useState(
    String(defaultMaintenanceMonths),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyPortal, setNotifyPortal] = useState(true);
  const [shareCredentialIds, setShareCredentialIds] = useState<number[]>([]);
  const [domainName, setDomainName] = useState("");
  const [domainRegistrar, setDomainRegistrar] = useState("");
  const [domainRenewalDate, setDomainRenewalDate] = useState("");
  const [domainManagedBy, setDomainManagedBy] = useState<"lbs" | "client">(
    "lbs",
  );
  const [domainDnsServers, setDomainDnsServers] = useState("");
  const [corporateEmailsText, setCorporateEmailsText] = useState("");

  const { data: existingDeliveries = [] } = useGetList<ProjectDelivery>(
    "project_deliveries",
    {
      filter: { "deal_id@eq": record.id, "revoked_at@is": null },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "delivered_at", order: "DESC" },
    },
    { enabled: enabled && !!record.id },
  );

  const { data: credentials = [] } = useGetList<DealAccessEntry>(
    "deal_access_entries",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "portal_sort_order", order: "ASC" },
    },
    { enabled: enabled && !!record.id },
  );

  const credentialIdKey = useMemo(
    () => credentials.map((entry) => String(entry.id)).join(","),
    [credentials],
  );

  const wasEnabledRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }

    const isOpening = !wasEnabledRef.current;
    wasEnabledRef.current = true;

    if (!isOpening) return;

    const initialSiteUrl =
      resolveProjectDeploymentUrls(record).productionUrl ||
      String(record.production_url ?? "").trim();
    setSiteUrl(initialSiteUrl);
    setPlanName("");
    setHostingRenewalDate("");
    setHostingProvider("");
    setHostingPanelUrl("");
    setHostingLocation("");
    setHostingManagedBy("lbs");
    setIncludedPages(DEFAULT_INCLUDED_PAGES);
    setMaintenanceMonths(String(defaultMaintenanceMonths));
    setConfirmed(false);
    setNotifyEmail(true);
    setNotifyPortal(true);
    setDomainName(parseDomainFromUrl(initialSiteUrl));
    setDomainRegistrar("");
    setDomainRenewalDate("");
    setDomainManagedBy("lbs");
    setDomainDnsServers("");
    setCorporateEmailsText("");
  }, [defaultMaintenanceMonths, enabled, record.production_url]);

  useEffect(() => {
    if (!enabled || !credentialIdKey) return;
    setShareCredentialIds(credentialIdKey.split(",").map((id) => Number(id)));
  }, [credentialIdKey, enabled]);

  const deliverMutation = useMutation({
    mutationFn: () => {
      const corporateEmails = corporateEmailsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((email) => ({ email }));

      return dataProvider.deliverProject({
        deal_id: Number(record.id),
        site_url: siteUrl.trim(),
        plan_name: planName.trim() || undefined,
        project_start_date: record.created_at
          ? String(record.created_at).slice(0, 10)
          : undefined,
        hosting_renewal_date: hostingRenewalDate.trim() || undefined,
        hosting_info: buildPortalHostingMetaPayload({
          provider: hostingProvider,
          panel_url: hostingPanelUrl,
          managed_by: hostingManagedBy,
          location: hostingLocation,
        }),
        domain_info: {
          registrar: domainRegistrar.trim() || null,
        },
        enabled_sections: [...DEFAULT_PORTAL_ENABLED_SECTIONS],
        site_language: String(brief.site_language ?? "").trim() || undefined,
        included_pages: includedPages,
        maintenance_plan: {
          free_months: Number(maintenanceMonths) || 0,
          support_channels: ["whatsapp", "email"],
          next_review_date: maintenanceReviewDate?.trim() || undefined,
        },
        notify_email: notifyEmail,
        notify_portal: notifyPortal,
        share_credential_entry_ids: shareCredentialIds,
        domain: {
          domain: domainName.trim() || undefined,
          registrar: domainRegistrar.trim() || undefined,
          renewal_date: domainRenewalDate.trim() || undefined,
          managed_by: domainManagedBy,
          dns_servers: domainDnsServers
            .split(/[\n,]+/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        },
        corporate_emails: corporateEmails,
        checklist_snapshot: {
          logo_uploaded: true,
          backup_uploaded: false,
          tutorial_ready: false,
        },
        manual_override: manualOverride,
      });
    },
  });

  const togglePage = (page: string) => {
    setIncludedPages((current) =>
      current.includes(page)
        ? current.filter((entry) => entry !== page)
        : [...current, page],
    );
  };

  const toggleCredential = (entryId: number) => {
    setShareCredentialIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    );
  };

  const alreadyDelivered = Boolean(existingDeliveries[0]);
  const existingDelivery = existingDeliveries[0] ?? null;
  const canSubmit = confirmed && siteUrl.trim().length > 0 && !alreadyDelivered;

  const submitBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (alreadyDelivered) {
      blockers.push("This project was already delivered");
    }
    if (!siteUrl.trim()) {
      blockers.push("Live site URL is required");
    }
    if (!confirmed) {
      blockers.push('Check "I reviewed everything and it is ready to deliver"');
    }
    return blockers;
  }, [alreadyDelivered, confirmed, siteUrl]);

  return {
    siteUrl,
    setSiteUrl,
    planName,
    setPlanName,
    hostingRenewalDate,
    setHostingRenewalDate,
    hostingProvider,
    setHostingProvider,
    hostingPanelUrl,
    setHostingPanelUrl,
    hostingLocation,
    setHostingLocation,
    hostingManagedBy,
    setHostingManagedBy,
    includedPages,
    maintenanceMonths,
    setMaintenanceMonths,
    confirmed,
    setConfirmed,
    notifyEmail,
    setNotifyEmail,
    notifyPortal,
    setNotifyPortal,
    shareCredentialIds,
    domainName,
    setDomainName,
    domainRegistrar,
    setDomainRegistrar,
    domainRenewalDate,
    setDomainRenewalDate,
    domainManagedBy,
    setDomainManagedBy,
    domainDnsServers,
    setDomainDnsServers,
    corporateEmailsText,
    setCorporateEmailsText,
    credentials,
    alreadyDelivered,
    existingDelivery,
    canSubmit,
    submitBlockers,
    togglePage,
    toggleCredential,
    deliverMutation,
  };
};
