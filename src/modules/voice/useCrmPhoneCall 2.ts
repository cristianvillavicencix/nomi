import { useCallback } from "react";
import { useGetIdentity, useNotify } from "ra-core";
import type { Identifier } from "ra-core";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useTwilioVoice } from "@/modules/voice/useTwilioVoice";

export type CrmPhoneCallParams = {
  to: string;
  contactId?: Identifier | null;
  conversationId?: Identifier | null;
  dealId?: Identifier | null;
};

export const useCrmPhoneCall = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const { placeCall } = useTwilioVoice(voiceEnabled);

  const canCall = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "voice.calls.make",
  );

  const voiceReady = voiceEnabled && !isPending;

  const callPhone = useCallback(
    async (params: CrmPhoneCallParams) => {
      const to = params.to?.trim();
      if (!to) {
        notify("No phone number available.", { type: "warning" });
        return;
      }
      if (!canCall) {
        notify("You do not have permission to make calls.", { type: "warning" });
        return;
      }
      if (!voiceReady) {
        notify("Enable voice in Settings → Communications", { type: "info" });
        return;
      }

      try {
        await placeCall({
          to,
          contactId: params.contactId,
          conversationId: params.conversationId,
          dealId: params.dealId,
        });
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Could not start the call",
          { type: "error" },
        );
      }
    },
    [canCall, voiceReady, placeCall, notify],
  );

  return { canCall, voiceReady, callPhone };
};
