import { Link } from "react-router";
import type { Contact } from "@/components/atomic-crm/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getLeadShowPath } from "@/lbs/routing";
import { ContactActivityFeed } from "@/lbs/shared/ContactActivityFeed";

const leadDisplayName = (lead: Contact) =>
  `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
  lead.company_name ||
  "Unnamed lead";

type LeadActivitySheetProps = {
  lead: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const LeadActivitySheet = ({
  lead,
  open,
  onOpenChange,
}: LeadActivitySheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      aria-describedby={undefined}
    >
      <SheetHeader className="space-y-2 border-b px-4 py-3 text-left">
        <SheetTitle className="truncate pr-6">
          {lead ? leadDisplayName(lead) : "Lead activity"}
        </SheetTitle>
        <SheetDescription>
          Full history: pipeline changes, notes, tasks, and calendar events.
        </SheetDescription>
        {lead ? (
          <Link
            to={getLeadShowPath(lead.id)}
            className="link-action inline-block text-sm font-medium"
            onClick={() => onOpenChange(false)}
          >
            Open full lead →
          </Link>
        ) : null}
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {lead ? (
          <ContactActivityFeed
            contact={lead}
            showNoteCreate={false}
            emptyLabel="No activity yet for this lead."
          />
        ) : null}
      </div>
    </SheetContent>
  </Sheet>
);
