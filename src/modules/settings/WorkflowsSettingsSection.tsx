import { useCallback } from "react";
import type { RaRecord } from "ra-core";
import { useGetList, useInput } from "ra-core";
import { useFormContext } from "react-hook-form";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { toSlug } from "@/lib/toSlug";
import type { DealPipeline } from "@/components/atomic-crm/types";
import { validateItemsInUse } from "@/components/atomic-crm/settings/validateItemsInUse";
import { PipelinesEditor } from "@/modules/settings/workflows/PipelinesEditor";
import { InboundLeadAutomationPanel } from "@/modules/settings/leads/InboundLeadAutomationPanel";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import { SettingsTabPanel } from "@/modules/settings/SettingsTabPanel";
import type { WorkflowsSectionId } from "@/modules/settings/settingsNavigation";

const ColorInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return (
    <input
      type="color"
      {...field}
      value={field.value || "#000000"}
      className="h-9 w-9 shrink-0 cursor-pointer appearance-none rounded border bg-transparent p-0.5"
      aria-label="Color"
    />
  );
};

type Props = {
  activeSection: WorkflowsSectionId;
  onSectionChange: (section: WorkflowsSectionId) => void;
};

export const WorkflowsSettingsSection = ({
  activeSection,
  onSectionChange,
}: Props) => {
  const config = useConfigurationContext();
  const { watch, setValue } = useFormContext();
  const dealPipelines: DealPipeline[] = watch("dealPipelines") ?? [];

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) => {
      if (!categories) return undefined;

      const normalized = categories.map(
        (item) => item.value || toSlug(item.label),
      );
      const duplicateValues = normalized.filter(
        (value, index) => normalized.indexOf(value) !== index,
      );
      if (duplicateValues.length > 0) {
        return `Duplicate categories: ${[...new Set(duplicateValues)].join(", ")}`;
      }

      const initialValues = new Set(
        (config.dealCategories ?? []).map(
          (item) => item.value || toSlug(item.label),
        ),
      );
      const currentValues = new Set(normalized);
      const removedInitialValues = [...initialValues].filter(
        (value) => !currentValues.has(value),
      );

      if (removedInitialValues.length === 0) return undefined;

      return validateItemsInUse(categories, deals, "category", "categories");
    },
    [config.dealCategories, deals],
  );

  return (
    <SettingsSubNav
      value={activeSection}
      onValueChange={onSectionChange}
      items={[
        { id: "pipelines", label: "Pipelines" },
        { id: "leads", label: "Lead statuses" },
        { id: "tasks", label: "Task types" },
      ]}
    >
      <SettingsTabPanel value="pipelines" title="Pipelines & categories">
        <div className="space-y-8">
          <PipelinesEditor
            pipelines={dealPipelines}
            onChange={(pipelines) => setValue("dealPipelines", pipelines)}
            deals={deals as RaRecord[] | undefined}
          />
          <div className="border-t pt-6">
            <h4 className="mb-3 text-sm font-medium">Project categories</h4>
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
        </div>
      </SettingsTabPanel>

      <SettingsTabPanel value="leads" title="Lead statuses">
        <div className="space-y-8">
          <InboundLeadAutomationPanel />
          <div className="border-t pt-6">
            <h4 className="mb-3 text-sm font-medium">Lead status colors</h4>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
          </div>
        </div>
      </SettingsTabPanel>

      <SettingsTabPanel value="tasks" title="Task types">
        <ArrayInput source="taskTypes" label={false} helperText={false}>
          <SimpleFormIterator disableReordering disableClear>
            <TextInput source="label" label={false} />
          </SimpleFormIterator>
        </ArrayInput>
      </SettingsTabPanel>
    </SettingsSubNav>
  );
};
