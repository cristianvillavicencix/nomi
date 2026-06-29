import { useState } from "react";
import { Phone } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useTwilioVoice } from "@/modules/voice/useTwilioVoice";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import {
  formatUsPhoneDisplayFromAny,
  normalizeUsPhoneToE164,
} from "@/utils/phone";

export const VoiceDialDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const notify = useNotify();
  const { voiceEnabled } = useMessagingEnabled();
  const { placeCall, isBusy } = useTwilioVoice(voiceEnabled);
  const [phone, setPhone] = useState("");
  const [isDialing, setIsDialing] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !isDialing) {
      setPhone("");
    }
    onOpenChange(nextOpen);
  };

  const handleDial = async () => {
    const normalized =
      normalizeUsPhoneToE164(phone.trim()) ?? phone.trim();
    if (!normalized.startsWith("+")) {
      notify("Enter a valid US phone number (10 digits or +1…).", {
        type: "warning",
      });
      return;
    }

    setIsDialing(true);
    try {
      await placeCall({ to: normalized });
      setPhone("");
      onOpenChange(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not start the call",
        { type: "error" },
      );
    } finally {
      setIsDialing(false);
    }
  };

  const preview = phone.trim()
    ? formatUsPhoneDisplayFromAny(phone.trim())
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call a number</DialogTitle>
          <DialogDescription>
            Dial any US number from your CRM line. The contact does not need to
            be saved in the CRM.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="voice-dial-phone">Phone number</Label>
          <Input
            id="voice-dial-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(555) 123-4567"
            inputMode="tel"
            autoFocus
            disabled={isDialing || isBusy}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleDial();
              }
            }}
          />
          {preview ? (
            <p className="text-xs text-muted-foreground">Calling {preview}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isDialing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleDial()}
            disabled={isDialing || isBusy || !phone.trim()}
          >
            <Phone className="mr-2 size-4" />
            {isDialing ? "Calling…" : "Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const VoiceDialButton = ({
  variant = "outline",
  size = "sm",
  className,
}: {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
}) => {
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const [open, setOpen] = useState(false);
  const canCall = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "voice.calls.make",
  );

  if (isPending || !voiceEnabled || !canCall) return null;

  const isIconOnly = size === "icon";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-label="Call a number"
        onClick={() => setOpen(true)}
      >
        <Phone className={isIconOnly ? "size-4" : "mr-2 size-4"} />
        {isIconOnly ? null : "Call number"}
      </Button>
      <VoiceDialDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
