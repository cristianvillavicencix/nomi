import { useEffect, useState } from "react";
import { MessageSquare, Settings2 } from "lucide-react";
import { Link } from "react-router";
import { useGetIdentity } from "ra-core";
import { Button } from "@/components/ui/button";
import { PageLayout, ScrollableContentArea } from "@/components/atomic-crm/layout/page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Conversation } from "@/lbs/types";
import { MessagesWorkspace } from "@/lbs/messages/MessagesWorkspace";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { useMessagesQuickAccess } from "@/lbs/messages/messagesQuickAccessContext";

export const MessagesPage = () => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const {
    focusedConversation,
    clearFocusedConversation,
    draftSms,
    clearDraftSms,
    focusConversation,
    setActiveConversationId,
    viewConversation,
  } = useMessagesQuickAccess();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const { conversations, deals, dmParticipants, members, contacts, isPending } =
    useInboxConversations();

  useEffect(() => {
    if (!focusedConversation) return;
    viewConversation(focusedConversation);
    setSelectedConversation(focusedConversation);
    if (isMobile) setMobileShowChat(true);
    clearFocusedConversation();
  }, [clearFocusedConversation, focusedConversation, isMobile, viewConversation]);

  useEffect(() => {
    if (!draftSms) return;
    setSelectedConversation(null);
    setActiveConversationId(null);
    if (isMobile) setMobileShowChat(true);
  }, [draftSms, isMobile, setActiveConversationId]);

  useEffect(() => {
    if (draftSms || selectedConversation) return;
    if (conversations[0]) {
      viewConversation(conversations[0]);
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, draftSms, selectedConversation, viewConversation]);

  const handleSelectConversation = (conversation: Conversation) => {
    clearDraftSms();
    viewConversation(conversation);
    setSelectedConversation(conversation);
    if (isMobile) setMobileShowChat(true);
  };

  const handleClientSmsSent = (conversation: Conversation) => {
    clearDraftSms();
    viewConversation(conversation);
    focusConversation(conversation);
    setSelectedConversation(conversation);
    if (isMobile) setMobileShowChat(true);
  };

  return (
    <PageLayout>
      <ScrollableContentArea className="px-0 pb-2 md:px-3">
        <div className="mx-auto flex h-[calc(100vh-7rem)] w-full max-w-[1600px] flex-col overflow-hidden px-2 md:px-4">
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">Messages</h1>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings?section=messaging">
                <Settings2 className="mr-2 size-4" />
                Communications
              </Link>
            </Button>
          </div>
          <MessagesWorkspace
            conversations={conversations}
            deals={deals}
            dmParticipants={dmParticipants}
            members={members}
            contacts={contacts}
            currentMemberId={identity?.id}
            selectedConversation={selectedConversation}
            clientSmsDraft={draftSms}
            onSelectConversation={handleSelectConversation}
            onClientSmsSent={handleClientSmsSent}
            isPending={isPending}
            isMobile={isMobile}
            showMobileChat={mobileShowChat}
            onMobileBack={() => setMobileShowChat(false)}
            className="min-h-0 flex-1"
          />
        </div>
      </ScrollableContentArea>
    </PageLayout>
  );
};
