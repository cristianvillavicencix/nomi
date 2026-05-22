import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { ContactInputs } from "@/components/atomic-crm/contacts/ContactInputs";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import type { Contact } from "@/components/atomic-crm/types";

export const LeadCreatePage = () => {
  const { identity } = useGetIdentity();

  return (
    <CreateBase
      resource="contacts"
      title="New lead"
      redirect={(resource, id) => `/leads/${id}/show`}
      transform={(data: Contact) => ({
        ...data,
        status: data.status ?? "new",
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        tags: [],
      })}
    >
      <div className="mt-2 flex">
        <div className="max-w-5xl flex-1">
          <Form
            defaultValues={{
              status: "new",
              organization_member_id: identity?.id,
            }}
          >
            <Card>
              <CardContent>
                <ContactInputs />
                <FormToolbar />
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
