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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ContactFormFields } from "./ContactFormFields";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <EditBase
          resource="contacts"
          id={contactId}
          redirect={false}
          mutationOptions={{
            onSuccess: () => {
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <SaveButton label="Save" />
            </DialogFooter>
          </Form>
        </EditBase>
      </DialogContent>
    </Dialog>
  );
};
