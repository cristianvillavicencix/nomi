import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { isValidE164 } from "@/lib/e164";

type MemberPhoneStatusProps = {
  phone?: string | null;
  selected?: boolean;
};

export const MemberPhoneStatus = ({
  phone,
  selected,
}: MemberPhoneStatusProps) => {
  const trimmed = phone?.trim() ?? "";

  if (trimmed && isValidE164(trimmed)) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3 text-green-600" />
        {trimmed}
      </span>
    );
  }

  return (
    <span className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
      <span>
        No phone configured
        {selected
          ? " — will not receive SMS until they set one in Profile"
          : ""}
      </span>
    </span>
  );
};

export const hasConfiguredNotificationPhone = (phone?: string | null) =>
  Boolean(phone?.trim() && isValidE164(phone.trim()));
