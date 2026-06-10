import type { Identifier } from "ra-core";
import { ContactFormDialog } from "@/lbs/contacts/ContactFormDialog";

type ClientAddContactDialogProps = {
  companyId: Identifier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ClientAddContactDialog = ({
  companyId,
  open,
  onOpenChange,
}: ClientAddContactDialogProps) => (
  <ContactFormDialog
    open={open}
    onOpenChange={onOpenChange}
    lockCompanyId={companyId}
    title="Add contact"
    description="Add a person to this company."
    submitLabel="Add contact"
    navigateOnCreate={false}
  />
);
