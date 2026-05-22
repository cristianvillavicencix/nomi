import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { PageLayout, ScrollableContentArea } from "@/components/atomic-crm/layout/page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Conversation } from "@/lbs/types";
import { ConversationThread } from "@/lbs/messages/ConversationThread";
import { ConversationChatHeader } from "@/lbs/messages/ConversationChatHeader";
import { MessagesInboxPanel } from "@/lbs/messages/MessagesInboxPanel";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { cn } from "@/lib/utils";

export const MessagesPage = () => {
  const isMobile = useIsMobile();
  const { identity } = useGetIdentity();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const { conversations, deals, dmParticipants, members, contacts, isPending } =
    useInboxConversations();

  useEffect(() => {
    if (!selectedConversation && conversations[0]) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  const activeConversation = selectedConversation;

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (isMobile) setMobileShowChat(true);
  };

  const handleConversationCreated = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (isMobile) setMobileShowChat(true);
  };

  const showInbox = !isMobile || !mobileShowChat;
  const showChat = !isMobile || mobileShowChat;

  return (
    <PageLayout>
      <ScrollableContentArea className="px-4 pb-4 md:px-6">
        <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-6xl overflow-hidden rounded-2xl border bg-background shadow-sm">
          <aside
            className={cn(
              "flex min-h-0 w-full flex-col border-r md:w-[340px] lg:w-[360px]",
              !showInbox && "hidden md:flex",
            )}
          >
            <MessagesInboxPanel
              conversations={conversations}
              deals={deals}
              dmParticipants={dmParticipants}
              members={members}
              contacts={contacts}
              currentMemberId={identity?.id}
              selectedConversationId={activeConversation?.id}
              onSelectConversation={handleSelectConversation}
              onConversationCreated={handleConversationCreated}
              isPending={isPending}
            />
          </aside>

          <main
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col bg-muted/10",
              !showChat && "hidden md:flex",
            )}
          >
            {activeConversation ? (
              <>
                <ConversationChatHeader
                  conversation={activeConversation}
                  deals={deals}
                  dmParticipants={dmParticipants}
                  members={members}
                  contacts={contacts}
                  currentMemberId={identity?.id}
                  showBackButton={isMobile}
                  onBack={() => setMobileShowChat(false)}
                />
                <div className="min-h-0 flex-1 px-3 pb-3 pt-2 md:px-4 md:pb-4">
                  <ConversationThread conversation={activeConversation} />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="rounded-full bg-muted p-4">
                  <MessageSquare className="size-8 text-muted-foreground" />
                </div>
                <p className="mt-4 text-base font-medium">Select a conversation</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Pick a chat on the left or start a new message with someone on your team.
                </p>
              </div>
            )}
          </main>
        </div>
      </ScrollableContentArea>
    </PageLayout>
  );
};
