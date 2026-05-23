import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useGetList, useNotify, useRefresh } from "ra-core";
import type { Identifier } from "ra-core";
import { Input } from "@/components/ui/input";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { cn } from "@/lib/utils";
import { InboxTabs } from "@/lbs/messages/inbox/InboxTabs";
import { InboxList } from "@/lbs/messages/inbox/InboxList";
import { filterInboxConversations } from "@/lbs/messages/inbox/filterInboxConversations";
import {
  DEFAULT_INBOX_FILTERS,
  type InboxFilterState,
  type InboxTab,
} from "@/lbs/messages/messagesHubTypes";
import { useMessagesQuickAccess } from "@/lbs/messages/messagesQuickAccessContext";
import { useMessagesUnreadCounts } from "@/lbs/messages/useMessagesUnreadCounts";
import {
  contactAlreadyHasClientConversation,
  contactHasSmsPhone,
  getContactDisplayName,
  getContactPhoneLabel,
} from "@/lbs/messages/messageContactUtils";
import { getInitials } from "@/lbs/messages/conversationDisplay";

const INBOX_PAGE_SIZE = 30;

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
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/35",
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
          {contact.company_name?.trim() || "Client contact"} ·{" "}
          {getContactPhoneLabel(contact)}
        </span>
      </span>
    </button>
  );
};

export const MessagesInbox = (props: {
  conversations: Conversation[];
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
  selectedConversationId?: Identifier;
  onSelectConversation: (conversation: Conversation) => void;
  isPending: boolean;
  compact?: boolean;
  onLoadMore?: () => void;
  hasMoreConversations?: boolean;
  loadingMoreConversations?: boolean;
}) => {
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [filters, setFilters] = useState<InboxFilterState>(
    DEFAULT_INBOX_FILTERS,
  );
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [startingContactId, setStartingContactId] = useState<Identifier | null>(
    null,
  );
  const { openSms } = useMessagesQuickAccess();
  const notify = useNotify();
  const refresh = useRefresh();
  const unread = useMessagesUnreadCounts(
    props.dmParticipants,
    props.conversations,
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(filters.query.trim());
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [filters.query]);

  const filteredConversations = useMemo(
    () =>
      filterInboxConversations(props.conversations, activeTab, filters, {
        currentMemberId: props.currentMemberId,
        participations: props.dmParticipants,
      }),
    [
      activeTab,
      filters,
      props.conversations,
      props.currentMemberId,
      props.dmParticipants,
    ],
  );

  const tabCounts = useMemo(
    () => ({
      team: props.conversations.filter(
        (c) => c.type === "team_dm" || c.type === "project",
      ).length,
      unread: unread.totalUnread,
    }),
    [props.conversations, unread.totalUnread],
  );

  const { data: searchedContacts = [], isPending: isSearchingContacts } =
    useGetList<Contact>(
      "contacts",
      {
        filter: debouncedQuery ? { q: debouncedQuery } : {},
        pagination: { page: 1, perPage: 25 },
        sort: { field: "last_name", order: "ASC" },
      },
      { enabled: debouncedQuery.length > 0, staleTime: 15_000 },
    );

  const newSmsContacts = useMemo(() => {
    if (!debouncedQuery) return [];
    return searchedContacts.filter(
      (contact) =>
        contactHasSmsPhone(contact) &&
        !contactAlreadyHasClientConversation(contact, props.conversations),
    );
  }, [props.conversations, debouncedQuery, searchedContacts]);

  const handleStartClientSms = async (contact: Contact) => {
    setStartingContactId(contact.id);
    try {
      await openSms(contact);
      refresh();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not start SMS conversation",
        {
          type: "error",
        },
      );
    } finally {
      setStartingContactId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InboxTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={tabCounts}
        filters={filters}
        onFiltersChange={setFilters}
        members={props.members}
      />
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder="Search conversations or clients…"
            className="h-9 pl-9"
          />
        </div>
      </div>
      {props.isPending ? null : filteredConversations.length === 0 &&
        !debouncedQuery ? (
        <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center px-4 text-center text-sm text-muted-foreground">
          No conversations yet. Search for a client to start SMS.
        </div>
      ) : (
        <InboxList
          conversations={filteredConversations}
          deals={props.deals}
          dmParticipants={props.dmParticipants}
          members={props.members}
          contacts={props.contacts}
          currentMemberId={props.currentMemberId}
          selectedConversationId={props.selectedConversationId}
          onSelectConversation={props.onSelectConversation}
          isConversationUnread={unread.isConversationUnread}
          onLoadMore={props.onLoadMore}
          hasMore={props.hasMoreConversations}
          loadingMore={props.loadingMoreConversations}
        />
      )}

      {debouncedQuery.length > 0 &&
      (isSearchingContacts || newSmsContacts.length > 0) ? (
        <div className="border-t border-border/40 px-2 py-3">
          <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <UserPlus className="size-3.5" />
            Start SMS with a contact
          </div>
          {isSearchingContacts ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Searching contacts…
            </p>
          ) : newSmsContacts.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
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
    </div>
  );
};

export { INBOX_PAGE_SIZE };
