import { MessageSquare } from "lucide-react";
import { useState } from "react";
import type { Identifier } from "ra-core";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ClientSmsDraft, Contact, Conversation, ConversationParticipant, LbsDeal, OrganizationMember } from "@/lbs/types";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";
import { ConversationThread } from "@/lbs/messages/ConversationThread";
import { ConversationChatHeader } from "@/lbs/messages/ConversationChatHeader";
import { MessagesInbox } from "@/lbs/messages/inbox/MessagesInbox";
import { ContextPanel, ContextPanelContent } from "@/lbs/messages/context/ContextPanel";
import { useMessagesContextPanel } from "@/lbs/messages/context/useMessagesContextPanel";

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
  onLoadMoreInbox,
  hasMoreInbox,
  loadingMoreInbox,
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
  onLoadMoreInbox?: () => void;
  hasMoreInbox?: boolean;
  loadingMoreInbox?: boolean;
}) => {
  const { open: contextOpen, toggle: toggleContext, close: closeContext } = useMessagesContextPanel();
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
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

  const activeDeal =
    activeConversation?.deal_id != null
      ? deals.find((entry) => String(entry.id) === String(activeConversation.deal_id))
      : undefined;

  const handleToggleContext = () => {
    if (isMobile) {
      setMobileContextOpen(true);
      return;
    }
    toggleContext();
  };

  return (
    <div className={cn("flex min-h-0 flex-1 overflow-hidden bg-background", className)}>
      <aside
        className={cn(
          "flex min-h-0 flex-col border-r border-border/30 bg-muted/5",
          compact ? "w-[300px] shrink-0" : "w-full shrink-0 md:w-[320px] lg:w-[360px] xl:w-[400px]",
          !showInbox && "hidden md:flex",
        )}
      >
        <MessagesInbox
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
          onLoadMore={onLoadMoreInbox}
          hasMoreConversations={hasMoreInbox}
          loadingMoreConversations={loadingMoreInbox}
        />
      </aside>

      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col bg-background",
          contextOpen && "lg:border-r lg:border-border/30",
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
                contextOpen={isMobile ? mobileContextOpen : contextOpen}
                onToggleContext={handleToggleContext}
              />
            ) : clientSmsDraft ? (
              <div className={cn("border-b border-border/40 bg-background px-4", compact ? "py-2.5" : "py-3")}>
                <div className="truncate font-semibold">
                  {getContactDisplayName(clientSmsDraft.contact)}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {clientSmsDraft.contact.company_name?.trim() || "New SMS"}
                </div>
              </div>
            ) : null}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
            <MessageSquare className="size-9 text-muted-foreground/50" />
            <p className="mt-4 text-base font-medium">Select a conversation</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Pick a chat on the left or search for a client to start an SMS.
            </p>
          </div>
        )}
      </main>

      <ContextPanel
        conversation={activeConversation}
        contact={activeContact}
        deal={activeDeal}
        open={contextOpen}
        onClose={closeContext}
      />

      <Sheet open={mobileContextOpen} onOpenChange={setMobileContextOpen}>
        <SheetContent side="right" className="w-[min(100vw,360px)] p-0">
          <SheetHeader className="border-b border-border/40 px-4 py-3 text-left">
            <SheetTitle>Details</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <ContextPanelContent
              conversation={activeConversation}
              contact={activeContact}
              deal={activeDeal}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
