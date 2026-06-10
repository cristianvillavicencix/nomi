import type { Identifier } from "ra-core";
import { ContactFormDialog } from "@/lbs/contacts/ContactFormDialog";

type NewContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NewContactDialog = ({
  open,
  onOpenChange,
}: NewContactDialogProps) => (
  <ContactFormDialog open={open} onOpenChange={onOpenChange} />
);

export type { Identifier };
