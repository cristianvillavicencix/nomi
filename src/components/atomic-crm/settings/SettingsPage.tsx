import { RotateCcw, Save } from "lucide-react";
import type { RaRecord } from "ra-core";
import { EditBase, Form, useGetList, useInput, useNotify } from "ra-core";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { isTenantBrandingEditorVisible } from "./tenantBrandingFlags";
import { useSearchParams } from "react-router";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toSlug } from "@/lib/toSlug";
import { ArrayInput } from "@/components/admin/array-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

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

const SETTINGS_TAB_IDS = [
  "general",
  "users",
  "payments",
  "projects",
  "notes",
  "tasks",
] as const;
type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "users", label: "Users & roles" },
  { id: "payments", label: "Payments" },
  { id: "projects", label: "Projects" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
];

const isSettingsTabId = (value: string | null): value is SettingsTabId =>
  value != null && (SETTINGS_TAB_IDS as readonly string[]).includes(value);

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
      companyWebsite: typeof data.companyWebsite === "string" ? data.companyWebsite.trim() : "",
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
            pipelineId:
              pipeline.id || `pipeline-${pipelineIndex + 1}`,
          }),
        ),
      }),
    ),
      dealStages: ensureValues(data.dealStages),
      dealPipelineStatuses: data.dealPipelineStatuses,
      noteStatuses: ensureValues(data.noteStatuses),
      payrollSettings: {
        overtimeEnabledGlobally: Boolean(
          data.payrollSettings?.overtimeEnabledGlobally ?? true,
        ),
        overtimeWeeklyThreshold: Number(
          data.payrollSettings?.overtimeWeeklyThreshold ?? 40,
        ),
        defaultOvertimeMultiplier: Number(
          data.payrollSettings?.defaultOvertimeMultiplier ?? 1.5,
        ),
        defaultHoursPerWeekReference: Number(
          data.payrollSettings?.defaultHoursPerWeekReference ?? 40,
        ),
        lunchAutoSuggestHours: Number(
          data.payrollSettings?.lunchAutoSuggestHours ?? 6,
        ),
        lunchAutoSuggestMinutes: Number(
          data.payrollSettings?.lunchAutoSuggestMinutes ?? 30,
        ),
        usFederalHolidaysEnabled: Boolean(
          data.payrollSettings?.usFederalHolidaysEnabled ?? true,
        ),
        customHolidays: data.payrollSettings?.customHolidays ?? [],
        defaultPaySchedule: data.payrollSettings?.defaultPaySchedule ?? "biweekly",
        companyPaySchedule:
          data.payrollSettings?.companyPaySchedule ??
          data.payrollSettings?.defaultPaySchedule ??
          "biweekly",
        defaultPaymentMethod:
          data.payrollSettings?.defaultPaymentMethod ?? "bank_deposit",
        weeklyPayday: data.payrollSettings?.weeklyPayday ?? "Friday",
        biweeklyAnchorDate:
          data.payrollSettings?.biweeklyAnchorDate ?? "2026-01-02",
        monthlyPayRule: data.payrollSettings?.monthlyPayRule ?? "end_of_month",
        monthlyDayOfMonth: Number(data.payrollSettings?.monthlyDayOfMonth ?? 30),
        payday: data.payrollSettings?.payday ?? "Friday",
        payPeriodStartDay: Number(data.payrollSettings?.payPeriodStartDay ?? 1),
        payPeriodEndDay: Number(data.payrollSettings?.payPeriodEndDay ?? 14),
      },
    } as ConfigurationContextValue,
  };
};

const SettingsPageContent = () => {
  const currentConfig = useConfigurationContext();
  const updateConfiguration = useConfigurationUpdater();
  const notify = useNotify();
  const transform = useCallback(
    (data: Record<string, any>) => transformFormValues(data, currentConfig),
    [currentConfig],
  );

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={transform}
      mutationOptions={{
        onSuccess: (data: any) => {
          updateConfiguration(data.config);
          notify("Configuration saved successfully");
        },
        onError: () => {
          notify("Failed to save configuration", { type: "error" });
        },
      }}
    >
      <SettingsForm />
    </EditBase>
  );
};

export const SettingsPage = () => <SettingsPageContent />;

SettingsPage.path = "/settings";

const SettingsForm = () => {
  const config = useConfigurationContext();

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
      payrollSettings: config.payrollSettings,
    }),
    [config],
  );

  return (
    <Form defaultValues={defaultValues}>
      <SettingsFormFields />
    </Form>
  );
};

const SettingsFormFields = () => {
  const config = useConfigurationContext();
  const {
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useFormContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const dealPipelines: DealPipeline[] = watch("dealPipelines") ?? [];

  const tabParam = searchParams.get("tab");
  const normalizedTab = tabParam === "plans" ? "users" : tabParam;
  const activeTab: SettingsTabId = isSettingsTabId(normalizedTab) ? normalizedTab : "general";

  const setSettingsTab = useCallback(
    (id: SettingsTabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", id);
          next.delete("section");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useLayoutEffect(() => {
    if (searchParams.get("tab") !== "plans") return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "users");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useLayoutEffect(() => {
    const section = searchParams.get("section");
    if (section == null) return;
    if (section !== "users" && section !== "general") return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", section === "users" ? "users" : "general");
        next.delete("section");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) => {
      if (!categories) return undefined;

      const normalized = categories.map((item) => item.value || toSlug(item.label));
      const duplicateValues = normalized.filter((value, index) => normalized.indexOf(value) !== index);
      if (duplicateValues.length > 0) {
        return `Duplicate categories: ${[...new Set(duplicateValues)].join(", ")}`;
      }

      const initialValues = new Set(
        (config.dealCategories ?? []).map((item) => item.value || toSlug(item.label)),
      );
      const currentValues = new Set(normalized);
      const removedInitialValues = [...initialValues].filter((value) => !currentValues.has(value));

      // Allow saving unrelated sections (e.g. Branding) when categories haven't been removed.
      if (removedInitialValues.length === 0) return undefined;

      return validateItemsInUse(categories, deals, "category", "categories");
    },
    [config.dealCategories, deals],
  );

  return (
    <div className="w-full min-w-0 mt-1 pb-28">
      <h1 className="text-2xl font-semibold tracking-tight mb-5">Settings</h1>
      <nav
        className="flex flex-wrap gap-2 mb-8 border-b border-border/50 pb-4"
        aria-label="Settings sections"
        role="tablist"
      >
        {SETTINGS_TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            role="tab"
            variant={activeTab === t.id ? "default" : "secondary"}
            size="sm"
            aria-selected={activeTab === t.id}
            onClick={() => setSettingsTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {activeTab === "general" ? <SettingsGeneralTab /> : null}
      {activeTab === "users" ? <UsersSettingsSection /> : null}
      {activeTab === "payments" ? (
        <div className="space-y-8 max-w-6xl">
            <h2 className="text-sm font-medium text-muted-foreground">Pay schedule &amp; methods</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectInput
                source="payrollSettings.companyPaySchedule"
                choices={[
                  { id: "weekly", name: "Weekly" },
                  { id: "biweekly", name: "Biweekly" },
                  { id: "semimonthly", name: "Semi-monthly" },
                  { id: "monthly", name: "Monthly" },
                ]}
                label="Payroll frequency"
              />
              <SelectInput
                source="payrollSettings.defaultPaymentMethod"
                choices={[
                  { id: "cash", name: "Cash" },
                  { id: "check", name: "Check" },
                  { id: "zelle", name: "Zelle" },
                  { id: "bank_deposit", name: "Bank deposit" },
                ]}
                label="Default payment method"
              />
            </div>
            <h2 className="text-sm font-medium text-muted-foreground">Pay timing</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextInput source="payrollSettings.weeklyPayday" label="Weekly payday" />
              <TextInput source="payrollSettings.biweeklyAnchorDate" label="Biweekly anchor (YYYY-MM-DD)" />
              <SelectInput
                source="payrollSettings.monthlyPayRule"
                label="Monthly rule"
                choices={[
                  { id: "end_of_month", name: "End of month" },
                  { id: "day_of_month", name: "Day of month" },
                ]}
              />
              <NumberInput source="payrollSettings.monthlyDayOfMonth" label="Monthly day" />
              <NumberInput source="payrollSettings.payPeriodStartDay" label="Period start day" />
              <NumberInput source="payrollSettings.payPeriodEndDay" label="Period end day" />
              <TextInput source="payrollSettings.payday" label="Payday (legacy label)" />
            </div>
            <h2 className="text-sm font-medium text-muted-foreground">Overtime</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <BooleanInput source="payrollSettings.overtimeEnabledGlobally" label="Overtime on" />
              <NumberInput source="payrollSettings.overtimeWeeklyThreshold" label="Weekly OT threshold" />
              <NumberInput source="payrollSettings.defaultOvertimeMultiplier" label="OT multiplier" />
              <NumberInput
                source="payrollSettings.defaultHoursPerWeekReference"
                label="Default hours / week"
              />
            </div>
            <h2 className="text-sm font-medium text-muted-foreground">Time entry</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberInput source="payrollSettings.lunchAutoSuggestHours" label="Lunch after (h)" />
              <NumberInput source="payrollSettings.lunchAutoSuggestMinutes" label="Lunch (min)" />
              <BooleanInput source="payrollSettings.usFederalHolidaysEnabled" label="US federal holidays" />
            </div>
            <h2 className="text-sm font-medium text-muted-foreground">Holidays</h2>
            <ArrayInput source="payrollSettings.customHolidays" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering>
                <TextInput source="date" label="Date (YYYY-MM-DD)" />
                <TextInput source="label" label="Label" />
              </SimpleFormIterator>
            </ArrayInput>
        </div>
      ) : null}
      {activeTab === "projects" ? (
        <div className="space-y-6 max-w-6xl">
            <PipelinesEditor
              pipelines={dealPipelines}
              onChange={(pipelines) => setValue("dealPipelines", pipelines)}
              deals={deals}
            />
            <Separator />
            <h2 className="text-sm font-medium text-muted-foreground">Categories</h2>
            <ArrayInput
              source="dealCategories"
              label={false}
              helperText={false}
              validate={validateDealCategories}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
        </div>
      ) : null}
      {activeTab === "notes" ? (
        <div className="space-y-4 max-w-4xl">
            <h2 className="text-sm font-medium text-muted-foreground">Note statuses</h2>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
        </div>
      ) : null}
      {activeTab === "tasks" ? (
        <div className="space-y-4 max-w-4xl">
            <h2 className="text-sm font-medium text-muted-foreground">Task types</h2>
            <ArrayInput source="taskTypes" label={false} helperText={false}>
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex w-full min-w-0 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
};

const PipelinesEditor = ({
  pipelines,
  onChange,
  deals,
}: {
  pipelines: DealPipeline[];
  onChange: (pipelines: DealPipeline[]) => void;
  deals?: RaRecord[];
}) => {
  const [selectedPipelineId, setSelectedPipelineId] = useState(
    () => pipelines[0]?.id ?? "default",
  );
  const selectedPipeline =
    pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ??
    pipelines[0];

  const replacePipeline = (nextPipeline: DealPipeline) => {
    onChange(
      pipelines.map((pipeline) =>
        pipeline.id === nextPipeline.id ? nextPipeline : pipeline,
      ),
    );
  };

  const addPipeline = () => {
    const id = `pipeline-${Date.now()}`;
    const nextPipeline: DealPipeline = {
      id,
      label: "New Pipeline",
      order: pipelines.length + 1,
      stages: [
        {
          id: "new",
          label: "New",
          color: "#64748b",
          order: 1,
          pipelineId: id,
          isDefault: true,
        },
      ],
      isDefault: pipelines.length === 0,
    };
    onChange([...pipelines, nextPipeline]);
    setSelectedPipelineId(id);
  };

  const deletePipeline = () => {
    if (!selectedPipeline) return;
    if (pipelines.length <= 1) return;
    const next = pipelines.filter((pipeline) => pipeline.id !== selectedPipeline.id);
    onChange(next);
    setSelectedPipelineId(next[0].id);
  };

  const movePipeline = (direction: "up" | "down") => {
    if (!selectedPipeline) return;
    const index = pipelines.findIndex((pipeline) => pipeline.id === selectedPipeline.id);
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= pipelines.length) return;
    const reordered = [...pipelines];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    onChange(
      reordered.map((pipeline, orderIndex) => ({
        ...pipeline,
        order: orderIndex + 1,
        isDefault: orderIndex === 0 ? true : pipeline.isDefault,
      })),
    );
  };

  const addStage = () => {
    if (!selectedPipeline) return;
    const nextStage: DealPipelineStage = {
      id: `stage-${Date.now()}`,
      label: "New Stage",
      color: "#64748b",
      order: selectedPipeline.stages.length + 1,
      pipelineId: selectedPipeline.id,
    };
    replacePipeline({
      ...selectedPipeline,
      stages: [...selectedPipeline.stages, nextStage],
    });
  };

  const updateStage = (stageId: string, patch: Partial<DealPipelineStage>) => {
    if (!selectedPipeline) return;
    replacePipeline({
      ...selectedPipeline,
      stages: selectedPipeline.stages.map((stage) =>
        stage.id === stageId ? { ...stage, ...patch } : stage,
      ),
    });
  };

  const swapStage = (fromIndex: number, toIndex: number) => {
    if (!selectedPipeline) return;
    if (toIndex < 0 || toIndex >= selectedPipeline.stages.length) return;
    const stages = [...selectedPipeline.stages];
    const [moved] = stages.splice(fromIndex, 1);
    stages.splice(toIndex, 0, moved);
    replacePipeline({
      ...selectedPipeline,
      stages: stages.map((stage, index) => ({ ...stage, order: index + 1 })),
    });
  };

  const removeStage = (stage: DealPipelineStage) => {
    if (!selectedPipeline) return;
    const stageInUse =
      deals?.some(
        (deal) =>
          (deal.pipeline_id || selectedPipeline.id) === selectedPipeline.id &&
          deal.stage === stage.id,
      ) ?? false;
    if (stageInUse) {
      window.alert(
        "This stage is currently used by projects. Reassign those projects before deleting it.",
      );
      return;
    }
    replacePipeline({
      ...selectedPipeline,
      stages: selectedPipeline.stages
        .filter((item) => item.id !== stage.id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-medium text-muted-foreground">Pipelines</h3>
        <Button type="button" size="sm" variant="outline" onClick={addPipeline}>
          Add Pipeline
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={deletePipeline}
          disabled={pipelines.length <= 1}
        >
          Delete Pipeline
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => movePipeline("up")}
          disabled={
            pipelines.findIndex((pipeline) => pipeline.id === selectedPipeline?.id) <= 0
          }
        >
          Move Up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => movePipeline("down")}
          disabled={
            pipelines.findIndex((pipeline) => pipeline.id === selectedPipeline?.id) >=
            pipelines.length - 1
          }
        >
          Move Down
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPipeline?.id}
          onChange={(event) => setSelectedPipelineId(event.target.value)}
        >
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.label}
            </option>
          ))}
        </select>
        <input
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPipeline?.label ?? ""}
          onChange={(event) =>
            selectedPipeline &&
            replacePipeline({ ...selectedPipeline, label: event.target.value })
          }
          placeholder="Pipeline name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">Stages</h4>
          <Button type="button" size="sm" variant="outline" onClick={addStage}>
            Add Stage
          </Button>
        </div>
        {(selectedPipeline?.stages ?? []).map((stage, index) => (
          <div
            key={stage.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
          >
            <input
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={stage.label}
              onChange={(event) =>
                updateStage(stage.id, {
                  label: event.target.value,
                  id: toSlug(event.target.value || stage.id),
                })
              }
              placeholder="Stage label"
            />
            <input
              type="color"
              value={stage.color || "#64748b"}
              onChange={(event) => updateStage(stage.id, { color: event.target.value })}
              className="h-9 w-10 rounded-md border border-input bg-background p-1"
            />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => swapStage(index, index - 1)}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => swapStage(index, index + 1)}
                disabled={index === (selectedPipeline?.stages.length ?? 0) - 1}
              >
                ↓
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => removeStage(stage)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

/** A minimal color picker input compatible with ra-core's useInput. */
const ColorInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return (
    <input
      type="color"
      {...field}
      value={field.value || "#000000"}
      className="w-9 h-9 shrink-0 cursor-pointer appearance-none rounded border bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:cursor-pointer [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:cursor-pointer [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none"
    />
  );
};
