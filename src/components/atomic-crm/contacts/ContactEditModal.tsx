import type { Identifier } from "ra-core";
import {
  EditBase,
  Form,
  RecordRepresentation,
  useNotify,
  useRefresh,
  useTranslate,
} from "ra-core";
import { SaveButton } from "@/components/admin/form";
import {
  FormGuardProvider,
  useGuardedDialogClose,
} from "@/components/admin/form-guard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearFormDraft } from "@/lib/formPersistence/formDraftStorage";

import { ContactFormFields } from "./ContactFormFields";

const contactEditDraftKey = (id: Identifier) => `crm:contact-edit:${id}`;

export interface ContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: Identifier;
}

export const ContactEditModal = ({
  open,
  onOpenChange,
  contactId,
}: ContactEditModalProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();

  if (!open) return null;

  return (
    <EditBase
      resource="contacts"
      id={contactId}
      redirect={false}
      mutationOptions={{
        onSuccess: () => {
          clearFormDraft(contactEditDraftKey(contactId));
          notify("resources.contacts.notifications.updated", {
            type: "info",
            messageArgs: {
              smart_count: 1,
              _: translate("ra.notification.updated", { smart_count: 1 }),
            },
            undoable: true,
          });
          refresh();
          onOpenChange(false);
        },
      }}
    >
      <Form className="flex flex-col gap-4">
        <FormGuardProvider draftKey={contactEditDraftKey(contactId)} enabled>
          <ContactEditModalShell onOpenChange={onOpenChange} />
        </FormGuardProvider>
      </Form>
    </EditBase>
  );
};

const ContactEditModalShell = ({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) => {
  const guardedClose = useGuardedDialogClose(onOpenChange);

  return (
    <Dialog open onOpenChange={guardedClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Edit <RecordRepresentation />
          </DialogTitle>
        </DialogHeader>

        <ContactFormFields />

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => guardedClose(false)}
          >
            Cancel
          </Button>
          <SaveButton label="Save" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
