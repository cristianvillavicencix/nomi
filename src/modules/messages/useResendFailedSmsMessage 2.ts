import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotify, type Identifier } from "ra-core";
import type { ConversationMessage } from "@/modules/types";
import { isSmsDeliveryRetryable } from "@/modules/messages/smsDeliveryStatus";
import { appendConversationMessageToCache } from "@/modules/messages/messagesRealtimeCache";
import { useSendClientSms } from "@/modules/messages/useClientSms";

export const useResendFailedSmsMessage = ({
  enabled = true,
  onSent,
}: {
  enabled?: boolean;
  onSent?: () => void;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const sendClientSms = useSendClientSms();
  const [retryingMessageId, setRetryingMessageId] = useState<Identifier | null>(
    null,
  );

  const retryMessage = useCallback(
    async (message: ConversationMessage) => {
      if (!enabled || !isSmsDeliveryRetryable(message)) {
        return;
      }

      setRetryingMessageId(message.id);
      appendConversationMessageToCache(queryClient, {
        ...message,
        sms_delivery_status: "sending",
        sms_error_code: null,
      });

      try {
        const result = await sendClientSms({
          resendMessageId: message.id,
        });

        if (result.message) {
          appendConversationMessageToCache(queryClient, result.message);
        }

        notify("Message resent", { type: "info" });
        onSent?.();
      } catch (error) {
        appendConversationMessageToCache(queryClient, message);
        notify(error instanceof Error ? error.message : "Failed to resend SMS", {
          type: "error",
        });
      } finally {
        setRetryingMessageId(null);
      }
    },
    [enabled, notify, onSent, queryClient, sendClientSms],
  );

  return {
    retryMessage: enabled ? retryMessage : undefined,
    retryingMessageId,
  };
};
