import type { Identifier } from "ra-core";
import { ShowBase } from "ra-core";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ContactShowContent } from "@/lbs/contacts/ContactShowContent";

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
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 p-0 sm:max-w-[24rem]"
      aria-describedby={undefined}
    >
      <SheetHeader className="border-b px-4 py-3 text-left">
        <SheetTitle>Contact profile</SheetTitle>
        <SheetDescription className="sr-only">
          Preview contact details without leaving the current page.
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {contactId ? (
          <ShowBase resource="contacts" id={contactId} key={String(contactId)}>
            <ContactShowContent embedded />
          </ShowBase>
        ) : null}
      </div>
    </SheetContent>
  </Sheet>
);
