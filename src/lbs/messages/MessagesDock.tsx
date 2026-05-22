import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  MessageSquare,
  Minus,
} from "lucide-react";
import { useGetIdentity } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Conversation } from "@/lbs/types";
import { MessagesWorkspace } from "@/lbs/messages/MessagesWorkspace";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { useMessagesQuickAccess } from "@/lbs/messages/messagesQuickAccessContext";
import { useMessagesUnreadCounts } from "@/lbs/messages/useMessagesUnreadCounts";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";
import { cn } from "@/lib/utils";

export const MessagesDock = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const {
    isDockOpen,
    isOpening,
    openInbox,
    closeInbox,
    focusedConversation,
    clearFocusedConversation,
    draftSms,
    clearDraftSms,
    focusConversation,
    setActiveConversationId,
    viewConversation,
  } = useMessagesQuickAccess();
  const { totalUnread: totalUnreadCount } = useMessagesUnreadCounts();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const isMessagesPage = location.pathname.startsWith("/messages");

  const { conversations, deals, dmParticipants, members, contacts, isPending } =
    useInboxConversations({ enabled: !isMessagesPage });

  useEffect(() => {
    if (!draftSms) return;
    setSelectedConversation(null);
    setActiveConversationId(null);
    if (isMobile) setMobileShowChat(true);
  }, [draftSms, isMobile, setActiveConversationId]);

  useEffect(() => {
    if (!focusedConversation) return;
    viewConversation(focusedConversation);
    setSelectedConversation(focusedConversation);
    if (isMobile) setMobileShowChat(true);
    clearFocusedConversation();
  }, [clearFocusedConversation, focusedConversation, isMobile, viewConversation]);

  useEffect(() => {
    if (!isDockOpen) {
      setMobileShowChat(false);
      if (!isMessagesPage) {
        setActiveConversationId(null);
      }
    }
  }, [isDockOpen, isMessagesPage, setActiveConversationId]);

  useEffect(() => {
    if (!isDockOpen || !selectedConversation) return;
    const stillVisible = conversations.some(
      (conversation) => String(conversation.id) === String(selectedConversation.id),
    );
    if (!stillVisible && conversations[0]) {
      viewConversation(conversations[0]);
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, isDockOpen, selectedConversation, viewConversation]);

  const handleOpen = () => {
    openInbox();
  };

  const handleClose = () => {
    closeInbox();
    setActiveConversationId(null);
  };

  if (isMessagesPage) {
    return null;
  }

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

  const showOpeningState = isOpening && !selectedConversation && !draftSms;

  const workspace = showOpeningState ? (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin" />
      Opening conversation…
    </div>
  ) : (
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
      compact
      isMobile={isMobile}
      showMobileChat={mobileShowChat}
      onMobileBack={() => setMobileShowChat(false)}
      className="h-full"
    />
  );

  if (isMobile) {
    return (
      <>
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-end px-4">
          <div className="pointer-events-auto">
            <MessagesDockTrigger
              unreadCount={totalUnreadCount}
              isOpen={isDockOpen}
              onClick={isDockOpen ? handleClose : handleOpen}
            />
          </div>
        </div>
        <Sheet open={isDockOpen} onOpenChange={(open) => (open ? handleOpen() : handleClose())}>
          <SheetContent side="bottom" className="flex h-[92vh] flex-col gap-0 p-0">
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle>Messages</SheetTitle>
              <SheetDescription>Team chats, projects, and client SMS</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1">{workspace}</div>
            <div className="border-t px-4 py-3">
              <Button type="button" variant="outline" size="sm" asChild className="w-full">
                <Link to="/messages" onClick={handleClose}>
                  <ExternalLink className="size-4" />
                  Open full Messages page
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 flex justify-end px-4",
        isMobile ? "bottom-20" : "bottom-4",
      )}
    >
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        {isDockOpen ? (
          <div className="flex h-[min(560px,calc(100vh-6rem))] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquare className="size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">Messages</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Team chats, projects, and client SMS
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link to="/messages" onClick={handleClose}>
                    <ExternalLink className="size-4" />
                    Open page
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={handleClose}
                  aria-label="Minimize messages"
                >
                  <Minus className="size-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">{workspace}</div>
          </div>
        ) : null}

        <MessagesDockTrigger
          unreadCount={totalUnreadCount}
          isOpen={isDockOpen}
          onClick={isDockOpen ? handleClose : handleOpen}
        />
      </div>
    </div>
  );
};

const MessagesDockTrigger = ({
  unreadCount,
  isOpen,
  onClick,
}: {
  unreadCount: number;
  isOpen: boolean;
  onClick: () => void;
}) => (
  <Button
    type="button"
    size="lg"
    className={cn(
      "h-12 rounded-full px-4 shadow-lg",
      isOpen ? "bg-muted text-foreground hover:bg-muted/90" : "",
    )}
    onClick={onClick}
    aria-expanded={isOpen}
    aria-label={isOpen ? "Minimize messages dock" : "Open messages dock"}
  >
    {isOpen ? <ChevronDown className="size-4" /> : <MessageSquare className="size-4" />}
    <span className="font-medium">{isOpen ? "Minimize" : "Messages"}</span>
    {!isOpen && unreadCount > 0 ? (
      <Badge variant="default" className="ml-1 rounded-full px-2 py-0 text-[11px]">
        {formatUnreadBadgeCount(unreadCount)}
      </Badge>
    ) : null}
  </Button>
);
