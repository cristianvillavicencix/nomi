import type { Identifier } from "ra-core";
import { ShowBase } from "ra-core";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ContactShowContent } from "@/components/atomic-crm/contacts/ContactShow";

type ContactShowSheetProps = {
  contactId: Identifier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ContactShowSheet = ({
  contactId,
  open,
  onOpenChange,
}: ContactShowSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
      <SheetHeader className="border-b px-6 py-4 text-left">
        <SheetTitle>Contact profile</SheetTitle>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {contactId ? (
          <ShowBase resource="contacts" id={contactId}>
            <ContactShowContent embedded onClose={() => onOpenChange(false)} />
          </ShowBase>
        ) : null}
      </div>
    </SheetContent>
  </Sheet>
);
