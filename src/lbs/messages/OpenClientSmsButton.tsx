import { MessageSquare } from "lucide-react";
import { type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/lbs/types";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import { useMessagingEnabled } from "@/lbs/messages/useMessagingEnabled";
import { cn } from "@/lib/utils";

export const OpenClientSmsButton = ({
  contact,
  dealId,
  variant = "outline",
  size = "sm",
  className,
  label = "SMS",
  showLabel = true,
  disabled,
}: {
  contact: Contact | null | undefined;
  dealId?: Identifier | null;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  label?: string;
  showLabel?: boolean;
  disabled?: boolean;
}) => {
  const { smsEnabled, isPending: isSettingsPending } = useMessagingEnabled();
  const messagesQuickAccess = useMessagesQuickAccessOptional();

  if (
    isSettingsPending ||
    !smsEnabled ||
    !contact ||
    !contactHasSmsPhone(contact) ||
    !messagesQuickAccess
  ) {
    return null;
  }

  const { openSms, isOpening } = messagesQuickAccess;
  const isIconOnly = size === "icon" || !showLabel;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(isIconOnly ? "size-9" : "gap-2", className)}
      disabled={disabled || isOpening}
      aria-label={isIconOnly ? label : undefined}
      onClick={() => {
        void openSms(contact, dealId ?? null);
      }}
    >
      <MessageSquare className="size-4" />
      {showLabel && size !== "icon" ? label : null}
    </Button>
  );
};
