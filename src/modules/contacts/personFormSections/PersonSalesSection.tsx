import { required } from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { SelectInput } from "@/components/admin/select-input";
import { Badge } from "@/components/ui/badge";
import { getPersonCreateLeadStageLabel } from "@/modules/contacts/personFormLogic";
import { PersonFormSection } from "@/modules/contacts/personFormSections/PersonFormSection";
import { LeadReferrerInputs } from "@/modules/leads/LeadReferrerInputs";
import {
  LBS_INTERESTED_SERVICE_CHOICES,
  LBS_LEAD_SOURCE_CHOICES,
} from "@/modules/leads/leadFormConstants";

type PersonSalesSectionProps = {
  showLeadStageBadge: boolean;
};

export const PersonSalesSection = ({
  showLeadStageBadge,
}: PersonSalesSectionProps) => (
  <PersonFormSection title="Sales">
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
    <LeadReferrerInputs />

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

    {showLeadStageBadge ? (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Pipeline stage</span>
        <div>
          <Badge variant="secondary">{getPersonCreateLeadStageLabel()}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          New leads start in the first pipeline column. Change stage from the
          lead board or detail view.
        </p>
      </div>
    ) : null}
  </PersonFormSection>
);
