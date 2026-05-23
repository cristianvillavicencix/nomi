import { useEffect, useState } from "react";
import { useGetIdentity } from "ra-core";
import { PageLayout } from "@/components/atomic-crm/layout/page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Conversation } from "@/lbs/types";
import { MessagesWorkspace } from "@/lbs/messages/MessagesWorkspace";
import { INBOX_PAGE_SIZE } from "@/lbs/messages/inbox/MessagesInbox";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { useMessagesQuickAccess } from "@/lbs/messages/messagesQuickAccessContext";

export const MessagesPage = () => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const [inboxPageSize, setInboxPageSize] = useState(INBOX_PAGE_SIZE);
  const [loadingMoreInbox, setLoadingMoreInbox] = useState(false);
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
    useInboxConversations({ pageSize: inboxPageSize });

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
    <PageLayout className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-background shadow-sm">
      <header className="shrink-0 border-b border-border/30 bg-background/80 px-4 py-2.5 backdrop-blur-sm md:px-5">
        <h1 className="text-base font-semibold tracking-tight">Messages</h1>
        <p className="text-xs text-muted-foreground">Team chat, projects, and client SMS</p>
      </header>

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
        onLoadMoreInbox={() => {
          setLoadingMoreInbox(true);
          setInboxPageSize((current) => current + INBOX_PAGE_SIZE);
          setTimeout(() => setLoadingMoreInbox(false), 300);
        }}
        hasMoreInbox={conversations.length >= inboxPageSize}
        loadingMoreInbox={loadingMoreInbox}
      />
    </PageLayout>
  );
};
