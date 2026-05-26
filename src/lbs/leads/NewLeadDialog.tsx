import {
  CreateBase,
  Form,
  email,
  required,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { useNavigate } from "react-router";
import { SaveButton } from "@/components/admin/form";
import { ArrayInput } from "@/components/admin/array-input";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { AutocompleteCompanyInput } from "@/components/atomic-crm/companies/AutocompleteCompanyInput";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { Contact, OrganizationMember } from "@/components/atomic-crm/types";

import { InterestedServiceInput } from "./InterestedServiceInput";
import {
  LBS_LEAD_SOURCE_CHOICES,
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "./leadFormConstants";
import { LeadReferrerInputs } from "./LeadReferrerInputs";

const PERSONAL_INFO_TYPES = [
  { id: "Work", name: "Work" },
  { id: "Home", name: "Home" },
  { id: "Other", name: "Other" },
];

type NewLeadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type LeadFormValues = Partial<Contact> & {
  email_jsonb?: { email: string; type: string }[];
  phone_jsonb?: { number: string; type: string }[];
};

export const NewLeadDialog = ({ open, onOpenChange }: NewLeadDialogProps) => {
  const { identity } = useGetIdentity();
  const { noteStatuses } = useConfigurationContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <CreateBase
          resource="contacts"
          redirect={false}
          transform={(values: LeadFormValues): Partial<Contact> => {
            const now = new Date().toISOString();
            const isReferral = values.lead_source === LBS_LEAD_SOURCE_REFERRAL;
            const isOther = values.lead_source === LBS_LEAD_SOURCE_OTHER;
            return {
              ...values,
              referred_by_contact_id: isReferral
                ? (values.referred_by_contact_id ?? null)
                : null,
              referred_by_company_id: isReferral
                ? (values.referred_by_company_id ?? null)
                : null,
              lead_source_other: isOther
                ? (values.lead_source_other ?? null)
                : null,
              status: values.status ?? "new",
              first_seen: now,
              last_seen: now,
              tags: [],
            };
          }}
          mutationOptions={{
            onSuccess: (data) => {
              notify("Lead created", { type: "info" });
              refresh();
              handleClose();
              if (data?.id != null) {
                navigate(`/leads/${data.id}/show`);
              }
            },
            onError: () => {
              notify("Failed to create lead", { type: "error" });
            },
          }}
        >
          <Form
            defaultValues={{
              status: "new",
              organization_member_id: identity?.id,
              email_jsonb: [{ email: "", type: "Work" }],
              phone_jsonb: [{ number: "", type: "Work" }],
            }}
          >
            <DialogHeader>
              <DialogTitle>New lead</DialogTitle>
              <DialogDescription>
                Quick capture for a potential client. Required: name, lead
                source, and assignee.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5 py-2">
              {/* Basics: name + company (with inline create) */}
              <div className="grid gap-3 md:grid-cols-2">
                <TextInput
                  source="first_name"
                  label="First name"
                  validate={required()}
                  helperText={false}
                />
                <TextInput
                  source="last_name"
                  label="Last name"
                  validate={required()}
                  helperText={false}
                />
              </div>
              <ReferenceInput
                source="company_id"
                reference="companies"
                perPage={20}
                sort={{ field: "name", order: "ASC" }}
              >
                <AutocompleteCompanyInput />
              </ReferenceInput>

              <Separator />

              {/* Multi-email and multi-phone with + button */}
              <ArrayInput source="email_jsonb" label="Email(s)" helperText={false}>
                <SimpleFormIterator
                  inline
                  disableReordering
                  disableClear
                  className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
                >
                  <EmailInput
                    source="email"
                    label={false}
                    placeholder="Email"
                    className="w-full"
                    helperText={false}
                    validate={email()}
                  />
                  <SelectInput
                    source="type"
                    label={false}
                    optionText="id"
                    choices={PERSONAL_INFO_TYPES}
                    defaultValue="Work"
                    helperText={false}
                    className="w-24 min-w-24"
                  />
                </SimpleFormIterator>
              </ArrayInput>

              <ArrayInput source="phone_jsonb" label="Phone(s)" helperText={false}>
                <SimpleFormIterator
                  inline
                  disableReordering
                  disableClear
                  className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
                >
                  <PhoneInput
                    source="number"
                    label={false}
                    placeholder="(xxx) xxx-xxxx"
                    className="w-full"
                    helperText={false}
                  />
                  <SelectInput
                    source="type"
                    label={false}
                    optionText="id"
                    choices={PERSONAL_INFO_TYPES}
                    defaultValue="Work"
                    helperText={false}
                    className="w-24 min-w-24"
                  />
                </SimpleFormIterator>
              </ArrayInput>

              <Separator />

              {/* Management: source / service / assigned */}
              <SelectInput
                source="lead_source"
                label="Lead source"
                choices={LBS_LEAD_SOURCE_CHOICES.map((entry) => ({
                  id: entry.id,
                  name: entry.name,
                }))}
                validate={required()}
                helperText={false}
              />
              <LeadReferrerInputs />
              <InterestedServiceInput />

              <ReferenceInput
                reference="organization_members"
                source="organization_member_id"
                sort={{ field: "last_name", order: "ASC" }}
                filter={{ "disabled@neq": true }}
              >
                <SelectInput
                  label="Assigned to"
                  optionText={(choice: OrganizationMember) =>
                    `${choice.first_name ?? ""} ${choice.last_name ?? ""}`.trim()
                  }
                  validate={required()}
                  helperText={false}
                />
              </ReferenceInput>

              <SelectInput
                source="status"
                label="Status"
                choices={noteStatuses.map((status) => ({
                  id: status.value,
                  name: status.label,
                }))}
                validate={required()}
                helperText={false}
              />

              <TextInput
                source="background"
                label="Background / notes"
                multiline
                helperText={false}
              />
            </div>

            <DialogFooter className={isMobile ? "flex-col gap-2" : ""}>
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <SaveButton label="Create lead" />
            </DialogFooter>
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};
