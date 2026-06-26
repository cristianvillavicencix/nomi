import { Loader2, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";

const callStateLabel = (
  state: string,
  label: string | null,
) => {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "ringing":
      return label ? `Calling ${label}…` : "Ringing…";
    case "open":
      return label ? `On call with ${label}` : "On call";
    default:
      return null;
  }
};

export const ActiveCallBar = () => {
  const voice = useVoiceCallContextOptional();
  if (!voice) return null;
  if (voice.incomingCall) return null;

  const hasActiveCall =
    voice.activeCallLabel != null ||
    voice.callState === "connecting" ||
    voice.callState === "ringing" ||
    voice.callState === "open";

  const label = callStateLabel(voice.callState, voice.activeCallLabel);
  if (!hasActiveCall && !voice.errorMessage) return null;
  if (!hasActiveCall && voice.callState === "error") return null;

  const busy = voice.isBusy;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {label ?? "Call error"}
          </div>
          {voice.errorMessage ? (
            <div className="truncate text-xs text-destructive">
              {voice.errorMessage}
            </div>
          ) : null}
        </div>
        {busy || voice.callState === "error" ? (
          <Button
            type="button"
            size="sm"
            variant={busy ? "destructive" : "outline"}
            onClick={() => voice.hangUp()}
          >
            {voice.callState === "connecting" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <PhoneOff className="mr-2 size-4" />
            )}
            {busy ? "Hang up" : "Dismiss"}
          </Button>
        ) : (
          <Phone className="size-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
};
