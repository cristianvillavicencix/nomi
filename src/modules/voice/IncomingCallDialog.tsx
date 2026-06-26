import { Link } from "react-router";
import { Minimize2, Phone, PhoneOff, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPersonShowPath } from "@/app/routing";
import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";

export const IncomingCallDialog = () => {
  const voice = useVoiceCallContextOptional();
  if (!voice?.incomingCall || voice.incomingUiMinimized) return null;

  const info = voice.incomingCallerInfo;
  const title =
    info?.contactName?.trim() ||
    voice.incomingCallerLabel?.trim() ||
    info?.displayPhone ||
    "Incoming call";
  const subtitlePhone =
    info?.contactName && info.displayPhone ? info.displayPhone : null;

  const handleMinimize = () => {
    voice.dismissIncomingUi();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleMinimize();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => {
          event.preventDefault();
          handleMinimize();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          handleMinimize();
        }}
      >
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/10">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/30" />
              <Phone className="relative size-7 text-primary" aria-hidden />
            </span>
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">
                Answer when you are ready. You can keep working in the CRM — the
                call only ends if you tap Decline or hang up after answering.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {info?.isLookupPending ? (
                  <Badge variant="secondary">Looking up caller…</Badge>
                ) : info?.isKnownContact ? (
                  <Badge className="bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-200">
                    <UserRound className="mr-1 size-3.5" />
                    Contact in CRM
                  </Badge>
                ) : (
                  <Badge variant="outline">Unknown number</Badge>
                )}
              </div>
              {subtitlePhone ? (
                <p className="text-sm text-muted-foreground">{subtitlePhone}</p>
              ) : null}
              {info?.companyName ? (
                <p className="text-sm text-muted-foreground">{info.companyName}</p>
              ) : null}
              {!info?.isKnownContact && !info?.isLookupPending ? (
                <p className="text-sm text-muted-foreground">
                  This number is not saved as a contact yet.
                </p>
              ) : null}
              {info?.isKnownContact && info.contactId != null ? (
                <Button
                  asChild
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-sm"
                >
                  <Link
                    to={getPersonShowPath({ id: info.contactId })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View contact profile
                  </Link>
                </Button>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex w-full gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => voice.rejectIncoming()}
            >
              <PhoneOff className="mr-2 size-4" />
              Decline
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={() => voice.acceptIncoming()}
            >
              <Phone className="mr-2 size-4" />
              Answer
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleMinimize}
          >
            <Minimize2 className="mr-2 size-4" />
            Keep working — call keeps ringing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
