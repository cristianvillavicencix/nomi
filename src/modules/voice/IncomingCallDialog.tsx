import { Link } from "react-router";
import { Phone, PhoneOff, UserRound } from "lucide-react";
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
  if (!voice?.incomingCall) return null;

  const info = voice.incomingCallerInfo;
  const title =
    info?.contactName?.trim() ||
    voice.incomingCallerLabel?.trim() ||
    info?.displayPhone ||
    "Incoming call";
  const subtitlePhone =
    info?.contactName && info.displayPhone ? info.displayPhone : null;

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
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-center">
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
                    onClick={() => voice.rejectIncoming()}
                  >
                    View contact profile
                  </Link>
                </Button>
              ) : null}
            </div>
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
