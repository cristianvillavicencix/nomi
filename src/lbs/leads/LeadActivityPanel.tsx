import type { Contact } from "@/components/atomic-crm/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactActivityFeed } from "@/lbs/shared/ContactActivityFeed";

export const LeadActivityPanel = ({
  lead,
  embedded = false,
}: {
  lead: Contact;
  embedded?: boolean;
}) => {
  const content = (
    <ContactActivityFeed
      contact={lead}
      showNoteCreate={false}
      emptyLabel="No activity yet. Pipeline changes, notes, tasks, and calendar events will show up here. Add new notes in the Notes tab."
    />
  );

  if (embedded) return content;

  return (
    <Card className="mt-4 gap-0 border-0 py-0 shadow-none">
      <CardHeader className="px-4 pt-0 pb-0">
        <CardTitle className="text-base font-semibold">Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4">{content}</CardContent>
    </Card>
  );
};
