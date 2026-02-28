import type { Identifier } from "ra-core";

import { ContactEditSheet } from "./ContactEditSheet";

export interface ContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}

export const ContactEditModal = ({
  open,
  onOpenChange,
  contactId,
}: ContactEditModalProps) => (
  <ContactEditSheet
    open={open}
    onOpenChange={onOpenChange}
    contactId={contactId}
  />
);
