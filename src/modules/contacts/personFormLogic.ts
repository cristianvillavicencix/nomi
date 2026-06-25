import type { Identifier } from "ra-core";
import type { LeadType } from "@/modules/leads/leadFormConstants";
import { LBS_LEAD_KANBAN_STAGES } from "@/modules/leads/leadStages";
import {
  emptyCompanyDraftFormFields,
  PRIMARY_MOVE_CONFIRMED_FIELD,
} from "@/modules/contacts/companyDraft";
import type {
  PersonFormMode,
  PersonFormValues,
  PersonFormVisibility,
  PersonFormVisibilityInput,
  PersonKind,
} from "@/modules/contacts/personFormTypes";

export const PERSON_KIND_CHOICES: ReadonlyArray<{
  value: PersonKind;
  label: string;
}> = [
  { value: "prospect", label: "Prospect" },
  { value: "contact_only", label: "Contact only" },
];

export const PERSON_LEAD_PROFILE_CHOICES: ReadonlyArray<{
  value: LeadType;
  label: string;
}> = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business (B2B)" },
];

/** Read-only pipeline stage label for new prospects (always `new`). */
export const PERSON_CREATE_LEAD_STAGE_ID = "new" as const;

export const getPersonCreateLeadStageLabel = () => {
  const stage = LBS_LEAD_KANBAN_STAGES.find(
    (entry) => entry.id === PERSON_CREATE_LEAD_STAGE_ID,
  );
  return stage?.label ?? "New";
};

export const personKindToStatus = (kind: PersonKind): string =>
  kind === "prospect" ? "lead" : "contact_only";

export const statusToPersonKind = (status?: string | null): PersonKind =>
  status === "lead" || status === "prospect" ? "prospect" : "contact_only";

export const isProspectKind = (kind: PersonKind) => kind === "prospect";

export const syncPersonKindFields = (
  kind: PersonKind,
): Pick<PersonFormValues, "person_kind" | "status" | "lead_stage"> => ({
  person_kind: kind,
  status: personKindToStatus(kind),
  lead_stage: kind === "prospect" ? PERSON_CREATE_LEAD_STAGE_ID : null,
});

export const defaultPersonFormValues = (
  mode: PersonFormMode = "directory",
  organizationMemberId?: Identifier,
): PersonFormValues => {
  const personKind: PersonKind = mode === "pipeline" ? "prospect" : "contact_only";
  const kindFields = syncPersonKindFields(personKind);

  return {
    first_name: "",
    last_name: "",
    title: "",
    email_jsonb: [{ email: "", type: "Work" }],
    phone_jsonb: [{ number: "", type: "Work" }],
    address: "",
    city: "",
    state_abbr: "",
    zipcode: "",
    country: "",
    company_id: null,
    ...emptyCompanyDraftFormFields(),
    [PRIMARY_MOVE_CONFIRMED_FIELD]: false,
    add_primary_contact: true,
    use_company_contact_info: false,
    ...kindFields,
    lead_type: "individual",
    lead_source: "",
    lead_source_other: null,
    referred_by_contact_id: null,
    referred_by_company_id: null,
    interested_services: [],
    lead_value_estimate: null,
    next_followup_at: null,
    organization_member_id: organizationMemberId,
    assigned_member_ids:
      organizationMemberId != null && organizationMemberId !== ""
        ? [organizationMemberId]
        : [],
    background: "",
  };
};

const isCompanyLocked = (lockCompanyId?: Identifier | null) =>
  lockCompanyId != null && lockCompanyId !== "";

export const shouldShowContactIdentity = (
  personKind: PersonKind,
  leadType: LeadType,
  addPrimaryContact: boolean,
): boolean => {
  if (!isProspectKind(personKind)) return true;
  if (leadType === "individual") return true;
  return addPrimaryContact;
};

export const resolveCompanySectionVariant = (
  input: Pick<
    PersonFormVisibilityInput,
    "mode" | "personKind" | "leadType" | "lockCompanyId"
  >,
): PersonFormVisibility["companySection"] => {
  if (isCompanyLocked(input.lockCompanyId)) return "hidden";

  if (
    input.mode === "pipeline" &&
    isProspectKind(input.personKind) &&
    input.leadType === "business"
  ) {
    return "inline_draft";
  }

  if (
    input.mode === "pipeline" &&
    isProspectKind(input.personKind) &&
    input.leadType === "individual"
  ) {
    return "picker";
  }

  return "picker";
};

export const resolvePersonFormVisibility = (
  input: PersonFormVisibilityInput,
): PersonFormVisibility => {
  const prospect = isProspectKind(input.personKind);
  const companySection = resolveCompanySectionVariant(input);
  const showContactFieldsInMainFlow = shouldShowContactIdentity(
    input.personKind,
    input.leadType,
    input.addPrimaryContact,
  );
  const compactCollapsed =
    input.mode === "compact" && input.expanded !== true;

  if (compactCollapsed) {
    return {
      showIdentitySection: true,
      showContactSection: true,
      companySection: isCompanyLocked(input.lockCompanyId) ? "hidden" : "picker",
      showTypeSelector: false,
      showLeadProfileToggle: false,
      showSalesSection: false,
      showAssignmentSection: false,
      assignmentMulti: false,
      showMoreOptions: false,
      showContactFieldsInMainFlow: true,
      showUseCompanyContactInfo: false,
      showInactiveDirectoryStatus: false,
      showLeadStageBadge: false,
      compactCollapsed: true,
    };
  }

  return {
    showIdentitySection: showContactFieldsInMainFlow,
    showContactSection: showContactFieldsInMainFlow,
    companySection,
    showTypeSelector: input.mode === "directory" || input.mode === "deferred",
    showLeadProfileToggle: prospect && input.mode === "pipeline",
    showSalesSection: prospect,
    showAssignmentSection: true,
    assignmentMulti: prospect,
    showMoreOptions: true,
    showContactFieldsInMainFlow,
    showUseCompanyContactInfo:
      prospect &&
      input.leadType === "business" &&
      Boolean(input.addPrimaryContact) &&
      companySection === "inline_draft",
    showInactiveDirectoryStatus:
      !prospect && (input.mode === "directory" || input.mode === "deferred"),
    showLeadStageBadge: prospect,
    compactCollapsed: false,
  };
};
