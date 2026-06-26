import type { Identifier } from "ra-core";
import { normalizePhoneForTel } from "@/lib/linking";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";

type CrmPhoneDisplayProps = {
  phone?: string | null;
  contactId?: Identifier | null;
  dealId?: Identifier | null;
  conversationId?: Identifier | null;
  className?: string;
  fallback?: string;
};

export const CrmPhoneDisplay = ({
  phone,
  contactId,
  dealId,
  conversationId,
  className,
  fallback = "—",
}: CrmPhoneDisplayProps) => {
  const raw = phone?.trim() ?? "";
  if (!raw || raw === "—") {
    return <>{fallback}</>;
  }

  const { display, e164 } = normalizePhoneForTel(raw);
  if (!e164) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <CrmPhoneLink
      phone={raw}
      contactId={contactId}
      dealId={dealId}
      conversationId={conversationId}
      className={className}
    >
      {display}
    </CrmPhoneLink>
  );
};
