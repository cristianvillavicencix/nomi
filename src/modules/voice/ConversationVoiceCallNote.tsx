import { ArrowDownLeft, ArrowUpRight, Phone } from "lucide-react";
import type { VoiceCall } from "@/modules/types";
import { formatMessageTime } from "@/modules/messages/conversationUtils";
import {
  buildVoiceCallTimelineLabel,
  getVoiceCallTimelineTimestamp,
} from "@/modules/voice/voiceCallTimeline";
import { cn } from "@/lib/utils";

export const ConversationVoiceCallNote = ({
  call,
  compact = false,
}: {
  call: VoiceCall;
  compact?: boolean;
}) => {
  const isInbound = call.direction === "inbound";
  const label = buildVoiceCallTimelineLabel(call);
  const timestamp = getVoiceCallTimelineTimestamp(call);

  return (
    <div className="flex justify-center py-1">
      <div
        className={cn(
          "inline-flex max-w-[min(92%,560px)] items-center gap-2 bg-muted/40 text-muted-foreground",
          compact
            ? "rounded-none px-2 py-0.5 text-[10px]"
            : "rounded-full px-3 py-1 text-xs",
        )}
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full",
            compact ? "size-4" : "size-5",
            isInbound ? "bg-emerald-500/10" : "bg-sky-500/10",
          )}
        >
          {isInbound ? (
            <ArrowDownLeft
              className={cn(
                "text-emerald-600",
                compact ? "size-2.5" : "size-3",
              )}
            />
          ) : (
            <ArrowUpRight
              className={cn("text-sky-600", compact ? "size-2.5" : "size-3")}
            />
          )}
        </span>
        <Phone
          className={cn("shrink-0 opacity-70", compact ? "size-2.5" : "size-3")}
          aria-hidden
        />
        <span>{label}</span>
        {timestamp ? (
          <span className="opacity-70">· {formatMessageTime(timestamp)}</span>
        ) : null}
      </div>
    </div>
  );
};
