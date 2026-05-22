import { useEffect, useMemo, useState } from "react";
import { useGetList, useNotify, useRefresh } from "ra-core";
import { MessageSquare, Search, UserPlus } from "lucide-react";
import type { Identifier } from "ra-core";
import { Input } from "@/components/ui/input";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { ConversationListItem } from "@/lbs/messages/ConversationListItem";
import { NewDirectMessageButton } from "@/lbs/messages/NewDirectMessageDialog";
import {
  contactAlreadyHasClientConversation,
  contactHasSmsPhone,
  getContactDisplayName,
  getContactPhoneLabel,
} from "@/lbs/messages/messageContactUtils";
import { getInitials } from "@/lbs/messages/conversationDisplay";
import { useOpenClientSms } from "@/lbs/messages/useClientSms";
import { cn } from "@/lib/utils";

const MessageSearchContactItem = ({
  contact,
  disabled,
  onSelect,
}: {
  contact: Contact;
  disabled?: boolean;
  onSelect: (contact: Contact) => void;
}) => {
  const label = getContactDisplayName(contact);

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
        disabled && "opacity-60",
      )}
      onClick={() => onSelect(contact)}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-sm font-medium text-emerald-800 dark:text-emerald-200">
        {getInitials(label)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {contact.company_name?.trim() || "Client contact"} · {getContactPhoneLabel(contact)}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        SMS
      </span>
    </button>
  );
};

export const MessagesInboxPanel = ({
  conversations,
  deals,
  dmParticipants,
  members,
  contacts = [],
  currentMemberId,
  selectedConversationId,
  onSelectConversation,
  onConversationCreated,
  isPending,
}: {
  conversations: Conversation[];
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
  selectedConversationId?: Identifier | null;
  onSelectConversation: (conversation: Conversation) => void;
  onConversationCreated: (conversation: Conversation) => void;
  isPending: boolean;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const { openClientSms } = useOpenClientSms();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [startingContactId, setStartingContactId] = useState<Identifier | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const { data: searchedContacts = [], isPending: isSearchingContacts } = useGetList<Contact>(
    "contacts",
    {
      filter: debouncedQuery ? { q: debouncedQuery } : {},
      pagination: { page: 1, perPage: 25 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: debouncedQuery.length > 0, staleTime: 15_000 },
  );

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;

    return conversations.filter((conversation) => {
      const contact =
        conversation.contact_id != null
          ? contacts.find((entry) => String(entry.id) === String(conversation.contact_id))
          : undefined;
      const contactName = contact
        ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
        : null;

      const haystack = [
        conversation.title,
        conversation.type,
        conversation.external_phone,
        contactName,
        contact?.company_name,
        conversation.deal_id != null
          ? deals.find((deal) => String(deal.id) === String(conversation.deal_id))?.name
          : null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [conversations, contacts, deals, query]);

  const newSmsContacts = useMemo(() => {
    if (!debouncedQuery) return [];

    return searchedContacts.filter(
      (contact) =>
        contactHasSmsPhone(contact) &&
        !contactAlreadyHasClientConversation(contact, conversations),
    );
  }, [conversations, debouncedQuery, searchedContacts]);

  const handleStartClientSms = async (contact: Contact) => {
    setStartingContactId(contact.id);
    try {
      const conversation = await openClientSms(contact);
      refresh();
      onConversationCreated(conversation);
      setQuery("");
      setDebouncedQuery("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not start SMS conversation", {
        type: "error",
      });
    } finally {
      setStartingContactId(null);
    }
  };

  const hasSearch = query.trim().length > 0;
  const showConversationEmpty =
    !isPending && filteredConversations.length === 0 && (!hasSearch || debouncedQuery.length > 0);
  const showContactsSection =
    debouncedQuery.length > 0 && (isSearchingContacts || newSmsContacts.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="border-b bg-background px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Messages</h1>
            <p className="text-xs text-muted-foreground">Team chats, projects, and client SMS</p>
          </div>
          <NewDirectMessageButton onConversationCreated={onConversationCreated} />
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations or clients..."
            className="bg-muted/40 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isPending ? null : (
          <>
            {filteredConversations.length > 0 ? (
              <div className="space-y-0.5">
                {filteredConversations.map((conversation) => (
                  <ConversationListItem
                    key={String(conversation.id)}
                    conversation={conversation}
                    isActive={String(selectedConversationId) === String(conversation.id)}
                    onSelect={onSelectConversation}
                    deals={deals}
                    dmParticipants={dmParticipants}
                    members={members}
                    contacts={contacts}
                    currentMemberId={currentMemberId}
                  />
                ))}
              </div>
            ) : showConversationEmpty ? (
              <div className="flex min-h-[180px] flex-col items-center justify-center px-4 text-center">
                <MessageSquare className="size-8 text-muted-foreground/70" />
                <p className="mt-3 text-sm font-medium">
                  {hasSearch ? "No conversations match your search" : "No conversations yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasSearch
                    ? "Check the contacts below to start a new SMS."
                    : "Search for a client or start a direct message with your team."}
                </p>
              </div>
            ) : null}

            {showContactsSection ? (
              <div className={cn(filteredConversations.length > 0 && "mt-4 border-t pt-3")}>
                <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <UserPlus className="size-3.5" />
                  Start SMS with a contact
                </div>
                {isSearchingContacts ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Searching contacts…</p>
                ) : newSmsContacts.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No new contacts with phone numbers match this search.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {newSmsContacts.map((contact) => (
                      <MessageSearchContactItem
                        key={String(contact.id)}
                        contact={contact}
                        disabled={String(startingContactId) === String(contact.id)}
                        onSelect={(entry) => void handleStartClientSms(entry)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
