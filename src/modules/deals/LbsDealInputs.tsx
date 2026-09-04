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
import { MoneyText } from "@/lib/permissions/MoneyText";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
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
  projectTypeShowsDomainHosting,
  projectTypeShowsGithub,
  projectTypeShowsServiceDetails,
  projectTypeShowsWebsiteUrl,
} from "@/modules/deals/lbsProjectConstants";
import { LBS_PROJECT_PRIORITIES } from "@/modules/deals/lbsAgencyProjectModel";
import { lbsProjectContactName } from "@/modules/deals/LbsProjectContactOption";
import type { Proposal } from "@/modules/types";

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Prefer stored amount; fall back to one_time_total when amount is empty. */
const resolveProposalBudget = (proposal?: Proposal | null): number | null => {
  const amount =
    toNumber(proposal?.amount) ?? toNumber(proposal?.one_time_total);
  return amount != null && amount > 0 ? amount : null;
};

const isSelectableProjectProposal = (proposal: Proposal) => {
  const status = String(proposal.status ?? "").toLowerCase();
  return status !== "draft" && status !== "rejected" && status !== "cancelled";
};

/** Map linked proposal status → project stage (sales funnel only). */
const stageFromProposal = (proposal?: Proposal | null): string | null => {
  if (!proposal) return null;
  const status = String(proposal.status ?? "").toLowerCase();
  if (status === "accepted" || status === "paid_in_full") return "won";
  if (!isSelectableProjectProposal(proposal)) return null;
  return "proposal_sent";
};

const isEarlySalesStage = (stageValue?: string | null) => {
  const stage = String(stageValue ?? "");
  return (
    !stage ||
    stage === "lead" ||
    stage === "proposal_sent" ||
    stage === "won"
  );
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

const toDateOnly = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
};

/** Delivery may equal start; only reject when it is earlier. */
const deliveryOnOrAfterStart = (
  value: unknown,
  allValues?: { start_date?: unknown },
) => {
  const delivery = toDateOnly(value);
  const start = toDateOnly(allValues?.start_date);
  if (!delivery || !start) return undefined;
  if (delivery < start) {
    return "Delivery date must be on or after the start date";
  }
  return undefined;
};

const FormSection = ({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) => (
  <section className="space-y-4 py-1">
    {title ? (
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
    ) : null}
    {children}
  </section>
);

export const LbsDealInputs = ({
  seedContact,
  mode = "edit",
}: {
  seedContact?: Contact | null;
  /** Create seeds default assignees; same field set as edit. */
  mode?: "create" | "edit";
} = {}) => {
  const isMobile = useIsMobile();
  const canViewAmounts = useCanViewAmounts();
  const isCreateFlow = mode === "create";
  const { identity } = useGetIdentity();
  const { control, setValue, getValues } = useFormContext<
    Deal & Record<string, unknown>
  >();
  const contactId = useWatch({ control, name: "contact_id" });
  const contactIds = useWatch({ control, name: "contact_ids" });
  const companyId = useWatch({ control, name: "company_id" });
  const companyName = useWatch({ control, name: "company_name" });
  const acceptedProposalId = useWatch({
    control,
    name: "accepted_proposal_id",
  });
  const stage = useWatch({ control, name: "stage" });
  const projectType = useWatch({ control, name: "project_type" });
  const category = useWatch({ control, name: "category" });
  const estimatedValue = useWatch({ control, name: "estimated_value" });
  const amount = useWatch({ control, name: "amount" });
  const notes = useWatch({ control, name: "notes" });
  const description = useWatch({ control, name: "description" });
  const projectName = useWatch({ control, name: "name" });

  const selectedContactId = toNumber(contactId);
  const selectedCompanyId = toNumber(companyId);
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

  const proposalListFilter = useMemo(() => {
    if (selectedCompanyId != null) {
      return { "company_id@eq": selectedCompanyId };
    }
    if (selectedContactId != null) {
      return { "contact_id@eq": selectedContactId };
    }
    return null;
  }, [selectedCompanyId, selectedContactId]);

  const { data: accountProposals = [], isFetched: accountProposalsFetched } =
    useGetList<Proposal>(
      "proposals",
      {
        filter: proposalListFilter ?? { "id@eq": -1 },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled: proposalListFilter != null, staleTime: 30_000 },
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
        contactName: selectedContact
          ? lbsProjectContactName(selectedContact)
          : "",
        projectType: String(projectType ?? ""),
        proposalTitle: selectedProposal?.title,
      }),
    [companyName, projectType, selectedContact, selectedProposal?.title],
  );

  useEffect(() => {
    if (!autoProjectName) return;
    if (projectName === autoProjectName) return;
    setValue("name", autoProjectName, { shouldDirty: false });
  }, [autoProjectName, projectName, setValue]);

  // Auto-select proposal when the account/contact has exactly one usable proposal.
  useEffect(() => {
    if (proposalListFilter == null) {
      if (selectedProposalId != null) {
        setValue("accepted_proposal_id", null, { shouldDirty: true });
      }
      return;
    }
    if (!accountProposalsFetched) return;

    const usable = accountProposals.filter(isSelectableProjectProposal);
    const stillValid =
      selectedProposalId != null &&
      usable.some((proposal) => Number(proposal.id) === selectedProposalId);

    if (stillValid) return;

    const accepted = usable.filter((proposal) => {
      const status = String(proposal.status ?? "").toLowerCase();
      return status === "accepted" || status === "paid_in_full";
    });
    const pick =
      accepted.length === 1
        ? accepted[0]
        : usable.length === 1
          ? usable[0]
          : null;

    if (pick) {
      setValue("accepted_proposal_id", pick.id, { shouldDirty: true });
      return;
    }

    if (selectedProposalId != null) {
      setValue("accepted_proposal_id", null, { shouldDirty: true });
    }
  }, [
    accountProposals,
    accountProposalsFetched,
    proposalListFilter,
    selectedProposalId,
    setValue,
  ]);

  const proposalBudget = resolveProposalBudget(selectedProposal);

  useEffect(() => {
    if (proposalBudget == null) return;
    setValue("estimated_value", proposalBudget, { shouldDirty: false });
    setValue("amount", proposalBudget, { shouldDirty: false });
  }, [proposalBudget, setValue]);

  // When a proposal is linked, bump stage: accepted → Won, otherwise → Proposal.
  useEffect(() => {
    const nextStage = stageFromProposal(selectedProposal ?? null);
    if (!nextStage) return;
    if (!isEarlySalesStage(stage)) return;
    if (String(stage ?? "") === "won" && nextStage === "proposal_sent") return;
    if (String(stage ?? "") === nextStage) return;
    setValue("stage", nextStage, { shouldDirty: true });
  }, [selectedProposal, setValue, stage]);

  const proposalBudgetLocked =
    selectedProposalId != null && proposalBudget != null;

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

  const gridClass = isMobile
    ? "grid-cols-1 items-start"
    : "grid-cols-2 items-start";

  return (
    <div className="flex flex-col gap-6">
      <FormSection>
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
          <LbsProjectClientFields seedContact={seedContact} />
          <ReferenceInput
            source="accepted_proposal_id"
            reference="proposals"
            filter={
              selectedCompanyId != null
                ? { "company_id@eq": selectedCompanyId }
                : selectedContactId != null
                  ? { "contact_id@eq": selectedContactId }
                  : { "id@eq": -1 }
            }
          >
            <AutocompleteInput
              label="Accepted proposal (optional)"
              optionText="title"
              helperText={false}
              disabled={
                selectedCompanyId == null && selectedContactId == null
              }
              placeholder={
                selectedCompanyId == null && selectedContactId == null
                  ? "Select an account first"
                  : "Search proposal"
              }
              filterToQuery={(searchText) => ({ q: searchText })}
              labelVariant="floating"
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
            labelVariant="floating"
          />
        </div>
      </FormSection>

      <FormSection title="Timeline">
        <div className={`grid gap-4 ${gridClass}`}>
          <SelectInput
            source="stage"
            label="Project stage"
            choices={stageChoices}
            optionText="label"
            optionValue="value"
            helperText={false}
            validate={required()}
            labelVariant="floating"
          />
          <SelectInput
            source="priority"
            label="Priority"
            choices={LBS_PROJECT_PRIORITIES}
            optionText="label"
            optionValue="value"
            helperText={false}
            labelVariant="floating"
          />
          <DateInput
            source="start_date"
            label="Start date"
            helperText={false}
            labelVariant="floating"
          />
          <DateInput
            source="expected_end_date"
            label="Delivery date"
            helperText={false}
            validate={deliveryOnOrAfterStart}
            labelVariant="floating"
          />
        </div>
      </FormSection>

      <FormSection title="Budget">
        <div className={`grid gap-4 ${gridClass}`}>
          {!canViewAmounts ? null : !proposalBudgetLocked ? (
            <NumberInput
              source="estimated_value"
              label="Project budget (USD)"
              helperText={false}
              validate={optionalPositiveCurrency}
              min={0}
              step={0.01}
              labelVariant="floating"
            />
          ) : (
            <div className="self-start rounded-md border border-input bg-background px-3 py-2 shadow-xs">
              <p className="text-[11px] font-medium leading-none text-muted-foreground">
                Project budget (USD)
              </p>
              <p className="mt-1.5 text-sm font-medium tabular-nums text-foreground">
                <MoneyText value={proposalBudget ?? 0} />
              </p>
            </div>
          )}
        </div>
      </FormSection>

      {projectTypeShowsServiceDetails(String(projectType ?? "")) ? (
        <FormSection title="Service details">
          <div className={`grid gap-4 ${gridClass}`}>
            {projectTypeShowsWebsiteUrl(String(projectType ?? "")) ? (
              <TextInput
                source="website_brief.existing_website"
                label="Current website"
                helperText={false}
                placeholder="https://example.com"
                labelVariant="floating"
              />
            ) : null}
            {projectTypeShowsDomainHosting(String(projectType ?? "")) ? (
              <>
                <TextInput
                  source="website_brief.domain"
                  label="Domain"
                  helperText={false}
                  placeholder="example.com"
                  labelVariant="floating"
                />
                <TextInput
                  source="website_brief.hosting"
                  label="Hosting"
                  helperText={false}
                  placeholder="Current or preferred host"
                  labelVariant="floating"
                />
              </>
            ) : null}
            {projectTypeShowsGithub(String(projectType ?? "")) ? (
              <TextInput
                source="github_repo"
                label="GitHub repository"
                helperText={false}
                placeholder="lbs-web/acme-roofing"
                validate={optionalGithubRepo}
                labelVariant="floating"
              />
            ) : null}
          </div>
        </FormSection>
      ) : null}

      <FormSection title="Team">
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
            labelVariant="floating"
            filterToQuery={(searchText) => ({ q: searchText })}
          />
        </ReferenceArrayInput>
      </FormSection>

      <FormSection title="Notes">
        <TextInput
          source="notes"
          label="Internal notes"
          multiline
          rows={3}
          helperText={false}
          placeholder="Discovery notes, client requests, or next steps"
          labelVariant="floating"
        />
      </FormSection>
    </div>
  );
};
