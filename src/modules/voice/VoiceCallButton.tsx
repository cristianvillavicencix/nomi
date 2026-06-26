import { Loader2, Phone, PhoneOff } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useTwilioVoice } from "@/modules/voice/useTwilioVoice";

type VoiceCallButtonProps = {
  phoneNumber: string | null | undefined;
  contactId?: Identifier | null;
  conversationId?: Identifier | null;
  dealId?: Identifier | null;
  className?: string;
};

export const VoiceCallButton = ({
  phoneNumber,
  contactId,
  conversationId,
  dealId,
  className,
}: VoiceCallButtonProps) => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const { callState, errorMessage, placeCall, hangUp, isBusy } =
    useTwilioVoice(voiceEnabled);

  const canCall = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "voice.calls.make",
  );

  const disabled =
    isPending ||
    !voiceEnabled ||
    !canCall ||
    !phoneNumber?.trim() ||
    callState === "initializing";

  const handleClick = async () => {
    if (isBusy) {
      hangUp();
      return;
    }

    if (!phoneNumber?.trim()) {
      notify("No phone number available for this conversation.", {
        type: "warning",
      });
      return;
    }

    try {
      await placeCall({
        to: phoneNumber,
        contactId,
        conversationId,
        dealId,
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not start the call",
        { type: "error" },
      );
    }
  };

  if ((!voiceEnabled && !isPending) || !canCall) {
    return null;
  }

  const label =
    callState === "open"
      ? "Hang up"
      : callState === "ringing"
        ? "Ringing…"
        : callState === "connecting" || callState === "initializing"
          ? "Connecting…"
          : "Call";

  return (
    <div className={className}>
      <Button
        type="button"
        variant={isBusy ? "destructive" : "outline"}
        size="sm"
        className="w-full justify-start"
        disabled={disabled && !isBusy}
        onClick={() => void handleClick()}
        title={errorMessage ?? undefined}
      >
        {callState === "connecting" || callState === "initializing" ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : isBusy ? (
          <PhoneOff className="mr-2 size-4" />
        ) : (
          <Phone className="mr-2 size-4" />
        )}
        {label}
      </Button>
    </div>
  );
};
