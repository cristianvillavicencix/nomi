import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useNotify } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  formatUnreadBadgeCount,
  useMessagesUnreadCounts,
} from "@/modules/messages/useMessagesUnreadCounts";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useSendClientSms } from "@/modules/messages/useClientSms";
import {
  formatSmsLengthSummary,
  isSmsLengthOverLimit,
} from "@/modules/messages/smsMessageLimits";
import {
  SMS_COMPOSER_TEXTAREA_PROPS,
} from "@/modules/messages/smsComposerInputProps";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
import { cn } from "@/lib/utils";

export const GlobalMessagesButton = () => {
  const notify = useNotify();
  const { smsEnabled, isPending } = useMessagingEnabled();
  const canSend = useMemberCapability("messaging.send");
  const sendClientSms = useSendClientSms();
  const { totalUnread } = useMessagesUnreadCounts();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const smsOverLimit = isSmsLengthOverLimit(body);
  const lengthSummary = useMemo(() => formatSmsLengthSummary(body), [body]);

  if (isPending || !smsEnabled || !canSend) return null;

  const handleSend = async () => {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      notify("Write a message before sending.", { type: "warning" });
      return;
    }
    const normalized = normalizeUsPhoneToE164(phone.trim());
    if (!normalized) {
      notify("Enter a valid US phone number (10 digits or +1…).", {
        type: "warning",
      });
      return;
    }
    if (smsOverLimit) {
      notify("Message is too long for SMS.", { type: "warning" });
      return;
    }

    setIsSending(true);
    try {
      await sendClientSms({
        body: trimmedBody,
        externalPhone: normalized,
      });
      setBody("");
      setPhone("");
      setOpen(false);
      notify("Message sent", { type: "success" });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not send message",
        { type: "error" },
      );
    } finally {
      setIsSending(false);
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
              aria-label="Quick message"
              aria-expanded={open}
            >
              <MessageSquare className="size-4" />
              {totalUnread > 0 ? (
                <Badge className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]">
                  {formatUnreadBadgeCount(totalUnread)}
                </Badge>
              ) : null}
            </IconButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Quick message</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.5rem,340px)] p-0"
      >
        <div className="border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Quick message</p>
          <p className="text-xs text-muted-foreground">
            Send an SMS without leaving this page.
          </p>
        </div>

        <div className="space-y-3 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="global-sms-phone">To</Label>
            <Input
              id="global-sms-phone"
              name="sms-to-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(555) 123-4567"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              disabled={isSending}
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="global-sms-body">Message</Label>
            <Textarea
              id="global-sms-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Type a quick SMS…"
              rows={3}
              disabled={isSending}
              {...SMS_COMPOSER_TEXTAREA_PROPS}
              className="resize-none text-sm"
            />
            <p
              className={cn(
                "text-[11px] text-muted-foreground",
                smsOverLimit && "text-destructive",
              )}
            >
              {lengthSummary}
            </p>
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={
              isSending || !phone.trim() || !body.trim() || smsOverLimit
            }
            onClick={() => void handleSend()}
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {isSending ? "Sending…" : "Send SMS"}
          </Button>
        </div>

        <div className="border-t px-3 py-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/messages" onClick={() => setOpen(false)}>
              Open inbox
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
