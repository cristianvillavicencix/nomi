import type { MouseEvent, ReactNode } from "react";
import type { Identifier } from "ra-core";
import { cn } from "@/lib/utils";
import { normalizePhoneForTel } from "@/lib/linking";
import { useCrmPhoneCall } from "@/modules/voice/useCrmPhoneCall";

type CrmPhoneLinkProps = {
  phone: string;
  contactId?: Identifier | null;
  dealId?: Identifier | null;
  conversationId?: Identifier | null;
  className?: string;
  title?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  stopPropagation?: boolean;
};

export const CrmPhoneLink = ({
  phone,
  contactId,
  dealId,
  conversationId,
  className,
  title,
  children,
  onClick,
  stopPropagation = true,
}: CrmPhoneLinkProps) => {
  const { display, e164 } = normalizePhoneForTel(phone);
  const { canCall, voiceReady, callPhone } = useCrmPhoneCall();

  if (!e164) {
    return <span className={className}>{children ?? display}</span>;
  }

  const callable = canCall && voiceReady;

  if (!callable) {
    return (
      <span className={className} title={title ?? display}>
        {children ?? display}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn("link-action", className)}
      title={title ?? display}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        onClick?.(event);
        void callPhone({ to: e164, contactId, dealId, conversationId });
      }}
    >
      {children ?? display}
    </button>
  );
};
