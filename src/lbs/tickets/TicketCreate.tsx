import { CreateBase, Form, useGetIdentity } from "ra-core";
import { useSearchParams } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Card, CardContent } from "@/components/ui/card";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import { contactOptionText } from "@/components/atomic-crm/misc/ContactOption";
import type { Ticket } from "@/lbs/types";

const statusChoices = [
  { id: "open", name: "Open" },
  { id: "in_progress", name: "In progress" },
  { id: "waiting_client", name: "Waiting on client" },
  { id: "resolved", name: "Resolved" },
  { id: "closed", name: "Closed" },
];

const priorityChoices = [
  { id: "low", name: "Low" },
  { id: "normal", name: "Normal" },
  { id: "high", name: "High" },
  { id: "urgent", name: "Urgent" },
];

export const TicketCreate = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();

  const defaultCompanyId = searchParams.get("company_id") ?? undefined;
  const defaultDealId = searchParams.get("deal_id") ?? undefined;
  const defaultContactId = searchParams.get("contact_id") ?? undefined;

  return (
    <CreateBase
      resource="tickets"
      redirect={(resource, id) => `/tickets/${id}/show`}
      transform={(data: Ticket) => ({
        ...data,
        status: data.status ?? "open",
        priority: data.priority ?? "normal",
        organization_member_id: identity?.id,
      })}
    >
      <div className="mt-2 flex">
        <div className="max-w-3xl flex-1">
          <Form
            defaultValues={{
              status: "open",
              priority: "normal",
              company_id: defaultCompanyId,
              deal_id: defaultDealId,
              contact_id: defaultContactId,
              organization_member_id: identity?.id,
            }}
          >
            <Card>
              <CardContent className="space-y-4 pt-6">
                <TextInput
                  source="subject"
                  validate={(value) => (!value ? "Required" : undefined)}
                />
                <SelectInput source="status" choices={statusChoices} />
                <SelectInput source="priority" choices={priorityChoices} />
                <ReferenceInput source="company_id" reference="companies">
                  <AutocompleteInput optionText="name" label="Client" />
                </ReferenceInput>
                <ReferenceInput source="contact_id" reference="contacts_summary">
                  <AutocompleteInput optionText={contactOptionText} label="Contact" />
                </ReferenceInput>
                <ReferenceInput source="deal_id" reference="deals">
                  <AutocompleteInput optionText="name" label="Project" />
                </ReferenceInput>
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
