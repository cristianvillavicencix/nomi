import { cn } from "@/lib/utils";
import {
  formatSmsLengthSummary,
  isSmsLengthOverLimit,
  isSmsLengthWarning,
  SMS_MAX_BODY_CHARS,
} from "@/modules/messages/smsMessageLimits";

export const SmsBodyLengthHint = ({
  body,
  className,
}: {
  body: string;
  className?: string;
}) => {
  const overLimit = isSmsLengthOverLimit(body);
  const warning = !overLimit && isSmsLengthWarning(body);

  if (body.length === 0) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        Max {SMS_MAX_BODY_CHARS.toLocaleString()} characters per SMS
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-[11px]",
        overLimit
          ? "font-medium text-destructive"
          : warning
            ? "text-warning"
            : "text-muted-foreground",
        className,
      )}
    >
      {formatSmsLengthSummary(body)}
      {overLimit
        ? " — shorten the message to send"
        : warning
          ? " — long messages may split into multiple texts"
          : null}
    </p>
  );
};
