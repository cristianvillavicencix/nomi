import { useCallback, useEffect, useMemo, useRef } from "react";
import { useGetIdentity } from "ra-core";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { ConversationMessage } from "@/modules/types";
import { getConversationDisplay } from "@/modules/messages/conversationDisplay";
import { buildMessagePreview } from "@/modules/messages/conversationUtils";
import { useInboxConversations } from "@/modules/messages/useInboxConversations";
import { useMessagesInboxRealtime } from "@/modules/messages/useMessagesInboxRealtime";
import { useMessagesQuickAccess } from "@/modules/messages/messagesQuickAccessContext";
import { useNotificationPrefsContext } from "@/modules/notifications/NotificationPrefsContext";
import type { NotificationCategory } from "@/modules/notifications/types";
import { getMessagesConversationPath } from "@/modules/messages/messagesRouting";

type NotifyDecision = {
  category: NotificationCategory;
  sound: boolean;
  desktop: boolean;
};

const trimNotifiedIds = (notifiedIds: Set<string>) => {
  if (notifiedIds.size <= 500) return;
  const recentIds = Array.from(notifiedIds).slice(-100);
  notifiedIds.clear();
  recentIds.forEach((id) => notifiedIds.add(id));
};

const isMessageFromCurrentMember = (
  message: ConversationMessage,
  currentMemberId: string | number | null | undefined,
) =>
  message.author_member_id != null &&
  String(message.author_member_id) === String(currentMemberId ?? "");

const resolveMessageCategory = (
  message: ConversationMessage,
): NotificationCategory => {
  if (message.channel === "sms" || message.channel === "whatsapp") {
    return "messages_sms";
  }
  return "messages_internal";
};

const shouldNotifyForMessage = (
  message: ConversationMessage,
  currentMemberId: string | number | null | undefined,
  activeConversationId: string | number | null | undefined,
  notifiedIds: Set<string>,
): NotifyDecision | false => {
  const messageId = String(message.id);
  if (notifiedIds.has(messageId)) return false;
  notifiedIds.add(messageId);
  trimNotifiedIds(notifiedIds);

  const category = resolveMessageCategory(message);

  if (category === "messages_sms") {
    if (message.direction === "outbound") return false;
  } else if (message.channel === "internal" || !message.channel) {
    if (isMessageFromCurrentMember(message, currentMemberId)) return false;
  } else if (message.direction === "outbound") {
    return false;
  }

  const isActiveThread =
    String(message.conversation_id) === String(activeConversationId ?? "");
  const tabVisible =
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    document.hasFocus();

  if (isActiveThread && tabVisible) {
    return false;
  }

  if (isActiveThread) {
    return {
      category,
      sound: !tabVisible,
      desktop: !tabVisible,
    };
  }

  return {
    category,
    sound: true,
    desktop: !tabVisible,
  };
};

export const useMessagesNotifications = () => {
  const { identity } = useGetIdentity();
  const { activeConversationId } = useMessagesQuickAccess();
  const { pushNotification } = useNotificationPrefsContext();
  const { conversations, deals, dmParticipants, members, contacts } =
    useInboxConversations();

  const notifiedIdsRef = useRef(new Set<string>());
  const activeConversationIdRef = useRef(activeConversationId);

  useMessagesInboxRealtime(true);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const conversationsById = useMemo(
    () =>
      Object.fromEntries(
        conversations.map((entry) => [String(entry.id), entry]),
      ),
    [conversations],
  );

  const notifyMessage = useCallback(
    (message: ConversationMessage, decision: NotifyDecision) => {
      const conversation = conversationsById[String(message.conversation_id)];
      const display = conversation
        ? getConversationDisplay({
            conversation,
            deals,
            dmParticipants,
            members,
            contacts,
            currentMemberId: identity?.id,
          })
        : null;

      pushNotification({
        category: decision.category,
        title: display?.title ?? "New message",
        body: buildMessagePreview(message),
        tag: `msg-${message.id}`,
        href: conversation
          ? getMessagesConversationPath(conversation.id)
          : "/messages",
        sound: decision.sound,
        desktop: decision.desktop,
      });
    },
    [
      contacts,
      conversationsById,
      deals,
      dmParticipants,
      identity?.id,
      members,
      pushNotification,
    ],
  );

  useEffect(() => {
    const channel = supabase
      .channel("messages_incoming_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        (payload) => {
          const message = payload.new as ConversationMessage | undefined;
          if (!message?.conversation_id || message.id == null) return;

          const decision = shouldNotifyForMessage(
            message,
            identity?.id,
            activeConversationIdRef.current,
            notifiedIdsRef.current,
          );

          if (!decision) return;
          notifyMessage(message, decision);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, notifyMessage]);
};
