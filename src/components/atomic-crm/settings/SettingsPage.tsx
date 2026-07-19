import { RotateCcw, Save } from "lucide-react";
import type { RaRecord } from "ra-core";
import {
  EditBase,
  Form,
  useDataProvider,
  useNotify,
} from "ra-core";
import { useCallback, useLayoutEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isTenantBrandingEditorVisible } from "./tenantBrandingFlags";
import { useSearchParams } from "react-router";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { toSlug } from "@/lib/toSlug";

import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import {
  defaultCompanySectors,
  defaultConfiguration,
  primaryBusinessSectorUnsetToken,
} from "../root/defaultConfiguration";
import type { DealPipeline, DealPipelineStage } from "../types";
import { SettingsGeneralTab } from "./SettingsGeneralTab";
import { UsersSettingsSection } from "./UsersSettingsSection";
import { ConnectorsSettingsSection } from "@/modules/settings/ConnectorsSettingsSection";
import { DataImportSection } from "@/modules/settings/DataImportSection";
import { BillingSettingsSection } from "@/modules/settings/BillingSettingsSection";
import { CommunicationsSettingsSection } from "@/modules/settings/CommunicationsSettingsSection";
import { ProductsSettingsSection } from "@/modules/settings/ProductsSettingsSection";
import { ProposalsSettingsSection } from "@/modules/settings/ProposalsSettingsSection";
import { FormsSettingsSection } from "@/modules/settings/FormsSettingsSection";
import { NotificationsSettingsSection } from "@/modules/settings/NotificationsSettingsSection";
import { SettingsHubLayout } from "@/modules/settings/SettingsHubLayout";
import { WorkflowsSettingsSection } from "@/modules/settings/WorkflowsSettingsSection";
import { TicketsSettingsSection } from "@/modules/settings/TicketsSettingsSection";
import {
  buildSettingsSearchParams,
  getSettingsTabLabel,
  resolveSettingsRoute,
  type CompanySectionId,
  type CommunicationsSectionId,
  type ConnectorsSectionId,
  type DataSectionId,
  type FormsSectionId,
  type NotificationsSectionId,
  type SettingsTabId,
  type TicketsSectionId,
  type WorkflowsSectionId,
} from "@/modules/settings/settingsNavigation";
import { useLbsPipelineConfig } from "@/modules/deals/useLbsPipelineConfig";

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (items: { value?: string; label: string }[] | undefined) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

/**
 * Validate that no items were removed if they are still referenced by existing deals.
 * Also rejects duplicate slug values.
 * Returns undefined if valid, or an error message string.
 */
export const validateItemsInUse = (
  items: { value: string; label: string }[] | undefined,
  deals: RaRecord[] | undefined,
  fieldName: string,
  displayName: string,
) => {
  if (!items) return undefined;
  // Check for duplicate slugs
  const slugs = items.map((i) => i.value || toSlug(i.label));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  if (duplicates.size > 0) {
    return `Duplicate ${displayName}: ${[...duplicates].join(", ")}`;
  }
  // Check that no in-use value was removed (skip if deals haven't loaded)
  if (!deals) return "Validating…";
  const values = new Set(slugs);
  const inUse = [
    ...new Set(
      deals
        .filter(
          (deal) => deal[fieldName] && !values.has(deal[fieldName] as string),
        )
        .map((deal) => deal[fieldName] as string),
    ),
  ];
  if (inUse.length > 0) {
    return `Cannot remove ${displayName} that are still used by projects: ${inUse.join(", ")}`;
  }
  return undefined;
};

const transformFormValues = (
  data: Record<string, any>,
  currentConfig: ConfigurationContextValue,
) => {
  const canEditBranding = isTenantBrandingEditorVisible();
  const title = canEditBranding ? data.title : currentConfig.title;
  const lightModeLogo = canEditBranding
    ? data.lightModeLogo
    : currentConfig.lightModeLogo;
  const darkModeLogo = canEditBranding
    ? data.darkModeLogo
    : currentConfig.darkModeLogo;

  return {
    config: {
      title,
      lightModeLogo,
      darkModeLogo,
      companyLegalName: data.companyLegalName,
      companyTaxId: data.companyTaxId,
      companyAddressLine1: data.companyAddressLine1,
      companyAddressLine2: data.companyAddressLine2,
      companyCity: data.companyCity,
      companyState: data.companyState,
      companyPostalCode: data.companyPostalCode,
      companyCountry: data.companyCountry,
      companyPhone: data.companyPhone,
      companyEmail: data.companyEmail,
      companyWebsite:
        typeof data.companyWebsite === "string"
          ? data.companyWebsite.trim()
          : "",
      companyRepresentativeName: data.companyRepresentativeName,
      companyRepresentativeTitle: data.companyRepresentativeTitle,
      primaryBusinessSector:
        typeof data.primaryBusinessSector === "string" &&
        data.primaryBusinessSector.length > 0 &&
        data.primaryBusinessSector !== primaryBusinessSectorUnsetToken
          ? data.primaryBusinessSector
          : "",
      companySectors: defaultCompanySectors,
      dealCategories: ensureValues(data.dealCategories),
      taskTypes: ensureValues(data.taskTypes),
      dealPipelines: (data.dealPipelines ?? []).map(
        (pipeline: DealPipeline, pipelineIndex: number) => ({
          ...pipeline,
          id: pipeline.id || `pipeline-${pipelineIndex + 1}`,
          order: pipeline.order ?? pipelineIndex + 1,
          stages: (pipeline.stages ?? []).map(
            (stage: DealPipelineStage, stageIndex: number) => ({
              ...stage,
              id: stage.id || toSlug(stage.label || `stage-${stageIndex + 1}`),
              label: stage.label || `Stage ${stageIndex + 1}`,
              color: stage.color || "#64748b",
              order: stage.order ?? stageIndex + 1,
              pipelineId: pipeline.id || `pipeline-${pipelineIndex + 1}`,
            }),
          ),
        }),
      ),
      dealStages: ensureValues(data.dealStages),
      dealPipelineStatuses: data.dealPipelineStatuses,
      noteStatuses: ensureValues(data.noteStatuses),
    } as ConfigurationContextValue,
  };
};

const SettingsPageContent = () => {
  const currentConfig = useConfigurationContext();
  const lbsConfig = useLbsPipelineConfig();
  const updateConfiguration = useConfigurationUpdater();
  const dataProvider = useDataProvider();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const transform = useCallback(
    (data: Record<string, any>) => transformFormValues(data, currentConfig),
    [currentConfig],
  );

  return (
    <div className="flex w-full min-w-0 flex-col">
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={transform}
      mutationOptions={{
        onSuccess: async (data: any) => {
          updateConfiguration(data.config);
          try {
            await dataProvider.syncOrganizationPipelineStages(
              data.config.dealPipelines ?? [],
            );
            await queryClient.invalidateQueries({
              queryKey: ["organization_pipeline_stages"],
            });
          } catch {
            notify("Settings saved, but pipeline stages failed to sync", {
              type: "warning",
            });
          }
          notify("Configuration saved successfully");
        },
        onError: () => {
          notify("Failed to save configuration", { type: "error" });
        },
      }}
    >
      <SettingsForm config={lbsConfig} />
    </EditBase>
    </div>
  );
};

export const SettingsPage = () => <SettingsPageContent />;

SettingsPage.path = "/settings";

const SettingsForm = ({ config }: { config: ConfigurationContextValue }) => {
  const defaultValues = useMemo(
    () => ({
      title: config.title,
      lightModeLogo: { src: config.lightModeLogo },
      darkModeLogo: { src: config.darkModeLogo },
      companyLegalName: config.companyLegalName,
      companyTaxId: config.companyTaxId,
      companyAddressLine1: config.companyAddressLine1,
      companyAddressLine2: config.companyAddressLine2,
      companyCity: config.companyCity,
      companyState: config.companyState,
      companyPostalCode: config.companyPostalCode,
      companyCountry: config.companyCountry,
      companyPhone: config.companyPhone,
      companyEmail: config.companyEmail,
      companyWebsite: config.companyWebsite,
      companyRepresentativeName: config.companyRepresentativeName,
      companyRepresentativeTitle: config.companyRepresentativeTitle,
      companySectors: defaultCompanySectors,
      primaryBusinessSector:
        config.primaryBusinessSector && config.primaryBusinessSector.length > 0
          ? config.primaryBusinessSector
          : primaryBusinessSectorUnsetToken,
      dealCategories: config.dealCategories,
      taskTypes: config.taskTypes,
      dealPipelines: config.dealPipelines,
      dealStages: config.dealStages,
      dealPipelineStatuses: config.dealPipelineStatuses,
      noteStatuses: config.noteStatuses,
    }),
    [config],
  );

  return (
    <Form className="flex w-full min-w-0 flex-col" defaultValues={defaultValues}>
      <SettingsFormFields />
    </Form>
  );
};

const SettingsFormFields = () => {
  const config = useConfigurationContext();
  const { reset, formState: { isSubmitting } } = useFormContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    tab: activeTab,
    workflowsSection,
    connectorsSection,
    communicationsSection,
    formsSection,
    notificationsSection,
    ticketsSection,
    dataSection,
    companySection,
  } = resolveSettingsRoute(searchParams);

  const setSettingsTab = useCallback(
    (id: SettingsTabId) => {
      setSearchParams(buildSettingsSearchParams(id), { replace: true });
    },
    [setSearchParams],
  );

  const setSettingsSection = useCallback(
    (tab: SettingsTabId, section: string) => {
      setSearchParams(buildSettingsSearchParams(tab, section), { replace: true });
    },
    [setSearchParams],
  );

  const setWorkflowsSection = useCallback(
    (section: WorkflowsSectionId) => {
      setSettingsSection("workflows", section);
    },
    [setSettingsSection],
  );

  const setConnectorsSection = useCallback(
    (section: ConnectorsSectionId) => {
      setSettingsSection("connectors", section);
    },
    [setSettingsSection],
  );

  const setCommunicationsSection = useCallback(
    (section: CommunicationsSectionId) => {
      setSettingsSection("communications", section);
    },
    [setSettingsSection],
  );

  const setFormsSection = useCallback(
    (section: FormsSectionId) => {
      setSettingsSection("forms", section);
    },
    [setSettingsSection],
  );

  const setNotificationsSection = useCallback(
    (section: NotificationsSectionId) => {
      setSettingsSection("notifications", section);
    },
    [setSettingsSection],
  );

  const setTicketsSection = useCallback(
    (section: TicketsSectionId) => {
      setSettingsSection("tickets", section);
    },
    [setSettingsSection],
  );

  const setDataSection = useCallback(
    (section: DataSectionId) => {
      setSettingsSection("data", section);
    },
    [setSettingsSection],
  );

  const setCompanySection = useCallback(
    (section: CompanySectionId) => {
      setSettingsSection("company", section);
    },
    [setSettingsSection],
  );

  useLayoutEffect(() => {
    const rawTab = searchParams.get("tab");
    if (!rawTab) return;

    const route = resolveSettingsRoute(searchParams);
    const legacyTabs = new Set([
      "general",
      "messaging",
      "projects",
      "notes",
      "tasks",
      "plans",
      "roles",
      "web-monitor",
      "commercial",
    ]);

    const sectionByTab: Partial<Record<SettingsTabId, string>> = {
      workflows: route.workflowsSection,
      connectors: route.connectorsSection,
      communications: route.communicationsSection,
      forms: route.formsSection,
      notifications: route.notificationsSection,
      tickets: route.ticketsSection,
      data: route.dataSection,
      company: route.companySection,
    };
    const section = sectionByTab[route.tab];
    const next = buildSettingsSearchParams(route.tab, section);
    const needsNormalize = next.toString() !== searchParams.toString();

    if (legacyTabs.has(rawTab) || needsNormalize) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const showConfigFooter =
    activeTab === "company" || activeTab === "workflows";

  const footer = showConfigFooter ? (
    <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          reset(
            isTenantBrandingEditorVisible()
              ? {
                  ...defaultConfiguration,
                  primaryBusinessSector: primaryBusinessSectorUnsetToken,
                  lightModeLogo: {
                    src: defaultConfiguration.lightModeLogo,
                  },
                  darkModeLogo: {
                    src: defaultConfiguration.darkModeLogo,
                  },
                }
              : {
                  ...defaultConfiguration,
                  primaryBusinessSector: primaryBusinessSectorUnsetToken,
                  title: config.title,
                  lightModeLogo: { src: config.lightModeLogo },
                  darkModeLogo: { src: config.darkModeLogo },
                },
          )
        }
      >
        <RotateCcw className="mr-1 h-4 w-4" />
        Reset to defaults
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-1 h-4 w-4" />
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  ) : undefined;

  return (
    <SettingsHubLayout
      activeTab={activeTab}
      onTabChange={setSettingsTab}
      title={getSettingsTabLabel(activeTab)}
      footer={footer}
    >
      {activeTab === "company" ? (
        <SettingsGeneralTab
          activeSection={companySection}
          onSectionChange={setCompanySection}
        />
      ) : null}
      {activeTab === "notifications" ? (
        <NotificationsSettingsSection
          activeSection={notificationsSection}
          onSectionChange={setNotificationsSection}
        />
      ) : null}
      {activeTab === "users" ? <UsersSettingsSection /> : null}
      {activeTab === "connectors" ? (
        <ConnectorsSettingsSection
          activeSection={connectorsSection}
          onSectionChange={setConnectorsSection}
        />
      ) : null}
      {activeTab === "forms" ? <FormsSettingsSection /> : null}
      {activeTab === "communications" ? (
        <CommunicationsSettingsSection
          activeSection={communicationsSection}
          onSectionChange={setCommunicationsSection}
        />
      ) : null}
      {activeTab === "tickets" ? (
        <TicketsSettingsSection
          activeSection={ticketsSection}
          onSectionChange={setTicketsSection}
        />
      ) : null}
      {activeTab === "products" ? <ProductsSettingsSection /> : null}
      {activeTab === "proposals" ? <ProposalsSettingsSection /> : null}
      {activeTab === "billing" ? <BillingSettingsSection /> : null}
      {activeTab === "data" ? (
        <DataImportSection
          activeSection={dataSection}
          onSectionChange={setDataSection}
        />
      ) : null}
      {activeTab === "workflows" ? (
        <WorkflowsSettingsSection
          activeSection={workflowsSection}
          onSectionChange={setWorkflowsSection}
        />
      ) : null}
    </SettingsHubLayout>
  );
};
