import { required, useGetOne } from "ra-core";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type {
  Contact,
  Deal,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { AutocompleteCompanyInput } from "@/components/atomic-crm/companies/AutocompleteCompanyInput";
import { useIsMobile } from "@/hooks/use-mobile";
import { LbsProjectClientFields } from "@/lbs/deals/LbsProjectClientFields";
import { isLbsMode } from "@/lbs/productMode";
import {
  lbsProjectContactName,
  lbsProjectContactOptionText,
} from "@/lbs/deals/LbsProjectContactOption";
import { optionalGithubRepo } from "@/lbs/deals/githubRepo";
import {
  getLbsProjectScopeMode,
  getLbsProjectStageLabel,
  LBS_DEFAULT_PROJECT_CATEGORY,
  LBS_DEFAULT_PROJECT_STAGE,
  LBS_DEFAULT_PROJECT_TYPE,
  LBS_LANDING_PAGE_SCOPE,
  lbsProjectStages,
  lbsProjectTypeChoices,
} from "@/lbs/deals/lbsProjectConstants";
import { LBS_PROJECT_PRIORITIES } from "@/lbs/deals/lbsAgencyProjectModel";

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getMemberOptionText = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const fullName = [member.first_name, member.last_name]
    .filter(Boolean)
    .join(" ");
  if (member.email) return `${fullName} (${member.email})`;
  return fullName;
};

const withCurrentCustomChoice = (
  choices: Array<{ value: string; label: string }>,
  current?: string,
) => {
  if (!current) return choices;
  const exists = choices.some((choice) => choice.value === current);
  if (exists) return choices;
  return [
    ...choices,
    {
      value: current,
      label: getLbsProjectStageLabel(current),
    },
  ];
};

const optionalPositiveCurrency = (value: unknown) => {
  if (value === "" || value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0) return "Budget cannot be negative";
  return undefined;
};

const FormSectionDivider = () => (
  <div
    className="h-px w-full bg-gradient-to-r from-transparent via-border/80 to-transparent"
    aria-hidden
  />
);

const FormSection = ({
  title,
  children,
  showDivider = true,
}: {
  title: string;
  children: ReactNode;
  showDivider?: boolean;
}) => (
  <>
    {showDivider ? <FormSectionDivider /> : null}
    <section className="space-y-4 py-1">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  </>
);

export const LbsDealInputs = ({
  createStep,
}: { createStep?: 1 | 2 } = {}) => {
  const showStep = (step: 1 | 2) => !createStep || createStep === step;
  const isMobile = useIsMobile();
  const { dealCategories } = useConfigurationContext();
  const { control, setValue, getValues } = useFormContext<
    Deal & Record<string, unknown>
  >();
  const contactId = useWatch({ control, name: "contact_id" });
  const contactIds = useWatch({ control, name: "contact_ids" });
  const stage = useWatch({ control, name: "stage" });
  const projectType = useWatch({ control, name: "project_type" });
  const category = useWatch({ control, name: "category" });
  const estimatedValue = useWatch({ control, name: "estimated_value" });
  const amount = useWatch({ control, name: "amount" });
  const notes = useWatch({ control, name: "notes" });
  const description = useWatch({ control, name: "description" });

  const selectedContactId = toNumber(contactId);
  const previousContactId = useRef<number | null>(null);
  const { data: selectedContact } = useGetOne<Contact>(
    "contacts_summary",
    { id: selectedContactId as number },
    { enabled: selectedContactId != null },
  );

  const stageChoices = useMemo(
    () => withCurrentCustomChoice(lbsProjectStages, String(stage ?? "")),
    [stage],
  );
  const typeChoices = useMemo(
    () =>
      withCurrentCustomChoice(lbsProjectTypeChoices, String(projectType ?? "")),
    [projectType],
  );
  const projectTypeAutocompleteChoices = useMemo(
    () =>
      typeChoices.map((choice) => ({
        id: choice.value,
        name: choice.label,
      })),
    [typeChoices],
  );

  useEffect(() => {
    if (!category) {
      setValue("category", LBS_DEFAULT_PROJECT_CATEGORY, {
        shouldDirty: false,
      });
    }
    if (!projectType) {
      setValue("project_type", LBS_DEFAULT_PROJECT_TYPE, {
        shouldDirty: false,
      });
    }
    if (!stage) {
      setValue("stage", LBS_DEFAULT_PROJECT_STAGE, { shouldDirty: false });
    }
    setValue("pipeline_id", "default", { shouldDirty: false });
  }, [category, projectType, setValue, stage]);

  useEffect(() => {
    const normalizedContactIds = Array.isArray(contactIds)
      ? contactIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    if (!selectedContactId && normalizedContactIds.length > 0) {
      setValue("contact_id", normalizedContactIds[0], { shouldDirty: false });
    }
  }, [contactIds, selectedContactId, setValue]);

  useEffect(() => {
    if (selectedContactId == null) {
      setValue("contact_ids", [], { shouldDirty: true });
      previousContactId.current = null;
      return;
    }
    setValue("contact_ids", [selectedContactId], { shouldDirty: true });
  }, [selectedContactId, setValue]);

  useEffect(() => {
    if (!selectedContact || selectedContactId == null) return;
    if (previousContactId.current === selectedContactId) return;

    if (selectedContact.company_id) {
      setValue("company_id", Number(selectedContact.company_id), {
        shouldDirty: true,
      });
      setValue("company_name", selectedContact.company_name ?? "", {
        shouldDirty: false,
      });
    } else {
      setValue("company_id", null, { shouldDirty: true });
      if (selectedContact.company_name) {
        setValue("company_name", selectedContact.company_name, {
          shouldDirty: true,
        });
      }
    }

    previousContactId.current = selectedContactId;
  }, [selectedContact, selectedContactId, setValue]);

  useEffect(() => {
    const estimatedAsNumber = toNumber(estimatedValue);
    const amountAsNumber = toNumber(amount);

    if (estimatedAsNumber == null && amountAsNumber != null) {
      setValue("estimated_value", amountAsNumber, { shouldDirty: false });
      return;
    }

    if (
      estimatedAsNumber != null &&
      (amountAsNumber == null || amountAsNumber !== estimatedAsNumber)
    ) {
      setValue("amount", estimatedAsNumber, { shouldDirty: false });
    }
  }, [amount, estimatedValue, setValue]);

  useEffect(() => {
    if (!notes && description) {
      setValue("notes", description, { shouldDirty: false });
      return;
    }
    if (notes !== description) {
      setValue("description", String(notes ?? ""), { shouldDirty: false });
    }
  }, [description, notes, setValue]);

  const scopeMode = getLbsProjectScopeMode(String(projectType ?? ""));

  useEffect(() => {
    if (scopeMode === "single") {
      setValue("website_brief.scope", LBS_LANDING_PAGE_SCOPE, {
        shouldDirty: true,
      });
      return;
    }
    const currentScope = String(getValues("website_brief.scope") ?? "");
    if (currentScope === LBS_LANDING_PAGE_SCOPE) {
      setValue("website_brief.scope", "", { shouldDirty: true });
    }
  }, [getValues, scopeMode, setValue]);

  const gridClass = isMobile ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className="flex flex-col gap-6">
      {showStep(1) ? (
        <FormSection title="Project overview" showDivider={false}>
          <div className={`grid gap-4 ${gridClass}`}>
            <TextInput
              source="name"
              label="Project name"
              validate={required()}
              helperText={false}
              placeholder="e.g. Acme Corp website redesign"
            />
            {isLbsMode() ? (
              <LbsProjectClientFields />
            ) : (
              <>
                <ReferenceInput
                  source="contact_id"
                  reference="contacts_summary"
                >
                  <AutocompleteInput
                    label="Client contact"
                    optionText={lbsProjectContactOptionText}
                    inputText={lbsProjectContactName}
                    validate={required()}
                    helperText={false}
                    placeholder="Search contact"
                    filterToQuery={(searchText) => ({ q: searchText })}
                  />
                </ReferenceInput>
                <ReferenceInput source="company_id" reference="companies">
                  <AutocompleteCompanyInput validate={undefined} />
                </ReferenceInput>
              </>
            )}
            {isLbsMode() ? (
              <ReferenceInput
                source="accepted_proposal_id"
                reference="proposals"
              >
                <AutocompleteInput
                  label="Accepted proposal (optional)"
                  optionText="title"
                  helperText={false}
                  filterToQuery={(searchText) => ({ q: searchText })}
                />
              </ReferenceInput>
            ) : null}
            <SelectInput
              source="category"
              label="Service category"
              choices={dealCategories}
              optionText="label"
              optionValue="value"
              helperText={false}
              validate={required()}
            />
            <AutocompleteInput
              source="project_type"
              label="Service type"
              choices={projectTypeAutocompleteChoices}
              optionText="name"
              optionValue="id"
              translateChoice={false}
              validate={required()}
              create
              placeholder="Select or type a service"
              helperText={false}
            />
          </div>
        </FormSection>
      ) : null}

      {showStep(2) ? (
        <FormSection title="Timeline & team">
          <div className={`grid gap-4 ${gridClass}`}>
            <SelectInput
              source="stage"
              label="Project stage"
              choices={stageChoices}
              optionText="label"
              optionValue="value"
              helperText={false}
              validate={required()}
            />
            <SelectInput
              source="priority"
              label="Priority"
              choices={LBS_PROJECT_PRIORITIES}
              optionText="label"
              optionValue="value"
              helperText={false}
            />
            <DateInput
              source="start_date"
              label="Start date"
              helperText={false}
            />
            <DateInput
              source="expected_end_date"
              label="Delivery date"
              helperText={false}
            />
            <NumberInput
              source="estimated_value"
              label="Project budget (USD)"
              helperText={false}
              validate={optionalPositiveCurrency}
              min={0}
              step={0.01}
            />
            <TextInput
              source="github_repo"
              label="GitHub repository"
              helperText="owner/repo or full github.com URL"
              placeholder="lbs-web/acme-roofing"
              validate={optionalGithubRepo}
            />
            <div className={isMobile ? undefined : "md:col-span-2"}>
              <ReferenceArrayInput
                source="salesperson_ids"
                reference="organization_members"
                filter={{ "disabled@neq": true }}
              >
                <AutocompleteArrayInput
                  label="Assign team"
                  optionText={getMemberOptionText}
                  helperText={false}
                  placeholder="Select team members"
                  filterToQuery={(searchText) => ({ q: searchText })}
                />
              </ReferenceArrayInput>
            </div>
            <div className={isMobile ? undefined : "md:col-span-2"}>
              <TextInput
                source="notes"
                label="Internal notes"
                multiline
                rows={3}
                helperText="The full brief is filled out separately in the project's Brief tab or sent to the client as a web form."
                placeholder="Discovery notes, client requests, or next steps"
              />
            </div>
          </div>
        </FormSection>
      ) : null}
    </div>
  );
};
