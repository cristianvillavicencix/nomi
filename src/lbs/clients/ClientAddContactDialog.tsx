import {
  CreateBase,
  Form,
  useGetIdentity,
  useNotify,
  useRefresh,
  type Identifier,
} from "ra-core";
import { SaveButton } from "@/components/admin/form";
import { EmailInput } from "@/components/admin/email-input";
import { PhoneInput } from "@/components/admin/phone-input";
import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_CLIENT_STATUS } from "@/lbs/navigation";
import { splitClientFullName } from "@/lbs/clients/ClientCreateForm";

type ClientAddContactDialogProps = {
  companyId: Identifier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type AddContactFormValues = {
  full_name: string;
  email: string;
  phone: string;
  title: string;
};

export const ClientAddContactDialog = ({
  companyId,
  open,
  onOpenChange,
}: ClientAddContactDialogProps) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const refresh = useRefresh();

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <CreateBase
          resource="contacts"
          redirect={false}
          transform={(values: AddContactFormValues): Partial<Contact> => {
            const { firstName, lastName } = splitClientFullName(
              values.full_name ?? "",
            );
            const now = new Date().toISOString();
            return {
              first_name: firstName,
              last_name: lastName || firstName,
              title: values.title?.trim() || null,
              company_id: companyId,
              status: LBS_CLIENT_STATUS,
              organization_member_id: identity?.id,
              email_jsonb: values.email?.trim()
                ? [{ email: values.email.trim(), type: "Work" }]
                : [],
              phone_jsonb: values.phone?.trim()
                ? [{ number: values.phone.trim(), type: "Work" }]
                : [],
              first_seen: now,
              last_seen: now,
              tags: [],
            };
          }}
          mutationOptions={{
            onSuccess: () => {
              notify("Contact added");
              refresh();
              handleClose();
            },
            onError: () => {
              notify("Failed to add contact", { type: "error" });
            },
          }}
        >
          <Form
            defaultValues={{
              full_name: "",
              email: "",
              phone: "",
              title: "",
            }}
          >
            <DialogHeader>
              <DialogTitle>Add contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <TextInput
                source="full_name"
                label="Full name"
                validate={(value) => (value?.trim() ? undefined : "Required")}
                helperText={false}
              />
              <TextInput source="title" label="Title" helperText={false} />
              <EmailInput source="email" helperText={false} />
              <PhoneInput source="phone" helperText={false} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <SaveButton label="Add contact" />
            </DialogFooter>
          </Form>
        </CreateBase>
      </DialogContent>
    </Dialog>
  );
};
