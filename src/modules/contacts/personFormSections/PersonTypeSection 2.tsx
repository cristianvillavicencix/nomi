import { useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PERSON_KIND_CHOICES,
  PERSON_LEAD_PROFILE_CHOICES,
  syncPersonKindFields,
} from "@/modules/contacts/personFormLogic";
import type {
  PersonFormValues,
  PersonKind,
} from "@/modules/contacts/personFormTypes";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";
import type { LeadType } from "@/modules/leads/leadFormConstants";

type PersonTypeSectionProps = {
  showTypeSelector: boolean;
  showLeadProfileToggle: boolean;
};

const KindChoiceButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
      active
        ? "border-primary bg-primary/5 font-medium"
        : "border-border hover:bg-muted/50",
    )}
  >
    {label}
  </button>
);

export const PersonTypeSection = ({
  showTypeSelector,
  showLeadProfileToggle,
}: PersonTypeSectionProps) => {
  const { setValue } = useFormContext<PersonFormValues>();
  const personKind = useWatch<PersonFormValues, "person_kind">({
    name: "person_kind",
  });
  const leadType = useWatch<PersonFormValues, "lead_type">({
    name: "lead_type",
  });

  const setPersonKind = (kind: PersonKind) => {
    const synced = syncPersonKindFields(kind);
    setValue("person_kind", synced.person_kind, { shouldDirty: true });
    setValue("status", synced.status, { shouldDirty: true });
    setValue("lead_stage", synced.lead_stage, { shouldDirty: true });
    if (kind === "contact_only") {
      setValue("lead_type", "individual", { shouldDirty: true });
      setValue("add_primary_contact", true, { shouldDirty: true });
    }
  };

  const setLeadType = (type: LeadType) => {
    setValue("lead_type", type, { shouldDirty: true });
    setValue("add_primary_contact", true, { shouldDirty: true });
  };

  if (!showTypeSelector && !showLeadProfileToggle) return null;

  return (
    <PersonFormSection title="Type">
      {showTypeSelector ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Person type</Label>
          <div className="grid grid-cols-2 gap-2">
            {PERSON_KIND_CHOICES.map((choice) => (
              <KindChoiceButton
                key={choice.value}
                active={personKind === choice.value}
                label={choice.label}
                onClick={() => setPersonKind(choice.value)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showLeadProfileToggle ? (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Lead profile</Label>
          <div className="grid grid-cols-2 gap-2">
            {PERSON_LEAD_PROFILE_CHOICES.map((choice) => (
              <KindChoiceButton
                key={choice.value}
                active={leadType === choice.value}
                label={choice.label}
                onClick={() => setLeadType(choice.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </PersonFormSection>
  );
};
