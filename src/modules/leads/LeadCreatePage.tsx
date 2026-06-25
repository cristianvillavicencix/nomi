import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import {
  FormGuardProvider,
  FormNavigationGuard,
} from "@/components/admin/form-guard";
import { ContactInputs } from "@/components/atomic-crm/contacts/ContactInputs";
import { FormToolbar } from "@/components/atomic-crm/layout/FormToolbar";
import type { Contact } from "@/components/atomic-crm/types";
import {
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "@/modules/leads/leadFormConstants";

const LEAD_CREATE_PAGE_DRAFT_KEY = "lbs:lead-create-page";

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
          status: data.status ?? "lead",
          lead_stage: "new",
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
              status: "lead",
              organization_member_id: identity?.id,
            }}
          >
            <FormGuardProvider draftKey={LEAD_CREATE_PAGE_DRAFT_KEY} enabled>
              <FormNavigationGuard />
              <Card>
                <CardContent>
                  <ContactInputs />
                  <FormToolbar />
                </CardContent>
              </Card>
            </FormGuardProvider>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
