import { useState } from "react";
import { Link } from "react-router";
import { Loader2, Phone, PhoneCall } from "lucide-react";
import { useGetIdentity, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { ActiveCallKeypad } from "@/modules/voice/ActiveCallKeypad";
import { useVoiceCallContextOptional } from "@/modules/voice/voiceCallContext";
import { useTwilioVoice } from "@/modules/voice/useTwilioVoice";
import {
  formatUsPhoneDisplayFromAny,
  normalizeUsPhoneToE164,
} from "@/utils/phone";

export const GlobalDialButton = () => {
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { voiceEnabled, isPending } = useMessagingEnabled();
  const { placeCall, isBusy } = useTwilioVoice(voiceEnabled);
  const voice = useVoiceCallContextOptional();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [isDialing, setIsDialing] = useState(false);

  const canCall = hasMemberCapability(
    identity as AccessIdentity | undefined,
    "voice.calls.make",
  );

  if (isPending || !voiceEnabled || !canCall) return null;

  const onCall = voice?.callState === "open" || voice?.isBusy;
  const preview = phone.trim()
    ? formatUsPhoneDisplayFromAny(phone.trim())
    : null;

  const appendDigit = (digit: string) => {
    setPhone((current) => `${current}${digit}`);
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
    if (isBusy) {
      notify("Finish the current call before dialing another number.", {
        type: "info",
      });
      return;
    }

    setIsDialing(true);
    try {
      await placeCall({ to: normalized });
      setPhone("");
      setOpen(false);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not start the call",
        { type: "error" },
      );
    } finally {
      setIsDialing(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <IconButton
              variant="secondary"
              className="relative size-9"
              aria-label="Dial"
              aria-expanded={open}
            >
              <Phone className="size-4" />
              {onCall ? (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
              ) : null}
            </IconButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Dial</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.5rem,320px)] p-0"
      >
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Quick dial</p>
          <p className="text-xs text-muted-foreground">
            Call any US number from your CRM line.
          </p>
        </div>

        <div className="space-y-3 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="global-dial-phone">Phone number</Label>
            <Input
              id="global-dial-phone"
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

          <ActiveCallKeypad
            onDigit={appendDigit}
            className="rounded-lg border bg-muted/20 p-2"
          />

          <Button
            type="button"
            className="w-full"
            disabled={isDialing || isBusy || !phone.trim()}
            onClick={() => void handleDial()}
          >
            {isDialing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PhoneCall className="size-4" />
            )}
            {isDialing ? "Calling…" : isBusy ? "On a call" : "Call"}
          </Button>
        </div>

        <div className="border-t px-3 py-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/messages" onClick={() => setOpen(false)}>
              Open Messages
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
