import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, UserPlus } from "lucide-react";
import { useGetList, useNotify, useRefresh } from "ra-core";
import type { Identifier } from "ra-core";
import { Input } from "@/components/ui/input";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/modules/types";
import { cn } from "@/lib/utils";
import { InboxTabs } from "@/modules/messages/inbox/InboxTabs";
import { InboxList } from "@/modules/messages/inbox/InboxList";
import { TeamMembersList } from "@/modules/messages/inbox/TeamMembersList";
import { filterInboxConversations } from "@/modules/messages/inbox/filterInboxConversations";
import {
  DEFAULT_INBOX_FILTERS,
  type InboxFilterState,
  type InboxTab,
} from "@/modules/messages/messagesHubTypes";
import { useMessagesQuickAccess } from "@/modules/messages/messagesQuickAccessContext";
import { useMessagesUnreadCounts } from "@/modules/messages/useMessagesUnreadCounts";
import {
  contactAlreadyHasClientConversation,
  contactHasSmsPhone,
  findClientConversationByPhone,
  getContactDisplayName,
  getContactPhoneLabel,
  getPrimaryContactPhone,
  normalizePhoneSearchQuery,
} from "@/modules/messages/messageContactUtils";
import { formatUsPhoneDisplayFromAny } from "@/utils/phone";
import { getInitials } from "@/modules/messages/conversationDisplay";

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

const MessageSearchPhoneItem = ({
  phoneE164,
  disabled,
  onSelect,
}: {
  phoneE164: string;
  disabled?: boolean;
  onSelect: (phoneE164: string) => void;
}) => {
  const display = formatUsPhoneDisplayFromAny(phoneE164);

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/35",
        disabled && "opacity-60",
      )}
      onClick={() => onSelect(phoneE164)}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-sky-500/10 text-sky-800 dark:text-sky-200">
        <MessageSquare className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">Text {display}</span>
        <span className="block truncate text-sm text-muted-foreground">
          Not saved as a contact · start a new SMS
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
  const [startingPhone, setStartingPhone] = useState<string | null>(null);
  const { openSms, openSmsToPhone } = useMessagesQuickAccess();
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

  const teamTabProjectConversations = useMemo(
    () =>
      filteredConversations.filter(
        (conversation) => conversation.type === "project",
      ),
    [filteredConversations],
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

  const searchedPhoneE164 = useMemo(
    () => normalizePhoneSearchQuery(debouncedQuery),
    [debouncedQuery],
  );

  const showPhoneSmsOption = useMemo(() => {
    if (!searchedPhoneE164) return false;
    const existing = findClientConversationByPhone(
      props.conversations,
      searchedPhoneE164,
    );
    if (existing?.last_message_at) return false;
    const matchingContact = searchedContacts.find((contact) => {
      if (!contactHasSmsPhone(contact)) return false;
      return getPrimaryContactPhone(contact) === searchedPhoneE164;
    });
    if (
      matchingContact &&
      !contactAlreadyHasClientConversation(matchingContact, props.conversations)
    ) {
      return false;
    }
    return true;
  }, [props.conversations, searchedContacts, searchedPhoneE164]);

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

  const handleStartPhoneSms = async (phoneE164: string) => {
    setStartingPhone(phoneE164);
    try {
      await openSmsToPhone(phoneE164);
      refresh();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Could not start SMS conversation",
        { type: "error" },
      );
    } finally {
      setStartingPhone(null);
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
            placeholder="Search conversations, clients, or phone…"
            className="h-9 pl-9"
          />
        </div>
      </div>
      {activeTab === "team" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Team members
          </div>
          <TeamMembersList
            conversations={props.conversations}
            selectedConversationId={props.selectedConversationId}
            onSelectConversation={props.onSelectConversation}
          />
          {teamTabProjectConversations.length > 0 ? (
            <>
              <div className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Project chats
              </div>
              <InboxList
                conversations={teamTabProjectConversations}
                deals={props.deals}
                dmParticipants={props.dmParticipants}
                members={props.members}
                contacts={props.contacts}
                currentMemberId={props.currentMemberId}
                selectedConversationId={props.selectedConversationId}
                onSelectConversation={props.onSelectConversation}
                isConversationUnread={unread.isConversationUnread}
                getUnreadCount={unread.getUnreadCount}
              />
            </>
          ) : null}
        </div>
      ) : props.isPending ? null : filteredConversations.length === 0 &&
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
          getUnreadCount={unread.getUnreadCount}
          onLoadMore={props.onLoadMore}
          hasMore={props.hasMoreConversations}
          loadingMore={props.loadingMoreConversations}
        />
      )}

      {debouncedQuery.length > 0 &&
      (showPhoneSmsOption ||
        isSearchingContacts ||
        newSmsContacts.length > 0) ? (
        <div className="border-t border-border/40 px-2 py-3">
          {showPhoneSmsOption && searchedPhoneE164 ? (
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="size-3.5" />
                Text a number
              </div>
              <MessageSearchPhoneItem
                phoneE164={searchedPhoneE164}
                disabled={startingPhone === searchedPhoneE164}
                onSelect={(phone) => void handleStartPhoneSms(phone)}
              />
            </div>
          ) : null}

          {isSearchingContacts || newSmsContacts.length > 0 ? (
            <>
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
                  {searchedPhoneE164
                    ? "No matching contacts with phone numbers."
                    : "No new contacts with phone numbers match this search."}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {newSmsContacts.map((contact) => (
                    <MessageSearchContactItem
                      key={String(contact.id)}
                      contact={contact}
                      disabled={
                        String(startingContactId) === String(contact.id)
                      }
                      onSelect={(entry) => void handleStartClientSms(entry)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export { INBOX_PAGE_SIZE };
