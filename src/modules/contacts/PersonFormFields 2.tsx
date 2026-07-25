import { resolvePersonFormVisibility } from "@/modules/contacts/personFormLogic";
import type { PersonFormFieldsProps } from "@/modules/contacts/personFormTypes";
import { PersonAssignmentSection } from "@/modules/contacts/personFormSections/PersonAssignmentSection";
import {
  PersonCompactPreview,
  usePersonFormExpandedState,
  usePersonFormWatchValues,
} from "@/modules/contacts/personFormSections/PersonCompactPreview";
import { PersonCompanySection } from "@/modules/contacts/personFormSections/PersonCompanySection";
import { PersonContactSection } from "@/modules/contacts/personFormSections/PersonContactSection";
import { PersonIdentitySection } from "@/modules/contacts/personFormSections/PersonIdentitySection";
import { PersonMoreOptionsSection } from "@/modules/contacts/personFormSections/PersonMoreOptionsSection";
import { PersonSalesSection } from "@/modules/contacts/personFormSections/PersonSalesSection";
import { PersonTypeSection } from "@/modules/contacts/personFormSections/PersonTypeSection";
import { PersonFormCreateLayout } from "@/modules/contacts/personFormSections/PersonFormCreateLayout";

/** Unified person create/edit fields (directory contact + pipeline lead). */
export const PersonFormFields = ({
  mode = "directory",
  lockCompanyId,
  variant = "full",
}: PersonFormFieldsProps) => {
  const { personKind, leadType, addPrimaryContact } =
    usePersonFormWatchValues();
  const { expanded, setExpanded } = usePersonFormExpandedState(variant);

  if (variant === "create") {
    return (
      <PersonFormCreateLayout
        mode={mode}
        lockCompanyId={lockCompanyId}
        companyOptional={mode === "directory" && lockCompanyId == null}
      />
    );
  }

  const resolvedMode = variant === "compact" ? "compact" : mode;

  const visibility = resolvePersonFormVisibility({
    mode: resolvedMode,
    personKind: personKind ?? "contact_only",
    leadType: leadType ?? "individual",
    addPrimaryContact: addPrimaryContact ?? true,
    lockCompanyId,
    expanded,
  });

  if (visibility.compactCollapsed) {
    return (
      <PersonCompactPreview
        lockCompanyId={lockCompanyId}
        onExpand={() => setExpanded(true)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-1">
      {visibility.showIdentitySection ? <PersonIdentitySection /> : null}
      {visibility.showContactSection ? <PersonContactSection /> : null}
      <PersonCompanySection variant={visibility.companySection} />
      <PersonTypeSection
        showTypeSelector={visibility.showTypeSelector}
        showLeadProfileToggle={visibility.showLeadProfileToggle}
      />
      {visibility.showSalesSection ? (
        <PersonSalesSection
          showLeadStageBadge={visibility.showLeadStageBadge}
        />
      ) : null}
      {visibility.showAssignmentSection ? (
        <PersonAssignmentSection assignmentMulti={visibility.assignmentMulti} />
      ) : null}
      {visibility.showMoreOptions ? (
        <PersonMoreOptionsSection
          showUseCompanyContactInfo={visibility.showUseCompanyContactInfo}
          showInactiveDirectoryStatus={visibility.showInactiveDirectoryStatus}
          leadType={leadType ?? "individual"}
        />
      ) : null}
    </div>
  );
};

export type { PersonFormFieldsProps } from "@/modules/contacts/personFormTypes";
export {
  defaultPersonFormValues,
  getPersonCreateLeadStageLabel,
  personKindToStatus,
  resolvePersonFormVisibility,
  statusToPersonKind,
  syncPersonKindFields,
} from "@/modules/contacts/personFormLogic";
export type {
  PersonFormMode,
  PersonFormValues,
  PersonKind,
} from "@/modules/contacts/personFormTypes";
