import {
  CreateBase,
  Form,
  required,
  useGetIdentity,
  useNotify,
  useRefresh,
} from "ra-core";
import { useState } from "react";
import { useNavigate } from "react-router";
import { SaveButton } from "@/components/admin/form";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
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
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";

import { InterestedServiceInput } from "./InterestedServiceInput";
import { LeadChannelsInput } from "./LeadChannelsInput";
import { LeadCompanyField } from "./LeadCompanyField";
import {
  LBS_LEAD_SOURCE_CHOICES,
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "./leadFormConstants";
import { LeadReferrerInputs } from "./LeadReferrerInputs";

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
  const [moreOpen, setMoreOpen] = useState(false);

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                Name, company, contact info, and how they found you.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
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

              <LeadCompanyField />

              <LeadChannelsInput
                source="email_jsonb"
                kind="email"
                label="Email"
              />
              <LeadChannelsInput
                source="phone_jsonb"
                kind="phone"
                label="Phone"
              />

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

              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1 px-2 text-muted-foreground"
                  onClick={() => setMoreOpen((open) => !open)}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      moreOpen && "rotate-180",
                    )}
                  />
                  More options
                </Button>
                {moreOpen ? (
                  <div className="mt-2 space-y-4 rounded-lg border bg-muted/20 p-3">
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
                      label="Notes"
                      multiline
                      helperText={false}
                    />
                  </div>
                ) : null}
              </div>
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
