import { required, useGetIdentity, useGetList, useGetOne } from "ra-core";
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
import type {
  Contact,
  Deal,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildAutoProjectName } from "@/modules/deals/buildAutoProjectName";
import { LbsProjectClientFields } from "@/modules/deals/LbsProjectClientFields";
import { optionalGithubRepo } from "@/modules/deals/githubRepo";
import {
  getLbsProjectScopeMode,
  getLbsProjectStageLabel,
  LBS_DEFAULT_PROJECT_CATEGORY,
  LBS_DEFAULT_PROJECT_STAGE,
  LBS_DEFAULT_PROJECT_TYPE,
  LBS_LANDING_PAGE_SCOPE,
  lbsProjectStages,
  lbsProjectTypeChoices,
} from "@/modules/deals/lbsProjectConstants";
import { LBS_PROJECT_PRIORITIES } from "@/modules/deals/lbsAgencyProjectModel";
import { lbsProjectContactName } from "@/modules/deals/LbsProjectContactOption";
import type { Proposal } from "@/modules/types";

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isAdminMember = (member: OrganizationMember) =>
  member.administrator === true ||
  (Array.isArray(member.roles) && member.roles.includes("admin"));

const memberDisplayName = (member: OrganizationMember) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ").trim() ||
  member.email ||
  "Team member";

const getMemberOptionText = (member?: Partial<OrganizationMember>) => {
  if (!member) return "";
  const name = memberDisplayName(member as OrganizationMember);
  if (member.email) return `${name} (${member.email})`;
  return name;
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
  const isCreateFlow = createStep != null;
  const { identity } = useGetIdentity();
  const { control, setValue, getValues } = useFormContext<
    Deal & Record<string, unknown>
  >();
  const contactId = useWatch({ control, name: "contact_id" });
  const contactIds = useWatch({ control, name: "contact_ids" });
  const companyName = useWatch({ control, name: "company_name" });
  const acceptedProposalId = useWatch({ control, name: "accepted_proposal_id" });
  const stage = useWatch({ control, name: "stage" });
  const projectType = useWatch({ control, name: "project_type" });
  const category = useWatch({ control, name: "category" });
  const estimatedValue = useWatch({ control, name: "estimated_value" });
  const amount = useWatch({ control, name: "amount" });
  const notes = useWatch({ control, name: "notes" });
  const description = useWatch({ control, name: "description" });
  const projectName = useWatch({ control, name: "name" });
  const salespersonIds = useWatch({ control, name: "salesperson_ids" });

  const selectedContactId = toNumber(contactId);
  const selectedProposalId = toNumber(acceptedProposalId);
  const previousContactId = useRef<number | null>(null);
  const teamAssignedRef = useRef(false);
  const { data: selectedContact } = useGetOne<Contact>(
    "contacts",
    { id: selectedContactId as number },
    { enabled: selectedContactId != null },
  );
  const { data: selectedProposal } = useGetOne<Proposal>(
    "proposals",
    { id: selectedProposalId as number },
    { enabled: selectedProposalId != null },
  );
  const { data: organizationMembers = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "last_name", order: "ASC" },
      filter: { "disabled@neq": true },
    },
  );

  const defaultCreateTeamIds = useMemo(() => {
    const adminIds = organizationMembers
      .filter(isAdminMember)
      .map((member) => Number(member.id))
      .filter(Number.isFinite);
    return Array.from(
      new Set(
        [Number(identity?.id), ...adminIds].filter((id) => Number.isFinite(id)),
      ),
    );
  }, [identity?.id, organizationMembers]);

  const assignedTeamMembers = useMemo(() => {
    const ids = (
      isCreateFlow
        ? defaultCreateTeamIds
        : Array.isArray(salespersonIds)
          ? salespersonIds.map((id) => Number(id))
          : []
    ).filter(Number.isFinite);

    const byId = new Map(
      organizationMembers.map((member) => [Number(member.id), member]),
    );
    return ids
      .map((id) => byId.get(id))
      .filter((member): member is OrganizationMember => member != null);
  }, [
    defaultCreateTeamIds,
    isCreateFlow,
    organizationMembers,
    salespersonIds,
  ]);

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

  useEffect(() => {
    if (!isCreateFlow || teamAssignedRef.current) return;
    if (defaultCreateTeamIds.length === 0) return;

    setValue("salesperson_ids", defaultCreateTeamIds, { shouldDirty: false });
    teamAssignedRef.current = true;
  }, [defaultCreateTeamIds, isCreateFlow, setValue]);

  const autoProjectName = useMemo(
    () =>
      buildAutoProjectName({
        companyName:
          typeof companyName === "string" && companyName.trim()
            ? companyName
            : selectedContact?.company_name,
        contactName: selectedContact ? lbsProjectContactName(selectedContact) : "",
        projectType: String(projectType ?? ""),
        proposalTitle: selectedProposal?.title,
      }),
    [
      companyName,
      projectType,
      selectedContact,
      selectedProposal?.title,
    ],
  );

  useEffect(() => {
    if (!autoProjectName) return;
    if (projectName === autoProjectName) return;
    setValue("name", autoProjectName, { shouldDirty: false });
  }, [autoProjectName, projectName, setValue]);

  useEffect(() => {
    const proposalAmount = toNumber(selectedProposal?.amount);
    if (proposalAmount == null || proposalAmount <= 0) return;
    setValue("estimated_value", proposalAmount, { shouldDirty: false });
    setValue("amount", proposalAmount, { shouldDirty: false });
  }, [selectedProposal?.amount, setValue]);

  const proposalBudgetLocked =
    selectedProposalId != null &&
    toNumber(selectedProposal?.amount) != null &&
    toNumber(selectedProposal?.amount)! > 0;

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
            <div className={isMobile ? undefined : "md:col-span-2"}>
              <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Project name
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {autoProjectName || "Select a client and service to generate"}
                </p>
              </div>
            </div>
            <LbsProjectClientFields />
            <ReferenceInput
              source="accepted_proposal_id"
              reference="proposals"
              filter={
                selectedContactId != null
                  ? { "contact_id@eq": selectedContactId }
                  : undefined
              }
            >
              <AutocompleteInput
                label="Accepted proposal (optional)"
                optionText="title"
                helperText={
                  proposalBudgetLocked
                    ? "Budget is taken from this proposal."
                    : false
                }
                filterToQuery={(searchText) => ({ q: searchText })}
              />
            </ReferenceInput>
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
            {!proposalBudgetLocked ? (
              <NumberInput
                source="estimated_value"
                label="Project budget (USD)"
                helperText={false}
                validate={optionalPositiveCurrency}
                min={0}
                step={0.01}
              />
            ) : (
              <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Project budget (USD)
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums text-foreground">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(toNumber(selectedProposal?.amount) ?? 0)}
                </p>
              </div>
            )}
            <TextInput
              source="github_repo"
              label="GitHub repository"
              helperText="owner/repo or full github.com URL"
              placeholder="lbs-web/acme-roofing"
              validate={optionalGithubRepo}
            />
            <div className={isMobile ? undefined : "md:col-span-2"}>
              {isCreateFlow ? (
                <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Assigned team
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The project creator and workspace administrators are added
                    automatically.
                  </p>
                  {assignedTeamMembers.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {assignedTeamMembers.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="font-medium text-foreground">
                            {memberDisplayName(member)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {Number(member.id) === Number(identity?.id)
                              ? "Creator"
                              : isAdminMember(member)
                                ? "Admin"
                                : "Team"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">—</p>
                  )}
                </div>
              ) : (
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
              )}
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
