import {
  required,
  useGetIdentity,
  useGetList,
  useGetOne,
} from "ra-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import type {
  Contact,
  Deal,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import { applyPriorDealToCreateForm } from "@/modules/deals/applyPriorDealToCreateForm";
import { buildAutoProjectName } from "@/modules/deals/buildAutoProjectName";
import { isValidRecordId } from "@/lib/isValidRecordId";
import {
  getLbsProjectStageLabel,
  LBS_DEFAULT_PROJECT_CATEGORY,
  LBS_DEFAULT_PROJECT_STAGE,
  LBS_DEFAULT_PROJECT_TYPE,
  lbsProjectStages,
  lbsProjectTypeChoices,
} from "@/modules/deals/lbsProjectConstants";
import { LbsProjectClientFields } from "@/modules/deals/LbsProjectClientFields";
import { lbsProjectContactName } from "@/modules/deals/LbsProjectContactOption";
import {
  CreateFormFieldHint,
  CreateFormFieldRow,
} from "@/modules/shared/createForm/CreateFormLayout";

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
  if (parsed < 0) return "Amount cannot be negative";
  return undefined;
};

/** Streamlined new-deal form: client, deal name, stage/type, amount/close, assignee. */
export const LbsDealCreateFields = ({
  seedContact,
}: {
  seedContact?: Contact | null;
} = {}) => {
  const { identity } = useGetIdentity();
  const { control, setValue } = useFormContext<Deal & Record<string, unknown>>();
  const contactId = useWatch({ control, name: "contact_id" });
  const companyIdOnForm = useWatch({ control, name: "company_id" });
  const companyName = useWatch({ control, name: "company_name" });
  const stage = useWatch({ control, name: "stage" });
  const projectType = useWatch({ control, name: "project_type" });
  const category = useWatch({ control, name: "category" });
  const estimatedValue = useWatch({ control, name: "estimated_value" });
  const amount = useWatch({ control, name: "amount" });
  const projectName = useWatch({ control, name: "name" });
  const contactIds = useWatch({ control, name: "contact_ids" });

  const selectedContactId = toNumber(contactId);
  const hasSelectedContact = isValidRecordId(selectedContactId);
  const hasCompanyOnForm = isValidRecordId(companyIdOnForm);
  const shouldFetchSelectedContact =
    hasSelectedContact && !hasCompanyOnForm;
  const previousContactId = useRef<number | null>(null);
  const lastPrefilledContactId = useRef<number | null>(null);
  const teamAssignedRef = useRef(false);
  const [priorDealTitle, setPriorDealTitle] = useState<string | null>(null);

  const { data: selectedContact, isError: selectedContactError } = useGetOne<Contact>(
    "contacts",
    { id: selectedContactId as number },
    { enabled: shouldFetchSelectedContact, retry: false },
  );

  useEffect(() => {
    if (!selectedContactError) return;
    setValue("contact_id", null, { shouldDirty: false });
    setValue("contact_ids", [], { shouldDirty: false });
    previousContactId.current = null;
    lastPrefilledContactId.current = null;
    setPriorDealTitle(null);
  }, [selectedContactError, setValue]);

  const { data: priorDeals = [], isFetching: isPriorDealsFetching } =
    useGetList<Deal>(
      "deals",
      {
        filter: {
          "contact_ids@cs": `{${selectedContactId}}`,
          "archived_at@is": null,
        },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "created_at", order: "DESC" },
      },
      { enabled: hasSelectedContact },
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

    if (!hasSelectedContact) {
      if (normalizedContactIds.length > 0) {
        setValue("contact_ids", [], { shouldDirty: true });
      }
      previousContactId.current = null;
      lastPrefilledContactId.current = null;
      setPriorDealTitle(null);
      return;
    }

    const alreadySynced =
      normalizedContactIds.length === 1 &&
      normalizedContactIds[0] === selectedContactId;
    if (!alreadySynced) {
      setValue("contact_ids", [selectedContactId], { shouldDirty: true });
    }
  }, [contactIds, hasSelectedContact, selectedContactId, setValue]);

  useEffect(() => {
    const normalizedContactIds = Array.isArray(contactIds)
      ? contactIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];
    if (!hasSelectedContact && normalizedContactIds.length > 0) {
      setValue("contact_id", normalizedContactIds[0], { shouldDirty: false });
    }
  }, [contactIds, hasSelectedContact, setValue]);

  useEffect(() => {
    if (!selectedContact || !hasSelectedContact) return;
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
    if (selectedContactId == null) return;
    if (isPriorDealsFetching) return;
    if (lastPrefilledContactId.current === selectedContactId) return;

    const priorDeal = priorDeals[0];
    if (!priorDeal) {
      lastPrefilledContactId.current = selectedContactId;
      setPriorDealTitle(null);
      return;
    }

    applyPriorDealToCreateForm(setValue, priorDeal);
    lastPrefilledContactId.current = selectedContactId;
    setPriorDealTitle(priorDeal.name?.trim() || "Previous project");
  }, [isPriorDealsFetching, priorDeals, selectedContactId, setValue]);

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
    if (teamAssignedRef.current) return;
    if (defaultCreateTeamIds.length === 0) return;

    setValue("salesperson_ids", defaultCreateTeamIds, { shouldDirty: false });
    teamAssignedRef.current = true;
  }, [defaultCreateTeamIds, setValue]);

  const autoProjectName = useMemo(
    () =>
      buildAutoProjectName({
        companyName:
          typeof companyName === "string" && companyName.trim()
            ? companyName
            : selectedContact?.company_name,
        contactName: selectedContact ? lbsProjectContactName(selectedContact) : "",
        projectType: String(projectType ?? ""),
      }),
    [companyName, projectType, selectedContact],
  );

  useEffect(() => {
    if (!autoProjectName) return;
    if (projectName === autoProjectName) return;
    setValue("name", autoProjectName, { shouldDirty: false });
  }, [autoProjectName, projectName, setValue]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <LbsProjectClientFields variant="create" seedContact={seedContact} />
        {priorDealTitle ? (
          <CreateFormFieldHint>
            Values copied from the client&apos;s previous project ({priorDealTitle}
            ).
          </CreateFormFieldHint>
        ) : null}
      </div>

      <TextInput
        source="name"
        label="Deal name"
        helperText={false}
        validate={required()}
        placeholder="e.g. Acme Roofing — Website"
      />

      <CreateFormFieldRow>
        <SelectInput
          source="stage"
          label="Stage"
          choices={stageChoices}
          optionText="label"
          optionValue="value"
          helperText={false}
          validate={required()}
        />
        <AutocompleteInput
          source="project_type"
          label="Project type"
          choices={projectTypeAutocompleteChoices}
          optionText="name"
          optionValue="id"
          translateChoice={false}
          validate={required()}
          create
          placeholder="Select or type"
          helperText={false}
        />
      </CreateFormFieldRow>

      <CreateFormFieldRow>
        <NumberInput
          source="amount"
          label="Amount"
          helperText={false}
          validate={optionalPositiveCurrency}
          min={0}
          step={0.01}
        />
        <DateInput
          source="expected_closing_date"
          label="Expected close"
          helperText={false}
        />
      </CreateFormFieldRow>

      <ReferenceInput
        source="organization_member_id"
        reference="organization_members"
        filter={{ "disabled@neq": true }}
      >
        <AutocompleteInput
          label="Assigned to"
          optionText={getMemberOptionText}
          helperText={false}
          validate={required()}
          filterToQuery={(searchText) => ({ q: searchText })}
        />
      </ReferenceInput>
    </div>
  );
};
