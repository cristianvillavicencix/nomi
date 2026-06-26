import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";

export const IncomingCallDialog = () => {
  const voice = useVoiceCallContextOptional();
  if (!voice?.incomingCall) return null;

  return (
    <Dialog open onOpenChange={() => voice.rejectIncoming()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/30" />
              <Phone className="relative size-7 text-primary" aria-hidden />
            </span>
          </div>
          <DialogTitle>Incoming call</DialogTitle>
          <DialogDescription>
            {voice.incomingCallerLabel
              ? `Call from ${voice.incomingCallerLabel}`
              : "Someone is calling your CRM number."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => voice.rejectIncoming()}
          >
            <PhoneOff className="mr-2 size-4" />
            Decline
          </Button>
          <Button type="button" onClick={() => voice.acceptIncoming()}>
            <Phone className="mr-2 size-4" />
            Answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
