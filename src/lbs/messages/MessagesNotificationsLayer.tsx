import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useGetIdentity, useNotify } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { Conversation, ConversationMessage, ConversationParticipant } from "@/lbs/types";
import { getConversationDisplay } from "@/lbs/messages/conversationDisplay";
import {
  MessagesIncomingBannerStack,
  type IncomingMessageNotification,
} from "@/lbs/messages/MessagesIncomingBanner";
import { playMessageNotificationSound } from "@/lbs/messages/messageNotificationSound";
import { getConversationReadAt } from "@/lbs/messages/messagesUnreadUtils";
import { showMessagingDesktopNotification } from "@/lbs/messages/messagingDesktopNotifications";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { useMessagesInboxRealtime } from "@/lbs/messages/useMessagesInboxRealtime";
import { useMessagesQuickAccess } from "@/lbs/messages/messagesQuickAccessContext";

const buildMessagePreview = (message: ConversationMessage) => {
  if (message.media_url) {
    return message.body?.trim() || "Sent an attachment";
  }
  return message.body?.trim() || "New message";
};

const shouldNotifyForMessage = (
  message: ConversationMessage,
  currentMemberId: string | number | null | undefined,
  activeConversationId: string | number | null | undefined,
  readAt?: string | null,
) => {
  if (String(message.conversation_id) === String(activeConversationId ?? "")) {
    return false;
  }

  if (message.created_at && readAt) {
    if (Date.parse(message.created_at) <= Date.parse(readAt)) {
      return false;
    }
  }

  if (message.channel === "sms") {
    return message.direction === "inbound";
  }

  if (message.channel === "internal" || !message.channel) {
    if (message.author_member_id == null) return true;
    return String(message.author_member_id) !== String(currentMemberId ?? "");
  }

  return message.direction === "inbound";
};

export const MessagesNotificationsLayer = () => {
  const location = useLocation();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const { activeConversationId, focusConversation, openInbox, viewConversation } =
    useMessagesQuickAccess();
  const [incomingNotifications, setIncomingNotifications] = useState<
    IncomingMessageNotification[]
  >([]);

  const { conversations, deals, dmParticipants, members, contacts, participations } =
    useInboxConversations();

  const participationsRef = useRef<ConversationParticipant[]>(participations);
  useEffect(() => {
    participationsRef.current = participations;
  }, [participations]);

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
    () => Object.fromEntries(conversations.map((entry) => [String(entry.id), entry])),
    [conversations],
  );

  const pushNotification = useCallback(
    (
      message: ConversationMessage,
    ) => {
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

      playMessageNotificationSound();

      /** In-app toast: every route unless user is already on /messages viewing this same thread (banner still shows). Hidden tab → always toast. */
      const onMessagesRoute = location.pathname.startsWith("/messages");
      if (
        !onMessagesRoute ||
        typeof document === "undefined" ||
        document.visibilityState !== "visible" ||
        String(activeConversationId ?? "") !== String(message.conversation_id)
      ) {
        notify(`${notification.title}: ${notification.preview}`, { type: "info" });
      }

      showMessagingDesktopNotification({
        title: notification.title,
        body: notification.preview,
        tag: notification.conversationId,
      });
    },
    [
      activeConversationId,
      contacts,
      conversationsById,
      deals,
      dmParticipants,
      identity?.id,
      location.pathname,
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
          if (!message?.conversation_id) return;

          const readAt = getConversationReadAt(
            message.conversation_id,
            participationsRef.current,
          );

          if (
            !shouldNotifyForMessage(
              message,
              identity?.id,
              activeConversationIdRef.current,
              readAt,
            )
          ) {
            return;
          }
          pushNotification(message);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.id, pushNotification]);

  const dismissNotification = useCallback((id: string) => {
    setIncomingNotifications((current) => current.filter((entry) => entry.id !== id));
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
