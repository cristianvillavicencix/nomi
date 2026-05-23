import { CreateBase, Form, useGetIdentity } from "ra-core";
import { useSearchParams } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { Card, CardContent } from "@/components/ui/card";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import { contactOptionText } from "@/components/atomic-crm/misc/ContactOption";
import type { Proposal } from "@/lbs/types";

export const ProposalCreate = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get("company_id");
  const contactId = searchParams.get("contact_id");

  return (
    <CreateBase
      resource="proposals"
      redirect={(resource, id) => `/proposals/${id}/show`}
      transform={(data: Proposal) => ({
        ...data,
        status: data.status ?? "draft",
        amount: data.amount ?? 0,
        organization_member_id: identity?.id,
      })}
    >
      <div className="mt-2 flex">
        <div className="max-w-3xl flex-1">
          <Form
            defaultValues={{
              status: "draft",
              amount: 0,
              company_id: companyId ? Number(companyId) : undefined,
              contact_id: contactId ? Number(contactId) : undefined,
            }}
          >
            <Card>
              <CardContent className="space-y-4 pt-6">
                <TextInput
                  source="title"
                  validate={(value) => (!value ? "Required" : undefined)}
                />
                <ReferenceInput source="company_id" reference="companies">
                  <AutocompleteInput optionText="name" label="Client" />
                </ReferenceInput>
                <ReferenceInput
                  source="contact_id"
                  reference="contacts_summary"
                >
                  <AutocompleteInput
                    optionText={contactOptionText}
                    label="Contact"
                  />
                </ReferenceInput>
                <NumberInput source="amount" />
                <DateInput source="valid_until" />
                <TextInput source="notes" multiline rows={4} />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
