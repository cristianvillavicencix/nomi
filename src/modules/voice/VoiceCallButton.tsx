import { Loader2, Phone, PhoneOff } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  variant?: "full" | "icon";
};

export const VoiceCallButton = ({
  phoneNumber,
  contactId,
  conversationId,
  dealId,
  className,
  variant = "full",
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

  if (!canCall) {
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

  const voiceDisabled = !voiceEnabled && !isPending;
  const noPhone = !phoneNumber?.trim();

  const tooltip = voiceDisabled
    ? "Enable voice in Settings → Communications"
    : noPhone
      ? "No phone number for this conversation"
      : (errorMessage ?? label);

  const button =
    variant === "icon" ? (
      <IconButton
        variant={isBusy ? "destructive" : "ghost"}
        className="size-9 shrink-0"
        disabled={(disabled && !isBusy) || voiceDisabled || noPhone}
        onClick={() => void handleClick()}
        aria-label={label}
      >
        {callState === "connecting" || callState === "initializing" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isBusy ? (
          <PhoneOff className="size-4" />
        ) : (
          <Phone className="size-4" />
        )}
      </IconButton>
    ) : (
      <Button
        type="button"
        variant={isBusy ? "destructive" : "secondary"}
        size="sm"
        className="w-full justify-start"
        disabled={(disabled && !isBusy) || voiceDisabled || noPhone}
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
    );

  if (variant === "full" && voiceDisabled) {
    return null;
  }

  return (
    <div className={className}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
