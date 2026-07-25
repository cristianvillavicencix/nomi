import { useGetList, type Identifier } from "ra-core";
import { Note } from "@/components/atomic-crm/notes/Note";
import { NoteCreate } from "@/components/atomic-crm/notes";
import type { Contact, ContactNote } from "@/components/atomic-crm/types";
import { ClientTabEmpty } from "@/modules/clients/ClientContactsTab";
import { isPipelineTransitionNote } from "@/modules/leads/leadFollowUpUtils";
import { PipelineUpdateBadge } from "@/modules/shared/ContactActivityFeed";
import { LeadBackgroundNote } from "@/modules/leads/LeadBackgroundNote";
import { getLeadBackgroundText } from "@/modules/leads/leadBackgroundUtils";
import { Skeleton } from "@/components/ui/skeleton";

const TabLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

export const LeadNotesTab = ({
  lead,
  contactIds,
}: {
  lead: Contact;
  contactIds: Identifier[];
}) => {
  const backgroundText = getLeadBackgroundText(lead);
  const filter =
    contactIds.length > 0
      ? { "contact_id@in": `(${contactIds.join(",")})` }
      : { "contact_id@eq": -1 };

  const { data: notes = [], isPending } = useGetList<ContactNote>(
    "contact_notes",
    {
      filter,
      pagination: { page: 1, perPage: 50 },
      sort: { field: "date", order: "DESC" },
    },
    { staleTime: 30_000, enabled: contactIds.length > 0 },
  );

  if (isPending) return <TabLoading />;

  const hasNotes = notes.length > 0;
  const hasBackground = backgroundText.length > 0;

  return (
    <div className="space-y-4">
      <NoteCreate reference="contacts" showStatus contactId={lead.id} />

      {hasBackground ? <LeadBackgroundNote lead={lead} /> : null}

      {!hasNotes && !hasBackground ? (
        <ClientTabEmpty message="No notes for this lead yet." />
      ) : hasNotes ? (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="space-y-2">
              {isPipelineTransitionNote(note) ? (
                <div className="flex justify-end">
                  <PipelineUpdateBadge />
                </div>
              ) : null}
              <Note note={note} resource="contact_notes" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
