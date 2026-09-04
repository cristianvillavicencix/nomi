import { required, useGetOne } from "ra-core";
import type { Identifier } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import type { Company } from "@/components/atomic-crm/types";
import { ContactCompanyPickerField } from "@/modules/contacts/ContactCompanyPickerField";
import { CompanyInlineDraftFields } from "@/modules/contacts/CompanyInlineDraftFields";
import {
  resolvePersonFormVisibility,
  syncPersonKindFields,
} from "@/modules/contacts/personFormLogic";
import type {
  PersonFormMode,
  PersonFormValues,
  PersonKind,
} from "@/modules/contacts/personFormTypes";
import { PersonAssignmentSection } from "@/modules/contacts/personFormSections/PersonAssignmentSection";
import { LeadReferrerInputs } from "@/modules/leads/LeadReferrerInputs";
import { ProgressiveMultiChannelInput } from "@/modules/shared/ProgressiveMultiChannelInput";
import {
  LBS_CONTACT_ROLE_CHOICES,
  LBS_INTERESTED_SERVICE_CHOICES,
  LBS_LEAD_SOURCE_CHOICES,
  LEAD_EMAIL_TYPES,
  LEAD_PHONE_TYPES,
} from "@/modules/leads/leadFormConstants";
import { LBS_LEAD_KANBAN_STAGES } from "@/modules/leads/leadStages";
import {
  CreateFormCollapsible,
  CreateFormFieldHint,
  CreateFormFieldRow,
  CreateFormSectionLabel,
  CreateFormStatusCard,
} from "@/modules/shared/createForm/CreateFormLayout";
import { PersonMoreOptionsSection } from "@/modules/contacts/personFormSections/PersonMoreOptionsSection";
import { isValidRecordId } from "@/lib/isValidRecordId";

type PersonFormCreateLayoutProps = {
  mode: PersonFormMode;
  lockCompanyId?: Identifier;
  companyOptional?: boolean;
};

const PIPELINE_STAGE_CHOICES = LBS_LEAD_KANBAN_STAGES.map((stage) => ({
  id: stage.id,
  name: stage.label,
}));

const LockedAccountBanner = ({ companyId }: { companyId: Identifier }) => {
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId },
    { enabled: isValidRecordId(companyId) },
  );
  const name = company?.name?.trim();

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Account
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">
        {name
          ? `Contact for ${name}`
          : "Contact for the selected account"}
      </p>
    </div>
  );
};

const PrimaryContactToggle = () => {
  const { setValue } = useFormContext<PersonFormValues>();
  const addPrimaryContact = useWatch<PersonFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
      <p className="text-sm font-medium">
        Add a primary contact for this company?
      </p>
      <CreateFormFieldRow columns={2}>
        <CreateFormStatusCard
          active={Boolean(addPrimaryContact)}
          label="Yes"
          description="Create a person linked to the company"
          onClick={() =>
            setValue("add_primary_contact", true, { shouldDirty: true })
          }
        />
        <CreateFormStatusCard
          active={!addPrimaryContact}
          label="No"
          description="Company-only lead record"
          onClick={() =>
            setValue("add_primary_contact", false, { shouldDirty: true })
          }
        />
      </CreateFormFieldRow>
    </div>
  );
};

const DirectoryCommercialStatus = () => {
  const { setValue } = useFormContext<PersonFormValues>();
  const personKind = useWatch<PersonFormValues, "person_kind">({
    name: "person_kind",
  });

  const setKind = (kind: PersonKind) => {
    const synced = syncPersonKindFields(kind);
    setValue("person_kind", synced.person_kind, { shouldDirty: true });
    setValue("status", synced.status, { shouldDirty: true });
    setValue("lead_stage", synced.lead_stage, { shouldDirty: true });
    if (kind === "contact_only") {
      setValue("lead_type", "individual", { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-3">
      <CreateFormSectionLabel>Commercial status</CreateFormSectionLabel>
      <CreateFormFieldRow columns={2}>
        <CreateFormStatusCard
          active={personKind === "prospect"}
          label="Prospect"
          description="Goes to Pipeline"
          onClick={() => setKind("prospect")}
        />
        <CreateFormStatusCard
          active={personKind === "contact_only"}
          label="Contact only"
          description="Directory, no pipeline"
          onClick={() => setKind("contact_only")}
        />
      </CreateFormFieldRow>
    </div>
  );
};

const DirectorySalesFields = () => (
  <CreateFormFieldRow columns={2}>
    <SelectInput
      source="lead_source"
      label="Lead source"
      choices={LBS_LEAD_SOURCE_CHOICES.map((entry) => ({
        id: entry.id,
        name: entry.name,
      }))}
      validate={required()}
      helperText={false}
      labelVariant="floating"
    />
    <AutocompleteArrayInput
      source="interested_services"
      label="Services"
      choices={LBS_INTERESTED_SERVICE_CHOICES.map((entry) => ({
        id: entry.id,
        name: entry.name,
      }))}
      validate={required()}
      helperText={false}
      placeholder="Website, Xactimate, …"
    />
    <LeadReferrerInputs />
  </CreateFormFieldRow>
);

const PipelineSalesFields = () => (
  <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
    <CreateFormSectionLabel>Sales details</CreateFormSectionLabel>
    <CreateFormFieldRow columns={2}>
      <SelectInput
        source="lead_source"
        label="Lead source"
        choices={LBS_LEAD_SOURCE_CHOICES.map((entry) => ({
          id: entry.id,
          name: entry.name,
        }))}
        validate={required()}
        helperText={false}
        labelVariant="floating"
      />
      <AutocompleteArrayInput
        source="interested_services"
        label="Services"
        choices={LBS_INTERESTED_SERVICE_CHOICES.map((entry) => ({
          id: entry.id,
          name: entry.name,
        }))}
        validate={required()}
        helperText={false}
        placeholder="Website, Xactimate, …"
      />
      <SelectInput
        source="lead_stage"
        label="Stage"
        choices={PIPELINE_STAGE_CHOICES}
        optionText="name"
        helperText={false}
        readOnly
        labelVariant="floating"
      />
      <NumberInput
        source="lead_value_estimate"
        label="Est. value ($)"
        helperText={false}
        min={0}
        labelVariant="floating"
      />
      <DateInput
        source="next_followup_at"
        label="Follow-up date"
        helperText={false}
        labelVariant="floating"
      />
      <LeadReferrerInputs />
    </CreateFormFieldRow>
  </div>
);

/** Mockup-aligned create layout for directory contact and pipeline lead dialogs. */
export const PersonFormCreateLayout = ({
  mode,
  lockCompanyId,
  companyOptional = false,
}: PersonFormCreateLayoutProps) => {
  const personKind = useWatch<PersonFormValues, "person_kind">({
    name: "person_kind",
  });
  const leadType = useWatch<PersonFormValues, "lead_type">({
    name: "lead_type",
  });
  const addPrimaryContact = useWatch<PersonFormValues, "add_primary_contact">({
    name: "add_primary_contact",
  });

  const visibility = resolvePersonFormVisibility({
    mode,
    personKind: personKind ?? "contact_only",
    leadType: leadType ?? "individual",
    addPrimaryContact: addPrimaryContact ?? true,
    lockCompanyId,
    expanded: true,
  });

  if (mode === "directory") {
    const accountLocked = isValidRecordId(lockCompanyId);

    return (
      <div className="space-y-5">
        {accountLocked ? (
          <LockedAccountBanner companyId={lockCompanyId as Identifier} />
        ) : (
          <DirectoryCommercialStatus />
        )}
        {!accountLocked && personKind === "prospect" ? (
          <DirectorySalesFields />
        ) : null}

        <CreateFormFieldRow columns={2}>
          <TextInput
            source="first_name"
            label="First name"
            validate={required()}
            helperText={false}
            labelVariant="floating"
          />
          <TextInput
            source="last_name"
            label="Last name"
            helperText={false}
            labelVariant="floating"
          />
        </CreateFormFieldRow>

        <ProgressiveMultiChannelInput
          source="email_jsonb"
          kind="email"
          label="Email"
          valueKey="email"
          typeChoices={[...LEAD_EMAIL_TYPES]}
          addLabel="+ Add email"
        />
        <ProgressiveMultiChannelInput
          source="phone_jsonb"
          kind="phone"
          label="Phone"
          valueKey="number"
          typeChoices={[...LEAD_PHONE_TYPES]}
          addLabel="+ Add phone"
        />

        {visibility.companySection === "picker" ? (
          <ContactCompanyPickerField optional={companyOptional} />
        ) : null}

        <TextInput
          source="title"
          label="Title / role"
          helperText={false}
          placeholder="Owner, Office manager, Estimator…"
          labelVariant="floating"
        />

        {!accountLocked ? (
          <PersonAssignmentSection
            assignmentMulti={visibility.assignmentMulti}
            flat
          />
        ) : null}
      </div>
    );
  }

  if (mode === "pipeline") {
    return (
      <div className="space-y-5">
        <CreateFormFieldRow columns={2}>
          <TextInput
            source="first_name"
            label="First name"
            validate={required()}
            helperText={false}
            labelVariant="floating"
          />
          <TextInput
            source="last_name"
            label="Last name"
            helperText={false}
            labelVariant="floating"
          />
        </CreateFormFieldRow>

        <ProgressiveMultiChannelInput
          source="email_jsonb"
          kind="email"
          label="Email"
          valueKey="email"
          typeChoices={[...LEAD_EMAIL_TYPES]}
          addLabel="+ Add email"
        />
        <ProgressiveMultiChannelInput
          source="phone_jsonb"
          kind="phone"
          label="Phone"
          valueKey="number"
          typeChoices={[...LEAD_PHONE_TYPES]}
          addLabel="+ Add phone"
        />

        {visibility.companySection === "inline_draft" ? (
          <div className="space-y-3">
            <CreateFormSectionLabel required>Company</CreateFormSectionLabel>
            <CompanyInlineDraftFields />
            <PrimaryContactToggle />
          </div>
        ) : null}

        {visibility.companySection === "picker" ? (
          <div className="space-y-2">
            <ContactCompanyPickerField optional />
            <CreateFormFieldHint>
              Many leads do not have a company yet. You can link one now or add
              it when you convert.
            </CreateFormFieldHint>
          </div>
        ) : null}

        {leadType === "business" && visibility.showContactFieldsInMainFlow ? (
          <SelectInput
            source="title"
            label="Title / role"
            choices={[...LBS_CONTACT_ROLE_CHOICES]}
            optionText="name"
            helperText={false}
            emptyText="Select role"
            labelVariant="floating"
          />
        ) : null}

        <PipelineSalesFields />
        <PersonAssignmentSection assignmentMulti />

        {visibility.showMoreOptions ? (
          <CreateFormCollapsible label="More options">
            <PersonMoreOptionsSection
              showUseCompanyContactInfo={visibility.showUseCompanyContactInfo}
              showInactiveDirectoryStatus={false}
              leadType={leadType ?? "individual"}
            />
          </CreateFormCollapsible>
        ) : null}
      </div>
    );
  }

  return null;
};
