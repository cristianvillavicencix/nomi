import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useGetIdentity, useNotify } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type {
  Conversation,
  ConversationMessage,
} from "@/lbs/types";
import { getConversationDisplay } from "@/lbs/messages/conversationDisplay";
import { buildMessagePreview } from "@/lbs/messages/conversationUtils";
import {
  MessagesIncomingBannerStack,
  type IncomingMessageNotification,
} from "@/lbs/messages/MessagesIncomingBanner";
import { playMessageNotificationSound } from "@/lbs/messages/messageNotificationSound";
import { showMessagingDesktopNotification } from "@/lbs/messages/messagingDesktopNotifications";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { useMessagesInboxRealtime } from "@/lbs/messages/useMessagesInboxRealtime";
import { useMessagesQuickAccess } from "@/lbs/messages/messagesQuickAccessContext";

type NotifyDecision = {
  toast: boolean;
  sound: boolean;
  os: boolean;
};

const trimNotifiedMessageIds = (notifiedMessageIds: Set<string>) => {
  if (notifiedMessageIds.size <= 500) return;
  const recentIds = Array.from(notifiedMessageIds).slice(-100);
  notifiedMessageIds.clear();
  recentIds.forEach((id) => notifiedMessageIds.add(id));
};

const isMessageFromCurrentMember = (
  message: ConversationMessage,
  currentMemberId: string | number | null | undefined,
) =>
  message.author_member_id != null &&
  String(message.author_member_id) === String(currentMemberId ?? "");

const shouldNotifyForMessage = (
  message: ConversationMessage,
  currentMemberId: string | number | null | undefined,
  activeConversationId: string | number | null | undefined,
  notifiedMessageIds: Set<string>,
): NotifyDecision | false => {
  const messageId = String(message.id);
  if (notifiedMessageIds.has(messageId)) return false;
  notifiedMessageIds.add(messageId);
  trimNotifiedMessageIds(notifiedMessageIds);

  if (message.channel === "sms") {
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
      toast: false,
      sound: !tabVisible,
      os: !tabVisible,
    };
  }

  return {
    toast: true,
    sound: true,
    os: !tabVisible,
  };
};

export const MessagesNotificationsLayer = () => {
  const location = useLocation();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const {
    activeConversationId,
    focusConversation,
    openInbox,
    viewConversation,
  } = useMessagesQuickAccess();
  const [incomingNotifications, setIncomingNotifications] = useState<
    IncomingMessageNotification[]
  >([]);

  const {
    conversations,
    deals,
    dmParticipants,
    members,
    contacts,
  } = useInboxConversations();

  const notifiedMessageIdsRef = useRef(new Set<string>());

  useMessagesInboxRealtime(true);

  const activeConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    setIncomingNotifications((current) =>
      current.filter(
        (entry) => entry.conversationId !== String(activeConversationId),
      ),
    );
  }, [activeConversationId]);

  const conversationsById = useMemo(
    () =>
      Object.fromEntries(
        conversations.map((entry) => [String(entry.id), entry]),
      ),
    [conversations],
  );

  const pushNotification = useCallback(
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

      const notification: IncomingMessageNotification = {
        id: String(message.id),
        conversationId: String(message.conversation_id),
        title: display?.title ?? "New message",
        preview: buildMessagePreview(message),
      };

      setIncomingNotifications((current) => {
        if (current.some((entry) => entry.id === notification.id)) {
          return current;
        }
        return [notification, ...current].slice(0, 4);
      });

      if (decision.sound) {
        playMessageNotificationSound();
      }

      if (decision.toast) {
        notify(`${notification.title}: ${notification.preview}`, {
          type: "info",
        });
      }

      if (decision.os) {
        showMessagingDesktopNotification({
          title: notification.title,
          body: notification.preview,
          tag: notification.id,
        });
      }
    },
    [
      contacts,
      conversationsById,
      deals,
      dmParticipants,
      identity?.id,
      members,
      notify,
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
            notifiedMessageIdsRef.current,
          );

          if (!decision) return;
          pushNotification(message, decision);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, pushNotification]);

  const dismissNotification = useCallback((id: string) => {
    setIncomingNotifications((current) =>
      current.filter((entry) => entry.id !== id),
    );
  }, []);

  const openNotification = useCallback(
    (notification: IncomingMessageNotification) => {
      const conversation = conversationsById[notification.conversationId];
      if (!conversation) return;

      dismissNotification(notification.id);
      viewConversation(conversation as Conversation);
      focusConversation(conversation as Conversation);

      if (!location.pathname.startsWith("/messages")) {
        openInbox();
      }
    },
    [
      conversationsById,
      dismissNotification,
      focusConversation,
      location.pathname,
      openInbox,
      viewConversation,
    ],
  );

  return (
    <MessagesIncomingBannerStack
      notifications={incomingNotifications}
      onDismiss={dismissNotification}
      onOpen={openNotification}
    />
  );
};
