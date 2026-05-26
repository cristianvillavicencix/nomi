import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { ContactInputs } from "@/components/atomic-crm/contacts/ContactInputs";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import type { Contact } from "@/components/atomic-crm/types";
import {
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "@/lbs/leads/leadFormConstants";

export const LeadCreatePage = () => {
  const { identity } = useGetIdentity();

  return (
    <CreateBase
      resource="contacts"
      title="New lead"
      redirect={(resource, id) => `/leads/${id}/show`}
      transform={(data: Contact) => {
        const isReferral = data.lead_source === LBS_LEAD_SOURCE_REFERRAL;
        const isOther = data.lead_source === LBS_LEAD_SOURCE_OTHER;
        return {
          ...data,
          referred_by_contact_id: isReferral
            ? (data.referred_by_contact_id ?? null)
            : null,
          referred_by_company_id: isReferral
            ? (data.referred_by_company_id ?? null)
            : null,
          lead_source_other: isOther ? (data.lead_source_other ?? null) : null,
          status: data.status ?? "new",
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          tags: [],
        };
      }}
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
