import { ShowBase, useGetOne, type Identifier } from "ra-core";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Contact } from "@/components/atomic-crm/types";
import { getPersonShowPath } from "@/app/routing";
import { ContactShowContent } from "@/modules/contacts/ContactShowContent";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { LeadDetailPanel } from "@/modules/leads/LeadDetailPanel";
import { normalizeLeadStage } from "@/modules/leads/leadStages";
import { ProfilePreviewChrome } from "@/modules/shared/profile";

type ContactShowSheetProps = {
  contactId: Identifier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ContactShowSheet = ({
  contactId,
  open,
  onOpenChange,
}: ContactShowSheetProps) => {
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId! },
    { enabled: open && contactId != null },
  );

  const isLead = contact ? isLeadLifecycleStatus(contact.status) : false;
  const title = isLead ? "Lead Preview" : "Contact Preview";
  const fullViewPath = contact ? getPersonShowPath(contact) : undefined;
  const stage = normalizeLeadStage(contact?.lead_stage);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[50vw] [&>button]:hidden"
        aria-describedby={undefined}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Preview person details without leaving the current page.
          </SheetDescription>
        </SheetHeader>

        <ProfilePreviewChrome
          title={title}
          onClose={() => onOpenChange(false)}
          fullViewPath={fullViewPath}
        />

        <div className="min-h-0 flex-1 overflow-hidden">
          {contactId ? (
            isLead ? (
              <LeadDetailPanel
                key={String(contactId)}
                leadId={String(contactId)}
                kanbanStage={stage}
                preview
              />
            ) : (
              <ShowBase resource="contacts" id={contactId} key={String(contactId)}>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                  <ContactShowContent embedded />
                </div>
              </ShowBase>
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};
