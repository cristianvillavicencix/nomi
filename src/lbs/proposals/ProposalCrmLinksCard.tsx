import { useGetOne } from "ra-core";
import { useFormContext } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Card, CardContent } from "@/components/ui/card";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { ProposalCrmLinkedMeta } from "@/lbs/proposals/ProposalCrmLinkedMeta";
import {
  proposalContactOptionText,
  useProposalCrmLinks,
} from "@/lbs/proposals/useProposalCrmLinks";

export const ProposalCrmLinksCard = () => {
  const { watch } = useFormContext<{
    company_id: unknown;
    contact_id: unknown;
  }>();
  const companyId = watch("company_id");
  const contactId = watch("contact_id");
  const { companyIdEnabled, contactFilter, dealFilter } = useProposalCrmLinks();

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId as Company["id"] },
    { enabled: companyId != null && companyId !== "" },
  );

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as Contact["id"] },
    { enabled: contactId != null && contactId !== "" },
  );

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CRM links
        </p>
        <div className="grid gap-2">
          <ReferenceInput source="company_id" reference="companies">
            <AutocompleteInput
              optionText="name"
              label="Client"
              className="[&_label]:text-xs [&_input]:h-8 [&_button]:h-8"
            />
          </ReferenceInput>
          <ReferenceInput
            source="contact_id"
            reference="contacts"
            filter={contactFilter}
            disabled={!companyIdEnabled}
          >
            <AutocompleteInput
              optionText={(record: Contact) => proposalContactOptionText(record)}
              inputText={(record: Contact) => proposalContactOptionText(record)}
              label="Contact"
              placeholder={
                companyIdEnabled ? "Select contact" : "Choose client first"
              }
              className="[&_label]:text-xs [&_input]:h-8 [&_button]:h-8"
            />
          </ReferenceInput>
          <ReferenceInput
            source="deal_id"
            reference="deals"
            filter={dealFilter}
            disabled={!companyIdEnabled}
          >
            <AutocompleteInput
              optionText="name"
              label="Deal"
              placeholder={
                companyIdEnabled ? "Select deal" : "Choose client first"
              }
              className="[&_label]:text-xs [&_input]:h-8 [&_button]:h-8"
            />
          </ReferenceInput>
        </div>
        <ProposalCrmLinkedMeta company={company} contact={contact} />
      </CardContent>
    </Card>
  );
};
