import { ChevronUp, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";

export const IncomingCallBanner = () => {
  const voice = useVoiceCallContextOptional();
  if (!voice?.incomingCall || !voice.incomingUiMinimized) return null;

  const info = voice.incomingCallerInfo;
  const title =
    info?.contactName?.trim() ||
    voice.incomingCallerLabel?.trim() ||
    info?.displayPhone ||
    "Incoming call";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border border-primary/30 bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => voice.expandIncomingUi()}
        >
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/25" />
            <Phone className="relative size-4 text-primary" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              Incoming call · tap to expand
            </span>
          </span>
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => voice.rejectIncoming()}
            aria-label="Decline call"
          >
            <PhoneOff className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => voice.acceptIncoming()}
            aria-label="Answer call"
          >
            <Phone className="mr-1 size-4" />
            Answer
          </Button>
        </div>
      </div>
    </div>
  );
};
