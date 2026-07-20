import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Calendar,
  ExternalLink,
  Loader2,
  MessageSquare,
  Ticket,
  UserRound,
} from "lucide-react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useGetOne,
  useNotify,
} from "ra-core";
import { getPersonShowPath } from "@/app/routing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket as CrmTicket, VoiceCall } from "@/modules/types";
import { ticketShowPath } from "@/modules/tickets/ticketStatusWorkflow";
import {
  formatCallDuration,
  formatCallTimestamp,
  voiceCallStatusLabel,
} from "@/modules/voice/voiceCallFormat";
import type { ActiveCallParty } from "@/modules/voice/voiceCallTypes";
import { cn } from "@/lib/utils";

type WorkspaceTab = "details" | "notes" | "activity";

export const ActiveCallPanel = ({
  party,
  className,
  maxHeight = 420,
}: {
  party: ActiveCallParty | null;
  className?: string;
  /** Caps panel height so it expands above the control bar without leaving the viewport. */
  maxHeight?: number;
}) => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const [tab, setTab] = useState<WorkspaceTab>("notes");
  const [noteText, setNoteText] = useState("");
  const [createNote, { isPending: savingNote }] = useCreate();

  const contactId = party?.contactId ?? null;
  const contactQueryId = contactId ?? "__none__";

  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactQueryId },
    { enabled: contactId != null },
  );

  const { data: tickets = [], isPending: ticketsPending } = useGetList<CrmTicket>(
    "tickets",
    {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "updated_at", order: "DESC" },
      filter:
        contactId != null
          ? {
              "contact_id@eq": contactId,
              "merged_into_ticket_id@is": null,
            }
          : undefined,
    },
    { enabled: contactId != null },
  );

  const { data: calls = [], isPending: callsPending } = useGetList<VoiceCall>(
    "voice_calls",
    {
      pagination: { page: 1, perPage: 5 },
      sort: { field: "created_at", order: "DESC" },
      filter: contactId != null ? { "contact_id@eq": contactId } : undefined,
    },
    { enabled: contactId != null },
  );

  useEffect(() => {
    setNoteText("");
    setTab(contactId != null ? "notes" : "details");
  }, [contactId, party?.phoneLabel]);

  const displayName =
    party?.contactName?.trim() ||
    (contact
      ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
      : "") ||
    party?.phoneLabel ||
    "Unknown caller";

  const companyName =
    party?.companyName?.trim() || contact?.company_name?.trim() || null;

  const contactPath = useMemo(() => {
    if (!contact?.id) {
      return contactId != null ? getPersonShowPath({ id: contactId }) : null;
    }
    return getPersonShowPath(contact);
  }, [contact, contactId]);

  const ticketCreatePath =
    contactId != null
      ? `/tickets/create?contact_id=${encodeURIComponent(String(contactId))}`
      : "/tickets/create";

  const handleSaveNote = async () => {
    const text = noteText.trim();
    if (!text) {
      notify("Write a note before saving.", { type: "warning" });
      return;
    }
    if (contactId == null) {
      notify("Link a CRM contact to save call notes.", { type: "warning" });
      return;
    }
    if (!identity?.id) {
      notify("You must be signed in to save notes.", { type: "warning" });
      return;
    }

    try {
      await createNote(
        "contact_notes",
        {
          data: {
            contact_id: contactId,
            text: `Call note:\n${text}`,
            date: new Date().toISOString(),
            organization_member_id: identity.id,
            status: "contacted",
          },
        },
        { returnPromise: true },
      );
      setNoteText("");
      notify("Call note saved", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not save note",
        { type: "error" },
      );
    }
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-t-xl border border-b-0 border-border/60 bg-background/95 shadow-lg backdrop-blur",
        className,
      )}
      style={{ maxHeight }}
    >
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserRound className="size-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {party?.phoneLabel}
              {companyName ? ` · ${companyName}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-1 rounded-lg bg-muted/50 p-0.5">
          {(
            [
              ["details", "Details"],
              ["notes", "Notes"],
              ["activity", "Activity"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                tab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === "details" ? (
          <div className="space-y-3">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="font-medium">{party?.phoneLabel ?? "—"}</dd>
              </div>
              {companyName ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Company</dt>
                  <dd className="font-medium">{companyName}</dd>
                </div>
              ) : null}
              {contactId == null ? (
                <p className="text-xs text-muted-foreground">
                  This number is not linked to a CRM contact yet. You can still
                  take notes after creating or linking a contact.
                </p>
              ) : null}
            </dl>
            <div className="flex flex-wrap gap-2">
              {contactPath ? (
                <Button asChild variant="secondary" size="sm">
                  <Link
                    to={contactPath}
                    className="inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="size-3.5" />
                    Open contact
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" size="sm">
                <Link
                  to={ticketCreatePath}
                  className="inline-flex items-center gap-1.5"
                >
                  <Ticket className="size-3.5" />
                  New ticket
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link
                  to="/meetings"
                  className="inline-flex items-center gap-1.5"
                >
                  <Calendar className="size-3.5" />
                  Meetings
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link
                  to="/messages"
                  className="inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="size-3.5" />
                  Messages
                </Link>
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="space-y-2">
            <Textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder={
                contactId != null
                  ? "Take notes during the call…"
                  : "Notes require a linked CRM contact."
              }
              disabled={contactId == null}
              rows={5}
              className="resize-none text-sm"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={contactId == null || savingNote || !noteText.trim()}
                onClick={() => void handleSaveNote()}
              >
                {savingNote ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Save note
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "activity" ? (
          <div className="space-y-4">
            {!contactId ? (
              <p className="text-sm text-muted-foreground">
                Link a contact to see tickets and call history.
              </p>
            ) : (
              <>
                <section>
                  <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Recent tickets
                  </h3>
                  {ticketsPending ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Loading…
                    </p>
                  ) : tickets.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No tickets for this contact.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {tickets.map((ticket) => (
                        <li key={ticket.id}>
                          <Link
                            to={ticketShowPath(ticket.id, ticket.status)}
                            className="block rounded-md border border-border/50 px-2.5 py-2 text-sm hover:bg-muted/40"
                          >
                            <span className="font-medium">#{ticket.id}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {ticket.status}
                            </span>
                            {ticket.subject ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {ticket.subject}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Recent calls
                  </h3>
                  {callsPending ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Loading…
                    </p>
                  ) : calls.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No prior calls logged.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {calls.map((call) => (
                        <li
                          key={call.id}
                          className="rounded-md border border-border/50 px-2.5 py-2 text-xs text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">
                            {call.direction === "inbound"
                              ? "Inbound"
                              : "Outbound"}
                          </span>
                          {" · "}
                          {voiceCallStatusLabel(call.status)}
                          {" · "}
                          {formatCallDuration(call.duration_seconds)}
                          <span className="mt-0.5 block">
                            {formatCallTimestamp(
                              call.ended_at ??
                                call.started_at ??
                                call.created_at,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
