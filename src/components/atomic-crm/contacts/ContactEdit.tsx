import { Card, CardContent } from "@/components/ui/card";
import { EditBase, Form, useEditContext } from "ra-core";

import type { Contact } from "../types";
import { ContactInputs } from "./ContactInputs";
import { FormToolbar } from "../layout/FormToolbar";
import {
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "@/lbs/leads/leadFormConstants";

export const ContactEdit = () => (
  <EditBase
    redirect="show"
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
      };
    }}
  >
    <ContactEditContent />
  </EditBase>
);

const ContactEditContent = () => {
  const { isPending, record } = useEditContext<Contact>();
  if (isPending || !record) return null;
  return (
    <div className="mt-2 flex">
      <Form className="flex flex-1 max-w-5xl flex-col gap-4">
        <Card>
          <CardContent>
            <ContactInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  );
};
