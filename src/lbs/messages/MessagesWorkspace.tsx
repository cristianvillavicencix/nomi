import { MessageSquare } from "lucide-react";
import type { Identifier } from "ra-core";
import { cn } from "@/lib/utils";
import type { ClientSmsDraft, Contact, Conversation, ConversationParticipant, LbsDeal, OrganizationMember } from "@/lbs/types";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";
import { ConversationThread } from "@/lbs/messages/ConversationThread";
import { ConversationChatHeader } from "@/lbs/messages/ConversationChatHeader";
import { MessagesInboxPanel } from "@/lbs/messages/MessagesInboxPanel";

export const MessagesWorkspace = ({
  conversations,
  deals,
  dmParticipants,
  members,
  contacts,
  currentMemberId,
  selectedConversation,
  clientSmsDraft,
  onSelectConversation,
  onClientSmsSent,
  isPending,
  compact = false,
  showMobileChat,
  onMobileBack,
  isMobile = false,
  className,
}: {
  conversations: Conversation[];
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts: Contact[];
  currentMemberId?: Identifier;
  selectedConversation: Conversation | null;
  clientSmsDraft?: ClientSmsDraft | null;
  onSelectConversation: (conversation: Conversation) => void;
  onClientSmsSent?: (conversation: Conversation) => void;
  isPending: boolean;
  compact?: boolean;
  showMobileChat?: boolean;
  onMobileBack?: () => void;
  isMobile?: boolean;
  className?: string;
}) => {
  const showInbox = !isMobile || !showMobileChat;
  const showChat = !isMobile || showMobileChat || !!clientSmsDraft;
  const activeConversation = selectedConversation;
  const showThread = activeConversation || clientSmsDraft;
  const activeContact =
    clientSmsDraft?.contact ??
    (activeConversation?.contact_id != null
      ? contacts.find(
          (entry) => String(entry.id) === String(activeConversation.contact_id),
        )
      : undefined);

  return (
    <div className={cn("flex min-h-0 flex-1 overflow-hidden bg-background", className)}>
      <aside
        className={cn(
          "flex min-h-0 flex-col border-r bg-muted/10",
          compact ? "w-[280px] shrink-0" : "w-full md:w-[340px] lg:w-[360px]",
          !showInbox && "hidden md:flex",
        )}
      >
        <MessagesInboxPanel
          conversations={conversations}
          deals={deals}
          dmParticipants={dmParticipants}
          members={members}
          contacts={contacts}
          currentMemberId={currentMemberId}
          selectedConversationId={selectedConversation?.id}
          onSelectConversation={onSelectConversation}
          isPending={isPending}
          compact={compact}
        />
      </aside>

      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10",
          !showChat && "hidden md:flex",
        )}
      >
        {showThread ? (
          <>
            {activeConversation ? (
              <ConversationChatHeader
                conversation={activeConversation}
                deals={deals}
                dmParticipants={dmParticipants}
                members={members}
                contacts={contacts}
                currentMemberId={currentMemberId}
                showBackButton={isMobile}
                onBack={onMobileBack}
                compact={compact}
              />
            ) : clientSmsDraft ? (
              <div className={cn("border-b bg-background px-4", compact ? "py-2" : "py-3")}>
                <div className="truncate font-semibold">
                  {getContactDisplayName(clientSmsDraft.contact)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {clientSmsDraft.contact.company_name?.trim() || "New SMS"}
                </div>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 px-3 pb-3 pt-2">
              <ConversationThread
                conversation={activeConversation}
                clientSmsDraft={clientSmsDraft}
                composerContact={activeContact}
                onClientSmsSent={onClientSmsSent}
              />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-muted p-4">
              <MessageSquare className="size-8 text-muted-foreground" />
            </div>
            <p className="mt-4 text-base font-medium">Select a conversation</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Pick a chat on the left or search for a client to start an SMS.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
